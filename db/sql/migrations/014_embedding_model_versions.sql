-- Embedding model version tracking and voyage-3-lite invalidation.
--
-- Adds tb_embedding_model_versions to track the exact model weights,
-- inference environment, and lifecycle of each embedding model used.
-- Adds embedding_model_version_id FK and invalidated_at to tb_embeddings
-- for version tagging and soft-invalidation of stale embeddings.
--
-- Modifies the UNIQUE constraint on tb_embeddings: the old constraint
-- (embedding_source_id, source_record_id) prevents multiple model versions
-- from coexisting for the same source record. The new constraint adds
-- embedding_model_version_id so each model version can have its own row.

SET search_path = alice, public;

-- ── Model version registry ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tb_embedding_model_versions (
   embedding_model_version_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,model_name                  TEXT NOT NULL
  ,weights_sha256              TEXT NOT NULL
  ,inference_environment       JSONB NOT NULL
  ,active_from                 DATE NOT NULL
  ,active_to                   DATE
  ,notes                       TEXT
  ,dttm_created_utc            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                  TEXT NOT NULL DEFAULT 'system'
);

-- ── Seed the first model version (Qwen3-Embedding-0.6B) ─────────────

INSERT INTO tb_embedding_model_versions (
  model_name, weights_sha256, inference_environment, active_from, notes
) VALUES (
  'Qwen3-Embedding-0.6B',
  '0437e45c94563b09e13cb7a64478fc406947a93cb34a7e05870fc8dcd48e23fd',
  '{"tei_version": "1.9.3", "backend": "candle-cpu", "precision": "float32", "matryoshka_dim": 512, "pooling": "last-token", "platform": "darwin-arm64"}',
  '2026-04-23',
  'Apache 2.0 weights. MS MARCO training data licensing (QwenLM/Qwen3-Embedding#166) acceptable for research use, flagged for commercial deployment review.'
) ON CONFLICT DO NOTHING;

-- ── Add columns to tb_embeddings ─────────────────────────────────────

ALTER TABLE tb_embeddings
  ADD COLUMN IF NOT EXISTS embedding_model_version_id INT,
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ;

-- ── Invalidate existing voyage-3-lite rows ───────────────────────────

UPDATE tb_embeddings
SET invalidated_at = CURRENT_TIMESTAMP
WHERE model_name = 'voyage-3-lite'
  AND invalidated_at IS NULL;

-- ── Replace UNIQUE constraint to include model version ───────────────
-- Old: UNIQUE(embedding_source_id, source_record_id)
-- New: UNIQUE(embedding_source_id, source_record_id, embedding_model_version_id)
-- This allows the same source record to have embeddings from different models.

ALTER TABLE tb_embeddings
  DROP CONSTRAINT IF EXISTS tb_embeddings_embedding_source_id_source_record_id_key;

ALTER TABLE tb_embeddings
  ADD CONSTRAINT tb_embeddings_source_model_unique
  UNIQUE (embedding_source_id, source_record_id, embedding_model_version_id);
