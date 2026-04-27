/**
 * Backfill: Recompute behavioral 7D + semantic 11D state vectors, dynamics,
 * couplings, session metadata, and calibration baseline snapshots from the
 * existing tb_session_summaries / tb_burst_sequences history.
 *
 * Designed to bring the post-slice-3 architecture into parity with the data
 * already captured pre-restructure. Runs idempotently (skips rows that
 * already exist in the destination tables) so it can be safely re-run.
 *
 * Limitations:
 *   - tb_session_events can NOT be backfilled (per-keystroke event log was
 *     not captured for old sessions). Replay only works for sessions
 *     submitted after slice 3 ships.
 *   - tb_session_metadata fields that depend on deletion_events_json are
 *     left null for sessions where that JSON wasn't captured (most pre-slice-3
 *     sessions). Burst-derived fields and hour_typicality DO backfill.
 *
 * Usage: npx tsx scripts/backfill-slice3-history.ts
 */
import { sql } from '../src/lib/libDb.ts';
import {
  saveEntryState, getEntryStateCount,
  saveSemanticState, getSemanticStateCount,
  saveTraitDynamics, saveCouplingMatrix,
  saveSemanticDynamics, saveSemanticCoupling,
  saveEmotionBehaviorCoupling,
  saveSessionMetadata, getMetadataQuestionIdsAlreadyComputed,
  getBurstSequence,
} from '../src/lib/libDb.ts';
import { computeEntryStates } from '../src/lib/libAliceNegative/libStateEngine.ts';
import { computeSemanticStates, SEMANTIC_DIMENSIONS } from '../src/lib/libAliceNegative/libSemanticSpace.ts';
import { computeDynamics } from '../src/lib/libAliceNegative/libDynamics.ts';
import { computeEmotionAnalysis } from '../src/lib/libAliceNegative/libEmotionProfile.ts';
import { computeSessionMetadata } from '../src/lib/libSessionMetadata.ts';
import { snapshotCalibrationBaselinesAfterSubmit } from '../src/lib/libCalibrationDrift.ts';
import { parseSubjectIdArg } from '../src/lib/utlSubjectIdArg.ts';

async function main() {
  const subjectId = parseSubjectIdArg();
  console.log('Backfilling slice-3 architecture against existing history...\n');

  // --- 1. Behavioral 7D entry states ---

  const behavioralStates = await computeEntryStates(subjectId);
  console.log(`Behavioral 7D states computed: ${behavioralStates.length} entries`);

  const existingBehavioral = await getEntryStateCount(subjectId);
  if (behavioralStates.length > existingBehavioral) {
    const newBehavioral = behavioralStates.slice(existingBehavioral);
    for (const s of newBehavioral) {
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
    console.log(`  → persisted ${newBehavioral.length} new behavioral states`);
  } else {
    console.log(`  → already up to date (${existingBehavioral} rows)`);
  }

  // --- 2. Semantic 11D entry states ---

  const semanticStates = await computeSemanticStates(subjectId);
  console.log(`Semantic 11D states computed: ${semanticStates.length} entries`);

  const existingSemantic = await getSemanticStateCount(subjectId);
  if (semanticStates.length > existingSemantic) {
    const newSemantic = semanticStates.slice(existingSemantic);
    for (const s of newSemantic) {
      await saveSemanticState({
        subject_id: subjectId,
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
    console.log(`  → persisted ${newSemantic.length} new semantic states`);
  } else {
    console.log(`  → already up to date (${existingSemantic} rows)`);
  }

  // --- 3. Behavioral dynamics + coupling (over current 7D history) ---

  if (behavioralStates.length >= 5) {
    const behDynamics = computeDynamics(behavioralStates);
    await saveTraitDynamics(behDynamics.dimensions.map(d => ({
      subject_id: subjectId,
      entry_count: behavioralStates.length,
      dimension: d.dimension,
      baseline: d.baseline,
      variability: d.variability,
      attractor_force: d.attractorForce,
      current_state: d.currentState,
      deviation: d.deviation,
      window_size: d.windowSize,
    })));
    if (behDynamics.coupling.length > 0) {
      await saveCouplingMatrix(behDynamics.coupling.map(c => ({
        subject_id: subjectId,
        entry_count: behavioralStates.length,
        leader: c.leader,
        follower: c.follower,
        lag_sessions: c.lagSessions,
        correlation: c.correlation,
        direction: c.direction,
      })));
    }
    console.log(`Behavioral dynamics: phase=${behDynamics.phase}, velocity=${behDynamics.velocity.toFixed(3)}, coupling=${behDynamics.coupling.length}`);
  } else {
    console.log(`Behavioral dynamics skipped (need ≥5 entries, have ${behavioralStates.length})`);
  }

  // --- 4. Semantic dynamics + coupling (over current 11D history) ---

  if (semanticStates.length >= 5) {
    const semDynamics = computeDynamics(semanticStates, SEMANTIC_DIMENSIONS);
    await saveSemanticDynamics(semDynamics.dimensions.map(d => ({
      subject_id: subjectId,
      entry_count: semanticStates.length,
      dimension: d.dimension,
      baseline: d.baseline,
      variability: d.variability,
      attractor_force: d.attractorForce,
      current_state: d.currentState,
      deviation: d.deviation,
      window_size: d.windowSize,
    })));
    if (semDynamics.coupling.length > 0) {
      await saveSemanticCoupling(semDynamics.coupling.map(c => ({
        subject_id: subjectId,
        entry_count: semanticStates.length,
        leader: c.leader,
        follower: c.follower,
        lag_sessions: c.lagSessions,
        correlation: c.correlation,
        direction: c.direction,
      })));
    }
    console.log(`Semantic dynamics: phase=${semDynamics.phase}, velocity=${semDynamics.velocity.toFixed(3)}, coupling=${semDynamics.coupling.length}`);
  } else {
    console.log(`Semantic dynamics skipped (need ≥5 entries, have ${semanticStates.length})`);
  }

  // --- 5. Emotion -> behavior coupling ---

  if (behavioralStates.length >= 5) {
    const emotionAnalysis = await computeEmotionAnalysis(subjectId, behavioralStates);
    if (emotionAnalysis.emotionBehaviorCoupling.length > 0) {
      await saveEmotionBehaviorCoupling(emotionAnalysis.emotionBehaviorCoupling.map(c => ({
        subject_id: subjectId,
        entry_count: behavioralStates.length,
        emotion_dim: c.emotionDim,
        behavior_dim: c.behaviorDim,
        lag_sessions: c.lagSessions,
        correlation: c.correlation,
        direction: c.direction,
      })));
    }
    console.log(`Emotion→behavior coupling: ${emotionAnalysis.emotionBehaviorCoupling.length} cross-domain edges`);
  }

  // --- 6. Session metadata for each historical session ---
  // Limited to fields we can compute from existing data:
  //   - hour_typicality (from hour_of_day, present)
  //   - burst_trajectory_shape, inter_burst_interval (from tb_burst_sequences, present)
  //   - deletion_curve_type + deletion_during/between_burst_count require
  //     deletion_events_json which old sessions lack -- these become null.

  const allSessions = await sql`
    SELECT
       ss.question_id, ss.hour_of_day as "hourOfDay", ss.total_duration_ms as "totalDurationMs",
       ss.deletion_events_json as "deletionEventsJson"
    FROM tb_session_summaries ss
    JOIN tb_questions q ON ss.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
      AND q.question_source_id != 3
    ORDER BY ss.session_summary_id ASC
  ` as Array<{ question_id: number; hourOfDay: number | null; totalDurationMs: number | null; deletionEventsJson: string | null }>;

  const alreadyComputedMeta = await getMetadataQuestionIdsAlreadyComputed(subjectId);
  let metadataAdded = 0;
  let metadataSkipped = 0;

  for (const sess of allSessions) {
    if (alreadyComputedMeta.has(sess.question_id)) {
      metadataSkipped++;
      continue;
    }
    const bursts = await getBurstSequence(subjectId, sess.question_id);
    let deletionEvents: Array<{ c: number; t: number }> = [];
    if (sess.deletionEventsJson) {
      try {
        const parsed = JSON.parse(sess.deletionEventsJson);
        if (Array.isArray(parsed)) {
          deletionEvents = parsed.map((d: any) => ({
            c: Math.max(1, d.c ?? d.chars ?? 1),
            t: Math.max(0, d.t ?? d.time ?? 0),
          }));
        }
      } catch {
        // ignore malformed
      }
    }
    const meta = await computeSessionMetadata({
      subjectId,
      questionId: sess.question_id,
      hourOfDay: sess.hourOfDay,
      totalDurationMs: sess.totalDurationMs ?? 0,
      deletionEvents,
      bursts,
    });
    await saveSessionMetadata({ ...meta, subject_id: subjectId });
    metadataAdded++;
  }

  console.log(`Session metadata: +${metadataAdded} computed, ${metadataSkipped} already present`);

  // --- 7. Calibration baseline snapshots in chronological order ---

  // Walk calibration sessions oldest-first; after each one, snapshot the
  // baselines as they would have looked at that point. Drift between snapshots
  // is then meaningful as a backfilled history.

  const calibrations = await sql`
    SELECT q.question_id, ss.device_type
    FROM tb_questions q
    JOIN tb_session_summaries ss ON ss.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
      AND q.question_source_id = 3
    ORDER BY q.question_id ASC
  ` as Array<{ question_id: number; device_type: string | null }>;

  const [calCountRow] = await sql`SELECT COUNT(*) as c FROM tb_calibration_baselines_history WHERE subject_id = ${subjectId}`;
  const existingCalSnapshots = (calCountRow as { c: number }).c;

  if (existingCalSnapshots > 0) {
    console.log(`Calibration drift: skipping (${existingCalSnapshots} snapshots already present)`);
  } else if (calibrations.length === 0) {
    console.log('Calibration drift: no calibration sessions to snapshot');
  } else {
    console.log(`Calibration drift: snapshotting ${calibrations.length} calibrations chronologically...`);
    // The snapshot function reads the current state of tb_session_summaries
    // each call. To reconstruct progressive history we'd need to temporarily
    // hide later calibrations from the query -- but since the snapshot computes
    // averages over all calibrations present at call time, calling it once per
    // calibration in order would just produce N identical snapshots.
    //
    // For an honest progressive backfill we'd need to filter session_summaries
    // by question_id ordinal. Instead, we take a single snapshot reflecting the
    // current state (drift_magnitude = 0 since there's no prior). Future
    // calibrations will produce real drift values from that anchor.
    await snapshotCalibrationBaselinesAfterSubmit(subjectId, null);
    // Also one per device that has calibrations
    const deviceTypes = new Set(calibrations.map(c => c.device_type).filter(d => d != null) as string[]);
    for (const dt of deviceTypes) {
      await snapshotCalibrationBaselinesAfterSubmit(subjectId, dt);
    }
    console.log(`  → seeded baseline anchor (1 global + ${deviceTypes.size} per-device snapshots)`);
  }

  console.log('\nBackfill complete. Re-run is safe -- script skips already-populated rows.');
  console.log('Note: tb_session_events (per-keystroke playback log) cannot be backfilled.');
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
