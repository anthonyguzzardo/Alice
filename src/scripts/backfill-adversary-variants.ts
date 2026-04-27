/**
 * Backfill: compute adversary variants 2-5 for existing sessions.
 *
 * Finds sessions that have baseline (variant 1) residuals but are
 * missing one or more of the advanced variants (2-5). Calls
 * computeReconstructionResidual() which internally loops over all
 * 5 variants and skips any that already exist.
 *
 * Idempotent. Safe to re-run.
 *
 * Requires:
 *   - Rust native module built (npm run build:rust)
 *   - Personal profile populated with new fields (run backfill-profile.ts first)
 *   - Existing baseline residuals (variant 1) in tb_reconstruction_residuals
 *
 * Run: npx tsx src/scripts/backfill-adversary-variants.ts
 */

import { sql } from '../lib/libDb.ts';
import { computeReconstructionResidual } from '../lib/libReconstruction.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';
import { fileURLToPath } from 'node:url';

export interface VariantStat {
  id: number;
  name: string;
  count: number;
  avg_l2: string | null;
  avg_motor_l2: string | null;
}

/** Per-variant rollup: COUNT and AVG over tb_reconstruction_residuals
 *  scoped to a subject. The subject scope lives on the LEFT JOIN's ON
 *  clause so variants with zero rows for that subject still appear with
 *  count=0 (not filtered out by a WHERE). */
export async function getVariantStats(subjectId: number): Promise<VariantStat[]> {
  return await sql`
    SELECT
      v.adversary_variant_id AS id,
      v.name,
      COUNT(r.reconstruction_residual_id)::int AS count,
      ROUND(AVG(r.total_l2_norm)::numeric, 4) AS avg_l2,
      ROUND(AVG(r.motor_l2_norm)::numeric, 4) AS avg_motor_l2
    FROM te_adversary_variants v
    LEFT JOIN tb_reconstruction_residuals r
      ON v.adversary_variant_id = r.adversary_variant_id AND r.subject_id = ${subjectId}
    GROUP BY v.adversary_variant_id, v.name
    ORDER BY v.adversary_variant_id
  ` as VariantStat[];
}

async function main() {
  const subjectId = parseSubjectIdArg();

  // Find question_ids with baseline (1) but missing any of 2-5
  const rows = await sql`
    SELECT DISTINCT r.question_id
    FROM tb_reconstruction_residuals r
    WHERE r.subject_id = ${subjectId}
      AND r.adversary_variant_id = 1
      AND NOT EXISTS (
        SELECT 1 FROM tb_reconstruction_residuals r2
        WHERE r2.subject_id = ${subjectId}
          AND r2.question_id = r.question_id
          AND r2.adversary_variant_id = 5
      )
    ORDER BY r.question_id ASC
  ` as Array<{ question_id: number }>;

  console.log(`Found ${rows.length} sessions needing variant backfill.`);

  if (rows.length === 0) {
    console.log('All sessions already have all 5 variants. Nothing to do.');
    return;
  }

  // Check prerequisites
  const [{ c: profileCount }] = await sql`SELECT COUNT(*)::int AS c FROM tb_personal_profile WHERE subject_id = ${subjectId}` as [{ c: number }];
  if (profileCount === 0) {
    console.log('No personal profile found. Run backfill-profile.ts first. Exiting.');
    return;
  }

  let processed = 0;
  let failed = 0;

  for (const { question_id } of rows) {
    try {
      await computeReconstructionResidual(subjectId, question_id);
      processed++;
      process.stdout.write(`\r  ${processed}/${rows.length} processed`);
    } catch (err) {
      failed++;
      console.error(`\n  Failed question_id=${question_id}:`, (err as Error).message);
    }
  }

  console.log(`\n\nBackfill complete. Processed: ${processed}, Failed: ${failed}`);

  // Report final state by variant
  const variantStats = await getVariantStats(subjectId);

  console.log('\n  Residuals by variant:');
  for (const row of variantStats) {
    console.log(`    ${row.id}. ${row.name}: ${row.count} rows, avg total L2=${row.avg_l2}, avg motor L2=${row.avg_motor_l2}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}
