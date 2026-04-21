-- 009: Add R-burst sequence capture (parallel to tb_burst_sequences for P-bursts)
-- Brings R-burst instrumentation to parity: per-burst detail, trajectory shape,
-- profile aggregation columns.

SET search_path = alice, public;

-- Per-R-burst sequence rows (Deane 2015 R-burst classification + Lindgren & Sullivan 2006 leading edge)
CREATE TABLE IF NOT EXISTS tb_rburst_sequences (
   rburst_sequence_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id            INT      NOT NULL
  ,burst_index            SMALLINT NOT NULL
  ,deleted_char_count     INT      NOT NULL
  ,total_char_count       INT      NOT NULL
  ,burst_duration_ms      DOUBLE PRECISION NOT NULL
  ,burst_start_offset_ms  DOUBLE PRECISION NOT NULL
  ,is_leading_edge        BOOLEAN  NOT NULL
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'system'
);

-- R-burst trajectory shape on session metadata
ALTER TABLE tb_session_metadata
  ADD COLUMN IF NOT EXISTS rburst_trajectory_shape TEXT;

-- R-burst profile aggregation columns
ALTER TABLE tb_personal_profile
  ADD COLUMN IF NOT EXISTS rburst_consolidation    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS rburst_mean_size        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS rburst_mean_duration    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS rburst_leading_edge_pct DOUBLE PRECISION;
