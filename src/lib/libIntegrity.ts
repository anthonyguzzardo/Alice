/**
 * Session Integrity: Profile-Based Mediation Detection
 *
 * Computes how well a session's motor and process signals match the
 * person's established behavioral profile. Sessions that fall outside
 * the expected range are flagged.
 *
 * Method:
 *   For each dimension where the profile has both mean and std (>0),
 *   compute z = (session_value - profile_mean) / profile_std.
 *   Profile distance = L2 norm of the z-score vector.
 *   Flag if distance > dynamic threshold (mean + 2*std of all
 *   historical distances, with a floor of sqrt(dimension_count)).
 *
 * The z_scores_json is the durable asset. The flag and threshold
 * may be recomputed with different criteria; the raw z-scores persist.
 */

import sql from './libDbPool.ts';
import { computeProfileDistance as rustProfileDistance } from './libSignalsNative.ts';
import { logError } from './utlErrorLog.ts';
import { logSignalSkip } from './libDb.ts';

// ─── Types ──────────────────────────────────────────────────────────

export interface IntegrityResult {
  questionId: number;
  profileDistance: number;
  dimensionCount: number;
  zScores: Record<string, number>;
  isFlagged: boolean;
  thresholdUsed: number;
  profileSessionCount: number;
}

// ─── Dimension definitions ──────────────────────────────────────────
// Each dimension maps a session summary (or signal) column to its
// profile mean/std columns. Only dimensions with both mean and std
// in the profile are usable for z-scoring.

interface DimensionDef {
  name: string;
  sessionQuery: string;   // column from tb_session_summaries
  profileMean: string;    // column from tb_personal_profile
  profileStd: string;     // column from tb_personal_profile
  source: 'summary' | 'motor';
}

const DIMENSIONS: DimensionDef[] = [
  // Motor fingerprint
  { name: 'iki_mean', sessionQuery: 'inter_key_interval_mean', profileMean: 'iki_mean_mean', profileStd: 'iki_mean_std', source: 'summary' },
  { name: 'hold_time', sessionQuery: 'hold_time_mean', profileMean: 'hold_time_mean_mean', profileStd: 'hold_time_mean_std', source: 'summary' },
  { name: 'flight_time', sessionQuery: 'flight_time_mean', profileMean: 'flight_time_mean_mean', profileStd: 'flight_time_mean_std', source: 'summary' },
  { name: 'ex_gaussian_mu', sessionQuery: 'ex_gaussian_mu', profileMean: 'ex_gaussian_mu_mean', profileStd: 'ex_gaussian_mu_std', source: 'motor' },
  { name: 'ex_gaussian_sigma', sessionQuery: 'ex_gaussian_sigma', profileMean: 'ex_gaussian_sigma_mean', profileStd: 'ex_gaussian_sigma_std', source: 'motor' },
  { name: 'ex_gaussian_tau', sessionQuery: 'ex_gaussian_tau', profileMean: 'ex_gaussian_tau_mean', profileStd: 'ex_gaussian_tau_std', source: 'motor' },
  // Writing process shape
  { name: 'burst_count', sessionQuery: 'p_burst_count', profileMean: 'burst_count_mean', profileStd: 'burst_count_std', source: 'summary' },
  { name: 'burst_length', sessionQuery: 'avg_p_burst_length', profileMean: 'burst_length_mean', profileStd: 'burst_length_std', source: 'summary' },
  { name: 'session_duration', sessionQuery: 'total_duration_ms', profileMean: 'session_duration_mean', profileStd: 'session_duration_std', source: 'summary' },
  { name: 'word_count', sessionQuery: 'word_count', profileMean: 'word_count_mean', profileStd: 'word_count_std', source: 'summary' },
  // Pause architecture
  { name: 'first_keystroke', sessionQuery: 'first_keystroke_ms', profileMean: 'first_keystroke_mean', profileStd: 'first_keystroke_std', source: 'summary' },
  // Language signature
  { name: 'mattr', sessionQuery: 'mattr', profileMean: 'mattr_mean', profileStd: 'mattr_std', source: 'summary' },
];

// ─── Load profile ───────────────────────────────────────────────────

async function loadProfile(subjectId: number): Promise<Record<string, number | null> | null> {
  const rows = await sql`SELECT * FROM tb_personal_profile WHERE subject_id = ${subjectId} LIMIT 1`;
  if (rows.length === 0) return null;
  return rows[0] as Record<string, number | null>;
}

// ─── Load session data ──────────────────────────────────────────────

async function loadSessionSummary(subjectId: number, questionId: number): Promise<Record<string, number | null> | null> {
  const rows = await sql`
    SELECT inter_key_interval_mean, hold_time_mean, flight_time_mean,
           p_burst_count, avg_p_burst_length, total_duration_ms, word_count,
           first_keystroke_ms, mattr
    FROM tb_session_summaries
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
  `;
  if (rows.length === 0) return null;
  return rows[0] as Record<string, number | null>;
}

async function loadMotorSignals(subjectId: number, questionId: number): Promise<Record<string, number | null> | null> {
  const rows = await sql`
    SELECT ex_gaussian_mu, ex_gaussian_sigma, ex_gaussian_tau
    FROM tb_motor_signals
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
  `;
  if (rows.length === 0) return null;
  return rows[0] as Record<string, number | null>;
}

// ─── Compute historical threshold ───────────────────────────────────

async function computeThreshold(subjectId: number, dimensionCount: number): Promise<number> {
  const rows = await sql`
    SELECT profile_distance
    FROM tb_session_integrity
    WHERE subject_id = ${subjectId}
    ORDER BY session_integrity_id ASC
  `;

  const distances = (rows as unknown as Array<{ profile_distance: number }>)
    .map(r => r.profile_distance)
    .filter(v => v != null && Number.isFinite(v));

  if (distances.length < 3) {
    // Not enough history; use chi-squared heuristic for multivariate normal
    // E[||z||] = sqrt(k), std ≈ sqrt(2). Threshold = sqrt(k) + 2*sqrt(2)
    return Math.sqrt(dimensionCount) + 2 * Math.SQRT2;
  }

  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const std = Math.sqrt(
    distances.reduce((s, v) => s + (v - mean) ** 2, 0) / (distances.length - 1)
  );

  // Floor: never below sqrt(k) to avoid flagging normal variance
  return Math.max(mean + 2 * std, Math.sqrt(dimensionCount));
}

// ─── Main computation ───────────────────────────────────────────────

export async function computeSessionIntegrity(subjectId: number, questionId: number): Promise<IntegrityResult | null> {
  // Calibration sessions (question_source_id = 3) are prompted neutral writing
  // that produces systematically large distances against the journal-derived
  // profile. Allowing them in would inflate the threshold and mask genuine
  // journal anomalies.
  const sourceRows = await sql`
    SELECT question_source_id FROM tb_questions
    WHERE question_id = ${questionId} AND subject_id = ${subjectId}
  `;
  if (sourceRows.length === 0) {
    await logSignalSkip(subjectId, questionId, 'integrity', 'question_not_found');
    return null;
  }
  if ((sourceRows[0] as { question_source_id: number }).question_source_id === 3) {
    await logSignalSkip(subjectId, questionId, 'integrity', 'calibration_excluded');
    return null;
  }

  const profile = await loadProfile(subjectId);
  if (!profile || !profile.session_count || (profile.session_count as number) < 5) {
    await logSignalSkip(subjectId, questionId, 'integrity', 'profile_too_immature', {
      needed: 5,
      got: (profile?.session_count as number | null | undefined) ?? 0,
    });
    return null;
  }

  const summary = await loadSessionSummary(subjectId, questionId);
  if (!summary) {
    await logSignalSkip(subjectId, questionId, 'integrity', 'session_summary_missing');
    return null;
  }

  const motor = await loadMotorSignals(subjectId, questionId);

  // Gather aligned values/means/stds for dimensions with valid data
  const dimNames: string[] = [];
  const values: number[] = [];
  const means: number[] = [];
  const stds: number[] = [];

  for (const dim of DIMENSIONS) {
    const profileMean = profile[dim.profileMean];
    const profileStd = profile[dim.profileStd];

    if (profileMean == null || profileStd == null || (profileStd as number) <= 0) continue;

    const source = dim.source === 'motor' ? motor : summary;
    if (!source) continue;

    const sessionVal = source[dim.sessionQuery];
    if (sessionVal == null) continue;

    dimNames.push(dim.name);
    values.push(sessionVal as number);
    means.push(profileMean as number);
    stds.push(profileStd as number);
  }

  if (dimNames.length < 3) {
    await logSignalSkip(subjectId, questionId, 'integrity', 'dimension_count_too_low', {
      needed: 3,
      got: dimNames.length,
    });
    return null;
  }

  // Rust computes z-scores and L2 distance. Single source of truth.
  const rustResult = rustProfileDistance(values, means, stds);
  if (!rustResult || rustResult.zScores.length !== dimNames.length) {
    await logSignalSkip(subjectId, questionId, 'integrity', 'compute_error', {
      detail: !rustResult ? 'rustProfileDistance returned null' : 'zScores length mismatch',
      dimensionCount: dimNames.length,
      rustResultZScores: rustResult?.zScores.length ?? null,
    });
    return null;
  }

  const zScores: Record<string, number> = {};
  for (let i = 0; i < dimNames.length; i++) {
    zScores[dimNames[i]!] = rustResult.zScores[i]!;
  }
  const distance = rustResult.distance;

  const dimCount = dimNames.length;

  const threshold = await computeThreshold(subjectId, dimCount);
  const isFlagged = distance > threshold;

  return {
    questionId,
    profileDistance: distance,
    dimensionCount: dimCount,
    zScores,
    isFlagged,
    thresholdUsed: threshold,
    profileSessionCount: profile.session_count as number,
  };
}
