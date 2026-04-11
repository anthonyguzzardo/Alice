/**
 * Witness State API
 * Computes the witness-form's current state from accumulated journal data.
 * Pure data transformation — no LLM, no image generation.
 * Only changes when new data enters the DB.
 */
import type { APIRoute } from 'astro';
import type { WitnessState, BlackboxSignal } from '../../lib/dream/types.ts';
import { DEFAULT_WITNESS } from '../../lib/dream/types.ts';
import db from '../../lib/db.ts';

/** Cache: only recompute when entry count changes */
let cached: WitnessState | null = null;
let cachedEntryCount = -1;

function computeWitnessState(sig: BlackboxSignal): WitnessState {
  const entryCount = sig.sessionCount;

  // Mass grows logarithmically with entries — fast early, slow later
  // 1 entry ≈ 0.15, 10 entries ≈ 0.4, 50 ≈ 0.65, 200 ≈ 0.85, 500 ≈ 1.0
  const mass = Math.min(1, Math.log(1 + entryCount) / Math.log(501));

  // Density: how defined the form is. Driven by commitment.
  // High commitment = you gave it something real = more defined.
  const density = sig.avgCommitment * mass;

  // Coherence: how unified. High confidence + high landed ratio = unified.
  // Low confidence + frame disagreement = fragmented.
  const confidenceScore = sig.latestConfidence === 'HIGH' ? 0.9
    : sig.latestConfidence === 'MODERATE' ? 0.6
    : sig.latestConfidence === 'LOW' ? 0.25
    : 0.5;
  const coherence = (confidenceScore * 0.6 + sig.landedRatio * 0.4) * mass;

  // Asymmetry: driven by thematic density (repetition = circling = tension)
  // and pause frequency (pauses = internal conflict).
  const asymmetry = Math.min(1, (sig.thematicDensity * 0.5 + sig.pauseFrequency * 0.5) * mass);

  // Concavity: suppressed content creates hollows.
  // Normalized against entry count — 0 suppressions = 0, many = up to 1.
  const concavity = entryCount > 0
    ? Math.min(1, (sig.suppressedCount / Math.max(1, entryCount)) * 2)
    : 0;

  // Erosion: inverse of commitment. Low commitment = dissolved edges.
  const erosion = (1 - sig.avgCommitment) * 0.8 + sig.deletionIntensity * 0.2;

  // Breathing: more entries = slower, deeper breath. Early = fast shallow breath.
  const breathRate = 15 + mass * 15; // 15s (new) to 30s (mature)
  const breathDepth = 0.01 + mass * 0.04; // subtle always

  // Threshold duration: based on how long since last entry
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

  // Threshold: longer absence = slower reveal
  // 0 days = 3s, 1 day = 4s, 3 days = 6s, 7+ days = 10-15s
  const thresholdDuration = Math.min(15, 3 + daysSinceLastEntry * 1.5);

  // Threshold character
  let thresholdCharacter: WitnessState['thresholdCharacter'] = 'normal';
  if (daysSinceLastEntry >= 5) {
    thresholdCharacter = 'slow';
  } else if (asymmetry > 0.5) {
    thresholdCharacter = 'misaligned';
  } else if (sig.avgCommitment > 0.85 && sig.avgHesitation < 0.2) {
    thresholdCharacter = 'abrupt';
  }

  return {
    density: Math.max(0.05, density),
    coherence: Math.max(0.05, coherence),
    asymmetry,
    concavity,
    erosion: Math.min(0.95, erosion),
    mass: Math.max(0.05, mass),
    breathRate,
    breathDepth,
    thresholdDuration,
    thresholdCharacter,
    entryCount,
    lastEntryDate,
    daysSinceLastEntry,
  };
}

export const GET: APIRoute = async ({ url }) => {
  try {
    // Check if data has changed
    const currentCount = (db.prepare(
      `SELECT COUNT(*) as c FROM tb_session_summaries`
    ).get() as { c: number }).c;

    if (cached && currentCount === cachedEntryCount) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch signals
    const origin = url.origin;
    const sigRes = await fetch(`${origin}/api/blackbox`);
    if (!sigRes.ok) throw new Error('Failed to fetch signals');
    const sig: BlackboxSignal = await sigRes.json();

    const state = computeWitnessState(sig);
    cached = state;
    cachedEntryCount = currentCount;

    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Return default if anything fails
    return new Response(JSON.stringify(DEFAULT_WITNESS), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
