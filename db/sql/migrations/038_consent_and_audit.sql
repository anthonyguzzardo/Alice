-- ============================================================================
-- Migration 038 — Consent acknowledgments + data access audit
-- ============================================================================
--
-- DATE: 2026-04-27
-- TIE-IN: Phase 6c (consent + export + delete). Required before enrolling
--         beyond the manually-provisioned single subject. Append-only audit
--         + append-only consent record. No FK constraints (logical FKs only,
--         per CLAUDE.md).
--
-- WHAT
--   1. te_data_access_actor — enum lookup distinguishing who initiated an
--      action (subject / operator / system). The `actor_subject_id` column
--      on tb_data_access_log is nullable because pre-owner-session-auth a
--      CLI-initiated operator action has no subject identity attached;
--      data_access_actor_id disambiguates without forcing NULL semantics.
--   2. tb_subject_consent — append-only record of every consent
--      acknowledgment. The subject's CURRENT consent is the most-recent row
--      for their subject_id; missing or version-mismatched implies the
--      consent gate is engaged in middleware.
--   3. tb_data_access_log — append-only audit trail. Survives subject
--      deletion; the tombstone (subject_id, consent timestamps, deletion
--      timestamp) is the research-integrity record per the consent doc.
--
-- USE CASE
--   Drives middleware consent gate (libConsent.getSubjectConsentStatus),
--   export endpoint audit logging, delete cascade audit logging, factory
--   reset audit logging, and the subject-facing consent history view on
--   /account.astro.
--
-- SAFETY
--   CREATE TABLE IF NOT EXISTS — idempotent re-run is a no-op. Zero data
--   movement, zero impact on existing rows. New tables contain no
--   pre-existing data so there is nothing to backfill.
--
-- ROLLBACK
--   DROP TABLE IF EXISTS alice.tb_data_access_log;
--   DROP TABLE IF EXISTS alice.tb_subject_consent;
--   DROP TABLE IF EXISTS alice.te_data_access_actor;
-- ============================================================================

\echo '--- 038: te_data_access_actor (enum lookup) ---'

CREATE TABLE IF NOT EXISTS alice.te_data_access_actor (
   data_access_actor_id  SMALLINT PRIMARY KEY
  ,enum_code             TEXT UNIQUE NOT NULL
  ,name                  TEXT NOT NULL
  ,description           TEXT
);

INSERT INTO alice.te_data_access_actor (data_access_actor_id, enum_code, name, description) VALUES
   (1, 'subject',  'Subject',  'A subject acted on their own data')
  ,(2, 'operator', 'Operator', 'The operator acted on a subject''s data (CLI script or owner endpoint)')
  ,(3, 'system',   'System',   'Automated system action (cron, worker, deploy hook)')
ON CONFLICT (data_access_actor_id) DO NOTHING;

\echo '--- 038: tb_subject_consent (append-only consent record) ---'

CREATE TABLE IF NOT EXISTS alice.tb_subject_consent (
   subject_consent_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id            INT NOT NULL                              -- logical FK to tb_subjects
  ,consent_version       TEXT NOT NULL                             -- e.g. 'v1'
  ,dttm_acknowledged_utc TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,ip_address            TEXT                                       -- truncated to 45 chars (IPv6 max)
  ,user_agent            TEXT                                       -- truncated to 200 chars
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc     TIMESTAMPTZ
  ,modified_by           TEXT
);

CREATE INDEX IF NOT EXISTS ix_subject_consent_subject_version
  ON alice.tb_subject_consent (subject_id, consent_version);

CREATE INDEX IF NOT EXISTS ix_subject_consent_subject_recent
  ON alice.tb_subject_consent (subject_id, dttm_acknowledged_utc DESC);

\echo '--- 038: tb_data_access_log (append-only audit) ---'

CREATE TABLE IF NOT EXISTS alice.tb_data_access_log (
   data_access_log_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id            INT NOT NULL                              -- whose data was accessed (logical FK to tb_subjects)
  ,actor_subject_id      INT                                        -- who initiated; NULL when actor was operator pre-session-auth or system
  ,data_access_actor_id  SMALLINT NOT NULL                         -- te_data_access_actor.data_access_actor_id
  ,action_type           TEXT NOT NULL                             -- 'export' | 'factory_reset' | 'delete' | 'consent'
  ,consent_version       TEXT                                       -- populated when action_type = 'consent'
  ,notes                 TEXT                                       -- JSON string with action-specific context (e.g. cascade row counts)
  ,ip_address            TEXT
  ,user_agent            TEXT
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc     TIMESTAMPTZ
  ,modified_by            TEXT
);

CREATE INDEX IF NOT EXISTS ix_data_access_log_subject
  ON alice.tb_data_access_log (subject_id, dttm_created_utc DESC);

CREATE INDEX IF NOT EXISTS ix_data_access_log_actor
  ON alice.tb_data_access_log (actor_subject_id, dttm_created_utc DESC);

CREATE INDEX IF NOT EXISTS ix_data_access_log_action
  ON alice.tb_data_access_log (action_type, dttm_created_utc DESC);

-- Verify
\echo '--- 038 post-state ---'
SELECT 'te_data_access_actor rows' AS what, count(*)::text AS value FROM alice.te_data_access_actor
UNION ALL
SELECT 'tb_subject_consent exists', (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='alice' AND table_name='tb_subject_consent') THEN '1' ELSE '0' END)
UNION ALL
SELECT 'tb_data_access_log exists', (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='alice' AND table_name='tb_data_access_log') THEN '1' ELSE '0' END);
