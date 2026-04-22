# Alice

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## Stack
- Astro (SSR with Node adapter)
- PostgreSQL 17 + pgvector (connection: `postgres://localhost/alice`)
- Rust signal engine via napi-rs (`src-rs/`, dynamical + motor + process signals)
- Claude API (@anthropic-ai/sdk) for question generation and pattern surfacing
- TypeScript (strict)

## Agent Navigation
- Before data-layer work, run `grep '@region' db/sql/dbAlice_Tables.sql` for the schema table of contents and `grep '@region' src/lib/libDb.ts` for the function table of contents.
- When adding new tables or exported functions to these files, update the nearest `@region` marker to include the new name. When adding a new gotcha, append it to `GOTCHAS.md`.
- Before touching unfamiliar areas, check `GOTCHAS.md` for known landmines.

## Architecture
- Single user, no auth
- PostgreSQL database `alice`, schema `alice` (local, connection via `ALICE_PG_URL` env var, `search_path = alice,public`)
- Schema managed by `db/sql/dbAlice_Tables.sql`, seed data in `db/sql/dbAlice_Seed.sql`
- Connection pool in `src/lib/libDbPool.ts` (porsager/postgres.js)
- All db functions are async (return Promise)
- Seed questions in `src/lib/libSeeds.ts`
- Nightly script (`npm run generate`) generates tomorrow's question from past responses
- Rust signal engine in `src-rs/` built via `npm run build:rust`
- Signal pipeline (`src/lib/libSignalsNative.ts`) loads Rust via napi-rs. No TS fallback; if Rust is unavailable, signals are null for that session
- `npm run build` runs Rust build before Astro build

---

## CRITICAL: Logical Foreign Keys

**THE DATABASE USES LOGICAL FOREIGN KEYS. THERE ARE NO PHYSICAL FK CONSTRAINTS.**

This means:
- **No cascade deletes** -- deleting a parent row will NOT automatically delete children
- **No referential integrity enforcement** -- the database will not reject orphaned references
- **JOINs work fine** -- postgres.js uses raw SQL, not an ORM that needs FK metadata
- **Application code is responsible** for consistency when inserting or deleting across tables

### The Pattern (ALWAYS USE THIS)
```typescript
// CORRECT -- postgres.js tagged template with logical FK JOIN
const rows = await sql`
  SELECT r.response_id, r.text, q.scheduled_for AS date, q.text AS question_text
  FROM tb_responses r
  JOIN tb_questions q ON r.question_id = q.question_id
  WHERE q.scheduled_for = ${today}
`;

// CORRECT -- multi-table JOIN with camelCase aliases (must double-quote)
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

// WRONG -- unquoted camelCase alias (PG lowercases it)
SELECT s.total_duration_ms AS totalDurationMs  -- becomes "totaldurationms"

// WRONG -- assuming cascade delete behavior
await sql`DELETE FROM tb_questions WHERE question_id = ${id}`;
// ^^^ orphans rows in tb_responses, tb_session_summaries, tb_entry_states, etc.
```

### Reference Implementation

See `src/lib/libDb.ts` -- `getCalibrationSessionsWithText()` for the canonical multi-table JOIN pattern.

### Cascade Dependencies per Parent Table

When deleting from a parent table, the following children must be deleted first (or the delete must be skipped). There are no physical FK constraints to enforce this; application code is responsible.

- `tb_questions` -> `tb_responses`, `tb_session_summaries`, `tb_session_events`, `tb_burst_sequences`, `tb_session_metadata`, `tb_dynamical_signals`, `tb_motor_signals`, `tb_semantic_signals`, `tb_process_signals`, `tb_cross_session_signals`, `tb_calibration_context`, `tb_question_feedback`, `tb_interaction_events`
- `tb_responses` -> `tb_entry_states`, `tb_semantic_states`, `tb_embeddings` (where `embedding_source_id = 1`)
- `tb_witness_states` -> no children (leaf table)
- `tb_entry_states` -> no children (leaf table)

Prefer `sql.begin` for any multi-table delete. When in doubt, do not delete; orphan detection is in the health endpoint.

### Transaction Handles for Multi-Table Writes

Write functions in `libDb.ts` accept an optional `tx` parameter (`TxSql`) for transaction propagation. When performing multiple writes that must be atomic, use `sql.begin` and pass the transaction handle through:

```typescript
await sql.begin(async (tx) => {
  const responseId = await saveResponse(questionId, text, tx);
  await saveSessionSummary(summary, tx);
  await saveBurstSequence(questionId, bursts, tx);
});
```

Without the `tx` parameter, each function uses the module-level connection pool and runs independently. The `tx` parameter is optional so existing single-write call sites are unaffected.

---

## Database Conventions
- **Table prefixes**: `te_` (enumeration/static), `td_` (dictionary), `tb_` (normal/mutable), `tm_` (matrix), `th_` (history)
- **Surrogate keys**: `table_name_id` (NEVER just `id`)
- **Logical foreign keys only** -- no physical FK constraints
- **Footer columns** on mutable tables: `dttm_created_utc`, `created_by`, `dttm_modified_utc`, `modified_by`
- **No footer** on static enum tables
- **Header comments** on every table: PURPOSE, USE CASE, MUTABILITY, REFERENCED BY, FOOTER
- **Enum tables** get explicit INSERT with fixed IDs
- Do NOT use ALTER TABLE **in the schema file** (`db/sql/dbAlice_Tables.sql`) -- rewrite the CREATE TABLE so the schema always reads as a complete, intact script. Incremental changes belong in migration files under `db/sql/migrations/`.
- Do NOT hard-code proper nouns into column names
- **JSONB columns**: event_log_json, keystroke_stream_json, traits_json, signals_json, deletion_events_json, iki_autocorrelation_json, digraph_latency_json, pe_spectrum, prompt trace ID arrays
- **Embeddings**: stored as `vector(512)` on `tb_embeddings` via pgvector with HNSW index

---

## Naming Convention

**Why prefixes exist:** Every prefix (`lib`, `utl`, `cmp`, `lay`, `sty`) makes a file self-identifying outside its directory. When a filename appears in a search result, a stack trace, an import line, or a tab bar, the prefix tells you what it is without needing the path. `cmpAppNav` is a component. `layBase` is a layout. `utlDate` is a utility. The file should never be ambiguous when encountered in the wild.

All folders and files follow consistent conventions by layer.

### File Naming by Directory

| Directory | Prefix | Convention | Example |
|-----------|--------|-----------|---------|
| `src/lib/` | `lib` / `utl` | PascalCase `.ts` | `libDynamicalSignals.ts`, `utlDate.ts` |
| `src/lib/libAliceNegative/` | `lib` | PascalCase `.ts` | `libEmotionProfile.ts`, `libRenderWitness.ts` |
| `src/components/` | `cmp` | PascalCase `.astro` | `cmpAppNav.astro`, `cmpPublicNav.astro` |
| `src/layouts/` | `lay` | PascalCase `.astro` | `layApp.astro`, `layBase.astro` |
| `src/styles/` | `sty` | PascalCase `.css` | `styObservatory.css` |
| `src/pages/` | none | kebab-case `.astro` | `alice-negative.astro`, `landing.astro` |
| `src/pages/api/` | none | kebab-case `.ts` | `calibration-drift.ts`, `signal-variants.ts` |
| `src/scripts/` | none | kebab-case `.ts` | `generate-question.ts`, `backfill-embeddings.ts` |
| `src-rs/src/` | none | snake_case `.rs` | `dynamical.rs`, `motor.rs` |
| `db/sql/` | `dbAlice_` | PascalCase `.sql` | `dbAlice_Tables.sql`, `dbAlice_Seed.sql` |

### Prefixes

| Prefix | Type | Use for |
|--------|------|---------|
| `lib` | Library/domain logic | Signal computation, database, AI/ML, domain modules |
| `utl` | Utility | Generic helpers (date, error logging, word lists) |
| `cmp` | Component | Astro components |
| `lay` | Layout | Astro layouts |
| `sty` | Style | CSS files |

### Rules

1. **Prefix + PascalCase, no hyphens**: `libDynamicalSignals.ts`, not `dynamical-signals.ts`
2. **Subdirectories also prefixed**: `libAliceNegative/libStateEngine.ts`
3. **Pages and API routes are NOT prefixed**: file-based routing maps to URLs directly
4. **Scripts are NOT prefixed**: invoked by path from package.json/CLI
5. **Rust files are NOT prefixed**: snake_case per language convention, already namespaced in src-rs/

### Structure

```
src/
├── assets/         # Static assets (shaders, etc.)
├── components/     # cmpX.astro
├── layouts/        # layX.astro
├── lib/            # libX.ts / utlX.ts (domain logic + utilities)
│   └── libAliceNegative/  # libX.ts (sub-module)
├── pages/
│   ├── api/        # kebab-case.ts (API routes, NOT prefixed)
│   │   ├── observatory/
│   │   └── dev/
│   ├── app/        # kebab-case.astro (NOT prefixed)
│   ├── observatory/
│   └── papers/
├── scripts/        # kebab-case.ts (runnable tasks, NOT prefixed)
└── styles/         # styX.css

db/
└── sql/            # dbAlice_X.sql
    └── migrations/ # 001_description.sql

scripts/            # Top-level migration/backfill scripts
└── archive/        # Completed one-off scripts

src-rs/             # Rust native signal engine
└── src/            # snake_case.rs (NOT prefixed)
```

---

## Async & State Patterns

**All database calls are async. No exceptions.**

- Every function in `src/lib/libDb.ts` returns a `Promise`. Every call site must `await`.
- If you add a new db function, it must be `async`.
- API routes (`src/pages/api/*.ts`) are async handlers returning `Response` objects.
- Background jobs (embed, observe, generate, signal computation) fire-and-forget after the HTTP response. Errors go to `data/errors.log` via `src/lib/utlErrorLog.ts`.
- The signal pipeline runs Rust natively via napi-rs. Rust is the single source of truth for signal computation. If the native module fails to load, signal computation returns null and the pipeline skips that family for the session. The session still saves; derived signals are absent until `npm run build:rust` is run. The health endpoint exposes `hasNativeEngine` to surface this state.

---

## Rust Signal Engine (`src-rs/`)

The Rust crate is a measurement instrument, not a computation library. The distinction matters: every signal it produces is a quantitative claim about a person's cognitive state derived from keystroke dynamics. Measurement instruments have stricter requirements than application code.

**What this means in practice:**
- **Estimation quality over convenience.** The ex-Gaussian fit uses MLE via EM (Lacouture & Cousineau 2008), not method of moments, because tau is the signal and MoM is unreliable on small samples. If MLE fails to improve over MoM, it falls back honestly rather than returning bad estimates. Every signal function must make this kind of decision: produce a trustworthy number or produce nothing.
- **Multi-scale over single-point.** Permutation entropy is computed at orders 3-7 (pe_spectrum), not just order 3. A single PE value collapses temporal structure across scales. The spectrum separates local complexity from global structure, which is the difference between deliberation and volatility. When adding a new signal, ask whether a single number is actually sufficient or whether the measurement needs multiple scales.
- **The napi boundary is not an API.** It is a measurement interface. `Option::None` means "this session did not produce enough data for a reliable measurement," not "something went wrong." The `SignalError` enum (`InsufficientData`, `ZeroVariance`, `DegenerateValue`) preserves why a measurement could not be made. This information matters for downstream interpretation: a missing signal due to a 15-keystroke session means something different than a missing signal due to zero variance.
- **Numerical functions must be cited.** `erfc` uses Abramowitz & Stegun 7.1.26. KSG transfer entropy uses Kraskov et al. 2004. DFA uses Peng et al. 1994. If you add a statistical function, cite the source and approximation error bound. This is a measurement tool; provenance matters.

The Rust crate must be written to Rust's standards, not JavaScript's.

**Two kinds of signals.** `dynamical.rs` and `motor.rs` contain *estimators*: numerical computations of quantities defined in cited literature, with known approximation error bounds. `process.rs` contains *structural descriptions*: heuristic counters and pattern classifiers that describe the shape of a writing session without estimating any single quantity. The standards differ. Estimators require citation, error bounds, and typed error variants distinguishing failure modes. Structural descriptions require tested logic, documented heuristics, and honest naming (a count named `i_burst_count` must actually count I-bursts as defined, not a superset).

### Type Discipline

- **Newtypes for domain separation**: `IkiSeries` and `FlightTimes` are distinct types via newtype wrappers with `Deref<Target=[f64]>`. Never pass raw `&[f64]` where a typed series is expected. If you add a new series kind, wrap it. **Newtypes earn their keep by flowing**: a newtype is justified when it is constructed in one place, used in another, and the wrapper prevents a specific category of mistake at the use site. A newtype constructed and consumed in the same struct with no independent constructor is ceremony -- either give it a `from_*` constructor or inline the field.
- **Newtypes enforce invariants through private inner fields.** `IkiSeries` and `FlightTimes` wrap private `Vec<f64>` fields with controlled constructors (`from_stream`) that apply the relevant filtering. An unfiltered series cannot be constructed outside `types.rs` in non-test code. `HoldFlight` encapsulates its `holds` field the same way, accessed via `.holds() -> &[f64]`. When adding a new series type, follow this pattern -- a tuple struct with a `pub` inner field is a newtype in name only.
- **Internal items are `pub(crate)`, not `pub`.** The crate is a `cdylib` with no Rust consumers -- everything below the napi boundary is crate-internal by design. `pub(crate)` declares that intent. `pub` is reserved for items that cross the FFI boundary (the `#[napi]` entry functions and `#[napi(object)]` structs in `lib.rs`).
- **`SignalError` enum over `Option`**: Internal signal functions return `SignalResult<T>`. The error variants (`InsufficientData`, `ZeroVariance`, `DegenerateValue`, `ParseError`) preserve *why* a computation failed. `ParseError` is for JSON deserialization failures at module boundaries. Convert to `Option` with `.ok()` only at the napi boundary in `lib.rs`. Never silently default on bad input with `unwrap_or_default()` -- propagate the error.
- **`#[derive(Debug)]` on all `pub(crate)` types.** Every struct and enum in the crate should derive `Debug` so error messages (especially `assert!` failures in tests) produce useful output. This is standard practice for library types.
- **Structs get methods**: If a struct has a derived property (e.g. `HoldFlight::aligned_len()`), put it on the struct. Don't compute it inline at the call site.
- **`KeystrokeEvent` uses `#[serde(rename)]`**: Wire format is `{c, d, u}`. Rust-side fields are `character`, `key_down_ms`, `key_up_ms`. Always use the readable names in Rust code.

### UTF-8 Safety

- **JavaScript cursor positions are UTF-16 code units. Rust strings are UTF-8.** Any code that receives a cursor position or delete count from JS MUST convert through `types::utf16_to_byte_offset()` before indexing into a Rust string. Indexing raw bytes at a UTF-16 offset will panic on any non-ASCII character (curly quotes, accented letters, emoji).
- **Count comparisons are also unit-typed.** When comparing a Rust-side character or byte count against a JS-sourced count (like `deletedCount`), convert both sides to the same unit -- typically UTF-16 code units via `.chars().map(|c| c.len_utf16()).sum::<usize>()`. Byte length (`.len()`) and character count (`.chars().count()`) are both wrong when the other side of the comparison is UTF-16.
- **Never use `text.as_bytes()[pos]` with JS-sourced positions.** Use `text[..byte_offset].chars().next_back()` for character inspection.

### Deterministic Iteration

- **Never iterate a `HashMap` on a path that feeds into sampling or output.** `HashMap` iteration order is nondeterministic across runs in Rust (randomized hash seeds). If a seeded PRNG samples from a `HashMap`-ordered distribution, the same seed produces different results across runs. This is a correctness bug for any reproducibility claim.
- **The pattern: build with `HashMap`, freeze into sorted `Vec`.** Use `HashMap` as a mutable builder during construction, then `.into_iter().collect()` into a `Vec<(K, V)>` and `.sort_by()` on the key. All subsequent reads go through the sorted vec. See `MarkovChain` and `PpmTrie` in `avatar.rs` for the canonical implementation.
- **Use `sorted_vec_get()` for O(log n) lookup** into frozen sorted vecs. Binary search on the key, returns `Option<&V>`.
- **When to use `BTreeMap` instead**: if the data structure needs insertion after construction (e.g. online learning without a rebuild step), `BTreeMap` provides deterministic iteration without a freeze step. For build-once-sample-many workloads, sorted vecs are preferred for cache locality.
- **Determinism tests**: any module that generates output from a seeded PRNG must have a test that calls the function twice with the same seed and asserts identical output. See `avatar::tests::determinism_*` for examples.

### napi Boundary (`lib.rs`)

- `lib.rs` is a thin mapping layer. It deserializes JSON, calls module `compute()` functions, and maps internal result types to flat `#[napi(object)]` structs. No signal logic belongs here.
- napi entry points take `String` by value (required by FFI). Suppress `clippy::needless_pass_by_value` with `#[allow]`.
- `usize` counts convert to `i32` via `i32::try_from(x).unwrap_or(i32::MAX)`. Never use `as i32`.
- `Option::None` from Rust becomes `undefined` in JS. The TS integration layer (`libSignalsNative.ts`) coerces these to `null` for postgres.js compatibility.

### Clippy & Linting

- The crate uses `#![allow(clippy::cast_precision_loss)]` at the crate level because all values are bounded by keystroke count (realistically < 50K).
- `#[allow]` on individual items requires a comment justifying why the lint is a false positive.
- `clippy::suspicious_operation_groupings` must be suppressed on OLS formulas (`n*Sxx - Sx^2`) with a comment citing the formula.
- Use `mul_add` where clippy suggests `suboptimal_flops`. It is both faster and more numerically stable.
- Run `cargo clippy -- -W clippy::all` before committing Rust changes. Zero warnings on standard lints.

### Testing

- Every module has a `#[cfg(test)]` section. If you add a signal computation, add tests.
- **Golden value tests**: known inputs with pre-computed expected outputs (e.g. PE of sorted sequence = 0).
- **Invariant tests**: properties that must hold (e.g. entropy >= 0, recurrence_rate in [0,1]).
- **Error variant tests**: `assert!(matches!(result, Err(SignalError::InsufficientData { .. })))`.
- **UTF-8 safety tests**: any text reconstruction code must have a test with emoji and multibyte characters that proves it doesn't panic.
- Run `cargo test` before committing.

### Module Structure

```
src-rs/src/
├── lib.rs          # napi boundary: structs + entry points (no logic)
├── types.rs        # SignalError, KeystrokeEvent, newtypes, utf16 conversion
├── stats.rs        # mean, std_dev, erfc, digamma, extract_iki, linreg_slope (#[inline])
├── dynamical.rs    # PE (single + multi-scale spectrum), DFA, RQA, KSG transfer entropy
├── motor.rs        # sample entropy, autocorrelation, ex-Gaussian (MLE/EM), compression
├── process.rs      # text reconstruction, pause/burst analysis
└── avatar.rs       # ghost engine: Markov/PPM text generation, timing synthesis, adversary variants
```

Each compute module defines its own result struct (e.g. `DynamicalResult`, `MotorResult`). `lib.rs` maps these to the flat napi output structs.

### Avatar Engine (`avatar.rs`)

The avatar (ghost) is a reconstruction adversary: it generates synthetic keystroke streams from a person's statistical profile. Five adversary variants isolate which dimension of behavior carries the most signal by adding one modeling improvement at a time (text prediction via Markov/PPM, IKI correlation via AR(1), hold/flight coupling via Gaussian copula). Comparing reconstruction residuals across variants reveals what a profile can reproduce vs. what requires the actual person.

**Key patterns:**
- **Sampler factories over boolean flags.** Timing synthesis takes `IkiSampler` and `HoldSampler` closures constructed per-variant, rather than boolean flags controlling behavior inside the function. This keeps the generation skeleton free of variant-specific logic.
- **Build-once-sample-many.** `MarkovChain` and `PpmTrie` are built from `HashMap`s then frozen into sorted vecs. See **Deterministic Iteration** above.
- **String cloning is intentional.** The corpus vocabulary is ~2-5K words. Interning or arena allocation would add complexity for zero measurable benefit at this scale. This is documented on the `MarkovChain` struct.
- **`compute_seeded()` for testability.** The public `compute()` uses a time-based seed. Tests call `compute_seeded()` with a fixed seed to verify determinism.

### Single Source of Truth

Rust is the only implementation of signal computation. There is no TypeScript fallback. A measurement instrument cannot have two implementations, because two implementations can disagree, and disagreement between sources of truth is indistinguishable from a bug. If the instrument is unavailable (native module not built), the measurement doesn't happen. The session saves; derived signals are absent until `npm run build:rust` restores the engine. The health endpoint exposes `rustEngine: true/false` so this state is visible.

---

## Known Gotchas
- **VoyageAI types in `libEmbeddings.ts`**: The `voyageai` package is imported via `createRequire` (CJS shim in ESM). TypeScript can't resolve types cleanly through this path. If type errors resurface on `VoyageAIClient` or `result` being `unknown`, the fix is: extract the module ref separately, use `InstanceType<typeof VoyageAIClient>` for the type alias, and cast embed responses to `{ data?: Array<{ embedding?: number[] }> }`.
- **PostgreSQL camelCase aliases**: PG lowercases unquoted identifiers. Use double quotes for camelCase aliases in SQL: `SELECT col AS "camelCase"`.
- **JSONB auto-parsing**: The postgres driver auto-parses JSONB columns into JS objects. Functions returning JSONB fields that callers expect as strings must re-stringify them.
- **Rust native module**: Loaded via `createRequire` in `libSignalsNative.ts`. The `.node` file is platform-specific (`alice-signals.darwin-arm64.node`). If it fails to load, signal computation returns null and the pipeline skips the affected families. The health endpoint's `rustEngine: false` surfaces this state. Rebuild with `npm run build:rust` after changing `src-rs/` code. See **Rust Signal Engine** section above for coding standards.

---

## Archival

**Archival means removal, not stubbing.** When a feature is archived, its database tables, API handlers, lib functions, and any downstream integration points (health check fields, signal registries) must be deleted in the same commit. Stub functions that preserve imports during a transition must be deleted by the time the archival commit lands. Hardcoded `true`/`false` return values in place of computed coverage are never acceptable; remove the coverage field entirely instead. Data is preserved under `zz_archive_*` tables in the database, not in application code.

---

## Philosophy
Every technical decision should serve depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.

**Single source of truth for measurements.** Every signal is computed by exactly one implementation (the Rust engine). A measurement instrument cannot have two implementations. If the instrument is unavailable, the measurement doesn't happen. A silent wrong answer is worse than no answer.
