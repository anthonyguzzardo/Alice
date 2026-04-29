/**
 * POST /api/subject/respond
 *
 * Saves a subject's journal response and session summary, then enqueues the
 * signal pipeline. Symmetric with `/api/respond` (owner) as of INC-023
 * (2026-04-29) — the prior asymmetric "no derivation for subjects" rule was
 * an over-stated boundary that produced perpetual daily-delta pileup for
 * every non-owner subject. The actual contamination constraint is narrower:
 *
 *   - NO synchronous LLM/Anthropic call (none exist in any submission path
 *     anyway; question generation lives in the operator-run corpus refresh).
 *   - Embed defers when TEI is offline. Prod has no TEI; the worker logs
 *     and skips, then `npm run embed` drains later from the operator's
 *     laptop. Same behavior owner has had since Phase 4.
 *
 * Daily delta + Rust signal compute run on prod for everyone. Both are pure
 * (DB + math, or napi-loaded `.node` binary) — no external services, no
 * privacy or contamination cost.
 *
 * Subjects only — middleware guarantees this is a non-owner active session
 * past the consent + must-reset gates. Owner posts to `/api/respond`.
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDbPool.ts';
import { getScheduledQuestion } from '../../../lib/libScheduler.ts';
import {
  saveResponse,
  saveSessionSummary,
  saveSessionEvents,
  getResponseText,
  enqueueSignalJob,
  SIGNAL_JOB_KIND,
} from '../../../lib/libDb.ts';
import { localDateStr } from '../../../lib/utlDate.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';
import { coerceSessionSummary } from '../../../lib/utlSessionSummary.ts';
import { logError } from '../../../lib/utlErrorLog.ts';
import { ensureWorkerStarted } from '../../../lib/libSignalWorker.ts';

// Boot the durable signal worker on first import. Idempotent (HMR-safe via
// globalThis flag in libSignalWorker). The worker drains tb_signal_jobs and
// runs the response pipeline (daily delta → embed-when-TEI-up → derived
// signals) for both owner and subject jobs.
void ensureWorkerStarted();

export const POST: APIRoute = async ({ request, locals }) => {
  // Middleware guarantees this is non-null + non-owner + reset complete.
  const subject = locals.subject!;

  const body = await parseBody<{
    question_id: number;
    text: string;
    sessionSummary?: Record<string, unknown>;
  }>(request);

  if (!body) {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { question_id, text, sessionSummary } = body;

  if (!question_id || !text?.trim()) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate: the corpus-drawn scheduled question exists, belongs to this
  // subject, and is for today (in the subject's local TZ — calendar flip
  // happens at subject midnight, not server midnight).
  const today = localDateStr(new Date(), subject.iana_timezone);
  const scheduled = await getScheduledQuestion(subject.subject_id, today);

  if (!scheduled || scheduled.question_id !== question_id) {
    return new Response(JSON.stringify({ error: 'invalid_question' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check for existing response — submission is final, no edits.
  const existingText = await getResponseText(subject.subject_id, question_id);
  if (existingText !== null) {
    return new Response(JSON.stringify({ error: 'already_responded' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trimmedText = text.trim();

  // Transaction: save response + session summary atomically.
  let responseId: number;
  try {
    responseId = await sql.begin(async (tx) => {
      const rid = await saveResponse(
        subject.subject_id,
        question_id,
        trimmedText,
        tx,
      );

      if (sessionSummary) {
        await saveSessionSummary(
          coerceSessionSummary(subject.subject_id, sessionSummary, question_id, trimmedText),
          tx,
        );

        // Persist raw measurement input (event log + keystroke stream,
        // encrypted at rest via libDb). Mirrors the owner journal path.
        // Required so signal recomputation is possible if a formula changes.
        const eventLog = (sessionSummary as Record<string, unknown>).eventLog;
        const keystrokeStream = (sessionSummary as Record<string, unknown>).keystrokeStream;
        const totalDurationMs = (sessionSummary as Record<string, unknown>).totalDurationMs;
        const eventLogTotalInputs = (sessionSummary as Record<string, unknown>).eventLogTotalInputs;
        if (Array.isArray(eventLog) && eventLog.length > 0) {
          await saveSessionEvents({
            subject_id: subject.subject_id,
            question_id,
            event_log_json: JSON.stringify(eventLog),
            total_events: eventLog.length,
            session_duration_ms: typeof totalDurationMs === 'number' ? totalDurationMs : 0,
            keystroke_stream_json: Array.isArray(keystrokeStream) && keystrokeStream.length > 0
              ? JSON.stringify(keystrokeStream)
              : null,
            total_input_events: typeof eventLogTotalInputs === 'number' ? eventLogTotalInputs : null,
            decimation_count: 0,
          }, tx);
        }
      }

      // Enqueue the durable signal pipeline job inside the same transaction
      // as the response save. Either both land or neither — no orphaned
      // submission without its job, no orphan job without its session.
      await enqueueSignalJob(
        {
          subjectId: subject.subject_id,
          questionId: question_id,
          kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
        },
        tx,
      );

      return rid;
    });
  } catch (err) {
    logError('subject-respond.transaction', err, {
      subjectId: subject.subject_id,
      questionId: question_id,
    });
    return new Response(JSON.stringify({ error: 'save_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    response_id: responseId,
    accepted: true,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
