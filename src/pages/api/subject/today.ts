/**
 * GET /api/subject/today
 *
 * Returns today's scheduled question for an authenticated subject.
 * Subjects only — owner gets 403.
 */
import type { APIRoute } from 'astro';
import { getRequestSubject } from '../../../lib/libSubject.ts';
import { getScheduledQuestion } from '../../../lib/libScheduler.ts';
import { getSubjectResponse } from '../../../lib/libDb.ts';
import { localDateStr } from '../../../lib/utlDate.ts';

export const GET: APIRoute = async ({ request }) => {
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
