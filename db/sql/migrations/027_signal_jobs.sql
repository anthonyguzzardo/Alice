-- 027_signal_jobs.sql
-- Durable signal pipeline job queue.
-- Replaces the fire-and-forget IIFE pattern in /api/respond and /api/calibrate.
-- See GOTCHAS.md historical entry for the prior pattern.
--
-- Design notes:
--   - One job per session (response or calibration), not one per signal family.
--     The existing pipeline already has idempotent guards (`if (!(await getXSignals(qid)))`),
--     so retries replay safely. Per-family granularity would multiply schema and
--     coordination cost without commensurate observability gain.
--   - Atomic claim via FOR UPDATE SKIP LOCKED. Backoff via next_run_at.
--   - Dead-letter excluded from idempotent unique constraint so admin can
--     re-enqueue after manual investigation.

SET search_path = alice, public;

-- ============================================================================
-- ENUMS
-- ============================================================================

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

-- PURPOSE: which pipeline a job runs
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

-- ============================================================================
-- FACT TABLE
-- ============================================================================

-- PURPOSE: durable queue of pipeline jobs that survive process crashes
-- USE CASE: enqueued in the same transaction as the response/calibration save.
--           A worker loop atomically claims jobs (FOR UPDATE SKIP LOCKED),
--           runs the corresponding pipeline, marks completed or schedules retry.
--           Boot-time sweep re-queues 'running' jobs that were in flight when
--           the process died.
-- MUTABILITY: row-level state machine (queued -> running -> completed | failed -> queued | dead_letter)
-- REFERENCED BY: none (leaf)
-- FOOTER: created + modified
CREATE TABLE IF NOT EXISTS tb_signal_jobs (
   signal_job_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  ,question_id           INT NOT NULL                                   -- logical FK to tb_questions
  ,subject_id            INT                                            -- logical FK to tb_subjects (NULL for owner)
  ,signal_job_kind_id    SMALLINT NOT NULL DEFAULT 1                    -- logical FK to te_signal_job_kind
  ,signal_job_status_id  SMALLINT NOT NULL DEFAULT 1                    -- logical FK to te_signal_job_status
  ,attempts              INT NOT NULL DEFAULT 0
  ,max_attempts          INT NOT NULL DEFAULT 5
  ,next_run_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,claimed_at            TIMESTAMPTZ
  ,completed_at          TIMESTAMPTZ
  ,last_error            TEXT
  ,params_json           JSONB                                          -- kind-specific params (e.g., {deviceType} for calibration)
  -- footer
  ,dttm_created_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,created_by            TEXT NOT NULL DEFAULT 'system'
  ,dttm_modified_utc     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,modified_by           TEXT NOT NULL DEFAULT 'system'
);

-- Atomic-claim path: SELECT ... WHERE status = 1 AND next_run_at <= NOW()
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
