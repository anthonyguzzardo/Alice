/**
 * Reinterpret Alice Negative through the dynamics + emotion pipeline.
 *
 * Runs the full pipeline against all existing session data:
 *   1. Compute 7D entry states from full history
 *   2. Derive PersDyn dynamics (baseline, variability, attractor force)
 *   3. Discover empirical coupling matrix
 *   4. Load emotion densities, discover emotion→behavior coupling
 *   5. Re-render visual traits through the LLM renderer
 *
 * Usage: npx tsx scripts/reinterpret.ts
 * Does NOT require the dev server.
 */
import 'dotenv/config';
import { sql } from '../src/lib/libDb.ts';
import { computeEntryStates } from '../src/lib/libAliceNegative/libStateEngine.ts';
import { computeDynamics, formatDynamicsForRenderer } from '../src/lib/libAliceNegative/libDynamics.ts';
import { computeEmotionAnalysis, formatEmotionForRenderer } from '../src/lib/libAliceNegative/libEmotionProfile.ts';
import { renderTraits } from '../src/lib/libAliceNegative/libInterpreter.ts';
import {
  saveEntryState,
  saveTraitDynamics,
  saveCouplingMatrix,
  saveEmotionBehaviorCoupling,
} from '../src/lib/libDb.ts';
import { parseSubjectIdArg } from '../src/lib/utlSubjectIdArg.ts';

async function main() {
  const subjectId = parseSubjectIdArg();

  const [countRow] = await sql`SELECT COUNT(*) as count FROM tb_session_summaries WHERE subject_id = ${subjectId}`;
  const entryCount = (countRow as { count: number }).count;
  console.log(`\n=== Reinterpret: ${entryCount} entries ===\n`);

  // Clear stale data so we recompute everything fresh
  await sql`DELETE FROM tb_entry_states WHERE subject_id = ${subjectId}`;
  await sql`DELETE FROM tb_trait_dynamics WHERE subject_id = ${subjectId}`;
  await sql`DELETE FROM tb_coupling_matrix WHERE subject_id = ${subjectId}`;
  await sql`DELETE FROM tb_emotion_behavior_coupling WHERE subject_id = ${subjectId}`;
  await sql`DELETE FROM tb_witness_states WHERE subject_id = ${subjectId} AND entry_count = ${entryCount}`;
  console.log('Cleared stale states, dynamics, coupling, emotion coupling, and witness data.\n');

  // -- Phase 1: 7D Entry States --
  console.log('Phase 1: Computing 7D entry states...');
  const states = await computeEntryStates(subjectId);
  console.log(`  → ${states.length} entry states computed`);

  if (states.length < 3) {
    console.log('Not enough entries for dynamics. Done.');
    process.exit(0);
  }

  // Persist entry states
  for (const s of states) {
    await saveEntryState({
      subject_id: subjectId,
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
  console.log(`  → ${states.length} states persisted to tb_entry_states\n`);

  // Show last 5 states
  console.log('Recent entry states (last 5):');
  const recent = states.slice(-5);
  for (const s of recent) {
    console.log(
      `  [${s.date}] flu=${s.fluency > 0 ? '+' : ''}${s.fluency.toFixed(2)} ` +
      `del=${s.deliberation > 0 ? '+' : ''}${s.deliberation.toFixed(2)} ` +
      `rev=${s.revision > 0 ? '+' : ''}${s.revision.toFixed(2)} ` +
      `com=${s.commitment > 0 ? '+' : ''}${s.commitment.toFixed(2)} ` +
      `vol=${s.volatility > 0 ? '+' : ''}${s.volatility.toFixed(2)} ` +
      `thm=${s.thermal > 0 ? '+' : ''}${s.thermal.toFixed(2)} ` +
      `prs=${s.presence > 0 ? '+' : ''}${s.presence.toFixed(2)} ` +
      `conv=${s.convergence.toFixed(2)} (${s.convergenceLevel})`
    );
  }

  // -- Phase 2 & 3: Dynamics + Coupling --
  console.log('\nPhase 2: Computing PersDyn dynamics...');
  const dynamics = computeDynamics(states);

  console.log(`  → Phase: ${dynamics.phase}`);
  console.log(`  → Velocity: ${dynamics.velocity.toFixed(3)}`);
  console.log(`  → System entropy: ${dynamics.systemEntropy.toFixed(3)}`);

  console.log('\nDimension dynamics:');
  for (const d of dynamics.dimensions) {
    const attractorLabel =
      d.attractorForce >= 0.7 ? 'RIGID' :
      d.attractorForce >= 0.4 ? 'moderate' : 'MALLEABLE';
    console.log(
      `  ${d.dimension.padEnd(14)} ` +
      `baseline=${d.baseline > 0 ? '+' : ''}${d.baseline.toFixed(2)}  ` +
      `σ=${d.variability.toFixed(2)}  ` +
      `attractor=${d.attractorForce.toFixed(2)} [${attractorLabel}]  ` +
      `now=${d.currentState > 0 ? '+' : ''}${d.currentState.toFixed(2)}  ` +
      `Δ=${d.deviation > 0 ? '+' : ''}${d.deviation.toFixed(2)}σ`
    );
  }

  // Persist dynamics
  await saveTraitDynamics(dynamics.dimensions.map(d => ({
    subject_id: subjectId,
    entry_count: entryCount,
    dimension: d.dimension,
    baseline: d.baseline,
    variability: d.variability,
    attractor_force: d.attractorForce,
    current_state: d.currentState,
    deviation: d.deviation,
    window_size: d.windowSize,
  })));
  console.log(`\n  → ${dynamics.dimensions.length} dimension dynamics persisted`);

  if (dynamics.coupling.length > 0) {
    console.log('\nPhase 3: Empirical coupling matrix:');
    for (const c of dynamics.coupling) {
      const sign = c.direction > 0 ? '+' : '−';
      const lagLabel = c.lagSessions === 0 ? 'concurrent' : `${c.lagSessions}-entry lag`;
      console.log(
        `  ${c.leader} → ${c.follower}  ` +
        `r=${sign}${c.correlation.toFixed(2)}  (${lagLabel})`
      );
    }

    await saveCouplingMatrix(dynamics.coupling.map(c => ({
      subject_id: subjectId,
      entry_count: entryCount,
      leader: c.leader,
      follower: c.follower,
      lag_sessions: c.lagSessions,
      correlation: c.correlation,
      direction: c.direction,
    })));
    console.log(`  → ${dynamics.coupling.length} couplings persisted`);
  } else {
    console.log('\nPhase 3: Not enough data for coupling analysis (need 10+ entries).');
  }

  // -- Phase 3.5: Emotion Profile + Emotion->Behavior Coupling --
  console.log('\nPhase 3.5: Computing emotion profile + cross-domain coupling...');
  const emotionAnalysis = await computeEmotionAnalysis(subjectId, states);

  if (emotionAnalysis.profile.current) {
    const p = emotionAnalysis.profile;
    console.log('Current entry emotion densities:');
    const nrcDims = ['anger', 'fear', 'joy', 'sadness', 'trust', 'anticipation'] as const;
    for (const dim of nrcDims) {
      const val = p.current![dim as keyof typeof p.current];
      const pct = p.percentiles[dim];
      const dev = p.deviations[dim];
      console.log(
        `  ${dim.padEnd(14)} ${((val as number) * 100).toFixed(1)}%  ` +
        `P${Math.round(pct * 100)}  ` +
        `${dev > 0 ? '+' : ''}${dev.toFixed(1)}σ`
      );
    }
    if (p.dominantEmotion) {
      console.log(`  Dominant: ${p.dominantEmotion} | Intensity: ${(p.emotionalIntensity * 100).toFixed(1)}% | Diversity: ${p.emotionalDiversity.toFixed(2)}`);
    }
  } else {
    console.log('  No emotion data available.');
  }

  if (emotionAnalysis.emotionBehaviorCoupling.length > 0) {
    console.log('\nEmotion → Behavior coupling:');
    for (const c of emotionAnalysis.emotionBehaviorCoupling.slice(0, 15)) {
      const sign = c.direction > 0 ? '+' : '−';
      const lagLabel = c.lagSessions === 0 ? 'concurrent' : `${c.lagSessions}-entry lag`;
      console.log(
        `  ${c.emotionDim} → ${c.behaviorDim}  ` +
        `r=${sign}${c.correlation.toFixed(2)}  (${lagLabel})`
      );
    }

    await saveEmotionBehaviorCoupling(emotionAnalysis.emotionBehaviorCoupling.map(c => ({
      subject_id: subjectId,
      entry_count: entryCount,
      emotion_dim: c.emotionDim,
      behavior_dim: c.behaviorDim,
      lag_sessions: c.lagSessions,
      correlation: c.correlation,
      direction: c.direction,
    })));
    console.log(`  → ${emotionAnalysis.emotionBehaviorCoupling.length} emotion→behavior couplings persisted`);
  } else {
    console.log('\n  Not enough data for emotion→behavior coupling (need 10+ entries).');
  }

  // -- Phase 4: Visual Rendering --
  console.log('\nPhase 4: Rendering visual traits via dynamics + emotion...');
  console.log('(LLM receives validated dynamics + emotion profile, outputs 26 visual traits)\n');

  // Print what the LLM will see
  console.log('--- DYNAMICS INPUT TO RENDERER ---');
  console.log(formatDynamicsForRenderer(dynamics));
  if (emotionAnalysis.profile.current) {
    console.log('');
    console.log(formatEmotionForRenderer(emotionAnalysis));
  }
  console.log('--- END RENDERER INPUT ---\n');

  const traits = await renderTraits(subjectId, dynamics, entryCount, emotionAnalysis);
  console.log('Visual traits (26D):');
  const entries = Object.entries(traits);
  const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
  for (const [key, val] of entries) {
    const bar = '█'.repeat(Math.round((val as number) * 20));
    const empty = '░'.repeat(20 - Math.round((val as number) * 20));
    console.log(`  ${key.padEnd(maxKeyLen)} ${(val as number).toFixed(2)} ${bar}${empty}`);
  }

  console.log('\nDone. Full dynamics + emotion pipeline complete.');
}

main().catch((err) => {
  console.error('Reinterpret failed:', err);
  process.exit(1);
});
