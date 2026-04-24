/**
 * Semantic Baseline Engine (Phase 2)
 *
 * Self-referencing longitudinal baselines for seven semantic signals:
 *   1. idea_density
 *   2. lexical_sophistication
 *   3. epistemic_stance
 *   4. integrative_complexity
 *   5. deep_cohesion
 *   6. text_compression_ratio
 *   7. referential_cohesion (added beyond the original six-signal spec;
 *      content-word overlap measure with within-person stability properties
 *      relevant to longitudinal trajectory; already computed and stored in
 *      tb_semantic_signals at the time of inclusion)
 *
 * Classification of these signals as trait-like or state-like is deferred
 * pending empirical within-person ICC validation. See METHODS_PROVENANCE.md
 * "Deferred for Data Depth" DEF-002.
 *
 * The reconstruction adversary (ghost) is the correct null model for motor
 * and dynamical signals. It is the WRONG null model for semantic signals:
 * Markov/PPM word salad vs coherent text produces a trivially explained
 * residual with no discriminative information across sessions.
 *
 * The correct null for semantic measurement is within-person history:
 * "how does this session compare to this person's own distribution?"
 *
 * Architecture:
 *   1. Running distribution (Welford's online algorithm) per signal in
 *      tb_semantic_baselines. Updated incrementally after each session.
 *   2. Global z-score: session value vs all-time personal mean/variance.
 *   3. Topic-matched z-score: session value vs mean/variance of the k
 *      most similar prior sessions (HNSW on tb_embeddings).
 *   4. Minimum-n gating: z-scores below threshold are stored but flagged
 *      as unreliable. The instrument refuses to produce a trajectory
 *      claim until the baseline is stable.
 *
 * Trajectory analysis (change-point detection) over the z-score series is
 * deferred pending data depth. See METHODS_PROVENANCE.md "Deferred for
 * Data Depth" DEF-001.
 *
 * Baseline model sophistication (EWMA, seasonal decomposition) is deferred
 * pending evidence that stationary baselines are insufficient. See
 * METHODS_PROVENANCE.md "Deferred for Data Depth" DEF-003.
 *
 * References:
 *   Welford (1962) - online variance algorithm
 *   Snowdon et al. (1996) - idea density longitudinal validity
 *   Pakhomov et al. (2013) - within-person propositional density stability
 */

import sql, { getSemanticSignals } from './libDb.ts';
import { logError } from './utlErrorLog.ts';

// ─── Constants ─────────────────────────────────────────────────────

/** Semantic signals tracked for longitudinal baselines. */
const BASELINE_SIGNALS = [
  'idea_density',
  'lexical_sophistication',
  'epistemic_stance',
  'integrative_complexity',
  'deep_cohesion',
  'text_compression_ratio',
  'referential_cohesion',
] as const;

type BaselineSignal = typeof BASELINE_SIGNALS[number];

/**
 * Minimum sessions before a z-score is considered reliable.
 * Below this, the z-score is stored but gated = true.
 * Informed by Pakhomov et al.: within-person variance stabilizes
 * around 10-15 samples for propositional density. We use 10 as a
 * conservative lower bound.
 */
const MINIMUM_N = 10;

/** Number of topic-matched prior sessions to retrieve for topic z-scores. */
const TOPIC_MATCH_K = 10;

// ─── Welford's Online Algorithm ────────────────────────────────────

interface WelfordState {
  mean: number;
  m2: number;
  n: number;
}

function welfordUpdate(state: WelfordState, value: number): WelfordState {
  const n = state.n + 1;
  const delta = value - state.mean;
  const mean = state.mean + delta / n;
  const delta2 = value - mean;
  const m2 = state.m2 + delta * delta2;
  return { mean, m2, n };
}

function welfordVariance(state: WelfordState): number | null {
  if (state.n < 2) return null;
  return state.m2 / (state.n - 1);
}

function welfordStdDev(state: WelfordState): number | null {
  const v = welfordVariance(state);
  if (v == null) return null;
  return Math.sqrt(v);
}

function zScore(value: number, mean: number, stdDev: number): number | null {
  if (stdDev === 0) return null;
  return (value - mean) / stdDev;
}

// ─── Database Operations ───────────────────────────────────────────

async function getBaseline(signalName: string): Promise<WelfordState & { lastQuestionId: number | null }> {
  const rows = await sql`
    SELECT running_mean, running_m2, session_count, last_question_id
    FROM tb_semantic_baselines
    WHERE signal_name = ${signalName}
  `;
  const row = rows[0] as { running_mean: number; running_m2: number; session_count: number; last_question_id: number | null } | undefined;
  if (!row) return { mean: 0, m2: 0, n: 0, lastQuestionId: null };
  return { mean: row.running_mean, m2: row.running_m2, n: row.session_count, lastQuestionId: row.last_question_id };
}

async function upsertBaseline(signalName: string, state: WelfordState, questionId: number): Promise<void> {
  await sql`
    INSERT INTO tb_semantic_baselines (signal_name, running_mean, running_m2, session_count, last_question_id, dttm_modified_utc, modified_by)
    VALUES (${signalName}, ${state.mean}, ${state.m2}, ${state.n}, ${questionId}, CURRENT_TIMESTAMP, 'system')
    ON CONFLICT (signal_name) DO UPDATE SET
      running_mean = ${state.mean},
      running_m2 = ${state.m2},
      session_count = ${state.n},
      last_question_id = ${questionId},
      dttm_modified_utc = CURRENT_TIMESTAMP,
      modified_by = 'system'
  `;
}

async function saveTrajectoryPoint(
  questionId: number,
  signalName: string,
  rawValue: number | null,
  globalZ: number | null,
  topicZ: number | null,
  topicMatchCount: number | null,
  baselineN: number,
  gated: boolean,
): Promise<void> {
  await sql`
    INSERT INTO tb_semantic_trajectory (
      question_id, signal_name, raw_value, global_z_score, topic_z_score,
      topic_match_count, baseline_n, gated
    ) VALUES (
      ${questionId}, ${signalName}, ${rawValue}, ${globalZ}, ${topicZ},
      ${topicMatchCount}, ${baselineN}, ${gated}
    )
    ON CONFLICT (question_id, signal_name) DO NOTHING
  `;
}

// ─── Topic-Matched Retrieval ───────────────────────────────────────

/**
 * Find the k most semantically similar prior sessions via HNSW index,
 * excluding the current session, and return their semantic signal values
 * for a given signal.
 */
async function getTopicMatchedValues(
  questionId: number,
  signalName: string,
  k: number,
): Promise<{ values: number[]; matchCount: number }> {
  // Get current session's embedding (exclude invalidated rows from prior model versions)
  const embRows = await sql`
    SELECT e.embedding
    FROM tb_embeddings e
    JOIN tb_responses r ON e.source_record_id = r.response_id
    WHERE e.embedding_source_id = 1
      AND r.question_id = ${questionId}
      AND e.embedding IS NOT NULL
      AND e.invalidated_at IS NULL
  `;

  if (embRows.length === 0) return { values: [], matchCount: 0 };

  const embedding = (embRows[0] as { embedding: string }).embedding;

  // Find k nearest prior journal sessions (excluding current and calibrations)
  const matches = await sql`
    SELECT ss.${sql(signalName)} AS signal_value
    FROM tb_embeddings e
    JOIN tb_responses r ON e.source_record_id = r.response_id
    JOIN tb_questions q ON r.question_id = q.question_id
    JOIN tb_semantic_signals ss ON r.question_id = ss.question_id
    WHERE e.embedding_source_id = 1
      AND e.embedding IS NOT NULL
      AND e.invalidated_at IS NULL
      AND r.question_id != ${questionId}
      AND q.question_source_id != 3
      AND ss.${sql(signalName)} IS NOT NULL
    ORDER BY e.embedding <-> ${embedding}::vector
    LIMIT ${k}
  ` as Array<{ signal_value: number }>;

  return {
    values: matches.map(m => m.signal_value),
    matchCount: matches.length,
  };
}

/**
 * Compute mean and stddev from an array of values.
 */
function distributionStats(values: number[]): { mean: number; stdDev: number } | null {
  if (values.length < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return { mean, stdDev: Math.sqrt(variance) };
}

// ─── Main Entry Point ──────────────────────────────────────────────

/**
 * Update semantic baselines and compute trajectory z-scores for a session.
 *
 * Called AFTER semantic signals are saved in the signal pipeline.
 * Idempotent: skips signals already present in tb_semantic_trajectory.
 */
export async function updateSemanticBaselines(questionId: number): Promise<void> {
  // Calibration sessions (question_source_id = 3) are prompted neutral writing,
  // fundamentally different from reflective journal sessions. Including them
  // would shift the within-person baseline mean and inflate variance.
  const sourceRows = await sql`
    SELECT question_source_id FROM tb_questions WHERE question_id = ${questionId}
  `;
  if (sourceRows.length === 0) return;
  if ((sourceRows[0] as { question_source_id: number }).question_source_id === 3) return;

  const sem = await getSemanticSignals(questionId);
  if (!sem) return;

  // Sessions with external input contamination (paste or drag-and-drop) should
  // not shift the within-person baseline. The text may not be the person's own
  // unmediated output, and including it would compromise the baseline's validity
  // as a self-referencing cognitive measurement.
  if (sem.paste_contaminated) return;

  const signalValues: Record<BaselineSignal, number | null> = {
    idea_density: sem.idea_density ?? null,
    lexical_sophistication: sem.lexical_sophistication ?? null,
    epistemic_stance: sem.epistemic_stance ?? null,
    integrative_complexity: sem.integrative_complexity ?? null,
    deep_cohesion: sem.deep_cohesion ?? null,
    text_compression_ratio: sem.text_compression_ratio ?? null,
    referential_cohesion: sem.referential_cohesion ?? null,
  };

  for (const signalName of BASELINE_SIGNALS) {
    const value = signalValues[signalName];
    if (value == null) continue;

    try {
      // Check idempotency
      const existing = await sql`
        SELECT 1 FROM tb_semantic_trajectory
        WHERE question_id = ${questionId} AND signal_name = ${signalName}
      `;
      if (existing.length > 0) continue;

      // Load current baseline state
      const baseline = await getBaseline(signalName);

      // Guard against processing the same question twice
      if (baseline.lastQuestionId === questionId) continue;

      // Compute global z-score BEFORE updating the baseline (compare against prior distribution)
      let globalZ: number | null = null;
      const stdDev = welfordStdDev(baseline);
      if (stdDev != null) {
        globalZ = zScore(value, baseline.mean, stdDev);
      }

      // Topic-matched z-score
      let topicZ: number | null = null;
      let topicMatchCount: number | null = null;
      try {
        const matched = await getTopicMatchedValues(questionId, signalName, TOPIC_MATCH_K);
        topicMatchCount = matched.matchCount;
        if (matched.values.length >= 3) {
          const stats = distributionStats(matched.values);
          if (stats) {
            topicZ = zScore(value, stats.mean, stats.stdDev);
          }
        }
      } catch (err) {
        logError('semantic-baseline.topic-match', err, { questionId, signalName });
      }

      // Gate: is the baseline deep enough for reliable z-scores?
      const gated = baseline.n < MINIMUM_N;

      // Save trajectory point
      await saveTrajectoryPoint(
        questionId, signalName, value,
        globalZ, topicZ, topicMatchCount,
        baseline.n, gated,
      );

      // Update baseline with new value (Welford's step)
      const updated = welfordUpdate(baseline, value);
      await upsertBaseline(signalName, updated, questionId);
    } catch (err) {
      logError('semantic-baseline.update', err, { questionId, signalName });
    }
  }
}
