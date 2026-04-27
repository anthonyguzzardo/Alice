-- ============================================================================
-- Migration 033 — Archive tb_witness_states
-- ============================================================================
--
-- DATE: 2026-04-27
-- TIE-IN: METHODS_PROVENANCE.md INC-014 (Alice Negative full deprecation)
--
-- WHAT
--   Renames the now-orphaned `tb_witness_states` to
--   `zz_archive_tb_witness_states`. All application code that read or wrote
--   this table was deleted on 2026-04-27 (the alice-negative scrub):
--     - libDb.ts saveWitnessState / getLatestWitnessState — removed
--     - libAliceNegative/libRenderWitness.ts — file deleted
--     - libSignalWorker.ts witness invocation — removed
--     - All witness page/API files — deleted
--   Per CLAUDE.md "Archival" discipline: data is preserved under a `zz_archive_*`
--   table; the schema's active surface no longer references the original name.
--
-- SAFETY
--   Pure rename. Zero data movement. Zero data loss. Idempotent via DO block —
--   re-running the migration after success is a no-op.
--
-- ROLLBACK
--   ALTER TABLE alice.zz_archive_tb_witness_states RENAME TO tb_witness_states;
--   (No application code reads it anymore, so rollback only matters for
--   forensic recovery — never for restoring runtime functionality.)
--
-- VERIFICATION
--   After running:
--     SELECT COUNT(*) FROM alice.zz_archive_tb_witness_states;     -- preserved
--     SELECT to_regclass('alice.tb_witness_states');               -- NULL (gone)
-- ============================================================================

\echo '--- 033: archiving tb_witness_states -> zz_archive_tb_witness_states ---'

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'alice' AND table_name = 'tb_witness_states'
  ) THEN
    ALTER TABLE alice.tb_witness_states RENAME TO zz_archive_tb_witness_states;
    RAISE NOTICE 'Renamed tb_witness_states to zz_archive_tb_witness_states.';
  ELSE
    RAISE NOTICE 'tb_witness_states not found — already archived or never existed. No-op.';
  END IF;
END $$;

-- Verify
\echo '--- post-archive state ---'
SELECT
  to_regclass('alice.tb_witness_states')             AS active_witness_states,
  to_regclass('alice.zz_archive_tb_witness_states')  AS archived_witness_states,
  (SELECT COUNT(*)::int FROM alice.zz_archive_tb_witness_states) AS archived_row_count;
