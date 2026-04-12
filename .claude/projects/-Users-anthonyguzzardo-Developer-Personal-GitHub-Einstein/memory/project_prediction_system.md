---
name: Prediction system architecture
description: V5 prediction engine — falsifiable predictions, Bayesian confidence, knowledge-transforming detection, leading indicators, intervention tagging
type: project
---

Prediction system added to Marrow as the experimental loop that turns interpretation into science. Built 2026-04-12.

**Why:** The system observed and interpreted but never made falsifiable predictions. Without predictions, there was no mechanism to distinguish analysis from storytelling. Research basis: SCED methodology (Barlow & Hersen, Kazdin), N-of-1 trials (Guyatt), active inference (Friston/Clark), knowledge-transforming detection (Baaijen/Galbraith), leading indicators via DTW (Mesbah 2024).

**How to apply:** Every observation now generates 1-2 predictions graded against future sessions. Bayesian Beta-Binomial updating tracks confidence per theory/topic. Questions are tagged with intervention intent. Trajectory engine computes leading indicators (which dimensions move first). Knowledge-transforming score detects whether writing produced new thinking.

**Key tables:** tb_predictions, tb_theory_confidence, te_prediction_status, te_prediction_type, te_intervention_intent. New columns on tb_questions: intervention_intent_id, intervention_rationale.

**Key functions:** savePrediction, gradePrediction, updateTheoryConfidence, computeKnowledgeTransformScore, crossCorrelation, formatOpenPredictions, formatPredictionTrackRecord, formatLeadingIndicators.

**Files modified:** db.ts, observe.ts, generate.ts, reflect.ts, signals.ts, bob/helpers.ts, bob/trajectory.ts.
