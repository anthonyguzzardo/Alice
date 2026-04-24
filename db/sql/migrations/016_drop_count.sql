-- Migration 016: Add drop_count to tb_session_summaries
-- Tracks drag-and-drop attempts (blocked at client, counted for contamination detection).
-- Mirrors paste_count: both are external-input contamination vectors, tracked separately.

SET search_path TO alice, public;

ALTER TABLE tb_session_summaries
  ADD COLUMN IF NOT EXISTS drop_count INT DEFAULT 0;
