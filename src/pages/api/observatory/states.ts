/**
 * Observatory States API
 *
 * Returns all 8D entry states with dates for the trajectory sparklines.
 * No AI involved. Pure deterministic data from tb_entry_states.
 */
import type { APIRoute } from 'astro';
import { getEntryStatesWithDates } from '../../../lib/db.ts';

export const GET: APIRoute = async () => {
  try {
    const rows = getEntryStatesWithDates();
    const states = rows.map(r => ({
      response_id: r.response_id,
      date: r.date,
      fluency: r.fluency,
      deliberation: r.deliberation,
      revision: r.revision,
      expression: r.expression,
      commitment: r.commitment,
      volatility: r.volatility,
      thermal: r.thermal,
      presence: r.presence,
      convergence: r.convergence,
    }));

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
