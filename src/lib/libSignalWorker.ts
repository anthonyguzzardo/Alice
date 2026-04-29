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
  stampEngineProvenance,
  getQuestionTextById,
  getResponseText,
  SIGNAL_JOB_KIND,
  type SignalJobRow,
} from './libDb.ts';
import { computeAndPersistDerivedSignals } from './libSignalPipeline.ts';
import { computePriorDayDelta } from './libDailyDelta.ts';
import { embedResponse, isTeiAvailable } from './libEmbeddings.ts';
import { snapshotCalibrationBaselinesAfterSubmit } from './libCalibrationDrift.ts';
import { getEngineProvenanceId } from './libEngineProvenance.ts';
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
 *
 * Also installs a SIGTERM/SIGINT handler so a `systemctl stop alice` (or
 * Ctrl-C in dev) waits for an in-flight job to finish before exiting. Without
 * this, a deploy mid-pipeline would leave a job in `running` state until the
 * 10-minute boot sweep on the next start. The handler is installed once
 * (guarded by the same flag) so HMR reloads don't stack up listeners.
 */
export async function ensureWorkerStarted(): Promise<void> {
  const g = globalThis as unknown as WorkerGlobals;
  if (g[WORKER_FLAG]) return;
  g[WORKER_FLAG] = true;

  installShutdownHandlers();

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

function installShutdownHandlers(): void {
  const onShutdown = (signal: NodeJS.Signals): void => {
    console.log(`[worker] received ${signal}, draining in-flight job and exiting`);
    void (async () => {
      try {
        await stopWorker();
      } catch (err) {
        logError('worker.shutdown', err);
      } finally {
        process.exit(0);
      }
    })();
  };
  process.once('SIGTERM', onShutdown);
  process.once('SIGINT', onShutdown);
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
  const ctx = { signal_job_id: job.signal_job_id, subject_id: job.subject_id, question_id: job.question_id };
  try {
    if (job.signal_job_kind_id === SIGNAL_JOB_KIND.RESPONSE_PIPELINE) {
      await runResponsePipeline(job);
    } else if (job.signal_job_kind_id === SIGNAL_JOB_KIND.CALIBRATION_PIPELINE) {
      await runCalibrationPipeline(job);
    } else {
      throw new Error(`Unknown signal_job_kind_id: ${String(job.signal_job_kind_id)}`);
    }

    // Stamp engine provenance on every Rust-derived signal row written by this
    // job. Idempotent — only updates rows whose engine_provenance_id IS NULL.
    // Runs AFTER the pipeline completes (and BEFORE markSignalJobCompleted) so
    // a completed job always has every signal row stamped with the binary that
    // produced it. If provenance lookup fails (e.g. .node missing), we skip
    // stamping rather than fail the job — a missing stamp is recoverable
    // (re-run after rebuild); a failed signal save isn't.
    try {
      const provenanceId = await getEngineProvenanceId();
      if (provenanceId !== null) {
        await stampEngineProvenance(job.subject_id, job.question_id, provenanceId);
      }
    } catch (err) {
      logError('worker.stampProvenance', err, ctx);
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
 * Journal response pipeline (owner + subject; symmetric since INC-023).
 * Each stage is wrapped in try/catch so one stage's failure doesn't fail
 * the whole job. Only catastrophic failures (DB unavailable etc.) propagate
 * out of this function and trigger a retry.
 */
async function runResponsePipeline(job: SignalJobRow): Promise<void> {
  const ctx = { signal_job_id: job.signal_job_id, subject_id: job.subject_id, question_id: job.question_id };

  try { await computePriorDayDelta(job.subject_id, localDateStr()); }
  catch (err) { logError('worker.daily-delta', err, ctx); }

  // Embed: defer cleanly if TEI is offline. Owner local dev runs TEI via
  // `npm run dev:full`; prod has no TEI by design (no Anthropic / no embed
  // service on prod). On prod the worker logs and skips here; operator drains
  // pending embeds later from the laptop via `npm run embed` (all subjects)
  // or `npm run backfill -- --subject-id N` (one). Other stages aren't blocked.
  try {
    if (!(await isTeiAvailable())) {
      console.log(
        `[embed] TEI offline — embedding deferred for response on q${job.question_id}. ` +
        `Run \`npm run dev:full\` (or start TEI separately) and then \`npm run backfill\` to drain pending embeds.`
      );
    } else {
      const qInfo = await getQuestionTextById(job.subject_id, job.question_id);
      const responseText = await getResponseText(job.subject_id, job.question_id);
      const [meta] = await sql`
        SELECT response_id AS "responseId", scheduled_for AS "scheduledFor"
        FROM tb_responses r
        JOIN tb_questions q ON r.question_id = q.question_id
        WHERE q.subject_id = ${job.subject_id} AND q.question_id = ${job.question_id}
        LIMIT 1
      ` as [{ responseId: number; scheduledFor: string | null }];
      if (qInfo && responseText !== null && meta) {
        const dateStr = meta.scheduledFor ?? localDateStr();
        await embedResponse(job.subject_id, meta.responseId, qInfo.text, responseText, dateStr);
      }
    }
  } catch (err) {
    logError('worker.embed', err, ctx);
  }

  await computeAndPersistDerivedSignals(job.subject_id, job.question_id);
}

/**
 * Calibration pipeline (owner + subject; symmetric since INC-023). Computes
 * derived signals + snapshots the drift baseline.
 */
async function runCalibrationPipeline(job: SignalJobRow): Promise<void> {
  const ctx = { signal_job_id: job.signal_job_id, subject_id: job.subject_id, question_id: job.question_id };

  try {
    await computeAndPersistDerivedSignals(job.subject_id, job.question_id);
  } catch (err) {
    logError('worker.calibration-derived-signals', err, ctx);
  }

  try {
    const deviceType = (job.params_json?.deviceType as string | null | undefined) ?? null;
    await snapshotCalibrationBaselinesAfterSubmit(job.subject_id, deviceType);
  } catch (err) {
    logError('worker.calibration-drift', err, ctx);
  }
}
