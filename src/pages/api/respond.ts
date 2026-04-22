import type { APIRoute } from 'astro';
import sql, {
  saveResponse, getTodaysQuestion, getTodaysResponse,
  saveSessionSummary, saveBurstSequence, getResponseCount,
  updateDeletionEvents, saveSessionEvents, saveSessionMetadata, getBurstSequence,
} from '../../lib/libDb.ts';
import { runGeneration } from '../../lib/libGenerate.ts';
import { embedResponse } from '../../lib/libEmbeddings.ts';
import { logError } from '../../lib/utlErrorLog.ts';
import { localDateStr } from '../../lib/utlDate.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { coerceSessionSummary } from '../../lib/utlSessionSummary.ts';
import { renderWitnessState } from '../../lib/libAliceNegative/libRenderWitness.ts';
import { computeSessionMetadata } from '../../lib/libSessionMetadata.ts';
import { computeAndPersistDerivedSignals } from '../../lib/libSignalPipeline.ts';

// Note: runObservation (three-frame + prediction + suppressed question) and
// runReflection (weekly narrative) removed 2026-04-16 in interpretive-layer
// restructure. The background pipeline now only generates tomorrow's question
// and renders the witness state.

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

  // All DB writes in a single transaction via the tx handle.
  // Every write function receives tx so it runs on the transaction
  // connection, not the module-level pool.
  let responseId: number;
  try {
    responseId = await sql.begin(async (tx) => {
      const responseId = await saveResponse(questionId, trimmedText, tx);

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

      return responseId;
    });
  } catch (err) {
    logError('respond.transaction', err, { questionId });
    return new Response(JSON.stringify({ error: 'Failed to save session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fire-and-forget: embed the new response for RAG retrieval
  embedResponse(responseId, question.text, trimmedText, localDateStr())
    .catch(err => logError('respond.embed', err, { responseId, questionId }));

  const responseCount = await getResponseCount();

  // Determine if we should ask "did it land?" (every 5th daily response)
  const askFeedback = responseCount % 5 === 0;

  // Background pipeline — each stage runs independently so one failure
  // cannot silently skip the others. Each error lands in data/errors.log
  // tagged with its stage so you can see exactly what broke.
  (async () => {
    const ctx = { questionId, responseId, responseCount };
    try { await runGeneration(); }
    catch (err) { logError('respond.generation', err, ctx); }

    try { await renderWitnessState(); }
    catch (err) { logError('respond.witness', err, ctx); }

    try { await computeAndPersistDerivedSignals(questionId); }
    catch (err) { logError('respond.derived-signals', err, ctx); }
  })();

  return new Response(JSON.stringify({ ok: true, askFeedback, questionId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
