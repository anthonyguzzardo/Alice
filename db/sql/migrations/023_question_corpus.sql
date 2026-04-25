-- 023_question_corpus.sql
-- Shared question corpus for multi-user scheduling.
-- Questions authored offline by owner, never by subjects or at runtime.

SET search_path = alice, public;

-- New question source enum value
INSERT INTO te_question_source (question_source_id, enum_code, name)
VALUES (4, 'corpus', 'Corpus')
ON CONFLICT DO NOTHING;

-- PURPOSE: shared pool of reviewed questions for all subjects
-- USE CASE: one row per unique question text. Subjects are scheduled from this
--           pool via tb_scheduled_questions (Phase 4). Owner may also draw from
--           this pool but is not required to.
-- MUTABILITY: insert by owner, soft-retire via is_retired. Never deleted.
-- REFERENCED BY: tb_scheduled_questions (Phase 4, logical FK)
-- FOOTER: created only (append-only, retirement is a flag not an update)
CREATE TABLE IF NOT EXISTS tb_question_corpus (
   corpus_question_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,text                 TEXT UNIQUE NOT NULL
  ,theme_tag            TEXT
  ,is_retired           BOOLEAN NOT NULL DEFAULT FALSE
  ,added_by             TEXT NOT NULL DEFAULT 'owner'
  ,dttm_created_utc     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the corpus with the original 30 questions from libSeeds.ts.
-- ON CONFLICT ensures idempotency on re-run.
INSERT INTO tb_question_corpus (text, theme_tag, added_by) VALUES
   ('What are you pretending isn''t bothering you right now?',                                          'surface',   'seed-import')
  ,('If you couldn''t work on anything you''re currently working on, what would you do instead?',       'surface',   'seed-import')
  ,('What decision are you quietly avoiding?',                                                          'surface',   'seed-import')
  ,('What would you be embarrassed to admit you want?',                                                 'surface',   'seed-import')
  ,('When was the last time you changed your mind about something that mattered?',                      'surface',   'seed-import')
  ,('What do you keep almost saying out loud but don''t?',                                              'surface',   'seed-import')
  ,('What''s the difference between what you say you value and how you actually spend your time?',      'surface',   'seed-import')
  ,('What are you building, and who told you to build it?',                                             'patterns',  'seed-import')
  ,('What would you do if you knew nobody was watching?',                                               'patterns',  'seed-import')
  ,('What question are you afraid someone will ask you?',                                               'patterns',  'seed-import')
  ,('When do you feel most like yourself? What''s different about those moments?',                      'patterns',  'seed-import')
  ,('What have you outgrown but haven''t let go of yet?',                                               'patterns',  'seed-import')
  ,('What''s the story you tell yourself about why things haven''t worked out the way you wanted?',     'patterns',  'seed-import')
  ,('What would it look like to take yourself seriously?',                                              'patterns',  'seed-import')
  ,('What are you protecting by staying busy?',                                                         'depth',     'seed-import')
  ,('If your life had a thesis statement, what would it be? Do you like it?',                           'depth',     'seed-import')
  ,('What would you have to give up to get what you actually want?',                                    'depth',     'seed-import')
  ,('Who do you become when you''re scared? Is that who you want to be?',                               'depth',     'seed-import')
  ,('What conversation would change everything if you actually had it?',                                'depth',     'seed-import')
  ,('What are you building that will still matter in ten years?',                                       'depth',     'seed-import')
  ,('Where are you performing competence instead of actually learning?',                                'depth',     'seed-import')
  ,('What would you work on if you had no audience?',                                                   'direction', 'seed-import')
  ,('What''s the most honest thing you could say about where you are right now?',                       'direction', 'seed-import')
  ,('What do you know that you wish you didn''t?',                                                      'direction', 'seed-import')
  ,('What''s the version of your life you''re most afraid of ending up in?',                            'direction', 'seed-import')
  ,('What are you circling that you haven''t landed on yet?',                                           'direction', 'seed-import')
  ,('If you could only do one thing for the next year, what would it be?',                              'direction', 'seed-import')
  ,('What would it mean to stop optimizing and start choosing?',                                        'direction', 'seed-import')
  ,('Go back and read your first response. What do you notice?',                                        'return',    'seed-import')
  ,('What question should Alice have asked you that it didn''t?',                                       'return',    'seed-import')
ON CONFLICT (text) DO NOTHING;
