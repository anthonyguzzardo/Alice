# Methods Provenance Log

Running record of correctness issues in the signal engine: what was wrong, how it was found, what it affected, and how it was resolved. Each entry is evidence for the methods section, not just a changelog.

The test: could a reviewer read this entry and independently verify every claim? If not, the entry doesn't belong here.

Newest first.

---

## INC-006: Reconstruction residual reproducibility

**Date:** 2026-04-22
**Type:** Methods event (architectural upgrade, not an incident)
**Design doc:** `docs/designs/residual-reproducibility.md`
**Commits:** `9d193ea` through `a4ea6b5` (7 commits)

### What changed

Reconstruction residuals are now reproducible scientific artifacts. Every residual computed after 2026-04-22 stores the exact inputs needed to regenerate the ghost that produced it:

- **PRNG seed** (`avatar_seed TEXT`): the u64 seed used by the ghost engine, serialized as a decimal string (JS cannot represent u64 without precision loss).
- **Profile snapshot** (`profile_snapshot_json JSONB`): the exact JSON passed to `generateAvatar()` at computation time (3.1KB measured, the curated object with field renaming, not the full 31KB database row).
- **Corpus hash** (`corpus_sha256 TEXT`): SHA-256 of the serialized corpus JSON, for integrity verification at regeneration time.
- **Topic string** (`avatar_topic TEXT`): the topic passed to `generateAvatar()` (currently equals question text).

Schema: migration `011_residual_reproducibility.sql`. 130 pre-existing rows have NULL for all four columns (pre-reproducibility-era artifacts).

### Rust changes

- `avatar::compute()` returns `SeededAvatarResult` (result + seed). The seed is no longer discarded.
- `AvatarOutput` (napi boundary) includes `seed: String`.
- New napi entry point `regenerate_avatar` takes an explicit seed string and calls `compute_seeded()` directly.
- Cross-build ghost determinism verified by CI: `tests/avatar_reproducibility.rs` snapshots all 5 adversary variants with fixed (corpus, profile, seed) and diffs across clean rebuilds. All 7 snapshots (2 signal + 5 avatar) bit-identical.

### Verification on production data

The reproducibility chain was verified end-to-end on real production data using `src/scripts/verify-residual-integration.ts`. The script deletes a pre-reproducibility-era residual, recomputes it via the production pipeline (which now stores seed + profile + hash + topic), then regenerates the ghost from stored inputs and compares per-signal.

**Question 86** (seed `1776843941639`, 312 keystrokes, 40 words, "Name as many musical instruments as you can..."):

| Signal | Family | Stored | Recomputed | Match |
|--------|--------|--------|------------|-------|
| permutation_entropy | dynamical | 0.9966825625 | 0.9966825625 | EXACT |
| dfa_alpha | dynamical | 0.7261043441 | 0.7261043441 | EXACT |
| rqa_determinism | dynamical | 0.6937524329 | 0.6937524329 | EXACT |
| rqa_laminarity | dynamical | 0.8164168937 | 0.8164168937 | EXACT |
| te_dominance | dynamical | 0.0000000000 | 0.0000000000 | EXACT |
| sample_entropy | motor | 0.6523756287 | 0.6523756287 | EXACT |
| motor_jerk | motor | 439.0112425783 | 439.0112425783 | EXACT |
| lapse_rate | motor | 3.8544461387 | 3.8544461387 | EXACT |
| tempo_drift | motor | 4.2073461319 | 4.2073461319 | EXACT |
| perplexity | perplexity | 67.3776199753 | 67.3776199753 | EXACT |

**Question 85** (seed `1776844011412`, 566 keystrokes, 77 words, "Describe the taste of black pepper to someone who has never..."):

| Signal | Family | Stored | Recomputed | Match |
|--------|--------|--------|------------|-------|
| permutation_entropy | dynamical | 0.9932871508 | 0.9932871508 | EXACT |
| dfa_alpha | dynamical | 0.7434630019 | 0.7434630019 | EXACT |
| rqa_determinism | dynamical | 0.6764910266 | 0.6764910266 | EXACT |
| rqa_laminarity | dynamical | 0.7843978488 | 0.7843978488 | EXACT |
| te_dominance | dynamical | 5.7556321802 | 5.7556321802 | EXACT |
| sample_entropy | motor | 0.7015220898 | 0.7015220898 | EXACT |
| motor_jerk | motor | 496.6321126694 | 496.6321126694 | EXACT |
| lapse_rate | motor | 4.3036414353 | 4.3036414353 | EXACT |
| tempo_drift | motor | -9.7296811544 | -9.7296811544 | EXACT |
| perplexity | perplexity | 83.2449181719 | 83.2449181719 | EXACT |

Both questions: 10/10 dynamical + motor + perplexity signals bit-identical. `ex_gaussian_tau` and `tau_proportion` were null on both stored and recomputed (insufficient data for MLE), correctly matching as null=null.

Semantic signals (idea density, lexical sophistication, epistemic stance, integrative complexity, deep cohesion, text compression ratio) were excluded from verification. They depend on external APIs (Claude, Voyage) that can change behavior independently of Alice's code. Per design, semantic residuals are classified as externally-dependent and are not covered by the bit-reproducibility guarantee.

### Scope of the guarantee

**Dynamical and motor residuals are bit-reproducible end to end.** The full chain: stored seed + stored profile + reconstructed corpus (verified by SHA-256) -> `regenerate_avatar` (seed-deterministic, build-stable per CI) -> signal computation (Neumaier summation, deterministic iteration, pinned toolchain per CI) -> residual values identical to stored.

**Semantic residuals are not.** They are stored and verifiable against regenerated ghost text, but external API drift means bit-identity cannot be guaranteed.

**Pre-reproducibility-era residuals (avatar_seed IS NULL) are frozen artifacts.** Their stored values are the permanent record. They cannot be independently regenerated because the seed and profile state at computation time were not persisted.

### Design lifecycle

1. **Gap identified** (2026-04-22): ghost output is ephemeral, residuals cannot be verified.
2. **Design deferred** (2026-04-22): no current consumer for cross-build ghost determinism.
3. **User challenge** (2026-04-22): "residuals should be reproducible scientific artifacts, not frozen measurements."
4. **Design approved** (2026-04-22): full design doc covering seed persistence, profile snapshotting (Option A: inline JSON, measured at 3.1KB), corpus SHA-256, topic persistence, regeneration API, CI enforcement, verification failure procedure.
5. **Implementation** (2026-04-22): 7 commits, each independently verified (clippy, unit tests, reproducibility check, CI).
6. **Verification** (2026-04-22): integration test on production data, 10/10 signals bit-identical on two questions.

### Scope note

The reproducibility claim is explicitly scoped to dynamical and motor signals. Process signals are computed by the same Rust engine with the same numerical discipline but are not in the cross-build snapshot test. Semantic signals depend on external APIs and are inherently outside build-time reproducibility guarantees. Process signal verification is tracked as a followup below.

---

## Followup: Process signal cross-build verification

**Date noted:** 2026-04-22
**Type:** Open followup (scope boundary, not an incident)
**Priority:** Low. Close before Stage 2 if not sooner.

Process signals (pause/burst classification, R-burst detection, strategy shifts, text reconstruction) are not currently in the cross-build snapshot test. The numerical discipline used in those functions is the same as dynamical/motor (Neumaier summation, no HashMap iteration on output paths), so drift is unlikely, but the guarantee is not enforced.

### To close

Construct a realistic keystroke event fixture including:

1. Cursor position tracking
2. Deletion events (both single-character and multi-character)
3. Insertion events at non-terminal positions (I-bursts)
4. UTF-16 offsets for multi-byte characters (emoji, curly quotes)
5. Enough editing history to exercise strategy shift detection

Add as a new integration test in `tests/reproducibility.rs` (or a new `tests/process_reproducibility.rs`) writing to `REPRO_SNAPSHOT_DIR`. The existing `reproducibility-check.sh` diff loop and CI workflow pick up new snapshot files automatically.

### Why this is low priority

Process signal outputs are mostly counts and ratios (burst count, pause percentages, deletion rates, R-burst sizes, strategy shift count). These are less sensitive to floating-point accumulation order than the iterated nonlinear computations in dynamical and motor signals (PE, DFA, RQA, transfer entropy, ex-Gaussian MLE). The riskiest process signal path is windowed strategy shift detection, which involves a comparison of burst length distributions across session halves.

---

## INC-005: Reproducibility check wired into CI

**Date:** 2026-04-22
**Type:** Methods event (not an incident)
**Commit:** 54e84a1 (merge), e43fadb (documentation)

### What changed

The two-clean-build reproducibility check (`reproducibility-check.sh`) is now enforced automatically by GitHub Actions on every PR touching `src-rs/**`, `package.json`, `package-lock.json`, or the workflow file itself. Workflow: `.github/workflows/signal-reproducibility.yml`. Runner: `macos-14` (Apple M1, ARM64), matching the pinned `aarch64-apple-darwin` toolchain.

CI step order: clippy with warnings-as-errors, unit tests (`cargo test --lib`), then the full reproducibility check (two clean release builds, byte-for-byte snapshot diff). Caches Rust toolchain and cargo registry; never caches `target/` (clean builds are the point).

### Why this is a methods event

INC-002 established the bit-identity guarantee and built the verification infrastructure. INC-004 closed numerical edge cases. But enforcement was a paragraph in CLAUDE.md telling agents to run the check before committing. That is a soft guarantee. It depends on discipline, not mechanism.

CI makes the guarantee structural. A PR that breaks bit-identity cannot merge. The enforcement authority is the workflow, not agent memory.

### Verification

First CI run on PR #1: all steps passed in 1m54s. Clippy zero warnings, unit tests passed, reproducibility check PASS (bit-identical snapshots across clean rebuilds on `macos-14`).

### Golden signal values (fixture session, 100 keystrokes)

These are the exact values produced by the deterministic fixture session in `tests/reproducibility.rs`. Every clean rebuild on the pinned toolchain produces these numbers to the bit. The CI reproducibility check diffs these JSON snapshots byte-for-byte across two clean builds.

**Dynamical signals:**

| Signal | Value |
|--------|-------|
| permutation_entropy | 0.8166391588527645 |
| pe_spectrum | [0.8167, 0.6886, 0.5546, 0.4456, 0.3633] |
| dfa_alpha | 0.4822765767735998 |
| rqa_determinism | 0.6141015921152388 |
| rqa_laminarity | 0.7035633055344959 |
| rqa_trapping_time | 3.0984974958263773 |
| rqa_recurrence_rate | 0.1910763436187165 |
| te_hold_to_flight | 0.16977971674099246 |
| te_flight_to_hold | 0.05842298195931006 |
| te_dominance | 2.906043324855263 |

**Motor signals:**

| Signal | Value |
|--------|-------|
| sample_entropy | 0.7388353647313733 |
| motor_jerk | 49.40374729293968 |
| lapse_rate | 0.0 |
| tempo_drift | 0.7383869840763395 |
| iki_compression_ratio | 0.42954545454545456 |
| ex_gaussian_mu | 22.192482197745814 |
| ex_gaussian_sigma | 16.22382081065317 |
| ex_gaussian_tau | 10.000067202433417 |
| tau_proportion | 0.31063296908003635 |
| hold_flight_rank_corr | -0.02803064616827978 |
| adjacent_hold_time_cov | -0.048294022900374656 |

---

## INC-004: Numerical edge case closure (batch)

**Date:** 2026-04-21/22
**Severity:** produces-wrong-number (4 items)
**Discovery method:** Adversarial defect audit, systematic sweep of all signal functions for inputs that produce wrong numbers silently.

### What was wrong

Four separate numerical edge cases, none individually dramatic, all silently producing wrong or non-finite values under specific input conditions:

1. **`digamma(x)` for x <= 0** (`stats.rs:171`). The recurrence `result -= 1.0 / x` divides by zero when x=0, propagating `-inf` through the transfer entropy estimator. Not reachable from current call sites (KSG always passes x >= 1.0), but no guard prevented future callers from hitting it.

2. **`te_dominance` returning `f64::INFINITY`** (`dynamical.rs:472`). When `te_flight_to_hold` was zero but `te_hold_to_flight` was positive, the ratio `hf / fh` produced infinity. This value was stored to PostgreSQL as float8 and could break downstream arithmetic or JSON serialization. Occurred when flight-to-hold transfer entropy rounded to exactly zero.

3. **`exgauss_log_pdf` overflow** (`motor.rs:293`). The term `(mu - x) / tau` overflows to `-inf` for extreme flight times (e.g., 4999ms with mu=80, tau=30). A single outlier that passes the IQR filter can poison the entire MLE log-likelihood sum, silently forcing fallback to method-of-moments without any error signal.

4. **Exact `== 0.0` variance comparisons** (`motor.rs:156, 483, 563`). Four sites compared standard deviation or variance against exactly zero. Near-zero variance (e.g., all values 100.0 except one at 100.0 + 1e-15) passes the guard, then divides by the epsilon-small variance, producing astronomically large autocorrelation, covariance, or correlation values.

### Resolution

1. `digamma`: added `if x <= 0.0 { return f64::NAN; }` guard. Tests: `digamma_zero_returns_nan`, `digamma_negative_returns_nan`.
2. `te_dominance`: simplified to `if fh_val > 0.0 { Some(hf/fh) } else { None }`. Dominance is undefined, not infinite, when the denominator is zero.
3. `exgauss_log_pdf`: clamped exponential term to `.max(-700.0)`. `exp(-700)` is effectively zero but finite, preventing `-inf` propagation.
4. All four variance sites: changed `== 0.0` to `< 1e-20`.

### Scope of impact

Items 1 and 3 were latent (no known session triggered them). Item 2 may have produced infinity values in `tb_dynamical_signals.te_dominance` for sessions where `te_flight_to_hold` was exactly zero. Item 4 is theoretically triggerable but extremely unlikely given keystroke timing variance.

No data reprocessing performed for these items. The alignment fix reprocessing (INC-001) already rebuilt all dynamical signals with these fixes applied.

---

## INC-003: Silent FFI boundary parse failures

**Date:** 2026-04-21
**Severity:** produces-no-number-when-it-should
**Discovery method:** Adversarial defect audit, sweep of all `unwrap_or_default` / `match Err(_) =>` patterns.

### What was wrong

The napi entry points `compute_dynamical_signals` and `compute_motor_signals` in `lib.rs` caught JSON parse errors and returned default structs (all fields `None` / 0). The TypeScript caller received an all-null result indistinguishable from "session too short to compute." A malformed JSON payload, a schema mismatch, and a genuinely empty session all looked identical.

Separately, `avatar::compute` used `serde_json::from_str(corpus_json).unwrap_or_default()` which silently returned an empty vec on parse failure, then hit the `texts.is_empty()` check and returned `InsufficientData` -- technically correct but hiding the real cause.

### Resolution

**napi boundary:** Added `parse_error: Option<String>` field to `DynamicalSignals` and `MotorSignals` structs. On parse failure, the field contains the serde error message. On success, it's `None`. The TS layer can now distinguish "Rust computed nothing from valid input" from "Rust never got valid input."

**Avatar:** Replaced `unwrap_or_default()` with `SignalError::ParseError(format!("corpus JSON: {e}"))` propagation. Added new `ParseError(String)` variant to `SignalError` enum in `types.rs`.

### Scope of impact

No known production incident. The keystroke stream JSON is constructed by the client and has never been malformed in practice. This was a defensive fix for robustness, not a response to data loss.

---

## INC-002: Floating-point summation order / bit-reproducibility sweep

**Date:** 2026-04-21/22
**Severity:** produces-wrong-number (summation order changes results at ULP level; accumulated over sessions, this constitutes a measurement reproducibility failure)
**Discovery method:** Comparison of dynamical signals across Rust recompilations during INC-001 data reprocessing. DFA alpha and PE showed last-significant-digit drift for 4/26 sessions despite identical inputs. Initially misdiagnosed as "LLVM optimizer nondeterminism, not a code bug." Corrected after user challenge.

### What was wrong

Three independent sources of floating-point nondeterminism:

1. **Naive summation in 17+ accumulation sites.** `stats::mean`, `stats::std_dev`, `stats::pearson`, `motor::iki_autocorrelation`, `motor::ex_gaussian_fit`, `dynamical::dfa_alpha`, `dynamical::transfer_entropy`, and others used `.iter().sum()` or `sum += x` loop accumulators. These are sensitive to the order the compiler processes elements (auto-vectorization, loop unrolling). Different optimization passes across recompilations produced different results at the ULP level.

2. **HashMap iteration in permutation entropy** (`dynamical.rs:51`). `pattern_counts: HashMap<Vec<usize>, u64>` was iterated at line 67 to compute the entropy sum. HashMap iteration order is randomized per-process in Rust. The entropy sum `S = -sum(p * log2(p))` depends on the order of addends because floating-point addition is not commutative. Different runs of the same binary could produce different PE values.

3. **HashMap iteration in digraph latency profile** (`motor.rs:265`). The `profile: HashMap<String, f64>` was serialized to JSON by serde, which preserves HashMap iteration order. The JSON field order was nondeterministic across runs. Additionally, the top-10 digraph selection (`sort_by_key(Reverse(len))`) had nondeterministic tie-breaking when multiple digraphs had the same frequency.

### How it was discovered

During INC-001 data reprocessing, the old-vs-new comparison showed DFA alpha, PE, and RQA deltas at the 14th-15th significant digit for 4 sessions, despite identical IKI series (verified by iki_count match and PE bit-identity for 3/4 sessions). Initially attributed to LLVM optimizer variance and documented as "not a code bug." User correctly rejected this framing: a measurement instrument doesn't get to hand-wave ULP drift.

Issues 2 and 3 were discovered when building the cross-build reproducibility check. The within-binary reproducibility test (`motor_signals_reproducible`) failed on the digraph profile before the HashMap was converted to BTreeMap.

### Resolution

**Summation:** Implemented Neumaier compensated summation (`stats.rs`): `neumaier_sum`, `neumaier_sum_map`, `NeumaierAccumulator`. Converted all 17 accumulation sites across `stats.rs`, `motor.rs`, and `dynamical.rs`. Neumaier is an improved Kahan algorithm that handles inputs of varying magnitude. Error bound: O(eps) independent of n.

**PE HashMap:** Converted `pattern_counts` from `HashMap<Vec<usize>, u64>` to `BTreeMap<Vec<usize>, u64>` for deterministic iteration.

**Digraph profile:** Converted output `HashMap<String, f64>` to `BTreeMap<String, f64>` for deterministic JSON serialization. Added secondary sort key (`a.0.cmp(&b.0)`) for deterministic tie-breaking in top-10 selection.

**Toolchain pinning:** Created `src-rs/rust-toolchain.toml` pinning Rust 1.95.0 + LLVM 22.1.2 + `aarch64-apple-darwin` target. FMA determinism guaranteed by fixed target (always has NEON FMA) and fixed LLVM version.

**Verification:** `reproducibility-check.sh` builds twice from clean state, computes signals on fixture session, diffs byte-for-byte. Result: **PASS. Bit-identical across clean rebuilds.** Available as `npm run reproducibility-check`.

### Scope of impact

Summation order sensitivity affected all signal values at the ULP level (~1e-14 relative). The PE HashMap bug was more severe: it could change PE values by a meaningful amount across runs (same binary, different process). The digraph profile bug changed JSON field order across runs, which could affect downstream consumers that depend on key ordering.

No data reprocessing performed for this incident specifically. The INC-001 reprocessing already used the fixed code.

### Followups

- `src-rs/REPRODUCIBILITY.md` documents the guarantee, supported targets, and failure protocol.
- CLAUDE.md updated to require `npm run reproducibility-check` before committing signal changes.
- Process signals (`process.rs`) are not covered by the cross-build check due to text reconstruction fixture complexity. Tracked as a future improvement.

---

## INC-001: HoldFlight vector misalignment

**Date:** 2026-04-21
**Severity:** produces-wrong-number
**Discovery method:** Adversarial defect audit of the Rust signal engine, specifically reviewing `types.rs` for correctness under adversarial input (overlapping keystrokes, negative flight times, out-of-order events).

### What was wrong

`HoldFlight::from_stream` in `src-rs/src/types.rs` filtered hold times and flight times independently. For each keystroke event, the hold time (`key_up - key_down`) was pushed to the holds vector if valid (0-2000ms), and the flight time (`key_down[i] - key_up[i-1]`) was pushed to the flights vector if valid (0-5000ms). These two filters ran independently.

The problem: rollover typing, where the next key is pressed before the previous key is released (`key_down[i] < key_up[i-1]`), produces a negative flight time. The flight filter rejects it, but the hold filter for the same event accepts the hold. This shifts the flights vector by one position relative to the holds vector. Every subsequent pair `(holds[k], flights[k])` now refers to different keystroke events.

Transfer entropy and RQA computed on these misaligned pairs measured the correlation between holds from one set of events and flights from a completely different set of events.

### How it was discovered

Not from observing bad outputs. The TE values were plausible (positive, finite, in expected range). The bug was found during a systematic sweep for correctness under adversarial input, specifically asking "what happens if hold is valid but flight isn't for the same event?"

A diagnostic script (`scripts/diagnose-holdlight-alignment.ts`) was written to quantify the impact before any fix was applied. It queried every session's keystroke stream and counted events where hold and flight validity diverged.

### Scope of impact

- **27/27 sessions affected** (100% contamination rate).
- **6,589 total misaligned events** across all sessions.
- **Root cause:** Rollover typing. Negative flight times from `key_down[i] < key_up[i-1]`. This is normal fast typing behavior, not an edge case. Sessions had 40-757 misaligned events each.
- **TE values:** Mean relative shift 130%+. Maximum relative shift 804% (Q6 `te_hold_to_flight`: 0.0133 old, 0.1201 new). 5 sign flips across 52 TE measurements (26 sessions x 2 directions).
- **RQA values:** Unaffected. RQA is computed on the IKI series, not hold-flight pairs.
- **PE, DFA:** Unaffected. These use IKI series only.
- **Vector length example:** Q7 had holds=1488, flights=730. `aligned_len()` truncated to 730, but `holds[k]` for k < 730 corresponded to completely different events than `flights[k]`.

### Resolution

**Fix:** Changed `HoldFlight::from_stream` to filter hold and flight together. Only push both when both are valid for the same event. Added `debug_assert_eq!` in `aligned_len()` to enforce the invariant.

```rust
// New: paired filtering
for i in 1..stream.len() {
    let ht = stream[i].key_up_ms - stream[i].key_down_ms;
    let ft = stream[i].key_down_ms - stream[i - 1].key_up_ms;
    if ht > 0.0 && ht < 2000.0 && ft > 0.0 && ft < 5000.0 {
        holds.push(ht);
        flights.push(ft);
    }
}
```

**Tests:** 4 regression tests in `types.rs`:
- `holdflight_vectors_always_same_length` (rollover input)
- `holdflight_pairs_refer_to_same_event` (value verification)
- `holdflight_excludes_invalid_hold_with_valid_flight`
- `holdflight_aligned_len_equals_vector_length`

**Data reprocessing protocol:**
1. Snapshot: `tb_dynamical_signals_pre_alignment_fix_20260421` (26 rows, pristine copy of original data).
2. Recomputed into staging table `tb_dynamical_signals_v2` (27 rows: 26 existing + Q65 which previously had no dynamical signals).
3. Old-vs-new comparison performed for every session and every numeric signal: absolute delta, relative delta, sign flip, null transitions. TE severely contaminated (130%+ mean shift). RQA < 1% shift (floating-point noise from recompilation, not alignment-related). PE/DFA zero delta.
4. Atomic table swap: `tb_dynamical_signals` renamed to `tb_dynamical_signals_contaminated_20260421`, staging table renamed to `tb_dynamical_signals`.
5. Post-swap verification: row count 27, spot-check Q68 `te_flight_to_hold` = 0.0000 (was 0.4947).

**Preserved artifacts:**
- `tb_dynamical_signals_pre_alignment_fix_20260421`: pristine snapshot (26 rows)
- `tb_dynamical_signals_contaminated_20260421`: original live data (26 rows)
- `scripts/diagnose-holdlight-alignment.ts`: diagnostic script
- `scripts/recompute-dynamical-v2.ts`: reprocessing script

### Followups

- **Flight time upper bound** (`ft < 5000.0`) may be too aggressive for deep reflection sessions. Q7 had a 5093ms flight flagged as invalid that is almost certainly a legitimate cognitive pause. The threshold conflates journal sessions (deep reflection, long pauses expected) with calibration sessions (timed typing, long pauses are distraction). Documented in GOTCHAS.md as a separate follow-up with analysis plan. Not bundled with the alignment fix.
