/**
 * Hotspot N3 — src/lib/libGenerate.ts:51-162. Question generation prompt
 * assembly threads subjectId through ~13 libDb / lib calls before reaching
 * the Anthropic API call. Owner-pinned in production today (Caddy basic
 * auth gates the /generate endpoint to the owner only); the threading is
 * defensive future-proofing.
 *
 * Origin: handoff item N3. Per the Step 6 plan, this hotspot is lower
 * direct risk because the call site (`runGeneration` in respond.ts and
 * the worker) currently always passes OWNER_SUBJECT_ID. The test
 * documents that the threading is correct so a future subject-aware
 * pipeline does not silently cross-pollute prompt input.
 *
 * Test scope (deliberate scope-limit):
 *   Verifying threading at the FIRST libDb call (hasQuestionForDate)
 *   via a tripwire: getResponseCount is mocked to throw if it ever
 *   runs. Proper threading triggers hasQuestionForDate's early-exit
 *   for the OWNER pre-seeded tomorrow-question, so getResponseCount is
 *   never reached. A mutation that hardcodes a different subjectId at
 *   line 56 makes hasQuestionForDate look at the wrong subject's
 *   tomorrow data, the early-exit doesn't fire, and getResponseCount
 *   throws.
 *
 *   Deeper threading (getRecentResponses, retrieveSimilarMulti, etc.)
 *   would require mocking Anthropic + VoyageAI. The threading pattern
 *   is mechanical (`subjectId` as the first argument to every call) and
 *   greppable; full-path mutation testing is deferred. The claim is:
 *   if the first call's threading is wired correctly, the mechanical
 *   pattern at every subsequent line is the same shape.
 *
 * Mutation log:
 *   N3-1 (hasQuestionForDate hardcoded subject 1): with OWNER_ID=1001
 *     pre-seeded for tomorrow but subject 1 not pre-seeded,
 *     hasQuestionForDate(1, tomorrow) returns false. runGeneration
 *     proceeds past line 56 to line 58, hits the
 *     getResponseCount-throws tripwire. Test rejects with the tripwire
 *     error.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { localDateStr } from '../../../src/lib/utlDate.ts';
import {
  OWNER_ID,
  cleanupFixtureRows,
  seedTwoSubjects,
} from './_fixtures.ts';

// Tripwire: import-time mock that throws if getResponseCount is called.
// Proper threading at hasQuestionForDate triggers an early-exit before
// runGeneration ever calls getResponseCount.
vi.mock('../../../src/lib/libDb.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/libDb.ts')>();
  return {
    ...actual,
    getResponseCount: vi.fn(async () => {
      throw new Error(
        'TRIPWIRE: getResponseCount was called — runGeneration did not early-exit at hasQuestionForDate, which means subjectId threading at libGenerate.ts:56 is wrong.',
      );
    }),
  };
});

// Import AFTER vi.mock so the mocked module is used.
const { runGeneration } = await import('../../../src/lib/libGenerate.ts');

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
  // Also clean any subj=1 question for tomorrow that other tests may have
  // left in place — required for the mutation observability claim
  // (mutation looks up subj=1's tomorrow question; must be absent).
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDateStr(tomorrow);
  await sql`
    DELETE FROM tb_questions
    WHERE subject_id = 1 AND scheduled_for = ${tomorrowStr}::date
  `;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe('hotspot N3 — libGenerate runGeneration subjectId threading', () => {
  it('threads subjectId to hasQuestionForDate (early-exit on pre-seeded tomorrow question)', async () => {
    await seedTwoSubjects(sql);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = localDateStr(tomorrow);

    // Pre-seed OWNER's tomorrow question. With proper threading,
    // hasQuestionForDate(OWNER_ID, tomorrow) returns true and runGeneration
    // returns immediately. With the threading mutation (hardcoded subj=1),
    // hasQuestionForDate(1, tomorrow) returns false, the function proceeds,
    // and the getResponseCount tripwire throws.
    await sql`
      INSERT INTO tb_questions (subject_id, scheduled_for, text, question_source_id)
      VALUES (${OWNER_ID}, ${tomorrowStr}::date, 'pre-seeded for N3 test', 2)
    `;

    // Proper threading: returns silently. Mutation: throws via tripwire.
    await expect(runGeneration(OWNER_ID)).resolves.toBeUndefined();
  });
});
