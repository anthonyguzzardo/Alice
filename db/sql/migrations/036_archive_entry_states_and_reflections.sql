-- ============================================================================
-- Migration 036 — Archive tb_entry_states and tb_reflections
-- ============================================================================
--
-- DATE: 2026-04-27
-- TIE-IN: METHODS_PROVENANCE.md INC-017 (orphan-table archival, second wave)
--
-- WHAT
--   Renames two tables whose producers were deleted in earlier deprecation
--   passes and whose consumers were already broken or showing frozen data:
--
--     - tb_entry_states     (8D behavioral state vectors)
--     - tb_reflections      (weekly/monthly journal reflections)
--
--   Producer status at archival time:
--     * tb_entry_states: writer was `libAliceNegative/libRenderWitness`,
--       deleted in commit c0023bb on 2026-04-27 (INC-014). Rows frozen
--       since 2026-04-25 11:58 (last successful pipeline run).
--     * tb_reflections: no live writer remains in src/. The reflection
--       generator was retired alongside the legacy `runGeneration` pipeline
--       (INC-014). Only an encryption smoke test still imported the
--       producer functions.
--
--   In this commit, the consumer-side surfaces were also removed:
--     * /api/observatory/entry/[id].ts (entire file)
--     * /observatory/entry/[id].astro  (entire page — behavioral 7D radar)
--     * /api/observatory/states.ts re-anchored on tb_responses; the
--       behavioral 7D and convergence columns dropped
--     * Trajectory page: "Behavioral 7D · z-score trajectory" + Convergence
--       overlay sections removed
--     * Observatory index Entries panel: behavioral z-score columns dropped,
--       entry-detail link removed
--     * Replay page: back-link to /observatory/entry/<id> removed
--     * libDb.ts: EntryStateRow, saveEntryState, getAllEntryStates,
--       getEntryStateCount, getEntryStatesWithDates, getEntryStateByResponseId,
--       saveReflection, getLatestReflection, getAllReflections,
--       getLatestReflectionWithCoverage all deleted
--     * tb_reflections encryption smoke test removed
--
-- SAFETY
--   Pure rename. Zero data movement. Zero data loss. Idempotent via DO block.
--
-- ROLLBACK
--   ALTER TABLE alice.zz_archive_tb_entry_states RENAME TO tb_entry_states;
--   ALTER TABLE alice.zz_archive_tb_reflections  RENAME TO tb_reflections;
--   (No application code reads these anymore — rollback only matters for
--   forensic recovery.)
--
-- ENUMS LEFT INTACT
--   `te_reflection_type` and the `embedding_source_id = 3` row in
--   `te_embedding_source` are preserved. They are static dictionary entries;
--   removing them would orphan any historical rows in zz_archive_tb_reflections
--   and any embedding rows that referenced source 3, with no benefit beyond
--   stylistic cleanup. Leave alone unless a future audit sweeps enum dictionaries.
--
-- VERIFICATION
--   After running, every `to_regclass('alice.tb_<name>')` should be NULL,
--   and every `zz_archive_*` should hold the original row counts.
-- ============================================================================

\echo '--- 036: archiving tb_entry_states and tb_reflections ---'

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tb_entry_states',
    'tb_reflections'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'alice' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE alice.%I RENAME TO %I', t, 'zz_archive_' || t);
      RAISE NOTICE 'Renamed % to zz_archive_%.', t, t;
    ELSE
      RAISE NOTICE '% not found — already archived or never existed. No-op.', t;
    END IF;
  END LOOP;
END $$;

\echo '--- post-archive state ---'
SELECT
  to_regclass('alice.tb_entry_states') AS active_entry_states,
  to_regclass('alice.tb_reflections')  AS active_reflections;
