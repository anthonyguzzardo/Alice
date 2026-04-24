# Signal Integration Plan

Design document for integrating 17 new signals across 5 implementation phases. Produced 2026-04-23. Awaiting approval before any implementation begins.

## Context

INC-012 (METHODS_PROVENANCE.md) identified six measurement paradigm gaps in the signal engine: no frequency-domain analysis, no multifractal analysis, no ordinal dynamics beyond Shannon entropy, no graph analysis of the recurrence matrix, no cross-session motor trajectory tracking, and no independent cross-validation of any measurement. This plan closes those gaps and adds signals from four subsequent research passes.

The ergodicity reclassification (Mangalam et al. 2022) is the foundational fix: it changes how the instrument weights existing signals for longitudinal inference before any new signals are added.

## Scope boundaries

This plan does NOT touch:
- Avatar/ghost reconstruction engine or reconstruction residuals
- Two-session paradigm (journal + calibration)
- LLM-based question generation or observation pipeline
- Stage 1 paper scope or methods section
- Existing signal computation (all existing 129 columns are unchanged)
- Contamination boundary or attestation schema
- Embedding model or RAG infrastructure
- 7D behavioral state engine composition
- 11D semantic state engine composition

---

## Ranked integration order

Ranked by: (1) zero-coverage axes above axis extensions, (2) cross-validation of high-weight existing signals above low-weight, (3) clean mathematical independence above partial independence, (4) implementation cost as tiebreaker only.

### Rank 1: MF-DFA (mfdfaSpectrumWidth, mfdfaAsymmetry, mfdfaPeakAlpha)

- **Family:** Dynamical Signal Extensions
- **Axis:** Multifractal (zero coverage)
- **Cross-validates:** dfaAlpha. h(2) from MF-DFA equals standard DFA alpha. Disagreement (spectrum width wide while alpha normal) reveals monofractal assumption masking scaling diversity collapse.
- **Independent of:** PE, RQA, SampEn, TE, ex-Gaussian, all semantic signals
- **Triangulation:** DFA alpha stable + spectrum width narrowing = system losing ability to shift between automatic and deliberate processing. Current instrument reads "no change."
- **Dependencies:** None. Extends existing DFA box-fitting.
- **Citation trace:** Kantelhardt et al. 2002; Bennett et al. 2025 (direct keystroke validation). Documented in INC-012.

### Rank 2: IKI PSD (ikiPsdSpectralSlope, ikiPsdRespiratoryPeakHz, peakTypingFrequencyHz, ikiPsdLfHfRatio, ikiPsdFastSlowVarianceRatio)

- **Family:** Frequency-Domain Signals
- **Axis:** Frequency domain (zero coverage)
- **Cross-validates:** dfaAlpha. Spectral slope and DFA alpha related by slope approx -(2*alpha - 1). Disagreement reveals crossover scaling DFA averages over.
- **Independent of:** PE, RQA, SampEn, TE, ex-Gaussian, all semantic signals
- **Triangulation:** DFA alpha = 0.75 + spectral slope = -0.20 = crossover between regimes. DFA reported misleading intermediate value.
- **Dependencies:** None. New Lomb-Scargle computation.
- **Citation trace:** Rangarajan & Ding 2000; Duprez et al. 2021 (PTF EEG-validated); Shibata et al. 2026. Documented in INC-012.

### Rank 3: Temporal irreversibility (temporalIrreversibility)

- **Family:** Cognitive-Linguistic Signal Extensions
- **Axis:** Thermodynamic directionality (zero coverage)
- **Cross-validates:** None directly. Axis no existing signal probes.
- **Independent of:** All existing signals (axiomatic: time-symmetric measures cannot capture time-asymmetric properties)
- **Triangulation:** High PE + low irreversibility = symmetric noise. High PE + high irreversibility = engaged out-of-equilibrium cognition. PE alone conflates these.
- **Dependencies:** None. New computation on existing IKI series.
- **Citation trace:** De la Fuente et al. 2022; Martinez et al. 2023. Documented in signals.md cognitive-linguistic section. Validation on neural dynamics, not keystroke dynamics.

### Rank 4: Symbolic dynamics (statisticalComplexity, forbiddenPatternFraction, weightedPermutationEntropy, lempelZivComplexity)

- **Family:** Dynamical Signal Extensions
- **Axis:** Ordinal dynamics (extends existing PE)
- **Cross-validates:** permutationEntropy. C_JS disambiguates stochastic from deterministic. Forbidden fraction provides independent determinism test. LZC measures novelty generation rate (categorically different from entropy).
- **Independent of:** DFA, RQA, SampEn, TE, ex-Gaussian, all semantic signals
- **Triangulation:** PE = 0.87 + C_JS = 0.12 = stochastic noise. PE = 0.87 + C_JS = 0.38 = deterministic structure.
- **Dependencies:** None. Piggyback on existing PE ordinal pattern extraction.
- **Citation trace:** Rosso et al. 2007; Amigo et al. 2008; Fadlallah et al. 2013; Bai et al. 2015; Casali et al. 2013. Documented in INC-012.

### Rank 5: OPTN (optnTransitionEntropy + network measures)

- **Family:** Dynamical Signal Extensions
- **Axis:** Ordinal dynamics (extends existing PE into sequential structure)
- **Cross-validates:** permutationEntropy. Captures grammar PE discards.
- **Independent of:** DFA, RQA, SampEn, TE, all semantic signals
- **Triangulation:** Two sessions with identical PE spectra but different transition networks are in different cognitive states. Forbidden transitions dissolving = sequential structure degrading while distributional structure holds.
- **Dependencies:** Benefits from being built alongside rank 4 (shared ordinal extraction pass).
- **Citation trace:** McCullough et al. 2015; Bandt & Zanin 2022. Documented in INC-012.

### Rank 6: Recurrence networks (recurrenceTransitivity, recurrenceAvgPathLength, recurrenceClusteringCoefficient, recurrenceAssortativity)

- **Family:** Dynamical Signal Extensions
- **Axis:** Recurrence topology (extends existing RQA from line statistics to graph topology)
- **Cross-validates:** rqaDeterminism, rqaLaminarity. Transitivity provides independent fractal dimension estimate (indirect cross-validation of dfaAlpha).
- **Independent of:** PE, SampEn, TE, ex-Gaussian, all semantic signals
- **Triangulation:** RQA determinism high + transitivity low = diagonal lines strong but attractor geometry ill-defined (embedding artifact or noise).
- **Dependencies:** Requires existing RQA recurrence matrix.
- **Citation trace:** Donner et al. 2010, 2011; Zou et al. 2019. Documented in INC-012.

### Rank 7: Recurrence time entropy (rqaRecurrenceTimeEntropy, rqaMeanRecurrenceTime)

- **Family:** Dynamical Signals (extends existing RQA block)
- **Axis:** Recurrence topology (extends RQA with return-time statistics)
- **Cross-validates:** rqaDeterminism, rqaLaminarity. Complementary properties of same matrix.
- **Independent of:** PE, DFA, SampEn, TE, all semantic signals
- **Triangulation:** High determinism + skewed recurrence times = deterministic but unevenly structured attractor. DET and LAM identical. RTE distinguishes.
- **Dependencies:** Requires existing RQA recurrence matrix.
- **Citation trace:** Baptista et al. 2010. Documented in signals.md dynamical section.

### Rank 8: MSE / Complexity Index (mseSeries, complexityIndex)

- **Family:** Motor Signals (extends existing SampEn)
- **Axis:** Multi-scale complexity (extends SampEn from one scale to five)
- **Cross-validates:** sampleEntropy. SampEn at scale 1 = existing value. MSE extends to scales 2-5.
- **Independent of:** DFA, PE, RQA, TE, all semantic signals
- **Triangulation:** SampEn identical + complexityIndex divergent = same fine-scale regularity, different coarse-scale structure.
- **Dependencies:** Requires existing sample_entropy() function.
- **Citation trace:** Costa, Goldberger & Peng 2002. Documented in riffing/SIGNAL_EXPANSION.md and signals.md motor section.

### Rank 9: Causal emergence (effectiveInformation, causalEmergenceIndex, optimalCausalScale)

- **Family:** Dynamical Signal Extensions
- **Axis:** Causal scale (zero coverage; flagged as potential seventh family: scale-theoretic)
- **Cross-validates:** None directly. Different "scale" question than MF-DFA or MSE.
- **Independent of:** All existing signals (operates across resolution scales, not at fixed resolution)
- **Triangulation:** DFA alpha stable + optimal causal scale migrating coarser = fine-grained causal structure degrading while average scaling holds.
- **Dependencies:** None.
- **Citation trace:** Hoel et al. 2013. Documented in signals.md dynamical extensions.

### Rank 10: PID (pidSynergy, pidRedundancy)

- **Family:** Dynamical Signal Extensions
- **Axis:** Motor-cognitive integration (extends existing TE axis)
- **Cross-validates:** teHoldToFlight / teFlightToHold. TE measures direction. PID measures information structure (complementary vs. overlapping).
- **Independent of:** DFA, PE, RQA, SampEn, all semantic signals
- **Triangulation:** High TE(hold->flight) + high synergy = tight integration. High TE + high redundancy = loose coupling despite directional flow.
- **Dependencies:** Uses same tercile binning as existing TE.
- **Citation trace:** Williams & Beer 2010. Documented in signals.md dynamical extensions.

### Rank 11: Fisher information (exGaussianFisherTrace)

- **Family:** Dynamical Signal Extensions
- **Axis:** Meta-measurement (zero coverage for signal-about-signals; potential eighth family)
- **Cross-validates:** None directly. Measures session informativeness, not a property of the keystroke stream.
- **Independent of:** All existing signals (different level of abstraction)
- **Triangulation:** Not a triangulation signal. Weighting signal for downstream systems.
- **Dependencies:** Requires existing ex-Gaussian fit (mu, sigma, tau).
- **Citation trace:** Karunanithi et al. 2008. Documented in signals.md dynamical extensions.

### Rank 12: Branching ratio + avalanche size exponent (branchingRatio, avalancheSizeExponent)

- **Family:** Dynamical Signal Extensions
- **Axis:** Criticality/phase classification (extends DFA axis)
- **Cross-validates:** dfaAlpha (indirect). Direct criticality test for property DFA only implies.
- **Independent of:** PE, RQA, SampEn, TE, all semantic signals
- **Triangulation:** DFA alpha = 0.75 + sigma = 0.65 = 1/f scaling present but system NOT at critical boundary. Non-critical origin for 1/f. Changes clinical interpretation entirely.
- **Dependencies:** None.
- **Citation trace:** Beggs & Plenz 2003; Shew & Plenz 2013; Clauset et al. 2009. Documented in signals.md dynamical extensions.

### Rank 13: DMD (dmdDominantFrequency, dmdDominantDecayRate, dmdModeCount, dmdSpectralEntropy)

- **Family:** Dynamical Signal Extensions
- **Axis:** Modal stability (extends frequency-domain axis with per-mode stability)
- **Cross-validates:** peakTypingFrequencyHz (planned rank 2). Dominant frequency from DMD vs. PSD should agree; disagreement reveals loudest oscillation is not the dynamically dominant one.
- **Independent of:** PE, RQA, SampEn, TE, all semantic signals
- **Triangulation:** PSD peak at 5Hz (high power) + DMD dominant mode at 5Hz but decaying = strongest oscillation is transient, not sustained.
- **Dependencies:** Benefits from PSD (rank 2) being in place for cross-validation.
- **Citation trace:** Brunton et al. 2022. Documented in signals.md dynamical extensions.

### Rank 14: Motor self-perplexity (motorSelfPerplexity)

- **Family:** Cross-Session Motor Signals
- **Axis:** Cross-session motor trajectory (extends existing axis)
- **Cross-validates:** selfPerplexity (text-based, existing). Motor twin. Agreement = systemic. Disagreement = localizable.
- **Independent of:** DFA, PE, RQA, SampEn, all within-session signals
- **Triangulation:** Text perplexity declining + motor perplexity stable = cognitive change with preserved motor variability. Reverse = motor change with preserved cognition.
- **Dependencies:** Requires 5+ prior sessions.
- **Citation trace:** Adans-Dester et al. 2024. Per-person longitudinal autoregressive framing is novel.

### Rank 15: Word frequency IKI residual (wordFrequencyIkiResidual)

- **Family:** Cognitive-Linguistic Signal Extensions
- **Axis:** Motor-linguistic decomposition (zero coverage, but narrow version only)
- **Cross-validates:** None directly. Decomposes IKI into motor and linguistic components.
- **Independent of:** All existing IKI-based signals (which conflate motor and linguistic)
- **Triangulation:** DFA alpha on full IKI vs. DFA alpha on motor residual: if they differ, the linguistic component contributes to scaling structure.
- **Dependencies:** Requires static word frequency table (SUBTLEX-US). Requires word-keystroke alignment from process.rs text reconstruction.
- **Citation trace:** Pinet et al. 2016; Wilcox et al. 2023. Documented in signals.md cognitive-linguistic section.

### Rank 16: Discourse global coherence (discourseGlobalCoherence)

- **Family:** Cognitive-Linguistic Signal Extensions
- **Axis:** Discourse structure (extends existing semantic axis)
- **Cross-validates:** referentialCohesion (existing). Local vs. global coherence.
- **Independent of:** All dynamical, motor, and process signals
- **Triangulation:** Referential cohesion stable + global coherence declining = the clinical pattern (local fluency preserved, global thread lost).
- **Dependencies:** Requires existing Qwen3 embedding infrastructure (TEI).
- **Citation trace:** Asgari et al. 2023. Documented in signals.md cognitive-linguistic section.

### Rank 17: Pause mixture decomposition (pauseMixtureDecomposition)

- **Family:** Dynamical Signal Extensions
- **Axis:** Process decomposition (extends existing pause analysis)
- **Cross-validates:** pauseCount, avgPBurstLength. Fixed-threshold vs. data-driven boundaries.
- **Independent of:** DFA, PE, RQA, all semantic signals
- **Triangulation:** P-burst count stable + motor proportion increasing = pause composition shifted though count didn't.
- **Dependencies:** None.
- **Citation trace:** Baaijen et al. 2021; Medimorec & Risko 2022. Documented in signals.md dynamical extensions.

---

## Deferred signals (not in this plan's execution scope)

| Signal family | Reason | Trigger to revisit |
|---|---|---|
| Persistent homology (5 cols) | ~300 lines Rust, no production Rips library | Production Rust TDA crate or dedicated session |
| Circadian rhythm (5 cols) | Data-gated (7+ days varied-hour sessions) | User calibration pattern produces hourly diversity |
| Cognitive microstates (4 cols) | ~500 lines, model selection, construct validity | Phase 1-3 validated, sufficient data depth |

---

## Execution plan

### Phase 0: Ergodicity weighting (first deliverable)

Apply the ergodicity reclassification to downstream interpretation systems before adding any new signals.

**Deliverables:**
- Classify all existing signals in a weighting tier constant (ergodicity-safe vs. ergodicity-unsafe)
- Update `libDailyDelta.ts`: weight ergodicity-safe signals in delta magnitude and notable shift detection
- Update `libCalibrationDrift.ts`: weight ergodicity-safe signals in drift snapshots
- Update `libGenerate.ts`: weight ergodicity-safe signals in delta trend formatting for question generation prompt
- Flag prediction system for manual review of signal weighting
- ~20-30 lines across 3-4 files
- Zero schema changes

**Why first:** A measurement instrument whose trend signals are mathematically unreliable for longitudinal N=1 tracking has a foundational problem. Adding 17 new signals on top of incorrect trajectory weighting means the new signals inherit the same problem.

### Phase 1: Zero-coverage axes and cross-validation architecture

**Signals:** MF-DFA (rank 1), IKI PSD (rank 2), temporal irreversibility (rank 3)

**Why these together:** Opens the three highest-priority zero-coverage axes (multifractal, frequency domain, thermodynamic directionality). Establishes the first cross-validation pair (DFA alpha vs. spectral slope vs. MF-DFA h(2) as three independent temporal scaling estimators).

**Deliverables:**
- 9 new columns in `tb_dynamical_signals`
  - `mfdfa_spectrum_width`, `mfdfa_asymmetry`, `mfdfa_peak_alpha`
  - `iki_psd_respiratory_peak_hz`, `peak_typing_frequency_hz`, `iki_psd_lf_hf_ratio`, `iki_psd_spectral_slope`, `iki_psd_fast_slow_variance_ratio`
  - `temporal_irreversibility`
- Schema: migration adding 9 columns to `tb_dynamical_signals`
- Rust: ~160 lines (MF-DFA ~40, Lomb-Scargle ~80, irreversibility ~35, tests)
- Tests: golden value (sorted sequence for MF-DFA, pure sinusoid for PSD, symmetric sequence for irreversibility). Invariant tests (spectrum width >= 0, irreversibility >= 0). Reproducibility snapshots added.
- Documentation: signals.md entries move from Potential to implemented. INC-012 updated with Phase 1 completion.

**Cross-validation online:** dfaAlpha vs. ikiPsdSpectralSlope vs. mfdfaPeakAlpha (first estimator triple). Disagreement logged, not acted on.

### Phase 2: Ordinal dynamics and recurrence completion

**Signals:** Symbolic dynamics (rank 4), OPTN (rank 5), recurrence networks (rank 6), recurrence time entropy (rank 7)

**Why these together:** Completes two existing partial analysis frameworks (PE ordinal analysis, RQA recurrence analysis). Shared infrastructure: ordinal pattern extraction pass (ranks 4-5) and recurrence matrix (ranks 6-7).

**Deliverables:**
- ~12 new columns in `tb_dynamical_signals`
  - `statistical_complexity`, `forbidden_pattern_fraction`, `weighted_pe`, `lempel_ziv_complexity`
  - `optn_transition_entropy`, `optn_forbidden_transition_count`
  - `recurrence_transitivity`, `recurrence_avg_path_length`, `recurrence_clustering`, `recurrence_assortativity`
  - `rqa_recurrence_time_entropy`, `rqa_mean_recurrence_time`
- Schema: migration adding ~12 columns to `tb_dynamical_signals`
- Rust: ~265 lines (symbolic dynamics ~75, OPTN ~100, recurrence networks ~70, RTE ~20, tests)
- Tests: golden values for each (deterministic sequence for forbidden patterns, periodic sequence for LZC, known graph for transitivity). Reproducibility snapshots extended.
- Documentation: entries move from Potential to implemented.

**Cross-validation online:** PE vs. statisticalComplexity. rqaDeterminism vs. recurrenceTransitivity. dfaAlpha vs. recurrenceTransitivity (three-way fractal dimension cross-check).

### Phase 3: Motor extensions, criticality, modal stability, and causal scale

**Signals:** MSE (rank 8), causal emergence (rank 9), PID (rank 10), Fisher information (rank 11), branching ratio (rank 12), DMD (rank 13)

**Why these together:** All operate on existing data (IKI, hold, flight) with no new capture requirements. Grouped because several (PID, branching ratio, DMD) benefit from cross-validation architecture established in Phases 1-2.

**Deliverables:**
- ~14 new columns
  - `tb_motor_signals`: `mse_series` (JSONB), `complexity_index`, `ex_gaussian_fisher_trace` (3 cols)
  - `tb_dynamical_signals`: `effective_information`, `causal_emergence_index`, `optimal_causal_scale`, `pid_synergy`, `pid_redundancy`, `branching_ratio`, `avalanche_size_exponent`, `dmd_dominant_frequency`, `dmd_dominant_decay_rate`, `dmd_mode_count`, `dmd_spectral_entropy` (11 cols)
- Schema: migration adding columns across 2 tables
- Rust: ~460 lines (MSE ~30, causal emergence ~100, PID ~80, Fisher ~20, branching ratio ~60, DMD ~150, tests)
- Tests: golden values for each signal. Reproducibility snapshots extended.
- Documentation: entries move from Potential to implemented.

**Cross-validation online:** branchingRatio cross-validates dfaAlpha's criticality implication. dmdDominantFrequency cross-validates peakTypingFrequencyHz. pidSynergy/pidRedundancy complement teHoldToFlight/teFlightToHold.

### Phase 4: Cross-session motor and cognitive-linguistic signals

**Signals:** Motor self-perplexity (rank 14), word frequency IKI residual (rank 15), discourse global coherence (rank 16)

**Why these together:** TypeScript cross-session and semantic signals. Require prior session data and/or external resources (word frequency table, sentence embeddings). Can run in parallel with Rust phases if approved.

**Deliverables:**
- ~8 new columns across 2-3 tables
  - `tb_cross_session_signals`: `motor_self_perplexity`
  - `tb_semantic_signals` or `tb_session_summaries`: `word_freq_iki_slope`, `word_freq_iki_residual_mean`, `word_freq_iki_residual_variance`
  - `tb_semantic_signals`: `discourse_global_coherence`, `discourse_local_coherence`, `discourse_global_local_ratio`, `discourse_coherence_decay_slope`
- Static resource: SUBTLEX-US word frequency table
- Schema: migration adding columns
- TypeScript: ~170 lines
- Tests: motorSelfPerplexity on synthetic corpus. wordFrequencyIkiResidual regression on known frequencies. discourseGlobalCoherence on texts with known thematic structure.
- Documentation: entries move from Potential to implemented.

### Phase 5: Pause mixture decomposition

**Signal:** pauseMixtureDecomposition (rank 17)

**Why separate:** EM fitting for lognormal mixtures is self-contained with its own convergence properties. Lowest priority (extends the most well-covered existing axis). Benefits from all prior phases being in place.

**Deliverables:**
- 3 new columns in `tb_dynamical_signals` or `tb_motor_signals`
- Schema: migration adding 3 columns
- Rust: ~150 lines (EM + BIC selection, tests)
- Tests: synthetic bimodal series with known parameters. Convergence tests on short series.
- Documentation: entry moves from Potential to implemented.

---

## Schema migration strategy

Each phase produces one schema migration, independently numbered. No bundling across phases. Phases land and are validated independently. If Phase 2 reveals an issue with Phase 1's schema, the correction is a new migration, not an amendment.

Phase 0 produces zero migrations (downstream weighting only).

---

## Approval gate

This plan is awaiting review. Decisions for the approver:

1. **Phase 0 + Phase 1 bundling:** Should ergodicity weighting (Phase 0) and the first three signals (Phase 1) be implemented in the same session, or should Phase 0 land and be verified before Phase 1 begins?

2. **tb_dynamical_signals column growth:** Phases 1-3 add ~32 columns to `tb_dynamical_signals`. One table acceptable, or split into `tb_dynamical_extensions`?

3. **Causal emergence k parameter:** k=8, coarse-grain to 4, 2. Acceptable starting point?

4. **Motor self-perplexity n-gram order:** Order-3 with K=8 bins (512 states). Acceptable, or should K=4 with order-5 (1024 states) be evaluated?

5. **DMD rank truncation:** r=5 (5 modes). Higher or lower?

6. **Branching ratio threshold:** mean + 1*std. Acceptable?

7. **Phase 4 parallel execution:** Phase 4 (TypeScript) can run in parallel with Phases 2-3 (Rust) since they touch different codebases. Approved?

---

*Awaiting approval before proceeding to implementation.*
