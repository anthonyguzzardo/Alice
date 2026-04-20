# Handoff: Rust Measurement Instrument Upgrade (2026-04-20)

## What happened this session

Two upgrades to the Rust signal engine, transforming it from a fast computation library into a proper measurement instrument.

### Task 5: MLE Ex-Gaussian Fit

Replaced method of moments with maximum likelihood estimation via EM algorithm in `src-rs/src/motor.rs`.

**Why it matters:** The ex-Gaussian decomposes flight times into a Gaussian component (mu, sigma) representing motor baseline and an exponential tail (tau) representing cognitive slowing. Tau is the signal. Method of moments produces noisy tau estimates on small samples and heavy tails. MLE via EM converges to better estimates or honestly falls back to MoM when it can't improve.

**What changed:**
- `stats.rs`: Added `erfc()` (complementary error function, Abramowitz & Stegun 7.1.26 rational approximation)
- `motor.rs`: New `exgauss_log_pdf()` for numerical validation, `mom_estimates()` extracted as seed + fallback, full EM iteration (E-step: posterior exponential component weight per observation, M-step: update mu/sigma from Gaussian residuals, tau from mean exponential weight)
- Convergence: max 200 iterations, tolerance 1e-6, validates MLE log-likelihood > MoM log-likelihood before accepting
- Degenerate parameter guard: reverts to MoM if mu/sigma/tau go non-positive during iteration

**No pipeline changes needed.** Same output struct, same napi interface, better estimates.

### Task 4: Multi-scale Permutation Entropy

Compute PE at orders 3-7 instead of a single order-3 value. Cascaded through the full pipeline.

**Why it matters:** A single PE value collapses temporal structure across scales. Order 3 sees 3-keystroke patterns. Order 7 sees 7-keystroke patterns. The spectrum separates local complexity from global structure. Session 77 showed PE dropping from 0.998 (order 3) to 0.729 (order 7): high local randomness, detectable longer-range patterns. That distinction separates deliberation from volatility.

**Files changed (full cascade):**

| Layer | File | Change |
|-------|------|--------|
| Rust | `src-rs/src/dynamical.rs` | `pe_spectrum: Option<Vec<f64>>` on `DynamicalResult`, computed at orders 3-7 in `compute()` |
| napi | `src-rs/src/lib.rs` | `pe_spectrum: Option<Vec<f64>>` on `DynamicalSignals` napi struct |
| Schema | `db/sql/dbAlice_Tables.sql` | `pe_spectrum JSONB` column on `tb_dynamical_signals` |
| Migration | `db/sql/migrations/002_add_pe_spectrum.sql` | `ALTER TABLE` with `search_path = alice, public` |
| DB types | `src/lib/libDb.ts` | `pe_spectrum: string \| null` on `DynamicalSignalRow`, JSONB re-stringify in `getDynamicalSignals()` |
| DB save | `src/lib/libDb.ts` | `pe_spectrum` added to `saveDynamicalSignals()` INSERT |
| TS types | `src/lib/libDynamicalSignals.ts` | `peSpectrum: number[] \| null` on `DynamicalSignals` interface + fallback computation |
| Native bridge | `src/lib/libSignalsNative.ts` | `peSpectrum` wired through native interface type + coercion |
| Pipeline | `src/lib/libSignalPipeline.ts` | `JSON.stringify(ds.peSpectrum)` before save |

### CLAUDE.md Updated

Rewrote the Rust Signal Engine section opening to frame the crate as a measurement instrument. Key principles documented:
- Estimation quality over convenience (MLE over MoM)
- Multi-scale over single-point (spectrum over scalar)
- The napi boundary is a measurement interface, not an API
- Numerical functions must be cited with source and error bounds

Also updated module descriptions (`erfc` in stats, MLE/EM in motor, multi-scale PE in dynamical) and added `pe_spectrum` to JSONB column list.

## Runtime verification

Both tasks verified against live journal and calibration sessions:

| Session | Type | IKIs | pe_spectrum | ex_gaussian_tau |
|---------|------|------|-------------|-----------------|
| Q77 | Journal | 554 | [0.998, 0.995, 0.977, 0.882, 0.729] | 75.9 (tau_prop=0.95) |
| Q78 | Calibration | 178 | [0.992, 0.981, 0.927, 0.760, 0.602] | null (expected: <50 flights after filtering) |

## Test count

44 Rust tests, zero clippy warnings, clean release build with LTO.

New tests this session:
- `erfc_known_values` -- golden values at 0, 1, +inf, -inf
- `ex_gaussian_mle_converges` -- right-skewed synthetic data
- `ex_gaussian_insufficient_data` -- error variant check
- `ex_gaussian_log_pdf_finite` -- sanity on log-PDF
- `pe_spectrum_length_and_bounds` -- 5 values, all in [0,1]
- `pe_spectrum_none_for_short_series` -- order 7 needs >= 17 points

## What's left (deferred)

### PE spectrum consumption
`pe_spectrum` is stored but nothing reads it yet. The state engine's Deliberation dimension still uses single order-3 PE. Next step: wire spectral slope (regression across orders) into the state engine as a complexity-scale feature. Could also compute spectral flatness (ratio of geometric to arithmetic mean) as a single summary statistic.

### Streaming signal computation
Rust maintains a persistent keystroke buffer via napi Reference, computes signals incrementally during typing instead of batch post-session. Would give intra-session signal trajectories.

### Signal trait composition
`trait Signal { fn compute(&self, stream: &[KeystrokeEvent]) -> SignalResult<Self::Output>; }` for pipeline composability.

### Multifractal DFA
Full singularity spectrum instead of single DFA alpha.

### NCD on keystroke dynamics
Normalized compression distance between IKI windows within a session (temporal complexity profile).

## Key file locations

- Rust engine: `src-rs/src/{lib,types,stats,dynamical,motor,process}.rs`
- State engine: `src/lib/libAliceNegative/libStateEngine.ts`
- Signal pipeline: `src/lib/libSignalPipeline.ts`
- Native wrapper: `src/lib/libSignalsNative.ts`
- DB functions: `src/lib/libDb.ts`
- TS fallback (dynamical): `src/lib/libDynamicalSignals.ts`
- TS fallback (motor): `src/lib/libMotorSignals.ts`
- Schema: `db/sql/dbAlice_Tables.sql`
- Migrations: `db/sql/migrations/`
- Project rules: `CLAUDE.md`
