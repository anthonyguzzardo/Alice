import type { APIRoute } from 'astro';
import { getTodaysQuestion, getTodaysResponse, OWNER_SUBJECT_ID } from '../../lib/libDb.ts';
import { seedUpcomingQuestions } from '../../lib/libSchedule.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  // Owner journal endpoint (Caddy basic-auth gated). Subject path is /api/subject/today.
  // TODO(step5): review.
  const subjectId = OWNER_SUBJECT_ID;
  try {
    // Ensure questions are seeded
    await seedUpcomingQuestions(subjectId);

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
