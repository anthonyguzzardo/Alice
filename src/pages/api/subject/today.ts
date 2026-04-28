/**
 * GET /api/subject/today
 *
 * Returns today's scheduled question for the authenticated subject.
 *
 * Auth: middleware has verified the session, attached `locals.subject`,
 * rejected owner accounts, and gated `must_reset_password = TRUE`. By the
 * time this handler runs, `locals.subject` is non-null, non-owner, and has
 * a real password set.
 *
 * Storage: post migration 032 the subject's daily question is a row in the
 * unified `tb_questions` table (`question_source_id = 4`, `corpus_question_id`
 * pointing to `tb_question_corpus`). The legacy `tb_scheduled_questions`
 * table was dropped in Step 9 of the schema unification. The wire field
 * carrying the question's surrogate key was renamed `scheduled_question_id
 * → question_id` to match the unified schema.
 */
import type { APIRoute } from 'astro';
import { getScheduledQuestion } from '../../../lib/libScheduler.ts';
import { getResponseText } from '../../../lib/libDb.ts';
import { localDateStr } from '../../../lib/utlDate.ts';

export const GET: APIRoute = async ({ locals }) => {
  // Middleware guarantees this is non-null + non-owner + reset complete.
  const subject = locals.subject!;

  const today = localDateStr(new Date(), subject.iana_timezone);
  const scheduled = await getScheduledQuestion(subject.subject_id, today);

  if (!scheduled) {
    return new Response(JSON.stringify({ error: 'no_question_scheduled' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existingText = await getResponseText(subject.subject_id, scheduled.question_id);

  return new Response(JSON.stringify({
    question_id: scheduled.question_id,
    text: scheduled.text,
    theme_tag: scheduled.theme_tag,
    scheduled_for: scheduled.scheduled_for,
    existing_response_text: existingText ?? null,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
