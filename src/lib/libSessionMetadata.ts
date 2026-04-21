/**
 * Per-session derived metadata signals (slice-3 follow-ups).
 *
 * These signals do not perturb the 7D behavioral z-score discipline or the
 * semantic 11D vector — they live in tb_session_metadata as session-level
 * descriptors. Joint embedding will pick them up as additional coordinates
 * once the distance function lands.
 *
 * Five computations:
 *   1. hour_typicality            — circular-density z-score on personal hour distribution
 *   2. deletion_curve_type        — early / late / uniform / bimodal / terminal-burst / none
 *   3. burst_trajectory_shape     — monotonic_up/down / u_shaped / inverted_u / flat / none
 *   4. inter_burst_interval       — mean + std of ms between burst boundaries
 *   5. deletion_during/between_burst — proximity of deletions to burst windows
 */

import sql from './libDb.ts';
import { getRburstSequence } from './libDb.ts';
import type { RBurstEntry } from './libDb.ts';

export interface SessionMetadataInputs {
  questionId: number;
  hourOfDay: number | null;
  totalDurationMs: number;
  deletionEvents: Array<{ c: number; t: number }>; // chars + ms_offset_from_start
  bursts: Array<{ chars: number; startOffsetMs: number; durationMs: number; burstIndex: number }>;
}

export interface SessionMetadataResult {
  question_id: number;
  hour_typicality: number | null;
  deletion_curve_type: string | null;
  burst_trajectory_shape: string | null;
  rburst_trajectory_shape: string | null;
  inter_burst_interval_mean_ms: number | null;
  inter_burst_interval_std_ms: number | null;
  deletion_during_burst_count: number | null;
  deletion_between_burst_count: number | null;
}

// ─── 1. Hour-of-day typicality ──────────────────────────────────────
// Personal hour distribution computed from history of session hours,
// smoothed with a circular kernel (half-width 1 hour). For each session,
// `hour_typicality = z((density at this hour) - mean(densities))`.
// Sessions at typical hours score near 0; unusual hours score negative.

function buildHourDensity(hours: number[]): number[] {
  const counts = new Array(24).fill(0);
  for (const h of hours) {
    if (h == null || h < 0 || h > 23) continue;
    counts[h] += 1;
  }
  // Circular smoothing with half-width 1 (3-bin moving average over circle)
  const smoothed = new Array(24).fill(0);
  for (let i = 0; i < 24; i++) {
    const left = (i - 1 + 24) % 24;
    const right = (i + 1) % 24;
    smoothed[i] = (counts[left] + counts[i] + counts[right]) / 3;
  }
  // Normalize to density
  const total = smoothed.reduce((s, v) => s + v, 0);
  if (total < 1e-10) return smoothed;
  return smoothed.map(v => v / total);
}

async function computeHourTypicality(hour: number | null): Promise<number | null> {
  if (hour == null) return null;
  const rows = await sql`
    SELECT ss.hour_of_day FROM tb_session_summaries ss
    JOIN tb_questions q ON ss.question_id = q.question_id
    WHERE q.question_source_id != 3 AND ss.hour_of_day IS NOT NULL
  ` as Array<{ hour_of_day: number }>;

  if (rows.length < 5) return null; // need a reasonable history first

  const hours = rows.map(r => r.hour_of_day);
  const density = buildHourDensity(hours);
  const myDensity = density[hour];
  const mean = density.reduce((s, v) => s + v, 0) / 24;
  const variance = density.reduce((s, v) => s + (v - mean) ** 2, 0) / 24;
  const std = Math.sqrt(variance);
  if (std < 1e-10) return 0;
  return (myDensity - mean) / std;
}

// ─── 2. Deletion-density curve classification ───────────────────────
// Bin deletion-event chars by relative session position (0=start, 1=end).
// Classify the resulting curve:
//   early       — mass concentrated in first third
//   late        — mass concentrated in last third
//   terminal    — sharp burst in last 10%
//   bimodal     — two peaks, sparse middle
//   uniform     — roughly even
//   none        — fewer than 3 deletion events

function classifyDeletionCurve(
  deletionEvents: Array<{ c: number; t: number }>,
  totalDurationMs: number,
): string | null {
  if (!deletionEvents || deletionEvents.length < 3) return 'none';
  if (totalDurationMs < 1000) return 'none';

  // 10-bin histogram of weighted deletion chars across session time
  const bins = new Array(10).fill(0);
  for (const ev of deletionEvents) {
    const rel = Math.min(0.9999, Math.max(0, ev.t / totalDurationMs));
    const bin = Math.floor(rel * 10);
    bins[bin] += ev.c;
  }
  const total = bins.reduce((s, v) => s + v, 0);
  if (total < 1) return 'none';
  const norm = bins.map(v => v / total);

  // Terminal burst: last bin > 40% of all deletion mass
  if (norm[9] > 0.4) return 'terminal';

  // Early: first third > 55%
  const earlySum = norm[0] + norm[1] + norm[2] + norm[3];
  if (earlySum > 0.55 && norm[9] < 0.2) return 'early';

  // Late: last third > 55%
  const lateSum = norm[6] + norm[7] + norm[8] + norm[9];
  if (lateSum > 0.55) return 'late';

  // Bimodal: peaks at both ends, valley in middle
  const middle = (norm[4] + norm[5]) / 2;
  const ends = (earlySum + lateSum) / 2;
  if (ends > 0.4 && middle < 0.05) return 'bimodal';

  return 'uniform';
}

// ─── 3. Burst trajectory shape ──────────────────────────────────────
// Classify the sequence of burst lengths (chars) as a temporal shape.

function classifyBurstShape(bursts: Array<{ chars: number }>): string | null {
  if (bursts.length < 3) return 'none';
  const lengths = bursts.map(b => b.chars);
  const n = lengths.length;

  // Compare first half to second half
  const mid = Math.floor(n / 2);
  const firstHalf = lengths.slice(0, mid);
  const secondHalf = lengths.slice(mid);
  const fhMean = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const shMean = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  // Coefficient of variation across the whole sequence
  const allMean = lengths.reduce((s, v) => s + v, 0) / n;
  const allVar = lengths.reduce((s, v) => s + (v - allMean) ** 2, 0) / n;
  const cv = allMean > 0 ? Math.sqrt(allVar) / allMean : 0;

  // Flat: low coefficient of variation
  if (cv < 0.25) return 'flat';

  // Monotonic: count strict increases vs decreases
  let up = 0, down = 0;
  for (let i = 1; i < n; i++) {
    if (lengths[i] > lengths[i - 1]) up++;
    else if (lengths[i] < lengths[i - 1]) down++;
  }
  const monotonicityRatio = Math.max(up, down) / (n - 1);

  if (monotonicityRatio >= 0.7) {
    return shMean > fhMean ? 'monotonic_up' : 'monotonic_down';
  }

  // U-shape vs inverted-U: middle vs ends
  const middleStart = Math.floor(n / 3);
  const middleEnd = Math.ceil((2 * n) / 3);
  const middleLengths = lengths.slice(middleStart, middleEnd);
  const middleMean = middleLengths.length > 0
    ? middleLengths.reduce((s, v) => s + v, 0) / middleLengths.length
    : allMean;
  const endsMean = (fhMean + shMean) / 2;

  if (middleMean < 0.7 * endsMean) return 'u_shaped';
  if (middleMean > 1.3 * endsMean) return 'inverted_u';

  // Default: irregular, call it none rather than mislabel
  return 'none';
}

// ─── 4. Inter-burst interval distribution ───────────────────────────
// Time between burst boundaries (end of burst N to start of burst N+1).

function computeInterBurstInterval(
  bursts: Array<{ startOffsetMs: number; durationMs: number }>,
): { mean: number | null; std: number | null } {
  if (bursts.length < 2) return { mean: null, std: null };
  const intervals: number[] = [];
  for (let i = 1; i < bursts.length; i++) {
    const prevEnd = bursts[i - 1].startOffsetMs + bursts[i - 1].durationMs;
    const gap = bursts[i].startOffsetMs - prevEnd;
    if (gap > 0) intervals.push(gap);
  }
  if (intervals.length === 0) return { mean: null, std: null };
  const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
  return { mean, std: Math.sqrt(variance) };
}

// ─── 5. Deletion-burst proximity ────────────────────────────────────
// For each deletion event, was it inside a burst window or between bursts?

function computeDeletionBurstProximity(
  deletionEvents: Array<{ c: number; t: number }>,
  bursts: Array<{ startOffsetMs: number; durationMs: number }>,
): { during: number; between: number } {
  let during = 0, between = 0;
  for (const ev of deletionEvents) {
    let inBurst = false;
    for (const b of bursts) {
      if (ev.t >= b.startOffsetMs && ev.t <= b.startOffsetMs + b.durationMs) {
        inBurst = true;
        break;
      }
    }
    if (inBurst) during++;
    else between++;
  }
  return { during, between };
}

// ─── 6. R-burst trajectory shape ────────────────────────────────────
// Same shape taxonomy as P-bursts, applied to R-burst deletion magnitudes.
// "Are your revisions getting larger or smaller over the session?"

function classifyRburstShape(rbursts: Array<{ deletedCharCount: number }>): string | null {
  if (rbursts.length < 3) return 'none';
  // Reuse the same classifier on deletion magnitudes
  return classifyBurstShape(rbursts.map(r => ({ chars: r.deletedCharCount })));
}

// ─── Public API ─────────────────────────────────────────────────────

export async function computeSessionMetadata(inputs: SessionMetadataInputs): Promise<SessionMetadataResult> {
  const hour_typicality = await computeHourTypicality(inputs.hourOfDay);
  const deletion_curve_type = classifyDeletionCurve(inputs.deletionEvents, inputs.totalDurationMs);
  const burst_trajectory_shape = classifyBurstShape(inputs.bursts);
  const ibi = computeInterBurstInterval(inputs.bursts);
  const proximity = computeDeletionBurstProximity(inputs.deletionEvents, inputs.bursts);

  return {
    question_id: inputs.questionId,
    hour_typicality,
    deletion_curve_type,
    burst_trajectory_shape,
    rburst_trajectory_shape: null, // computed later in signal pipeline after R-burst sequences are saved
    inter_burst_interval_mean_ms: ibi.mean,
    inter_burst_interval_std_ms: ibi.std,
    deletion_during_burst_count: proximity.during,
    deletion_between_burst_count: proximity.between,
  };
}

/**
 * Compute and persist R-burst trajectory shape for a session.
 * Called from the signal pipeline after R-burst sequences have been saved.
 */
export async function updateRburstTrajectoryShape(questionId: number): Promise<void> {
  const rbursts = await getRburstSequence(questionId);
  const shape = classifyRburstShape(rbursts);
  await sql`
    UPDATE tb_session_metadata
    SET rburst_trajectory_shape = ${shape}
    WHERE question_id = ${questionId}
  `;
}
