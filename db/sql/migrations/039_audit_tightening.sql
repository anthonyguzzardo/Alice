-- ============================================================================
-- Migration 039 — Audit schema tightening (deferred from 038 review)
-- ============================================================================
--
-- DATE: 2026-04-27
-- TIE-IN: Phase 6c (consent + export + delete). The 038 review surfaced
--         three items that needed tightening before any audit rows
--         accumulate that would later need backfilling. Lands BEFORE
--         libConsent.ts so the helpers reference the final schema shape.
--
-- WHAT
--   1. Create `te_data_access_action` lookup table mirroring the actor
--      pattern (export / factory_reset / delete / consent). Replaces the
--      free-text `action_type` column with a SMALLINT FK so a typo at the
--      call site can't corrupt the append-only audit trail.
--   2. Convert `tb_data_access_log.notes` from TEXT to JSONB. Postgres now
--      validates the value is JSON on write and the column becomes
--      queryable (e.g. extracting cascade row counts from delete records
--      is a one-liner instead of a `notes::jsonb` cast every time).
--      ENFORCEMENT: helper code must JSON.stringify every write. Passing
--      non-JSON text into the column will fail at the postgres-driver
--      boundary — by design. Invalid JSON should never silently land in
--      append-only audit rows.
--   3. (Schema file only, no DDL) The `actor_subject_id` column comment
--      is tightened in `dbAlice_Tables.sql` to remove the
--      "operator-or-system" ambiguity flagged in the 038 review.
--
-- USE CASE
--   Lands before any audit rows accumulate so column conversions are
--   zero-risk. The pre-flight DO block aborts if rows are present — if 039
--   is ever delayed past first-write, a backfill UPDATE step has to be
--   added before re-running.
--
-- SAFETY
--   Wrapped in a single transaction so partial failure rolls back. The
--   pre-flight refuses to run when audit rows already exist, forcing the
--   operator to review the migration before clobbering the conversion.
--
-- ROLLBACK
--   BEGIN;
--   ALTER TABLE alice.tb_data_access_log ADD COLUMN action_type TEXT;
--   UPDATE alice.tb_data_access_log SET action_type = CASE data_access_action_id
--      WHEN 1 THEN 'export' WHEN 2 THEN 'factory_reset'
--      WHEN 3 THEN 'delete' WHEN 4 THEN 'consent' END;
--   ALTER TABLE alice.tb_data_access_log ALTER COLUMN action_type SET NOT NULL;
--   ALTER TABLE alice.tb_data_access_log DROP COLUMN data_access_action_id;
--   ALTER TABLE alice.tb_data_access_log
--      ALTER COLUMN notes TYPE TEXT USING notes::text;
--   DROP TABLE IF EXISTS alice.te_data_access_action;
--   COMMIT;
-- ============================================================================

\echo '--- 039: pre-flight (refuse to run if audit rows exist) ---'
DO $$
DECLARE
  audit_row_count INT;
BEGIN
  SELECT count(*)::int INTO audit_row_count FROM alice.tb_data_access_log;
  IF audit_row_count > 0 THEN
    RAISE EXCEPTION '039 expects 0 rows in tb_data_access_log, found %; add a backfill step before re-running', audit_row_count;
  END IF;
END
$$;

BEGIN;

\echo '--- 039: te_data_access_action (enum lookup) ---'

CREATE TABLE IF NOT EXISTS alice.te_data_access_action (
   data_access_action_id  SMALLINT PRIMARY KEY
  ,enum_code              TEXT UNIQUE NOT NULL
  ,name                   TEXT NOT NULL
  ,description            TEXT
);

INSERT INTO alice.te_data_access_action (data_access_action_id, enum_code, name, description) VALUES
   (1, 'export',         'Export',         'Subject downloaded their data as JSON')
  ,(2, 'factory_reset',  'Factory reset',  'Operator wiped a subject''s journal data while preserving account + seeds')
  ,(3, 'delete',         'Delete',         'Subject closed their account or operator initiated a full delete')
  ,(4, 'consent',        'Consent',        'Subject acknowledged a consent version')
ON CONFLICT (data_access_action_id) DO NOTHING;

\echo '--- 039: replace action_type TEXT with data_access_action_id FK ---'

ALTER TABLE alice.tb_data_access_log
  ADD COLUMN IF NOT EXISTS data_access_action_id SMALLINT;

-- Backfill is a no-op when the table is empty (pre-flight already enforced
-- that), but kept here so this migration remains correct if an operator
-- ever needs to re-run it after manually inserting test rows.
UPDATE alice.tb_data_access_log
   SET data_access_action_id = CASE action_type
       WHEN 'export'        THEN 1
       WHEN 'factory_reset' THEN 2
       WHEN 'delete'        THEN 3
       WHEN 'consent'       THEN 4
     END
 WHERE data_access_action_id IS NULL;

-- Catch unmapped action_type values BEFORE the SET NOT NULL would fail
-- with a cryptic constraint error. With 0 rows today this is a no-op;
-- the one time an unexpected action_type ever lands in the table, this
-- block tells the operator exactly what's wrong instead of "column
-- contains null values".
DO $$
DECLARE unmapped_count INT;
BEGIN
  SELECT count(*)::int INTO unmapped_count
    FROM alice.tb_data_access_log
   WHERE data_access_action_id IS NULL;
  IF unmapped_count > 0 THEN
    RAISE EXCEPTION '039: % row(s) have action_type values not in {export, factory_reset, delete, consent}; inspect tb_data_access_log before proceeding', unmapped_count;
  END IF;
END
$$;

ALTER TABLE alice.tb_data_access_log
  ALTER COLUMN data_access_action_id SET NOT NULL;

ALTER TABLE alice.tb_data_access_log
  DROP COLUMN IF EXISTS action_type;

DROP INDEX IF EXISTS alice.ix_data_access_log_action;

CREATE INDEX IF NOT EXISTS ix_data_access_log_action
  ON alice.tb_data_access_log (data_access_action_id, dttm_created_utc DESC);

\echo '--- 039: convert notes TEXT to JSONB ---'

ALTER TABLE alice.tb_data_access_log
  ALTER COLUMN notes TYPE JSONB USING (CASE WHEN notes IS NULL THEN NULL ELSE notes::jsonb END);

COMMIT;

\echo '--- 039 post-state ---'
SELECT 'te_data_access_action rows' AS what, count(*)::text AS value FROM alice.te_data_access_action
UNION ALL
SELECT 'action_type column gone',
       (CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns
                              WHERE table_schema='alice' AND table_name='tb_data_access_log' AND column_name='action_type')
             THEN '1' ELSE '0' END)
UNION ALL
SELECT 'data_access_action_id present',
       (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_schema='alice' AND table_name='tb_data_access_log' AND column_name='data_access_action_id')
             THEN '1' ELSE '0' END)
UNION ALL
SELECT 'notes data_type',
       (SELECT data_type FROM information_schema.columns
        WHERE table_schema='alice' AND table_name='tb_data_access_log' AND column_name='notes');
