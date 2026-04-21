/**
 * Native Rust Signal Engine Bindings
 *
 * Loads the napi-rs native module and exposes typed functions for signal
 * computation. Rust is the single source of truth for all signal math.
 * If the native module fails to load, signal computation returns null
 * and the pipeline skips that family for the session.
 */

import { createRequire } from 'node:module';
import { logError } from './utlErrorLog.ts';

// ─── Signal types (canonical definitions) ─────────────────────────

export interface KeystrokeEvent {
  c: string;   // key code
  d: number;   // keydown offset ms
  u: number;   // keyup offset ms
}

export interface DynamicalSignals {
  ikiCount: number;
  holdFlightCount: number;
  permutationEntropy: number | null;
  permutationEntropyRaw: number | null;
  peSpectrum: number[] | null;
  dfaAlpha: number | null;
  rqaDeterminism: number | null;
  rqaLaminarity: number | null;
  rqaTrappingTime: number | null;
  rqaRecurrenceRate: number | null;
  teHoldToFlight: number | null;
  teFlightToHold: number | null;
  teDominance: number | null;
}

export interface MotorSignals {
  sampleEntropy: number | null;
  ikiAutocorrelation: number[] | null;
  motorJerk: number | null;
  lapseRate: number | null;
  tempoDrift: number | null;
  ikiCompressionRatio: number | null;
  digraphLatencyProfile: Record<string, number> | null;
  exGaussianTau: number | null;
  exGaussianMu: number | null;
  exGaussianSigma: number | null;
  tauProportion: number | null;
  adjacentHoldTimeCov: number | null;
}

export interface ProcessSignals {
  pauseWithinWord: number | null;
  pauseBetweenWord: number | null;
  pauseBetweenSentence: number | null;
  abandonedThoughtCount: number | null;
  rBurstCount: number | null;
  iBurstCount: number | null;
  vocabExpansionRate: number | null;
  phaseTransitionPoint: number | null;
  strategyShiftCount: number | null;
}

export interface PerplexityResult {
  perplexity: number;
  wordCount: number;
  knownFraction: number;
}

export interface AvatarResult {
  text: string;
  delays: number[];
  keystrokeStream: KeystrokeEvent[];
  wordCount: number;
  markovOrder: number;
  chainSize: number;
  iBurstCount: number;
}

// ─── Null coercion helpers ────────────────────────────────────────
// napi-rs omits Rust Option::None fields entirely, producing undefined.
// postgres.js rejects undefined values. Coerce to null.

function n(v: number | null | undefined): number | null {
  return v ?? null;
}
function na(v: number[] | null | undefined): number[] | null {
  return v ?? null;
}

// ─── Native module loading ─────────────────────────────────────────

interface NativeModule {
  computeDynamicalSignals(streamJson: string): {
    ikiCount: number;
    holdFlightCount: number;
    permutationEntropy: number | null;
    permutationEntropyRaw: number | null;
    peSpectrum: number[] | null;
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
  computePerplexity(corpusJson: string, text: string): {
    perplexity: number;
    wordCount: number;
    knownFraction: number;
  };
  generateAvatar(
    corpusJson: string,
    topic: string,
    profileJson: string,
    maxWords: number,
  ): {
    text: string;
    delays: number[];
    keystrokeStreamJson: string;
    wordCount: number;
    order: number;
    chainSize: number;
    iBurstCount: number;
  };
}

let native: NativeModule | null = null;

try {
  const require = createRequire(import.meta.url);
  native = require('../../src-rs/alice-signals.darwin-arm64.node') as NativeModule;
  console.log('[signals] Rust engine loaded');
} catch {
  console.warn('[signals] Rust engine unavailable — signal computation disabled');
}

export const hasNativeEngine = native !== null;

// ─── Dynamical signals ─────────────────────────────────────────────

export function computeDynamicalSignals(stream: KeystrokeEvent[]): DynamicalSignals | null {
  if (!native) return null;

  try {
    const t0 = performance.now();
    const result = native.computeDynamicalSignals(JSON.stringify(stream));
    console.log(`[signals] rust dynamical: ${(performance.now() - t0).toFixed(1)}ms (${stream.length} keystrokes)`);
    return {
      ikiCount: result.ikiCount ?? 0,
      holdFlightCount: result.holdFlightCount ?? 0,
      permutationEntropy: n(result.permutationEntropy),
      permutationEntropyRaw: n(result.permutationEntropyRaw),
      peSpectrum: na(result.peSpectrum),
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
    logError('signalsNative.dynamical', err, { eventCount: stream.length });
    return null;
  }
}

// ─── Motor signals ─────────────────────────────────────────────────

export function computeMotorSignals(
  stream: KeystrokeEvent[],
  totalDurationMs: number,
): MotorSignals | null {
  if (!native) return null;

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
    logError('signalsNative.motor', err, { eventCount: stream.length });
    return null;
  }
}

// ─── Process signals ───────────────────────────────────────────────

export function computeProcessSignals(eventLogJson: string): ProcessSignals | null {
  if (!native) return null;

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
    logError('signalsNative.process', err);
    return null;
  }
}

// ─── Perplexity (Markov model) ────────────────────────────────────

export function computePerplexity(corpusJson: string, text: string): PerplexityResult | null {
  if (!native) return null;

  try {
    const t0 = performance.now();
    const result = native.computePerplexity(corpusJson, text);
    console.log(`[signals] rust perplexity: ${(performance.now() - t0).toFixed(1)}ms`);
    if (result.perplexity < 0) return null; // Rust signals error with -1.0
    return {
      perplexity: result.perplexity,
      wordCount: result.wordCount,
      knownFraction: result.knownFraction,
    };
  } catch (err) {
    logError('signalsNative.perplexity', err);
    return null;
  }
}

// ─── Avatar generation ────────────────────────────────────────────

export function generateAvatar(
  corpusJson: string,
  topic: string,
  profileJson: string,
  maxWords: number,
): AvatarResult | null {
  if (!native) return null;

  try {
    const t0 = performance.now();
    const result = native.generateAvatar(corpusJson, topic, profileJson, maxWords);
    console.log(`[signals] rust avatar: ${(performance.now() - t0).toFixed(1)}ms (${result.wordCount} words)`);
    if (!result.text) return null;
    const stream: KeystrokeEvent[] = result.keystrokeStreamJson
      ? JSON.parse(result.keystrokeStreamJson) as KeystrokeEvent[]
      : [];
    return {
      text: result.text,
      delays: result.delays,
      keystrokeStream: stream,
      wordCount: result.wordCount,
      markovOrder: result.order,
      chainSize: result.chainSize,
      iBurstCount: result.iBurstCount,
    };
  } catch (err) {
    logError('signalsNative.avatar', err);
    return null;
  }
}
