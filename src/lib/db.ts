import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDateStr } from './date.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/marrow.db');

const db = new Database(DB_PATH);

sqliteVec.load(db);
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
    -- CONTEXT
    ,device_type                TEXT             -- 'mobile' or 'desktop'
    ,user_agent                 TEXT             -- raw user agent string
    ,hour_of_day                INTEGER          -- 0-23 local time
    ,day_of_week                INTEGER          -- 0=Sunday, 6=Saturday
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
    `INSERT INTO tb_responses (question_id, text) VALUES (?, ?)`
  ).run(questionId, text);
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
    `INSERT INTO tb_reflections (text, reflection_type_id, coverage_through_response_id) VALUES (?, ?, ?)`
  ).run(text, typeId, coverageThroughResponseId ?? null);
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
       device_type, user_agent, hour_of_day, day_of_week
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    s.questionId, s.firstKeystrokeMs, s.totalDurationMs,
    s.totalCharsTyped, s.finalCharCount, s.commitmentRatio,
    s.pauseCount, s.totalPauseMs, s.deletionCount, s.largestDeletion,
    s.totalCharsDeleted, s.tabAwayCount, s.totalTabAwayMs,
    s.wordCount, s.sentenceCount,
    s.deviceType, s.userAgent, s.hourOfDay, s.dayOfWeek
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
            sentence_count as sentenceCount, device_type as deviceType,
            user_agent as userAgent, hour_of_day as hourOfDay, day_of_week as dayOfWeek
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
           s.sentence_count as sentenceCount, s.device_type as deviceType,
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
      ,COUNT(*) as sessionCount
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE ${conditions.join(' AND ')}
  `).get(...params) as { avgFirstKeystrokeMs: number | null; avgCommitmentRatio: number | null; avgDurationMs: number | null; avgPauseCount: number | null; avgDeletionCount: number | null; sessionCount: number };

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

export function isCalibrationQuestion(questionId: number): boolean {
  const row = db.prepare(
    `SELECT 1 FROM tb_questions WHERE question_id = ? AND question_source_id = 3`
  ).get(questionId);
  return !!row;
}

// ----------------------------------------------------------------------------
// AI OBSERVATIONS & SUPPRESSED QUESTIONS
// ----------------------------------------------------------------------------

export function saveAiObservation(questionId: number, text: string, date: string): number {
  const result = db.prepare(
    `INSERT OR IGNORE INTO tb_ai_observations (question_id, observation_text, observation_date) VALUES (?, ?, ?)`
  ).run(questionId, text, date);
  return Number(result.lastInsertRowid);
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

export function getRecentObservations(limit: number): Array<{
  ai_observation_id: number; date: string; observation: string;
}> {
  return db.prepare(`
    SELECT ai_observation_id, observation_date as date, observation_text as observation
    FROM tb_ai_observations
    ORDER BY observation_date DESC
    LIMIT ?
  `).all(limit) as Array<{
    ai_observation_id: number; date: string; observation: string;
  }>;
}

export function getObservationsSinceDate(sinceDate: string): Array<{
  ai_observation_id: number; date: string; observation: string;
}> {
  return db.prepare(`
    SELECT ai_observation_id, observation_date as date, observation_text as observation
    FROM tb_ai_observations
    WHERE observation_date > ?
    ORDER BY observation_date ASC
  `).all(sinceDate) as Array<{
    ai_observation_id: number; date: string; observation: string;
  }>;
}

export function getRecentSuppressedQuestions(limit: number): Array<{ date: string; question: string }> {
  return db.prepare(`
    SELECT suppressed_date as date, suppressed_text as question
    FROM tb_ai_suppressed_questions
    ORDER BY suppressed_date DESC
    LIMIT ?
  `).all(limit) as Array<{ date: string; question: string }>;
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
           s.sentence_count as sentenceCount, s.device_type as deviceType,
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
  return db.prepare(`
    SELECT o.ai_observation_id, o.observation_text as observation, o.observation_date as date
    FROM tb_ai_observations o
    WHERE NOT EXISTS (
      SELECT 1 FROM tb_embeddings e
      WHERE e.embedding_source_id = 2 AND e.source_record_id = o.ai_observation_id
    )
    ORDER BY o.observation_date ASC
  `).all() as Array<{
    ai_observation_id: number; observation: string; date: string;
  }>;
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
  return db.prepare(`
    SELECT e.embedding_id, e.embedding_source_id, e.source_record_id,
           e.embedded_text, e.source_date, v.distance
    FROM vec_embeddings v
    JOIN tb_embeddings e ON v.rowid = e.embedding_id
    WHERE v.embedding MATCH ?
      AND k = ?
    ORDER BY v.distance
  `).all(queryVector, k) as Array<{
    embedding_id: number; distance: number; embedding_source_id: number;
    source_record_id: number; embedded_text: string; source_date: string | null;
  }>;
}

export default db;
