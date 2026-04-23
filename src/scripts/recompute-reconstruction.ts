/**
 * Recompute reconstruction residuals for all journal sessions.
 * Part of coordinated recompute after decontamination fixes.
 *
 * Usage: npx tsx src/scripts/recompute-reconstruction.ts
 */
import 'dotenv/config';
import { sql } from '../lib/libDb.ts';
import { computeReconstructionResidual } from '../lib/libReconstruction.ts';

async function main() {
  // All journal sessions with responses, chronological order
  const rows = await sql`
    SELECT r.question_id
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
    ORDER BY q.scheduled_for ASC
  ` as Array<{ question_id: number }>;

  console.log(`[recompute-reconstruction] ${rows.length} journal sessions to process`);

  const [{ c: profileCount }] = await sql`SELECT COUNT(*)::int AS c FROM tb_personal_profile` as [{ c: number }];
  if (profileCount === 0) {
    console.log('No personal profile found. Exiting.');
    return;
  }

  let ok = 0, failed = 0;
  for (const { question_id } of rows) {
    try {
      await computeReconstructionResidual(question_id);
      ok++;
      console.log(`  q${question_id}: done (${ok}/${rows.length})`);
    } catch (err) {
      failed++;
      console.error(`  q${question_id}: FAILED`, (err as Error).message);
    }
  }

  const [stats] = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(DISTINCT question_id)::int AS sessions,
           COUNT(DISTINCT adversary_variant_id)::int AS variants
    FROM tb_reconstruction_residuals
  ` as [{ total: number; sessions: number; variants: number }];

  console.log(`\n[recompute-reconstruction] done: ${ok} sessions, ${failed} failed`);
  console.log(`  tb_reconstruction_residuals: ${stats.total} rows (${stats.sessions} sessions × ${stats.variants} variants)`);
}

main().catch(err => {
  console.error('Recompute failed:', err);
  process.exit(1);
});
