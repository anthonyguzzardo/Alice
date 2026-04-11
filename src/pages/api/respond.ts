import type { APIRoute } from 'astro';
import { saveResponse, getTodaysQuestion, getTodaysResponse } from '../../lib/db.ts';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { questionId, text } = body;

  if (!questionId || !text?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing questionId or text' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const question = getTodaysQuestion();
  if (!question || question.question_id !== questionId) {
    return new Response(JSON.stringify({ error: 'Invalid question' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = getTodaysResponse();
  if (existing) {
    return new Response(JSON.stringify({ error: 'Already responded today' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  saveResponse(questionId, text.trim());

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
