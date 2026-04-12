/**
 * Witness State API
 *
 * Returns the witness-form's 26-trait vector + metadata.
 *
 * Pipeline (dynamics + emotion):
 *   1. Compute 8D entry states from raw session data (deterministic)
 *   2. Compute PersDyn dynamics per dimension (baseline, variability, attractor force)
 *   3. Discover empirical coupling between dimensions (lagged cross-correlations)
 *   4. Load emotion densities, compute emotion profile + emotion→behavior coupling
 *   5. LLM renders validated dynamics + emotion profile into 26 visual traits
 *   6. Persist entry states, dynamics, coupling, emotion coupling, and visual traits
 *
 * The LLM fires only when entry count changes. Cached otherwise.
 */
import type { APIRoute } from 'astro';
import type { WitnessState } from '../../lib/bob/types.ts';
import { DEFAULT_WITNESS } from '../../lib/bob/types.ts';
import { renderTraits, loadPersistedTraits } from '../../lib/bob/interpreter.ts';
import { computeEntryStates } from '../../lib/bob/state-engine.ts';
import { computeDynamics } from '../../lib/bob/dynamics.ts';
import { computeEmotionAnalysis } from '../../lib/bob/emotion-profile.ts';
import db, {
  saveEntryState,
  getEntryStateCount,
  saveTraitDynamics,
  saveCouplingMatrix,
  saveEmotionBehaviorCoupling,
} from '../../lib/db.ts';

export const GET: APIRoute = async () => {
  try {
    const currentCount = (db.prepare(
      `SELECT COUNT(*) as c FROM tb_session_summaries`
    ).get() as { c: number }).c;

    if (currentCount === 0) {
      return new Response(JSON.stringify(DEFAULT_WITNESS), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Check if we already have valid traits for this entry count ──
    const persisted = loadPersistedTraits(currentCount);
    if (persisted) {
      const metadata = computeMetadata(currentCount, persisted);
      return new Response(JSON.stringify(metadata), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Phase 1: Compute 8D entry states (deterministic) ──
    const states = computeEntryStates();
    if (states.length < 3) {
      return new Response(JSON.stringify(DEFAULT_WITNESS), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Persist any new entry states to DB
    const existingStateCount = getEntryStateCount();
    if (states.length > existingStateCount) {
      const newStates = states.slice(existingStateCount);
      for (const s of newStates) {
        saveEntryState({
          response_id: s.responseId,
          fluency: s.fluency,
          deliberation: s.deliberation,
          revision: s.revision,
          expression: s.expression,
          commitment: s.commitment,
          volatility: s.volatility,
          thermal: s.thermal,
          presence: s.presence,
          convergence: s.convergence,
        });
      }
    }

    // ── Phase 2 & 3: Compute dynamics + coupling ──
    const dynamics = computeDynamics(states);

    saveTraitDynamics(dynamics.dimensions.map(d => ({
      entry_count: currentCount,
      dimension: d.dimension,
      baseline: d.baseline,
      variability: d.variability,
      attractor_force: d.attractorForce,
      current_state: d.currentState,
      deviation: d.deviation,
      window_size: d.windowSize,
    })));

    if (dynamics.coupling.length > 0) {
      saveCouplingMatrix(dynamics.coupling.map(c => ({
        entry_count: currentCount,
        leader: c.leader,
        follower: c.follower,
        lag_sessions: c.lagSessions,
        correlation: c.correlation,
        direction: c.direction,
      })));
    }

    // ── Phase 3.5: Emotion profile + emotion→behavior coupling ──
    const emotionAnalysis = computeEmotionAnalysis(states);

    if (emotionAnalysis.emotionBehaviorCoupling.length > 0) {
      saveEmotionBehaviorCoupling(emotionAnalysis.emotionBehaviorCoupling.map(c => ({
        entry_count: currentCount,
        emotion_dim: c.emotionDim,
        behavior_dim: c.behaviorDim,
        lag_sessions: c.lagSessions,
        correlation: c.correlation,
        direction: c.direction,
      })));
    }

    // ── Phase 4: Render visual traits (LLM — art, not science) ──
    const traits = await renderTraits(dynamics, currentCount, emotionAnalysis);

    const state = computeMetadata(currentCount, traits);

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

function computeMetadata(currentCount: number, traits: import('../../lib/bob/types.ts').WitnessTraits): WitnessState {
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
