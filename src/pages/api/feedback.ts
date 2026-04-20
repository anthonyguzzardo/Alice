import type { APIRoute } from 'astro';
import { saveQuestionFeedback } from '../../lib/libDb.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody<{ questionId: number; landed: boolean }>(request);
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { questionId, landed } = body;

  if (!questionId || typeof landed !== 'boolean') {
    return new Response(JSON.stringify({ error: 'Missing questionId or landed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await saveQuestionFeedback(questionId, landed);
  } catch (err) {
    logError('api.feedback', err, { questionId });
    return new Response(JSON.stringify({ error: 'Failed to save feedback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
