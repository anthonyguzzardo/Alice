/**
 * Durable signal pipeline worker.
 *
 * Replaces the fire-and-forget IIFE pattern in /api/respond and /api/calibrate
 * with a durable queue-and-poll loop. Jobs are enqueued in `tb_signal_jobs` in
 * the same transaction as the response/calibration save; this worker claims
 * them atomically (FOR UPDATE SKIP LOCKED) and runs the corresponding pipeline.
 *
 * Crash recovery: a job in RUNNING state when the process dies is re-queued
 * by the boot-time sweep. Existing idempotent guards in libSignalPipeline
 * (`if (!(await getXSignals(qid)))`) make per-stage replay safe.
 *
 * The worker starts on first import via `ensureWorkerStarted()`. In dev with
 * HMR, a `globalThis` flag prevents duplicate loops across hot-reloads.
 */

import sql, {
  claimNextSignalJob,
  markSignalJobCompleted,
  markSignalJobFailed,
  sweepStaleSignalJobs,
  SIGNAL_JOB_KIND,
  type SignalJobRow,
} from './libDb.ts';
import { computeAndPersistDerivedSignals } from './libSignalPipeline.ts';
import { computePriorDayDelta } from './libDailyDelta.ts';
import { runGeneration } from './libGenerate.ts';
import { renderWitnessState } from './libAliceNegative/libRenderWitness.ts';
import { embedResponse } from './libEmbeddings.ts';
import { runCalibrationExtraction } from './libCalibrationExtract.ts';
import { snapshotCalibrationBaselinesAfterSubmit } from './libCalibrationDrift.ts';
import { localDateStr } from './utlDate.ts';
import { logError } from './utlErrorLog.ts';

// ─── Tunables ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 1000;
/**
 * Boot sweep re-queues jobs left in RUNNING state for longer than this.
 * Must be longer than the longest plausible pipeline runtime, so jobs the
 * process is actively running are not falsely re-queued. Alice's full
 * pipeline runs in a few seconds; 10 minutes is generous.
 */
const STALE_RUNNING_AFTER_MS = 10 * 60 * 1000;

// ─── Backoff (pure, unit-tested) ───────────────────────────────────────────

/**
 * Quadratic backoff with a 5-minute cap.
 *
 *   attempts=1 ->  1s   (just-failed retry)
 *   attempts=2 ->  4s
 *   attempts=3 ->  9s
 *   attempts=4 -> 16s
 *   attempts=5 -> 25s
 *   attempts=6 -> 36s
 *   ...
 *   capped at 300_000 ms (5 minutes)
 *
 * Quadratic, not exponential, because 2^n explodes past minutes by attempt 4
 * and Alice's job set is small. Min floor of 1000 ms protects against
 * accidental zero-attempt calls.
 */
export function computeBackoffMs(attempts: number): number {
  const base = Math.min(attempts * attempts * 1000, 300_000);
  return Math.max(base, 1000);
}

// ─── Worker lifecycle ──────────────────────────────────────────────────────

const WORKER_FLAG = '__alice_signal_worker_started';

interface WorkerGlobals {
  [WORKER_FLAG]?: boolean;
}

let shouldStop = false;
let activeJob: Promise<void> | null = null;

/**
 * Idempotent worker boot. Safe to call from multiple modules at import time;
 * the first call wins, subsequent calls return immediately. The `globalThis`
 * flag survives HMR reloads in dev so the loop is not duplicated.
 */
export async function ensureWorkerStarted(): Promise<void> {
  const g = globalThis as unknown as WorkerGlobals;
  if (g[WORKER_FLAG]) return;
  g[WORKER_FLAG] = true;

  // Boot-time sweep: re-queue jobs left in RUNNING state from a prior process.
  try {
    const recovered = await sweepStaleSignalJobs(STALE_RUNNING_AFTER_MS);
    if (recovered > 0) {
      console.log(`[worker] boot sweep recovered ${recovered} stale running job(s)`);
    }
  } catch (err) {
    logError('worker.bootSweep', err);
  }

  console.log('[worker] signal job worker started');
  // Kick off the poll loop.
  void pollLoop();
}

/**
 * Graceful shutdown: stop polling and wait for any in-flight job to finish.
 * Used by tests and by SIGTERM handling. Has no effect if the worker was
 * never started.
 */
export async function stopWorker(): Promise<void> {
  shouldStop = true;
  if (activeJob) {
    await activeJob.catch(() => {
      /* swallow — error already logged */
    });
  }
  const g = globalThis as unknown as WorkerGlobals;
  g[WORKER_FLAG] = false;
}

async function pollLoop(): Promise<void> {
  while (!shouldStop) {
    try {
      const job = await claimNextSignalJob();
      if (job) {
        activeJob = runJob(job);
        await activeJob;
        activeJob = null;
      } else {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      logError('worker.pollLoop', err);
      // Don't tight-loop on a persistent failure (e.g. DB down).
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Job dispatch ──────────────────────────────────────────────────────────

async function runJob(job: SignalJobRow): Promise<void> {
  const ctx = { signal_job_id: job.signal_job_id, question_id: job.question_id };
  try {
    if (job.signal_job_kind_id === SIGNAL_JOB_KIND.RESPONSE_PIPELINE) {
      await runResponsePipeline(job);
    } else if (job.signal_job_kind_id === SIGNAL_JOB_KIND.CALIBRATION_PIPELINE) {
      await runCalibrationPipeline(job);
    } else {
      throw new Error(`Unknown signal_job_kind_id: ${String(job.signal_job_kind_id)}`);
    }
    await markSignalJobCompleted(job.signal_job_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const backoff = computeBackoffMs(job.attempts);
    await markSignalJobFailed(job.signal_job_id, msg, backoff);
    logError(`worker.runJob.kind${String(job.signal_job_kind_id)}`, err, ctx);
  }
}

/**
 * Owner journal pipeline. Each stage is wrapped in try/catch so one stage's
 * failure doesn't fail the whole job (preserving the existing IIFE semantics
 * from respond.ts). Only catastrophic failures (DB unavailable etc.) propagate
 * out of this function and trigger a retry.
 */
async function runResponsePipeline(job: SignalJobRow): Promise<void> {
  const ctx = { signal_job_id: job.signal_job_id, question_id: job.question_id };

  try { await computePriorDayDelta(localDateStr()); }
  catch (err) { logError('worker.daily-delta', err, ctx); }

  try { await runGeneration(); }
  catch (err) { logError('worker.generation', err, ctx); }

  try { await renderWitnessState(); }
  catch (err) { logError('worker.witness', err, ctx); }

  // Embed: look up response + question text by question_id.
  // The semantic baseline updater inside computeAndPersistDerivedSignals
  // queries tb_embeddings via HNSW for topic-matched z-scores, so the
  // embedding must exist before derived signals run.
  try {
    const rows = await sql`
      SELECT r.response_id AS "responseId",
             r.text AS "responseText",
             q.text AS "questionText",
             q.scheduled_for AS "scheduledFor"
      FROM tb_responses r
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE q.question_id = ${job.question_id}
      LIMIT 1
    `;
    const r = rows[0] as { responseId: number; responseText: string; questionText: string; scheduledFor: string | null } | undefined;
    if (r) {
      const dateStr = r.scheduledFor ?? localDateStr();
      await embedResponse(r.responseId, r.questionText, r.responseText, dateStr);
    }
  } catch (err) {
    logError('worker.embed', err, ctx);
  }

  await computeAndPersistDerivedSignals(job.question_id);
}

/**
 * Calibration pipeline. Mirrors the post-save sequence from /api/calibrate:
 * extract life-context tags, compute derived signals, snapshot drift baseline.
 */
async function runCalibrationPipeline(job: SignalJobRow): Promise<void> {
  const ctx = { signal_job_id: job.signal_job_id, question_id: job.question_id };

  try {
    const rows = await sql`
      SELECT q.text AS prompt, r.text AS response_text
      FROM tb_questions q
      JOIN tb_responses r ON r.question_id = q.question_id
      WHERE q.question_id = ${job.question_id}
      LIMIT 1
    `;
    const r = rows[0] as { prompt: string; response_text: string } | undefined;
    if (r) {
      await runCalibrationExtraction(job.question_id, r.response_text, r.prompt);
    }
  } catch (err) {
    logError('worker.calibration-extraction', err, ctx);
  }

  try {
    await computeAndPersistDerivedSignals(job.question_id);
  } catch (err) {
    logError('worker.calibration-derived-signals', err, ctx);
  }

  try {
    const deviceType = (job.params_json?.deviceType as string | null | undefined) ?? null;
    await snapshotCalibrationBaselinesAfterSubmit(deviceType);
  } catch (err) {
    logError('worker.calibration-drift', err, ctx);
  }
}
