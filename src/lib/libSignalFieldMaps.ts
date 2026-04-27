/**
 * Single source of truth for camelCase ↔ snake_case correspondence between
 * the typed signal results (returned by `libSignalsNative.ts`) and the
 * database columns they persist to. Each map's keys are TS interface field
 * names (camelCase); values are the matching `tb_*_signals` column names.
 *
 * Why this exists: pre-2026-04-25, every save in `libSignalPipeline.ts`
 * inlined a 47-field object literal mapping camelCase to snake_case by hand.
 * A typo (`ds.ikicount` instead of `ds.ikiCount`) silently nulled the
 * column — same shape as the persistence-boundary bugs documented in
 * GOTCHAS. These maps centralize the mapping; the unit test in
 * `tests/db/fieldMaps.test.ts` cross-checks every entry against the live
 * DB schema, turning a typo from a silent runtime data corruption into a
 * loud test failure.
 *
 * Adding a new signal field means updating exactly two places: the Rust
 * struct (which propagates through the auto-generated d.ts) and the field
 * map below. The pipeline auto-discovers the new field through the map.
 *
 * Footer columns (`dttm_created_utc`, `created_by`, `dttm_modified_utc`,
 * `modified_by`) and the synthetic `engine_provenance_id` are NOT in these
 * maps — the former are owned by the DB, the latter is stamped by the
 * worker after the pipeline completes (see libSignalWorker).
 */

import type { DynamicalSignals, MotorSignals, ProcessSignals } from './libSignalsNative.ts';

/** Cross-session signal type, computed in libCrossSessionSignals (TS side). */
export interface CrossSessionSignals {
  selfPerplexity: number | null;
  motorSelfPerplexity: number | null;
  ncdLag1: number | null;
  ncdLag3: number | null;
  ncdLag7: number | null;
  ncdLag30: number | null;
  vocabRecurrenceDecay: number | null;
  digraphStability: number | null;
  textNetworkDensity: number | null;
  textNetworkCommunities: number | null;
  bridgingRatio: number | null;
}

// Helper: ensures every key of T is mapped, no extras allowed.
type CompleteMap<T> = { [K in keyof T]-?: string };

export const DYNAMICAL_FIELD_MAP = {
  ikiCount: 'iki_count',
  holdFlightCount: 'hold_flight_count',
  permutationEntropy: 'permutation_entropy',
  permutationEntropyRaw: 'permutation_entropy_raw',
  peSpectrum: 'pe_spectrum',
  dfaAlpha: 'dfa_alpha',
  mfdfaSpectrumWidth: 'mfdfa_spectrum_width',
  mfdfaAsymmetry: 'mfdfa_asymmetry',
  mfdfaPeakAlpha: 'mfdfa_peak_alpha',
  temporalIrreversibility: 'temporal_irreversibility',
  ikiPsdSpectralSlope: 'iki_psd_spectral_slope',
  ikiPsdRespiratoryPeakHz: 'iki_psd_respiratory_peak_hz',
  peakTypingFrequencyHz: 'peak_typing_frequency_hz',
  ikiPsdLfHfRatio: 'iki_psd_lf_hf_ratio',
  ikiPsdFastSlowVarianceRatio: 'iki_psd_fast_slow_variance_ratio',
  statisticalComplexity: 'statistical_complexity',
  forbiddenPatternFraction: 'forbidden_pattern_fraction',
  weightedPe: 'weighted_pe',
  lempelZivComplexity: 'lempel_ziv_complexity',
  optnTransitionEntropy: 'optn_transition_entropy',
  optnForbiddenTransitionCount: 'optn_forbidden_transition_count',
  rqaDeterminism: 'rqa_determinism',
  rqaLaminarity: 'rqa_laminarity',
  rqaTrappingTime: 'rqa_trapping_time',
  rqaRecurrenceRate: 'rqa_recurrence_rate',
  rqaRecurrenceTimeEntropy: 'rqa_recurrence_time_entropy',
  rqaMeanRecurrenceTime: 'rqa_mean_recurrence_time',
  recurrenceTransitivity: 'recurrence_transitivity',
  recurrenceAvgPathLength: 'recurrence_avg_path_length',
  recurrenceClustering: 'recurrence_clustering',
  recurrenceAssortativity: 'recurrence_assortativity',
  effectiveInformation: 'effective_information',
  causalEmergenceIndex: 'causal_emergence_index',
  optimalCausalScale: 'optimal_causal_scale',
  pidSynergy: 'pid_synergy',
  pidRedundancy: 'pid_redundancy',
  branchingRatio: 'branching_ratio',
  avalancheSizeExponent: 'avalanche_size_exponent',
  dmdDominantFrequency: 'dmd_dominant_frequency',
  dmdDominantDecayRate: 'dmd_dominant_decay_rate',
  dmdModeCount: 'dmd_mode_count',
  dmdSpectralEntropy: 'dmd_spectral_entropy',
  pauseMixtureComponentCount: 'pause_mixture_component_count',
  pauseMixtureMotorProportion: 'pause_mixture_motor_proportion',
  pauseMixtureCognitiveLoadIndex: 'pause_mixture_cognitive_load_index',
  teHoldToFlight: 'te_hold_to_flight',
  teFlightToHold: 'te_flight_to_hold',
  teDominance: 'te_dominance',
} as const satisfies CompleteMap<DynamicalSignals>;

export const MOTOR_FIELD_MAP = {
  sampleEntropy: 'sample_entropy',
  mseSeries: 'mse_series',
  complexityIndex: 'complexity_index',
  exGaussianFisherTrace: 'ex_gaussian_fisher_trace',
  ikiAutocorrelation: 'iki_autocorrelation_json',
  motorJerk: 'motor_jerk',
  lapseRate: 'lapse_rate',
  tempoDrift: 'tempo_drift',
  ikiCompressionRatio: 'iki_compression_ratio',
  digraphLatencyProfile: 'digraph_latency_json',
  exGaussianTau: 'ex_gaussian_tau',
  exGaussianMu: 'ex_gaussian_mu',
  exGaussianSigma: 'ex_gaussian_sigma',
  tauProportion: 'tau_proportion',
  adjacentHoldTimeCov: 'adjacent_hold_time_cov',
  holdFlightRankCorr: 'hold_flight_rank_corr',
} as const satisfies CompleteMap<MotorSignals>;

export const CROSS_SESSION_FIELD_MAP = {
  selfPerplexity: 'self_perplexity',
  motorSelfPerplexity: 'motor_self_perplexity',
  ncdLag1: 'ncd_lag_1',
  ncdLag3: 'ncd_lag_3',
  ncdLag7: 'ncd_lag_7',
  ncdLag30: 'ncd_lag_30',
  vocabRecurrenceDecay: 'vocab_recurrence_decay',
  digraphStability: 'digraph_stability',
  textNetworkDensity: 'text_network_density',
  textNetworkCommunities: 'text_network_communities',
  bridgingRatio: 'bridging_ratio',
} as const satisfies CompleteMap<CrossSessionSignals>;

export const PROCESS_FIELD_MAP = {
  pauseWithinWord: 'pause_within_word',
  pauseBetweenWord: 'pause_between_word',
  pauseBetweenSentence: 'pause_between_sentence',
  abandonedThoughtCount: 'abandoned_thought_count',
  rBurstCount: 'r_burst_count',
  iBurstCount: 'i_burst_count',
  rBurstSequences: '__not_persisted__', // r-burst rows go to tb_rburst_sequences via saveRburstSequence
  vocabExpansionRate: 'vocab_expansion_rate',
  phaseTransitionPoint: 'phase_transition_point',
  strategyShiftCount: 'strategy_shift_count',
} as const satisfies CompleteMap<ProcessSignals>;

/**
 * Columns in a signal table that are owned by the DB or stamped after-the-fact
 * rather than by the pipeline's INSERT. The DB-schema audit excludes these.
 */
export const NON_PIPELINE_COLUMNS = new Set<string>([
  'dttm_created_utc',
  'created_by',
  'dttm_modified_utc',
  'modified_by',
  'engine_provenance_id',
]);

/**
 * Per-family primary-key + foreign-key columns excluded from the audit.
 * These are written by the SQL `INSERT INTO ... (question_id, ...) VALUES ...`
 * directly, not via the field map.
 */
export const STRUCTURAL_COLUMNS = new Set<string>([
  'dynamical_signal_id',
  'motor_signal_id',
  'process_signal_id',
  'cross_session_signal_id',
  'session_integrity_id',
  'reconstruction_residual_id',
  'question_id',
  'subject_id',  // migration 030: denormalized FK to tb_subjects on every signal table
]);
