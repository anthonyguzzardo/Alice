/**
 * GET  /api/subject/calibrate  — returns a random calibration prompt for the subject.
 * POST /api/subject/calibrate  — saves a calibration session (prompt + response).
 *
 * ============================================================================
 * CONTAMINATION BOUNDARY — READ BEFORE EDITING
 * ============================================================================
 * This handler must NEVER trigger:
 *   - runCalibrationExtraction()             — LLM, owner-only
 *   - embedResponse()                        — TEI/Qwen, owner-only (local-mode draining)
 *   - computeAndPersistDerivedSignals()      — Rust pipeline, owner-only on prod
 *   - snapshotCalibrationBaselinesAfterSubmit() — owner drift signal
 *   - enqueueSignalJob()                     — would drive any of the above via the worker
 *
 * The subject calibration path does EXACTLY:
 *   1. Validate identity (must be active non-owner subject)
 *   2. Pick or accept a calibration prompt
 *   3. Save tb_questions (source_id=3) + tb_responses + tb_session_summaries
 *      + tb_session_events (raw keystroke + event log, encrypted) atomically
 *   4. Return success
 *
 * NO LLM. NO embedding. NO signal pipeline. NO drift snapshot.
 *
 * Architectural note: subjects must always have unlimited calibration access.
 * Raw measurement input (event log + keystroke stream) is persisted encrypted
 * so the owner can drain pending analysis later via local-mode `npm run dev:full`
 * — that is where the LLM extraction + signal computation happens, off-prod.
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import {
  saveCalibrationSession,
  getUsedCalibrationPrompts,
  getCalibrationPromptsByRecency,
} from '../../../lib/libDb.ts';
import { CALIBRATION_PROMPTS } from '../../../lib/libCalibrationPrompts.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';
import { coerceSessionSummary } from '../../../lib/utlSessionSummary.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

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
    // No `signalJob` — the contamination boundary forbids enqueueing on prod
    // for subjects. Owner local-mode picks up these rows via the pending-work
    // notification flow (separate feature) and drains them off-prod.
    questionId = await saveCalibrationSession(subject.subject_id, prompt, trimmedText, coerced, {
      attestation: {
        boundaryVersion: 'v1',
        codePathsRef: 'docs/contamination-boundary-v1.md',
        commitHash: 'pre-attestation',
      },
      events,
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
