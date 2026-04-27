# Methods Provenance Log

Running record of correctness issues in the signal engine: what was wrong, how it was found, what it affected, and how it was resolved. Each entry is evidence for the methods section, not just a changelog.

The test: could a reviewer read this entry and independently verify every claim? If not, the entry doesn't belong here.

Newest first.

---

## INC-016: Alice Negative state/dynamics/coupling tables archived (consumer-side scrub)

**Date:** 2026-04-27
**Type:** Architectural correction (orphan consumer surfaces left displaying frozen data after producer was deleted)

### What was wrong

INC-014 deleted the Alice Negative producer pipeline (`renderWitnessState` and the `libAliceNegative/*` modules). It did not delete the consumer surfaces: six observatory pages and APIs continued to read from six tables that stopped receiving writes at 2026-04-25 11:58 (the pipeline's last successful run before the scrub). The user opened the entry observatory page expecting their most recent session and got "NO SEMANTIC STATE FOR THIS ENTRY" — a panel that would never populate again because the producer was gone.

The orphan-consumer pattern is the mirror of INC-015's orphan-producer pattern: when a feature is archived, both sides of the producer-consumer edge must be cut in the same commit. INC-014 cut the producer; the consumer side carried frozen-data displays for two days until the user noticed.

Tables affected (all confirmed frozen at 2026-04-25 11:58 via `SELECT max(dttm_created_utc)`):

| Table                          | Last write          | Rows |
|--------------------------------|---------------------|------|
| tb_semantic_states             | 2026-04-25 11:58:33 | 13   |
| tb_semantic_dynamics           | 2026-04-25 11:58:33 | 110  |
| tb_semantic_coupling           | 2026-04-25 11:58:33 | 218  |
| tb_trait_dynamics              | 2026-04-25 11:58:33 | 70   |
| tb_coupling_matrix             | 2026-04-25 11:58:33 | 82   |
| tb_emotion_behavior_coupling   | 2026-04-25 11:58:33 | 194  |

### Discovery method

User report on the observatory entry detail view: a recent entry showed an empty "SEMANTIC 11D" panel with no semantic state. Code search confirmed `saveSemanticState` had zero callers anywhere in `src/`, and `git show c0023bb` showed `libAliceNegative/libRenderWitness.ts` (the only writer) had been deleted in INC-014. A second pass on the four other dimensions of the dead pipeline (semantic dynamics, semantic coupling, trait dynamics, coupling matrix, emotion-behavior coupling) confirmed every save function had zero callers and every table was frozen at the same instant.

### Resolution

**Application code removed (per CLAUDE.md "archival means removal"):**

- `src/pages/api/observatory/coupling.ts` — entire file (read tb_semantic_coupling, tb_semantic_dynamics, tb_coupling_matrix, tb_trait_dynamics, tb_emotion_behavior_coupling)
- `src/pages/api/observatory/synthesis.ts` — entire file (the "Right Now / Sustained Trends / Discoveries" narration generator; read all six dead tables)
- `src/pages/observatory/coupling.astro` — rewritten down to just the live coupling-stability section (still computed via `libCouplingStability` from raw signals, not from frozen tables). Behavioral dynamics, behavioral coupling, semantic dynamics, semantic coupling, and emotion-behavior coupling panels deleted.
- `src/pages/observatory/index.astro` — "Right Now", "Sustained Trends", "Discoveries" panels and their `renderInsights/renderArcs/renderDiscoveries` helpers removed; the `sem-conv` column was dropped from the entries table; the synthesis fetch was removed from the Promise.all.
- `src/pages/observatory/trajectory.astro` — `SEMANTIC_DIMS`, `EMOTION_DIMS`, the two semantic trajectory sections, and the semantic-convergence chart removed.
- `src/pages/observatory/entry/[id].astro` — the Semantic 11D radar panel and `SEMANTIC_DIMS` constant removed (this was the user's original entry point).
- `src/pages/api/observatory/entry/[id].ts` — `tb_semantic_states` query and `semanticState` response field removed.
- `src/pages/api/observatory/states.ts` — `tb_semantic_states` query and `semantic` enrichment field removed.
- `src/lib/libDb.ts` — `SemanticStateRow`, `saveSemanticState`, `getSemanticStateCount`, `SemanticDynamicRow`, `saveSemanticDynamics`, `SemanticCouplingRow`, `saveSemanticCoupling`, `TraitDynamicRow`, `saveTraitDynamics`, `getLatestTraitDynamics`, `CouplingRow`, `saveCouplingMatrix`, `getLatestCouplingMatrix`, `EmotionBehaviorCouplingRow`, `saveEmotionBehaviorCoupling`, `getLatestEmotionBehaviorCoupling` deleted. The `@region state` marker was rewritten to `tb_entry_states` only.

**Schema-side work:**

- `db/sql/migrations/035_archive_alice_negative_state_tables.sql` — new migration. One DO block, six idempotent renames to `zz_archive_*`, post-archive verification query confirming every original `to_regclass` returns NULL. Run locally; operator runs `psql "$ALICE_PG_URL" -v ON_ERROR_STOP=1 -f db/sql/migrations/035_archive_alice_negative_state_tables.sql` against Supabase when ready. NOT auto-applied.
- `db/sql/dbAlice_Tables.sql` — the six `CREATE TABLE` blocks deleted; `@region state` marker rewritten to `tb_entry_states` only; the stale `REFERENCED BY: tb_entry_states, tb_semantic_states, tb_embeddings` comment on `tb_responses` corrected to drop `tb_semantic_states`.
- `tests/unit/lint/subjectScopeLint.ts` — six dead tables removed from `SUBJECT_BEARING_TABLES`.

### Existing data

Local DB: 687 rows total across the six tables, all frozen at 2026-04-25 11:58. After migration, every row lives in `zz_archive_*` and is inert. No application code reads them.

`tb_entry_states` was deliberately NOT archived in this commit despite also being frozen since 2026-04-25. The behavioral 7D radar on the entry observatory page still reads from it. That panel is showing pre-INC-014 data for old entries and will return "Entry not found" for any entry submitted after 2026-04-25. Out of scope for this incident; tracked separately.

### Verification

| Check | Pre-fix | Post-fix |
|---|---|---|
| Files reading the six dead tables | 7 (4 API, 3 page) | 0 |
| `saveSemanticState`/`saveTraitDynamics`/`saveCouplingMatrix` callers | 0 (already orphaned) | 0 (now also deleted) |
| `to_regclass('alice.tb_semantic_states')` etc. (×6) | non-NULL | NULL |
| `to_regclass('alice.zz_archive_tb_semantic_states')` etc. (×6) | NULL | non-NULL with original row counts |
| Live `src/` references to dead table names or removed exports | varied | 0 |
| TS check on touched files | clean | clean (pre-existing strict-null noise unchanged) |

### What this does NOT fix

- **Migration 035 not yet applied to Supabase.** Until then, the six tables remain live in production with their frozen 2026-04-25 row counts. No code reads or writes them; the only effect of leaving them un-archived is database surface area.
- **`tb_entry_states` is also frozen.** It writes stopped on 2026-04-25 along with the rest of the pipeline. The entry observatory page joins on it for the behavioral 7D radar. Any entry created after 2026-04-25 will return 404 from `/api/observatory/entry/[id]`. A future incident either rebuilds the producer or archives the table and removes the radar panel.
- **Discipline confirmation.** The orphan-producer rule from INC-015 has its mirror image: when archiving a feature, grep for tables and exported helpers to confirm there are no satellite consumers left displaying frozen data. Both directions of the dependency edge must be cut in the archival commit.

---

## INC-015: Calibration context extraction deprecated (orphan producer purged)

**Date:** 2026-04-27
**Type:** Architectural correction (orphan producer left running after consumer was deleted)

### What was wrong

The calibration context extraction pipeline (`src/lib/libCalibrationExtract.ts` → `tb_calibration_context`) was a producer with no surviving consumer. The Anthropic LLM call extracted seven dimensions of life-context tags (sleep, physical_state, emotional_event, social_quality, stress, exercise, routine) from every calibration response and persisted them encrypted at rest. The only thing that ever read these tags was `runGeneration`, which used them to feed life-context into next-day question prompts.

`runGeneration` was deleted in INC-014 (same day) as part of the corpus pivot. The extraction pipeline was missed in that scrub: it kept writing to a table that nothing queried. The Anthropic call was triggered from `libSignalWorker.runCalibrationPipeline`, the worker per-stage try/catch swallowed any failure, and the resulting `tb_calibration_context` rows were inert from the moment of write.

The orphan-producer pattern is identical to alice-negative tonight: a feature was archived, but a satellite producer kept running because its dependency edge was load-bearing only via a single deleted consumer. Once is an oversight; twice in one week is a pattern that needs a discipline rule.

### Discovery method

Direct from the operator immediately after INC-014 landed: "yeah let's fucking deprecate this retard ass shit." The grep that confirmed zero non-extractor consumers of `tb_calibration_context`:

```
grep -rn "tb_calibration_context\|saveCalibrationContext\|getCalibrationContext" src/ tests/
```

Every match either wrote to the table (`saveCalibrationContext`) or was the now-deleted `runGeneration` reading via `getRecentCalibrationContext` / `getCalibrationContextNearDate`. After confirming no other reader, the deprecation was greenlit.

### Resolution

**Code removed (per CLAUDE.md "archival means removal" discipline):**

- `src/lib/libCalibrationExtract.ts` — entire file (the `runCalibrationExtraction` function and its prompt builder)
- `src/lib/libSignalWorker.ts` — `runCalibrationExtraction` import and the try/catch invocation in `runCalibrationPipeline`
- `src/lib/libDb.ts` — `saveCalibrationContext`, `getCalibrationContextForQuestion`, `getRecentCalibrationContext`, `getCalibrationContextNearDate`, the `CalibrationContextTag` type, and the `DIMENSION_ID_MAP` helper. The `@region calibration-context` marker was renamed to `@region calibration-deltas` (the section now contains only `tb_session_delta` helpers).
- `src/pages/api/health.ts` — `pendingWork.extractions`, `extractionsBySubject`, `anthropicAvailable`, the underlying SQL, the overall-status check, and the `HealthResponse` type fields. The pending-work badge now counts only embeds + seed alerts.
- `src/pages/index.astro` `renderHealth` — `pw.extractions` removed from the badge total, `anthropicAvailable` removed from the auto-drainable check, "Extractions pending" panel section deleted.
- Stale references in `src/pages/api/subject/respond.ts` and `src/pages/api/subject/calibrate.ts` CONTAMINATION BOUNDARY docstrings — `runCalibrationExtraction()` bullet removed.
- `tests/db/encryption.test.ts` — `tb_calibration_context` round-trip case and its imports (`saveCalibrationContext`, `getCalibrationContextForQuestion`) removed; the per-test cleanup loop and the `te_context_dimension` seed were also dropped (no remaining caller in this test file).

**Schema-side work:**

- `db/sql/migrations/034_archive_calibration_context.sql` — new migration. Renames `tb_calibration_context` → `zz_archive_tb_calibration_context` (idempotent DO block, post-archive verification query). Operator runs `psql "$ALICE_PG_URL" -v ON_ERROR_STOP=1 -f db/sql/migrations/034_archive_calibration_context.sql` against Supabase when ready. NOT auto-applied.
- `db/sql/dbAlice_Tables.sql` — the `CREATE TABLE tb_calibration_context` block, its index, and the table mention in the `@region calibration` marker removed. The deprecation rationale is captured in a one-line comment pointing back to INC-015 / migration 034.
- `tests/unit/lint/subjectScopeLint.ts` — `tb_calibration_context` removed from `SUBJECT_BEARING_TABLES`.
- `tests/unit/lint/subjectScopeLint.test.ts` — `tb_calibration_context` added to `ARCHIVED_SINCE_030` exemption set so the migration-drift test still passes against the historical reference in migration 030.
- `CLAUDE.md` — calibration_context removed from the `tb_questions` cascade list and the post-031 encrypted-columns inventory, with a pointer to migration 034.

### Existing data

35 historical calibrations had `tb_calibration_context` rows ranging from extracted to never-run. After the rename, those rows live in `zz_archive_tb_calibration_context` and are inert. The 35 backlog disappears from the operator's pending-work badge (which also no longer has an extractions counter).

`te_context_dimension` (the seven-dimension enum table) is now also orphaned — no production code joins against it. Left in place for forensic readability of the archived rows; safe to drop in a future schema cleanup.

### Verification

| System | Pre-fix | Post-fix |
|---|---|---|
| `runCalibrationExtraction` invocations on calibration submit | 1 (per submit, every subject) | 0 |
| Files referencing `tb_calibration_context` (excluding migrations + handoffs) | 5 | 0 |
| Files referencing `saveCalibrationContext`/`getCalibrationContext*` | 4 | 0 |
| `npm run vitest tests/unit` | 72 passing | 72 passing |
| TS check on touched files | clean | clean (pre-existing strict-null noise unchanged) |
| Pending-work badge categories | embeds + extractions + seedAlerts | embeds + seedAlerts |

The producer is gone, the consumer was already gone (INC-014), the table is queued for archive in migration 034.

### What this does NOT fix

- **Migration 034 not yet applied to Supabase.** Operator runs it manually. Until then, `tb_calibration_context` remains as a live table in the database with 35 rows of inert data. No code reads or writes it; the only effect of leaving it un-archived is database surface area.
- **Discipline memo.** The orphan-producer pattern fired twice in one week (alice-negative + this). A new memory entry (`feedback_orphan_pipeline_discipline.md`) captures the rule: when archiving a feature, grep for the table/function family to confirm there is no satellite producer left running with no consumer.

---

## INC-014: Legacy per-submission question generation removed, corpus-refresh model documented

**Date:** 2026-04-27
**Type:** Architectural correction (legacy code persisted across an undocumented methodological pivot) + new operator-facing alert

### What was wrong

The codebase carried a per-submission auto-generation path (`runGeneration` in `src/lib/libGenerate.ts`, called from `src/lib/libSignalWorker.ts:222`) that predates the corpus-refresh pivot and was never removed when the pivot landed.

`runGeneration` would, after every owner journal submission past day 30: query past responses, run RAG retrieval (`libRag.ts`), build a context-loaded prompt, call Anthropic, and schedule a generated question for tomorrow into `tb_questions` with `question_source_id = 2`. A standalone manual-trigger script (`src/scripts/generate-question.ts`, exposed as `npm run generate`) wrapped the same function. The previous documentation in CLAUDE.md (line 25) described it as a "Nightly script," which compounded the confusion — there was no scheduler; the script was either invoked manually or fired implicitly via the post-submission worker pipeline.

The actual current methodological model — confirmed by the operator on 2026-04-27 — is:

- Each subject receives **30 personal seed questions** at account creation, pre-scheduled into `tb_questions` (`question_source_id = 1`). These are sacred and never overwritten.
- A **shared corpus** lives in `tb_question_corpus` (`question_source_id = 4`) that subjects pull from once their personal queue runs dry, or for variety alongside.
- When **any subject's unanswered seeds drop to ≤ 5**, an alert fires in the owner's navbar pending-work badge.
- The owner then **manually invokes an LLM** to take in past responses + existing corpus rows and generate a fresh batch of ~30 unique questions, which are **appended** (not replacing) to `tb_question_corpus`. Subjects whose personal queues are still partly populated are unaffected; the new corpus rows are extra inventory available to any subject.
- There is no per-submission auto-generation. The `runGeneration` path was a leftover from the previous design and had been silently failing on prod (no `ANTHROPIC_API_KEY` in the systemd EnvironmentFile by design — see `project_prod_is_signal_store_only.md`) since the pivot landed; failures were caught by the worker's per-stage try/catch and logged to `data/errors.log` with no operator-facing surface.

This pivot was never recorded in METHODS_PROVENANCE.md, which was the gap that allowed the legacy path to persist for weeks past its end-of-life.

### Discovery method

Surfaced during a separate task (the alice-negative full deprecation), when the assistant proposed extending the new pending-work navbar badge to include "pending question generation" as a deferred-work category. The operator caught the mismatch immediately: "what nightly question generation? what is going on here? am i lost? the only question generation that happens is a brand new seeding of 30 questions." Code review of `libSignalWorker.ts:222` and `libGenerate.ts:51-60` confirmed the legacy `runGeneration` invocation was still wired in and would attempt an Anthropic call after every owner submission. Cross-check against METHODS_PROVENANCE.md confirmed the corpus-refresh pivot had no entry.

### Resolution

**Code removed (per CLAUDE.md "archival means removal" discipline):**

- `src/lib/libGenerate.ts` — entire file (the `runGeneration` function, supporting types, and the RAG-context prompt builder)
- `src/lib/libRag.ts` — entire file (only consumer was libGenerate; `retrieveSimilarMulti` and `retrieveContrarian` had no other callers)
- `src/scripts/generate-question.ts` — entire file (manual trigger wrapping `runGeneration`)
- `tests/db/aggregation_scoping/libGenerate_threading_scoping.test.ts` — entire file (hotspot test for `runGeneration`)
- `package.json` — `"generate": "npx tsx src/scripts/generate-question.ts"` script entry
- `src/lib/libSignalWorker.ts` — import line 30 (`runGeneration`) and the post-submission `try { await runGeneration(...) }` block at line 222–223
- Stale references in contamination-boundary docstrings (`src/pages/api/subject/respond.ts:11`, `src/pages/api/subject/calibrate.ts:9`) and in `src/lib/libDailyDelta.ts:493` updated to reflect that the daily-delta backfill is now standalone
- `CLAUDE.md` line 25 ("Nightly script (`npm run generate`)…") replaced with an accurate description of the seed-30 + corpus-refresh model and a pointer to this entry

**Operator-facing alert built:**

- `/api/health` `pendingWork` payload extended with:
  - `embeds: number` and `embedsBySubject: Array<{ subject_id, username, count }>` — embed counter is now cross-subject (was: owner-only). Mirrors the operator's stated intent that they need visibility into pending embeds for any subject, not just their own.
  - `seedAlerts: Array<{ subject_id, username, remaining }>` — surfaces every subject with `0 < unanswered_seeds ≤ 5`, ordered by `remaining` ascending. The 0 case is intentionally excluded (perpetual once seeds are exhausted; signal value drops).
- `overall` health status flips to `yellow` whenever `pendingEmbeds > 0 || seedAlerts.length > 0`.
- Owner journal page (`/`) renders a numeric badge on the existing `health-dot`. The badge text is `pendingEmbeds + seedAlerts.length` (combined attention items). Color is green only when the entire pending set is auto-drainable (TEI online AND no seed alerts); otherwise yellow.
- Expanded health panel renders a "Pending work" section with a per-subject breakdown of pending embeds and a per-subject breakdown of low-seed alerts, plus action hints (`npm run dev:full` + `npm run backfill` for embeds; manual corpus refresh for seed alerts).

### Followups completed later in the same session

- **LLM corpus-refresh workflow wired up.** Two pre-existing scripts (`src/scripts/expand-corpus.ts` and `src/scripts/approve-corpus.ts`) covered the heavy lift but were undiscoverable. Default candidate count bumped from 10 to 30 to match the methodology. New npm shortcuts: `npm run corpus:refresh` and `npm run corpus:approve <file>`. The corpus-refresh prompt (in expand-corpus.ts) was kept as-written — it already encodes the design principles (UNANSWERABLE / ABOUT THE PERSON / DIVERSITY / disclosure context) plus a comprehensive "what makes a question bad" exclusion list, with the full active corpus passed in as anti-duplication context. CLAUDE.md updated to point at the workflow.
- **Archive migration for `tb_witness_states` written.** `db/sql/migrations/033_archive_witness_states.sql` renames the table to `zz_archive_tb_witness_states` (idempotent via DO block, no data movement, full verification query at the end). Schema file `db/sql/dbAlice_Tables.sql` updated: the WITNESS-STATE region marker, the deprecation block, and the CREATE TABLE were removed; the seven non-witness state-engine tables remain in active use. The migration is NOT applied automatically — operator runs `psql "$ALICE_PG_URL" -v ON_ERROR_STOP=1 -f db/sql/migrations/033_archive_witness_states.sql` against Supabase when ready.
- **Lint table list cleaned up.** `tb_witness_states` removed from `tests/unit/lint/subjectScopeLint.ts` (`SUBJECT_BEARING_TABLES`) and `tests/db/aggregation_scoping/_fixtures.ts`. The migration-drift test was updated with a new `ARCHIVED_SINCE_030` exemption set so the historical reference in migration 030 doesn't fail the test. When future tables are archived, add them to that set in the same commit as the archive migration.
- **Pending-work alert extended to calibration extractions.** `/api/health` now reports `pendingWork.extractions` + `extractionsBySubject` (calibrations missing a `tb_calibration_context` row) and `anthropicAvailable` (boolean derived from `process.env.ANTHROPIC_API_KEY`). Overall status flips to yellow whenever extractions are pending. Owner page badge total = embeds + extractions + seed alerts; badge stays yellow if either TEI or Anthropic is offline (or seed alerts are firing). Panel renders a per-subject "Extractions pending" section with the same shape as the embed section. The actual rescue path (re-running failed extractions whose `tb_signal_jobs` rows were dead-lettered while the API key was missing) is itself a followup — for now the alert surfaces the gap and the operator manually re-invokes once the key is loaded.

### Still on the followup queue

- ~~**Extraction rescue script.**~~ Moot — the entire calibration extraction pipeline was deprecated in INC-015 the same day. No rescue path is needed for a pipeline that no longer exists.
- ~~**`scripts/archive/retrigger-background.ts`**~~ deleted 2026-04-27 (it referenced the removed `libGenerate`).

### Verification

| System | Pre-fix | Post-fix |
|---|---|---|
| `runGeneration` invocations on submission | 1 (per owner submit, post-day-30) | 0 |
| Files referencing `runGeneration` (excluding archive/) | 8 | 0 |
| `npm run generate` script | present | removed |
| Cross-subject embed counter | owner-only | aggregates over all subjects |
| Seed-low alert surface | none | navbar badge + per-subject breakdown |
| `tb_questions` rows with `question_source_id = 2` | historical (no new writes; existing rows preserved) | same — no new writes after this commit |
| TS check on touched files (`libSignalWorker`, `libDailyDelta`, `libEmbeddings`, `health.ts`, `index.astro` script) | clean | clean |

The legacy method is now removed, the active method is documented, and the operator-facing trigger that drives the active method is wired into the navbar.

---



**Date:** 2026-04-24
**Type:** Code bug (silent field stripping) + methods expansion (ghost comparison surface) + architectural correction (missing calibration guard)

### What was wrong

**1. TypeScript wrapper silently dropped 36 signal fields.** `libSignalsNative.ts` contained two wrapper functions (`computeDynamicalSignals`, `computeMotorSignals`) that explicitly constructed return objects with only the original signal fields. The Rust napi binary correctly computed and exported all 38 new dynamical fields and 3 new motor fields, but the TypeScript wrappers discarded them by constructing a new object with only the original 14 fields. The exported TypeScript interfaces (`DynamicalSignals`, `MotorSignals`) were also never updated, so strict TypeScript would not have caught the missing fields. Every session processed through the live pipeline since the Phase 1-5 implementation had NULL values for all new signal columns despite the Rust engine computing them correctly.

**2. Ghost comparison used only 13 of 51 available signals.** `libReconstruction.ts` computed residuals for 5 dynamical (PE, DFA, RQA determinism, RQA laminarity, TE dominance), 6 motor (sample entropy, jerk, lapse rate, drift, tau, tau proportion), 1 perplexity, and 6 semantic signals. The 38 new dynamical and 3 new motor signals were available in the database but excluded from the ghost comparison. The behavioral L2 norm was computed from 13 dimensions, providing no visibility into which signal families the ghost could reproduce and which it could not.

**3. Reconstruction residual pipeline had no calibration guard.** `computeReconstructionResidual` was the only aggregate pipeline function that did not filter `question_source_id = 3`. All other aggregate systems (profile, cross-session, integrity, semantic baselines) had early-return guards added during an April 23 decontamination pass. The reconstruction function was missed. Result: 125 of 180 residual rows were calibration sessions, contradicting the architectural decision that calibrations participate only in per-session signals and daily deltas (see `systemDesign/CALIBRATION_ENGINE.md`).

### Discovery method

The wrapper bug was found by tracing the data flow from the Rust napi boundary through the TypeScript wrapper to the pipeline save functions. The handoff document reported "all new columns are NULL when computed through the tsx runtime" and diagnosed it as a build.rs / napi export issue. The actual cause was three lines upstream: the wrapper functions explicitly listed only original fields in their return statements.

The missing calibration guard was found during a systematic audit of all aggregate pipeline functions triggered by the user's question about whether calibrations participate in ghost comparison.

### Resolution

**Wrapper fix (3 edits in `libSignalsNative.ts`):**
1. `DynamicalSignals` interface expanded from 14 to 49 fields
2. `MotorSignals` interface expanded from 14 to 17 fields
3. Both wrapper functions updated to pass through all fields with `n()` null coercion

**Signal backfill:**
- Deleted and re-inserted all 31 dynamical + 31 motor signal rows
- All new columns populated at expected coverage rates (MF-DFA 17/31, PSD 19/31, temporal irreversibility 28/31, ordinal 31/31, causal emergence 28/31, MSE 22/31, Fisher trace 16/31)

**Extended ghost residuals:**
- Schema migration 022: added `extended_residuals_json JSONB` to `tb_reconstruction_residuals`
- 28 new signals included in ghost comparison, organized by theoretical family. Selected for non-tautological ghost comparison (ghost is not designed to match these dimensions). 9 signals excluded as tautological or degenerate (pause mixture, redundant integers, derivative quantities).
- `ON CONFLICT` changed from `DO NOTHING` to `DO UPDATE` on the save function for backfill support
- L2 norms (`dynamical_l2_norm`, `motor_l2_norm`, `behavioral_l2_norm`) recomputed to include extended signals. RMS normalization (`sqrt(sum/count)`) keeps the magnitude comparable across different dimension counts.
- All 180 existing residual rows backfilled from stored seeds via `regenerateAvatar`. 0 skipped, 0 failures.

**Calibration guard:**
- Added early-return guard to `computeReconstructionResidual`: `if (question_source_id === 3) return;`
- Matches pattern used in `updateProfile`, `computeCrossSessionSignals`, `computeSessionIntegrity`, `updateSemanticBaselines`
- 125 historical calibration residual rows retained (harmless data, not computed going forward)

### What the extended residuals revealed

The per-family residual breakdown for the full adversary (variant 5) across 6 journal sessions:

| Family | Mean |Residual| | Ghost Capability |
|---|---|---|
| Multifractal (MF-DFA spectrum width) | 4.75 | Cannot reproduce. Largest residual by 4x. |
| Motor Complexity (MSE complexity index) | 1.28 | Cannot reproduce multi-scale entropy. |
| Recurrence Networks (transitivity) | 0.13 | Partially reproducible. |
| Causal Emergence (CEI) | 0.13 | Partially reproducible. |
| Spectral (PSD slope) | 0.11 | AR(1) approximates spectral slope. |
| Dynamic Modes (DMD frequency) | 0.04 | Ghost matches oscillatory modes. |
| Ordinal Complexity (CECP) | 0.006 | Nearly perfectly reproduced. |

**Finding:** Multifractal structure is the single most ghost-resistant dimension. The ghost generates from a single stochastic process (ex-Gaussian + optional AR(1)), which produces a narrow singularity spectrum. Real typing has broad multifractal structure from the interaction of multiple cognitive processes at different time scales. No amount of statistical sophistication closes this gap. Conversely, ordinal statistics reflect the distributional shape, which the ghost matches by construction.

This decomposition was latent in every session's raw keystroke stream since the Phase 1-5 signals were computed. It became visible only when the extended residuals widened the comparison surface from 13 to 41 dimensions.

### Verification

| System | Pre-fix | Post-fix |
|---|---|---|
| Dynamical signals (new columns) | All NULL | 17-31/31 non-null per column |
| Motor signals (new columns) | All NULL | 16-22/31 non-null |
| Ghost extended residuals | Not computed | 180/180 rows with JSONB (28 keys each) |
| Behavioral L2 dimension count | 13 | 36-40 (session-dependent) |
| Calibration residual rows (future) | Computed | Skipped by guard |
| Live pipeline (journal q12, April 24) | N/A | Full coverage across all families |
| Live pipeline (calibration q89, April 24) | N/A | Per-session signals only; ghost/cross-session/integrity correctly skipped |

### Files changed

| File | Change |
|---|---|
| `src/lib/libSignalsNative.ts` | Wrapper fix: interfaces + both wrapper functions expanded |
| `src/lib/libReconstruction.ts` | Extended residuals, calibration guard, `snakeToCamel` helper |
| `src/lib/libDb.ts` | `ReconstructionResidualInput` interface + `ON CONFLICT DO UPDATE` |
| `db/sql/dbAlice_Tables.sql` | `extended_residuals_json JSONB` column added |
| `db/sql/migrations/022_extended_residuals.sql` | New migration |
| `src/scripts/backfill-extended-residuals.ts` | New: regenerate from seeds, populate JSONB + norms |

### What this does NOT fix

- **Reproducibility snapshots not updated for new signals.** The CI snapshot test (`tests/reproducibility.rs`) covers the original dynamical and motor signals. The 38 new dynamical and 3 new motor signals are not in the snapshot fixture. They are computed by the same Rust engine with the same numerical discipline, so drift is unlikely, but the guarantee is not enforced. Tracked as existing followup (process signal verification, same scope).
- **Historical calibration residual rows not deleted.** 125 rows remain from pre-guard era. They are valid measurements but architecturally unintended. Retained for potential future calibration engine use.

---

## INC-012: Single-paradigm measurement architecture

**Date:** 2026-04-23
**Type:** Methods correction (measurement paradigm gap, not a code bug)

### What was wrong

The signal engine has 129 database columns computed by a Rust native engine and TypeScript pipeline. Every signal is technically correct within its own paradigm. The paradigm itself is incomplete.

Every probe of temporal structure, complexity, or recurrence uses exactly one mathematical approach. There are no independent estimators cross-checking each other, no frequency-domain analysis of any kind, and no cross-session motor trajectory tracking. Specifically:

**1. No frequency-domain analysis.** The IKI series is a time series. Spectral analysis of time series is fundamental. The system computes DFA (time-domain scaling), PE (ordinal patterns), RQA (recurrence structure), and sample entropy (temporal regularity) but never computes a power spectral density. The entire frequency domain is invisible: oscillation frequencies, spectral slope, respiratory coupling, autonomic analogs, noise color. This is equivalent to measuring a signal with an oscilloscope and never switching to the spectrum analyzer.

**2. No multifractal analysis.** DFA computes a single scaling exponent (alpha), assuming monofractal scaling (one power law governs all moment orders). Multifractal DFA (Kantelhardt et al. 2002) generalizes this to a spectrum of scaling exponents that reveals whether scaling diversity is adaptive or rigid. The generalization has been available for 24 years. Bennett, Roudaut & Metatla (2025, Int. J. Human-Computer Studies) directly validated MF-DFA spectrum width on keystroke IKI data as a fatigue marker. The existing DFA code extends to MF-DFA with approximately 40 lines. This was not an unknown technique. It was an established generalization of a technique already implemented, with direct keystroke validation, that was not followed through.

**3. No ordinal dynamics beyond Shannon entropy.** The PE implementation computes Shannon entropy of ordinal patterns (Bandt & Pompe 2002). The standard literature extensions are the complexity-entropy causality plane (Rosso et al. 2007) and forbidden pattern analysis (Amigo et al. 2008). These answer a question PE alone cannot: is the IKI sequence deterministic or stochastic? Both can have identical PE values. The extensions build on the same ordinal pattern distribution already computed by PE and add negligible computational cost. If you know Bandt-Pompe (2002), Rosso (2007) and Amigo (2008) are the immediate next papers. They were not followed.

**4. No graph analysis of the recurrence matrix.** RQA extracts sequential line statistics (diagonal lines for determinism, vertical lines for laminarity) from the recurrence matrix. Recurrence network analysis (Donner et al. 2010, 2011) reinterprets the same matrix as a graph adjacency matrix and computes graph-theoretic properties (transitivity, path length, clustering, assortativity). The recurrence matrix is already computed. The graph analysis adds 2-10ms of computation on data that already exists in memory. The RQA implementation stopped at line statistics and left the graph structure of the same matrix unexamined.

**5. No cross-session motor trajectory tracking.** The cross-session signal family tracks semantic and linguistic drift (NCD, self-perplexity, vocab recurrence decay, text network density). Motor distribution shape drift is not tracked at all. This means the system can detect when language is changing but cannot detect when the motor system's timing distribution is changing shape (developing heavier tails, becoming bimodal, losing symmetry). Lam et al. (2024, Scientific Reports) showed that motor distribution shape change (Wasserstein distance) accelerates months before mean speed declines in ALS. The system has no analog of this measurement.

**6. No independent estimators for any measurement.** DFA alpha is the only temporal scaling probe. PE is the only ordinal complexity probe. RQA determinism is the only recurrence structure probe. If any single estimator is wrong or misleading for a particular session, nothing catches it. A measurement instrument that produces one number per dimension and offers no cross-validation of that number is making a stronger claim than it should about each individual measurement.

### Why this was missed

The signal engine was built by following citations forward from the keystroke dynamics literature: Bandt-Pompe -> PE, Peng -> DFA, Webber-Zbilut -> RQA, Schreiber -> TE. Each addition was justified by its own paper and its own measurement target. The result was a thorough inventory of time-domain nonlinear dynamics tools, each operating independently.

What was not done was to ask the complementary question: for each measurement, what independent approach would cross-validate it? That question would have immediately surfaced spectral slope (independent check on DFA), CECP (disambiguation layer for PE), recurrence networks (geometric complement to RQA's sequential analysis), and MF-DFA (generalization test of DFA's monofractal assumption). The paradigm boundary was invisible from inside the paradigm because each signal appeared complete on its own terms.

The frequency domain blind spot is the least defensible. Spectral analysis is not an exotic technique. It is the first thing a signal processing engineer would compute on any time series. Its absence reflects the fact that the signal engine was designed by a cognitive science framing (what do keystroke dynamics papers compute?) rather than a signal processing framing (what are the standard analysis axes for any time series?).

### What we aim to achieve today

Implementation of six signal families that close the paradigm gap. All extend existing infrastructure. Target: complete Rust implementation with tests, database schema, and pipeline integration in a single session.

**Family 1: MF-DFA (extends `dynamical.rs`, existing DFA infrastructure)**

| Signal | Computation | Lines est. |
|--------|-------------|-----------|
| `mfdfa_spectrum_width` | Generalize DFA over q = -5 to +5, Legendre transform, max(alpha) - min(alpha) | ~40 on DFA |
| `mfdfa_asymmetry` | (alpha_peak - alpha_min) / (alpha_max - alpha_min) | included |
| `mfdfa_peak_alpha` | alpha at max f(alpha); h(2) = standard DFA alpha for backward compatibility | included |

Cross-validates: DFA alpha (is the monofractal assumption valid?). Closes: multifractal gap.

**Family 2: Symbolic dynamics extensions (extends `dynamical.rs`, existing PE infrastructure)**

| Signal | Computation | Lines est. |
|--------|-------------|-----------|
| `statistical_complexity` | Jensen-Shannon divergence of ordinal pattern distribution vs uniform | ~25 on PE |
| `forbidden_pattern_fraction` | absent_patterns / d! at orders 3-5 | ~10 on PE |
| `weighted_pe` | Variance-weighted ordinal pattern entropy | ~15 on PE |

Cross-validates: PE (is the complexity deterministic or stochastic?). Closes: ordinal dynamics gap.

**Family 3: Recurrence network analysis (extends `dynamical.rs`, existing RQA infrastructure)**

| Signal | Computation | Lines est. |
|--------|-------------|-----------|
| `recurrence_transitivity` | Triangle ratio on recurrence matrix as graph | ~40 on RQA |
| `recurrence_avg_path_length` | BFS mean shortest path on largest connected component | ~30 on RQA |
| `recurrence_clustering` | Mean local clustering coefficient | included |
| `recurrence_assortativity` | Degree-degree correlation | ~20 |

Cross-validates: DFA alpha (transitivity approximates fractal dimension independently). Closes: recurrence graph gap.

**Family 4: IKI power spectral density (new in `dynamical.rs` or new module)**

| Signal | Computation | Lines est. |
|--------|-------------|-----------|
| `iki_psd_respiratory_peak_hz` | Lomb-Scargle periodogram, peak in 0.15-0.35 Hz band | ~80 (Lomb-Scargle core) |
| `peak_typing_frequency_hz` | Peak in 2-15 Hz band of keystroke onset PSD | ~20 on PSD |
| `iki_psd_lf_hf_ratio` | Integrated power ratio 0.04-0.15 Hz / 0.15-0.4 Hz | ~10 on PSD |
| `iki_psd_spectral_slope` | log-log regression of PSD | ~10 on PSD |
| `iki_psd_fast_slow_variance_ratio` | Integrated power >1 Hz / <0.5 Hz | ~5 on PSD |

Cross-validates: DFA alpha (spectral slope provides independent scaling estimate). Closes: frequency domain gap.

**Family 5: Cross-session motor trajectory (TypeScript, `libCrossSessionSignals.ts`)**

| Signal | Computation | Lines est. |
|--------|-------------|-----------|
| `wasserstein_hold_time` | KDE + earth mover's distance between consecutive session hold time distributions | ~60 |
| `wasserstein_flight_time` | Same for flight time distributions | included |
| `motor_consolidation_index` | Cross-day digraph improvement ratio for high-frequency digraphs | ~50 |

Cross-validates: NCD (semantic drift) with motor distribution drift. Closes: cross-session motor gap.

**Family 6: Pause mixture decomposition (Rust, `dynamical.rs` or `motor.rs`)**

| Signal | Computation | Lines est. |
|--------|-------------|-----------|
| `pause_mixture_component_count` | BIC-selected K for lognormal mixture EM | ~80 |
| `pause_mixture_motor_proportion` | Mixing proportion of fastest component | included |
| `pause_mixture_cognitive_load_index` | pi_reflective / pi_motor | included |

Cross-validates: fixed-threshold pause analysis (P-bursts, pause count). Closes: data-driven process boundary gap.

### Estimated total

~20-25 new database columns. ~400-500 lines of Rust. ~110 lines of TypeScript. Schema migration for `tb_dynamical_signals` (Families 1-4), `tb_cross_session_signals` (Family 5), and either `tb_motor_signals` or `tb_dynamical_signals` (Family 6).

### What this fixes

**Before:** 129 columns, one estimator per measurement, zero frequency-domain signals, zero cross-session motor signals, zero cross-validation architecture.

**After:** ~150-155 columns with independent cross-validation on three core measurements (temporal scaling, ordinal complexity, recurrence structure), a complete frequency-domain axis, cross-session motor trajectory tracking, and data-driven process decomposition. The instrument can now distinguish types of change (cognitive vs. motor, deterministic vs. stochastic, monofractal vs. multifractal, scaling shift vs. scaling diversity collapse) rather than only detecting that change occurred.

### Resolution

**Implemented 2026-04-24.** All six planned families were implemented in Phases 1-5 (38 new dynamical columns, 3 new motor columns, 5 schema migrations 017-021). The napi boundary export bug that prevented the new signals from reaching the TypeScript pipeline was identified and fixed in INC-013. The per-family ghost residual breakdown confirmed the cross-validation architecture's value: MF-DFA (Family 1) proved to be the most ghost-resistant dimension by a factor of 4x, while ordinal extensions (Family 2) proved nearly perfectly reproducible by the ghost. This decomposition was impossible with the single-paradigm architecture.

Family 5 (cross-session motor trajectory via Wasserstein distance) was not implemented as specified. Motor self-perplexity was implemented instead as the cross-session motor signal. The Wasserstein distance approach remains a candidate for future work.

### Design principle established

A measurement instrument does not become more trustworthy by adding more signals in the same paradigm. It becomes more trustworthy when independent mathematical approaches to the same underlying quantity agree. Cross-validation architecture (multiple estimators, multiple domains, multiple scales) is not a luxury. It is the minimum standard for a measurement that claims to track cognitive trajectory over years.

When implementing a signal from the literature, follow the citation chain to its standard extensions. If you implement Bandt-Pompe, check Rosso and Amigo. If you implement DFA, check Kantelhardt. If you build a recurrence matrix, check Donner. If you have a time series and no power spectrum, stop and ask why.

---

## INC-011: Daily delta trigger failure and calibration pairing corrections

**Date:** 2026-04-23
**Type:** Architectural correction (dead code path) + data correction (wrong calibration pairings)

### What was wrong

Three issues discovered in the daily delta system:

1. **Dead trigger.** INC-007 (2026-04-22) moved the daily delta backfill into `runGeneration()` but placed it after an early return gate:

   ```typescript
   if (await hasQuestionForDate(tomorrowStr)) return;  // line 56
   await runDailyDeltaBackfill();                       // line 60 -- NEVER REACHED
   ```

   Once tomorrow's question is generated (which happens on the first journal submission each day), every subsequent call to `runGeneration()` exits at line 56. The delta backfill executed once on April 22 and never again. April 22 and 23 had eligible day-pairs with no delta rows.

2. **Wrong calibration pairings.** Two delta rows from the initial INC-007 backfill paired with the wrong calibration sessions:
   - April 14: paired with question 31 (created April 13, wrong day entirely). Correct: question 44 (last calibration of April 14).
   - April 15: paired with question 47 (mid-day calibration). Correct: question 52 (last calibration of April 15).

3. **Missing reconstruction residual.** Calibration 65 (April 17, 23:51) had keystroke data, dynamical signals, and motor signals, but zero rows in `tb_reconstruction_residuals`. The two calibrations adjacent to it (62 and 66) had full 5-variant residuals. The reconstruction pipeline skipped or errored on this single session with no retry mechanism.

### Discovery method

Direct database inspection during a system review. The daily delta trigger failure was traced by reading the `runGeneration()` control flow. The calibration mispairing was found by comparing `calibration_question_id` in `tb_session_delta` against `getSameDayCalibrationSummary()` output for each date. The missing residual was found by querying for sessions with dynamical signals but no reconstruction residual rows.

### Resolution

**Daily delta trigger:** Replaced the backfill-inside-generation design with a targeted per-submission computation. New function `computePriorDayDelta(currentDate)` in `libDailyDelta.ts` finds the most recent date before `currentDate` with a complete journal+calibration pair and no delta row, computes one delta, and saves it. Called from `respond.ts` in the fire-and-forget block before `runGeneration()`, with its own try/catch. Independent of question generation. Self-healing: if a delta save fails, the next journal submission finds the same date eligible and retries.

`runDailyDeltaBackfill()` removed from `runGeneration()`. Standalone backfill script retained for historical repair.

**Calibration pairings:** April 14 and 15 delta rows deleted and recomputed via backfill. All 11 rows verified: `calibration_question_id` matches `getSameDayCalibrationSummary()` output for every date.

**Missing residual:** Calibration 65 backfilled via `backfill-reconstruction.ts`. All 5 adversary variants computed. Zero gaps remain (31 sessions with signals, 31 with residuals, 155 total rows).

### Verification

Post-fix database state:

| System | Status |
|--------|--------|
| Daily deltas | 11/11 eligible day-pairs computed. 0 missing. |
| Delta calibration pairings | 11/11 match `getSameDayCalibrationSummary()` |
| Reconstruction residuals | 31 sessions, 155 rows, 5 variants each. 0 gaps. |
| Signal pipeline | Every session with keystroke data has dynamical + motor signals. 0 gaps. |
| Semantic baselines | 7 signals tracked, 7-9 sessions each, all gated (n < 10). |
| Embeddings | 21 active (Qwen3), 10 invalidated (voyage). |

Simulated the new flow: deleted April 23 delta, called `computePriorDayDelta('2026-04-24')`, verified it recomputed April 23's delta with correct pairing. Second call returned null (idempotent).

### Pre-instrument-era data

Sessions from April 13-17 have varying pipeline coverage depending on when each subsystem came online:

| Date | Keystroke capture | Signal pipeline | Reconstruction |
|------|------------------|----------------|----------------|
| April 13-16 | Not active | Not active | Not possible |
| April 17 | Partial (3/6 calibrations) | Active for sessions with keystrokes | Active (with 1 gap, now fixed) |
| April 18+ | Active | Active | Active |

Journal questions 1-5 (April 13-17) have response text and session summaries but no keystroke streams. Dynamical, motor, and reconstruction signals cannot be computed retroactively. Semantic signals and embeddings are present for questions 4-5 (text-only, no keystroke dependency). Questions 1-3 predate all derived signal systems.

### Files changed

| File | Change |
|------|--------|
| `src/lib/libDailyDelta.ts` | Added `computePriorDayDelta()`. `runDailyDeltaBackfill()` retained for standalone script. |
| `src/pages/api/respond.ts` | Wired `computePriorDayDelta` as first step in fire-and-forget block. |
| `src/lib/libGenerate.ts` | Removed `runDailyDeltaBackfill` import and call. |

---

## INC-010: Embedding model migration (voyage-3-lite to Qwen3-Embedding-0.6B)

**Date:** 2026-04-23
**Type:** Architecture correction (replacing API-dependent embedding model with self-hosted archivable weights)

### What was wrong

The embedding pipeline used VoyageAI's `voyage-3-lite` model via API (`voyageai` npm package v0.2.1, authenticated by `VOYAGE_API_KEY`). This failed three of Alice's four constitutional requirements for measurement infrastructure:

1. **Not archivable.** Vendor-hosted weights with no SHA-256 identifier. VoyageAI can deprecate, retrain, or silently update the model at any time. A methods section citing "voyage-3-lite" is citing a moving target.
2. **Not deterministic across vendor changes.** Two concurrent API calls returned bit-identical vectors (cosine 1.0, max element diff 0), but this is a property of concurrent calls to the same live model, not a guarantee across model version changes or deprecation events.
3. **No lifecycle control.** No mechanism to pin a model version, detect a silent update, or reproduce historical vectors after a vendor change.

The fourth requirement (sufficient quality for topic matching on a corpus of tens to low-thousands of journal entries) was satisfied. The model worked; the provenance chain was broken.

### Discovery method

Systematic audit of the semantic channel infrastructure during Phase 2 baseline work. The embedding model's provenance gap was identified while specifying the topic-matched z-score pipeline (`libSemanticBaseline.ts`), which depends on HNSW similarity against stored embeddings. A model that can silently change under the pipeline invalidates all downstream z-scores.

### Decision: Qwen3-Embedding-0.6B

**Model:** `Qwen/Qwen3-Embedding-0.6B` (Hugging Face, Apache 2.0)
**Weights SHA-256:** `0437e45c94563b09e13cb7a64478fc406947a93cb34a7e05870fc8dcd48e23fd`
**HF commit:** `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`
**Parameters:** 0.6B (2.4 GB at FP32)
**Architecture:** Qwen3ForCausalLM with last-token pooling
**Output dimension:** 1024 native, truncated to 512 via Matryoshka Representation Learning

Selected from four candidate paths after Qwen3-Embedding-4B (originally specified) was found to exceed the 16 GB RAM constraint at FP32. The 0.6B satisfies all four constitutional requirements: archivable weights under Apache 2.0, testable bit-reproducibility under FP32 deterministic inference, sufficient quality for single-user topic matching, and fits the hardware.

Topic matching on journal text is not a frontier NLP task. The 4B's additional capacity optimizes for cross-lingual retrieval, code retrieval, and long-context understanding, which do not meaningfully discriminate on Alice's task.

**Licensing note:** GitHub issue `QwenLM/Qwen3-Embedding#166` raises a question about MS MARCO training data licensing (non-commercial use clause) potentially affecting the Apache 2.0 release. Acceptable for Paper One research use. Flagged for Phase Two commercial deployment review.

### Serving layer decision: TEI CPU-only build

**Problem:** Hugging Face Text Embeddings Inference (TEI) v1.9.3 via Homebrew segfaults during warmup when loading Qwen3-Embedding-0.6B on Metal. The Homebrew binary is compiled with `cargo install --path router -F candle -F metal`. The `metal_is_available()` check in candle is compile-time (`cfg!(feature = "metal")`), not runtime. There is no environment variable or flag to force CPU in a Metal-compiled binary. `CANDLE_USE_CPU=1` does not exist in the TEI or candle source code.

**Cross-cutting finding:** Metal FP32 computation on Apple Silicon is not bit-reproducible. Metal kernels use batch-dependent reduction patterns and adaptive tiling that produce ~1e-4 relative error on identical inputs across runs. This affects every framework that offloads to Metal (TEI/candle, PyTorch MPS, MLX, llama.cpp with GPU layers). The only path to FP32 bit-reproducibility on Apple Silicon is CPU-only inference.

**Candidates evaluated:**

| Path | FP32 | Determinism | Pooling verified | Verdict |
|---|---|---|---|---|
| TEI v1.9.3 Homebrew (Metal) | Yes | No (Metal non-deterministic + segfaults) | Yes | Eliminated |
| TEI source build (CPU-only candle) | Yes | Yes | Yes | **Selected** |
| llama.cpp with F32 GGUF | Yes | Yes (`-ngl 0`) | Yes (`--pooling last`) | Viable backup |
| sentence-transformers (Python CPU) | Yes | Yes (`eager` attn workaround) | Yes (reference impl) | Viable backup |
| Ollama | No (FP16 max) | No control | Yes | Eliminated |
| MLX | Yes but non-deterministic | No (Metal only) | Unverified | Eliminated |
| fastembed-rs (Rust/candle) | Yes | Yes (CPU) | Unverified | Deferred |

**Resolution:** Built TEI v1.9.3 from source with `cargo install --path router -F candle` (no `-F metal`). Binary at `~/.cargo/bin/text-embeddings-router`. CPU-only by construction.

### Bit-reproducibility verification

TEI CPU-only + FP32 + Qwen3-Embedding-0.6B, two successive calls with identical input:

| Observable | 1024-dim (native) | 512-dim (Matryoshka) |
|---|---|---|
| Cosine similarity | 1.0000000000000002 | 1.0000000000000002 |
| Max element difference | 0 | 0 |
| Vectors identical | Yes | Yes |

### Schema changes

| Change | Migration |
|---|---|
| `tb_embedding_model_versions` table created | 014 |
| `embedding_model_version_id` column on `tb_embeddings` | 014 |
| `invalidated_at` column on `tb_embeddings` | 014 |
| UNIQUE constraint updated to `(source_id, record_id, model_version_id)` | 014 |
| Qwen3-Embedding-0.6B registered as model version 1 | 014 |
| 10 voyage-3-lite rows soft-invalidated (`invalidated_at = now()`) | 014 |

### Data migration

1. All 10 non-calibration sessions re-embedded under Qwen3-Embedding-0.6B (10/10 succeeded, 0 failed).
2. New embeddings: 512-dimensional, L2-normalized, tagged with `embedding_model_version_id = 1`.
3. All embedding queries updated to filter `invalidated_at IS NULL`: `searchVecEmbeddings`, `getTopicMatchedValues`, `isRecordEmbedded`, `getUnembeddedResponses`.
4. Semantic baselines regenerated from scratch against new embeddings. 185 stale trajectory rows deleted, 48 new rows computed. All 48 have topic z-scores. All 48 correctly gated (baseline_n < MINIMUM_N = 10).

### Contamination attestation schema (co-landed)

Three columns added to `tb_responses` (migration 015):
- `contamination_boundary_version` (default `'v1'`)
- `audited_code_paths_ref` (default `'docs/contamination-boundary-v1.md'`)
- `code_commit_hash` (populated at session-write time via `git rev-parse HEAD`)

All 65 existing rows backfilled with v1 attestation and `'pre-attestation'` commit hash. Both `respond.ts` and `calibrate.ts` wired to populate commit hash on new sessions.

Boundary document `docs/contamination-boundary-v1.md` enumerates five audited code paths and explicitly excludes `src/pages/app/index.astro` (unwired textarea).

### Behavioral L2 norm backfill (co-landed)

140 historical rows in `tb_reconstruction_residuals` backfilled with `behavioral_l2_norm` (RMS of dynamical + motor + perplexity residuals, filtering non-finite values). Three spot-checks verified SQL-computed values match TypeScript `l2()` to 6 decimal places.

Observatory pages updated to display `behavioral_l2_norm` as the primary aggregate:
- `instrument-status.ts`: primary metric is `behavioralL2`
- `observatory/ghost.ts`: summary uses `avgBehavioralL2`, comparison uses `avgBehavioral`
- `observatory/difficulty.ts`: groups by `behavioralL2`

`total_l2_norm` preserved in API responses but no longer rendered as the primary number.

### Migration search_path fix (co-landed)

Migrations 011-013 were missing `SET search_path = alice, public;`. Fixed. Gotcha added to `GOTCHAS.md`.

### Files changed

| File | Change |
|---|---|
| `src/lib/libEmbeddings.ts` | Rewritten: VoyageAI API replaced with TEI HTTP calls, Matryoshka truncation + L2 normalization |
| `src/lib/libDb.ts` | `insertEmbeddingMeta`, `isRecordEmbedded`, `getUnembeddedResponses`, `searchVecEmbeddings` updated for model versioning and invalidation; `saveResponse` and `saveCalibrationSession` accept attestation; `getActiveEmbeddingModelVersionId` added |
| `src/lib/libSemanticBaseline.ts` | `invalidated_at IS NULL` filter on both embedding queries; module header updated with seven-signal list |
| `src/lib/utlGitCommit.ts` | New: git commit hash at process startup |
| `src/pages/api/respond.ts` | Attestation columns populated at session-write time |
| `src/pages/api/calibrate.ts` | Attestation columns populated at session-write time |
| `src/pages/api/instrument-status.ts` | Primary metric switched to `behavioralL2` |
| `src/pages/api/observatory/ghost.ts` | `behavioralL2` in SELECT and summary; comparison uses `avgBehavioral` |
| `src/pages/api/observatory/difficulty.ts` | Groups by `behavioralL2` |
| `db/sql/dbAlice_Tables.sql` | `tb_embedding_model_versions` added; `tb_embeddings` updated (model version FK, invalidated_at, new UNIQUE); `tb_responses` updated (attestation columns) |
| `db/sql/migrations/014_embedding_model_versions.sql` | New migration |
| `db/sql/migrations/015_contamination_attestation.sql` | New migration |
| `db/sql/migrations/011-013` | `SET search_path` added |
| `docs/embedding-methods.md` | New: canonical methods specification for Paper One citation |
| `docs/contamination-boundary-v1.md` | New: boundary audit document |
| `src/scripts/backfill-semantic-baselines.ts` | New: regeneration script for baselines after embedding model change |
| `GOTCHAS.md` | VoyageAI gotcha replaced with TEI gotcha; invalidated embeddings gotcha; migration search_path gotcha; semantic trajectory gating gotcha; semantic baseline calibration exclusion gotcha |

### What this does NOT fix

- **Calibration sessions are not embedded.** The embedding pipeline (`getUnembeddedResponses`) filters `question_source_id != 3`. Calibration text is prompted, not organic. If calibration embeddings are ever needed (e.g., for cross-session-type topic similarity), a separate pipeline with explicit scope would be required.
- **Semantic baselines include only non-calibration sessions.** The backfill processes question_source_id != 3 only. Previous baselines (n=13-29) included calibration sessions. New baselines (n=6-7) are lower but methodologically correct: calibration text does not represent within-person organic trajectory.
- **`voyageai` npm package remains in `package.json`.** Not removed in this migration to avoid unnecessary churn. It is no longer imported by any live code. Can be removed in a future cleanup.

---

## INC-009: Construct validity audit and remediation (Waves 1-2)

**Date:** 2026-04-22
**Type:** Methods correction (presentation layer making unsupported construct claims)

### What was wrong

A systematic audit of all user-facing signal surfaces identified two classes of construct validity failure:

1. **Interpretive labels presented as instrument readings.** Four sets of natural-language labels attached to numeric signal values implied validated construct mappings that do not exist:
   - Attractor force: "rigid" / "moderate" / "malleable" (coupling page)
   - Permutation entropy: "exploratory" / "varied" / "patterned" / "formulaic" (entry detail)
   - Tau proportion: "cognitive-dominant" / "mixed" / "motor-dominant" (entry detail)
   - RQA laminarity: "fluid" / "moderate" / "sticky" / "trapped" (entry detail)

   These labels imply the signal has been validated to mean what the label says. It has not. A PE value of 0.58 is a measurement. "Formulaic" is an interpretation that requires external validation (e.g., rater agreement, concurrent validity with writing quality assessments). The labels were heuristic thresholds presented without qualification.

   DFA regime labels (white noise / pink / pink-brown / brown noise) were retained because they map to standard spectral classifications with established literature backing.

2. **Statistical notation without adequate sample-size context.** Six presentation-layer behaviors made claims stronger than the data supported:
   - Deviation callouts used σ notation without disclosing the baseline entry count. A "2.1σ deviation" from a 5-entry baseline is not the same statistical claim as from a 50-entry baseline.
   - Sustained trend detection triggered at 3-session monotonic runs, which are expected ~1.4 times by chance across 7 dimensions in 8 observations.
   - Trajectory charts connected 2-4 data points with lines, visually implying temporal structure that few observations cannot support.
   - Session integrity used "flagged" language at profile counts below 10, where the adaptive threshold is unreliable.
   - The ghost page labeled the journal/calibration residual gap as "cognitive contribution by question type," an interpretive claim about causation that the data does not establish.
   - The avatar page displayed positional phase labels ("exploring" / "composing" / "finishing") that implied behavioral classification but were computed purely from stream position (< 20% / < 75% / else).

### Discovery method

Structured audit using the construct validity framework: for each signal surface, (1) what signal is displayed, (2) what does the UI claim about it, (3) what would have to be true for that claim to be honest, (4) is it. Applied to all observatory sub-pages, entry detail, ghost, coupling, trajectory, avatar, research, and dev surfaces.

### Resolution

**Wave 1: Strip unvalidated interpretive labels (4 changes)**

| Surface | Removed | Replaced with |
|---|---|---|
| Coupling page: attractor force | "rigid" / "moderate" / "malleable" badges | Numeric value (0.00-1.00) with inline 0-1 scale bar |
| Entry detail: PE | "exploratory" / "varied" / "patterned" / "formulaic" | Numeric PE value with (0-1) range annotation |
| Entry detail: tau proportion | "cognitive-dominant" / "mixed" / "motor-dominant" | Numeric tau value in ms only |
| Entry detail: RQA laminarity | "fluid" / "moderate" / "sticky" / "trapped" | Numeric laminarity percentage only |

**Wave 2: Honest framing for low-n signals (6 changes)**

| Surface | Before | After |
|---|---|---|
| Trajectory charts | Connected lines at all n >= 2 | Dots-only for n < 5; lines at n >= 5 |
| Ghost section header | "cognitive contribution by question type" | "residual gap by session type" |
| Avatar phase indicator | "exploring" / "composing" / "finishing" labels | Removed entirely |
| Deviation callouts | "Xσ from baseline" at all n | At n < 15: "Above/Below average (n=X)"; at n >= 15: "Xσ from baseline (n=X)" |
| Sustained trends | Minimum run length 3 | Minimum run length 4 |
| Integrity flags | "flagged" at all n | At n < 10: "atypical (based on n=X prior sessions)"; at n >= 10: "flagged" |

### Files changed

| File | Wave | Change |
|---|---|---|
| `src/pages/observatory/coupling.astro` | 1 | `attractorBadge()` replaced with `attractorBar()` |
| `src/pages/observatory/entry/[id].astro` | 1 | `peRegime()`, `tauRegime()`, `lamRegime()` removed |
| `src/pages/observatory/trajectory.astro` | 2 | Dots-only rendering for n < 5 |
| `src/pages/observatory/ghost.astro` | 2 | Section header string change |
| `src/pages/avatar.astro` | 2 | Phase indicator HTML, JS, and CSS removed |
| `src/pages/api/observatory/synthesis.ts` | 2 | Deviation text generation, trend run threshold |
| `src/pages/observatory/index.astro` | 2 | Integrity low-n language |

Zero schema changes. Zero computation changes. All modifications are presentation-layer only.

### What this does NOT fix

- **Coupling table significance context.** The coupling page still displays raw Pearson r values without significance tests or confidence intervals for same-domain pairs. The discoveries section has the critical-r gate (INC-008), but the coupling page's raw tables do not. Deferred to a future pass.
- **PersDyn model validity.** The attractor force computation itself (Ornstein-Uhlenbeck mean-reversion from lag-1 autocorrelation) has construct validity assumptions that were not audited. Removing the labels does not validate the numeric values; it removes claims the numeric values do not support.
- **Methodology page.** The static `/methodology` page uses "rigid" and "malleable" in explanatory prose describing what the signals measure. This is editorial description of a model, not an instrument reading on a data point. Left intact.
- **Internal narrative generation.** `libSignals.ts` and `libDynamics.ts` use "rigid"/"malleable" in narrative text fed to the question generation prompt. This is internal context for Claude, not a user-facing claim. Left intact.

### Design principle established

Signal surfaces display measurements. Measurements are numbers with units and sample sizes. Interpretive labels ("rigid," "formulaic," "cognitive-dominant") are construct claims that require external validation before they can be presented as instrument readings. Until validated, show the number and let the reader interpret.

---

## INC-008: Observatory discovery badges -- statistical rigor pass

**Date:** 2026-04-22
**Type:** Methods correction (presentation layer was making unsupported statistical claims)

### What was wrong

The observatory discoveries section displayed coupling correlations with "strong" and "moderate" badges based on hardcoded thresholds: |r| >= 0.5 was "strong," |r| >= 0.3 was "moderate." These labels implied statistical confidence but had no significance testing behind them.

Specific problems:

1. **No sample-size gate on badge strength.** A correlation of r=0.55 from n=10 entries displayed as "strong" despite having p > 0.05 (critical r at n=10 is ~0.63). The badge claimed strength that the data could not support.

2. **No multiple-comparisons awareness.** The system tests 784 raw correlation pairs (147 behavioral + 385 semantic + 252 emotion-behavior, each across multiple lag values), reduced to 139 stored pairs via best-lag selection. Displaying the top results without any correction inflates the false-positive rate. (FDR correction is deferred to a future pass; this change addresses the sample-size gate only.)

3. **Stability analysis disconnected from badges.** `libCouplingStability.ts` computed rolling-window CV for emotion-behavior couplings but fed a separate page (`/observatory/coupling`). The discoveries page ignored stability entirely. A coupling could be flagged as unstable (CV >= 0.5) by the stability system and still display as "strong" in discoveries.

### Resolution

**Dynamic critical-r gate.** Replaced the hardcoded |r| >= 0.3 floor with `max(criticalR(n), 0.3)`, where `criticalR(n)` computes the two-tailed Pearson r significance threshold at alpha=0.05 using a Cornish-Fisher approximation of the t-distribution quantile (Abramowitz & Stegun 26.7.5, < 0.5% error for df >= 3). Correlations below this threshold are not displayed. The 0.3 floor preserves a practical relevance gate (~9% shared variance) at large n where weak correlations become technically significant.

Verified against published t-table values:

| n | criticalR(n) | max(rCrit, 0.3) |
|---|---|---|
| 10 | 0.6236 | 0.6236 |
| 15 | 0.5108 | 0.5108 |
| 20 | 0.4422 | 0.4422 |
| 25 | 0.3952 | 0.3952 |
| 30 | 0.3604 | 0.3604 |
| 50 | 0.2786 | 0.3000 |

**Two-state badge system.** Replaced "strong"/"moderate" with "established"/"provisional":
- **Established:** passes critical-r gate AND the emotion-behavior coupling is stable (CV < 0.5 from `libCouplingStability.ts`).
- **Provisional:** passes critical-r gate but either fails stability, stability data is unavailable, or the coupling is same-domain (behavioral-only or semantic-only).
- Below critical-r: not displayed.

**Stability wiring.** `synthesis.ts` now calls `computeCouplingStability()` and builds a lookup set of stable emotion-behavior pair keys. If the stability computation fails or returns empty (e.g., insufficient data for rolling windows), all badges default to "provisional."

### Known limitation

`libCouplingStability.ts` only analyzes emotion-behavior cross-domain pairs. Same-domain couplings (behavioral-only, semantic-only) can never reach "established" under this design. This is a structural asymmetry, not a bug. Extending the stability system to same-domain pairs is a phase-two follow-up.

### Files changed

| File | Change |
|---|---|
| `src/lib/utlCriticalR.ts` | New. Exports `criticalR(n)`. |
| `src/pages/api/observatory/synthesis.ts` | Dynamic r gate, stability wiring, two-state badges. |
| `src/pages/observatory/index.astro` | Badge CSS class mapping updated. |
| `GOTCHAS.md` | Two new entries documenting the badge asymmetry and the critical-r gate behavior. |

Zero schema changes. All coupling tables (`tb_coupling_matrix`, `tb_semantic_coupling`, `tb_emotion_behavior_coupling`) are read-only from this change.

### What this does NOT fix

- **FDR correction:** The 784-test multiple-comparisons surface is not corrected. The critical-r gate addresses single-test significance only. FDR is explicitly deferred.
- **Same-domain stability analysis:** Behavioral and semantic couplings have no convergence data.
- **Lag-selection inflation:** Best-lag selection (picking max |r| across 4-7 lags per pair) inflates the effective false-positive rate. The critical-r threshold does not account for this.

---

## INC-007: Daily delta timing fix and dead code removal

**Date:** 2026-04-22
**Type:** Architectural correction (design flaw, not a data incident)

### What was wrong

The session delta system (`libSessionDelta.ts`) was designed around a same-session assumption: compute the behavioral delta between calibration and journal writing in real time, and inject it into the observation prompt. This assumption was never valid. In the actual daily flow, the user submits the journal session first, then optionally does one or more calibration (free-write) sessions afterward. The delta could never be computed before the journal session's observation, because the calibration didn't exist yet.

Consequences:
- `runSessionDelta` was exported but never called from any code path.
- `formatSessionDelta` (observation prompt formatter) was exported but never called.
- `formatEnrichedCalibration` and `formatCalibrationDeviation` in `libSignals.ts` were exported but never called.
- `getCalibrationBaselines` and `CalibrationBaseline` in `libDb.ts` were exported but never called.
- `tb_session_delta` had 2 rows (from a manual test), despite 9 eligible day-pairs existing.
- `libGenerate.ts` was reading from `tb_session_delta` for delta trend context, but the table was effectively empty, so the delta trend section was silently absent from every generated question prompt.

Additionally, `libProfile.ts` had a column name mismatch: the SQL selected `bs.burst_char_count` but the JavaScript accessed `b.char_count`, causing P-burst consolidation ratios to silently compute on `undefined` values.

### Resolution

**Renamed:** `libSessionDelta.ts` to `libDailyDelta.ts`. The module now frames deltas as retrospective day-N+1 batch computations, not real-time session inputs.

**New:** `runDailyDeltaBackfill()` scans the entire history for dates where both a journal session and at least one calibration exist but no delta row has been computed. Idempotent (skips dates with existing rows, upserts as secondary safety net). Multi-calibration rule: last calibration of the day is used for pairing (closest to journal session, stabilized behavioral state).

**Wired in:** `runDailyDeltaBackfill()` runs at the top of `runGeneration()` in `libGenerate.ts`, before question generation, so delta trends are current when prompts are built.

**Removed (dead code):**
- `libSessionDelta.ts` (replaced by `libDailyDelta.ts`)
- `formatSessionDelta` (observation prompt formatter, never called)
- `formatEnrichedCalibration` from `libSignals.ts` (never called)
- `formatCalibrationDeviation` from `libSignals.ts` (never called)
- `CalibrationBaseline` interface + `getCalibrationBaselines` from `libDb.ts` (never called)

**Fixed:** `libProfile.ts` burst consolidation: `b.char_count` corrected to `b.burst_char_count` to match the SQL column name.

**Preserved (untouched):**
- `libCalibrationExtract.ts` (context tag extraction, fire-and-forget from every calibration submit)
- `libCalibrationDrift.ts` (drift snapshots from every calibration submit, not just last-of-day)
- `calibrate.ts` API route
- All db functions: `saveSessionDelta`, `getRecentSessionDeltas`, `getSameDayCalibrationSummary`, `SessionDeltaRow`

### Backfill result

First run computed 7 new delta rows (April 13, 16-21). 2 pre-existing rows (April 14-15) were skipped. April 22 skipped (no calibration yet). Total: 9 rows covering all eligible day-pairs. Re-run produced 0 new rows (idempotent). Delta magnitude is null for all rows (fewer than 10 days of history for z-score normalization).

### Behavior change in question generation

Before: `getRecentSessionDeltas(14)` returned 0-2 rows. The delta trend section was absent from the generation prompt. After: returns up to 9 rows. `formatCompactDelta` produces a `=== DAILY DELTA TRENDS ===` block showing per-date notable dimension shifts (>1 sigma) and 7-day trends. This is additive context for question selection, not a replacement for any existing signal.

---

## INC-006: Reconstruction residual reproducibility

**Date:** 2026-04-22
**Type:** Methods event (architectural upgrade, not an incident)
**Design doc:** `docs/designs/residual-reproducibility.md`
**Commits:** `9d193ea` through `a4ea6b5` (7 commits)

### What changed

Reconstruction residuals are now reproducible scientific artifacts. Every residual computed after 2026-04-22 stores the exact inputs needed to regenerate the ghost that produced it:

- **PRNG seed** (`avatar_seed TEXT`): the u64 seed used by the ghost engine, serialized as a decimal string (JS cannot represent u64 without precision loss).
- **Profile snapshot** (`profile_snapshot_json JSONB`): the exact JSON passed to `generateAvatar()` at computation time (3.1KB measured, the curated object with field renaming, not the full 31KB database row).
- **Corpus hash** (`corpus_sha256 TEXT`): SHA-256 of the serialized corpus JSON, for integrity verification at regeneration time.
- **Topic string** (`avatar_topic TEXT`): the topic passed to `generateAvatar()` (currently equals question text).

Schema: migration `011_residual_reproducibility.sql`. 130 pre-existing rows have NULL for all four columns (pre-reproducibility-era artifacts).

### Rust changes

- `avatar::compute()` returns `SeededAvatarResult` (result + seed). The seed is no longer discarded.
- `AvatarOutput` (napi boundary) includes `seed: String`.
- New napi entry point `regenerate_avatar` takes an explicit seed string and calls `compute_seeded()` directly.
- Cross-build ghost determinism verified by CI: `tests/avatar_reproducibility.rs` snapshots all 5 adversary variants with fixed (corpus, profile, seed) and diffs across clean rebuilds. All 7 snapshots (2 signal + 5 avatar) bit-identical.

### Verification on production data

The reproducibility chain was verified end-to-end on real production data using `src/scripts/verify-residual-integration.ts`. The script deletes a pre-reproducibility-era residual, recomputes it via the production pipeline (which now stores seed + profile + hash + topic), then regenerates the ghost from stored inputs and compares per-signal.

**Question 86** (seed `1776843941639`, 312 keystrokes, 40 words, "Name as many musical instruments as you can..."):

| Signal | Family | Stored | Recomputed | Match |
|--------|--------|--------|------------|-------|
| permutation_entropy | dynamical | 0.9966825625 | 0.9966825625 | EXACT |
| dfa_alpha | dynamical | 0.7261043441 | 0.7261043441 | EXACT |
| rqa_determinism | dynamical | 0.6937524329 | 0.6937524329 | EXACT |
| rqa_laminarity | dynamical | 0.8164168937 | 0.8164168937 | EXACT |
| te_dominance | dynamical | 0.0000000000 | 0.0000000000 | EXACT |
| sample_entropy | motor | 0.6523756287 | 0.6523756287 | EXACT |
| motor_jerk | motor | 439.0112425783 | 439.0112425783 | EXACT |
| lapse_rate | motor | 3.8544461387 | 3.8544461387 | EXACT |
| tempo_drift | motor | 4.2073461319 | 4.2073461319 | EXACT |
| perplexity | perplexity | 67.3776199753 | 67.3776199753 | EXACT |

**Question 85** (seed `1776844011412`, 566 keystrokes, 77 words, "Describe the taste of black pepper to someone who has never..."):

| Signal | Family | Stored | Recomputed | Match |
|--------|--------|--------|------------|-------|
| permutation_entropy | dynamical | 0.9932871508 | 0.9932871508 | EXACT |
| dfa_alpha | dynamical | 0.7434630019 | 0.7434630019 | EXACT |
| rqa_determinism | dynamical | 0.6764910266 | 0.6764910266 | EXACT |
| rqa_laminarity | dynamical | 0.7843978488 | 0.7843978488 | EXACT |
| te_dominance | dynamical | 5.7556321802 | 5.7556321802 | EXACT |
| sample_entropy | motor | 0.7015220898 | 0.7015220898 | EXACT |
| motor_jerk | motor | 496.6321126694 | 496.6321126694 | EXACT |
| lapse_rate | motor | 4.3036414353 | 4.3036414353 | EXACT |
| tempo_drift | motor | -9.7296811544 | -9.7296811544 | EXACT |
| perplexity | perplexity | 83.2449181719 | 83.2449181719 | EXACT |

Both questions: 10/10 dynamical + motor + perplexity signals bit-identical. `ex_gaussian_tau` and `tau_proportion` were null on both stored and recomputed (insufficient data for MLE), correctly matching as null=null.

Semantic signals (idea density, lexical sophistication, epistemic stance, integrative complexity, deep cohesion, text compression ratio) were excluded from verification. They depend on external APIs (Claude, Voyage) that can change behavior independently of Alice's code. Per design, semantic residuals are classified as externally-dependent and are not covered by the bit-reproducibility guarantee.

### Scope of the guarantee

**Dynamical and motor residuals are bit-reproducible end to end.** The full chain: stored seed + stored profile + reconstructed corpus (verified by SHA-256) -> `regenerate_avatar` (seed-deterministic, build-stable per CI) -> signal computation (Neumaier summation, deterministic iteration, pinned toolchain per CI) -> residual values identical to stored.

**Semantic residuals are not.** They are stored and verifiable against regenerated ghost text, but external API drift means bit-identity cannot be guaranteed.

**Pre-reproducibility-era residuals (avatar_seed IS NULL) are frozen artifacts.** Their stored values are the permanent record. They cannot be independently regenerated because the seed and profile state at computation time were not persisted.

### Design lifecycle

1. **Gap identified** (2026-04-22): ghost output is ephemeral, residuals cannot be verified.
2. **Design deferred** (2026-04-22): no current consumer for cross-build ghost determinism.
3. **User challenge** (2026-04-22): "residuals should be reproducible scientific artifacts, not frozen measurements."
4. **Design approved** (2026-04-22): full design doc covering seed persistence, profile snapshotting (Option A: inline JSON, measured at 3.1KB), corpus SHA-256, topic persistence, regeneration API, CI enforcement, verification failure procedure.
5. **Implementation** (2026-04-22): 7 commits, each independently verified (clippy, unit tests, reproducibility check, CI).
6. **Verification** (2026-04-22): integration test on production data, 10/10 signals bit-identical on two questions.

### Scope note

The reproducibility claim is explicitly scoped to dynamical and motor signals. Process signals are computed by the same Rust engine with the same numerical discipline but are not in the cross-build snapshot test. Semantic signals depend on external APIs and are inherently outside build-time reproducibility guarantees. Process signal verification is tracked as a followup below.

---

## Followup: Process signal cross-build verification

**Date noted:** 2026-04-22
**Type:** Open followup (scope boundary, not an incident)
**Priority:** Low. Close before Stage 2 if not sooner.

Process signals (pause/burst classification, R-burst detection, strategy shifts, text reconstruction) are not currently in the cross-build snapshot test. The numerical discipline used in those functions is the same as dynamical/motor (Neumaier summation, no HashMap iteration on output paths), so drift is unlikely, but the guarantee is not enforced.

### To close

Construct a realistic keystroke event fixture including:

1. Cursor position tracking
2. Deletion events (both single-character and multi-character)
3. Insertion events at non-terminal positions (I-bursts)
4. UTF-16 offsets for multi-byte characters (emoji, curly quotes)
5. Enough editing history to exercise strategy shift detection

Add as a new integration test in `tests/reproducibility.rs` (or a new `tests/process_reproducibility.rs`) writing to `REPRO_SNAPSHOT_DIR`. The existing `reproducibility-check.sh` diff loop and CI workflow pick up new snapshot files automatically.

### Why this is low priority

Process signal outputs are mostly counts and ratios (burst count, pause percentages, deletion rates, R-burst sizes, strategy shift count). These are less sensitive to floating-point accumulation order than the iterated nonlinear computations in dynamical and motor signals (PE, DFA, RQA, transfer entropy, ex-Gaussian MLE). The riskiest process signal path is windowed strategy shift detection, which involves a comparison of burst length distributions across session halves.

---

## INC-005: Reproducibility check wired into CI

**Date:** 2026-04-22
**Type:** Methods event (not an incident)
**Commit:** 54e84a1 (merge), e43fadb (documentation)

### What changed

The two-clean-build reproducibility check (`reproducibility-check.sh`) is now enforced automatically by GitHub Actions on every PR touching `src-rs/**`, `package.json`, `package-lock.json`, or the workflow file itself. Workflow: `.github/workflows/signal-reproducibility.yml`. Runner: `macos-14` (Apple M1, ARM64), matching the pinned `aarch64-apple-darwin` toolchain.

CI step order: clippy with warnings-as-errors, unit tests (`cargo test --lib`), then the full reproducibility check (two clean release builds, byte-for-byte snapshot diff). Caches Rust toolchain and cargo registry; never caches `target/` (clean builds are the point).

### Why this is a methods event

INC-002 established the bit-identity guarantee and built the verification infrastructure. INC-004 closed numerical edge cases. But enforcement was a paragraph in CLAUDE.md telling agents to run the check before committing. That is a soft guarantee. It depends on discipline, not mechanism.

CI makes the guarantee structural. A PR that breaks bit-identity cannot merge. The enforcement authority is the workflow, not agent memory.

### Verification

First CI run on PR #1: all steps passed in 1m54s. Clippy zero warnings, unit tests passed, reproducibility check PASS (bit-identical snapshots across clean rebuilds on `macos-14`).

### Golden signal values (fixture session, 100 keystrokes)

These are the exact values produced by the deterministic fixture session in `tests/reproducibility.rs`. Every clean rebuild on the pinned toolchain produces these numbers to the bit. The CI reproducibility check diffs these JSON snapshots byte-for-byte across two clean builds.

**Dynamical signals:**

| Signal | Value |
|--------|-------|
| permutation_entropy | 0.8166391588527645 |
| pe_spectrum | [0.8167, 0.6886, 0.5546, 0.4456, 0.3633] |
| dfa_alpha | 0.4822765767735998 |
| rqa_determinism | 0.6141015921152388 |
| rqa_laminarity | 0.7035633055344959 |
| rqa_trapping_time | 3.0984974958263773 |
| rqa_recurrence_rate | 0.1910763436187165 |
| te_hold_to_flight | 0.16977971674099246 |
| te_flight_to_hold | 0.05842298195931006 |
| te_dominance | 2.906043324855263 |

**Motor signals:**

| Signal | Value |
|--------|-------|
| sample_entropy | 0.7388353647313733 |
| motor_jerk | 49.40374729293968 |
| lapse_rate | 0.0 |
| tempo_drift | 0.7383869840763395 |
| iki_compression_ratio | 0.42954545454545456 |
| ex_gaussian_mu | 22.192482197745814 |
| ex_gaussian_sigma | 16.22382081065317 |
| ex_gaussian_tau | 10.000067202433417 |
| tau_proportion | 0.31063296908003635 |
| hold_flight_rank_corr | -0.02803064616827978 |
| adjacent_hold_time_cov | -0.048294022900374656 |

---

## INC-004: Numerical edge case closure (batch)

**Date:** 2026-04-21/22
**Severity:** produces-wrong-number (4 items)
**Discovery method:** Adversarial defect audit, systematic sweep of all signal functions for inputs that produce wrong numbers silently.

### What was wrong

Four separate numerical edge cases, none individually dramatic, all silently producing wrong or non-finite values under specific input conditions:

1. **`digamma(x)` for x <= 0** (`stats.rs:171`). The recurrence `result -= 1.0 / x` divides by zero when x=0, propagating `-inf` through the transfer entropy estimator. Not reachable from current call sites (KSG always passes x >= 1.0), but no guard prevented future callers from hitting it.

2. **`te_dominance` returning `f64::INFINITY`** (`dynamical.rs:472`). When `te_flight_to_hold` was zero but `te_hold_to_flight` was positive, the ratio `hf / fh` produced infinity. This value was stored to PostgreSQL as float8 and could break downstream arithmetic or JSON serialization. Occurred when flight-to-hold transfer entropy rounded to exactly zero.

3. **`exgauss_log_pdf` overflow** (`motor.rs:293`). The term `(mu - x) / tau` overflows to `-inf` for extreme flight times (e.g., 4999ms with mu=80, tau=30). A single outlier that passes the IQR filter can poison the entire MLE log-likelihood sum, silently forcing fallback to method-of-moments without any error signal.

4. **Exact `== 0.0` variance comparisons** (`motor.rs:156, 483, 563`). Four sites compared standard deviation or variance against exactly zero. Near-zero variance (e.g., all values 100.0 except one at 100.0 + 1e-15) passes the guard, then divides by the epsilon-small variance, producing astronomically large autocorrelation, covariance, or correlation values.

### Resolution

1. `digamma`: added `if x <= 0.0 { return f64::NAN; }` guard. Tests: `digamma_zero_returns_nan`, `digamma_negative_returns_nan`.
2. `te_dominance`: simplified to `if fh_val > 0.0 { Some(hf/fh) } else { None }`. Dominance is undefined, not infinite, when the denominator is zero.
3. `exgauss_log_pdf`: clamped exponential term to `.max(-700.0)`. `exp(-700)` is effectively zero but finite, preventing `-inf` propagation.
4. All four variance sites: changed `== 0.0` to `< 1e-20`.

### Scope of impact

Items 1 and 3 were latent (no known session triggered them). Item 2 may have produced infinity values in `tb_dynamical_signals.te_dominance` for sessions where `te_flight_to_hold` was exactly zero. Item 4 is theoretically triggerable but extremely unlikely given keystroke timing variance.

No data reprocessing performed for these items. The alignment fix reprocessing (INC-001) already rebuilt all dynamical signals with these fixes applied.

---

## INC-003: Silent FFI boundary parse failures

**Date:** 2026-04-21
**Severity:** produces-no-number-when-it-should
**Discovery method:** Adversarial defect audit, sweep of all `unwrap_or_default` / `match Err(_) =>` patterns.

### What was wrong

The napi entry points `compute_dynamical_signals` and `compute_motor_signals` in `lib.rs` caught JSON parse errors and returned default structs (all fields `None` / 0). The TypeScript caller received an all-null result indistinguishable from "session too short to compute." A malformed JSON payload, a schema mismatch, and a genuinely empty session all looked identical.

Separately, `avatar::compute` used `serde_json::from_str(corpus_json).unwrap_or_default()` which silently returned an empty vec on parse failure, then hit the `texts.is_empty()` check and returned `InsufficientData` -- technically correct but hiding the real cause.

### Resolution

**napi boundary:** Added `parse_error: Option<String>` field to `DynamicalSignals` and `MotorSignals` structs. On parse failure, the field contains the serde error message. On success, it's `None`. The TS layer can now distinguish "Rust computed nothing from valid input" from "Rust never got valid input."

**Avatar:** Replaced `unwrap_or_default()` with `SignalError::ParseError(format!("corpus JSON: {e}"))` propagation. Added new `ParseError(String)` variant to `SignalError` enum in `types.rs`.

### Scope of impact

No known production incident. The keystroke stream JSON is constructed by the client and has never been malformed in practice. This was a defensive fix for robustness, not a response to data loss.

---

## INC-002: Floating-point summation order / bit-reproducibility sweep

**Date:** 2026-04-21/22
**Severity:** produces-wrong-number (summation order changes results at ULP level; accumulated over sessions, this constitutes a measurement reproducibility failure)
**Discovery method:** Comparison of dynamical signals across Rust recompilations during INC-001 data reprocessing. DFA alpha and PE showed last-significant-digit drift for 4/26 sessions despite identical inputs. Initially misdiagnosed as "LLVM optimizer nondeterminism, not a code bug." Corrected after user challenge.

### What was wrong

Three independent sources of floating-point nondeterminism:

1. **Naive summation in 17+ accumulation sites.** `stats::mean`, `stats::std_dev`, `stats::pearson`, `motor::iki_autocorrelation`, `motor::ex_gaussian_fit`, `dynamical::dfa_alpha`, `dynamical::transfer_entropy`, and others used `.iter().sum()` or `sum += x` loop accumulators. These are sensitive to the order the compiler processes elements (auto-vectorization, loop unrolling). Different optimization passes across recompilations produced different results at the ULP level.

2. **HashMap iteration in permutation entropy** (`dynamical.rs:51`). `pattern_counts: HashMap<Vec<usize>, u64>` was iterated at line 67 to compute the entropy sum. HashMap iteration order is randomized per-process in Rust. The entropy sum `S = -sum(p * log2(p))` depends on the order of addends because floating-point addition is not commutative. Different runs of the same binary could produce different PE values.

3. **HashMap iteration in digraph latency profile** (`motor.rs:265`). The `profile: HashMap<String, f64>` was serialized to JSON by serde, which preserves HashMap iteration order. The JSON field order was nondeterministic across runs. Additionally, the top-10 digraph selection (`sort_by_key(Reverse(len))`) had nondeterministic tie-breaking when multiple digraphs had the same frequency.

### How it was discovered

During INC-001 data reprocessing, the old-vs-new comparison showed DFA alpha, PE, and RQA deltas at the 14th-15th significant digit for 4 sessions, despite identical IKI series (verified by iki_count match and PE bit-identity for 3/4 sessions). Initially attributed to LLVM optimizer variance and documented as "not a code bug." User correctly rejected this framing: a measurement instrument doesn't get to hand-wave ULP drift.

Issues 2 and 3 were discovered when building the cross-build reproducibility check. The within-binary reproducibility test (`motor_signals_reproducible`) failed on the digraph profile before the HashMap was converted to BTreeMap.

### Resolution

**Summation:** Implemented Neumaier compensated summation (`stats.rs`): `neumaier_sum`, `neumaier_sum_map`, `NeumaierAccumulator`. Converted all 17 accumulation sites across `stats.rs`, `motor.rs`, and `dynamical.rs`. Neumaier is an improved Kahan algorithm that handles inputs of varying magnitude. Error bound: O(eps) independent of n.

**PE HashMap:** Converted `pattern_counts` from `HashMap<Vec<usize>, u64>` to `BTreeMap<Vec<usize>, u64>` for deterministic iteration.

**Digraph profile:** Converted output `HashMap<String, f64>` to `BTreeMap<String, f64>` for deterministic JSON serialization. Added secondary sort key (`a.0.cmp(&b.0)`) for deterministic tie-breaking in top-10 selection.

**Toolchain pinning:** Created `src-rs/rust-toolchain.toml` pinning Rust 1.95.0 + LLVM 22.1.2 + `aarch64-apple-darwin` target. FMA determinism guaranteed by fixed target (always has NEON FMA) and fixed LLVM version.

**Verification:** `reproducibility-check.sh` builds twice from clean state, computes signals on fixture session, diffs byte-for-byte. Result: **PASS. Bit-identical across clean rebuilds.** Available as `npm run reproducibility-check`.

### Scope of impact

Summation order sensitivity affected all signal values at the ULP level (~1e-14 relative). The PE HashMap bug was more severe: it could change PE values by a meaningful amount across runs (same binary, different process). The digraph profile bug changed JSON field order across runs, which could affect downstream consumers that depend on key ordering.

No data reprocessing performed for this incident specifically. The INC-001 reprocessing already used the fixed code.

### Followups

- `src-rs/REPRODUCIBILITY.md` documents the guarantee, supported targets, and failure protocol.
- CLAUDE.md updated to require `npm run reproducibility-check` before committing signal changes.
- Process signals (`process.rs`) are not covered by the cross-build check due to text reconstruction fixture complexity. Tracked as a future improvement.

---

## INC-001: HoldFlight vector misalignment

**Date:** 2026-04-21
**Severity:** produces-wrong-number
**Discovery method:** Adversarial defect audit of the Rust signal engine, specifically reviewing `types.rs` for correctness under adversarial input (overlapping keystrokes, negative flight times, out-of-order events).

### What was wrong

`HoldFlight::from_stream` in `src-rs/src/types.rs` filtered hold times and flight times independently. For each keystroke event, the hold time (`key_up - key_down`) was pushed to the holds vector if valid (0-2000ms), and the flight time (`key_down[i] - key_up[i-1]`) was pushed to the flights vector if valid (0-5000ms). These two filters ran independently.

The problem: rollover typing, where the next key is pressed before the previous key is released (`key_down[i] < key_up[i-1]`), produces a negative flight time. The flight filter rejects it, but the hold filter for the same event accepts the hold. This shifts the flights vector by one position relative to the holds vector. Every subsequent pair `(holds[k], flights[k])` now refers to different keystroke events.

Transfer entropy and RQA computed on these misaligned pairs measured the correlation between holds from one set of events and flights from a completely different set of events.

### How it was discovered

Not from observing bad outputs. The TE values were plausible (positive, finite, in expected range). The bug was found during a systematic sweep for correctness under adversarial input, specifically asking "what happens if hold is valid but flight isn't for the same event?"

A diagnostic script (`scripts/diagnose-holdlight-alignment.ts`) was written to quantify the impact before any fix was applied. It queried every session's keystroke stream and counted events where hold and flight validity diverged.

### Scope of impact

- **27/27 sessions affected** (100% contamination rate).
- **6,589 total misaligned events** across all sessions.
- **Root cause:** Rollover typing. Negative flight times from `key_down[i] < key_up[i-1]`. This is normal fast typing behavior, not an edge case. Sessions had 40-757 misaligned events each.
- **TE values:** Mean relative shift 130%+. Maximum relative shift 804% (Q6 `te_hold_to_flight`: 0.0133 old, 0.1201 new). 5 sign flips across 52 TE measurements (26 sessions x 2 directions).
- **RQA values:** Unaffected. RQA is computed on the IKI series, not hold-flight pairs.
- **PE, DFA:** Unaffected. These use IKI series only.
- **Vector length example:** Q7 had holds=1488, flights=730. `aligned_len()` truncated to 730, but `holds[k]` for k < 730 corresponded to completely different events than `flights[k]`.

### Resolution

**Fix:** Changed `HoldFlight::from_stream` to filter hold and flight together. Only push both when both are valid for the same event. Added `debug_assert_eq!` in `aligned_len()` to enforce the invariant.

```rust
// New: paired filtering
for i in 1..stream.len() {
    let ht = stream[i].key_up_ms - stream[i].key_down_ms;
    let ft = stream[i].key_down_ms - stream[i - 1].key_up_ms;
    if ht > 0.0 && ht < 2000.0 && ft > 0.0 && ft < 5000.0 {
        holds.push(ht);
        flights.push(ft);
    }
}
```

**Tests:** 4 regression tests in `types.rs`:
- `holdflight_vectors_always_same_length` (rollover input)
- `holdflight_pairs_refer_to_same_event` (value verification)
- `holdflight_excludes_invalid_hold_with_valid_flight`
- `holdflight_aligned_len_equals_vector_length`

**Data reprocessing protocol:**
1. Snapshot: `tb_dynamical_signals_pre_alignment_fix_20260421` (26 rows, pristine copy of original data).
2. Recomputed into staging table `tb_dynamical_signals_v2` (27 rows: 26 existing + Q65 which previously had no dynamical signals).
3. Old-vs-new comparison performed for every session and every numeric signal: absolute delta, relative delta, sign flip, null transitions. TE severely contaminated (130%+ mean shift). RQA < 1% shift (floating-point noise from recompilation, not alignment-related). PE/DFA zero delta.
4. Atomic table swap: `tb_dynamical_signals` renamed to `tb_dynamical_signals_contaminated_20260421`, staging table renamed to `tb_dynamical_signals`.
5. Post-swap verification: row count 27, spot-check Q68 `te_flight_to_hold` = 0.0000 (was 0.4947).

**Preserved artifacts:**
- `tb_dynamical_signals_pre_alignment_fix_20260421`: pristine snapshot (26 rows)
- `tb_dynamical_signals_contaminated_20260421`: original live data (26 rows)
- `scripts/diagnose-holdlight-alignment.ts`: diagnostic script
- `scripts/recompute-dynamical-v2.ts`: reprocessing script

### Followups

- **Flight time upper bound** (`ft < 5000.0`) may be too aggressive for deep reflection sessions. Q7 had a 5093ms flight flagged as invalid that is almost certainly a legitimate cognitive pause. The threshold conflates journal sessions (deep reflection, long pauses expected) with calibration sessions (timed typing, long pauses are distraction). Documented in GOTCHAS.md as a separate follow-up with analysis plan. Not bundled with the alignment fix.

---

# Deferred for Data Depth

The following components of the semantic measurement infrastructure are intentionally deferred pending sufficient longitudinal data accumulation. Each is named here to distinguish intentional scope discipline from incomplete work, and to specify the empirical conditions under which each becomes appropriate to build or validate. The instrument's current scope makes no claims that depend on these components.

## DEF-001: Drift detection layer

**What it is:** Change-point detection on the semantic trajectory z-score series (`tb_semantic_trajectory`), intended to identify sustained shifts in within-person semantic measurement over time. Candidate methods include CUSUM, Bayesian online changepoint detection, and comparable sequential analysis techniques.

**Why it is deferred:** Change-point detection algorithms require a sufficiently long z-score series to distinguish genuine signal from noise. The current trajectory depth is approximately 6-7 sessions per signal (as of 2026-04-23). At this depth, change-point analysis produces statistically meaningless output dominated by noise. Running these methods on short series does not produce "preliminary results" -- it produces artifacts indistinguishable from false positives.

**Empirical condition for revisiting:** Approximately one year of accumulated daily trajectory data (300+ sessions per signal) provides the minimum series length where change-point methods produce defensible output. The exact threshold is itself an empirical question to be revisited as the corpus deepens. The gating mechanism (`tb_semantic_trajectory.gated`) already distinguishes reliable from unreliable z-scores at the per-session level; drift detection is the longitudinal extension of this principle.

**Current handling:** Trajectory z-scores (global and topic-matched) are computed and persisted per session in `tb_semantic_trajectory`. The z-score series is the input that drift detection will eventually consume. When the data depth justifies it, drift detection becomes a downstream analysis layer over the existing z-score series. No data is lost or unrecoverable by deferring. The `gated` column ensures that only z-scores computed from baselines with n >= 10 (MINIMUM_N) are eligible for downstream analysis.

## DEF-002: Tier separation of stable versus volatile semantic signals

**What it is:** Classification of each of the seven semantic signals (idea density, lexical sophistication, epistemic stance, integrative complexity, deep cohesion, text compression ratio, referential cohesion) as trait-like (stable within-person across sessions, useful for longitudinal trajectory) or state-like (variable session-to-session, more reflective of immediate context than long-term cognitive trajectory).

**Why it is deferred:** Population-level literature provides general guidance. Pakhomov et al. (2013) and the propositional density tradition suggest idea density and lexical sophistication are typically trait-like; epistemic stance and integrative complexity are more state-dependent and responsive to question provocation. However, within-person classification for any specific user must be validated empirically against accumulated data, not assumed from population norms. Trait-versus-state classification depends on intraclass correlation (ICC) computed across many within-person observations. Applying population-level ICC estimates to a single user's data is a Simpson's paradox risk: the within-person variance structure can differ substantially from the between-person variance structure that population studies measure.

**Empirical condition for revisiting:** Approximately 3 to 6 months of accumulated daily session data per signal provides sufficient within-person variance to compute meaningful intraclass correlations and validate the trait-versus-state classification empirically. At 7 sessions per signal, ICC estimates are unreliable.

**Current handling:** All seven semantic signals are computed, baselined via Welford's online algorithm (`tb_semantic_baselines`), and trajectory-tracked under identical methodology (`tb_semantic_trajectory`). The Phase Two analysis layer that interprets these signals will eventually weight trait-like and state-like signals differently, but the measurement itself is uniform until the empirical classification is available. This is the correct default: measure everything the same way, then differentiate interpretation based on evidence about each signal's within-person stability.

## DEF-003: Baseline model sophistication

**What it is:** The running distribution store currently uses Welford's online algorithm to maintain running mean and variance for each semantic signal across all prior non-calibration sessions. More sophisticated baseline models exist, including exponentially weighted moving averages (EWMA, which would weight recent sessions more heavily than ancient ones), seasonal decomposition (which would separate cyclical patterns such as weekly or monthly variation from genuine longitudinal trajectory), and regime-switching models (which would accommodate discrete baseline shifts rather than treating the baseline as stationary).

**Why it is deferred:** Welford is mathematically correct and sufficient for the current scope. It computes exact running mean and variance with O(1) memory per signal, updates incrementally, and makes no assumptions about the data's temporal structure beyond stationarity. The question of whether more sophisticated baseline models would improve the within-person trajectory measurement is an empirical question that requires sufficient data to evaluate. Premature commitment to a specific alternative baseline model risks encoding assumptions about the data's structure (recency weighting implies recent sessions are more representative; seasonal decomposition implies cyclical patterns exist; regime-switching implies discrete baseline shifts occur) that may not hold for this instrument's data.

**Empirical condition for revisiting:** Substantial accumulated data (likely 1 to 2 years) is required to evaluate whether the assumption of stationary baselines holds, whether seasonal patterns exist in within-person semantic measurement, and whether weighting schemes would meaningfully improve trajectory detection over the simple Welford baseline. Until this evidence exists, the simple-and-correct choice is preferred over the sophisticated-but-unjustified choice.

**Current handling:** Welford running statistics are computed and persisted in `tb_semantic_baselines`. The trajectory z-scores produced from these baselines are mathematically valid under the assumption of stationary within-person distributions. If future evidence challenges this assumption, the historical raw signal values remain available in `tb_semantic_signals` for re-baselining under alternative models. The backfill script (`src/scripts/backfill-semantic-baselines.ts`) demonstrates that baselines can be regenerated from scratch against the full historical corpus, so the choice of baseline model is not a one-way door.

---

## DEF-004: Recursive language model architecture for question generation

**What it is:** The question generation pipeline (`libGenerate.ts`) currently pre-assembles a fixed context window (recent entries, RAG-similar entries, contrarian entries, reflections, behavioral signals, dynamics, life context) and sends it to Claude in a single call. All retrieval decisions are made before the LLM reasons over the context. Recursive Language Models (Zhang, Kraska & Khattab 2026; arXiv:2512.24601v2) demonstrate an alternative: the LLM treats the corpus as a queryable environment, programmatically decomposing and recursively processing slices of context via sub-LM calls inside a REPL. In benchmarks, RLMs outperform vanilla LLMs and retrieval agents even on shorter contexts (91.3% vs 51.0% on BrowseComp+ at comparable cost), because the quality gain comes from how the model reasons over context, not from fitting more of it.

**Why it is deferred:** At n=65 sessions the pre-assembled context fits comfortably in Claude's context window and the fixed retrieval strategy (embedding similarity + recency weighting + contrarian distance) covers the corpus adequately. The RLM pattern becomes valuable when the corpus is large enough that pre-selection misses important context, or when question quality plateaus because the retrieval strategy cannot surface the right entries for novel question directions.

**Empirical condition for revisiting:** Corpus size exceeding approximately 200 sessions (roughly 6 to 8 months of daily use), or observable plateau in question quality despite adequate signal and semantic context. At that scale, the generation model would benefit from actively querying the corpus (embedding search, signal lookups, temporal filtering) as part of its reasoning process rather than receiving a pre-curated package.

**Current handling:** The RAG stack (Qwen3-Embedding-0.6B via TEI, pgvector HNSW, `libRag.ts` retrieval with recency-weighted re-ranking and contrarian search) is the compression layer. It reduces the corpus to a curated context window before Claude sees it. The paper is archived locally at `systemDesign/rl_models.pdf`.

---

These deferments reflect a deliberate principle: the instrument's measurement methodology should commit to the simplest defensible approach at each layer, with more sophisticated approaches deferred until accumulated data justifies the additional complexity. This protects the methodology from premature optimization and preserves the option to revisit each layer as the longitudinal corpus deepens. Nothing in the current scope of the instrument depends on these deferred components; their absence is by design, not oversight.
