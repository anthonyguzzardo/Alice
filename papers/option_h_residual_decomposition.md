---
title: "Signal Partitioning by Reconstruction Fidelity in a Longitudinal Keystroke Instrument"
slug: residual-decomposition
author: Anthony Guzzardo
date: 2026-04-24
status: published
version: 2
abstract: "A reconstruction adversary framework partitions behavioral signals by their dependence on distributional versus structural properties of writing. Synthetic writing sessions generated from a person's statistical profile are compared against real sessions across 41 behavioral dimensions. Signals are first separated by unit scale into commensurable comparison sets, then decomposed by theoretical family. Among scale-comparable signals, the partition produces a consistent hierarchy: multifractal descriptors are the most resistant to reconstruction, ordinal statistics are nearly perfectly reproduced, and other families fall between. The ordinal reproducibility serves as a positive control confirming the adversary is well-calibrated for distributional properties. The partition is a methods contribution for signal selection in process-level cognitive measurement."
---

# Signal Partitioning by Reconstruction Fidelity in a Longitudinal Keystroke Instrument

**Anthony Guzzardo**
April 2026 (v2)

*v2: Revised framing from headline finding to methods contribution. Unit-scale partitioning logic moved before any numerical comparisons. Title changed to reflect the actual contribution (partitioning method, not single-signal result).*

---

## 1. The partitioning problem

A keystroke-based cognitive instrument computes many signals from each writing session. Some of those signals measure properties of the person that cannot be reduced to a statistical summary. Others measure the statistical summary itself. An instrument that cannot distinguish between the two does not know what it is measuring.

The reconstruction adversary framework (Guzzardo 2026c, "Reconstruction Validity") provides a method for making this distinction empirically. A synthetic writing session is generated from the person's accumulated statistical profile and run through the same signal engine. Signals where the ghost closely matches reality depend on distributional properties the profile captures. Signals where the ghost diverges depend on structural properties the profile cannot capture. The residual between real and synthetic signal values, computed per dimension, partitions the instrument's signal inventory by reconstruction fidelity.

This paper reports the partition for Alice's current signal inventory (41 behavioral dimensions, 12 journal sessions, 5 adversary variants) and argues that the partition is a methods contribution for signal selection in process-level cognitive measurement.

---

## 2. Unit-scale separation

Before comparing residuals across signal families, the signals must be separated by unit scale. Alice's 41 behavioral dimensions include signals on fundamentally different measurement scales:

**Bounded or normalized signals** are entropy measures in bits or [0,1], correlation coefficients in [-1,1], dimensionless ratios, and exponents. These are directly comparable across families because their magnitudes are on commensurable scales. There are 28 such signals across 10 theoretical families.

**Raw-scale signals** are measured in physical units: motor jerk in ms/step^2, ex-Gaussian tau in milliseconds, lapse rate in events/minute. Their residual magnitudes reflect unit scale, not measurement-theoretic importance. A residual of 192 for motor_jerk and 5 for MF-DFA spectrum width does not mean motor jerk is 38x more ghost-resistant; it means the signals are denominated in different currencies. There are 8 such signals in the motor distribution and transfer entropy families, plus avalanche_size_exponent in causal emergence.

The primary decomposition (Section 3) reports only the bounded signals. The raw-scale signals are reported separately (Section 4) and confirm that the ghost cannot reproduce motor timing distributions, but their residual magnitudes are not compared against the bounded families.

This separation is not post-hoc. It follows from the unit structure of the signals. A reviewer asking "why did you exclude motor_jerk from the comparison" has the same answer as "why don't you compare degrees Celsius to kilograms": the comparison is undefined without normalization, and the natural normalization (z-scoring against personal baselines) requires more accumulated data than the current corpus provides. The separation is reported rather than the comparison being forced.

---

## 3. The partition (bounded signals)

The full adversary (variant 5) produces the following per-family mean absolute residuals among bounded signals. Families are groups of signals sharing a mathematical framework. Per-family residual is the mean of per-signal mean absolute residuals within the family, averaged across sessions.

| Family | Signals | Mean Residual | Std | n |
|---|---|---|---|---|
| Multifractal (MF-DFA) | 2 | 2.742 | 0.945 | 7 |
| Motor Complexity (MSE + Fisher) | 2 | 1.029 | 0.846 | 7 |
| Recurrence (RQA + time entropy) | 4 | 0.199 | 0.136 | 7 |
| Recurrence Networks | 4 | 0.168 | 0.048 | 7 |
| Dynamic Modes (DMD) | 3 | 0.162 | 0.137 | 7 |
| Spectral (PSD) | 3 | 0.146 | 0.054 | 7 |
| Scaling (DFA alpha) | 1 | 0.138 | 0.022 | 7 |
| Ordinal Statistics | 5 | 0.012 | 0.005 | 7 |
| Permutation Entropy | 1 | 0.010 | 0.003 | 7 |
| Temporal Irreversibility | 1 | 0.006 | 0.004 | 7 |

The partition has three tiers. MF-DFA and motor complexity are an order of magnitude above the middle tier (recurrence, networks, DMD, spectral, DFA). The middle tier is an order of magnitude above the bottom tier (ordinal statistics, PE, temporal irreversibility). The total range among bounded signals spans roughly two orders of magnitude.

Within the top tier, MF-DFA spectrum width alone (mean 5.019, std 1.894) produces the largest per-signal residual. MF-DFA asymmetry (mean 0.466, std 0.032) is stable but smaller. Complexity index (mean 1.426, std 0.735) anchors the motor complexity family.

Within the bottom tier, forbidden pattern fraction is exactly 0.000 across all 7 sessions. The ghost produces the same forbidden pattern structure as real sessions.

### 3.1 Variant ladder

How each adversary improvement affects each family:

| Family | V1 (Baseline) | V2 (+AR1) | V3 (+Copula) | V4 (+PPM) | V5 (Full) |
|---|---|---|---|---|---|
| Multifractal | 2.778 | 5.896 | 1.648 | 2.114 | 2.742 |
| Motor Complexity | 1.259 | 0.783 | 1.732 | 1.409 | 1.029 |
| Recurrence Networks | 0.125 | 0.141 | 0.144 | 0.160 | 0.168 |
| Spectral | 0.136 | 0.134 | 0.135 | 0.124 | 0.146 |
| Ordinal Statistics | 0.011 | 0.048 | 0.013 | 0.011 | 0.012 |
| Temporal Irreversibility | 0.009 | 0.008 | 0.009 | 0.005 | 0.006 |

MF-DFA is not monotonically reduced by increasing adversary sophistication. It spikes under variant 2 (AR(1) conditioning) and dips under variant 3 (copula coupling). This is consistent with the known sensitivity of MF-DFA to serial correlation in short series (Kantelhardt et al. 2002): introducing correlation structure into the ghost's timing changes the scaling properties of the synthetic series in ways that can increase the distance from the real spectrum rather than decrease it. The full adversary combines all improvements and lands near the baseline level, suggesting the interaction effects partially cancel.

Ordinal statistics spike under variant 2 (0.048 vs 0.011 baseline) because AR(1) conditioning introduces serial dependencies that alter ordinal pattern transition probabilities without matching the real transition structure. The full adversary (which adds PPM text prediction) returns ordinal statistics to baseline levels.

---

## 4. Raw-scale signals (separate comparison set)

The original motor distribution signals and transfer entropy are reported here for completeness. These are not compared against the bounded families.

| Family | Signals | Mean Residual | Std | n |
|---|---|---|---|---|
| Motor Distribution | 6 | 56.718 | 22.617 | 7 |
| Transfer Entropy | 1 | 2.998 | 2.640 | 6 |

Motor distribution is dominated by motor_jerk (mean residual 192.995) and ex_gaussian_tau (159.542). These confirm the ghost cannot reproduce raw motor timing values, but the magnitudes reflect the millisecond-scale units of the underlying measurements.

Causal emergence (family mean 3.184) is included in the bounded comparison (Section 3) for most of its signals (effective information, causal emergence index, PID synergy/redundancy, branching ratio), but avalanche_size_exponent (mean 21.740) is on an unconstrained scale and inflates the family mean. Excluding it, the family mean drops to 0.091, placing causal emergence in the middle tier.

---

## 5. Why the partition has this structure

The partition is not an empirical accident. It follows from the generative architecture of the adversary.

**Why ordinal statistics are reproduced.** The ghost samples IKI values from a distribution fitted to the real person's history. Ordinal statistics (permutation entropy, statistical complexity, forbidden pattern fraction, weighted PE, Lempel-Ziv complexity) depend on the rank-order structure of the IKI series, which is determined by the marginal distribution. A well-fitted distribution produces the correct rank-order structure. The near-zero residuals confirm the fit is good. This is the positive control.

**Why MF-DFA resists.** The ghost generates timing from a single stochastic process (ex-Gaussian with optional AR(1) conditioning and copula coupling). A single stochastic process has one characteristic scaling behavior. Its singularity spectrum is narrow. Real writing involves multiple cognitive processes operating at different time scales (lexical retrieval, syntactic planning, revision, motor execution). When these interleave, the IKI series inherits scaling properties from all of them, producing a broad multifractal spectrum. The width of the singularity spectrum measures the diversity of scaling behaviors. The ghost can match the marginal distribution and the serial correlation, but it cannot match the multi-process interaction structure across scales, because it has one process.

**Why the middle tier is partially reproduced.** Recurrence networks, spectral features, DMD modes, and DFA alpha depend partly on distributional properties (which the ghost matches) and partly on temporal structure (which the ghost approximates through AR(1) and copula, but does not fully capture). Their intermediate residuals reflect this mixed dependence.

The partition tells you which signals are worth making in a cognitive instrument. Signals at the bottom of the partition are measuring the distribution. Signals at the top are measuring something the distribution cannot reproduce. An instrument that measured only ordinal statistics would be fully fakeable by a statistical profile and therefore uninformative for longitudinal tracking. The partition is the empirical basis for that claim.

---

## 6. Limitations

This partition characterizes the instrument's discriminative structure, not a clinical finding. It answers "what does this measurement system capture that a statistical summary cannot" rather than "what does it detect in a person."

Residuals are absolute differences, not z-scored against personal baselines. Within the bounded comparison set, signals are on commensurable but not identical scales. Variance differences could inflate some family residuals relative to others. A z-scored decomposition is planned as baseline depth increases.

The sample is n=1 participant, 7 sessions with full extended residual coverage (12 total journal sessions, 7 with sufficient keystroke count for all dynamical families). The structural argument does not depend on sample size, but the precision of the per-family estimates does.

Family groupings are theoretically motivated (each family shares a mathematical framework) but not empirically validated as independent measurement dimensions. Within-family signal correlations have not been computed.

The ghost architecture constrains what "irreducible" means. A more sophisticated adversary with multiple interleaved generative processes might close the multifractal gap. If it did, the gap was architectural, not cognitive. This is a testable prediction: any future adversary variant that produces broad multifractal spectra should reduce the MF-DFA residual proportionally.

---

## References

- Kantelhardt, J.W., Zschiegner, S.A., Koscielny-Bunde, E., et al. (2002). Multifractal detrended fluctuation analysis of nonstationary time series. *Physica A*, 316(1-4), 87-114.
- Bandt, C. & Pompe, B. (2002). Permutation entropy: A natural complexity measure for time series. *Physical Review Letters*, 88(17), 174102.
- Rosso, O.A., Larrondo, H.A., Martin, M.T., et al. (2007). Distinguishing noise from chaos. *Physical Review Letters*, 99(15), 154102.
- Costa, M., Goldberger, A.L. & Peng, C.K. (2002). Multiscale entropy analysis of complex physiologic time series. *Physical Review Letters*, 89(6), 068102.
- Donner, R.V., Zou, Y., Donges, J.F., et al. (2010). Recurrence networks: A novel paradigm for nonlinear time series analysis. *New Journal of Physics*, 12, 033025.
- Guzzardo, A. (2026c). Reconstruction Validity: Self-Validation of Process-Level Cognitive Measurement Through Adversarial Synthesis.
- Guzzardo, A. (2026a). A Closing Window: The Demographic Confound in Keystroke-Based Cognitive Biomarkers.
