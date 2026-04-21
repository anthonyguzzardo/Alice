# Handoff: The Ghost (2026-04-20, Sessions 3-6)

## What happened

Sessions 3-4 built the reconstruction residual pipeline, backfilled 20 sessions, built the Ghost observatory page, and wired live metadata into the research page. Sessions 5-6 (this session) completed the full ghost handoff: adaptive difficulty logging, coupling stability analysis, profile-based mediation detection, Rust migration of numerical cores, and revision of the Reconstruction Validity paper with empirical results.

The ghost handoff is complete. The instrument now validates itself, detects anomalous sessions, and tracks whether emotion-behavior coupling is stable. The Reconstruction Validity paper (v3) reports the first empirical results, including a falsified prediction that turned out to be the strongest finding.

## What was built (Sessions 5-6)

### Migration 007: difficulty tracking on prompt traces
- Added `difficulty_level TEXT` and `difficulty_inputs JSONB` to `tb_prompt_traces`
- Schema file updated, `PromptTraceInput` type updated, `savePromptTrace` writes both fields
- `libGenerate.ts` now passes computed difficulty level (`high`/`moderate`/`low`) and raw inputs (`avgMATTR`, `avgCogDensity`) to every generation trace
- Raw inputs are the durable asset; the difficulty label may change as the classifier evolves

### Migration 008: session integrity
- Created `tb_session_integrity` table: per-session profile distance, z-score vector, flag, threshold
- 12 motor/process dimensions scored: IKI mean, hold time, flight time, ex-Gaussian mu/sigma/tau, burst count/length, session duration, word count, first keystroke, MATTR
- z-score vector persisted as JSONB (raw inputs alongside the label)

### Difficulty-residual correlation
- **API**: `src/pages/api/observatory/difficulty.ts` -- joins prompt traces with reconstruction residuals via date (generation on day N, question scheduled for day N+1)
- **Ghost page**: new "Adaptive difficulty" section with grouped dot plot (L2 by difficulty level) and MATTR scatter
- Shows "awaiting data" until next question generation runs (first to log difficulty)

### Emotion-behavior coupling stability
- **Lib**: `src/lib/libCouplingStability.ts` -- rolling-window stability analysis computed directly from raw data (not dependent on empty `tb_emotion_behavior_coupling` table)
- Tests windows from n=10 to current entry count in steps of 2
- For each (emotion_dim, behavior_dim) pair: tracks correlation trajectory, computes CV, classifies as stable (CV < 0.5) or unstable
- **API**: `src/pages/api/observatory/coupling-stability.ts`
- **Coupling page**: new "Coupling stability" section with convergence chart (|r| over growing window), KPI strip (entries, windows, stable/total pairs, rate), and stable/unstable pair tables with CV and trend slope

### Profile-based mediation detection
- **Lib**: `src/lib/libIntegrity.ts` -- loads personal profile, computes z-scores against session summary + motor signals, returns L2 distance
- Runs in signal pipeline BEFORE `updateProfile()` so it compares against the prior profile state
- Dynamic threshold: mean + 2*std of historical distances, floor at sqrt(dimension_count)
- **API**: `src/pages/api/observatory/integrity.ts` -- per-session distances, most deviant dimensions, flagged sessions
- **Observatory overview**: new integrity panel with distance trajectory sparkline, dimension summary table, flagged sessions table
- **Backfill**: `src/scripts/backfill-integrity.ts` -- 54 sessions scored, 10 flagged

### Rust migration of numerical cores
- **stats.rs**: added `pearson()`, `z_scores_and_distance()`, `best_lagged_correlation()` with 8 new tests (115 total pass)
- **lib.rs**: added `compute_profile_distance` and `compute_batch_correlations` napi entry points
- **libSignalsNative.ts**: exposed `computeProfileDistance()` and `computeBatchCorrelations()` with TS fallback
- **libIntegrity.ts**: uses Rust for z-scores/distance, falls back to TS if engine unavailable
- **libCouplingStability.ts**: uses Rust batch for all ~1400 correlations (9 emotion x 7 behavior x ~20 windows) in one FFI call, falls back to TS

### Research page update
- Motor residual prediction text updated from "Expected: small" to "Expected: small. Measured: largest family." with explanation that the prediction was falsified

### Reconstruction Validity paper revision (v2 to v3)
- **Abstract**: added empirical results summary
- **Section 6**: renamed "Predictions and Results", updated from 8 to 54 sessions, each prediction preserved with result alongside. Motor prediction explicitly marked **Falsified**.
- **Section 6.3**: new findings (journal vs calibration gap, two-scale perplexity)
- **Section 6.4**: dimensional validity profile summary
- **Section 7**: each residual type updated with measured values. Key reframing: cognitive residual lives in the motor channel ("Condrey's result concerns timing *distributions*. The instrument measures timing *sequences*.")
- **Section 9**: corpus size updated, difficulty-correlation flagged as pending
- **Section 10**: 10.1 and 10.2 marked completed, new 10.2a (adaptive difficulty, in progress) and 10.2b (mediation detection, completed)
- **Section 11**: rewritten to lead with falsification as strongest evidence

## Key findings from the data

**Motor execution is irreducible.** The ghost draws from the same ex-Gaussian and digraph distributions the instrument fits. Motor L2 = 90.0 (mean), range 46-144. Dynamical L2 < 1.3, semantic L2 < 0.35. The ghost types from the right distributions in the wrong sequences.

**The person is more internally consistent than their profile predicts.** Real perplexity always lower than ghost (21.3 vs 78.5 avg). The Markov model overgenerates.

**Cognitive contribution scales with question type.** Journal avg L2 = 59.6, calibration avg L2 = 51.1. Harder questions widen the gap.

**Two-scale divergence.** Markov perplexity avg = 21.3, trigram avg = 9.0, ratio ~2.4x. More predictable at character level than word level.

**TE dominance stability.** Mean residual = 0.350, CV = 3.08. Not yet stable. Needs more sessions.

**Session integrity baseline.** 54 sessions scored, 10 flagged (18.5%). Distances range 0.89 to 43.82. The distribution establishes the baseline for real-time detection.

## Files created (Sessions 5-6)

| File | What |
|------|------|
| `db/sql/migrations/007_add_difficulty_to_prompt_traces.sql` | Difficulty columns on prompt traces |
| `db/sql/migrations/008_add_session_integrity.sql` | Session integrity table |
| `src/lib/libCouplingStability.ts` | Rolling-window coupling stability analysis |
| `src/lib/libIntegrity.ts` | Profile-based mediation detection |
| `src/scripts/backfill-integrity.ts` | Backfill integrity scores for all sessions |
| `src/pages/api/observatory/difficulty.ts` | Difficulty-residual correlation API |
| `src/pages/api/observatory/coupling-stability.ts` | Coupling stability API |
| `src/pages/api/observatory/integrity.ts` | Session integrity API |

## Files modified (Sessions 5-6)

| File | Change |
|------|--------|
| `db/sql/dbAlice_Tables.sql` | Added difficulty columns to `tb_prompt_traces`, added `tb_session_integrity` |
| `src/lib/libDb.ts` | Added `difficultyLevel`/`difficultyInputs` to `PromptTraceInput` and INSERT; added `saveSessionIntegrity`/`getSessionIntegrity` |
| `src/lib/libGenerate.ts` | Passes difficulty level + raw inputs to `savePromptTrace` |
| `src/lib/libSignalPipeline.ts` | Added integrity check before `updateProfile()` |
| `src/lib/libSignalsNative.ts` | Exposed `computeProfileDistance()` and `computeBatchCorrelations()` |
| `src-rs/src/stats.rs` | Added `pearson()`, `z_scores_and_distance()`, `best_lagged_correlation()` + 8 tests |
| `src-rs/src/lib.rs` | Added `compute_profile_distance` and `compute_batch_correlations` napi functions |
| `src/pages/observatory/ghost.astro` | Added difficulty section (grouped dots + MATTR scatter) |
| `src/pages/observatory/coupling.astro` | Added coupling stability section (convergence chart + tables) |
| `src/pages/observatory/index.astro` | Added integrity panel (distance trajectory + flagged sessions) |
| `src/pages/research.astro` | Updated motor residual prediction text |
| `papers/option_f_draft.md` | Revision v2 to v3 (empirical results, falsified prediction, updated research program) |

## What's next

### Difficulty-residual correlation (data accumulating)
Difficulty classification began at session 54. Each future question generation will log the difficulty level and raw inputs. Once enough data accumulates (10+ generated questions with reconstruction residuals), the correlation between difficulty and motor residual magnitude will be testable. If harder questions produce larger motor residuals, the residual is confirmed as cognitive. This closes the loop on the paper's central claim.

### TE dominance stability (monitoring)
CV = 3.08 at 20 sessions. Not yet stable enough for a "consistent within-person" claim. More sessions will clarify whether this stabilizes or remains noisy.

### Condrey attack (from paper Section 10.3)
Transcription protocol: same user transcribes LLM-generated text under the journaling interface. Direct empirical test of whether the instrument detects content-process binding. The reconstruction residual provides the measurement; the Condrey attack provides the adversary.

### The Quiet Debt (paper draft)
Active draft on cognitive reserve and AI offloading. Independent of the reconstruction validity revision but shares the same instrument.

## Architecture reference

```
src/lib/libReconstruction.ts           -- ghost generation + signal comparison + L2 norm
src/lib/libSignalsNative.ts            -- napi boundary (all Rust FFI calls)
src/lib/libSignalPipeline.ts           -- orchestrates all derived signals per session
src/lib/libIntegrity.ts                -- profile distance computation (uses Rust)
src/lib/libCouplingStability.ts        -- rolling-window coupling stability (uses Rust)
src/lib/libProfile.ts                  -- rolling behavioral profile
src/lib/libDb.ts                       -- all database functions
src/lib/libGenerate.ts                 -- question generation with difficulty logging
src/scripts/backfill-integrity.ts      -- backfill integrity scores
src/scripts/backfill-reconstruction.ts -- backfill reconstruction residuals
src/pages/observatory/ghost.astro      -- Ghost in the Shell page + difficulty panel
src/pages/observatory/coupling.astro   -- Coupling page + stability panel
src/pages/observatory/index.astro      -- Overview + integrity panel
src/pages/api/observatory/ghost.ts     -- ghost data API
src/pages/api/observatory/difficulty.ts     -- difficulty correlation API
src/pages/api/observatory/coupling-stability.ts -- coupling stability API
src/pages/api/observatory/integrity.ts      -- integrity API
src/pages/api/instrument-status.ts     -- research page metadata API
src-rs/src/stats.rs                    -- Rust stats (pearson, z-scores, linreg, etc.)
src-rs/src/lib.rs                      -- napi boundary (profile distance, batch correlations)
src-rs/src/avatar.rs                   -- Markov chain + timing synthesis
src-rs/src/dynamical.rs                -- PE, DFA, RQA, transfer entropy
src-rs/src/motor.rs                    -- sample entropy, ex-Gaussian, motor jerk, etc.
src-rs/src/process.rs                  -- text reconstruction, pause/burst analysis
db/sql/migrations/005                  -- tb_reconstruction_residuals
db/sql/migrations/006                  -- question_source_id column
db/sql/migrations/007                  -- difficulty columns on prompt traces
db/sql/migrations/008                  -- tb_session_integrity
papers/option_f_draft.md               -- Reconstruction Validity paper (v3)
```

## Key design decisions

- **Non-finite L2 exclusion**: Infinity TE dominance from avatar is an honest measurement failure. Aggregate norms exclude it. Per-signal residuals preserve the raw value.
- **Two-scale perplexity**: trigram (character-level, cross-session) and Markov (word-level, reconstruction) are independent measures. Their ratio characterizes the scale at which the person's writing is predictable.
- **Tautology guard**: Never frame a ghost comparison as a finding when the ghost is decoupled on that dimension by construction. Establish within-person stability of the real signal first.
- **Raw input logging**: When adding classifiers, always log the raw signal inputs alongside the label. The inputs are the durable asset.
- **Integrity before profile update**: Session integrity runs before `updateProfile()` so the comparison is against the prior profile state, not a profile that includes the current session.
- **Rust for numerical cores**: z-score distance, Pearson correlation, and batch lagged correlations moved to Rust. TS fallback preserved if native engine unavailable. Single source of truth for signal math.
- **Distributions vs sequences**: The motor residual falsification reveals that distributional equivalence (same IKI distribution, same ex-Gaussian parameters) is not behavioral equivalence. Motor signals are sensitive to the sequence of intervals, not just their distribution. This is the distinction between what Condrey attacked and what the instrument measures.
