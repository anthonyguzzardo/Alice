import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  -- VALUES: seed (1), generated (2)
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
     (1, 'seed',      'Seed')
    ,(2, 'generated', 'Generated');

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
    ,(8, 'tab_focus',        'Tab Focus');

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
`);

// ----------------------------------------------------------------------------
// QUERIES
// ----------------------------------------------------------------------------

export function getTodaysQuestion(): { question_id: number; text: string } | null {
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(
    `SELECT question_id, text FROM tb_questions WHERE scheduled_for = ?`
  ).get(today) as { question_id: number; text: string } | null;
}

export function getTodaysResponse(): { response_id: number; text: string } | null {
  const today = new Date().toISOString().split('T')[0];
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

export function scheduleQuestion(text: string, date: string, source: 'seed' | 'generated' = 'seed'): void {
  const sourceId = source === 'generated' ? 2 : 1;
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

export default db;
