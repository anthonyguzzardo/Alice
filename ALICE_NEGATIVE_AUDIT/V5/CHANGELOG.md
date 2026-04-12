> **Note:** This document predates the renames: Marrow → Alice, Bob → Alice Negative, Einstein → Bob (2026-04-12).

# V5 Changelog — Prediction Engine

## What Was Wrong

The system observed, interpreted, and generated questions — but never made falsifiable predictions. Without predictions, there was no mechanism to distinguish analysis from storytelling. The AI could claim "this person is avoiding something" and never be proven wrong because it never committed to a testable consequence of that claim.

Additionally:
- Questions were generated without metadata about *why* they were chosen (no intervention tagging)
- Trajectory detected phases but never predicted transitions before they happened
- No mechanism to detect whether writing sessions produced new thinking vs. recited existing knowledge
- No cross-dimensional analysis to discover which behavioral dimensions lead others for this specific person

## What Changed

### Prediction System (Single-Case Experimental Design)

**New tables:**
- `te_prediction_status` — open, confirmed, falsified, expired, indeterminate
- `te_prediction_type` — behavioral, thematic, phase_transition, frame_resolution
- `te_intervention_intent` — suppressed_promotion, theme_targeting, contrarian_break, frame_disambiguation, trajectory_probe, depth_test
- `tb_predictions` — the lab notebook: hypothesis, favored frame, expected signature, falsification criteria, target topic, expiry window, grade, rationale
- `tb_theory_confidence` — Bayesian Beta-Binomial confidence tracking per theory/topic combination

**New columns on `tb_questions`:**
- `intervention_intent_id` — why the question was generated
- `intervention_rationale` — brief explanation of strategic intent

### Observation Pipeline Changes (observe.ts)

Every observation now:
1. **Grades open predictions** — checks each pending prediction against today's behavioral data. Outputs GRADE lines (CONFIRMED/FALSIFIED/INDETERMINATE/EXPIRED with rationale).
2. **Updates theory confidence** — Bayesian Beta-Binomial update on each grade. Alpha increments on confirmation, beta on falsification.
3. **Generates 1-2 new predictions** — each with hypothesis, favored frame, expected behavioral signature, falsification criteria, and topic tag.
4. **Computes knowledge-transforming score** — detects whether the session produced new thinking (Baaijen/Galbraith signature).
5. **Expires old predictions** — predictions past their session window are auto-expired.

System prompt now includes PREDICTION GRADES section (when open predictions exist) and PREDICTIONS section.

### Generation Pipeline Changes (generate.ts)

Every generated question now:
1. **Receives prediction track record** — hit rate, theory confidence scores, recent graded predictions
2. **Receives leading indicator analysis** — which trajectory dimensions lead for this person
3. **Outputs intervention intent** — one of 6 tags explaining why this question was chosen
4. **Tags the question in DB** — intervention_intent_id and rationale stored on tb_questions

### Reflection Pipeline Changes (reflect.ts)

Weekly reflection now:
1. **Receives prediction track record** — full stats, theory confidence, recent grades
2. **Receives leading indicator analysis** — cross-dimensional lag relationships
3. **Includes PREDICTION ANALYSIS section** — reviews which prediction types are most reliable, patterns in hits vs. misses, leading indicator usefulness

### Trajectory Engine Changes (trajectory.ts)

- **Leading indicator analysis** via cross-correlation with lag (Mesbah et al. 2024)
- For each pair of dimensions (fluency, deliberation, revision, expression), computes which leads the other and by how many sessions
- Requires 10+ data points to report
- Returns `leadingIndicators` array on TrajectoryAnalysis

### Signal Formatting Changes (signals.ts)

New functions:
- `computeKnowledgeTransformScore()` — detects Baaijen/Galbraith knowledge-transforming signature from available session data + response text. Uses: late revision ratio, substantive revision count, MATTR, cognitive mechanism word density (Pennebaker).
- `formatOpenPredictions()` — formats pending predictions for the observation prompt
- `formatPredictionTrackRecord()` — formats stats, theory confidence, and recent grades for generation/reflection
- `formatLeadingIndicators()` — formats cross-correlation results

### Math Utilities Changes (bob/helpers.ts)

New functions:
- `crossCorrelation()` — Pearson correlation with lag between two named time series
- `COGNITIVE_WORDS` — word set for cognitive mechanism detection (Pennebaker LIWC)

## Research Basis

- **SCED**: Barlow & Hersen (1984), Kazdin (2011) — stable baseline → intervention → measured outcome
- **N-of-1 trials**: Guyatt et al. (1986), Bayesian updating — sequential hypothesis-test cycles for individuals
- **Active inference**: Friston (2006, 2010), Clark (2013) — prediction error is the learning signal; post-hoc explanation ≠ learning
- **Knowledge-transforming**: Baaijen, Galbraith & de Glopper (2012) — detectable signature in pause-burst patterns, revisions, vocabulary
- **Leading indicators**: Mesbah et al. (2024) — DTW on individual trajectories reveals which dimensions lead
- **Pennebaker LIWC**: trajectory of cognitive mechanism words predicts benefit; slopes > levels
- **Idiographic science**: Fisher et al. (2018, PNAS), Molenaar (2004) — group patterns don't apply to individuals
- **Reflective Agency**: Kim et al. (2025, MIT Media Lab) — over-automation erodes agency; preserve interpretive space

## Files Changed

- `src/lib/db.ts` — 5 new tables, 2 new columns, 12 new query functions
- `src/lib/observe.ts` — prediction grading, prediction generation, knowledge-transforming scoring
- `src/lib/generate.ts` — intervention tagging, prediction track record in prompt
- `src/lib/reflect.ts` — prediction analysis section, leading indicators in prompt
- `src/lib/signals.ts` — 5 new exported functions for prediction/KT/leading indicator formatting
- `src/lib/bob/helpers.ts` — cross-correlation, cognitive word set
- `src/lib/bob/trajectory.ts` — leading indicator analysis via cross-correlation

## What's NOT Done

### Prediction → Einstein Personality
Einstein should inherit the prediction track record and use it to calibrate conviction. A theorist with a 80% hit rate on behavioral predictions speaks differently than one at 50%. Not built.

### Micro-Randomized Trial Validation
The JITAI/MRT framework (Murphy et al., Harvard) could formally validate whether intervention-tagged questions produce different trajectory outcomes. Would require enough generated questions (post day 30) to have statistical power.

### LIWC-style Longitudinal Word Category Tracking
Pennebaker's research shows slopes of cognitive mechanism words matter more than levels. Could track past-tense ratio, cognitive words, emotional valence across entries as a time series. Python NLP ecosystem is stronger for this.

### Knowledge-Transforming Within-Session Granularity
Current KT detection uses session-level averages. Baaijen/Galbraith's signature is about *within-session* transitions (short bursts → long bursts). Would need per-burst data from the frontend, not just averages.

### DTW Full Implementation
Cross-correlation is a simpler proxy for DTW. Full DTW (Mesbah et al.) would be more robust for non-linear temporal relationships. Worth implementing when data density allows.
