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

import db, {
  saveCalibrationBaselineSnapshot,
  getLatestCalibrationSnapshot,
  type CalibrationHistoryRow,
} from './db.ts';

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

function computeBaselineSnapshot(deviceType: string | null): BaselineRowInput & { calibration_session_count: number } {
  const conditions: string[] = ['q.question_source_id = 3'];
  const params: (string | number)[] = [];
  if (deviceType) {
    conditions.push('s.device_type = ?');
    params.push(deviceType);
  } else {
    // global snapshot ignores device
  }

  const row = db.prepare(`
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
    WHERE ${conditions.join(' AND ')}
  `).get(...params) as BaselineRowInput & { calibration_session_count: number };

  return row;
}

function getJournalDispersion(field: keyof BaselineRowInput): number | null {
  // Per-person dispersion across journal sessions for the source field.
  // Used as the scaling denominator when computing per-dimension drift.
  const sourceCol = field
    .replace(/^avg_/, '')
    .replace('first_keystroke_ms', 'first_keystroke_ms')
    .replace('commitment_ratio', 'commitment_ratio')
    .replace('duration_ms', 'total_duration_ms')
    .replace('pause_count', 'pause_count')
    .replace('deletion_count', 'deletion_count')
    .replace('chars_per_minute', 'chars_per_minute')
    .replace('p_burst_length', 'avg_p_burst_length')
    .replace('small_deletion_count', 'small_deletion_count')
    .replace('large_deletion_count', 'large_deletion_count')
    .replace('iki_mean', 'inter_key_interval_mean')
    .replace('hold_time_mean', 'hold_time_mean')
    .replace('flight_time_mean', 'flight_time_mean');

  // Population std on journal-session column. SQLite doesn't have a stddev
  // function by default, but we can compute it manually.
  const row = db.prepare(`
    SELECT s.${sourceCol} as v
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE q.question_source_id != 3 AND s.${sourceCol} IS NOT NULL
  `).all() as Array<{ v: number }>;

  if (row.length < 3) return null;
  const vals = row.map(r => r.v);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  return Math.sqrt(variance);
}

function computeDriftMagnitude(
  current: BaselineRowInput,
  previous: CalibrationHistoryRow | null,
): number | null {
  if (!previous) return 0; // first snapshot has no drift

  let sumSq = 0;
  let dimsWithDispersion = 0;
  for (const dim of DRIFT_DIMENSIONS) {
    const cur = current[dim as keyof BaselineRowInput] as number | null;
    const prev = previous[dim] as number | null;
    if (cur == null || prev == null) continue;

    const dispersion = getJournalDispersion(dim as keyof BaselineRowInput);
    if (dispersion == null || dispersion < 1e-10) continue;

    const z = (cur - prev) / dispersion;
    sumSq += z * z;
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
export function snapshotCalibrationBaselinesAfterSubmit(deviceType: string | null): void {
  // Global snapshot
  const globalSnap = computeBaselineSnapshot(null);
  if (globalSnap.calibration_session_count > 0) {
    const prevGlobal = getLatestCalibrationSnapshot(null);
    const driftGlobal = computeDriftMagnitude(globalSnap, prevGlobal);
    saveCalibrationBaselineSnapshot({
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
    const deviceSnap = computeBaselineSnapshot(deviceType);
    if (deviceSnap.calibration_session_count > 0) {
      const prevDevice = getLatestCalibrationSnapshot(deviceType);
      const driftDevice = computeDriftMagnitude(deviceSnap, prevDevice);
      saveCalibrationBaselineSnapshot({
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
