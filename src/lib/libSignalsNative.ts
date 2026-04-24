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
  parseError: string | null;
  ikiCount: number;
  holdFlightCount: number;
  permutationEntropy: number | null;
  permutationEntropyRaw: number | null;
  peSpectrum: number[] | null;
  dfaAlpha: number | null;
  mfdfaSpectrumWidth: number | null;
  mfdfaAsymmetry: number | null;
  mfdfaPeakAlpha: number | null;
  temporalIrreversibility: number | null;
  ikiPsdSpectralSlope: number | null;
  ikiPsdRespiratoryPeakHz: number | null;
  peakTypingFrequencyHz: number | null;
  ikiPsdLfHfRatio: number | null;
  ikiPsdFastSlowVarianceRatio: number | null;
  statisticalComplexity: number | null;
  forbiddenPatternFraction: number | null;
  weightedPe: number | null;
  lempelZivComplexity: number | null;
  optnTransitionEntropy: number | null;
  optnForbiddenTransitionCount: number | null;
  rqaDeterminism: number | null;
  rqaLaminarity: number | null;
  rqaTrappingTime: number | null;
  rqaRecurrenceRate: number | null;
  rqaRecurrenceTimeEntropy: number | null;
  rqaMeanRecurrenceTime: number | null;
  recurrenceTransitivity: number | null;
  recurrenceAvgPathLength: number | null;
  recurrenceClustering: number | null;
  recurrenceAssortativity: number | null;
  effectiveInformation: number | null;
  causalEmergenceIndex: number | null;
  optimalCausalScale: number | null;
  pidSynergy: number | null;
  pidRedundancy: number | null;
  branchingRatio: number | null;
  avalancheSizeExponent: number | null;
  dmdDominantFrequency: number | null;
  dmdDominantDecayRate: number | null;
  dmdModeCount: number | null;
  dmdSpectralEntropy: number | null;
  pauseMixtureComponentCount: number | null;
  pauseMixtureMotorProportion: number | null;
  pauseMixtureCognitiveLoadIndex: number | null;
  teHoldToFlight: number | null;
  teFlightToHold: number | null;
  teDominance: number | null;
}

export interface MotorSignals {
  parseError: string | null;
  sampleEntropy: number | null;
  mseSeries: number[] | null;
  complexityIndex: number | null;
  exGaussianFisherTrace: number | null;
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
  holdFlightRankCorr: number | null;
}

export interface RBurstEntry {
  deletedCharCount: number;
  totalCharCount: number;
  durationMs: number;
  startOffsetMs: number;
  isLeadingEdge: boolean;
}

export interface ProcessSignals {
  pauseWithinWord: number | null;
  pauseBetweenWord: number | null;
  pauseBetweenSentence: number | null;
  abandonedThoughtCount: number | null;
  rBurstCount: number | null;
  iBurstCount: number | null;
  rBurstSequences: RBurstEntry[];
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
  variant: number;
  seed: string;
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
    parseError?: string;
    ikiCount: number;
    holdFlightCount: number;
    permutationEntropy: number | null;
    permutationEntropyRaw: number | null;
    peSpectrum: number[] | null;
    dfaAlpha: number | null;
    mfdfaSpectrumWidth: number | null;
    mfdfaAsymmetry: number | null;
    mfdfaPeakAlpha: number | null;
    temporalIrreversibility: number | null;
    ikiPsdSpectralSlope: number | null;
    ikiPsdRespiratoryPeakHz: number | null;
    peakTypingFrequencyHz: number | null;
    ikiPsdLfHfRatio: number | null;
    ikiPsdFastSlowVarianceRatio: number | null;
    statisticalComplexity: number | null;
    forbiddenPatternFraction: number | null;
    weightedPe: number | null;
    lempelZivComplexity: number | null;
    optnTransitionEntropy: number | null;
    optnForbiddenTransitionCount: number | null;
    rqaDeterminism: number | null;
    rqaLaminarity: number | null;
    rqaTrappingTime: number | null;
    rqaRecurrenceRate: number | null;
    rqaRecurrenceTimeEntropy: number | null;
    rqaMeanRecurrenceTime: number | null;
    recurrenceTransitivity: number | null;
    recurrenceAvgPathLength: number | null;
    recurrenceClustering: number | null;
    recurrenceAssortativity: number | null;
    effectiveInformation: number | null;
    causalEmergenceIndex: number | null;
    optimalCausalScale: number | null;
    pidSynergy: number | null;
    pidRedundancy: number | null;
    branchingRatio: number | null;
    avalancheSizeExponent: number | null;
    dmdDominantFrequency: number | null;
    dmdDominantDecayRate: number | null;
    dmdModeCount: number | null;
    dmdSpectralEntropy: number | null;
    pauseMixtureComponentCount: number | null;
    pauseMixtureMotorProportion: number | null;
    pauseMixtureCognitiveLoadIndex: number | null;
    teHoldToFlight: number | null;
    teFlightToHold: number | null;
    teDominance: number | null;
  };
  computeMotorSignals(streamJson: string, totalDurationMs: number): {
    parseError?: string;
    sampleEntropy: number | null;
    mseSeries: number[] | null;
    complexityIndex: number | null;
    exGaussianFisherTrace: number | null;
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
    holdFlightRankCorr: number | null;
  };
  computeProcessSignals(eventLogJson: string): {
    pauseWithinWord: number | null;
    pauseBetweenWord: number | null;
    pauseBetweenSentence: number | null;
    abandonedThoughtCount: number | null;
    rBurstCount: number | null;
    iBurstCount: number | null;
    rBurstSequences: Array<{
      deletedCharCount: number;
      totalCharCount: number;
      durationMs: number;
      startOffsetMs: number;
      isLeadingEdge: boolean;
    }>;
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
    variant: number,
  ): {
    text: string;
    delays: number[];
    keystrokeStreamJson: string;
    wordCount: number;
    order: number;
    chainSize: number;
    iBurstCount: number;
    variant: number;
    seed: string;
  };
  regenerateAvatar(
    corpusJson: string,
    topic: string,
    profileJson: string,
    maxWords: number,
    variant: number,
    seed: string,
  ): {
    text: string;
    delays: number[];
    keystrokeStreamJson: string;
    wordCount: number;
    order: number;
    chainSize: number;
    iBurstCount: number;
    variant: number;
    seed: string;
  };
  computeProfileDistance(
    valuesJson: string,
    meansJson: string,
    stdsJson: string,
  ): {
    zScores: number[];
    distance: number;
    dimensionCount: number;
  };
  computeBatchCorrelations(
    seriesAJson: string,
    seriesBJson: string,
    windowSizesJson: string,
    maxLag: number,
    threshold: number,
  ): Array<{
    aIndex: number;
    bIndex: number;
    windowSize: number;
    correlation: number;
    lag: number;
  }>;
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
    if (result.parseError) {
      logError('signalsNative.dynamical.parseError', result.parseError, { eventCount: stream.length });
    }
    return {
      parseError: result.parseError ?? null,
      ikiCount: result.ikiCount ?? 0,
      holdFlightCount: result.holdFlightCount ?? 0,
      permutationEntropy: n(result.permutationEntropy),
      permutationEntropyRaw: n(result.permutationEntropyRaw),
      peSpectrum: na(result.peSpectrum),
      dfaAlpha: n(result.dfaAlpha),
      mfdfaSpectrumWidth: n(result.mfdfaSpectrumWidth),
      mfdfaAsymmetry: n(result.mfdfaAsymmetry),
      mfdfaPeakAlpha: n(result.mfdfaPeakAlpha),
      temporalIrreversibility: n(result.temporalIrreversibility),
      ikiPsdSpectralSlope: n(result.ikiPsdSpectralSlope),
      ikiPsdRespiratoryPeakHz: n(result.ikiPsdRespiratoryPeakHz),
      peakTypingFrequencyHz: n(result.peakTypingFrequencyHz),
      ikiPsdLfHfRatio: n(result.ikiPsdLfHfRatio),
      ikiPsdFastSlowVarianceRatio: n(result.ikiPsdFastSlowVarianceRatio),
      statisticalComplexity: n(result.statisticalComplexity),
      forbiddenPatternFraction: n(result.forbiddenPatternFraction),
      weightedPe: n(result.weightedPe),
      lempelZivComplexity: n(result.lempelZivComplexity),
      optnTransitionEntropy: n(result.optnTransitionEntropy),
      optnForbiddenTransitionCount: n(result.optnForbiddenTransitionCount),
      rqaDeterminism: n(result.rqaDeterminism),
      rqaLaminarity: n(result.rqaLaminarity),
      rqaTrappingTime: n(result.rqaTrappingTime),
      rqaRecurrenceRate: n(result.rqaRecurrenceRate),
      rqaRecurrenceTimeEntropy: n(result.rqaRecurrenceTimeEntropy),
      rqaMeanRecurrenceTime: n(result.rqaMeanRecurrenceTime),
      recurrenceTransitivity: n(result.recurrenceTransitivity),
      recurrenceAvgPathLength: n(result.recurrenceAvgPathLength),
      recurrenceClustering: n(result.recurrenceClustering),
      recurrenceAssortativity: n(result.recurrenceAssortativity),
      effectiveInformation: n(result.effectiveInformation),
      causalEmergenceIndex: n(result.causalEmergenceIndex),
      optimalCausalScale: n(result.optimalCausalScale),
      pidSynergy: n(result.pidSynergy),
      pidRedundancy: n(result.pidRedundancy),
      branchingRatio: n(result.branchingRatio),
      avalancheSizeExponent: n(result.avalancheSizeExponent),
      dmdDominantFrequency: n(result.dmdDominantFrequency),
      dmdDominantDecayRate: n(result.dmdDominantDecayRate),
      dmdModeCount: n(result.dmdModeCount),
      dmdSpectralEntropy: n(result.dmdSpectralEntropy),
      pauseMixtureComponentCount: n(result.pauseMixtureComponentCount),
      pauseMixtureMotorProportion: n(result.pauseMixtureMotorProportion),
      pauseMixtureCognitiveLoadIndex: n(result.pauseMixtureCognitiveLoadIndex),
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
    if (result.parseError) {
      logError('signalsNative.motor.parseError', result.parseError, { eventCount: stream.length });
    }
    return {
      parseError: result.parseError ?? null,
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
      holdFlightRankCorr: n(result.holdFlightRankCorr),
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
      rBurstSequences: result.rBurstSequences ?? [],
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
  variant: number = 1,
): AvatarResult | null {
  if (!native) return null;

  try {
    const t0 = performance.now();
    const result = native.generateAvatar(corpusJson, topic, profileJson, maxWords, variant);
    console.log(`[signals] rust avatar v${variant}: ${(performance.now() - t0).toFixed(1)}ms (${result.wordCount} words)`);
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
      variant: result.variant,
      seed: result.seed,
    };
  } catch (err) {
    logError('signalsNative.avatar', err);
    return null;
  }
}

// ─── Avatar regeneration (reproducibility verification) ──────────

export function regenerateAvatar(
  corpusJson: string,
  topic: string,
  profileJson: string,
  maxWords: number,
  variant: number,
  seed: string,
): AvatarResult | null {
  if (!native) return null;

  try {
    const t0 = performance.now();
    const result = native.regenerateAvatar(corpusJson, topic, profileJson, maxWords, variant, seed);
    console.log(`[signals] rust regenerate avatar v${variant}: ${(performance.now() - t0).toFixed(1)}ms (${result.wordCount} words)`);
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
      variant: result.variant,
      seed: result.seed,
    };
  } catch (err) {
    logError('signalsNative.regenerateAvatar', err);
    return null;
  }
}

// ─── Profile distance (mediation detection) ──────────────────────

export interface ProfileDistanceResult {
  zScores: number[];
  distance: number;
  dimensionCount: number;
}

export function computeProfileDistance(
  values: number[],
  means: number[],
  stds: number[],
): ProfileDistanceResult | null {
  if (!native) return null;

  try {
    return native.computeProfileDistance(
      JSON.stringify(values),
      JSON.stringify(means),
      JSON.stringify(stds),
    );
  } catch (err) {
    logError('signalsNative.profileDistance', err);
    return null;
  }
}

// ─── Batch correlations (coupling stability) ─────────────────────

export interface BatchCorrelationResult {
  aIndex: number;
  bIndex: number;
  windowSize: number;
  correlation: number;
  lag: number;
}

export function computeBatchCorrelations(
  seriesA: number[][],
  seriesB: number[][],
  windowSizes: number[],
  maxLag: number,
  threshold: number,
): BatchCorrelationResult[] | null {
  if (!native) return null;

  try {
    return native.computeBatchCorrelations(
      JSON.stringify(seriesA),
      JSON.stringify(seriesB),
      JSON.stringify(windowSizes),
      maxLag,
      threshold,
    );
  } catch (err) {
    logError('signalsNative.batchCorrelations', err);
    return null;
  }
}
