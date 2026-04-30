/**
 * Native Rust Signal Engine Bindings
 *
 * Loads the napi-rs native module and exposes typed functions for signal
 * computation. Rust is the single source of truth for all signal math.
 * If the native module fails to load, signal computation returns null
 * and the pipeline skips that family for the session.
 */

import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logError } from './utlErrorLog.ts';
import type * as Native from '../../src-rs/index.d.ts';

// ─── Signal types ──────────────────────────────────────────────────
//
// Single source of truth: `src-rs/index.d.ts` is generated from the Rust
// `#[napi]` annotations on every Rust build (see `src-rs/build.sh` and
// `src-rs/scripts/generate-dts.mjs`). Hand-written interfaces are forbidden;
// edit the Rust struct, rebuild, and the type updates here automatically.
//
// The exported types are post-coercion shapes: napi maps Rust `Option::None`
// to JS `undefined`, but postgres.js rejects undefined values. Below we apply
// the `NullCoerced<T>` mapped type that converts every optional field to
// `T[K] | null`. The `n()` / `na()` runtime helpers do the same coercion at
// the value level. Together they keep the type system honest about what
// reaches the database layer.

/** Converts every `T?` field to `T | null` while preserving array-vs-scalar typing. */
type NullCoerced<T> = {
  [K in keyof T]-?: undefined extends T[K]
    ? Exclude<T[K], undefined> | null
    : T[K];
};

// Re-exports under public names. Native input type aliased to `KeystrokeEvent`
// for readability at call sites; structurally identical to `KeystrokeEventInput`.
export type KeystrokeEvent = Native.KeystrokeEventInput;
export type DynamicalSignals = NullCoerced<Native.DynamicalSignals>;
export type MotorSignals = NullCoerced<Native.MotorSignals>;
export type ProcessSignals = NullCoerced<Native.ProcessSignals>;
export type RBurstEntry = Native.RBurstEntry;
export type DigraphEntry = Native.DigraphEntry;
export type PerplexityResult = Native.PerplexityOutput;

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
// Runtime counterparts to NullCoerced<T>. napi-rs omits `Option::None` fields
// entirely (so they read as `undefined`); postgres.js rejects undefined.

function n(v: number | null | undefined): number | null {
  return v ?? null;
}
function na(v: number[] | null | undefined): number[] | null {
  return v ?? null;
}

// ─── Native module loading ─────────────────────────────────────────
//
// The shape of the loaded .node module is `typeof Native` — i.e. the auto-
// generated module type. No hand-written interface that can drift from the
// Rust binary.
//
// Binary path is platform-dependent. napi-rs emits per-target files named
// `alice-signals.<platform>-<arch>[-<libc>].node`. We resolve the right one
// at boot. `BINARY_PATH` is exported so `libEngineProvenance` can hash the
// exact same file the engine loaded — provenance must match the running
// binary, not whichever happens to live next to it.

type NativeModule = typeof Native;

function resolveBinaryFilename(platform: NodeJS.Platform, arch: NodeJS.Architecture): string {
  if (platform === 'darwin' && arch === 'arm64')   return 'alice-signals.darwin-arm64.node';
  if (platform === 'darwin' && arch === 'x64')     return 'alice-signals.darwin-x64.node';
  if (platform === 'linux'  && arch === 'x64')     return 'alice-signals.linux-x64-gnu.node';
  if (platform === 'linux'  && arch === 'arm64')   return 'alice-signals.linux-arm64-gnu.node';
  if (platform === 'win32'  && arch === 'x64')     return 'alice-signals.win32-x64-msvc.node';
  throw new Error(`Unsupported platform/arch combination: ${platform}/${arch}`);
}

const BINARY_FILENAME: string | null = (() => {
  try { return resolveBinaryFilename(process.platform, process.arch); }
  catch { return null; }
})();

// Resolve the absolute path to the binary. In dev (`src/lib/...`) the binary
// sits two levels up at `src-rs/<file>`. In the bundled Astro production build
// the source moves to `dist/server/chunks/`, so the relative `../../src-rs/`
// math points at `dist/src-rs/` which doesn't exist. Try a sequence of
// candidate locations and pick the first that exists. `process.cwd()` is the
// most reliable anchor in production because the systemd unit pins
// `WorkingDirectory=/opt/alice`, where `src-rs/<binary>` always lives.
function resolveBinaryAbsolute(filename: string): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '..', '..', 'src-rs', filename),                  // dev: src/lib/.. → repo root
    resolve(here, '..', '..', '..', 'src-rs', filename),            // bundled (one extra level)
    resolve(here, '..', '..', '..', '..', 'src-rs', filename),      // bundled (deeper)
    resolve(process.cwd(), 'src-rs', filename),                     // systemd cwd anchor
  ];
  for (const c of candidates) {
    try { if (statSync(c).isFile()) return c; } catch { /* continue */ }
  }
  return null;
}

const BINARY_ABSOLUTE_PATH: string | null = BINARY_FILENAME
  ? resolveBinaryAbsolute(BINARY_FILENAME)
  : null;

let native: NativeModule | null = null;

if (BINARY_FILENAME && BINARY_ABSOLUTE_PATH) {
  try {
    const require = createRequire(import.meta.url);
    native = require(BINARY_ABSOLUTE_PATH) as NativeModule;
    console.log(`[signals] Rust engine loaded (${BINARY_ABSOLUTE_PATH})`);
  } catch (err) {
    console.warn(`[signals] Rust engine unavailable (${BINARY_ABSOLUTE_PATH}) — signal computation disabled`);
    if (process.env.ALICE_DEBUG_NATIVE) console.warn(err);
  }
} else if (BINARY_FILENAME) {
  console.warn(`[signals] Rust engine binary ${BINARY_FILENAME} not found in any candidate location — signal computation disabled`);
  if (process.env.ALICE_DEBUG_NATIVE) {
    console.warn(`[signals]   tried (in order):`);
    const here = dirname(fileURLToPath(import.meta.url));
    for (const c of [
      resolve(here, '..', '..', 'src-rs', BINARY_FILENAME),
      resolve(here, '..', '..', '..', 'src-rs', BINARY_FILENAME),
      resolve(here, '..', '..', '..', '..', 'src-rs', BINARY_FILENAME),
      resolve(process.cwd(), 'src-rs', BINARY_FILENAME),
    ]) console.warn(`[signals]     ${c} ${existsSync(c) ? '(exists)' : '(missing)'}`);
  }
} else {
  console.warn(`[signals] no .node mapping for ${process.platform}/${process.arch} — signal computation disabled`);
}

/** Filename only (e.g. `alice-signals.linux-x64-gnu.node`). Null on unsupported platforms. */
export const BINARY_PATH = BINARY_FILENAME;
/** Absolute path to the loaded binary, or null if it couldn't be located/loaded. Used by libEngineProvenance to hash the EXACT file the engine ran. */
export const BINARY_ABSOLUTE = BINARY_ABSOLUTE_PATH;

export const hasNativeEngine = native !== null;

// ─── Dynamical signals ─────────────────────────────────────────────

export function computeDynamicalSignals(stream: KeystrokeEvent[]): DynamicalSignals | null {
  if (!native) return null;

  try {
    // Typed FFI: pass the stream array directly. napi-rs decodes from JS to
    // Vec<KeystrokeEventInput> on the Rust side. No JSON round-trip.
    const result = native.computeDynamicalSignals(stream);
    return {
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
    const result = native.computeMotorSignals(stream, totalDurationMs);
    return {
      sampleEntropy: n(result.sampleEntropy),
      mseSeries: na(result.mseSeries),
      complexityIndex: n(result.complexityIndex),
      exGaussianFisherTrace: n(result.exGaussianFisherTrace),
      ikiAutocorrelation: na(result.ikiAutocorrelation),
      motorJerk: n(result.motorJerk),
      lapseRate: n(result.lapseRate),
      tempoDrift: n(result.tempoDrift),
      ikiCompressionRatio: n(result.ikiCompressionRatio),
      // Typed Vec<DigraphEntry> from Rust — no JSON parse step, deterministic
      // iteration order is preserved by the sort applied on the Rust side.
      digraphLatencyProfile: result.digraphLatencyProfile ?? null,
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
    const result = native.computeProcessSignals(eventLogJson);
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

export function computePerplexity(corpus: string[], text: string): PerplexityResult | null {
  if (!native) return null;

  try {
    const result = native.computePerplexity(corpus, text);
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

export type AvatarProfileInput = Native.AvatarProfileInput;
export type DigraphAggregateEntry = Native.DigraphAggregateEntry;

/**
 * Convert a legacy-format profile JSON record (stored as
 * `{ digraph: { "t>h": 87.3, ... }, mu: ..., sigma: ..., ... }`) into the
 * typed `AvatarProfileInput` accepted by the napi boundary.
 *
 * Used by the replay path (`regenerateFromStored`) which reads
 * `profile_snapshot_json` columns persisted before and after this refactor.
 * Both shapes resolve cleanly: the digraph map is converted to a Vec, and
 * scalar fields are read directly.
 */
export function profileFromLegacyJson(json: string): AvatarProfileInput {
  const obj = JSON.parse(json) as Record<string, unknown>;
  const digraphObj = obj.digraph as Record<string, number> | null | undefined;
  return {
    digraph: digraphObj
      ? Object.entries(digraphObj).map(([digraph, meanLatencyMs]) => ({ digraph, meanLatencyMs }))
      : undefined,
    mu: (obj.mu as number | null) ?? undefined,
    sigma: (obj.sigma as number | null) ?? undefined,
    tau: (obj.tau as number | null) ?? undefined,
    burstLength: (obj.burst_length as number | null) ?? undefined,
    pauseBetweenPct: (obj.pause_between_pct as number | null) ?? undefined,
    pauseSentPct: (obj.pause_sent_pct as number | null) ?? undefined,
    firstKeystroke: (obj.first_keystroke as number | null) ?? undefined,
    smallDelRate: (obj.small_del_rate as number | null) ?? undefined,
    largeDelRate: (obj.large_del_rate as number | null) ?? undefined,
    revisionTimingBias: (obj.revision_timing_bias as number | null) ?? undefined,
    rBurstRatio: (obj.r_burst_ratio as number | null) ?? undefined,
    rburstMeanSize: (obj.rburst_mean_size as number | null) ?? undefined,
    rburstLeadingEdgePct: (obj.rburst_leading_edge_pct as number | null) ?? undefined,
    rburstConsolidation: (obj.rburst_consolidation as number | null) ?? undefined,
    rburstMeanDuration: (obj.rburst_mean_duration as number | null) ?? undefined,
    ikiAutocorrelationLag1: (obj.iki_autocorrelation_lag1 as number | null) ?? undefined,
    holdFlightRankCorrelation: (obj.hold_flight_rank_correlation as number | null) ?? undefined,
    holdTimeMean: (obj.hold_time_mean as number | null) ?? undefined,
    holdTimeStd: (obj.hold_time_std as number | null) ?? undefined,
    flightTimeMean: (obj.flight_time_mean as number | null) ?? undefined,
    flightTimeStd: (obj.flight_time_std as number | null) ?? undefined,
  };
}

export function generateAvatar(
  corpus: string[],
  topic: string,
  profile: AvatarProfileInput,
  maxWords: number,
  variant: number = 1,
): AvatarResult | null {
  if (!native) return null;

  try {
    const result = native.generateAvatar(corpus, topic, profile, maxWords, variant);
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
  corpus: string[],
  topic: string,
  profile: AvatarProfileInput,
  maxWords: number,
  variant: number,
  seed: string,
): AvatarResult | null {
  if (!native) return null;

  try {
    const result = native.regenerateAvatar(corpus, topic, profile, maxWords, variant, seed);
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
    return native.computeProfileDistance(values, means, stds);
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
    return native.computeBatchCorrelations(seriesA, seriesB, windowSizes, maxLag, threshold);
  } catch (err) {
    logError('signalsNative.batchCorrelations', err);
    return null;
  }
}
