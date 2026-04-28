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
--
-- MULTI-SUBJECT MODEL (post migration 030, 2026-04-26):
--   Every behavioral table carries `subject_id INT NOT NULL` (logical FK to
--   tb_subjects). Owner = subject_id 1; subjects are 2+. There is no implicit
--   owner anywhere — every read scopes by subject, every write specifies
--   subject. The denormalization is intentional: it lets the per-table lint
--   rule mechanically enforce "every query references subject_id" instead of
--   relying on transitive derivation through joins.
--
--   `created_by` is an audit column (process role: 'system' / 'user' /
--   'client'), NOT an identity column. Subject identity lives ONLY in
--   `subject_id`. Never put 'subject:<name>' or 'subject:<id>' into created_by.
--
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS alice;
SET search_path TO alice, public;

-- pgvector extension installs in public (shared across schemas)
CREATE EXTENSION IF NOT EXISTS vector;

-- @region enums -- te_question_source, te_reflection_type, te_interaction_event_type, te_prompt_trace_type, te_embedding_source, te_context_dimension, te_adversary_variants, te_signal_job_status, te_signal_job_kind, te_data_access_actor
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

-- --------------------------------------------------------------------------

-- PURPOSE: who initiated a data access action (export / delete / consent / etc)
-- USE CASE: discriminator on tb_data_access_log so we can distinguish
--           subject-initiated, operator-initiated, and system-initiated actions
--           even when actor_subject_id is NULL (e.g. operator CLI before
--           owner-session-auth ships).
-- MUTABILITY: static after deploy
-- REFERENCED BY: tb_data_access_log.data_access_actor_id
CREATE TABLE IF NOT EXISTS te_data_access_actor (
   data_access_actor_id  SMALLINT PRIMARY KEY
  ,enum_code             TEXT UNIQUE NOT NULL
  ,name                  TEXT NOT NULL
  ,description           TEXT
);

INSERT INTO te_data_access_actor (data_access_actor_id, enum_code, name, description) VALUES
   (1, 'subject',  'Subject',  'A subject acted on their own data')
  ,(2, 'operator', 'Operator', 'The operator acted on a subject''s data (CLI script or owner endpoint)')
  ,(3, 'system',   'System',   'Automated system action (cron, worker, deploy hook)')
ON CONFLICT (data_access_actor_id) DO NOTHING;

-- @region identity -- tb_subjects, tb_subject_sessions
-- ============================================================================
-- IDENTITY
-- ============================================================================

-- PURPOSE: all users of Alice (owner + subjects)
-- USE CASE: one row per identity. Auth via username + Argon2id password_hash.
--           Owner row seeded at deploy; subjects created by owner via CLI
--           (`npm run create-subject`). New subjects are issued a temp password
--           and `must_reset_password = TRUE`; the reset endpoint flips it to FALSE.
--           `invite_code` is legacy (kept for backward compat with read paths).
-- MUTABILITY: insert by owner CLI, soft-disable via is_active. Never deleted.
-- REFERENCED BY: tb_scheduled_questions, tb_subject_responses, tb_subject_session_summaries, tb_subject_sessions (all logical FK)
-- FOOTER: created + modified
CREATE TABLE IF NOT EXISTS tb_subjects (
   subject_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,username             TEXT NOT NULL UNIQUE                          -- login identifier
  ,password_hash        TEXT NOT NULL                                 -- Argon2id (use libSubjectAuth.hashPassword)
  ,must_reset_password  BOOLEAN NOT NULL DEFAULT TRUE                 -- TRUE on temp-password issue; FALSE after reset
  ,iana_timezone        TEXT NOT NULL DEFAULT 'UTC'                   -- per-subject timezone (Phase 6b multi-tz scheduling)
  ,invite_code          TEXT UNIQUE                                   -- legacy; nullable
  ,display_name         TEXT
  ,is_owner             BOOLEAN NOT NULL DEFAULT FALSE
  ,is_active            BOOLEAN NOT NULL DEFAULT TRUE
  ,dttm_created_utc     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,dttm_modified_utc    TIMESTAMPTZ
  ,modified_by          TEXT
);

-- Enforce exactly one owner at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_single_owner
  ON tb_subjects (is_owner) WHERE is_owner = TRUE;

-- --------------------------------------------------------------------------

-- PURPOSE: active subject login sessions
-- USE CASE: one row per (subject, login). Cookie holds the raw token; the DB
--           stores SHA-256(token) so a DB leak does not grant active sessions.
-- MUTABILITY: insert on login, delete on logout or expiry sweep.
-- REFERENCED BY: none (leaf)
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_subject_sessions (
   subject_session_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id          INT NOT NULL                                   -- logical FK to tb_subjects
  ,token_hash          TEXT NOT NULL UNIQUE                           -- SHA-256(raw_token)
  ,expires_at          TIMESTAMPTZ NOT NULL
  -- Session telemetry (migration 035, 2026-04-27). Updated on verify, throttled
  -- to a 5-minute floor so the write rate stays bounded. Nullable on first
  -- verify after rollout; populated organically thereafter.
  ,last_seen_at        TIMESTAMPTZ
  ,last_ip             TEXT
  ,dttm_created_utc    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_subject_sessions_subject_id
  ON tb_subject_sessions (subject_id);

CREATE INDEX IF NOT EXISTS ix_subject_sessions_expires_at
  ON tb_subject_sessions (expires_at);

-- --------------------------------------------------------------------------

-- @region audit -- tb_subject_consent, tb_data_access_log
-- ============================================================================
-- AUDIT (Phase 6c, migration 038)
-- ============================================================================
-- Append-only governance tables. Survive subject deletion: the tombstone
-- (subject_id, consent acknowledgments, deletion timestamp) is the
-- research-integrity record promised by docs/consent-v1.md. Never modified
-- in place; never truncated; never garbage-collected.
--
-- The middleware consent gate reads `tb_subject_consent` to determine
-- whether a subject's most-recent acknowledgment matches the current
-- CONSENT_VERSION constant. The export, delete, factory-reset, and consent
-- endpoints write to `tb_data_access_log` so every plaintext-egress and
-- destructive action leaves a forensic trace.

-- PURPOSE: append-only record of every consent acknowledgment per subject
-- USE CASE: middleware queries the most-recent row per subject_id; if its
--           consent_version != server's CONSENT_VERSION constant, the
--           subject is gated until they re-acknowledge. Older rows are
--           retained so the subject's account page can show full history.
-- MUTABILITY: insert-only (append). Rows are never modified or deleted —
--             not even when the subject deletes their account, since the
--             consent timeline is part of the research integrity record.
-- REFERENCED BY: none (leaf)
-- FOOTER: created + modified (modified_by/dttm_modified_utc are unused
--         in practice — kept for schema-shape consistency with other
--         mutable tables)
CREATE TABLE IF NOT EXISTS tb_subject_consent (
   subject_consent_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id            INT NOT NULL                                   -- logical FK to tb_subjects
  ,consent_version       TEXT NOT NULL                                  -- e.g. 'v1'
  ,dttm_acknowledged_utc TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,ip_address            TEXT                                            -- truncated to 45 chars (IPv6 max)
  ,user_agent            TEXT                                            -- truncated to 200 chars
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc     TIMESTAMPTZ
  ,modified_by           TEXT
);

CREATE INDEX IF NOT EXISTS ix_subject_consent_subject_version
  ON tb_subject_consent (subject_id, consent_version);

CREATE INDEX IF NOT EXISTS ix_subject_consent_subject_recent
  ON tb_subject_consent (subject_id, dttm_acknowledged_utc DESC);

-- --------------------------------------------------------------------------

-- PURPOSE: append-only audit trail of every data access action
-- USE CASE: every export, delete, factory-reset, and consent action writes
--           a row here. The notes field carries action-specific context as
--           a JSON string (e.g. per-table row counts after a delete cascade,
--           bytes streamed during an export). Survives subject deletion so
--           the post-delete tombstone has a verifiable history.
-- MUTABILITY: insert-only (append). Rows are never modified or deleted.
-- REFERENCED BY: none (leaf)
-- FOOTER: created + modified (modified columns unused in practice)
CREATE TABLE IF NOT EXISTS tb_data_access_log (
   data_access_log_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id            INT NOT NULL                                   -- whose data was accessed (logical FK)
  ,actor_subject_id      INT                                             -- who initiated; NULL when actor was operator pre-session-auth or system
  ,data_access_actor_id  SMALLINT NOT NULL                              -- te_data_access_actor.data_access_actor_id
  ,action_type           TEXT NOT NULL                                  -- 'export' | 'factory_reset' | 'delete' | 'consent'
  ,consent_version       TEXT                                            -- populated when action_type = 'consent'
  ,notes                 TEXT                                            -- JSON string with action-specific context
  ,ip_address            TEXT
  ,user_agent            TEXT
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc     TIMESTAMPTZ
  ,modified_by           TEXT
);

CREATE INDEX IF NOT EXISTS ix_data_access_log_subject
  ON tb_data_access_log (subject_id, dttm_created_utc DESC);

CREATE INDEX IF NOT EXISTS ix_data_access_log_actor
  ON tb_data_access_log (actor_subject_id, dttm_created_utc DESC);

CREATE INDEX IF NOT EXISTS ix_data_access_log_action
  ON tb_data_access_log (action_type, dttm_created_utc DESC);

-- --------------------------------------------------------------------------

-- @region core -- tb_questions, tb_question_corpus, tb_responses, tb_interaction_events, tb_question_feedback
-- ============================================================================
-- CORE MUTABLE TABLES
-- ============================================================================

-- PURPOSE: daily questions (seed, generated, calibration, corpus-drawn)
-- USE CASE: one row per (subject, question). For journal questions,
--           scheduled_for is unique per subject per calendar date. Calibration
--           questions have scheduled_for IS NULL (no scheduled date) — UNIQUE
--           permits multiple NULLs per Postgres semantics, so a subject may
--           have many calibration rows with (subject_id, NULL).
--
--           question_source_id semantics:
--             1 = seed         (owner journal seed text)
--             2 = generated    (owner journal LLM-generated text)
--             3 = calibration  (owner calibration prompt; scheduled_for IS NULL)
--             4 = corpus       (subject corpus draw; corpus_question_id IS NOT NULL)
--           For source = 4 rows, corpus_question_id is the logical FK to
--           tb_question_corpus. For sources 1-3, corpus_question_id is NULL.
-- MUTABILITY: insert once, rarely updated (intervention fields may be set later)
-- REFERENCED BY: tb_responses, tb_session_summaries, tb_session_events, tb_burst_sequences, tb_rburst_sequences
-- FOOTER: yes
CREATE TABLE IF NOT EXISTS tb_questions (
   question_id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id             INT NOT NULL                                    -- logical FK to tb_subjects
  -- text encrypted at rest (migration 031). Plaintext column removed; both
  -- ciphertext + nonce produced by libCrypto.encrypt() are required.
  ,text_ciphertext        TEXT NOT NULL
  ,text_nonce             TEXT NOT NULL
  ,question_source_id     SMALLINT NOT NULL DEFAULT 1
  ,scheduled_for          DATE
  -- corpus_question_id (migration 032): logical FK to tb_question_corpus.
  -- NOT NULL for question_source_id = 4 rows (subject corpus draws),
  -- NULL for owner journal/calibration sources (1-3).
  ,corpus_question_id     INT
  ,intervention_intent_id INT
  ,intervention_rationale TEXT
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc      TIMESTAMPTZ
  ,modified_by            TEXT
  ,CONSTRAINT tb_questions_subject_scheduled_for_key UNIQUE (subject_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS ix_questions_subject_scheduled_for
  ON tb_questions (subject_id, scheduled_for);

-- Partial index for the corpus round-robin no-repeat lookup: "which corpus
-- questions has this subject been assigned?" The partial WHERE keeps the
-- index narrow (owner journal rows have corpus_question_id IS NULL).
CREATE INDEX IF NOT EXISTS ix_questions_subject_corpus_question_id
  ON tb_questions (subject_id, corpus_question_id)
  WHERE corpus_question_id IS NOT NULL;

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

-- PURPOSE: journal responses (one row per question, one response per question)
-- USE CASE: subject_id identifies which person submitted; question_id stays
--           unique because question_id is itself a globally-unique surrogate.
-- MUTABILITY: insert once, never updated (black box)
-- REFERENCED BY: tb_embeddings
-- FOOTER: yes
CREATE TABLE IF NOT EXISTS tb_responses (
   response_id                     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id                      INT NOT NULL                           -- logical FK to tb_subjects
  ,question_id                     INT NOT NULL UNIQUE
  -- text encrypted at rest (migration 031). Plaintext column removed.
  ,text_ciphertext                 TEXT NOT NULL
  ,text_nonce                      TEXT NOT NULL
  ,contamination_boundary_version  TEXT NOT NULL DEFAULT 'v1'
  ,audited_code_paths_ref          TEXT NOT NULL DEFAULT 'docs/contamination-boundary-v1.md'
  ,code_commit_hash                TEXT NOT NULL DEFAULT 'pre-attestation'
  ,dttm_created_utc                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                      TEXT NOT NULL DEFAULT 'user'
  ,dttm_modified_utc               TIMESTAMPTZ
  ,modified_by                     TEXT
);

CREATE INDEX IF NOT EXISTS ix_responses_subject_id ON tb_responses (subject_id);

-- --------------------------------------------------------------------------

-- PURPOSE: client-side interaction event log (page_open, keystroke, pause, etc.)
-- USE CASE: append-only event stream per session
-- MUTABILITY: insert only
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_interaction_events (
   interaction_event_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id                 INT      NOT NULL                           -- logical FK to tb_subjects
  ,question_id                INT      NOT NULL
  ,interaction_event_type_id  SMALLINT NOT NULL
  ,metadata                   JSONB
  ,dttm_created_utc           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                 TEXT NOT NULL DEFAULT 'client'
);

CREATE INDEX IF NOT EXISTS ix_interaction_events_subject_id ON tb_interaction_events (subject_id);

-- --------------------------------------------------------------------------

-- PURPOSE: user feedback on whether a question "landed"
-- USE CASE: one boolean per question
-- MUTABILITY: insert once
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_question_feedback (
   question_feedback_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id            INT     NOT NULL                                 -- logical FK to tb_subjects
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
  ,subject_id                  INT  NOT NULL                              -- logical FK to tb_subjects
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
  ,drop_count                  INT DEFAULT 0          -- migration 016
  -- Footer
  ,dttm_created_utc            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                  TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS ix_session_summaries_subject_id ON tb_session_summaries (subject_id);

-- --------------------------------------------------------------------------

-- PURPOSE: LLM prompt provenance for auditability
-- USE CASE: one row per LLM call (generation, observation, reflection) per subject
-- MUTABILITY: insert only
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_prompt_traces (
   prompt_trace_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id             INT NOT NULL                                    -- logical FK to tb_subjects
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
  ,subject_id                  INT NOT NULL                               -- logical FK to tb_subjects
  ,embedding_source_id         SMALLINT NOT NULL
  ,source_record_id            INT      NOT NULL
  -- embedded_text encrypted at rest (migration 031). For response embeddings
  -- the plaintext equals tb_responses.text — leaving it plaintext while
  -- encrypting tb_responses.text would have been a bypass.
  ,embedded_text_ciphertext    TEXT NOT NULL
  ,embedded_text_nonce         TEXT NOT NULL
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

-- @region session-data -- tb_burst_sequences, tb_rburst_sequences, tb_session_metadata, tb_calibration_baselines_history, tb_session_events
-- ============================================================================
-- SESSION-DATA TABLES (bursts, metadata, event logs, calibration history)
-- ============================================================================
--
-- ALICE NEGATIVE WITNESS RENDERER — REMOVED 2026-04-27
--   The witness rendering subsystem (LLM-powered visual trait extraction)
--   was fully deprecated. Application code is gone (see METHODS_PROVENANCE.md
--   INC-014). Its dedicated table `tb_witness_states` was archived to
--   `zz_archive_tb_witness_states` via migration 033.
--
-- BEHAVIORAL 7D ENTRY-STATES — REMOVED 2026-04-27
--   `tb_entry_states` (PersDyn 7D state vectors) was archived to
--   `zz_archive_tb_entry_states` via migration 036 (INC-017). Its producer
--   was the deleted alice-negative pipeline; its consumer (the entry
--   detail observatory page) was deleted in the same commit.
--
-- ============================================================================

-- PURPOSE: P-burst sequences per session
-- USE CASE: ordered burst-level decomposition of writing flow
-- MUTABILITY: insert only
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_burst_sequences (
   burst_sequence_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id             INT      NOT NULL                               -- logical FK to tb_subjects
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
  ,subject_id             INT      NOT NULL                               -- logical FK to tb_subjects
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
  ,subject_id                    INT NOT NULL                             -- logical FK to tb_subjects
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
  ,subject_id                    INT NOT NULL                             -- logical FK to tb_subjects
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

CREATE INDEX IF NOT EXISTS ix_calibration_baselines_subject_id ON tb_calibration_baselines_history (subject_id);

-- --------------------------------------------------------------------------

-- PURPOSE: raw event log + keystroke stream per session
-- USE CASE: replay, process signal computation, dynamical signal computation
-- MUTABILITY: insert once per session
-- FOOTER: created only
--
-- ENCRYPTION: both payloads (event_log + keystroke_stream) are encrypted at
--   rest (migration 031). The application JSON.stringifys the array, encrypts
--   via libCrypto.encrypt(), and stores ciphertext + nonce in the columns
--   below. On read libDb.getSessionEvents (and friends) decrypt and return
--   the JSON string; callers JSON.parse as needed. The shape definitions
--   below describe the PLAINTEXT — the columns themselves are ciphertext.
--
-- event_log (plaintext): JSON array of [offsetMs, cursorPos, deletedCount, insertedText]
--   offsetMs is microsecond-precision from performance.now() (DOUBLE PRECISION).
--
-- keystroke_stream (plaintext): JSON array of {c: character, d: keydownOffset, u: keyupOffset}
--   d and u are DOUBLE PRECISION offsets from page open (microsecond-precision).
--   Consumed by Rust signal engine via JSON.stringify() round-trip.
CREATE TABLE IF NOT EXISTS tb_session_events (
   session_event_id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id                    INT NOT NULL                             -- logical FK to tb_subjects
  ,question_id                   INT NOT NULL UNIQUE
  -- event_log + keystroke_stream encrypted at rest (migration 031). The
  -- application JSON.stringifys the JSONB array before encrypting and
  -- JSON.parses on read. Plaintext JSONB columns removed.
  ,event_log_ciphertext          TEXT NOT NULL
  ,event_log_nonce               TEXT NOT NULL
  ,total_events                  INT  NOT NULL
  ,session_duration_ms           DOUBLE PRECISION NOT NULL
  ,keystroke_stream_ciphertext   TEXT
  ,keystroke_stream_nonce        TEXT
  ,total_input_events            INT
  ,decimation_count              INT
  ,dttm_created_utc              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                    TEXT NOT NULL DEFAULT 'client'
);

CREATE INDEX IF NOT EXISTS ix_session_events_subject_id ON tb_session_events (subject_id);

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
  ,subject_id                   INT NOT NULL                              -- logical FK to tb_subjects
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
  -- Phase 3-5 extensions (migrations 017-021): folded back into canonical
  -- schema 2026-04-25 to satisfy "schema file always reads as a complete,
  -- intact script" rule. Prior to this date the schema was missing these
  -- columns even though production had them.
  ,effective_information           DOUBLE PRECISION
  ,causal_emergence_index          DOUBLE PRECISION
  ,optimal_causal_scale            INT
  ,pid_synergy                     DOUBLE PRECISION
  ,pid_redundancy                  DOUBLE PRECISION
  ,branching_ratio                 DOUBLE PRECISION
  ,avalanche_size_exponent         DOUBLE PRECISION
  ,dmd_dominant_frequency          DOUBLE PRECISION
  ,dmd_dominant_decay_rate         DOUBLE PRECISION
  ,dmd_mode_count                  INT
  ,dmd_spectral_entropy            DOUBLE PRECISION
  ,pause_mixture_component_count   INT
  ,pause_mixture_motor_proportion  DOUBLE PRECISION
  ,pause_mixture_cognitive_load_index DOUBLE PRECISION
  ,engine_provenance_id         INT                                  -- logical FK to tb_engine_provenance; identifies the binary that computed this row
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
  ,subject_id                   INT NOT NULL                              -- logical FK to tb_subjects
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
  -- Phase 2 extensions (migration 019): folded back into canonical schema 2026-04-25.
  ,mse_series                   JSONB
  ,complexity_index             DOUBLE PRECISION
  ,ex_gaussian_fisher_trace     DOUBLE PRECISION
  ,engine_provenance_id         INT                                  -- logical FK to tb_engine_provenance
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
  ,subject_id                   INT NOT NULL                              -- logical FK to tb_subjects
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
  ,subject_id                   INT NOT NULL                              -- logical FK to tb_subjects
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
  ,engine_provenance_id         INT                                  -- logical FK to tb_engine_provenance
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
  ,subject_id                   INT NOT NULL                              -- logical FK to tb_subjects
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
  ,engine_provenance_id         INT                                  -- logical FK to tb_engine_provenance
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS ix_dynamical_signals_subject_id   ON tb_dynamical_signals (subject_id);
CREATE INDEX IF NOT EXISTS ix_motor_signals_subject_id       ON tb_motor_signals (subject_id);
CREATE INDEX IF NOT EXISTS ix_semantic_signals_subject_id    ON tb_semantic_signals (subject_id);
CREATE INDEX IF NOT EXISTS ix_process_signals_subject_id     ON tb_process_signals (subject_id);
CREATE INDEX IF NOT EXISTS ix_cross_session_subject_id       ON tb_cross_session_signals (subject_id);

-- @region calibration -- tb_calibration_baselines_history, tb_session_delta
-- ============================================================================
-- CALIBRATION & CONTEXT TABLES
-- ============================================================================
-- (tb_calibration_context archived 2026-04-27 per migration 034 / INC-015 —
--  the extraction pipeline had no surviving consumers after INC-014 removed
--  runGeneration.)

-- PURPOSE: calibration vs journal session delta for same-day comparison
-- USE CASE: separating state-of-day from trait signal
-- MUTABILITY: insert once per day with both sessions
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_session_delta (
   session_delta_id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id                          INT  NOT NULL                      -- logical FK to tb_subjects
  ,session_date                        DATE NOT NULL
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
  ,CONSTRAINT tb_session_delta_subject_date_key UNIQUE (subject_id, session_date)
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

-- PURPOSE: Rolling behavioral profile aggregated from a subject's journal
--          sessions. One row per subject (UNIQUE(subject_id) enforced).
-- USE CASE: Foundation for writing avatar / process reconstruction. Updated
--           in place after each session. Feeds all adversary variants.
-- MUTABILITY: Updated after each journal session.
-- REFERENCED BY: reconstruction pipeline, mediation detection.
-- FOOTER: dttm_updated_utc only.
CREATE TABLE IF NOT EXISTS tb_personal_profile (
   profile_id              SERIAL PRIMARY KEY
  ,subject_id              INT NOT NULL CONSTRAINT tb_personal_profile_subject_key UNIQUE   -- logical FK to tb_subjects; one profile per subject
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
  ,subject_id                   INT NOT NULL                              -- logical FK to tb_subjects
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

  ,engine_provenance_id         INT                -- logical FK to tb_engine_provenance

  -- ── Footer ──────────────────────────────────────────────────────────
  ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by                   TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS ix_reconstruction_residuals_subject_id ON tb_reconstruction_residuals (subject_id);

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
  ,subject_id             INT NOT NULL                                    -- logical FK to tb_subjects
  ,question_id            INT NOT NULL UNIQUE
  ,profile_distance       DOUBLE PRECISION NOT NULL
  ,dimension_count        SMALLINT NOT NULL
  ,z_scores_json          JSONB NOT NULL
  ,is_flagged             BOOLEAN NOT NULL DEFAULT FALSE
  ,threshold_used         DOUBLE PRECISION
  ,profile_session_count  INT
  ,engine_provenance_id   INT                                        -- logical FK to tb_engine_provenance
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
  ,subject_id             INT NOT NULL                                    -- logical FK to tb_subjects
  ,signal_name            TEXT NOT NULL
  ,running_mean           DOUBLE PRECISION NOT NULL DEFAULT 0
  ,running_m2             DOUBLE PRECISION NOT NULL DEFAULT 0
  ,session_count          INT NOT NULL DEFAULT 0
  ,last_question_id       INT
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc      TIMESTAMPTZ
  ,modified_by            TEXT
  ,CONSTRAINT tb_semantic_baselines_subject_signal_key UNIQUE (subject_id, signal_name)
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
  ,subject_id              INT NOT NULL                                   -- logical FK to tb_subjects
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

-- @region jobs -- tb_engine_provenance, tb_signal_jobs

-- PURPOSE: identify which Rust signal-engine binary produced a given signal
-- USE CASE: at process boot, the engine module computes SHA-256 of the loaded
--           .node file, reads CPU model + arch + target_cpu flag, and looks up
--           or inserts a row here. The returned engine_provenance_id is cached
--           process-wide and stamped on every signal row written by that
--           process. Two processes with the same binary on the same CPU model
--           share a row; different CPU generations (Milan vs Genoa) get
--           distinct rows even with the same binary because vectorized FP
--           paths can diverge.
-- MUTABILITY: insert-only; rows are immutable identity records
-- REFERENCED BY: tb_dynamical_signals.engine_provenance_id,
--                tb_motor_signals.engine_provenance_id,
--                tb_process_signals.engine_provenance_id,
--                tb_cross_session_signals.engine_provenance_id,
--                tb_session_integrity.engine_provenance_id,
--                tb_reconstruction_residuals.engine_provenance_id
-- FOOTER: dttm_observed_first only (no modification)
CREATE TABLE IF NOT EXISTS tb_engine_provenance (
   engine_provenance_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,binary_sha256         TEXT NOT NULL                                 -- SHA-256 of the .node file as loaded
  ,code_commit_hash      TEXT                                          -- git rev-parse HEAD at build time (best-effort)
  ,cpu_model             TEXT NOT NULL                                 -- e.g. "Apple M1 Pro" or "AMD EPYC 9654 96-Core Processor"
  ,host_arch             TEXT NOT NULL                                 -- "aarch64" / "x86_64"
  ,target_cpu_flag       TEXT                                          -- "x86-64-v3" on Linux production, NULL on dev
  ,napi_rs_version       TEXT                                          -- e.g. "3.6.2"
  ,rustc_version         TEXT                                          -- e.g. "rustc 1.85.0"
  ,UNIQUE (binary_sha256, cpu_model)
  ,dttm_observed_first   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------------

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
  ,subject_id            INT NOT NULL                                   -- logical FK to tb_subjects (post migration 030: required for every job)
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

CREATE INDEX IF NOT EXISTS ix_signal_jobs_subject_id ON tb_signal_jobs (subject_id);
