/**
 * Emotion-Behavior Coupling Stability Analysis
 *
 * Answers: is emotion→behavior coupling a stable within-person
 * characteristic, or noise? Uses a rolling-window approach over
 * the full history to measure how coupling estimates converge.
 *
 * This is a prerequisite for ghost comparison. If coupling is not
 * stable, comparing it to a deliberately-decoupled ghost is
 * tautological regardless of the result.
 *
 * Method:
 *   For windows of size [MIN, MIN+STEP, MIN+2*STEP, ..., N],
 *   compute all emotion→behavior cross-correlations (same algorithm
 *   as libEmotionProfile.ts). For each (emotion_dim, behavior_dim)
 *   pair, track how the correlation estimate changes across windows.
 *   CV < 0.5 = stable. Trend converging = the estimate is settling.
 */

import {
  loadEmotionEntries,
  EMOTION_DIMENSIONS,
  type EmotionDimension,
  type EmotionEntry,
} from './libAliceNegative/libEmotionProfile.ts';
import {
  computeEntryStates,
} from './libAliceNegative/libStateEngine.ts';
import { computeBatchCorrelations as rustBatchCorrelations } from './libSignalsNative.ts';
import {
  STATE_DIMENSIONS,
  type StateDimension,
  type EntryState,
} from './libAliceNegative/libStateEngine.ts';

// ─── Configuration ──────────────────────────────────────────────────

const MIN_WINDOW = 10;
const WINDOW_STEP = 2;
const COUPLING_THRESHOLD = 0.3;
const MAX_LAG = 3;

// ─── Types ──────────────────────────────────────────────────────────

export interface CouplingTrajectory {
  emotionDim: EmotionDimension;
  behaviorDim: StateDimension;
  /** Correlation values at each window size */
  windowSizes: number[];
  correlations: number[];
  lags: number[];
  /** Final (full-window) correlation */
  finalCorrelation: number;
  finalLag: number;
  finalDirection: number;
  /** Stability metrics */
  cv: number;
  isStable: boolean;
  /** Linear trend slope of |correlation| over windows */
  trendSlope: number;
}

export interface CouplingStabilityResult {
  entryCount: number;
  windowCount: number;
  stablePairs: CouplingTrajectory[];
  unstablePairs: CouplingTrajectory[];
  /** Fraction of discovered couplings that are stable */
  stabilityRate: number;
  /** All pairs that exceeded threshold in at least one window */
  allPairs: CouplingTrajectory[];
}

// ─── Signed Pearson (matches libEmotionProfile.ts) ──────────────────

function signedPearson(a: number[], b: number[]): number {
  if (a.length < 3 || a.length !== b.length) return 0;
  const n = a.length;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]!; sumB += b[i]!; }
  const ma = sumA / n, mb = sumB / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i]! - ma;
    const bi = b[i]! - mb;
    num += ai * bi;
    da += ai * ai;
    db += bi * bi;
  }
  const denom = Math.sqrt(da * db);
  return denom < 1e-10 ? 0 : num / denom;
}

// ─── Compute coupling at a single window size ───────────────────────

function computeCouplingAtWindow(
  emotionEntries: EmotionEntry[],
  behaviorStates: EntryState[],
  windowSize: number,
): Map<string, { correlation: number; lag: number; direction: number }> {
  const n = Math.min(windowSize, emotionEntries.length, behaviorStates.length);
  const result = new Map<string, { correlation: number; lag: number; direction: number }>();

  if (n < MIN_WINDOW) return result;

  const emotionSeries: Record<string, number[]> = {};
  for (const dim of EMOTION_DIMENSIONS) {
    emotionSeries[dim] = emotionEntries.slice(0, n).map(e => e[dim]);
  }

  const behaviorSeries: Record<string, number[]> = {};
  for (const dim of STATE_DIMENSIONS) {
    behaviorSeries[dim] = behaviorStates.slice(0, n).map(s => s[dim] as number);
  }

  for (const eDim of EMOTION_DIMENSIONS) {
    for (const bDim of STATE_DIMENSIONS) {
      const eValues = emotionSeries[eDim]!;
      const bValues = behaviorSeries[bDim]!;

      if (n < MAX_LAG * 2 + 3) continue;

      let bestCorr = 0;
      let bestLag = 0;

      for (let lag = 0; lag <= MAX_LAG; lag++) {
        const end = n - lag;
        const a = eValues.slice(0, end);
        const b = bValues.slice(lag, lag + end);
        const r = signedPearson(a, b);
        if (Math.abs(r) > Math.abs(bestCorr)) {
          bestCorr = r;
          bestLag = lag;
        }
      }

      if (Math.abs(bestCorr) >= COUPLING_THRESHOLD) {
        const key = `${eDim}|${bDim}`;
        result.set(key, {
          correlation: bestCorr,
          lag: bestLag,
          direction: bestCorr >= 0 ? 1 : -1,
        });
      }
    }
  }

  return result;
}

// ─── Linear regression slope ────────────────────────────────────────

function linregSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!; sumY += ys[i]!;
    sumXY += xs[i]! * ys[i]!; sumXX += xs[i]! * xs[i]!;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

// ─── Main computation ───────────────────────────────────────────────

export async function computeCouplingStability(): Promise<CouplingStabilityResult> {
  const [emotionEntries, behaviorStates] = await Promise.all([
    loadEmotionEntries(),
    computeEntryStates(),
  ]);

  const maxN = Math.min(emotionEntries.length, behaviorStates.length);

  if (maxN < MIN_WINDOW) {
    return {
      entryCount: maxN,
      windowCount: 0,
      stablePairs: [],
      unstablePairs: [],
      stabilityRate: 0,
      allPairs: [],
    };
  }

  // Generate window sizes
  const windowSizes: number[] = [];
  for (let w = MIN_WINDOW; w <= maxN; w += WINDOW_STEP) {
    windowSizes.push(w);
  }
  if (windowSizes[windowSizes.length - 1] !== maxN) {
    windowSizes.push(maxN);
  }

  // Prepare series arrays for Rust batch computation
  const emotionSeries = EMOTION_DIMENSIONS.map(dim =>
    emotionEntries.slice(0, maxN).map(e => e[dim])
  );
  const behaviorSeries = STATE_DIMENSIONS.map(dim =>
    behaviorStates.slice(0, maxN).map(s => s[dim] as number)
  );

  // Try Rust batch computation; fall back to TS if unavailable
  const rustResults = rustBatchCorrelations(
    emotionSeries, behaviorSeries, windowSizes, MAX_LAG, COUPLING_THRESHOLD
  );

  // Index results by key+window for trajectory building
  type CorrEntry = { correlation: number; lag: number };
  const windowResults: Map<string, CorrEntry>[] = windowSizes.map(() => new Map());

  if (rustResults && rustResults.length > 0) {
    // Rust results: flat list of (aIndex, bIndex, windowSize, correlation, lag)
    for (const r of rustResults) {
      const eDim = EMOTION_DIMENSIONS[r.aIndex];
      const bDim = STATE_DIMENSIONS[r.bIndex];
      if (!eDim || !bDim) continue;
      const key = `${eDim}|${bDim}`;
      const wsIdx = windowSizes.indexOf(r.windowSize);
      if (wsIdx >= 0) {
        windowResults[wsIdx]!.set(key, { correlation: r.correlation, lag: r.lag });
      }
    }
  } else {
    // TS fallback
    for (let wi = 0; wi < windowSizes.length; wi++) {
      const wr = computeCouplingAtWindow(emotionEntries, behaviorStates, windowSizes[wi]!);
      windowResults[wi] = wr;
    }
  }

  // Collect all pairs that appeared in any window
  const allKeys = new Set<string>();
  for (const wr of windowResults) {
    for (const key of wr.keys()) allKeys.add(key);
  }

  // Build trajectories
  const trajectories: CouplingTrajectory[] = [];

  for (const key of allKeys) {
    const [eDim, bDim] = key.split('|') as [EmotionDimension, StateDimension];

    const tWindowSizes: number[] = [];
    const tCorrelations: number[] = [];
    const tLags: number[] = [];

    for (let i = 0; i < windowSizes.length; i++) {
      const wr = windowResults[i]!;
      if (wr.has(key)) {
        const { correlation, lag } = wr.get(key)!;
        tWindowSizes.push(windowSizes[i]!);
        tCorrelations.push(correlation);
        tLags.push(lag);
      }
    }

    if (tCorrelations.length < 2) continue;

    // CV of absolute correlation
    const absCorrs = tCorrelations.map(Math.abs);
    const mean = absCorrs.reduce((a, b) => a + b, 0) / absCorrs.length;
    const std = Math.sqrt(
      absCorrs.reduce((s, v) => s + (v - mean) ** 2, 0) / (absCorrs.length - 1)
    );
    const cv = mean > 0.001 ? std / mean : Infinity;

    const trendSlope = linregSlope(tWindowSizes, absCorrs);

    const lastIdx = tCorrelations.length - 1;

    trajectories.push({
      emotionDim: eDim,
      behaviorDim: bDim,
      windowSizes: tWindowSizes,
      correlations: tCorrelations,
      lags: tLags,
      finalCorrelation: tCorrelations[lastIdx]!,
      finalLag: tLags[lastIdx]!,
      finalDirection: tCorrelations[lastIdx]! >= 0 ? 1 : -1,
      cv,
      isStable: cv < 0.5,
      trendSlope,
    });
  }

  trajectories.sort((a, b) => Math.abs(b.finalCorrelation) - Math.abs(a.finalCorrelation));

  const stablePairs = trajectories.filter(t => t.isStable);
  const unstablePairs = trajectories.filter(t => !t.isStable);
  const stabilityRate = trajectories.length > 0
    ? stablePairs.length / trajectories.length
    : 0;

  return {
    entryCount: maxN,
    windowCount: windowSizes.length,
    stablePairs,
    unstablePairs,
    stabilityRate,
    allPairs: trajectories,
  };
}
