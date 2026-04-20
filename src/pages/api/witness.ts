/**
 * Witness State API
 *
 * Returns the witness-form's 26-trait vector + metadata.
 *
 * IMPORTANT: This endpoint NEVER triggers an LLM call.
 * It only returns the latest persisted witness state, or defaults.
 * New witness states are generated ONLY when a session completes
 * (via the session completion pipeline).
 */
import type { APIRoute } from 'astro';
import type { WitnessState } from '../../lib/libAliceNegative/libTypes.ts';
import { DEFAULT_WITNESS } from '../../lib/libAliceNegative/libTypes.ts';
import { loadPersistedTraits } from '../../lib/libAliceNegative/libInterpreter.ts';
import sql from '../../lib/libDb.ts';

export const GET: APIRoute = async () => {
  try {
    const traits = await loadPersistedTraits();

    if (!traits) {
      return new Response(JSON.stringify(DEFAULT_WITNESS), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [countRow] = await sql`
      SELECT COUNT(*)::int as c FROM tb_session_summaries ss
      JOIN tb_questions q ON ss.question_id = q.question_id
      WHERE q.question_source_id != 3
    `;
    const currentCount = (countRow as { c: number }).c;

    const state = await computeMetadata(currentCount, traits);

    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[witness] Error:', err);
    return new Response(JSON.stringify(DEFAULT_WITNESS), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

async function computeMetadata(currentCount: number, traits: import('../../lib/libAliceNegative/libTypes.ts').WitnessTraits): Promise<WitnessState> {
  const mass = Math.min(1, Math.log(1 + currentCount) / Math.log(501));

  const lastEntryRows = await sql`
    SELECT q.scheduled_for
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
    ORDER BY q.scheduled_for DESC LIMIT 1
  `;
  const lastEntry = (lastEntryRows[0] as { scheduled_for: string }) ?? null;

  let daysSinceLastEntry = 0;
  let lastEntryDate: string | null = null;
  if (lastEntry) {
    lastEntryDate = lastEntry.scheduled_for;
    const now = new Date();
    const last = new Date(lastEntry.scheduled_for);
    daysSinceLastEntry = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 86400000));
  }

  const thresholdDuration = Math.min(15, 3 + daysSinceLastEntry * 1.5);

  let thresholdCharacter: WitnessState['thresholdCharacter'] = 'normal';
  if (daysSinceLastEntry >= 5) {
    thresholdCharacter = 'slow';
  } else if (traits.symmetry > 0.5 || traits.multiplicity > 0.4) {
    thresholdCharacter = 'misaligned';
  }

  return {
    traits,
    mass: Math.max(0.05, mass),
    thresholdDuration,
    thresholdCharacter,
    entryCount: currentCount,
    lastEntryDate,
    daysSinceLastEntry,
  };
}
