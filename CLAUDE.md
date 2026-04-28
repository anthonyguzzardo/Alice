# Alice

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## Stack
- Astro (SSR with Node adapter)
- PostgreSQL 17 + pgvector — `postgres://localhost/alice`, env `ALICE_PG_URL`, schema `alice`, `search_path = alice,public`
- Rust signal engine via napi-rs (`src-rs/`, dynamical + motor + process)
- Claude API (`@anthropic-ai/sdk`) for question generation
- TypeScript (strict)

## Agent Navigation
- Before data-layer work: `grep '@region' db/sql/dbAlice_Tables.sql` (schema TOC) and `grep '@region' src/lib/libDb.ts` (function TOC). When adding tables/exported functions, update the nearest `@region` marker.
- Before unfamiliar areas: check `GOTCHAS.md`.
- **`GOTCHAS.md` is not a holding pen for bugs.** Only four entry categories: necessary friction, historical landmines (with fix date), discipline rules, philosophy-driven choices (with principle). If you write "semi-intentional" or "matches the pattern of X being best-effort," you're rationalizing a bug — fix the bug and write the entry as a historical landmine.

## Architecture
- Single user (owner) + provisioned subjects (Path 2-lite, see Subject Auth below)
- Schema: `db/sql/dbAlice_Tables.sql`. Seed: `db/sql/dbAlice_Seed.sql`. Pool: `src/lib/libDbPool.ts` (porsager/postgres.js)
- All db functions are async (return Promise). Every call site must `await`.
- Seed questions in `src/lib/libSeeds.ts`. Each new subject = 30 personal seeds; on exhaustion they pull from `tb_question_corpus`. When ≤5 unanswered seeds remain, owner gets a navbar pending-work badge and runs `npm run corpus:refresh` (writes `data/corpus-candidates-YYYY-MM-DD.md`), marks approved with `[x]`, then `npm run corpus:approve <file>` (additive, never overwrites a subject's personal queue). No per-submission auto-generation. Legacy `runGeneration` removed 2026-04-27 (METHODS_PROVENANCE.md INC-014).
- Rust signal engine in `src-rs/` built via `npm run build:rust`. Loaded via napi-rs in `src/lib/libSignalsNative.ts`. **No TS fallback** — if Rust unavailable, signals are null for that session.
- `npm run build` runs Rust build before Astro build.

---

## CRITICAL: Logical Foreign Keys

**THE DATABASE USES LOGICAL FOREIGN KEYS. THERE ARE NO PHYSICAL FK CONSTRAINTS.**

- **No cascade deletes** — application is responsible for child cleanup
- **No referential integrity enforcement** — DB will not reject orphaned references
- **JOINs work fine** — postgres.js uses raw SQL

### The Pattern

```typescript
// Tagged template, JOIN on logical FK, double-quote camelCase aliases (PG lowercases unquoted)
const rows = await sql`
  SELECT s.question_id AS "questionId",
         s.total_duration_ms AS "totalDurationMs",
         q.scheduled_for AS date,
         r.text AS "responseText"
  FROM tb_session_summaries s
  JOIN tb_questions q ON s.question_id = q.question_id
  JOIN tb_responses r ON q.question_id = r.question_id
  WHERE q.question_source_id = 3
  ORDER BY q.question_id ASC
`;

// WRONG -- unquoted camelCase alias (PG lowercases to "totaldurationms")
SELECT s.total_duration_ms AS totalDurationMs

// WRONG -- assumes cascade (orphans rows in tb_responses, tb_session_summaries, etc.)
await sql`DELETE FROM tb_questions WHERE question_id = ${id}`;
```

Reference: `libDb.ts::getCalibrationSessionsWithText()`.

### Cascade Dependencies (children must be deleted FIRST; no FK enforces this)

- `tb_questions` → `tb_responses`, `tb_session_summaries`, `tb_session_events`, `tb_burst_sequences`, `tb_session_metadata`, `tb_dynamical_signals`, `tb_motor_signals`, `tb_semantic_signals`, `tb_process_signals`, `tb_cross_session_signals`, `tb_question_feedback`, `tb_interaction_events`
- `tb_responses` → `tb_embeddings` (where `embedding_source_id = 1`)

Use `sql.begin` for multi-table deletes. When in doubt, don't delete; orphan detection is in the health endpoint.

### Transaction Handles

Write functions in `libDb.ts` accept optional `tx: TxSql` for atomic propagation:

```typescript
await sql.begin(async (tx) => {
  await saveResponse(questionId, text, tx);
  await saveSessionSummary(summary, tx);
  await saveBurstSequence(questionId, bursts, tx);
});
```

Without `tx`, each function uses the module-level pool independently. Optional so existing single-write call sites are unaffected.

---

## Shared Constants (do not duplicate)

- **`SESSION_SUMMARY_COLS`** (`libDb.ts`): single source for the ~37-column SELECT mapping `tb_session_summaries` → `SessionSummaryInput`. Use via `sql.unsafe`. Never inline.
- **`coerceSessionSummary()`** (`utlSessionSummary.ts`): single source for converting client JSON → typed `SessionSummaryInput`. Handles null coercion, computes MATTR + sentence metrics server-side, merges linguistic densities. Used by both `calibrate.ts` and `respond.ts`. New session-summary fields: update `coerceSessionSummary` AND `SESSION_SUMMARY_COLS` together.

---

## Database Conventions

- **Prefixes**: `te_` (enum/static), `td_` (dictionary), `tb_` (mutable), `tm_` (matrix), `th_` (history)
- **Surrogate keys**: `table_name_id` (NEVER just `id`)
- **Logical FKs only** — no physical FK constraints
- **Footer columns** on mutable tables: `dttm_created_utc`, `created_by`, `dttm_modified_utc`, `modified_by`. None on enum tables.
- **Header comments** on every table: PURPOSE, USE CASE, MUTABILITY, REFERENCED BY, FOOTER
- **Enum tables** get explicit INSERT with fixed IDs
- **No ALTER TABLE in schema file** (`db/sql/dbAlice_Tables.sql`) — rewrite the CREATE TABLE so schema reads as a complete script. Increments go in `db/sql/migrations/`.
- **No proper nouns** in column names
- **JSONB columns**: `traits_json`, `signals_json`, `deletion_events_json`, `iki_autocorrelation_json`, `digraph_latency_json`, `pe_spectrum`, prompt trace ID arrays. (Migration 031 converted `event_log_json` and `keystroke_stream_json` to encrypted ciphertext+nonce TEXT pairs; app `JSON.stringify`s before encrypt and `JSON.parse`s after decrypt.)
- **Embeddings**: `vector(512)` on `tb_embeddings` via pgvector with HNSW index

---

## Naming Convention

Prefixes make files self-identifying outside their directory (in stack traces, search results, tab bars). `cmpAppNav` is a component, `layBase` is a layout, `utlDate` is a utility — never ambiguous in the wild.

| Prefix | Type | Example |
|--------|------|---------|
| `lib` | Library/domain logic | `libDynamicalSignals.ts` |
| `utl` | Utility | `utlDate.ts` |
| `cmp` | Astro component | `cmpAppNav.astro` |
| `lay` | Astro layout | `layBase.astro` |
| `sty` | CSS file | `styObservatory.css` |

Rules:
1. Prefix + PascalCase, no hyphens (`libDynamicalSignals.ts`, not `dynamical-signals.ts`)
2. Subdirectories also prefixed (`libAliceNegative/libStateEngine.ts`)
3. **NOT prefixed**: `src/pages/*.astro` (file-based routing → URLs, kebab-case), `src/pages/api/*.ts` (kebab-case), `src/scripts/*.ts` (kebab-case, invoked by path), `src-rs/src/*.rs` (snake_case per Rust)
4. SQL: `db/sql/dbAlice_*.sql`, migrations `db/sql/migrations/NNN_description.sql`

Layout:
```
src/
├── components/     # cmpX.astro
├── layouts/        # layX.astro
├── lib/            # libX.ts / utlX.ts (+ libAliceNegative/ submodule)
├── pages/          # kebab-case.astro (api/ also kebab-case.ts)
├── scripts/        # kebab-case.ts (runnable tasks)
└── styles/         # styX.css
db/sql/             # dbAlice_X.sql, migrations/NNN_*.sql
src-rs/src/         # snake_case.rs
```

---

## Async & State Patterns

**All db calls are async. No exceptions.** API routes (`src/pages/api/*.ts`) are async handlers returning `Response`.

- **Background work is durable, not fire-and-forget.** After HTTP response commits, durable work is enqueued in `tb_signal_jobs` (`enqueueSignalJob` in `libDb.ts`) and drained by `libSignalWorker.ts`. Compute is idempotent (guarded by `if (!(await getXSignals(qid)))`) so retries replay safely. Errors land in `data/errors.log` AND on the failed job row's `last_error`. **Fire-and-forget IIFEs in API routes are forbidden** — pre-2026-04-25 this silently lost signals on crash. See GOTCHAS.md.
- **Pipeline stages must use scoped `if (result) { ... }` blocks, never bare `return`, to skip a failed stage.** A `return` inside one stage exits the whole function and silently voids the independence guarantee. Functions whose contract is "each stage runs independently" must catch the failure, leave the stage's persisted output absent, and continue. (Bug carried at 3 sites until 2026-04-25 — see GOTCHAS.md.)

## Signal Job Worker (`libSignalWorker.ts`)

State machine: `queued → running → completed | failed → queued | dead_letter`.

- **Atomic claim**: `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`. Concurrent workers never collide.
- **Backoff**: quadratic, capped at 5min. `computeBackoffMs(attempts)` is pure (`tests/unit/signalWorker.test.ts`).
- **Dead-letter** when `attempts >= max_attempts` (default 5). Partial unique index `uq_signal_jobs_question_kind` excludes dead-lettered rows so admin can re-enqueue after manual investigation.
- **Boot-time sweep** re-queues `running` jobs older than `STALE_RUNNING_AFTER_MS` (10min) — recovers from mid-pipeline crashes.
- **Worker startup**: `ensureWorkerStarted()` called from `respond.ts` and `calibrate.ts` at module load. First call wins; subsequent no-op via `globalThis` flag (survives HMR in dev).
- **One job per session, not per family** — idempotent guards make per-stage replay free; per-family granularity would multiply schema/coordination cost without commensurate observability gain.

---

## Rust Signal Engine (`src-rs/`)

The crate is a **measurement instrument**, not a computation library. Every signal is a quantitative claim about a person's cognitive state derived from keystroke dynamics — stricter requirements than application code.

**Standards:**
- **Estimation quality over convenience.** Ex-Gaussian fit uses MLE via EM (Lacouture & Cousineau 2008), not method of moments — tau is the signal and MoM is unreliable on small samples. Falls back honestly if MLE doesn't improve over MoM. Produce a trustworthy number or produce nothing.
- **Multi-scale over single-point.** PE is computed at orders 3-7 (`pe_spectrum`), not just order 3. A single PE collapses temporal structure across scales. Ask whether one number is sufficient or whether the measurement needs multiple scales.
- **The napi boundary is a measurement interface, not an API.** `Option::None` means "session didn't produce enough data for a reliable measurement," not "something went wrong." `SignalError` enum (`InsufficientData`, `ZeroVariance`, `DegenerateValue`, `ParseError`) preserves why.
- **Numerical functions must be cited.** `erfc` uses Abramowitz & Stegun 7.1.26. KSG transfer entropy uses Kraskov et al. 2004. DFA uses Peng et al. 1994. New statistical functions cite source and approximation error bound.

**Two kinds of signals.** `dynamical.rs` and `motor.rs` are *estimators* (numerical computations of quantities from cited literature with known error bounds). `process.rs` is *structural descriptions* (heuristic counters, pattern classifiers describing the shape of a session without estimating any single quantity). Standards differ — estimators require citation/error bounds/typed errors; structural descriptions require tested logic, documented heuristics, honest naming (`i_burst_count` must actually count I-bursts as defined, not a superset).

The Rust crate must be written to Rust's standards, not JavaScript's.

### Type Discipline

- **Newtypes for domain separation.** `IkiSeries` and `FlightTimes` wrap private `Vec<f64>` with controlled constructors (`from_stream`) that apply filtering. Unfiltered series cannot be constructed outside `types.rs` in non-test code. `HoldFlight` encapsulates `holds` similarly, accessed via `.holds() -> &[f64]`. Tuple struct with a `pub` inner field is a newtype in name only — make the inner field private.
- **Newtypes earn their keep by flowing.** Justified when constructed in one place and used in another (preventing a category of mistake at the use site). Constructed-and-consumed in the same struct with no constructor = ceremony; either give it a `from_*` constructor or inline the field.
- **Internal items are `pub(crate)`, not `pub`.** The crate is `cdylib` with no Rust consumers; everything below the napi boundary is crate-internal. `pub` is reserved for items crossing FFI (`#[napi]` functions and `#[napi(object)]` structs in `lib.rs`).
- **`SignalError` enum over `Option`** internally. Convert to `Option` with `.ok()` only at the napi boundary in `lib.rs`. Never silently default with `unwrap_or_default()` — propagate the error.
- **`#[derive(Debug)]` on all `pub(crate)` types** — useful test failure output, standard library practice.
- **Structs get methods.** Derived properties (e.g. `HoldFlight::aligned_len()`) live on the struct, not inline at the call site.
- **`KeystrokeEvent` uses `#[serde(rename)]`**: wire is `{c, d, u}`, Rust fields are `character`, `key_down_ms`, `key_up_ms`. Always use the readable names in Rust code.

### UTF-8 Safety

- **JS cursor positions are UTF-16 code units. Rust strings are UTF-8.** Convert through `types::utf16_to_byte_offset()` before indexing into a Rust string. Indexing raw bytes at a UTF-16 offset panics on any non-ASCII character (curly quotes, accented letters, emoji).
- **Count comparisons are unit-typed.** When comparing Rust counts against JS-sourced counts (like `deletedCount`), convert both sides to UTF-16 code units via `.chars().map(|c| c.len_utf16()).sum::<usize>()`. Byte length (`.len()`) and char count (`.chars().count()`) are both wrong vs UTF-16.
- **Never use `text.as_bytes()[pos]`** with JS-sourced positions. Use `text[..byte_offset].chars().next_back()`.

### Deterministic Iteration

- **Never iterate `HashMap` on a path feeding sampling/output.** Iteration order is nondeterministic across runs (randomized hash seeds). Same seed → different results = correctness bug for any reproducibility claim.
- **Pattern: build with `HashMap`, freeze into sorted `Vec`.** Use `HashMap` as a mutable builder, then `.into_iter().collect()` into `Vec<(K, V)>` and `.sort_by()` on the key. All reads go through the sorted vec. See `MarkovChain` and `PpmTrie` in `avatar.rs`.
- **`sorted_vec_get()`** for O(log n) lookup into frozen sorted vecs (binary search on key).
- **`BTreeMap`** when the structure needs insertion after construction (online learning without rebuild). For build-once-sample-many, sorted vecs preferred for cache locality.
- **Determinism tests required**: any module with a seeded PRNG must call the function twice with the same seed and assert identical output. See `avatar::tests::determinism_*`.

### napi Boundary (`lib.rs`)

- `lib.rs` is a **thin mapping layer**. Accepts typed napi inputs (`Vec<KeystrokeEventInput>`, `Vec<f64>`, `Vec<Vec<f64>>`, `Vec<String>`, `AvatarProfileInput`), calls module `compute()` functions, maps internal results to flat `#[napi(object)]` structs. **No signal logic.**
- **Inputs/outputs are typed `#[napi(object)]` structs and primitive vectors.** JSON strings only for genuinely heterogeneous payloads (e.g. `event_log_json` with variable event shapes). Never use `String` for fixed-schema values — pre-2026-04-25 used `stream_json: String` and serialized ~1MB per call.
- **Boundary-mirror pattern.** When internal Rust type and FFI shape disagree on visibility/naming, define a separate `pub` `#[napi(object)]` struct with wire-format names and a `From` impl into the internal `pub(crate)` type. Examples: `KeystrokeEventInput` → `KeystrokeEvent`; `AvatarProfileInput` → `TimingProfile` (via `profile_input_to_json`).
- **TypeScript types are auto-generated.** `napi-derive` with `type-def` emits JSONL at `target/.napi_type_def.tmp` during `cargo build`; `src-rs/build.sh` sets `TYPE_DEF_TMP_PATH`, then `src-rs/scripts/generate-dts.mjs` stitches into `src-rs/index.d.ts`. The TS layer (`libSignalsNative.ts`) imports from this file. **Hand-written interfaces mirroring napi shapes are forbidden** — they drift; the generated file cannot.
- `usize` → `i32` via `i32::try_from(x).unwrap_or(i32::MAX)`. Never `as i32`.
- `Option::None` → `undefined` in JS. TS layer coerces to `null` for postgres.js via `NullCoerced<T>` and `n()` / `na()` helpers.

### Persistence Field Maps (`libSignalFieldMaps.ts`)

camelCase ↔ snake_case mapping between typed signal results and `tb_*_signals` columns lives in **one source of truth per family**: `DYNAMICAL_FIELD_MAP`, `MOTOR_FIELD_MAP`, `PROCESS_FIELD_MAP`, `CROSS_SESSION_FIELD_MAP`. Each is `as const satisfies CompleteMap<T>` so missing keys are tsc errors. DB integration test `tests/db/fieldMaps.test.ts` cross-checks against the live schema — typo that would silently null a column becomes a loud test failure.

Adding a new signal field: edit Rust struct → rebuild (regenerates d.ts) → add to matching map.

### Clippy & Linting

- Crate-level `#![allow(clippy::cast_precision_loss)]` (values bounded by keystroke count, realistically < 50K).
- Per-item `#[allow]` requires a comment justifying false positive.
- `clippy::suspicious_operation_groupings` suppressed on OLS formulas (`n*Sxx - Sx^2`) with formula citation.
- Use `mul_add` where clippy suggests `suboptimal_flops` (faster + numerically stable).
- Run `cargo clippy -- -W clippy::all` before commit. Zero warnings on standard lints.

### Testing

- Every module has `#[cfg(test)]`. Add tests with new signal computations.
- **Golden value**: known input → pre-computed output (e.g. PE of sorted = 0).
- **Invariant**: properties that must hold (entropy ≥ 0, recurrence_rate ∈ [0,1]).
- **Error variant**: `assert!(matches!(result, Err(SignalError::InsufficientData { .. })))`.
- **UTF-8 safety**: text reconstruction code must test emoji + multibyte characters, prove no panic.
- Run `cargo test` before commit.
- **Reproducibility check**: CI enforces bit-identity on every PR touching `src-rs/**` via `.github/workflows/signal-reproducibility.yml` (clippy, unit tests, two-clean-build snapshot diff). `npm run reproducibility-check` is recommended for fast local iteration but is not the enforcement mechanism. See `src-rs/REPRODUCIBILITY.md`.

### Module Structure

```
src-rs/src/
├── lib.rs        # napi boundary: structs + entry points (no logic)
├── types.rs      # SignalError, KeystrokeEvent, newtypes, utf16 conversion
├── stats.rs      # mean, std_dev, erfc, digamma, extract_iki, linreg_slope (#[inline])
├── dynamical.rs  # PE (single + spectrum), DFA, RQA, KSG transfer entropy
├── motor.rs      # sample entropy, autocorrelation, ex-Gaussian (MLE/EM), compression
├── process.rs    # text reconstruction, pause/burst analysis
└── avatar.rs     # ghost engine: Markov/PPM, timing synthesis, adversary variants
```

Each compute module defines its own result struct (`DynamicalResult`, `MotorResult`, etc). `lib.rs` maps these to flat napi output structs.

### Avatar Engine (`avatar.rs`)

The avatar (ghost) is a reconstruction adversary: generates synthetic keystroke streams from a person's statistical profile. Five adversary variants isolate which behavioral dimension carries signal (text prediction via Markov/PPM, IKI correlation via AR(1), hold/flight coupling via Gaussian copula). Reconstruction residuals reveal what a profile reproduces vs what requires the actual person.

- **Sampler factories over boolean flags.** Timing synthesis takes `IkiSampler`/`HoldSampler` closures per-variant, keeping the generation skeleton variant-agnostic.
- **Build-once-sample-many.** `MarkovChain` and `PpmTrie` built from `HashMap` then frozen into sorted vecs (see Deterministic Iteration above).
- **String cloning is intentional.** Corpus vocab is ~2-5K words; interning would add complexity for zero gain. Documented on the `MarkovChain` struct.
- **`compute_seeded()` for testability.** Public `compute()` uses time-based seed; tests use fixed seed.

### Single Source of Truth

Rust is the only signal computation. No TS fallback. Two implementations can disagree, and disagreement is indistinguishable from a bug. If the instrument is unavailable, the measurement doesn't happen — the session saves; derived signals are absent until `npm run build:rust`. Health endpoint exposes `rustEngine: true/false`.

### Binary Provenance

A bit-identity claim that doesn't extend to production rows is marketing, not a measurement guarantee. Every Rust-derived signal row records `engine_provenance_id` linking to `tb_engine_provenance`, identifying the `(binary_sha256, cpu_model)` pair that produced it.

- **One row per (binary, CPU model) pair.** Same binary on different microarchitectures (AMD EPYC Milan vs Genoa) gets distinct rows — vectorized FP paths can diverge across uarchs.
- **Captured once per process** via `getEngineProvenanceId()` in `libEngineProvenance.ts`: lazily computes SHA-256 of loaded `.node`, reads CPU model (`sysctl` macOS / `/proc/cpuinfo` Linux), `napi-rs` and `rustc` versions, upserts. Cached for process lifetime.
- **Stamped after pipeline, before completion.** `libSignalWorker.runJob` calls `stampEngineProvenance(questionId, provenanceId)`. Updates all 6 Rust-derived signal tables atomically, only where `IS NULL`. Idempotent on retry.
- **NULL = pre-provenance era** (rows from before 2026-04-25). Column is nullable by design — missing stamp must never block a measurement.
- **Production build flag**: linux/x86_64 builds with `RUSTFLAGS="-C target-cpu=x86-64-v3"`. Pins instruction baseline (AVX2 + FMA + BMI2) so AMD EPYC Milan and Genoa produce bit-identical output. Without it, runtime CPU dispatch can diverge across the Hetzner fleet's microarchitecture mix and break bit-identity. CI's `build-linux-x64` job sets this.
- **Compiled `.node` is never in git.** Built per-target locally (`npm run build:rust`) or in CI (`signal-reproducibility.yml`). `src-rs/*.node` is in `.gitignore`. Dev `.node` ≠ prod `.node`; provenance row tells you which.

---

## Known Gotchas

- **VoyageAI types in `libEmbeddings.ts`**: `voyageai` imported via `createRequire` (CJS shim in ESM). If type errors resurface on `VoyageAIClient` or `result: unknown`, extract module ref separately, use `InstanceType<typeof VoyageAIClient>`, cast embed responses to `{ data?: Array<{ embedding?: number[] }> }`.
- **PostgreSQL camelCase aliases**: PG lowercases unquoted identifiers. Double-quote camelCase: `SELECT col AS "camelCase"`.
- **JSONB auto-parsing**: postgres driver auto-parses JSONB into JS objects. Functions returning JSONB to callers expecting strings must re-stringify.
- **Rust native module**: loaded via `createRequire` in `libSignalsNative.ts`. Binary path resolves per `process.platform`/`process.arch` via `resolveBinaryFilename()` and is exported as `BINARY_PATH` so `libEngineProvenance` hashes the exact loaded file. Targets: `darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`, `win32-x64-msvc`. If binary missing, signals null + `rustEngine: false`. Rebuild with `npm run build:rust`.

---

## Subject Auth (Path 2-lite, 2026-04-25)

Subjects authenticate with username + Argon2id password. Owner manually provisions accounts via `npm run create-subject -- <username> <temp-password> [tz] [display-name]`, hands credentials privately, subject is forced to reset on first login (`must_reset_password` → FALSE). No self-service signup, no email service, no email-based recovery. Owner is the recovery mechanism (re-run `create-subject` with new temp password if needed).

**Key files:**
- `src/lib/libSubjectAuth.ts` — Argon2id hash/verify, session token issue/verify, password reset, owner provisioning
- `src/lib/libSubject.ts` — `getRequestSubject()` resolves cookie via `verifySubjectSession`
- `src/middleware.ts` — Astro middleware: attaches `locals.subject`, gates `/api/subject/*` (auth + owner check + must_reset_password)
- `src/pages/api/subject/{login,reset-password,logout}.ts`
- `src/pages/{login,reset-password}.astro` — universal login (subjects + owner) and forced-reset form
- `src/scripts/create-subject.ts`, `src/scripts/set-owner-password.ts`

**Token model**: raw 32-byte hex token in cookie, SHA-256(token) in `tb_subject_sessions`. DB leak alone doesn't grant active sessions (attacker also needs live cookie). 30-day expiry, no sliding renewal. Password reset deletes ALL sessions for that subject (forces re-login everywhere).

**Universal login (2026-04-28)**: every protected route — subject and owner — flows through `src/middleware.ts`. Both auth paths share the same session-cookie infrastructure (Argon2id verify, opaque 32-byte hex in cookie, SHA-256 in DB). HTML routes redirect to `/login?next=<path>` when unauth; API routes return 401 JSON. `isOwner` flag in login response dispatches redirect (owner → `/`, subject → `/subject`). Pre-2026-04-28 Caddy basic-auth gate (`OWNER_BASICAUTH_HASH`) retired in same change. Cookie has no `Max-Age` — closes with browser; server-side row in `tb_subject_sessions` still has its 7-day cap.

**`invite_code` is legacy** (pre-2026-04-25 single-static-code auth). Column still on `tb_subjects` (nullable) for backward compat with any unmigrated read paths; new code MUST use session auth. See `GOTCHAS.md` for the historical landmine.

---

## At-rest Encryption (`libCrypto.ts` + migration 031)

Every subject-bearing text and JSONB column is encrypted before write to Supabase via AES-256-GCM. Migration 031 (Step 8 of unification, 2026-04-27) extended v1 primitive to schema-level discipline. Key from `ALICE_ENCRYPTION_KEY` (base64 32 bytes, loaded from systemd `EnvironmentFile`). GCM auth tag appended to ciphertext for storage; decrypt splits and throws on tampering.

```ts
import { encrypt, decrypt } from './libCrypto.ts';
const { ciphertext, nonce } = encrypt(plaintext);  // both base64
const original = decrypt(ciphertext, nonce);       // throws on tamper
```

**Encrypted columns** (post-031): `tb_responses.text`, `tb_questions.text`, `tb_embeddings.embedded_text`, `tb_session_events.event_log_json`+`keystroke_stream_json`. Each becomes `<col>_ciphertext`+`<col>_nonce` TEXT pair. See `db/sql/migrations/030_STEP8_ENCRYPTION.md` for full inventory and rationale. (`tb_calibration_context.value`+`detail` and `tb_reflections.text` were also encrypted at 031, then both tables archived 2026-04-27 — INC-015/migration 034, INC-017/migration 036.)

**Encrypted-content table invariant.** Tables holding subject-authored content via `<col>_ciphertext`+`<col>_nonce` (`tb_responses`, `tb_questions`, `tb_session_events`) MUST contain only subject-authored or subject-derived signal fields. Operator-side annotations (review notes, QA flags, internal triage state) belong in separate tables, never as new columns on these. Load-bearing for `/api/subject/export`: the endpoint uses `SELECT *` and strips ciphertext pairs before writing decrypted plaintext, so any future column flows into export automatically. Adding an operator-side column ships operator state to the subject by default. (Phase 6c, established 2026-04-28.)

**Boundary discipline**: every read of an encrypted column lives inside `src/lib/libDb.ts`. Application code above libDb sees plaintext on the way in and out — never ciphertext. Direct SELECTs of encrypted columns outside libDb are forbidden by convention. Helpers in `@region encrypted-reads`: `getResponseText`, `getQuestionTextById`, `getEventLogJson`, `getKeystrokeStreamJson`, `listEventLogJson`, `listKeystrokeStreams`, `listResponseTexts`.

**Key facts:**
- `ALICE_ENCRYPTION_KEY` is permanent. Lose it = lose every encrypted row across all in-scope tables. Backed up in operator's password manager AND in `/etc/alice/secrets.env`.
- Each `encrypt()` generates a fresh 12-byte random nonce — same plaintext → different ciphertext.
- `decrypt()` throws on tampered ciphertext, tampered nonce, or wrong key. Never returns garbage.
- No key rotation in v1.
- SQL operators (`GROUP BY`, `DISTINCT`, `=`) on encrypted columns no longer collapse identical plaintexts (random nonces yield distinct ciphertexts). Two existing operators were migrated to decrypt-then-dedupe-in-JS: `libDb.getCalibrationPromptsByRecency` and `health.ts:166` duplicate-question anomaly check. New code needing equality on encrypted columns must follow this pattern.

---

## Deployment (Hetzner Hillsboro CCX13 + Supabase us-west-2)

Production runs on a single Hetzner CCX13 in Hillsboro, OR (matching Supabase region for sub-5ms DB latency). Code at `/opt/alice` owned by non-root `alice` user. systemd unit `deploy/alice.service` runs the Astro Node server which auto-starts the signal worker via `ensureWorkerStarted()` on first import.

`deploy/deploy.sh` pushes latest main and the linux-x64 `.node` artifact (from CI's `alice-signals-linux-x64` artifact) and restarts the unit. systemd `TimeoutStopSec=30` lets in-flight signal jobs drain (worker installs SIGTERM handler calling `stopWorker()`).

DB migrations are NOT auto-applied — run by hand: `psql -d "$ALICE_PG_URL" -f db/sql/migrations/NNN_*.sql`. Auditing before running is the discipline.

See `deploy/README.md` for one-time host-setup walkthrough.

---

## Archival

**Archival means removal, not stubbing.** Archiving a feature deletes its database tables, API handlers, lib functions, and downstream integration points (health check fields, signal registries) in the same commit. Stub functions preserving imports during a transition must be deleted by the time the archival commit lands. Hardcoded `true`/`false` in place of computed coverage is never acceptable; remove the coverage field entirely instead. Data is preserved under `zz_archive_*` tables in the database, not in application code.

---

## Philosophy

Every technical decision should serve depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.

**Single source of truth for measurements.** Every signal is computed by exactly one implementation (Rust). A measurement instrument cannot have two implementations. If unavailable, the measurement doesn't happen. A silent wrong answer is worse than no answer.
