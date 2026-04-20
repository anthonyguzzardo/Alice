import type { APIRoute } from 'astro';
import { logInteractionEvent } from '../../lib/libDb.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody<{ questionId: number; eventType: string; metadata?: string | Record<string, unknown> }>(request);
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { questionId, eventType, metadata } = body;

  if (!questionId || !eventType) {
    return new Response(JSON.stringify({ error: 'Missing questionId or eventType' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await logInteractionEvent(questionId, eventType, metadata);
  } catch (err) {
    logError('api.event', err, { questionId, eventType });
    return new Response(JSON.stringify({ error: 'Failed to log event' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
