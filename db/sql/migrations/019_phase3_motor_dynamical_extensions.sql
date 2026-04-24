-- Phase 3: Motor extensions, criticality, modal stability, causal scale (INC-012)
-- Motor: MSE (Costa 2002), Fisher information (Karunanithi 2008)
-- Dynamical: Causal emergence (Hoel 2013), PID (Williams-Beer 2010),
--            Branching ratio (Beggs-Plenz 2003), DMD (Brunton 2022)

SET search_path = alice, public;

-- Motor signal extensions
ALTER TABLE tb_motor_signals
  ADD COLUMN IF NOT EXISTS mse_series                    JSONB,
  ADD COLUMN IF NOT EXISTS complexity_index               DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ex_gaussian_fisher_trace       DOUBLE PRECISION;

-- Causal emergence (Hoel et al. 2013)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS effective_information          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS causal_emergence_index         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS optimal_causal_scale           INT;

-- Partial Information Decomposition (Williams & Beer 2010)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS pid_synergy                   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pid_redundancy                DOUBLE PRECISION;

-- Criticality estimation (Beggs & Plenz 2003; Clauset et al. 2009)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS branching_ratio               DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS avalanche_size_exponent        DOUBLE PRECISION;

-- Dynamic Mode Decomposition (Brunton et al. 2022)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS dmd_dominant_frequency         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dmd_dominant_decay_rate        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dmd_mode_count                 INT,
  ADD COLUMN IF NOT EXISTS dmd_spectral_entropy           DOUBLE PRECISION;

COMMENT ON COLUMN tb_motor_signals.mse_series IS 'Multiscale entropy: SampEn at scales 1-5 (JSONB array). Costa et al. 2002.';
COMMENT ON COLUMN tb_motor_signals.complexity_index IS 'Sum of SampEn across scales 1-5. Cardiac gold standard for multi-scale complexity discrimination.';
COMMENT ON COLUMN tb_motor_signals.ex_gaussian_fisher_trace IS 'Trace of 3x3 Fisher information matrix at fitted ex-Gaussian (mu,sigma,tau). Meta-measurement: session informativeness.';
COMMENT ON COLUMN tb_dynamical_signals.effective_information IS 'EI at optimal coarse-graining scale. Causal power of the dynamics (Hoel 2013).';
COMMENT ON COLUMN tb_dynamical_signals.causal_emergence_index IS 'Max macro EI - micro EI. Positive = causal emergence (macro captures more causal structure).';
COMMENT ON COLUMN tb_dynamical_signals.optimal_causal_scale IS 'Bin count (8/4/2) at which EI is maximized. Fine-to-coarse migration indicates resolution degradation.';
COMMENT ON COLUMN tb_dynamical_signals.pid_synergy IS 'Information in (hold,flight) jointly that neither carries alone (Williams-Beer I_min). Motor-cognitive integration.';
COMMENT ON COLUMN tb_dynamical_signals.pid_redundancy IS 'Overlapping information between hold and flight channels (Williams-Beer I_min).';
COMMENT ON COLUMN tb_dynamical_signals.branching_ratio IS 'Direct criticality test. 1.0 = critical. <1 = subcritical (rigid). >1 = supercritical (unstable). Threshold: mean+1*std.';
COMMENT ON COLUMN tb_dynamical_signals.avalanche_size_exponent IS 'Power-law exponent of avalanche size distribution (Clauset 2009). Second independent criticality test.';
COMMENT ON COLUMN tb_dynamical_signals.dmd_dominant_frequency IS 'Frequency of strongest dynamical mode from DMD eigenvalue decomposition (Hz).';
COMMENT ON COLUMN tb_dynamical_signals.dmd_dominant_decay_rate IS 'Decay rate of dominant DMD mode. <0 = damped (stable). >0 = growing (unstable).';
COMMENT ON COLUMN tb_dynamical_signals.dmd_mode_count IS 'Number of dynamical modes above noise floor.';
COMMENT ON COLUMN tb_dynamical_signals.dmd_spectral_entropy IS 'Shannon entropy of DMD mode amplitude distribution. Low = one mode dominates. High = multi-mode.';
