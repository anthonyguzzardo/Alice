# Handoff: Alice Instrument State (2026-04-22)

## Current state

Daily journaling instrument with 27+ sessions, five signal families active (dynamical, motor, semantic, process, cross-session), five-variant reconstruction residuals, and a Rust signal engine as the single source of truth. 154 Rust tests, zero clippy warnings.

The instrument validates itself. Five adversary ghosts, each the strongest statistical reconstruction possible along a different axis, all fail to reproduce what the instrument detects in real writing. The motor floor holds across every variant.

**As of today, reconstruction residuals are reproducible scientific artifacts.** Every new residual stores the PRNG seed, profile snapshot, corpus SHA-256, and topic string. Given these stored inputs, any build on the pinned toolchain regenerates the identical ghost and verifies the residual to bit identity. Verified on production data (Q85, Q86: 10/10 dynamical + motor signals EXACT). Full evidence in METHODS_PROVENANCE.md INC-006.

## What was built today (2026-04-22)

### Residual reproducibility (7 commits, design through production verification)

The session started with the question "why does cross-build bit-identity matter?" and ended with bit-identical residual verification on production data. The full arc:

1. **`9d193ea`** Rust: `compute()` returns `SeededAvatarResult` (result + seed). The seed is no longer discarded.
2. **`fee7b87`** Rust: `regenerate_avatar` napi entry point. Takes explicit seed string, calls `compute_seeded()`.
3. **`541cd65`** Rust: avatar cross-build reproducibility CI test. All 5 variants bit-identical across clean rebuilds (7 total snapshots: 2 signal + 5 avatar).
4. **`40bf740`** Schema: migration 011. Four new columns on `tb_reconstruction_residuals`: `avatar_seed`, `profile_snapshot_json`, `corpus_sha256`, `avatar_topic`.
5. **`4caacbd`** TypeScript: persist all four inputs. Corpus SHA-256 computed once per session, not per variant.
6. **`a4ea6b5`** TypeScript: `regenerateAvatar`, `verifyResidual`, and integration test (`verify-residual-integration.ts`). Full chain verified on Q85 and Q86.
7. **`5a42226`** Documentation: METHODS_PROVENANCE.md (INC-006 with verification tables), REPRODUCIBILITY.md (scoped claim).

**`bbb6e05`** Paper and research page updated with reproducibility evidence.

### Design doc

`docs/designs/residual-reproducibility.md` contains the full design: seed persistence, profile snapshotting (Option A: inline JSON, measured at 3.1KB), corpus SHA-256, topic persistence, regeneration API, CI enforcement, verification failure procedure (three failure modes with investigation protocols), and TS integration test plan. Pro/con analysis and caller audit are part of the methods trail.

### Three-layer reproducibility architecture

Each layer composes on the one below it:

1. **Signal computation is build-stable.** Neumaier compensated summation, BTreeMap/sorted-vec deterministic iteration, pinned toolchain. CI-enforced via `tests/reproducibility.rs`. Golden signal values (21 dynamical + motor signals from fixture session) documented in METHODS_PROVENANCE.md INC-005 and paper Section 4.4.
2. **Ghost generation is seed-deterministic and build-stable.** SplitMix64 PRNG, sorted-vec Markov/PPM sampling. CI-enforced via `tests/avatar_reproducibility.rs`. All 5 variants bit-identical across clean rebuilds.
3. **Full residual chain is reproducible.** Stored inputs (seed, profile, corpus hash, topic) -> regenerated ghost -> recomputed signals -> bit-identical to stored values. Verified on production data (Q85, Q86: 10/10 signals EXACT), runnable on demand.

### Scope of the guarantee

- **Dynamical and motor residuals:** bit-reproducible end to end.
- **Semantic residuals:** externally-dependent (Claude, Voyage APIs). Stored but not bit-identity guaranteed.
- **Pre-reproducibility-era residuals** (`avatar_seed IS NULL`): frozen artifacts. Cannot be independently regenerated.

## Prior work (2026-04-21)

### Signal engine audit (INC-001 through INC-005)

Adversarial audit found HoldFlight vector misalignment (INC-001) contaminating 100% of transfer entropy values. All dynamical signals and reconstruction residuals recomputed. Additionally: Neumaier compensated summation at 17 sites (INC-002), HashMap -> sorted vecs for bit-reproducibility (INC-002), silent FFI parse failure surfacing (INC-003), four numerical edge cases closed (INC-004), CI enforcement (INC-005). Full details in METHODS_PROVENANCE.md.

### Multi-adversary system

Five ghost variants run on every session:

| Variant | Text | Timing | What It Tests |
|---------|------|--------|---------------|
| 1. Baseline | Order-2 Markov | Independent ex-Gaussian | Control condition |
| 2. Conditional Timing | Order-2 Markov | AR(1) conditioned IKI | Serial dependence |
| 3. Copula Motor | Order-2 Markov | Gaussian copula hold/flight | Hold-flight coupling |
| 4. PPM Text | Variable-order PPM | Independent ex-Gaussian | Better text generation |
| 5. Full Adversary | PPM | AR(1) + copula | Strongest ghost |

### R-burst revision calibration

Ghost R-bursts use measured profile data: `rburst_mean_duration` calibrates episode timing via budget allocation, `rburst_consolidation` scales size by session position, `rburst_mean_size` and `rburst_leading_edge_pct` are wired.

### Strategic paper plan

- **Option B** (`papers/option_b_compressed.md`): Science Perspective draft. Construct replacement vs measurement noise. Done.
- **Option F** (`papers/option_f_draft.md`): Reconstruction Validity paper, v5. Now includes Section 4.4 with reproducibility verification tables. Done.
- **Ghost crate** (`../reconstruction-validity/`): Standalone Rust crate. 50 tests, awaiting publish to crates.io.

## Architecture reference

```
src/lib/libReconstruction.ts           -- orchestrates all 5 variants, verifyResidual()
src/lib/libSignalsNative.ts            -- napi boundary (generateAvatar, regenerateAvatar)
src/lib/libSignalPipeline.ts           -- orchestrates all derived signals per session
src/lib/libDb.ts                       -- all database functions (ReconstructionResidualInput with reproducibility fields)
src-rs/src/avatar.rs                   -- SeededAvatarResult, compute_seeded, 5 adversary variants
src-rs/src/lib.rs                      -- napi boundary (generate_avatar, regenerate_avatar)
src-rs/src/dynamical.rs                -- PE, DFA, RQA, transfer entropy
src-rs/src/motor.rs                    -- sample entropy, ex-Gaussian, motor jerk
src-rs/src/process.rs                  -- text reconstruction, pause/burst analysis
src-rs/tests/reproducibility.rs        -- signal cross-build snapshot test
src-rs/tests/avatar_reproducibility.rs -- ghost cross-build snapshot test (5 variants)
src-rs/reproducibility-check.sh        -- two-clean-build diff (7 snapshots)
src/scripts/verify-residual-integration.ts  -- full-chain verification on production data
db/sql/dbAlice_Tables.sql              -- complete schema (synced through migration 011)
db/sql/migrations/011                  -- residual reproducibility columns
docs/designs/residual-reproducibility.md -- full design doc with pro/con analysis
papers/option_f_draft.md               -- Reconstruction Validity paper (v5, Section 4.4)
METHODS_PROVENANCE.md                  -- INC-001 through INC-006
src-rs/REPRODUCIBILITY.md              -- signal + residual reproducibility guarantees
```

## Also built today (2026-04-22): Construct validity remediation

### INC-008: Discovery badges with dynamic critical-r gate
Observatory discoveries now use `max(criticalR(n), 0.3)` instead of a hardcoded 0.3 floor. Two-state badge system: "established" (passes critical-r + stability CV < 0.5) / "provisional" (passes critical-r only). Wired `libCouplingStability.ts` into synthesis for the first time. New utility: `src/lib/utlCriticalR.ts`.

### INC-009: Interpretive label strip + low-n framing (Waves 1-2)
Audit found two material gaps (attractor force badges, PE/tau/laminarity regime labels) and six minor gaps. All resolved across two waves. See METHODS_PROVENANCE.md INC-009 for full before/after tables.

### Daily delta verification
All 9 backfilled delta rows confirmed present in generation prompt via `formatCompactDelta`. Next generated question (April 24) will be the first with delta context. `deltaMagnitude` is null for all rows (needs 10+ day-pairs for z-score composite; roughly 2-3 more journaling days).

## What's next

### Deferred from construct validity session

| Item | Why deferred | When it matters |
|---|---|---|
| `/papers/reconstruction-validity` content audit | Product decision, not methods correction | Before external eyes see `/research` (it links to the paper) |
| PersDyn computation-layer audit | Phase two; Wave 1 stripped the labels, the numeric model is untouched | Before making claims about attractor force as a validated construct |
| Persistent prompt logging in `tb_prompt_traces` | Schema change, separate decision | When you want to audit what context fed a specific generated question |
| Same-domain coupling stability | `libCouplingStability` only covers emotion-behavior pairs | Before behavioral/semantic couplings can reach "established" badge |
| FDR correction on discoveries | 784-test surface uncorrected; critical-r handles single-test significance only | When n is large enough that corrected vs uncorrected changes which discoveries survive |
| Coupling table significance context | Raw r values on `/observatory/coupling` have no significance annotation | Low priority; designer-facing page, not user-facing |

### Publish reconstruction-validity crate
Owner to create GitHub repo, commit, push, publish to crates.io. Code complete at `../reconstruction-validity/`.

### Dataset strategy decision
Scale Alice to multi-user (auth, multi-tenancy, IRB) or keep monastic and let the ghost framework propagate through other instruments.

### Difficulty-residual correlation
Difficulty classification began at session 54. Correlation between difficulty and motor residual testable as generated questions accumulate.

### Process signal cross-build verification
Process signals (pause/burst, R-burst, strategy shifts, text reconstruction) use the same numerical discipline as dynamical/motor but are not in the cross-build snapshot test. Needs a realistic event fixture with cursor positions, deletions, insertions, and UTF-16 offsets. Low priority (mostly counts and ratios, drift unlikely). Tracked in METHODS_PROVENANCE.md. Close before Stage 2.

### Observatory reproducibility indicator
The ghost page (`observatory/ghost.astro`) already shows residuals live. Adding reproducibility status (seed present, verifiable, last verification result) is natural instrument state. Not urgent.

### Verification failure procedure (future)
`verification_status` column on `tb_reconstruction_residuals` deferred to when verification is automated (nightly sweep). Manual investigation via METHODS_PROVENANCE for now. Three failure modes documented in design doc.
