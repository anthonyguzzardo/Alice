-- 005_add_reconstruction_residuals.sql
--
-- Reconstruction residual: per-session delta between real signals and
-- Markov avatar signals. Measures what in a person's behavior CANNOT
-- be predicted by their own statistical profile.
--
-- Depends on: tb_personal_profile (004), all signal tables (001)

SET search_path = alice, public;

CREATE TABLE IF NOT EXISTS tb_reconstruction_residuals (
   reconstruction_residual_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                  INT NOT NULL UNIQUE

  -- ── Avatar generation metadata ──────────────────────────────────────
  ,avatar_text                  TEXT
  ,avatar_word_count            INT
  ,avatar_markov_order          SMALLINT
  ,avatar_chain_size            INT
  ,avatar_i_burst_count         INT
  ,real_word_count              INT
  ,corpus_size                  INT
  ,session_count                INT

  -- ── Perplexity comparison (Markov model) ────────────────────────────
  ,real_perplexity              DOUBLE PRECISION
  ,real_known_fraction          DOUBLE PRECISION
  ,avatar_perplexity            DOUBLE PRECISION
  ,avatar_known_fraction        DOUBLE PRECISION
  ,perplexity_residual          DOUBLE PRECISION

  -- ── Dynamical signal residuals ──────────────────────────────────────
  ,real_permutation_entropy     DOUBLE PRECISION
  ,avatar_permutation_entropy   DOUBLE PRECISION
  ,residual_permutation_entropy DOUBLE PRECISION

  ,real_pe_spectrum             JSONB
  ,avatar_pe_spectrum           JSONB
  ,residual_pe_spectrum         JSONB

  ,real_dfa_alpha               DOUBLE PRECISION
  ,avatar_dfa_alpha             DOUBLE PRECISION
  ,residual_dfa_alpha           DOUBLE PRECISION

  ,real_rqa_determinism         DOUBLE PRECISION
  ,avatar_rqa_determinism       DOUBLE PRECISION
  ,residual_rqa_determinism     DOUBLE PRECISION

  ,real_rqa_laminarity          DOUBLE PRECISION
  ,avatar_rqa_laminarity        DOUBLE PRECISION
  ,residual_rqa_laminarity      DOUBLE PRECISION

  ,real_te_dominance            DOUBLE PRECISION
  ,avatar_te_dominance          DOUBLE PRECISION
  ,residual_te_dominance        DOUBLE PRECISION

  -- ── Motor signal residuals ──────────────────────────────────────────
  ,real_sample_entropy          DOUBLE PRECISION
  ,avatar_sample_entropy        DOUBLE PRECISION
  ,residual_sample_entropy      DOUBLE PRECISION

  ,real_motor_jerk              DOUBLE PRECISION
  ,avatar_motor_jerk            DOUBLE PRECISION
  ,residual_motor_jerk          DOUBLE PRECISION

  ,real_lapse_rate              DOUBLE PRECISION
  ,avatar_lapse_rate            DOUBLE PRECISION
  ,residual_lapse_rate          DOUBLE PRECISION

  ,real_tempo_drift             DOUBLE PRECISION
  ,avatar_tempo_drift           DOUBLE PRECISION
  ,residual_tempo_drift         DOUBLE PRECISION

  ,real_ex_gaussian_tau         DOUBLE PRECISION
  ,avatar_ex_gaussian_tau       DOUBLE PRECISION
  ,residual_ex_gaussian_tau     DOUBLE PRECISION

  ,real_tau_proportion          DOUBLE PRECISION
  ,avatar_tau_proportion        DOUBLE PRECISION
  ,residual_tau_proportion      DOUBLE PRECISION

  -- ── Semantic signal residuals ───────────────────────────────────────
  ,real_idea_density            DOUBLE PRECISION
  ,avatar_idea_density          DOUBLE PRECISION
  ,residual_idea_density        DOUBLE PRECISION

  ,real_lexical_sophistication  DOUBLE PRECISION
  ,avatar_lexical_sophistication DOUBLE PRECISION
  ,residual_lexical_sophistication DOUBLE PRECISION

  ,real_epistemic_stance        DOUBLE PRECISION
  ,avatar_epistemic_stance      DOUBLE PRECISION
  ,residual_epistemic_stance    DOUBLE PRECISION

  ,real_integrative_complexity  DOUBLE PRECISION
  ,avatar_integrative_complexity DOUBLE PRECISION
  ,residual_integrative_complexity DOUBLE PRECISION

  ,real_deep_cohesion           DOUBLE PRECISION
  ,avatar_deep_cohesion         DOUBLE PRECISION
  ,residual_deep_cohesion       DOUBLE PRECISION

  ,real_text_compression_ratio  DOUBLE PRECISION
  ,avatar_text_compression_ratio DOUBLE PRECISION
  ,residual_text_compression_ratio DOUBLE PRECISION

  -- ── Aggregate norms ─────────────────────────────────────────────────
  ,dynamical_l2_norm            DOUBLE PRECISION
  ,motor_l2_norm                DOUBLE PRECISION
  ,semantic_l2_norm             DOUBLE PRECISION
  ,total_l2_norm                DOUBLE PRECISION
  ,residual_count               INT

  -- ── Footer ──────────────────────────────────────────────────────────
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
);

COMMENT ON TABLE tb_reconstruction_residuals IS
'PURPOSE: Per-session delta between real signals and Markov avatar signals.
USE CASE: Measures what in a person''s behavior cannot be predicted by their own statistical profile. The residual is the cognitive signature.
MUTABILITY: Insert once per session after profile update. Recomputable from stored data.
REFERENCED BY: convergence tracking, observatory.
FOOTER: created only (append-only).';
