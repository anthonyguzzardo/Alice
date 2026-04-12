# Handoff — April 12, 2026

## What Happened This Session

Built the prediction engine — the mechanism that turns Marrow's interpretive layer from storytelling into science. Then wired calibration data deeper into the system as the zero point for knowledge-transforming detection and behavioral deviation measurement.

### Prediction Engine

**The problem:** The system observed, interpreted, and generated questions but never made falsifiable predictions. Without predictions, there was no mechanism to distinguish analysis from storytelling. The AI could claim "this person is avoiding something" and never be proven wrong.

**The fix:** Every observation now generates 1-2 falsifiable predictions, grades open predictions against current session data, and updates Bayesian confidence scores per theory/topic. Every generated question is tagged with intervention intent. The architecture follows single-case experimental design methodology (Barlow & Hersen, Kazdin) and active inference (Friston, Clark).

**New tables:**
- `te_prediction_status` — open, confirmed, falsified, expired, indeterminate
- `te_prediction_type` — behavioral, thematic, phase_transition, frame_resolution
- `te_intervention_intent` — suppressed_promotion, theme_targeting, contrarian_break, frame_disambiguation, trajectory_probe, depth_test
- `tb_predictions` — the lab notebook: hypothesis, favored frame, expected/falsification criteria, topic, expiry, grade, KT score
- `tb_theory_confidence` — Bayesian Beta-Binomial confidence per theory/topic (alpha/beta updating)

**New columns on `tb_questions`:**
- `intervention_intent_id` — why the question was generated
- `intervention_rationale` — brief explanation

**Files modified:**
- `src/lib/db.ts` — 5 new tables, 2 new columns, ~15 new query functions
- `src/lib/observe.ts` — prediction grading, prediction generation, KT scoring, calibration deviation context. Token limit bumped to 3000.
- `src/lib/generate.ts` — intervention tagging output, prediction track record + leading indicators in prompt
- `src/lib/reflect.ts` — prediction analysis section (section 8), leading indicators, prediction track record in prompt
- `src/lib/signals.ts` — `computeKnowledgeTransformScore()`, `formatOpenPredictions()`, `formatPredictionTrackRecord()`, `formatLeadingIndicators()`, `formatCalibrationDeviation()`
- `src/lib/bob/helpers.ts` — `crossCorrelation()`, `COGNITIVE_WORDS` set
- `src/lib/bob/trajectory.ts` — leading indicator analysis via cross-correlation, `leadingIndicators` on TrajectoryAnalysis

### Calibration Floor Wiring

**The problem:** Calibration data was only used for context-matched baselines in observation prompts. Knowledge-transforming detection compared journal entries against other journal entries (all emotionally loaded). Predictions used raw percentiles with no anchoring to neutral behavior.

**The fix:**
- KT detection now computes a calibration floor from free-write sessions — the score of neutral writing. Real entries are measured by distance above that floor.
- Observation prompts now include calibration-relative deviation (how far each metric deviates from neutral free-write baselines, not just from journal history).
- Prediction system prompt instructs AI to prefer calibration-relative thresholds over raw percentiles.
- `getCalibrationSessionsWithText()` added to db.ts for floor computation.

### Calibration Prompt Expansion

Expanded from 15 to 200 prompts across 12 categories (routines, food, environment, objects, errands, movement, weather, media, conversations, processes, memory recall, numbers). Already randomly selected via `Math.random()`.

### Re-ran April 12 Observation

Cleared the old observation and re-ran with the full prediction pipeline. The new observation:
- Generated 2 predictions (one thematic about mom topic resurfacing, one behavioral about fragmented P-bursts on emotional topics)
- Computed knowledge-transforming score with calibration floor
- Embedded via Voyage AI (no errors)
- Suppressed question targets the mom-topic ambiguity point

## Current State of the Data

- **3 real entries:** April 10, 11, 12. April 10+11 have no session summaries (submitted before tracking). April 12 has full enriched data.
- **16 calibration sessions:** 14 pre-existing (12 pre-V3, 2 enriched) + 2 new from this session. 9 have >=10 words (usable for KT floor), but only 5 have >=20 words (the threshold for reliable floor computation).
- **1 observation** (April 12) — generated with prediction engine. Includes calibration-relative deviation.
- **2 open predictions** — one thematic (mom topic resurfacing pattern), one behavioral (fragmented bursts on emotional topics).
- **0 graded predictions** — grading starts on the next observation.
- **0 theory confidence entries** — Bayesian tracking starts on first grade.
- **Trajectory: insufficient** — needs 3 non-calibration entries with session summaries. Has 1 (April 12).
- **Leading indicators: insufficient** — needs 10+ trajectory points. Has 1.
- **KT calibration floor: marginal** — needs 5+ calibration sessions with >=20 words. Has ~5, but several are very short. More calibration sessions with real effort will stabilize the floor.
- **Generation: no-op** — still in seed phase (seeds scheduled through May 11).

## What's NOT Done

### Test Suite
Still not built. Should simulate sessions and verify: session summary → enriched signals → formatted output → prediction generation → prediction grading → Bayesian update → theory confidence.

### Trajectory → Einstein Personality
Einstein should inherit the prediction track record. A theorist with an 80% hit rate speaks differently than one at 50%. Conceptual — nothing built.

### Micro-Randomized Trial Validation
The JITAI/MRT framework could formally validate whether intervention-tagged questions produce different trajectory outcomes. Needs enough generated questions (post day 30) for statistical power.

### LIWC-style Word Category Tracking
Pennebaker research shows slopes of cognitive mechanism words matter more than levels. Could track past-tense ratio, cognitive words, emotional valence as time series across entries. Python NLP ecosystem is stronger for this.

### Within-Session KT Granularity
Current KT detection uses session-level averages. The Baaijen/Galbraith signature is about within-session transitions (short bursts → long bursts). Would need per-burst sequence data from the frontend, not just averages.

### Full DTW Implementation
Cross-correlation is a proxy for Dynamic Time Warping. Full DTW (Mesbah et al. 2024) would be more robust for non-linear temporal lag relationships. Worth implementing when data density allows.

### Sound
Bob is still visual only.

### April 10 & 11 Missing Session Data
First two real entries submitted before session tracking. No session summaries, not included in trajectory. Not fixable retroactively.

## README Audit Trail

- `README_AUDIT/V8/V8_README.md` — pre-prediction system (signal wiring era)
- `README_AUDIT/V9/V9_README.md` — prediction engine, before calibration floor
- `README_AUDIT/V10/V10_README.md` — current: prediction engine + calibration floor + calibration-relative deviation
