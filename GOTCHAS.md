# Gotchas

Things that look wrong but aren't, things that will bite you, things that are non-obvious from reading the code.

## Database

- **JSONB auto-parse trap.** postgres.js auto-parses JSONB columns into JS objects on read. But signal functions and callers expect JSON *strings*. Four functions in `libDb.ts` have manual re-stringify logic: `getSessionEvents`, `getLatestWitnessState`, `getDynamicalSignals`, `getMotorSignals`. If you add a new function that reads a JSONB column and the caller passes it to `JSON.parse()` or to a Rust function expecting a string, you will get `[object Object]` or a silent double-parse. Always check whether the caller expects a string or an object.

- **Calibration questions have `scheduled_for = NULL`.** Daily journal questions have a `scheduled_for` date. Calibration questions (source_id = 3) do not -- they're created on-demand without a scheduled date. If you JOIN calibration sessions on `scheduled_for`, you get zero rows. Match by `dttm_created_utc::date` instead. See `getSameDayCalibrationSummary()` for the pattern.

- **Question IDs 42, 63, 64 are intentional orphans.** These are early calibration sessions (2026-04-14, 2026-04-17) that have responses but no session summaries or session events. They predate the calibration event-logging pipeline. They are NOT bugs or transaction failures. The response text is real. The health endpoint explicitly excludes them from the "sessions missing summary" anomaly count.

- **No physical foreign keys.** The entire schema uses logical FKs only. JOINs work, but there are no cascade deletes and no referential integrity checks. Deleting a parent row silently orphans children. See CLAUDE.md for the cascade dependency map. When in doubt, don't delete.

- **Unquoted camelCase aliases get lowercased.** PostgreSQL lowercases unquoted identifiers. `SELECT col AS totalDurationMs` becomes `totaldurationms`. Always double-quote: `SELECT col AS "totalDurationMs"`. Every query in libDb.ts does this correctly; don't break the pattern.

- **`getSessionSummary` uses `sql.unsafe()`.** It's the only query that does this, because it interpolates the giant `SESSION_SUMMARY_COLS` constant string into the query. Every other function uses tagged templates. Don't copy this pattern for new queries without reason.

- **`COUNT(*)` returns bigint.** postgres.js returns `COUNT(*)` as a string (PG bigint). Every count query in libDb.ts casts with `COUNT(*)::int` to get a JS number. Forget the cast and you get string comparisons.

## Rust / Avatar Engine

- **HashMap iteration is nondeterministic in Rust.** Rust's `HashMap` uses randomized hash seeds, so iteration order changes between runs. If you iterate a `HashMap` to build a probability distribution and then sample from it with a seeded PRNG, the same seed produces different output across runs. This was a real bug in `avatar.rs` that broke reproducibility. The fix: build with `HashMap`, freeze into a sorted `Vec<(K, V)>`, sample from the sorted vec. See `MarkovChain` and `PpmTrie` for the pattern. If you add a new data structure that feeds into sampling, never iterate a `HashMap` on the sampling path.

- **`serde_json::from_str().unwrap_or_default()` silently eats parse errors.** If corpus or profile JSON is malformed, `unwrap_or_default()` returns an empty vec or default struct, and the function proceeds with garbage state. Avatar functions now use `SignalError::ParseError` to propagate parse failures. If you add a new function that deserializes JSON, use `.map_err(|e| SignalError::ParseError(...))` and `?`, never `unwrap_or_default()`.

- **Avatar `compute()` uses a time-based seed. Tests use `compute_seeded()`.** The public `compute()` generates variety by seeding from `SystemTime`. Tests must call `compute_seeded()` with a fixed seed to verify determinism. If you add a new generation function with randomness, provide a seeded variant for testing.

- **`default_profile()` is `#[cfg(test)]` only.** It was removed from production code when `unwrap_or_else(|_| default_profile())` was replaced with error propagation. Tests still use it. If you need a default profile in production, the caller should construct one explicitly.

- **`HoldFlight::from_stream` was misaligned prior to 2026-04-21.** Holds and flights were filtered independently, so rollover typing (next key pressed before previous released, producing negative flight times) caused `holds[k]` and `flights[k]` to refer to different keystroke events. This affected 100% of sessions and contaminated all stored transfer entropy values (130%+ average shift, 5 sign flips across 26 sessions). RQA was not affected (computed on IKI series, not hold-flight pairs). Fixed by filtering both together: only push when hold AND flight are valid for the same event. Snapshot preserved as `tb_dynamical_signals_pre_alignment_fix_20260421`.

- **Flight time upper bound `ft < 5000.0` conflates two session types with different pause regimes.** Q7 had a 5093ms flight flagged as invalid. In a daily journal session, this is almost certainly a legitimate cognitive pause (re-reading, deliberating before the next word). In a calibration session (timed typing task), the same gap might be distraction or disengagement. The 5000ms threshold was inherited from IKI filtering where it makes sense (IKI > 5s is usually a tab-away or session boundary), but flight times between keystrokes are structurally different: they include evaluation pauses, read-back pauses, and reformulation pauses that are core to the writing process, not noise. **Follow-up needed**: (1) analyze the distribution of flight times above 5000ms separately for journal vs calibration sessions, (2) determine whether the threshold should be session-type-dependent (e.g., 10-15s for journal, 5s for calibration) or uniformly raised, (3) check how many hold-flight pairs are currently being dropped across all sessions by the 5000ms flight cap. Do not bundle this change with the alignment fix.

## Signal Pipeline

- **`return` in signal family blocks exits the entire pipeline function.** In `libSignalPipeline.ts`, the dynamical, motor, and process signal blocks each have `if (!ds) return;` / `if (!ms) return;` / `if (!ps) return;` when the Rust engine is unavailable. These `return` statements exit `computeAndPersistDerivedSignals` entirely, skipping all subsequent families. This means if dynamical signals fail, motor/semantic/process/cross-session/integrity/profile/reconstruction all get skipped. This is semi-intentional (if Rust is down, most families can't compute) but surprising if you add a new family that doesn't depend on Rust.

- **Signal pipeline ordering matters.** Integrity must run BEFORE profile update (it compares against prior profile). Reconstruction must run AFTER profile update (it uses the current profile). Cross-session signals depend on motor signals being persisted first. Don't reorder blocks without understanding the dependency chain.

- **Rust engine failure is silent, not fatal.** If the `.node` native module isn't built, `hasNativeEngine` is false, all compute functions return null, and signal tables stay empty for that session. The session still saves. The health endpoint exposes `rustEngine: false`. Run `npm run build:rust` to fix. This is by design -- a missing measurement is better than a blocked session.

- **The `.node` file is platform-specific.** `alice-signals.darwin-arm64.node` only works on Apple Silicon macOS. It won't exist after a fresh clone on a different platform. The `createRequire` import in `libSignalsNative.ts` catches the load failure gracefully.

## Submission Flow

- **Response submission is a single transaction, background work is fire-and-forget.** The POST to `/api/respond` saves the response, session summary, burst sequences, events, and metadata in one `sql.begin` transaction. Then it kicks off generation, witness rendering, and the signal pipeline as a detached async IIFE. If the background work fails, it logs to `data/errors.log` but the response is already saved. The HTTP response returns before background work starts.

- **Calibration submit does NOT use a transaction for event storage.** `saveSessionEvents` in `/api/calibrate` runs outside the `saveCalibrationSession` transaction. If the event save fails, the calibration session exists without its event log. This matches the pattern of "session data is sacred, derived data is best-effort."

- **`updateDeletionEvents` is an UPDATE, not an INSERT.** It modifies the session summary row that `saveSessionSummary` just created. Must run AFTER saveSessionSummary within the same transaction. If you reorder the transaction block, this silently updates zero rows.

- **Linguistic densities and MATTR are computed server-side, not from the client summary.** The `respond` and `calibrate` endpoints compute NRC densities, cognitive/hedging/first-person densities, MATTR, and sentence metrics from the response text on the server. The client sends raw `sessionSummary` fields for keystroke/timing data only. Don't look for these in the client payload.

## Embeddings

- **VoyageAI is loaded via `createRequire` (CJS shim).** The `voyageai` package is CommonJS. Alice is ESM (`"type": "module"`). The import uses `createRequire(import.meta.url)` to bridge this. TypeScript can't resolve types through this path, so `VoyageClient` is typed as `InstanceType<typeof VoyageAIClient>` and embed results are cast to `{ data?: Array<{ embedding?: number[] }> }`. This looks wrong but is the correct workaround.

- **Embedding failures are never fatal.** `embedResponse` runs fire-and-forget after submission. If Voyage API is down or the key is missing, it logs a warning and the response saves without an embedding. Backfill later with `npm run backfill`.

## Question Generation

- **Seed phase: first 30 days, generation is a no-op.** `runGeneration` checks `responseCount < SEED_DAYS` and returns early. During this phase, questions come from `libSeeds.ts` scheduled by the seed script. If you're testing generation and nothing happens, check response count.

- **`scheduleQuestion` uses `ON CONFLICT (scheduled_for) DO NOTHING`.** If a question already exists for tomorrow, generation silently does nothing. This prevents duplicates but also means re-running generation for the same day has no effect.

## General

- **`localDateStr()` is timezone-sensitive.** It uses the server's local timezone, NOT UTC. This is intentional (the journal is for one person in one timezone) but means `localDateStr()` and `new Date().toISOString().slice(0,10)` return different dates near midnight UTC. All date comparisons in the app use `localDateStr()`.

- **`nowStr()` has a date override for simulation.** `libDb.ts` has a module-level `_dateOverride` that, when set, replaces `CURRENT_TIMESTAMP` in all save functions. Production never calls `setDateOverride`. But if you're debugging and see timestamps stuck at noon, this is why.

- **Error log is a flat file, not a database table.** `data/errors.log` is appended by `utlErrorLog.ts` via `fs.appendFileSync`. It's the only way to see what failed in fire-and-forget background jobs. If this file doesn't exist, errors are console-only and vanish on restart.

- **`npm run dev` builds Rust first.** The dev script runs `./src-rs/build.sh && astro dev`. If the Rust build fails (missing toolchain, compile error), the dev server doesn't start. If you're only working on frontend/API code and don't need signals, you can run `astro dev` directly, but signal computation will be disabled.

- **Archival means deletion, not stubbing.** When features are archived, their tables, API handlers, lib functions, and downstream integration points are all deleted in the same commit. Data goes to `zz_archive_*` tables in the database. Don't leave stub functions that return hardcoded values.
