-- 010_add_adversary_variants.sql
--
-- Multiple adversary variants for reconstruction residual comparison.
-- Each variant uses a different text generation and/or timing synthesis
-- strategy, enabling direct measurement of which statistical improvement
-- closes the most reconstruction residual.
--
-- Depends on: tb_reconstruction_residuals (005), tb_personal_profile (004),
--             tb_motor_signals (001)

SET search_path = alice, public;

-- ── Enum table: adversary variant definitions ─────────────────────────

-- PURPOSE: Static enumeration of ghost adversary strategies
-- USE CASE: Discriminator for reconstruction residual rows
-- MUTABILITY: Static after deploy
-- REFERENCED BY: tb_reconstruction_residuals.adversary_variant_id
-- FOOTER: None (enum table)

CREATE TABLE IF NOT EXISTS te_adversary_variants (
   adversary_variant_id  SMALLINT PRIMARY KEY
  ,name                  TEXT NOT NULL UNIQUE
  ,description           TEXT
);

INSERT INTO te_adversary_variants (adversary_variant_id, name, description) VALUES
   (1, 'baseline',            'Order-2 Markov + independent ex-Gaussian timing')
  ,(2, 'conditional_timing',  'Order-2 Markov + AR(1) conditioned IKI')
  ,(3, 'copula_motor',        'Order-2 Markov + Gaussian copula hold/flight')
  ,(4, 'ppm_text',            'Variable-order PPM + independent timing')
  ,(5, 'full_adversary',      'PPM + AR(1) + copula')
ON CONFLICT (adversary_variant_id) DO NOTHING;

-- ── Extend reconstruction residuals with variant discriminator ────────

ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN IF NOT EXISTS adversary_variant_id SMALLINT NOT NULL DEFAULT 1;

-- Replace single-column unique with composite unique
ALTER TABLE tb_reconstruction_residuals
  DROP CONSTRAINT IF EXISTS tb_reconstruction_residuals_question_id_key;

ALTER TABLE tb_reconstruction_residuals
  ADD CONSTRAINT tb_reconstruction_residuals_question_variant_uq
  UNIQUE (question_id, adversary_variant_id);

-- ── Extend personal profile for new variant inputs ────────────────────

ALTER TABLE tb_personal_profile
  ADD COLUMN IF NOT EXISTS iki_autocorrelation_lag1_mean DOUBLE PRECISION;

ALTER TABLE tb_personal_profile
  ADD COLUMN IF NOT EXISTS hold_flight_rank_correlation DOUBLE PRECISION;

-- ── Add per-session hold/flight rank correlation to motor signals ─────

ALTER TABLE tb_motor_signals
  ADD COLUMN IF NOT EXISTS hold_flight_rank_corr DOUBLE PRECISION;
