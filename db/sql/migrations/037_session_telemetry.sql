-- ============================================================================
-- Migration 037 — Session telemetry columns on tb_subject_sessions
-- ============================================================================
--
-- DATE: 2026-04-27
-- TIE-IN: Auth hardening pass (rate-limit + 7-day expiry + session telemetry)
--
-- HISTORY: Originally landed as 035_session_telemetry.sql in commit 3705e18,
-- creating a filename collision with 035_archive_alice_negative_state_tables.sql.
-- Renamed to 037 (post-036 entry-states archival) once both 035 files were
-- confirmed already applied to Supabase. Pure cosmetic rename — the migration
-- itself is unchanged and idempotent if run again.
--
-- WHAT
--   Adds two nullable columns to `tb_subject_sessions`:
--     last_seen_at  TIMESTAMPTZ — updated on each successful session verify
--     last_ip       TEXT        — client IP from x-forwarded-for / x-real-ip
--
--   Both nullable so the migration is non-destructive on existing rows. The
--   application updates them on verify (throttled: only if last_seen_at is
--   NULL or older than 5 minutes) so the write rate stays bounded.
--
-- USE CASE
--   Surface stale-but-valid sessions and detect cookie-on-new-IP situations.
--   The columns are read by future tooling, not by hot-path auth — auth still
--   resolves on token_hash + expires_at alone.
--
-- SAFETY
--   Pure ADD COLUMN with IF NOT EXISTS. Idempotent. Zero data movement.
--   Existing rows get NULL on both columns; the application populates them
--   organically on the next verify per session.
--
-- ROLLBACK
--   ALTER TABLE alice.tb_subject_sessions DROP COLUMN IF EXISTS last_ip;
--   ALTER TABLE alice.tb_subject_sessions DROP COLUMN IF EXISTS last_seen_at;
-- ============================================================================

\echo '--- 037: adding last_seen_at + last_ip to tb_subject_sessions ---'

ALTER TABLE alice.tb_subject_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_ip      TEXT;

-- Verify
\echo '--- post-add column inventory ---'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'alice'
  AND table_name   = 'tb_subject_sessions'
ORDER BY ordinal_position;
