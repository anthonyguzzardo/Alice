import type { APIRoute } from 'astro';
import { logInteractionEvent, OWNER_SUBJECT_ID } from '../../lib/libDb.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const POST: APIRoute = async ({ request }) => {
  // Owner-only. Subjects don't hit this endpoint.
  const subjectId = OWNER_SUBJECT_ID;
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
    await logInteractionEvent(subjectId, questionId, eventType, metadata);
  } catch (err) {
    logError('api.event', err, { subjectId, questionId, eventType });
    return new Response(JSON.stringify({ error: 'Failed to log event' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
