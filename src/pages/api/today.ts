import type { APIRoute } from 'astro';
import { OWNER_SUBJECT_ID } from '../../lib/libDb.ts';
import { getOrCreateTodayQuestion } from '../../lib/libQuestionFlow.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  // Owner journal endpoint (Caddy basic-auth gated). Subject path is /api/subject/today.
  try {
    const today = await getOrCreateTodayQuestion(OWNER_SUBJECT_ID);

    return new Response(JSON.stringify({
      question: { id: today.questionId, text: today.text },
      response: today.existingResponseText !== null
        ? { text: today.existingResponseText }
        : null,
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
