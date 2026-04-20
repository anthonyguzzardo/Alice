-- ============================================================================
-- Migration 001: Move all tables from public to alice schema
-- ============================================================================
-- One-time migration. Run after creating the alice schema.
-- Safe to re-run (IF EXISTS guards on every statement).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS alice;

-- Enum tables
ALTER TABLE IF EXISTS public.te_question_source SET SCHEMA alice;
ALTER TABLE IF EXISTS public.te_reflection_type SET SCHEMA alice;
ALTER TABLE IF EXISTS public.te_interaction_event_type SET SCHEMA alice;
ALTER TABLE IF EXISTS public.te_prompt_trace_type SET SCHEMA alice;
ALTER TABLE IF EXISTS public.te_embedding_source SET SCHEMA alice;
ALTER TABLE IF EXISTS public.te_context_dimension SET SCHEMA alice;

-- Core mutable tables
ALTER TABLE IF EXISTS public.tb_questions SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_responses SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_interaction_events SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_reflections SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_question_feedback SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_session_summaries SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_prompt_traces SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_embeddings SET SCHEMA alice;

-- Witness, state, dynamics, coupling tables
ALTER TABLE IF EXISTS public.tb_witness_states SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_burst_sequences SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_session_metadata SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_calibration_baselines_history SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_session_events SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_entry_states SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_trait_dynamics SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_coupling_matrix SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_emotion_behavior_coupling SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_semantic_states SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_semantic_dynamics SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_semantic_coupling SET SCHEMA alice;

-- Signal tables
ALTER TABLE IF EXISTS public.tb_dynamical_signals SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_motor_signals SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_semantic_signals SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_process_signals SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_cross_session_signals SET SCHEMA alice;

-- Calibration & context tables
ALTER TABLE IF EXISTS public.tb_calibration_context SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_session_delta SET SCHEMA alice;
ALTER TABLE IF EXISTS public.tb_paper_comments SET SCHEMA alice;

-- Archive tables (if they exist from prior migrations)
ALTER TABLE IF EXISTS public.zz_archive_entry_states_8d_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_trait_dynamics_8d_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_coupling_matrix_8d_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_predictions_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_theory_confidence_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_ai_observations_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_ai_suppressed_questions_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_question_candidates_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_prediction_status_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_prediction_type_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_grade_method_20260416 SET SCHEMA alice;
ALTER TABLE IF EXISTS public.zz_archive_intervention_intent_20260416 SET SCHEMA alice;
