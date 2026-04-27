/**
 * Hotspot B — libCalibrationDrift.ts:150–171. getJournalDispersion: per-
 * dimension sample stddev across the subject's JOURNAL sessions (note:
 * journal, not calibration, despite living in libCalibrationDrift). Used
 * as the per-dimension scaling denominator in computeDriftMagnitude
 * (libCalibrationDrift.ts:173–198).
 *
 * Origin: canonical Step 0 §C list. See db/sql/migrations/030_STEP6_PLAN.md.
 *
 * What this verifies:
 *   getJournalDispersion(subjectId, field) reads tb_session_summaries
 *   joined to tb_questions, filters to journal sessions
 *   (q.question_source_id != 3) for the requested subject, computes
 *   sample stddev of the named field. Returns null if fewer than 3 rows.
 *
 *   computeDriftMagnitude consumes this as the denominator in the per-
 *   dimension drift z-score: z = (cur_baseline - prev_baseline) / dispersion.
 *   The drift_magnitude written to tb_calibration_baselines_history is
 *   sqrt(weighted mean of z² across dims).
 *
 * Silent-corruption failure mode (what this test guards against):
 *   The dispersion is the personal-history scaling factor for drift
 *   z-scores. If pooled across subjects, two subjects with very different
 *   baseline timings (owner ~100ms IKI, other ~1000ms IKI) inflate the
 *   stddev by an order of magnitude. The same per-dimension delta in the
 *   calibration baseline gets divided by a much larger denominator —
 *   drift z-scores shrink, every drift point looks artificially stable,
 *   real drift in the calibration reference frame becomes invisible.
 *
 *   In the existing fixture: owner journal iki_mean values [90, 95, 100,
 *   105, 110] have sample stddev ≈ 7.91. Pooled with other's [900, 950,
 *   1000, 1050, 1100] the stddev jumps to ≈ 474 — a 60x inflation. A
 *   given calibration delta would produce z ≈ 12.6 with correct scoping
 *   vs z ≈ 0.21 with pooled scoping. Drift trajectories computed with
 *   the wrong dispersion are off by 60x in scale.
 *
 *   getJournalDispersion is internal; the public surface that consumes
 *   it is snapshotCalibrationBaselinesAfterSubmit, which writes
 *   drift_magnitude to the new history row. We assert on that
 *   drift_magnitude with a threshold that cleanly separates the correct
 *   value (~9) from the contaminated value (~0.15).
 *
 * Rule 1 (LIMIT / heap order): N/A. getJournalDispersion has no LIMIT
 * clause; pure aggregation reading all matching journal rows.
 *
 * Carry-forward COUNT discipline: A and B are paired hotspots in the same
 * file. A asserted on COUNT(*) as the cleanest single signal; B asserts
 * on the magnitude of drift_magnitude itself (60x scaling difference)
 * because dispersion is consumed AS a magnitude, not a count.
 *
 * Mutation log (verified during test development, see report):
 *   B1: WHERE q.subject_id removed from getJournalDispersion → drift_magnitude
 *       on the second snapshot is ~0.15 (small, owing to inflated pooled
 *       dispersion) instead of ~9 (large, owing to correct owner-only
 *       dispersion).
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

describe('hotspot B — libCalibrationDrift dispersion scoping', () => {
  it('computes per-dimension stddev over only the requested subject\'s journal sessions, driving correct drift z-scores', async () => {
    await seedTwoSubjects(sql);

    // ── Journal sessions: the population getJournalDispersion reads ──
    // We need WITHIN-SUBJECT VARIANCE in iki_mean, not just identical
    // values, so the stddev is meaningful. The default fixture profile
    // gives constant iki_mean per subject; we insert sessions then UPDATE
    // their inter_key_interval_mean to a series of distinct values.
    //
    //   Owner journal iki_mean values: [90, 95, 100, 105, 110]
    //     → sample stddev ≈ √(250/4) = 7.91
    //   Other journal iki_mean values: [900, 950, 1000, 1050, 1100]
    //     → sample stddev ≈ 79.1
    //   Pooled (all 10 values): mean = 550, stddev ≈ 474
    //   Owner-only vs pooled scaling factor: ~60x
    const ownerIkiSeries = [90, 95, 100, 105, 110];
    const otherIkiSeries = [900, 950, 1000, 1050, 1100];

    for (let i = 0; i < ownerIkiSeries.length; i++) {
      const qid = await insertJournalSession(sql, {
        subjectId: OWNER_ID,
        profile: OWNER_PROFILE,
        scheduledFor: `2026-03-${String(i + 1).padStart(2, '0')}`,
        sessionIndex: i,
      });
      await sql`
        UPDATE tb_session_summaries
        SET inter_key_interval_mean = ${ownerIkiSeries[i]!}
        WHERE question_id = ${qid}
      `;
    }
    for (let i = 0; i < otherIkiSeries.length; i++) {
      const qid = await insertJournalSession(sql, {
        subjectId: OTHER_ID,
        profile: OTHER_PROFILE,
        scheduledFor: `2026-03-${String(i + 11).padStart(2, '0')}`,
        sessionIndex: i,
      });
      await sql`
        UPDATE tb_session_summaries
        SET inter_key_interval_mean = ${otherIkiSeries[i]!}
        WHERE question_id = ${qid}
      `;
    }

    // ── Pre-insert a "previous" calibration baseline snapshot for OWNER ──
    // computeDriftMagnitude returns 0 on the first snapshot (no prior to
    // compare against). To exercise the dispersion path, we seed a
    // synthetic prior snapshot with all dimensions equal to the owner
    // calibration values EXCEPT iki_mean, which is offset. The function
    // will then compute a non-zero delta on iki_mean only, and divide
    // that delta by getJournalDispersion(...).
    //
    // Prior values mirror what the upcoming OWNER_PROFILE-based calibration
    // sessions will produce, so cur - prev = 0 on every dim except iki_mean.
    // For iki_mean, prior = 200, cur = OWNER_PROFILE.ikiMean (100). Delta = -100.
    await sql`
      INSERT INTO tb_calibration_baselines_history (
        subject_id, calibration_session_count, device_type,
        avg_first_keystroke_ms, avg_commitment_ratio, avg_duration_ms,
        avg_pause_count, avg_deletion_count, avg_chars_per_minute,
        avg_p_burst_length, avg_small_deletion_count, avg_large_deletion_count,
        avg_iki_mean, avg_hold_time_mean, avg_flight_time_mean,
        drift_magnitude
      ) VALUES (
        ${OWNER_ID}, 5, NULL,
        ${OWNER_PROFILE.firstKeystrokeMs}, ${OWNER_PROFILE.commitmentRatio}, ${OWNER_PROFILE.totalDurationMs},
        ${OWNER_PROFILE.pauseCount}, ${OWNER_PROFILE.smallDeletionCount + OWNER_PROFILE.largeDeletionCount}, ${OWNER_PROFILE.totalCharsTyped / (OWNER_PROFILE.activeTypingMs / 60000)},
        ${OWNER_PROFILE.avgPBurstLength}, ${OWNER_PROFILE.smallDeletionCount}, ${OWNER_PROFILE.largeDeletionCount},
        200, ${OWNER_PROFILE.holdTimeMean}, ${OWNER_PROFILE.flightTimeMean},
        0
      )
    `;

    // ── New owner calibration sessions with iki_mean = OWNER_PROFILE default ──
    // 5 sessions, all with iki_mean = 100 (the profile default), giving a
    // current baseline avg_iki_mean = 100. Delta vs the prior (200) = -100.
    await insertCalibrationSessions(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      count: 5,
      startIndex: 0,
    });

    // ── Run the drift snapshot ──
    // snapshotCalibrationBaselinesAfterSubmit(OWNER_ID, null) computes the
    // global baseline, looks up the most recent prior global snapshot
    // (the one we just pre-inserted), and writes a NEW row with computed
    // drift_magnitude.
    await snapshotCalibrationBaselinesAfterSubmit(OWNER_ID, null);

    // ── Read the new snapshot ──
    const newSnap = await sql<Array<{ drift_magnitude: number | null; calibration_history_id: number }>>`
      SELECT calibration_history_id, drift_magnitude
      FROM tb_calibration_baselines_history
      WHERE subject_id = ${OWNER_ID} AND device_type IS NULL
      ORDER BY calibration_history_id DESC
      LIMIT 1
    `;
    expect(newSnap.length).toBe(1);
    const drift = newSnap[0]!.drift_magnitude;
    expect(drift).not.toBeNull();

    // ── Drift z-score expectation under correct (owner-only) dispersion ──
    // Only iki_mean has both a non-zero delta and non-zero owner-only
    // dispersion. All other dims have either delta=0 (owner cal ==
    // pre-inserted prior) or dispersion=0 (owner journal sessions have
    // identical values for those dims). computeDriftMagnitude skips dims
    // where dispersion < 1e-10, so only iki_mean enters.
    //
    // For iki_mean:
    //   delta = -100 (cur 100 - prev 200)
    //   dispersion (correct, owner-only) ≈ 7.91
    //   z ≈ -12.64
    //   w (ergodicity weight) = 0.5 for iki_mean
    //   drift_magnitude = sqrt(0.5 * z²) ≈ |z| * sqrt(0.5) ≈ 8.94
    //
    // Pooled dispersion contamination would yield:
    //   dispersion (pooled) ≈ 474
    //   z ≈ -0.211
    //   drift_magnitude ≈ 0.149
    //
    // Threshold of 1.0 cleanly separates the two cases (correct ~9 vs
    // pooled ~0.15), and is the assertion that catches B mutation.
    expect(drift!).toBeGreaterThan(5);
    // Defensive upper bound — drift_magnitude with correct scoping is
    // bounded by the iki_mean z-score magnitude (~9 for this fixture).
    // If the test ever produces a drift > 50, something has changed about
    // the fixture or the function under test that warrants investigation.
    expect(drift!).toBeLessThan(50);
  });
});
