# Handoff: Avatar Engine Audit + Calibration (2026-04-20, Sessions 1-2)

## What happened this session

Full engineering audit of the Avatar Markov chain engine (`src-rs/src/avatar.rs`), followed by market research, implementation of seven fixes, CLAUDE.md compliance pass, frontend integration, and paper/research page updates. Continued in GHOST_HANDOFF.md (sessions 3-8) which built the full reconstruction residual pipeline, session integrity, coupling stability, and brought the instrument to self-validation.

## Part 1: Audit Findings

### Critical flaws (fixed)

| Flaw | Impact | Fix |
|------|--------|-----|
| PRNG `f64()` could return exactly 1.0 | Violated `[0, 1)` contract, biased `weighted_pick` | Divisor changed from `(u32::MAX >> 1)` to `(1u64 << 31)` |
| `word_difficulty_multiplier` formula inverted | Common words got 2.6x multiplier (should be ~0.7x), rare words got ~1.0x (should be ~1.8x). Every avatar session had backwards content-process coupling | Rewrote with log-frequency scaling (Inhoff & Rayner 1986) |
| Laplace smoothing in perplexity | Worst-in-class for small corpora (Chen & Goodman 1999). Systematically inflated convergence metric | Replaced with Absolute Discounting: d = n1/(n1 + 2*n2), unigram backoff |
| Zero tests | Only module in the crate without `#[cfg(test)]`. Violated crate's own mandate | 39 tests added covering every subsystem |
| No `SignalResult`/`SignalError` | Only module not using the crate's error system. Silent failures returned empty defaults | `compute()` and `compute_text_perplexity()` now return `SignalResult<T>` with `InsufficientData` variants |

### Significant flaws (fixed)

| Flaw | Fix |
|------|-----|
| Hard order-2/order-1 fallback | Witten-Bell interpolated backoff: lambda = T(h) / (T(h) + C(h)) blends both orders probabilistically |
| R-burst retype identical to deleted text | Large deletions now generate variant text from Markov chain (genuine reformulation) |
| I-burst timing flat (no tempo drift or word difficulty) | Inserted text now carries tempo drift and word difficulty coupling, matching forward production |
| `rng_jitter()` dead function returning constant 0.3 | Deleted. Unseen-word jitter is now stochastic via `rng.f64()` |
| Stale `#[allow(dead_code)]` on `r_burst_ratio` | Removed. Field is actively used by I-burst synthesis |
| Missing citations on PRNG/statistical functions | Added: SplitMix64 (Steele, Lea & Flood 2014), xoshiro128+ (Blackman & Vigna 2018), Box-Muller (Box & Muller 1958), ex-Gaussian (Lacouture & Cousineau 2008) |
| No `mul_add` in numerical code | Box-Muller `mu + sigma * z` changed to `sigma.mul_add(z, mu)` per crate convention |

## Part 2: Market Research

Surveyed state of the art in non-LLM text generation for behavioral reconstruction. Key findings applied:

- **Smoothing**: Absolute Discounting (Chen & Goodman 1999) over Laplace. Optimal single-discount estimator for small corpora.
- **Backoff**: Witten-Bell interpolation (Jelinek & Mercer 1980) over hard fallback. Context-sensitive blending.
- **Word difficulty**: Log-frequency scaling (Inhoff & Rayner 1986). Psycholinguistic standard for word retrieval latency.
- **PRNG**: xoshiro128+ is fine for upper-bit float conversion. Low-bit artifacts only affect modular arithmetic (not used).
- **Reconstruction validity**: KS test, Jensen-Shannon divergence, MMD per signal family for future adversarial validation (Hamaker, Dolan & Molenaar 2005).

## Part 3: Frontend Integration

### I-burst counter was permanently zero
The frontend defined `sigIbursts` but never incremented it. I-bursts can't be detected from the flat keystroke stream because position information is lost after Rust splices them.

**Fix**: Added `i_burst_count` field to `AvatarResult` (Rust) -> `AvatarOutput` (napi) -> API response -> frontend. The count comes from Rust, which knows exactly how many it injected.

### API empty-result guard
Added check for empty `result.text` after Rust call, returning a proper error response when `SignalResult` returns `InsufficientData` and napi converts to `AvatarOutput::default()`.

## Part 4: Paper F Updated to v2

`papers/option_f_draft.md` bumped from v1 to v2. Sections rewritten:

| Section | v1 | v2 |
|---------|----|----|
| 4.2 Text generation | Hard fallback, no smoothing spec | Witten-Bell interpolated backoff, Absolute Discounting perplexity |
| 4.2 Timing synthesis | 6-item priority list, forward-only | Seven named dimensions: forward timing, tempo drift, content-process coupling, evaluation pauses, revision synthesis, I-burst synthesis, PRNG citations |
| 4.3 Validation loop | "minus deletions and cursor movements" | Signal-pipeline-compatible `{c, d, u}` stream including backspaces and insertions |
| 6.3 Predictions | "Process signals will show large distance regardless of corpus size" | "Process signal partial convergence" since reconstruction now attempts revision |
| 9 Limitations | "Reconstruction omits revision" (false) | "Revision synthesis is statistical, not cognitive" (true) |
| 10.1-10.2 Research program | "Implement perplexity" (future) | "Perplexity implemented with Absolute Discounting" (done) |
| References | 22 references | 27 references (+Box & Muller, Chen & Goodman, Inhoff & Rayner, Jelinek & Mercer, Steele/Lea/Flood) |

## Part 5: Research Page Updated

### New section: "The instrument can validate itself"
Added between "Validity requirements" and "Theoretical extensions" in both nav and content.

Contents:
- **Canvas visualization**: Horizontal fidelity bar chart showing projected reconstruction fidelity per signal family (motor 93%, pause 84%, temporal 55%, revision 45%, semantic 4%). Filled bars in accent color, residual gaps visible, bracket labeling "the residual."
- **Callout**: "Where the reconstruction matches reality, the instrument captures that dimension. Where it diverges, it does not. The gap is not noise. It is diagnostic."
- **Three residual cards**: Motor (expected small), content (expected decreasing), cognitive (expected persistent, highlighted). The cognitive residual IS the finding.
- **Condrey response**: The reconstruction is timing-perfect but meaning-absent. If the full signal set distinguishes it from real sessions, content-process binding is in the measurements.
- Caption explicitly notes schematic projections, not measured values.

### Validation open question updated
Previously: "The validation must come from the data, not precede it."
Now: Acknowledges reconstruction validity as complementary pathway computable from n=1 today, while preserving honest statement that external-criterion validation still requires longitudinal outcome data.

### Sources updated
From "two preprints" to "three papers." Paper F (Reconstruction Validity) added with full title. Key citations list updated with Chen & Goodman, Inhoff & Rayner, Jelinek & Mercer.

## Part 6: Documentation Updated

### AVATAR.md
Updated all sections affected by engine changes: forward production (interpolated backoff), motor timing (ex-Gaussian citation), content-process coupling (log-frequency formula), R-bursts (variant text), I-bursts (timing coupling), napi boundary (SignalResult), development guidelines (SignalResult requirement, citation requirement, PRNG invariant, test count).

## Files modified this session

| File | Change |
|------|--------|
| `src-rs/src/avatar.rs` | 7 bug fixes, Absolute Discounting, interpolated backoff, R-burst reformulation, I-burst timing coupling, `SignalResult`, citations, `mul_add`, `i_burst_count`, 39 tests (1041 -> ~1650 lines) |
| `src-rs/src/lib.rs` | `SignalResult` handling at napi boundary, `i_burst_count` field on `AvatarOutput` |
| `src/pages/api/avatar.ts` | Returns `iBurstCount`, empty-result guard for `SignalError` |
| `src/pages/avatar.astro` | I-burst counter initialized from API, displayed in signal update loop |
| `src/pages/research.astro` | New "Reconstruction validity" section with canvas viz + residual cards, updated validation open question, paper F in sources |
| `papers/option_f_draft.md` | v1 -> v2: sections 4.2, 4.3, 6.3, 9, 10.1, 10.2 rewritten, 5 references added |
| `avatar.md` | All seven sections updated for engine changes |

## Test results

- **Rust**: 107 tests pass (39 new in avatar module), zero clippy warnings
- **Astro**: Build succeeds

## What's next

All three items below were completed in sessions 3-8. See `GHOST_HANDOFF.md` for the full accounting.

### ~~Engineering priority: Close the adversarial validation loop~~ DONE
Reconstruction residual pipeline built, 22 reconstructions computed across 56 sessions. Motor L2 = 89.3 (mean), dynamical L2 < 1.3, semantic L2 < 0.35. Motor prediction falsified; falsification is the strongest finding.

### ~~Engineering: Perplexity tracking~~ DONE
Perplexity computed per session. Real 21.3 vs ghost 78.5 (mean). Person is more internally consistent than the Markov model predicts. Ratio ~3x.

### Research: Condrey attack experiment
Design transcription protocol. Run authentic + transcribed sessions through full pipeline. Test whether process signals distinguish composition from transcription. **Still open.** The reconstruction residual provides the measurement; the Condrey attack provides the adversary.
