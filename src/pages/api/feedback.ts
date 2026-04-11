import type { APIRoute } from 'astro';
import { saveQuestionFeedback } from '../../lib/db.ts';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { questionId, landed } = body;

  if (!questionId || typeof landed !== 'boolean') {
    return new Response(JSON.stringify({ error: 'Missing questionId or landed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  saveQuestionFeedback(questionId, landed);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
