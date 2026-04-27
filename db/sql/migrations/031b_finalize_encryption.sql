-- ============================================================================
-- Migration 031b — Finalize at-rest encryption (drop plaintext columns)
-- Date: 2026-04-27
-- Phase: 6b — Encryption uniformity (Step 8 of unification plan)
-- Run order: 031a → backfill-encryption.ts → 031b (this)
-- ============================================================================
--
-- PURPOSE
--   Step 3 of the at-rest encryption rollout. After 031a added the new
--   ciphertext + nonce columns and the backfill script populated them,
--   this migration:
--     - Verifies every row has its ciphertext + nonce populated.
--     - Sets NOT NULL on the columns whose source was NOT NULL.
--     - Drops the original plaintext columns.
--
-- IRREVERSIBILITY
--   The DROP COLUMN block at the end is the point of no return. After this
--   runs, plaintext is gone — only ciphertext + nonce remain. Recovery
--   requires the encryption key (`ALICE_ENCRYPTION_KEY`).
--
--   Before running this, you should have:
--     - A pg_dump of the database from before 031a (operator habit).
--     - Verified the backfill log showed zero unencrypted rows.
--     - Run the round-trip test (`npm run test -- encryption`) and seen it pass.
--
-- ============================================================================

\set ON_ERROR_STOP on
SET search_path = alice, public, extensions;

BEGIN;

-- ============================================================================
-- BLOCK 1 — Verify backfill is complete
-- ============================================================================

\echo '--- 031b: verifying backfill completeness (every count must be 0) ---'

DO $$
DECLARE
  unencrypted_count INT;
BEGIN
  SELECT COUNT(*) INTO unencrypted_count FROM tb_responses
    WHERE text_ciphertext IS NULL OR text_nonce IS NULL;
  IF unencrypted_count > 0 THEN
    RAISE EXCEPTION 'tb_responses has % unencrypted rows; run backfill-encryption.ts first', unencrypted_count;
  END IF;

  SELECT COUNT(*) INTO unencrypted_count FROM tb_questions
    WHERE text_ciphertext IS NULL OR text_nonce IS NULL;
  IF unencrypted_count > 0 THEN
    RAISE EXCEPTION 'tb_questions has % unencrypted rows; run backfill-encryption.ts first', unencrypted_count;
  END IF;

  SELECT COUNT(*) INTO unencrypted_count FROM tb_reflections
    WHERE text_ciphertext IS NULL OR text_nonce IS NULL;
  IF unencrypted_count > 0 THEN
    RAISE EXCEPTION 'tb_reflections has % unencrypted rows; run backfill-encryption.ts first', unencrypted_count;
  END IF;

  SELECT COUNT(*) INTO unencrypted_count FROM tb_calibration_context
    WHERE value_ciphertext IS NULL OR value_nonce IS NULL;
  IF unencrypted_count > 0 THEN
    RAISE EXCEPTION 'tb_calibration_context has % rows missing value ciphertext', unencrypted_count;
  END IF;

  -- detail is nullable in source schema; the partial check is "if detail was
  -- non-null pre-migration, ciphertext must be present." Source detail column
  -- is dropped below, so we check that the plaintext detail and the ciphertext
  -- agree on presence.
  SELECT COUNT(*) INTO unencrypted_count FROM tb_calibration_context
    WHERE detail IS NOT NULL AND (detail_ciphertext IS NULL OR detail_nonce IS NULL);
  IF unencrypted_count > 0 THEN
    RAISE EXCEPTION 'tb_calibration_context has % rows with detail but no ciphertext', unencrypted_count;
  END IF;

  SELECT COUNT(*) INTO unencrypted_count FROM tb_embeddings
    WHERE embedded_text_ciphertext IS NULL OR embedded_text_nonce IS NULL;
  IF unencrypted_count > 0 THEN
    RAISE EXCEPTION 'tb_embeddings has % unencrypted rows; run backfill-encryption.ts first', unencrypted_count;
  END IF;

  SELECT COUNT(*) INTO unencrypted_count FROM tb_session_events
    WHERE event_log_ciphertext IS NULL OR event_log_nonce IS NULL;
  IF unencrypted_count > 0 THEN
    RAISE EXCEPTION 'tb_session_events has % rows missing event_log ciphertext', unencrypted_count;
  END IF;

  -- keystroke_stream_json is nullable in source schema. Same agreement check.
  SELECT COUNT(*) INTO unencrypted_count FROM tb_session_events
    WHERE keystroke_stream_json IS NOT NULL AND (keystroke_stream_ciphertext IS NULL OR keystroke_stream_nonce IS NULL);
  IF unencrypted_count > 0 THEN
    RAISE EXCEPTION 'tb_session_events has % rows with keystroke_stream but no ciphertext', unencrypted_count;
  END IF;

  RAISE NOTICE 'backfill verification passed';
END $$;

-- ============================================================================
-- BLOCK 2 — Set NOT NULL on the ciphertext / nonce columns whose source was NOT NULL
-- ============================================================================

\echo '--- 031b: setting NOT NULL on populated ciphertext/nonce columns ---'

ALTER TABLE tb_responses
  ALTER COLUMN text_ciphertext SET NOT NULL,
  ALTER COLUMN text_nonce      SET NOT NULL;

ALTER TABLE tb_questions
  ALTER COLUMN text_ciphertext SET NOT NULL,
  ALTER COLUMN text_nonce      SET NOT NULL;

ALTER TABLE tb_reflections
  ALTER COLUMN text_ciphertext SET NOT NULL,
  ALTER COLUMN text_nonce      SET NOT NULL;

ALTER TABLE tb_calibration_context
  ALTER COLUMN value_ciphertext SET NOT NULL,
  ALTER COLUMN value_nonce      SET NOT NULL;
-- detail_ciphertext / detail_nonce stay nullable (detail TEXT was nullable)

ALTER TABLE tb_embeddings
  ALTER COLUMN embedded_text_ciphertext SET NOT NULL,
  ALTER COLUMN embedded_text_nonce      SET NOT NULL;

ALTER TABLE tb_session_events
  ALTER COLUMN event_log_ciphertext SET NOT NULL,
  ALTER COLUMN event_log_nonce      SET NOT NULL;
-- keystroke_stream_ciphertext / keystroke_stream_nonce stay nullable (source JSONB was nullable)

-- ============================================================================
-- BLOCK 3 — Drop original plaintext columns (POINT OF NO RETURN)
-- ============================================================================

\echo '--- 031b: dropping plaintext columns ---'

ALTER TABLE tb_responses           DROP COLUMN text;
ALTER TABLE tb_questions           DROP COLUMN text;
ALTER TABLE tb_reflections         DROP COLUMN text;
ALTER TABLE tb_calibration_context DROP COLUMN value;
ALTER TABLE tb_calibration_context DROP COLUMN detail;
ALTER TABLE tb_embeddings          DROP COLUMN embedded_text;
ALTER TABLE tb_session_events      DROP COLUMN event_log_json;
ALTER TABLE tb_session_events      DROP COLUMN keystroke_stream_json;

-- ============================================================================
-- BLOCK 4 — Post-migration verification
-- ============================================================================

\echo '--- 031b: post-migration column shape (should NOT show plaintext columns) ---'
SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'alice'
  AND table_name IN (
    'tb_responses','tb_questions','tb_reflections',
    'tb_calibration_context','tb_embeddings','tb_session_events'
  )
  AND (column_name LIKE '%ciphertext' OR column_name LIKE '%nonce'
       OR column_name IN ('text','value','detail','embedded_text','event_log_json','keystroke_stream_json'))
ORDER BY table_name, column_name;

COMMIT;

\echo '--- 031b complete. At-rest encryption is now enforced at the schema level.'
