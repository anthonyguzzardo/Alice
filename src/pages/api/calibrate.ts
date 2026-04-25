import type { APIRoute } from 'astro';
import {
  saveCalibrationSession,
  getUsedCalibrationPrompts,
  getCalibrationPromptsByRecency,
  SIGNAL_JOB_KIND,
} from '../../lib/libDb.ts';
import { CALIBRATION_PROMPTS } from '../../lib/libCalibrationPrompts.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { getGitCommitHash } from '../../lib/utlGitCommit.ts';
import { coerceSessionSummary } from '../../lib/utlSessionSummary.ts';
import { ensureWorkerStarted } from '../../lib/libSignalWorker.ts';

// Background pipeline (extraction + derived signals + drift snapshot) is
// enqueued in tb_signal_jobs by saveCalibrationSession and executed by
// libSignalWorker. Pre-2026-04-25 these stages ran fire-and-forget after
// the HTTP response. See GOTCHAS.md historical entry.

void ensureWorkerStarted();

export const GET: APIRoute = async () => {
  const used = new Set(await getUsedCalibrationPrompts());
  const available = CALIBRATION_PROMPTS.filter(p => !used.has(p));

  let prompt: string;
  if (available.length > 0) {
    // Fresh prompts remain — pick randomly
    prompt = available[Math.floor(Math.random() * available.length)];
  } else {
    // Pool exhausted — prefer prompts used longest ago for max temporal spacing.
    // Pick randomly from the oldest quartile so repeat pairs stay spread out.
    const byRecency = await getCalibrationPromptsByRecency();
    const stillInPool = byRecency.filter(p => used.has(p) && CALIBRATION_PROMPTS.includes(p));
    const quartile = Math.max(1, Math.floor(stillInPool.length / 4));
    const oldest = stillInPool.slice(0, quartile);
    prompt = oldest.length > 0
      ? oldest[Math.floor(Math.random() * oldest.length)]
      : CALIBRATION_PROMPTS[Math.floor(Math.random() * CALIBRATION_PROMPTS.length)];
  }

  return new Response(JSON.stringify({ prompt }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody<{ prompt: string; text: string; sessionSummary: Record<string, unknown> }>(request);
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { prompt, text, sessionSummary } = body;

  if (!prompt || !text?.trim() || !sessionSummary) {
    return new Response(JSON.stringify({ error: 'Missing prompt, text, or sessionSummary' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trimmedText = text.trim();
  const coerced = coerceSessionSummary(sessionSummary, 0, trimmedText);

  // Event log + keystroke stream and the signal-pipeline job are all persisted
  // atomically inside saveCalibrationSession's transaction. Either the session,
  // its measurement input, AND its job all land, or none do. The worker
  // (libSignalWorker) drains tb_signal_jobs and runs the calibration pipeline
  // (extraction + derived signals + drift snapshot).
  const events = Array.isArray(sessionSummary.eventLog) && sessionSummary.eventLog.length > 0
    ? {
        event_log_json: JSON.stringify(sessionSummary.eventLog),
        total_events: sessionSummary.eventLog.length,
        session_duration_ms: sessionSummary.totalDurationMs ?? 0,
        keystroke_stream_json: Array.isArray(sessionSummary.keystrokeStream) && sessionSummary.keystrokeStream.length > 0
          ? JSON.stringify(sessionSummary.keystrokeStream)
          : null,
      }
    : undefined;

  const questionId = await saveCalibrationSession(prompt, trimmedText, coerced, {
    attestation: {
      boundaryVersion: 'v1',
      codePathsRef: 'docs/contamination-boundary-v1.md',
      commitHash: getGitCommitHash(),
    },
    events,
    signalJob: {
      kindId: SIGNAL_JOB_KIND.CALIBRATION_PIPELINE,
      params: { deviceType: sessionSummary.deviceType ?? null },
    },
  });

  return new Response(JSON.stringify({ ok: true, questionId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
