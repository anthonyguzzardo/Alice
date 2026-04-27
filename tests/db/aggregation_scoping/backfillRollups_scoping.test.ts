/**
 * Hotspot L — backfill rollup queries scoping verification.
 *
 *   L-1 (backfill-adversary-variants.ts:getVariantStats): per-variant
 *       rollup with `r.subject_id = ${subjectId}` in the LEFT JOIN ON
 *       clause (so variants with zero rows still appear).
 *   L-2 (backfill-reconstruction.ts:getReconstructionResidualCount):
 *       single COUNT(*) with `WHERE subject_id = ${subjectId}`.
 *   L-3 (backfill-reconstruction.ts:getReconstructionStats): single
 *       row of COUNT/AVG/MIN/MAX with `WHERE subject_id = ${subjectId}`.
 *   L-4 (backfill-reconstruction.ts:getReconstructionSourceSplit):
 *       GROUP BY question_source_id with `WHERE subject_id = ${subjectId}`.
 *
 * Origin: handoff item L. Both scripts run as one-shot operator tools;
 * a scoping bug shows up as a misleading post-backfill summary
 * (operator sees the wrong subject's rollup or a pooled mean).
 *
 * Fixture: tb_reconstruction_residuals rows directly inserted (no
 * tb_questions rows needed — none of the rollup queries JOIN to
 * tb_questions). OWNER has 3 rows total (2 journal at variants 1/2,
 * 1 calibration at variant 1). OTHER has 1 journal row at variant 1
 * with a divergent total_l2_norm=10.0 — large enough that pooled
 * AVG diverges by ~6x from OWNER-only.
 *
 * Mutation log:
 *   L-1  (variantStats r.subject_id): pooled means; variant-1 count
 *        grows from 2 (OWNER's 1+1) to 3 (adds OTHER's). avg_l2
 *        becomes ~3.63 instead of OWNER-only ~0.45.
 *   L-2  (residualCount subject_id): count grows from 3 to 4.
 *   L-3  (stats subject_id): total grows from 3 to 4; avg_norm jumps
 *        from 0.5 to 2.875.
 *   L-4  (sourceSplit subject_id): journal (source=1) row's c grows
 *        from 2 to 3, avg_norm jumps from 0.55 to ~3.7.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { getVariantStats } from '../../../src/scripts/backfill-adversary-variants.ts';
import {
  getReconstructionResidualCount,
  getReconstructionStats,
  getReconstructionSourceSplit,
} from '../../../src/scripts/backfill-reconstruction.ts';
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
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

async function insertResidual(
  subjectId: number,
  questionId: number,
  variantId: number,
  questionSourceId: number,
  totalL2: number,
  motorL2: number,
): Promise<void> {
  await sql`
    INSERT INTO tb_reconstruction_residuals (
      subject_id, question_id, adversary_variant_id, question_source_id,
      total_l2_norm, motor_l2_norm, residual_count
    ) VALUES (
      ${subjectId}, ${questionId}, ${variantId}, ${questionSourceId},
      ${totalL2}, ${motorL2}, 10
    )
  `;
}

describe('hotspot L — backfill rollup scoping', () => {
  it('per-subject rollups reflect only OWNER rows under two-subject fixture', async () => {
    await seedTwoSubjects(sql);

    // OWNER: 2 journal residuals at variants 1 and 2 (same question_id),
    // 1 calibration residual at variant 1 (different question_id).
    await insertResidual(OWNER_ID, 1001, 1, 1, 0.5, 0.1);
    await insertResidual(OWNER_ID, 1001, 2, 1, 0.6, 0.2);
    await insertResidual(OWNER_ID, 1002, 1, 3, 0.4, 0.05);

    // OTHER: 1 journal residual at variant 1, large total_l2 to make
    // pooled AVGs diverge clearly from OWNER-only.
    await insertResidual(OTHER_ID, 1003, 1, 1, 10.0, 5.0);

    // ── L-1: getVariantStats ────────────────────────────────────────────
    const variantStats = await getVariantStats(OWNER_ID);

    // 5 variants seeded by te_adversary_variants. All 5 rows present
    // because LEFT JOIN; variants without OWNER rows have count=0.
    expect(variantStats.length).toBe(5);

    const v1 = variantStats.find((v) => v.id === 1)!;
    const v2 = variantStats.find((v) => v.id === 2)!;
    const v3 = variantStats.find((v) => v.id === 3)!;

    // OWNER has 2 rows at variant 1 (1 journal + 1 cal). With L-1
    // mutation removed, count grows to 3 (adds OTHER's).
    expect(v1.count).toBe(2);
    // avg_l2 returns NUMERIC; postgres.js may return string. Convert.
    expect(parseFloat(v1.avg_l2!)).toBeCloseTo(0.45, 4);

    // OWNER has 1 row at variant 2.
    expect(v2.count).toBe(1);
    expect(parseFloat(v2.avg_l2!)).toBeCloseTo(0.6, 4);

    // OWNER has 0 rows at variant 3 (LEFT JOIN gives count=0, no avg).
    expect(v3.count).toBe(0);
    expect(v3.avg_l2).toBeNull();

    // ── L-2: getReconstructionResidualCount ─────────────────────────────
    // OWNER has 3 rows total. Mutation removed → 4.
    const count = await getReconstructionResidualCount(OWNER_ID);
    expect(count).toBe(3);

    // ── L-3: getReconstructionStats ─────────────────────────────────────
    // OWNER total=3, avg=(0.5+0.6+0.4)/3 = 0.5. Mutation removed →
    // total=4, avg=(0.5+0.6+0.4+10.0)/4 = 2.875.
    const stats = await getReconstructionStats(OWNER_ID);
    expect(stats.total).toBe(3);
    expect(stats.with_norm).toBe(3);
    expect(parseFloat(stats.avg_norm!)).toBeCloseTo(0.5, 4);
    expect(parseFloat(stats.min_norm!)).toBeCloseTo(0.4, 4);
    expect(parseFloat(stats.max_norm!)).toBeCloseTo(0.6, 4);

    // ── L-4: getReconstructionSourceSplit ───────────────────────────────
    // OWNER has 2 rows at source=1 (journal) and 1 row at source=3
    // (calibration). Mutation removed → source=1 c=3, avg_norm jumps.
    const sourceSplit = await getReconstructionSourceSplit(OWNER_ID);
    expect(sourceSplit.length).toBe(2);

    const journalSplit = sourceSplit.find((r) => r.question_source_id === 1)!;
    const calSplit = sourceSplit.find((r) => r.question_source_id === 3)!;

    expect(journalSplit.c).toBe(2);
    expect(parseFloat(journalSplit.avg_norm!)).toBeCloseTo(0.55, 4);
    expect(calSplit.c).toBe(1);
    expect(parseFloat(calSplit.avg_norm!)).toBeCloseTo(0.4, 4);
  });
});
