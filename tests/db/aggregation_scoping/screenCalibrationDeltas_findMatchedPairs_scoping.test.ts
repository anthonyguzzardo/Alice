/**
 * Hotspot J — src/scripts/screen-calibration-deltas.ts:148-172.
 * findMatchedPairs SQL is byte-identical to extract-calibration-deltas.ts's
 * (hotspot I): outer + one correlated subquery for calibrationQuestionId.
 *
 * Origin: handoff item J. Same shape as I; testing both because the
 * scripts are independent files maintained separately. A divergence
 * (e.g. one updated for migration 030 and not the other) would be a
 * silent contamination source.
 *
 * Mutation log:
 *   J-1a (outer j.subject_id): pairs.length grows from 1 to 2.
 *   J-1b (inner c.subject_id): pairs[0].calibrationQuestionId resolves
 *     to OTHER's qid (later dttm wins ORDER BY DESC LIMIT 1).
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { findMatchedPairs } from '../../../src/scripts/screen-calibration-deltas.ts';
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

describe('hotspot J — screen-calibration-deltas findMatchedPairs scoping', () => {
  it('returns only OWNER day-pairs and resolves calibrationQuestionId from OWNER', async () => {
    await seedTwoSubjects(sql);

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

    // OWNER 2026-04-15: calibration only — J-1a contamination surface.
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 101,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-15T08:00:00Z',
    });

    // OTHER 2026-04-10: calibration only with later dttm — J-1b contamination.
    const otherC_0410 = await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: null,
      sessionIndex: 200,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-10T20:00:00Z',
    });

    // OTHER 2026-04-15: complete day-pair — J-1a partner.
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

    expect(pairs.length).toBe(1);
    expect(pairs[0]!.date).toBe('2026-04-10');
    expect(pairs[0]!.journalQuestionId).toBe(ownerJ_0410);
    expect(pairs[0]!.calibrationQuestionId).toBe(ownerC_0410);
    expect(pairs[0]!.calibrationQuestionId).not.toBe(otherC_0410);
  });
});
