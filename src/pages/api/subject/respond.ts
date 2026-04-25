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
 *   - renderWitnessState()     — LLM call, owner-only
 *   - runCalibrationExtraction() — LLM call, owner-only
 *   - embedResponse()          — writes to owner RAG corpus, owner-only
 *   - computeAndPersistDerivedSignals() — writes to owner signal tables, owner-only
 *   - computePriorDayDelta()   — owner signal pipeline, owner-only
 *
 * The subject response path does EXACTLY:
 *   1. Validate identity (must be active non-owner subject)
 *   2. Validate scheduled question (must belong to this subject, for today)
 *   3. Save text to tb_subject_responses
 *   4. Save session summary to tb_subject_session_summaries
 *   5. Return success
 *
 * NO background tasks. NO fire-and-forget. NO LLM calls. NO signal writes.
 * If you are adding code after the transaction commit, you are probably
 * violating this boundary. Stop and verify.
 * ============================================================================
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDbPool.ts';
import { getRequestSubject } from '../../../lib/libSubject.ts';
import { getScheduledQuestion } from '../../../lib/libScheduler.ts';
import {
  saveSubjectResponse,
  getSubjectResponse,
  saveSubjectSessionSummary,
} from '../../../lib/libDb.ts';
import { localDateStr } from '../../../lib/utlDate.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';
import { coerceSessionSummary } from '../../../lib/utlSessionSummary.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const POST: APIRoute = async ({ request }) => {
  const subject = await getRequestSubject(request);
  if (!subject) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (subject.is_owner) {
    return new Response(JSON.stringify({ error: 'owner_use_main_path' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await parseBody<{
    scheduled_question_id: number;
    text: string;
    sessionSummary?: Record<string, unknown>;
  }>(request);

  if (!body) {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { scheduled_question_id, text, sessionSummary } = body;

  if (!scheduled_question_id || !text?.trim()) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate: the scheduled question exists, belongs to this subject, and is for today
  const today = localDateStr();
  const scheduled = await getScheduledQuestion(subject.subject_id, today);

  if (!scheduled || scheduled.scheduled_question_id !== scheduled_question_id) {
    return new Response(JSON.stringify({ error: 'invalid_scheduled_question' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check for existing response — submission is final, no edits
  const existing = await getSubjectResponse(scheduled_question_id);
  if (existing) {
    return new Response(JSON.stringify({ error: 'already_responded' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trimmedText = text.trim();

  // Transaction: save response + session summary atomically
  let responseId: number;
  try {
    responseId = await sql.begin(async (tx) => {
      const rid = await saveSubjectResponse(
        subject.subject_id,
        scheduled_question_id,
        trimmedText,
        tx,
      );

      if (sessionSummary) {
        await saveSubjectSessionSummary(
          subject.subject_id,
          scheduled_question_id,
          coerceSessionSummary(sessionSummary, 0, trimmedText),
          tx,
        );
      }

      return rid;
    });
  } catch (err) {
    logError('subject-respond.transaction', err, {
      subjectId: subject.subject_id,
      scheduledQuestionId: scheduled_question_id,
    });
    return new Response(JSON.stringify({ error: 'save_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // NO BACKGROUND TASKS. The response ends here. See contamination boundary above.

  return new Response(JSON.stringify({
    subject_response_id: responseId,
    accepted: true,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
