# Phase 6 Resume Handoff (rewritten 2026-04-25 EOD)

This document is the single source of truth for the next agent picking up this work. The previous version of this file is obsolete and has been replaced wholesale.

---

## STOP. Read this first.

**The next agent MUST audit all of the prior session's work before continuing with any remaining Phase 6 step.** The user explicitly distrusts deferred-then-forgotten work and prefers loud failures over silent drift. Several "small" deferred items in this session turned out to be real production bugs once audited. Do not assume the prior work is correct just because the build is green and tests pass.

The audit checklist is in **§ 1 (Audit Protocol)** below. Do that first, before anything else. Then proceed to **§ 5 (Pending Phase 6 Plan)**.

---

## 0. TL;DR

In this session (2026-04-25), Phases 1, 1.5, 1.75, 2, 3, 4, and 4.5 were completed. **Phase 6a has not started.** All seven completed phases are documented below with file lists, design decisions, and verification commands.

Headline numbers at session end:
- 49 TypeScript tests passing across 6 files
- 181 Rust tests passing (172 unit + 5 avatar reproducibility + 4 dynamical reproducibility)
- Bit-identity reproducibility check passing for dynamical, motor, and avatar v1-v5 across two clean rebuilds
- 0 new TypeScript strict-mode errors introduced
- 0 clippy warnings
- Local `alice` PostgreSQL has migrations 027 (signal jobs) and 028 (engine provenance) applied

What is unblocked by this session: Phase 6a (Hetzner deploy + Supabase cutover) has every infrastructure prerequisite in place. What is still missing: the actual deploy, the auth implementation, the encryption library wiring, and the rest of the 6b/c/d/e sub-phases.

---

## 1. Audit Protocol (DO THIS FIRST)

Before writing any new code, the next agent runs through this list. Stop and report findings the moment anything fails.

### 1a. Environment sanity

```bash
# Docker socket reachable (OrbStack should be running, NOT Docker Desktop)
docker info | grep -E "Server Version|Operating System"
# Expected: "Operating System: OrbStack" (NOT "Docker Desktop")
# If you see Docker Desktop: it has a known VM-disk-permission bug on this user's
# Mac. Switch to OrbStack via `brew install orbstack` then quit Docker Desktop.

# PostgreSQL alice DB reachable, schema present
psql -d alice -c "SELECT current_database();"
psql -d alice -c "\dt alice.tb_signal_jobs alice.tb_engine_provenance"

# Both tables MUST exist. If missing, the next agent must apply migrations:
#   psql -d alice -f db/sql/migrations/027_signal_jobs.sql
#   psql -d alice -f db/sql/migrations/028_engine_provenance.sql
```

### 1b. Build + test green

```bash
# Rust crate
cd src-rs
cargo build --release           # must succeed
cargo clippy --release -- -D warnings   # zero warnings
cargo test --lib                # 172 tests pass
cargo test --release --test reproducibility           # 4 tests pass
cargo test --release --test avatar_reproducibility    # 5 tests pass
./reproducibility-check.sh      # dynamical, motor, avatar v1-v5 all IDENTICAL

# TypeScript / project root
cd ..
npm run build                   # builds Rust THEN Astro; both must succeed
npm test                        # 49 tests across 6 files; requires OrbStack running
```

If any of these fail, the audit fails. Investigate before continuing.

### 1c. Code review checklist

The next agent reads (not just opens) each of these files and verifies the listed property is upheld:

- **`src/lib/libSignalPipeline.ts` (function `computeAndPersistDerivedSignals`).** Must NOT contain any bare `return` inside the dynamical, motor, or process signal blocks. The fix at three sites was the first bug in this session. Pattern check: every `if (!xxx) return;` in this file is a regression. The correct pattern is `if (result) { ... }` scoped blocks.

- **`src/lib/libDb.ts` (function `saveCalibrationSession`).** Must accept an `events?` parameter and persist `saveSessionEvents` inside its own `sql.begin` transaction. Pre-2026-04-25 this ran outside the transaction and was rationalized as "session data is sacred, derived data is best-effort." Both the rationalization and the bug were fixed in Phase 1.5.

- **`src/lib/libDb.ts` (function `enqueueSignalJob`, `claimNextSignalJob`, `markSignalJobCompleted`, `markSignalJobFailed`, `sweepStaleSignalJobs`, `stampEngineProvenance`).** Must be present and use `FOR UPDATE SKIP LOCKED` in the claim query (test enforces this).

- **`src/lib/libSignalWorker.ts`.** Must call `getEngineProvenanceId()` then `stampEngineProvenance(questionId, provenanceId)` AFTER each pipeline run and BEFORE `markSignalJobCompleted`. This is the chain that puts a provenance row on every signal record.

- **`src/lib/libEngineProvenance.ts`.** Must compute SHA-256 of the loaded `.node` file, read CPU model via `sysctl` (macOS) or `/proc/cpuinfo` (Linux), and cache the provenance_id at module level for the process lifetime.

- **`src/lib/libSignalsNative.ts`.** Must NOT contain a hand-written `interface NativeModule { ... }`. Types come from `import type * as Native from '../../src-rs/index.d.ts'`. The 151-line hand-written interface deleted in Phase 4.5 must NOT have been reintroduced.

- **`src-rs/index.d.ts`.** Must be auto-generated (header line says so). Should be ~240 lines. NEVER hand-edit. To regenerate: `npm run build:rust`.

- **`src/lib/libSignalFieldMaps.ts`.** Four maps (`DYNAMICAL_FIELD_MAP`, `MOTOR_FIELD_MAP`, `PROCESS_FIELD_MAP`, `CROSS_SESSION_FIELD_MAP`), each typed `as const satisfies CompleteMap<T>`. The matching test at `tests/db/fieldMaps.test.ts` cross-checks every entry against the live schema.

- **`db/sql/dbAlice_Tables.sql`.** Must contain all 17 columns folded back during the Phase 4.5 audit (14 in `tb_dynamical_signals`, 3 in `tb_motor_signals`). If a fresh `psql -f db/sql/dbAlice_Tables.sql` against a clean database produces a schema that differs from the migrated `alice` DB, that is a regression of the audit fix.

- **`GOTCHAS.md`.** Must have the new charter at the top (4 acceptable categories, banned smell phrases). Must contain the historical landmines for: pipeline early-return, calibration event-storage rationalization, fire-and-forget IIFE, schema-file drift, JSON FFI, hand-written NativeModule, Milan/Genoa FP divergence, binary-provenance-required.

- **`CLAUDE.md`.** Must have the Signal Job Worker section, Binary Provenance subsection, Persistence Field Maps subsection, and the napi Boundary section pointing at the auto-generated d.ts rule. The "fire-and-forget after the HTTP response" guidance has been replaced with "background work is durable" wording.

### 1d. Smoke test the full pipeline

The most reliable end-to-end check: submit a real session via the dev server. Expectations:

```bash
npm run dev   # starts Astro + Rust build
# Submit a journal session via the UI.
# Then verify the worker drained the job:
psql -d alice -c "SELECT signal_job_id, signal_job_status_id, attempts, last_error FROM alice.tb_signal_jobs ORDER BY signal_job_id DESC LIMIT 5;"
# Expected: most recent rows have status_id = 3 (completed) within ~5 seconds
psql -d alice -c "SELECT engine_provenance_id, binary_sha256, cpu_model FROM alice.tb_engine_provenance;"
# Expected: 1 row recording the dev binary's SHA-256
psql -d alice -c "SELECT COUNT(*) AS rows_with_provenance FROM alice.tb_dynamical_signals WHERE engine_provenance_id IS NOT NULL;"
# Expected: at least 1 (the just-submitted session)
```

If the worker did not drain the job, or no provenance was stamped, the audit has found a real bug. Fix before proceeding.

### 1e. Audit report

The next agent writes a brief report to the user before doing any new work. Either: "audit clean, proceeding to Phase 6a" with the list of green checks; or: "audit failed at X with finding Y, halting." Do not start Phase 6a if the audit reports any non-trivial drift.

---

## 2. Locked-in design decisions (do not relitigate)

These were settled before this session and remain in force.

- **Cloud DB:** Supabase. Single source of truth going forward. Local PostgreSQL is demoted to a backup mirror via daily `pg_dump` from Supabase.
- **Encryption model:** server-side AES-256-GCM at rest, owner holds the key. NOT end-to-end. Honestly disclosed in consent doc (built in Phase 6c).
- **Auth:** Argon2id; session tokens in `tb_subject_sessions`. Native `argon2` works on the chosen deploy target.
- **Existing owner data:** dump local then restore to Supabase. Preserved.
- **Subject calibration:** triggers `runCalibrationExtraction()`. Intentional contamination boundary change. Phase 6b scope.
- **Calibration text storage for subjects:** encrypted in `tb_subject_calibrations`. Phase 6b scope.
- **Vector dimension for subject embeddings:** 512 (Matryoshka-truncated, matches owner table).
- **Timezone:** IANA on `tb_subjects`, on-demand scheduling. Phase 6b scope. The current single-user `localDateStr()` pattern is flagged as a RATIONALIZATION in `GOTCHAS.md` line ~93 to force Phase 6b to revisit it.
- **Sub-phase ordering:** 6a (infra + auth + encryption) then 6b (encrypted subject responses + timezone scheduling) then 6c (consent + delete + export) then 6d (embedder queue) then 6e (observatory subject toggle + decrypt + notifications).

### 2a. Three previously-open decisions, NOW RESOLVED

The previous version of this file listed three blockers. Resolved as follows:

1. **Deployment platform:** **Hetzner Cloud CCX (dedicated AMD EPYC vCPU).** Not Vercel, not Cloudflare Workers, not Fly. The reasoning is in the research transcript and the new `CLAUDE.md` Binary Provenance subsection: bit-identity claims demand pinned hardware, and PaaS abstracts that away. Cloudflare Workers breaks `postgres.js` over TCP, the `argon2` C addon, and the napi-rs `.node` file. Vercel cold-starts the `.node` file. Fly silently mixes Milan and Genoa generations. Hetzner CCX gives dedicated EPYC cores with no oversubscription.
2. **Local development DB:** **Local Postgres mirror (option ii from the prior file).** The Rust reproducibility tests, schema migrations, and seed-data work all need a DB you can drop and rebuild. 50-200 ms latency per query against Supabase during dev iteration is unworkable. Drift risk is mitigated by always running migrations against both.
3. **Argon2 replacement:** **Moot.** Hetzner is a real Linux VM, native `argon2` works. Skip the WASM fallback entirely.

### 2b. Critical Hetzner caveat (Milan / Genoa)

Hetzner CCX silently mixes AMD EPYC Milan (Zen 3) and Genoa (Zen 4) generations. Without `RUSTFLAGS="-C target-cpu=x86-64-v3"`, the same Rust binary takes different vectorized FP paths across the fleet and breaks bit-identity. The CI `build-linux-x64` job in `.github/workflows/signal-reproducibility.yml` sets this flag. Production builds MUST set it. See `GOTCHAS.md` for the full explanation.

---

## 3. What the prior session shipped (for the next agent's reference)

Each phase below is verified green at session end. Files touched are listed verbatim so the next agent can review the specific changes.

### Phase 1 — Pipeline early-return fix

**Bug:** `libSignalPipeline.ts` had `if (!ds) return;` / `if (!ms) return;` / `if (!ps) return;` at three sites. Each `return` exited the entire `computeAndPersistDerivedSignals` function, silently skipping every downstream signal family when any single Rust call returned null. The pipeline's documented contract said families ran independently. The bug had been hiding behind a GOTCHAS entry that called the behavior "semi-intentional."

**Fix:** Replaced all three with scoped `if (result) { ... }` blocks. Each save is wrapped in an explicit braced block.

**Files:** `src/lib/libSignalPipeline.ts`. New CLAUDE.md rule under Async & State Patterns. GOTCHAS.md entry rewritten as a historical landmine.

**Lesson the next agent should internalize:** a GOTCHAS entry that uses "semi-intentional" or "matches the pattern of X being best-effort" is a bug being laundered as documentation. The new charter at the top of GOTCHAS.md formalizes this rule.

### Phase 1.5 — GOTCHAS meta-flaw + active rationalizations

**Done:**
- `GOTCHAS.md` got a new charter at the top defining the 4 acceptable categories of entries (necessary friction, historical landmines, discipline rules, philosophy choices) and banning the smell phrases.
- `CLAUDE.md` Agent Navigation section got a new bullet pointing at the GOTCHAS charter.
- The calibration event-storage rationalization was fixed: `saveCalibrationSession` now accepts an `events?` parameter and persists the events row inside its existing `sql.begin` transaction. The old "session data is sacred, derived data is best-effort" framing is gone.
- The `localDateStr()` timezone rationalization was tagged with `RATIONALIZATION, revisit at Phase 6 multi-user transition` so Phase 6b cannot miss it.

**Files:** `src/lib/libDb.ts` (saveCalibrationSession refactored to options object), `src/pages/api/calibrate.ts` (events flow through saveCalibrationSession), `GOTCHAS.md` (charter + 2 entries rewritten), `CLAUDE.md` (Agent Navigation rule).

### Phase 1.75 — Vitest + testcontainers infrastructure

**Done:**
- Installed `vitest@3`, `@vitest/coverage-v8`, `fast-check`, `@testcontainers/postgresql`.
- `vitest.config.ts` wraps Astro's `getViteConfig()` with `pool: 'forks'` (required for napi-rs `.node` modules; the default `threads` pool segfaults on native modules).
- Three projects: `unit`, `db` (testcontainers), `rust` (singleFork to load the binary once across the suite).
- `tests/db/globalSetup.ts` starts a `pgvector/pgvector:pg17` container, applies `dbAlice_Tables.sql`, exposes the URL via `ALICE_PG_URL`.
- `tests/README.md` documents the disciplines: never mock the Rust engine, reject pg-mem.

**Files:** `package.json` (deps + scripts), `vitest.config.ts`, `tests/db/globalSetup.ts`, `tests/README.md`, `tests/unit/sanity.test.ts`.

### Phase 2 — Durable signal pipeline

**Bug being fixed:** `respond.ts` and `calibrate.ts` ran the post-save signal pipeline as a fire-and-forget `(async () => { ... })()` IIFE. Process crashes mid-pipeline (OOM, deploy, signal, restart) silently lost every signal for that session.

**Done:**
- Migration `db/sql/migrations/027_signal_jobs.sql` (also folded into `dbAlice_Tables.sql` under a new `@region jobs`): `te_signal_job_status` (5 rows), `te_signal_job_kind` (2 rows), `tb_signal_jobs` (durable queue with attempts/max_attempts/next_run_at/claimed_at/last_error/params_json/footer).
- Two indexes on `tb_signal_jobs`: a partial index for the claim path (`status_id = 1`), and a partial unique index on `(question_id, kind)` excluding dead-lettered rows so admin can re-enqueue after manual investigation.
- `libDb.ts` got a new `@region jobs` with: `SIGNAL_JOB_STATUS`, `SIGNAL_JOB_KIND` constants; `enqueueSignalJob(input, tx?)` (idempotent INSERT); `claimNextSignalJob()` (atomic UPDATE with FOR UPDATE SKIP LOCKED); `markSignalJobCompleted`; `markSignalJobFailed(id, err, backoffMs)` (handles retry + dead-letter); `sweepStaleSignalJobs(staleAfterMs)` (boot recovery).
- `libSignalWorker.ts` (new, ~200 lines) implements the poll loop with `computeBackoffMs(attempts)` (quadratic, 5-min cap, pure), idempotent `ensureWorkerStarted()` via `globalThis` flag, graceful `stopWorker()`. Two pipeline dispatchers: `runResponsePipeline` (replays the existing post-save IIFE) and `runCalibrationPipeline`.
- `respond.ts` and `calibrate.ts` refactored: the IIFE deleted, `enqueueSignalJob` runs inside the existing `sql.begin` transaction. `saveCalibrationSession` extended with optional `signalJob: { kindId, params }` for the same atomic guarantee.
- 12 unit tests for `computeBackoffMs` (golden values + fast-check properties).
- 17 DB integration tests for the queue, including the load-bearing concurrent-claim test (`Promise.all([claim(), claim()])` on 2 jobs returns 2 distinct rows).

**Files:** `db/sql/migrations/027_signal_jobs.sql`, `db/sql/dbAlice_Tables.sql` (enums + tb_signal_jobs + region marker), `src/lib/libDb.ts` (~150 lines added), `src/lib/libSignalWorker.ts` (new), `src/pages/api/respond.ts`, `src/pages/api/calibrate.ts`, `tests/unit/signalWorker.test.ts`, `tests/db/signalJobs.test.ts`, `tests/db/globalSetup.ts`, `vitest.config.ts` (db globalSetup), `CLAUDE.md`, `GOTCHAS.md`.

### Phase 3 — Binary provenance + build hygiene

**Done:**
- Migration `db/sql/migrations/028_engine_provenance.sql` (also in `dbAlice_Tables.sql`): `tb_engine_provenance` with binary_sha256, code_commit_hash, cpu_model, host_arch, target_cpu_flag, napi_rs_version, rustc_version, dttm_observed_first. Unique on `(binary_sha256, cpu_model)`. `engine_provenance_id` column added to 6 Rust-derived signal tables: tb_dynamical_signals, tb_motor_signals, tb_process_signals, tb_cross_session_signals, tb_session_integrity, tb_reconstruction_residuals. tb_semantic_signals deliberately skipped because semantic computation is pure TypeScript.
- `libDb.ts` new `@region provenance`: `EngineProvenanceInput`/`EngineProvenanceRow` types, `upsertEngineProvenance(input)` (idempotent on the unique key, preserves dttm_observed_first across re-upserts), `getEngineProvenanceById`, `stampEngineProvenance(questionId, provenanceId)` (atomic UPDATE across all 6 tables, only sets where IS NULL, never overwrites existing provenance).
- `libEngineProvenance.ts` (new): `getEngineProvenanceId()` lazy + cached. Pure helpers exposed for unit testing: `parseCpuinfoModelName`, `sha256OfFile`. Returns `null` (never throws) if the `.node` is missing.
- `libSignalWorker.ts.runJob` calls `getEngineProvenanceId()` + `stampEngineProvenance(...)` AFTER pipeline succeeds, BEFORE `markSignalJobCompleted`. Stamp failure is logged but does not fail the job.
- `.github/workflows/signal-reproducibility.yml`: existing `check` job renamed to `check-darwin-arm64`. New `build-linux-x64` job builds with `RUSTFLAGS="-C target-cpu=x86-64-v3"` on ubuntu-latest, prints SHA-256, uploads the artifact (30-day retention).
- 6 unit tests for parseCpuinfoModelName + sha256OfFile.
- 9 DB integration tests for upsert idempotency, provenance per CPU model, stamp idempotency, and "stamp does NOT overwrite existing provenance" (the honest-record property).

**Files:** `db/sql/migrations/028_engine_provenance.sql`, `db/sql/dbAlice_Tables.sql` (new table + 6 ALTERs + region marker), `src/lib/libDb.ts` (~80 lines), `src/lib/libEngineProvenance.ts` (new, ~140 lines), `src/lib/libSignalWorker.ts` (provenance stamp wired in), `.github/workflows/signal-reproducibility.yml`, `tests/unit/engineProvenance.test.ts`, `tests/db/engineProvenance.test.ts`, `CLAUDE.md` (new Binary Provenance subsection), `GOTCHAS.md` (Milan/Genoa entry + provenance-required entry).

**False-flag note:** the original Phase 3 plan included "remove `.node` from git." This was based on a wrong assumption. `git ls-files src-rs/` confirmed the `.node` file is not tracked; `.gitignore` already has `src-rs/*.node`. No removal needed.

### Phase 4 — Typed napi inputs (high-volume paths)

**Done:**
- New `KeystrokeEventInput` `#[napi(object)]` boundary type in `src-rs/src/lib.rs` (decoupled from internal `pub(crate) KeystrokeEvent` via `From` impl + `into_internal_stream` helper).
- 5 napi entry points converted from JSON-string inputs to typed inputs:
  - `compute_dynamical_signals(stream: Vec<KeystrokeEventInput>)`
  - `compute_motor_signals(stream: Vec<KeystrokeEventInput>, total_duration_ms: f64)`
  - `compute_profile_distance(values: Vec<f64>, means: Vec<f64>, stds: Vec<f64>)`
  - `compute_batch_correlations(series_a: Vec<Vec<f64>>, series_b: Vec<Vec<f64>>, window_sizes: Vec<i32>, ...)`
  - `compute_perplexity(corpus: Vec<String>, text: String)`
- `parse_error` plumbing removed from these paths (no JSON parse, no parse error possible).
- TS bindings in `libSignalsNative.ts` updated: no more `JSON.stringify(stream)` per call.
- Reproducibility test fixture refactored to typed `Vec<KeystrokeEventInput>`.
- The 3 callers of `computePerplexity` in `libReconstruction.ts` updated to parse the existing corpusJson once at the call site.

**Files:** `src-rs/src/lib.rs`, `src-rs/tests/reproducibility.rs`, `src/lib/libSignalsNative.ts`, `src/lib/libReconstruction.ts`, `CLAUDE.md` (napi Boundary subsection rewritten).

**Performance impact:** for a typical 5K-keystroke session, ~450KB of JSON serialization across 3 calls eliminated. Not benchmarked end-to-end. The structural elimination is what matters.

### Phase 4.5 — Auto-gen d.ts, typed digraph, typed avatar profile, field maps

This phase was originally deferred. The user pushed back with: "deferred items get forgotten and resurface as bugs." All four items were completed in this session.

**Step 1 — Auto-generated `index.d.ts`:**
- `napi-derive` `type-def` feature enabled.
- `src-rs/scripts/generate-dts.mjs` (new) stitches the JSONL temp file emitted by `napi-derive` into a clean `index.d.ts`.
- `src-rs/build.sh` sets `TYPE_DEF_TMP_PATH` and runs the generator after `napi build`.
- 151 lines of hand-written `NativeModule` interface deleted from `libSignalsNative.ts`. Public types now `NullCoerced<T>` over the generated module type.
- Vestigial `parseError` field removed from Rust `DynamicalSignals`/`MotorSignals` structs (typed inputs cannot fail to parse).

**Step 2 — Typed `digraph_latency_profile`:**
- New `#[napi(object)] DigraphEntry { digraph, latency_ms }`.
- `MotorSignals.digraph_latency_profile` changed from `Option<String>` (JSON-stringified HashMap) to `Option<Vec<DigraphEntry>>` sorted alphabetically. Determinism is now a property of the data structure.
- Storage format intentionally preserved as legacy `Record<digraph, latencyMs>` JSONB so existing readers (`libProfile`, `libCrossSessionSignals`) keep working. The pipeline collapses the typed Vec back to a Record at the JSONB boundary.

**Step 3 — Typed avatar profile inputs:**
- New `AvatarProfileInput` `#[napi(object)]` mirroring the personal motor profile (~22 fields plus `Vec<DigraphAggregateEntry>`).
- `generate_avatar` and `regenerate_avatar` napi entries take `corpus: Vec<String>` and `profile: AvatarProfileInput`.
- Internal `avatar.rs` was NOT changed (1900 lines preserved). The boundary serializes the typed inputs back to JSON via a `profile_input_to_json` helper before calling internal `avatar::compute`. Schema-evolution defense at the FFI; internal API stable.
- `profileFromLegacyJson()` helper in TS converts the legacy stored profile JSON to the typed input for the replay path (`regenerateFromStored`).

**Step 4 — Field maps + DB cross-check:**
- `src/lib/libSignalFieldMaps.ts` (new): four maps (`DYNAMICAL_FIELD_MAP`, `MOTOR_FIELD_MAP`, `PROCESS_FIELD_MAP`, `CROSS_SESSION_FIELD_MAP`), each `as const satisfies CompleteMap<T>`.
- `tests/db/fieldMaps.test.ts` cross-checks every map entry against the live schema. Missing entry on either side fails CI.

**REAL AUDIT FINDING surfaced during this phase (not a hypothetical):**
The schema file `db/sql/dbAlice_Tables.sql` was missing 17 columns that exist in production. Migrations 017-021 added them to the live DB but the project's documented "schema file always reads as a complete intact script" rule was violated. Fixed:
- `tb_dynamical_signals`: 14 columns folded back (`effective_information`, `causal_emergence_index`, `optimal_causal_scale`, `pid_synergy`, `pid_redundancy`, `branching_ratio`, `avalanche_size_exponent`, `dmd_*` x4, `pause_mixture_*` x3)
- `tb_motor_signals`: 3 columns folded back (`mse_series`, `complexity_index`, `ex_gaussian_fisher_trace`)
- `tb_cross_session_signals`, `tb_process_signals`: already in sync

**Files:** `src-rs/Cargo.toml` (type-def feature), `src-rs/src/lib.rs` (boundary types + entry points), `src-rs/src/motor.rs` (digraph output type), `src-rs/build.sh`, `src-rs/scripts/generate-dts.mjs` (new), `src-rs/index.d.ts` (auto-generated), `src-rs/tests/avatar_reproducibility.rs` (fixture refactor), `src/lib/libSignalsNative.ts` (152-line interface deleted, NullCoerced + profileFromLegacyJson + typed avatar wrappers), `src/lib/libReconstruction.ts`, `src/lib/libSignalPipeline.ts` (digraph storage collapses to Record), `src/lib/libSignalFieldMaps.ts` (new), `tests/db/fieldMaps.test.ts` (new), `db/sql/dbAlice_Tables.sql` (17 columns folded back), `CLAUDE.md` (Persistence Field Maps + auto-gen d.ts), `GOTCHAS.md` (3 new historical landmines).

---

## 4. Operational state (snapshot at session end)

### 4a. Local environment
- macOS Darwin 25.4.0 (darwin-arm64).
- Node v22+ (per package.json engines).
- Rust 1.95.0 (per `src-rs/rust-toolchain.toml`).
- Docker via OrbStack (NOT Docker Desktop). OrbStack must be running for any `npm test` invocation that touches the `db` project. Docker Desktop on this user's Mac has a known VM-disk-permission bug; do not switch back.

### 4b. Local PostgreSQL
- Database: `alice` on default localhost port.
- Schema: `alice` with `search_path = alice,public`.
- Migrations applied in order: 001 through 028.
- Most recent applied during this session: 027 (signal jobs), 028 (engine provenance).
- Health: `tb_signal_jobs` and `tb_engine_provenance` exist; the 17 missing columns from migrations 017-021 already existed in the live DB (the bug was schema-file-vs-DB drift, not DB-vs-application drift).

### 4c. Tests
- `npm test` runs 49 tests across 6 files. Requires OrbStack for `tests/db/*`. The first run pulls `pgvector/pgvector:pg17` (~few hundred MB) then is fast on subsequent runs.
- `cd src-rs && cargo test --lib` runs 172 tests.
- `cd src-rs && ./reproducibility-check.sh` runs the two-clean-build snapshot diff.

### 4d. Dependencies (added this session)
**npm devDependencies:**
- `vitest` ^3
- `@vitest/coverage-v8` ^3
- `fast-check` ^3
- `@testcontainers/postgresql` ^11

**Cargo `napi-derive`:** now `{ version = "2", features = ["type-def"] }`. The `type-def` feature is required for the auto-generated d.ts.

### 4e. Files NOT in git (intentional)
- `src-rs/alice-signals.darwin-arm64.node` (gitignored; built locally per platform).
- `src-rs/target/.napi_type_def.tmp` (build artifact).

### 4f. Files generated, MUST be committed when changed
- `src-rs/index.d.ts` (auto-generated by build.sh, committed because TypeScript imports it). After any Rust signature change, `npm run build:rust` regenerates this file; commit the regenerated version.

### 4g. Memory entries written this session (in `/Users/anthonyguzzardo/.claude/.../memory/`)
- `feedback_defer_reasoning.md` — user distrusts "lack of scale" defer reasoning; recommendations must name the specific trigger, failure mode, and how-late-noticed.
- `MEMORY.md` index updated.

---

## 5. Pending Phase 6 plan (the work still to do)

The next agent picks up here AFTER the audit in section 1.

### 5a. Phase 6a — Cloud infrastructure + auth + encryption foundation

**Scope:**
- Provision Hetzner CCX13 (2 dedicated AMD EPYC vCPU, 8 GB RAM). Pin to a single region (Falkenstein or Helsinki). Document the choice.
- Provision Supabase project. Free tier for setup; Pro tier ($25/mo) before subjects come online (Phase 6b) because the Free tier connection caps will bite.
- Generate a server-side AES-256-GCM key. Store outside the repo in a managed secret store (Hetzner volume + restricted permissions, or an encrypted secrets file). The user owns this key.
- Set up DNS: Cloudflare (where `fweeo.com` is registered) points an A record at the Hetzner IP. Cloudflare DNS only; no Cloudflare Workers / Pages.
- Restore local `pg_dump` to Supabase. Verify all migrations 001-028 are present. Run smoke tests against Supabase.
- Build pipeline:
  - GitHub Actions builds the production `.node` for Linux/x86_64 with `RUSTFLAGS="-C target-cpu=x86-64-v3"` (already in `signal-reproducibility.yml` build-linux-x64 job; just needs to publish the artifact to a release).
  - Deploy script: SSH to Hetzner, pull the latest build, restart the systemd unit running the Astro Node server.
  - The server starts the worker via `ensureWorkerStarted()` on first import (already wired).
- Auth scaffolding:
  - Schema: `tb_subjects` (subject_id, email, hashed_password, iana_timezone, created_at, dttm_modified_utc, modified_by). `tb_subject_sessions` (session_id, subject_id, token_hash, expires_at, dttm_created_utc).
  - libSubjectAuth: `signupSubject(email, password, timezone)`, `loginSubject(email, password)`, `verifySubjectSession(token)`. Argon2id for password hashing. Session tokens are random 32 bytes, hashed before storage.
  - Middleware: `/api/subject/*` routes require a valid subject session.
  - Owner auth stays unchanged (still single-user, no auth) for now.
- Encryption library:
  - libCrypto: `encrypt(plaintext): { ciphertext, nonce }`, `decrypt(ciphertext, nonce): plaintext`. AES-256-GCM via Node's built-in `crypto`. Key loaded from env at boot.
  - Key rotation deferred to a future phase; v1 has a single key.

**Tests:**
- `tests/db/subjectAuth.test.ts` — signup creates a row with hashed password (verifies Argon2 hash format); login with correct password returns a session token; login with wrong password fails; expired sessions are rejected.
- `tests/unit/crypto.test.ts` — round-trip encrypt+decrypt; tampered ciphertext fails authentication; different nonce per encryption.

**Acceptance:**
- Astro server runs on Hetzner with the Rust signal engine (`hasNativeEngine: true` from health endpoint).
- Subject can sign up, log in, log out via API.
- A test record encrypted with the server key round-trips through the DB.
- The reproducibility check still passes against the production binary's SHA-256 (recorded in `tb_engine_provenance`).
- Cloudflare DNS resolves `fweeo.com` to the Hetzner IP. TLS via Caddy (or systemd-resolved + ACME, agent's choice).

### 5b. Phase 6b — Encrypted subject responses + timezone scheduling

**Scope:**
- `tb_subject_responses` columns get encrypted variants: `ciphertext` BYTEA, `nonce` BYTEA. Migrations to convert existing schema (this is owner-only at present so the column add is non-destructive).
- Subject submission endpoint `/api/subject/respond`: encrypts response text before insert.
- Subject calibration endpoint `/api/subject/calibrate`: encrypts before insert; enqueues a `calibration_pipeline` job in `tb_signal_jobs` (already supported by the worker).
- Scheduling: `tb_scheduled_questions` honors per-subject `iana_timezone`. The cron-style scheduler runs continuously and uses `(now() AT TIME ZONE subject.iana_timezone)::date` for the per-subject "today."
- `localDateStr()` is now the bug it was tagged as. Replace every call site in the subject-facing path with a tz-aware variant. Audit the GOTCHAS RATIONALIZATION entry as part of the fix.

**Acceptance:**
- A subject in PST submits at 11pm PST. A subject in CET reads at 8am CET the next day. Both see the same scheduled date (their respective local "today").
- Encrypted column round-trips via libCrypto.
- The signal worker drains both owner and subject jobs without distinguishing; both get a provenance stamp.

### 5c. Phase 6c — Consent + delete + export

**Scope:**
- Consent doc (Markdown, served at `/consent`). Honestly states server-side encryption with operator-held key. Specifies retention, deletion guarantees, what data the system collects.
- `/api/subject/delete`: deletes the subject's responses, calibrations, embeddings, signals, sessions; logs an audit row in `tb_subject_deletions` with timestamp + reason.
- `/api/subject/export`: returns a JSON dump of all the subject's plaintext data (decrypted on the way out). Rate-limited; logs an audit row.

**Acceptance:**
- Delete is total: nothing in any `tb_subject_*` table contains the subject's data after the delete completes. (Verify with a script that scans every JSONB and TEXT column for a known marker string before/after delete.)
- Export contains every field the system has on the subject, in plaintext.

### 5d. Phase 6d — Embedder queue

**Scope:**
- Currently `embedResponse` is called inline in the worker's `runResponsePipeline`. For subjects, embedding may need its own job kind to handle TEI service unavailability with retry.
- Add `signal_job_kind_id = 3, enum_code = 'embed_response'`. Default `max_attempts = 10` (TEI may be flaky).
- The response pipeline enqueues an embed job INSTEAD OF calling `embedResponse` directly. The semantic baseline updater inside `computeAndPersistDerivedSignals` already gracefully degrades when the embedding is missing; with the queue, eventual consistency is tolerable.

**Acceptance:**
- Submitting a response when TEI is down: the response saves, the signal pipeline runs, derived signals compute, semantic baseline z-scores are NULL for that session. When TEI comes back, the embed job retries and the embedding lands.

### 5e. Phase 6e — Observatory subject toggle + decrypt + notifications

**Scope:**
- Observatory pages add a subject toggle in the URL (e.g. `/observatory?subject=42`). Renders the subject's data, decrypted on read.
- Authentication: only the owner can view subject pages. The owner is identified by an env-var-controlled passcode for now (proper owner auth is deferred).
- Notification stub: when a subject submits, the owner gets... TBD. Email via Resend? In-app only? Decide during the phase.

**Acceptance:**
- Owner views Observatory for any subject; sees decrypted text and signal trajectories.
- Subject's own auth never lets them see another subject.

---

## 6. Things to NEVER do (cross-reference to GOTCHAS / CLAUDE)

The next agent should not re-introduce any of these. The historical landmine entries in GOTCHAS exist precisely so this list does not have to be remembered.

- Bare `return` inside `computeAndPersistDerivedSignals` (or any pipeline of independent stages).
- Fire-and-forget `(async () => ...)()` IIFEs in API routes. Use `enqueueSignalJob` instead.
- Hand-written `interface NativeModule` in TypeScript. Types come from the auto-generated `src-rs/index.d.ts`.
- ALTER TABLE in `dbAlice_Tables.sql`. Migrations go in `db/sql/migrations/`; the canonical schema file gets the corresponding CREATE TABLE rewrite.
- `JSON.stringify(stream)` on the keystroke path. Pass typed arrays directly to napi.
- "semi-intentional" or "matches the pattern of X being best-effort" wording in GOTCHAS. Read the new charter at the top of GOTCHAS.md before writing any entry.
- Skipping work because "scale is small." If you want to defer, name the trigger, failure mode, and how-late-noticed (memory: `feedback_defer_reasoning.md`).
- Production Linux build without `RUSTFLAGS="-C target-cpu=x86-64-v3"`. Hetzner CCX silently mixes Milan and Genoa; without the flag, FP output diverges across hosts.
- Committing `src-rs/*.node` files. They are gitignored for a reason.
- Editing `src-rs/index.d.ts` by hand. It regenerates on every Rust build.

---

## 7. Quick reference commands

```bash
# Project root
npm run dev                # Astro dev (builds Rust first)
npm run build              # full build
npm test                   # all 49 tests (requires OrbStack)
npm test -- tests/unit     # unit only
npm test -- tests/db       # db only (testcontainers)

# Rust crate (cd src-rs/)
cargo build --release
cargo test --lib
cargo clippy --release -- -D warnings
./build.sh                 # builds .node + regenerates index.d.ts
./reproducibility-check.sh # two-clean-build snapshot diff

# Local DB
psql -d alice -f db/sql/migrations/NNN_*.sql   # apply a migration
psql -d alice -c "\dt alice.*"                  # list tables
psql -d alice -c "\d alice.tb_signal_jobs"      # inspect a table

# OrbStack control
orb start                  # start (first time)
docker info                # verify socket
```

---

## 8. Resume command

The next agent reads this file in full, then runs the audit in section 1. If the audit is clean, they post a short "audit clean" report and start Phase 6a (section 5a). If the audit fails, they halt at the failing check and report.

The user has been clear about pace and discipline: no shortcuts, no skip-by-scale, no rationalizations. Every defer needs a named trigger and a named failure mode. When in doubt, surface the finding and let the user decide.

End of handoff.
