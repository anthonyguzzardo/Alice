/**
 * Hotspot I — src/scripts/extract-calibration-deltas.ts:21-45.
 * findMatchedPairs joins journals to same-day calibrations via an outer
 * SELECT plus one correlated subquery (calibrationQuestionId).
 *
 * Origin: handoff item I. Two scoping sites — outer `j.subject_id` and
 * inner `c.subject_id` — same shape as K-1's first two layers, simpler
 * (no calibrationHour second subquery).
 *
 * Silent-corruption failure mode:
 *   The script computes per-signal deltas (journal - calibration) across
 *   day-pairs. A scoping bug at either layer pulls cross-subject pairs
 *   into the analysis: descriptive statistics on the delta distribution
 *   then describe a chimera of two writers' divergence patterns rather
 *   than a single subject's calibration→journal shift.
 *
 * Rule 1 (LIMIT / heap order): The inner subquery uses
 *   `ORDER BY c.dttm_created_utc DESC LIMIT 1`. Fixture pins distinct
 *   dttm timestamps (OWNER cal at 10:00, OTHER cal at 20:00 same date)
 *   so an inner-mutation deterministically picks OTHER's row.
 *
 * Mutation log:
 *   I-1a (outer j.subject_id): OTHER's 2026-04-15 journal enters the
 *     SELECT; inner subquery (still OWNER-scoped) finds OWNER's
 *     2026-04-15 calibration → pair included → pairs.length = 2 vs 1.
 *   I-1b (inner c.subject_id): For OWNER's 2026-04-10 journal, the
 *     unscoped subquery's ORDER BY dttm DESC LIMIT 1 picks OTHER's
 *     calibration on 2026-04-10 (dttm=20:00 > OWNER's 10:00) →
 *     pairs[0].calibrationQuestionId is OTHER's qid.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { findMatchedPairs } from '../../../src/scripts/extract-calibration-deltas.ts';
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

describe('hotspot I — extract-calibration-deltas findMatchedPairs scoping', () => {
  it('returns only OWNER day-pairs and resolves calibrationQuestionId from OWNER', async () => {
    await seedTwoSubjects(sql);

    // ── OWNER 2026-04-10: complete eligible day-pair ────────────────────
    const ownerJ_0410 = await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-04-10',
      sessionIndex: 0,
    });
    const ownerC_0410 = await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 100,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-10T10:00:00Z',
    });

    // ── OWNER 2026-04-15: calibration only (I-1a contamination surface) ──
    // No OWNER journal on 2026-04-15. With outer scope removed, OTHER's
    // 2026-04-15 journal enters the SELECT and the still-scoped inner
    // subquery finds THIS calibration.
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 101,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-15T08:00:00Z',
    });

    // ── OTHER 2026-04-10: calibration only with later dttm ──────────────
    // I-1b contamination. Same calendar date as OWNER's; later dttm wins
    // ORDER BY DESC LIMIT 1 if the inner c.subject_id scope is removed.
    const otherC_0410 = await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: null,
      sessionIndex: 200,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-10T20:00:00Z',
    });

    // ── OTHER 2026-04-15: complete day-pair (I-1a partner) ──────────────
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
      dttmCreatedUtc: '2026-04-15T20:00:00Z',
    });

    const pairs = await findMatchedPairs(OWNER_ID);

    // I-1a: outer scope → pairs.length grows from 1 to 2.
    expect(pairs.length).toBe(1);
    expect(pairs[0]!.date).toBe('2026-04-10');
    expect(pairs[0]!.journalQuestionId).toBe(ownerJ_0410);

    // I-1b: inner subquery scope → calibrationQuestionId becomes
    //   otherC_0410 instead of ownerC_0410 (OTHER's later dttm wins).
    expect(pairs[0]!.calibrationQuestionId).toBe(ownerC_0410);
    expect(pairs[0]!.calibrationQuestionId).not.toBe(otherC_0410);
  });
});
