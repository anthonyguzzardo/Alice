-- ============================================================================
-- Migration 030 — Unify owner/subject schema under denormalized subject_id
-- Date: 2026-04-26
-- Phase: 6b foundation (precedes calibration build, encryption uniformity, lint)
-- ============================================================================
--
-- PURPOSE
--   Add `subject_id INT NOT NULL` to every behavioral table. Owner becomes
--   `subject_id = 1`, the row already in `tb_subjects`. Subject `ash` is 2.
--   New subjects get new ids. There is no implicit owner anywhere after this
--   migration: every behavioral row is explicitly attributed to a subject.
--
-- WHY DENORMALIZE
--   Many tables reach owner identity transitively (signal table → question →
--   subject). Storing `subject_id` directly on every behavioral table costs
--   one INT column per row and buys: (1) one-term WHERE clauses, (2) a
--   per-table lint rule that mechanically enforces "every query references
--   subject_id," (3) parity with `tb_signal_jobs` which already follows this
--   pattern. The 19+ extra columns are storage noise; the lint enforceability
--   is structural. See assessment in conversation log preceding this migration.
--
-- created_by CONVENTION (UNCHANGED, DOCUMENTED HERE FOR FUTURE READERS)
--   `created_by` is an audit column — what *process* wrote the row. It is
--   role-based, not identity-based. Three values in production today:
--     'system'  — server-side background work (signal pipeline, LLM extraction)
--     'user'    — direct human input via form submit
--     'client'  — browser-side instrumentation (interaction events)
--   Subject identity belongs in `subject_id`. Do NOT put 'subject:ash' or
--   'subject:2' into `created_by` — that conflates audit with identity. Subject
--   writes use the same three role values: 'system' for pipeline, 'user' for
--   ash's response submits, 'client' for her browser events.
--
-- UPSERT CONFLICT TARGETS CHANGED (search this file for `CONFLICT TARGET CHANGED`)
--   Every constraint that becomes per-subject post-migration is flagged with
--   that exact comment string. Application code referencing `ON CONFLICT (X)`
--   on these columns must be updated in Step 5 to use the new tuple. Sites
--   surfaced in Step 0 write-path pass:
--     - tb_questions          : (scheduled_for) → (subject_id, scheduled_for)
--     - tb_semantic_baselines : (signal_name) → (subject_id, signal_name)
--     - tb_session_delta      : (session_date) → (subject_id, session_date)
--     - tb_personal_profile   : new UNIQUE(subject_id) (was implicit singleton)
--
-- ALICE NEGATIVE — DEPRIORITIZED, MINIMAL TREATMENT
--   The Alice Negative (witness/state/dynamics/coupling) tables are legacy
--   baggage being carried through this migration unchanged. Per directive,
--   they get `subject_id` added (default 1, NOT NULL) and nothing else:
--   no UNIQUE constraints, no per-subject indexes, no query-shape work.
--   Affected tables (eight):
--     - tb_witness_states, tb_entry_states, tb_semantic_states
--     - tb_semantic_dynamics, tb_semantic_coupling
--     - tb_trait_dynamics, tb_coupling_matrix, tb_emotion_behavior_coupling
--   Surfaced during Step 2 dry-run: tb_witness_states.entry_count is NOT
--   unique in production data (entry_count=3 has two snapshots from
--   consecutive days). The header comment "one row per observation cycle"
--   is intent, not enforcement. We honor the data: skip the UNIQUE.
--
-- NOT MODIFIED (intentionally)
--   - te_*               : static enums
--   - tb_subjects, tb_subject_sessions : identity tables (subject_id IS the key)
--   - tb_question_corpus : shared corpus pool, no subject identity
--   - tb_subscribers     : public-website mailing list
--   - tb_paper_comments  : public-website comments
--   - tb_engine_provenance : (binary_sha256, cpu_model) keyed, population-agnostic
--   - tb_embedding_model_versions : static registry
--   - te_adversary_variants : static enum
--   - tb_subject_responses, tb_subject_session_summaries, tb_scheduled_questions
--       : empty tables, dropped at end (commented out for review)
--
-- REVERSIBILITY
--   Every step before the final DROP block is reversible:
--     - Columns can be dropped (DROP COLUMN subject_id)
--     - Constraints can be re-created with the prior shape
--   The DROP TABLE block at the end is the point of no return. It is
--   commented out so this migration can be reviewed and re-run safely. Step 9
--   is when those drops execute, after Steps 2-8 verify the unified shape
--   works end-to-end.
--
-- VERIFICATION
--   Inline `\echo` markers separate sections for psql output review.
--   Pre/post row counts and NULL checks at the bottom.
--
-- ============================================================================

\set ON_ERROR_STOP on
SET search_path = alice, public, extensions;

BEGIN;

\echo '--- 030: pre-migration row counts ---'
SELECT
   (SELECT count(*) FROM tb_questions)                    AS questions
  ,(SELECT count(*) FROM tb_responses)                    AS responses
  ,(SELECT count(*) FROM tb_session_summaries)            AS session_summaries
  ,(SELECT count(*) FROM tb_session_events)               AS session_events
  ,(SELECT count(*) FROM tb_burst_sequences)              AS burst_sequences
  ,(SELECT count(*) FROM tb_rburst_sequences)             AS rburst_sequences
  ,(SELECT count(*) FROM tb_session_metadata)             AS session_metadata
  ,(SELECT count(*) FROM tb_dynamical_signals)            AS dynamical
  ,(SELECT count(*) FROM tb_motor_signals)                AS motor
  ,(SELECT count(*) FROM tb_semantic_signals)             AS semantic
  ,(SELECT count(*) FROM tb_process_signals)              AS process
  ,(SELECT count(*) FROM tb_cross_session_signals)        AS cross_session
  ,(SELECT count(*) FROM tb_calibration_context)          AS calibration_context
  ,(SELECT count(*) FROM tb_calibration_baselines_history) AS calibration_baselines
  ,(SELECT count(*) FROM tb_entry_states)                 AS entry_states
  ,(SELECT count(*) FROM tb_witness_states)               AS witness_states
  ,(SELECT count(*) FROM tb_semantic_states)              AS semantic_states
  ,(SELECT count(*) FROM tb_question_feedback)            AS question_feedback
  ,(SELECT count(*) FROM tb_interaction_events)           AS interaction_events
  ,(SELECT count(*) FROM tb_personal_profile)             AS personal_profile
  ,(SELECT count(*) FROM tb_session_delta)                AS session_delta
  ,(SELECT count(*) FROM tb_reconstruction_residuals)     AS reconstruction_residuals
  ,(SELECT count(*) FROM tb_session_integrity)            AS session_integrity
  ,(SELECT count(*) FROM tb_semantic_baselines)           AS semantic_baselines
  ,(SELECT count(*) FROM tb_semantic_trajectory)          AS semantic_trajectory
  ,(SELECT count(*) FROM tb_signal_jobs)                  AS signal_jobs
  ,(SELECT count(*) FROM tb_embeddings)                   AS embeddings
  ,(SELECT count(*) FROM tb_prompt_traces)                AS prompt_traces
  ,(SELECT count(*) FROM tb_reflections)                  AS reflections
  ,(SELECT count(*) FROM tb_semantic_dynamics)            AS semantic_dynamics
  ,(SELECT count(*) FROM tb_semantic_coupling)            AS semantic_coupling
  ,(SELECT count(*) FROM tb_trait_dynamics)               AS trait_dynamics
  ,(SELECT count(*) FROM tb_coupling_matrix)              AS coupling_matrix
  ,(SELECT count(*) FROM tb_emotion_behavior_coupling)    AS emotion_behavior
;

-- ============================================================================
-- BLOCK 1 — Add subject_id INT (nullable initially) to every affected table
-- ============================================================================

\echo '--- 030: BLOCK 1 — adding nullable subject_id columns ---'

ALTER TABLE tb_questions                    ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_responses                    ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_session_summaries            ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_session_events               ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_burst_sequences              ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_rburst_sequences             ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_session_metadata             ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_dynamical_signals            ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_motor_signals                ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_semantic_signals             ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_process_signals              ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_cross_session_signals        ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_calibration_context          ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_calibration_baselines_history ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_entry_states                 ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_witness_states               ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_semantic_states              ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_question_feedback            ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_interaction_events           ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_personal_profile             ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_session_delta                ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_reconstruction_residuals     ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_session_integrity            ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_semantic_baselines           ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_semantic_trajectory          ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_embeddings                   ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_prompt_traces                ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_reflections                  ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_semantic_dynamics            ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_semantic_coupling            ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_trait_dynamics               ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_coupling_matrix              ADD COLUMN IF NOT EXISTS subject_id INT;
ALTER TABLE tb_emotion_behavior_coupling    ADD COLUMN IF NOT EXISTS subject_id INT;

-- tb_signal_jobs already has nullable subject_id (added in migration 027).
-- We will flip it to NOT NULL in Block 3 along with the rest.

-- ============================================================================
-- BLOCK 2 — Backfill subject_id = 1 (owner) on every existing row
-- ============================================================================

\echo '--- 030: BLOCK 2 — backfilling subject_id = 1 (owner) ---'

UPDATE tb_questions                    SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_responses                    SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_session_summaries            SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_session_events               SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_burst_sequences              SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_rburst_sequences             SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_session_metadata             SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_dynamical_signals            SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_motor_signals                SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_semantic_signals             SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_process_signals              SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_cross_session_signals        SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_calibration_context          SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_calibration_baselines_history SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_entry_states                 SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_witness_states               SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_semantic_states              SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_question_feedback            SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_interaction_events           SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_personal_profile             SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_session_delta                SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_reconstruction_residuals     SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_session_integrity            SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_semantic_baselines           SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_semantic_trajectory          SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_signal_jobs                  SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_embeddings                   SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_prompt_traces                SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_reflections                  SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_semantic_dynamics            SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_semantic_coupling            SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_trait_dynamics               SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_coupling_matrix              SET subject_id = 1 WHERE subject_id IS NULL;
UPDATE tb_emotion_behavior_coupling    SET subject_id = 1 WHERE subject_id IS NULL;

-- Verify zero NULLs remain across all tables before flipping NOT NULL.
\echo '--- 030: BLOCK 2 verification — NULL check (every count must be 0) ---'
SELECT
   (SELECT count(*) FROM tb_questions                    WHERE subject_id IS NULL) AS questions
  ,(SELECT count(*) FROM tb_responses                    WHERE subject_id IS NULL) AS responses
  ,(SELECT count(*) FROM tb_session_summaries            WHERE subject_id IS NULL) AS session_summaries
  ,(SELECT count(*) FROM tb_session_events               WHERE subject_id IS NULL) AS session_events
  ,(SELECT count(*) FROM tb_burst_sequences              WHERE subject_id IS NULL) AS burst_sequences
  ,(SELECT count(*) FROM tb_rburst_sequences             WHERE subject_id IS NULL) AS rburst_sequences
  ,(SELECT count(*) FROM tb_session_metadata             WHERE subject_id IS NULL) AS session_metadata
  ,(SELECT count(*) FROM tb_dynamical_signals            WHERE subject_id IS NULL) AS dynamical
  ,(SELECT count(*) FROM tb_motor_signals                WHERE subject_id IS NULL) AS motor
  ,(SELECT count(*) FROM tb_semantic_signals             WHERE subject_id IS NULL) AS semantic
  ,(SELECT count(*) FROM tb_process_signals              WHERE subject_id IS NULL) AS process
  ,(SELECT count(*) FROM tb_cross_session_signals        WHERE subject_id IS NULL) AS cross_session
  ,(SELECT count(*) FROM tb_calibration_context          WHERE subject_id IS NULL) AS calibration_context
  ,(SELECT count(*) FROM tb_calibration_baselines_history WHERE subject_id IS NULL) AS calibration_baselines
  ,(SELECT count(*) FROM tb_entry_states                 WHERE subject_id IS NULL) AS entry_states
  ,(SELECT count(*) FROM tb_witness_states               WHERE subject_id IS NULL) AS witness_states
  ,(SELECT count(*) FROM tb_semantic_states              WHERE subject_id IS NULL) AS semantic_states
  ,(SELECT count(*) FROM tb_question_feedback            WHERE subject_id IS NULL) AS question_feedback
  ,(SELECT count(*) FROM tb_interaction_events           WHERE subject_id IS NULL) AS interaction_events
  ,(SELECT count(*) FROM tb_personal_profile             WHERE subject_id IS NULL) AS personal_profile
  ,(SELECT count(*) FROM tb_session_delta                WHERE subject_id IS NULL) AS session_delta
  ,(SELECT count(*) FROM tb_reconstruction_residuals     WHERE subject_id IS NULL) AS reconstruction_residuals
  ,(SELECT count(*) FROM tb_session_integrity            WHERE subject_id IS NULL) AS session_integrity
  ,(SELECT count(*) FROM tb_semantic_baselines           WHERE subject_id IS NULL) AS semantic_baselines
  ,(SELECT count(*) FROM tb_semantic_trajectory          WHERE subject_id IS NULL) AS semantic_trajectory
  ,(SELECT count(*) FROM tb_signal_jobs                  WHERE subject_id IS NULL) AS signal_jobs
  ,(SELECT count(*) FROM tb_embeddings                   WHERE subject_id IS NULL) AS embeddings
  ,(SELECT count(*) FROM tb_prompt_traces                WHERE subject_id IS NULL) AS prompt_traces
  ,(SELECT count(*) FROM tb_reflections                  WHERE subject_id IS NULL) AS reflections
  ,(SELECT count(*) FROM tb_semantic_dynamics            WHERE subject_id IS NULL) AS semantic_dynamics
  ,(SELECT count(*) FROM tb_semantic_coupling            WHERE subject_id IS NULL) AS semantic_coupling
  ,(SELECT count(*) FROM tb_trait_dynamics               WHERE subject_id IS NULL) AS trait_dynamics
  ,(SELECT count(*) FROM tb_coupling_matrix              WHERE subject_id IS NULL) AS coupling_matrix
  ,(SELECT count(*) FROM tb_emotion_behavior_coupling    WHERE subject_id IS NULL) AS emotion_behavior
;

-- Verify every backfilled value is exactly 1 (owner). If a non-1 value exists,
-- something inserted a subject row mid-migration and we should abort.
\echo '--- 030: BLOCK 2 verification — non-owner check (every count must be 0) ---'
SELECT
   (SELECT count(*) FROM tb_questions                    WHERE subject_id <> 1) AS questions
  ,(SELECT count(*) FROM tb_responses                    WHERE subject_id <> 1) AS responses
  ,(SELECT count(*) FROM tb_session_summaries            WHERE subject_id <> 1) AS session_summaries
  ,(SELECT count(*) FROM tb_signal_jobs                  WHERE subject_id <> 1) AS signal_jobs
;

-- ============================================================================
-- BLOCK 3 — Flip subject_id to NOT NULL on every affected table
-- ============================================================================

\echo '--- 030: BLOCK 3 — setting subject_id NOT NULL ---'

ALTER TABLE tb_questions                    ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_responses                    ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_session_summaries            ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_session_events               ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_burst_sequences              ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_rburst_sequences             ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_session_metadata             ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_dynamical_signals            ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_motor_signals                ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_semantic_signals             ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_process_signals              ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_cross_session_signals        ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_calibration_context          ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_calibration_baselines_history ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_entry_states                 ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_witness_states               ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_semantic_states              ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_question_feedback            ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_interaction_events           ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_personal_profile             ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_session_delta                ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_reconstruction_residuals     ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_session_integrity            ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_semantic_baselines           ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_semantic_trajectory          ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_signal_jobs                  ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_embeddings                   ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_prompt_traces                ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_reflections                  ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_semantic_dynamics            ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_semantic_coupling            ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_trait_dynamics               ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_coupling_matrix              ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE tb_emotion_behavior_coupling    ALTER COLUMN subject_id SET NOT NULL;

-- ============================================================================
-- BLOCK 4 — UNIQUE constraint changes (CONFLICT TARGETS CHANGED)
-- ============================================================================

\echo '--- 030: BLOCK 4 — rewriting per-subject UNIQUE constraints ---'

-- CONFLICT TARGET CHANGED: tb_questions (scheduled_for) → (subject_id, scheduled_for)
-- Application sites: src/lib/libDb.ts:75-77 (ON CONFLICT (scheduled_for) DO NOTHING)
ALTER TABLE tb_questions DROP CONSTRAINT IF EXISTS tb_questions_scheduled_for_key;
ALTER TABLE tb_questions ADD CONSTRAINT tb_questions_subject_scheduled_for_key
  UNIQUE (subject_id, scheduled_for);

-- CONFLICT TARGET CHANGED: tb_session_delta (session_date) → (subject_id, session_date)
-- session_date is one row per calendar day per subject (daily delta computation)
ALTER TABLE tb_session_delta DROP CONSTRAINT IF EXISTS tb_session_delta_session_date_key;
ALTER TABLE tb_session_delta ADD CONSTRAINT tb_session_delta_subject_date_key
  UNIQUE (subject_id, session_date);

-- CONFLICT TARGET CHANGED: tb_semantic_baselines (signal_name) → (subject_id, signal_name)
-- Application sites: src/lib/libSemanticBaseline.ts:130 (UPSERT keyed on signal_name)
ALTER TABLE tb_semantic_baselines DROP CONSTRAINT IF EXISTS tb_semantic_baselines_signal_name_key;
ALTER TABLE tb_semantic_baselines ADD CONSTRAINT tb_semantic_baselines_subject_signal_key
  UNIQUE (subject_id, signal_name);

-- HONORING DATA: tb_witness_states has duplicate entry_count values in
-- production (entry_count=3 has two snapshots, ~10 hours apart). The header
-- comment "one row per observation cycle" is intent, not enforcement, and
-- the writer at libDb.ts:1048 is a bare INSERT. This is a snapshot log, not
-- a state register. No UNIQUE added; subject_id column-add only (above).
-- Per Alice Negative deprioritization, also skip the per-subject index.

-- CONFLICT TARGET CHANGED: tb_personal_profile — new UNIQUE(subject_id) (was implicit singleton)
-- Application sites: src/lib/libProfile.ts:312 (INSERT, currently relies on app-level "only one row" assumption)
ALTER TABLE tb_personal_profile ADD CONSTRAINT tb_personal_profile_subject_key
  UNIQUE (subject_id);

-- ============================================================================
-- BLOCK 5 — Indexes for common per-subject query patterns
-- ============================================================================

\echo '--- 030: BLOCK 5 — adding per-subject indexes ---'

-- Subject + date are the canonical access pattern for journal queries.
-- (subject_id alone is rarely useful; the composite supports both equality
-- on subject_id and range scans on scheduled_for.)
CREATE INDEX IF NOT EXISTS ix_questions_subject_scheduled_for
  ON tb_questions (subject_id, scheduled_for);

-- Most aggregation hotspots filter `WHERE q.subject_id = ?` then join children.
-- Indexing subject_id alone on each child speeds up the per-subject scan.
CREATE INDEX IF NOT EXISTS ix_responses_subject_id           ON tb_responses (subject_id);
CREATE INDEX IF NOT EXISTS ix_session_summaries_subject_id   ON tb_session_summaries (subject_id);
CREATE INDEX IF NOT EXISTS ix_session_events_subject_id      ON tb_session_events (subject_id);
CREATE INDEX IF NOT EXISTS ix_dynamical_signals_subject_id   ON tb_dynamical_signals (subject_id);
CREATE INDEX IF NOT EXISTS ix_motor_signals_subject_id       ON tb_motor_signals (subject_id);
CREATE INDEX IF NOT EXISTS ix_semantic_signals_subject_id    ON tb_semantic_signals (subject_id);
CREATE INDEX IF NOT EXISTS ix_process_signals_subject_id     ON tb_process_signals (subject_id);
CREATE INDEX IF NOT EXISTS ix_cross_session_subject_id       ON tb_cross_session_signals (subject_id);
CREATE INDEX IF NOT EXISTS ix_calibration_context_subject_id ON tb_calibration_context (subject_id);
CREATE INDEX IF NOT EXISTS ix_calibration_baselines_subject_id ON tb_calibration_baselines_history (subject_id);
CREATE INDEX IF NOT EXISTS ix_interaction_events_subject_id  ON tb_interaction_events (subject_id);
CREATE INDEX IF NOT EXISTS ix_reconstruction_residuals_subject_id ON tb_reconstruction_residuals (subject_id);
CREATE INDEX IF NOT EXISTS ix_signal_jobs_subject_id         ON tb_signal_jobs (subject_id);

-- ============================================================================
-- BLOCK 6 — Final post-migration verification
-- ============================================================================

\echo '--- 030: BLOCK 6 — post-migration constraint validation ---'
SELECT conname, conrelid::regclass AS tbl, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid IN (
   'alice.tb_questions'::regclass
  ,'alice.tb_session_delta'::regclass
  ,'alice.tb_semantic_baselines'::regclass
  ,'alice.tb_witness_states'::regclass
  ,'alice.tb_personal_profile'::regclass
)
  AND contype = 'u'
ORDER BY conrelid::text, conname;

\echo '--- 030: BLOCK 6 — post-migration row counts (must equal pre-counts) ---'
SELECT
   (SELECT count(*) FROM tb_questions)                    AS questions
  ,(SELECT count(*) FROM tb_responses)                    AS responses
  ,(SELECT count(*) FROM tb_session_summaries)            AS session_summaries
  ,(SELECT count(*) FROM tb_dynamical_signals)            AS dynamical
  ,(SELECT count(*) FROM tb_motor_signals)                AS motor
  ,(SELECT count(*) FROM tb_calibration_context)          AS calibration_context
  ,(SELECT count(*) FROM tb_calibration_baselines_history) AS calibration_baselines
  ,(SELECT count(*) FROM tb_interaction_events)           AS interaction_events
  ,(SELECT count(*) FROM tb_personal_profile)             AS personal_profile
;

\echo '--- 030: BLOCK 6 — distinct subject_id values (every table must show {1}) ---'
SELECT 'tb_questions'                    AS t, array_agg(DISTINCT subject_id ORDER BY subject_id) AS subjects FROM tb_questions
UNION ALL SELECT 'tb_responses',                array_agg(DISTINCT subject_id ORDER BY subject_id) FROM tb_responses
UNION ALL SELECT 'tb_session_summaries',        array_agg(DISTINCT subject_id ORDER BY subject_id) FROM tb_session_summaries
UNION ALL SELECT 'tb_dynamical_signals',        array_agg(DISTINCT subject_id ORDER BY subject_id) FROM tb_dynamical_signals
UNION ALL SELECT 'tb_motor_signals',            array_agg(DISTINCT subject_id ORDER BY subject_id) FROM tb_motor_signals
UNION ALL SELECT 'tb_calibration_context',      array_agg(DISTINCT subject_id ORDER BY subject_id) FROM tb_calibration_context
UNION ALL SELECT 'tb_interaction_events',       array_agg(DISTINCT subject_id ORDER BY subject_id) FROM tb_interaction_events
UNION ALL SELECT 'tb_personal_profile',         array_agg(DISTINCT subject_id ORDER BY subject_id) FROM tb_personal_profile
ORDER BY 1;

COMMIT;

\echo '--- 030: migration complete (subject-id columns added, backfilled, constrained) ---'

-- ============================================================================
-- BLOCK 7 — DROP empty subject-variant tables (DO NOT UNCOMMENT UNTIL STEP 9)
-- ============================================================================
--
-- These tables have zero rows on production today. They were the original
-- "subject variant" tables built in Phase 6a; their data shape folds into the
-- unified tables above.
--
--   tb_subject_responses           → folded into tb_responses (with subject_id)
--   tb_subject_session_summaries   → folded into tb_session_summaries
--   tb_scheduled_questions         → folded into tb_questions (with corpus_question_id column)
--
-- Step 9 of the unification plan is when these drops execute, AFTER:
--   - Step 4: libDb function signatures threaded with subject_id
--   - Step 5: all 47 query sites updated
--   - Step 6: 12 aggregation hotspots reworked + tested
--   - Step 7: lint rule landed
--   - Step 8: encryption uniformity applied
--
-- Reversibility note: every step before this drop block is reversible.
-- DROPs below are the point of no return. Keep commented until Step 9.
--
-- BEGIN;
-- DROP TABLE IF EXISTS tb_subject_responses;
-- DROP TABLE IF EXISTS tb_subject_session_summaries;
-- DROP TABLE IF EXISTS tb_scheduled_questions;
-- COMMIT;
--
-- After running the above in Step 9, also delete:
--   db/sql/session_summary_divergence.allow
-- (the divergence it documented dissolves under the unified schema).
