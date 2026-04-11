import type { APIRoute } from 'astro';
import { getTodaysQuestion, getTodaysResponse } from '../../lib/db.ts';
import { seedUpcomingQuestions } from '../../lib/schedule.ts';

export const GET: APIRoute = () => {
  // Ensure questions are seeded
  seedUpcomingQuestions();

  const question = getTodaysQuestion();
  const response = getTodaysResponse();

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
};
