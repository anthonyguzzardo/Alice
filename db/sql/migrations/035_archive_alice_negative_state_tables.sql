-- ============================================================================
-- Migration 035 — Archive Alice Negative state/dynamics/coupling tables
-- ============================================================================
--
-- DATE: 2026-04-27
-- TIE-IN: METHODS_PROVENANCE.md INC-014 (Alice Negative full deprecation)
--
-- WHAT
--   Renames seven tables that were exclusively populated by the deleted
--   Alice Negative pipeline (`renderWitnessState` and downstream stages).
--   Every producer was deleted in commit c0023bb on 2026-04-27; row counts
--   confirm all seven tables stopped writing at 2026-04-25 11:58 (the
--   pipeline's last successful run).
--
--   Tables archived:
--     - tb_semantic_states
--     - tb_semantic_dynamics
--     - tb_semantic_coupling
--     - tb_trait_dynamics
--     - tb_coupling_matrix
--     - tb_emotion_behavior_coupling
--
--   In this commit, the application code that read these tables (entry
--   observatory page, /api/observatory/coupling, /api/observatory/synthesis,
--   /api/observatory/states semantic block, trajectory.astro semantic plots,
--   index.astro Right-Now/Arcs/Discoveries panels) was deleted alongside
--   the libDb save/get exports for these tables.
--
-- SAFETY
--   Pure rename. Zero data movement. Zero data loss. Idempotent via DO blocks.
--
-- ROLLBACK
--   ALTER TABLE alice.zz_archive_tb_<name> RENAME TO tb_<name>;
--   (No application code reads these anymore — rollback only matters for
--   forensic recovery.)
--
-- VERIFICATION
--   After running, every `to_regclass('alice.tb_<name>')` should be NULL,
--   and every `zz_archive_*` should hold the original row counts.
-- ============================================================================

\echo '--- 035: archiving Alice Negative state/dynamics/coupling tables ---'

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tb_semantic_states',
    'tb_semantic_dynamics',
    'tb_semantic_coupling',
    'tb_trait_dynamics',
    'tb_coupling_matrix',
    'tb_emotion_behavior_coupling'
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
  to_regclass('alice.tb_semantic_states')           AS active_sem_states,
  to_regclass('alice.tb_semantic_dynamics')         AS active_sem_dyn,
  to_regclass('alice.tb_semantic_coupling')         AS active_sem_coup,
  to_regclass('alice.tb_trait_dynamics')            AS active_trait_dyn,
  to_regclass('alice.tb_coupling_matrix')           AS active_coup_matrix,
  to_regclass('alice.tb_emotion_behavior_coupling') AS active_emo_beh;
