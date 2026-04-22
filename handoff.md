# Handoff: Alice Instrument State (2026-04-21)

## Current state

Daily journaling instrument with 57 entries, 23 sessions with full five-variant reconstruction residuals (115 total), five signal families active (dynamical, motor, semantic, process, cross-session). Rust signal engine is the single source of truth for all signal computation and avatar synthesis.

The instrument validates itself. Five adversary ghosts, each one the strongest statistical reconstruction possible along a different axis, all fail to reproduce what the instrument detects in real writing. The motor floor holds at L2 = 86-102 across every variant.

## Strategic paper plan (2026-04-21)

A four-phase plan to position reconstruction validity as a general paradigm and Alice's dataset as a structural moat. The leverage chain: B creates urgency in the widest audience, F provides the paradigm, the standalone ghost crate hands researchers the tool, and Alice's longitudinal unmediated dataset becomes irreplaceable by information-theoretic guarantee.

### Phase 1: Compressed Option B (DONE)
`papers/option_b_compressed.md` -- ~1500-word Science Perspective draft. Core move: construct replacement vs measurement noise distinction. Bathroom scale analogy. Three empirical anchors (Arnold et al., Doshi & Hauser, Zhou & Liu). Three-part research program close. Cuts measurement theory scaffolding from the full paper. Ready for author review.

### Phase 2: Tighten Option F to v5 (DONE)
`papers/option_f_draft.md` bumped to v5. Changes:
- Abstract rewritten: leads with paradigm (informational sufficiency as validity evidence), not implementation
- Generalizability foreshadowed in introduction (keystroke, speech, gait, handwriting, eye tracking)
- Section 5 collapsed from 3 subsections to 1, reframed as "Application" not co-equal motivation
- Section 9: removed duplicate "single participant" limitation, compressed No-LLM paragraph
- Section 10: removed 4 completed status-report items, kept 4 forward-looking items (cross-modality first)
- Section 11: restructured to lead with generality before empirical results
- Method 4.2: PRNG/sampling details moved to supplementary material
- 3 references removed (Blackman & Vigna, Box & Muller, Steele et al.)

### Phase 3: Dataset (owner's legwork)
The irreversible moat. A+G together prove: unmediated longitudinal behavioral data becomes impossible to replicate as AI mediation saturates. Every day of collection increases the value. Key decision still open: scale Alice to multi-user (auth, multi-tenancy, IRB) or keep Alice monastic and let the ghost framework propagate through other instruments.

### Phase 4: Ghost crate extraction (DONE)
Standalone Rust crate `reconstruction-validity` built at `/Users/anthonyguzzardo/Developer/Personal/GitHub/reconstruction-validity/`. Extracts the algorithmic core from `avatar.rs` into a generic library other instruments can use. Alice's avatar.rs is completely untouched.

**Status:** Code complete. 50 tests, zero clippy warnings, example runs clean. Files staged in local git but not committed or pushed. Awaiting owner to create GitHub repo and publish to crates.io.

**What was built (Phases 1-4 in one session):**
1. Extracted pure algorithms from avatar.rs (Markov, PPM, AR(1), copula, PRNG, stats, perplexity, residual computation)
2. Defined generic traits (`BehavioralProfile`, `TextModel`, `TimingModel`, `AdversaryVariant`)
3. Built keystroke reference implementation with all 5 adversary variants + `ReconstructionEngine` orchestrator
4. README, LICENSE (MIT), example (`keystroke_example.rs`), doc-test

**Crate structure:**
```
reconstruction-validity/
  Cargo.toml            # crate metadata, keystroke feature flag
  LICENSE               # MIT
  README.md             # full docs, usage examples, variant table, custom modality guide
  src/
    lib.rs              # pub API surface, doc-test
    traits.rs           # BehavioralProfile, TextModel, TimingModel, AdversaryVariant
    adversary.rs        # ReconstructionEngine orchestrator
    text/
      mod.rs            # shared tokenizer
      markov.rs         # MarkovChain (order-1/2, Witten-Bell, absolute discounting, perplexity)
      ppm.rs            # PpmModel (variable-order, Method C escape)
    timing/
      mod.rs            # word_difficulty_multiplier (content-process coupling)
      baseline.rs       # Independent ex-Gaussian + tempo drift
      ar1.rs            # AR(1) conditioned timing
      copula.rs         # Gaussian copula joint sampling
    residual.rs         # Per-dimension delta, L2 norms, family aggregation
    rng.rs              # xoshiro128+, Box-Muller, ex-Gaussian sampling
    stats.rs            # mean, std_dev, pearson, normalize, erfc, linreg
    keystroke.rs        # KeystrokeProfile, 5 variants, all_variants(), signal extraction
  examples/
    keystroke_example.rs  # end-to-end: corpus -> engine -> residual report
```

**Key design decisions:**
- Separate repo (not in Einstein workspace). Different audience, different release cycle.
- Traits use associated types (`type Event`) not generics
- Keystroke module is feature-gated (`default = ["keystroke"]`)
- Rng is deterministic and seedable (reproducibility for research)
- No flate2/napi dependencies. Only serde + serde_json.
- Alice doesn't change until optional Phase 5 (swap inline algorithms for crate dependency)

**To publish:**
1. Create GitHub repo: `gh repo create reconstruction-validity --public`
2. Commit: `git commit -m "initial release: reconstruction validity framework"`
3. Push: `git remote add origin <url> && git push -u origin main`
4. Publish: `cargo publish` (requires crates.io API token)

## What was built (prior session, 2026-04-21)

### Multi-adversary system for reconstruction residuals

Five ghost variants run on every session. Each adds one statistical improvement to the baseline Markov ghost. If the improvement closes the residual, that component of the gap was statistical. Whatever remains is cognitive.

| Variant | Text | Timing | Motor L2 |
|---------|------|--------|----------|
| 1. Baseline | Order-2 Markov | Independent ex-Gaussian | 90.7 |
| 2. Conditional Timing | Order-2 Markov | AR(1) conditioned IKI | 86.2 |
| 3. Copula Motor | Order-2 Markov | Gaussian copula hold/flight | 102.4 |
| 4. PPM Text | Variable-order PPM | Independent ex-Gaussian | 99.7 |
| 5. Full Adversary | PPM | AR(1) + copula | 89.3 |

Key findings:
- AR(1) modestly closes motor but creates dynamical artifacts (L2 = 83.4)
- Copula makes motor worse (coupling artifact)
- PPM closes semantic (0.131 vs 0.159) and dynamical (0.26 vs 1.51) without affecting motor
- Text and timing axes are independent in the measurement
- The motor floor is not an artifact of weak synthesis

### R-burst revision calibration

Ghost R-burst episodes now use measured profile data instead of hardcoded timing:
- `rburst_mean_duration` (9338ms) calibrates total episode timing via budget allocation (25% deliberation, 35% deletion, 10% transition, 30% retype)
- `rburst_consolidation` (null, awaiting density) scales R-burst size by session position via log-linear interpolation
- `rburst_mean_size` (20.7 chars) and `rburst_leading_edge_pct` (1.0) were already wired

### Schema file sync

`dbAlice_Tables.sql` was out of sync with migrations 009 and 010:
- Added `te_adversary_variants` enum table with 5 variant INSERTs
- Added `tb_personal_profile` as complete CREATE TABLE (was only in migration 004)
- Added `adversary_variant_id` and composite unique to `tb_reconstruction_residuals`
- Added `hold_flight_rank_corr` to `tb_motor_signals`

### Instrument status API

`instrument-status.ts` now returns per-variant convergence data:
- `convergence`: baseline (variant 1) for backward compat with published paper numbers
- `fullAdversary`: variant 5 for the strongest claim
- `variants`: per-variant summary array with motor/dynamical/semantic/total L2

### Research page updated

Reconstruction validity section rewritten for multi-adversary framing. No longer describes a single ghost. Names the five strategies (AR(1), copula, PPM, full adversary). Motor residual card shows L2 range across variants. Instrument strip shows variant count. Paper citation updated to v4.

### Reconstruction Validity paper (v3 to v4)

`papers/option_f_draft.md` updated:
- Abstract rewritten with five-variant motor floor (86-102)
- New Section 4.2a: full adversary variant table, AR(1)/copula/PPM descriptions, citations
- Revision synthesis updated: budget-allocated R-burst timing, consolidation scaling, Lindgren & Sullivan leading-edge
- Section 6.4 added: multi-adversary empirical results table
- Section 6.5 updated: dimensional validity profile across all variants
- Section 7.1 updated: motor residual replicated across five strategies
- Limitations updated: generative model ceiling partially tested, no-LLM constraint validated
- Section 10.6 marked completed (model progression implemented)
- Conclusion rewritten with multi-adversary evidence
- Seven new references added (Box/Jenkins/Reinsel, Cleary/Witten, Killourhy/Maxion, Kruskal, Lindgren/Sullivan, Moffat, Nelsen)

### Avatar page dropdown

Replaced native `<select>` with custom dropdown matching observatory aesthetic (mono, uppercase, bg/bg-dim hover contrast pattern from nav).

### GHOST.md updated

Architecture, data flow, engineering decisions (R-burst duration budget, consolidation log-linear interpolation), backfill section (added rburst-sequences, updated order), profile fields table (added rburst_consolidation, rburst_mean_duration).

## Stale data note

The 115 existing residual rows (23 sessions x 5 variants) were computed before R-burst duration calibration (2026-04-21). New sessions use calibrated values. To recompute:
```
DELETE FROM alice.tb_reconstruction_residuals;
npx tsx src/scripts/backfill-adversary-variants.ts
```
Code comments in `avatar.rs` and `libReconstruction.ts` document this cutover.

## What's next

### Publish reconstruction-validity crate
Owner to create GitHub repo, commit, push, and publish to crates.io. Code is complete and tested at `../reconstruction-validity/`.

### Dataset strategy decision (Phase 3)
Key fork: scale Alice to multi-user (auth, multi-tenancy, IRB) or keep monastic and let the ghost framework propagate through other instruments. The irreversible data moat argument (Papers A+G) holds either way, but the path determines what gets built next.

### Difficulty-residual correlation (data accumulating)
Difficulty classification began at session 54. Once enough generated questions have reconstruction residuals, the correlation between difficulty and motor residual is testable.

### Condrey attack (from paper Section 10.3)
Transcription protocol: same user transcribes LLM-generated text under the journaling interface. Direct test of whether the instrument detects content-process binding.

### TE dominance stability (monitoring)
CV = 3.08 at 20 sessions. Not yet stable. More sessions needed.

## Architecture reference

```
src/lib/libReconstruction.ts           -- orchestrates all 5 variants per session
src/lib/libSignalsNative.ts            -- napi boundary (all Rust FFI calls)
src/lib/libSignalPipeline.ts           -- orchestrates all derived signals per session
src/lib/libIntegrity.ts                -- profile distance computation (uses Rust)
src/lib/libCouplingStability.ts        -- rolling-window coupling stability (uses Rust)
src/lib/libProfile.ts                  -- rolling behavioral profile (variant inputs + R-burst calibration)
src/lib/libDb.ts                       -- all database functions (variant-aware residuals)
src/lib/libGenerate.ts                 -- question generation with difficulty logging
src-rs/src/avatar.rs                   -- AdversaryVariant enum, Markov + PPM text, baseline + conditional + copula timing, revision calibration
src-rs/src/stats.rs                    -- Rust stats (pearson, z-scores, linreg, batch correlations)
src-rs/src/lib.rs                      -- napi boundary
src-rs/src/dynamical.rs                -- PE, DFA, RQA, transfer entropy
src-rs/src/motor.rs                    -- sample entropy, ex-Gaussian, motor jerk, hold_flight_rank_corr
src-rs/src/process.rs                  -- text reconstruction, pause/burst analysis, R-burst detail
db/sql/dbAlice_Tables.sql              -- complete schema (synced through migration 010)
db/sql/migrations/010                  -- te_adversary_variants, variant column, profile extensions
src/pages/api/instrument-status.ts     -- per-variant convergence data for research page
papers/option_b_compressed.md          -- Compressed Option B for Science (Phase 1, DONE)
papers/option_f_draft.md               -- Reconstruction Validity paper (v5, Phase 2, DONE)
GHOST.md                               -- ghost system documentation (multi-adversary, R-burst calibration)
../reconstruction-validity/            -- standalone crate (Phase 4, DONE, awaiting publish)
```

## Key design decisions

- **Five variants, not one.** A single ghost invites the objection that the generator is weak. Five variants, each targeting a specific limitation, close that objection empirically.
- **Measurement-bounded reconstruction.** No neural models. The ghost can only use what the instrument measures. The ceiling of statistical reconstruction IS the point.
- **R-burst duration budget, not single sample.** Episode timing split across phases preserves the temporal signature the dynamical signals detect.
- **Consolidation via log-linear interpolation.** Multiplicative ratios require log-space interpolation to preserve the mean.
- **Distributions vs sequences.** The motor residual falsification reveals that distributional equivalence is not behavioral equivalence. Condrey attacked distributions. The instrument measures sequences. The distinction is where the cognitive signal lives.
- **Integrity before profile update.** Session integrity runs before `updateProfile()` to compare against the prior profile state.
- **Single source of truth.** Rust is the only signal implementation. No TS fallback. If Rust is unavailable, the measurement does not happen.
- **Ghost extraction is additive.** The standalone crate publishes the paradigm. Alice keeps its avatar.rs unchanged. Phase 5 migration is optional.

## Test results

- **Alice Rust**: 136 tests pass, zero clippy warnings
- **Alice TypeScript**: no new type errors in changed files
- **Alice Pipeline**: all 5 variants producing correct residuals for new sessions
- **reconstruction-validity crate**: 50 tests pass (49 unit + 1 doc-test), zero clippy warnings, example runs clean
