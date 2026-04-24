-- Phase 5: Pause mixture decomposition (INC-012)
-- Data-driven process separation via lognormal mixture EM (Baaijen et al. 2021)

SET search_path = alice, public;

ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS pause_mixture_component_count      INT,
  ADD COLUMN IF NOT EXISTS pause_mixture_motor_proportion     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pause_mixture_cognitive_load_index  DOUBLE PRECISION;

COMMENT ON COLUMN tb_dynamical_signals.pause_mixture_component_count IS 'Number of lognormal mixture components (BIC-selected, typically 2).';
COMMENT ON COLUMN tb_dynamical_signals.pause_mixture_motor_proportion IS 'Mixing proportion of fastest component (motor execution). Higher = more automatic.';
COMMENT ON COLUMN tb_dynamical_signals.pause_mixture_cognitive_load_index IS 'Reflective proportion / motor proportion. Higher = more deliberation relative to automatic execution.';
