/**
 * Hotspot K — src/scripts/confound-analysis.ts. Three aggregation blocks:
 *
 *   K-1: findMatchedPairs (lines 213-249) — outer SELECT over journals +
 *        TWO correlated subqueries (calibrationQid, calibrationHour) each
 *        with `c.subject_id` scoping.
 *
 *   K-2: IC time-of-day data (Task B, ~lines 470-490) — two SELECTs over
 *        tb_semantic_signals JOIN tb_questions, one for journal IC, one
 *        for calibration IC, each scoped by `q.subject_id`.
 *
 *   K-3: DOW counts (Task D, ~lines 660-675) — two SELECTs over
 *        tb_session_summaries JOIN tb_questions for journal vs calibration
 *        day-of-week, each scoped by `q.subject_id`.
 *
 * Origin: handoff item K. Multi-site mutation discipline — seven scoping
 * sites total (3 in K-1, 2 in K-2, 2 in K-3).
 *
 * What this verifies:
 *   The script's main() previously ran these queries inline; this commit
 *   refactored each block into named exported helpers (findMatchedPairs
 *   was already standalone, just exported; getJournalICRows /
 *   getCalibrationICRows / getJournalDOWCounts / getCalibrationDOWCounts
 *   are new). main() now calls the helpers; the dead `icRows` / `icByQid`
 *   pair (assigned but never read) was removed during the refactor.
 *
 *   The test calls each helper with subjectId=OWNER under a two-subject
 *   fixture and asserts the result reflects only OWNER. Mutations of each
 *   `subject_id` clause are individually catchable through these helpers'
 *   public outputs — no defense-in-depth masking, since the helpers ARE
 *   the public surface for this analysis.
 *
 * Silent-corruption failure mode:
 *   The script is an analysis tool; cross-subject leakage produces
 *   misleading regression statistics, IC trends, and DOW distributions
 *   that the operator reads as truth. The Task B regression alone (IC
 *   delta vs time-of-day) would silently produce a chimerized r/p value
 *   if either IC query leaked.
 *
 * Rule 1 (LIMIT / heap order): findMatchedPairs's two inner subqueries
 * use `ORDER BY c.dttm_created_utc DESC LIMIT 1` (most-recent
 * calibration on the journal's date). The fixture pins distinct dttm
 * timestamps (OWNER cal at 10:00, OTHER cal at 20:00 on the same date)
 * so that an inner-subquery mutation deterministically picks OTHER's
 * row. Date is the heap-order discriminator; nothing depends on
 * insertion order.
 *
 * Mutation log:
 *   K-1a (findMatchedPairs outer j.subject_id): OTHER's 2026-04-15
 *     journal enters the SELECT; inner subqueries (still OWNER-scoped)
 *     find OWNER's 2026-04-15 calibration → pair included →
 *     pairs.length = 3 instead of 2.
 *   K-1b (findMatchedPairs 1st inner c.subject_id, calibrationQid):
 *     For OWNER journal 2026-04-10, the unscoped subquery's ORDER BY
 *     dttm DESC LIMIT 1 picks OTHER's calibration on 2026-04-10
 *     (dttm=20:00 > OWNER's 10:00). pairs[0].calibrationQid = OTHER's
 *     qid → fails the "calibrationQid in OWNER set" assertion.
 *   K-1c (findMatchedPairs 2nd inner c.subject_id, calibrationHour):
 *     Same as K-1b but for the hour subquery. pairs[0].calibrationHour
 *     = 20 instead of 10 → fails the calibrationHour assertion.
 *   K-2a (getJournalICRows q.subject_id): icJournal.length = 3 (adds
 *     OTHER's 2026-04-15 journal IC row).
 *   K-2b (getCalibrationICRows q.subject_id): icCalibration.length = 5
 *     (adds OTHER's two calibration IC rows).
 *   K-3a (getJournalDOWCounts q.subject_id): jDOWCounts sum = 3 (adds
 *     OTHER's 2026-04-15 journal). DOW=1 bucket would gain 1.
 *   K-3b (getCalibrationDOWCounts q.subject_id): cDOWCounts sum = 5
 *     (adds OTHER's two calibrations).
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import {
  findMatchedPairs,
  getJournalICRows,
  getCalibrationICRows,
  getJournalDOWCounts,
  getCalibrationDOWCounts,
} from '../../../src/scripts/confound-analysis.ts';
import {
  OWNER_ID,
  OTHER_ID,
  OWNER_PROFILE,
  OTHER_PROFILE,
  cleanupFixtureRows,
  seedTwoSubjects,
  insertJournalSession,
  insertSemanticSignalsRow,
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

describe('hotspot K — confound-analysis three-block scoping', () => {
  it('returns OWNER-only matched pairs, IC rows, and DOW counts under two-subject fixture', async () => {
    await seedTwoSubjects(sql);

    // ── OWNER 2026-04-10: complete eligible day-pair ─────────────────────
    // Journal scheduled for 2026-04-10 at hour 10 (DOW 3). Calibration with
    // scheduled_for=NULL and dttm at 10:00 UTC, hour_of_day=10. The
    // calibration timestamp is EARLIER than OTHER's same-date calibration
    // below (10:00 vs 20:00) — this is what makes K-1b/K-1c mutations
    // deterministic: ORDER BY dttm DESC LIMIT 1 picks OTHER's row when the
    // c.subject_id scope is removed.
    const ownerJ_0410 = await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-04-10',
      sessionIndex: 0,
      hourOfDay: 10,
      dayOfWeek: 3,
    });
    const ownerC_0410 = await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 100,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-10T10:00:00Z',
      hourOfDay: 10,
      dayOfWeek: 3,
    });

    // ── OWNER 2026-04-12: complete eligible day-pair ─────────────────────
    const ownerJ_0412 = await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-04-12',
      sessionIndex: 1,
      hourOfDay: 11,
      dayOfWeek: 5,
    });
    const ownerC_0412 = await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 101,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-12T11:00:00Z',
      hourOfDay: 11,
      dayOfWeek: 5,
    });

    // ── OWNER 2026-04-15: calibration only ───────────────────────────────
    // No OWNER journal on 2026-04-15. Used as the K-1a contamination
    // surface: with j.subject_id removed from the outer SELECT, OTHER's
    // 2026-04-15 journal enters the list AND the still-scoped inner
    // subquery finds THIS calibration → pair gets included.
    const ownerC_0415 = await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 102,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-15T08:00:00Z',
      hourOfDay: 8,
      dayOfWeek: 1,
    });

    // ── OTHER 2026-04-10: calibration only with dttm at 20:00 ────────────
    // K-1b/K-1c contamination. Same calendar date as OWNER's 2026-04-10,
    // dttm=20:00 (later than OWNER's 10:00). With c.subject_id removed
    // from either inner subquery, ORDER BY DESC LIMIT 1 picks this row.
    const otherC_0410 = await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: null,
      sessionIndex: 200,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-10T20:00:00Z',
      hourOfDay: 20,
      dayOfWeek: 3,
    });

    // ── OTHER 2026-04-15: complete eligible day-pair ─────────────────────
    // K-1a partner: OTHER's journal on 2026-04-15. Without outer scoping,
    // the SELECT lists this journal, and the inner subqueries find OWNER's
    // 2026-04-15 calibration (above) → an OWNER pair gets contaminated.
    const otherJ_0415 = await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: '2026-04-15',
      sessionIndex: 201,
      hourOfDay: 15,
      dayOfWeek: 1,
    });
    const otherC_0415 = await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: null,
      sessionIndex: 202,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-15T20:00:00Z',
      hourOfDay: 20,
      dayOfWeek: 1,
    });

    // ── IC seed: every journal/calibration row above gets a semantic ──
    // signals row with integrative_complexity. Distinct values per row
    // so K-2 mutations are observable through count of returned rows.
    await insertSemanticSignalsRow(sql, OWNER_ID, ownerJ_0410, { integrative_complexity: 0.5 });
    await insertSemanticSignalsRow(sql, OWNER_ID, ownerC_0410, { integrative_complexity: 0.3 });
    await insertSemanticSignalsRow(sql, OWNER_ID, ownerJ_0412, { integrative_complexity: 0.6 });
    await insertSemanticSignalsRow(sql, OWNER_ID, ownerC_0412, { integrative_complexity: 0.4 });
    await insertSemanticSignalsRow(sql, OWNER_ID, ownerC_0415, { integrative_complexity: 0.7 });
    await insertSemanticSignalsRow(sql, OTHER_ID, otherC_0410, { integrative_complexity: 0.95 });
    await insertSemanticSignalsRow(sql, OTHER_ID, otherJ_0415, { integrative_complexity: 0.9 });
    await insertSemanticSignalsRow(sql, OTHER_ID, otherC_0415, { integrative_complexity: 0.8 });

    // ════════════════════════════════════════════════════════════════════
    // K-1: findMatchedPairs (3 mutation sites)
    // ════════════════════════════════════════════════════════════════════

    const pairs = await findMatchedPairs(OWNER_ID);

    // K-1a: outer scope → OTHER's 2026-04-15 journal would add a 3rd pair.
    expect(pairs.length).toBe(2);

    // pairs are ORDER BY j.scheduled_for ASC, so [0] = 2026-04-10.
    const ownerCalibrationQids = new Set([ownerC_0410, ownerC_0412, ownerC_0415]);

    expect(pairs[0]!.date).toBe('2026-04-10');
    expect(pairs[1]!.date).toBe('2026-04-12');

    // K-1b: 1st inner subquery scope (calibrationQid) → unscoped picks
    //   OTHER's calibration_question_id on 2026-04-10 (dttm 20:00 wins).
    expect(ownerCalibrationQids.has(pairs[0]!.calibrationQid)).toBe(true);
    expect(ownerCalibrationQids.has(pairs[1]!.calibrationQid)).toBe(true);

    // K-1c: 2nd inner subquery scope (calibrationHour) → unscoped picks
    //   OTHER's hour 20 on 2026-04-10 in place of OWNER's 10.
    expect(pairs[0]!.calibrationHour).toBe(10);
    expect(pairs[1]!.calibrationHour).toBe(11);

    // ════════════════════════════════════════════════════════════════════
    // K-2: IC fetching (2 mutation sites)
    // ════════════════════════════════════════════════════════════════════

    const icJournal = await getJournalICRows(OWNER_ID);
    const icCalibration = await getCalibrationICRows(OWNER_ID);

    // K-2a: getJournalICRows scope → mutated returns 3 rows (adds OTHER's
    //   2026-04-15 journal IC).
    expect(icJournal.length).toBe(2);
    expect(icJournal.map((r) => r.value).sort()).toEqual([0.5, 0.6]);

    // K-2b: getCalibrationICRows scope → mutated returns 5 rows (adds
    //   OTHER's two calibration IC rows).
    expect(icCalibration.length).toBe(3);
    expect(icCalibration.map((r) => r.value).sort()).toEqual([0.3, 0.4, 0.7]);

    // ════════════════════════════════════════════════════════════════════
    // K-3: DOW counts (2 mutation sites)
    // ════════════════════════════════════════════════════════════════════

    const jDOWCounts = await getJournalDOWCounts(OWNER_ID);
    const cDOWCounts = await getCalibrationDOWCounts(OWNER_ID);

    // K-3a: getJournalDOWCounts scope → sum = 3 instead of 2 (OTHER's
    //   2026-04-15 journal at DOW=1 gets included).
    expect(jDOWCounts.reduce((s, n) => s + n, 0)).toBe(2);
    // OWNER journals are at DOW=3 (2026-04-10) and DOW=5 (2026-04-12).
    expect(jDOWCounts[3]).toBe(1);
    expect(jDOWCounts[5]).toBe(1);
    expect(jDOWCounts[1]).toBe(0); // would be 1 under K-3a mutation

    // K-3b: getCalibrationDOWCounts scope → sum = 5 instead of 3 (adds
    //   OTHER's two calibrations at DOW=3 and DOW=1).
    expect(cDOWCounts.reduce((s, n) => s + n, 0)).toBe(3);
    expect(cDOWCounts[3]).toBe(1);  // OWNER cal 2026-04-10
    expect(cDOWCounts[5]).toBe(1);  // OWNER cal 2026-04-12
    expect(cDOWCounts[1]).toBe(1);  // OWNER cal 2026-04-15
  });
});
