/**
 * Gallery API — returns one entry per real session day for the Alice Negative gallery.
 *
 * Each day that has a non-calibration response gets a gallery cell.
 * Days before a witness state existed use default traits.
 * Days after a witness state use the most recent witness at that point in time.
 */
import type { APIRoute } from 'astro';
import sql from '../../lib/libDb.ts';
import { DEFAULT_WITNESS } from '../../lib/libAliceNegative/libTypes.ts';

export const GET: APIRoute = async () => {
  // Get distinct session days (by scheduled_for) with real responses
  const sessionDays = await sql`
    SELECT q.scheduled_for, MIN(r.dttm_created_utc) as first_response_utc,
           COUNT(r.response_id)::int as response_count
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
    GROUP BY q.scheduled_for
    ORDER BY q.scheduled_for ASC
  ` as Array<{
    scheduled_for: string;
    first_response_utc: string;
    response_count: number;
  }>;

  // Get all witness states ordered by creation
  const witnesses = await sql`
    SELECT witness_state_id, entry_count, traits_json, dttm_created_utc
    FROM tb_witness_states
    ORDER BY dttm_created_utc ASC
  ` as Array<{
    witness_state_id: number;
    entry_count: number;
    traits_json: string;
    dttm_created_utc: string;
  }>;

  // For each session day, find the most recent witness state created on or before
  // that day's last response. If none exists, use defaults.
  const states = sessionDays.map((day, i) => {
    const dayEnd = day.first_response_utc;
    // Find the latest witness created up to or shortly after this day's response.
    // The witness renders after the response is saved, so it may be created
    // minutes (or, after a crash + manual re-run, hours) later.
    // For each day, pick the witness whose entry_count matches (version i+1),
    // or fall back to the latest witness created before or within a window after.
    let bestWitness = null;
    const targetEntryCount = i + 1;
    // First pass: exact entry_count match (most reliable)
    for (const w of witnesses) {
      if (w.entry_count === targetEntryCount) {
        bestWitness = w;
        break;
      }
    }
    // Second pass: latest witness created on or before the response
    if (!bestWitness) {
      for (const w of witnesses) {
        if (w.dttm_created_utc <= dayEnd) {
          bestWitness = w;
        }
      }
    }

    return {
      id: bestWitness?.witness_state_id ?? -(i + 1),
      version: i + 1,
      entryCount: bestWitness?.entry_count ?? day.response_count,
      traits: bestWitness ? JSON.parse(bestWitness.traits_json) : DEFAULT_WITNESS.traits,
      createdAt: day.first_response_utc,
      scheduledFor: day.scheduled_for,
    };
  });

  return new Response(JSON.stringify(states), {
    headers: { 'Content-Type': 'application/json' },
  });
};
