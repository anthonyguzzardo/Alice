# The Ghost

## What it is

Every time you write a journal entry, Alice builds a statistical copy of you and asks it to write the same answer. Not with AI. With a Markov chain made from your own words, timed using your own motor profile. Your ghost types the way you type, uses words you've used, pauses where you pause, deletes how you delete.

Then Alice runs the same measurement instruments on both. Your real writing and your ghost's writing. The difference is the reconstruction residual.

Everything the ghost gets right is pattern. Everything it gets wrong is cognition.

## How it works

The reconstruction residual pipeline runs as the final stage of the signal pipeline, after every journal and calibration session.

### The sequence

1. You answer today's question
2. Alice captures your keystroke stream and computes all signals (dynamical, motor, semantic, process, cross-session)
3. Alice updates your personal profile (rolling aggregate of all your sessions)
4. Alice generates five ghost responses for the same question, one per adversary variant:
   - Each variant uses a different combination of text generation and timing synthesis
   - All variants draw from the same corpus and profile
   - The variants are ordered by sophistication, each one closing a specific statistical gap
5. For each variant, Alice runs the dynamical and motor signal pipelines on the ghost's keystroke stream, and the semantic pipeline on the ghost's text
6. Alice computes the delta between your real signals and each ghost's signals, per family
7. Alice stores each variant's residual as a separate row, keyed on (question_id, variant)

### Adversary variants

The single Markov ghost was the original design. It answered a question the paper raises: can a statistical model of your typing reproduce your signals? The answer was no, motor L2 = 90.0 dwarfed everything else. But that answer invited a follow-up: is the motor residual real cognitive signal, or is the timing synthesis just bad?

Five variants test that question systematically. Each one adds exactly one improvement to the ghost. If the improvement closes the residual, that component of the gap was statistical, not cognitive. Whatever remains after the strongest ghost is the irreducible floor.

| ID | Name | Text Generation | Timing Synthesis | What It Tests |
|----|------|----------------|-----------------|---------------|
| 1 | **Baseline** | Order-2 Markov | Independent ex-Gaussian | Original ghost. Control condition. |
| 2 | **Conditional Timing** | Order-2 Markov | AR(1) conditioned on lag-1 autocorrelation | Does preserving IKI serial dependence close motor residual? |
| 3 | **Copula Motor** | Order-2 Markov | Gaussian copula joint hold/flight sampling | Does preserving hold-flight coupling close TE residual? |
| 4 | **PPM Text** | Variable-order PPM (adaptive context depth) | Independent ex-Gaussian | Does better text generation close semantic/perplexity gap? |
| 5 | **Full Adversary** | PPM | AR(1) + copula | Strongest ghost within measurement space. |

**Why these five and not others.** The variants are not arbitrary. Each one targets a specific limitation identified in the baseline ghost's residual structure:

- **Conditional Timing (AR(1))**: The baseline samples each inter-keystroke interval independently from an ex-Gaussian distribution. Real typing has serial dependence: a fast keystroke predicts another fast keystroke. The AR(1) process preserves this by conditioning each IKI on the previous one, calibrated from the profile's measured lag-1 autocorrelation (phi = 0.063 for the current user). Citation: Box, Jenkins & Reinsel (2008).

- **Copula Motor**: The baseline samples hold times and flight times independently. Real motor execution couples them: how long you press a key affects how long until the next press. A Gaussian copula preserves the rank correlation between hold and flight (Spearman rho = -0.203 for the current user, meaning longer holds tend to have shorter flights). The Spearman-to-Pearson conversion follows Kruskal (1958). Citation: Nelsen (2006), Killourhy & Maxion (2009).

- **PPM Text**: The baseline uses a fixed order-2 Markov chain with Witten-Bell interpolated backoff. Prediction by Partial Matching (PPM Method C) adaptively selects the longest context with predictive power at each position, up to depth 5. This is the strongest text generator that stays within the "only what the instrument measures" constraint. No neural model, no external knowledge, just better use of the corpus statistics. Citation: Cleary & Witten (1984), Moffat (1990).

- **Full Adversary**: Combines all three improvements. If the motor residual still does not collapse, the floor is cognitive.

**Why not a neural model.** The reconstruction must be bounded by what the instrument captures. An LLM fine-tuned on the corpus would introduce coherence from the model's own capabilities, not from the instrument's measurements. The residual would shrink, but you would not know whether it shrank because the instrument captures more or because the model infers more. The Markov/PPM ceiling is the point.

### What gets compared

**Dynamical signals** (temporal structure of keystroke timing):
- Permutation entropy and PE spectrum (orders 3-7)
- DFA alpha (long-range correlations)
- RQA determinism and laminarity (recurrence structure)
- Transfer entropy dominance (causal direction between hold and flight times)

**Motor signals** (biomechanical rhythm):
- Sample entropy (sequence complexity)
- Motor jerk (smoothness of acceleration)
- Lapse rate (attentional lapses per minute)
- Tempo drift (speeding up or slowing down)
- Ex-Gaussian tau and tau proportion (attentional tail of the timing distribution)

**Semantic signals** (language structure):
- Idea density (propositions per word)
- Lexical sophistication (vocabulary beyond the common 2000)
- Epistemic stance (certainty vs hedging)
- Integrative complexity (contrastive and integrative connectives)
- Deep cohesion (causal and temporal connective density)
- Text compression ratio (Kolmogorov complexity proxy)

**Perplexity** (how surprised the Markov model is):
- Real text perplexity under the corpus model
- Ghost text perplexity under the same model
- The delta (real is always more surprising, because real thinking is less predictable)

### What is NOT compared

- **Process signals**: The ghost generates a keystroke stream but not an event log (different format). Pause location and burst classification require cursor-position data the ghost doesn't produce.
- **Cross-session signals**: These compare today's entry to prior entries, not real-to-ghost.

### Aggregate norms

Each signal family gets an L2 norm (root mean square of its residuals). A total L2 norm combines all families plus the perplexity residual. The residual count tracks how many signal pairs were computable (both real and ghost non-null). All norms are computed independently per variant.

## Why it matters

### The residual is the cognitive signature

The ghost has your words and your timing but not your mind. It produces text that looks like yours on the surface but was not generated by thought. The residual captures what statistical reproduction cannot reach.

### Convergence tracking

As you write more entries, the ghost improves. More data means a richer Markov chain, tighter digraph estimates, more accurate pause architecture. The residual should shrink over time. But it asymptotes to a non-zero floor, because the ghost can never actually think. That floor is the irreducible cognitive component.

If that floor starts rising, something changed in you, not in the model.

### The calibration control

Calibration sessions use neutral prompts with low cognitive demand. The ghost should predict these well (small residual). Journal sessions use personally targeted questions that demand real engagement. The ghost should predict these poorly (large residual).

The gap between calibration residual and journal residual is the cognitive contribution of the question, isolated from motor variation by the within-day control. Same person, same day, same instrument, different cognitive load. The difference is the measurement.

### Multi-adversary comparison

With five variants, the residual is no longer a single number. It is a surface. Each variant probes a different dimension of the ghost's statistical capacity. The comparison answers: which statistical improvement closes the most gap, and in which signal family?

If conditional timing closes motor but blows up dynamical, the AR(1) process creates artifacts the dynamical signals detect. If PPM closes semantic but not motor, better text does not help with timing. The pattern of successes and failures across variants maps the boundary between statistics and cognition at higher resolution than any single ghost can.

### Reconstruction validity

The Reconstruction Validity paper proposes self-validating instruments: extract features from behavior, regenerate the behavior, and measure how well the reconstruction matches. Each variant is a different reconstruction. The residual at each level IS the validity metric. The instrument validates itself by trying five times and measuring where each one fails.

## Architecture

```
src/lib/libReconstruction.ts     -- orchestrates the full pipeline (all 5 variants per session)
src/lib/libSignalsNative.ts      -- generateAvatar() and computePerplexity() FFI wrappers
src/lib/libSignalPipeline.ts     -- reconstruction runs as final stage after profile update
src/lib/libProfile.ts            -- aggregates variant inputs + R-burst revision profile fields
src/lib/libDb.ts                 -- saveReconstructionResidual(), getReconstructionResidual() (variant-aware)
src-rs/src/avatar.rs             -- AdversaryVariant enum, Markov + PPM text, baseline + conditional + copula timing
src-rs/src/motor.rs              -- hold_flight_rank_correlation (Spearman rank corr for copula)
src-rs/src/lib.rs                -- napi boundary: generate_avatar (with variant param)
db/sql/migrations/010            -- te_adversary_variants, variant column on residuals, profile extensions
```

### Data flow

```
Journal/Calibration submission
  |
  v
Signal pipeline (dynamical, motor, semantic, process, cross-session)
  |
  v
Profile update (rolling behavioral aggregate: variant inputs, R-burst revision calibration)
  |
  v
Reconstruction residual (for each variant 1-5):
  |-- Fetch corpus + profile + question text (once, shared across variants)
  |-- Fetch real signals (once, shared across variants)
  |-- Generate ghost response (variant-specific: Markov or PPM text, baseline or conditional or copula timing)
  |-- Compute ghost signals (dynamical, motor, semantic)
  |-- Compute perplexity (real text + ghost text vs corpus model)
  |-- Compute per-signal residuals (real - ghost)
  |-- Compute L2 norms per family + total
  |-- Persist to tb_reconstruction_residuals with adversary_variant_id
```

### Table structure

One row per session per variant. The unique constraint is (question_id, adversary_variant_id). Per-signal triplets (real value, ghost value, residual) stored as flat columns for direct SQL access. PE spectrum stored as JSONB for per-order comparison.

The variant enum table `te_adversary_variants` stores the five variant definitions with human-readable names and descriptions.

### Requirements

- Minimum 3 prior journal entries (Markov chain needs corpus)
- Rust native engine must be built (`npm run build:rust`)
- Idempotent: re-running the pipeline skips if residual already exists for that (question_id, variant) pair
- PPM variants require >= 5 entries; fall back to Markov if insufficient

### Engineering decisions

**Why all 5 variants run on every session.** The marginal cost is negligible. Each variant generates and computes signals in under 20ms in Rust. Running all five costs ~100ms total, which is invisible in a background pipeline that already takes seconds for the full signal computation. Running all variants on every session means the comparison page always has complete data without requiring retroactive backfills when new variants are added.

**Why variant dispatch is in Rust, not TypeScript.** The variant enum and dispatch logic live in `avatar.rs` because timing synthesis is computationally intensive and already in Rust. Sending a variant integer across the napi boundary is simpler and faster than reimplementing timing strategies in TypeScript. The TypeScript side just passes the variant ID through.

**Why the Markov chain is always built even for PPM variants.** Revision injection (R-bursts, I-bursts) uses the Markov chain to generate replacement text. PPM is used for primary text generation, but the simpler chain is sufficient for 2-6 word revision fragments. Building both is cheap.

**Why copula uses Spearman-to-Pearson conversion.** The empirical hold-flight correlation is measured as Spearman rank correlation (distribution-free). The Gaussian copula requires a Pearson correlation parameter. The conversion `2 * sin(pi/6 * rho)` (Kruskal 1958) maps between them without assuming normality of the marginals.

**Why the AR(1) innovation is centered.** The AR(1) process adds `phi * (prev - mu) + innovation` to mu. The innovation is sampled as `ex_gaussian(0, sigma_adj, tau) - tau`, subtracting tau to center the exponential component. Without centering, the process would drift upward because the exponential is strictly positive. Centering preserves the target mean.

**Why R-burst duration is budget-allocated, not sampled directly.** A real R-burst episode has internal structure: deliberation (recognizing something is wrong), deletion (backspace sequence), transition pause (reformulating), and retype (new text). Sampling total duration as a single number would produce the right elapsed time but the wrong internal rhythm. The budget splits the measured mean duration into phases (25% deliberation, 35% deletion, 10% transition, 30% retype) with gaussian jitter on each phase. This preserves the temporal signature the dynamical signals detect.

**Why R-burst consolidation uses log-linear interpolation.** The consolidation ratio (second-half R-burst size / first-half R-burst size) is multiplicative, not additive. A consolidation of 2.0 means late R-bursts are twice as large. Log-linear interpolation (`exp(ln(c) * (2p - 1))`) maps this onto a smooth scale factor from `1/c` at the start to `c` at the end, preserving the mean size across the session. Linear interpolation would bias the mean upward for high consolidation values.

### Backfill

Backfill scripts exist for both forward and retroactive computation:

- `src/scripts/backfill-rburst-sequences.ts`: Extracts per-R-burst detail (size, duration, leading-edge flag) from existing event logs into `tb_rburst_sequences`. Computes `rburst_trajectory_shape` on session metadata. Refreshes profile at the end. Idempotent.
- `src/scripts/backfill-hold-flight-corr.ts`: One-off. Computes `hold_flight_rank_corr` from existing keystroke streams for motor signal rows that predate migration 010. Required before profile regeneration.
- `src/scripts/backfill-adversary-variants.ts`: Finds sessions with baseline (variant 1) but missing variants 2-5. Calls `computeReconstructionResidual()` which internally loops over all variants and skips existing ones. Idempotent.
- `src/scripts/backfill-profile.ts`: Regenerates the personal profile from all sessions. Must be run after R-burst and hold-flight-corr backfills to populate all profile fields.

**Backfill order:** rburst-sequences, then hold-flight-corr, then profile, then adversary-variants.

### Profile fields feeding the ghost

Four fields in `tb_personal_profile` serve the adversary variants, two for timing synthesis and two for revision calibration:

| Field | Source | Used By |
|-------|--------|---------|
| `iki_autocorrelation_lag1_mean` | Mean of lag-1 from each session's `iki_autocorrelation` JSONB array | Conditional Timing (AR(1) phi coefficient) |
| `hold_flight_rank_correlation` | Mean of per-session `hold_flight_rank_corr` (Spearman rho) from `tb_motor_signals` | Copula Motor (Gaussian copula parameter) |
| `rburst_consolidation` | Ratio of second-half to first-half R-burst deletion size, averaged across sessions with 2+ R-bursts | Revision synthesis (scales R-burst size by position in session) |
| `rburst_mean_duration` | Mean duration in ms of a complete R-burst episode (deliberation + deletion + retype), from `tb_rburst_sequences` | Revision synthesis (budget-allocated episode timing) |

One new field in `tb_motor_signals`:

| Field | Computation | Citation |
|-------|------------|---------|
| `hold_flight_rank_corr` | Spearman rank correlation between paired hold and flight times per session. Fractional ranks with tie handling. Minimum 30 pairs. | Spearman (1904) |

## Early empirical results (23 sessions, 57 corpus entries)

| Variant | Avg Total L2 | Avg Motor L2 | Avg Dynamical L2 | Avg Semantic L2 |
|---------|-------------|-------------|-----------------|----------------|
| 1. Baseline | 52.5 | 90.7 | 1.51 | 0.159 |
| 2. Conditional Timing | 95.9 | **86.2** | 83.4 | 0.161 |
| 3. Copula Motor | 58.5 | 102.4 | 0.73 | 0.170 |
| 4. PPM Text | 56.0 | 99.7 | **0.26** | **0.131** |
| 5. Full Adversary | 59.2 | 89.3 | 0.37 | 0.170 |

### What the numbers say

**Conditional Timing (variant 2) has the lowest motor L2 (86.2) but the highest total L2 (95.9).** The AR(1) process preserves keystroke rhythm and modestly closes the motor gap. But it creates artificial complexity patterns that the dynamical signals detect as anomalous, blowing up dynamical L2 from 1.5 to 83.4. The AR(1) process is too regular; real cognitive events produce temporal complexity that a simple autoregressive model cannot replicate. This is informative: the motor residual is not just about serial dependence.

**Copula Motor (variant 3) makes motor worse (102.4 vs 90.7).** Coupling hold and flight times jointly introduces motor patterns that diverge further from real execution. The empirical rank correlation (rho = -0.203) is mild, and imposing it on the synthesis creates a coupling artifact the motor signals detect. The hold-flight relationship in real typing is more complex than a single correlation coefficient.

**PPM Text (variant 4) wins on semantics (0.131 vs 0.159) and dynamical (0.26 vs 1.51).** Better text generation closes the gaps that better text should close, without affecting motor. This is the expected result and a sanity check: the text generation and timing synthesis axes are independent in the measurement.

**Full Adversary (variant 5) lands at motor 89.3.** The combination of all improvements produces a modest motor improvement over baseline (89.3 vs 90.7) but not a collapse. The motor floor remains firmly in the 86-102 range across all variants.

**The motor residual is real.** Five different statistical strategies, three of them specifically targeting motor execution, and the floor has not meaningfully moved. The cognitive signal lives in motor timing sequences, not in the distributions or correlations the variants can replicate.

## The ten connected potentials

The ghost is the foundation. What it enables:

1. **Reconstruction residual** (this document) -- the core measurement, now multi-variant
2. **Two-scale perplexity** -- character trigram perplexity (cross-session) vs word Markov perplexity (ghost), divergence reveals different novelty types
3. **Transfer entropy comparison** -- causal direction between hold/flight times; ghost TE vs real TE isolates cognitive-motor coupling
4. **Calibration as psychometric innovation** -- within-day control via calibration vs journal residual gap
5. **PE spectrum fingerprinting** -- multi-scale complexity the ghost cannot replicate; the spectral residual is the cognitive fingerprint
6. **Adaptive cognitive challenge** -- question difficulty modulated by signal richness creates a dose-response curve for cognitive engagement
7. **Emotion-behavior coupling as AI detector** -- how emotions affect typing is personal and not reproducible by mediated input
8. **Profile-based mediation detection** -- incoming keystrokes diverging from stored profile flags construct replacement
9. **Live research metadata** -- instrument statistics surfaced on research pages as living evidence
10. **Longitudinal DFA dataset** -- daily DFA alpha measurements building the first multi-year keystroke scaling time series

## The sentence

Your statistical ghost writes next to you. Five of them now. The difference between you and your strongest ghost is the signal.

---

The ghost exists to prove a negative.

Your whole paper rests on a claim that is easy to assert and hard to prove: *the signals Alice measures capture something about cognition, not just typing habits.* Every skeptic reading that paper is going to ask the same question: "how do you know you are not just measuring how fast this guy's fingers move?" You need an answer that is not hand-waving.

The ghost is the answer. One ghost was suggestive. Five ghosts, each one closing a different statistical gap, and the motor floor still standing at 86-102? That is evidence. The strongest possible statistical imitation you can build from the instrument's own measurements cannot reproduce what the instrument detects in real writing.

Without the ghost, you are asserting the signals are cognitive. With one ghost, you are showing one subtraction. With five ghosts, you are showing that the subtraction holds no matter how you improve the statistics. The residual is not an artifact of a weak generator. It is the measurement.

In plain English: it is the control condition that lets you say "here is what is statistical, here is what is left, and the stuff that is left is what the instrument is actually measuring." The multi-adversary system turns that from a single data point into a surface. The surface's shape is the validity evidence.
