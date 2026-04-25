-- 024_subjects.sql
-- Multi-user identity: subjects + owner.
-- Owner is a subject with is_owner = true, seeded at deploy.

SET search_path = alice, public;

-- PURPOSE: all users of Alice (owner + subjects)
-- USE CASE: one row per identity. invite_code is the authentication token.
--           Owner row seeded at deploy; subjects created by owner via CLI.
-- MUTABILITY: insert by owner, soft-disable via is_active. Never deleted.
-- REFERENCED BY: tb_scheduled_questions, tb_subject_responses, tb_subject_session_summaries (all logical FK)
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_subjects (
   subject_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,invite_code      TEXT UNIQUE NOT NULL
  ,display_name     TEXT
  ,is_owner         BOOLEAN NOT NULL DEFAULT FALSE
  ,is_active        BOOLEAN NOT NULL DEFAULT TRUE
  ,dttm_created_utc TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enforce exactly one owner at the database level.
-- A second INSERT with is_owner = true will violate this index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_single_owner
  ON tb_subjects (is_owner) WHERE is_owner = TRUE;

-- Seed the owner row with a deterministic invite code.
-- ON CONFLICT prevents duplicate on re-run.
INSERT INTO tb_subjects (invite_code, display_name, is_owner)
VALUES ('alice-owner', 'Owner', TRUE)
ON CONFLICT (invite_code) DO NOTHING;
