---
title: "Calibration Delta Replication Plan"
slug: calibration-delta-replication-plan
author: Anthony Guzzardo
date: 2026-04-24
status: published
version: 1
---

# Calibration Delta Replication Plan

Two checkpoints for re-running the Phase 1 screen plus confound battery. The current finding: integrative complexity (IC) is the sole surviving provocation signal with g_z = +1.211, 100% sign consistency at n=6, 95% BCa CI [+0.60, +4.60].

---

## Lock rule

**No changes between checkpoints.** The following are frozen from now until the n=25 checkpoint completes:

- **Analysis pipeline.** The screening script (`screen-calibration-deltas.ts`) and confound script (`confound-analysis.ts`) are locked. No modifications to thresholds, statistical methods, signal definitions, or metadata classifications. Any change to the pipeline between checkpoints invalidates the n=25 result as a test of the n=6 finding.
- **Calibration prompt pool.** The 303-prompt pool in `libCalibrationPrompts.ts` is frozen. No additions, removals, or category reorganization.
- **Question generation system.** No modifications to `libGenerate.ts`, `formatCompactDelta`, or any component that produces journal questions. IC is not fed back into generation.
- **Screening thresholds.** Sign consistency > 0.75, Hedges' g_z CI excludes zero, Mann-Kendall stationarity p > 0.05. These are pre-specified and do not change.
- **Persistence layer.** No schema changes. No new delta tables. No signal-family delta persistence.

The only permitted change is the session ordering randomization (odd/even day alternation), which is a behavioral change to the data collection protocol, not to the analysis or instrument code.

Exception: if calibration drift exceeds the FDR-corrected threshold (see below), intervention is required and the lock is broken with documentation.

---

## Checkpoint 1: n=15 matched pairs

**Run the full pipeline.** Phase 1 screen on all 68 signals (sign consistency > 0.75, Hedges' g_z CI excludes zero, calibration stationary). Confound battery on all survivors (length-matched recomputation for dynamical signals, TOD regression for all).

**Integrative complexity criteria:**

| Outcome | Criteria | Action |
|---|---|---|
| **Holding** | Sign consistency >= 13/15 (87%+). CI excludes zero. g_z >= +0.60 (within half of current). TOD regression p > 0.10. | Proceed to n=25 checkpoint. |
| **Attenuating** | Sign consistency 11-12/15 (73-80%). CI still excludes zero but lower bound < +0.20. OR g_z drops below +0.60. | Proceed to n=25 but do not claim IC as validated. The effect may be real but smaller than initially estimated. |
| **Failing** | Sign consistency < 11/15 (< 73%). OR CI spans zero. OR TOD regression becomes significant (p < 0.05). | IC does not replicate. Remove from candidate list. The n=6 result was a small-sample fluctuation or an early-period artifact. |

**New signals to watch.** Idea density narrowly missed Phase 1 at n=8 (sign consistency = 0.75, threshold is > 0.75, CI [+0.35, +1.26] excludes zero). At n=15, re-evaluate. If sign consistency crosses 0.80 and CI holds, it becomes the second candidate.

**Calibration drift (FDR-corrected).** Re-run Mann-Kendall on all 68 signals. At p <= 0.05 with 68 tests, the expected number of false positives under the null is 68 * 0.05 = 3.4. Apply Benjamini-Hochberg FDR correction at q = 0.05: rank the 68 p-values, and a signal is significantly drifting only if its p-value <= (rank/68) * 0.05. If the number of BH-significant signals exceeds 5 (well above the ~0 expected under the null after FDR correction), flag as a systemic calibration design problem requiring intervention before n=25.

---

## Checkpoint 2: n=25 matched pairs

**Same pipeline, stricter criteria.**

| Outcome | Criteria | Action |
|---|---|---|
| **Holding** | Sign consistency >= 21/25 (84%+). CI excludes zero with lower bound >= +0.30. g_z >= +0.50. TOD regression p > 0.10. Calibration baseline stationary. | IC is a validated provocation signal. Proceed to Phase 2: persist IC delta, feed into question generation as provocation score. Write the finding into the instrument paper as a confirmed result. |
| **Attenuating** | Sign consistency 19-20/25 (76-80%). CI excludes zero but lower bound < +0.30. OR g_z in [+0.30, +0.50]. | IC is a real but modest effect. Persist for monitoring but do not use as a question quality signal (the effect is too small to discriminate good questions from bad ones). Continue accumulating pairs. |
| **Failing** | Sign consistency < 19/25 (< 76%). OR CI spans zero. | IC does not replicate at scale. The instrument's calibration delta design does not produce reliable provocation signals in the current configuration. Consider implementing Option A (extended calibration) and restarting the analysis from the new baseline. |

**Dynamical family re-evaluation.** At n=25, if Option B (length-matching) is standard practice and no dynamical signals have emerged from the length-matched analysis across 25 pairs, the dynamical family does not carry provocation signal in this design. This is a meaningful null result: the reflective question changes what people write (semantic) but not how they type (dynamical, motor, process) once series length is controlled. Document this in the instrument paper.

**Drift check (FDR-corrected).** Same BH procedure as Checkpoint 1. If BH-significant drift signals exceed 5, the calibration task is non-stationary and the matched-pair design is compromised. This triggers a prompt category audit, mechanism investigation (familiarity vs category vs genuine change), and potential redesign. The lock rule is broken with documentation.
