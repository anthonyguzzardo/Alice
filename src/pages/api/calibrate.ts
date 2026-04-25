import type { APIRoute } from 'astro';
import { saveCalibrationSession, getUsedCalibrationPrompts, getCalibrationPromptsByRecency } from '../../lib/libDb.ts';
import { CALIBRATION_PROMPTS } from '../../lib/libCalibrationPrompts.ts';
import { runCalibrationExtraction } from '../../lib/libCalibrationExtract.ts';
import { snapshotCalibrationBaselinesAfterSubmit } from '../../lib/libCalibrationDrift.ts';
import { computeAndPersistDerivedSignals } from '../../lib/libSignalPipeline.ts';
import { logError } from '../../lib/utlErrorLog.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { getGitCommitHash } from '../../lib/utlGitCommit.ts';
import { coerceSessionSummary } from '../../lib/utlSessionSummary.ts';

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

  // Event log + keystroke stream persisted atomically with the calibration
  // session inside saveCalibrationSession's transaction. Either both land or
  // neither does — calibration sessions cannot exist without their measurement
  // input.
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

  const questionId = await saveCalibrationSession(
    prompt,
    trimmedText,
    coerced,
    {
      boundaryVersion: 'v1',
      codePathsRef: 'docs/contamination-boundary-v1.md',
      commitHash: getGitCommitHash(),
    },
    events,
  );

  // Fire-and-forget: extract life-context tags from calibration response text.
  // Non-blocking — extraction failure never prevents calibration from succeeding.
  void runCalibrationExtraction(questionId, text.trim(), prompt).catch((err) =>
    logError('calibrate.extraction', err, { questionId })
  );

  // Fire-and-forget: compute derived signals (motor, semantic, process, cross-session)
  try { await computeAndPersistDerivedSignals(questionId); }
  catch (err) { logError('calibrate.derived-signals', err, { questionId }); }

  // Snapshot calibration baselines after this submission so drift can be
  // tracked over time. Pure deterministic, fire-and-forget.
  try {
    await snapshotCalibrationBaselinesAfterSubmit(sessionSummary.deviceType ?? null);
  } catch (err) {
    logError('calibrate.driftSnapshot', err, { questionId });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
