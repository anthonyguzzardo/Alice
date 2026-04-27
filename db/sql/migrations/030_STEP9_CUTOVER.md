# Migration 030 — Step 9: Subject API cutover + drop legacy variant tables

Date: 2026-04-27
Phase: 6b — Schema unification (final step)

## What Step 9 finishes

The schema unification (migration 030) added `subject_id NOT NULL` to every
behavioral table and rewrote constraints, indexes, and queries to be
subject-scoped. Steps 4–8 reworked the application layer end-to-end
(libDb signatures, query sites, hotspot aggregations, lint, encryption
boundary). Step 9 is the cutover that removes the last remnants of the
Phase 6a "subject variant" tables: `tb_subject_responses`,
`tb_subject_session_summaries`, and `tb_scheduled_questions`. After Step 9
the unified schema is the only schema and every behavioral row in the
database is reachable through `subject_id`.

## Files changed in this step

**Schema (source of truth):**
- `db/sql/dbAlice_Tables.sql` — added `corpus_question_id INT` and the
  partial index `ix_questions_subject_corpus_question_id` to `tb_questions`;
  removed the three legacy `CREATE TABLE` blocks.

**Migrations:**
- `db/sql/migrations/032a_add_corpus_question_id.sql` — additive: column +
  partial index. Runs **before** app deploy.
- `db/sql/migrations/032b_drop_legacy_subject_variant_tables.sql` —
  destructive: zero-row assertion, then `DROP TABLE` for the three legacy
  tables. Runs **after** app deploy.
- `db/sql/migrations/030_unify_subject_id.sql` — BLOCK 7 header updated to
  point readers at 032a/032b (the original commented-out drop block stays
  as historical context).

**Library / API:**
- `src/lib/libDb.ts` — added `scheduleSubjectCorpusQuestion`,
  `getSubjectScheduledQuestion`, `getSubjectCorpusHistory`,
  `getSubjectUnseenCorpusCount`. Removed the `@region subject-data` block
  (`saveSubjectResponse`, `getSubjectResponse`, `saveSubjectSessionSummary`).
  All subject-side reads/writes against subject-bearing tables now go
  through the same encryption + subject-scope helpers as the owner path.
- `src/lib/libScheduler.ts` — rewritten to use the new libDb helpers; the
  only direct SQL it retains is the corpus-pool read against
  `tb_question_corpus` (population-agnostic). The `scheduled_question_id`
  field on `ScheduleResult` and `ScheduledQuestion` was renamed
  `question_id` to match the unified schema.
- `src/pages/api/subject/today.ts` — reads via `getScheduledQuestion`
  (libScheduler) and `getResponseText` (libDb). Returns `question_id` in
  the wire payload.
- `src/pages/api/subject/respond.ts` — writes via `saveResponse` and
  `saveSessionSummary` (libDb), inside a single `sql.begin` transaction.
  The contamination boundary docstring is preserved verbatim and tightened
  to forbid `enqueueSignalJob` (subject sessions deliberately produce no
  derived signals, witness states, embeddings, or daily deltas).

**UI:**
- `src/pages/subject/index.astro` — the wire field name is
  `scheduled_question_id → question_id` (request body, response field,
  local variable, sessionSummary blob).

**Lint config:**
- `tests/unit/lint/subjectScopeLint.ts` —
  `tb_subject_responses`, `tb_subject_session_summaries`, and
  `tb_scheduled_questions` removed from `POPULATION_AGNOSTIC_TABLES` (they
  no longer exist in the schema, so they cannot appear in any query).

**Deletions:**
- `db/sql/session_summary_divergence.allow` — the parity allowlist for
  `tb_session_summaries` vs `tb_subject_session_summaries` no longer has a
  reason to exist.
- `src/scripts/test-session-summary-alignment.ts` — same: the schema
  divergence it tested no longer exists.

## Cutover sequence

The split between 032a and 032b mirrors 031a/031b: additive ahead of code,
destructive behind code, gated on a runtime assertion. The window between
the two migrations is the only time both old and new code paths can
coexist; both are designed to be safe across that window.

1. **Run `032a_add_corpus_question_id.sql` against Supabase.**
   - Adds `corpus_question_id INT` (nullable) to `tb_questions`.
   - Adds the partial index `ix_questions_subject_corpus_question_id`.
   - Old (pre-Step-9) app code continues to work: every existing INSERT
     omits the new column, the new column is nullable, and the partial
     index `WHERE corpus_question_id IS NOT NULL` is empty until new code
     starts writing.

2. **Deploy the Step 9 application code.**
   - The new code reads/writes through unified tables with the new
     `corpus_question_id` link.
   - Existing rows have `corpus_question_id IS NULL` and continue to flow
     through the owner journal path unaltered.
   - Subject API endpoints accept the renamed `question_id` wire field;
     the only client (the `subject/index.astro` page) was updated in the
     same commit.

3. **Run `032b_drop_legacy_subject_variant_tables.sql` against Supabase.**
   - Asserts zero rows in each of the three legacy tables.
   - On success, executes `DROP TABLE IF EXISTS` for each.
   - On failure, raises `EXCEPTION` and aborts the transaction. No drops
     occur. See "Verification gates" below for triage steps.

If a hotfix is required between steps 1 and 3, both old and new code paths
co-exist on the same schema (legacy tables present + `corpus_question_id`
column added). This is the only co-existence window in the cutover.

## Verification gates

**Before 032a:**
- `te_question_source(4, 'corpus')` row exists (from migration 023).
  032a's pre-flight DO block confirms this.

**Between 032a and 032b:**
- App deploy succeeded; the new subject endpoints respond.
- Subject UI loads `today.ts` and the `question_id` wire field is present.
- `tb_questions` has at least one row with `corpus_question_id IS NOT NULL`
  (from a real subject submission) before running 032b. **This is not
  required**, but it is the cleanest end-to-end signal that the cutover is
  live. If subjects are not actively journaling during the deploy window,
  skip this check.

**Before 032b:**
- All three legacy tables are zero-row. The migration's BLOCK 1
  assertion does this automatically.

**On assertion failure (032b BLOCK 1 raises):**
- Investigate the source of any non-zero rows. The expected sources of
  legacy-table rows after Step 9 are:
  - **Pre-Step-9 rows** (carried from before the cutover): unexpected,
    since the canonical migration 030 verification documented zero rows.
    Recheck 030's row-count output. If rows were present then but missed,
    the same fold mapping applies (see below).
  - **Rows written between 032a and 032b**: only possible if old app code
    is still running. Confirm the deploy completed and no rolling
    deploy is in flight.
- Fold any rows manually before retrying:
  - `tb_subject_responses` → `tb_responses` (set `subject_id`,
    `question_id` from the matching `tb_questions` row produced by the
    fold below).
  - `tb_subject_session_summaries` → `tb_session_summaries` (same
    mapping as responses).
  - `tb_scheduled_questions` → `tb_questions` with
    `question_source_id = 4` and `corpus_question_id` copied across.
    Encrypt the corpus row's text via `libCrypto.encrypt()` before
    writing the question row's `text_ciphertext + text_nonce`.
- Re-run 032b after the fold completes.

**After 032b:**
- The post-migration verification block confirms the three tables no
  longer exist in `information_schema.tables`.
- Application metric: subject submissions land in `tb_responses` with
  the subject's `subject_id` (verifiable via `SELECT DISTINCT subject_id
  FROM tb_responses ORDER BY subject_id`).

## Rollback procedure

The cutover is split into a reversible phase and an irreversible phase.

**Between 032a and 032b (reversible):**
- Revert the application deploy to the pre-Step-9 commit.
- Drop the new column + index added by 032a:
  ```sql
  DROP INDEX IF EXISTS ix_questions_subject_corpus_question_id;
  ALTER TABLE tb_questions DROP COLUMN IF EXISTS corpus_question_id;
  ```
- The legacy tables are still present, so the pre-Step-9 code paths work
  as they did before.

**After 032b (irreversible by mechanics; recoverable by restore):**
- The legacy tables are gone. To revert:
  1. Restore the table CREATE TABLE definitions in `dbAlice_Tables.sql`
     from the git history at the cutover commit's parent.
  2. Re-create the tables on production.
  3. Restore the application code paths that read/write them
     (`saveSubjectResponse`, `getSubjectResponse`,
     `saveSubjectSessionSummary`, the libScheduler SQL block, the API
     wire field name).
  4. If any subject submissions landed in the unified tables between
     032b and the rollback, fold them back to the legacy tables before
     resuming pre-Step-9 code paths.

The rollback path after 032b is intentionally unattractive — Step 9's
position in the unification plan is the last point where the legacy
tables are still present, and the discipline is to verify before drop
rather than rollback after drop.

## Test + tsc deltas

- **Test suite:** 145/145 pass (28 test files), unchanged from Step 8.
  Includes the lint test (32/32) and the Step 6 hotspot tests
  (`tests/db/aggregation_scoping/*`).
- **tsc errors:** 284 → 281 (3 fewer). The reduction reflects the
  deletion of the legacy `@region subject-data` block, which carried two
  pre-existing `'row' is possibly 'undefined'` warnings; the new
  encrypted-aware functions raise zero new warnings. No tsc regression.
- **Lint:** zero violations on the cutover code. The new libDb
  functions all reference `subject_id` in every query that mentions a
  subject-bearing table.

## Open follow-ups (not part of Step 9)

- The pre-existing `TransactionSql` vs `Sql<{}>` type mismatch is shared
  by the owner respond/calibrate paths (libDb tx threading). Step 9 does
  not introduce or fix this. Tracked separately.
- The `RESUME.md` and `030_HANDOFF.md` files still mention the legacy
  tables as live; these are operator notes and will be regenerated with
  the next handoff cycle.
