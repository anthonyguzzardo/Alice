import type { APIRoute } from 'astro';
import { getTodaysQuestion, getTodaysResponse } from '../../lib/libDb.ts';
import { seedUpcomingQuestions } from '../../lib/libSchedule.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  try {
    // Ensure questions are seeded
    await seedUpcomingQuestions();

    const question = await getTodaysQuestion();
    const response = await getTodaysResponse();

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
