-- ============================================================================
-- Migration 032a — Add corpus_question_id to tb_questions (additive)
-- Date: 2026-04-27
-- Phase: 6b — Subject API cutover (Step 9 of unification plan)
-- Run order: 032a → app deploy with cutover code → 032b
-- ============================================================================
--
-- PURPOSE
--   Step 9 of the schema unification folds the three subject-variant tables
--   (`tb_subject_responses`, `tb_subject_session_summaries`,
--   `tb_scheduled_questions`) into the unified `tb_responses`,
--   `tb_session_summaries`, and `tb_questions` tables. The fold from
--   `tb_scheduled_questions` requires a `corpus_question_id` link on
--   `tb_questions` so that subject corpus draws can be distinguished from
--   owner journal/calibration questions.
--
--   This migration is the additive half of the cutover:
--     1. Adds `corpus_question_id INT` to `tb_questions` (NULL allowed).
--     2. Adds a partial index for the round-robin no-repeat lookup.
--
--   No data writes are performed. Owner rows keep `corpus_question_id IS NULL`.
--
-- ENUM PRECONDITION
--   `te_question_source` row (4, 'corpus', 'Corpus') already exists from
--   migration 023. No re-insert needed.
--
-- DEPLOY ORDER
--   Run this BEFORE deploying the Step 9 application code. The app on the
--   old code continues to work because:
--     - The added column is nullable; existing INSERTs that omit it succeed.
--     - The added partial index is `WHERE corpus_question_id IS NOT NULL`,
--       so it costs nothing on existing rows.
--   After app deploy, run 032b to drop the three legacy tables.
--
-- REVERSIBILITY
--   Pure additive. Drop column + index to revert.
--
-- ============================================================================

\set ON_ERROR_STOP on
SET search_path = alice, public, extensions;

BEGIN;

\echo '--- 032a: pre-migration check — confirm te_question_source(4, corpus) exists ---'
DO $$
DECLARE
  corpus_source_count INT;
BEGIN
  SELECT COUNT(*) INTO corpus_source_count
    FROM te_question_source
    WHERE question_source_id = 4 AND enum_code = 'corpus';
  IF corpus_source_count <> 1 THEN
    RAISE EXCEPTION 'expected te_question_source(4, corpus) row to exist (from migration 023); got count = %',
      corpus_source_count;
  END IF;
  RAISE NOTICE 'te_question_source(4, corpus) precondition satisfied';
END $$;

-- ============================================================================
-- BLOCK 1 — Add corpus_question_id column
-- ============================================================================

\echo '--- 032a: BLOCK 1 — adding corpus_question_id INT (nullable) ---'

ALTER TABLE tb_questions
  ADD COLUMN IF NOT EXISTS corpus_question_id INT;

-- ============================================================================
-- BLOCK 2 — Partial index for the round-robin no-repeat lookup
-- ============================================================================
--
-- The round-robin scheduler queries: "which corpus questions has this subject
-- been assigned?" — i.e. SELECT corpus_question_id FROM tb_questions WHERE
-- subject_id = ? AND corpus_question_id IS NOT NULL. The partial WHERE keeps
-- the index narrow (owner journal rows have corpus_question_id IS NULL).
-- ============================================================================

\echo '--- 032a: BLOCK 2 — adding partial index ix_questions_subject_corpus_question_id ---'

CREATE INDEX IF NOT EXISTS ix_questions_subject_corpus_question_id
  ON tb_questions (subject_id, corpus_question_id)
  WHERE corpus_question_id IS NOT NULL;

-- ============================================================================
-- BLOCK 3 — Post-migration verification
-- ============================================================================

\echo '--- 032a: BLOCK 3 — verifying column and index are present ---'

DO $$
DECLARE
  col_count INT;
  idx_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = 'alice'
      AND table_name = 'tb_questions'
      AND column_name = 'corpus_question_id';
  IF col_count <> 1 THEN
    RAISE EXCEPTION 'tb_questions.corpus_question_id column missing after migration';
  END IF;

  SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE schemaname = 'alice'
      AND tablename = 'tb_questions'
      AND indexname = 'ix_questions_subject_corpus_question_id';
  IF idx_count <> 1 THEN
    RAISE EXCEPTION 'ix_questions_subject_corpus_question_id index missing after migration';
  END IF;

  RAISE NOTICE 'corpus_question_id column + partial index present';
END $$;

\echo '--- 032a: BLOCK 3 — distinct corpus_question_id values (must show {NULL} on existing rows) ---'
SELECT array_agg(DISTINCT corpus_question_id) AS corpus_question_ids
FROM tb_questions;

COMMIT;

\echo '--- 032a complete. Deploy Step 9 application code, then run 032b. ---'
