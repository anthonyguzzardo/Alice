-- ============================================================================
-- Migration 034 — Archive tb_calibration_context
-- ============================================================================
--
-- DATE: 2026-04-27
-- TIE-IN: METHODS_PROVENANCE.md INC-015 (calibration extraction deprecation)
--
-- WHAT
--   Renames the now-orphaned `tb_calibration_context` to
--   `zz_archive_tb_calibration_context`. All application code that read or
--   wrote this table was deleted on 2026-04-27 (INC-015):
--     - libCalibrationExtract.ts — file deleted
--     - libDb.ts saveCalibrationContext / getCalibrationContextForQuestion /
--       getRecentCalibrationContext / getCalibrationContextNearDate — removed
--     - libSignalWorker.ts runCalibrationExtraction invocation — removed
--     - health.ts pendingWork.extractions* surface — removed
--   The producer was orphaned: `runGeneration` (the only consumer of the
--   extracted tags) was deleted 2026-04-27 in INC-014. Per CLAUDE.md
--   "Archival" discipline: data preserved under `zz_archive_*`; the schema's
--   active surface no longer references the original name.
--
-- SAFETY
--   Pure rename. Zero data movement. Zero data loss. Idempotent via DO block —
--   re-running the migration after success is a no-op.
--
-- ROLLBACK
--   ALTER TABLE alice.zz_archive_tb_calibration_context RENAME TO tb_calibration_context;
--   (No application code reads it anymore, so rollback only matters for
--   forensic recovery — never for restoring runtime functionality.)
--
-- VERIFICATION
--   After running:
--     SELECT COUNT(*) FROM alice.zz_archive_tb_calibration_context;  -- preserved
--     SELECT to_regclass('alice.tb_calibration_context');            -- NULL (gone)
-- ============================================================================

\echo '--- 034: archiving tb_calibration_context -> zz_archive_tb_calibration_context ---'

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'alice' AND table_name = 'tb_calibration_context'
  ) THEN
    ALTER TABLE alice.tb_calibration_context RENAME TO zz_archive_tb_calibration_context;
    RAISE NOTICE 'Renamed tb_calibration_context to zz_archive_tb_calibration_context.';
  ELSE
    RAISE NOTICE 'tb_calibration_context not found — already archived or never existed. No-op.';
  END IF;
END $$;

-- Verify
\echo '--- post-archive state ---'
SELECT
  to_regclass('alice.tb_calibration_context')             AS active_calibration_context,
  to_regclass('alice.zz_archive_tb_calibration_context')  AS archived_calibration_context,
  (SELECT COUNT(*)::int FROM alice.zz_archive_tb_calibration_context) AS archived_row_count;
