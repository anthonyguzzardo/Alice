> **Note:** This document predates the rename from Marrow to Alice (2026-04-12).

# BOB_AUDIT V4 — Signal Pipeline Wiring

## What Was Wrong With V3

V3 got the science right. The signals were research-backed, the normalization was honest, the trajectory dimensions were validated. But it was all trapped in Bob's visual pipeline.

### The AI brain was reading the old dashboard

Observation, generation, and reflection — the three systems that actually make decisions about this person — were still receiving V1-era behavioral data: a flat template with ~11 raw fields.

```
device=desktop hour=21 keystroke_latency=47000ms duration=240000ms
commitment=0.38 pauses=2 deletions=5 largest_deletion=36
tab_aways=1 words=187
```

Meanwhile, the database had 28 fields per session. P-burst metrics, deletion decomposition, revision timing, active typing time — all captured, all stored, all invisible to the interpretation layer.

### The three-frame analysis was guessing unnecessarily

The observation system applied charitable, avoidance, and mundane frames to behavioral signals. But it couldn't tell whether 5 deletions were 5 typo fixes or 1 substantive revision plus 4 backspaces. It saw `deletions=5, largest_deletion=36` and had to speculate about the ratio. The data to resolve this existed in the database. It just wasn't passed through.

### The suppressed questions were targeting false uncertainty

Suppressed questions are designed to disambiguate between Frame A and Frame B. But if the frames are built on incomplete data, the uncertainty they're disambiguating might be an artifact of missing signal, not genuine interpretive ambiguity. Give the system `corrections=4 revisions=1(36chars,late)` and the Frame A vs. Frame B question changes entirely — now it's about why they gutted a sentence after drafting, not whether 5 generic deletions mean anything at all.

### Question generation was blind to trajectory

The trajectory engine computed phase (stable/shifting/disrupted), convergence (did dimensions move together?), and velocity (how fast is the behavioral fingerprint changing?) — and none of it reached the question generator. Claude was choosing what to ask tomorrow without knowing whether the person's writing behavior was stable, in flux, or just broke pattern.

A disrupted phase should change question strategy. A shifting phase means something is evolving and should be followed. Generation had no access to this.

### Calibration baselines were incomplete

The calibration system returned 5 averages (keystroke latency, commitment, duration, pauses, deletions). The enriched fields (small/large deletion split, P-burst metrics, typing speed) had no calibration baselines at all. The system could tell you "your average deletion count is 4.2" but couldn't tell you "your average number of substantive revisions is 0.8."

### Raw numbers are bad input for LLMs

This isn't a Marrow-specific problem. Research confirms it:

- LLMs internally encode number magnitudes but verbally reason about them with 50-70% accuracy (arXiv:2602.07812, 2026)
- Converting structured log data to natural language yields 92.9% improvement over template-based formats (Netflix "From Logs to Language," 2026)
- Percentiles on a 0-100 scale are the most intuitive numerical format for LLMs — z-scores add cognitive load, raw values require holding baselines in working memory (numeracy research, 2026)
- LLMs anchor to the first number presented (~37% retention) — baseline-first ordering exploits this usefully (anchoring bias studies, 2024)

Marrow was sending `commitment=0.38` and expecting Claude to know what that means for this person. It should have been sending: "Commitment: 38% of typed text kept (4th percentile — very low for you; baseline 65%)."

---

## What V4 Changes

### Shared math helpers extracted

`src/lib/bob/helpers.ts` — `avg`, `variance`, `stddev`, `clamp`, `percentileRank`, `rescaleDelta`, `normVariance`, `computeMATTR`, word sets. Previously duplicated across `bob.ts` (API route) and `trajectory.ts`. Now imported by both, plus the new signals module.

### Calibration baselines expanded

`CalibrationBaseline` interface now includes 6 enriched fields: `avgSmallDeletionCount`, `avgLargeDeletionCount`, `avgLargeDeletionChars`, `avgCharsPerMinute`, `avgPBurstCount`, `avgPBurstLength`. SQL AVG naturally skips NULLs, so pre-V3 calibration sessions contribute only to the original 5 fields. Backward compatible.

### Signal formatting module

`src/lib/signals.ts` — four exported functions, each research-informed:

**`formatObserveSignals`** — Deep verbalized detail for a single session (used by observation). Signal hierarchy follows "Lost in the Middle" (TACL 2024): primary signals first (deletion decomposition, P-bursts, commitment), supporting signals middle (duration, pauses, tab-aways), trajectory context last (recency effect). Each metric verbalized with percentile context and personal baseline anchoring.

**`formatCompactSignals`** — Enriched one-liner per session (used by generation and reflection). Compact P-notation (`P85` = 85th percentile), deletion decomposition inline (`corrections=4 revisions=1(36chars,late)`), P-burst metrics packed (`bursts=5x42chars`). Pre-V3 sessions get legacy format with `[pre-V3]` suffix.

**`formatTrajectoryContext`** — Two modes. `observe` mode: full verbalized block with phase explanation, convergence meaning, dimension values, notable deviations called out. `compact` mode: single line for generation/reflection.

**`formatEnrichedCalibration`** — Expanded calibration baselines with enriched metrics when available, confidence guidance.

### Observation wired

`src/lib/observe.ts` now receives:
- Enriched behavioral signals with personal percentile context
- Deletion decomposition (corrections vs. revisions with timing)
- P-burst metrics with baseline comparison
- Trajectory context (phase, convergence, dimension values)
- Expanded calibration baselines

System prompt updated with BEHAVIORAL SIGNAL GUIDE: explains corrections vs. revisions (Faigley & Witte), P-bursts (Chenoweth & Hayes), revision timing, trajectory dimensions, and percentile interpretation. Tells Claude that primary signals appear first and trajectory context appears last.

### Generation wired

`src/lib/generate.ts` now receives:
- Compact enriched behavioral lines with percentile context
- Trajectory phase + convergence as meta-signal
- System prompt references enriched metrics and instructs: use trajectory phase to detect behavioral shifts, "disrupted" means probe what changed, "shifting" means follow the thread

### Reflection wired

`src/lib/reflect.ts` now receives:
- Compact enriched behavioral lines with percentile context
- Trajectory context
- Expanded calibration baselines with enriched metrics
- System prompt section 6 (BEHAVIORAL PATTERNS) expanded: references deletion decomposition, P-burst trends, trajectory phase/convergence, percentile normalization

### README updated

- Trajectory dimensions fixed from V2 names (engagement, processing, revision, structure) to V3 names (fluency, deliberation, revision, expression) with research citations
- V3 enriched metrics documented in Data Collection section
- Signal pipeline wiring documented (capture → normalize → verbalize → feed to all AI systems)

---

## Research Basis for Signal Presentation

This wiring is informed by LLM prompt engineering research, not intuition:

- **Netflix "From Logs to Language" (2026, arXiv:2602.20558)** — Converting structured log data to natural language rewrites yielded 92.9% relative improvement over template-based baselines. Syntax normalization, noise filtering, preference summarization.
- **"Can You See Me Think?" (Zafar, Yousaf, Minhas, 2025, arXiv:2508.13543)** — Ablation study: LLM + keystroke logs produced zero hallucinations when behavioral comments were spot-checked against actual keystroke events. Organization scores significantly improved. Directly validates feeding writing process data to LLMs.
- **"Lost in the Middle" (Liu et al., TACL 2024)** — U-shaped attention: LLMs attend most to beginning and end of context, middle falls into dead zone. Primary signals placed first, trajectory context placed last.
- **Anchoring bias (2024, arXiv:2412.06593)** — LLMs retain ~37% of anchor numbers. Expert-opinion anchors most persuasive. Applied: present personal baseline first (anchor), then current value (deviation from anchor).
- **"Does Prompt Formatting Have Any Impact on LLM Performance?" (2024, arXiv:2411.10541)** — Labeled structured sections outperform flat text. JSON performed best on average. Larger models more robust to format changes. Applied: named sections with importance markers.
- **Numeracy research (2026, arXiv:2602.07812)** — LLMs encode log-magnitudes internally with ~2.3% error but reason verbally at 50-70% accuracy. Percentiles map to natural language concepts ("higher than 85% of previous sessions"). Z-scores require understanding standard deviation units. Applied: percentile normalization for all metrics.
- **"Prompting a Weighting Mechanism into LLM-as-a-Judge" (2025, arXiv:2502.13396)** — Explicit importance weighting improved Human Alignment Rate by 6%. Applied: "Primary signal:" / "Supporting context:" labels.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/bob/helpers.ts` | **NEW** — extracted shared math utilities from bob.ts |
| `src/lib/signals.ts` | **NEW** — signal formatting module (formatObserveSignals, formatCompactSignals, formatTrajectoryContext, formatEnrichedCalibration) |
| `src/pages/api/bob.ts` | Imports from helpers instead of defining inline |
| `src/lib/bob/trajectory.ts` | Imports from helpers instead of defining inline |
| `src/lib/db.ts` | CalibrationBaseline expanded (+6 enriched fields), getCalibrationBaselines SQL expanded |
| `src/lib/observe.ts` | Wired: formatObserveSignals + formatTrajectoryContext + formatEnrichedCalibration + system prompt behavioral signal guide |
| `src/lib/generate.ts` | Wired: formatCompactSignals + formatTrajectoryContext + system prompt enriched metrics reference |
| `src/lib/reflect.ts` | Wired: formatCompactSignals + formatTrajectoryContext + formatEnrichedCalibration + system prompt section 6 expanded |
| `README.md` | Fixed V2→V3 trajectory dimensions, added V3 enriched metrics documentation |

## What V3's "NOT Done" List Now Looks Like

| V3 Item | V4 Status |
|---|---|
| Trajectory → generation integration | **DONE** — trajectory phase + convergence passed to generation as meta-signal |
| Trajectory → Einstein | Still conceptual — nothing built |
| Sound | Still visual only |
| Test suite | Not built |

## What's NOT in V4

- **Test suite.** Discussed in V3 handoff as agreed next step. Still not built. Should simulate sessions and verify the full pipeline: session summary → enriched signals → trajectory → formatted output → AI interpretation.
- **Trajectory-aware question targeting.** Generation receives trajectory phase but the system prompt doesn't prescribe specific strategies per phase (e.g., "disrupted → grounding question" vs. "stable → go deeper"). Claude decides. Whether to make this more prescriptive is an open question — more prescription means less flexibility, but it also means more predictable behavior.
- **Shape metrics in generation/reflection.** MATTR, sentence structure, hedging density are computed in bob.ts and used by the interpreter, but not passed through to generation/reflection. These are expression-layer signals — relevant for trajectory but potentially noise for question generation. Left out intentionally to keep moderate context (time-series research says more detail can degrade performance past a sweet spot).
- **Momentum metrics in generation.** Recent-vs-all-time deltas (commitment trending up, typing speed declining) are computed in bob.ts but only partially surfaced. The trajectory's velocity metric captures similar information at a higher level of abstraction. Could be added if trajectory alone proves insufficient.
- **Calibration baseline enrichment for specific contexts.** The expanded calibration baselines use SQL AVG which skips NULLs gracefully, but there's no logic to flag "your calibration data predates enrichment — enriched baselines unavailable." The system handles this silently (fields are null, formatter omits them). Could be made explicit.

## Open Questions

1. **Should generation prescribe phase-specific strategies?** Currently Claude receives "phase=disrupted" and decides what to do. Should the system prompt say "if disrupted, ask a grounding question, not a probing one"? The three-frame analysis already provides structured interpretive disagreement — adding generation strategies would be a second layer of structured behavior.

2. **When does trajectory become reliable?** Currently requires 3 non-calibration entries with session summaries. But z-scores with 3 data points are noisy. At what point should the system promote trajectory from "context" to "primary signal"? Probably 10-15 entries with enriched data.

3. **Should the observation layer see trajectory history?** Currently it sees the latest point. Should it see the last 5 points to detect trends itself, or is that the trajectory engine's job?
