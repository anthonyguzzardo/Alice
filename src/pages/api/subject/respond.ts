/**
 * POST /api/subject/respond
 *
 * Saves a subject's journal response and session summary.
 * Subjects only — owner gets 403.
 *
 * ============================================================================
 * CONTAMINATION BOUNDARY — READ BEFORE EDITING
 * ============================================================================
 * This handler must NEVER trigger:
 *   - runGeneration()          — LLM call, owner-only
 *   - runCalibrationExtraction() — LLM call, owner-only
 *   - embedResponse()          — writes to owner RAG corpus, owner-only
 *   - computeAndPersistDerivedSignals() — writes to owner signal tables, owner-only
 *   - computePriorDayDelta()   — owner signal pipeline, owner-only
 *   - enqueueSignalJob()       — drives the same pipelines via the worker
 *
 * The subject response path does EXACTLY:
 *   1. Validate identity (must be active non-owner subject)
 *   2. Validate scheduled question (must be this subject's corpus draw for today)
 *   3. Save text to tb_responses (subject_id-scoped, encrypted at rest)
 *   4. Save session summary to tb_session_summaries
 *   5. Return success
 *
 * NO background tasks. NO fire-and-forget. NO LLM calls. NO signal writes.
 * No `enqueueSignalJob` call: subject sessions deliberately do not produce
 * derived signals, embeddings, or daily deltas. If you are adding code after
 * the transaction commit, you are probably violating this boundary. Stop and
 * verify.
 *
 * Storage (post migration 032): writes hit unified `tb_responses` and
 * `tb_session_summaries` tables (each carrying `subject_id NOT NULL` from
 * migration 030). The legacy `tb_subject_responses` and
 * `tb_subject_session_summaries` tables were dropped in Step 9. The wire
 * field carrying the question key was renamed `scheduled_question_id →
 * question_id` to match the unified schema.
 * ============================================================================
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDbPool.ts';
import { getScheduledQuestion } from '../../../lib/libScheduler.ts';
import {
  saveResponse,
  saveSessionSummary,
  getResponseText,
} from '../../../lib/libDb.ts';
import { localDateStr } from '../../../lib/utlDate.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';
import { coerceSessionSummary } from '../../../lib/utlSessionSummary.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

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
  // subject, and is for today.
  const today = localDateStr();
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
      }

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

  // NO BACKGROUND TASKS. The response ends here. See contamination boundary above.

  return new Response(JSON.stringify({
    response_id: responseId,
    accepted: true,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
