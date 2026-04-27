/**
 * Hotspot 13 — src/pages/api/instrument-status.ts:14-94 (now extracted as
 * getInstrumentStatusCounts + getConvergenceForVariant + getVariantSummary).
 *
 * The endpoint is owner-pinned (OWNER_SUBJECT_ID); the comment in the
 * source explicitly forbids mixing subjects in this rollup. The test
 * verifies that the helpers reflect only the requested subject under a
 * two-subject fixture.
 *
 *   13-1 (getInstrumentStatusCounts): 11 scoping sites — one per
 *        subselect/aggregate. The helper bundles them in a single row;
 *        we mutate one representative site and assert the corresponding
 *        count assertion catches it.
 *   13-2 (getConvergenceForVariant): 1 scoping site, AVG over
 *        tb_reconstruction_residuals filtered by subject_id +
 *        adversary_variant_id. With OTHER's residual at variant 1
 *        having a 10x divergent total_l2_norm, the AVG diverges loudly.
 *   13-3 (getVariantSummary): 1 scoping site, GROUP BY adversary_variant_id.
 *
 * Origin: handoff item 13. The 030_STEP6_PLAN.md §2 calls this a
 * "verification test" because the threading was already in place before
 * Step 6; the test cements that it stays that way.
 *
 * Mutation log:
 *   13-1 (getInstrumentStatusCounts: tb_responses subquery scope removed) —
 *        responses count grows from 2 (OWNER) to 3 (adds OTHER).
 *   13-2 (getConvergenceForVariant: subject_id removed) — totalL2 AVG
 *        diverges (OWNER's [0.5, 0.6] avg = 0.55; pooled [0.5, 0.6, 10.0]
 *        avg ≈ 3.7).
 *   13-3 (getVariantSummary: subject_id removed) — variant-1 sessions
 *        count grows from 2 (OWNER) to 3 (adds OTHER).
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import {
  getInstrumentStatusCounts,
  getConvergenceForVariant,
  getVariantSummary,
} from '../../../src/pages/api/instrument-status.ts';
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

async function insertDynamicalSignal(subjectId: number, questionId: number): Promise<void> {
  await sql`INSERT INTO tb_dynamical_signals (subject_id, question_id) VALUES (${subjectId}, ${questionId})`;
}

async function insertCrossSessionSignal(subjectId: number, questionId: number): Promise<void> {
  await sql`INSERT INTO tb_cross_session_signals (subject_id, question_id) VALUES (${subjectId}, ${questionId})`;
}

async function insertResidual(
  subjectId: number,
  questionId: number,
  variantId: number,
  questionSourceId: number,
  totalL2: number,
  motorL2: number,
  behavioralL2: number,
): Promise<void> {
  await sql`
    INSERT INTO tb_reconstruction_residuals (
      subject_id, question_id, adversary_variant_id, question_source_id,
      total_l2_norm, motor_l2_norm, behavioral_l2_norm, residual_count,
      behavioral_residual_count
    ) VALUES (
      ${subjectId}, ${questionId}, ${variantId}, ${questionSourceId},
      ${totalL2}, ${motorL2}, ${behavioralL2}, 10, 10
    )
  `;
}

describe('hotspot 13 — instrument-status scoping verification', () => {
  it('all instrument-status helpers reflect only OWNER under two-subject fixture', async () => {
    await seedTwoSubjects(sql);

    // ── OWNER ───────────────────────────────────────────────────────────
    // 2 journal sessions + 1 calibration. insertJournalSession also writes
    // tb_motor_signals, tb_process_signals via its standard fixture path.
    const ownerJ1 = await insertJournalSession(sql, {
      subjectId: OWNER_ID, profile: OWNER_PROFILE, scheduledFor: '2026-04-10', sessionIndex: 0,
    });
    const ownerJ2 = await insertJournalSession(sql, {
      subjectId: OWNER_ID, profile: OWNER_PROFILE, scheduledFor: '2026-04-12', sessionIndex: 1,
    });
    const ownerC = await insertJournalSession(sql, {
      subjectId: OWNER_ID, profile: OWNER_PROFILE, scheduledFor: null,
      sessionIndex: 100, questionSourceId: 3, dttmCreatedUtc: '2026-04-10T12:00:00Z',
    });

    // Dynamical + cross_session + semantic signals for one OWNER journal.
    await insertDynamicalSignal(OWNER_ID, ownerJ1);
    await insertCrossSessionSignal(OWNER_ID, ownerJ1);
    await sql`INSERT INTO tb_semantic_signals (subject_id, question_id, integrative_complexity) VALUES (${OWNER_ID}, ${ownerJ1}, 0.5)`;

    // 2 OWNER residuals at variant 1.
    await insertResidual(OWNER_ID, ownerJ1, 1, 1, 0.5, 0.1, 0.4);
    await insertResidual(OWNER_ID, ownerJ2, 1, 1, 0.6, 0.2, 0.5);

    // ── OTHER ───────────────────────────────────────────────────────────
    const otherJ1 = await insertJournalSession(sql, {
      subjectId: OTHER_ID, profile: OTHER_PROFILE, scheduledFor: '2026-04-15', sessionIndex: 200,
    });
    await insertDynamicalSignal(OTHER_ID, otherJ1);
    await insertCrossSessionSignal(OTHER_ID, otherJ1);
    await sql`INSERT INTO tb_semantic_signals (subject_id, question_id, integrative_complexity) VALUES (${OTHER_ID}, ${otherJ1}, 0.95)`;

    // 1 OTHER residual at variant 1 with divergent total_l2 — would
    // contaminate OWNER's AVG by ~6x if scope leaks.
    await insertResidual(OTHER_ID, otherJ1, 1, 1, 10.0, 5.0, 8.0);

    // ── 13-1: getInstrumentStatusCounts ────────────────────────────────
    const counts = await getInstrumentStatusCounts(OWNER_ID);

    // Assertions designed so each reflects ONLY OWNER's count.
    expect(counts.responses).toBe(3);          // 2 journal + 1 calibration responses
    expect(counts.sessions).toBe(3);           // 2 journal + 1 calibration session_summaries
    expect(counts.dynamical).toBe(1);          // OWNER has 1 dynamical signal row
    expect(counts.motor).toBe(3);              // insertJournalSession writes 1 motor row per session
    expect(counts.semantic).toBe(1);           // OWNER has 1 semantic signal row
    expect(counts.process).toBe(3);            // insertJournalSession writes 1 process row per session
    expect(counts.cross_session).toBe(1);      // OWNER has 1 cross-session signal row
    expect(counts.residuals).toBe(2);          // OWNER has 2 residual rows
    expect(counts.calibration_questions).toBe(1);

    // No count equals OTHER's contamination shifts:
    //   responses 3+1=4, sessions 3+1=4, dynamical 1+1=2, residuals 2+1=3.
    // Each mutation lifts the corresponding count above the OWNER value.

    // ── 13-2: getConvergenceForVariant ──────────────────────────────────
    const conv = await getConvergenceForVariant(OWNER_ID, 1);
    expect(conv).not.toBeNull();
    // OWNER variant-1 totalL2 values: [0.5, 0.6]; AVG = 0.55, ROUND(_, 1) = 0.6.
    // With OTHER's 10.0 mixed in, AVG = (0.5+0.6+10.0)/3 ≈ 3.7.
    expect(parseFloat(conv!.totalL2!)).toBeCloseTo(0.6, 1);
    expect(parseFloat(conv!.behavioralL2!)).toBeCloseTo(0.5, 1);

    // ── 13-3: getVariantSummary ─────────────────────────────────────────
    const variants = await getVariantSummary(OWNER_ID);
    expect(variants.length).toBe(1); // OWNER only has variant 1 residuals
    expect(variants[0]!.variantId).toBe(1);
    expect(variants[0]!.sessions).toBe(2);  // OWNER's 2 residual rows
    expect(parseFloat(variants[0]!.behavioralL2!)).toBeCloseTo(0.5, 1);
  });
});
