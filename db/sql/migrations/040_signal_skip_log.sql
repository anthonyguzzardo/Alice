SET search_path = alice, public;

-- ============================================================================
-- Migration 040 — Signal skip log
-- ============================================================================
--
-- DATE: 2026-05-02
-- TIE-IN: every "why is this signal row missing / null" question, which
--         currently requires reading five different files (libSignalPipeline,
--         libIntegrity, libProfile, libSemanticSignals, libCrossSessionSignals,
--         plus motor.rs / dynamical.rs / process.rs in Rust). The rules
--         themselves are correct; their invisibility from the DB is the bug.
--
-- WHAT
--   1. Create `te_signal_skip_reason` lookup table. Codes correspond to the
--      reasons a signal family or stage decides not to compute or persist
--      anything for a given session.
--   2. Create `tb_signal_skip_log` append-only table. The pipeline + family
--      computes write one row per (session, family, skip event). Nothing
--      reads these rows in the application path — the table is for human
--      diagnosis and audit. Indexed by (subject_id, question_id) for the
--      common "why is this row missing" lookup.
--
--   This is Level-1 (family-level) coverage only — when a family decides not
--   to write any row at all for a given session. Sub-signal nullability
--   inside an existing row (e.g. why is `self_perplexity` null while
--   `text_network_density` is populated) is Level-2 and not addressed here.
--
-- USE CASE
--   `SELECT * FROM tb_signal_skip_log WHERE subject_id = ? AND question_id = ?`
--   surfaces, in one query, every family that declined to compute and why.
--   Replaces the current "grep five files and reason about it" workflow.
--
-- SAFETY
--   Pure CREATE statements. No data mutation, no column conversions, no
--   pre-flight check needed. Wrapped in a single transaction so a partial
--   failure (e.g. seed INSERT conflict) rolls back the table creation
--   rather than leaving an empty dictionary.
--
-- ROLLBACK
--   BEGIN;
--     DROP TABLE IF EXISTS alice.tb_signal_skip_log;
--     DROP TABLE IF EXISTS alice.te_signal_skip_reason;
--   COMMIT;

BEGIN;

-- ─── te_signal_skip_reason ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS te_signal_skip_reason (
   signal_skip_reason_id  SMALLINT PRIMARY KEY
  ,enum_code              TEXT UNIQUE NOT NULL
  ,name                   TEXT NOT NULL
  ,description            TEXT
);

INSERT INTO te_signal_skip_reason (signal_skip_reason_id, enum_code, name, description) VALUES
   (1,  'text_too_short',           'Text too short',           'Response text length below the family threshold (semantic ≥20 chars, cross-session ≥20 chars).')
  ,(2,  'text_missing',             'Text missing',             'getResponseText returned null. Indicates a saved row whose text could not be decrypted, or a defensive guard tripping on a row that should not exist.')
  ,(3,  'stream_too_short',         'Stream too short',         'Keystroke stream event count below the family threshold (dynamical ≥10, motor ≥10).')
  ,(4,  'stream_missing',           'Stream missing',           'getKeystrokeStream returned null. Indicates a session_event row absent or unparseable.')
  ,(5,  'event_log_missing',        'Event log missing',        'getEventLogJson returned null. Process signals require the event log; the keystroke stream alone is insufficient.')
  ,(6,  'calibration_excluded',     'Calibration excluded',     'Calibration sessions (question_source_id = 3) are intentionally excluded from integrity, profile, and reconstruction. Prompted neutral writing produces systematically large distances against journal-derived baselines.')
  ,(7,  'profile_too_immature',     'Profile too immature',     'Integrity requires profile.session_count ≥ 5. New subjects produce no integrity rows for their first 4 journal sessions by design.')
  ,(8,  'session_summary_missing',  'Session summary missing',  'tb_session_summaries row not found. Integrity, profile, and reconstruction depend on it.')
  ,(9,  'dimension_count_too_low',  'Dimension count too low',  'Fewer than 3 valid dimensions had both profile_mean and profile_std > 0. Z-score distance is unreliable below this floor.')
  ,(10, 'paste_contaminated',       'Paste contaminated',       'Session has external-input contamination (paste or drop). Profile, reconstruction, and several derived analyses exclude these rows.')
  ,(11, 'question_not_found',       'Question not found',       'Defensive guard: the (subject_id, question_id) tuple did not resolve to a tb_questions row. Indicates a bug at the call site or a deleted question.')
  ,(12, 'compute_error',            'Compute error',            'The family compute function threw, returned null unexpectedly, or returned a result that failed downstream validation. Context_json carries the error string when available.')
  ,(13, 'no_journal_sessions',      'No journal sessions',      'Profile builder found zero non-calibration, paste-uncontaminated journal sessions for the subject. Profile is not yet computable.')
ON CONFLICT (signal_skip_reason_id) DO NOTHING;

-- ─── tb_signal_skip_log ─────────────────────────────────────────────────────

-- PURPOSE: append-only log of every "did not compute" decision in the signal
--          pipeline. One row per (session, family, decision). Read by humans
--          for diagnosis; never read by application code in a hot path.
-- USE CASE: when a row is missing from tb_dynamical_signals (or any signal
--          table) for a given session, this log says why. Eliminates the
--          "grep five files" workflow.
-- MUTABILITY: insert by libDb.logSignalSkip. Never updated, never deleted by
--          application code. Cleanup is a future operator concern (TTL or
--          per-subject delete on account close — see libDelete.ts).
-- REFERENCED BY: nothing in the application path. Diagnostic surface only.
-- FOOTER: created only (the row records a decision at a moment in time;
--          there is no "modified" semantic).
CREATE TABLE IF NOT EXISTS tb_signal_skip_log (
   signal_skip_log_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id             INT NOT NULL                                  -- logical FK to tb_subjects
  ,question_id            INT NOT NULL                                  -- logical FK to tb_questions
  ,signal_family          TEXT NOT NULL                                 -- string tag: 'dynamical' | 'motor' | 'semantic' | 'process' | 'cross_session' | 'integrity' | 'profile' | 'reconstruction' | 'semantic_baseline'
  ,signal_skip_reason_id  SMALLINT NOT NULL                             -- logical FK to te_signal_skip_reason
  ,context_json           JSONB                                         -- numeric details: {needed: 256, got: 312} etc. Nullable.
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by             TEXT NOT NULL DEFAULT 'system'
);

-- Common query pattern: "why is family X missing for question Y?" — pinned by
-- (subject_id, question_id). Family + reason can be filtered in-memory off a
-- single index hit since N rows per session is small.
CREATE INDEX IF NOT EXISTS ix_signal_skip_log_subject_question
  ON tb_signal_skip_log (subject_id, question_id);

-- Secondary pattern: "every skip of family X across this subject's history" —
-- supports cross-session diagnostic queries without a sequential scan.
CREATE INDEX IF NOT EXISTS ix_signal_skip_log_subject_family
  ON tb_signal_skip_log (subject_id, signal_family);

COMMIT;
