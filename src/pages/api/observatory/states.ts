/**
 * Observatory States API — hardcoded to simulation DB.
 */
import type { APIRoute } from 'astro';
import simDb from '../../../lib/sim-db.ts';

export const GET: APIRoute = async () => {
  try {
    const states = simDb.prepare(`
      SELECT es.response_id, q.scheduled_for as date,
             es.fluency, es.deliberation, es.revision, es.expression,
             es.commitment, es.volatility, es.thermal, es.presence, es.convergence
      FROM tb_entry_states es
      JOIN tb_responses r ON es.response_id = r.response_id
      JOIN tb_questions q ON r.question_id = q.question_id
      ORDER BY es.entry_state_id ASC
    `).all();

    return new Response(JSON.stringify({ states }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to load entry states' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
