/**
 * Calibration Drift Engine
 *
 * Calibration is supposed to be the stable reference frame — neutral writing
 * about your morning, your desk, the weather. If the reference frame itself
 * is drifting over time, that's signal — and it's not surfaced to the user.
 * Pure designer-facing health metric.
 *
 * On every calibration submission:
 *   1. Recompute the calibration baselines (per device when applicable + global)
 *   2. Snapshot them into tb_calibration_baselines_history
 *   3. Compute drift_magnitude = z-score-normalized L2 distance to the previous
 *      snapshot (per dimension, then summed)
 *   4. Persist the snapshot with its drift score
 *
 * Drift trajectory becomes a designer-facing chart in the Observatory.
 *
 * Slice 3 follow-up (2026-04-16). Pure deterministic computation. No LLM.
 */

import sql, {
  saveCalibrationBaselineSnapshot,
  getLatestCalibrationSnapshot,
  type CalibrationHistoryRow,
} from './libDb.ts';

// Personal-history dispersion is computed from existing journal sessions
// so that drift magnitudes are scaled by what a "typical" deviation looks
// like for this person on this dimension. Without per-dimension scaling,
// fields with large absolute units (avg_first_keystroke_ms in the thousands)
// would dominate fields with small units (avg_p_burst_length under 100).

const DRIFT_DIMENSIONS: Array<keyof CalibrationHistoryRow> = [
  'avg_first_keystroke_ms',
  'avg_commitment_ratio',
  'avg_duration_ms',
  'avg_pause_count',
  'avg_deletion_count',
  'avg_chars_per_minute',
  'avg_p_burst_length',
  'avg_small_deletion_count',
  'avg_large_deletion_count',
  'avg_iki_mean',
  'avg_hold_time_mean',
  'avg_flight_time_mean',
];

// Ergodicity classification (Mangalam et al. 2022, J. Royal Society Interface).
// IKI-derived means are non-ergodic: their time averages diverge from ensemble
// averages for multiplicative processes. Ratios, counts, and durations derived
// from event counts are not affected by this specific concern.
// Weight: 1.0 = safe for longitudinal drift inference, 0.5 = valid per-snapshot
// but unreliable as trend estimator.
const DRIFT_ERGODICITY_WEIGHT: Record<string, number> = {
  avg_first_keystroke_ms: 1.0,     // single event latency, not IKI mean
  avg_commitment_ratio: 1.0,       // ratio
  avg_duration_ms: 1.0,            // wall-clock duration
  avg_pause_count: 1.0,            // count
  avg_deletion_count: 1.0,         // count
  avg_chars_per_minute: 0.5,       // IKI-derived rate
  avg_p_burst_length: 1.0,         // burst-level aggregate
  avg_small_deletion_count: 1.0,   // count
  avg_large_deletion_count: 1.0,   // count
  avg_iki_mean: 0.5,               // IKI mean (directly non-ergodic)
  avg_hold_time_mean: 0.5,         // motor timing mean (non-ergodic)
  avg_flight_time_mean: 0.5,       // motor timing mean (non-ergodic)
};

interface BaselineRowInput {
  avg_first_keystroke_ms: number | null;
  avg_commitment_ratio: number | null;
  avg_duration_ms: number | null;
  avg_pause_count: number | null;
  avg_deletion_count: number | null;
  avg_chars_per_minute: number | null;
  avg_p_burst_length: number | null;
  avg_small_deletion_count: number | null;
  avg_large_deletion_count: number | null;
  avg_iki_mean: number | null;
  avg_hold_time_mean: number | null;
  avg_flight_time_mean: number | null;
}

async function computeBaselineSnapshot(subjectId: number, deviceType: string | null): Promise<BaselineRowInput & { calibration_session_count: number }> {
  let rows;
  if (deviceType) {
    rows = await sql`
      SELECT
         AVG(s.first_keystroke_ms)        as avg_first_keystroke_ms
        ,AVG(s.commitment_ratio)          as avg_commitment_ratio
        ,AVG(s.total_duration_ms)         as avg_duration_ms
        ,AVG(s.pause_count)               as avg_pause_count
        ,AVG(s.deletion_count)            as avg_deletion_count
        ,AVG(s.chars_per_minute)          as avg_chars_per_minute
        ,AVG(s.avg_p_burst_length)        as avg_p_burst_length
        ,AVG(s.small_deletion_count)      as avg_small_deletion_count
        ,AVG(s.large_deletion_count)      as avg_large_deletion_count
        ,AVG(s.inter_key_interval_mean)   as avg_iki_mean
        ,AVG(s.hold_time_mean)            as avg_hold_time_mean
        ,AVG(s.flight_time_mean)          as avg_flight_time_mean
        ,COUNT(*)                          as calibration_session_count
      FROM tb_session_summaries s
      JOIN tb_questions q ON s.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id = 3
        AND s.device_type = ${deviceType}
    `;
  } else {
    rows = await sql`
      SELECT
         AVG(s.first_keystroke_ms)        as avg_first_keystroke_ms
        ,AVG(s.commitment_ratio)          as avg_commitment_ratio
        ,AVG(s.total_duration_ms)         as avg_duration_ms
        ,AVG(s.pause_count)               as avg_pause_count
        ,AVG(s.deletion_count)            as avg_deletion_count
        ,AVG(s.chars_per_minute)          as avg_chars_per_minute
        ,AVG(s.avg_p_burst_length)        as avg_p_burst_length
        ,AVG(s.small_deletion_count)      as avg_small_deletion_count
        ,AVG(s.large_deletion_count)      as avg_large_deletion_count
        ,AVG(s.inter_key_interval_mean)   as avg_iki_mean
        ,AVG(s.hold_time_mean)            as avg_hold_time_mean
        ,AVG(s.flight_time_mean)          as avg_flight_time_mean
        ,COUNT(*)                          as calibration_session_count
      FROM tb_session_summaries s
      JOIN tb_questions q ON s.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id = 3
    `;
  }

  return rows[0] as BaselineRowInput & { calibration_session_count: number };
}

// Map baseline field names to their corresponding session summary column names
const BASELINE_TO_COLUMN: Record<string, string> = {
  avg_first_keystroke_ms: 'first_keystroke_ms',
  avg_commitment_ratio: 'commitment_ratio',
  avg_duration_ms: 'total_duration_ms',
  avg_pause_count: 'pause_count',
  avg_deletion_count: 'deletion_count',
  avg_chars_per_minute: 'chars_per_minute',
  avg_p_burst_length: 'avg_p_burst_length',
  avg_small_deletion_count: 'small_deletion_count',
  avg_large_deletion_count: 'large_deletion_count',
  avg_iki_mean: 'inter_key_interval_mean',
  avg_hold_time_mean: 'hold_time_mean',
  avg_flight_time_mean: 'flight_time_mean',
};

async function getJournalDispersion(subjectId: number, field: keyof BaselineRowInput): Promise<number | null> {
  // Per-person dispersion across journal sessions for the source field.
  // Used as the scaling denominator when computing per-dimension drift.
  const sourceCol = BASELINE_TO_COLUMN[field];
  if (!sourceCol) return null;

  // Sample std on journal-session column. Postgres has stddev_samp but
  // we compute manually to stay consistent with the existing approach.
  const rows = await sql.unsafe(
    `SELECT s.${sourceCol} as v
     FROM tb_session_summaries s
     JOIN tb_questions q ON s.question_id = q.question_id
     WHERE q.subject_id = $1 AND q.question_source_id != 3 AND s.${sourceCol} IS NOT NULL`,
    [subjectId]
  ) as Array<{ v: number }>;

  if (rows.length < 3) return null;
  const vals = rows.map(r => r.v);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1);
  return Math.sqrt(variance);
}

async function computeDriftMagnitude(
  subjectId: number,
  current: BaselineRowInput,
  previous: CalibrationHistoryRow | null,
): Promise<number | null> {
  if (!previous) return 0; // first snapshot has no drift

  let sumSq = 0;
  let dimsWithDispersion = 0;
  for (const dim of DRIFT_DIMENSIONS) {
    const cur = current[dim as keyof BaselineRowInput] as number | null;
    const prev = previous[dim] as number | null;
    if (cur == null || prev == null) continue;

    const dispersion = await getJournalDispersion(subjectId, dim as keyof BaselineRowInput);
    if (dispersion == null || dispersion < 1e-10) continue;

    const z = (cur - prev) / dispersion;
    const w = DRIFT_ERGODICITY_WEIGHT[dim] ?? 1.0;
    sumSq += w * z * z;
    dimsWithDispersion++;
  }

  if (dimsWithDispersion === 0) return null;
  return Math.sqrt(sumSq / dimsWithDispersion);
}

/**
 * Recompute and snapshot calibration baselines after a new calibration
 * session has been saved. Idempotent in the sense that if no calibration
 * sessions exist, this is a no-op; otherwise it always appends one row.
 *
 * Two snapshots are taken: one global (deviceType=null) and one for the
 * device of the calibration session that just ran (when available).
 */
export async function snapshotCalibrationBaselinesAfterSubmit(subjectId: number, deviceType: string | null): Promise<void> {
  // Global snapshot
  const globalSnap = await computeBaselineSnapshot(subjectId, null);
  if (globalSnap.calibration_session_count > 0) {
    const prevGlobal = await getLatestCalibrationSnapshot(subjectId, null);
    const driftGlobal = await computeDriftMagnitude(subjectId, globalSnap, prevGlobal);
    await saveCalibrationBaselineSnapshot({
      subject_id: subjectId,
      calibration_session_count: globalSnap.calibration_session_count,
      device_type: null,
      avg_first_keystroke_ms: globalSnap.avg_first_keystroke_ms,
      avg_commitment_ratio: globalSnap.avg_commitment_ratio,
      avg_duration_ms: globalSnap.avg_duration_ms,
      avg_pause_count: globalSnap.avg_pause_count,
      avg_deletion_count: globalSnap.avg_deletion_count,
      avg_chars_per_minute: globalSnap.avg_chars_per_minute,
      avg_p_burst_length: globalSnap.avg_p_burst_length,
      avg_small_deletion_count: globalSnap.avg_small_deletion_count,
      avg_large_deletion_count: globalSnap.avg_large_deletion_count,
      avg_iki_mean: globalSnap.avg_iki_mean,
      avg_hold_time_mean: globalSnap.avg_hold_time_mean,
      avg_flight_time_mean: globalSnap.avg_flight_time_mean,
      drift_magnitude: driftGlobal,
    });
  }

  // Device-specific snapshot
  if (deviceType) {
    const deviceSnap = await computeBaselineSnapshot(subjectId, deviceType);
    if (deviceSnap.calibration_session_count > 0) {
      const prevDevice = await getLatestCalibrationSnapshot(subjectId, deviceType);
      const driftDevice = await computeDriftMagnitude(subjectId, deviceSnap, prevDevice);
      await saveCalibrationBaselineSnapshot({
        subject_id: subjectId,
        calibration_session_count: deviceSnap.calibration_session_count,
        device_type: deviceType,
        avg_first_keystroke_ms: deviceSnap.avg_first_keystroke_ms,
        avg_commitment_ratio: deviceSnap.avg_commitment_ratio,
        avg_duration_ms: deviceSnap.avg_duration_ms,
        avg_pause_count: deviceSnap.avg_pause_count,
        avg_deletion_count: deviceSnap.avg_deletion_count,
        avg_chars_per_minute: deviceSnap.avg_chars_per_minute,
        avg_p_burst_length: deviceSnap.avg_p_burst_length,
        avg_small_deletion_count: deviceSnap.avg_small_deletion_count,
        avg_large_deletion_count: deviceSnap.avg_large_deletion_count,
        avg_iki_mean: deviceSnap.avg_iki_mean,
        avg_hold_time_mean: deviceSnap.avg_hold_time_mean,
        avg_flight_time_mean: deviceSnap.avg_flight_time_mean,
        drift_magnitude: driftDevice,
      });
    }
  }
}
