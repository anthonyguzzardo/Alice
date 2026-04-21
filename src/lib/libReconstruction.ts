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
  type ReconstructionResidualInput,
} from './libDb.ts';
import {
  computeDynamicalSignals,
  computeMotorSignals,
  generateAvatar,
  computePerplexity,
  type DynamicalSignals,
  type MotorSignals,
} from './libSignalsNative.ts';
import { computeSemanticSignals, type SemanticSignals } from './libSemanticSignals.ts';
import { logError } from './utlErrorLog.ts';

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
  realDyn: Awaited<ReturnType<typeof getDynamicalSignals>>,
  realMot: Awaited<ReturnType<typeof getMotorSignals>>,
  realSem: Awaited<ReturnType<typeof getSemanticSignals>>,
): Promise<void> {
  // Gate: idempotent per variant
  if (await getReconstructionResidual(questionId, variantId)) return;

  // Generate avatar for this variant
  const avatar = generateAvatar(corpusJson, questionText, profileJson, realWordCount, variantId);
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

  // Compute perplexity for both texts
  const realPerp = computePerplexity(corpusJson, realText);
  const avatarPerp = computePerplexity(corpusJson, avatar.text);

  // PE spectrum comparison
  const { realParsed: realPeSpec, residual: peSpecResidual } = spectrumDelta(
    realDyn?.pe_spectrum,
    avatarDyn?.peSpectrum,
  );

  // Per-signal residuals
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

  // Aggregate norms
  const dynNorm = l2(Object.values(dynResiduals));
  const motNorm = l2(Object.values(motResiduals));
  const semNorm = l2(Object.values(semResiduals));
  const allResiduals = [
    ...Object.values(dynResiduals),
    ...Object.values(motResiduals),
    ...Object.values(semResiduals),
    delta(realPerp?.perplexity ?? null, avatarPerp?.perplexity ?? null),
  ];
  const totalNorm = l2(allResiduals);
  const residualCount = allResiduals.filter(isFiniteNum).length;

  // Persist
  const row: ReconstructionResidualInput = {
    adversary_variant_id: variantId,
    question_source_id: questionSourceId,
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
    perplexity_residual: delta(realPerp?.perplexity ?? null, avatarPerp?.perplexity ?? null),

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

    dynamical_l2_norm: dynNorm,
    motor_l2_norm: motNorm,
    semantic_l2_norm: semNorm,
    total_l2_norm: totalNorm,
    residual_count: residualCount,
  };

  try {
    await saveReconstructionResidual(questionId, row);
  } catch (err) {
    logError('reconstruction.save', err, { questionId, variantId });
  }
}

// ─── Main ──────────────────────────────────────────────────────────

export async function computeReconstructionResidual(questionId: number): Promise<void> {
  // Fetch corpus (shared across all variants)
  const textRows = await sql`
    SELECT r.text
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY q.scheduled_for ASC
  ` as Array<{ text: string }>;

  if (textRows.length < 3) return;

  // Fetch question text + source
  const qRows = await sql`SELECT text, question_source_id FROM tb_questions WHERE question_id = ${questionId}`;
  const qRow = qRows[0] as { text: string; question_source_id: number } | undefined;
  const questionText = qRow?.text;
  if (!questionText) return;
  const questionSourceId = qRow.question_source_id;

  // Fetch real response text + word count
  const summaryRows = await sql`
    SELECT s.word_count, r.text AS response_text
    FROM tb_session_summaries s
    JOIN tb_responses r ON s.question_id = r.question_id
    WHERE s.question_id = ${questionId}
  ` as Array<{ word_count: number | null; response_text: string }>;
  const realWordCount = summaryRows[0]?.word_count ?? 150;
  const realText = summaryRows[0]?.response_text;
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
           session_count,
           iki_autocorrelation_lag1_mean, hold_flight_rank_correlation,
           hold_time_mean_mean, hold_time_mean_std,
           flight_time_mean_mean, flight_time_mean_std
    FROM tb_personal_profile
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
    iki_autocorrelation_lag1: p.iki_autocorrelation_lag1_mean ?? null,
    hold_flight_rank_correlation: p.hold_flight_rank_correlation ?? null,
    hold_time_mean: p.hold_time_mean_mean ?? null,
    hold_time_std: p.hold_time_mean_std ?? null,
    flight_time_mean: p.flight_time_mean_mean ?? null,
    flight_time_std: p.flight_time_mean_std ?? null,
  });

  // Fetch real signals ONCE (shared across all variants)
  const realDyn = await getDynamicalSignals(questionId);
  const realMot = await getMotorSignals(questionId);
  const realSem = await getSemanticSignals(questionId);

  const corpusSize = textRows.length;
  const sessionCount = (p.session_count as number) ?? 0;

  // Run all 5 variants sequentially
  for (const variantId of ALL_VARIANTS) {
    try {
      await computeForVariant(
        questionId, variantId, corpusJson, questionText, questionSourceId,
        realWordCount, realText, profileJson, corpusSize, sessionCount,
        realDyn, realMot, realSem,
      );
    } catch (err) {
      logError('reconstruction.variant', err, { questionId, variantId });
    }
  }
}
