# Handoff — April 12, 2026 (Session 4)

## What This Session Did

Closed four wiring gaps that left the AI reasoning layer running on outdated/incomplete data. The dynamics engine, keystroke signals, and burst sequence KT detection were all built and stored but never connected to the AI interpretation pipeline. Now they are.

---

## Gap 1: 8D Dynamics Engine → AI Layer (was: only Bob consumed it)

**Problem:** The 8D PersDyn dynamics engine (state-engine.ts, dynamics.ts) — with commitment, volatility, thermal, presence, attractor force, empirical coupling, and system entropy — was only consumed by Bob's witness renderer. The AI layer (observe, generate, reflect) was still using the legacy 4D trajectory engine (fluency, deliberation, revision, expression) with simple cross-correlation leading indicators.

**Fix:**
- New `formatDynamicsContext()` function in `signals.ts` with two modes:
  - **observe mode**: Full 8D dimension table with current state, baseline, variability, attractor force (rigid/moderate/malleable labels), deviation labels (normal/mild/notable/EXTREME), notable deviations with attractor interpretation, empirical coupling edges with active coupling predictions, rigid vs malleable dimension summaries, system entropy interpretation
  - **compact mode**: Single-line summary with all 8 dimensions, phase, velocity, entropy, top 3 couplings
- `observe.ts` — replaced `computeTrajectory()` + `formatTrajectoryContext()` + `formatLeadingIndicators()` with `computeEntryStates()` + `computeDynamics()` + `formatDynamicsContext(dynamics, 'observe')`
- `generate.ts` — same replacement, compact mode
- `reflect.ts` — same replacement, compact mode
- System prompts in all three files updated to reference 8D dynamics, attractor force, coupling, entropy, and keystroke signals

**What the AI now sees that it didn't before:** commitment dimension, volatility dimension, thermal (editing heat), presence (inverse distraction), attractor force per dimension (rigid vs malleable), empirical coupling between all 28 dimension pairs, active coupling predictions, system entropy.

### Files Modified
- `src/lib/signals.ts` — added `formatDynamicsContext()`, imported `DynamicsAnalysis` type
- `src/lib/observe.ts` — replaced trajectory with dynamics, updated system prompt
- `src/lib/generate.ts` — replaced trajectory with dynamics, updated system prompt
- `src/lib/reflect.ts` — replaced trajectory with dynamics, updated system prompt

---

## Gap 2: Within-Session Burst Sequence KT Detection (was: data captured but no algorithm)

**Problem:** `tb_burst_sequences` captured full per-burst temporal data (char count, duration, start offset) on every session, and `getBurstSequence()` existed in db.ts, but nothing ever called it. The Baaijen & Galbraith (2012) within-session knowledge-transforming signature — short fragmented bursts consolidating into longer sustained bursts — was described in the README but never detected.

**Fix:** Added a 5th component to `computeRawKTScore()` in `signals.ts`:
1. Reads burst sequence via `getBurstSequence(session.questionId)`
2. Requires ≥4 bursts (need enough data to compare halves)
3. Splits at midpoint, computes avg burst char count for each half
4. Consolidation ratio = secondHalfAvg / firstHalfAvg
5. Ratio > 1.2 → KT signal, scored as `min(1, (ratio - 1) / 1.0)` — so bursts doubling in length scores 1.0
6. Ratio < 0.7 → fragmentation (anti-KT), scores 0 for this component
7. Between 0.7–1.2 → no meaningful pattern, component skipped entirely
8. Signal messages distinguish "strong burst consolidation" (>1.5x) from "mild" (1.2–1.5x) from "burst fragmentation" (<0.7x)

**What this means:** The KT score now has 5 components instead of 4: late revision ratio, substantive revisions, MATTR vocabulary diversity, cognitive mechanism word density, and burst consolidation pattern. The Baaijen signature is the deepest available — it detects the actual cognitive transition within a single writing session, not just session-level averages.

### Files Modified
- `src/lib/signals.ts` — added burst consolidation component to `computeRawKTScore()`, imported `getBurstSequence` from db.ts

---

## Gap 3: 6 New Keystroke Signals → AI Layer (was: captured and stored but invisible to AI)

**Problem:** `inter_key_interval_mean`, `inter_key_interval_std`, `revision_chain_count`, `revision_chain_avg_length`, `scroll_back_count`, and `question_reread_count` were captured client-side, passed through respond.ts/calibrate.ts, stored in `tb_session_summaries`, but never included in `formatObserveSignals()` or `formatCompactSignals()`. The AI literally couldn't see this data.

**Fix:**
- `PersonalBaselines` interface extended with 6 new baseline arrays
- `computePersonalBaselines()` now collects historical values for all 6 signals
- `formatObserveSignals()` — new `=== KEYSTROKE DYNAMICS ===` section with three subsections:
  - **Inter-key interval dynamics** (Epp et al. 2011): mean, std, coefficient of variation with interpretation (high CV = cognitive switching, low CV = flow state), percentile context
  - **Revision chain topology** (Leijten & Van Waes 2013): chain count, avg length, percentile context, interpretation (long chains = deep structural revision, short chains = surface correction)
  - **Re-engagement behavior** (Czerwinski et al. 2004): scroll-back count with percentile and interpretation, question re-read count with percentile and interpretation
- `formatCompactSignals()` — enriched session lines now include `iki=`, `chains=`, `scrollback=`, `rereads=` fields

### Files Modified
- `src/lib/signals.ts` — extended PersonalBaselines, added keystroke section to formatObserveSignals(), added fields to formatCompactSignals()

---

## Verification

TypeScript compiles clean — zero errors in any modified file. Only pre-existing errors in `embeddings.ts` (unrelated VoyageAI type issues).

---

## Current State of the Data

- **3 real entries:** April 10, 11, 12. April 12 has full enriched data.
- **14+ calibration sessions.** All have linguistic densities. Sessions from today onward also have keystroke dynamics and scroll-back tracking.
- **0 sessions with burst sequence data.** Capture started but no sessions recorded yet — burst consolidation KT component will activate once data exists.
- **0 sessions with keystroke dynamics data.** Same — the signals will start flowing on next session.
- **1 observation** (April 12).
- **2 open predictions.**
- **Generation: still in seed phase** through ~May 11.

---

## What's NOT Done

1. **Full DTW for coupling** — dynamic time warping for dimension coupling. Cross-correlation is the current proxy in the dynamics engine. DTW would handle non-linear temporal relationships (variable lag that stretches/compresses depending on context). Not needed now — cross-correlation is reliable at current data density, and DTW needs 30-50+ entries before the difference matters. Revisit around day 60.

2. **Test suite** — still not built. No unit tests, no integration tests.

3. **Einstein interaction surface** — not started. The conversational layer that consumes everything Marrow collects.

---

## Legacy Trajectory Engine

The 4D trajectory engine (`src/lib/bob/trajectory.ts`) is still in the codebase but **no longer consumed by the AI layer**. It was replaced by the 8D dynamics engine in observe, generate, and reflect. The trajectory engine's functions (`formatTrajectoryContext`, `formatLeadingIndicators`) remain in `signals.ts` as exports but are not called. They can be removed when ready — no current consumers.
