import type { APIRoute } from 'astro';
import sql, {
  saveResponse, getTodaysQuestion, getTodaysResponse,
  saveSessionSummary, saveBurstSequence, getResponseCount,
  updateDeletionEvents, saveSessionEvents, saveSessionMetadata, getBurstSequence,
  enqueueSignalJob, SIGNAL_JOB_KIND,
} from '../../lib/libDb.ts';
import { logError } from '../../lib/utlErrorLog.ts';
import { getGitCommitHash } from '../../lib/utlGitCommit.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { coerceSessionSummary } from '../../lib/utlSessionSummary.ts';
import { computeSessionMetadata } from '../../lib/libSessionMetadata.ts';
import { ensureWorkerStarted } from '../../lib/libSignalWorker.ts';

// Background pipeline (prior-day delta, generation, witness, embed, derived
// signals) is enqueued as a durable job in tb_signal_jobs and executed by
// libSignalWorker. Pre-2026-04-25 this ran as a fire-and-forget async IIFE
// after the HTTP response, which silently lost signals on process crash.
// See GOTCHAS.md historical entry.

void ensureWorkerStarted();

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody<{ questionId: number; text: string; sessionSummary?: Record<string, unknown> }>(request);
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { questionId, text, sessionSummary } = body;

  if (!questionId || !text?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing questionId or text' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const question = await getTodaysQuestion();
  if (!question || question.question_id !== questionId) {
    return new Response(JSON.stringify({ error: 'Invalid question' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = await getTodaysResponse();
  if (existing) {
    return new Response(JSON.stringify({ error: 'Already responded today' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trimmedText = text.trim();

  // All DB writes in a single transaction via the tx handle, including the
  // signal job enqueue. The job row only exists if the response saved; the
  // response is never saved without its job row. Either both land or neither.
  let responseId: number;
  try {
    responseId = await sql.begin(async (tx) => {
      const responseId = await saveResponse(questionId, trimmedText, tx, {
        boundaryVersion: 'v1',
        codePathsRef: 'docs/contamination-boundary-v1.md',
        commitHash: getGitCommitHash(),
      });

      if (sessionSummary) {
        if (Array.isArray(sessionSummary.burstSequence) && sessionSummary.burstSequence.length > 0) {
          await saveBurstSequence(questionId, sessionSummary.burstSequence, tx);
        }

        if (Array.isArray(sessionSummary.eventLog) && sessionSummary.eventLog.length > 0) {
          await saveSessionEvents({
            question_id: questionId,
            event_log_json: JSON.stringify(sessionSummary.eventLog),
            total_events: sessionSummary.eventLog.length,
            session_duration_ms: sessionSummary.totalDurationMs ?? 0,
            keystroke_stream_json: Array.isArray(sessionSummary.keystrokeStream) && sessionSummary.keystrokeStream.length > 0
              ? JSON.stringify(sessionSummary.keystrokeStream)
              : null,
            total_input_events: sessionSummary.eventLogTotalInputs ?? null,
            decimation_count: 0,
          }, tx);
        }

        await saveSessionSummary(
          coerceSessionSummary(sessionSummary, sessionSummary.questionId, trimmedText),
          tx,
        );

        // Persist deletion event timing log — must run AFTER saveSessionSummary
        // since updateDeletionEvents is an UPDATE on the row it creates.
        if (Array.isArray(sessionSummary.deletionEvents)) {
          const compact = sessionSummary.deletionEvents.map((d: any) => ({
            c: Math.max(1, d.chars ?? d.c ?? 1),
            t: Math.max(0, d.time ?? d.t ?? 0),
          }));
          await updateDeletionEvents(questionId, JSON.stringify(compact), tx);
        }

        // Compute and persist slice-3 session metadata
        const burstsForMeta = await getBurstSequence(questionId, tx);
        const deletionEvents = Array.isArray(sessionSummary.deletionEvents)
          ? sessionSummary.deletionEvents.map((d: any) => ({
              c: Math.max(1, d.chars ?? d.c ?? 1),
              t: Math.max(0, d.time ?? d.t ?? 0),
            }))
          : [];
        const meta = await computeSessionMetadata({
          questionId,
          hourOfDay: sessionSummary.hourOfDay ?? null,
          totalDurationMs: sessionSummary.totalDurationMs ?? 0,
          deletionEvents,
          bursts: burstsForMeta,
        });
        await saveSessionMetadata(meta, tx);
      }

      // Enqueue the durable signal pipeline job inside this same transaction.
      // libSignalWorker drains tb_signal_jobs and runs the response pipeline.
      await enqueueSignalJob(
        { questionId, kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE },
        tx,
      );

      return responseId;
    });
  } catch (err) {
    logError('respond.transaction', err, { questionId });
    return new Response(JSON.stringify({ error: 'Failed to save session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const responseCount = await getResponseCount();

  // Determine if we should ask "did it land?" (every 5th daily response)
  const askFeedback = responseCount % 5 === 0;

  return new Response(JSON.stringify({ ok: true, askFeedback, questionId, responseId, responseCount }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
