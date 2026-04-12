/**
 * Witness State Renderer — session completion trigger
 *
 * Called ONCE per session completion from /api/respond.
 * Runs the full deterministic pipeline (states → dynamics → emotion)
 * then calls the LLM to render visual traits.
 *
 * This is the ONLY path that generates new witness states.
 * The /api/witness endpoint only reads persisted data.
 */

import db, {
  saveEntryState,
  getEntryStateCount,
  saveTraitDynamics,
  saveCouplingMatrix,
  saveEmotionBehaviorCoupling,
} from '../db.ts';
import { computeEntryStates } from './state-engine.ts';
import { computeDynamics } from './dynamics.ts';
import { computeEmotionAnalysis } from './emotion-profile.ts';
import { renderTraits } from './interpreter.ts';

export async function renderWitnessState(): Promise<void> {
  const currentCount = (db.prepare(
    `SELECT COUNT(*) as c FROM tb_session_summaries ss
     JOIN tb_questions q ON ss.question_id = q.question_id
     WHERE q.question_source_id != 3`
  ).get() as { c: number }).c;

  if (currentCount === 0) return;

  // Phase 1: Compute 8D entry states (deterministic)
  const states = computeEntryStates();
  if (states.length < 3) return;

  // Persist any new entry states
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

  // Phase 2 & 3: Compute dynamics + coupling
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

  // Phase 3.5: Emotion profile + emotion→behavior coupling
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

  // Phase 4: Render visual traits (LLM call)
  await renderTraits(dynamics, currentCount, emotionAnalysis);

  console.log(`[witness] New Bob generated for entry count ${currentCount}`);
}
