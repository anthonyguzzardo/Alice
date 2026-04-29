/**
 * Backfill: extended reconstruction residuals for existing rows.
 *
 * For each existing residual row:
 *   1. Regenerate the avatar from stored seed (bit-identical)
 *   2. Compute new Phase 1-5 signals on the avatar's keystroke stream
 *   3. Load real signals from tb_dynamical_signals / tb_motor_signals
 *   4. Compute extended residuals and recompute L2 norms
 *   5. UPDATE the row with JSONB + new norms
 *
 * Safe to re-run: rows with non-null extended_residuals_json are skipped.
 *
 * Run: npx tsx src/scripts/backfill-extended-residuals.ts
 */

import sql, { getDynamicalSignals, getMotorSignals, listResponseTextsExcludingCalibration } from '../lib/libDb.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';
import {
  computeDynamicalSignals,
  computeMotorSignals,
  regenerateAvatar,
  profileFromLegacyJson,
  type DynamicalSignals,
  type MotorSignals,
} from '../lib/libSignalsNative.ts';
import { createHash } from 'node:crypto';

// ─── Helpers (duplicated from libReconstruction.ts to keep script standalone) ──

function delta(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null;
  return a - b;
}

function isFiniteNum(v: number | null): v is number {
  return v != null && Number.isFinite(v);
}

function l2(values: (number | null)[]): number | null {
  const valid = values.filter(isFiniteNum);
  if (valid.length === 0) return null;
  return Math.sqrt(valid.reduce((s, v) => s + v * v, 0) / valid.length);
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const subjectId = parseSubjectIdArg();

  // Find rows that need backfill
  const rows = await sql`
    SELECT reconstruction_residual_id, question_id, adversary_variant_id,
           avatar_seed, profile_snapshot_json, corpus_sha256, avatar_topic,
           real_word_count,
           real_permutation_entropy, avatar_permutation_entropy,
           real_dfa_alpha, avatar_dfa_alpha,
           real_rqa_determinism, avatar_rqa_determinism,
           real_rqa_laminarity, avatar_rqa_laminarity,
           real_te_dominance, avatar_te_dominance,
           real_sample_entropy, avatar_sample_entropy,
           real_motor_jerk, avatar_motor_jerk,
           real_lapse_rate, avatar_lapse_rate,
           real_tempo_drift, avatar_tempo_drift,
           real_ex_gaussian_tau, avatar_ex_gaussian_tau,
           real_tau_proportion, avatar_tau_proportion,
           real_perplexity, avatar_perplexity,
           real_idea_density, avatar_idea_density,
           real_lexical_sophistication, avatar_lexical_sophistication,
           real_epistemic_stance, avatar_epistemic_stance,
           real_integrative_complexity, avatar_integrative_complexity,
           real_deep_cohesion, avatar_deep_cohesion,
           real_text_compression_ratio, avatar_text_compression_ratio
    FROM tb_reconstruction_residuals
    WHERE subject_id = ${subjectId}
      AND avatar_seed IS NOT NULL
      AND (extended_residuals_json IS NULL OR jsonb_typeof(extended_residuals_json) != 'object')
    ORDER BY question_id ASC, adversary_variant_id ASC
  ` as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    console.log('No rows need backfill.');
    return;
  }

  console.log(`Found ${rows.length} residual rows to backfill.`);

  // Build corpus once (shared across all rows). Plaintext through libDb's
  // decryption boundary.
  const corpusRows = await listResponseTextsExcludingCalibration(subjectId, {
    orderBy: 'scheduled_for_asc',
  });
  const textRows = corpusRows.map(r => ({ text: r.text }));

  // corpusArr is the array form regenerateAvatar's napi binding requires
  // (post-2026-04-25 signature change from `corpus_json: String` to
  // `corpus: Vec<String>`). corpusJson stays for the SHA-256 reproducibility
  // check — that hash is computed on the JSON-stringified form by design.
  const corpusArr = textRows.map(r => r.text);
  const corpusJson = JSON.stringify(corpusArr);
  const corpusSha256 = createHash('sha256').update(corpusJson).digest('hex');

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const qid = row.question_id as number;
    const vid = row.adversary_variant_id as number;
    const rid = row.reconstruction_residual_id as number;
    const seed = row.avatar_seed as string;
    const profileJson = row.profile_snapshot_json as string;
    const storedHash = row.corpus_sha256 as string | null;
    const topic = row.avatar_topic as string | null;
    const realWordCount = (row.real_word_count as number) ?? 150;

    // Corpus integrity check
    if (storedHash && storedHash !== corpusSha256) {
      console.warn(`  q${qid} v${vid}: corpus hash mismatch, skipping`);
      skipped++;
      continue;
    }

    // Regenerate avatar from stored seed. Post-2026-04-25 the napi binding
    // expects an AvatarProfileInput object, not the legacy JSON string
    // stored in profile_snapshot_json. profileFromLegacyJson handles either
    // shape (parses then maps to the typed struct).
    const resolvedProfile = typeof profileJson === 'string' ? profileJson : JSON.stringify(profileJson);
    const profileObj = profileFromLegacyJson(resolvedProfile);
    const avatar = regenerateAvatar(corpusArr, topic ?? '', profileObj, realWordCount, vid, seed);
    if (!avatar) {
      console.warn(`  q${qid} v${vid}: avatar regeneration failed, skipping`);
      skipped++;
      continue;
    }

    // Compute avatar signals
    const avatarDurationMs = avatar.keystrokeStream.length > 0
      ? avatar.keystrokeStream[avatar.keystrokeStream.length - 1]!.u
      : 0;

    let avatarDyn: DynamicalSignals | null = null;
    let avatarMot: MotorSignals | null = null;

    if (avatar.keystrokeStream.length >= 10) {
      avatarDyn = computeDynamicalSignals(avatar.keystrokeStream);
      avatarMot = computeMotorSignals(avatar.keystrokeStream, avatarDurationMs);
    }

    // Load real signals
    const realDyn = await getDynamicalSignals(subjectId, qid);
    const realMot = await getMotorSignals(subjectId, qid);

    // Compute extended residuals
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

    // Build JSONB payload
    const extendedJson: Record<string, { real: number | null; avatar: number | null; residual: number | null }> = {};
    for (const [k, res] of Object.entries(extDynResiduals)) {
      const realVal = (realDyn as Record<string, unknown> | null)?.[k] as number | null ?? null;
      const camelKey = snakeToCamel(k);
      const avatarVal = (avatarDyn as Record<string, unknown> | null)?.[camelKey] as number | null ?? null;
      extendedJson[k] = { real: realVal, avatar: avatarVal, residual: res };
    }
    for (const [k, res] of Object.entries(extMotResiduals)) {
      const realVal = (realMot as Record<string, unknown> | null)?.[k] as number | null ?? null;
      const camelKey = snakeToCamel(k);
      const avatarVal = (avatarMot as Record<string, unknown> | null)?.[camelKey] as number | null ?? null;
      extendedJson[k] = { real: realVal, avatar: avatarVal, residual: res };
    }

    // Recompute norms (original + extended)
    const origDynResiduals = {
      pe: delta(row.real_permutation_entropy as number | null, row.avatar_permutation_entropy as number | null),
      dfa: delta(row.real_dfa_alpha as number | null, row.avatar_dfa_alpha as number | null),
      rqaDet: delta(row.real_rqa_determinism as number | null, row.avatar_rqa_determinism as number | null),
      rqaLam: delta(row.real_rqa_laminarity as number | null, row.avatar_rqa_laminarity as number | null),
      teDom: delta(row.real_te_dominance as number | null, row.avatar_te_dominance as number | null),
    };
    const origMotResiduals = {
      sampEn: delta(row.real_sample_entropy as number | null, row.avatar_sample_entropy as number | null),
      jerk: delta(row.real_motor_jerk as number | null, row.avatar_motor_jerk as number | null),
      lapse: delta(row.real_lapse_rate as number | null, row.avatar_lapse_rate as number | null),
      drift: delta(row.real_tempo_drift as number | null, row.avatar_tempo_drift as number | null),
      tau: delta(row.real_ex_gaussian_tau as number | null, row.avatar_ex_gaussian_tau as number | null),
      tauProp: delta(row.real_tau_proportion as number | null, row.avatar_tau_proportion as number | null),
    };
    const origSemResiduals = {
      idea: delta(row.real_idea_density as number | null, row.avatar_idea_density as number | null),
      lex: delta(row.real_lexical_sophistication as number | null, row.avatar_lexical_sophistication as number | null),
      epist: delta(row.real_epistemic_stance as number | null, row.avatar_epistemic_stance as number | null),
      integ: delta(row.real_integrative_complexity as number | null, row.avatar_integrative_complexity as number | null),
      cohes: delta(row.real_deep_cohesion as number | null, row.avatar_deep_cohesion as number | null),
      compress: delta(row.real_text_compression_ratio as number | null, row.avatar_text_compression_ratio as number | null),
    };
    const perplexityResidual = delta(row.real_perplexity as number | null, row.avatar_perplexity as number | null);

    const allDynValues = [...Object.values(origDynResiduals), ...Object.values(extDynResiduals)];
    const allMotValues = [...Object.values(origMotResiduals), ...Object.values(extMotResiduals)];
    const dynNorm = l2(allDynValues);
    const motNorm = l2(allMotValues);
    const semNorm = l2(Object.values(origSemResiduals));

    const behavioralResiduals = [...allDynValues, ...allMotValues, perplexityResidual];
    const behavioralNorm = l2(behavioralResiduals);
    const behavioralCount = behavioralResiduals.filter(isFiniteNum).length;

    const allResiduals = [...behavioralResiduals, ...Object.values(origSemResiduals)];
    const totalNorm = l2(allResiduals);
    const residualCount = allResiduals.filter(isFiniteNum).length;

    // UPDATE the row
    // alice-lint-disable-next-query subject-scope -- PK update on reconstruction_residual_id; the row was selected via a subject-scoped SELECT above
    // extended_residuals_json is a Record (Tier A JSONB convention per
    // HANDOFF §4 item 11); stringify before parameter binding.
    const extendedJsonParam = JSON.stringify(extendedJson);
    await sql`
      UPDATE tb_reconstruction_residuals SET
        extended_residuals_json = ${extendedJsonParam},
        dynamical_l2_norm = ${dynNorm},
        motor_l2_norm = ${motNorm},
        semantic_l2_norm = ${semNorm},
        total_l2_norm = ${totalNorm},
        residual_count = ${residualCount},
        behavioral_l2_norm = ${behavioralNorm},
        behavioral_residual_count = ${behavioralCount}
      WHERE reconstruction_residual_id = ${rid}
    `;

    updated++;
    process.stdout.write(`\r  ${updated}/${rows.length} done`);
  }

  console.log(`\n\nBackfill complete. Updated: ${updated}, Skipped: ${skipped}`);

  // Coverage report
  const [coverage] = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(extended_residuals_json) AS has_extended
    FROM tb_reconstruction_residuals
    WHERE subject_id = ${subjectId}
  ` as [{ total: number; has_extended: number }];
  console.log(`  Coverage: ${coverage.has_extended}/${coverage.total} rows have extended residuals`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
