# Migration 030 — Resumption Handoff

Updated 2026-04-26. Stop point: Step 5 batch 1 of 4 (lib batch), 3 of 21 files
complete. **No problem with the work** — paused for context-window discipline.
Resume in a fresh chat session by reading this file end-to-end.

## 1. Context

Migration 030 unifies the owner/subject schema by adding `subject_id INT NOT NULL`
to every behavioral table, dissolving the Phase 6a subject-variant tables
(`tb_subject_responses`, `tb_subject_session_summaries`, `tb_scheduled_questions`).
The migration SQL is written, dry-run-verified against a local Postgres copy of
production, and ready to apply via `deploy/run-migration.sh` — but the cutover
runs as Step 9, after the application code is fully threaded with `subjectId`.

We are mid-rollout in Step 5: updating ~47 caller files to pass `subjectId`
through to the unified `libDb` functions. Step 5 is broken into four batches
(lib → api → scripts → tests) with per-batch test runs.

## 2. The 10-step plan

| # | Step | Status | Description |
|---|---|---|---|
| 0 | Surface unknowns | ✅ done | Read divergence file, listed 12 aggregation hotspots, mapped scheduled_for assumptions, write-path pass |
| 1 | Write migration SQL | ✅ done | `db/sql/migrations/030_unify_subject_id.sql` with backfill, verifications, drops commented out |
| 2 | Dry-run on branch DB | ✅ done | Local `alice_migration_test` DB built from `pg_dump` of Supabase, migration ran clean, runbook produced |
| 3 | Update `dbAlice_Tables.sql` | ✅ done | Canonical schema rewritten, three-way verified byte-equivalent to migration output |
| 4 | Thread `subjectId` through `libDb.ts` | ✅ done | ~70 functions updated, `OWNER_SUBJECT_ID = 1` constant added, 459 tsc errors surfaced as Step 5 checklist |
| 5 | **Mechanical query updates in batches** | 🟡 **in progress** | batch 1 (lib): 3/21 done — see §3 below |
| 6 | Aggregation hotspots one at a time | pending | 12 hotspots from Step 0 §C — each gets explicit scoping + a two-subject test |
| 7 | Lint rule for unscoped queries | pending | Repo-level check flagging queries against unified tables that lack `subject_id` |
| 8 | Encryption uniformity | pending | Re-encrypt 72 owner responses + 44 calibration context rows + JSONB streams uniformly |
| 9 | Drop empty subject-variant tables + run migration on prod | pending | Uncomment Block 7 of 030, run via `deploy/run-migration.sh` against Supabase |
| 10 | End-to-end verification | pending | Owner journal, ash journal, signals, calibration baseline, drift |

The full plan with constraints lives in this conversation (`Approved: Option A. Proceed.` user turn defining all 10 steps).

## 3. Step 5 batch structure

| Batch | Scope | Files | Status |
|---|---|---|---|
| 1 | `src/lib/*` (excluding `libAliceNegative/*` which gets minimal touch) | 21 | 🟡 3 done, 18 remaining |
| 2 | `src/pages/api/*` | ~15 | pending |
| 3 | `src/scripts/*` and `scripts/*` (excluding `scripts/archive/*`) | ~17 | pending |
| 4 | `tests/db/*` | 3 (`signalJobs.test.ts`, `engineProvenance.test.ts`, `fieldMaps.test.ts`) | pending |

Note: `libAliceNegative/*` (6 files) gets the lightest possible mechanical
touch as part of batch 1 cleanup — pass `subjectId` through, no improvements,
per the AN deprioritization. Listed in §5 below.

## 4. Files completed in batch 1

| File | What changed |
|---|---|
| `src/lib/libSignalFieldMaps.ts` | Added `'subject_id'` to `STRUCTURAL_COLUMNS` set so the fieldMaps DB test admits the new denormalized column |
| `src/lib/libSignalWorker.ts` | `runJob` reads `job.subject_id` and propagates it to `runResponsePipeline` / `runCalibrationPipeline` and `stampEngineProvenance`. Both pipelines defensively scope their internal SQL by `subject_id`. Calls into `computePriorDayDelta`, `runGeneration`, `renderWitnessState`, `embedResponse`, `computeAndPersistDerivedSignals`, `runCalibrationExtraction`, `snapshotCalibrationBaselinesAfterSubmit` all pass `job.subject_id` |
| `src/lib/libSignalPipeline.ts` | `computeAndPersistDerivedSignals(subjectId, questionId)` threads `subjectId` through 4 internal helpers (`getKeystrokeStream`, `getEventLogJson`, `getResponseText`, `getSessionInfo`) and 18 libDb/lib calls. `saveSessionIntegrity` now passes `subjectId` in the input object. All `logError` ctx blobs include `subjectId` |

## 5. Files remaining in batch 1 (in tackle order)

Tackle small/leaf files first to make rapid progress, then the larger ones:

1. `src/lib/libProfile.ts` (5 errors) — `updateProfile(subjectId, questionId)`. Aggregation hotspot C — six SELECTs that need `subject_id` scoping. **§6 of the plan** will rework this in detail; for now, mechanical add of `WHERE q.subject_id = ${subjectId}` to each JOIN to `tb_questions` is sufficient.
2. `src/lib/libRag.ts` (4 errors) — `retrieveSimilar`, `retrieveSimilarMulti`, `retrieveContrarian` all take `subjectId`, propagate to `searchVecEmbeddings`.
3. `src/lib/libDailyDelta.ts` (5 errors) — `computePriorDayDelta(subjectId, currentDate)`, `runDailyDeltaBackfill(subjectId)`. Multiple SQL queries inside need `subject_id` scoping (these overlap hotspots I/J/K, defer detailed rework to Step 6).
4. `src/lib/libReconstruction.ts` (4 errors) — `computeReconstructionResidual(subjectId, questionId)`. Hotspot D — avatar corpus per subject. Mechanical add for now; §6 will validate.
5. `src/lib/libCalibrationDrift.ts` (~5 errors) — `snapshotCalibrationBaselinesAfterSubmit(subjectId, deviceType)`. Hotspots A & B — owner baseline + dispersion. Mechanical add `WHERE q.subject_id = ${subjectId}` to both branches; §6 will validate the test.
6. `src/lib/libCalibrationExtract.ts` (~3 errors) — `runCalibrationExtraction(subjectId, questionId, ...)`, `extractCalibrationContext(subjectId, questionId, ...)`. Pass through to `saveCalibrationContext`.
7. `src/lib/libSemanticBaseline.ts` (~4 errors) — `updateSemanticBaselines(subjectId, questionId)`, helpers (`getBaseline`, `upsertBaseline`, `saveTrajectoryPoint`, `getTopicMatchedValues`) all scope by `subjectId`. Hotspot F.
8. `src/lib/libSessionMetadata.ts` (21 errors) — `computeSessionMetadata` doesn't touch DB, but `updateRburstTrajectoryShape(subjectId, questionId)` does. The 21 errors are mostly from internal helpers reading/writing scoped tables.
9. `src/lib/libCrossSessionSignals.ts` (19 errors) — `computeCrossSessionSignals(subjectId, questionId, text)`, internal helpers (`getPriorTexts`, `motorSelfPerplexity`, `digraphStability`) scope by `subjectId`. Hotspot E.
10. `src/lib/libSemanticSignals.ts` (30 errors) — Mostly pure compute. The DB-touching wrapper functions need `subjectId`.
11. `src/lib/libGenerate.ts` (11 errors) — `runGeneration(subjectId, options?)`. **Owner-pinned today**, mark with `// TODO(step5): review` at the call site. Subjects don't generate (per CLAUDE.md / user directive). Internal calls to libDb pass `subjectId` (which will always be `OWNER_SUBJECT_ID = 1` in current routing).
12. `src/lib/libEmbeddings.ts` (~4 errors) — `embedResponse(subjectId, responseId, ...)`, `backfillEmbeddings(subjectId)`. Pass through to `insertEmbeddingMeta`.
13. `src/lib/libSignals.ts` (~few errors) — `formatObserveSignals`, `formatCompactSignals`, `formatDynamicsContext` are pure-format. `computeKnowledgeTransformScore` and helpers need `subjectId` for the calibration-floor query.
14. `src/lib/libSignalFamilies.ts` (6 errors) — `computeVariantTree(subjectId)` (LLM-orchestration around variants). Owner-only feature today; pin to `OWNER_SUBJECT_ID` with TODO.
15. `src/lib/libSchedule.ts` (~few errors) — `seedUpcomingQuestions(subjectId, days)`. Owner-only seeding pre-corpus era. May be obsolete; check call sites in batch 3.
16. `src/lib/libSubject.ts` (~few errors) — Identity functions; no behavioral data. May only need updates if it imports from libDb in unexpected ways. Read first.
17. `src/lib/libDocs.ts` (~few errors) — Static doc registry. Probably no real change needed; check what's in error.
18. `src/lib/utlSessionSummary.ts` — `coerceSessionSummary(subjectId, raw)`. **Caller passes subjectId** — `locals.subject!.subject_id` from subject path, `OWNER_SUBJECT_ID` from owner path. No TODO needed (this is the right shape, not scaffolding).
19. **`src/lib/libAliceNegative/libStateEngine.ts`** — Minimal touch. Pass `subjectId` through, scope SELECTs to subject_id, no rework.
20. **`src/lib/libAliceNegative/libRenderWitness.ts`** — Same. `renderWitnessState(subjectId)`. Internal `MAX(entry_count) WHERE subject_id = ?` per the Step 0 §B note.
21. **`src/lib/libAliceNegative/libEmotionProfile.ts`**, **`libSemanticSpace.ts`**, **`libDynamics.ts`**, **`libInterpreter.ts`** — Same minimal-touch treatment for each.

## 6. The established per-file pattern

`libSignalPipeline.ts` is the canonical template. The pattern:

1. **Public signature**: prepend `subjectId: number` as the first parameter to every exported function that touches the DB.
2. **Internal helpers**: thread `subjectId` through any helper that issues SQL.
3. **Read SQL**: every `SELECT ... FROM tb_X WHERE ...` adds `subject_id = ${subjectId} AND` to the WHERE clause. For JOINs, add `q.subject_id = ${subjectId}` (or whichever table alias is the subject-bearing parent).
4. **Write SQL**: Already handled by `libDb` write functions accepting `subjectId`. Just pass it.
5. **`logError` ctx blobs**: include `subjectId` so error logs are traceable.
6. **TODO markers**: when threading `subjectId` to a function whose call site doesn't yet have a real subject context (e.g., owner-only LLM generation), the call site uses `OWNER_SUBJECT_ID` from `libDb.ts` with a `// TODO(step5): review` comment. Step 6+ revisits these.

`replace_all` edits are efficient for the repetitive `getXSignals(questionId)` → `getXSignals(subjectId, questionId)` pattern.

## 7. Confirmed judgment calls

### Established this turn
- **`libGenerate.runGeneration`**: owner-pinned. Accept the `subjectId` param so the signature is ready, but in practice it always receives `OWNER_SUBJECT_ID = 1` because subjects don't generate (per CLAUDE.md / user directive). Mark call site with `// TODO(step5): review`.
- **`utlSessionSummary.coerceSessionSummary`**: shared by owner and subject paths. Caller supplies `subjectId` — `locals.subject!.subject_id` (subject) or `OWNER_SUBJECT_ID` (owner). No TODO needed; this is the right shape.

### Established in Step 4 (already in libDb.ts, reproduced here for resumption clarity)
Functions that intentionally KEPT their original signatures (no `subjectId` param), because they're population-agnostic by design:
- `isCalibrationQuestion` — PK lookup, doesn't read subject-private data
- `isRecordEmbedded` — composite key already globally unique
- `getActiveEmbeddingModelVersionId` — shared registry
- `getCorpusQuestions` / `getCorpusQuestionById` / `insertCorpusQuestion` / `retireCorpusQuestion` / `getActiveCorpusCount` — shared corpus pool
- `upsertEngineProvenance` / `getEngineProvenanceById` — population-agnostic by binary+CPU
- `getCommentsForPaper` / `saveComment` — public website
- `claimNextSignalJob` / `markSignalJobCompleted` / `markSignalJobFailed` / `sweepStaleSignalJobs` / `getSignalJobById` / `getDeadLetterSignalJobs` / `countOpenSignalJobs` — worker-internal, PK-keyed

### From Step 0 (data oddity, schema-side)
- **`tb_witness_states.entry_count`**: NOT unique in production data. No UNIQUE constraint in migration 030. AN deprioritized; minimal touch.

## 8. Conventions in force

- **`OWNER_SUBJECT_ID = 1`** (in `src/lib/libDb.ts`) is temporary scaffolding. Every use gets `// TODO(step5): review` so a future grep finds the list of "is this site genuinely owner-only or does it need subject context?"
- **AN tables (`libAliceNegative/*`)**: minimal mechanical touch only. No refactoring, no improvements, no investigation. Goal is "compiles," not "good." User has explicitly deprioritized AN.
- **`scripts/archive/*`**: untouched. Pre-existing errors (40 of them, mostly `better-sqlite3` from pre-PG era). Out of scope for unification.
- **Per-batch test runs are required**. Don't compound batch errors into the next batch's noise.
- **Surface structural findings**. If a call site reveals a context where the right `subjectId` is genuinely unclear, surface it as a finding before working around it.
- **`created_by` stays role-based** (`'system'` / `'user'` / `'client'`). Subject identity lives ONLY in `subject_id`. Documented in migration 030 header and `dbAlice_Tables.sql` top.
- **CONFLICT TARGET CHANGED markers**: every UPSERT whose conflict target changed under migration 030 is flagged with the literal comment `-- CONFLICT TARGET CHANGED (migration 030):` so they're greppable. Three sites: `tb_questions (subject_id, scheduled_for)`, `tb_session_delta (subject_id, session_date)`, `tb_semantic_baselines (subject_id, signal_name)`. `tb_personal_profile` gets a new `UNIQUE (subject_id)`.
- **Pre-existing tsc noise**: ~119 errors from `scripts/archive/*`, strict-null-check loosenings in `libDb.ts` itself, missing `await`s in `scripts/backfill-slice3-history.ts`, etc. Tracked as a post-unification cleanup followup; not fixed during this work.

## 9. How to resume

In a fresh chat session:

1. **Read this file** end-to-end.
2. **Read `db/sql/migrations/030_unify_subject_id.sql`** to ground the schema picture.
3. **Read `src/lib/libDb.ts`** lines 1–30 (intro + `OWNER_SUBJECT_ID` doc).
4. **Read `src/lib/libSignalPipeline.ts`** as the canonical pattern template.
5. **Run `npx tsc --noEmit -p . 2>&1 | grep -cE "error TS"`** to confirm baseline (should be 459 ± changes from any work since this checkpoint).
6. **Pick file 1 from §5** (`src/lib/libProfile.ts`) and apply the §6 pattern.
7. After every 3–5 files, run `tsc` and confirm the error count is decreasing (or at least not growing beyond what newly-revealed downstream callers explain).
8. When all 21 batch-1 files compile clean, run `npx vitest run --project unit` (passes locally, no Docker needed). DB tests run on CI only (no Docker on macOS host).
9. Report the batch 1 completion to the user and STOP for review before batch 2 (api routes).

## 10. Current tsc baseline

**Total errors: 459** (unchanged from end of Step 4).

The unchanged total is expected: my batch-1-partial edits fixed errors in the 3 keystone files but pushed equivalent errors onto downstream callers (the 18 remaining lib files) that those keystones invoke. Net delta is approximately zero until the downstream callers update their own signatures.

| File | Errors before this checkpoint | Errors after | Delta |
|---|---|---|---|
| `src/lib/libSignalFieldMaps.ts` | 0 | 0 | 0 (cosmetic edit, no error impact) |
| `src/lib/libSignalWorker.ts` | 1 | 6 | +5 (now exposes errors in functions it calls that haven't been updated) |
| `src/lib/libSignalPipeline.ts` | 13 | 6 | -7 (libDb calls now correct; remaining 6 are calls to lib functions still pending) |

The ~5+ "new" errors in `libSignalWorker.ts` and the ~6 remaining in `libSignalPipeline.ts` are precisely the downstream callers in §5 of this doc — fixing those files will bubble their fixes back up to clean these.

Specific remaining errors in the 3 edited files (these will resolve once their callees update):

`libSignalPipeline.ts`:
- L217: `updateSemanticBaselines(subjectId, questionId)` — fixed when libSemanticBaseline updates
- L244: `updateRburstTrajectoryShape(subjectId, questionId)` — libSessionMetadata
- L258: `computeCrossSessionSignals(subjectId, questionId, text)` — libCrossSessionSignals
- L283: `computeSessionIntegrity(subjectId, questionId)` — libSessionIntegrity (need to find which file)
- L303: `updateProfile(subjectId, questionId)` — libProfile
- L310: `computeReconstructionResidual(subjectId, questionId)` — libReconstruction

`libSignalWorker.ts`:
- L218: `computePriorDayDelta(subjectId, ...)` — libDailyDelta
- L221: `runGeneration(subjectId)` — libGenerate (signature change requires param shape rework)
- L224: `renderWitnessState(subjectId)` — libAliceNegative/libRenderWitness (AN, minimal touch)
- L245: `embedResponse(subjectId, ...)` — libEmbeddings
- L271: `runCalibrationExtraction(subjectId, ...)` — libCalibrationExtract
- L285: `snapshotCalibrationBaselinesAfterSubmit(subjectId, ...)` — libCalibrationDrift

End of handoff.
