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

## What is NOT covered

- **Process signals** (`process.rs`) are not included in the reproducibility check because they depend on event log replay with UTF-16 text reconstruction, which is hard to fixture deterministically. Process signals do use Neumaier summation where applicable but are not bit-identity tested.
- **Avatar generation** uses a time-based seed in production (`SystemTime`). Tests use `compute_seeded()` with a fixed seed and are covered by the avatar determinism tests, but not by the cross-build snapshot check.
