/**
 * Hotspot A — libCalibrationDrift.ts:87–129. The calibration baseline
 * computation, with two branches:
 *
 *   A1: Global baseline (no device_type filter). AVG over 12 session-
 *       summary fields + COUNT(*) across all calibration sessions for
 *       a subject.
 *
 *   A2: Device-typed baseline. Same AVG/COUNT, additionally filtered by
 *       s.device_type = ${deviceType}.
 *
 * Origin: canonical Step 0 §C list. See db/sql/migrations/030_STEP6_PLAN.md.
 *
 * What this verifies:
 *   computeBaselineSnapshot(subjectId, deviceType?) reads tb_session_summaries
 *   joined to tb_questions, filtered to calibration sessions (q.question_source_id
 *   = 3) for the requested subject. The 12 AVG outputs become the calibration
 *   baseline persisted to tb_calibration_baselines_history. Subsequent drift
 *   measurements are computed relative to this baseline.
 *
 *   This test invokes the full public path: snapshotCalibrationBaselinesAfterSubmit
 *   (which calls computeBaselineSnapshot for both A1 and A2 branches, then
 *   saves a row to tb_calibration_baselines_history). We assert the persisted
 *   AVG fields reflect ONLY the requested subject's calibration sessions.
 *
 * Silent-corruption failure mode (what this test guards against):
 *   The calibration baseline IS the reference frame for drift analysis. If
 *   the AVG SELECT pools across subjects, every subsequent drift snapshot
 *   for this subject is computed relative to a chimerized population mean.
 *   Drift z-scores become meaningless: the baseline is supposed to track
 *   "this person's neutral writing state" but is actually tracking "the
 *   midpoint between this person's neutral state and another person's."
 *   Drift trends after that point are population dynamics, not within-
 *   subject dynamics — the entire drift trajectory is invalid.
 *
 *   The two-branch structure (A1 + A2) means the failure mode applies to
 *   both global and per-device baselines. A scoping bug in one branch but
 *   not the other would produce inconsistent drift signals across views.
 *
 * Rule 1 (LIMIT / heap order): N/A. libCalibrationDrift.ts has zero
 * LIMIT clauses; pure AVG/COUNT aggregation. Standard fixture insertion
 * order works.
 *
 * Mutation log (verified during test development, see report):
 *   A1: WHERE q.subject_id removed from no-device branch → AVG fields in
 *       the global tb_calibration_baselines_history row reflect pooled
 *       owner+other means.
 *   A2: WHERE q.subject_id removed from device branch → AVG fields in the
 *       device-typed row reflect pooled means. Same failure shape as A1.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { snapshotCalibrationBaselinesAfterSubmit } from '../../../src/lib/libCalibrationDrift.ts';
import {
  OWNER_ID,
  OTHER_ID,
  OWNER_PROFILE,
  OTHER_PROFILE,
  FIXTURE_OWNED_SUBJECT_IDS,
  cleanupFixtureRows,
  seedTwoSubjects,
  insertCalibrationSessions,
  insertJournalSession,
} from './_fixtures.ts';

const TEST_DEVICE = 'macbook-test';

beforeAll(async () => {
  if (!process.env.ALICE_PG_URL?.includes('@')) {
    throw new Error(
      'tests/db expected ALICE_PG_URL to be set by globalSetup; got: ' +
        String(process.env.ALICE_PG_URL),
    );
  }
});

beforeEach(async () => {
  await cleanupFixtureRows(sql);
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe('hotspot A — libCalibrationDrift baseline scoping', () => {
  it('computes AVG / COUNT over only the requested subject\'s calibration sessions, in both global and device-typed branches', async () => {
    await seedTwoSubjects(sql);

    // Five calibration sessions per subject, all with the same device_type
    // so the A2 branch finds rows for both. The function under test is
    // invoked with subjectId=OWNER_ID; OTHER's rows are the contamination
    // source.
    await insertCalibrationSessions(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      count: 5,
      startIndex: 0,
      deviceType: TEST_DEVICE,
    });
    await insertCalibrationSessions(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      count: 5,
      startIndex: 5,             // distinct dates from owner's
      deviceType: TEST_DEVICE,   // SAME device — exercises A2 cross-subject path
    });

    // The function also reads tb_session_summaries for journal sessions
    // (via getJournalDispersion → hotspot B). We provide owner journal
    // sessions so dispersion has data — but we only assert on the
    // calibration AVGs the function persists, not the drift_magnitude
    // (which depends on hotspot B's correctness and is tested separately).
    for (let i = 0; i < 5; i++) {
      await insertJournalSession(sql, {
        subjectId: OWNER_ID,
        profile: OWNER_PROFILE,
        scheduledFor: `2026-03-${String(i + 1).padStart(2, '0')}`,
        sessionIndex: 100 + i,
        questionSourceId: 1,
        deviceType: TEST_DEVICE,
      });
    }

    // ── Run the production path ──
    // snapshotCalibrationBaselinesAfterSubmit invokes computeBaselineSnapshot
    // TWICE: once with deviceType=null (A1, global), once with the supplied
    // device (A2). Each result is persisted as a row in
    // tb_calibration_baselines_history.
    await snapshotCalibrationBaselinesAfterSubmit(OWNER_ID, TEST_DEVICE);

    // ── Read back the snapshots for the test-owner subject ──
    const snapshots = await sql<Array<{
      subject_id: number;
      device_type: string | null;
      calibration_session_count: number;
      avg_first_keystroke_ms: number | null;
      avg_commitment_ratio: number | null;
      avg_duration_ms: number | null;
      avg_pause_count: number | null;
      avg_chars_per_minute: number | null;
      avg_p_burst_length: number | null;
      avg_iki_mean: number | null;
      avg_hold_time_mean: number | null;
      avg_flight_time_mean: number | null;
    }>>`
      SELECT subject_id, device_type, calibration_session_count,
             avg_first_keystroke_ms, avg_commitment_ratio, avg_duration_ms,
             avg_pause_count, avg_chars_per_minute, avg_p_burst_length,
             avg_iki_mean, avg_hold_time_mean, avg_flight_time_mean
      FROM tb_calibration_baselines_history
      WHERE subject_id = ANY(${FIXTURE_OWNED_SUBJECT_IDS as unknown as number[]}::int[])
      ORDER BY device_type NULLS FIRST, calibration_history_id ASC
    `;

    // Two rows: global (device_type=null) and device-specific.
    expect(snapshots.length).toBe(2);
    const [globalSnap, deviceSnap] = snapshots;
    expect(globalSnap!.subject_id).toBe(OWNER_ID);
    expect(globalSnap!.device_type).toBeNull();
    expect(deviceSnap!.subject_id).toBe(OWNER_ID);
    expect(deviceSnap!.device_type).toBe(TEST_DEVICE);

    // ── A1 branch (global) verification ──
    // OWNER has 5 calibration sessions; OTHER has 5. With correct scoping,
    // the global baseline averages over OWNER's 5 only. Pooled (10 sessions)
    // would produce midpoint values an order of magnitude off — every AVG
    // sits at half of (OWNER_value + OTHER_value) which equals 5.5x the
    // owner value (since OTHER is 10x).
    expect(globalSnap!.calibration_session_count).toBe(5);
    expect(globalSnap!.avg_first_keystroke_ms).toBe(OWNER_PROFILE.firstKeystrokeMs);
    expect(globalSnap!.avg_iki_mean).toBe(OWNER_PROFILE.ikiMean);
    expect(globalSnap!.avg_hold_time_mean).toBe(OWNER_PROFILE.holdTimeMean);
    expect(globalSnap!.avg_flight_time_mean).toBe(OWNER_PROFILE.flightTimeMean);
    expect(globalSnap!.avg_p_burst_length).toBe(OWNER_PROFILE.avgPBurstLength);
    expect(globalSnap!.avg_duration_ms).toBe(OWNER_PROFILE.totalDurationMs);
    expect(globalSnap!.avg_pause_count).toBe(OWNER_PROFILE.pauseCount);
    // commitment_ratio is float-precision sensitive; use toBeCloseTo.
    expect(globalSnap!.avg_commitment_ratio!).toBeCloseTo(OWNER_PROFILE.commitmentRatio, 5);

    // ── A2 branch (device-typed) verification ──
    // OWNER and OTHER both have 5 calibration sessions on TEST_DEVICE. With
    // correct scoping the device-typed baseline averages over OWNER's 5
    // device-typed sessions only.
    expect(deviceSnap!.calibration_session_count).toBe(5);
    expect(deviceSnap!.avg_first_keystroke_ms).toBe(OWNER_PROFILE.firstKeystrokeMs);
    expect(deviceSnap!.avg_iki_mean).toBe(OWNER_PROFILE.ikiMean);
    expect(deviceSnap!.avg_hold_time_mean).toBe(OWNER_PROFILE.holdTimeMean);
    expect(deviceSnap!.avg_flight_time_mean).toBe(OWNER_PROFILE.flightTimeMean);

    // ── No spurious snapshots ──
    // OTHER never had snapshotCalibrationBaselinesAfterSubmit called for
    // it, so there should be no rows in tb_calibration_baselines_history
    // for OTHER among the fixture subjects.
    const otherRows = snapshots.filter(s => s.subject_id === OTHER_ID);
    expect(otherRows).toEqual([]);
  });
});
