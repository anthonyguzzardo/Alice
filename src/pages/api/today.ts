import type { APIRoute } from 'astro';
import { getTodaysQuestion, getTodaysResponse, OWNER_SUBJECT_ID } from '../../lib/libDb.ts';
import { seedUpcomingQuestions } from '../../lib/libSchedule.ts';
import { getSubjectById } from '../../lib/libSubject.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  // Owner journal endpoint (Caddy basic-auth gated). Subject path is /api/subject/today.
  const subjectId = OWNER_SUBJECT_ID;
  try {
    const owner = await getSubjectById(subjectId);
    if (!owner) throw new Error(`api.today: no tb_subjects row for owner subject_id=${subjectId}`);
    await seedUpcomingQuestions(subjectId, owner.iana_timezone);

    const question = await getTodaysQuestion(subjectId);
    const response = await getTodaysResponse(subjectId);

    if (!question) {
      return new Response(JSON.stringify({ error: 'No question for today' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      question: { id: question.question_id, text: question.text },
      response: response ? { text: response.text } : null,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.today', err);
    return new Response(JSON.stringify({ error: 'Failed to load today' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
