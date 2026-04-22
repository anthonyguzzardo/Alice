**Audit 1 — the Alice repo:**

Open a fresh session with repo access and hand it a checklist. Rough shape of what to verify:

*Correctness:*
- All 10 audit defects from the April 21 sweep are closed in code. Grep for each: `digamma` guard, `te_dominance` returning None, `parse_error` sentinel field, exgauss clamp, four `< 1e-20` variance comparisons, HoldFlight alignment fix, Neumaier summation applied at all 17 sites listed in the sweep scope.
- PE uses BTreeMap, not HashMap. Digraph profile uses BTreeMap. Top-10 digraph has deterministic tie-breaking.
- No `unwrap_or_default()` on serde boundaries.
- No `== 0.0` exact float comparisons anywhere in signal computation paths.

*Reproducibility:*
- `rust-toolchain.toml` pins version and target.
- Reproducibility check passes on current main.
- CI workflow triggers and passes on PR.
- `REPRODUCIBILITY.md` accurately describes the current state.

*Data integrity:*
- Live `tb_dynamical_signals` values match fresh computation from raw streams (spot-check 2-3 sessions).
- Snapshot tables still exist with correct row counts.

*Documentation:*
- `METHODS_PROVENANCE.md` has entries for the four incidents plus the CI landing.
- `GOTCHAS.md` entries are current, including the snapshot-tables entry and reproducibility-contract entry we discussed adding.
- `CLAUDE.md` reproducibility-check language reflects CI-enforcement posture.

*Cleanup:*
- No TODO comments referencing issues that are now resolved.
- No commented-out code from the audit sweep.
- No dead code (functions introduced during the sweep that are no longer called).
- `ci/signal-reproducibility` branch deleted.

Frame for the agent: "verify each item against the actual code and report status. Do not fix anything. Produce a report. If anything is not as expected, flag it and stop."

The "do not fix" framing is important. You want an inventory, not another round of changes. If something's off, you want to know about it and make a deliberate decision, not have the agent silently "clean it up" and introduce a regression.

**Audit 2 — the crate for publication:**

This is bigger and deserves its own session at minimum, possibly its own plan. Things to think through before starting:

*Scope:* What actually ships in the crate? Probably the signal functions themselves — the stats module, motor module, dynamical module, the `IkiSeries` and `HoldFlight` types, the error types. Not the napi layer, not the avatar/reconstruction pieces, not anything Alice-product-specific. Publishing is easier when the crate is small and well-scoped.

*Naming:* `alice-signals` already appears in your codebase but "alice" is generic and may be taken on crates.io (it is — there's already an `alice` crate). You probably want something like `keystroke-signals`, `writing-process-signals`, or a name tied to the paper. Check crates.io for availability before committing.

*API design:* The public API of a published crate is a contract. What you expose becomes promises you have to keep across semver. Currently your code has lots of `pub(crate)` functions — most of those should stay internal. The public API should be small: the signal-computation entry points, the input types, the error type, the config/tuning knobs if any. Everything else private. This is the single most important design decision for a published crate and deserves genuine thought, not a first pass.

*Documentation:* `cargo doc` should produce comprehensive rustdoc. Every public function needs a doc comment explaining what it computes, what the inputs mean, what the outputs mean, what can fail and why, and a citation for the mathematical source where relevant. Examples in the doc comments. A crate-level doc comment explaining the instrument philosophy and pointing to the paper.

*Examples:* An `examples/` directory with at least two runnable examples. "Here's how to compute signals from a keystroke stream" and "here's how to handle the error cases." These become the de facto tutorial for adopters.

*Licensing:* You need a LICENSE file. MIT, Apache-2.0, or dual-licensed MIT/Apache are the standard choices for Rust crates. Pick one and put the file in the crate root. This is non-negotiable for publishing.

*Cargo.toml metadata:* `description`, `repository`, `license`, `keywords`, `categories`, `readme`, `documentation`. All required or strongly recommended for crates.io. The `keywords` field is how researchers will actually find the crate — think about what someone studying writing-process cognitive biomarkers would search for.

*Versioning:* Start at 0.1.0 or 0.0.1, not 1.0.0. Pre-1.0 signals "API may change" which is honest. Go to 1.0.0 when you have adopters and the API is stable.

*Tests:* The integration tests and reproducibility tests should come along. Consider whether to include the golden snapshots as test fixtures or to document how users generate their own.

*README.md:* This is what people see on crates.io. Lead with what the crate is, why it exists (the measurement-instrument framing), an example of use, a pointer to the paper, a pointer to the reproducibility contract, installation instructions.

*CI for the crate:* The crate's CI needs to be broader than Alice's. You guarantee `aarch64-apple-darwin` bit-identity. For other targets (Linux x86_64, Windows, etc.), you should at minimum verify the crate *compiles and tests pass*, even if bit-identity isn't guaranteed. This means a matrix CI with multiple targets. Clearly document what's guaranteed on each.

*The hard question:* Does the crate need to publish the reproducibility guarantee to be scientifically useful, or is "reproducible on the author's target, compiles everywhere" enough? If a researcher on Linux clones the crate and gets slightly different numbers than you do, is that acceptable? This is a scientific judgment call, not a software one, and it should be answered before publication, not after. The honest answer will inform how aggressively you need to expand the reproducibility guarantees.
