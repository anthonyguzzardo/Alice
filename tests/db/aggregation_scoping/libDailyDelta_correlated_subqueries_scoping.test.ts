/**
 * Hotspot N2 — libDailyDelta.ts:407–451 (computePriorDayDelta) and 461–484
 * (getEligibleDatesWithoutDelta). Both functions use the same three-layer
 * correlated-subquery skeleton:
 *
 *     SELECT j.scheduled_for, j.question_id
 *     FROM tb_questions j JOIN tb_session_summaries js ...
 *     WHERE j.subject_id = ${subjectId}                    -- (1) outer
 *       AND j.question_source_id != 3
 *       AND j.scheduled_for IS NOT NULL
 *       [AND j.scheduled_for < ${currentDate}::date]       -- only computePriorDayDelta
 *       AND EXISTS (
 *         SELECT 1 FROM tb_questions c JOIN tb_session_summaries cs ...
 *         WHERE c.subject_id = ${subjectId}                 -- (2) EXISTS
 *           AND c.question_source_id = 3
 *           AND c.dttm_created_utc::date = j.scheduled_for
 *       )
 *       AND NOT EXISTS (
 *         SELECT 1 FROM tb_session_delta d
 *         WHERE d.subject_id = ${subjectId}                 -- (3) NOT EXISTS
 *           AND d.session_date::date = j.scheduled_for
 *       )
 *
 * Origin: handoff-defined N-series consolidating original Step 0 §C
 * hotspots I/J. The functions share the same SQL skeleton; we test
 * computePriorDayDelta thoroughly (all three layers observable through
 * the public API), and runDailyDeltaBackfill (which wraps
 * getEligibleDatesWithoutDelta) for the layer observable through ITS
 * public API.
 *
 * What this verifies (computePriorDayDelta):
 *   computePriorDayDelta(subjectId, currentDate) walks the SQL above to
 *   find the most-recent eligible day-pair for the requested subject,
 *   then computes & saves the delta. We assert the returned date is
 *   OWNER's eligible date despite OTHER having overlapping-date data
 *   that would corrupt the result if any of the three scopes leaked.
 *
 * What this verifies (runDailyDeltaBackfill):
 *   runDailyDeltaBackfill(subjectId) calls getEligibleDatesWithoutDelta,
 *   then loops through results saving each. We assert the count of saved
 *   deltas reflects only OWNER's eligible day-pairs.
 *
 * Silent-corruption failure mode (what this test guards against):
 *   The daily delta feeds question-generation prompts (formatCompactDelta)
 *   which see ~14 days of history. A scoping bug inserts cross-subject
 *   deltas into that window — the prompt is then assembled against a
 *   chimera of writing patterns rather than the requesting subject's
 *   actual provocation history. Because the function self-heals (next
 *   submission retries any unfilled dates), a corrupted delta row could
 *   linger silently for many sessions before being noticed.
 *
 *   For runDailyDeltaBackfill, a NOT EXISTS scoping bug causes silent
 *   data loss: OWNER eligible dates that happen to match OTHER's
 *   pre-existing delta dates would be wrongly suppressed and never
 *   processed. The function returns "complete" without ever attempting
 *   those dates.
 *
 * Defense-in-depth observation (verified during mutation testing):
 *   getEligibleDatesWithoutDelta's outer (j.subject_id) and EXISTS
 *   (c.subject_id) scopes are guarded downstream by the subject-scoped
 *   getSessionSummary(subjectId, ...) and getSameDayCalibrationSummary(
 *   subjectId, ...) calls inside runDailyDeltaBackfill's loop. A mutation
 *   of either layer expands the eligible list with rows that the
 *   downstream subject check fails on, triggering `continue` without a
 *   save. The number of saved deltas is therefore unchanged. Only NOT
 *   EXISTS (which suppresses OWNER rows the downstream layers cannot
 *   recover) produces an observable change through runDailyDeltaBackfill.
 *
 *   This is layered defense, not a test deficiency. The mutation log
 *   below records the catchable layers (N2-A/B/C/D) alongside the two
 *   masked layers (N2-E/F).
 *
 * Rule 1 (LIMIT / heap order): computePriorDayDelta uses LIMIT 1 with
 * ORDER BY j.scheduled_for DESC; selection is deterministic via the
 * date column. Fixtures control via distinct dates per subject;
 * insertion order is irrelevant.
 *
 * Mutation log (verified during test development, see report):
 *   N2-A (computePriorDayDelta outer, j.subject_id): OWNER's correct
 *     date (2026-04-10) is overridden by OTHER's more-recent eligible
 *     2026-04-15. Downstream getSessionSummary(OWNER, otherJournalQid)
 *     returns null → function returns null. Test assertion fails.
 *   N2-B (computePriorDayDelta EXISTS, c.subject_id): OWNER's
 *     journal-only 2026-04-12 becomes "eligible" because OTHER has a
 *     calibration on 2026-04-12. ORDER BY DESC selects 2026-04-12 over
 *     2026-04-10. Downstream getSameDayCalibrationSummary(OWNER,
 *     '2026-04-12') returns null → function returns null.
 *   N2-C (computePriorDayDelta NOT EXISTS, d.subject_id): OWNER's
 *     2026-04-10 is suppressed by OTHER's pre-existing delta on
 *     2026-04-10. No other OWNER eligible dates → function returns null.
 *   N2-D (getEligibleDatesWithoutDelta NOT EXISTS, d.subject_id):
 *     OWNER's 2026-03-01 suppressed by OTHER's delta there →
 *     runDailyDeltaBackfill processes only 2026-03-03, returns 1.
 *     Test assertion (count=2) fails.
 *   N2-E (getEligibleDatesWithoutDelta outer, j.subject_id):
 *     [DEFENSE-IN-DEPTH MASKED] OTHER's journals listed but downstream
 *     getSessionSummary(OWNER, otherJournalQid) returns null → continue.
 *     count of saved deltas unchanged. Documented; not catchable through
 *     the public runDailyDeltaBackfill API.
 *   N2-F (getEligibleDatesWithoutDelta EXISTS, c.subject_id):
 *     [DEFENSE-IN-DEPTH MASKED] OWNER's journal-only dates that match
 *     OTHER's calibration dates are listed, but downstream
 *     getSameDayCalibrationSummary(OWNER, ...) returns null → continue.
 *     count of saved deltas unchanged. Documented; not catchable through
 *     the public runDailyDeltaBackfill API.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import {
  computePriorDayDelta,
  runDailyDeltaBackfill,
} from '../../../src/lib/libDailyDelta.ts';
import {
  OWNER_ID,
  OTHER_ID,
  OWNER_PROFILE,
  OTHER_PROFILE,
  cleanupFixtureRows,
  seedTwoSubjects,
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

describe('hotspot N2 — libDailyDelta correlated-subquery scoping', () => {
  it('computePriorDayDelta returns OWNER eligible date despite OTHER overlapping data', async () => {
    await seedTwoSubjects(sql);

    // ── OWNER 2026-04-10: complete eligible day-pair ─────────────────────
    // Journal scheduled for 2026-04-10. Calibration with scheduled_for=NULL
    // (production semantics) and dttm_created_utc on 2026-04-10 — the
    // EXISTS subquery joins on c.dttm_created_utc::date = j.scheduled_for.
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-04-10',
      sessionIndex: 0,
    });
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 100,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-10T12:00:00Z',
    });

    // ── OWNER 2026-04-12: journal only (no OWNER calibration) ────────────
    // EXISTS-mutation contamination. With c.subject_id removed, OTHER's
    // 2026-04-12 calibration would satisfy the unscoped EXISTS, and
    // 2026-04-12 (more recent than 2026-04-10) would win ORDER BY DESC.
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-04-12',
      sessionIndex: 1,
    });

    // ── OWNER 2026-04-15: calibration only (no OWNER journal) ────────────
    // OUTER-mutation enabler. With j.subject_id removed, OTHER's 2026-04-15
    // journal enters the SELECT — but the EXISTS subquery is still scoped
    // (c.subject_id = OWNER), so it only matches an OWNER calibration on
    // 2026-04-15. Without this row, the OUTER mutation alone is masked
    // because no OWNER calibration ⇒ EXISTS fails ⇒ OTHER's journal
    // filtered out before reaching ORDER BY.
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 101,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-15T12:00:00Z',
    });

    // ── OTHER 2026-04-12: calibration only ───────────────────────────────
    // Partner for EXISTS-mutation contamination. OTHER has no journal on
    // 2026-04-12, only this calibration.
    await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: null,
      sessionIndex: 200,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-12T12:00:00Z',
    });

    // ── OTHER 2026-04-15: complete eligible day-pair ─────────────────────
    // OUTER-mutation contamination. With j.subject_id removed, OTHER's
    // 2026-04-15 journal enters the SELECT and the EXISTS subquery's still-
    // scoped c.subject_id = OWNER finds OWNER's 2026-04-15 calibration
    // (from the row above). 2026-04-15 then wins ORDER BY DESC LIMIT 1.
    await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: '2026-04-15',
      sessionIndex: 201,
    });
    await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: null,
      sessionIndex: 202,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-15T12:00:00Z',
    });

    // ── OTHER pre-existing delta on 2026-04-10 ───────────────────────────
    // NOT EXISTS-mutation contamination. With d.subject_id removed, OWNER's
    // 2026-04-10 would be suppressed because OTHER has a delta on that
    // date. With the scope intact, OWNER's 2026-04-10 is eligible (OWNER
    // has no delta there yet). The calibration/journal question_id values
    // are arbitrary — NOT EXISTS only reads (subject_id, session_date).
    await sql`
      INSERT INTO tb_session_delta (
        subject_id, session_date, calibration_question_id, journal_question_id
      ) VALUES (${OTHER_ID}, '2026-04-10', 1, 2)
    `;

    // ── Run the production path ──────────────────────────────────────────
    const result = await computePriorDayDelta(OWNER_ID, '2026-04-26');

    // ── N2-A/B/C assertion: returned date is OWNER's 2026-04-10 ──────────
    // Each of the three mutations independently makes this null:
    //   N2-A (outer): null (OTHER's qid not in OWNER's session_summaries)
    //   N2-B (EXISTS): null (OWNER has no calibration on 2026-04-12)
    //   N2-C (NOT EXISTS): null (OWNER's 2026-04-10 suppressed)
    expect(result).toBe('2026-04-10');

    // ── Defense in depth: OWNER's saved delta references only OWNER ──────
    // Even if the SELECT had returned an OTHER row, the downstream
    // getSessionSummary scope would block the save. This assertion catches
    // the case where any layer's failure produces a delta linked to
    // OTHER's question_id.
    const ownerDeltas = await sql<Array<{ date: string; cal: number; jrnl: number }>>`
      SELECT
        session_date::text AS date,
        calibration_question_id AS cal,
        journal_question_id AS jrnl
      FROM tb_session_delta
      WHERE subject_id = ${OWNER_ID}
      ORDER BY session_date ASC
    `;
    expect(ownerDeltas.length).toBe(1);
    expect(ownerDeltas[0]!.date).toBe('2026-04-10');

    // ── Defense in depth: OTHER's pre-existing delta is unchanged ────────
    const otherDeltas = await sql<Array<{ date: string }>>`
      SELECT session_date::text AS date FROM tb_session_delta
      WHERE subject_id = ${OTHER_ID}
      ORDER BY session_date ASC
    `;
    expect(otherDeltas.length).toBe(1);
    expect(otherDeltas[0]!.date).toBe('2026-04-10');
  });

  it('runDailyDeltaBackfill processes only OWNER eligible day-pairs', async () => {
    await seedTwoSubjects(sql);

    // ── OWNER: 2 eligible day-pairs (2026-03-01, 2026-03-03) ─────────────
    for (const date of ['2026-03-01', '2026-03-03']) {
      const day = parseInt(date.slice(8), 10);
      await insertJournalSession(sql, {
        subjectId: OWNER_ID,
        profile: OWNER_PROFILE,
        scheduledFor: date,
        sessionIndex: day,
      });
      await insertJournalSession(sql, {
        subjectId: OWNER_ID,
        profile: OWNER_PROFILE,
        scheduledFor: null,
        sessionIndex: 100 + day,
        questionSourceId: 3,
        dttmCreatedUtc: `${date}T12:00:00Z`,
      });
    }

    // ── OWNER 2026-03-05: journal only (defense-in-depth demo for N2-F) ──
    // With c.subject_id removed from EXISTS, OTHER's 2026-03-05 calibration
    // would satisfy the unscoped EXISTS for this OWNER journal. Eligible
    // list expands to include 2026-03-05, but the loop's downstream
    // getSameDayCalibrationSummary(OWNER, '2026-03-05') returns null
    // (OWNER has no calibration on 2026-03-05) → continue without save.
    // The mutation does not change `computed`.
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-03-05',
      sessionIndex: 5,
    });

    // ── OWNER 2026-03-07: calibration only (defense-in-depth demo for N2-E) ──
    // With j.subject_id removed from outer, OTHER's 2026-03-07 journal
    // would enter the SELECT and the still-scoped EXISTS would find this
    // OWNER calibration on 2026-03-07. Eligible list expands to include
    // (OTHER's journal_question_id, 2026-03-07), but the loop's downstream
    // getSessionSummary(OWNER, otherJournalQid) returns null → continue
    // without save. The mutation does not change `computed`.
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 107,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-03-07T12:00:00Z',
    });

    // ── OTHER day-pairs (2026-03-02, 2026-03-04) — disjoint from OWNER ───
    for (const date of ['2026-03-02', '2026-03-04']) {
      const day = parseInt(date.slice(8), 10);
      await insertJournalSession(sql, {
        subjectId: OTHER_ID,
        profile: OTHER_PROFILE,
        scheduledFor: date,
        sessionIndex: 200 + day,
      });
      await insertJournalSession(sql, {
        subjectId: OTHER_ID,
        profile: OTHER_PROFILE,
        scheduledFor: null,
        sessionIndex: 300 + day,
        questionSourceId: 3,
        dttmCreatedUtc: `${date}T12:00:00Z`,
      });
    }

    // ── OTHER 2026-03-05: calibration only (partner for N2-F demo) ───────
    await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: null,
      sessionIndex: 305,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-03-05T12:00:00Z',
    });

    // ── OTHER 2026-03-07: complete day-pair (partner for N2-E demo) ──────
    await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: '2026-03-07',
      sessionIndex: 207,
    });
    await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: null,
      sessionIndex: 307,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-03-07T12:00:00Z',
    });

    // ── OTHER pre-existing delta on 2026-03-01 ───────────────────────────
    // N2-D contamination: with d.subject_id removed, OWNER's 2026-03-01
    // would be suppressed because OTHER has a delta on that date.
    await sql`
      INSERT INTO tb_session_delta (
        subject_id, session_date, calibration_question_id, journal_question_id
      ) VALUES (${OTHER_ID}, '2026-03-01', 1, 2)
    `;

    // ── Run the production path ──────────────────────────────────────────
    const computed = await runDailyDeltaBackfill(OWNER_ID);

    // ── N2-D assertion: backfill processed both OWNER day-pairs ──────────
    // With NOT EXISTS d.subject_id removed, OWNER's 2026-03-01 is
    // suppressed → only 2026-03-03 saved → computed=1. Correct scope
    // returns 2. The N2-E and N2-F mutations DO expand the internal
    // eligible list (verified via mutation testing) but the downstream
    // getSessionSummary / getSameDayCalibrationSummary scopes catch the
    // expansion before any save — `computed` remains 2 either way.
    expect(computed).toBe(2);

    // Both OWNER deltas saved on the expected dates.
    const ownerDeltas = await sql<Array<{ date: string }>>`
      SELECT session_date::text AS date FROM tb_session_delta
      WHERE subject_id = ${OWNER_ID}
      ORDER BY session_date ASC
    `;
    expect(ownerDeltas.map((r) => r.date)).toEqual(['2026-03-01', '2026-03-03']);

    // OTHER's pre-existing delta is the only OTHER row (no spurious saves).
    const otherDeltas = await sql<Array<{ date: string }>>`
      SELECT session_date::text AS date FROM tb_session_delta
      WHERE subject_id = ${OTHER_ID}
      ORDER BY session_date ASC
    `;
    expect(otherDeltas.map((r) => r.date)).toEqual(['2026-03-01']);
  });
});
