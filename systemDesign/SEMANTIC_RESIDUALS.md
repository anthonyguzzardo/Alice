# Semantic Residuals

The semantic channel measures what you said, not how you typed it. Seven text-level signals computed from final response text, tracked against your own longitudinal distribution, with topic-matched controls via embedding similarity.

The ghost is the wrong null model for these signals. This document explains why, and what replaces it.

## The Two-Null-Model Problem

The ghost (reconstruction adversary) is the correct null model for motor and dynamical signals. It reconstructs your typing behavior from statistical aggregates. The residual between real and ghost isolates what statistics cannot reproduce. That residual is cognitive.

For semantic signals, the ghost is useless. A Markov/PPM chain produces word salad. Comparing "coherent journal entry" to "statistically plausible gibberish" on idea density or integrative complexity tells you exactly one thing: coherent text is more coherent than gibberish. This is trivially true and constant across sessions. The residual has no discriminative information.

The correct null for semantic measurement is within-person history: how does this session compare to this person's own distribution? A high idea density relative to your own baseline is informative. A high idea density relative to a Markov chain is not.

This means Alice has two measurement paradigms running in parallel:

| Domain | Null Model | Residual Meaning | Reported |
|--------|-----------|-----------------|----------|
| Behavioral (dynamical + motor + perplexity) | Ghost reconstruction | What statistics cannot reproduce | Paper-reported (`behavioral_l2_norm`) |
| Semantic (7 text signals) | Within-person longitudinal baseline | How this session deviates from personal history | Stored, Phase 2 (`semantic_l2_norm`) |

The ghost still computes semantic signals on its generated text. These are stored in `tb_reconstruction_residuals` for completeness and future analysis. But `behavioral_l2_norm` explicitly excludes them. The paper reports the behavioral aggregate. The semantic channel has its own measurement system.

## The Seven Signals

All computed deterministically from final response text in `libSemanticSignals.ts`. No LLM, no external API. Word lists and information-theoretic measures.

| Signal | Citation | What It Measures |
|--------|----------|-----------------|
| Idea density | Snowdon et al. 1996 (Nun Study) | Propositions per word. Predicted Alzheimer's 58 years in advance. |
| Lexical sophistication | Kyle & Crossley 2017 (TAALES) | Proportion of content words outside the top-2000 frequency list. |
| Epistemic stance | Hyland 2005 | Booster / (booster + hedge) ratio. Certainty vs hedging. |
| Integrative complexity | Suedfeld & Tetlock | Contrastive + integrative connective density per sentence. |
| Deep cohesion | McNamara et al. (Coh-Metrix) | Causal + temporal + intentional connective density. |
| Referential cohesion | Coh-Metrix | Content word overlap between adjacent sentences. |
| Text compression ratio | Kolmogorov complexity proxy | gzip compressed / raw byte length. Information density. |

Emotional valence arc (Reagan et al. 2016) is computed and stored alongside these but is not baselined. It is a categorical shape descriptor (ascending, descending, vee, peak, flat), not a continuous signal suitable for z-score tracking.

### Minimum input gates

- Idea density, epistemic stance, deep cohesion: 10+ words
- Lexical sophistication: 5+ content words
- Integrative complexity: 2+ sentences
- Referential cohesion: 2+ sentences
- Text compression ratio: 50+ characters
- Emotional valence arc: 3+ sentences

Below these thresholds, the signal returns null. A null signal does not update the baseline.

## Architecture

Three storage layers, each with a distinct purpose:

```
tb_semantic_signals      Raw signal values per session (the measurements)
        |
        v
tb_semantic_baselines    Running Welford distribution per signal (the reference)
        |
        v
tb_semantic_trajectory   Per-session z-scores against the reference (the trajectory)
```

### Layer 1: Raw signals (`tb_semantic_signals`)

One row per session. Seven continuous columns plus metadata (lexicon version, paste contamination flag, emotional valence arc string). The source of truth for what was measured. Stored for both journal and calibration sessions (the exclusion happens downstream).

Unique constraint on `question_id`. Idempotent writes via the signal pipeline.

### Layer 2: Running baselines (`tb_semantic_baselines`)

Seven rows total, one per signal. Each row holds a Welford online running distribution: `running_mean`, `running_m2` (sum of squared deviations), `session_count`. Updated incrementally after each non-calibration session.

Welford's algorithm (1962) computes exact running mean and variance in O(1) space per signal. No need to store or re-read the full history. The update is:

```
delta  = value - mean
mean'  = mean + delta / n
delta2 = value - mean'
m2'    = m2 + delta * delta2
```

Variance = m2 / n. Standard deviation = sqrt(variance). Requires n >= 2 for a meaningful variance.

`last_question_id` prevents double-processing the same session. Upserts on `signal_name`.

### Layer 3: Trajectory z-scores (`tb_semantic_trajectory`)

Seven rows per session (one per signal). Each row stores:

- `raw_value`: the original signal measurement
- `global_z_score`: z = (value - baseline_mean) / baseline_stddev, computed BEFORE the baseline is updated with this session's value (so the score measures deviation from the prior distribution, not one contaminated by the current observation)
- `topic_z_score`: z against the k=10 most semantically similar prior sessions (via HNSW embedding lookup)
- `topic_match_count`: how many neighbors were found (may be < k for sparse corpora)
- `baseline_n`: the baseline depth at computation time
- `gated`: true if baseline_n < MINIMUM_N (10), meaning the z-score is unreliable

Unique constraint on `(question_id, signal_name)`. Idempotent via `ON CONFLICT DO NOTHING`.

## Data Flow

### Per-session (triggered by response submission)

```
POST /api/respond
  |
  v
Signal pipeline (libSignalPipeline.ts)
  |
  |-- Dynamical signals (Rust)  -> tb_dynamical_signals
  |-- Motor signals (Rust)      -> tb_motor_signals
  |-- Semantic signals (TS)     -> tb_semantic_signals          <-- Layer 1
  |-- Process signals (Rust)    -> tb_process_signals
  |-- Cross-session signals     -> tb_cross_session_signals
  |
  |-- updateSemanticBaselines(questionId)                       <-- Layers 2+3
  |     |
  |     |  For each of 7 signals:
  |     |    1. Load current Welford state from tb_semantic_baselines
  |     |    2. Check idempotency (trajectory point already exists?)
  |     |    3. Compute global z-score BEFORE updating baseline
  |     |    4. Query HNSW index for k=10 nearest prior sessions
  |     |    5. Compute topic-matched z-score from neighbor distribution
  |     |    6. Gate: is baseline_n < 10?
  |     |    7. Save trajectory point to tb_semantic_trajectory
  |     |    8. Update baseline with Welford step
  |     v
  |
  |-- Profile update             -> tb_personal_profile
  |-- Reconstruction residual    -> tb_reconstruction_residuals
  |     (ghost semantic signals computed and stored here,
  |      but excluded from behavioral_l2_norm)
  |
  |-- [fire-and-forget] embedResponse()  -> tb_embeddings
```

### Ordering constraint

Semantic baselines run AFTER semantic signals are saved. The baseline update reads from `tb_semantic_signals` via `getSemanticSignals(questionId)`. If semantic signal computation fails or produces all nulls, the baseline update exits early with no side effects.

Embedding happens fire-and-forget AFTER the transaction. On the first session where TEI is available, the embedding may not exist yet when the baseline update runs. In this case, the topic-matched z-score returns zero matches and `topic_z_score` is null. The global z-score is still computed. The trajectory point is still saved. On backfill, the embedding exists and the topic z-score can be recomputed.

### Calibration exclusion

Calibration sessions (question_source_id = 3) are excluded from the semantic baseline system at two points:

1. **Embedding pipeline**: `getUnembeddedResponses()` filters `WHERE q.question_source_id != 3`. Calibration responses are never embedded. They cannot appear as HNSW neighbors.

2. **Baseline backfill**: `backfill-semantic-baselines.ts` filters `WHERE q.question_source_id != 3`. Only organic (seed + generated) sessions feed the Welford distribution.

The signal pipeline itself does not filter. `computeSemanticSignals()` runs on calibration text and saves to `tb_semantic_signals`. The raw measurements exist. They are excluded from the baseline distribution because prompted text does not represent organic within-person trajectory.

Calibration semantic signals are used in reconstruction residuals (the ghost comparison). They contribute to `semantic_l2_norm` in `tb_reconstruction_residuals`. This is consistent: the ghost comparison runs on all sessions, but the self-referencing baseline only tracks organic ones.

## Topic-Matched Z-Scores

The global z-score answers: "how does this session compare to all your prior sessions?" The topic z-score answers: "how does this session compare to sessions where you wrote about similar things?"

Topic matching is the reason the embedding pipeline exists. Without it, a session about grief and a session about music would be compared against the same baseline. A low idea density on a grief entry might be normal for grief entries but would appear as a deviation against the global mean. The topic z-score corrects for this by comparing against the 10 most similar prior sessions.

### How it works

1. Look up the current session's embedding in `tb_embeddings` (must be active, not invalidated).
2. Query the HNSW index for the k=10 nearest embeddings, excluding the current session.
3. Join against `tb_semantic_signals` to get the signal value for each neighbor.
4. Compute mean and stddev of the neighbor distribution (requires >= 3 neighbors).
5. z = (current_value - neighbor_mean) / neighbor_stddev.

If the current session has no embedding (TEI was down), or fewer than 3 neighbors exist, `topic_z_score` is null. The trajectory point still saves with global z-score only.

### Embedding model dependency

Topic z-scores depend on embedding quality. When the embedding model changes (e.g., voyage-3-lite to Qwen3-Embedding-0.6B), all prior embeddings are soft-invalidated (`invalidated_at` set), new embeddings are generated, and semantic baselines must be regenerated from scratch via `backfill-semantic-baselines.ts`.

This is why the embedding model migration (INC-010 in METHODS_PROVENANCE.md) deleted 185 stale trajectory rows and recomputed 48 new ones. The topic z-scores from the old model are not comparable to topic z-scores from the new model because the similarity metric changed.

## Gating

A z-score computed from a 3-session baseline is not the same statistical claim as one computed from a 30-session baseline. The `gated` column makes this explicit.

- `gated = true`: baseline_n < MINIMUM_N (10). The z-score is stored but should not be consumed by any analytical system (drift detection, visualization, trend analysis).
- `gated = false`: baseline_n >= 10. The z-score is reliable enough for downstream use.

The threshold of 10 is informed by Pakhomov et al. (2013): within-person variance for propositional density stabilizes around 10-15 observations. 10 is a conservative lower bound.

Current state (as of 2026-04-23): all 48 trajectory rows are gated (baseline_n < 10). No semantic z-score is yet reliable. This is the system working as designed. The instrument refuses to produce a trajectory claim until the baseline is stable.

## What Is Deferred

Three components are explicitly deferred pending data depth. Each is documented in METHODS_PROVENANCE.md under "Deferred for Data Depth."

### DEF-001: Drift detection

Change-point detection (CUSUM, Bayesian online) on the z-score series. Requires ~300+ sessions per signal (approximately one year of daily use). At current depth, change-point analysis produces artifacts indistinguishable from false positives.

### DEF-002: Trait vs state classification

Empirical within-person ICC to classify each signal as trait-like (stable, useful for trajectory) or state-like (context-dependent). Requires 3-6 months of data. Population-level ICC from literature is not transferable to within-person measurement (Simpson's paradox).

### DEF-003: Baseline model sophistication

EWMA, seasonal decomposition, regime-switching alternatives to Welford. Requires 1-2 years to evaluate whether stationarity holds. Welford is mathematically correct and sufficient until evidence says otherwise.

## Relationship to Ghost Residuals

The ghost computes semantic signals on its generated text. These flow into `tb_reconstruction_residuals` as:

- `real_idea_density`, `avatar_idea_density`, `residual_idea_density` (and so on for all 6 continuous signals)
- `semantic_l2_norm`: L2 of the 6 semantic residuals

These values are stored. They are NOT included in `behavioral_l2_norm` (the paper-reported aggregate). They are NOT used for longitudinal tracking. They exist for two reasons:

1. **Completeness**: the residual table captures every signal family the pipeline computes.
2. **Future analysis**: if a more sophisticated text generator replaces the Markov/PPM chain (one that produces coherent text without external knowledge), the semantic residuals become meaningful. The data is there when the method is ready.

The norm partition is:

```
behavioral_l2_norm = L2(dynamical residuals, motor residuals, perplexity residual)
semantic_l2_norm   = L2(semantic residuals)
total_l2_norm      = L2(all residuals)     -- backward compat, not paper-reported
```

`behavioral_l2_norm` is the single number that summarizes reconstruction validity. It is what the observatory displays and what the paper reports.

## Files

| File | Role |
|------|------|
| `src/lib/libSemanticSignals.ts` | Computes 7 signals from response text. Pure functions, no I/O. |
| `src/lib/libSemanticBaseline.ts` | Welford engine, topic matching, trajectory persistence. Main entry: `updateSemanticBaselines()`. |
| `src/lib/libSignalPipeline.ts` | Orchestrates all signal families. Calls semantic signals then baselines in sequence. |
| `src/lib/libReconstruction.ts` | Ghost semantic residuals (stored, not paper-reported). |
| `src/lib/libEmbeddings.ts` | Embedding generation (TEI + Qwen3). Feeds topic-matched retrieval. |
| `src/lib/libDb.ts` | `saveSemanticSignals`, `getSemanticSignals`, `searchVecEmbeddings`, `getActiveEmbeddingModelVersionId`, `isRecordEmbedded`, `getUnembeddedResponses` |
| `src/scripts/backfill-semantic-baselines.ts` | Full baseline regeneration. Deletes trajectory, resets baselines, replays chronologically. |
| `db/sql/dbAlice_Tables.sql` | Schema for `tb_semantic_signals`, `tb_semantic_baselines`, `tb_semantic_trajectory`, `tb_embeddings` |
| `db/sql/migrations/013_semantic_baselines.sql` | Creates baseline and trajectory tables |
| `db/sql/migrations/014_embedding_model_versions.sql` | Model versioning, invalidation, Qwen registration |

## The Sentence

The ghost measures what you cannot fake. The baseline measures what you cannot repeat. Both are the instrument. Neither is complete without the other.
