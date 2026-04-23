-- Semantic baseline infrastructure (Phase 2).
--
-- Ghost comparison is the wrong null hypothesis for semantic signals:
-- Markov/PPM word salad vs coherent text produces a trivially explained
-- residual with no discriminative information across sessions.
--
-- The correct null model for semantic measurement is within-person
-- longitudinal baselines: "how does this session's semantic output compare
-- to this person's own historical distribution?"
--
-- tb_semantic_baselines: Welford's online algorithm for incremental
--   per-signal mean/variance. Updated after each session.
--
-- tb_semantic_trajectory: per-session z-scores against global and
--   topic-matched baselines. Gated by minimum-n threshold.

SET search_path = alice, public;

CREATE TABLE IF NOT EXISTS tb_semantic_baselines (
   semantic_baseline_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,signal_name            TEXT NOT NULL UNIQUE
  ,running_mean           DOUBLE PRECISION NOT NULL DEFAULT 0
  ,running_m2             DOUBLE PRECISION NOT NULL DEFAULT 0
  ,session_count          INT NOT NULL DEFAULT 0
  ,last_question_id       INT
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc      TIMESTAMPTZ
  ,modified_by            TEXT
);

CREATE TABLE IF NOT EXISTS tb_semantic_trajectory (
   semantic_trajectory_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id             INT NOT NULL
  ,signal_name             TEXT NOT NULL
  ,raw_value               DOUBLE PRECISION
  ,global_z_score          DOUBLE PRECISION
  ,topic_z_score           DOUBLE PRECISION
  ,topic_match_count       INT
  ,baseline_n              INT NOT NULL
  ,gated                   BOOLEAN NOT NULL DEFAULT TRUE
  ,UNIQUE (question_id, signal_name)
  ,dttm_created_utc        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by              TEXT NOT NULL DEFAULT 'system'
);
