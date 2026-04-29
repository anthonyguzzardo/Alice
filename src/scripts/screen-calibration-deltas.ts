/**
 * Phase 1 Screening: Signal-Family Delta Reliability Analysis
 *
 * For each of the ~66 signals across 4 families, computes across all
 * available same-day journal/calibration pairs:
 *
 *   1. Sign consistency (proportion of days where delta has the same sign)
 *   2. Hedges' g_z with BCa bootstrap CI (1000 resamples)
 *   3. Per-signal RCI using calibration-session SD as the noise floor
 *   4. Calibration stationarity check (Mann-Kendall trend test on calibration values)
 *
 * Partitioned by ergodicity class, unit scale, and computation method.
 *
 * Reliability threshold: sign consistency > 0.75 AND bootstrap CI excludes
 * zero AND calibration baseline is stationary. Everything failing any
 * criterion goes in a separate section.
 *
 * Run: npx tsx src/scripts/screen-calibration-deltas.ts
 */
import sql from '../lib/libDbPool.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';
import { fileURLToPath } from 'node:url';

// ─── Signal metadata ────────────────────────────────────────────────

type ErgodicityClass = 'safe' | 'unsafe';
type UnitScale = 'bounded' | 'raw';
type ComputationMethod = 'rust-deterministic' | 'ts-deterministic' | 'llm-derived';

interface SignalMeta {
  column: string;
  table: string;
  family: string;
  ergodicity: ErgodicityClass;
  unitScale: UnitScale;
  computation: ComputationMethod;
  label: string;
}

// Per signals.md ergodicity framework:
// Safe: DFA, PE, RQA, sample entropy, compression ratio, MF-DFA, temporal irreversibility,
//        PE-derived extensions (statistical complexity, forbidden patterns, weighted PE, LZC)
// Unsafe: IKI mean/std, hold/flight means, ex-Gaussian mu/sigma, chars per minute, active typing
//
// Per Option H paper unit scale:
// Bounded: entropy [0,1], correlation [-1,1], ratios, exponents
// Raw: ms, ms/step^2, counts, bits (unbounded)

const SIGNALS: SignalMeta[] = [
  // ─── Dynamical ──────────────────────────────────────────────────
  // Permutation entropy family
  { column: 'permutation_entropy', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Permutation entropy (normalized)' },
  { column: 'dfa_alpha', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'DFA alpha (Hurst exponent)' },
  // MF-DFA
  { column: 'mfdfa_spectrum_width', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'MF-DFA spectrum width' },
  { column: 'mfdfa_asymmetry', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'MF-DFA asymmetry' },
  { column: 'mfdfa_peak_alpha', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'MF-DFA peak alpha' },
  // Temporal
  { column: 'temporal_irreversibility', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Temporal irreversibility' },
  // PSD
  { column: 'iki_psd_spectral_slope', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'IKI PSD spectral slope' },
  { column: 'iki_psd_lf_hf_ratio', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'unsafe', unitScale: 'raw', computation: 'rust-deterministic', label: 'IKI PSD LF/HF ratio' },
  { column: 'iki_psd_fast_slow_variance_ratio', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'unsafe', unitScale: 'raw', computation: 'rust-deterministic', label: 'IKI PSD fast/slow variance ratio' },
  // Ordinal extensions
  { column: 'statistical_complexity', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Statistical complexity (C_JS)' },
  { column: 'forbidden_pattern_fraction', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Forbidden pattern fraction' },
  { column: 'weighted_pe', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Weighted PE' },
  { column: 'lempel_ziv_complexity', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Lempel-Ziv complexity' },
  { column: 'optn_transition_entropy', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'OPTN transition entropy (bits)' },
  // RQA
  { column: 'rqa_determinism', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'RQA determinism' },
  { column: 'rqa_laminarity', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'RQA laminarity' },
  { column: 'rqa_trapping_time', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'RQA trapping time' },
  { column: 'rqa_recurrence_rate', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'RQA recurrence rate' },
  { column: 'rqa_recurrence_time_entropy', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'RQA recurrence time entropy (bits)' },
  { column: 'rqa_mean_recurrence_time', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'RQA mean recurrence time' },
  // Recurrence networks
  { column: 'recurrence_transitivity', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Recurrence transitivity' },
  { column: 'recurrence_avg_path_length', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Recurrence avg path length' },
  { column: 'recurrence_clustering', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Recurrence clustering coefficient' },
  { column: 'recurrence_assortativity', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Recurrence assortativity' },
  // Causal emergence
  { column: 'effective_information', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Effective information (bits)' },
  { column: 'causal_emergence_index', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Causal emergence index (bits)' },
  // PID
  { column: 'pid_synergy', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'PID synergy (bits)' },
  { column: 'pid_redundancy', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'PID redundancy (bits)' },
  // Criticality
  { column: 'branching_ratio', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Branching ratio' },
  // DMD
  { column: 'dmd_dominant_frequency', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'DMD dominant frequency (Hz)' },
  { column: 'dmd_dominant_decay_rate', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'DMD dominant decay rate' },
  { column: 'dmd_spectral_entropy', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'DMD spectral entropy (bits)' },
  // Transfer entropy
  { column: 'te_hold_to_flight', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'TE hold->flight (bits)' },
  { column: 'te_flight_to_hold', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'TE flight->hold (bits)' },
  { column: 'te_dominance', table: 'tb_dynamical_signals', family: 'Dynamical', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'TE dominance ratio' },

  // ─── Motor ──────────────────────────────────────────────────────
  { column: 'sample_entropy', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Sample entropy (nats)' },
  { column: 'complexity_index', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'MSE complexity index (nats)' },
  { column: 'ex_gaussian_mu', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Ex-Gaussian mu (ms)' },
  { column: 'ex_gaussian_sigma', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Ex-Gaussian sigma (ms)' },
  { column: 'ex_gaussian_tau', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Ex-Gaussian tau (ms)' },
  { column: 'tau_proportion', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Tau proportion' },
  { column: 'ex_gaussian_fisher_trace', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Ex-Gaussian Fisher trace' },
  { column: 'motor_jerk', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Motor jerk (ms/step^2)' },
  { column: 'lapse_rate', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Lapse rate (per min)' },
  { column: 'tempo_drift', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Tempo drift (ms/quartile)' },
  { column: 'iki_compression_ratio', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'IKI compression ratio' },
  { column: 'adjacent_hold_time_cov', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Adjacent hold-time covariance' },
  { column: 'hold_flight_rank_corr', table: 'tb_motor_signals', family: 'Motor', ergodicity: 'unsafe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Hold-flight rank correlation' },

  // ─── Process ────────────────────────────────────────────────────
  { column: 'pause_within_word', table: 'tb_process_signals', family: 'Process', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Pause within word (count)' },
  { column: 'pause_between_word', table: 'tb_process_signals', family: 'Process', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Pause between word (count)' },
  { column: 'pause_between_sentence', table: 'tb_process_signals', family: 'Process', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Pause between sentence (count)' },
  { column: 'abandoned_thought_count', table: 'tb_process_signals', family: 'Process', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Abandoned thought count' },
  { column: 'r_burst_count', table: 'tb_process_signals', family: 'Process', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'R-burst count' },
  { column: 'i_burst_count', table: 'tb_process_signals', family: 'Process', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'I-burst count' },
  { column: 'vocab_expansion_rate', table: 'tb_process_signals', family: 'Process', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Vocab expansion rate (Heaps exponent)' },
  { column: 'phase_transition_point', table: 'tb_process_signals', family: 'Process', ergodicity: 'safe', unitScale: 'bounded', computation: 'rust-deterministic', label: 'Phase transition point [0-1]' },
  { column: 'strategy_shift_count', table: 'tb_process_signals', family: 'Process', ergodicity: 'safe', unitScale: 'raw', computation: 'rust-deterministic', label: 'Strategy shift count' },

  // ─── Semantic ─────────────────────────────────��─────────────────
  // Deterministic (word-list based)
  { column: 'idea_density', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'bounded', computation: 'ts-deterministic', label: 'Idea density' },
  { column: 'lexical_sophistication', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'bounded', computation: 'ts-deterministic', label: 'Lexical sophistication' },
  { column: 'epistemic_stance', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'bounded', computation: 'ts-deterministic', label: 'Epistemic stance' },
  { column: 'integrative_complexity', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'raw', computation: 'ts-deterministic', label: 'Integrative complexity (per sentence)' },
  { column: 'deep_cohesion', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'bounded', computation: 'ts-deterministic', label: 'Deep cohesion' },
  { column: 'referential_cohesion', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'bounded', computation: 'ts-deterministic', label: 'Referential cohesion' },
  { column: 'text_compression_ratio', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'bounded', computation: 'ts-deterministic', label: 'Text compression ratio' },
  // LLM-derived (require embeddings)
  { column: 'discourse_global_coherence', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'bounded', computation: 'llm-derived', label: 'Discourse global coherence' },
  { column: 'discourse_local_coherence', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'bounded', computation: 'llm-derived', label: 'Discourse local coherence' },
  { column: 'discourse_global_local_ratio', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'raw', computation: 'llm-derived', label: 'Discourse global/local ratio' },
  { column: 'discourse_coherence_decay_slope', table: 'tb_semantic_signals', family: 'Semantic', ergodicity: 'safe', unitScale: 'raw', computation: 'llm-derived', label: 'Discourse coherence decay slope' },
];

// ─── Matched pair finding ───────────────────────────────────────────

export interface MatchedPair {
  date: string;
  journalQuestionId: number;
  calibrationQuestionId: number;
}

export async function findMatchedPairs(subjectId: number): Promise<MatchedPair[]> {
  const rows = await sql`
    SELECT
      j.scheduled_for::text AS date,
      j.question_id AS "journalQuestionId",
      (
        SELECT c.question_id
        FROM tb_questions c
        JOIN tb_session_summaries cs ON cs.question_id = c.question_id
        WHERE c.subject_id = ${subjectId}
          AND c.question_source_id = 3
          AND c.dttm_created_utc::date = j.scheduled_for
        ORDER BY c.dttm_created_utc DESC
        LIMIT 1
      ) AS "calibrationQuestionId"
    FROM tb_questions j
    JOIN tb_session_summaries js ON js.question_id = j.question_id
    WHERE j.subject_id = ${subjectId}
      AND j.question_source_id != 3
      AND j.scheduled_for IS NOT NULL
    ORDER BY j.scheduled_for ASC
  ` as { date: string; journalQuestionId: number; calibrationQuestionId: number | null }[];

  return rows.filter(r => r.calibrationQuestionId != null) as MatchedPair[];
}

// ─── Data fetching ──────────────────────────────────────────────────

interface SignalValues {
  journal: number;
  calibration: number;
  delta: number; // journal - calibration
}

/** Fetch all calibration session values for a signal (for stationarity test) */
async function fetchCalibrationSeries(subjectId: number, sig: SignalMeta): Promise<{ date: string; value: number }[]> {
  const rows = await sql.unsafe(
    `SELECT q.dttm_created_utc::date::text AS date, s.${sig.column} AS value
     FROM ${sig.table} s
     JOIN tb_questions q ON s.question_id = q.question_id
     WHERE q.subject_id = $1
       AND q.question_source_id = 3
       AND s.${sig.column} IS NOT NULL
     ORDER BY q.dttm_created_utc ASC`,
    [subjectId]
  );
  // postgres.js's RowList<Row[]> generic doesn't narrow to a concrete shape;
  // the SELECT projection matches by construction.
  return rows as unknown as { date: string; value: number }[];
}

/** Fetch paired signal values for all matched day-pairs */
async function fetchPairedValues(
  subjectId: number,
  sig: SignalMeta,
  pairs: MatchedPair[],
): Promise<{ pair: MatchedPair; values: SignalValues }[]> {
  const results: { pair: MatchedPair; values: SignalValues }[] = [];

  for (const pair of pairs) {
    const jRows = await sql.unsafe(
      `SELECT ${sig.column} AS value FROM ${sig.table} WHERE subject_id = $1 AND question_id = $2`,
      [subjectId, pair.journalQuestionId]
    );
    const cRows = await sql.unsafe(
      `SELECT ${sig.column} AS value FROM ${sig.table} WHERE subject_id = $1 AND question_id = $2`,
      [subjectId, pair.calibrationQuestionId]
    );

    if (jRows.length === 0 || cRows.length === 0) continue;
    // postgres.js Row generic; bounds-checked length above guarantees [0] exists.
    const jv = (jRows[0] as unknown as { value: number | null }).value;
    const cv = (cRows[0] as unknown as { value: number | null }).value;
    if (jv == null || cv == null || !Number.isFinite(jv) || !Number.isFinite(cv)) continue;

    results.push({
      pair,
      values: { journal: jv, calibration: cv, delta: jv - cv },
    });
  }

  return results;
}

// ─── Statistical functions ──────────────────────────────────────────

function mean(vals: number[]): number {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function sd(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}

// ── Sign consistency ────────────────────────────────────────────────

interface SignConsistencyResult {
  n: number;
  positiveCount: number;
  negativeCount: number;
  dominantSign: 'positive' | 'negative' | 'tied';
  consistency: number; // proportion in dominant direction
  binomialP: number;   // two-sided binomial test against 0.5
}

function computeSignConsistency(deltas: number[]): SignConsistencyResult {
  const nonZero = deltas.filter(d => Math.abs(d) > 1e-15);
  const n = nonZero.length;
  if (n === 0) return { n: 0, positiveCount: 0, negativeCount: 0, dominantSign: 'tied', consistency: 0, binomialP: 1 };

  const positiveCount = nonZero.filter(d => d > 0).length;
  const negativeCount = n - positiveCount;
  const k = Math.max(positiveCount, negativeCount);
  const dominantSign = positiveCount > negativeCount ? 'positive' as const
    : negativeCount > positiveCount ? 'negative' as const
    : 'tied' as const;
  const consistency = k / n;

  // Two-sided binomial P(X >= k | n, 0.5) * 2, capped at 1
  // Using exact summation for small n
  let pTail = 0;
  for (let i = k; i <= n; i++) {
    pTail += binomialPMF(n, i, 0.5);
  }
  const binomialP = Math.min(1, 2 * pTail);

  return { n, positiveCount, negativeCount, dominantSign, consistency, binomialP };
}

function binomialPMF(n: number, k: number, p: number): number {
  return binomialCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function binomialCoeff(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < Math.min(k, n - k); i++) {
    result *= (n - i) / (i + 1);
  }
  return result;
}

// ── Hedges' g_z with BCa Bootstrap CI ───────────────────────────────

interface HedgesResult {
  n: number;
  meanDelta: number;
  sdDelta: number;
  dz: number;          // Cohen's d_z (paired)
  gz: number;          // Hedges' corrected
  ciLow: number;       // BCa 95% CI lower
  ciHigh: number;      // BCa 95% CI upper
  ciExcludesZero: boolean;
}

function hedgesCorrection(n: number): number {
  // J = 1 - 3 / (4(n-1) - 1)
  return 1 - 3 / (4 * (n - 1) - 1);
}

function computeHedgesGz(deltas: number[], nBoot: number = 1000): HedgesResult {
  const n = deltas.length;
  if (n < 3) {
    return { n, meanDelta: n > 0 ? mean(deltas) : 0, sdDelta: 0, dz: 0, gz: 0, ciLow: 0, ciHigh: 0, ciExcludesZero: false };
  }

  const m = mean(deltas);
  const s = sd(deltas);
  const dz = s > 1e-15 ? m / s : 0;
  const J = hedgesCorrection(n);
  const gz = dz * J;

  // BCa bootstrap
  const bootMeans: number[] = [];
  // Seeded PRNG for reproducibility (simple LCG)
  let seed = 42;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let b = 0; b < nBoot; b++) {
    const sample: number[] = [];
    for (let i = 0; i < n; i++) {
      sample.push(deltas[Math.floor(nextRand() * n)]!);
    }
    const bm = mean(sample);
    const bs = sd(sample);
    bootMeans.push(bs > 1e-15 ? (bm / bs) * J : 0);
  }
  bootMeans.sort((a, b) => a - b);

  // Bias correction (z0)
  const propBelow = bootMeans.filter(v => v < gz).length / nBoot;
  const z0 = normalQuantile(propBelow);

  // Acceleration (a) via jackknife
  const jackValues: number[] = [];
  for (let i = 0; i < n; i++) {
    const jk = [...deltas.slice(0, i), ...deltas.slice(i + 1)];
    const jm = mean(jk);
    const js = sd(jk);
    jackValues.push(js > 1e-15 ? (jm / js) * hedgesCorrection(n - 1) : 0);
  }
  const jackMean = mean(jackValues);
  const jackDiffSq = jackValues.map(v => (jackMean - v) ** 2);
  const jackDiffCube = jackValues.map(v => (jackMean - v) ** 3);
  const sumDiffSq = jackDiffSq.reduce((s, v) => s + v, 0);
  const sumDiffCube = jackDiffCube.reduce((s, v) => s + v, 0);
  const a = sumDiffSq > 1e-15 ? sumDiffCube / (6 * Math.pow(sumDiffSq, 1.5)) : 0;

  // Adjusted percentiles
  const alpha = 0.05;
  const zAlphaLow = normalQuantile(alpha / 2);
  const zAlphaHigh = normalQuantile(1 - alpha / 2);

  const adjLow = normalCDF(z0 + (z0 + zAlphaLow) / (1 - a * (z0 + zAlphaLow)));
  const adjHigh = normalCDF(z0 + (z0 + zAlphaHigh) / (1 - a * (z0 + zAlphaHigh)));

  const idxLow = Math.max(0, Math.min(nBoot - 1, Math.floor(adjLow * nBoot)));
  const idxHigh = Math.max(0, Math.min(nBoot - 1, Math.floor(adjHigh * nBoot)));

  const ciLow = bootMeans[idxLow]!;
  const ciHigh = bootMeans[idxHigh]!;

  return {
    n,
    meanDelta: m,
    sdDelta: s,
    dz,
    gz,
    ciLow,
    ciHigh,
    ciExcludesZero: (ciLow > 0 && ciHigh > 0) || (ciLow < 0 && ciHigh < 0),
  };
}

// Approximations for normal distribution
function normalCDF(x: number): number {
  // Abramowitz & Stegun 7.1.26 via error function
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327; // 1/sqrt(2*pi)
  const p = d * Math.exp(-x * x / 2) * (t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));
  return x >= 0 ? 1 - p : p;
}

function normalQuantile(p: number): number {
  // Rational approximation (Beasley-Springer-Moro)
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  if (p === 0.5) return 0;

  const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
  const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  let z = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
  return p < 0.5 ? -z : z;
}

// ── Reliable Change Index ───────────────────────────────────────────

interface RCIResult {
  calibrationSD: number;
  calibrationN: number;
  // Split-half reliability (odd-even) of calibration sessions
  rxx: number;
  seDiff: number;        // SE_diff = SD * sqrt(2 * (1 - rxx))
  // Per-day RCI values
  perDayRCI: { date: string; rci: number; significant: boolean }[];
  // Summary: how many days exceed threshold
  significantDays: number;
  totalDays: number;
  proportionSignificant: number;
}

function computeRCI(
  pairedData: { pair: MatchedPair; values: SignalValues }[],
  calibrationSeries: number[],
): RCIResult {
  const calN = calibrationSeries.length;
  const calSD = calN >= 2 ? sd(calibrationSeries) : 0;

  // Odd-even split-half reliability
  let rxx = 0;
  if (calN >= 4) {
    const odd = calibrationSeries.filter((_, i) => i % 2 === 0);
    const even = calibrationSeries.filter((_, i) => i % 2 === 1);
    const n = Math.min(odd.length, even.length);
    if (n >= 2) {
      const r = pearsonR(odd.slice(0, n), even.slice(0, n));
      // Spearman-Brown correction for split-half: rxx = 2r / (1 + r)
      rxx = (2 * r) / (1 + Math.abs(r));
      rxx = Math.max(0, Math.min(1, rxx)); // clamp to [0, 1]
    }
  }

  // SE_diff = SD_cal * sqrt(2 * (1 - rxx))
  const seDiff = calSD * Math.sqrt(2 * (1 - rxx));

  const perDayRCI: { date: string; rci: number; significant: boolean }[] = [];
  for (const { pair, values } of pairedData) {
    const rci = seDiff > 1e-15 ? values.delta / seDiff : 0;
    perDayRCI.push({ date: pair.date, rci, significant: Math.abs(rci) > 1.96 });
  }

  const significantDays = perDayRCI.filter(d => d.significant).length;

  return {
    calibrationSD: calSD,
    calibrationN: calN,
    rxx,
    seDiff,
    perDayRCI,
    significantDays,
    totalDays: perDayRCI.length,
    proportionSignificant: perDayRCI.length > 0 ? significantDays / perDayRCI.length : 0,
  };
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const mx = mean(x);
  const my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom > 1e-15 ? num / denom : 0;
}

// ── Calibration Stationarity (Mann-Kendall trend test) ──────────────

interface StationarityResult {
  n: number;
  kendallS: number;
  variance: number;
  z: number;
  pValue: number;     // two-sided
  isStationary: boolean; // p > 0.05 means no significant trend
  trendDirection: 'rising' | 'falling' | 'none';
}

function mannKendallTest(values: number[]): StationarityResult {
  const n = values.length;
  if (n < 4) {
    return { n, kendallS: 0, variance: 0, z: 0, pValue: 1, isStationary: true, trendDirection: 'none' };
  }

  // Compute S statistic
  let S = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = values[j]! - values[i]!;
      if (diff > 1e-15) S++;
      else if (diff < -1e-15) S--;
    }
  }

  // Variance with tie correction
  // Count tied groups
  const tieGroups = new Map<number, number>();
  for (const v of values) {
    // Round to avoid floating point ties
    const rounded = Math.round(v * 1e10) / 1e10;
    tieGroups.set(rounded, (tieGroups.get(rounded) ?? 0) + 1);
  }
  let tieCorrection = 0;
  for (const t of tieGroups.values()) {
    if (t > 1) tieCorrection += t * (t - 1) * (2 * t + 5);
  }

  const variance = (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18;

  // Z statistic with continuity correction
  let z: number;
  if (S > 0) z = (S - 1) / Math.sqrt(variance);
  else if (S < 0) z = (S + 1) / Math.sqrt(variance);
  else z = 0;

  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    n,
    kendallS: S,
    variance,
    z,
    pValue,
    isStationary: pValue > 0.05,
    trendDirection: S > 0 && pValue <= 0.05 ? 'rising' : S < 0 && pValue <= 0.05 ? 'falling' : 'none',
  };
}

// ─── Full screening result per signal ───────────────────────────────

interface ScreeningResult {
  signal: SignalMeta;
  nPairs: number;
  signConsistency: SignConsistencyResult;
  hedges: HedgesResult;
  rci: RCIResult;
  stationarity: StationarityResult;
  // Composite pass/fail
  passesThreshold: boolean;
  failReasons: string[];
}

// ─── Report formatting ──────────────────────────────────────────────

function pad(s: string, n: number): string { return s.padEnd(n); }
function rpad(s: string, n: number): string { return s.padStart(n); }
function fmt(v: number, d: number = 3): string { return v.toFixed(d); }
function fmtSigned(v: number, d: number = 3): string { return (v >= 0 ? '+' : '') + v.toFixed(d); }

function printResult(r: ScreeningResult): void {
  const dir = r.signConsistency.dominantSign === 'positive' ? 'journal >'
    : r.signConsistency.dominantSign === 'negative' ? 'calib >'
    : 'tied';
  const pass = r.passesThreshold ? 'PASS' : 'FAIL';
  const reasons = r.failReasons.length > 0 ? ` [${r.failReasons.join(', ')}]` : '';
  const statFlag = r.stationarity.isStationary ? '' : ` ⚠DRIFT(${r.stationarity.trendDirection})`;

  console.log(`  ${pad(r.signal.label, 42)} | ${rpad(String(r.nPairs), 3)} | ${rpad(fmt(r.signConsistency.consistency, 2), 5)} (p=${fmt(r.signConsistency.binomialP, 3)}) | g_z=${fmtSigned(r.hedges.gz)} [${fmtSigned(r.hedges.ciLow)}, ${fmtSigned(r.hedges.ciHigh)}] | RCI: ${rpad(String(r.rci.significantDays), 2)}/${rpad(String(r.rci.totalDays), 2)} sig (rxx=${fmt(r.rci.rxx, 2)}) | ${pad(dir, 10)} | ${pass}${reasons}${statFlag}`);
}

function printSectionHeader(title: string): void {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(80));
  console.log(`  ${'Signal'.padEnd(42)} |   n | Sign (p)         | Hedges g_z [95% BCa CI]          | RCI signif days        | Direction  | Result`);
  console.log(`  ${'─'.repeat(42)}-┼─────┼──────────────────┼──────────────────────────────────┼────────────────────────┼────────────┼───────`);
}

// ─── Main ─────────────────────────────────────��─────────────────────

async function main() {
  const subjectId = parseSubjectIdArg();
  const pairs = await findMatchedPairs(subjectId);

  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  SIGNAL-FAMILY DELTA SCREENING REPORT                                                                         ║');
  console.log('║  Phase 1: Reliability analysis across all signal families                                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n  Matched day-pairs: ${pairs.length}`);
  console.log(`  Date range: ${pairs[0]?.date ?? '?'} to ${pairs[pairs.length - 1]?.date ?? '?'}`);
  console.log(`  Signals screened: ${SIGNALS.length}`);
  console.log(`\n  Reliability threshold:`);
  console.log(`    1. Sign consistency > 0.75`);
  console.log(`    2. Hedges' g_z 95% BCa CI excludes zero`);
  console.log(`    3. Calibration baseline stationary (Mann-Kendall p > 0.05)`);

  const allResults: ScreeningResult[] = [];

  for (const sig of SIGNALS) {
    process.stdout.write(`  Screening ${sig.column}...`);

    const pairedData = await fetchPairedValues(subjectId, sig, pairs);
    const deltas = pairedData.map(d => d.values.delta);

    // Calibration series for stationarity + RCI
    const calSeries = await fetchCalibrationSeries(subjectId, sig);
    const calValues = calSeries.map(c => c.value);

    // 1. Sign consistency
    const signCon = computeSignConsistency(deltas);

    // 2. Hedges' g_z
    const hedges = deltas.length >= 3 ? computeHedgesGz(deltas) : computeHedgesGz([]);

    // 3. RCI
    const rci = computeRCI(pairedData, calValues);

    // 4. Stationarity
    const stationarity = mannKendallTest(calValues);

    // Composite threshold
    const failReasons: string[] = [];
    if (signCon.consistency <= 0.75) failReasons.push('sign<0.75');
    if (!hedges.ciExcludesZero) failReasons.push('CI spans 0');
    if (!stationarity.isStationary) failReasons.push('cal drifting');
    if (deltas.length < 3) failReasons.push('n<3');

    allResults.push({
      signal: sig,
      nPairs: deltas.length,
      signConsistency: signCon,
      hedges,
      rci,
      stationarity,
      passesThreshold: failReasons.length === 0,
      failReasons,
    });

    process.stdout.write(` ${deltas.length} pairs\n`);
  }

  // ── Separate passing from failing ──────────────────────────────
  const passing = allResults.filter(r => r.passesThreshold);
  const failing = allResults.filter(r => !r.passesThreshold);

  // Sort passing by effect size magnitude (descending)
  passing.sort((a, b) => Math.abs(b.hedges.gz) - Math.abs(a.hedges.gz));

  // ── HEADLINE: Provocation-reliable signals ─────────────────────
  console.log('\n\n');
  printSectionHeader('PROVOCATION-RELIABLE SIGNALS (all three criteria met)');

  if (passing.length === 0) {
    console.log('\n  (No signals met all three reliability criteria)');
  } else {
    // Group by family
    const families = ['Dynamical', 'Motor', 'Process', 'Semantic'];
    for (const fam of families) {
      const famResults = passing.filter(r => r.signal.family === fam);
      if (famResults.length === 0) continue;
      console.log(`\n  ── ${fam} (${famResults.length} reliable) ──`);
      for (const r of famResults) printResult(r);
    }

    // Classification breakdown
    console.log(`\n  ── Classification breakdown ──`);
    const safeCount = passing.filter(r => r.signal.ergodicity === 'safe').length;
    const unsafeCount = passing.filter(r => r.signal.ergodicity === 'unsafe').length;
    const boundedCount = passing.filter(r => r.signal.unitScale === 'bounded').length;
    const rawCount = passing.filter(r => r.signal.unitScale === 'raw').length;
    const rustCount = passing.filter(r => r.signal.computation === 'rust-deterministic').length;
    const tsCount = passing.filter(r => r.signal.computation === 'ts-deterministic').length;
    const llmCount = passing.filter(r => r.signal.computation === 'llm-derived').length;

    console.log(`  Ergodicity:  ${safeCount} safe, ${unsafeCount} unsafe`);
    console.log(`  Unit scale:  ${boundedCount} bounded, ${rawCount} raw`);
    console.log(`  Computation: ${rustCount} Rust, ${tsCount} TS-deterministic, ${llmCount} LLM-derived`);
  }

  // ── BELOW THRESHOLD ────────────────────────────────────────────
  printSectionHeader('BELOW THRESHOLD (failed one or more criteria)');

  // Sort by number of fail reasons (fewest first = closest to passing)
  failing.sort((a, b) => a.failReasons.length - b.failReasons.length || Math.abs(b.hedges.gz) - Math.abs(a.hedges.gz));

  for (const fam of ['Dynamical', 'Motor', 'Process', 'Semantic']) {
    const famResults = failing.filter(r => r.signal.family === fam);
    if (famResults.length === 0) continue;
    console.log(`\n  ── ${fam} (${famResults.length} below threshold) ──`);
    for (const r of famResults) printResult(r);
  }

  // ── STATIONARITY WARNINGS ─────────────────────────────────────
  const driftingSignals = allResults.filter(r => !r.stationarity.isStationary);
  if (driftingSignals.length > 0) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  CALIBRATION BASELINE DRIFT WARNINGS (${driftingSignals.length} signals)`);
    console.log('═'.repeat(80));
    console.log(`  These signals show a statistically significant trend in calibration sessions.`);
    console.log(`  Provocation deltas on these signals are confounded with baseline drift.\n`);
    for (const r of driftingSignals) {
      console.log(`  ${pad(r.signal.label, 42)} | MK z=${fmtSigned(r.stationarity.z)} p=${fmt(r.stationarity.pValue, 4)} | trend: ${r.stationarity.trendDirection} | n_cal=${r.stationarity.n}`);
    }
  }

  // ── Summary statistics ─────────────────────────────────────────
  console.log(`\n${'═'.repeat(80)}`);
  console.log('  SUMMARY');
  console.log('═'.repeat(80));
  console.log(`  Total signals screened:              ${allResults.length}`);
  console.log(`  Passing all three criteria:           ${passing.length}`);
  console.log(`  Failing (below threshold):            ${failing.length}`);
  console.log(`  Calibration baseline drifting:         ${driftingSignals.length}`);
  console.log(`  Insufficient data (n < 3 pairs):      ${allResults.filter(r => r.nPairs < 3).length}`);

  const failBreakdown = new Map<string, number>();
  for (const r of failing) {
    for (const reason of r.failReasons) {
      failBreakdown.set(reason, (failBreakdown.get(reason) ?? 0) + 1);
    }
  }
  console.log(`\n  Failure reason breakdown:`);
  for (const [reason, count] of [...failBreakdown.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pad(reason, 20)} ${count} signals`);
  }

  // ── Per-family summary ─────────────────────────────────────────
  console.log(`\n  Per-family summary:`);
  for (const fam of ['Dynamical', 'Motor', 'Process', 'Semantic']) {
    const famAll = allResults.filter(r => r.signal.family === fam);
    const famPass = famAll.filter(r => r.passesThreshold);
    console.log(`    ${pad(fam, 12)} ${famPass.length}/${famAll.length} reliable`);
  }

  console.log(`\n${'═'.repeat(80)}\n`);

  await sql.end();
}

// Only invoke main() when run directly. When imported by tests for the
// exported helpers, main() must not run — its sql.end() would close the
// shared connection pool and break unrelated test queries.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
