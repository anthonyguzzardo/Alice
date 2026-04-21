-- 006_add_source_to_residuals.sql
--
-- Adds question_source_id to tb_reconstruction_residuals so
-- calibration (3) vs journal (1/2) filtering is a direct column
-- lookup instead of requiring a JOIN to tb_questions.

SET search_path = alice, public;

ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN IF NOT EXISTS question_source_id SMALLINT;
