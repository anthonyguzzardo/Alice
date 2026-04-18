-- ============================================================================
-- Alice PostgreSQL Schema
-- ============================================================================
-- Migrated from SQLite (better-sqlite3 + sqlite-vec) to PostgreSQL 17 + pgvector.
-- All migration ALTERs baked into final CREATE TABLE statements.
-- Naming: te_ = enum, tb_ = mutable, zz_archive_ = preserved historical
-- Surrogate keys: table_name_id (never just "id")
-- Logical foreign keys only (no physical FK constraints)
-- Footer: dttm_created_utc, created_by, dttm_modified_utc, modified_by
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ENUM TABLES (static, no footer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS te_question_source (
   question_source_id  INT PRIMARY KEY
  ,enum_code           TEXT UNIQUE NOT NULL
  ,name                TEXT NOT NULL
);

INSERT INTO te_question_source (question_source_id, enum_code, name) VALUES
   (1, 'seed',        'Seed')
  ,(2, 'generated',   'Generated')
  ,(3, 'calibration', 'Calibration')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS te_reflection_type (
   reflection_type_id  INT PRIMARY KEY
  ,enum_code           TEXT UNIQUE NOT NULL
  ,name                TEXT NOT NULL
);

INSERT INTO te_reflection_type (reflection_type_id, enum_code, name) VALUES
   (1, 'weekly',  'Weekly')
  ,(2, 'monthly', 'Monthly')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS te_interaction_event_type (
   interaction_event_type_id  INT PRIMARY KEY
  ,enum_code                  TEXT UNIQUE NOT NULL
  ,name                       TEXT NOT NULL
);

INSERT INTO te_interaction_event_type (interaction_event_type_id, enum_code, name) VALUES
   (1, 'page_open',       'Page Open')
  ,(2, 'first_keystroke', 'First Keystroke')
  ,(3, 'pause',           'Pause')
  ,(4, 'resume',          'Resume')
  ,(5, 'submit',          'Submit')
  ,(6, 'revisit',         'Revisit')
  ,(7, 'tab_blur',        'Tab Blur')
  ,(8, 'tab_focus',       'Tab Focus')
  ,(9, 'deletion',        'Deletion')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS te_prompt_trace_type (
   prompt_trace_type_id  INT PRIMARY KEY
  ,enum_code             TEXT UNIQUE NOT NULL
  ,name                  TEXT NOT NULL
);

INSERT INTO te_prompt_trace_type (prompt_trace_type_id, enum_code, name) VALUES
   (1, 'generation',  'Generation')
  ,(2, 'observation', 'Observation')
  ,(3, 'reflection',  'Reflection')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS te_embedding_source (
   embedding_source_id  INT PRIMARY KEY
  ,enum_code            TEXT UNIQUE NOT NULL
  ,name                 TEXT NOT NULL
);

INSERT INTO te_embedding_source (embedding_source_id, enum_code, name) VALUES
   (1, 'response',    'Response')
  ,(2, 'observation', 'Observation')
  ,(3, 'reflection',  'Reflection')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS te_context_dimension (
   context_dimension_id  INT PRIMARY KEY
  ,enum_code             TEXT UNIQUE NOT NULL
  ,name                  TEXT NOT NULL
);

INSERT INTO te_context_dimension (context_dimension_id, enum_code, name) VALUES
   (1, 'sleep',           'Sleep')
  ,(2, 'physical_state',  'Physical State')
  ,(3, 'emotional_event', 'Emotional Event')
  ,(4, 'social_quality',  'Social Quality')
  ,(5, 'stress',          'Stress')
  ,(6, 'exercise',        'Exercise')
  ,(7, 'routine',         'Routine')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CORE MUTABLE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tb_questions (
   question_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,text                  TEXT NOT NULL
  ,question_source_id    INT  NOT NULL DEFAULT 1
  ,scheduled_for         TEXT UNIQUE
  ,intervention_intent_id  INT
  ,intervention_rationale  TEXT
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc     TIMESTAMPTZ
  ,modified_by           TEXT
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_responses (
   response_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id           INT  NOT NULL
  ,text                  TEXT NOT NULL
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'user'
  ,dttm_modified_utc     TIMESTAMPTZ
  ,modified_by           TEXT
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_interaction_events (
   interaction_event_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                INT  NOT NULL
  ,interaction_event_type_id  INT  NOT NULL
  ,metadata                   TEXT
  ,dttm_created_utc           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                 TEXT NOT NULL DEFAULT 'client'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_reflections (
   reflection_id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,text                         TEXT NOT NULL
  ,reflection_type_id           INT  NOT NULL DEFAULT 1
  ,coverage_through_response_id INT
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc            TIMESTAMPTZ
  ,modified_by                  TEXT
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_question_feedback (
   question_feedback_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id           INT     NOT NULL UNIQUE
  ,landed                INT     NOT NULL
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT    NOT NULL DEFAULT 'user'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_session_summaries (
   session_summary_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                 INT  NOT NULL UNIQUE
  -- Behavioral core
  ,first_keystroke_ms          INT
  ,total_duration_ms           INT
  ,total_chars_typed           INT
  ,final_char_count            INT
  ,commitment_ratio            DOUBLE PRECISION
  ,pause_count                 INT
  ,total_pause_ms              INT
  ,deletion_count              INT
  ,largest_deletion            INT
  ,total_chars_deleted         INT
  ,tab_away_count              INT
  ,total_tab_away_ms           INT
  ,word_count                  INT
  ,sentence_count              INT
  -- Deletion decomposition
  ,small_deletion_count        INT
  ,large_deletion_count        INT
  ,large_deletion_chars        INT
  ,first_half_deletion_chars   INT
  ,second_half_deletion_chars  INT
  -- Production fluency
  ,active_typing_ms            INT
  ,chars_per_minute            DOUBLE PRECISION
  ,p_burst_count               INT
  ,avg_p_burst_length          DOUBLE PRECISION
  -- NRC Emotion Lexicon densities
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
  -- Hold time + flight time decomposition
  ,hold_time_mean              DOUBLE PRECISION
  ,hold_time_std               DOUBLE PRECISION
  ,flight_time_mean            DOUBLE PRECISION
  ,flight_time_std             DOUBLE PRECISION
  -- Keystroke entropy
  ,keystroke_entropy           DOUBLE PRECISION
  -- Lexical diversity
  ,mattr                       DOUBLE PRECISION
  -- Sentence metrics
  ,avg_sentence_length         DOUBLE PRECISION
  ,sentence_length_variance    DOUBLE PRECISION
  -- Session metadata
  ,scroll_back_count           INT
  ,question_reread_count       INT
  -- Deletion event log
  ,deletion_events_json        JSONB
  -- Cursor behavior + writing process (Phase 1 expansion)
  ,confirmation_latency_ms     INT
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
  -- Precorrection/postcorrection latency
  ,deletion_execution_speed_mean DOUBLE PRECISION
  ,postcorrection_latency_mean DOUBLE PRECISION
  -- Revision distance
  ,mean_revision_distance      DOUBLE PRECISION
  ,max_revision_distance       INT
  -- Punctuation key latency
  ,punctuation_flight_mean     DOUBLE PRECISION
  ,punctuation_letter_ratio    DOUBLE PRECISION
  -- Context
  ,device_type                 TEXT
  ,user_agent                  TEXT
  ,hour_of_day                 INT
  ,day_of_week                 INT
  -- Footer
  ,dttm_created_utc            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                  TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_prompt_traces (
   prompt_trace_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,prompt_trace_type_id   INT  NOT NULL
  ,output_record_id       INT
  ,recent_entry_ids       JSONB
  ,rag_entry_ids          JSONB
  ,contrarian_entry_ids   JSONB
  ,reflection_ids         JSONB
  ,observation_ids        JSONB
  ,model_name             TEXT NOT NULL DEFAULT 'claude-opus-4-6'
  ,token_estimate         INT
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------
-- tb_embeddings: metadata + pgvector column (replaces sqlite-vec virtual table)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_embeddings (
   embedding_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,embedding_source_id   INT  NOT NULL
  ,source_record_id      INT  NOT NULL
  ,embedded_text         TEXT NOT NULL
  ,source_date           TEXT
  ,model_name            TEXT NOT NULL DEFAULT 'voyage-3-lite'
  ,embedding             vector(512)
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
  ,UNIQUE(embedding_source_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON tb_embeddings
  USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- WITNESS, STATE, DYNAMICS, COUPLING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tb_witness_states (
   witness_state_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count         INT  NOT NULL
  ,traits_json         JSONB NOT NULL
  ,signals_json        JSONB NOT NULL
  ,model_name          TEXT DEFAULT 'claude-sonnet-4-20250514'
  ,dttm_created_utc    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by          TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_burst_sequences (
   burst_sequence_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id            INT  NOT NULL
  ,burst_index            INT  NOT NULL
  ,burst_char_count       INT  NOT NULL
  ,burst_duration_ms      INT  NOT NULL
  ,burst_start_offset_ms  INT  NOT NULL
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'client'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_session_metadata (
   session_metadata_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                   INT  NOT NULL
  ,hour_typicality               DOUBLE PRECISION
  ,deletion_curve_type           TEXT
  ,burst_trajectory_shape        TEXT
  ,inter_burst_interval_mean_ms  DOUBLE PRECISION
  ,inter_burst_interval_std_ms   DOUBLE PRECISION
  ,deletion_during_burst_count   INT
  ,deletion_between_burst_count  INT
  ,dttm_created_utc              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by                    TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_calibration_baselines_history (
   calibration_history_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,calibration_session_count     INT  NOT NULL
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
  ,dttm_created_utc              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by                    TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_session_events (
   session_event_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id            INT  NOT NULL
  ,event_log_json         JSONB NOT NULL
  ,total_events           INT   NOT NULL
  ,session_duration_ms    INT   NOT NULL
  ,keystroke_stream_json  JSONB
  ,total_input_events     INT
  ,decimation_count       INT
  ,dttm_created_utc       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT DEFAULT 'client'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_entry_states (
   entry_state_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,response_id       INT            NOT NULL
  ,fluency           DOUBLE PRECISION NOT NULL
  ,deliberation      DOUBLE PRECISION NOT NULL
  ,revision          DOUBLE PRECISION NOT NULL
  ,commitment        DOUBLE PRECISION NOT NULL
  ,volatility        DOUBLE PRECISION NOT NULL
  ,thermal           DOUBLE PRECISION NOT NULL
  ,presence          DOUBLE PRECISION NOT NULL
  ,convergence       DOUBLE PRECISION NOT NULL
  ,dttm_created_utc  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by        TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_trait_dynamics (
   trait_dynamic_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count        INT  NOT NULL
  ,dimension          TEXT NOT NULL
  ,baseline           DOUBLE PRECISION NOT NULL
  ,variability        DOUBLE PRECISION NOT NULL
  ,attractor_force    DOUBLE PRECISION NOT NULL
  ,current_state      DOUBLE PRECISION NOT NULL
  ,deviation          DOUBLE PRECISION NOT NULL
  ,window_size        INT  NOT NULL
  ,dttm_created_utc   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by         TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_coupling_matrix (
   coupling_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count        INT  NOT NULL
  ,leader             TEXT NOT NULL
  ,follower           TEXT NOT NULL
  ,lag_sessions       INT  NOT NULL
  ,correlation        DOUBLE PRECISION NOT NULL
  ,direction          DOUBLE PRECISION NOT NULL
  ,dttm_created_utc   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by         TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_emotion_behavior_coupling (
   emotion_coupling_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count          INT  NOT NULL
  ,emotion_dim          TEXT NOT NULL
  ,behavior_dim         TEXT NOT NULL
  ,lag_sessions         INT  NOT NULL
  ,correlation          DOUBLE PRECISION NOT NULL
  ,direction            DOUBLE PRECISION NOT NULL
  ,dttm_created_utc     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by           TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_semantic_states (
   semantic_state_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,response_id           INT            NOT NULL
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
  ,dttm_created_utc      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_semantic_dynamics (
   semantic_dynamic_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count          INT  NOT NULL
  ,dimension            TEXT NOT NULL
  ,baseline             DOUBLE PRECISION NOT NULL
  ,variability          DOUBLE PRECISION NOT NULL
  ,attractor_force      DOUBLE PRECISION NOT NULL
  ,current_state        DOUBLE PRECISION NOT NULL
  ,deviation            DOUBLE PRECISION NOT NULL
  ,window_size          INT  NOT NULL
  ,dttm_created_utc     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by           TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_semantic_coupling (
   semantic_coupling_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,entry_count           INT  NOT NULL
  ,leader                TEXT NOT NULL
  ,follower              TEXT NOT NULL
  ,lag_sessions          INT  NOT NULL
  ,correlation           DOUBLE PRECISION NOT NULL
  ,direction             DOUBLE PRECISION NOT NULL
  ,dttm_created_utc      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT DEFAULT 'system'
);

-- ============================================================================
-- SIGNAL TABLES (append-only, one row per session)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tb_dynamical_signals (
   dynamical_signal_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                  INT NOT NULL UNIQUE
  ,iki_count                    INT
  ,hold_flight_count            INT
  ,permutation_entropy          DOUBLE PRECISION
  ,permutation_entropy_raw      DOUBLE PRECISION
  ,dfa_alpha                    DOUBLE PRECISION
  ,rqa_determinism              DOUBLE PRECISION
  ,rqa_laminarity               DOUBLE PRECISION
  ,rqa_trapping_time            DOUBLE PRECISION
  ,rqa_recurrence_rate          DOUBLE PRECISION
  ,te_hold_to_flight            DOUBLE PRECISION
  ,te_flight_to_hold            DOUBLE PRECISION
  ,te_dominance                 DOUBLE PRECISION
  ,dttm_created_utc             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

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
  ,dttm_created_utc             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

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
  ,lexicon_version              INT NOT NULL DEFAULT 1
  ,paste_contaminated           INT NOT NULL DEFAULT 0
  ,dttm_created_utc             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

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
  ,dttm_created_utc             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_cross_session_signals (
   cross_session_signal_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id                  INT NOT NULL UNIQUE
  ,self_perplexity              DOUBLE PRECISION
  ,ncd_lag_1                    DOUBLE PRECISION
  ,ncd_lag_3                    DOUBLE PRECISION
  ,ncd_lag_7                    DOUBLE PRECISION
  ,ncd_lag_30                   DOUBLE PRECISION
  ,vocab_recurrence_decay       DOUBLE PRECISION
  ,digraph_stability            DOUBLE PRECISION
  ,text_network_density         DOUBLE PRECISION
  ,text_network_communities     INT
  ,bridging_ratio               DOUBLE PRECISION
  ,dttm_created_utc             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT DEFAULT 'system'
);

-- ============================================================================
-- CALIBRATION & CONTEXT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tb_calibration_context (
   calibration_context_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id             INT  NOT NULL
  ,context_dimension_id    INT  NOT NULL
  ,value                   TEXT NOT NULL
  ,detail                  TEXT
  ,confidence              DOUBLE PRECISION NOT NULL DEFAULT 1.0
  ,dttm_created_utc        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by              TEXT NOT NULL DEFAULT 'system'
);

-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tb_session_delta (
   session_delta_id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,session_date                        TEXT NOT NULL UNIQUE
  ,calibration_question_id             INT  NOT NULL
  ,journal_question_id                 INT  NOT NULL
  -- Delta dimensions
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
  -- Raw values
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

CREATE TABLE IF NOT EXISTS tb_paper_comments (
   paper_comment_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,paper_slug          TEXT NOT NULL
  ,author_name         TEXT NOT NULL
  ,comment_text        TEXT NOT NULL
  ,dttm_created_utc    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by          TEXT NOT NULL DEFAULT 'reader'
);
