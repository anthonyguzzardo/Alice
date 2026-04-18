/**
 * Native Rust Signal Engine Bindings
 *
 * Loads the napi-rs native module and exposes typed functions
 * matching the TypeScript signal computation APIs. Falls back
 * to TypeScript implementations if the native module fails to load.
 */

import { createRequire } from 'node:module';
import { computeDynamicalSignals as computeDynamicalTS, type KeystrokeEvent, type DynamicalSignals } from './dynamical-signals.ts';
import { computeMotorSignals as computeMotorTS, type MotorSignals } from './motor-signals.ts';
import { computeProcessSignals as computeProcessTS, type ProcessSignals } from './process-signals.ts';

// napi-rs omits Rust Option::None fields entirely, producing undefined.
// postgres.js rejects undefined values. Coerce to null.
function n(v: number | null | undefined): number | null {
  return v ?? null;
}
function na(v: number[] | null | undefined): number[] | null {
  return v ?? null;
}
function ns(v: string | null | undefined): string | null {
  return v ?? null;
}

// ─── Native module loading ─────────────────────────────────────────

interface NativeModule {
  computeDynamicalSignals(streamJson: string): {
    ikiCount: number;
    holdFlightCount: number;
    permutationEntropy: number | null;
    permutationEntropyRaw: number | null;
    dfaAlpha: number | null;
    rqaDeterminism: number | null;
    rqaLaminarity: number | null;
    rqaTrappingTime: number | null;
    rqaRecurrenceRate: number | null;
    teHoldToFlight: number | null;
    teFlightToHold: number | null;
    teDominance: number | null;
  };
  computeMotorSignals(streamJson: string, totalDurationMs: number): {
    sampleEntropy: number | null;
    ikiAutocorrelation: number[] | null;
    motorJerk: number | null;
    lapseRate: number | null;
    tempoDrift: number | null;
    ikiCompressionRatio: number | null;
    digraphLatencyProfile: string | null;
    exGaussianTau: number | null;
    exGaussianMu: number | null;
    exGaussianSigma: number | null;
    tauProportion: number | null;
    adjacentHoldTimeCov: number | null;
  };
  computeProcessSignals(eventLogJson: string): {
    pauseWithinWord: number | null;
    pauseBetweenWord: number | null;
    pauseBetweenSentence: number | null;
    abandonedThoughtCount: number | null;
    rBurstCount: number | null;
    iBurstCount: number | null;
    vocabExpansionRate: number | null;
    phaseTransitionPoint: number | null;
    strategyShiftCount: number | null;
  };
}

let native: NativeModule | null = null;

try {
  const require = createRequire(import.meta.url);
  native = require('../../src-rs/alice-signals.darwin-arm64.node') as NativeModule;
  console.log('[signals] Rust engine loaded');
} catch {
  console.warn('[signals] Rust engine unavailable, using TypeScript fallback');
}

export const hasNativeEngine = native !== null;

// ─── Dynamical signals ─────────────────────────────────────────────

export function computeDynamicalSignals(stream: KeystrokeEvent[]): DynamicalSignals {
  if (!native) return computeDynamicalTS(stream);

  try {
    const t0 = performance.now();
    const result = native.computeDynamicalSignals(JSON.stringify(stream));
    console.log(`[signals] rust dynamical: ${(performance.now() - t0).toFixed(1)}ms (${stream.length} keystrokes)`);
    return {
      ikiCount: result.ikiCount ?? 0,
      holdFlightCount: result.holdFlightCount ?? 0,
      permutationEntropy: n(result.permutationEntropy),
      permutationEntropyRaw: n(result.permutationEntropyRaw),
      dfaAlpha: n(result.dfaAlpha),
      rqaDeterminism: n(result.rqaDeterminism),
      rqaLaminarity: n(result.rqaLaminarity),
      rqaTrappingTime: n(result.rqaTrappingTime),
      rqaRecurrenceRate: n(result.rqaRecurrenceRate),
      teHoldToFlight: n(result.teHoldToFlight),
      teFlightToHold: n(result.teFlightToHold),
      teDominance: n(result.teDominance),
    };
  } catch (err) {
    console.error('[signals] Rust dynamical failed, falling back to TS:', err);
    return computeDynamicalTS(stream);
  }
}

// ─── Motor signals ─────────────────────────────────────────────────

export function computeMotorSignals(
  stream: KeystrokeEvent[],
  totalDurationMs: number,
): MotorSignals {
  if (!native) return computeMotorTS(stream, totalDurationMs);

  try {
    const t0 = performance.now();
    const result = native.computeMotorSignals(JSON.stringify(stream), totalDurationMs);
    console.log(`[signals] rust motor: ${(performance.now() - t0).toFixed(1)}ms`);
    return {
      sampleEntropy: n(result.sampleEntropy),
      ikiAutocorrelation: na(result.ikiAutocorrelation),
      motorJerk: n(result.motorJerk),
      lapseRate: n(result.lapseRate),
      tempoDrift: n(result.tempoDrift),
      ikiCompressionRatio: n(result.ikiCompressionRatio),
      digraphLatencyProfile: result.digraphLatencyProfile
        ? JSON.parse(result.digraphLatencyProfile) as Record<string, number>
        : null,
      exGaussianTau: n(result.exGaussianTau),
      exGaussianMu: n(result.exGaussianMu),
      exGaussianSigma: n(result.exGaussianSigma),
      tauProportion: n(result.tauProportion),
      adjacentHoldTimeCov: n(result.adjacentHoldTimeCov),
    };
  } catch (err) {
    console.error('[signals] Rust motor failed, falling back to TS:', err);
    return computeMotorTS(stream, totalDurationMs);
  }
}

// ─── Process signals ───────────────────────────────────────────────

export function computeProcessSignals(eventLogJson: string): ProcessSignals {
  if (!native) return computeProcessTS(eventLogJson);

  try {
    const t0 = performance.now();
    const result = native.computeProcessSignals(eventLogJson);
    console.log(`[signals] rust process: ${(performance.now() - t0).toFixed(1)}ms`);
    return {
      pauseWithinWord: n(result.pauseWithinWord),
      pauseBetweenWord: n(result.pauseBetweenWord),
      pauseBetweenSentence: n(result.pauseBetweenSentence),
      abandonedThoughtCount: n(result.abandonedThoughtCount),
      rBurstCount: n(result.rBurstCount),
      iBurstCount: n(result.iBurstCount),
      vocabExpansionRate: n(result.vocabExpansionRate),
      phaseTransitionPoint: n(result.phaseTransitionPoint),
      strategyShiftCount: n(result.strategyShiftCount),
    };
  } catch (err) {
    console.error('[signals] Rust process failed, falling back to TS:', err);
    return computeProcessTS(eventLogJson);
  }
}
