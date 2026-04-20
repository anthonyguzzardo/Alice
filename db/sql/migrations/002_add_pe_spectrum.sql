-- Migration 002: Add pe_spectrum column to tb_dynamical_signals
-- Multi-scale permutation entropy (orders 3-7) stored as JSONB array of 5 floats
-- 2026-04-20

SET search_path = alice, public;

ALTER TABLE tb_dynamical_signals
  ADD COLUMN IF NOT EXISTS pe_spectrum JSONB;
