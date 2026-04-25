---
title: "Calibration Delta Methodology: Within-Person Provocation Analysis"
slug: calibration-delta-methodology
author: Anthony Guzzardo
date: 2026-04-24
status: draft
version: 1
abstract: "A within-person matched-pair design compares behavioral and linguistic signals between reflective journal sessions and neutral calibration sessions. Initial screening of 68 signals across four families identified four candidates. A confound battery revealed that three dynamical signals were series-length artifacts. One signal (integrative complexity) survives all checks. The methodology is documented for replication at larger sample sizes."
---

# Calibration Delta Methodology: Within-Person Provocation Analysis

**Anthony Guzzardo**
April 2026 (v1, draft)

---

## 1. Design

### Matched-pair structure

Alice collects two writing sessions per day from a single participant: a journal session (reflective writing in response to a generated question about the person's inner life) and a calibration session (neutral writing in response to a randomly selected prompt from a pool of 303 knowledge-telling tasks). The two sessions form a within-person, within-day matched pair. The delta (journal value minus calibration value) on any behavioral or linguistic signal isolates what the reflective question provoked beyond the person's same-day neutral writing baseline.

### Calibration prompt design

The calibration prompt pool contains 303 prompts across 12 cognitive task categories: observation (describe what's around you), recent memory (what did you do/eat), routine and process (walk through how you do X), object explanation (describe X to someone who's never seen one), procedural instruction (explain how to X), constrained description (describe X without using words Y/Z), fluent generation (name as many X as you can), sensory description (taste, smell, texture, sound), spatial memory (describe a place from memory), perspective shift (describe from an unusual vantage), and enumeration (count and describe specific things). All prompts are designed to elicit knowledge-telling, not knowledge-transforming. Prompts are selected without replacement until the pool is exhausted, then oldest-used prompts are recycled with maximum temporal spacing.

### Current timing pattern

In the first 12 day-pairs (April 13-24, 2026), journal sessions occur in the morning or midday (mean hour 9.7, SD 5.9) and calibration sessions occur in the evening (mean hour 19.9, SD 3.6). Journal precedes calibration in 83% of pairs (10/12), with a mean within-pair time gap of 10.3 hours (SD 7.7). The ordering is not randomized; it reflects the participant's natural daily routine.

### Signal inventory

68 signals are computed per session across four families: dynamical (35 signals, Rust-computed from IKI series: permutation entropy, DFA, MF-DFA, RQA, transfer entropy, PID, DMD, causal emergence, criticality), motor (13 signals, Rust-computed from keystroke timing: sample entropy, ex-Gaussian distribution, motor jerk, tempo drift, compression ratio, digraph latency, hold-flight correlation), process (9 signals, Rust-computed from event log replay: pause location, burst classification, vocabulary expansion, phase transition, strategy shifts), and semantic (11 signals, TypeScript-computed from response text: idea density, lexical sophistication, epistemic stance, integrative complexity, cohesion measures, discourse coherence, text compression ratio). A fifth family (cross-session, 11 signals) is structurally excluded because it compares against prior history that calibration sessions may not have.

---

## 2. Confounds discovered

### Length asymmetry (2.5x)

Journal sessions are substantially longer than calibration sessions across every structural metric. Mean duration: 240s vs 97s. Mean IKI count: 1152 vs 470. Mean word count: 146 vs 56. Mean total characters typed: 972 vs 340. The ratio is approximately 2.5:1 across all production measures.

This asymmetry is critical for dynamical signals that depend on IKI series length. Many require minimum series lengths (RQA: 100+, MF-DFA: 256+, DMD: 100+), and their statistical properties change with series length even when the underlying process is identical. Normalized measures (LZC, PID) are particularly sensitive because their normalization constants depend on series length.

### Time-of-day gap (10 hours)

Journal sessions cluster in the morning (mean hour 9.7); calibration sessions cluster in the evening (mean hour 19.9). The gap is systematic, not random: it reflects the participant's daily routine of journaling in the morning and calibrating before bed. This introduces a circadian confound for any signal sensitive to time-of-day effects (fatigue, motor slowing, cognitive depletion).

### Fixed ordering

Journal precedes calibration in 83% of pairs. The calibration session occurs after a full day of cognitive activity. This confounds any motor signal comparison: calibration motor output reflects end-of-day motor state, not neutral-condition motor state.

### Pacing equivalence

Despite the structural differences above, keystroke-level pacing is comparable. IKI mean: 169ms vs 179ms (p=0.51). IKI CV: 1.5 vs 1.5 (p=0.48). Chars per minute: 273 vs 252 (p=0.42). The person types at similar speed in both conditions; the difference is in how long and how much they type, not how fast.

---

## 3. Analysis pipeline

### Phase 1: Screening (68 signals)

For each signal, compute across all available day-pairs:

1. **Sign consistency.** Proportion of days where the delta (journal minus calibration) has the same sign. Binomial test against 0.5 for significance. Threshold: > 0.75.

2. **Hedges' g_z with BCa bootstrap CI.** Paired effect size with small-sample correction (Hedges, 1981). 1000-resample bias-corrected accelerated bootstrap confidence interval. Threshold: 95% CI excludes zero.

3. **Calibration stationarity.** Mann-Kendall trend test on the calibration-session time series for each signal. Signals where the calibration baseline is drifting (p <= 0.05) are flagged: the provocation delta on those signals is confounded with baseline drift. Threshold: p > 0.05 (stationary).

A signal passes Phase 1 if all three criteria are met simultaneously.

### Confound battery (applied to Phase 1 survivors)

4. **Length-matched recomputation.** For each pair with raw keystroke streams, truncate the journal stream to the calibration stream's keystroke count (first N keystrokes of journal where N = calibration count). Recompute the signal via the Rust engine on the truncated stream. Rerun Phase 1 criteria on the truncated deltas. A signal passes if its sign consistency, effect size, and CI survive truncation.

5. **Time-of-day regression.** Regress the signal delta against the within-pair time-of-day difference (journal hour minus calibration hour). If the regression is significant (p < 0.05), the provocation effect covaries with circadian timing and cannot be attributed to the question alone.

6. **Pause and burst structure check.** Compare pause duration distribution (median, IQR, 90th percentile), burst length distribution, and inter-burst interval distribution between length-matched journal and calibration streams to verify structural comparability at equal keystroke counts.

---

## 4. Results (n=6-12 pairs, April 13-24, 2026)

### Phase 1 screen

4 of 68 signals met all three criteria:

| Signal | Family | g_z | Direction | Sign consistency | Ergodicity |
|---|---|---|---|---|---|
| Integrative complexity | Semantic | +1.211 | journal > | 6/6 (100%) | safe |
| Lempel-Ziv complexity | Dynamical | -0.800 | calib > | 6/7 (86%) | safe |
| PID synergy | Dynamical | -0.575 | calib > | 6/7 (86%) | safe |
| Temporal irreversibility | Dynamical | -0.490 | calib > | 6/6 (100%) | safe |

All four are ergodicity-safe. Zero ergodicity-unsafe signals passed. Zero LLM-derived signals passed. Two calibration baselines were drifting: DMD dominant frequency (falling, p=0.04) and lexical sophistication (rising, p=0.02).

### Confound battery

Length-matched recomputation was applied to the three dynamical signals (integrative complexity is text-based and not affected by IKI series length). All three collapsed:

| Signal | Original sign | Truncated sign | Original CI | Truncated CI | Verdict |
|---|---|---|---|---|---|
| Lempel-Ziv complexity | 0.86 calib > | 0.57 calib > | excludes zero | spans zero | artifact |
| PID synergy | 0.86 calib > | 0.57 calib > | excludes zero | spans zero | artifact |
| Temporal irreversibility | 1.00 calib > | 0.67 journal > | excludes zero | spans zero | sign flipped |

Temporal irreversibility is the clearest artifact: 100% sign consistency reverses direction entirely under length-matching. LZC and PID synergy lose sign consistency and CI significance.

Time-of-day regression on integrative complexity: r=0.315, R^2=0.099, p=0.458. Not significant. The IC provocation effect does not covary with the 10-hour circadian gap.

Length-matched pause and burst structure comparison shows comparable distributions: pause count (4.3 vs 3.7 per session), median pause duration (2929ms vs 2695ms), median burst length (67 vs 56 IKIs), inter-burst interval (2929ms vs 2695ms). No structural divergence at equal keystroke counts.

### Surviving signal

**Integrative complexity** is the sole signal surviving the full pipeline. It measures contrastive and integrative connective density per sentence (Suedfeld & Tetlock). The reflective question reliably produces more multi-perspective, nuanced writing than the neutral prompt. Effect size g_z = +1.211 (large). Sign consistency 100% across 6 pairs. Not confounded with time of day, series length, or calibration drift.

---

## 5. Limitations

**Small N.** 6-12 pairs depending on signal availability. Even the surviving signal's 100% sign consistency at n=6 yields a minimum binomial p of 0.016, which is suggestive but not definitive. The bootstrap CI is wide ([+0.60, +4.60]).

**Single participant.** All findings are idiographic. The provocation effect of the reflective question on integrative complexity may be specific to this person's writing style, cognitive profile, or relationship to the instrument.

**Fixed ordering.** Journal always precedes calibration. The time-of-day regression did not find a significant relationship for integrative complexity, but the test has low power at n=7. An order confound cannot be ruled out with certainty.

**Fatigue confound.** Calibration occurs after a full day. Motor signals in calibration may reflect end-of-day motor state. This is partially addressed by the finding that keystroke-level pacing (IKI mean, CV, chars per minute) is comparable between conditions, but subtle fatigue effects below the resolution of summary statistics cannot be excluded.

**Series-length sensitivity.** The confound battery revealed that three of four Phase 1 survivors were series-length artifacts. This underscores that any future analysis of dynamical signal deltas must control for series length. The 2.5x length asymmetry is a structural feature of the current design, not an anomaly.

---

## References

- Hedges, L.V. (1981). Distribution theory for Glass's estimator of effect size. *JASA*, 76, 107-128.
- Jacobson, N.S. & Truax, P. (1991). Clinical significance: A statistical approach. *JCCP*, 59, 12-19.
- Suedfeld, P. & Tetlock, P.E. (1977). Integrative complexity of communications in international crises. *J. Conflict Resolution*, 21, 169-184.
- Pennebaker, J.W. (1997). Writing about emotional experiences as a therapeutic process. *Psychological Science*, 8, 162-166.
- Mangalam, M. et al. (2022). Ergodic descriptors of non-ergodic stochastic processes. *J. Royal Society Interface*.
- Bandt, C. & Pompe, B. (2002). Permutation entropy. *Physical Review Letters*, 88, 174102.
- Toledo, N. et al. (2024). Within-day stress response variance. *Psychoneuroendocrinology*.
