import type { APIRoute } from 'astro';
import { logInteractionEvent } from '../../lib/db.ts';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { questionId, eventType, metadata } = body;

  if (!questionId || !eventType) {
    return new Response(JSON.stringify({ error: 'Missing questionId or eventType' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await logInteractionEvent(questionId, eventType, metadata);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
