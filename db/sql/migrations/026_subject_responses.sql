-- 026_subject_responses.sql
-- Subject response storage and session summaries.
-- Separate from owner tables — subjects never write to tb_responses or tb_session_summaries.

SET search_path = alice, public;

-- PURPOSE: subject journal responses
-- USE CASE: one row per response, one response per scheduled question.
--           Submission is final — no edits, no deletes.
-- MUTABILITY: insert once, never updated (black box, same as tb_responses)
-- REFERENCED BY: none (leaf table in v1)
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_subject_responses (
   subject_response_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id             INT NOT NULL
  ,scheduled_question_id  INT NOT NULL UNIQUE
  ,text                   TEXT NOT NULL
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PURPOSE: per-session behavioral summary for subject sessions
-- USE CASE: one row per subject session. Same behavioral columns as
--           tb_session_summaries for schema parity. Signal computation
--           is NOT run for subjects — columns store raw client metrics only.
-- MUTABILITY: insert once per session, never updated
-- REFERENCED BY: none (leaf table in v1)
-- FOOTER: created only
-- SCHEMA PARITY: columns must match tb_session_summaries behavioral columns.
--   See db/sql/session_summary_divergence.allow for intentional differences.
--   CI test enforces alignment — add new columns to both tables or document
--   the divergence in the allowlist.
CREATE TABLE IF NOT EXISTS tb_subject_session_summaries (
   subject_session_summary_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id                  INT NOT NULL
  ,scheduled_question_id       INT NOT NULL UNIQUE
  ,first_keystroke_ms              DOUBLE PRECISION
  ,total_duration_ms               DOUBLE PRECISION
  ,total_chars_typed               INT
  ,final_char_count                INT
  ,commitment_ratio                DOUBLE PRECISION
  ,pause_count                     INT
  ,total_pause_ms                  DOUBLE PRECISION
  ,deletion_count                  INT
  ,largest_deletion                INT
  ,total_chars_deleted             INT
  ,tab_away_count                  INT
  ,total_tab_away_ms               DOUBLE PRECISION
  ,word_count                      INT
  ,sentence_count                  INT
  ,small_deletion_count            INT
  ,large_deletion_count            INT
  ,large_deletion_chars            INT
  ,first_half_deletion_chars       INT
  ,second_half_deletion_chars      INT
  ,active_typing_ms                DOUBLE PRECISION
  ,chars_per_minute                DOUBLE PRECISION
  ,p_burst_count                   INT
  ,avg_p_burst_length              DOUBLE PRECISION
  ,nrc_anger_density               DOUBLE PRECISION
  ,nrc_fear_density                DOUBLE PRECISION
  ,nrc_joy_density                 DOUBLE PRECISION
  ,nrc_sadness_density             DOUBLE PRECISION
  ,nrc_trust_density               DOUBLE PRECISION
  ,nrc_anticipation_density        DOUBLE PRECISION
  ,cognitive_density               DOUBLE PRECISION
  ,hedging_density                 DOUBLE PRECISION
  ,first_person_density            DOUBLE PRECISION
  ,inter_key_interval_mean         DOUBLE PRECISION
  ,inter_key_interval_std          DOUBLE PRECISION
  ,revision_chain_count            INT
  ,revision_chain_avg_length       DOUBLE PRECISION
  ,hold_time_mean                  DOUBLE PRECISION
  ,hold_time_std                   DOUBLE PRECISION
  ,flight_time_mean                DOUBLE PRECISION
  ,flight_time_std                 DOUBLE PRECISION
  ,keystroke_entropy               DOUBLE PRECISION
  ,mattr                           DOUBLE PRECISION
  ,avg_sentence_length             DOUBLE PRECISION
  ,sentence_length_variance        DOUBLE PRECISION
  ,scroll_back_count               INT
  ,question_reread_count           INT
  ,deletion_events_json            JSONB
  ,confirmation_latency_ms         DOUBLE PRECISION
  ,paste_count                     INT
  ,paste_chars_total               INT
  ,read_back_count                 INT
  ,leading_edge_ratio              DOUBLE PRECISION
  ,contextual_revision_count       INT
  ,pre_contextual_revision_count   INT
  ,considered_and_kept_count       INT
  ,hold_time_mean_left             DOUBLE PRECISION
  ,hold_time_mean_right            DOUBLE PRECISION
  ,hold_time_std_left              DOUBLE PRECISION
  ,hold_time_std_right             DOUBLE PRECISION
  ,hold_time_cv                    DOUBLE PRECISION
  ,negative_flight_time_count      INT
  ,iki_skewness                    DOUBLE PRECISION
  ,iki_kurtosis                    DOUBLE PRECISION
  ,error_detection_latency_mean    DOUBLE PRECISION
  ,terminal_velocity               DOUBLE PRECISION
  ,cursor_distance_during_pauses   DOUBLE PRECISION
  ,cursor_fidget_ratio             DOUBLE PRECISION
  ,cursor_stillness_during_pauses  DOUBLE PRECISION
  ,drift_to_submit_count           INT
  ,cursor_pause_sample_count       INT
  ,deletion_execution_speed_mean   DOUBLE PRECISION
  ,postcorrection_latency_mean     DOUBLE PRECISION
  ,mean_revision_distance          DOUBLE PRECISION
  ,max_revision_distance           INT
  ,punctuation_flight_mean         DOUBLE PRECISION
  ,punctuation_letter_ratio        DOUBLE PRECISION
  ,device_type                     TEXT
  ,user_agent                      TEXT
  ,hour_of_day                     SMALLINT
  ,day_of_week                     SMALLINT
  ,drop_count                      INT DEFAULT 0
  ,dttm_created_utc                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
