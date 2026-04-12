# Handoff — April 12, 2026

## What Happened This Session

Wired the V3 research-backed behavioral signals into Marrow's AI interpretation layer. The signals (P-bursts, deletion decomposition, MATTR, trajectory) were already captured and stored correctly but were never passed to the three systems that make decisions: observation, generation, and reflection. Now they are.

### Signal Pipeline Wiring

**The problem:** Observation, generation, and reflection were receiving ~11 raw fields in a flat template (`deletions=5 largest_deletion=36 commitment=0.38`). Meanwhile, the database had 28 fields per session and the trajectory engine computed 4D behavioral dimensions — all invisible to the AI layer.

**The fix:** Created `src/lib/signals.ts` — a formatting module that converts raw session data into research-backed verbalized formats for LLM consumption. Four exported functions:

- `formatObserveSignals()` — deep verbalized detail for single sessions (observation). Signal hierarchy: primary signals first (deletion decomposition, P-bursts, commitment with percentile context), supporting signals middle, trajectory context last.
- `formatCompactSignals()` — enriched one-liner per session for generation and reflection. Compact P-notation (`P85`), deletion decomposition inline, P-burst metrics packed.
- `formatTrajectoryContext()` — two modes: full verbalized (observe) or compact 1-line (generate/reflect). Includes phase, convergence, dimension values, velocity.
- `formatEnrichedCalibration()` — expanded calibration baselines with enriched metrics.

**Research informing the format:**
- Netflix "From Logs to Language" (2026): verbalized > template (92.9% improvement)
- Anchoring bias (2024): present baseline first, then current value
- "Lost in the Middle" (TACL 2024): primary signals first, trajectory last (primacy/recency)
- Numeracy research (2026): percentiles most intuitive for LLMs, not z-scores
- "Can You See Me Think?" (Zafar et al. 2025): feeding keystroke data to LLMs produces zero hallucinations

**Files created:**
- `src/lib/bob/helpers.ts` — extracted shared math utilities (avg, stddev, percentileRank, computeMATTR, etc.) from bob.ts
- `src/lib/signals.ts` — the formatting module

**Files modified:**
- `src/pages/api/bob.ts` — imports from helpers instead of defining inline
- `src/lib/bob/trajectory.ts` — imports from helpers instead of defining inline
- `src/lib/db.ts` — CalibrationBaseline expanded with 6 enriched fields (avgSmallDeletionCount, avgLargeDeletionCount, avgLargeDeletionChars, avgCharsPerMinute, avgPBurstCount, avgPBurstLength). SQL updated in both context-matched and global queries.
- `src/lib/observe.ts` — wired in formatObserveSignals + formatTrajectoryContext + formatEnrichedCalibration. System prompt updated with BEHAVIORAL SIGNAL GUIDE explaining corrections vs. revisions, P-bursts, revision timing, trajectory, percentiles.
- `src/lib/generate.ts` — wired in formatCompactSignals + formatTrajectoryContext. System prompt references enriched metrics and trajectory phase for question targeting.
- `src/lib/reflect.ts` — wired in formatCompactSignals + formatTrajectoryContext + formatEnrichedCalibration. System prompt section 6 (BEHAVIORAL PATTERNS) expanded with deletion decomposition, P-bursts, trajectory, momentum.
- `README.md` — rewritten to reflect current system. No version labels or changelog language. P-bursts, deletion decomposition, revision timing, MATTR, percentile normalization are now described as how Layer 2 works, not as addenda. Trajectory dimensions fixed from old names to current (fluency, deliberation, revision, expression).

### Re-ran April 12 Observation

Cleared the old observation (generated with the pre-wiring flat format) and re-ran with the new wiring. The new observation correctly uses:
- Personal percentile rankings ("0th percentile commitment")
- Deletion decomposition ("174 characters removed in one early revision plus 101 small corrections")
- Revision timing to resolve between frames ("revision concentrated early slightly favors A or C over B")
- P-burst context with baseline comparison
- Frame analysis that uses enriched data to actually distinguish between frames instead of guessing

Old stale observation embedding cleaned from tb_embeddings. New observation embedded on re-run.

### Audit Trail

- `BOB_AUDIT/V4/CHANGELOG.md` — documents what was wrong (signals trapped in Bob's pipeline, AI brain reading old dashboard, suppressed questions targeting false uncertainty, generation blind to trajectory, raw numbers bad for LLMs), what changed, research basis for signal presentation, files changed, what's not done.
- `README_AUDIT/V7/V7_README.md` — snapshot of README at this point.

## Current State of the Data

- **3 real entries:** April 10, 11, 12. April 10+11 have no session summaries (submitted before tracking). April 12 has full enriched data.
- **14 calibration sessions:** 12 pre-V3 (NULL enriched fields), 2 from April 12 with enriched data.
- **1 observation** (April 12) — generated with new enriched wiring.
- **4 witness states** in DB. Latest computed with V3 signal format.
- **Trajectory: insufficient** — needs 3 non-calibration entries with session summaries. Has 1 (April 12).
- **RAG: 11 embeddings** in tb_embeddings. Old stale observation embedding removed.
- **Generation: no-op** — still in seed phase (seeds scheduled through May 11).

## What's NOT Done

### Test Suite
Discussed in V3 handoff as agreed next step. Still not built. Should simulate sessions and verify: session summary → enriched signals → formatted output → AI interpretation → trajectory.

### Trajectory-Aware Question Targeting
Generation receives trajectory phase but the system prompt doesn't prescribe specific strategies per phase. Claude decides what to do with "phase=disrupted." Whether to make this prescriptive is an open question.

### Shape Metrics in Generation/Reflection
MATTR, sentence structure, hedging density are computed in bob.ts and used by the interpreter but not passed to generation/reflection. Left out intentionally — moderate context is the sweet spot per research.

### Trajectory → Einstein
Einstein's personality should emerge from trajectory data. Conceptual — nothing built.

### Sound
Bob is still visual only.

### April 10 & 11 Missing Session Data
First two real entries submitted before session tracking. No session summaries, not included in trajectory. Not fixable retroactively.
