-- Phase 1: Zero-coverage measurement axes (INC-012)
-- Adds MF-DFA (multifractal), IKI PSD (frequency domain), and
-- temporal irreversibility (thermodynamic directionality) to
-- tb_dynamical_signals. These are the first three zero-coverage
-- axes identified in the signal engine paradigm audit.
--
-- Mangalam et al. 2022 ergodicity reclassification is applied in
-- downstream TypeScript (libDailyDelta, libCalibrationDrift), not
-- in schema. See Phase 0 of signal-integration-plan.md.

SET search_path = alice, public;

-- MF-DFA: Multifractal generalization of DFA (Kantelhardt et al. 2002)
-- Cross-validates dfaAlpha. mfdfa_peak_alpha = h(2) = standard DFA alpha.
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS mfdfa_spectrum_width        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mfdfa_asymmetry             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mfdfa_peak_alpha            DOUBLE PRECISION;

-- Temporal irreversibility: KL divergence between forward/backward
-- IKI transition probabilities (De la Fuente et al. 2022)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS temporal_irreversibility    DOUBLE PRECISION;

-- IKI PSD: Lomb-Scargle periodogram of the IKI series
-- Opens the frequency domain axis (zero coverage prior to this migration)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS iki_psd_spectral_slope          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS iki_psd_respiratory_peak_hz     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS peak_typing_frequency_hz        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS iki_psd_lf_hf_ratio             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS iki_psd_fast_slow_variance_ratio DOUBLE PRECISION;

COMMENT ON COLUMN tb_dynamical_signals.mfdfa_spectrum_width IS 'MF-DFA singularity spectrum width: max(alpha) - min(alpha). Wide = adaptive multifractal scaling. Narrow = rigid monofractal.';
COMMENT ON COLUMN tb_dynamical_signals.mfdfa_asymmetry IS 'MF-DFA spectrum asymmetry: (peak_alpha - alpha_min) / width. <0.5 = large fluctuations dominate. >0.5 = small fluctuations dominate.';
COMMENT ON COLUMN tb_dynamical_signals.mfdfa_peak_alpha IS 'MF-DFA peak alpha: alpha at max f(alpha). h(2) equals standard DFA alpha for backward compatibility.';
COMMENT ON COLUMN tb_dynamical_signals.temporal_irreversibility IS 'KL divergence between forward and backward IKI transition probabilities (bits). 0 = time-symmetric (equilibrium). >0 = out-of-equilibrium (engaged cognition).';
COMMENT ON COLUMN tb_dynamical_signals.iki_psd_spectral_slope IS 'Log-log slope of IKI power spectral density. ~0 = white noise. ~-1 = pink/1f noise. ~-2 = brown noise.';
COMMENT ON COLUMN tb_dynamical_signals.iki_psd_respiratory_peak_hz IS 'Peak frequency in respiratory band (0.15-0.35 Hz), if above 2x median power. NULL if no significant peak.';
COMMENT ON COLUMN tb_dynamical_signals.peak_typing_frequency_hz IS 'Peak frequency in typing band (2-15 Hz). Motor oscillation frequency reflecting cortico-basal ganglia loop tuning.';
COMMENT ON COLUMN tb_dynamical_signals.iki_psd_lf_hf_ratio IS 'Ratio of LF (0.04-0.15 Hz) to HF (0.15-0.4 Hz) spectral power. Motor analog of cardiac sympathetic/parasympathetic balance.';
COMMENT ON COLUMN tb_dynamical_signals.iki_psd_fast_slow_variance_ratio IS 'Ratio of >1 Hz (motor arousal) to <0.5 Hz (cognitive) spectral power.';
