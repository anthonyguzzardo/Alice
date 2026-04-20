/**
 * Witness State Renderer — session completion trigger
 *
 * Called ONCE per session completion from /api/respond.
 * Runs the full deterministic pipeline (behavioral states → semantic states →
 * dynamics for each → emotion couplings) then calls the LLM to render visual
 * traits.
 *
 * This is the ONLY path that generates new witness states.
 * The /api/witness endpoint only reads persisted data.
 *
 * Slice 3 (2026-04-16): behavioral 7D and semantic ND are computed and
 * persisted separately. Phase / entropy / velocity run on each space
 * independently — joint-space distance work is downstream.
 */

import sql, {
  saveEntryState,
  getEntryStateCount,
  saveTraitDynamics,
  saveCouplingMatrix,
  saveEmotionBehaviorCoupling,
  saveSemanticState,
  getSemanticStateCount,
  saveSemanticDynamics,
  saveSemanticCoupling,
} from '../libDb.ts';
import { computeEntryStates } from './libStateEngine.ts';
import { computeSemanticStates, SEMANTIC_DIMENSIONS } from './libSemanticSpace.ts';
import { computeDynamics } from './libDynamics.ts';
import { computeEmotionAnalysis } from './libEmotionProfile.ts';
import { renderTraits } from './libInterpreter.ts';

export async function renderWitnessState(): Promise<void> {
  const countRows = await sql`
    SELECT COUNT(*) as c FROM tb_session_summaries ss
    JOIN tb_questions q ON ss.question_id = q.question_id
    WHERE q.question_source_id != 3
  `;
  const currentCount = (countRows[0] as { c: number }).c;

  if (currentCount === 0) return;

  // ── Phase 1a: Compute 7D behavioral entry states (deterministic) ──
  const states = await computeEntryStates();
  if (states.length < 3) return;

  // Persist any new behavioral entry states
  const existingStateCount = await getEntryStateCount();
  if (states.length > existingStateCount) {
    const newStates = states.slice(existingStateCount);
    for (const s of newStates) {
      await saveEntryState({
        response_id: s.responseId,
        fluency: s.fluency,
        deliberation: s.deliberation,
        revision: s.revision,
        commitment: s.commitment,
        volatility: s.volatility,
        thermal: s.thermal,
        presence: s.presence,
        convergence: s.convergence,
      });
    }
  }

  // ── Phase 1b: Compute semantic entry states (deterministic, parallel space) ──
  const semanticStates = await computeSemanticStates();
  const existingSemanticCount = await getSemanticStateCount();
  if (semanticStates.length > existingSemanticCount) {
    const newSemantic = semanticStates.slice(existingSemanticCount);
    for (const s of newSemantic) {
      await saveSemanticState({
        response_id: s.responseId,
        syntactic_complexity: s.syntactic_complexity,
        interrogation: s.interrogation,
        self_focus: s.self_focus,
        uncertainty: s.uncertainty,
        cognitive_processing: s.cognitive_processing,
        nrc_anger: s.nrc_anger,
        nrc_fear: s.nrc_fear,
        nrc_joy: s.nrc_joy,
        nrc_sadness: s.nrc_sadness,
        nrc_trust: s.nrc_trust,
        nrc_anticipation: s.nrc_anticipation,
        sentiment: s.sentiment,
        abstraction: s.abstraction,
        agency_framing: s.agency_framing,
        temporal_orientation: s.temporal_orientation,
        convergence: s.convergence,
      });
    }
  }

  // ── Phase 2: Behavioral dynamics + coupling (over 7D) ──
  const dynamics = computeDynamics(states);

  await saveTraitDynamics(dynamics.dimensions.map(d => ({
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
    await saveCouplingMatrix(dynamics.coupling.map(c => ({
      entry_count: currentCount,
      leader: c.leader,
      follower: c.follower,
      lag_sessions: c.lagSessions,
      correlation: c.correlation,
      direction: c.direction,
    })));
  }

  // ── Phase 2b: Semantic dynamics + coupling (over SEMANTIC_DIMENSIONS) ──
  if (semanticStates.length >= 3) {
    const semanticDynamics = computeDynamics(semanticStates, SEMANTIC_DIMENSIONS);

    await saveSemanticDynamics(semanticDynamics.dimensions.map(d => ({
      entry_count: currentCount,
      dimension: d.dimension,
      baseline: d.baseline,
      variability: d.variability,
      attractor_force: d.attractorForce,
      current_state: d.currentState,
      deviation: d.deviation,
      window_size: d.windowSize,
    })));

    if (semanticDynamics.coupling.length > 0) {
      await saveSemanticCoupling(semanticDynamics.coupling.map(c => ({
        entry_count: currentCount,
        leader: c.leader,
        follower: c.follower,
        lag_sessions: c.lagSessions,
        correlation: c.correlation,
        direction: c.direction,
      })));
    }
  }

  // ── Phase 3: Emotion profile + emotion→behavior coupling ──
  const emotionAnalysis = await computeEmotionAnalysis(states);

  if (emotionAnalysis.emotionBehaviorCoupling.length > 0) {
    await saveEmotionBehaviorCoupling(emotionAnalysis.emotionBehaviorCoupling.map(c => ({
      entry_count: currentCount,
      emotion_dim: c.emotionDim,
      behavior_dim: c.behaviorDim,
      lag_sessions: c.lagSessions,
      correlation: c.correlation,
      direction: c.direction,
    })));
  }

  // ── Phase 4: Render visual traits (LLM call) ──
  await renderTraits(dynamics, currentCount, emotionAnalysis);

  console.log(`[witness] New Alice Negative generated for entry count ${currentCount}`);
}
