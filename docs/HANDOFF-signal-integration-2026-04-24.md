# Signal Integration Handoff — 2026-04-24

## What was accomplished

Phase 0-5 of the signal integration plan (docs/designs/signal-integration-plan.md) were implemented. 38 new signal columns across 4 tables, 5 schema migrations (017-021), ~800 lines of Rust, ~200 lines of TypeScript.

### Completed

- **Phase 0**: Ergodicity weighting applied to `libDailyDelta.ts` and `libCalibrationDrift.ts`. IKI-derived means weighted at 0.5 in RMS magnitude computations. Trend reporting restricted to ergodicity-safe dimensions.
- **Phase 1**: MF-DFA (3 signals), IKI PSD via Lomb-Scargle (5 signals), temporal irreversibility (1 signal) in `dynamical.rs`
- **Phase 2**: Symbolic dynamics CECP/forbidden/weighted PE/LZC (4), OPTN (2), recurrence networks (4), recurrence time entropy (2) in `dynamical.rs`
- **Phase 3**: MSE + complexity index + Fisher trace (3) in `motor.rs`. Causal emergence (3), PID (2), branching ratio (2), DMD (4), pause mixture (3) in `dynamical.rs`
- **Phase 4**: Motor self-perplexity in `libCrossSessionSignals.ts`. Discourse global coherence in `libSemanticSignals.ts`
- **Phase 5**: Pause mixture decomposition in `dynamical.rs`
- All Rust tests pass (172), clippy zero warnings
- Schema migrations 017-021 applied to live database
- Backfill completed for dynamical (31 rows), motor (31 rows), semantic discourse coherence (17/33), motor self-perplexity (1/8 — early sessions lack 5+ prior keystroke sessions)

## The blocking issue

**The live tsx/Astro pipeline does NOT populate the new signal columns.** All new columns are NULL when computed through the tsx runtime, even though the Rust unit tests pass and direct `node` calls to the `.node` binary work.

### Root cause identified (partially fixed)

Two problems were found:

1. **Missing `build.rs`** — The file `src-rs/build.rs` was missing. Without it, `napi-build` doesn't generate JS bindings for the `#[napi(object)]` structs. File was recreated:
   ```rust
   extern crate napi_build;
   fn main() { napi_build::setup(); }
   ```
   After recreation and `cargo clean && cargo build --release && npx napi build --release --platform`, the resulting `.node` file is 934192 bytes but still only exports 2 keys (ikiCount, holdFlightCount) instead of the expected 46.

2. **Missing `NativeModule` interface fields** — `src/lib/libSignalsNative.ts` lines 107-139 define a TypeScript `NativeModule` interface that must list every field the napi module returns. This was updated to include all 46 dynamical fields and all 16 motor fields. But this is moot until the `.node` binary actually exports the fields.

### What was NOT the problem

- The Rust code is correct. `cargo test --lib` passes 172 tests.
- The `DynamicalSignals` and `MotorSignals` napi structs in `lib.rs` are correctly annotated with `#[napi(object)]`.
- The `?? null` coercion is on every field in `libSignalPipeline.ts` (fixes the postgres.js UNDEFINED_VALUE error).
- The schema columns exist and accept values (verified via direct INSERT).

### What needs to happen next

The `.node` binary needs to correctly export all 46 dynamical signal fields and 16 motor signal fields. The current binary only exports 2 fields despite having the correct Rust source.

**Diagnosis steps:**

1. Check if `napi build` is actually invoking `build.rs`. Run: `cd src-rs && cargo clean && CARGO_LOG=cargo::core::compiler::fingerprint=info cargo build --release 2>&1 | grep build_script`
2. Check if the napi proc macro is generating the registration code. Look at `target/release/build/alice-signals-*/out/` for generated binding files.
3. Try `npx napi build --release --platform --js false` to see if napi CLI is generating a JS wrapper that overrides the native exports.
4. Check if there's a `index.js` or `index.node` file that napi generates as a wrapper. The `index.d.ts` file was found empty.
5. As a nuclear option: compare the working `.node` binary from before the session (the one that exports the original 14 dynamical fields) against the current one. The pre-session binary was backed up at `tb_dynamical_signals_pre_phase1_backfill` (data only, not the binary). Check git for the last known-good `.node` file.

**Once the `.node` binary correctly exports all fields:**

1. Run `npx tsx -e "import { computeAndPersistDerivedSignals } from './src/lib/libSignalPipeline.ts'; ..."` to verify the tsx pipeline populates new columns
2. Delete all signal rows and rerun the backfill: `npx tsx src/scripts/backfill-signals.ts`
3. Verify coverage matches expectations (see coverage table below)

## Files modified

### Rust
- `src-rs/src/dynamical.rs` — MF-DFA, temporal irreversibility, Lomb-Scargle PSD, ordinal analysis (CECP, forbidden, weighted PE, LZC, OPTN), recurrence networks, recurrence time entropy, causal emergence, PID, branching ratio, DMD, pause mixture
- `src-rs/src/motor.rs` — MSE (multiscale entropy), Fisher information of ex-Gaussian
- `src-rs/src/lib.rs` — `DynamicalSignals` and `MotorSignals` napi structs updated with all new fields, mapping in `compute_dynamical_signals` and `compute_motor_signals`
- `src-rs/build.rs` — RECREATED (was missing)

### TypeScript
- `src/lib/libSignalsNative.ts` — `NativeModule` interface updated with all new fields
- `src/lib/libSignalPipeline.ts` — All field mappings for dynamical, motor, cross-session saves. Every field has `?? null` coercion.
- `src/lib/libDb.ts` — `DynamicalSignalRow`, `MotorSignalRow`, `CrossSessionSignalRow`, `SemanticSignalRow` interfaces. `saveDynamicalSignals`, `saveMotorSignals`, `saveCrossSessionSignals`, `saveSemanticSignals` INSERT statements.
- `src/lib/libCrossSessionSignals.ts` — `motorSelfPerplexity` function and `CrossSessionSignals` interface
- `src/lib/libSemanticSignals.ts` — `computeDiscourseCoherence` function and `DiscourseCoherence` interface
- `src/lib/libDailyDelta.ts` — `ERGODICITY_WEIGHT` constant, weighted RMS, filtered trends
- `src/lib/libCalibrationDrift.ts` — `DRIFT_ERGODICITY_WEIGHT` constant, weighted drift

### Schema
- `db/sql/migrations/017_phase1_dynamical_extensions.sql` — 9 columns on tb_dynamical_signals
- `db/sql/migrations/018_phase2_ordinal_recurrence.sql` — 12 columns on tb_dynamical_signals
- `db/sql/migrations/019_phase3_motor_dynamical_extensions.sql` — 3 on tb_motor_signals, 11 on tb_dynamical_signals
- `db/sql/migrations/020_phase4_cross_session_semantic.sql` — 1 on tb_cross_session_signals, 4 on tb_semantic_signals
- `db/sql/migrations/021_phase5_pause_mixture.sql` — 3 on tb_dynamical_signals
- `db/sql/dbAlice_Tables.sql` — All columns added to CREATE TABLE definitions

### Documentation
- `signals.md` — All new signals documented with full Source/Computation/Unit/Why/Literature entries. Ergodicity framework section added at top.
- `systemDesign/METHODS_PROVENANCE.md` — INC-012 entry documenting the paradigm gap
- `docs/designs/signal-integration-plan.md` — Full execution plan with ranking, phases, approval gates

### Safety snapshots in database
- `tb_dynamical_signals_pre_phase1_backfill` — 31 rows, pre-backfill dynamical signals
- `tb_motor_signals_pre_phase1_backfill` — 31 rows, pre-backfill motor signals

## Expected coverage after successful backfill

| Signal | Expected coverage | Gate |
|---|---|---|
| MF-DFA | ~16/31 | 256+ IKIs |
| PSD spectral slope | ~18/31 | 200+ IKIs |
| Temporal irreversibility | ~25/31 | 100+ IKIs |
| CECP, LZC, OPTN, recurrence nets, RTE | ~27/31 | 50-100+ IKIs |
| Causal emergence, DMD, pause mixture | ~25/31 | 100+ IKIs |
| PID, branching ratio | ~24-27/31 | 30-100+ IKIs |
| MSE + CI | ~22/31 | 150+ IKIs at scale 5 |
| Fisher trace | ~16/31 | Requires ex-Gaussian fit |
| Discourse coherence | ~17/33 | 5+ sentences |
| Motor self-perplexity | ~1/8 growing | 5+ prior keystroke sessions |

## What is NOT in scope for this handoff

- Word frequency IKI residual (needs SUBTLEX-US data file, not in repo)
- Persistent homology / TDA (deferred to separate session, ~300 lines)
- Circadian rhythm signals (data-gated, needs varied-hour sessions)
- Cognitive microstates / HSMM (Phase 2, ~500 lines)
- Avatar/ghost engine changes
- Reproducibility snapshot updates for new signals
