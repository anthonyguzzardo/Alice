/**
 * Shared math utilities for behavioral signal computation.
 * Used by bob.ts (signal pipeline), trajectory.ts, and signals.ts (formatting).
 *
 * Research basis:
 *   MATTR — McCarthy & Jarvis (2010), validated for short texts
 */

// ─── Basic statistics ──────────────────────────────────────────────

export function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avg(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
}

export function stddev(values: number[]): number {
  return Math.sqrt(variance(values));
}

export const clamp = (v: number, fallback = 0) => Math.min(1, Math.max(0, v ?? fallback));

// ─── Normalization ──────���──────────────────────────────────────────

/** Personal percentile rank: what fraction of historical values fall below this one */
export function percentileRank(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0.5;
  const below = allValues.filter(v => v < value).length;
  return below / allValues.length;
}

/** Rescale a delta from [-1, 1] to [0, 1] where 0.5 = no change */
export function rescaleDelta(delta: number): number {
  return Math.max(0, Math.min(1, 0.5 + delta));
}

/** Normalize variance to 0–1 scale */
export function normVariance(v: number, maxExpected: number = 0.25): number {
  return Math.min(1, v / maxExpected);
}

// ─── MATTR (Moving-Average Type-Token Ratio) ───────────────────────
// McCarthy & Jarvis (2010) — validated for short texts, length-independent

export function computeMATTR(words: string[], windowSize = 25): number {
  if (words.length === 0) return 0.5;
  if (words.length <= windowSize) {
    return new Set(words).size / words.length;
  }
  let sum = 0;
  const windows = words.length - windowSize + 1;
  for (let i = 0; i < windows; i++) {
    const window = words.slice(i, i + windowSize);
    sum += new Set(window).size / windowSize;
  }
  return sum / windows;
}

// ─── Word sets ─────────────────────────────────────────────────────

export const HEDGING_WORDS = new Set([
  'maybe', 'perhaps', 'possibly', 'probably', 'might', 'could',
  'somewhat', 'guess', 'suppose', 'seem', 'seems', 'seemed',
  'apparently', 'arguably', 'basically', 'honestly',
]);

export const FIRST_PERSON = new Set(['i', 'me', 'my', 'mine', 'myself']);
