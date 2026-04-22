# Signal Engine Reproducibility

This crate is a measurement instrument. The same input must produce the same output, always, on every run, after every rebuild. This document states the guarantee, what enforces it, and what to do when it breaks.

## The guarantee

Given the same keystroke stream JSON and the same profile parameters, every signal value (dynamical, motor, process) is **bit-identical** across:

- Multiple runs of the same binary
- Clean rebuilds (`cargo clean && cargo build --release`) on the same machine
- Rebuilds after code changes that do not touch signal computation logic

This guarantee holds **only** on the pinned toolchain and target. See "Supported targets" below.

## What enforces it

### Toolchain pinning (`rust-toolchain.toml`)

The Rust version, LLVM version, and target triple are pinned in `rust-toolchain.toml`. This eliminates codegen variance from different compiler versions, optimization passes, or target feature detection. FMA (fused multiply-add) determinism is guaranteed by the fixed target: `aarch64-apple-darwin` always has NEON FMA, and the pinned LLVM version always emits the same FMA decisions for the same source.

### Neumaier compensated summation (`stats.rs`)

All multi-element floating-point sums use Neumaier's improved Kahan algorithm. This makes sums invariant to the order of addends, eliminating sensitivity to auto-vectorization differences and loop unrolling decisions. Citation: Neumaier (1974).

Three utilities:
- `neumaier_sum(&[f64])` for slice summation
- `neumaier_sum_map(&[T], fn)` for map-then-sum
- `NeumaierAccumulator` for loop accumulators

### Deterministic iteration order

- **Permutation entropy** uses `BTreeMap` for pattern counts (deterministic iteration for the entropy sum).
- **Digraph latency profile** uses `BTreeMap` for JSON serialization and deterministic tie-breaking in the top-10 selection.
- **Avatar engine** uses sorted vecs for all Markov chain and PPM trie data structures.

No `HashMap` is iterated on any path that feeds into a signal value or serialized output.

### Automated check (`reproducibility-check.sh`)

The script builds the crate twice from clean state, computes all signals on a deterministic fixture session, and diffs the JSON output byte-for-byte. Run it with:

```
npm run reproducibility-check
```

or directly:

```
./src-rs/reproducibility-check.sh
```

### CI enforcement (`.github/workflows/signal-reproducibility.yml`)

Bit-identity is enforced automatically on every PR that touches `src-rs/**`, `package.json`, `package-lock.json`, or the workflow file itself, and on pushes to `main` touching `src-rs/**`. The workflow runs on `macos-14` (Apple M1, ARM64) matching the pinned toolchain target. Steps: clippy with warnings-as-errors, unit tests, then the full two-clean-build reproducibility check.

### Local use

Running the check locally is recommended for fast feedback during development but is not the enforcement mechanism. Run it with:

```
npm run reproducibility-check
```

Useful when:
- Iterating on signal computation logic (faster than waiting for CI)
- After upgrading the Rust toolchain version
- After changing `Cargo.toml` dependencies or `[profile.release]` settings

## Supported targets

| Target | Guarantee | Enforced by |
|--------|-----------|-------------|
| `aarch64-apple-darwin` (Apple Silicon macOS) | Bit-identical across clean rebuilds | `rust-toolchain.toml` + `reproducibility-check.sh` |
| Other targets | **Not guaranteed.** Different FMA availability, different SIMD widths, different LLVM backends. | None |

This is a single-user local application. The only production target is Apple Silicon macOS. If deployment to other targets is needed in the future:

1. Add the target to `rust-toolchain.toml`
2. Run `reproducibility-check.sh` on that target
3. If it passes, add the target to this table
4. If it fails, investigate whether the divergence is from FMA, vectorization, or summation order, and fix before adding

Cross-target bit-identity (same input producing the same output on aarch64 vs x86_64) is **not** guaranteed and is not a goal. The FMA instruction set differs, and that is acceptable. The guarantee is: **same target, same toolchain, same output.**

## When the check fails

If `reproducibility-check.sh` reports DIVERGED after a toolchain upgrade:

1. Identify which signals changed and by how much
2. If the delta is ULP-level (< 1e-14 relative), the toolchain upgrade changed codegen slightly. Update the golden snapshots and document the expected tolerance in the commit message.
3. If the delta is larger, a summation site was missed or a new HashMap iteration was introduced. Fix the root cause; do not update the snapshots.

## Reconstruction residual reproducibility

As of 2026-04-22, **dynamical and motor reconstruction residuals are bit-identical across regeneration from stored seed and profile snapshot, verified on production data.**

Every residual computed after the 2026-04-22 migration stores the exact inputs needed to regenerate the ghost: PRNG seed, profile snapshot (the exact JSON passed to `generateAvatar()`), corpus SHA-256 hash, and topic string. Given these stored inputs and the response corpus (recoverable from `tb_responses`, verified by SHA-256), any build of Alice on the pinned toolchain can regenerate the identical ghost and verify the residual.

The guarantee composes two independently verified properties:
1. **Ghost generation is seed-deterministic and build-stable.** `regenerate_avatar` takes an explicit seed and produces bit-identical output across clean rebuilds. Verified by CI (`tests/avatar_reproducibility.rs`): all 5 adversary variants produce identical snapshots across builds.
2. **Signal computation is bit-identical across clean rebuilds.** The existing guarantee (Neumaier summation, deterministic iteration, pinned toolchain). Verified by CI (`tests/reproducibility.rs`).

**Semantic residuals are not covered.** They depend on external NLP APIs (Claude for idea density, Voyage for embeddings) whose behavior can change independently of Alice's code. Semantic residuals are stored and verifiable against regenerated ghost text, but bit-identity across regeneration is not guaranteed.

**Pre-reproducibility-era residuals** (`avatar_seed IS NULL`, all rows before 2026-04-22) are frozen artifacts. Their stored values are the permanent record; they cannot be independently regenerated.

### Verification script

```
npx tsx src/scripts/verify-residual-integration.ts
```

Exercises the full chain on a real stored residual: loads stored seed + profile, reconstructs corpus, verifies SHA-256, regenerates ghost, computes signals, compares per-signal against stored values. Reports EXACT/DELTA per signal with family classification.

## Scope of the Rust engine guarantee

Dynamical and motor signals are verified bit-identical across clean rebuilds via the cross-build snapshot test (see `signal-reproducibility.yml`). Process signals are computed by the same Rust engine with the same numerical discipline (Neumaier summation, BTreeMap iteration where applicable) but are not currently in the cross-build snapshot test. Adding process signals to the check requires a realistic keystroke event fixture with cursor positions, deletions, insertions, and UTF-16 offsets; the current fixture is a linear forward-typing sequence that does not exercise the text reconstruction path. This is tracked as a followup in METHODS_PROVENANCE.md.

Semantic signals depend on external APIs (Claude for idea density, Voyage for embeddings) and are not subject to build-time reproducibility guarantees. This is documented as an inherent scope limitation, not a gap to close.
