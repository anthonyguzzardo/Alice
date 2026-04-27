-- ============================================================================
-- Migration 032b — Drop legacy subject-variant tables (POINT OF NO RETURN)
-- Date: 2026-04-27
-- Phase: 6b — Subject API cutover (Step 9 of unification plan)
-- Run order: 032a → app deploy with cutover code → 032b (this)
-- ============================================================================
--
-- PURPOSE
--   Drop the three Phase 6a subject-variant tables that the Step 9 cutover
--   replaced with subject_id-scoped writes against the unified tables:
--     - tb_subject_responses          (folded into tb_responses)
--     - tb_subject_session_summaries  (folded into tb_session_summaries)
--     - tb_scheduled_questions        (folded into tb_questions via
--                                      corpus_question_id + question_source_id=4,
--                                      added in migration 032a)
--
--   These tables are documented zero-row in migration 030 BLOCK 7. The
--   cutover commit removes every writer to them. This migration verifies
--   the zero-row claim at runtime against production state and only then
--   executes the DROPs.
--
-- IRREVERSIBILITY
--   The DROP block is the point of no return. After this runs, the legacy
--   tables are gone and the schema source-of-truth (`db/sql/dbAlice_Tables.sql`)
--   no longer carries their CREATE TABLE statements. Reverting requires:
--     1. Restoring the table definitions in dbAlice_Tables.sql.
--     2. Re-creating the tables on production.
--     3. Re-introducing the application code paths that read/write them.
--
--   Before running this, verify:
--     - Migration 032a has run successfully on production.
--     - The Step 9 application code has been deployed and is the live version.
--     - The three legacy tables show zero rows on production
--       (the assertion below will fail if not).
--
-- VERIFICATION GATE
--   The DO block in BLOCK 1 raises EXCEPTION if any of the three tables has
--   any rows at runtime. A non-zero count indicates either:
--     a. A subject submission landed between migration 030 (which documented
--        zero rows) and this migration. In that case a fold script must run
--        first to migrate the row(s) to the unified tables.
--     b. An unexpected writer outside the inventoried set added rows. Investigate
--        before proceeding.
--
-- ============================================================================

\set ON_ERROR_STOP on
SET search_path = alice, public, extensions;

BEGIN;

-- ============================================================================
-- BLOCK 1 — Verify zero rows in legacy subject-variant tables
-- ============================================================================

\echo '--- 032b: BLOCK 1 — verifying zero rows in legacy tables (assertion gate) ---'

DO $$
DECLARE
  legacy_count INT;
BEGIN
  SELECT COUNT(*) INTO legacy_count FROM tb_subject_responses;
  IF legacy_count > 0 THEN
    RAISE EXCEPTION 'tb_subject_responses has % rows; cutover requires zero. Fold rows into tb_responses (with subject_id) before retrying.', legacy_count;
  END IF;

  SELECT COUNT(*) INTO legacy_count FROM tb_subject_session_summaries;
  IF legacy_count > 0 THEN
    RAISE EXCEPTION 'tb_subject_session_summaries has % rows; cutover requires zero. Fold rows into tb_session_summaries (with subject_id) before retrying.', legacy_count;
  END IF;

  SELECT COUNT(*) INTO legacy_count FROM tb_scheduled_questions;
  IF legacy_count > 0 THEN
    RAISE EXCEPTION 'tb_scheduled_questions has % rows; cutover requires zero. Fold rows into tb_questions (question_source_id=4 + corpus_question_id) before retrying.', legacy_count;
  END IF;

  RAISE NOTICE 'all three legacy tables verified zero-row; safe to drop';
END $$;

-- ============================================================================
-- BLOCK 2 — Drop legacy tables (POINT OF NO RETURN)
-- ============================================================================

\echo '--- 032b: BLOCK 2 — dropping legacy subject-variant tables ---'

DROP TABLE IF EXISTS tb_subject_responses;
DROP TABLE IF EXISTS tb_subject_session_summaries;
DROP TABLE IF EXISTS tb_scheduled_questions;

-- The supporting index on tb_scheduled_questions is dropped automatically
-- with the table; explicit DROP INDEX is unnecessary.

-- ============================================================================
-- BLOCK 3 — Post-migration verification
-- ============================================================================

\echo '--- 032b: BLOCK 3 — verifying tables are gone (count must be 0) ---'

DO $$
DECLARE
  remaining_tables INT;
BEGIN
  SELECT COUNT(*) INTO remaining_tables
    FROM information_schema.tables
    WHERE table_schema = 'alice'
      AND table_name IN ('tb_subject_responses', 'tb_subject_session_summaries', 'tb_scheduled_questions');
  IF remaining_tables <> 0 THEN
    RAISE EXCEPTION 'expected zero remaining legacy tables; found %', remaining_tables;
  END IF;
  RAISE NOTICE 'all three legacy tables confirmed dropped';
END $$;

COMMIT;

\echo '--- 032b complete. Schema unification finished — every behavioral row is subject_id-scoped through the unified tables. ---'
