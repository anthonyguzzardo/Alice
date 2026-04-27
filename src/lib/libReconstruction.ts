/**
 * Reconstruction Residual Computation
 *
 * After each session (once the personal profile is updated), generates
 * avatar responses for each adversary variant, runs the signal pipeline
 * on each avatar's keystroke stream, and computes per-family deltas.
 *
 * The residual is what CANNOT be reconstructed from the statistical profile.
 * It is the cognitive signature.
 *
 * ── Residual partitioning ──────────────────────────────────────────────
 *
 * The ghost validates BEHAVIORAL signals (motor + dynamical + perplexity).
 * These residuals are meaningful because the ghost reconstructs motor
 * timing from the person's statistical profile, and the residual measures
 * what that profile cannot reproduce.
 *
 * Semantic residuals (idea density, lexical sophistication, etc.) are
 * STORED but NOT included in the paper-reported aggregate. The ghost
 * generates Markov/PPM word salad; semantic signals computed on that
 * output measure "coherent text vs gibberish," a trivially explained
 * difference with no discriminative information across sessions. Semantic
 * measurement uses a self-referencing longitudinal baseline instead
 * (see libSemanticBaseline.ts).
 *
 * behavioral_l2_norm:  dynamical + motor + perplexity (paper-reported)
 * semantic_l2_norm:    semantic signals only (stored, Phase 2 baseline)
 * total_l2_norm:       all families (backward compat, not paper-reported)
 *
 * Adversary variants (te_adversary_variants):
 *   1. Baseline:           Order-2 Markov + independent ex-Gaussian
 *   2. Conditional Timing: Order-2 Markov + AR(1) conditioned IKI
 *   3. Copula Motor:       Order-2 Markov + Gaussian copula hold/flight
 *   4. PPM Text:           Variable-order PPM + independent timing
 *   5. Full Adversary:     PPM + AR(1) + copula
 *
 * Requires >= 3 prior entries (Markov chain minimum).
 * Runs AFTER updateProfile() in the signal pipeline.
 */

import sql, {
  getDynamicalSignals,
  getMotorSignals,
  getSemanticSignals,
  saveReconstructionResidual,
  getReconstructionResidual,
  getQuestionTextById,
  getResponseText,
  listResponseTextsExcludingCalibration,
  type ReconstructionResidualInput,
} from './libDb.ts';
import {
  computeDynamicalSignals,
  computeMotorSignals,
  generateAvatar,
  regenerateAvatar,
  profileFromLegacyJson,
  computePerplexity,
  type DynamicalSignals,
  type MotorSignals,
} from './libSignalsNative.ts';
import { computeSemanticSignals, type SemanticSignals } from './libSemanticSignals.ts';
import { logError } from './utlErrorLog.ts';
import { createHash } from 'node:crypto';

// ─── Constants ─────────────────────────────────────────────────────

const ALL_VARIANTS = [1, 2, 3, 4, 5] as const;

// ─── Helpers ───────────────────────────────────────────────────────

function delta(real: number | null | undefined, avatar: number | null | undefined): number | null {
  if (real == null || avatar == null) return null;
  return real - avatar;
}

function spectrumDelta(
  realJson: string | null | undefined,
  avatarSpectrum: number[] | null | undefined,
): { realParsed: number[] | null; residual: number[] | null } {
  if (!realJson || !avatarSpectrum) return { realParsed: null, residual: null };
  try {
    const real: number[] = typeof realJson === 'object' ? realJson as unknown as number[] : JSON.parse(realJson);
    if (!Array.isArray(real) || real.length !== avatarSpectrum.length) return { realParsed: real, residual: null };
    return {
      realParsed: real,
      residual: real.map((v, i) => v - avatarSpectrum[i]!),
    };
  } catch {
    return { realParsed: null, residual: null };
  }
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function isFiniteNum(v: number | null): v is number {
  return v != null && Number.isFinite(v);
}

function l2(values: (number | null)[]): number | null {
  const valid = values.filter(isFiniteNum);
  if (valid.length === 0) return null;
  return Math.sqrt(valid.reduce((s, v) => s + v * v, 0) / valid.length);
}

// ─── Per-variant computation ───────────────────────────────────────

async function computeForVariant(
  subjectId: number,
  questionId: number,
  variantId: number,
  corpusJson: string,
  questionText: string,
  questionSourceId: number,
  realWordCount: number,
  realText: string,
  profileJson: string,
  corpusSize: number,
  sessionCount: number,
  corpusSha256: string,
  realDyn: Awaited<ReturnType<typeof getDynamicalSignals>>,
  realMot: Awaited<ReturnType<typeof getMotorSignals>>,
  realSem: Awaited<ReturnType<typeof getSemanticSignals>>,
): Promise<void> {
  // Gate: idempotent per variant
  if (await getReconstructionResidual(subjectId, questionId, variantId)) return;

  // Generate avatar for this variant. Inputs cross the napi boundary as typed
  // values (Vec<String> corpus, AvatarProfileInput profile). corpusJson and
  // profileJson stay around because both are stored on the residual row for
  // replay (see `profile_snapshot_json` save below) and corpusJson feeds the
  // SHA-256 corpus integrity hash.
  const corpus = JSON.parse(corpusJson) as string[];
  const profile = profileFromLegacyJson(profileJson);
  const avatar = generateAvatar(corpus, questionText, profile, realWordCount, variantId);
  if (!avatar) return;

  // Compute avatar total duration from keystroke stream
  const avatarDurationMs = avatar.keystrokeStream.length > 0
    ? avatar.keystrokeStream[avatar.keystrokeStream.length - 1]!.u
    : 0;

  // Compute avatar signals
  let avatarDyn: DynamicalSignals | null = null;
  let avatarMot: MotorSignals | null = null;
  let avatarSem: SemanticSignals | null = null;

  if (avatar.keystrokeStream.length >= 10) {
    avatarDyn = computeDynamicalSignals(avatar.keystrokeStream);
    avatarMot = computeMotorSignals(avatar.keystrokeStream, avatarDurationMs);
  }
  if (avatar.text.length >= 20) {
    avatarSem = computeSemanticSignals(avatar.text, 0);
  }

  // computePerplexity reuses the typed corpus array constructed above.
  const realPerp = computePerplexity(corpus, realText);
  const avatarPerp = computePerplexity(corpus, avatar.text);

  // PE spectrum comparison
  const { realParsed: realPeSpec, residual: peSpecResidual } = spectrumDelta(
    realDyn?.pe_spectrum,
    avatarDyn?.peSpectrum,
  );

  // Per-signal residuals (original fixed-column signals)
  const dynResiduals = {
    pe: delta(realDyn?.permutation_entropy, avatarDyn?.permutationEntropy),
    dfa: delta(realDyn?.dfa_alpha, avatarDyn?.dfaAlpha),
    rqaDet: delta(realDyn?.rqa_determinism, avatarDyn?.rqaDeterminism),
    rqaLam: delta(realDyn?.rqa_laminarity, avatarDyn?.rqaLaminarity),
    teDom: delta(realDyn?.te_dominance, avatarDyn?.teDominance),
  };

  const motResiduals = {
    sampEn: delta(realMot?.sample_entropy, avatarMot?.sampleEntropy),
    jerk: delta(realMot?.motor_jerk, avatarMot?.motorJerk),
    lapse: delta(realMot?.lapse_rate, avatarMot?.lapseRate),
    drift: delta(realMot?.tempo_drift, avatarMot?.tempoDrift),
    tau: delta(realMot?.ex_gaussian_tau, avatarMot?.exGaussianTau),
    tauProp: delta(realMot?.tau_proportion, avatarMot?.tauProportion),
  };

  const semResiduals = {
    idea: delta(realSem?.idea_density, avatarSem?.ideaDensity),
    lex: delta(realSem?.lexical_sophistication, avatarSem?.lexicalSophistication),
    epist: delta(realSem?.epistemic_stance, avatarSem?.epistemicStance),
    integ: delta(realSem?.integrative_complexity, avatarSem?.integrativeComplexity),
    cohes: delta(realSem?.deep_cohesion, avatarSem?.deepCohesion),
    compress: delta(realSem?.text_compression_ratio, avatarSem?.textCompressionRatio),
  };

  // Extended residuals (Phase 1-5 signals, stored in JSONB)
  // Excluded: pause_mixture_* (ghost pauses are deterministic, not a mixture),
  // mfdfa_peak_alpha, iki_psd_fast_slow_variance_ratio, peak_typing_frequency_hz,
  // optimal_causal_scale, dmd_mode_count, optn_forbidden_transition_count
  // (redundant/integer/tautological -- see design plan for rationale).
  const extDynResiduals: Record<string, number | null> = {
    mfdfa_spectrum_width: delta(realDyn?.mfdfa_spectrum_width, avatarDyn?.mfdfaSpectrumWidth),
    mfdfa_asymmetry: delta(realDyn?.mfdfa_asymmetry, avatarDyn?.mfdfaAsymmetry),
    temporal_irreversibility: delta(realDyn?.temporal_irreversibility, avatarDyn?.temporalIrreversibility),
    iki_psd_spectral_slope: delta(realDyn?.iki_psd_spectral_slope, avatarDyn?.ikiPsdSpectralSlope),
    iki_psd_respiratory_peak_hz: delta(realDyn?.iki_psd_respiratory_peak_hz, avatarDyn?.ikiPsdRespiratoryPeakHz),
    iki_psd_lf_hf_ratio: delta(realDyn?.iki_psd_lf_hf_ratio, avatarDyn?.ikiPsdLfHfRatio),
    statistical_complexity: delta(realDyn?.statistical_complexity, avatarDyn?.statisticalComplexity),
    forbidden_pattern_fraction: delta(realDyn?.forbidden_pattern_fraction, avatarDyn?.forbiddenPatternFraction),
    weighted_pe: delta(realDyn?.weighted_pe, avatarDyn?.weightedPe),
    lempel_ziv_complexity: delta(realDyn?.lempel_ziv_complexity, avatarDyn?.lempelZivComplexity),
    optn_transition_entropy: delta(realDyn?.optn_transition_entropy, avatarDyn?.optnTransitionEntropy),
    recurrence_transitivity: delta(realDyn?.recurrence_transitivity, avatarDyn?.recurrenceTransitivity),
    recurrence_avg_path_length: delta(realDyn?.recurrence_avg_path_length, avatarDyn?.recurrenceAvgPathLength),
    recurrence_clustering: delta(realDyn?.recurrence_clustering, avatarDyn?.recurrenceClustering),
    recurrence_assortativity: delta(realDyn?.recurrence_assortativity, avatarDyn?.recurrenceAssortativity),
    rqa_recurrence_time_entropy: delta(realDyn?.rqa_recurrence_time_entropy, avatarDyn?.rqaRecurrenceTimeEntropy),
    rqa_mean_recurrence_time: delta(realDyn?.rqa_mean_recurrence_time, avatarDyn?.rqaMeanRecurrenceTime),
    effective_information: delta(realDyn?.effective_information, avatarDyn?.effectiveInformation),
    causal_emergence_index: delta(realDyn?.causal_emergence_index, avatarDyn?.causalEmergenceIndex),
    pid_synergy: delta(realDyn?.pid_synergy, avatarDyn?.pidSynergy),
    pid_redundancy: delta(realDyn?.pid_redundancy, avatarDyn?.pidRedundancy),
    branching_ratio: delta(realDyn?.branching_ratio, avatarDyn?.branchingRatio),
    avalanche_size_exponent: delta(realDyn?.avalanche_size_exponent, avatarDyn?.avalancheSizeExponent),
    dmd_dominant_frequency: delta(realDyn?.dmd_dominant_frequency, avatarDyn?.dmdDominantFrequency),
    dmd_dominant_decay_rate: delta(realDyn?.dmd_dominant_decay_rate, avatarDyn?.dmdDominantDecayRate),
    dmd_spectral_entropy: delta(realDyn?.dmd_spectral_entropy, avatarDyn?.dmdSpectralEntropy),
  };

  const extMotResiduals: Record<string, number | null> = {
    complexity_index: delta(realMot?.complexity_index, avatarMot?.complexityIndex),
    ex_gaussian_fisher_trace: delta(realMot?.ex_gaussian_fisher_trace, avatarMot?.exGaussianFisherTrace),
  };

  // Build JSONB payload: { signalName: { real, avatar, residual } }
  const extendedJson: Record<string, { real: number | null; avatar: number | null; residual: number | null }> = {};
  for (const [k, res] of Object.entries(extDynResiduals)) {
    const realVal = (realDyn as Record<string, unknown> | null)?.[k] as number | null ?? null;
    const avatarVal = (avatarDyn as Record<string, unknown> | null)?.[snakeToCamel(k)] as number | null ?? null;
    extendedJson[k] = { real: realVal, avatar: avatarVal, residual: res };
  }
  for (const [k, res] of Object.entries(extMotResiduals)) {
    const realVal = (realMot as Record<string, unknown> | null)?.[k] as number | null ?? null;
    const avatarVal = (avatarMot as Record<string, unknown> | null)?.[snakeToCamel(k)] as number | null ?? null;
    extendedJson[k] = { real: realVal, avatar: avatarVal, residual: res };
  }

  // Aggregate norms -- include both original and extended signals
  const allDynResidualValues = [...Object.values(dynResiduals), ...Object.values(extDynResiduals)];
  const allMotResidualValues = [...Object.values(motResiduals), ...Object.values(extMotResiduals)];
  const dynNorm = l2(allDynResidualValues);
  const motNorm = l2(allMotResidualValues);
  const semNorm = l2(Object.values(semResiduals));
  const perplexityResidual = delta(realPerp?.perplexity ?? null, avatarPerp?.perplexity ?? null);

  // Behavioral: dynamical + motor + perplexity (ghost-validated, paper-reported)
  const behavioralResiduals = [
    ...allDynResidualValues,
    ...allMotResidualValues,
    perplexityResidual,
  ];
  const behavioralNorm = l2(behavioralResiduals);
  const behavioralCount = behavioralResiduals.filter(isFiniteNum).length;

  // Total: all families including semantic (backward compat)
  const allResiduals = [
    ...behavioralResiduals,
    ...Object.values(semResiduals),
  ];
  const totalNorm = l2(allResiduals);
  const residualCount = allResiduals.filter(isFiniteNum).length;

  // Persist
  const row: ReconstructionResidualInput = {
    adversary_variant_id: variantId,
    question_source_id: questionSourceId,
    avatar_seed: avatar.seed,
    profile_snapshot_json: profileJson,
    corpus_sha256: corpusSha256,
    avatar_topic: questionText,
    avatar_text: avatar.text,
    avatar_word_count: avatar.wordCount,
    avatar_markov_order: avatar.markovOrder,
    avatar_chain_size: avatar.chainSize,
    avatar_i_burst_count: avatar.iBurstCount,
    real_word_count: realWordCount,
    corpus_size: corpusSize,
    session_count: sessionCount,

    real_perplexity: realPerp?.perplexity ?? null,
    real_known_fraction: realPerp?.knownFraction ?? null,
    avatar_perplexity: avatarPerp?.perplexity ?? null,
    avatar_known_fraction: avatarPerp?.knownFraction ?? null,
    perplexity_residual: perplexityResidual,

    real_permutation_entropy: realDyn?.permutation_entropy ?? null,
    avatar_permutation_entropy: avatarDyn?.permutationEntropy ?? null,
    residual_permutation_entropy: dynResiduals.pe,

    real_pe_spectrum: realPeSpec ? JSON.stringify(realPeSpec) : null,
    avatar_pe_spectrum: avatarDyn?.peSpectrum ? JSON.stringify(avatarDyn.peSpectrum) : null,
    residual_pe_spectrum: peSpecResidual ? JSON.stringify(peSpecResidual) : null,

    real_dfa_alpha: realDyn?.dfa_alpha ?? null,
    avatar_dfa_alpha: avatarDyn?.dfaAlpha ?? null,
    residual_dfa_alpha: dynResiduals.dfa,

    real_rqa_determinism: realDyn?.rqa_determinism ?? null,
    avatar_rqa_determinism: avatarDyn?.rqaDeterminism ?? null,
    residual_rqa_determinism: dynResiduals.rqaDet,

    real_rqa_laminarity: realDyn?.rqa_laminarity ?? null,
    avatar_rqa_laminarity: avatarDyn?.rqaLaminarity ?? null,
    residual_rqa_laminarity: dynResiduals.rqaLam,

    real_te_dominance: realDyn?.te_dominance ?? null,
    avatar_te_dominance: avatarDyn?.teDominance ?? null,
    residual_te_dominance: dynResiduals.teDom,

    real_sample_entropy: realMot?.sample_entropy ?? null,
    avatar_sample_entropy: avatarMot?.sampleEntropy ?? null,
    residual_sample_entropy: motResiduals.sampEn,

    real_motor_jerk: realMot?.motor_jerk ?? null,
    avatar_motor_jerk: avatarMot?.motorJerk ?? null,
    residual_motor_jerk: motResiduals.jerk,

    real_lapse_rate: realMot?.lapse_rate ?? null,
    avatar_lapse_rate: avatarMot?.lapseRate ?? null,
    residual_lapse_rate: motResiduals.lapse,

    real_tempo_drift: realMot?.tempo_drift ?? null,
    avatar_tempo_drift: avatarMot?.tempoDrift ?? null,
    residual_tempo_drift: motResiduals.drift,

    real_ex_gaussian_tau: realMot?.ex_gaussian_tau ?? null,
    avatar_ex_gaussian_tau: avatarMot?.exGaussianTau ?? null,
    residual_ex_gaussian_tau: motResiduals.tau,

    real_tau_proportion: realMot?.tau_proportion ?? null,
    avatar_tau_proportion: avatarMot?.tauProportion ?? null,
    residual_tau_proportion: motResiduals.tauProp,

    real_idea_density: realSem?.idea_density ?? null,
    avatar_idea_density: avatarSem?.ideaDensity ?? null,
    residual_idea_density: semResiduals.idea,

    real_lexical_sophistication: realSem?.lexical_sophistication ?? null,
    avatar_lexical_sophistication: avatarSem?.lexicalSophistication ?? null,
    residual_lexical_sophistication: semResiduals.lex,

    real_epistemic_stance: realSem?.epistemic_stance ?? null,
    avatar_epistemic_stance: avatarSem?.epistemicStance ?? null,
    residual_epistemic_stance: semResiduals.epist,

    real_integrative_complexity: realSem?.integrative_complexity ?? null,
    avatar_integrative_complexity: avatarSem?.integrativeComplexity ?? null,
    residual_integrative_complexity: semResiduals.integ,

    real_deep_cohesion: realSem?.deep_cohesion ?? null,
    avatar_deep_cohesion: avatarSem?.deepCohesion ?? null,
    residual_deep_cohesion: semResiduals.cohes,

    real_text_compression_ratio: realSem?.text_compression_ratio ?? null,
    avatar_text_compression_ratio: avatarSem?.textCompressionRatio ?? null,
    residual_text_compression_ratio: semResiduals.compress,

    extended_residuals_json: extendedJson,
    dynamical_l2_norm: dynNorm,
    motor_l2_norm: motNorm,
    semantic_l2_norm: semNorm,
    total_l2_norm: totalNorm,
    residual_count: residualCount,
    behavioral_l2_norm: behavioralNorm,
    behavioral_residual_count: behavioralCount,
  };

  try {
    await saveReconstructionResidual(subjectId, questionId, row);
  } catch (err) {
    logError('reconstruction.save', err, { subjectId, questionId, variantId });
  }
}

// ─── Main ──────────────────────────────────────────────────────────

export async function computeReconstructionResidual(subjectId: number, questionId: number): Promise<void> {
  // Calibration sessions (question_source_id = 3) are prompted neutral writing.
  // Ghost comparison is journal-only; calibration reconstruction requires a
  // parallel calibration engine (see systemDesign/CALIBRATION_ENGINE.md).
  const sourceRows = await sql`
    SELECT question_source_id FROM tb_questions
    WHERE question_id = ${questionId} AND subject_id = ${subjectId}
  `;
  if ((sourceRows[0] as { question_source_id: number }).question_source_id === 3) return;

  // Fetch corpus (shared across all variants) via libDb's decryption boundary.
  // Exclude calibration responses (question_source_id = 3): calibrations are
  // prompted neutral writing that would corrupt the Markov/PPM language model.
  const corpusRows = await listResponseTextsExcludingCalibration(subjectId, {
    orderBy: 'scheduled_for_asc',
  });
  const textRows = corpusRows.map(r => ({ text: r.text }));

  if (textRows.length < 3) return;

  // Fetch question text + source
  const qInfo = await getQuestionTextById(subjectId, questionId);
  if (!qInfo) return;
  const questionText = qInfo.text;
  const questionSourceId = qInfo.question_source_id;

  // Fetch real response text + word count.
  // word_count is on tb_session_summaries (not encrypted); response text comes
  // through libDb's decryption boundary.
  const summaryRows = await sql`
    SELECT s.word_count
    FROM tb_session_summaries s
    WHERE s.question_id = ${questionId}
      AND s.subject_id = ${subjectId}
  ` as Array<{ word_count: number | null }>;
  const realWordCount = summaryRows[0]?.word_count ?? 150;
  const realText = await getResponseText(subjectId, questionId);
  if (!realText) return;

  // Fetch personal profile (extended with variant-specific fields)
  const profileRows = await sql`
    SELECT digraph_aggregate_json,
           ex_gaussian_mu_mean, ex_gaussian_sigma_mean, ex_gaussian_tau_mean,
           burst_length_mean,
           pause_between_word_pct, pause_between_sent_pct,
           first_keystroke_mean,
           small_del_rate_mean, large_del_rate_mean,
           revision_timing_bias, r_burst_ratio_mean,
           rburst_mean_size, rburst_leading_edge_pct,
           rburst_consolidation, rburst_mean_duration,
           session_count,
           iki_autocorrelation_lag1_mean, hold_flight_rank_correlation,
           hold_time_mean_mean, hold_time_mean_std,
           flight_time_mean_mean, flight_time_mean_std
    FROM tb_personal_profile
    WHERE subject_id = ${subjectId}
    LIMIT 1
  `;
  const p = profileRows[0] as Record<string, unknown> | undefined;
  if (!p) return;

  const corpusJson = JSON.stringify(textRows.map(r => r.text));
  const profileJson = JSON.stringify({
    digraph: typeof p.digraph_aggregate_json === 'string'
      ? JSON.parse(p.digraph_aggregate_json as string)
      : p.digraph_aggregate_json || null,
    mu: p.ex_gaussian_mu_mean ?? null,
    sigma: p.ex_gaussian_sigma_mean ?? null,
    tau: p.ex_gaussian_tau_mean ?? null,
    burst_length: p.burst_length_mean ?? null,
    pause_between_pct: p.pause_between_word_pct ?? null,
    pause_sent_pct: p.pause_between_sent_pct ?? null,
    first_keystroke: p.first_keystroke_mean ?? null,
    small_del_rate: p.small_del_rate_mean ?? null,
    large_del_rate: p.large_del_rate_mean ?? null,
    revision_timing_bias: p.revision_timing_bias ?? null,
    r_burst_ratio: p.r_burst_ratio_mean ?? null,
    rburst_mean_size: p.rburst_mean_size ?? null,
    rburst_leading_edge_pct: p.rburst_leading_edge_pct ?? null,
    // Added 2026-04-21. Sessions before this date have residuals computed without
    // these fields (hardcoded R-burst timing). See avatar.rs note for recompute instructions.
    rburst_consolidation: p.rburst_consolidation ?? null,
    rburst_mean_duration: p.rburst_mean_duration ?? null,
    iki_autocorrelation_lag1: p.iki_autocorrelation_lag1_mean ?? null,
    hold_flight_rank_correlation: p.hold_flight_rank_correlation ?? null,
    hold_time_mean: p.hold_time_mean_mean ?? null,
    hold_time_std: p.hold_time_mean_std ?? null,
    flight_time_mean: p.flight_time_mean_mean ?? null,
    flight_time_std: p.flight_time_mean_std ?? null,
  });

  // Fetch real signals ONCE (shared across all variants)
  const realDyn = await getDynamicalSignals(subjectId, questionId);
  const realMot = await getMotorSignals(subjectId, questionId);
  const realSem = await getSemanticSignals(subjectId, questionId);

  const corpusSize = textRows.length;
  const sessionCount = (p.session_count as number) ?? 0;

  // Compute corpus hash ONCE per session (shared across all 5 variants)
  const corpusSha256 = createHash('sha256').update(corpusJson).digest('hex');

  // Run all 5 variants sequentially
  for (const variantId of ALL_VARIANTS) {
    try {
      await computeForVariant(
        subjectId, questionId, variantId, corpusJson, questionText, questionSourceId,
        realWordCount, realText, profileJson, corpusSize, sessionCount,
        corpusSha256, realDyn, realMot, realSem,
      );
    } catch (err) {
      logError('reconstruction.variant', err, { subjectId, questionId, variantId });
    }
  }
}

// ─── Verification ─────────────────────────────────────────────────

export interface SignalComparison {
  name: string;
  family: 'dynamical' | 'motor' | 'semantic' | 'perplexity';
  stored: number | null;
  recomputed: number | null;
  delta: number | null;
  match: boolean;
}

export interface VerificationResult {
  questionId: number;
  variantId: number;
  corpusValid: boolean;
  signals: SignalComparison[];
  dynamicalMatch: boolean;
  motorMatch: boolean;
  semanticMatch: boolean;
  allMatch: boolean;
}

/**
 * Verify a stored residual by regenerating the ghost from stored inputs
 * and comparing avatar signal values.
 *
 * Returns null if the residual is not reproducible (pre-reproducibility-era)
 * or if the corpus has changed since computation.
 */
export async function verifyResidual(
  subjectId: number,
  questionId: number,
  variantId: number,
): Promise<VerificationResult | null> {
  // 1. Load stored residual
  const stored = await getReconstructionResidual(subjectId, questionId, variantId);
  if (!stored) return null;

  // Gate: must be post-reproducibility-era
  const row = stored as unknown as Record<string, unknown>;
  const seed = row.avatar_seed as string | null;
  const profileJson = row.profile_snapshot_json as string | null;
  const storedHash = row.corpus_sha256 as string | null;
  const topic = row.avatar_topic as string | null;
  if (!seed || !profileJson) return null;

  // 2. Reconstruct corpus (must match computation-time filter). Plaintext
  // returns through libDb's decryption boundary.
  const corpusRows = await listResponseTextsExcludingCalibration(subjectId, {
    orderBy: 'scheduled_for_asc',
  });
  const textRows = corpusRows.map(r => ({ text: r.text }));

  const corpusJson = JSON.stringify(textRows.map(r => r.text));

  // 3. Corpus integrity check
  const corpusSha256 = createHash('sha256').update(corpusJson).digest('hex');
  const corpusValid = !storedHash || corpusSha256 === storedHash;
  if (!corpusValid) {
    return {
      questionId, variantId, corpusValid: false,
      signals: [], dynamicalMatch: false, motorMatch: false,
      semanticMatch: false, allMatch: false,
    };
  }

  // 4. Regenerate avatar
  const realWordCount = (stored.real_word_count as number) ?? 150;
  const resolvedTopic = topic ?? '';
  const resolvedProfile = typeof profileJson === 'string' ? profileJson : JSON.stringify(profileJson);

  // Typed boundary: parse the legacy-format JSON once into the typed inputs
  // the napi function accepts. Old rows (pre-2026-04-25) and new rows both
  // round-trip cleanly because `profileFromLegacyJson` accepts the
  // record-shaped digraph the project always stored.
  const corpusReplay = JSON.parse(corpusJson) as string[];
  const profileReplay = profileFromLegacyJson(resolvedProfile);
  const avatar = regenerateAvatar(corpusReplay, resolvedTopic, profileReplay, realWordCount, variantId, seed);
  if (!avatar) return null;

  // 5. Compute signals on regenerated ghost
  const avatarDurationMs = avatar.keystrokeStream.length > 0
    ? avatar.keystrokeStream[avatar.keystrokeStream.length - 1]!.u
    : 0;

  let regenDyn: DynamicalSignals | null = null;
  let regenMot: MotorSignals | null = null;

  if (avatar.keystrokeStream.length >= 10) {
    regenDyn = computeDynamicalSignals(avatar.keystrokeStream);
    regenMot = computeMotorSignals(avatar.keystrokeStream, avatarDurationMs);
  }

  // 6. Compare stored avatar signals against recomputed
  const signals: SignalComparison[] = [];

  function compare(
    name: string,
    family: SignalComparison['family'],
    storedVal: number | null | undefined,
    recomputedVal: number | null | undefined,
  ): void {
    const s = storedVal ?? null;
    const r = recomputedVal ?? null;
    const d = (s != null && r != null) ? Math.abs(s - r) : null;
    const m = s === r || (s == null && r == null);
    signals.push({ name, family, stored: s, recomputed: r, delta: d, match: m });
  }

  // Dynamical
  compare('permutation_entropy', 'dynamical', stored.avatar_permutation_entropy, regenDyn?.permutationEntropy);
  compare('dfa_alpha', 'dynamical', stored.avatar_dfa_alpha, regenDyn?.dfaAlpha);
  compare('rqa_determinism', 'dynamical', stored.avatar_rqa_determinism, regenDyn?.rqaDeterminism);
  compare('rqa_laminarity', 'dynamical', stored.avatar_rqa_laminarity, regenDyn?.rqaLaminarity);
  compare('te_dominance', 'dynamical', stored.avatar_te_dominance, regenDyn?.teDominance);

  // Motor
  compare('sample_entropy', 'motor', stored.avatar_sample_entropy, regenMot?.sampleEntropy);
  compare('motor_jerk', 'motor', stored.avatar_motor_jerk, regenMot?.motorJerk);
  compare('lapse_rate', 'motor', stored.avatar_lapse_rate, regenMot?.lapseRate);
  compare('tempo_drift', 'motor', stored.avatar_tempo_drift, regenMot?.tempoDrift);
  compare('ex_gaussian_tau', 'motor', stored.avatar_ex_gaussian_tau, regenMot?.exGaussianTau);
  compare('tau_proportion', 'motor', stored.avatar_tau_proportion, regenMot?.tauProportion);

  // Perplexity (computed from corpus + avatar text, deterministic)
  const regenPerp = computePerplexity(corpusReplay, avatar.text);
  compare('perplexity', 'perplexity', stored.avatar_perplexity, regenPerp?.perplexity);

  // Extended signals (from JSONB)
  const extJson = row.extended_residuals_json as Record<string, { real: number | null; avatar: number | null; residual: number | null }> | null;
  if (extJson) {
    // Dynamical extended signals
    const dynExtKeys = [
      'mfdfa_spectrum_width', 'mfdfa_asymmetry', 'temporal_irreversibility',
      'iki_psd_spectral_slope', 'iki_psd_respiratory_peak_hz', 'iki_psd_lf_hf_ratio',
      'statistical_complexity', 'forbidden_pattern_fraction', 'weighted_pe',
      'lempel_ziv_complexity', 'optn_transition_entropy',
      'recurrence_transitivity', 'recurrence_avg_path_length',
      'recurrence_clustering', 'recurrence_assortativity',
      'rqa_recurrence_time_entropy', 'rqa_mean_recurrence_time',
      'effective_information', 'causal_emergence_index',
      'pid_synergy', 'pid_redundancy',
      'branching_ratio', 'avalanche_size_exponent',
      'dmd_dominant_frequency', 'dmd_dominant_decay_rate', 'dmd_spectral_entropy',
    ];
    for (const k of dynExtKeys) {
      const entry = extJson[k];
      if (!entry) continue;
      const camelKey = snakeToCamel(k) as keyof DynamicalSignals;
      compare(k, 'dynamical', entry.avatar, regenDyn?.[camelKey] as number | null ?? null);
    }
    // Motor extended signals
    const motExtKeys = ['complexity_index', 'ex_gaussian_fisher_trace'];
    for (const k of motExtKeys) {
      const entry = extJson[k];
      if (!entry) continue;
      const camelKey = snakeToCamel(k) as keyof MotorSignals;
      compare(k, 'motor', entry.avatar, regenMot?.[camelKey] as number | null ?? null);
    }
  }

  // Semantic signals are NOT recomputed here. They depend on external APIs
  // (Claude, Voyage) that may have changed. Per design: semantic residuals
  // are externally-dependent and excluded from the bit-reproducibility guarantee.

  const dynamicalMatch = signals.filter(s => s.family === 'dynamical').every(s => s.match);
  const motorMatch = signals.filter(s => s.family === 'motor').every(s => s.match);
  const semanticMatch = true; // not tested; externally-dependent
  const allMatch = dynamicalMatch && motorMatch;

  return {
    questionId, variantId, corpusValid,
    signals, dynamicalMatch, motorMatch, semanticMatch, allMatch,
  };
}
