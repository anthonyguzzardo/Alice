-- ============================================================================
-- Alice PostgreSQL Schema — Tables
-- ============================================================================
-- PostgreSQL 17 + pgvector. Single-user cognitive journaling instrument.
-- Schema: alice (tables live here; extensions stay in public)
--
-- TYPE DECISIONS:
--   INT (4B)           — surrogate keys, counts that could theoretically exceed 32K
--   SMALLINT (2B)      — bounded small integers (hour 0-23, day 0-6, lag 1-30, index)
--   DOUBLE PRECISION   — all timing (microsecond-precision from performance.now()),
--                        all signal values (IEEE 754 f64, matches Rust f64 exactly),
--                        all ratios/densities/entropies
--   TEXT               — unbounded strings. PG TEXT = VARCHAR without limit, same
--                        storage, same performance. PG has no NVARCHAR; TEXT is
--                        already UTF-8 with full ICU collation support.
--   BOOLEAN            — binary flags. Never INT 0/1.
--   DATE               — calendar dates. Never TEXT 'YYYY-MM-DD'.
--   TIMESTAMPTZ        — all timestamps. Never TIMESTAMP (no timezone = drift risk
--                        if server TZ changes). Stored as microseconds since epoch
--                        internally (int64), so no float rounding on timestamps.
--   JSONB              — structured data (event logs, keystroke streams, arrays).
--                        Binary storage, indexable, auto-parsed by postgres.js driver.
--   vector(512)        — pgvector embedding type, HNSW-indexed.
--
-- RUST ALIGNMENT:
--   DOUBLE PRECISION <-> f64 (exact IEEE 754 match, no conversion loss)
--   INT              <-> i32 (exact range match: -2^31 to 2^31-1)
--   SMALLINT         <-> i16 (but napi-rs exports as i32/JsNumber; safe upcast)
--   BOOLEAN          <-> bool
--   TEXT             <-> String
--   JSONB            <-> serde_json::Value or String (serialized)
--
-- NAMING: te_ = enum, td_ = dictionary, tb_ = mutable, tm_ = matrix, th_ = history
-- KEYS: table_name_id (never just "id")
-- FK: logical only (no physical FK constraints)
-- FOOTER: dttm_created_utc, created_by, dttm_modified_utc, modified_by
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS alice;
SET search_path TO alice, public;

-- pgvector extension installs in public (shared across schemas)
CREATE EXTENSION IF NOT EXISTS vector;

-- @region enums -- te_question_source, te_reflection_type, te_interaction_event_type, te_prompt_trace_type, te_embedding_source, te_context_dimension, te_adversary_variants, te_signal_job_status, te_signal_job_kind
-- ============================================================================
-- ENUM TABLES (static, no footer)
-- ============================================================================

-- PURPOSE: question origin classification
-- MUTABILITY: static after deploy
CREATE TABLE IF NOT EXISTS te_question_source (
   question_source_id  SMALLINT PRIMARY KEY
  ,enum_code           TEXT UNIQUE NOT NULL
  ,name                TEXT NOT NULL
);

-- --------------------------------------------------------------------------

-- PURPOSE: reflection cadence
-- MUTABILITY: static after deploy
CREATE TABLE IF NOT EXISTS te_reflection_type (
   reflection_type_id  SMALLINT PRIMARY KEY
  ,enum_code           TEXT UNIQUE NOT NULL
  ,name                TEXT NOT NULL
);

-- --------------------------------------------------------------------------

-- PURPOSE: client-side interaction event classification
-- MUTABILITY: static after deploy
CREATE TABLE IF NOT EXISTS te_interaction_event_type (
   interaction_event_type_id  SMALLINT PRIMARY KEY
  ,enum_code                  TEXT UNIQUE NOT NULL
  ,name                       TEXT NOT NULL
);

-- --------------------------------------------------------------------------

-- PURPOSE: LLM prompt trace classification
-- MUTABILITY: static after deploy
CREATE TABLE IF NOT EXISTS te_prompt_trace_type (
   prompt_trace_type_id  SMALLINT PRIMARY KEY
  ,enum_code             TEXT UNIQUE NOT NULL
  ,name                  TEXT NOT NULL
);

-- --------------------------------------------------------------------------

-- PURPOSE: embedding source classification
-- MUTABILITY: static after deploy
CREATE TABLE IF NOT EXISTS te_embedding_source (
   embedding_source_id  SMALLINT PRIMARY KEY
  ,enum_code            TEXT UNIQUE NOT NULL
  ,name                 TEXT NOT NULL
);

-- --------------------------------------------------------------------------

-- PURPOSE: calibration context dimension classification
-- MUTABILITY: static after deploy
CREATE TABLE IF NOT EXISTS te_context_dimension (
   context_dimension_id  SMALLINT PRIMARY KEY
  ,enum_code             TEXT UNIQUE NOT NULL
  ,name                  TEXT NOT NULL
);

-- --------------------------------------------------------------------------

-- PURPOSE: static enumeration of ghost adversary strategies
-- USE CASE: discriminator for reconstruction residual rows; each variant
--           uses a different text generation + timing synthesis combination
-- MUTABILITY: static after deploy
-- REFERENCED BY: tb_reconstruction_residuals.adversary_variant_id
-- FOOTER: none (enum table)
CREATE TABLE IF NOT EXISTS te_adversary_variants (
   adversary_variant_id  SMALLINT PRIMARY KEY
  ,name                  TEXT NOT NULL UNIQUE
  ,description           TEXT
);

INSERT INTO te_adversary_variants (adversary_variant_id, name, description) VALUES
   (1, 'baseline',            'Order-2 Markov + independent ex-Gaussian timing')
  ,(2, 'conditional_timing',  'Order-2 Markov + AR(1) conditioned IKI')
  ,(3, 'copula_motor',        'Order-2 Markov + Gaussian copula hold/flight')
  ,(4, 'ppm_text',            'Variable-order PPM + independent timing')
  ,(5, 'full_adversary',      'PPM + AR(1) + copula')
ON CONFLICT (adversary_variant_id) DO NOTHING;

-- --------------------------------------------------------------------------

-- PURPOSE: signal job lifecycle status
-- MUTABILITY: static after deploy
-- REFERENCED BY: tb_signal_jobs.signal_job_status_id
CREATE TABLE IF NOT EXISTS te_signal_job_status (
   signal_job_status_id  SMALLINT PRIMARY KEY
  ,enum_code             TEXT UNIQUE NOT NULL
  ,name                  TEXT NOT NULL
  ,description           TEXT
);

INSERT INTO te_signal_job_status (signal_job_status_id, enum_code, name, description) VALUES
   (1, 'queued',      'Queued',      'Waiting for worker claim')
  ,(2, 'running',     'Running',     'Claimed by worker; in progress')
  ,(3, 'completed',   'Completed',   'All stages finished (or skipped via idempotent guards)')
  ,(4, 'failed',      'Failed',      'Last attempt failed; will retry if attempts < max_attempts')
  ,(5, 'dead_letter', 'Dead letter', 'Exceeded max_attempts; manual intervention required')
ON CONFLICT (signal_job_status_id) DO NOTHING;

-- --------------------------------------------------------------------------

-- PURPOSE: which pipeline a signal job runs
-- MUTABILITY: static after deploy
-- REFERENCED BY: tb_signal_jobs.signal_job_kind_id
CREATE TABLE IF NOT EXISTS te_signal_job_kind (
   signal_job_kind_id  SMALLINT PRIMARY KEY
  ,enum_code           TEXT UNIQUE NOT NULL
  ,name                TEXT NOT NULL
  ,description         TEXT
);

INSERT INTO te_signal_job_kind (signal_job_kind_id, enum_code, name, description) VALUES
   (1, 'response_pipeline',    'Response pipeline',    'Owner journal response: prior-day delta + question generation + witness render + embed + derived signals')
  ,(2, 'calibration_pipeline', 'Calibration pipeline', 'Calibration session: tag extraction + derived signals + drift snapshot')
ON CONFLICT (signal_job_kind_id) DO NOTHING;

-- @region identity -- tb_subjects
-- ============================================================================
-- IDENTITY
-- ============================================================================

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
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_single_owner
  ON tb_subjects (is_owner) WHERE is_owner = TRUE;

-- --------------------------------------------------------------------------

-- @region core -- tb_questions, tb_question_corpus, tb_scheduled_questions, tb_subject_responses, tb_subject_session_summaries, tb_responses, tb_interaction_events, tb_reflections, tb_question_feedback
-- ============================================================================
-- CORE MUTABLE TABLES
-- ============================================================================

-- PURPOSE: daily questions (seed, generated, calibration)
-- USE CASE: one row per question, scheduled_for is unique calendar date
-- MUTABILITY: insert once, rarely updated (intervention fields may be set later)
-- REFERENCED BY: tb_responses, tb_session_summaries, tb_session_events, tb_burst_sequences, tb_rburst_sequences
-- FOOTER: yes
CREATE TABLE IF NOT EXISTS tb_questions (
   question_id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,text                   TEXT NOT NULL
  ,question_source_id     SMALLINT NOT NULL DEFAULT 1
  ,scheduled_for          DATE UNIQUE
  ,intervention_intent_id INT
  ,intervention_rationale TEXT
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc      TIMESTAMPTZ
  ,modified_by            TEXT
);

-- --------------------------------------------------------------------------

-- PURPOSE: shared pool of reviewed questions for all subjects
-- USE CASE: one row per unique question text. Subjects are scheduled from this
--           pool via tb_scheduled_questions. Owner may also draw from this pool
--           but is not required to.
-- MUTABILITY: insert by owner, soft-retire via is_retired. Never deleted.
-- REFERENCED BY: tb_scheduled_questions (logical FK)
-- FOOTER: created only (append-only, retirement is a flag not an update)
CREATE TABLE IF NOT EXISTS tb_question_corpus (
   corpus_question_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,text                 TEXT UNIQUE NOT NULL
  ,theme_tag            TEXT
  ,is_retired           BOOLEAN NOT NULL DEFAULT FALSE
  ,added_by             TEXT NOT NULL DEFAULT 'owner'
  ,dttm_created_utc     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------------

-- PURPOSE: per-subject daily question assignments from the corpus
-- USE CASE: one row per (subject, date). The scheduler assigns a corpus question
--           to each active subject for each day. Round-robin with no-repeat window.
-- MUTABILITY: insert once per (subject, date). Never updated or deleted.
-- REFERENCED BY: tb_subject_responses (logical FK)
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_scheduled_questions (
   scheduled_question_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id             INT NOT NULL
  ,corpus_question_id     INT NOT NULL
  ,scheduled_for          DATE NOT NULL
  ,UNIQUE (subject_id, scheduled_for)
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_scheduled_questions_subject_corpus
  ON tb_scheduled_questions (subject_id, corpus_question_id);

-- --------------------------------------------------------------------------

-- PURPOSE: subject journal responses
-- USE CASE: one row per response, one response per scheduled question.
--           Submission is final.
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

-- --------------------------------------------------------------------------

-- PURPOSE: per-session behavioral summary for subject sessions
-- USE CASE: one row per subject session. Same behavioral columns as
--           tb_session_summaries for schema parity.
-- MUTABILITY: insert once per session, never updated
-- REFERENCED BY: none (leaf table in v1)
-- FOOTER: created only
-- SCHEMA PARITY: see db/sql/session_summary_divergence.allow
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

-- --------------------------------------------------------------------------

-- PURPOSE: user journal responses
-- USE CASE: one row per response, one response per question
-- MUTABILITY: insert once, never updated (black box)
-- REFERENCED BY: tb_entry_states, tb_semantic_states, tb_embeddings
-- FOOTER: yes
CREATE TABLE IF NOT EXISTS tb_responses (
   response_id                     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                     INT NOT NULL UNIQUE
  ,text                            TEXT NOT NULL
  ,contamination_boundary_version  TEXT NOT NULL DEFAULT 'v1'
  ,audited_code_paths_ref          TEXT NOT NULL DEFAULT 'docs/contamination-boundary-v1.md'
  ,code_commit_hash                TEXT NOT NULL DEFAULT 'pre-attestation'
  ,dttm_created_utc                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                      TEXT NOT NULL DEFAULT 'user'
  ,dttm_modified_utc               TIMESTAMPTZ
  ,modified_by                     TEXT
);

-- --------------------------------------------------------------------------

-- PURPOSE: client-side interaction event log (page_open, keystroke, pause, etc.)
-- USE CASE: append-only event stream per session
-- MUTABILITY: insert only
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_interaction_events (
   interaction_event_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                INT      NOT NULL
  ,interaction_event_type_id  SMALLINT NOT NULL
  ,metadata                   JSONB
  ,dttm_created_utc           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                 TEXT NOT NULL DEFAULT 'client'
);

-- --------------------------------------------------------------------------

-- PURPOSE: periodic AI-generated reflections over response history
-- USE CASE: weekly/monthly synthesis
-- MUTABILITY: insert once, may be regenerated
-- FOOTER: yes
CREATE TABLE IF NOT EXISTS tb_reflections (
   reflection_id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,text                         TEXT NOT NULL
  ,reflection_type_id           SMALLINT NOT NULL DEFAULT 1
  ,coverage_through_response_id INT
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc            TIMESTAMPTZ
  ,modified_by                  TEXT
);

-- --------------------------------------------------------------------------

-- PURPOSE: user feedback on whether a question "landed"
-- USE CASE: one boolean per question
-- MUTABILITY: insert once
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_question_feedback (
   question_feedback_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id           INT     NOT NULL UNIQUE
  ,landed                BOOLEAN NOT NULL
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'user'
);

-- --------------------------------------------------------------------------

-- @region sessions -- tb_session_summaries, tb_session_events, tb_session_metadata, tb_burst_sequences, tb_rburst_sequences, tb_prompt_traces, tb_embedding_model_versions, tb_embeddings

-- PURPOSE: per-session behavioral summary computed from raw keystroke capture
-- USE CASE: one row per session, computed at submission time
-- MUTABILITY: insert once, never updated
-- REFERENCED BY: state engine, signal pipeline, observatory
-- FOOTER: created only
--
-- TIMING COLUMNS: DOUBLE PRECISION (f64)
--   Source: performance.now() in browser, ~5 microsecond resolution.
--   Values are offsets in fractional milliseconds (e.g. 1523.456789).
--   Max session ~2 hours = 7,200,000.000 ms. f64 has 15+ significant digits,
--   so 7 integer digits + 8 fractional digits = no precision loss.
--   NUMERIC would be 4-10x slower for arithmetic with no gain since the
--   source resolution is ~5 microseconds (3 fractional digits meaningful).
--
-- RATIO/DENSITY COLUMNS: DOUBLE PRECISION (f64)
--   All are [0,1] bounded or small positive reals. f64 has 15-17 significant
--   digits; ratios computed from counts < 100K have at most 5 significant
--   digits. No precision concern.
--
-- COUNT COLUMNS: INT (i32)
--   Max value 2,147,483,647. Keystroke counts per session < 50,000.
--   SMALLINT (i16, max 32,767) would technically work for most counts but
--   risks overflow on edge cases (paste_chars_total, total_chars_typed for
--   very long sessions) and saves only 2 bytes per column. Not worth the risk.
CREATE TABLE IF NOT EXISTS tb_session_summaries (
   session_summary_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                 INT  NOT NULL UNIQUE
  -- Behavioral core (timing: f64 microsecond-precision offsets)
  ,first_keystroke_ms          DOUBLE PRECISION
  ,total_duration_ms           DOUBLE PRECISION
  ,total_chars_typed           INT
  ,final_char_count            INT
  ,commitment_ratio            DOUBLE PRECISION
  ,pause_count                 INT
  ,total_pause_ms              DOUBLE PRECISION
  ,deletion_count              INT
  ,largest_deletion            INT
  ,total_chars_deleted         INT
  ,tab_away_count              INT
  ,total_tab_away_ms           DOUBLE PRECISION
  ,word_count                  INT
  ,sentence_count              INT
  -- Deletion decomposition
  ,small_deletion_count        INT
  ,large_deletion_count        INT
  ,large_deletion_chars        INT
  ,first_half_deletion_chars   INT
  ,second_half_deletion_chars  INT
  -- Production fluency
  ,active_typing_ms            DOUBLE PRECISION
  ,chars_per_minute            DOUBLE PRECISION
  ,p_burst_count               INT
  ,avg_p_burst_length          DOUBLE PRECISION
  -- NRC Emotion Lexicon densities (word count / total words, [0,1])
  ,nrc_anger_density           DOUBLE PRECISION
  ,nrc_fear_density            DOUBLE PRECISION
  ,nrc_joy_density             DOUBLE PRECISION
  ,nrc_sadness_density         DOUBLE PRECISION
  ,nrc_trust_density           DOUBLE PRECISION
  ,nrc_anticipation_density    DOUBLE PRECISION
  ,cognitive_density           DOUBLE PRECISION
  ,hedging_density             DOUBLE PRECISION
  ,first_person_density        DOUBLE PRECISION
  -- Keystroke dynamics
  ,inter_key_interval_mean     DOUBLE PRECISION
  ,inter_key_interval_std      DOUBLE PRECISION
  ,revision_chain_count        INT
  ,revision_chain_avg_length   DOUBLE PRECISION
  -- Hold time + flight time decomposition (microsecond-precision)
  ,hold_time_mean              DOUBLE PRECISION
  ,hold_time_std               DOUBLE PRECISION
  ,flight_time_mean            DOUBLE PRECISION
  ,flight_time_std             DOUBLE PRECISION
  -- Keystroke entropy (bits)
  ,keystroke_entropy           DOUBLE PRECISION
  -- Lexical diversity ([0,1])
  ,mattr                       DOUBLE PRECISION
  -- Sentence metrics
  ,avg_sentence_length         DOUBLE PRECISION
  ,sentence_length_variance    DOUBLE PRECISION
  -- Session metadata
  ,scroll_back_count           INT
  ,question_reread_count       INT
  -- Deletion event log (array of {chars, time, type})
  ,deletion_events_json        JSONB
  -- Cursor behavior + writing process (Phase 1 expansion)
  ,confirmation_latency_ms     DOUBLE PRECISION
  ,paste_count                 INT
  ,paste_chars_total           INT
  ,read_back_count             INT
  ,leading_edge_ratio          DOUBLE PRECISION
  ,contextual_revision_count   INT
  ,pre_contextual_revision_count INT
  ,considered_and_kept_count   INT
  ,hold_time_mean_left         DOUBLE PRECISION
  ,hold_time_mean_right        DOUBLE PRECISION
  ,hold_time_std_left          DOUBLE PRECISION
  ,hold_time_std_right         DOUBLE PRECISION
  ,hold_time_cv                DOUBLE PRECISION
  ,negative_flight_time_count  INT
  ,iki_skewness                DOUBLE PRECISION
  ,iki_kurtosis                DOUBLE PRECISION
  ,error_detection_latency_mean DOUBLE PRECISION
  ,terminal_velocity           DOUBLE PRECISION
  -- Mouse/cursor trajectory (Phase 2 expansion)
  ,cursor_distance_during_pauses DOUBLE PRECISION
  ,cursor_fidget_ratio         DOUBLE PRECISION
  ,cursor_stillness_during_pauses DOUBLE PRECISION
  ,drift_to_submit_count       INT
  ,cursor_pause_sample_count   INT
  -- Precorrection/postcorrection latency (microsecond-precision)
  ,deletion_execution_speed_mean DOUBLE PRECISION
  ,postcorrection_latency_mean DOUBLE PRECISION
  -- Revision distance (character positions)
  ,mean_revision_distance      DOUBLE PRECISION
  ,max_revision_distance       INT
  -- Punctuation key latency (microsecond-precision)
  ,punctuation_flight_mean     DOUBLE PRECISION
  ,punctuation_letter_ratio    DOUBLE PRECISION
  -- Context
  ,device_type                 TEXT
  ,user_agent                  TEXT
  ,hour_of_day                 SMALLINT CHECK (hour_of_day BETWEEN 0 AND 23)
  ,day_of_week                 SMALLINT CHECK (day_of_week BETWEEN 0 AND 6)
  -- Footer
  ,dttm_created_utc            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                  TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: LLM prompt provenance for auditability
-- USE CASE: one row per LLM call (generation, observation, reflection)
-- MUTABILITY: insert only
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_prompt_traces (
   prompt_trace_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,prompt_trace_type_id   SMALLINT NOT NULL
  ,output_record_id       INT
  ,recent_entry_ids       JSONB
  ,rag_entry_ids          JSONB
  ,contrarian_entry_ids   JSONB
  ,reflection_ids         JSONB
  ,observation_ids        JSONB
  ,model_name             TEXT NOT NULL DEFAULT 'claude-opus-4-6'
  ,token_estimate         INT
  ,difficulty_level       TEXT
  ,difficulty_inputs      JSONB
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: vector embeddings for semantic search (RAG)
-- USE CASE: one embedding per response/observation/reflection
-- MUTABILITY: insert once, may be regenerated on model change
-- FOOTER: created only
--
-- vector(512): pgvector stores as array of float4 (32-bit). This is intentional;
-- embedding dimensions do not benefit from float64 precision (models output
-- float32). 512 dims * 4 bytes = 2048 bytes per vector.
-- PURPOSE: Embedding model version registry. Tracks exact weights, inference
--          environment, and lifecycle of each model used for embedding.
-- USE CASE: One row per model deployment. Links to tb_embeddings for provenance.
-- MUTABILITY: Insert on model change. active_to set when retired.
-- REFERENCED BY: tb_embeddings.embedding_model_version_id
-- FOOTER: created only
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

-- --------------------------------------------------------------------------

-- PURPOSE: pgvector embeddings for semantic similarity search
-- USE CASE: one row per (source, record, model version). Topic-matching via HNSW.
-- MUTABILITY: insert only. Soft-invalidated via invalidated_at when model changes.
-- REFERENCED BY: tb_semantic_trajectory (topic-matched z-scores via HNSW)
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_embeddings (
   embedding_id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,embedding_source_id         SMALLINT NOT NULL
  ,source_record_id            INT      NOT NULL
  ,embedded_text               TEXT NOT NULL
  ,source_date                 DATE
  ,model_name                  TEXT NOT NULL DEFAULT 'Qwen3-Embedding-0.6B'
  ,embedding_model_version_id  INT
  ,embedding                   vector(512)
  ,invalidated_at              TIMESTAMPTZ
  ,dttm_created_utc            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                  TEXT NOT NULL DEFAULT 'system'
  ,UNIQUE(embedding_source_id, source_record_id, embedding_model_version_id)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON tb_embeddings
  USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64);

-- @region state -- tb_witness_states, tb_entry_states, tb_semantic_states, tb_trait_dynamics, tb_coupling_matrix, tb_emotion_behavior_coupling, tb_semantic_dynamics, tb_semantic_coupling
-- ============================================================================
-- WITNESS, STATE, DYNAMICS, COUPLING TABLES
-- ============================================================================

-- PURPOSE: AI witness state snapshots (trait + signal JSON blobs)
-- USE CASE: one row per observation cycle
-- MUTABILITY: insert only
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_witness_states (
   witness_state_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count         INT  NOT NULL
  ,traits_json         JSONB NOT NULL
  ,signals_json        JSONB NOT NULL
  ,model_name          TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514'
  ,dttm_created_utc    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by          TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: P-burst sequences per session
-- USE CASE: ordered burst-level decomposition of writing flow
-- MUTABILITY: insert only
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_burst_sequences (
   burst_sequence_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id            INT      NOT NULL
  ,burst_index            SMALLINT NOT NULL
  ,burst_char_count       INT      NOT NULL
  ,burst_duration_ms      DOUBLE PRECISION NOT NULL
  ,burst_start_offset_ms  DOUBLE PRECISION NOT NULL
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'client'
);

-- --------------------------------------------------------------------------

-- PURPOSE: R-burst (revision burst) sequences per session
-- USE CASE: per-R-burst decomposition parallel to P-burst sequences;
--           Deane 2015 classification + Lindgren & Sullivan 2006 leading edge
-- MUTABILITY: insert only
-- REFERENCED BY: none (leaf table)
-- FOOTER: created only
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

-- --------------------------------------------------------------------------

-- PURPOSE: derived session-level metadata (computed post-submission)
-- USE CASE: hour typicality, burst trajectory shape, deletion curve
-- MUTABILITY: insert once per session
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_session_metadata (
   session_metadata_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                   INT NOT NULL UNIQUE
  ,hour_typicality               DOUBLE PRECISION
  ,deletion_curve_type           TEXT
  ,burst_trajectory_shape        TEXT
  ,rburst_trajectory_shape       TEXT
  ,inter_burst_interval_mean_ms  DOUBLE PRECISION
  ,inter_burst_interval_std_ms   DOUBLE PRECISION
  ,deletion_during_burst_count   INT
  ,deletion_between_burst_count  INT
  ,dttm_created_utc              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                    TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: calibration baseline history snapshots
-- USE CASE: tracks baseline drift over calibration sessions
-- MUTABILITY: insert only (append-only history)
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_calibration_baselines_history (
   calibration_history_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,calibration_session_count     INT NOT NULL
  ,device_type                   TEXT
  ,avg_first_keystroke_ms        DOUBLE PRECISION
  ,avg_commitment_ratio          DOUBLE PRECISION
  ,avg_duration_ms               DOUBLE PRECISION
  ,avg_pause_count               DOUBLE PRECISION
  ,avg_deletion_count            DOUBLE PRECISION
  ,avg_chars_per_minute          DOUBLE PRECISION
  ,avg_p_burst_length            DOUBLE PRECISION
  ,avg_small_deletion_count      DOUBLE PRECISION
  ,avg_large_deletion_count      DOUBLE PRECISION
  ,avg_iki_mean                  DOUBLE PRECISION
  ,avg_hold_time_mean            DOUBLE PRECISION
  ,avg_flight_time_mean          DOUBLE PRECISION
  ,drift_magnitude               DOUBLE PRECISION
  ,dttm_created_utc              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                    TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: raw event log + keystroke stream per session
-- USE CASE: replay, process signal computation, dynamical signal computation
-- MUTABILITY: insert once per session
-- FOOTER: created only
--
-- event_log_json: JSONB array of [offsetMs, cursorPos, deletedCount, insertedText]
--   offsetMs is DOUBLE PRECISION in the JSON (microsecond-precision from performance.now())
--   JSONB stores numbers as numeric internally; no float precision loss on storage.
--   postgres.js auto-parses JSONB on read; signal functions must accept parsed arrays.
--
-- keystroke_stream_json: JSONB array of {c: keyCode, d: keydownOffset, u: keyupOffset}
--   d and u are DOUBLE PRECISION offsets from page open (microsecond-precision).
--   Consumed by Rust signal engine via JSON.stringify() round-trip.
CREATE TABLE IF NOT EXISTS tb_session_events (
   session_event_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id            INT NOT NULL UNIQUE
  ,event_log_json         JSONB NOT NULL
  ,total_events           INT   NOT NULL
  ,session_duration_ms    DOUBLE PRECISION NOT NULL
  ,keystroke_stream_json  JSONB
  ,total_input_events     INT
  ,decimation_count       INT
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'client'
);

-- --------------------------------------------------------------------------

-- PURPOSE: 8D behavioral state per journal entry
-- USE CASE: PersDyn state engine output, observatory visualization
-- MUTABILITY: insert once, recomputable from session summaries
-- FOOTER: created only
--
-- All dimensions are DOUBLE PRECISION [0,1] normalized.
-- Rust f64 -> JS number -> PG float8. No conversion loss.
CREATE TABLE IF NOT EXISTS tb_entry_states (
   entry_state_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,response_id       INT NOT NULL UNIQUE
  ,fluency           DOUBLE PRECISION NOT NULL
  ,deliberation      DOUBLE PRECISION NOT NULL
  ,revision          DOUBLE PRECISION NOT NULL
  ,commitment        DOUBLE PRECISION NOT NULL
  ,volatility        DOUBLE PRECISION NOT NULL
  ,thermal           DOUBLE PRECISION NOT NULL
  ,presence          DOUBLE PRECISION NOT NULL
  ,convergence       DOUBLE PRECISION NOT NULL
  ,dttm_created_utc  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by        TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: per-dimension trait dynamics (baseline, variability, attractor)
-- USE CASE: PersDyn trait tracking, convergence detection
-- MUTABILITY: recomputed each session (latest row per dimension is current)
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_trait_dynamics (
   trait_dynamic_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count        INT      NOT NULL
  ,dimension          TEXT     NOT NULL
  ,baseline           DOUBLE PRECISION NOT NULL
  ,variability        DOUBLE PRECISION NOT NULL
  ,attractor_force    DOUBLE PRECISION NOT NULL
  ,current_state      DOUBLE PRECISION NOT NULL
  ,deviation          DOUBLE PRECISION NOT NULL
  ,window_size        SMALLINT NOT NULL
  ,dttm_created_utc   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by         TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: cross-dimension coupling (which dimensions lead/follow)
-- USE CASE: coupling matrix in observatory
-- MUTABILITY: recomputed each session
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_coupling_matrix (
   coupling_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count        INT      NOT NULL
  ,leader             TEXT     NOT NULL
  ,follower           TEXT     NOT NULL
  ,lag_sessions       SMALLINT NOT NULL
  ,correlation        DOUBLE PRECISION NOT NULL
  ,direction          DOUBLE PRECISION NOT NULL
  ,dttm_created_utc   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by         TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: emotion-behavior cross-space coupling
-- USE CASE: NRC emotion dims correlated with behavioral dims at lag
-- MUTABILITY: recomputed each session
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_emotion_behavior_coupling (
   emotion_coupling_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count          INT      NOT NULL
  ,emotion_dim          TEXT     NOT NULL
  ,behavior_dim         TEXT     NOT NULL
  ,lag_sessions         SMALLINT NOT NULL
  ,correlation          DOUBLE PRECISION NOT NULL
  ,direction            DOUBLE PRECISION NOT NULL
  ,dttm_created_utc     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by           TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: 11D+ semantic state per journal entry
-- USE CASE: parallel semantic space to behavioral 8D
-- MUTABILITY: insert once, recomputable
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_semantic_states (
   semantic_state_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,response_id           INT NOT NULL UNIQUE
  ,syntactic_complexity  DOUBLE PRECISION NOT NULL
  ,interrogation         DOUBLE PRECISION NOT NULL
  ,self_focus            DOUBLE PRECISION NOT NULL
  ,uncertainty           DOUBLE PRECISION NOT NULL
  ,cognitive_processing  DOUBLE PRECISION NOT NULL
  ,nrc_anger             DOUBLE PRECISION NOT NULL
  ,nrc_fear              DOUBLE PRECISION NOT NULL
  ,nrc_joy               DOUBLE PRECISION NOT NULL
  ,nrc_sadness           DOUBLE PRECISION NOT NULL
  ,nrc_trust             DOUBLE PRECISION NOT NULL
  ,nrc_anticipation      DOUBLE PRECISION NOT NULL
  ,sentiment             DOUBLE PRECISION
  ,abstraction           DOUBLE PRECISION
  ,agency_framing        DOUBLE PRECISION
  ,temporal_orientation  DOUBLE PRECISION
  ,convergence           DOUBLE PRECISION NOT NULL
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: per-dimension semantic trait dynamics
-- MUTABILITY: recomputed each session
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_semantic_dynamics (
   semantic_dynamic_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count          INT      NOT NULL
  ,dimension            TEXT     NOT NULL
  ,baseline             DOUBLE PRECISION NOT NULL
  ,variability          DOUBLE PRECISION NOT NULL
  ,attractor_force      DOUBLE PRECISION NOT NULL
  ,current_state        DOUBLE PRECISION NOT NULL
  ,deviation            DOUBLE PRECISION NOT NULL
  ,window_size          SMALLINT NOT NULL
  ,dttm_created_utc     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by           TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: semantic cross-dimension coupling
-- MUTABILITY: recomputed each session
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_semantic_coupling (
   semantic_coupling_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count           INT      NOT NULL
  ,leader                TEXT     NOT NULL
  ,follower              TEXT     NOT NULL
  ,lag_sessions          SMALLINT NOT NULL
  ,correlation           DOUBLE PRECISION NOT NULL
  ,direction             DOUBLE PRECISION NOT NULL
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
);

-- @region signals -- tb_dynamical_signals, tb_motor_signals, tb_semantic_signals, tb_process_signals, tb_cross_session_signals
-- ============================================================================
-- SIGNAL TABLES (append-only, one row per session)
-- ============================================================================
-- All signal values are DOUBLE PRECISION (Rust f64 -> JS number -> PG float8).
-- No conversion loss at any boundary. Nullable because short sessions may not
-- produce enough data for computation (e.g., RQA needs >= 30 IKIs).

-- PURPOSE: nonlinear dynamical signals from IKI series
-- USE CASE: RQA, DFA, permutation entropy, transfer entropy
-- MUTABILITY: insert once, recomputable from keystroke_stream_json
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_dynamical_signals (
   dynamical_signal_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                  INT NOT NULL UNIQUE
  ,iki_count                    INT
  ,hold_flight_count            INT
  ,permutation_entropy          DOUBLE PRECISION
  ,permutation_entropy_raw      DOUBLE PRECISION
  ,pe_spectrum                  JSONB
  ,dfa_alpha                    DOUBLE PRECISION
  ,mfdfa_spectrum_width         DOUBLE PRECISION
  ,mfdfa_asymmetry              DOUBLE PRECISION
  ,mfdfa_peak_alpha             DOUBLE PRECISION
  ,temporal_irreversibility     DOUBLE PRECISION
  ,iki_psd_spectral_slope       DOUBLE PRECISION
  ,iki_psd_respiratory_peak_hz  DOUBLE PRECISION
  ,peak_typing_frequency_hz     DOUBLE PRECISION
  ,iki_psd_lf_hf_ratio          DOUBLE PRECISION
  ,iki_psd_fast_slow_variance_ratio DOUBLE PRECISION
  ,statistical_complexity       DOUBLE PRECISION
  ,forbidden_pattern_fraction   DOUBLE PRECISION
  ,weighted_pe                  DOUBLE PRECISION
  ,lempel_ziv_complexity        DOUBLE PRECISION
  ,optn_transition_entropy      DOUBLE PRECISION
  ,optn_forbidden_transition_count INT
  ,rqa_determinism              DOUBLE PRECISION
  ,rqa_laminarity               DOUBLE PRECISION
  ,rqa_trapping_time            DOUBLE PRECISION
  ,rqa_recurrence_rate          DOUBLE PRECISION
  ,te_hold_to_flight            DOUBLE PRECISION
  ,te_flight_to_hold            DOUBLE PRECISION
  ,rqa_recurrence_time_entropy  DOUBLE PRECISION
  ,rqa_mean_recurrence_time     DOUBLE PRECISION
  ,recurrence_transitivity      DOUBLE PRECISION
  ,recurrence_avg_path_length   DOUBLE PRECISION
  ,recurrence_clustering        DOUBLE PRECISION
  ,recurrence_assortativity     DOUBLE PRECISION
  ,te_dominance                 DOUBLE PRECISION
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: motor rhythm and biometric signals
-- USE CASE: sample entropy, ex-Gaussian, digraph latency, motor coordination
-- MUTABILITY: insert once, recomputable from keystroke_stream_json
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_motor_signals (
   motor_signal_id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                  INT NOT NULL UNIQUE
  ,sample_entropy               DOUBLE PRECISION
  ,iki_autocorrelation_json     JSONB
  ,motor_jerk                   DOUBLE PRECISION
  ,lapse_rate                   DOUBLE PRECISION
  ,tempo_drift                  DOUBLE PRECISION
  ,iki_compression_ratio        DOUBLE PRECISION
  ,digraph_latency_json         JSONB
  ,ex_gaussian_tau              DOUBLE PRECISION
  ,ex_gaussian_mu               DOUBLE PRECISION
  ,ex_gaussian_sigma            DOUBLE PRECISION
  ,tau_proportion               DOUBLE PRECISION
  ,adjacent_hold_time_cov       DOUBLE PRECISION
  ,hold_flight_rank_corr        DOUBLE PRECISION
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: text-level semantic signals from response content
-- USE CASE: idea density, lexical sophistication, cohesion, valence arc
-- MUTABILITY: insert once, recomputable from response text
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_semantic_signals (
   semantic_signal_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                  INT NOT NULL UNIQUE
  ,idea_density                 DOUBLE PRECISION
  ,lexical_sophistication       DOUBLE PRECISION
  ,epistemic_stance             DOUBLE PRECISION
  ,integrative_complexity       DOUBLE PRECISION
  ,deep_cohesion                DOUBLE PRECISION
  ,referential_cohesion         DOUBLE PRECISION
  ,emotional_valence_arc        TEXT
  ,text_compression_ratio       DOUBLE PRECISION
  ,discourse_global_coherence   DOUBLE PRECISION
  ,discourse_local_coherence    DOUBLE PRECISION
  ,discourse_global_local_ratio DOUBLE PRECISION
  ,discourse_coherence_decay_slope DOUBLE PRECISION
  ,lexicon_version              SMALLINT NOT NULL DEFAULT 1
  ,paste_contaminated           BOOLEAN NOT NULL DEFAULT FALSE
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: writing process signals from event log replay
-- USE CASE: pause location, abandoned thoughts, burst classification
-- MUTABILITY: insert once, recomputable from event_log_json
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_process_signals (
   process_signal_id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                  INT NOT NULL UNIQUE
  ,pause_within_word            INT
  ,pause_between_word           INT
  ,pause_between_sentence       INT
  ,abandoned_thought_count      INT
  ,r_burst_count                INT
  ,i_burst_count                INT
  ,vocab_expansion_rate         DOUBLE PRECISION
  ,phase_transition_point       DOUBLE PRECISION
  ,strategy_shift_count         INT
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: cross-session longitudinal signals
-- USE CASE: self-perplexity, NCD, vocab recurrence, text network structure
-- MUTABILITY: insert once, recomputable from historical responses
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_cross_session_signals (
   cross_session_signal_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                  INT NOT NULL UNIQUE
  ,self_perplexity              DOUBLE PRECISION
  ,motor_self_perplexity        DOUBLE PRECISION
  ,ncd_lag_1                    DOUBLE PRECISION
  ,ncd_lag_3                    DOUBLE PRECISION
  ,ncd_lag_7                    DOUBLE PRECISION
  ,ncd_lag_30                   DOUBLE PRECISION
  ,vocab_recurrence_decay       DOUBLE PRECISION
  ,digraph_stability            DOUBLE PRECISION
  ,text_network_density         DOUBLE PRECISION
  ,text_network_communities     INT
  ,bridging_ratio               DOUBLE PRECISION
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
);

-- @region calibration -- tb_calibration_context, tb_calibration_baselines_history, tb_session_delta
-- ============================================================================
-- CALIBRATION & CONTEXT TABLES
-- ============================================================================

-- PURPOSE: extracted context tags from calibration responses
-- USE CASE: incidental supervision for confound tracking
-- MUTABILITY: insert once per calibration
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_calibration_context (
   calibration_context_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id             INT      NOT NULL
  ,context_dimension_id    SMALLINT NOT NULL
  ,value                   TEXT NOT NULL
  ,detail                  TEXT
  ,confidence              DOUBLE PRECISION NOT NULL DEFAULT 1.0
  ,dttm_created_utc        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by              TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: calibration vs journal session delta for same-day comparison
-- USE CASE: separating state-of-day from trait signal
-- MUTABILITY: insert once per day with both sessions
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_session_delta (
   session_delta_id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,session_date                        DATE NOT NULL UNIQUE
  ,calibration_question_id             INT  NOT NULL
  ,journal_question_id                 INT  NOT NULL
  -- Delta dimensions (journal - calibration, signed)
  ,delta_first_person                  DOUBLE PRECISION
  ,delta_cognitive                     DOUBLE PRECISION
  ,delta_hedging                       DOUBLE PRECISION
  ,delta_chars_per_minute              DOUBLE PRECISION
  ,delta_commitment                    DOUBLE PRECISION
  ,delta_large_deletion_count          DOUBLE PRECISION
  ,delta_inter_key_interval_mean       DOUBLE PRECISION
  ,delta_avg_p_burst_length            DOUBLE PRECISION
  ,delta_hold_time_mean                DOUBLE PRECISION
  ,delta_flight_time_mean              DOUBLE PRECISION
  -- Composite
  ,delta_magnitude                     DOUBLE PRECISION
  -- Raw values (for reconstruction)
  ,calibration_first_person            DOUBLE PRECISION
  ,journal_first_person                DOUBLE PRECISION
  ,calibration_cognitive               DOUBLE PRECISION
  ,journal_cognitive                   DOUBLE PRECISION
  ,calibration_hedging                 DOUBLE PRECISION
  ,journal_hedging                     DOUBLE PRECISION
  ,calibration_chars_per_minute        DOUBLE PRECISION
  ,journal_chars_per_minute            DOUBLE PRECISION
  ,calibration_commitment              DOUBLE PRECISION
  ,journal_commitment                  DOUBLE PRECISION
  ,calibration_large_deletion_count    DOUBLE PRECISION
  ,journal_large_deletion_count        DOUBLE PRECISION
  ,calibration_inter_key_interval_mean DOUBLE PRECISION
  ,journal_inter_key_interval_mean     DOUBLE PRECISION
  ,calibration_avg_p_burst_length      DOUBLE PRECISION
  ,journal_avg_p_burst_length          DOUBLE PRECISION
  ,calibration_hold_time_mean          DOUBLE PRECISION
  ,journal_hold_time_mean              DOUBLE PRECISION
  ,calibration_flight_time_mean        DOUBLE PRECISION
  ,journal_flight_time_mean            DOUBLE PRECISION
  -- Footer
  ,dttm_created_utc                    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                          TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- @region profile -- tb_paper_comments, tb_personal_profile, tb_reconstruction_residuals, tb_session_integrity, tb_semantic_baselines, tb_semantic_trajectory

-- PURPOSE: public paper comments
-- USE CASE: reader feedback on published research
-- MUTABILITY: insert only
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_paper_comments (
   paper_comment_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,paper_slug          TEXT NOT NULL
  ,author_name         TEXT NOT NULL
  ,comment_text        TEXT NOT NULL
  ,dttm_created_utc    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by          TEXT NOT NULL DEFAULT 'reader'
);

-- --------------------------------------------------------------------------

-- PURPOSE: Rolling behavioral profile aggregated from all journal sessions.
-- USE CASE: Foundation for writing avatar / process reconstruction. Single row
--           updated in place after each session. Feeds all adversary variants.
-- MUTABILITY: Updated after each journal session.
-- REFERENCED BY: reconstruction pipeline, mediation detection.
-- FOOTER: dttm_updated_utc only.
CREATE TABLE IF NOT EXISTS tb_personal_profile (
   profile_id              SERIAL PRIMARY KEY
  ,session_count           INT NOT NULL DEFAULT 0
  ,last_question_id        INT

  -- ── Motor fingerprint ──────────────────────────────────────────────
  ,digraph_aggregate_json  JSONB
  ,ex_gaussian_mu_mean     DOUBLE PRECISION
  ,ex_gaussian_mu_std      DOUBLE PRECISION
  ,ex_gaussian_sigma_mean  DOUBLE PRECISION
  ,ex_gaussian_sigma_std   DOUBLE PRECISION
  ,ex_gaussian_tau_mean    DOUBLE PRECISION
  ,ex_gaussian_tau_std     DOUBLE PRECISION
  ,iki_mean_mean           DOUBLE PRECISION
  ,iki_mean_std            DOUBLE PRECISION
  ,iki_std_mean            DOUBLE PRECISION
  ,iki_skewness_mean       DOUBLE PRECISION
  ,iki_kurtosis_mean       DOUBLE PRECISION
  ,hold_time_mean_mean     DOUBLE PRECISION
  ,hold_time_mean_std      DOUBLE PRECISION
  ,flight_time_mean_mean   DOUBLE PRECISION
  ,flight_time_mean_std    DOUBLE PRECISION
  ,hold_time_cv_mean       DOUBLE PRECISION

  -- ── Writing process shape ──────────────────────────────────────────
  ,burst_count_mean        DOUBLE PRECISION
  ,burst_count_std         DOUBLE PRECISION
  ,burst_length_mean       DOUBLE PRECISION
  ,burst_length_std        DOUBLE PRECISION
  ,burst_consolidation     DOUBLE PRECISION
  ,session_duration_mean   DOUBLE PRECISION
  ,session_duration_std    DOUBLE PRECISION
  ,word_count_mean         DOUBLE PRECISION
  ,word_count_std          DOUBLE PRECISION

  -- ── Pause architecture ─────────────────────────────────────────────
  ,pause_within_word_pct   DOUBLE PRECISION
  ,pause_between_word_pct  DOUBLE PRECISION
  ,pause_between_sent_pct  DOUBLE PRECISION
  ,pause_rate_mean         DOUBLE PRECISION
  ,first_keystroke_mean    DOUBLE PRECISION
  ,first_keystroke_std     DOUBLE PRECISION

  -- ── Revision topology ──────────────────────────────────────────────
  ,small_del_rate_mean     DOUBLE PRECISION
  ,large_del_rate_mean     DOUBLE PRECISION
  ,revision_timing_bias    DOUBLE PRECISION
  ,r_burst_ratio_mean      DOUBLE PRECISION

  -- ── Language signature ─────────────────────────────────────────────
  ,trigram_model_json      JSONB
  ,vocab_cumulative        INT
  ,mattr_mean              DOUBLE PRECISION
  ,mattr_std               DOUBLE PRECISION

  -- ── R-burst aggregation (migration 009) ────────────────────────────
  ,rburst_consolidation    DOUBLE PRECISION
  ,rburst_mean_size        DOUBLE PRECISION
  ,rburst_mean_duration    DOUBLE PRECISION
  ,rburst_leading_edge_pct DOUBLE PRECISION

  -- ── Adversary variant inputs (migration 010) ───────────────────────
  ,iki_autocorrelation_lag1_mean  DOUBLE PRECISION
  ,hold_flight_rank_correlation   DOUBLE PRECISION

  ,dttm_updated_utc        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------

-- PURPOSE: Per-session per-variant delta between real signals and ghost signals.
-- USE CASE: Measures what in a person's behavior cannot be predicted by their
--           own statistical profile. One row per (session, adversary variant).
--           The residual is the cognitive signature.
-- MUTABILITY: Insert once per session per variant after profile update. Recomputable.
-- REFERENCED BY: convergence tracking, observatory, multi-adversary comparison.
-- FOOTER: created only (append-only).
CREATE TABLE IF NOT EXISTS tb_reconstruction_residuals (
   reconstruction_residual_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                  INT NOT NULL
  ,adversary_variant_id         SMALLINT NOT NULL DEFAULT 1
  ,question_source_id           SMALLINT
  ,UNIQUE (question_id, adversary_variant_id)

  -- ── Reproducibility inputs (store to regenerate the exact ghost) ─────
  ,avatar_seed                  TEXT            -- PRNG seed (u64 decimal string). NULL = pre-reproducibility-era.
  ,profile_snapshot_json        JSONB           -- exact profile JSON passed to generateAvatar(). NULL = pre-reproducibility-era.
  ,corpus_sha256                TEXT            -- SHA-256 hex digest of corpusJson. NULL = pre-reproducibility-era.
  ,avatar_topic                 TEXT            -- topic string passed to generateAvatar(). NULL = pre-reproducibility-era.

  -- ── Avatar generation metadata ──────────────────────────────────────
  ,avatar_text                  TEXT
  ,avatar_word_count            INT
  ,avatar_markov_order          SMALLINT
  ,avatar_chain_size            INT
  ,avatar_i_burst_count         INT
  ,real_word_count              INT
  ,corpus_size                  INT
  ,session_count                INT

  -- ── Perplexity comparison (Markov model) ────────────────────────────
  ,real_perplexity              DOUBLE PRECISION
  ,real_known_fraction          DOUBLE PRECISION
  ,avatar_perplexity            DOUBLE PRECISION
  ,avatar_known_fraction        DOUBLE PRECISION
  ,perplexity_residual          DOUBLE PRECISION

  -- ── Dynamical signal residuals ──────────────────────────────────────
  ,real_permutation_entropy     DOUBLE PRECISION
  ,avatar_permutation_entropy   DOUBLE PRECISION
  ,residual_permutation_entropy DOUBLE PRECISION

  ,real_pe_spectrum             JSONB
  ,avatar_pe_spectrum           JSONB
  ,residual_pe_spectrum         JSONB

  ,real_dfa_alpha               DOUBLE PRECISION
  ,avatar_dfa_alpha             DOUBLE PRECISION
  ,residual_dfa_alpha           DOUBLE PRECISION

  ,real_rqa_determinism         DOUBLE PRECISION
  ,avatar_rqa_determinism       DOUBLE PRECISION
  ,residual_rqa_determinism     DOUBLE PRECISION

  ,real_rqa_laminarity          DOUBLE PRECISION
  ,avatar_rqa_laminarity        DOUBLE PRECISION
  ,residual_rqa_laminarity      DOUBLE PRECISION

  ,real_te_dominance            DOUBLE PRECISION
  ,avatar_te_dominance          DOUBLE PRECISION
  ,residual_te_dominance        DOUBLE PRECISION

  -- ── Motor signal residuals ──────────────────────────────────────────
  ,real_sample_entropy          DOUBLE PRECISION
  ,avatar_sample_entropy        DOUBLE PRECISION
  ,residual_sample_entropy      DOUBLE PRECISION

  ,real_motor_jerk              DOUBLE PRECISION
  ,avatar_motor_jerk            DOUBLE PRECISION
  ,residual_motor_jerk          DOUBLE PRECISION

  ,real_lapse_rate              DOUBLE PRECISION
  ,avatar_lapse_rate            DOUBLE PRECISION
  ,residual_lapse_rate          DOUBLE PRECISION

  ,real_tempo_drift             DOUBLE PRECISION
  ,avatar_tempo_drift           DOUBLE PRECISION
  ,residual_tempo_drift         DOUBLE PRECISION

  ,real_ex_gaussian_tau         DOUBLE PRECISION
  ,avatar_ex_gaussian_tau       DOUBLE PRECISION
  ,residual_ex_gaussian_tau     DOUBLE PRECISION

  ,real_tau_proportion          DOUBLE PRECISION
  ,avatar_tau_proportion        DOUBLE PRECISION
  ,residual_tau_proportion      DOUBLE PRECISION

  -- ── Semantic signal residuals ───────────────────────────────────────
  ,real_idea_density            DOUBLE PRECISION
  ,avatar_idea_density          DOUBLE PRECISION
  ,residual_idea_density        DOUBLE PRECISION

  ,real_lexical_sophistication  DOUBLE PRECISION
  ,avatar_lexical_sophistication DOUBLE PRECISION
  ,residual_lexical_sophistication DOUBLE PRECISION

  ,real_epistemic_stance        DOUBLE PRECISION
  ,avatar_epistemic_stance      DOUBLE PRECISION
  ,residual_epistemic_stance    DOUBLE PRECISION

  ,real_integrative_complexity  DOUBLE PRECISION
  ,avatar_integrative_complexity DOUBLE PRECISION
  ,residual_integrative_complexity DOUBLE PRECISION

  ,real_deep_cohesion           DOUBLE PRECISION
  ,avatar_deep_cohesion         DOUBLE PRECISION
  ,residual_deep_cohesion       DOUBLE PRECISION

  ,real_text_compression_ratio  DOUBLE PRECISION
  ,avatar_text_compression_ratio DOUBLE PRECISION
  ,residual_text_compression_ratio DOUBLE PRECISION

  -- ── Extended residuals (Phase 1-5 signals, JSONB) ────────────────────
  -- Per-signal { real, avatar, residual } triples for 28 new signals:
  -- 26 dynamical (mfdfa, psd, ordinal, recurrence network, causal, pid, dmd)
  -- 2 motor (mse complexity_index, fisher_trace)
  -- Included in the L2 norms below.
  ,extended_residuals_json      JSONB

  -- ── Aggregate norms ─────────────────────────────────────────────────
  ,dynamical_l2_norm            DOUBLE PRECISION
  ,motor_l2_norm                DOUBLE PRECISION
  ,semantic_l2_norm             DOUBLE PRECISION   -- stored, not ghost-validated; see Phase 2 self-referencing baselines
  ,total_l2_norm                DOUBLE PRECISION   -- backward compat: includes all families
  ,residual_count               INT                -- backward compat: includes all families
  ,behavioral_l2_norm           DOUBLE PRECISION   -- paper-reported: dynamical + motor + perplexity only
  ,behavioral_residual_count    INT                -- paper-reported: excludes semantic residuals

  -- ── Footer ──────────────────────────────────────────────────────────
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

-- PURPOSE: per-session profile-based mediation detection
-- USE CASE: flags sessions whose motor/process signals fall outside the
--           person's established behavioral range. Profile distance is the
--           L2 norm of z-scores across motor/process dimensions.
-- MUTABILITY: insert once per session, computed in signal pipeline
-- REFERENCED BY: none (leaf table)
-- FOOTER: created only
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

-- --------------------------------------------------------------------------

-- PURPOSE: running per-signal distribution for semantic baseline (Welford's online algorithm)
-- USE CASE: incremental mean/variance updated after each session; provides the
--           personal baseline against which semantic trajectory is measured.
--           Ghost comparison is invalid for semantic signals (Markov word salad
--           produces trivially explained residuals). Self-referencing baseline
--           answers: "how does this session compare to this person's own norm?"
-- MUTABILITY: updated after each session via Welford's algorithm
-- REFERENCED BY: tb_semantic_trajectory (provides baseline for z-score computation)
-- FOOTER: yes (modified)
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

-- --------------------------------------------------------------------------

-- PURPOSE: per-session semantic z-scores against personal baselines
-- USE CASE: one row per (session, signal). Stores z-scores against both the
--           global personal baseline and a topic-matched subset (via HNSW on
--           tb_embeddings). Gated: z-scores below minimum-n are flagged as
--           unreliable. Over months/years, the z-score series feeds drift
--           detection (CUSUM, changepoint) for cognitive trajectory monitoring.
-- MUTABILITY: insert once per session per signal
-- REFERENCED BY: none (leaf table, consumed by drift detection layer)
-- FOOTER: created only
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

-- --------------------------------------------------------------------------

-- @region jobs -- tb_signal_jobs

-- PURPOSE: durable queue of pipeline jobs that survive process crashes
-- USE CASE: enqueued in the same transaction as the response/calibration save.
--           A worker loop atomically claims jobs (FOR UPDATE SKIP LOCKED),
--           runs the corresponding pipeline (kind 1 = response_pipeline,
--           kind 2 = calibration_pipeline), marks completed or schedules
--           retry. Boot-time sweep re-queues 'running' jobs that were in
--           flight when the process died. Existing idempotent guards in
--           libSignalPipeline (`if (!(await getXSignals(qid)))`) make the
--           per-stage replay safe.
-- MUTABILITY: row-level state machine
--             queued(1) -> running(2) -> completed(3)
--                       -> running(2) -> failed(4) -> queued(1)   (retry)
--                                                  -> dead_letter(5) (max_attempts exceeded)
-- REFERENCED BY: none (leaf)
-- FOOTER: created + modified
CREATE TABLE IF NOT EXISTS tb_signal_jobs (
   signal_job_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id           INT NOT NULL                                   -- logical FK to tb_questions
  ,subject_id            INT                                            -- logical FK to tb_subjects (NULL for owner)
  ,signal_job_kind_id    SMALLINT NOT NULL DEFAULT 1                    -- logical FK to te_signal_job_kind
  ,signal_job_status_id  SMALLINT NOT NULL DEFAULT 1                    -- logical FK to te_signal_job_status
  ,attempts              INT NOT NULL DEFAULT 0
  ,max_attempts          INT NOT NULL DEFAULT 5
  ,next_run_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,claimed_at            TIMESTAMPTZ
  ,completed_at          TIMESTAMPTZ
  ,last_error            TEXT
  ,params_json           JSONB                                          -- kind-specific params (e.g., {deviceType} for calibration)
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,modified_by           TEXT NOT NULL DEFAULT 'system'
);

-- Atomic-claim path: SELECT ... WHERE signal_job_status_id = 1 AND next_run_at <= NOW()
-- ORDER BY next_run_at, signal_job_id FOR UPDATE SKIP LOCKED LIMIT 1.
-- Partial index keeps it small — only queued jobs need scanning.
CREATE INDEX IF NOT EXISTS idx_signal_jobs_claim
  ON tb_signal_jobs (next_run_at, signal_job_id)
  WHERE signal_job_status_id = 1;

-- Idempotent enqueue: same (question_id, kind) can only have one open job.
-- Excludes dead_letter so admin can re-enqueue after manual investigation
-- without conflicting with the dead row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_signal_jobs_question_kind
  ON tb_signal_jobs (question_id, signal_job_kind_id)
  WHERE signal_job_status_id <> 5;
