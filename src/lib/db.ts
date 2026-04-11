import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDateStr } from './date.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/marrow.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

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
  -- PURPOSE: Define how a question originated
  -- USE CASE: "Was this question hand-curated or AI-generated?"
  -- MUTABILITY: Static
  -- VALUES: seed (1), generated (2), calibration (3)
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
  -- PURPOSE: Store all questions (seed and generated) scheduled by date
  -- USE CASE: "What question is the user seeing today?"
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
  -- PURPOSE: Store user responses to daily questions
  -- USE CASE: "What did the user write today?"
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
  -- USE CASE: "What did Marrow notice across the user's responses?"
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
    -- FOOTER
    ,dttm_created_utc           TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by                 TEXT    NOT NULL DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_ai_observations
  -- --------------------------------------------------------------------------
  -- PURPOSE: Store the AI's nightly silent observations about the user
  -- USE CASE: "What did the AI notice today that it couldn't say?"
  -- MUTABILITY: Mutable (append-only, one row per day)
  -- LOGICAL FK: question_id → tb_questions.question_id
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_ai_observations (
     ai_observation_id   INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id         INTEGER NOT NULL UNIQUE
    ,observation_text    TEXT    NOT NULL
    ,observation_date    TEXT    NOT NULL
    -- FOOTER
    ,dttm_created_utc    TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by          TEXT    NOT NULL DEFAULT 'system'
  );

  -- --------------------------------------------------------------------------
  -- tb_ai_suppressed_questions
  -- --------------------------------------------------------------------------
  -- PURPOSE: Store questions the AI wanted to ask but couldn't (seed phase)
  --          or chose not to (generated phase — the runner-up)
  -- USE CASE: "What has the AI been building toward asking?"
  -- MUTABILITY: Mutable (append-only, one row per day)
  -- LOGICAL FK: question_id → tb_questions.question_id (the question that
  --             WAS asked that day, not this suppressed one)
  -- FOOTER: Minimal (append-only)
  -- --------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tb_ai_suppressed_questions (
     ai_suppressed_question_id  INTEGER PRIMARY KEY AUTOINCREMENT
    ,question_id                INTEGER NOT NULL UNIQUE
    ,suppressed_text            TEXT    NOT NULL
    ,suppressed_date            TEXT    NOT NULL
    -- FOOTER
    ,dttm_created_utc           TEXT    NOT NULL DEFAULT (datetime('now'))
    ,created_by                 TEXT    NOT NULL DEFAULT 'system'
  );
`);

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

export function saveResponse(questionId: number, text: string): void {
  db.prepare(
    `INSERT INTO tb_responses (question_id, text) VALUES (?, ?)`
  ).run(questionId, text);
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

export function saveReflection(text: string, type: 'weekly' | 'monthly' = 'weekly'): void {
  const typeId = type === 'monthly' ? 2 : 1;
  db.prepare(
    `INSERT INTO tb_reflections (text, reflection_type_id) VALUES (?, ?)`
  ).run(text, typeId);
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
}

export function saveSessionSummary(s: SessionSummaryInput): void {
  db.prepare(`
    INSERT OR IGNORE INTO tb_session_summaries (
       question_id, first_keystroke_ms, total_duration_ms,
       total_chars_typed, final_char_count, commitment_ratio,
       pause_count, total_pause_ms, deletion_count, largest_deletion,
       total_chars_deleted, tab_away_count, total_tab_away_ms,
       word_count, sentence_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    s.questionId, s.firstKeystrokeMs, s.totalDurationMs,
    s.totalCharsTyped, s.finalCharCount, s.commitmentRatio,
    s.pauseCount, s.totalPauseMs, s.deletionCount, s.largestDeletion,
    s.totalCharsDeleted, s.tabAwayCount, s.totalTabAwayMs,
    s.wordCount, s.sentenceCount
  );
}

export function getSessionSummary(questionId: number): SessionSummaryInput | null {
  return db.prepare(
    `SELECT question_id as questionId, first_keystroke_ms as firstKeystrokeMs,
            total_duration_ms as totalDurationMs, total_chars_typed as totalCharsTyped,
            final_char_count as finalCharCount, commitment_ratio as commitmentRatio,
            pause_count as pauseCount, total_pause_ms as totalPauseMs,
            deletion_count as deletionCount, largest_deletion as largestDeletion,
            total_chars_deleted as totalCharsDeleted, tab_away_count as tabAwayCount,
            total_tab_away_ms as totalTabAwayMs, word_count as wordCount,
            sentence_count as sentenceCount
     FROM tb_session_summaries WHERE question_id = ?`
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
           s.sentence_count as sentenceCount
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    ORDER BY q.scheduled_for ASC
  `).all() as Array<SessionSummaryInput & { date: string }>;
}

export function getCalibrationBaselines(): {
  avgFirstKeystrokeMs: number | null;
  avgCommitmentRatio: number | null;
  avgDurationMs: number | null;
  avgPauseCount: number | null;
  avgDeletionCount: number | null;
  sessionCount: number;
} {
  const row = db.prepare(`
    SELECT
       AVG(s.first_keystroke_ms) as avgFirstKeystrokeMs
      ,AVG(s.commitment_ratio) as avgCommitmentRatio
      ,AVG(s.total_duration_ms) as avgDurationMs
      ,AVG(s.pause_count) as avgPauseCount
      ,AVG(s.deletion_count) as avgDeletionCount
      ,COUNT(*) as sessionCount
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE q.question_source_id = 3
  `).get() as {
    avgFirstKeystrokeMs: number | null;
    avgCommitmentRatio: number | null;
    avgDurationMs: number | null;
    avgPauseCount: number | null;
    avgDeletionCount: number | null;
    sessionCount: number;
  };
  return row;
}

export function isCalibrationQuestion(questionId: number): boolean {
  const row = db.prepare(
    `SELECT 1 FROM tb_questions WHERE question_id = ? AND question_source_id = 3`
  ).get(questionId);
  return !!row;
}

// ----------------------------------------------------------------------------
// AI OBSERVATIONS & SUPPRESSED QUESTIONS
// ----------------------------------------------------------------------------

export function saveAiObservation(questionId: number, text: string, date: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO tb_ai_observations (question_id, observation_text, observation_date) VALUES (?, ?, ?)`
  ).run(questionId, text, date);
}

export function saveSuppressedQuestion(questionId: number, text: string, date: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO tb_ai_suppressed_questions (question_id, suppressed_text, suppressed_date) VALUES (?, ?, ?)`
  ).run(questionId, text, date);
}

export function getAllAiObservations(): Array<{ date: string; observation: string }> {
  return db.prepare(`
    SELECT observation_date as date, observation_text as observation
    FROM tb_ai_observations
    ORDER BY observation_date ASC
  `).all() as Array<{ date: string; observation: string }>;
}

export function getAllSuppressedQuestions(): Array<{ date: string; question: string }> {
  return db.prepare(`
    SELECT suppressed_date as date, suppressed_text as question
    FROM tb_ai_suppressed_questions
    ORDER BY suppressed_date ASC
  `).all() as Array<{ date: string; question: string }>;
}

export function getResponseCount(): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM tb_responses`).get() as { count: number };
  return row.count;
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

export default db;
