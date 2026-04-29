/**
 * GET  /api/subject/calibrate  — returns a random calibration prompt for the subject.
 * POST /api/subject/calibrate  — saves a calibration session and enqueues the pipeline.
 *
 * Symmetric with `/api/calibrate` (owner) as of INC-023 (2026-04-29). The
 * prior asymmetric "no derivation for subjects" rule was an over-stated
 * boundary that produced perpetual drift-snapshot pileup for every non-owner
 * subject. The actual contamination constraint is narrower:
 *
 *   - NO synchronous LLM/Anthropic call (none exist in any submission path).
 *   - Embed defers when TEI is offline (prod has no TEI; the worker logs
 *     and skips, drained later via `npm run embed`).
 *
 * Calibration pipeline (`runCalibrationPipeline` in libSignalWorker) computes
 * derived signals + drift baseline. Both pure compute. Subjects always have
 * unlimited calibration access — UI surfaces it from the journal done-screen
 * and the "no question today" fallback.
 */

import type { APIRoute } from 'astro';
import {
  saveCalibrationSession,
  getUsedCalibrationPrompts,
  getCalibrationPromptsByRecency,
  SIGNAL_JOB_KIND,
} from '../../../lib/libDb.ts';
import { CALIBRATION_PROMPTS } from '../../../lib/libCalibrationPrompts.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';
import { coerceSessionSummary } from '../../../lib/utlSessionSummary.ts';
import { logError } from '../../../lib/utlErrorLog.ts';
import { ensureWorkerStarted } from '../../../lib/libSignalWorker.ts';

void ensureWorkerStarted();

export const GET: APIRoute = async ({ locals }) => {
  // Middleware guarantees this is non-null + non-owner + reset complete.
  const subject = locals.subject!;

  // Same selection policy as the owner endpoint: prefer fresh prompts; on
  // exhaustion, draw from the oldest quartile of repeats for max temporal
  // spacing. Subjects walk the same shared CALIBRATION_PROMPTS pool.
  const used = new Set(await getUsedCalibrationPrompts(subject.subject_id));
  const available = CALIBRATION_PROMPTS.filter(p => !used.has(p));

  let prompt: string;
  if (available.length > 0) {
    prompt = available[Math.floor(Math.random() * available.length)]!;
  } else {
    const byRecency = await getCalibrationPromptsByRecency(subject.subject_id);
    const stillInPool = byRecency.filter(p => used.has(p) && CALIBRATION_PROMPTS.includes(p));
    const quartile = Math.max(1, Math.floor(stillInPool.length / 4));
    const oldest = stillInPool.slice(0, quartile);
    prompt = oldest.length > 0
      ? oldest[Math.floor(Math.random() * oldest.length)]!
      : CALIBRATION_PROMPTS[Math.floor(Math.random() * CALIBRATION_PROMPTS.length)]!;
  }

  return new Response(JSON.stringify({ prompt }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const subject = locals.subject!;

  const body = await parseBody<{
    prompt: string;
    text: string;
    sessionSummary: Record<string, unknown>;
  }>(request);
  if (!body) {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { prompt, text, sessionSummary } = body;

  if (!prompt || !text?.trim() || !sessionSummary) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trimmedText = text.trim();
  // questionId is unknown until insert — pass 0 as a placeholder; libDb
  // overwrites it inside the transaction once the calibration question row
  // is created. Mirrors how owner /api/calibrate uses the same helper.
  const coerced = coerceSessionSummary(subject.subject_id, sessionSummary, 0, trimmedText);

  // Persist raw measurement input alongside the response so owner-driven
  // local-mode analysis can later compute signals + drift baselines for this
  // subject without needing to round-trip the original session.
  const events = Array.isArray(sessionSummary.eventLog) && sessionSummary.eventLog.length > 0
    ? {
        subject_id: subject.subject_id,
        event_log_json: JSON.stringify(sessionSummary.eventLog),
        total_events: sessionSummary.eventLog.length,
        session_duration_ms: (sessionSummary.totalDurationMs as number) ?? 0,
        keystroke_stream_json:
          Array.isArray(sessionSummary.keystrokeStream) && sessionSummary.keystrokeStream.length > 0
            ? JSON.stringify(sessionSummary.keystrokeStream)
            : null,
      }
    : undefined;

  let questionId: number;
  try {
    questionId = await saveCalibrationSession(subject.subject_id, prompt, trimmedText, coerced, {
      attestation: {
        boundaryVersion: 'v1',
        codePathsRef: 'docs/contamination-boundary-v1.md',
        commitHash: 'pre-attestation',
      },
      events,
      signalJob: {
        kindId: SIGNAL_JOB_KIND.CALIBRATION_PIPELINE,
        params: { deviceType: (sessionSummary as { deviceType?: string | null }).deviceType ?? null },
      },
    });
  } catch (err) {
    logError('subject-calibrate.transaction', err, {
      subjectId: subject.subject_id,
    });
    return new Response(JSON.stringify({ error: 'save_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, questionId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
