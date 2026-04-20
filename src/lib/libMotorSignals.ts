/**
 * Motor Signal Computation
 *
 * Computes motor and rhythmic features from raw keystroke streams.
 * These complement dynamical-signals.ts by capturing cognitive rhythm,
 * motor smoothness, fatigue markers, and typing automaticity.
 *
 * Signals:
 *   sampleEntropy          — Richman & Moorman 2000: temporal regularity of IKI
 *   ikiAutocorrelation     — DARPA Active Auth: cognitive rhythm at lags 1-5
 *   motorJerk              — graphomotor analysis: motor planning smoothness
 *   lapseRate              — Haag et al. 2020: micro-dropout count (fatigue)
 *   tempoDrift             — fatigue research: speed slope across session
 *   ikiCompressionRatio    — information theory: IKI sequence complexity
 *   digraphLatencyProfile  — CMU keystroke lab: per-digraph flight times
 *
 * All signals work on keystroke streams as short as 30-100 points.
 */

import { gzipSync } from 'node:zlib';
import type { KeystrokeEvent } from './libDynamicalSignals.ts';

// ─── Types ──────────────────────────────────────────────────────────

export interface MotorSignals {
  sampleEntropy: number | null;
  ikiAutocorrelation: number[] | null;    // lags 1-5
  motorJerk: number | null;
  lapseRate: number | null;
  tempoDrift: number | null;
  ikiCompressionRatio: number | null;
  digraphLatencyProfile: Record<string, number> | null;
  // Phase 2 expansion (2026-04-18)
  exGaussianTau: number | null;
  exGaussianMu: number | null;
  exGaussianSigma: number | null;
  tauProportion: number | null;
  adjacentHoldTimeCov: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────

function extractIKI(stream: KeystrokeEvent[]): number[] {
  const ikis: number[] = [];
  for (let i = 1; i < stream.length; i++) {
    const gap = stream[i].d - stream[i - 1].d;
    if (gap > 0 && gap < 5000) ikis.push(gap);
  }
  return ikis;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[], m?: number): number {
  const mu = m ?? mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length);
}

// ─── Sample Entropy (Richman & Moorman 2000) ────────────────────────
// Measures temporal regularity. Lower = more regular/rigid cognitive control.
// Higher = more erratic motor-cognitive coupling.
// Distinct from Shannon entropy (distribution) and permutation entropy (ordinal).

function sampleEntropy(series: number[], m: number = 2, rFactor: number = 0.2): number | null {
  if (series.length < 30) return null;

  // Tolerance computed from full series (matches Rust: full-series std_dev
  // calibrates r to overall session variability)
  const r = rFactor * std(series);
  if (r <= 0) return null;

  // Cap at 500 points for O(n^2 * m) feasibility (matches Rust motor.rs)
  const data = series.length > 500 ? series.slice(-500) : series;
  const n = data.length;

  function countMatches(data: number[], n: number, templateLen: number, r: number): number {
    let count = 0;
    for (let i = 0; i < n - templateLen; i++) {
      for (let j = i + 1; j < n - templateLen; j++) {
        let match = true;
        for (let k = 0; k < templateLen; k++) {
          if (Math.abs(data[i + k] - data[j + k]) > r) {
            match = false;
            break;
          }
        }
        if (match) count++;
      }
    }
    return count;
  }

  const B = countMatches(data, n, m, r);
  const A = countMatches(data, n, m + 1, r);

  if (B === 0) return null;
  return -Math.log(A / B);
}

// ─── IKI Autocorrelation (DARPA Active Authentication) ──────────────
// Cognitive rhythm: how correlated is the timing at different lags.

function ikiAutocorrelation(ikis: number[], maxLag: number = 5): number[] | null {
  const N = ikis.length;
  if (N < maxLag + 10) return null;

  const mu = mean(ikis);
  const variance = ikis.reduce((s, v) => s + (v - mu) ** 2, 0) / N;
  if (variance === 0) return null;

  const result: number[] = [];
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) {
      sum += (ikis[i] - mu) * (ikis[i + lag] - mu);
    }
    result.push(sum / ((N - lag) * variance));
  }
  return result;
}

// ─── Motor Jerk (graphomotor analysis) ──────────────────────────────
// Smoothness of motor execution. High jerk = poorly planned, jerky.
// Low jerk = smooth, well-planned motor sequence.

function motorJerk(ikis: number[]): number | null {
  if (ikis.length < 10) return null;

  // Velocity = inverse IKI (chars/ms), but we use IKI directly
  // Acceleration = diff of IKI
  // Jerk = diff of acceleration = 2nd diff of IKI
  const jerks: number[] = [];
  for (let i = 2; i < ikis.length; i++) {
    const accel1 = ikis[i] - ikis[i - 1];
    const accel0 = ikis[i - 1] - ikis[i - 2];
    jerks.push(Math.abs(accel1 - accel0));
  }

  return jerks.length > 0 ? mean(jerks) : null;
}

// ─── Lapse Rate (Haag et al. 2020) ─────────────────────────────────
// Micro-dropouts in sustained attention. IKIs > mean + 3*std.
// Not pauses (those are deliberate). Lapses are involuntary.

function lapseRate(ikis: number[], totalDurationMs: number): number | null {
  if (ikis.length < 20) return null;

  const mu = mean(ikis);
  const s = std(ikis, mu);
  const threshold = mu + 3 * s;

  const lapseCount = ikis.filter(v => v > threshold).length;
  const minutes = totalDurationMs / 60000;

  return minutes > 0 ? lapseCount / minutes : null;
}

// ─── Tempo Drift (fatigue / acceleration slope) ─────────────────────
// Linear slope of mean IKI across session quartiles.
// Positive = slowing down (fatigue). Negative = speeding up (warming up).

function tempoDrift(ikis: number[]): number | null {
  if (ikis.length < 20) return null;

  const q = Math.floor(ikis.length / 4);
  const quartileMeans: number[] = [];
  for (let i = 0; i < 4; i++) {
    const start = i * q;
    const end = i === 3 ? ikis.length : (i + 1) * q;
    const slice = ikis.slice(start, end);
    quartileMeans.push(mean(slice));
  }

  // Linear regression: y = quartileMeans, x = [0,1,2,3]
  const xMean = 1.5;
  const yMean = mean(quartileMeans);
  let num = 0, den = 0;
  for (let i = 0; i < 4; i++) {
    num += (i - xMean) * (quartileMeans[i] - yMean);
    den += (i - xMean) ** 2;
  }

  return den > 0 ? num / den : null;
}

// ─── IKI Compression Ratio (Kolmogorov complexity proxy) ────────────
// How compressible is the timing sequence? High ratio = repetitive/metronomic.
// Low ratio = varied/complex motor behavior.

function ikiCompressionRatio(ikis: number[]): number | null {
  if (ikis.length < 10) return null;

  // Serialize as comma-separated integers (ms precision)
  const raw = ikis.map(v => Math.round(v)).join(',');
  const rawBytes = Buffer.from(raw, 'utf-8');
  const compressed = gzipSync(rawBytes);

  return compressed.length / rawBytes.length;
}

// ─── Digraph Latency Profile (CMU keystroke lab) ────────────────────
// Mean flight time for the most common consecutive key pairs.
// Individually distinctive and stable over time.

function digraphLatencyProfile(stream: KeystrokeEvent[]): Record<string, number> | null {
  if (stream.length < 20) return null;

  const digraphs = new Map<string, number[]>();

  for (let i = 1; i < stream.length; i++) {
    const ft = stream[i].d - stream[i - 1].u;
    if (ft > 0 && ft < 5000) {
      const key = `${stream[i - 1].c}>${stream[i].c}`;
      const arr = digraphs.get(key);
      if (arr) arr.push(ft);
      else digraphs.set(key, [ft]);
    }
  }

  // Take top 10 by frequency
  const sorted = [...digraphs.entries()]
    .filter(([, v]) => v.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  if (sorted.length === 0) return null;

  const profile: Record<string, number> = {};
  for (const [key, values] of sorted) {
    profile[key] = mean(values);
  }
  return profile;
}

// ─── Ex-Gaussian Tau (BiAffect / Zulueta 2018) ────────────────────
// Decomposes flight time distribution into Gaussian (motor speed) and
// exponential tail (cognitive slowing). Method of moments fitting.
// Tau shifts predict mood episodes before summary statistics move.

function exGaussianFit(flightTimes: number[]): {
  tau: number | null;
  mu: number | null;
  sigma: number | null;
  tauProportion: number | null;
} {
  if (flightTimes.length < 50) return { tau: null, mu: null, sigma: null, tauProportion: null };

  // Remove extreme outliers before fitting (BiAffect approach):
  // cap at Q3 + 3*IQR to prevent heavy tails from breaking method of moments.
  const sorted = [...flightTimes].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const cap = q3 + 3 * iqr;
  const filtered = flightTimes.filter(v => v <= cap);
  if (filtered.length < 50) return { tau: null, mu: null, sigma: null, tauProportion: null };

  const m = mean(filtered);
  const s = std(filtered, m);
  if (s <= 0) return { tau: null, mu: null, sigma: null, tauProportion: null };

  // Skewness (third standardized moment)
  const n = filtered.length;
  let m3 = 0;
  for (const v of filtered) {
    const d = (v - m) / s;
    m3 += d * d * d;
  }
  const skew = m3 / n;

  // Ex-Gaussian only valid for positively skewed distributions
  if (skew <= 0) return { tau: null, mu: null, sigma: null, tauProportion: null };

  // Method of moments: tau = std * (skewness/2)^(1/3)
  const tau = s * Math.cbrt(skew / 2);
  const variance = s * s;
  const tauSq = tau * tau;

  // Gaussian variance = total variance - tau^2
  const gaussianVar = variance - tauSq;
  if (gaussianVar <= 0) return { tau: null, mu: null, sigma: null, tauProportion: null };

  const sigma = Math.sqrt(gaussianVar);
  const mu = m - tau;

  // Sanity: mu should be positive for flight times
  if (mu <= 0) return { tau: null, mu: null, sigma: null, tauProportion: null };

  const tauProportion = m > 0 ? tau / m : null;

  return { tau, mu, sigma, tauProportion };
}

// ─── Adjacent Hold-Time Covariance (neuroQWERTY, Giancardo 2016) ───
// Pearson correlation between consecutive hold times. Motor coordination
// signal that degrades before mean hold time shifts in Parkinson's.

function adjacentHoldTimeCov(stream: KeystrokeEvent[]): number | null {
  // Extract hold times in sequence
  const holdTimes: number[] = [];
  for (const evt of stream) {
    const ht = evt.u - evt.d;
    if (ht > 0 && ht < 2000) holdTimes.push(ht);
  }
  if (holdTimes.length < 30) return null;

  const x = holdTimes.slice(0, -1);
  const y = holdTimes.slice(1);
  const n = x.length;

  const mx = mean(x);
  const my = mean(y);
  const sx = std(x, mx);
  const sy = std(y, my);

  if (sx === 0 || sy === 0) return null;

  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (x[i] - mx) * (y[i] - my);
  }

  return cov / (n * sx * sy);
}

// ─── Public API ─────────────────────────────────────────────────────

export function computeMotorSignals(
  stream: KeystrokeEvent[],
  totalDurationMs: number,
): MotorSignals {
  const ikis = extractIKI(stream);

  // Extract flight times for ex-Gaussian fitting
  const flightTimesArr: number[] = [];
  for (let i = 1; i < stream.length; i++) {
    const ft = stream[i].d - stream[i - 1].u;
    if (ft > 0 && ft < 5000) flightTimesArr.push(ft);
  }
  const exg = exGaussianFit(flightTimesArr);

  return {
    sampleEntropy: sampleEntropy(ikis),
    ikiAutocorrelation: ikiAutocorrelation(ikis),
    motorJerk: motorJerk(ikis),
    lapseRate: lapseRate(ikis, totalDurationMs),
    tempoDrift: tempoDrift(ikis),
    ikiCompressionRatio: ikiCompressionRatio(ikis),
    digraphLatencyProfile: digraphLatencyProfile(stream),
    exGaussianTau: exg.tau,
    exGaussianMu: exg.mu,
    exGaussianSigma: exg.sigma,
    tauProportion: exg.tauProportion,
    adjacentHoldTimeCov: adjacentHoldTimeCov(stream),
  };
}
