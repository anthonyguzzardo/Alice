---
title: "The Aha Channel: Insight Cognition as the Earliest Axis of a Cognitive Reserve Instrument"
slug: aha-channel
author: Anthony Guzzardo
date: 2026-05-03
status: skeleton
version: 1
abstract: "Alice currently measures two cognitive modes: knowledge-telling (calibration sessions) and knowledge-transforming (journal sessions). Both depend on faculties that decline relatively late in normal aging. The cognitive reserve literature identifies insight problem solving, the ability to break an impasse and restructure a problem representation, as a faculty that declines earlier and faster than recall or fluency, because it depends on flexible right-hemisphere semantic spread that thins out before working memory or vocabulary do. This skeleton outlines a third measurement axis for Alice: an insight-task prompt class with its own baseline and its own keystroke signature, distinct from calibration. The signature of interest is bimodal: long pre-solution silence (impasse) followed by a production burst (post-restructure articulation), versus the unimodal steady-IKI signature of recitation. The same problem solved analytically and the same problem solved by insight produce different keystroke traces, and the trace is what tells you which. The measurement is deferred against the current single-subject corpus but documented here so the architecture decisions are not relitigated when the corpus warrants the build."
---

# The Aha Channel: Insight Cognition as the Earliest Axis of a Cognitive Reserve Instrument

**Anthony Guzzardo**
May 2026 (skeleton)

---

*Author's note: This is a skeleton, not a draft. It captures an idea that emerged during a calibration-prompt redesign session and was deferred for cost-benefit reasons specific to the current corpus size (n=1). The architecture is documented now so the design decisions are stable when the build becomes warranted. Section 7 specifies the conditions under which deferral is reversed.*

---

## 1. The two-axis problem

Alice's measurement architecture currently has two axes.

**Calibration sessions** elicit knowledge-telling cognition (Bereiter and Scardamalia 1987): direct memory probe and recitation, no synthesis, no emotional load. The calibration prompt pool is designed to produce stable within-subject baseline keystroke dynamics under recall mode. Drift, daily delta, and reconstruction residual are all anchored to this baseline.

**Journal sessions** elicit knowledge-transforming cognition: extended composition where the writer discovers what they want to say in the act of writing it. Journal sessions are the load-bearing measurement; calibration is their reference frame.

Both axes depend on cognitive faculties that decline relatively late in the normal aging trajectory. Recall slows, fluency narrows, sustained composition becomes more effortful, but these changes typically occur after earlier signals have already been present for years.

The earlier signals are not currently captured.

---

## 2. What is missing

The cognitive reserve literature identifies insight problem solving as one of the earliest faculties to show change. Insight depends on the ability to abandon a failed problem representation and reorganize it, often after a period of impasse. Neurally, this depends on flexible semantic spread in right anterior superior temporal cortex (Kounios and Beeman 2014), which appears to thin out earlier than the structures supporting working memory or lexical retrieval. Behaviorally, it produces the impasse-then-restructure pattern documented by Metcalfe and Wiebe (1987): "warmth" ratings stay low through the impasse, then jump suddenly at solution, in contrast to analytic problems where warmth ramps smoothly.

If Alice is meant to catch cognitive change before the subject notices it, this is the channel that warrants measurement first. Calibration and journal cannot see it because they do not induce impasse. The cognitive mode that produces the relevant signal is not exercised by either existing prompt class.

---

## 3. Why insight cannot ride on the calibration channel

A natural temptation is to add insight prompts to the calibration pool to keep the architecture simple. This destroys the calibration measurement.

Calibration baseline depends on stable, unimodal keystroke dynamics from direct memory probe. Insight tasks produce bimodal sessions: a long silent impasse followed by a burst of articulation after the restructure (Bowden et al. 2005, Kounios and Beeman 2014). Mixing bimodal sessions into a baseline that depends on unimodal recitation contaminates the very statistics the baseline is supposed to provide. Drift detection, daily delta, and reconstruction residual all consume that baseline; degrading it degrades all three downstream measurements.

The two cognitive modes are distinct enough that they require distinct measurement infrastructure. They are not noisy variants of the same thing.

---

## 4. The keystroke signature

The load-bearing claim is that insight cognition has a distinctive keystroke signature that can be detected without self-report.

**Unimodal recitation:** steady inter-key intervals, low variance in the pause distribution, smooth production rate. This is what calibration prompts elicit and what calibration baselines describe.

**Bimodal insight:** the pause distribution is strongly bimodal. A long silence corresponds to the impasse; a subsequent burst of low-IKI typing corresponds to the post-restructure articulation. The bimodality coefficient (Pfister et al. 2013) on the per-session pause distribution becomes the primary diagnostic. Sessions where the same nominal task was solved analytically rather than by insight (Kounios and Beeman 2009) should show a unimodal trace despite the same prompt. The trace, not the outcome, distinguishes the cognitive mode.

This is what makes the channel measurable from keystroke data alone. The instrument does not need to ask the subject "did it feel like an aha"; the trace tells it.

Three derived signals are sufficient for v1:

1. **Bimodality coefficient** on the within-session pause distribution.
2. **Longest impasse duration** (longest single silence prior to solution submission).
3. **Aha burst strength** (peak post-impasse production rate over a fixed window, e.g. five seconds).

A fourth signal, **time-to-solution**, is not a keystroke-derived measurement but is captured trivially from event timestamps and serves as a check against the bimodality measurement.

---

## 5. Architecture sketch

The infrastructure required is parallel to existing signal families, not novel:

- New row in `te_question_source`: insight-task prompt class. Existing `tb_questions` schema accommodates it without changes.
- New row in `te_signal_job_kind`: `insight_pipeline`. Worker handles it through the existing state machine.
- New `tb_insight_signals` table (one row per session): the four signals above plus solved/gave_up booleans and attempt count. Joins via logical FK on `question_id`. Same encryption posture as other signal tables (none; signals are derived, not subject-authored).
- New `tb_insight_baselines_history` table parallel to `tb_calibration_baselines_history`: per-subject means and trajectories for the four signals. Kept separate from the calibration baseline by construction so the calibration measurement remains clean.
- Prompt corpus in `src/lib/libInsightPrompts.ts`, parallel to `libCalibrationPrompts.ts`. Each entry pairs a prompt with its accepted solution(s) and a difficulty grade seeded from published norms (Compound Remote Associates have validated solve-rate distributions in Bowden and Jung-Beeman 2003).
- Capture surface: a new page that presents one prompt with a solve textarea and explicit "got it" and "give up" affordances. Both stamp server-side timestamps. Got-it submits the answer for canonical-match grading. Give-up reveals the answer.
- Rust signal module (`src-rs/src/insight.rs`) implementing the bimodality, impasse, and burst-strength measurements with the same provenance and reproducibility discipline as existing signal modules.

The capture surface inherits subject-content opacity from existing rules: the owner observatory may surface the prompt, the timing, the solve/give-up booleans, and the keystroke-derived signals, but never the attempt text.

---

## 6. Cadence and consumption

Insight sessions are cognitively expensive in a way calibration sessions are not. The corpus is also necessarily finite: insight cannot recur on a known problem, so each prompt is one-time-only per subject and there is no fallback when the pool runs out. Both constraints push toward a low cadence.

Proposed v1 cadence: weekly, on-demand. Not daily, not stacked with the journal question. The monastic single-question-per-day discipline is preserved because the insight task is on a different day from the journal entry, and the subject opts in rather than being prompted.

The total measurement throughput at weekly cadence is approximately fifty insight sessions per year per subject. With a starting corpus of ~60 prompts, the pool covers slightly more than one year before extension is required. Corpus extension is a once-yearly content task, not infrastructure work.

---

## 7. Why deferred

The build is approximately two to three days of focused work (schema, prompt corpus with literature norms, capture surface, Rust module, owner observatory view). Against the current corpus (n=1, the author), the cost-benefit is unfavorable: insight measurements at weekly cadence accumulate slowly, and a single subject's trajectory is not interpretable without comparison data. The architecture is documented here so the eventual build does not relitigate the design.

The deferral is reversed when any of the following hold:

1. The Alice subject pool reaches a size where weekly insight measurements accumulate fast enough to support within-cohort comparison (rough threshold: five to ten regular subjects).
2. The author's own measurement priorities shift toward earlier-warning detection in a personal-use frame, in which case the n=1 limitation is accepted and the build proceeds for personal-instrument use.
3. An external collaboration or research context warrants the measurement on a population other than the current pool.

Until one of these holds, the channel exists as a documented design and an unfilled axis in the measurement architecture.

---

## 8. Open architectural decisions left for the build

These decisions are not made in this skeleton; they are flagged so the build does not reopen them as novel questions.

- **Visible timer or invisible timer.** Visible adds time-pressure cognition, which contaminates the impasse signal by adding an external pressure source. Invisible loses ground-truth solve-time visibility for the subject. Default at build time: invisible.
- **Reveal answer on give-up.** Withholding the answer feels disrespectful and stops the subject ever knowing what it was; revealing burns the prompt's first-time-only status, which is acceptable since the prompt was given up. Default at build time: reveal on give-up only.
- **Owner observatory opacity.** Owner sees prompt, timing, solve booleans, derived signals; never the attempt text. Default at build time: enforce parity with existing journal opacity.
- **Bimodality cutoff for "this was insight".** No clinical threshold. Document the per-subject distribution and let the trajectory speak. Do not classify individual sessions as insight or analytic; treat the bimodality coefficient as a continuous measurement.

---

## 9. Relationship to other papers

This skeleton extends Option C (cognitive reserve and AI offloading) by proposing a measurement channel that targets the earliest-declining reserve faculty. It complements Option F (reconstruction validity) by adding a cognitive mode whose reconstruction residual would be a separate empirical question: can statistical reconstruction reproduce impasse-then-burst dynamics, or do those dynamics depend on structure the profile cannot capture? It is independent of Option B (construct replacement) and Option G (irreversible loss).

If built, this channel would be reported as Option K or later in the research program. The methods paper would be a parallel to Option H (residual decomposition), with the partition computed across the three insight-derived signals plus the four signals already in the calibration and journal pipelines.

---

## 10. Falsifiability

The claim that the bimodality signature distinguishes insight from analytic solving is testable. The minimal experiment, requiring no new subject recruitment, is:

1. Present the same insight problem to the same subject twice, separated by sufficient time that the second presentation is functionally novel.
2. On one trial, instruct the subject to "work it out step by step." On the other, give no strategy instruction.
3. Compare the bimodality coefficients.

If the strategy-instructed trial shows a unimodal pause distribution and the unconstrained trial shows a bimodal one, the signature is doing what the literature predicts. If the two are indistinguishable, the keystroke trace is not separating the cognitive modes and the channel does not earn its place in the architecture.

This experiment requires the build to exist. The experiment cannot be run before the build, and the build is not warranted before the experiment. The chicken-and-egg is broken by the deferral conditions in Section 7: when one of those holds, the build proceeds and the falsification experiment is the first session.
