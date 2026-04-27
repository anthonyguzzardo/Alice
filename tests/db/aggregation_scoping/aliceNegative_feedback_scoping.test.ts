/**
 * Hotspot H — src/pages/api/alice-negative.ts:397-402 (now extracted as
 * getQuestionFeedbackTotals helper).
 *
 *   H-1 (q.subject_id): COUNT(*) and SUM(landed) over tb_question_feedback,
 *       single-table aggregation scoped by subject_id.
 *
 * Origin: handoff item H. AN-deprioritized per CLAUDE.md, but still
 * load-bearing for the alice-negative public API's relational-resonance
 * signal: a scoping bug pools landedRatio across subjects, displaying
 * the wrong "did this question land" telemetry on the AN page.
 *
 * Mutation log:
 *   H-1 (subject_id removed): total grows from 2 to 3 (adds OTHER's
 *       row); landed grows from 1 to 2 — landedRatio drops from
 *       1/2=0.5 to 2/3≈0.67.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { getQuestionFeedbackTotals } from '../../../src/pages/api/alice-negative.ts';
import {
  OWNER_ID,
  OTHER_ID,
  cleanupFixtureRows,
  seedTwoSubjects,
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
  // Cleanup tb_question_feedback for fixture subjects since it's not in
  // FIXTURE_TABLES (no other test touches it). Scoped DELETE only.
  await sql`DELETE FROM tb_question_feedback WHERE subject_id IN (${OWNER_ID}, ${OTHER_ID})`;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

async function insertFeedback(subjectId: number, questionId: number, landed: boolean): Promise<void> {
  await sql`
    INSERT INTO tb_question_feedback (subject_id, question_id, landed)
    VALUES (${subjectId}, ${questionId}, ${landed})
  `;
}

describe('hotspot H — alice-negative getQuestionFeedbackTotals scoping', () => {
  it('returns OWNER-only feedback totals', async () => {
    await seedTwoSubjects(sql);

    // OWNER: 2 rows, 1 landed. Expected total=2, landed=1.
    await insertFeedback(OWNER_ID, 9001, true);
    await insertFeedback(OWNER_ID, 9002, false);

    // OTHER: 1 row, 1 landed. Would shift OWNER's totals if scope leaks.
    await insertFeedback(OTHER_ID, 9003, true);

    const totals = await getQuestionFeedbackTotals(OWNER_ID);

    // H-1: with subject_id removed, total=3 and landed=2.
    expect(totals.total).toBe(2);
    expect(totals.landed).toBe(1);
  });
});
