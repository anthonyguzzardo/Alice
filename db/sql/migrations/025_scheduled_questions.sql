-- 025_scheduled_questions.sql
-- Per-subject question scheduling from the shared corpus.
-- Subjects get one corpus question per day via round-robin.

SET search_path = alice, public;

-- PURPOSE: per-subject daily question assignments from the corpus
-- USE CASE: one row per (subject, date). The scheduler assigns a corpus question
--           to each active subject for each day. Round-robin with no-repeat window.
-- MUTABILITY: insert once per (subject, date). Never updated or deleted.
-- REFERENCED BY: tb_subject_responses (Phase 5, logical FK)
-- FOOTER: created only
CREATE TABLE IF NOT EXISTS tb_scheduled_questions (
   scheduled_question_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,subject_id             INT NOT NULL
  ,corpus_question_id     INT NOT NULL
  ,scheduled_for          DATE NOT NULL
  ,UNIQUE (subject_id, scheduled_for)
  ,dttm_created_utc       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for no-repeat lookups: "which corpus questions has this subject seen?"
-- At current scale (<10 subjects, <500 rows) this is unnecessary for performance,
-- but the index is tiny and makes the scheduling query's intent explicit in the schema.
CREATE INDEX IF NOT EXISTS ix_scheduled_questions_subject_corpus
  ON tb_scheduled_questions (subject_id, corpus_question_id);
