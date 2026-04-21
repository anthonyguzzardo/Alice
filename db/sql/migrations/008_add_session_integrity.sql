-- Migration 008: Session integrity (profile-based mediation detection)
-- Per-session profile distance score computed against the personal
-- behavioral profile at time of submission. Flags sessions whose
-- motor/process signals fall outside the person's established range.
-- z_scores_json stores raw per-dimension z-scores (the durable asset).

SET search_path TO alice, public;

CREATE TABLE IF NOT EXISTS tb_session_integrity (
   session_integrity_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id            INT NOT NULL UNIQUE
  ,profile_distance       DOUBLE PRECISION NOT NULL
  ,dimension_count        SMALLINT NOT NULL
  ,z_scores_json          JSONB NOT NULL
  ,is_flagged             BOOLEAN NOT NULL DEFAULT FALSE
  ,threshold_used         DOUBLE PRECISION
  ,profile_session_count  INT
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'system'
);
