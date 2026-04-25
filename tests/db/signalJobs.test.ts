import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql, {
  enqueueSignalJob,
  claimNextSignalJob,
  markSignalJobCompleted,
  markSignalJobFailed,
  sweepStaleSignalJobs,
  getSignalJobById,
  countOpenSignalJobs,
  SIGNAL_JOB_KIND,
  SIGNAL_JOB_STATUS,
} from '../../src/lib/libDb.ts';

/**
 * Integration tests for the durable signal-job queue.
 *
 * These hit a real Postgres (containerized) — pg-mem does not implement
 * FOR UPDATE SKIP LOCKED, partial unique indexes, or interval arithmetic
 * the same way Postgres does, so it would silently lie about queue
 * semantics. The whole point of these tests is to verify the contract
 * production relies on.
 *
 * The container is started once by `tests/db/globalSetup.ts` and the
 * connection URL is in process.env.ALICE_PG_URL. Each test starts from
 * a clean tb_signal_jobs.
 */

const SOME_QUESTION_ID = 9001;
const ANOTHER_QUESTION_ID = 9002;

beforeAll(async () => {
  // Sanity: we should be pointed at a test container, not the dev DB.
  // The container's URL contains '@host:port'; the dev DB is on the
  // default port via 'postgres://localhost/alice'. If something is
  // misconfigured we want to fail loudly, not corrupt dev data.
  if (!process.env.ALICE_PG_URL?.includes('@')) {
    throw new Error(
      'tests/db expected ALICE_PG_URL to be set by globalSetup; got: ' +
        String(process.env.ALICE_PG_URL),
    );
  }

  // No tb_questions rows needed: the schema uses logical FKs only, and
  // tb_signal_jobs.question_id has no physical FK constraint. The test
  // ids are just bare ints used to discriminate jobs from one another.
});

beforeEach(async () => {
  await sql`TRUNCATE tb_signal_jobs RESTART IDENTITY`;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe('enqueueSignalJob', () => {
  it('inserts a queued job and returns its id', async () => {
    const id = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);

    const row = await getSignalJobById(id);
    expect(row).not.toBeNull();
    expect(row!.question_id).toBe(SOME_QUESTION_ID);
    expect(row!.signal_job_kind_id).toBe(SIGNAL_JOB_KIND.RESPONSE_PIPELINE);
    expect(row!.signal_job_status_id).toBe(SIGNAL_JOB_STATUS.QUEUED);
    expect(row!.attempts).toBe(0);
  });

  it('is idempotent for (question_id, kind) — duplicate enqueue returns same id', async () => {
    const a = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    const b = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    expect(a).toBe(b);

    const count = await countOpenSignalJobs();
    expect(count).toBe(1);
  });

  it('allows different kinds for the same question', async () => {
    const a = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    const b = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.CALIBRATION_PIPELINE,
    });
    expect(a).not.toBe(b);
  });

  it('persists params_json verbatim', async () => {
    const id = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.CALIBRATION_PIPELINE,
      params: { deviceType: 'macbook' },
    });
    const row = await getSignalJobById(id);
    expect(row!.params_json).toEqual({ deviceType: 'macbook' });
  });
});

describe('claimNextSignalJob', () => {
  it('returns null when no queued jobs exist', async () => {
    const claimed = await claimNextSignalJob();
    expect(claimed).toBeNull();
  });

  it('claims the only queued job, marks it RUNNING, increments attempts', async () => {
    const id = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    const claimed = await claimNextSignalJob();
    expect(claimed).not.toBeNull();
    expect(claimed!.signal_job_id).toBe(id);
    expect(claimed!.signal_job_status_id).toBe(SIGNAL_JOB_STATUS.RUNNING);
    expect(claimed!.attempts).toBe(1);
    expect(claimed!.claimed_at).not.toBeNull();
  });

  it('does not claim jobs whose next_run_at is in the future', async () => {
    const id = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    // Push next_run_at 1 minute into the future
    await sql`
      UPDATE tb_signal_jobs
      SET next_run_at = CURRENT_TIMESTAMP + INTERVAL '1 minute'
      WHERE signal_job_id = ${id}
    `;
    const claimed = await claimNextSignalJob();
    expect(claimed).toBeNull();
  });

  it('processes jobs in FIFO order by next_run_at', async () => {
    const a = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    const b = await enqueueSignalJob({
      questionId: ANOTHER_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    // Make `a` older
    await sql`
      UPDATE tb_signal_jobs
      SET next_run_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
      WHERE signal_job_id = ${a}
    `;
    const claimed = await claimNextSignalJob();
    expect(claimed!.signal_job_id).toBe(a);
    const claimed2 = await claimNextSignalJob();
    expect(claimed2!.signal_job_id).toBe(b);
  });

  it('two concurrent claimers grab different jobs (FOR UPDATE SKIP LOCKED)', async () => {
    // The load-bearing test. If SKIP LOCKED isn't in the query, both claimers
    // will fight for row 1 and one will get nothing or both will see the
    // same job. The contract is: each call returns a distinct row.
    const a = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    const b = await enqueueSignalJob({
      questionId: ANOTHER_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });

    const [r1, r2] = await Promise.all([claimNextSignalJob(), claimNextSignalJob()]);
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    const ids = new Set([r1!.signal_job_id, r2!.signal_job_id]);
    expect(ids.size).toBe(2);
    expect(ids.has(a)).toBe(true);
    expect(ids.has(b)).toBe(true);
  });

  it('a third concurrent claim returns null when only 2 jobs exist', async () => {
    await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    await enqueueSignalJob({
      questionId: ANOTHER_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });

    const [r1, r2, r3] = await Promise.all([
      claimNextSignalJob(),
      claimNextSignalJob(),
      claimNextSignalJob(),
    ]);
    const claimed = [r1, r2, r3].filter((r) => r !== null);
    expect(claimed.length).toBe(2);
    const nullCount = [r1, r2, r3].filter((r) => r === null).length;
    expect(nullCount).toBe(1);
  });
});

describe('markSignalJobCompleted', () => {
  it('flips status to COMPLETED and stamps completed_at', async () => {
    const id = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    await claimNextSignalJob();
    await markSignalJobCompleted(id);

    const row = await getSignalJobById(id);
    expect(row!.signal_job_status_id).toBe(SIGNAL_JOB_STATUS.COMPLETED);
    expect(row!.completed_at).not.toBeNull();
    expect(row!.last_error).toBeNull();
  });
});

describe('markSignalJobFailed', () => {
  it('reschedules with backoff when attempts < max_attempts', async () => {
    const id = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
      maxAttempts: 3,
    });
    await claimNextSignalJob();          // attempts -> 1
    await markSignalJobFailed(id, 'oops', 5000);

    const row = await getSignalJobById(id);
    expect(row!.signal_job_status_id).toBe(SIGNAL_JOB_STATUS.QUEUED);
    expect(row!.last_error).toBe('oops');
    expect(row!.next_run_at.getTime()).toBeGreaterThan(Date.now() + 4000);
    expect(row!.claimed_at).toBeNull();
  });

  it('dead-letters when attempts >= max_attempts', async () => {
    const id = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
      maxAttempts: 1,
    });
    await claimNextSignalJob();          // attempts -> 1, == max_attempts
    await markSignalJobFailed(id, 'gave up', 5000);

    const row = await getSignalJobById(id);
    expect(row!.signal_job_status_id).toBe(SIGNAL_JOB_STATUS.DEAD_LETTER);
    expect(row!.last_error).toBe('gave up');
  });

  it('after dead-letter, idempotent enqueue creates a NEW job (does not collide)', async () => {
    // Partial unique index excludes dead_letter so admin can re-enqueue
    // after manual investigation.
    const a = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
      maxAttempts: 1,
    });
    await claimNextSignalJob();
    await markSignalJobFailed(a, 'fatal', 5000);

    const b = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    expect(b).not.toBe(a);
    const newRow = await getSignalJobById(b);
    expect(newRow!.signal_job_status_id).toBe(SIGNAL_JOB_STATUS.QUEUED);
  });
});

describe('sweepStaleSignalJobs', () => {
  it('re-queues RUNNING jobs older than the stale threshold', async () => {
    const id = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    await claimNextSignalJob();
    // Backdate claimed_at past the stale threshold
    await sql`
      UPDATE tb_signal_jobs
      SET claimed_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
      WHERE signal_job_id = ${id}
    `;
    const recovered = await sweepStaleSignalJobs(10 * 60 * 1000);
    expect(recovered).toBe(1);

    const row = await getSignalJobById(id);
    expect(row!.signal_job_status_id).toBe(SIGNAL_JOB_STATUS.QUEUED);
    expect(row!.claimed_at).toBeNull();
  });

  it('does not re-queue RUNNING jobs whose claim is fresh', async () => {
    await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    await claimNextSignalJob();
    const recovered = await sweepStaleSignalJobs(10 * 60 * 1000);
    expect(recovered).toBe(0);
  });

  it('does not touch COMPLETED or DEAD_LETTER jobs', async () => {
    const a = await enqueueSignalJob({
      questionId: SOME_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
    });
    await claimNextSignalJob();
    await markSignalJobCompleted(a);

    const b = await enqueueSignalJob({
      questionId: ANOTHER_QUESTION_ID,
      kindId: SIGNAL_JOB_KIND.RESPONSE_PIPELINE,
      maxAttempts: 1,
    });
    await claimNextSignalJob();
    await markSignalJobFailed(b, 'fatal', 1000);

    // Backdate everything past the threshold to verify status filter, not time filter
    await sql`UPDATE tb_signal_jobs SET claimed_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'`;
    const recovered = await sweepStaleSignalJobs(10 * 60 * 1000);
    expect(recovered).toBe(0);
  });
});
