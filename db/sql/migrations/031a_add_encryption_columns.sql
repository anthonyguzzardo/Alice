-- ============================================================================
-- Migration 031a — Add ciphertext + nonce columns for at-rest encryption
-- Date: 2026-04-27
-- Phase: 6b — Encryption uniformity (Step 8 of unification plan)
-- Run order: 031a (this) → scripts/backfill-encryption.ts → 031b
-- ============================================================================
--
-- PURPOSE
--   Step 1 of the at-rest encryption rollout. Add nullable `<col>_ciphertext`
--   TEXT and `<col>_nonce` TEXT columns alongside every subject-bearing text
--   or JSONB column listed in the inventory below. This file is purely
--   additive: existing rows continue to read correctly from their plaintext
--   columns until the backfill script runs and 031b finalizes.
--
-- INVENTORY (in scope)
--   tb_responses.text                   -> text_ciphertext, text_nonce
--   tb_questions.text                   -> text_ciphertext, text_nonce
--   tb_reflections.text                 -> text_ciphertext, text_nonce
--   tb_calibration_context.value        -> value_ciphertext, value_nonce
--   tb_calibration_context.detail       -> detail_ciphertext, detail_nonce
--   tb_embeddings.embedded_text         -> embedded_text_ciphertext, embedded_text_nonce
--   tb_session_events.event_log_json    -> event_log_ciphertext, event_log_nonce
--   tb_session_events.keystroke_stream_json
--                                       -> keystroke_stream_ciphertext, keystroke_stream_nonce
--
-- INVENTORY (explicitly out of scope, see 030_STEP8_ENCRYPTION.md §1)
--   tb_burst_sequences   — no JSONB or text columns; per-burst numeric summaries only
--   tb_rburst_sequences  — same
--   tb_session_summaries.deletion_events_json — {c: count, t: time} only, no text
--   tb_subject_responses, tb_subject_session_summaries — empty, dropped in Step 9
--   tb_paper_comments    — public website
--   tb_question_corpus   — shared pool, population-agnostic
--
-- STORAGE SHAPE
--   Both ciphertext and nonce are stored as TEXT (base64-encoded). The
--   ciphertext column stores AES-256-GCM ciphertext + 16-byte auth tag,
--   base64'd. The nonce column stores the 12-byte random nonce, base64'd.
--   Both are produced by libCrypto.encrypt() in lib/libCrypto.ts.
--
--   For the two JSONB source columns (event_log_json, keystroke_stream_json),
--   the application JSON.stringifys before encrypting and JSON.parses after
--   decrypting. The new columns are TEXT, not JSONB, because base64 ciphertext
--   does not naturally fit JSONB.
--
-- REVERSIBILITY
--   This migration is fully reversible until 031b runs. To undo: drop the
--   new columns. The plaintext columns remain intact.
--
-- ============================================================================

\set ON_ERROR_STOP on
SET search_path = alice, public, extensions;

BEGIN;

\echo '--- 031a: pre-migration row counts ---'
SELECT
   (SELECT count(*) FROM tb_responses)               AS responses
  ,(SELECT count(*) FROM tb_questions)               AS questions
  ,(SELECT count(*) FROM tb_reflections)             AS reflections
  ,(SELECT count(*) FROM tb_calibration_context)     AS calibration_context
  ,(SELECT count(*) FROM tb_embeddings)              AS embeddings
  ,(SELECT count(*) FROM tb_session_events)          AS session_events
;

\echo '--- 031a: adding ciphertext + nonce columns (nullable) ---'

ALTER TABLE tb_responses
  ADD COLUMN IF NOT EXISTS text_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS text_nonce      TEXT;

ALTER TABLE tb_questions
  ADD COLUMN IF NOT EXISTS text_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS text_nonce      TEXT;

ALTER TABLE tb_reflections
  ADD COLUMN IF NOT EXISTS text_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS text_nonce      TEXT;

ALTER TABLE tb_calibration_context
  ADD COLUMN IF NOT EXISTS value_ciphertext  TEXT,
  ADD COLUMN IF NOT EXISTS value_nonce       TEXT,
  ADD COLUMN IF NOT EXISTS detail_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS detail_nonce      TEXT;

ALTER TABLE tb_embeddings
  ADD COLUMN IF NOT EXISTS embedded_text_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS embedded_text_nonce      TEXT;

ALTER TABLE tb_session_events
  ADD COLUMN IF NOT EXISTS event_log_ciphertext         TEXT,
  ADD COLUMN IF NOT EXISTS event_log_nonce              TEXT,
  ADD COLUMN IF NOT EXISTS keystroke_stream_ciphertext  TEXT,
  ADD COLUMN IF NOT EXISTS keystroke_stream_nonce       TEXT;

COMMIT;

\echo '--- 031a complete. Next steps:'
\echo '---   1. Run: ALICE_PG_URL=... ALICE_ENCRYPTION_KEY=... npm run backfill-encryption'
\echo '---   2. Verify decrypt round-trip in the script output'
\echo '---   3. Run db/sql/migrations/031b_finalize_encryption.sql'
