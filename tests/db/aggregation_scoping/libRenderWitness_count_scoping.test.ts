/**
 * Hotspot N4 — src/lib/libAliceNegative/libRenderWitness.ts:35-40 (now
 * extracted as getWitnessJournalSessionCount).
 *
 *   N4-1 (q.subject_id): COUNT(*) over tb_session_summaries JOIN
 *       tb_questions, filtered by question_source_id != 3 to exclude
 *       calibrations. The result becomes the witness `entry_count`,
 *       which downstream functions use to identify which version of
 *       the witness this is and to gate when traits get re-rendered.
 *
 * Origin: handoff item N4. AN-deprioritized per CLAUDE.md, but still
 * load-bearing for renderWitnessState's witness sequencing — a wrong
 * entry_count means the wrong dynamics row gets matched in the gallery
 * (and re-renders may be triggered or suppressed at the wrong cadence).
 *
 * Mutation log:
 *   N4-1 (q.subject_id removed): count grows from 2 (OWNER's two
 *       journal sessions) to 3 (adds OTHER's one journal session).
 *       Calibrations are still excluded by question_source_id != 3.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { getWitnessJournalSessionCount } from '../../../src/lib/libAliceNegative/libRenderWitness.ts';
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

describe('hotspot N4 — libRenderWitness journal-count scoping', () => {
  it('counts only OWNER journal sessions', async () => {
    await seedTwoSubjects(sql);

    // OWNER: 2 journal sessions + 1 calibration (calibration excluded by
    // question_source_id != 3).
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-04-10',
      sessionIndex: 0,
    });
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-04-12',
      sessionIndex: 1,
    });
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: null,
      sessionIndex: 100,
      questionSourceId: 3,
      dttmCreatedUtc: '2026-04-10T12:00:00Z',
    });

    // OTHER: 1 journal session — would contaminate the count if scope leaks.
    await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: '2026-04-15',
      sessionIndex: 200,
    });

    // N4-1: with subject_id removed, count grows from 2 to 3.
    const count = await getWitnessJournalSessionCount(OWNER_ID);
    expect(count).toBe(2);
  });
});
