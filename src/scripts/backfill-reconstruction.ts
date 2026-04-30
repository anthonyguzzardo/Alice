/**
 * Backfill: compute reconstruction residuals for all existing sessions.
 *
 * Iterates over all question_ids that have signal data (dynamical signals
 * as the gate) and runs computeReconstructionResidual() on each. The
 * function is idempotent (skips if row exists, ON CONFLICT DO NOTHING).
 *
 * Requires:
 *   - Rust native module built (npm run build:rust)
 *   - Personal profile populated (at least 1 row in tb_personal_profile)
 *   - >= 3 entries in tb_responses (Markov chain minimum)
 *
 * Run: npx tsx src/scripts/backfill-reconstruction.ts
 */

import { sql } from '../lib/libDb.ts';
import { computeReconstructionResidual } from '../lib/libReconstruction.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';
import { fileURLToPath } from 'node:url';

export async function getReconstructionResidualCount(subjectId: number): Promise<number> {
  const [{ c }] = await sql`
    SELECT COUNT(*)::int AS c FROM tb_reconstruction_residuals WHERE subject_id = ${subjectId}
  ` as [{ c: number }];
  return c;
}

export interface ReconstructionStats {
  total: number;
  with_norm: number;
  avg_norm: string | null;
  min_norm: string | null;
  max_norm: string | null;
  avg_signals: string | null;
}

export async function getReconstructionStats(subjectId: number): Promise<ReconstructionStats> {
  const [stats] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(total_l2_norm)::int AS with_norm,
      ROUND(AVG(total_l2_norm)::numeric, 4) AS avg_norm,
      ROUND(MIN(total_l2_norm)::numeric, 4) AS min_norm,
      ROUND(MAX(total_l2_norm)::numeric, 4) AS max_norm,
      ROUND(AVG(residual_count)::numeric, 1) AS avg_signals
    FROM tb_reconstruction_residuals
    WHERE subject_id = ${subjectId}
  ` as [ReconstructionStats];
  return stats;
}

export interface SourceSplitRow {
  question_source_id: number;
  c: number;
  avg_norm: string | null;
}

export async function getReconstructionSourceSplit(subjectId: number): Promise<SourceSplitRow[]> {
  return await sql`
    SELECT question_source_id, COUNT(*)::int AS c,
           ROUND(AVG(total_l2_norm)::numeric, 4) AS avg_norm
    FROM tb_reconstruction_residuals
    WHERE subject_id = ${subjectId}
      AND question_source_id IS NOT NULL
    GROUP BY question_source_id
    ORDER BY question_source_id
  ` as SourceSplitRow[];
}

async function main() {
  const subjectId = parseSubjectIdArg();

  // All question_ids with signal data + a response (required for reconstruction)
  const questionIds = await sql`
    SELECT d.question_id
    FROM tb_dynamical_signals d
    JOIN tb_responses r ON d.question_id = r.question_id
    WHERE d.subject_id = ${subjectId}
    ORDER BY d.question_id ASC
  ` as Array<{ question_id: number }>;

  console.log(`Inspecting ${questionIds.length} sessions with signal data.`);

  // Check prerequisites
  const [{ c: responseCount }] = await sql`SELECT COUNT(*)::int AS c FROM tb_responses WHERE subject_id = ${subjectId}` as [{ c: number }];
  if (responseCount < 3) {
    console.log(`Only ${responseCount} responses in corpus (need >= 3 for Markov chain). Exiting.`);
    return;
  }

  const [{ c: profileCount }] = await sql`SELECT COUNT(*)::int AS c FROM tb_personal_profile WHERE subject_id = ${subjectId}` as [{ c: number }];
  if (profileCount === 0) {
    console.log('No personal profile found. Run backfill-profile.ts first. Exiting.');
    return;
  }

  // Snapshot row count to report actual writes vs attempts. computeReconstructionResidual
  // can silently bail (calibration, <3 prior journals, missing avatar) without throwing,
  // so an "attempted" counter on no-throw alone is misleading. Truth is the delta.
  const beforeCount = await getReconstructionResidualCount(subjectId);

  let attempted = 0;
  let alreadyExisting = 0;
  let failed = 0;

  for (const { question_id } of questionIds) {
    try {
      const [existing] = await sql`
        SELECT 1 FROM tb_reconstruction_residuals WHERE subject_id = ${subjectId} AND question_id = ${question_id}
      `;
      if (existing) {
        alreadyExisting++;
        continue;
      }

      await computeReconstructionResidual(subjectId, question_id);
      attempted++;
      process.stdout.write(`\r  ${attempted + alreadyExisting}/${questionIds.length} processed (${attempted} attempted, ${alreadyExisting} existing)`);
    } catch (err) {
      failed++;
      console.error(`\n  Failed question_id=${question_id}:`, (err as Error).message);
    }
  }

  const afterCount = await getReconstructionResidualCount(subjectId);
  const newRows = afterCount - beforeCount;

  console.log(`\n\nExisting: ${alreadyExisting}, Attempted: ${attempted}, New rows: ${newRows}, Failed: ${failed}`);
  if (attempted > 0 && newRows === 0) {
    console.log(`  Note: every attempt produced zero rows. Common silent-bail causes: session is a calibration (excluded by design), <3 prior journal responses for the Markov chain, or thin profile/corpus data.`);
  }

  // Report final state
  const residualCount = await getReconstructionResidualCount(subjectId);
  const stats = await getReconstructionStats(subjectId);

  console.log(`\n  tb_reconstruction_residuals: ${residualCount} rows`);
  console.log(`  With L2 norm: ${stats.with_norm}`);
  console.log(`  Total L2 norm: avg=${stats.avg_norm}, min=${stats.min_norm}, max=${stats.max_norm}`);
  console.log(`  Avg signals per row: ${stats.avg_signals}`);

  // Source split
  const sourceSplit = await getReconstructionSourceSplit(subjectId);

  if (sourceSplit.length > 0) {
    console.log('\n  By source:');
    for (const row of sourceSplit) {
      const label = row.question_source_id === 3 ? 'calibration' : 'journal';
      console.log(`    ${label} (${row.question_source_id}): ${row.c} rows, avg L2=${row.avg_norm}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}
