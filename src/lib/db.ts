import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDateStr } from './date.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.ALICE_DB_PATH || path.resolve(__dirname, '../../data/alice.db');

const db = new Database(DB_PATH);

sqliteVec.load(db);
db.pragma('journal_mode = WAL');

// ----------------------------------------------------------------------------
// DATE OVERRIDE (for simulation — production never calls this)
// ----------------------------------------------------------------------------
// When set, save functions use this instead of datetime('now').
// This fixes the wall-clock timestamp bug where SQLite's datetime('now')
// ignores JavaScript's monkey-patched Date during simulation.
let _dateOverride: string | null = null;

/** Set a date override for all save functions. Pass null to clear. */
export function setDateOverride(dateStr: string | null): void {
  _dateOverride = dateStr;
}

/** Get the current datetime string — override if set, otherwise datetime('now'). */
function nowStr(): string {
  return _dateOverride ? `${_dateOverride}T12:00:00` : new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ----------------------------------------------------------------------------
// SCHEMA
// ----------------------------------------------------------------------------
// Standards (adapted from project conventions for SQLite):
// - te_ = enumeration tables (static)
// - tb_ = normal tables (mutable)
// - Surrogate keys: table_name_id (NEVER just "id")
// - Logical foreign keys (no physical constraints)
// - Footer: dttm_created_utc, created_by, dttm_modified_utc, modified_by
//   (on mutable tables; none on static enums)
// ----------------------------------------------------------------------------

db.exec(`
  -- --------------------------------------------------------------------------
  -- te_question_source
  -- --------------------------------------------------------------------------
  -- PURPOSE: Define how a question originated AND what pipeline it triggers
  -- USE CASE: "Is this a real session or a baseline calibration probe?"
  -- MUTABILITY: Static
  -- VALUES:
  --   seed (1)        — curated question. COUNTS AS SESSION. Triggers full
  --                     pipeline: embed → observe → suppressed_q → witness.
  --   generated (2)   — AI-generated question. COUNTS AS SESSION. Same
  --                     pipeline as seed.
  --   calibration (3) — baseline probe (neutral prompt, no reflective intent).
  --                     DOES NOT COUNT AS SESSION. observe/suppress/reflect
  --                     skip these (see observe.ts:85). Only keystroke
  --                     signals + embeddings are captured, to feed baselines.
  -- SESSION FILTER: to count "real sessions", always exclude source_id=3:
  --   JOIN tb_questions q ON ... WHERE q.question_source_id != 3
  -- REFERENCED BY: tb_questions.question_source_id
  -- FOOTER: None
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS te_question_source (
     question_source_id  INTEGER PRIMARY KEY
    ,enum_code           TEXT    UNIQUE NOT NULL
    ,name                TEXT    NOT NULL
  );

  INSERT OR IGNORE INTO te_question_source (question_source_id, enum_code, name)
  VALUES
     (1, 'seed',        'Seed')
    ,(2, 'generated',   'Generated')
    ,(3, 'calibration', 'Calibration');

  -- --------------------------------------------------------------------------
  -- te_reflection_type
  -- --------------------------------------------------------------------------
  -- PURPOSE: Define types of AI reflections
  -- USE CASE: "Is this a weekly pattern pass or a different kind?"
  -- MUTABILITY: Static
  -- VALUES: weekly (1), monthly (2)
  -- REFERENCED BY: tb_reflections.reflection_type_id
  -- FOOTER: None
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS te_reflection_type (
     reflection_type_id  INTEGER PRIMARY KEY
    ,enum_code           TEXT    UNIQUE NOT NULL
    ,name                TEXT    NOT NULL
  );

  INSERT OR IGNORE INTO te_reflection_type (reflection_type_id, enum_code, name)
  VALUES
     (1, 'weekly',  'Weekly')
    ,(2, 'monthly', 'Monthly');

  -- --------------------------------------------------------------------------
  -- tb_questions
  -- --------------------------------------------------------------------------
  -- PURPOSE: Store all questions — seed, generated, AND calibration — scheduled
  --          by date. Calibration rows are baseline probes, not reflective
  --          sessions (see te_question_source for pipeline impact).
  -- USE CASE: "What question is the user seeing today?"
  -- SCOPE: Mixed. question_source_id distinguishes session (1,2) vs
  --        calibration (3). Any query that counts "sessions" MUST filter
  --        WHERE question_source_id != 3.
  -- MUTABILITY: Mutable
  -- REFERENCED BY: tb_responses.question_id (logical)
  -- FOOTER: Full
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_questions (
     question_id         INTEGER PRIMARY KEY AUTOINCREMENT
    ,text                TEXT    NOT NULL
    ,question_source_id  INTEGER NOT NULL DEFAULT 1
    ,scheduled_for       TEXT    UNIQUE
    -- FOOTER
    ,dttm_created_utc    TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by          TEXT    NOT NULL DEFAULT 'system'
    ,dttm_modified_utc   TEXT
    ,modified_by         TEXT
  );

  -- --------------------------------------------------------------------------
  -- tb_responses
  -- --------------------------------------------------------------------------
  -- PURPOSE: Store user responses to daily questions (sessions + calibrations).
  -- USE CASE: "What did the user write today?"
  -- SCOPE: All submissions. Includes calibration responses. To filter to
  --        reflective sessions only, JOIN tb_questions and exclude
  --        question_source_id = 3.
  -- MUTABILITY: Mutable
  -- LOGICAL FK: question_id → tb_questions.question_id
  -- FOOTER: Full
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_responses (
     response_id         INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id         INTEGER NOT NULL
    ,text                TEXT    NOT NULL
    -- FOOTER
    ,dttm_created_utc    TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by          TEXT    NOT NULL DEFAULT 'user'
    ,dttm_modified_utc   TEXT
    ,modified_by         TEXT
  );

  -- --------------------------------------------------------------------------
  -- te_interaction_event_type
  -- --------------------------------------------------------------------------
  -- PURPOSE: Define types of user interaction events
  -- USE CASE: "What kind of interaction just happened?"
  -- MUTABILITY: Static
  -- VALUES: page_open (1), first_keystroke (2), pause (3), resume (4),
  --         submit (5), revisit (6), tab_blur (7), tab_focus (8)
  -- REFERENCED BY: tb_interaction_events.interaction_event_type_id
  -- FOOTER: None
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS te_interaction_event_type (
     interaction_event_type_id  INTEGER PRIMARY KEY
    ,enum_code                  TEXT    UNIQUE NOT NULL
    ,name                       TEXT    NOT NULL
  );

  INSERT OR IGNORE INTO te_interaction_event_type (interaction_event_type_id, enum_code, name)
  VALUES
     (1, 'page_open',        'Page Open')
    ,(2, 'first_keystroke',  'First Keystroke')
    ,(3, 'pause',            'Pause')
    ,(4, 'resume',           'Resume')
    ,(5, 'submit',           'Submit')
    ,(6, 'revisit',          'Revisit')
    ,(7, 'tab_blur',         'Tab Blur')
    ,(8, 'tab_focus',        'Tab Focus')
    ,(9, 'deletion',         'Deletion');

  -- --------------------------------------------------------------------------
  -- tb_interaction_events
  -- --------------------------------------------------------------------------
  -- PURPOSE: Log raw interaction events for behavioral signal
  -- USE CASE: "How did the user engage with today's question?"
  -- MUTABILITY: Mutable (append-only)
  -- LOGICAL FK: question_id → tb_questions.question_id
  -- LOGICAL FK: interaction_event_type_id → te_interaction_event_type
  -- FOOTER: Minimal (created only, no modified — append-only table)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_interaction_events (
     interaction_event_id       INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id                INTEGER NOT NULL
    ,interaction_event_type_id  INTEGER NOT NULL
    ,metadata                   TEXT
    -- FOOTER
    ,dttm_created_utc           TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by                 TEXT    NOT NULL DEFAULT 'client'
  );

  -- --------------------------------------------------------------------------
  -- tb_reflections
  -- --------------------------------------------------------------------------
  -- PURPOSE: Store AI-generated pattern reflections
  -- USE CASE: "What did Alice notice across the user's responses?"
  -- MUTABILITY: Mutable
  -- LOGICAL FK: reflection_type_id → te_reflection_type.reflection_type_id
  -- FOOTER: Full
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_reflections (
     reflection_id       INTEGER PRIMARY KEY AUTOINCREMENT
    ,text                TEXT    NOT NULL
    ,reflection_type_id  INTEGER NOT NULL DEFAULT 1
    -- FOOTER
    ,dttm_created_utc    TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by          TEXT    NOT NULL DEFAULT 'system'
    ,dttm_modified_utc   TEXT
    ,modified_by         TEXT
  );

  -- --------------------------------------------------------------------------
  -- tb_session_summaries
  -- --------------------------------------------------------------------------
  -- PURPOSE: Derived behavioral metrics for each daily session
  -- USE CASE: "How did the user engage with today's question — not what
  --           they said, but how they said it?"
  -- MUTABILITY: Mutable (append-only, one row per question)
  -- LOGICAL FK: question_id → tb_questions.question_id
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  -- --------------------------------------------------------------------------
  -- tb_question_feedback
  -- --------------------------------------------------------------------------
  -- PURPOSE: Minimal external signal — did the question land?
  -- USE CASE: "Was this question relevant/resonant for the user?"
  -- MUTABILITY: Mutable (append-only)
  -- LOGICAL FK: question_id → tb_questions.question_id
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_question_feedback (
     question_feedback_id  INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id           INTEGER NOT NULL UNIQUE
    ,landed                INTEGER NOT NULL          -- 1 = yes, 0 = no
    ,dttm_created_utc      TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by            TEXT    NOT NULL DEFAULT 'user'
  );

  -- --------------------------------------------------------------------------
  -- tb_session_summaries
  -- --------------------------------------------------------------------------
  -- PURPOSE: Derived behavioral metrics per daily session
  -- USE CASE: Feed Alice Negative signal computation and trajectory engine
  -- MUTABILITY: Mutable (append-only, one row per question)
  -- LOGICAL FK: question_id → tb_questions.question_id
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_session_summaries (
     session_summary_id         INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id                INTEGER NOT NULL UNIQUE
    ,first_keystroke_ms         INTEGER          -- ms from page open to first keystroke
    ,total_duration_ms          INTEGER          -- ms from page open to submit
    ,total_chars_typed          INTEGER          -- all chars typed including deleted
    ,final_char_count           INTEGER          -- length of submitted text
    ,commitment_ratio           REAL             -- final / total (0.0 - 1.0)
    ,pause_count                INTEGER          -- pauses > 30s
    ,total_pause_ms             INTEGER          -- cumulative pause time
    ,deletion_count             INTEGER          -- number of deletion events
    ,largest_deletion           INTEGER          -- max chars deleted in one burst
    ,total_chars_deleted        INTEGER          -- all chars deleted
    ,tab_away_count             INTEGER          -- times user left the page
    ,total_tab_away_ms          INTEGER          -- cumulative time away
    ,word_count                 INTEGER          -- words in final submission
    ,sentence_count             INTEGER          -- sentences in final submission
    -- ENRICHED: deletion decomposition (Faigley & Witte taxonomy)
    ,small_deletion_count       INTEGER          -- deletions <10 chars (corrections)
    ,large_deletion_count       INTEGER          -- deletions >=10 chars (revisions)
    ,large_deletion_chars       INTEGER          -- total chars in large deletions
    ,first_half_deletion_chars  INTEGER          -- deletion chars in first half of session
    ,second_half_deletion_chars INTEGER          -- deletion chars in second half of session
    -- ENRICHED: production fluency (Chenoweth & Hayes P-bursts)
    ,active_typing_ms           INTEGER          -- duration minus pauses minus tab-aways
    ,chars_per_minute           REAL             -- total_chars_typed / active_minutes
    ,p_burst_count              INTEGER          -- 2s-bounded production bursts
    ,avg_p_burst_length         REAL             -- mean burst length in chars
    -- LINGUISTIC: NRC Emotion Lexicon densities (Mohammad & Turney, 2013)
    ,nrc_anger_density          REAL             -- anger word count / total words
    ,nrc_fear_density           REAL             -- fear word count / total words
    ,nrc_joy_density            REAL             -- joy word count / total words
    ,nrc_sadness_density        REAL             -- sadness word count / total words
    ,nrc_trust_density          REAL             -- trust word count / total words
    ,nrc_anticipation_density   REAL             -- anticipation word count / total words
    ,cognitive_density          REAL             -- cognitive mechanism words / total (Pennebaker)
    ,hedging_density            REAL             -- hedging words / total
    ,first_person_density       REAL             -- first person pronouns / total
    -- KEYSTROKE DYNAMICS (Epp et al. 2011; Leijten & Van Waes 2013)
    ,inter_key_interval_mean    REAL             -- mean ms between keystrokes (capped 5s)
    ,inter_key_interval_std     REAL             -- std dev of inter-key intervals
    ,revision_chain_count       INTEGER          -- count of sequential deletion chains
    ,revision_chain_avg_length  REAL             -- avg keystrokes per revision chain
    -- HOLD TIME + FLIGHT TIME DECOMPOSITION (Kim et al. 2024, JMIR)
    -- Hold time (keydown→keyup) = motor execution, tremor, rigidity
    -- Flight time (keyup→next keydown) = cognitive planning, retrieval latency
    ,hold_time_mean             REAL             -- mean hold time in ms
    ,hold_time_std              REAL             -- std dev of hold times
    ,flight_time_mean           REAL             -- mean flight time in ms
    ,flight_time_std            REAL             -- std dev of flight times
    -- KEYSTROKE ENTROPY (Ajilore et al. 2025, BiAffect — d=-1.28 for executive function)
    -- Shannon entropy of IKI distribution: measures timing unpredictability
    ,keystroke_entropy          REAL             -- bits; higher = more irregular timing
    -- LEXICAL DIVERSITY (McCarthy & Jarvis 2010)
    ,mattr                      REAL             -- Moving-Average Type-Token Ratio (25-word window)
    -- SENTENCE METRICS
    ,avg_sentence_length        REAL             -- mean words per sentence
    ,sentence_length_variance   REAL             -- variance of sentence lengths
    -- SESSION METADATA (Czerwinski et al. 2004)
    ,scroll_back_count          INTEGER          -- times user scrolled back in textarea
    ,question_reread_count      INTEGER          -- times user scrolled to re-read question
    -- DELETION EVENT LOG (slice 3 follow-up — for deletion-density curve classification)
    -- JSON array: [{c: chars, t: ms_offset_from_session_start}, ...]
    ,deletion_events_json       TEXT             -- per-deletion timing log
    -- CONTEXT
    ,device_type                TEXT             -- 'mobile' or 'desktop'
    ,user_agent                 TEXT             -- raw user agent string
    ,hour_of_day                INTEGER          -- 0-23 local time
    ,day_of_week                INTEGER          -- 0=Sunday, 6=Saturday
    -- FOOTER
    ,dttm_created_utc           TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by                 TEXT    NOT NULL DEFAULT 'system'
  );

  -- tb_ai_observations, tb_ai_suppressed_questions — archived 2026-04-16
  -- (interpretive-layer restructure). Data preserved under
  -- zz_archive_ai_observations_20260416 and
  -- zz_archive_ai_suppressed_questions_20260416. Schema no longer recreated.
  -- See scripts/archive-interpretive-layer-20260416.ts.

  -- --------------------------------------------------------------------------
  -- te_prompt_trace_type
  -- --------------------------------------------------------------------------
  -- PURPOSE: Define what kind of prompt was assembled
  -- USE CASE: "Was this trace from question generation, observation, or reflection?"
  -- MUTABILITY: Static
  -- VALUES: generation (1), observation (2), reflection (3)
  -- REFERENCED BY: tb_prompt_traces.prompt_trace_type_id
  -- FOOTER: None
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS te_prompt_trace_type (
     prompt_trace_type_id  INTEGER PRIMARY KEY
    ,enum_code             TEXT    UNIQUE NOT NULL
    ,name                  TEXT    NOT NULL
  );

  INSERT OR IGNORE INTO te_prompt_trace_type (prompt_trace_type_id, enum_code, name)
  VALUES
     (1, 'generation',  'Generation')
    ,(2, 'observation', 'Observation')
    ,(3, 'reflection',  'Reflection');

  -- --------------------------------------------------------------------------
  -- tb_prompt_traces
  -- --------------------------------------------------------------------------
  -- PURPOSE: Record what data went into each AI prompt for future auditability
  -- USE CASE: "What did the model see when it generated this question?"
  -- MUTABILITY: Mutable (append-only)
  -- LOGICAL FK: prompt_trace_type_id -> te_prompt_trace_type.prompt_trace_type_id
  -- LOGICAL FK: output_record_id -> tb_questions.question_id (type=1)
  --                               -> tb_ai_observations.ai_observation_id (type=2)
  --                               -> tb_reflections.reflection_id (type=3)
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_prompt_traces (
     prompt_trace_id       INTEGER PRIMARY KEY AUTOINCREMENT
    ,prompt_trace_type_id  INTEGER NOT NULL
    ,output_record_id      INTEGER               -- the record produced by this prompt
    ,recent_entry_ids      TEXT                   -- JSON array of response_ids included verbatim
    ,rag_entry_ids         TEXT                   -- JSON array of response_ids retrieved by RAG
    ,contrarian_entry_ids  TEXT                   -- JSON array of response_ids from contrarian retrieval
    ,reflection_ids        TEXT                   -- JSON array of reflection_ids included
    ,observation_ids       TEXT                   -- JSON array of observation_ids included
    ,model_name            TEXT    NOT NULL DEFAULT 'claude-opus-4-6'
    ,token_estimate        INTEGER                -- rough prompt size for tracking growth
    -- FOOTER
    ,dttm_created_utc      TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by            TEXT    NOT NULL DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- te_embedding_source
  -- --------------------------------------------------------------------------
  -- PURPOSE: Define the origin type of an embedded text chunk
  -- USE CASE: "Is this embedding from a response, observation, or reflection?"
  -- MUTABILITY: Static
  -- VALUES: response (1), observation (2), reflection (3)
  -- REFERENCED BY: tb_embeddings.embedding_source_id
  -- FOOTER: None
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS te_embedding_source (
     embedding_source_id  INTEGER PRIMARY KEY
    ,enum_code            TEXT    UNIQUE NOT NULL
    ,name                 TEXT    NOT NULL
  );

  INSERT OR IGNORE INTO te_embedding_source (embedding_source_id, enum_code, name)
  VALUES
     (1, 'response',    'Response')
    ,(2, 'observation', 'Observation')
    ,(3, 'reflection',  'Reflection');

  -- --------------------------------------------------------------------------
  -- tb_embeddings
  -- --------------------------------------------------------------------------
  -- PURPOSE: Store metadata for embedded text chunks, linked to vec_embeddings
  -- USE CASE: "Which entries have been embedded? What text was embedded?"
  -- MUTABILITY: Mutable (append-only)
  -- LOGICAL FK: embedding_source_id -> te_embedding_source.embedding_source_id
  -- LOGICAL FK: source_record_id -> tb_responses.response_id (source=1)
  --                               -> tb_ai_observations.ai_observation_id (source=2)
  --                               -> tb_reflections.reflection_id (source=3)
  -- REFERENCED BY: vec_embeddings.embedding_id
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_embeddings (
     embedding_id         INTEGER PRIMARY KEY AUTOINCREMENT
    ,embedding_source_id  INTEGER NOT NULL
    ,source_record_id     INTEGER NOT NULL
    ,embedded_text        TEXT    NOT NULL
    ,source_date          TEXT
    ,model_name           TEXT    NOT NULL DEFAULT 'voyage-3-lite'
    -- FOOTER
    ,dttm_created_utc     TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by           TEXT    NOT NULL DEFAULT 'system'
    ,UNIQUE(embedding_source_id, source_record_id)
  );
`);

// sqlite-vec virtual table — created separately since virtual tables use different syntax
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
    embedding_id INTEGER PRIMARY KEY,
    embedding float[512]
  );
`);

// ----------------------------------------------------------------------------
// PREDICTION SYSTEM TABLES
// ----------------------------------------------------------------------------

// te_prediction_status, te_prediction_type, te_grade_method,
// te_intervention_intent, tb_question_candidates, tb_predictions,
// tb_theory_confidence — archived 2026-04-16 (interpretive-layer restructure).
// Data preserved under zz_archive_*_20260416. Schema no longer recreated.
// See scripts/archive-interpretive-layer-20260416.ts.

db.exec(`
  -- --------------------------------------------------------------------------
  -- tb_witness_states
  -- --------------------------------------------------------------------------
  -- PURPOSE: Store the witness-form's AI-generated trait vectors
  -- USE CASE: "What did Alice Negative look like after entry N?"
  -- MUTABILITY: Append-only — one row per data change event
  -- REFERENCED BY: /api/witness reads the latest row
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  -- --------------------------------------------------------------------------
  -- tb_burst_sequences
  -- --------------------------------------------------------------------------
  -- PURPOSE: Store per-burst production data for within-session KT analysis.
  --          Each row is one P-burst (Chenoweth & Hayes, 2s threshold).
  --          The full sequence captures the short→long burst transition
  --          signature identified by Baaijen & Galbraith (2012).
  -- USE CASE: "Did the writer start fragmented and consolidate, or stay even?"
  -- MUTABILITY: Append-only (one set of rows per session)
  -- LOGICAL FK: question_id → tb_questions.question_id
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_burst_sequences (
     burst_sequence_id    INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id          INTEGER NOT NULL
    ,burst_index          INTEGER NOT NULL          -- 0-based order within session
    ,burst_char_count     INTEGER NOT NULL          -- chars produced in this burst
    ,burst_duration_ms    INTEGER NOT NULL          -- ms from first to last keystroke in burst
    ,burst_start_offset_ms INTEGER NOT NULL         -- ms from page open to burst start
    -- FOOTER
    ,dttm_created_utc     TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by           TEXT    NOT NULL DEFAULT 'client'
  );

  -- --------------------------------------------------------------------------
  -- tb_session_metadata
  -- --------------------------------------------------------------------------
  -- PURPOSE: Per-session derived metadata signals from slice-3 follow-up work.
  --          These signals do not perturb the 7D behavioral z-score discipline
  --          or the semantic 11D vector — they live as session metadata that
  --          will feed the joint embedding when distance-function work lands.
  -- USE CASE: "Was today an unusual hour for the writer? What shape did the
  --            burst sequence take? Where did deletions cluster?"
  -- MUTABILITY: Append-only (one row per journal entry, computed at submit)
  -- LOGICAL FK: question_id → tb_questions.question_id
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_session_metadata (
     session_metadata_id           INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id                   INTEGER NOT NULL
    -- Time-of-day typicality: how typical is this hour for the writer?
    -- Computed from circular kernel density on personal hour distribution.
    ,hour_typicality               REAL    -- z-scored: 0 = typical, negative = unusual hour
    -- Deletion-density curve classification (early-loaded / late-loaded /
    -- uniform / bimodal / terminal-burst / none) computed from deletion_events_json
    ,deletion_curve_type           TEXT
    -- Burst trajectory shape from tb_burst_sequences:
    --   monotonic_up / monotonic_down / u_shaped / inverted_u / flat / none
    ,burst_trajectory_shape        TEXT
    -- Burst rhythm: inter-burst interval distribution (ms between burst ends)
    ,inter_burst_interval_mean_ms  REAL
    ,inter_burst_interval_std_ms   REAL
    -- Burst-deletion proximity: deletions inside bursts vs between bursts
    ,deletion_during_burst_count   INTEGER
    ,deletion_between_burst_count  INTEGER
    -- FOOTER
    ,dttm_created_utc              TEXT    DEFAULT (datetime('now'))
    ,created_by                    TEXT    DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_calibration_baselines_history
  -- --------------------------------------------------------------------------
  -- PURPOSE: Append-only snapshot of calibration baselines after each
  --          calibration submission. Drift in the reference frame itself is
  --          signal — if calibration is supposed to be stable, baseline
  --          drift over time is its own designer-facing health metric.
  -- USE CASE: "Did the writer's neutral-writing baseline drift this month?"
  -- MUTABILITY: Append-only
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_calibration_baselines_history (
     calibration_history_id        INTEGER PRIMARY KEY AUTOINCREMENT
    ,calibration_session_count     INTEGER NOT NULL
    ,device_type                   TEXT
    -- snapshot of baselines at this calibration count
    ,avg_first_keystroke_ms        REAL
    ,avg_commitment_ratio          REAL
    ,avg_duration_ms               REAL
    ,avg_pause_count               REAL
    ,avg_deletion_count            REAL
    ,avg_chars_per_minute          REAL
    ,avg_p_burst_length            REAL
    ,avg_small_deletion_count      REAL
    ,avg_large_deletion_count      REAL
    ,avg_iki_mean                  REAL
    ,avg_hold_time_mean            REAL
    ,avg_flight_time_mean          REAL
    -- L2 distance from previous snapshot (z-scored per dimension before sum)
    ,drift_magnitude               REAL
    -- FOOTER
    ,dttm_created_utc              TEXT    DEFAULT (datetime('now'))
    ,created_by                    TEXT    DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_session_events
  -- --------------------------------------------------------------------------
  -- PURPOSE: Per-keystroke event log enabling read-only playback of the
  --          original writing session at original tempo. Stored as a compact
  --          JSON array of event tuples to keep insert/scan cheap.
  -- USE CASE: "Re-watch the keystroke timeline of session N at real tempo."
  -- EVENT FORMAT: [t_offset_ms, event_type, payload]
  --   event_type: 'kd' (keydown), 'ku' (keyup), 'tx' (text-snapshot)
  --   payload:    key string for kd/ku, full text for tx (sparse — only on
  --               state transitions worth replaying)
  -- MUTABILITY: Append-only (one row per session, one big JSON blob)
  -- LOGICAL FK: question_id → tb_questions.question_id
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_session_events (
     session_event_id      INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id           INTEGER NOT NULL
    ,event_log_json        TEXT    NOT NULL
    ,total_events          INTEGER NOT NULL
    ,session_duration_ms   INTEGER NOT NULL
    -- FOOTER
    ,dttm_created_utc      TEXT    DEFAULT (datetime('now'))
    ,created_by            TEXT    DEFAULT 'client'
  );

  CREATE TABLE IF NOT EXISTS tb_witness_states (
     witness_state_id    INTEGER PRIMARY KEY AUTOINCREMENT
    ,entry_count         INTEGER NOT NULL
    ,traits_json         TEXT    NOT NULL
    ,signals_json        TEXT    NOT NULL
    ,model_name          TEXT    DEFAULT 'claude-sonnet-4-20250514'
    ,dttm_created_utc    TEXT    DEFAULT (datetime('now'))
    ,created_by          TEXT    DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_entry_states
  -- --------------------------------------------------------------------------
  -- PURPOSE: Per-entry 7D deterministic behavioral state vector. Each entry
  --          produces one state measurement — pure math, no AI interpretation.
  --          Slice 3 (2026-04-16) pulled "expression" out of PersDyn into a
  --          parallel semantic state space (tb_semantic_states); 8D vectors
  --          are archived as zz_archive_entry_states_8d_20260416.
  -- USE CASE: "What was the behavioral state for entry N?"
  -- MUTABILITY: Append-only (one row per journal entry)
  -- REFERENCED BY: dynamics engine reads full history for trait inference
  -- RESEARCH: Dimensions validated for independence:
  --   fluency      — Chenoweth & Hayes (2001), Deane (2015) P-burst length
  --   deliberation — Deane (2015) cognitive load composite
  --   revision     — Baaijen et al. (2012) commitment + substantive deletion
  --   commitment   — final/typed ratio z-scored
  --   volatility   — session-to-session behavioral distance
  --   thermal      — correction rate + revision timing composite
  --   presence     — inverse distraction (tab-away + pause rate)
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_entry_states (
     entry_state_id    INTEGER PRIMARY KEY AUTOINCREMENT
    ,response_id       INTEGER NOT NULL
    ,fluency           REAL    NOT NULL
    ,deliberation      REAL    NOT NULL
    ,revision          REAL    NOT NULL
    ,commitment        REAL    NOT NULL
    ,volatility        REAL    NOT NULL
    ,thermal           REAL    NOT NULL
    ,presence          REAL    NOT NULL
    ,convergence       REAL    NOT NULL
    ,dttm_created_utc  TEXT    DEFAULT (datetime('now'))
    ,created_by        TEXT    DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_trait_dynamics
  -- --------------------------------------------------------------------------
  -- PURPOSE: PersDyn model parameters per behavioral dimension.
  --          Three parameters per dimension: baseline (stable set point),
  --          variability (fluctuation width), attractor_force (snap-back speed).
  -- USE CASE: "How rigid/malleable is this person on each dimension?"
  -- RESEARCH: Sosnowska, Kuppens, De Fruyt & Hofmans (KU Leuven, 2019)
  --           PersDyn: A Unified Dynamic Systems Model
  -- MUTABILITY: Recomputed when entry count changes (latest row is canonical)
  -- REFERENCED BY: /api/witness reads latest dynamics set for rendering
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_trait_dynamics (
     trait_dynamic_id   INTEGER PRIMARY KEY AUTOINCREMENT
    ,entry_count        INTEGER NOT NULL
    ,dimension          TEXT    NOT NULL
    ,baseline           REAL    NOT NULL
    ,variability        REAL    NOT NULL
    ,attractor_force    REAL    NOT NULL
    ,current_state      REAL    NOT NULL
    ,deviation          REAL    NOT NULL
    ,window_size        INTEGER NOT NULL
    ,dttm_created_utc   TEXT    DEFAULT (datetime('now'))
    ,created_by         TEXT    DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_coupling_matrix
  -- --------------------------------------------------------------------------
  -- PURPOSE: Empirically-discovered causal coupling between behavioral dimensions.
  --          Lagged cross-correlations reveal which dimensions lead/follow.
  -- USE CASE: "When deliberation spikes, what happens to revision 2 entries later?"
  -- RESEARCH: Critcher (Berkeley xLab) causal trait theories;
  --           Mesbah et al. (2024) leading indicator analysis
  -- MUTABILITY: Recomputed when entry count changes
  -- REFERENCED BY: /api/witness uses coupling for visual rendering context
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_coupling_matrix (
     coupling_id        INTEGER PRIMARY KEY AUTOINCREMENT
    ,entry_count        INTEGER NOT NULL
    ,leader             TEXT    NOT NULL
    ,follower           TEXT    NOT NULL
    ,lag_sessions       INTEGER NOT NULL
    ,correlation        REAL    NOT NULL
    ,direction          REAL    NOT NULL
    ,dttm_created_utc   TEXT    DEFAULT (datetime('now'))
    ,created_by         TEXT    DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_emotion_behavior_coupling
  -- --------------------------------------------------------------------------
  -- PURPOSE: Cross-domain causal coupling between emotion word densities
  --          and behavioral state dimensions. Discovers whether emotional
  --          register predicts future behavioral shifts.
  -- USE CASE: "When anger word density spikes, does deliberation follow?"
  -- RESEARCH: Extends Critcher (Berkeley xLab) causal trait theories
  --           across the content/behavior boundary.
  --           Pennebaker (2011) word category slopes as predictors.
  -- MUTABILITY: Recomputed when entry count changes
  -- REFERENCED BY: /api/witness uses for visual rendering context
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_emotion_behavior_coupling (
     emotion_coupling_id  INTEGER PRIMARY KEY AUTOINCREMENT
    ,entry_count          INTEGER NOT NULL
    ,emotion_dim          TEXT    NOT NULL
    ,behavior_dim         TEXT    NOT NULL
    ,lag_sessions         INTEGER NOT NULL
    ,correlation          REAL    NOT NULL
    ,direction            REAL    NOT NULL
    ,dttm_created_utc     TEXT    DEFAULT (datetime('now'))
    ,created_by           TEXT    DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_semantic_states
  -- --------------------------------------------------------------------------
  -- PURPOSE: Per-entry semantic state vector. Parallel to tb_entry_states.
  --          Z-scored linguistic / affective densities per session, designed
  --          to be orthogonal to the behavioral 7D space at construction time.
  --          Slice 3 (2026-04-16) introduced this table when "expression" was
  --          pulled out of PersDyn.
  -- USE CASE: "What was the semantic state for entry N?"
  -- MUTABILITY: Append-only (one row per journal entry)
  -- REFERENCED BY: dynamics engine (called over SEMANTIC_DIMENSIONS list);
  --                downstream joint-embedding / distance-function work.
  -- DIMENSIONS (deterministic, populated now):
  --   syntactic_complexity  — z(avgSentenceLength)
  --   interrogation         — z(questionDensity)
  --   self_focus            — z(firstPersonDensity)
  --   uncertainty           — z(hedgingDensity)
  --   cognitive_processing  — z(cognitiveDensity)
  --   nrc_anger / nrc_fear / nrc_joy / nrc_sadness / nrc_trust / nrc_anticipation
  --                         — z(NRC emotion lexicon densities)
  -- DIMENSIONS (LLM-extracted, schema-ready, populated null until extraction):
  --   sentiment / abstraction / agency_framing / temporal_orientation
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_semantic_states (
     semantic_state_id     INTEGER PRIMARY KEY AUTOINCREMENT
    ,response_id           INTEGER NOT NULL
    ,syntactic_complexity  REAL    NOT NULL
    ,interrogation         REAL    NOT NULL
    ,self_focus            REAL    NOT NULL
    ,uncertainty           REAL    NOT NULL
    ,cognitive_processing  REAL    NOT NULL
    ,nrc_anger             REAL    NOT NULL
    ,nrc_fear              REAL    NOT NULL
    ,nrc_joy               REAL    NOT NULL
    ,nrc_sadness           REAL    NOT NULL
    ,nrc_trust             REAL    NOT NULL
    ,nrc_anticipation      REAL    NOT NULL
    -- LLM-extracted features (schema-ready, populated null until extraction lands)
    ,sentiment             REAL
    ,abstraction           REAL
    ,agency_framing        REAL
    ,temporal_orientation  REAL
    ,convergence           REAL    NOT NULL
    ,dttm_created_utc      TEXT    DEFAULT (datetime('now'))
    ,created_by            TEXT    DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_semantic_dynamics
  -- --------------------------------------------------------------------------
  -- PURPOSE: PersDyn-style parameters per semantic dimension. Parallel to
  --          tb_trait_dynamics. Same generic dynamics engine, different
  --          dimension list.
  -- MUTABILITY: Recomputed when entry count changes (latest row is canonical)
  -- REFERENCED BY: downstream coupling-graph / mode-cluster work
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_semantic_dynamics (
     semantic_dynamic_id  INTEGER PRIMARY KEY AUTOINCREMENT
    ,entry_count          INTEGER NOT NULL
    ,dimension            TEXT    NOT NULL
    ,baseline             REAL    NOT NULL
    ,variability          REAL    NOT NULL
    ,attractor_force      REAL    NOT NULL
    ,current_state        REAL    NOT NULL
    ,deviation            REAL    NOT NULL
    ,window_size          INTEGER NOT NULL
    ,dttm_created_utc     TEXT    DEFAULT (datetime('now'))
    ,created_by           TEXT    DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_semantic_coupling
  -- --------------------------------------------------------------------------
  -- PURPOSE: Empirically-discovered lagged coupling between semantic
  --          dimensions. Parallel to tb_coupling_matrix.
  -- MUTABILITY: Recomputed when entry count changes
  -- FOOTER: dttm_created_utc, created_by
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_semantic_coupling (
     semantic_coupling_id  INTEGER PRIMARY KEY AUTOINCREMENT
    ,entry_count           INTEGER NOT NULL
    ,leader                TEXT    NOT NULL
    ,follower              TEXT    NOT NULL
    ,lag_sessions          INTEGER NOT NULL
    ,correlation           REAL    NOT NULL
    ,direction             REAL    NOT NULL
    ,dttm_created_utc      TEXT    DEFAULT (datetime('now'))
    ,created_by            TEXT    DEFAULT 'system'
  );
`);

// --------------------------------------------------------------------------
// CALIBRATION CONTENT EXTRACTION TABLES
// --------------------------------------------------------------------------

db.exec(`
  -- --------------------------------------------------------------------------
  -- te_context_dimension
  -- --------------------------------------------------------------------------
  -- PURPOSE: Define life-context dimensions extracted from calibration text
  -- USE CASE: "What kind of life-context tag is this?"
  -- MUTABILITY: Static
  -- VALUES: sleep (1), physical_state (2), emotional_event (3),
  --         social_quality (4), stress (5), exercise (6), routine (7)
  -- REFERENCED BY: tb_calibration_context.context_dimension_id
  -- RESEARCH: Dimensions ranked by evidence strength for behavioral prediction:
  --   sleep           — Pilcher & Huffcutt (1996) d=-1.55; keystroke evidence (Abdullah et al. 2016)
  --   physical_state  — Moriarty et al. (2011) d=0.40-0.80; Eccleston & Crombez (1999)
  --   emotional_event — Amabile et al. (2005) 12K diary entries; Fredrickson (2001) broaden-and-build
  --   social_quality  — Reis et al. (2000) quality > quantity; Sun et al. (2020) PNAS
  --   stress          — Sliwinski et al. (2009) same-day WM decrement; Almeida (2005) carry-over
  --   exercise        — Hillman et al. (2008) d=0.20-0.50; temporally bounded acute effect
  --   routine         — Torous et al. (2016) circadian disruption; partially captured by session metadata
  --   DROPPED: meals (d=0.12-0.25, Hoyland et al.), environment (no keystroke evidence),
  --            caffeine (d=0.10-0.20 net for habitual users)
  -- FOOTER: None
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS te_context_dimension (
     context_dimension_id  INTEGER PRIMARY KEY
    ,enum_code             TEXT    UNIQUE NOT NULL
    ,name                  TEXT    NOT NULL
  );

  INSERT OR IGNORE INTO te_context_dimension (context_dimension_id, enum_code, name)
  VALUES
     (1, 'sleep',           'Sleep')
    ,(2, 'physical_state',  'Physical State')
    ,(3, 'emotional_event', 'Emotional Event')
    ,(4, 'social_quality',  'Social Quality')
    ,(5, 'stress',          'Stress')
    ,(6, 'exercise',        'Exercise')
    ,(7, 'routine',         'Routine');

  -- --------------------------------------------------------------------------
  -- tb_calibration_context
  -- --------------------------------------------------------------------------
  -- PURPOSE: Structured life-context tags extracted from calibration response
  --          text. The user's neutral descriptions of their morning/day contain
  --          observable facts (sleep, physical state, emotional events, social
  --          quality, stress, exercise, routine) that serve as incidental
  --          supervision for behavioral clustering.
  -- USE CASE: "What was happening in the user's life around this session?"
  -- MUTABILITY: Append-only (one set of rows per calibration session)
  -- LOGICAL FK: question_id → tb_questions.question_id (calibration question)
  -- LOGICAL FK: context_dimension_id → te_context_dimension.context_dimension_id
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_calibration_context (
     calibration_context_id  INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id             INTEGER NOT NULL
    ,context_dimension_id    INTEGER NOT NULL
    ,value                   TEXT    NOT NULL          -- e.g., 'poor', 'skipped', 'disrupted'
    ,detail                  TEXT                      -- optional specifics from the text
    ,confidence              REAL    NOT NULL DEFAULT 1.0  -- extraction confidence 0-1
    -- FOOTER
    ,dttm_created_utc        TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by              TEXT    NOT NULL DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_session_delta
  -- --------------------------------------------------------------------------
  -- PURPOSE: Computed behavioral delta vectors between same-day calibration
  --          (neutral writing) and journal (reflective writing) sessions.
  --          Isolates what the reflective question provoked, controlling for
  --          daily confounds (sleep, stress, fatigue, device, time-of-day).
  -- USE CASE: "How did this person's writing behavior change when they
  --           shifted from neutral to reflective writing today?"
  -- RESEARCH: Pennebaker (1986) expressive writing paradigm — neutral vs
  --           emotional writing as within-person control. Toledo et al (2024)
  --           76-89% of stress response variance is within-day. Collins et al
  --           (2025) self-referential language from diary text detects
  --           depression AUC 0.68. Lambert OQ-45 deviation-from-expected-
  --           trajectory detects 85-100% of deteriorating cases.
  -- MUTABILITY: Append-only (one row per date, INSERT OR REPLACE)
  -- LOGICAL FK: calibration_question_id → tb_questions.question_id
  -- LOGICAL FK: journal_question_id → tb_questions.question_id
  -- REFERENCED BY: session-delta.ts, observe.ts, generate.ts, reflect.ts
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_session_delta (
     session_delta_id                    INTEGER PRIMARY KEY AUTOINCREMENT
    ,session_date                        TEXT    NOT NULL UNIQUE
    ,calibration_question_id             INTEGER NOT NULL
    ,journal_question_id                 INTEGER NOT NULL
    -- DELTA DIMENSIONS (journal value minus calibration value)
    ,delta_first_person                  REAL    -- Newman 2003: self-referential distancing
    ,delta_cognitive                     REAL    -- Vrij: cognitive load markers
    ,delta_hedging                       REAL    -- uncertainty / performance anxiety
    ,delta_chars_per_minute              REAL    -- production disruption / fluency shift
    ,delta_commitment                    REAL    -- self-censoring behavior
    ,delta_large_deletion_count          REAL    -- substantive rethinking (Faigley & Witte)
    ,delta_inter_key_interval_mean       REAL    -- keystroke hesitation (Epp et al 2011)
    ,delta_avg_p_burst_length            REAL    -- thought-unit length (Chenoweth & Hayes)
    -- HOLD TIME + FLIGHT TIME DELTAS (Kim et al. 2024)
    ,delta_hold_time_mean                REAL    -- motor execution shift
    ,delta_flight_time_mean              REAL    -- cognitive planning shift
    -- COMPOSITE
    ,delta_magnitude                     REAL    -- Euclidean distance in z-normalized delta-space
    -- RAW VALUES (calibration then journal, for auditability)
    ,calibration_first_person            REAL
    ,journal_first_person                REAL
    ,calibration_cognitive               REAL
    ,journal_cognitive                   REAL
    ,calibration_hedging                 REAL
    ,journal_hedging                     REAL
    ,calibration_chars_per_minute        REAL
    ,journal_chars_per_minute            REAL
    ,calibration_commitment              REAL
    ,journal_commitment                  REAL
    ,calibration_large_deletion_count    REAL
    ,journal_large_deletion_count        REAL
    ,calibration_inter_key_interval_mean REAL
    ,journal_inter_key_interval_mean     REAL
    ,calibration_avg_p_burst_length      REAL
    ,journal_avg_p_burst_length          REAL
    ,calibration_hold_time_mean          REAL
    ,journal_hold_time_mean              REAL
    ,calibration_flight_time_mean        REAL
    ,journal_flight_time_mean            REAL
    -- FOOTER
    ,dttm_created_utc                    TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by                          TEXT    NOT NULL DEFAULT 'system'
  );
`);

// --------------------------------------------------------------------------
// MIGRATION: Update te_context_dimension to research-backed dimensions
// --------------------------------------------------------------------------
try {
  const existing = db.prepare(
    `SELECT enum_code FROM te_context_dimension WHERE context_dimension_id = 2`
  ).get() as { enum_code: string } | null;
  if (existing && existing.enum_code === 'meals') {
    // Old schema detected — update to research-backed dimensions
    db.exec(`
      UPDATE te_context_dimension SET enum_code = 'physical_state', name = 'Physical State' WHERE context_dimension_id = 2;
      UPDATE te_context_dimension SET enum_code = 'emotional_event', name = 'Emotional Event' WHERE context_dimension_id = 3;
      UPDATE te_context_dimension SET enum_code = 'social_quality', name = 'Social Quality' WHERE context_dimension_id = 4;
      UPDATE te_context_dimension SET enum_code = 'stress', name = 'Stress' WHERE context_dimension_id = 5;
      UPDATE te_context_dimension SET enum_code = 'exercise', name = 'Exercise' WHERE context_dimension_id = 6;
      UPDATE te_context_dimension SET enum_code = 'routine', name = 'Routine' WHERE context_dimension_id = 7;
    `);
    // Note: ID 1 (sleep) stays the same. Old IDs 2-7 are remapped.
    // No existing data needs migration — calibration context table is new.
  }
} catch {
  // Safe to ignore — table may not exist yet
}

// --------------------------------------------------------------------------
// MIGRATION: Add coverage_through_response_id to tb_reflections
// --------------------------------------------------------------------------
try {
  const cols = db.prepare(`PRAGMA table_info(tb_reflections)`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'coverage_through_response_id')) {
    db.exec(`ALTER TABLE tb_reflections ADD COLUMN coverage_through_response_id INTEGER`);
  }
} catch {
  // Column already exists or table doesn't exist yet — safe to ignore
}

// --------------------------------------------------------------------------
// MIGRATION: Add intervention_intent_id to tb_questions
// --------------------------------------------------------------------------
try {
  const cols = db.prepare(`PRAGMA table_info(tb_questions)`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'intervention_intent_id')) {
    db.exec(`ALTER TABLE tb_questions ADD COLUMN intervention_intent_id INTEGER`);
  }
  if (!cols.some(c => c.name === 'intervention_rationale')) {
    db.exec(`ALTER TABLE tb_questions ADD COLUMN intervention_rationale TEXT`);
  }
} catch {
  // safe to ignore
}

// --------------------------------------------------------------------------
// MIGRATION: Add linguistic density columns to tb_session_summaries
// --------------------------------------------------------------------------
try {
  const cols = db.prepare(`PRAGMA table_info(tb_session_summaries)`).all() as Array<{ name: string }>;
  const densityCols = [
    'nrc_anger_density', 'nrc_fear_density', 'nrc_joy_density',
    'nrc_sadness_density', 'nrc_trust_density', 'nrc_anticipation_density',
    'cognitive_density', 'hedging_density', 'first_person_density',
  ];
  for (const col of densityCols) {
    if (!cols.some(c => c.name === col)) {
      db.exec(`ALTER TABLE tb_session_summaries ADD COLUMN ${col} REAL`);
    }
  }
} catch {
  // safe to ignore
}

// MIGRATION: Add keystroke dynamics and session metadata columns
// --------------------------------------------------------------------------
try {
  const cols2 = db.prepare(`PRAGMA table_info(tb_session_summaries)`).all() as Array<{ name: string }>;
  const keystrokeCols: Array<[string, string]> = [
    ['inter_key_interval_mean', 'REAL'],
    ['inter_key_interval_std', 'REAL'],
    ['revision_chain_count', 'INTEGER'],
    ['revision_chain_avg_length', 'REAL'],
    ['scroll_back_count', 'INTEGER'],
    ['question_reread_count', 'INTEGER'],
  ];
  for (const [col, type] of keystrokeCols) {
    if (!cols2.some(c => c.name === col)) {
      db.exec(`ALTER TABLE tb_session_summaries ADD COLUMN ${col} ${type}`);
    }
  }
} catch {
  // safe to ignore
}

// --------------------------------------------------------------------------
// MIGRATION: Add hold time, flight time, entropy, MATTR, sentence metrics
// --------------------------------------------------------------------------
try {
  const cols3 = db.prepare(`PRAGMA table_info(tb_session_summaries)`).all() as Array<{ name: string }>;
  const newCols: Array<[string, string]> = [
    ['hold_time_mean', 'REAL'],
    ['hold_time_std', 'REAL'],
    ['flight_time_mean', 'REAL'],
    ['flight_time_std', 'REAL'],
    ['keystroke_entropy', 'REAL'],
    ['mattr', 'REAL'],
    ['avg_sentence_length', 'REAL'],
    ['sentence_length_variance', 'REAL'],
  ];
  for (const [col, type] of newCols) {
    if (!cols3.some(c => c.name === col)) {
      db.exec(`ALTER TABLE tb_session_summaries ADD COLUMN ${col} ${type}`);
    }
  }
} catch {
  // safe to ignore
}

// --------------------------------------------------------------------------
// MIGRATION: Add deletion_events_json for slice-3 deletion-density curve
// --------------------------------------------------------------------------
try {
  const cols4 = db.prepare(`PRAGMA table_info(tb_session_summaries)`).all() as Array<{ name: string }>;
  if (!cols4.some(c => c.name === 'deletion_events_json')) {
    db.exec(`ALTER TABLE tb_session_summaries ADD COLUMN deletion_events_json TEXT`);
  }
} catch {
  // safe to ignore
}

// --------------------------------------------------------------------------
// MIGRATION: Add hold time + flight time delta columns to tb_session_delta
// --------------------------------------------------------------------------
try {
  const deltaCols = db.prepare(`PRAGMA table_info(tb_session_delta)`).all() as Array<{ name: string }>;
  const newDeltaCols: Array<[string, string]> = [
    ['delta_hold_time_mean', 'REAL'],
    ['delta_flight_time_mean', 'REAL'],
    ['calibration_hold_time_mean', 'REAL'],
    ['journal_hold_time_mean', 'REAL'],
    ['calibration_flight_time_mean', 'REAL'],
    ['journal_flight_time_mean', 'REAL'],
  ];
  for (const [col, type] of newDeltaCols) {
    if (!deltaCols.some(c => c.name === col)) {
      db.exec(`ALTER TABLE tb_session_delta ADD COLUMN ${col} ${type}`);
    }
  }
} catch {
  // safe to ignore
}

// ----------------------------------------------------------------------------
// QUERIES
// ----------------------------------------------------------------------------

export function getTodaysQuestion(): { question_id: number; text: string } | null {
  const today = localDateStr();
  return db.prepare(
    `SELECT question_id, text FROM tb_questions WHERE scheduled_for = ?`
  ).get(today) as { question_id: number; text: string } | null;
}

export function getTodaysResponse(): { response_id: number; text: string } | null {
  const today = localDateStr();
  return db.prepare(`
    SELECT r.response_id, r.text
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.scheduled_for = ?
  `).get(today) as { response_id: number; text: string } | null;
}

export function saveResponse(questionId: number, text: string): number {
  const result = db.prepare(
    `INSERT INTO tb_responses (question_id, text, dttm_created_utc) VALUES (?, ?, ?)`
  ).run(questionId, text, nowStr());
  return Number(result.lastInsertRowid);
}

export function scheduleQuestion(text: string, date: string, source: 'seed' | 'generated' | 'calibration' = 'seed'): void {
  const sourceId = source === 'generated' ? 2 : source === 'calibration' ? 3 : 1;
  db.prepare(
    `INSERT OR IGNORE INTO tb_questions (text, question_source_id, scheduled_for) VALUES (?, ?, ?)`
  ).run(text, sourceId, date);
}

export function getAllResponses(): Array<{ question: string; response: string; date: string }> {
  return db.prepare(`
    SELECT q.text as question, r.text as response, q.scheduled_for as date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY q.scheduled_for ASC
  `).all() as Array<{ question: string; response: string; date: string }>;
}

export function getLatestReflection(): { text: string; dttm_created_utc: string } | null {
  return db.prepare(
    `SELECT text, dttm_created_utc FROM tb_reflections ORDER BY dttm_created_utc DESC LIMIT 1`
  ).get() as { text: string; dttm_created_utc: string } | null;
}

export function saveReflection(text: string, type: 'weekly' | 'monthly' = 'weekly', coverageThroughResponseId?: number): number {
  const typeId = type === 'monthly' ? 2 : 1;
  const result = db.prepare(
    `INSERT INTO tb_reflections (text, reflection_type_id, coverage_through_response_id, dttm_created_utc) VALUES (?, ?, ?, ?)`
  ).run(text, typeId, coverageThroughResponseId ?? null, nowStr());
  return Number(result.lastInsertRowid);
}

export function logInteractionEvent(questionId: number, eventType: string, metadata?: string): void {
  const typeRow = db.prepare(
    `SELECT interaction_event_type_id FROM te_interaction_event_type WHERE enum_code = ?`
  ).get(eventType) as { interaction_event_type_id: number } | null;
  if (!typeRow) return;
  db.prepare(
    `INSERT INTO tb_interaction_events (question_id, interaction_event_type_id, metadata) VALUES (?, ?, ?)`
  ).run(questionId, typeRow.interaction_event_type_id, metadata ?? null);
}

export function hasQuestionForDate(date: string): boolean {
  const row = db.prepare(
    `SELECT 1 FROM tb_questions WHERE scheduled_for = ?`
  ).get(date);
  return !!row;
}

export function countScheduledSeedQuestions(): number {
  return (db.prepare(
    `SELECT COUNT(*) AS c FROM tb_questions
     WHERE question_source_id = 1 AND scheduled_for IS NOT NULL`
  ).get() as { c: number }).c;
}

// ----------------------------------------------------------------------------
// SESSION SUMMARIES
// ----------------------------------------------------------------------------

export interface SessionSummaryInput {
  questionId: number;
  firstKeystrokeMs: number | null;
  totalDurationMs: number | null;
  totalCharsTyped: number;
  finalCharCount: number;
  commitmentRatio: number | null;
  pauseCount: number;
  totalPauseMs: number;
  deletionCount: number;
  largestDeletion: number;
  totalCharsDeleted: number;
  tabAwayCount: number;
  totalTabAwayMs: number;
  wordCount: number;
  sentenceCount: number;
  // Enriched: deletion decomposition
  smallDeletionCount: number | null;
  largeDeletionCount: number | null;
  largeDeletionChars: number | null;
  firstHalfDeletionChars: number | null;
  secondHalfDeletionChars: number | null;
  // Enriched: production fluency
  activeTypingMs: number | null;
  charsPerMinute: number | null;
  pBurstCount: number | null;
  avgPBurstLength: number | null;
  // Linguistic: NRC emotion densities + Pennebaker categories
  nrcAngerDensity: number | null;
  nrcFearDensity: number | null;
  nrcJoyDensity: number | null;
  nrcSadnessDensity: number | null;
  nrcTrustDensity: number | null;
  nrcAnticipationDensity: number | null;
  cognitiveDensity: number | null;
  hedgingDensity: number | null;
  firstPersonDensity: number | null;
  // Keystroke dynamics (Epp et al. 2011; Leijten & Van Waes 2013)
  interKeyIntervalMean: number | null;
  interKeyIntervalStd: number | null;
  revisionChainCount: number | null;
  revisionChainAvgLength: number | null;
  // Hold time + flight time decomposition (Kim et al. 2024)
  holdTimeMean: number | null;
  holdTimeStd: number | null;
  flightTimeMean: number | null;
  flightTimeStd: number | null;
  // Keystroke entropy (Ajilore et al. 2025, BiAffect)
  keystrokeEntropy: number | null;
  // Lexical diversity (McCarthy & Jarvis 2010)
  mattr: number | null;
  // Sentence metrics
  avgSentenceLength: number | null;
  sentenceLengthVariance: number | null;
  // Session metadata (Czerwinski et al. 2004)
  scrollBackCount: number | null;
  questionRereadCount: number | null;
  // Context
  deviceType: string | null;
  userAgent: string | null;
  hourOfDay: number | null;
  dayOfWeek: number | null;
}

export function saveSessionSummary(s: SessionSummaryInput): void {
  db.prepare(`
    INSERT OR IGNORE INTO tb_session_summaries (
       question_id, first_keystroke_ms, total_duration_ms,
       total_chars_typed, final_char_count, commitment_ratio,
       pause_count, total_pause_ms, deletion_count, largest_deletion,
       total_chars_deleted, tab_away_count, total_tab_away_ms,
       word_count, sentence_count,
       small_deletion_count, large_deletion_count, large_deletion_chars,
       first_half_deletion_chars, second_half_deletion_chars,
       active_typing_ms, chars_per_minute, p_burst_count, avg_p_burst_length,
       nrc_anger_density, nrc_fear_density, nrc_joy_density,
       nrc_sadness_density, nrc_trust_density, nrc_anticipation_density,
       cognitive_density, hedging_density, first_person_density,
       inter_key_interval_mean, inter_key_interval_std,
       revision_chain_count, revision_chain_avg_length,
       hold_time_mean, hold_time_std, flight_time_mean, flight_time_std,
       keystroke_entropy,
       mattr, avg_sentence_length, sentence_length_variance,
       scroll_back_count, question_reread_count,
       device_type, user_agent, hour_of_day, day_of_week
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    s.questionId, s.firstKeystrokeMs, s.totalDurationMs,
    s.totalCharsTyped, s.finalCharCount, s.commitmentRatio,
    s.pauseCount, s.totalPauseMs, s.deletionCount, s.largestDeletion,
    s.totalCharsDeleted, s.tabAwayCount, s.totalTabAwayMs,
    s.wordCount, s.sentenceCount,
    s.smallDeletionCount, s.largeDeletionCount, s.largeDeletionChars,
    s.firstHalfDeletionChars, s.secondHalfDeletionChars,
    s.activeTypingMs, s.charsPerMinute, s.pBurstCount, s.avgPBurstLength,
    s.nrcAngerDensity, s.nrcFearDensity, s.nrcJoyDensity,
    s.nrcSadnessDensity, s.nrcTrustDensity, s.nrcAnticipationDensity,
    s.cognitiveDensity, s.hedgingDensity, s.firstPersonDensity,
    s.interKeyIntervalMean, s.interKeyIntervalStd,
    s.revisionChainCount, s.revisionChainAvgLength,
    s.holdTimeMean, s.holdTimeStd, s.flightTimeMean, s.flightTimeStd,
    s.keystrokeEntropy,
    s.mattr, s.avgSentenceLength, s.sentenceLengthVariance,
    s.scrollBackCount, s.questionRereadCount,
    s.deviceType, s.userAgent, s.hourOfDay, s.dayOfWeek
  );
}

// ----------------------------------------------------------------------------
// BURST SEQUENCES
// ----------------------------------------------------------------------------

export interface BurstEntry {
  chars: number;
  startOffsetMs: number;
  durationMs: number;
}

export function saveBurstSequence(questionId: number, bursts: BurstEntry[]): void {
  const stmt = db.prepare(`
    INSERT INTO tb_burst_sequences (question_id, burst_index, burst_char_count, burst_duration_ms, burst_start_offset_ms)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((entries: BurstEntry[]) => {
    for (let i = 0; i < entries.length; i++) {
      stmt.run(questionId, i, entries[i].chars, entries[i].durationMs, entries[i].startOffsetMs);
    }
  });
  insertAll(bursts);
}

export function getBurstSequence(questionId: number): Array<BurstEntry & { burstIndex: number }> {
  return db.prepare(`
    SELECT burst_index as burstIndex, burst_char_count as chars,
           burst_duration_ms as durationMs, burst_start_offset_ms as startOffsetMs
    FROM tb_burst_sequences
    WHERE question_id = ?
    ORDER BY burst_index ASC
  `).all(questionId) as Array<BurstEntry & { burstIndex: number }>;
}

// ----------------------------------------------------------------------------
// SESSION METADATA (slice-3 follow-up signals)
// ----------------------------------------------------------------------------

export interface SessionMetadataRow {
  session_metadata_id: number;
  question_id: number;
  hour_typicality: number | null;
  deletion_curve_type: string | null;
  burst_trajectory_shape: string | null;
  inter_burst_interval_mean_ms: number | null;
  inter_burst_interval_std_ms: number | null;
  deletion_during_burst_count: number | null;
  deletion_between_burst_count: number | null;
}

export function saveSessionMetadata(row: Omit<SessionMetadataRow, 'session_metadata_id'>): number {
  const result = db.prepare(`
    INSERT INTO tb_session_metadata (
       question_id, hour_typicality, deletion_curve_type, burst_trajectory_shape,
       inter_burst_interval_mean_ms, inter_burst_interval_std_ms,
       deletion_during_burst_count, deletion_between_burst_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.question_id, row.hour_typicality, row.deletion_curve_type, row.burst_trajectory_shape,
    row.inter_burst_interval_mean_ms, row.inter_burst_interval_std_ms,
    row.deletion_during_burst_count, row.deletion_between_burst_count,
  );
  return Number(result.lastInsertRowid);
}

export function getSessionMetadata(questionId: number): SessionMetadataRow | null {
  return db.prepare(
    `SELECT * FROM tb_session_metadata WHERE question_id = ? ORDER BY session_metadata_id DESC LIMIT 1`
  ).get(questionId) as SessionMetadataRow | null;
}

export function getAllSessionMetadata(): SessionMetadataRow[] {
  return db.prepare(
    `SELECT * FROM tb_session_metadata ORDER BY session_metadata_id ASC`
  ).all() as SessionMetadataRow[];
}

export function getMetadataQuestionIdsAlreadyComputed(): Set<number> {
  const rows = db.prepare(`SELECT DISTINCT question_id FROM tb_session_metadata`).all() as Array<{ question_id: number }>;
  return new Set(rows.map(r => r.question_id));
}

// ----------------------------------------------------------------------------
// CALIBRATION BASELINES HISTORY (drift substrate)
// ----------------------------------------------------------------------------

export interface CalibrationHistoryRow {
  calibration_history_id: number;
  calibration_session_count: number;
  device_type: string | null;
  avg_first_keystroke_ms: number | null;
  avg_commitment_ratio: number | null;
  avg_duration_ms: number | null;
  avg_pause_count: number | null;
  avg_deletion_count: number | null;
  avg_chars_per_minute: number | null;
  avg_p_burst_length: number | null;
  avg_small_deletion_count: number | null;
  avg_large_deletion_count: number | null;
  avg_iki_mean: number | null;
  avg_hold_time_mean: number | null;
  avg_flight_time_mean: number | null;
  drift_magnitude: number | null;
}

export function saveCalibrationBaselineSnapshot(row: Omit<CalibrationHistoryRow, 'calibration_history_id'>): number {
  const result = db.prepare(`
    INSERT INTO tb_calibration_baselines_history (
       calibration_session_count, device_type,
       avg_first_keystroke_ms, avg_commitment_ratio, avg_duration_ms,
       avg_pause_count, avg_deletion_count, avg_chars_per_minute,
       avg_p_burst_length, avg_small_deletion_count, avg_large_deletion_count,
       avg_iki_mean, avg_hold_time_mean, avg_flight_time_mean,
       drift_magnitude
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.calibration_session_count, row.device_type,
    row.avg_first_keystroke_ms, row.avg_commitment_ratio, row.avg_duration_ms,
    row.avg_pause_count, row.avg_deletion_count, row.avg_chars_per_minute,
    row.avg_p_burst_length, row.avg_small_deletion_count, row.avg_large_deletion_count,
    row.avg_iki_mean, row.avg_hold_time_mean, row.avg_flight_time_mean,
    row.drift_magnitude,
  );
  return Number(result.lastInsertRowid);
}

export function getCalibrationHistory(): CalibrationHistoryRow[] {
  return db.prepare(
    `SELECT * FROM tb_calibration_baselines_history ORDER BY calibration_history_id ASC`
  ).all() as CalibrationHistoryRow[];
}

export function getLatestCalibrationSnapshot(deviceType?: string | null): CalibrationHistoryRow | null {
  if (deviceType) {
    return db.prepare(
      `SELECT * FROM tb_calibration_baselines_history WHERE device_type = ?
       ORDER BY calibration_history_id DESC LIMIT 1`
    ).get(deviceType) as CalibrationHistoryRow | null;
  }
  return db.prepare(
    `SELECT * FROM tb_calibration_baselines_history WHERE device_type IS NULL
     ORDER BY calibration_history_id DESC LIMIT 1`
  ).get() as CalibrationHistoryRow | null;
}

// ----------------------------------------------------------------------------
// SESSION EVENTS (per-keystroke event log for playback)
// ----------------------------------------------------------------------------

export interface SessionEventsRow {
  session_event_id: number;
  question_id: number;
  event_log_json: string;
  total_events: number;
  session_duration_ms: number;
}

export function saveSessionEvents(row: Omit<SessionEventsRow, 'session_event_id'>): number {
  const result = db.prepare(`
    INSERT INTO tb_session_events (question_id, event_log_json, total_events, session_duration_ms)
    VALUES (?, ?, ?, ?)
  `).run(row.question_id, row.event_log_json, row.total_events, row.session_duration_ms);
  return Number(result.lastInsertRowid);
}

export function getSessionEvents(questionId: number): SessionEventsRow | null {
  return db.prepare(
    `SELECT * FROM tb_session_events WHERE question_id = ? ORDER BY session_event_id DESC LIMIT 1`
  ).get(questionId) as SessionEventsRow | null;
}

// Save deletion events JSON onto the session summary row
export function updateDeletionEvents(questionId: number, deletionEventsJson: string): void {
  db.prepare(
    `UPDATE tb_session_summaries SET deletion_events_json = ? WHERE question_id = ?`
  ).run(deletionEventsJson, questionId);
}

const SESSION_SUMMARY_COLS = `
  s.question_id as questionId, first_keystroke_ms as firstKeystrokeMs,
  total_duration_ms as totalDurationMs, total_chars_typed as totalCharsTyped,
  final_char_count as finalCharCount, commitment_ratio as commitmentRatio,
  pause_count as pauseCount, total_pause_ms as totalPauseMs,
  deletion_count as deletionCount, largest_deletion as largestDeletion,
  total_chars_deleted as totalCharsDeleted, tab_away_count as tabAwayCount,
  total_tab_away_ms as totalTabAwayMs, word_count as wordCount,
  sentence_count as sentenceCount,
  small_deletion_count as smallDeletionCount, large_deletion_count as largeDeletionCount,
  large_deletion_chars as largeDeletionChars,
  first_half_deletion_chars as firstHalfDeletionChars,
  second_half_deletion_chars as secondHalfDeletionChars,
  active_typing_ms as activeTypingMs, chars_per_minute as charsPerMinute,
  p_burst_count as pBurstCount, avg_p_burst_length as avgPBurstLength,
  nrc_anger_density as nrcAngerDensity, nrc_fear_density as nrcFearDensity,
  nrc_joy_density as nrcJoyDensity, nrc_sadness_density as nrcSadnessDensity,
  nrc_trust_density as nrcTrustDensity, nrc_anticipation_density as nrcAnticipationDensity,
  cognitive_density as cognitiveDensity, hedging_density as hedgingDensity,
  first_person_density as firstPersonDensity,
  inter_key_interval_mean as interKeyIntervalMean,
  inter_key_interval_std as interKeyIntervalStd,
  revision_chain_count as revisionChainCount,
  revision_chain_avg_length as revisionChainAvgLength,
  hold_time_mean as holdTimeMean, hold_time_std as holdTimeStd,
  flight_time_mean as flightTimeMean, flight_time_std as flightTimeStd,
  keystroke_entropy as keystrokeEntropy,
  mattr, avg_sentence_length as avgSentenceLength,
  sentence_length_variance as sentenceLengthVariance,
  scroll_back_count as scrollBackCount,
  question_reread_count as questionRereadCount,
  device_type as deviceType, user_agent as userAgent,
  hour_of_day as hourOfDay, day_of_week as dayOfWeek
`;

export function getSessionSummary(questionId: number): SessionSummaryInput | null {
  return db.prepare(
    `SELECT ${SESSION_SUMMARY_COLS} FROM tb_session_summaries s WHERE s.question_id = ?`
  ).get(questionId) as SessionSummaryInput | null;
}

export function getAllSessionSummaries(): Array<SessionSummaryInput & { date: string }> {
  return db.prepare(`
    SELECT s.question_id as questionId, q.scheduled_for as date,
           s.first_keystroke_ms as firstKeystrokeMs,
           s.total_duration_ms as totalDurationMs, s.total_chars_typed as totalCharsTyped,
           s.final_char_count as finalCharCount, s.commitment_ratio as commitmentRatio,
           s.pause_count as pauseCount, s.total_pause_ms as totalPauseMs,
           s.deletion_count as deletionCount, s.largest_deletion as largestDeletion,
           s.total_chars_deleted as totalCharsDeleted, s.tab_away_count as tabAwayCount,
           s.total_tab_away_ms as totalTabAwayMs, s.word_count as wordCount,
           s.sentence_count as sentenceCount,
           s.small_deletion_count as smallDeletionCount,
           s.large_deletion_count as largeDeletionCount,
           s.large_deletion_chars as largeDeletionChars,
           s.first_half_deletion_chars as firstHalfDeletionChars,
           s.second_half_deletion_chars as secondHalfDeletionChars,
           s.active_typing_ms as activeTypingMs, s.chars_per_minute as charsPerMinute,
           s.p_burst_count as pBurstCount, s.avg_p_burst_length as avgPBurstLength,
           s.nrc_anger_density as nrcAngerDensity, s.nrc_fear_density as nrcFearDensity,
           s.nrc_joy_density as nrcJoyDensity, s.nrc_sadness_density as nrcSadnessDensity,
           s.nrc_trust_density as nrcTrustDensity, s.nrc_anticipation_density as nrcAnticipationDensity,
           s.cognitive_density as cognitiveDensity, s.hedging_density as hedgingDensity,
           s.first_person_density as firstPersonDensity,
           s.inter_key_interval_mean as interKeyIntervalMean,
           s.inter_key_interval_std as interKeyIntervalStd,
           s.revision_chain_count as revisionChainCount,
           s.revision_chain_avg_length as revisionChainAvgLength,
           s.hold_time_mean as holdTimeMean, s.hold_time_std as holdTimeStd,
           s.flight_time_mean as flightTimeMean, s.flight_time_std as flightTimeStd,
           s.keystroke_entropy as keystrokeEntropy,
           s.mattr, s.avg_sentence_length as avgSentenceLength,
           s.sentence_length_variance as sentenceLengthVariance,
           s.scroll_back_count as scrollBackCount,
           s.question_reread_count as questionRereadCount,
           s.device_type as deviceType,
           s.user_agent as userAgent, s.hour_of_day as hourOfDay, s.day_of_week as dayOfWeek
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    ORDER BY q.scheduled_for ASC
  `).all() as Array<SessionSummaryInput & { date: string }>;
}

export interface CalibrationBaseline {
  avgFirstKeystrokeMs: number | null;
  avgCommitmentRatio: number | null;
  avgDurationMs: number | null;
  avgPauseCount: number | null;
  avgDeletionCount: number | null;
  // Enriched (V3): null if all calibration sessions predate enrichment
  avgSmallDeletionCount: number | null;
  avgLargeDeletionCount: number | null;
  avgLargeDeletionChars: number | null;
  avgCharsPerMinute: number | null;
  avgPBurstCount: number | null;
  avgPBurstLength: number | null;
  sessionCount: number;
  confidence: 'none' | 'low' | 'moderate' | 'strong';
}

export function getCalibrationBaselines(deviceType?: string | null, hourOfDay?: number | null): CalibrationBaseline {
  // Try context-matched first, then fall back to global
  const conditions: string[] = ['q.question_source_id = 3'];
  const params: (string | number)[] = [];

  if (deviceType) {
    conditions.push('s.device_type = ?');
    params.push(deviceType);
  }
  if (hourOfDay != null) {
    // Match within a 4-hour window (e.g., 9pm-1am for a 11pm session)
    conditions.push('ABS(s.hour_of_day - ?) <= 2 OR ABS(s.hour_of_day - ?) >= 22');
    params.push(hourOfDay, hourOfDay);
  }

  const contextRow = db.prepare(`
    SELECT
       AVG(s.first_keystroke_ms) as avgFirstKeystrokeMs
      ,AVG(s.commitment_ratio) as avgCommitmentRatio
      ,AVG(s.total_duration_ms) as avgDurationMs
      ,AVG(s.pause_count) as avgPauseCount
      ,AVG(s.deletion_count) as avgDeletionCount
      ,AVG(s.small_deletion_count) as avgSmallDeletionCount
      ,AVG(s.large_deletion_count) as avgLargeDeletionCount
      ,AVG(s.large_deletion_chars) as avgLargeDeletionChars
      ,AVG(s.chars_per_minute) as avgCharsPerMinute
      ,AVG(s.p_burst_count) as avgPBurstCount
      ,AVG(s.avg_p_burst_length) as avgPBurstLength
      ,COUNT(*) as sessionCount
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE ${conditions.join(' AND ')}
  `).get(...params) as Omit<CalibrationBaseline, 'confidence'>;

  // Fall back to global if context-matched has too few
  let row = contextRow;
  if (contextRow.sessionCount < 3 && (deviceType || hourOfDay != null)) {
    row = db.prepare(`
      SELECT
         AVG(s.first_keystroke_ms) as avgFirstKeystrokeMs
        ,AVG(s.commitment_ratio) as avgCommitmentRatio
        ,AVG(s.total_duration_ms) as avgDurationMs
        ,AVG(s.pause_count) as avgPauseCount
        ,AVG(s.deletion_count) as avgDeletionCount
        ,AVG(s.small_deletion_count) as avgSmallDeletionCount
        ,AVG(s.large_deletion_count) as avgLargeDeletionCount
        ,AVG(s.large_deletion_chars) as avgLargeDeletionChars
        ,AVG(s.chars_per_minute) as avgCharsPerMinute
        ,AVG(s.p_burst_count) as avgPBurstCount
        ,AVG(s.avg_p_burst_length) as avgPBurstLength
        ,COUNT(*) as sessionCount
      FROM tb_session_summaries s
      JOIN tb_questions q ON s.question_id = q.question_id
      WHERE q.question_source_id = 3
    `).get() as typeof contextRow;
  }

  const count = row.sessionCount;
  const confidence: CalibrationBaseline['confidence'] =
    count === 0 ? 'none' :
    count < 3 ? 'low' :
    count < 8 ? 'moderate' : 'strong';

  return { ...row, confidence };
}

export function getCalibrationSessionsWithText(): Array<SessionSummaryInput & { date: string; responseText: string }> {
  return db.prepare(`
    SELECT s.question_id as questionId, q.scheduled_for as date,
           r.text as responseText,
           s.first_keystroke_ms as firstKeystrokeMs,
           s.total_duration_ms as totalDurationMs, s.total_chars_typed as totalCharsTyped,
           s.final_char_count as finalCharCount, s.commitment_ratio as commitmentRatio,
           s.pause_count as pauseCount, s.total_pause_ms as totalPauseMs,
           s.deletion_count as deletionCount, s.largest_deletion as largestDeletion,
           s.total_chars_deleted as totalCharsDeleted, s.tab_away_count as tabAwayCount,
           s.total_tab_away_ms as totalTabAwayMs, s.word_count as wordCount,
           s.sentence_count as sentenceCount,
           s.small_deletion_count as smallDeletionCount,
           s.large_deletion_count as largeDeletionCount,
           s.large_deletion_chars as largeDeletionChars,
           s.first_half_deletion_chars as firstHalfDeletionChars,
           s.second_half_deletion_chars as secondHalfDeletionChars,
           s.active_typing_ms as activeTypingMs, s.chars_per_minute as charsPerMinute,
           s.p_burst_count as pBurstCount, s.avg_p_burst_length as avgPBurstLength,
           s.nrc_anger_density as nrcAngerDensity, s.nrc_fear_density as nrcFearDensity,
           s.nrc_joy_density as nrcJoyDensity, s.nrc_sadness_density as nrcSadnessDensity,
           s.nrc_trust_density as nrcTrustDensity, s.nrc_anticipation_density as nrcAnticipationDensity,
           s.cognitive_density as cognitiveDensity, s.hedging_density as hedgingDensity,
           s.first_person_density as firstPersonDensity,
           s.inter_key_interval_mean as interKeyIntervalMean,
           s.inter_key_interval_std as interKeyIntervalStd,
           s.revision_chain_count as revisionChainCount,
           s.revision_chain_avg_length as revisionChainAvgLength,
           s.hold_time_mean as holdTimeMean, s.hold_time_std as holdTimeStd,
           s.flight_time_mean as flightTimeMean, s.flight_time_std as flightTimeStd,
           s.keystroke_entropy as keystrokeEntropy,
           s.mattr, s.avg_sentence_length as avgSentenceLength,
           s.sentence_length_variance as sentenceLengthVariance,
           s.scroll_back_count as scrollBackCount,
           s.question_reread_count as questionRereadCount,
           s.device_type as deviceType,
           s.user_agent as userAgent, s.hour_of_day as hourOfDay, s.day_of_week as dayOfWeek
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    JOIN tb_responses r ON q.question_id = r.question_id
    WHERE q.question_source_id = 3
      AND s.word_count >= 10
    ORDER BY q.question_id ASC
  `).all() as Array<SessionSummaryInput & { date: string; responseText: string }>;
}

export function isCalibrationQuestion(questionId: number): boolean {
  const row = db.prepare(
    `SELECT 1 FROM tb_questions WHERE question_id = ? AND question_source_id = 3`
  ).get(questionId);
  return !!row;
}

// ----------------------------------------------------------------------------
// AI OBSERVATIONS & SUPPRESSED QUESTIONS — ARCHIVED 2026-04-16
// Functions retained as no-op stubs so imports don't break during slice-2
// deletions. Called surfaces are being removed piecewise.
// ----------------------------------------------------------------------------

export function saveAiObservation(_questionId: number, _text: string, _date: string): number {
  return 0;
}

export function saveSuppressedQuestion(_questionId: number, _text: string, _date: string): void {
  // archived
}

export function getAllAiObservations(): Array<{ date: string; observation: string }> {
  return [];
}

export function getAllSuppressedQuestions(): Array<{ date: string; question: string }> {
  return [];
}

export function getResponseCount(): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM tb_responses`).get() as { count: number };
  return row.count;
}

export function getUsedCalibrationPrompts(): string[] {
  return (db.prepare(
    `SELECT text FROM tb_questions WHERE question_source_id = 3`
  ).all() as Array<{ text: string }>).map(r => r.text);
}

export function saveCalibrationSession(
  promptText: string,
  responseText: string,
  summary: SessionSummaryInput
): number {
  const result = db.prepare(
    `INSERT INTO tb_questions (text, question_source_id) VALUES (?, 3)`
  ).run(promptText);
  const questionId = Number(result.lastInsertRowid);

  db.prepare(
    `INSERT INTO tb_responses (question_id, text) VALUES (?, ?)`
  ).run(questionId, responseText);

  saveSessionSummary({ ...summary, questionId });

  return questionId;
}

// ----------------------------------------------------------------------------
// QUESTION FEEDBACK
// ----------------------------------------------------------------------------

export function saveQuestionFeedback(questionId: number, landed: boolean): void {
  db.prepare(
    `INSERT OR IGNORE INTO tb_question_feedback (question_id, landed) VALUES (?, ?)`
  ).run(questionId, landed ? 1 : 0);
}

export function getAllQuestionFeedback(): Array<{ date: string; landed: boolean }> {
  return db.prepare(`
    SELECT q.scheduled_for as date, f.landed
    FROM tb_question_feedback f
    JOIN tb_questions q ON f.question_id = q.question_id
    ORDER BY q.scheduled_for ASC
  `).all().map((r: any) => ({ date: r.date, landed: !!r.landed }));
}

// ----------------------------------------------------------------------------
// SCOPED RETRIEVAL (for RAG-augmented prompts)
// ----------------------------------------------------------------------------

export function getRecentResponses(limit: number): Array<{
  response_id: number; question_id: number; question: string; response: string; date: string;
}> {
  return db.prepare(`
    SELECT r.response_id, q.question_id, q.text as question, r.text as response, q.scheduled_for as date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY q.scheduled_for DESC
    LIMIT ?
  `).all(limit) as Array<{
    response_id: number; question_id: number; question: string; response: string; date: string;
  }>;
}

export function getResponsesSince(sinceDate: string): Array<{
  response_id: number; question_id: number; question: string; response: string; date: string;
}> {
  return db.prepare(`
    SELECT r.response_id, q.question_id, q.text as question, r.text as response, q.scheduled_for as date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.scheduled_for > ?
    ORDER BY q.scheduled_for ASC
  `).all(sinceDate) as Array<{
    response_id: number; question_id: number; question: string; response: string; date: string;
  }>;
}

export function getResponsesSinceId(sinceResponseId: number): Array<{
  response_id: number; question_id: number; question: string; response: string; date: string;
}> {
  return db.prepare(`
    SELECT r.response_id, q.question_id, q.text as question, r.text as response, q.scheduled_for as date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE r.response_id > ?
    ORDER BY q.scheduled_for ASC
  `).all(sinceResponseId) as Array<{
    response_id: number; question_id: number; question: string; response: string; date: string;
  }>;
}

export function getRecentObservations(_limit: number): Array<{
  ai_observation_id: number; date: string; observation: string;
}> {
  return []; // archived 2026-04-16
}

export function getObservationsSinceDate(_sinceDate: string): Array<{
  ai_observation_id: number; date: string; observation: string;
}> {
  return []; // archived 2026-04-16
}

export function getRecentSuppressedQuestions(_limit: number): Array<{ date: string; question: string }> {
  return []; // archived 2026-04-16
}

export function getAllReflections(): Array<{
  reflection_id: number; text: string; coverage_through_response_id: number | null;
  dttm_created_utc: string;
}> {
  return db.prepare(`
    SELECT reflection_id, text, coverage_through_response_id, dttm_created_utc
    FROM tb_reflections
    ORDER BY dttm_created_utc ASC
  `).all() as Array<{
    reflection_id: number; text: string; coverage_through_response_id: number | null;
    dttm_created_utc: string;
  }>;
}

export function getLatestReflectionWithCoverage(): {
  reflection_id: number; text: string;
  coverage_through_response_id: number | null;
  dttm_created_utc: string;
} | null {
  return db.prepare(`
    SELECT reflection_id, text, coverage_through_response_id, dttm_created_utc
    FROM tb_reflections
    ORDER BY dttm_created_utc DESC
    LIMIT 1
  `).get() as {
    reflection_id: number; text: string;
    coverage_through_response_id: number | null;
    dttm_created_utc: string;
  } | null;
}

export function getRecentFeedback(limit: number): Array<{ date: string; landed: boolean }> {
  return db.prepare(`
    SELECT q.scheduled_for as date, f.landed
    FROM tb_question_feedback f
    JOIN tb_questions q ON f.question_id = q.question_id
    ORDER BY q.scheduled_for DESC
    LIMIT ?
  `).all(limit).map((r: any) => ({ date: r.date, landed: !!r.landed }));
}

export function getSessionSummariesForQuestions(questionIds: number[]): Array<SessionSummaryInput & { date: string }> {
  if (questionIds.length === 0) return [];
  const placeholders = questionIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT s.question_id as questionId, q.scheduled_for as date,
           s.first_keystroke_ms as firstKeystrokeMs,
           s.total_duration_ms as totalDurationMs, s.total_chars_typed as totalCharsTyped,
           s.final_char_count as finalCharCount, s.commitment_ratio as commitmentRatio,
           s.pause_count as pauseCount, s.total_pause_ms as totalPauseMs,
           s.deletion_count as deletionCount, s.largest_deletion as largestDeletion,
           s.total_chars_deleted as totalCharsDeleted, s.tab_away_count as tabAwayCount,
           s.total_tab_away_ms as totalTabAwayMs, s.word_count as wordCount,
           s.sentence_count as sentenceCount,
           s.small_deletion_count as smallDeletionCount,
           s.large_deletion_count as largeDeletionCount,
           s.large_deletion_chars as largeDeletionChars,
           s.first_half_deletion_chars as firstHalfDeletionChars,
           s.second_half_deletion_chars as secondHalfDeletionChars,
           s.active_typing_ms as activeTypingMs, s.chars_per_minute as charsPerMinute,
           s.p_burst_count as pBurstCount, s.avg_p_burst_length as avgPBurstLength,
           s.nrc_anger_density as nrcAngerDensity, s.nrc_fear_density as nrcFearDensity,
           s.nrc_joy_density as nrcJoyDensity, s.nrc_sadness_density as nrcSadnessDensity,
           s.nrc_trust_density as nrcTrustDensity, s.nrc_anticipation_density as nrcAnticipationDensity,
           s.cognitive_density as cognitiveDensity, s.hedging_density as hedgingDensity,
           s.first_person_density as firstPersonDensity,
           s.inter_key_interval_mean as interKeyIntervalMean,
           s.inter_key_interval_std as interKeyIntervalStd,
           s.revision_chain_count as revisionChainCount,
           s.revision_chain_avg_length as revisionChainAvgLength,
           s.hold_time_mean as holdTimeMean, s.hold_time_std as holdTimeStd,
           s.flight_time_mean as flightTimeMean, s.flight_time_std as flightTimeStd,
           s.keystroke_entropy as keystrokeEntropy,
           s.mattr, s.avg_sentence_length as avgSentenceLength,
           s.sentence_length_variance as sentenceLengthVariance,
           s.scroll_back_count as scrollBackCount,
           s.question_reread_count as questionRereadCount,
           s.device_type as deviceType,
           s.user_agent as userAgent, s.hour_of_day as hourOfDay, s.day_of_week as dayOfWeek
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE s.question_id IN (${placeholders})
    ORDER BY q.scheduled_for ASC
  `).all(...questionIds) as Array<SessionSummaryInput & { date: string }>;
}

export function getMaxResponseId(): number {
  const row = db.prepare(`SELECT MAX(response_id) as max_id FROM tb_responses`).get() as { max_id: number | null };
  return row.max_id ?? 0;
}

// ----------------------------------------------------------------------------
// EMBEDDING METADATA QUERIES
// ----------------------------------------------------------------------------

export function insertEmbeddingMeta(
  embeddingSourceId: number,
  sourceRecordId: number,
  embeddedText: string,
  sourceDate: string | null,
  modelName: string = 'voyage-3-lite'
): number {
  const result = db.prepare(`
    INSERT OR IGNORE INTO tb_embeddings (embedding_source_id, source_record_id, embedded_text, source_date, model_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(embeddingSourceId, sourceRecordId, embeddedText, sourceDate, modelName);
  return Number(result.lastInsertRowid);
}

export function insertVecEmbedding(embeddingId: number, vector: Buffer): void {
  // sqlite-vec requires BigInt for primary key values
  db.prepare(`INSERT INTO vec_embeddings (embedding_id, embedding) VALUES (?, ?)`).run(BigInt(embeddingId), vector);
}

export function isRecordEmbedded(embeddingSourceId: number, sourceRecordId: number): boolean {
  const row = db.prepare(
    `SELECT 1 FROM tb_embeddings WHERE embedding_source_id = ? AND source_record_id = ?`
  ).get(embeddingSourceId, sourceRecordId);
  return !!row;
}

export function getUnembeddedResponses(): Array<{
  response_id: number; question: string; response: string; date: string;
}> {
  return db.prepare(`
    SELECT r.response_id, q.text as question, r.text as response, q.scheduled_for as date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE NOT EXISTS (
      SELECT 1 FROM tb_embeddings e
      WHERE e.embedding_source_id = 1 AND e.source_record_id = r.response_id
    )
    ORDER BY q.scheduled_for ASC
  `).all() as Array<{
    response_id: number; question: string; response: string; date: string;
  }>;
}

export function getUnembeddedObservations(): Array<{
  ai_observation_id: number; observation: string; date: string;
}> {
  return []; // archived 2026-04-16
}

export function getUnembeddedReflections(): Array<{
  reflection_id: number; text: string; dttm_created_utc: string;
}> {
  return db.prepare(`
    SELECT r.reflection_id, r.text, r.dttm_created_utc
    FROM tb_reflections r
    WHERE NOT EXISTS (
      SELECT 1 FROM tb_embeddings e
      WHERE e.embedding_source_id = 3 AND e.source_record_id = r.reflection_id
    )
    ORDER BY r.dttm_created_utc ASC
  `).all() as Array<{
    reflection_id: number; text: string; dttm_created_utc: string;
  }>;
}

export function searchVecEmbeddings(queryVector: Buffer, k: number): Array<{
  embedding_id: number; distance: number; embedding_source_id: number;
  source_record_id: number; embedded_text: string; source_date: string | null;
}> {
  try {
    return db.prepare(`
      SELECT e.embedding_id, e.embedding_source_id, e.source_record_id,
             e.embedded_text, e.source_date, v.distance
      FROM vec_embeddings v
      JOIN tb_embeddings e ON v.embedding_id = e.embedding_id
      WHERE v.embedding MATCH ?
        AND k = ?
      ORDER BY v.distance
    `).all(queryVector, k) as Array<{
      embedding_id: number; distance: number; embedding_source_id: number;
      source_record_id: number; embedded_text: string; source_date: string | null;
    }>;
  } catch (err) {
    console.error('[searchVecEmbeddings] Vector search failed, returning empty:', (err as Error).message);
    return [];
  }
}

// ----------------------------------------------------------------------------
// PROMPT TRACES
// ----------------------------------------------------------------------------

export interface PromptTraceInput {
  type: 'generation' | 'observation' | 'reflection';
  outputRecordId?: number;
  recentEntryIds?: number[];
  ragEntryIds?: number[];
  contrarianEntryIds?: number[];
  reflectionIds?: number[];
  observationIds?: number[];
  modelName?: string;
  tokenEstimate?: number;
}

export function savePromptTrace(trace: PromptTraceInput): void {
  const typeId = trace.type === 'generation' ? 1 : trace.type === 'observation' ? 2 : 3;
  db.prepare(`
    INSERT INTO tb_prompt_traces (
       prompt_trace_type_id, output_record_id,
       recent_entry_ids, rag_entry_ids, contrarian_entry_ids,
       reflection_ids, observation_ids,
       model_name, token_estimate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    typeId,
    trace.outputRecordId ?? null,
    trace.recentEntryIds ? JSON.stringify(trace.recentEntryIds) : null,
    trace.ragEntryIds ? JSON.stringify(trace.ragEntryIds) : null,
    trace.contrarianEntryIds ? JSON.stringify(trace.contrarianEntryIds) : null,
    trace.reflectionIds ? JSON.stringify(trace.reflectionIds) : null,
    trace.observationIds ? JSON.stringify(trace.observationIds) : null,
    trace.modelName ?? 'claude-opus-4-6',
    trace.tokenEstimate ?? null,
  );
}

// ----------------------------------------------------------------------------
// WITNESS STATE
// ----------------------------------------------------------------------------

export function saveWitnessState(entryCount: number, traitsJson: string, signalsJson: string, modelName = 'claude-sonnet-4-20250514'): number {
  const result = db.prepare(`
    INSERT INTO tb_witness_states (entry_count, traits_json, signals_json, model_name)
    VALUES (?, ?, ?, ?)
  `).run(entryCount, traitsJson, signalsJson, modelName);
  return Number(result.lastInsertRowid);
}

export function getLatestWitnessState(): { witness_state_id: number; entry_count: number; traits_json: string; signals_json: string } | null {
  return db.prepare(`
    SELECT witness_state_id, entry_count, traits_json, signals_json
    FROM tb_witness_states
    ORDER BY witness_state_id DESC LIMIT 1
  `).get() as { witness_state_id: number; entry_count: number; traits_json: string; signals_json: string } | null;
}

// ----------------------------------------------------------------------------
// ENTRY STATES (7D deterministic behavioral state vectors)
// ----------------------------------------------------------------------------

export interface EntryStateRow {
  entry_state_id: number;
  response_id: number;
  fluency: number;
  deliberation: number;
  revision: number;
  commitment: number;
  volatility: number;
  thermal: number;
  presence: number;
  convergence: number;
}

export function saveEntryState(state: Omit<EntryStateRow, 'entry_state_id'>): number {
  const result = db.prepare(`
    INSERT INTO tb_entry_states (
       response_id, fluency, deliberation, revision,
       commitment, volatility, thermal, presence, convergence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    state.response_id, state.fluency, state.deliberation,
    state.revision, state.commitment,
    state.volatility, state.thermal, state.presence, state.convergence,
  );
  return Number(result.lastInsertRowid);
}

export function getAllEntryStates(): EntryStateRow[] {
  return db.prepare(`
    SELECT * FROM tb_entry_states ORDER BY entry_state_id ASC
  `).all() as EntryStateRow[];
}

export function getEntryStateCount(): number {
  return (db.prepare(
    `SELECT COUNT(*) as c FROM tb_entry_states`
  ).get() as { c: number }).c;
}

// ----------------------------------------------------------------------------
// SEMANTIC STATES (parallel space; deterministic densities + LLM placeholders)
// ----------------------------------------------------------------------------

export interface SemanticStateRow {
  semantic_state_id: number;
  response_id: number;
  // Deterministic dimensions (always populated)
  syntactic_complexity: number;
  interrogation: number;
  self_focus: number;
  uncertainty: number;
  cognitive_processing: number;
  nrc_anger: number;
  nrc_fear: number;
  nrc_joy: number;
  nrc_sadness: number;
  nrc_trust: number;
  nrc_anticipation: number;
  // LLM-extracted (schema-ready, null until extraction lands)
  sentiment: number | null;
  abstraction: number | null;
  agency_framing: number | null;
  temporal_orientation: number | null;
  convergence: number;
}

export function saveSemanticState(state: Omit<SemanticStateRow, 'semantic_state_id'>): number {
  const result = db.prepare(`
    INSERT INTO tb_semantic_states (
       response_id,
       syntactic_complexity, interrogation, self_focus, uncertainty,
       cognitive_processing,
       nrc_anger, nrc_fear, nrc_joy, nrc_sadness, nrc_trust, nrc_anticipation,
       sentiment, abstraction, agency_framing, temporal_orientation,
       convergence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    state.response_id,
    state.syntactic_complexity, state.interrogation, state.self_focus, state.uncertainty,
    state.cognitive_processing,
    state.nrc_anger, state.nrc_fear, state.nrc_joy, state.nrc_sadness, state.nrc_trust, state.nrc_anticipation,
    state.sentiment, state.abstraction, state.agency_framing, state.temporal_orientation,
    state.convergence,
  );
  return Number(result.lastInsertRowid);
}

export function getSemanticStateCount(): number {
  return (db.prepare(
    `SELECT COUNT(*) as c FROM tb_semantic_states`
  ).get() as { c: number }).c;
}

export interface SemanticDynamicRow {
  semantic_dynamic_id: number;
  entry_count: number;
  dimension: string;
  baseline: number;
  variability: number;
  attractor_force: number;
  current_state: number;
  deviation: number;
  window_size: number;
}

export function saveSemanticDynamics(dynamics: Omit<SemanticDynamicRow, 'semantic_dynamic_id'>[]): void {
  const stmt = db.prepare(`
    INSERT INTO tb_semantic_dynamics (
       entry_count, dimension, baseline, variability,
       attractor_force, current_state, deviation, window_size
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const d of dynamics) {
      stmt.run(
        d.entry_count, d.dimension, d.baseline, d.variability,
        d.attractor_force, d.current_state, d.deviation, d.window_size,
      );
    }
  });
  tx();
}

export interface SemanticCouplingRow {
  semantic_coupling_id: number;
  entry_count: number;
  leader: string;
  follower: string;
  lag_sessions: number;
  correlation: number;
  direction: number;
}

export function saveSemanticCoupling(couplings: Omit<SemanticCouplingRow, 'semantic_coupling_id'>[]): void {
  const stmt = db.prepare(`
    INSERT INTO tb_semantic_coupling (
       entry_count, leader, follower, lag_sessions, correlation, direction
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const c of couplings) {
      stmt.run(c.entry_count, c.leader, c.follower, c.lag_sessions, c.correlation, c.direction);
    }
  });
  tx();
}

// ----------------------------------------------------------------------------
// TRAIT DYNAMICS (PersDyn model)
// ----------------------------------------------------------------------------

export interface TraitDynamicRow {
  trait_dynamic_id: number;
  entry_count: number;
  dimension: string;
  baseline: number;
  variability: number;
  attractor_force: number;
  current_state: number;
  deviation: number;
  window_size: number;
}

export function saveTraitDynamics(dynamics: Omit<TraitDynamicRow, 'trait_dynamic_id'>[]): void {
  const stmt = db.prepare(`
    INSERT INTO tb_trait_dynamics (
       entry_count, dimension, baseline, variability,
       attractor_force, current_state, deviation, window_size
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const d of dynamics) {
      stmt.run(
        d.entry_count, d.dimension, d.baseline, d.variability,
        d.attractor_force, d.current_state, d.deviation, d.window_size,
      );
    }
  });
  tx();
}

export function getLatestTraitDynamics(entryCount: number): TraitDynamicRow[] {
  return db.prepare(`
    SELECT * FROM tb_trait_dynamics
    WHERE entry_count = ?
    ORDER BY trait_dynamic_id ASC
  `).all(entryCount) as TraitDynamicRow[];
}

// ----------------------------------------------------------------------------
// COUPLING MATRIX
// ----------------------------------------------------------------------------

export interface CouplingRow {
  coupling_id: number;
  entry_count: number;
  leader: string;
  follower: string;
  lag_sessions: number;
  correlation: number;
  direction: number;
}

export function saveCouplingMatrix(couplings: Omit<CouplingRow, 'coupling_id'>[]): void {
  const stmt = db.prepare(`
    INSERT INTO tb_coupling_matrix (
       entry_count, leader, follower, lag_sessions, correlation, direction
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const c of couplings) {
      stmt.run(c.entry_count, c.leader, c.follower, c.lag_sessions, c.correlation, c.direction);
    }
  });
  tx();
}

export function getLatestCouplingMatrix(entryCount: number): CouplingRow[] {
  return db.prepare(`
    SELECT * FROM tb_coupling_matrix
    WHERE entry_count = ?
    ORDER BY correlation DESC
  `).all(entryCount) as CouplingRow[];
}

// ----------------------------------------------------------------------------
// EMOTION-BEHAVIOR COUPLING
// ----------------------------------------------------------------------------

export interface EmotionBehaviorCouplingRow {
  emotion_coupling_id: number;
  entry_count: number;
  emotion_dim: string;
  behavior_dim: string;
  lag_sessions: number;
  correlation: number;
  direction: number;
}

export function saveEmotionBehaviorCoupling(couplings: Omit<EmotionBehaviorCouplingRow, 'emotion_coupling_id'>[]): void {
  const stmt = db.prepare(`
    INSERT INTO tb_emotion_behavior_coupling (
       entry_count, emotion_dim, behavior_dim, lag_sessions, correlation, direction
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const c of couplings) {
      stmt.run(c.entry_count, c.emotion_dim, c.behavior_dim, c.lag_sessions, c.correlation, c.direction);
    }
  });
  tx();
}

export function getLatestEmotionBehaviorCoupling(entryCount: number): EmotionBehaviorCouplingRow[] {
  return db.prepare(`
    SELECT * FROM tb_emotion_behavior_coupling
    WHERE entry_count = ?
    ORDER BY correlation DESC
  `).all(entryCount) as EmotionBehaviorCouplingRow[];
}

// ----------------------------------------------------------------------------
// PREDICTIONS + THEORY CONFIDENCE — ARCHIVED 2026-04-16
// Retained as no-op stubs while callers are removed in slice 2.
// Data preserved under zz_archive_predictions_20260416 and
// zz_archive_theory_confidence_20260416.
// ----------------------------------------------------------------------------

export interface PredictionInput {
  aiObservationId: number;
  questionId: number;
  predictionTypeId: number;
  hypothesis: string;
  favoredFrame: string | null;
  expectedSignature: string;
  falsificationCriteria: string;
  targetTopic: string | null;
  expirySessions?: number;
  knowledgeTransformScore?: number | null;
  gradeMethodId?: number;
  structuredCriteria?: string | null;
}

export function savePrediction(_p: PredictionInput): number {
  return 0; // archived
}

export interface OpenPrediction {
  predictionId: number;
  aiObservationId: number;
  questionId: number;
  predictionTypeId: number;
  hypothesis: string;
  favoredFrame: string | null;
  expectedSignature: string;
  falsificationCriteria: string;
  targetTopic: string | null;
  expirySessions: number;
  gradeMethodId: number;
  structuredCriteria: string | null;
  sessionCheckResults: string | null;
  dttmCreatedUtc: string;
}

export function getOpenPredictions(): OpenPrediction[] {
  return []; // archived
}

export function updateSessionCheckResults(_predictionId: number, _results: string): void {
  // archived
}

export function gradePrediction(
  _predictionId: number,
  _statusCode: 'confirmed' | 'falsified' | 'expired' | 'indeterminate',
  _gradedByObservationId: number | null,
  _rationale: string,
): void {
  // archived
}

export function getPredictionStats(): {
  total: number; confirmed: number; falsified: number; expired: number; indeterminate: number; open: number;
} {
  return { total: 0, confirmed: 0, falsified: 0, expired: 0, indeterminate: 0, open: 0 };
}

export function getRecentGradedPredictions(_limit: number): Array<{
  predictionId: number; hypothesis: string; favoredFrame: string | null;
  statusCode: string; gradeRationale: string | null; targetTopic: string | null;
  dttmCreatedUtc: string; dttmGradedUtc: string | null;
}> {
  return []; // archived
}

export function getTheoryConfidence(_theoryKey: string): {
  alpha: number; beta: number; totalPredictions: number; posteriorMean: number;
  logBayesFactor: number; status: string;
} | null {
  return null; // archived
}

export function updateTheoryConfidence(
  _theoryKey: string,
  _description: string,
  _hit: boolean,
  _predictionId: number,
): void {
  // archived
}

export function getAllTheoryConfidences(): Array<{
  theoryKey: string; description: string; alpha: number; beta: number;
  totalPredictions: number; posteriorMean: number;
  logBayesFactor: number; status: string;
}> {
  return []; // archived
}

// ----------------------------------------------------------------------------
// INTERVENTION INTENT + QUESTION CANDIDATES — ARCHIVED 2026-04-16
// Stubbed; data preserved under zz_archive_intervention_intent_20260416 and
// zz_archive_question_candidates_20260416.
// ----------------------------------------------------------------------------

export function updateQuestionIntent(
  _questionId: number,
  _intentCode: string,
  _rationale: string,
): void {
  // archived
}

export function getQuestionIntent(_questionId: number): {
  intentCode: string; rationale: string | null;
} | null {
  return null; // archived
}

export interface QuestionCandidate {
  candidateRank: number;
  candidateText: string;
  selectionRationale: string | null;
  uncertaintyDimension: string | null;
  themeTags: string | null;
}

export function saveQuestionCandidates(_questionId: number, _candidates: QuestionCandidate[]): void {
  // archived
}

export function getQuestionCandidates(_questionId: number): QuestionCandidate[] {
  return []; // archived
}

// ----------------------------------------------------------------------------
// CALIBRATION CONTEXT EXTRACTION
// ----------------------------------------------------------------------------

export interface CalibrationContextTag {
  dimension: 'sleep' | 'physical_state' | 'emotional_event' | 'social_quality' | 'stress' | 'exercise' | 'routine';
  value: string;
  detail: string | null;
  confidence: number;
}

const DIMENSION_ID_MAP: Record<string, number> = {
  sleep: 1, physical_state: 2, emotional_event: 3, social_quality: 4,
  stress: 5, exercise: 6, routine: 7,
};

export function saveCalibrationContext(questionId: number, tags: CalibrationContextTag[]): void {
  const stmt = db.prepare(`
    INSERT INTO tb_calibration_context (
       question_id, context_dimension_id, value, detail, confidence
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((entries: CalibrationContextTag[]) => {
    for (const tag of entries) {
      const dimId = DIMENSION_ID_MAP[tag.dimension];
      if (!dimId) continue;
      stmt.run(questionId, dimId, tag.value, tag.detail, tag.confidence);
    }
  });
  insertAll(tags);
}

export function getCalibrationContextForQuestion(questionId: number): Array<CalibrationContextTag & { questionId: number }> {
  return db.prepare(`
    SELECT cc.question_id as questionId,
           d.enum_code as dimension,
           cc.value,
           cc.detail,
           cc.confidence
    FROM tb_calibration_context cc
    JOIN te_context_dimension d ON cc.context_dimension_id = d.context_dimension_id
    WHERE cc.question_id = ?
    ORDER BY cc.context_dimension_id ASC
  `).all(questionId) as Array<CalibrationContextTag & { questionId: number }>;
}

export function getRecentCalibrationContext(limit: number = 10): Array<{
  questionId: number;
  promptText: string;
  sessionDate: string;
  dimension: string;
  value: string;
  detail: string | null;
  confidence: number;
}> {
  return db.prepare(`
    SELECT cc.question_id as questionId,
           q.text as promptText,
           q.dttm_created_utc as sessionDate,
           d.enum_code as dimension,
           cc.value,
           cc.detail,
           cc.confidence
    FROM tb_calibration_context cc
    JOIN te_context_dimension d ON cc.context_dimension_id = d.context_dimension_id
    JOIN tb_questions q ON cc.question_id = q.question_id
    ORDER BY q.dttm_created_utc DESC, cc.context_dimension_id ASC
    LIMIT ?
  `).all(limit) as Array<{
    questionId: number;
    promptText: string;
    sessionDate: string;
    dimension: string;
    value: string;
    detail: string | null;
    confidence: number;
  }>;
}

export function getCalibrationContextNearDate(targetDate: string, windowDays: number = 1): Array<{
  questionId: number;
  sessionDate: string;
  dimension: string;
  value: string;
  detail: string | null;
  confidence: number;
}> {
  return db.prepare(`
    SELECT cc.question_id as questionId,
           q.dttm_created_utc as sessionDate,
           d.enum_code as dimension,
           cc.value,
           cc.detail,
           cc.confidence
    FROM tb_calibration_context cc
    JOIN te_context_dimension d ON cc.context_dimension_id = d.context_dimension_id
    JOIN tb_questions q ON cc.question_id = q.question_id
    WHERE ABS(julianday(q.dttm_created_utc) - julianday(?)) <= ?
    ORDER BY ABS(julianday(q.dttm_created_utc) - julianday(?)) ASC, cc.context_dimension_id ASC
  `).all(targetDate, windowDays, targetDate) as Array<{
    questionId: number;
    sessionDate: string;
    dimension: string;
    value: string;
    detail: string | null;
    confidence: number;
  }>;
}

// ----------------------------------------------------------------------------
// SESSION DELTA (same-day calibration → journal behavioral shift)
// ----------------------------------------------------------------------------

export interface SessionDeltaRow {
  sessionDeltaId: number;
  sessionDate: string;
  calibrationQuestionId: number;
  journalQuestionId: number;
  deltaFirstPerson: number | null;
  deltaCognitive: number | null;
  deltaHedging: number | null;
  deltaCharsPerMinute: number | null;
  deltaCommitment: number | null;
  deltaLargeDeletionCount: number | null;
  deltaInterKeyIntervalMean: number | null;
  deltaAvgPBurstLength: number | null;
  deltaHoldTimeMean: number | null;
  deltaFlightTimeMean: number | null;
  deltaMagnitude: number | null;
  calibrationFirstPerson: number | null;
  journalFirstPerson: number | null;
  calibrationCognitive: number | null;
  journalCognitive: number | null;
  calibrationHedging: number | null;
  journalHedging: number | null;
  calibrationCharsPerMinute: number | null;
  journalCharsPerMinute: number | null;
  calibrationCommitment: number | null;
  journalCommitment: number | null;
  calibrationLargeDeletionCount: number | null;
  journalLargeDeletionCount: number | null;
  calibrationInterKeyIntervalMean: number | null;
  journalInterKeyIntervalMean: number | null;
  calibrationAvgPBurstLength: number | null;
  journalAvgPBurstLength: number | null;
  calibrationHoldTimeMean: number | null;
  journalHoldTimeMean: number | null;
  calibrationFlightTimeMean: number | null;
  journalFlightTimeMean: number | null;
}

export function getSameDayCalibrationSummary(date: string): SessionSummaryInput | null {
  // Calibration questions have scheduled_for = NULL (see saveCalibrationSession).
  // Match by DATE(dttm_created_utc) instead. Take most recent if multiple same-day.
  return db.prepare(`
    SELECT ${SESSION_SUMMARY_COLS}
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE q.question_source_id = 3
      AND DATE(q.dttm_created_utc) = ?
    ORDER BY q.dttm_created_utc DESC
    LIMIT 1
  `).get(date) as SessionSummaryInput | null;
}

export function saveSessionDelta(delta: SessionDeltaRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO tb_session_delta (
       session_date
      ,calibration_question_id
      ,journal_question_id
      ,delta_first_person
      ,delta_cognitive
      ,delta_hedging
      ,delta_chars_per_minute
      ,delta_commitment
      ,delta_large_deletion_count
      ,delta_inter_key_interval_mean
      ,delta_avg_p_burst_length
      ,delta_hold_time_mean
      ,delta_flight_time_mean
      ,delta_magnitude
      ,calibration_first_person
      ,journal_first_person
      ,calibration_cognitive
      ,journal_cognitive
      ,calibration_hedging
      ,journal_hedging
      ,calibration_chars_per_minute
      ,journal_chars_per_minute
      ,calibration_commitment
      ,journal_commitment
      ,calibration_large_deletion_count
      ,journal_large_deletion_count
      ,calibration_inter_key_interval_mean
      ,journal_inter_key_interval_mean
      ,calibration_avg_p_burst_length
      ,journal_avg_p_burst_length
      ,calibration_hold_time_mean
      ,journal_hold_time_mean
      ,calibration_flight_time_mean
      ,journal_flight_time_mean
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    delta.sessionDate,
    delta.calibrationQuestionId,
    delta.journalQuestionId,
    delta.deltaFirstPerson,
    delta.deltaCognitive,
    delta.deltaHedging,
    delta.deltaCharsPerMinute,
    delta.deltaCommitment,
    delta.deltaLargeDeletionCount,
    delta.deltaInterKeyIntervalMean,
    delta.deltaAvgPBurstLength,
    delta.deltaHoldTimeMean,
    delta.deltaFlightTimeMean,
    delta.deltaMagnitude,
    delta.calibrationFirstPerson,
    delta.journalFirstPerson,
    delta.calibrationCognitive,
    delta.journalCognitive,
    delta.calibrationHedging,
    delta.journalHedging,
    delta.calibrationCharsPerMinute,
    delta.journalCharsPerMinute,
    delta.calibrationCommitment,
    delta.journalCommitment,
    delta.calibrationLargeDeletionCount,
    delta.journalLargeDeletionCount,
    delta.calibrationInterKeyIntervalMean,
    delta.journalInterKeyIntervalMean,
    delta.calibrationAvgPBurstLength,
    delta.journalAvgPBurstLength,
    delta.calibrationHoldTimeMean,
    delta.journalHoldTimeMean,
    delta.calibrationFlightTimeMean,
    delta.journalFlightTimeMean,
  );
}

export function getRecentSessionDeltas(limit: number = 30): SessionDeltaRow[] {
  return db.prepare(`
    SELECT
       session_delta_id as sessionDeltaId
      ,session_date as sessionDate
      ,calibration_question_id as calibrationQuestionId
      ,journal_question_id as journalQuestionId
      ,delta_first_person as deltaFirstPerson
      ,delta_cognitive as deltaCognitive
      ,delta_hedging as deltaHedging
      ,delta_chars_per_minute as deltaCharsPerMinute
      ,delta_commitment as deltaCommitment
      ,delta_large_deletion_count as deltaLargeDeletionCount
      ,delta_inter_key_interval_mean as deltaInterKeyIntervalMean
      ,delta_avg_p_burst_length as deltaAvgPBurstLength
      ,delta_hold_time_mean as deltaHoldTimeMean
      ,delta_flight_time_mean as deltaFlightTimeMean
      ,delta_magnitude as deltaMagnitude
      ,calibration_first_person as calibrationFirstPerson
      ,journal_first_person as journalFirstPerson
      ,calibration_cognitive as calibrationCognitive
      ,journal_cognitive as journalCognitive
      ,calibration_hedging as calibrationHedging
      ,journal_hedging as journalHedging
      ,calibration_chars_per_minute as calibrationCharsPerMinute
      ,journal_chars_per_minute as journalCharsPerMinute
      ,calibration_commitment as calibrationCommitment
      ,journal_commitment as journalCommitment
      ,calibration_large_deletion_count as calibrationLargeDeletionCount
      ,journal_large_deletion_count as journalLargeDeletionCount
      ,calibration_inter_key_interval_mean as calibrationInterKeyIntervalMean
      ,journal_inter_key_interval_mean as journalInterKeyIntervalMean
      ,calibration_avg_p_burst_length as calibrationAvgPBurstLength
      ,journal_avg_p_burst_length as journalAvgPBurstLength
      ,calibration_hold_time_mean as calibrationHoldTimeMean
      ,journal_hold_time_mean as journalHoldTimeMean
      ,calibration_flight_time_mean as calibrationFlightTimeMean
      ,journal_flight_time_mean as journalFlightTimeMean
    FROM tb_session_delta
    ORDER BY session_date DESC
    LIMIT ?
  `).all(limit) as SessionDeltaRow[];
}

// ═══════════════════════════════════════════════════════════════════
// OBSERVATORY QUERIES
// ═══════════════════════════════════════════════════════════════════

export function getEntryStatesWithDates(): Array<EntryStateRow & { date: string; question_id: number }> {
  return db.prepare(`
    SELECT es.*, q.scheduled_for as date, q.question_id
    FROM tb_entry_states es
    JOIN tb_responses r ON es.response_id = r.response_id
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY es.entry_state_id ASC
  `).all() as Array<EntryStateRow & { date: string; question_id: number }>;
}

export function getEntryStateByResponseId(responseId: number): (EntryStateRow & {
  date: string; question_id: number; question_text: string;
}) | null {
  return db.prepare(`
    SELECT es.*, q.scheduled_for as date, q.question_id, q.text as question_text
    FROM tb_entry_states es
    JOIN tb_responses r ON es.response_id = r.response_id
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE es.response_id = ?
  `).get(responseId) as (EntryStateRow & {
    date: string; question_id: number; question_text: string;
  }) | null;
}

export function getObservationForQuestion(_questionId: number): {
  ai_observation_id: number; observation_text: string; observation_date: string;
} | null {
  return null; // archived
}

export function getSuppressedQuestionForQuestion(_questionId: number): {
  suppressed_text: string; suppressed_date: string;
} | null {
  return null; // archived
}

export function getPredictionsForQuestion(_questionId: number): Array<{
  predictionId: number; hypothesis: string; favoredFrame: string | null;
  expectedSignature: string; falsificationCriteria: string;
  statusCode: string; gradeRationale: string | null;
  targetTopic: string | null;
  dttmCreatedUtc: string; dttmGradedUtc: string | null;
}> {
  return []; // archived
}

export default db;
