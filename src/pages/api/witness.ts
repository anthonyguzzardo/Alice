/**
 * Witness State API
 * Returns the witness-form's 26-trait vector + metadata.
 * Traits are persisted in DB. LLM only fires when entry count changes.
 */
import type { APIRoute } from 'astro';
import type { WitnessState, BlackboxSignal } from '../../lib/dream/types.ts';
import { DEFAULT_WITNESS } from '../../lib/dream/types.ts';
import { interpretTraits } from '../../lib/dream/interpreter.ts';
import db from '../../lib/db.ts';

export const GET: APIRoute = async ({ url }) => {
  try {
    const currentCount = (db.prepare(
      `SELECT COUNT(*) as c FROM tb_session_summaries`
    ).get() as { c: number }).c;

    // Fetch signals
    const origin = url.origin;
    const sigRes = await fetch(`${origin}/api/blackbox`);
    if (!sigRes.ok) throw new Error('Failed to fetch signals');
    const sig: BlackboxSignal = await sigRes.json();

    // Get traits — reads from DB if persisted, calls LLM only if needed
    const traits = await interpretTraits(sig, currentCount);

    // Compute metadata
    const mass = Math.min(1, Math.log(1 + currentCount) / Math.log(501));

    const lastEntry = db.prepare(`
      SELECT q.scheduled_for
      FROM tb_responses r
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE q.question_source_id != 3
      ORDER BY q.scheduled_for DESC LIMIT 1
    `).get() as { scheduled_for: string } | null;

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
    } else if (sig.avgCommitment > 0.85 && sig.avgHesitation < 0.2) {
      thresholdCharacter = 'abrupt';
    }

    const state: WitnessState = {
      traits,
      mass: Math.max(0.05, mass),
      thresholdDuration,
      thresholdCharacter,
      entryCount: currentCount,
      lastEntryDate,
      daysSinceLastEntry,
    };

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
