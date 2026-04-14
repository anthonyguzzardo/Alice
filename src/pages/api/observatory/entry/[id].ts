/**
 * Observatory Entry API
 *
 * Returns everything about a single entry: 8D state, session metrics,
 * AI observation (three frames), predictions, and suppressed question.
 */
import type { APIRoute } from 'astro';
import db, {
  getEntryStateByResponseId,
  getSessionSummary,
  getObservationForQuestion,
  getSuppressedQuestionForQuestion,
  getPredictionsForQuestion,
} from '../../../../lib/db.ts';

export const GET: APIRoute = async ({ params }) => {
  try {
    const responseId = parseInt(params.id ?? '', 10);
    if (isNaN(responseId)) {
      return new Response(JSON.stringify({ error: 'Invalid response ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entryState = getEntryStateByResponseId(responseId);
    if (!entryState) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionSummary = getSessionSummary(entryState.question_id);
    const observation = getObservationForQuestion(entryState.question_id);
    const predictions = getPredictionsForQuestion(entryState.question_id);
    const suppressedQuestion = getSuppressedQuestionForQuestion(entryState.question_id);

    // Navigation: prev/next response IDs
    const prev = db.prepare(`
      SELECT response_id FROM tb_entry_states
      WHERE entry_state_id < (SELECT entry_state_id FROM tb_entry_states WHERE response_id = ?)
      ORDER BY entry_state_id DESC LIMIT 1
    `).get(responseId) as { response_id: number } | undefined;

    const next = db.prepare(`
      SELECT response_id FROM tb_entry_states
      WHERE entry_state_id > (SELECT entry_state_id FROM tb_entry_states WHERE response_id = ?)
      ORDER BY entry_state_id ASC LIMIT 1
    `).get(responseId) as { response_id: number } | undefined;

    return new Response(JSON.stringify({
      entryState,
      sessionSummary,
      observation,
      predictions,
      suppressedQuestion,
      navigation: {
        prev: prev?.response_id ?? null,
        next: next?.response_id ?? null,
      },
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to load entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
