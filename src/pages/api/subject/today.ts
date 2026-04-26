/**
 * GET /api/subject/today
 *
 * Returns today's scheduled question for the authenticated subject.
 *
 * Auth: middleware has verified the session, attached `locals.subject`,
 * rejected owner accounts, and gated `must_reset_password = TRUE`. By the
 * time this handler runs, `locals.subject` is non-null, non-owner, and has
 * a real password set.
 */
import type { APIRoute } from 'astro';
import { getScheduledQuestion } from '../../../lib/libScheduler.ts';
import { getSubjectResponse } from '../../../lib/libDb.ts';
import { localDateStr } from '../../../lib/utlDate.ts';

export const GET: APIRoute = async ({ locals }) => {
  // Middleware guarantees this is non-null + non-owner + reset complete.
  const subject = locals.subject!;

  const today = localDateStr();
  const scheduled = await getScheduledQuestion(subject.subject_id, today);

  if (!scheduled) {
    return new Response(JSON.stringify({ error: 'no_question_scheduled' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = await getSubjectResponse(scheduled.scheduled_question_id);

  return new Response(JSON.stringify({
    scheduled_question_id: scheduled.scheduled_question_id,
    text: scheduled.text,
    theme_tag: scheduled.theme_tag,
    scheduled_for: scheduled.scheduled_for,
    existing_response_text: existing?.text ?? null,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
