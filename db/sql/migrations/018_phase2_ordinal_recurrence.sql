-- Phase 2: Ordinal dynamics completion and recurrence topology (INC-012)
-- Completes two existing partial analysis frameworks:
-- 1. PE ordinal analysis → symbolic dynamics (CECP, forbidden patterns,
--    weighted PE, LZC) + OPTN (transition entropy, forbidden transitions)
-- 2. RQA recurrence analysis → recurrence networks (transitivity, path
--    length, clustering, assortativity) + recurrence time entropy

SET search_path = alice, public;

-- Symbolic dynamics extensions (Rosso 2007, Amigo 2008, Fadlallah 2013, Bai 2015)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS statistical_complexity          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS forbidden_pattern_fraction      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS weighted_pe                     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lempel_ziv_complexity           DOUBLE PRECISION;

-- OPTN: Ordinal Pattern Transition Networks (McCullough 2015, Bandt & Zanin 2022)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS optn_transition_entropy         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS optn_forbidden_transition_count INT;

-- Recurrence network analysis (Donner 2010, 2011; Zou 2019)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS recurrence_transitivity         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS recurrence_avg_path_length      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS recurrence_clustering           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS recurrence_assortativity        DOUBLE PRECISION;

-- Recurrence time entropy (Baptista et al. 2010)
ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS rqa_recurrence_time_entropy     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS rqa_mean_recurrence_time        DOUBLE PRECISION;

COMMENT ON COLUMN tb_dynamical_signals.statistical_complexity IS 'Jensen-Shannon statistical complexity C_JS (Rosso 2007). 2D with PE: disambiguates stochastic from deterministic at same PE value.';
COMMENT ON COLUMN tb_dynamical_signals.forbidden_pattern_fraction IS 'Fraction of d! ordinal patterns absent from the session (Amigo 2008). Direct test of determinism.';
COMMENT ON COLUMN tb_dynamical_signals.weighted_pe IS 'Amplitude-sensitive PE (Fadlallah 2013). High-amplitude fluctuations weighted proportionally.';
COMMENT ON COLUMN tb_dynamical_signals.lempel_ziv_complexity IS 'PLZC: rate of novel ordinal pattern generation (Bai 2015). Orthogonal to PE (novelty rate vs entropy).';
COMMENT ON COLUMN tb_dynamical_signals.optn_transition_entropy IS 'Mean Shannon entropy of ordinal pattern transition matrix rows. Grammar of typing dynamics.';
COMMENT ON COLUMN tb_dynamical_signals.optn_forbidden_transition_count IS 'Count of zero-probability transitions between individually-present ordinal patterns.';
COMMENT ON COLUMN tb_dynamical_signals.recurrence_transitivity IS 'Global transitivity of recurrence network. Independent fractal dimension estimate (Donner 2010).';
COMMENT ON COLUMN tb_dynamical_signals.recurrence_avg_path_length IS 'Mean shortest path in recurrence network largest component. Attractor geometric diameter.';
COMMENT ON COLUMN tb_dynamical_signals.recurrence_clustering IS 'Mean local clustering coefficient of recurrence network.';
COMMENT ON COLUMN tb_dynamical_signals.recurrence_assortativity IS 'Degree-degree correlation in recurrence network. Whether extreme-timing states cluster.';
COMMENT ON COLUMN tb_dynamical_signals.rqa_recurrence_time_entropy IS 'Shannon entropy of return time distribution. Global attractor topology (Baptista 2010).';
COMMENT ON COLUMN tb_dynamical_signals.rqa_mean_recurrence_time IS 'Mean return time to recurrent states. Connects to Kolmogorov-Sinai entropy.';
