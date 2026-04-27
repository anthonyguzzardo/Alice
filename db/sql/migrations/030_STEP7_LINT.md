# Migration 030 — Step 7: Subject-Scope Lint

Landed 2026-04-27. The lint is a permanent infrastructure addition built to
last. Step 6 verified that 17 known aggregation hotspots are correctly
scoped today; Step 7 makes the discipline mechanical so future code can't
regress without a loud, actionable failure.

## What it enforces

Every SQL block in `src/**/*.ts` and `scripts/**/*.ts` (excluding
`scripts/archive/`, `node_modules/`, `tests/`, and `*.d.ts`) is scanned. A
block is in scope if it references one of the 33 subject-bearing tables
unified by migration 030:

```
tb_questions, tb_responses, tb_session_summaries, tb_session_events,
tb_burst_sequences, tb_rburst_sequences, tb_session_metadata,
tb_dynamical_signals, tb_motor_signals, tb_semantic_signals,
tb_process_signals, tb_cross_session_signals, tb_calibration_context,
tb_calibration_baselines_history, tb_entry_states, tb_witness_states,
tb_semantic_states, tb_question_feedback, tb_interaction_events,
tb_personal_profile, tb_session_delta, tb_reconstruction_residuals,
tb_session_integrity, tb_semantic_baselines, tb_semantic_trajectory,
tb_signal_jobs, tb_embeddings, tb_prompt_traces, tb_reflections,
tb_semantic_dynamics, tb_semantic_coupling, tb_trait_dynamics,
tb_coupling_matrix, tb_emotion_behavior_coupling
```

The list is the canonical source of truth from `030_unify_subject_id.sql`
BLOCK 1, plus `tb_signal_jobs` (which gained `subject_id` in migration 027).
A migration drift test cross-checks the lint's table set against the
migration file: if a future migration adds a behavioral table to the unified
set without updating the lint, the test fails loudly.

For every in-scope block, the lint requires that `subject_id` appears
literally somewhere in the block text — column reference, alias, comment,
anywhere. A block that mentions a subject-bearing table but does not
mention `subject_id` is a violation.

## Why mechanism C (vitest test)

The handoff offered three options:

- **A — AST-based linter plugin.** Most robust. Higher upfront cost.
- **B — Regex-based scanner.** Simpler. Higher false-positive rate.
- **C — Vitest test that introspects source files.** Integrates with CI.

Mechanism C was chosen because:

1. **Already in CI.** The unit project runs on every PR via `npm test`. No
   new pipeline step, no new tooling vector.
2. **No new dependencies.** Pure Node + vitest. The handoff was explicit
   that AST-based parsing is over-engineering for this scope.
3. **Fixture self-tests.** The same harness that runs the codebase scan
   also exercises positive/negative fixtures, so the rule itself is
   tested. A lint without self-tests is indistinguishable from a lint
   that returns nothing.
4. **Actionable output.** When the rule fires, vitest prints
   `file:line, table, snippet, reason` for every violation in one block
   — the developer fixes from the test output.

The implementation is a hand-rolled state machine over comments / strings
/ template literals, ~250 lines. Not a regex over the whole source — that
fails on nested template literals (which exist in `libDb.ts:1003`). Not an
AST — TypeScript compiler API would be a heavy dependency for the
extraction work this lint actually does.

## How to run

```bash
# Run only the lint:
npx vitest run --project unit tests/unit/lint/subjectScopeLint.test.ts

# Run the full unit suite (lint included):
npx vitest run --project unit

# Full test suite (CI does this):
npm test
```

Output on a clean codebase:

```
✓ tests/unit/lint/subjectScopeLint.test.ts (32 tests)
```

Output on a violation:

```
subject-scope lint found 1 violation(s):

src/lib/libDb.ts:62
  tables: tb_questions
  Query against tb_questions does not reference subject_id
  SELECT question_id, text FROM tb_questions WHERE scheduled_for = ${today}
```

## Exemptions: three layers

All exemption markers are comments. All require a `-- <reason>` clause —
a bare marker is ignored, and the lint then fires on whatever site the
marker tried to silence. Reasons exist so a `git grep` finds every
exemption with its rationale in one read.

### 1. File-level

```ts
// alice-lint-disable-file subject-scope -- <reason>
```

Anywhere in the file. Skips the whole file. Use for scripts whose entire
SQL surface is intentionally subject-agnostic — e.g. the smoke test that
operates exclusively on a single test `question_id`.

### 2. Range

```ts
// alice-lint-disable subject-scope -- <reason>
const rows = flag
  ? await sql`SELECT 1 FROM tb_embeddings WHERE ... `
  : await sql`SELECT 1 FROM tb_embeddings WHERE ... `;
// alice-lint-enable subject-scope
```

Opens a region. Every SQL block inside the region is exempt. An open range
without an `enable` covers the rest of the file. Use when a single
statement contains multiple SQL blocks (e.g. a ternary) and per-block
markers would not chain.

### 3. Single-block

```ts
// alice-lint-disable-next-query subject-scope -- <reason>
await sql`SELECT * FROM tb_signal_jobs WHERE signal_job_id = ${id}`;
```

Applies to the next SQL block. Whitespace and other comments between the
marker and the block are tolerated; intervening real code breaks the
chain. Use for one-off PK lookups or worker-queue operations.

## The exemption list

Exemptions are not centralised in a config file. Each one lives at the
query site, with its rationale right there. `git grep alice-lint-disable`
returns the full list:

```
src/lib/libDb.ts                    isCalibrationQuestion          PK lookup; question_id is globally unique
src/lib/libDb.ts                    isRecordEmbedded                composite key globally unique (range marker)
src/lib/libDb.ts                    claimNextSignalJob              worker queue; population-agnostic by design
src/lib/libDb.ts                    markSignalJobCompleted          worker queue PK update
src/lib/libDb.ts                    markSignalJobFailed             worker queue PK update
src/lib/libDb.ts                    sweepStaleSignalJobs            boot-time recovery; population-agnostic
src/lib/libDb.ts                    getSignalJobById                worker queue PK lookup
src/lib/libDb.ts                    getDeadLetterSignalJobs         admin/observability listing across subjects
src/lib/libDb.ts                    countOpenSignalJobs             queue health metric, global by design
src/lib/libProfile.ts               updateProfile                   PK lookup; gate above verifies (questionId, subjectId)
src/scripts/backfill-extended-residuals.ts UPDATE by reconstruction_residual_id; subject scope upstream
scripts/smokeTestPhase23.ts          file-level                     single test question_id throughout
```

Two conceptual buckets:

**Population-agnostic by design.** The worker queue is a global daemon
draining jobs across all subjects in PK/status order. Counting open jobs
or listing dead-lettered jobs is a queue-health metric, not a per-subject
view. These are not "exempt because we're being lazy"; the architecture
explicitly does not partition by subject at the queue layer.

**PK lookups where subject_id would be redundant.** `question_id`,
`signal_job_id`, `reconstruction_residual_id`, etc. are globally unique.
A SELECT keyed by one of them returns at most one row, whose subject_id
is fixed. Adding `AND subject_id = ?` is a defense-in-depth strengthening,
not a correctness fix, and Step 7 is observational — not a refactor pass.
If a future audit decides defense-in-depth here is worth the churn, the
exemption marker disappears with the addition.

## How to add a new exemption

1. Identify why the query is genuinely exempt.
2. Drop the appropriate marker (file / range / single-block) directly
   above the SQL block, with a `-- <reason>` clause that names the
   property making it safe (PK lookup; population-agnostic queue;
   etc.).
3. Run the lint locally:
   ```bash
   npx vitest run --project unit tests/unit/lint/subjectScopeLint.test.ts
   ```
4. If the lint passes, commit. If it doesn't, the marker is in the wrong
   position or missing `-- reason`.

If you find yourself adding many exemptions to a new feature, that's a
smell — re-examine whether the queries should be subject-scoped. The
exemption is a last resort, not a default.

## What the lint does NOT verify

- **Functional correctness.** That `subject_id` is bound to the right
  value, scoped on the right table, threaded through joins, or applied
  to subqueries. Step 6 hotspot tests own this.
- **Defense-in-depth completeness.** That every PK lookup also adds
  `AND subject_id = ?` for redundancy. The lint accepts the architectural
  argument that PK uniqueness is sufficient.
- **Data correctness.** That the rows in production actually carry the
  right subject_id. That's a migration / verification concern.

The lint is a syntactic backstop. It catches the class of mistake
"developer forgot subject_id entirely"; it does not catch "developer used
the wrong subject_id."

## Self-tests

The lint test file at `tests/unit/lint/subjectScopeLint.test.ts` exercises
the rule directly with synthetic source strings. Coverage includes:

- 9 positive fixtures (must flag): SELECT/UPDATE/INSERT/DELETE on each
  major table, multi-table JOIN, `sql.unsafe`, lowercase keywords,
  per-block detection across multiple queries in one file
- 8 negative fixtures (must not flag): subject_id present in WHERE,
  in JOIN, in placeholder; non-subject-bearing tables; non-SQL strings
  mentioning table names; comments mentioning table names; nested
  template literals
- 11 exemption-mechanism fixtures: file/range/single-block markers,
  reason-required validation, chain-breaking by intervening code,
  blank-line tolerance, range across closed/open boundaries
- 1 migration-drift test: SUBJECT_BEARING_TABLES covers every BLOCK 1
  table in `030_unify_subject_id.sql`
- 1 every-table-coverage test: dynamically generates a violation per
  table and asserts the lint catches each one
- 1 codebase scan: must report zero violations across `src/` and
  `scripts/`

If a fixture self-test fails, the rule logic itself is broken. If the
codebase scan fails, real source code violates the discipline and the
test output names the file/line.

## CI integration

The lint runs as part of the existing `Run vitest suite` step in
`.github/workflows/ci.yml`. No CI configuration changes are required:
the unit project includes everything under `tests/unit/**/*.test.ts`,
and the lint test file lives there. A failing lint blocks the PR.

## Re-running the mutation verification

To prove the lint exercises a real bug today, temporarily strip a
`subject_id` clause from any production query and run the lint:

```bash
# Edit src/lib/libDb.ts: remove "WHERE subject_id = ${subjectId} AND" from getTodaysQuestion
npx vitest run --project unit tests/unit/lint/subjectScopeLint.test.ts -t "codebase scan"
# Expect: test fails with "subject-scope lint found 1 violation"
# Restore the scope, re-run; test passes.
```

This was performed during Step 7 development against
`src/lib/libDb.ts:62` (`getTodaysQuestion`). The lint correctly reported
the violation.

## Where the rule lives

```
tests/unit/lint/
├── subjectScopeLint.ts        — lint module (state machine + exemption logic)
└── subjectScopeLint.test.ts    — fixture self-tests + codebase scan + drift check
```

Both files are pure TS, no runtime dependencies beyond vitest and Node's
`fs`. The module is exported (`lintSource`, `lintCodebase`,
`SUBJECT_BEARING_TABLES`, `POPULATION_AGNOSTIC_TABLES`) so future tooling
(e.g. a pre-commit hook) can reuse the same logic without re-implementing
the parser.
