-- Partition residual aggregation: behavioral (paper-scoped) vs semantic (stored, future work).
--
-- The reconstruction adversary validates motor and dynamical signals.
-- Semantic residuals (real coherent text vs Markov word salad) measure a
-- trivially explained difference and carry no discriminative information
-- across sessions. They remain stored for longitudinal analysis under a
-- self-referencing baseline (Phase 2), but are excluded from the reported
-- residual vector.
--
-- behavioral_l2_norm = L2(dynamical + motor + perplexity residuals)
-- behavioral_residual_count = count of finite residuals in that set
--
-- total_l2_norm and residual_count are preserved for backward compatibility
-- but are no longer the paper-reported aggregate.

SET search_path = alice, public;

ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN behavioral_l2_norm         DOUBLE PRECISION,
  ADD COLUMN behavioral_residual_count  INT;

COMMENT ON COLUMN tb_reconstruction_residuals.behavioral_l2_norm IS
  'L2 norm of dynamical + motor + perplexity residuals only. Paper-reported aggregate. Excludes semantic residuals.';

COMMENT ON COLUMN tb_reconstruction_residuals.behavioral_residual_count IS
  'Count of finite residuals in dynamical + motor + perplexity families. Excludes semantic residuals.';
