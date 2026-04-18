# Handoff: Phase 2 Signal Expansion + Infrastructure Upgrade (2026-04-18)

## What happened this session

Two major efforts in one day.

**Morning:** Deep research across intelligence programs (DARPA, IARPA SCITE, BioCatch/Unit 8200), academic labs (Antwerp/Inputlog, BiAffect, neuroQWERTY, ScriptLog), startups (TypingDNA, nQ Medical, NeuraMetrix), and novel analytical techniques. Scored, ranked, and implemented the highest-priority signals. Signal count went from ~147 to ~163 captured.

**Afternoon:** Full infrastructure upgrade. SQLite to PostgreSQL 17 + pgvector. Pure TypeScript signal math to Rust native engine via napi-rs. Integer millisecond capture to microsecond-precision floats. Schema audit and type tightening across all 30+ tables.

## Infrastructure upgrade

### PostgreSQL 17 + pgvector (replaces SQLite + sqlite-vec)

**Why:** SQLite locks the entire database file on any write. After session submission, 5 independent signal families, burst sequences, session metadata, deletion events, embeddings, and entry states all need to write. Under SQLite, every write queues behind every other one. PostgreSQL handles concurrent writes natively.

**What changed:**
- Connection pool in `src/lib/db-pool.ts` (porsager/postgres.js)
- All db functions in `src/lib/db.ts` are now async (return Promise)
- Schema managed by `scripts/create-postgres-schema.sql`
- pgvector HNSW-indexed embeddings replace sqlite-vec brute-force scans
- SQLite backup preserved at `src/lib/db-sqlite.ts` and `data/alice.db`
- Migration script at `scripts/migrate-sqlite-to-postgres.ts`

### Rust signal engine via napi-rs (replaces TypeScript signal math)

**Why:** RQA builds an n-by-n distance matrix (O(n^2)). Sample entropy is O(n^2 * m). Both were capped at 500 keystrokes in TypeScript. Rust runs the same algorithms ~200x faster: 1.6ms total for dynamical + motor signals on a 500-keystroke stream.

**What was ported:**
- `src-rs/src/dynamical.rs` -- permutation entropy, DFA, RQA (determinism, laminarity, trapping time, recurrence rate), transfer entropy (both directions + dominance)
- `src-rs/src/motor.rs` -- sample entropy, IKI autocorrelation, motor jerk, lapse rate, tempo drift, IKI compression ratio, digraph latency profile, ex-Gaussian fit (tau/mu/sigma), adjacent hold-time covariance
- `src-rs/src/process.rs` -- text reconstruction, pause location profile, abandoned thought detection, R/I-burst classification, vocab expansion rate, phase transition point, strategy shift detection

**What stayed in TypeScript (I/O-bound, not compute-bound):**
- Semantic signals (word list lookups, NRC categories, gzip compression)
- Cross-session signals (database queries for historical data)

**Integration:**
- `src/lib/signals-native.ts` loads the native module via `createRequire` with automatic TypeScript fallback if Rust unavailable
- `signal-pipeline.ts` imports from `signals-native.ts` instead of individual TS files
- napi-rs `Option::None` fields become JS `undefined`; wrapper coerces all fields to `null` via `v ?? null` (postgres.js rejects `undefined`)
- Timing logs on each Rust call: `[signals] rust dynamical: 0.6ms (342 keystrokes)`

**Build automation:**
- `src-rs/build.sh` handles everything: installs Rust toolchain if missing, hashes source files, skips rebuild if unchanged
- `npm run dev` calls `build.sh` before `astro dev`
- `npm run build` calls `build.sh` before `astro build`
- No manual cargo/rustup commands needed

### Microsecond-precision keystroke capture

**Why:** `Date.now()` gives integer milliseconds. `performance.now()` gives fractional milliseconds with ~5 microsecond resolution. The three motor biometric signals that matter most for longitudinal cognitive tracking (digraph latency profiles, adjacent hold-time covariance, ex-Gaussian tau) operate at sub-millisecond resolution.

**What changed:**
- All `Date.now()` calls in `src/pages/index.astro` replaced with `performance.now()` (both journal and calibration paths)
- `pageOpenTime`, all keystroke timestamps, all pause/tab-away durations now fractional milliseconds
- Keystroke stream `d` and `u` fields store values like `1523.456` instead of `1523`

### Schema type tightening

Every column audited and assigned the correct PostgreSQL type:

| Change | Before | After | Why |
|--------|--------|-------|-----|
| Timing columns (9 total) | `INT` | `DOUBLE PRECISION` | microsecond precision from `performance.now()` |
| `paste_contaminated` | `INT DEFAULT 0` | `BOOLEAN DEFAULT FALSE` | binary flag |
| `landed` | `INT` | `BOOLEAN` | binary flag |
| `scheduled_for` | `TEXT` | `DATE` | validates dates, enables date arithmetic |
| `session_date` | `TEXT` | `DATE` | same |
| `source_date` | `TEXT` | `DATE` | same |
| `metadata` (interaction_events) | `TEXT` | `JSONB` | stores JSON, should be queryable |
| Enum table PKs | `INT` | `SMALLINT` | 2 bytes, documents valid range |
| Enum FK references | `INT` | `SMALLINT` | matches PK type |
| `hour_of_day` | `INT` | `SMALLINT CHECK (0-23)` | bounded range with constraint |
| `day_of_week` | `INT` | `SMALLINT CHECK (0-6)` | bounded range with constraint |
| `burst_index`, `window_size`, `lag_sessions`, `lexicon_version` | `INT` | `SMALLINT` | small bounded values |
| Footer `NOT NULL` | inconsistent | all `NOT NULL` | consistent enforcement |
| Missing `UNIQUE` | absent | added on `tb_responses.question_id`, `tb_entry_states.response_id`, `tb_semantic_states.response_id`, `tb_session_events.question_id`, `tb_session_metadata.question_id` | one-to-one relationships |

All changes applied to both `scripts/create-postgres-schema.sql` and the live database.

## Phase 2 signal expansion (same day, earlier session)

### Phase 2 Client-Side Capture (11 new columns on tb_session_summaries)

Both journal AND calibration paths capture identically. New signals:

**Mouse/cursor trajectory (BioCatch cognitive biometrics):**
- `cursor_distance_during_pauses` -- total mouse px during >2s pauses
- `cursor_fidget_ratio` -- cursorDistance / activeTypingMs
- `cursor_stillness_during_pauses` -- proportion of samples <5px movement
- `drift_to_submit_count` -- cursor entered submit button during pause then left
- `cursor_pause_sample_count` -- 200ms samples taken during pauses

**Precorrection/postcorrection latency (Springer 2021):**
- `deletion_execution_speed_mean` -- mean IKI within deletion chains
- `postcorrection_latency_mean` -- mean ms from last delete to next insert

**Revision distance (ScriptLog, Lindgren & Sullivan 2006):**
- `mean_revision_distance` -- mean chars from leading edge per contextual revision
- `max_revision_distance` -- deepest revision in session

**Punctuation key latency (Plank 2016 COLING):**
- `punctuation_flight_mean` -- mean flight time before punctuation keys
- `punctuation_letter_ratio` -- punctuation flight / letter flight

### Phase 2 Motor Signals (5 new columns on tb_motor_signals)

**Ex-Gaussian tau (BiAffect / Zulueta 2018):**
- `ex_gaussian_tau` -- exponential tail (cognitive slowing)
- `ex_gaussian_mu` -- Gaussian mean (motor baseline speed)
- `ex_gaussian_sigma` -- Gaussian std (motor noise)
- `tau_proportion` -- tau / mean flight time

**Adjacent hold-time covariance (neuroQWERTY, Giancardo 2016):**
- `adjacent_hold_time_cov` -- Pearson corr of consecutive hold times

## Bugs fixed

- **Placeholder count mismatch:** saveSessionSummary had 81 placeholders for 80 columns
- **Ex-Gaussian blowup:** Method-of-moments fails when skewness > ~3. Fixed with Q3+3*IQR outlier removal
- **napi-rs undefined values:** Rust `Option::None` becomes JS `undefined`, not `null`. postgres.js rejects `undefined`. Fixed with `v ?? null` coercion on all native module return fields
- **JSONB auto-parsing in signal pipeline:** `getEventLogJson` and `getKeystrokeStream` in `signal-pipeline.ts` read JSONB columns that postgres.js auto-parses into JS objects. Functions expected strings. Fixed with type detection and re-stringification where needed
- **Calibration missing Phase 2:** Calibration surface had its own separate signal capture block that wasn't updated

## Architecture after this session

```
index.astro (client capture via performance.now(), microsecond precision)
    |
    |  ~80 fields captured client-side including Phase 2
    |
    v
POST /api/respond  OR  POST /api/calibrate
    |
    |-- Transaction: save response, burst sequence, session events,
    |   session summary, deletion events, session metadata
    |
    |-- Fire-and-forget (all 5 families independent, parallel writes):
    |   |-- embedResponse() -> pgvector HNSW index
    |   |-- runGeneration()
    |   |-- renderWitnessState()
    |   |-- computeAndPersistDerivedSignals()
    |       |-- dynamical signals  [RUST] -> tb_dynamical_signals (13 cols)
    |       |-- motor signals      [RUST] -> tb_motor_signals (12 cols)
    |       |-- semantic signals   [TS]   -> tb_semantic_signals (10 cols)
    |       |-- process signals    [RUST] -> tb_process_signals (9 cols)
    |       |-- cross-session      [TS]   -> tb_cross_session_signals (10 cols)
    |
    v
Observatory reads pre-computed values from PostgreSQL
```

## Type alignment across boundaries

```
Browser: performance.now() -> f64 (IEEE 754 double)
    |
JSON transport: number -> f64
    |
Rust engine: f64 computation (dynamical, motor, process)
    |
TypeScript: number (IEEE 754 double)
    |
PostgreSQL: DOUBLE PRECISION (IEEE 754 float8)
```

No conversion loss at any boundary. Same 64 bits from capture to storage.

## What's NOT done (deferred by design)

### Backfill analysis pass (can be done anytime, raw data stored)
MF-DFA, multiscale entropy, cross-recurrence (CRQA), Markov transition entropy rate, visibility graph, symbolic dynamics, wavelet energy ratio. All computed from stored keystroke streams. Build one Rust function, run once, backfill all sessions.

### Lift the 500-keystroke RQA cap
Rust makes this feasible. A 2000-keystroke entry would take ~25ms. Not urgent since current entries are under 500 keystrokes.

### Circadian-adjusted baselines
Store both global z-scores AND circadian z-scores in parallel. Must decide before day 30.

### Joint behavioral-semantic embedding (Phase 6)
Concatenate state vectors with text embeddings for cognitive-mode-aware RAG.

## Key files changed

| File | What changed |
|------|-------------|
| `src-rs/` (new) | Rust signal engine: Cargo.toml, lib.rs, dynamical.rs, motor.rs, process.rs, stats.rs, build.sh |
| `src/lib/signals-native.ts` (new) | Native module loader with TS fallback and null coercion |
| `src/lib/db-pool.ts` (new) | PostgreSQL connection pool |
| `src/lib/db.ts` | Async, PostgreSQL, new columns, proper types |
| `src/lib/signal-pipeline.ts` | Imports from signals-native.ts, JSONB handling fixes |
| `src/pages/index.astro` | Phase 2 capture + `performance.now()` upgrade |
| `scripts/create-postgres-schema.sql` | Full type audit: DOUBLE PRECISION, BOOLEAN, DATE, SMALLINT, CHECK, UNIQUE |
| `package.json` | `build:rust` script, `dev` runs Rust build first, `@napi-rs/cli` dev dep |
| `.gitignore` | `src-rs/target/`, `src-rs/*.node` |
| `CLAUDE.md` | Stack updated, Rust engine documented |
| `signals.md` | Infrastructure section, microsecond precision, Rust engine notes |
| `README.md` | Stack, architecture, commands updated for PG + Rust |
