---
title: "Calibration Delta Replication Plan"
slug: calibration-delta-replication-plan
author: Anthony Guzzardo
date: 2026-04-24
status: draft
version: 1
---

# Calibration Delta Replication Plan

Two checkpoints for re-running the Phase 1 screen plus confound battery. The current finding: integrative complexity (IC) is the sole surviving provocation signal with g_z = +1.211, 100% sign consistency at n=6, 95% BCa CI [+0.60, +4.60].

---

## Checkpoint 1: n=15 pairs (~May 5-8, 2026)

**Run the full pipeline.** Phase 1 screen on all 68 signals (sign consistency > 0.75, Hedges' g_z CI excludes zero, calibration stationary). Confound battery on all survivors (length-matched recomputation for dynamical signals, TOD regression for all).

**Integrative complexity criteria:**

| Outcome | Criteria | Action |
|---|---|---|
| **Holding** | Sign consistency >= 13/15 (87%+). CI excludes zero. g_z >= +0.60 (within half of current). TOD regression p > 0.10. | Proceed to n=25 checkpoint. Begin drafting IC as a validated provocation signal in the instrument paper. |
| **Attenuating** | Sign consistency 11-12/15 (73-80%). CI still excludes zero but lower bound < +0.20. OR g_z drops below +0.60. | Proceed to n=25 but do not claim IC as validated. The effect may be real but smaller than initially estimated. |
| **Failing** | Sign consistency < 11/15 (< 73%). OR CI spans zero. OR TOD regression becomes significant (p < 0.05). | IC does not replicate. Remove from candidate list. The n=6 result was a small-sample fluctuation or an early-period artifact (the participant's relationship to the instrument was different in the first two weeks). |

**New signals to watch.** Idea density narrowly missed Phase 1 at n=8 (sign consistency = 0.75, threshold is > 0.75, CI [+0.35, +1.26] excludes zero). At n=15, re-evaluate. If sign consistency crosses 0.80 and CI holds, it becomes the second candidate.

**Calibration drift.** Re-run Mann-Kendall on all 68 signals. If drift has spread beyond the current two signals (DMD frequency, lexical sophistication), flag as a systemic calibration design problem requiring intervention before n=25.

---

## Checkpoint 2: n=25 pairs (~May 15-20, 2026)

**Same pipeline, stricter criteria.**

| Outcome | Criteria | Action |
|---|---|---|
| **Holding** | Sign consistency >= 21/25 (84%+). CI excludes zero with lower bound >= +0.30. g_z >= +0.50. TOD regression p > 0.10. Calibration baseline stationary. | IC is a validated provocation signal. Proceed to Phase 2: persist IC delta in `tb_signal_family_deltas`, feed into question generation as provocation score. Write the finding into the instrument paper as a confirmed result. |
| **Attenuating** | Sign consistency 19-20/25 (76-80%). CI excludes zero but lower bound < +0.30. OR g_z in [+0.30, +0.50]. | IC is a real but modest effect. Persist for monitoring but do not use as a question quality signal (the effect is too small to discriminate good questions from bad ones). Continue accumulating pairs. |
| **Failing** | Sign consistency < 19/25 (< 76%). OR CI spans zero. | IC does not replicate at scale. The instrument's calibration delta design does not produce reliable provocation signals in the current configuration. Consider implementing Option A (extended calibration) and restarting the analysis from the new baseline. |

**Dynamical family re-evaluation.** At n=25, if Option B (length-matching) is standard practice and no dynamical signals have emerged from the length-matched analysis across 25 pairs, the dynamical family does not carry provocation signal in this design. This is a meaningful null result: the reflective question changes what people write (semantic) but not how they type (dynamical, motor, process) once series length is controlled. Document this in the instrument paper.

**Drift check.** If more than 5 of 68 signals show calibration drift at n=25, the calibration task itself is non-stationary and the matched-pair design is compromised. This triggers a prompt category audit and potential redesign.

---

## What not to do between checkpoints

- Do not change the calibration prompt pool, timing, or length target before n=25 unless drift becomes acute (> 5 signals drifting).
- Do not persist signal-family deltas before n=25 Checkpoint 2 produces a "holding" verdict.
- Do not feed IC or any other signal back into question generation before n=25.
- Do run the screening script (`screen-calibration-deltas.ts`) and confound script (`confound-analysis.ts`) at each checkpoint. The scripts are the analysis, not a one-off.
