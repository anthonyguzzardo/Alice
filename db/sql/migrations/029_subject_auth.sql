-- 029_subject_auth.sql
-- Path 2-lite auth: username + Argon2id password_hash + must_reset_password flag.
-- Owner manually provisions accounts via CLI; subjects reset their temp password
-- on first login. Sessions tracked in tb_subject_sessions (random token, hashed
-- before storage so a DB leak does not grant active sessions).
--
-- Migration strategy:
--   1. Add new columns nullable.
--   2. Backfill the existing owner row so the NOT NULL alter succeeds.
--      Owner's username defaults to 'owner'; password_hash is a placeholder
--      that fails verify until the owner runs `npm run set-owner-password`.
--   3. Promote columns to NOT NULL.
--   4. Drop the old NOT NULL on invite_code (kept nullable for backward compat
--      with any existing read paths; no new writes set it).

SET search_path = alice, public;

-- ─── tb_subjects extensions ─────────────────────────────────────────────────

ALTER TABLE tb_subjects ADD COLUMN IF NOT EXISTS username             TEXT;
ALTER TABLE tb_subjects ADD COLUMN IF NOT EXISTS password_hash        TEXT;
ALTER TABLE tb_subjects ADD COLUMN IF NOT EXISTS must_reset_password  BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tb_subjects ADD COLUMN IF NOT EXISTS iana_timezone        TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE tb_subjects ADD COLUMN IF NOT EXISTS dttm_modified_utc    TIMESTAMPTZ;
ALTER TABLE tb_subjects ADD COLUMN IF NOT EXISTS modified_by          TEXT;

-- Backfill owner row (idempotent — runs only if username is NULL).
-- Placeholder password_hash will fail verification; owner sets a real password
-- via `npm run set-owner-password` immediately after migration.
UPDATE tb_subjects
SET username = 'owner',
    password_hash = '$argon2id$placeholder$needs-set-via-cli',
    must_reset_password = TRUE
WHERE is_owner = TRUE AND username IS NULL;

-- Promote to NOT NULL after backfill.
ALTER TABLE tb_subjects ALTER COLUMN username SET NOT NULL;
ALTER TABLE tb_subjects ALTER COLUMN password_hash SET NOT NULL;

-- Username is the human-facing login identifier; must be unique.
ALTER TABLE tb_subjects ADD CONSTRAINT uq_subjects_username UNIQUE (username);

-- invite_code is legacy. New rows do not set it; existing rows keep theirs
-- for backward-compat with any unmigrated read paths. Drop the NOT NULL.
ALTER TABLE tb_subjects ALTER COLUMN invite_code DROP NOT NULL;

-- ─── tb_subject_sessions (new) ──────────────────────────────────────────────

-- PURPOSE: active subject login sessions
-- USE CASE: one row per (subject, login). Cookie holds the raw token; the DB
--           stores SHA-256(token) so a DB leak does not grant active sessions.
-- MUTABILITY: insert on login, delete on logout or expiry sweep.
-- REFERENCED BY: none (leaf)
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_subject_sessions (
   subject_session_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id          INT NOT NULL                                  -- logical FK to tb_subjects
  ,token_hash          TEXT NOT NULL UNIQUE                          -- SHA-256(raw_token)
  ,expires_at          TIMESTAMPTZ NOT NULL
  ,dttm_created_utc    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_subject_sessions_subject_id
  ON tb_subject_sessions (subject_id);

CREATE INDEX IF NOT EXISTS ix_subject_sessions_expires_at
  ON tb_subject_sessions (expires_at);
