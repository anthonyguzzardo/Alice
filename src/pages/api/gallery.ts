/**
 * Gallery API — returns all historical witness states for the Bob gallery.
 */
import type { APIRoute } from 'astro';
import db from '../../lib/db.ts';

export const GET: APIRoute = async () => {
  const rows = db.prepare(`
    SELECT witness_state_id, entry_count, traits_json, dttm_created_utc
    FROM tb_witness_states
    ORDER BY dttm_created_utc ASC
  `).all() as Array<{
    witness_state_id: number;
    entry_count: number;
    traits_json: string;
    dttm_created_utc: string;
  }>;

  const states = rows.map((row, i) => ({
    id: row.witness_state_id,
    version: i + 1,
    entryCount: row.entry_count,
    traits: JSON.parse(row.traits_json),
    createdAt: row.dttm_created_utc,
  }));

  return new Response(JSON.stringify(states), {
    headers: { 'Content-Type': 'application/json' },
  });
};
