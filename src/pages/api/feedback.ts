import type { APIRoute } from 'astro';
import { saveQuestionFeedback, OWNER_SUBJECT_ID } from '../../lib/libDb.ts';
import { parseBody } from '../../lib/utlParseBody.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const POST: APIRoute = async ({ request }) => {
  // Owner journal feedback (Caddy basic-auth gated).
  // TODO(step5): review.
  const subjectId = OWNER_SUBJECT_ID;
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
    await saveQuestionFeedback(subjectId, questionId, landed);
  } catch (err) {
    logError('api.feedback', err, { subjectId, questionId });
    return new Response(JSON.stringify({ error: 'Failed to save feedback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
