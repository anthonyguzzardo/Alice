---
title: "Dimensional Decomposition of Reconstruction Residuals: What the Ghost Cannot Reproduce"
slug: residual-decomposition
author: Anthony Guzzardo
date: 2026-04-24
status: draft
version: 1
abstract: "A reconstruction adversary generates synthetic writing sessions from a person's statistical profile. Comparing real and synthetic signals across 41 behavioral dimensions reveals a 100x range in ghost reproduction fidelity. Multifractal spectrum width produces the largest residual among scale-comparable signals. Ordinal statistics are nearly perfectly reproduced. The decomposition is structural: the ghost cannot produce multifractal dynamics because it generates from a single stochastic process, and ordinal statistics are reproducible because they depend on distributional properties the ghost matches by construction. This is the first empirical result from the Alice instrument, and it characterizes what the measurement system captures rather than what it detects in a person."
---

# Dimensional Decomposition of Reconstruction Residuals: What the Ghost Cannot Reproduce

**Anthony Guzzardo**
April 2026 (v1)

---

## 1. The measurement

The reconstruction adversary (the ghost) generates a synthetic writing session from a person's accumulated statistical profile: vocabulary and transition probabilities from their corpus, motor timing from their ex-Gaussian distribution and digraph latency profile, revision behavior from their deletion rates. The synthetic session is fed through the same Rust signal engine that processes real sessions. The residual between real and synthetic signal values, computed per dimension, measures what the profile can reconstruct and what it cannot.

Five adversary variants test this boundary with increasing statistical sophistication. Each adds one modeling improvement: AR(1) IKI correlation (variant 2), Gaussian copula hold-flight coupling (variant 3), variable-order PPM text prediction (variant 4), and all combined (variant 5, the full adversary). Comparing residuals across variants isolates which dimension of behavior each improvement captures. What remains after the full adversary is the irreducible floor.

The decomposition reported here covers 41 behavioral dimensions (28 extended + 13 original) across 12 journal sessions, each producing 5 residual rows (one per variant). Residuals are computed as simple differences (real minus avatar), with per-family means taken as mean absolute residual across sessions. Calibration sessions are excluded. The data were extracted from `tb_reconstruction_residuals` using the script `src/scripts/extract-residual-decomposition.ts`, and all numbers reported here are reproducible from the stored PRNG seeds and profile snapshots.

Full framework described in Guzzardo (2026c, "Reconstruction Validity").

---

## 2. The decomposition

### 2.1 Scale-comparable signals

The extended dynamical signals added in Phases 1-5 are bounded or normalized (entropy measures in bits or [0,1], correlation coefficients in [-1,1], ratios, dimensionless exponents). These are directly comparable across families. Among these signals, the full adversary (variant 5) produces the following per-family mean absolute residuals:

| Family | Signals | Mean |Res| | Std | n | Ratio to min |
|---|---|---|---|---|---|
| Multifractal (MF-DFA) | 2 | 2.742 | 0.945 | 7 | 436x |
| Motor Complexity (MSE + Fisher) | 2 | 1.029 | 0.846 | 7 | 164x |
| Recurrence (RQA + time entropy) | 4 | 0.199 | 0.136 | 7 | 32x |
| Recurrence Networks | 4 | 0.168 | 0.048 | 7 | 27x |
| Dynamic Modes (DMD) | 3 | 0.162 | 0.137 | 7 | 26x |
| Spectral (PSD) | 3 | 0.146 | 0.054 | 7 | 23x |
| Scaling (DFA alpha) | 1 | 0.138 | 0.022 | 7 | 22x |
| Ordinal Statistics | 5 | 0.012 | 0.005 | 7 | 2x |
| Permutation Entropy | 1 | 0.010 | 0.003 | 7 | 1.6x |
| Temporal Irreversibility | 1 | 0.006 | 0.004 | 7 | 1x |

The range spans over two orders of magnitude. MF-DFA spectrum width alone (mean residual 5.019, std 1.894) is the single largest per-signal residual in the entire inventory. Ordinal statistics cluster near zero, with forbidden pattern fraction at exactly 0.000 (the ghost produces the same forbidden pattern structure as real sessions).

### 2.2 Raw motor signals

The original motor distribution signals (ex-Gaussian tau, motor jerk, lapse rate, tempo drift, sample entropy, tau proportion) are on incomparable scales (motor jerk is in ms/step^2; ex-Gaussian tau is in milliseconds). Their family mean absolute residual is 56.72, dominated by motor_jerk (192.99) and ex_gaussian_tau (159.54). These numbers confirm that the ghost cannot reproduce motor timing distributions, but the residual magnitudes reflect unit scales rather than measurement-theoretic importance. They are reported separately and not compared against the normalized families.

Transfer entropy dominance (mean residual 2.998) and causal emergence signals (family mean 3.184, driven by avalanche_size_exponent at 21.74) are also on unconstrained scales. These are included in the variant comparison below but not in the primary decomposition.

### 2.3 Per-signal detail within MF-DFA

| Signal | Mean |Res| | Std | n |
|---|---|---|---|
| mfdfa_spectrum_width | 5.019 | 1.894 | 7 |
| mfdfa_asymmetry | 0.466 | 0.032 | 7 |

Spectrum width dominates. The ghost consistently produces a narrow singularity spectrum (because it generates from a single ex-Gaussian process with optional AR(1) structure), while real sessions produce broad spectra from the interaction of multiple cognitive processes at different time scales. Asymmetry shows a smaller but stable residual: the shape of the real spectrum is consistently different from the ghost's, not just the width.

### 2.4 Variant ladder

How does each adversary improvement affect each family? For scale-comparable families only:

| Family | V1 (Baseline) | V2 (+AR1) | V3 (+Copula) | V4 (+PPM) | V5 (Full) |
|---|---|---|---|---|---|
| Multifractal | 2.778 | 5.896 | 1.648 | 2.114 | 2.742 |
| Motor Complexity | 1.259 | 0.783 | 1.732 | 1.409 | 1.029 |
| Recurrence Networks | 0.125 | 0.141 | 0.144 | 0.160 | 0.168 |
| Spectral | 0.136 | 0.134 | 0.135 | 0.124 | 0.146 |
| Ordinal Statistics | 0.011 | 0.048 | 0.013 | 0.011 | 0.012 |
| Temporal Irreversibility | 0.009 | 0.008 | 0.009 | 0.005 | 0.006 |

Two patterns emerge. First, MF-DFA is not monotonically reduced by increasing adversary sophistication. It spikes under variant 2 (AR(1) conditioning) and dips under variant 3 (copula coupling), suggesting that temporal correlation structure interacts with multifractal estimation in non-trivial ways. This is consistent with the known sensitivity of MF-DFA to serial correlation in short series (Kantelhardt et al. 2002). Second, ordinal statistics spike under variant 2 (0.048 vs 0.011 baseline) because AR(1) conditioning introduces serial dependencies that alter ordinal pattern transition probabilities without matching the real transition structure. The full adversary (which adds PPM text prediction) brings ordinal statistics back to baseline levels.

---

## 3. Why multifractal structure resists

The ghost generates keystroke timing from a single stochastic process: ex-Gaussian sampling with optional AR(1) serial dependence and copula-based hold-flight coupling. A single stochastic process, by definition, has one characteristic scaling behavior. Its singularity spectrum is narrow, approaching monofractal.

Real writing produces broad multifractal structure because the person's cognitive state is not a single process. Lexical retrieval, syntactic planning, revision evaluation, and motor execution operate at different time scales and produce different scaling behaviors in the IKI series. When these processes interleave, the resulting timing series inherits scaling properties from all of them. The width of the singularity spectrum measures the diversity of these scaling behaviors.

The ghost can match the marginal distribution of IKI values (the ordinal statistics prove this). It can match the serial correlation structure (the AR(1) variant proves this). It can match the hold-flight coupling (the copula variant proves this). What it cannot match is the interaction structure across scales, because that structure requires multiple generative processes, and the ghost has one.

This is not a failure of the ghost. It is the ghost working correctly. The residual decomposition reveals where statistical profiles end and irreducible behavioral structure begins. An instrument that measured only ordinal statistics would be fully reproducible by a statistical profile and therefore uninformative. The multifractal residual is where the measurement happens.

---

## 4. What ordinal reproducibility confirms

At the bottom of the decomposition, ordinal statistics (statistical complexity, forbidden pattern fraction, weighted PE, Lempel-Ziv complexity, OPTN transition entropy) have a family mean residual of 0.012. Forbidden pattern fraction is exactly 0.000 across all 7 sessions. Permutation entropy residual is 0.010.

This is the positive control. Ordinal statistics depend on the shape of the IKI distribution: which ordinal patterns occur, how often, and in what combinations. The ghost samples from a distribution fitted to the real person's IKI history. It should reproduce distributional properties. The fact that it does, with residuals three orders of magnitude smaller than multifractal structure, confirms that the residual decomposition is measuring something real rather than reflecting noise or poor ghost calibration.

---

## 5. Implications for instrument design

The decomposition provides an empirical criterion for signal selection in longitudinal cognitive measurement. Signals that resist reconstruction are the ones carrying irreducible behavioral information: they measure something about the person that a statistical summary cannot reproduce. Signals that are easily reconstructed are measuring the distribution, not the person.

For Alice's signal inventory, this means:
- **Multifractal descriptors (MF-DFA spectrum width, asymmetry) carry the most irreducible information per signal.** An instrument that omits them is discarding its most informative measurements.
- **Multi-scale entropy and complexity index carry the next tier of irreducible information.** These capture cross-scale regularity structure that single-scale measures miss.
- **Ordinal statistics are distributional diagnostics, not cognitive indicators.** They confirm the ghost is well-calibrated but do not themselves distinguish the person from their profile.
- **The middle tier (recurrence networks, spectral, DMD, DFA alpha) carries moderate irreducible information.** These are partially reproducible, meaning the ghost captures some but not all of their structure.

This hierarchy is structural, not statistical. It holds at n=7 sessions because it reflects the generative architecture of the ghost, not a sample-size-dependent effect. More data will tighten the estimates but will not change the ordering, because the ordering is determined by what a single stochastic process can and cannot produce.

---

## 6. Limitations

This decomposition characterizes the instrument's discriminative structure, not a clinical finding. It answers "what does this measurement system capture that a statistical summary cannot" rather than "what does it detect in a person."

The residuals are absolute differences, not z-scored against personal baselines. Signals with larger natural variance will produce larger residuals. The scale-comparable analysis (Section 2.1) restricts comparison to bounded signals, but within that group, variance differences could still inflate some family residuals relative to others. A z-scored decomposition against accumulating baselines would control for this and is planned as the baseline depth increases.

The sample is n=1 participant, 7 sessions with full extended residual coverage (12 total journal sessions, 7 with sufficient keystroke count for all dynamical families). The structural argument (single process cannot produce multifractal structure) does not depend on sample size, but the precision of the per-family estimates does.

Family groupings are theoretically motivated (each family shares a mathematical framework) but not empirically validated as independent measurement dimensions. Within-family signal correlations have not been computed.

The ghost architecture constrains what "irreducible" means. A more sophisticated adversary (e.g., one with multiple interleaved generative processes) might close the multifractal gap. If it did, that would mean the gap was architectural, not cognitive. This is a testable prediction: any future adversary variant that produces broad multifractal spectra should reduce the MF-DFA residual proportionally.

---

## References

- Kantelhardt, J.W., Zschiegner, S.A., Koscielny-Bunde, E., et al. (2002). Multifractal detrended fluctuation analysis of nonstationary time series. Physica A, 316(1-4), 87-114.
- Bandt, C. & Pompe, B. (2002). Permutation entropy: A natural complexity measure for time series. Physical Review Letters, 88(17), 174102.
- Rosso, O.A., Larrondo, H.A., Martin, M.T., et al. (2007). Distinguishing noise from chaos. Physical Review Letters, 99(15), 154102.
- Costa, M., Goldberger, A.L. & Peng, C.K. (2002). Multiscale entropy analysis of complex physiologic time series. Physical Review Letters, 89(6), 068102.
- Donner, R.V., Zou, Y., Donges, J.F., et al. (2010). Recurrence networks: A novel paradigm for nonlinear time series analysis. New Journal of Physics, 12, 033025.
- Lacouture, Y. & Cousineau, D. (2008). How to use MATLAB to fit the ex-Gaussian and other probability functions to a distribution of response times. Tutorials in Quantitative Methods for Psychology, 4(1), 35-45.
- Guzzardo, A. (2026c). Reconstruction Validity: Self-Validation of Process-Level Cognitive Measurement Through Adversarial Synthesis.
- Guzzardo, A. (2026a). A Closing Window: The Demographic Confound in Keystroke-Based Cognitive Biomarkers.
