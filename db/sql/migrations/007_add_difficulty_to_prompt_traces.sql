-- Migration 007: Add difficulty tracking to prompt traces
-- Persists the adaptive difficulty classification and raw signal inputs
-- so difficulty can be correlated with reconstruction residual magnitude.
-- Raw inputs (MATTR, cognitive density) are the durable asset; the
-- difficulty label may change as the classifier evolves.

SET search_path TO alice, public;

ALTER TABLE tb_prompt_traces
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT,
  ADD COLUMN IF NOT EXISTS difficulty_inputs JSONB;
