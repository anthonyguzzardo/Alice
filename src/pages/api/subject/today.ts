/**
 * GET /api/subject/today
 *
 * Returns today's question for the authenticated subject. If today's row does
 * not exist, draws the next unseen corpus row, creates the row, returns it.
 * If the subject has already answered today (in their own timezone), returns
 * the same row with `existing_response_text` set so the UI renders the
 * locked-until-tomorrow state.
 *
 * Auth: middleware has verified the session, attached `locals.subject`,
 * rejected owner accounts, and gated `must_reset_password = TRUE`.
 */
import type { APIRoute } from 'astro';
import { getOrCreateTodayQuestion } from '../../../lib/libQuestionFlow.ts';

export const GET: APIRoute = async ({ locals }) => {
  const subject = locals.subject!;
  const today = await getOrCreateTodayQuestion(subject.subject_id);

  return new Response(JSON.stringify({
    question_id: today.questionId,
    text: today.text,
    theme_tag: today.themeTag,
    scheduled_for: today.scheduledFor,
    existing_response_text: today.existingResponseText,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
