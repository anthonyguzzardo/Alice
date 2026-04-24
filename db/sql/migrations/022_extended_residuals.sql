-- Migration 022: Extended reconstruction residuals
--
-- Adds a JSONB column to store per-signal {real, avatar, residual} triples
-- for the 28 new Phase 1-5 signals included in ghost comparison.
-- Existing fixed columns remain for the original 13 signals.

SET search_path = alice, public;

ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN extended_residuals_json JSONB;

COMMENT ON COLUMN tb_reconstruction_residuals.extended_residuals_json IS
  'Per-signal triples for Phase 1-5 signals: { signalName: { real, avatar, residual } }. '
  'Signals: 26 dynamical (mfdfa, psd, ordinal, recurrence network, causal, pid, dmd) + 2 motor (mse complexity_index, fisher_trace). '
  'Norms in dynamical_l2_norm / motor_l2_norm / behavioral_l2_norm include these signals.';
