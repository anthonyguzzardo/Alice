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

  // Journal sessions with signal data. Calibrations (question_source_id = 3)
  // are excluded at the candidate-set level because computeReconstructionResidual
  // skips them by design (line 394) — keeping them in the candidate set just
  // burns Supabase roundtrips per-session for guaranteed-skip work.
  const questionIds = await sql`
    SELECT d.question_id
    FROM tb_dynamical_signals d
    JOIN tb_responses r ON d.question_id = r.question_id
    JOIN tb_questions q ON d.question_id = q.question_id
    WHERE d.subject_id = ${subjectId}
      AND q.question_source_id != 3
    ORDER BY d.question_id ASC
  ` as Array<{ question_id: number }>;

  console.log(`Inspecting ${questionIds.length} journal sessions with signal data.`);

  // Prerequisite: ≥3 prior journal responses. The Markov chain inside the
  // avatar engine needs that minimum corpus, and calibrations are excluded
  // from the corpus at libReconstruction's `listResponseTextsExcludingCalibration`
  // call. Counting all responses (including calibrations) gives a false
  // positive — a subject with 1 journal + 4 calibrations would pass a
  // raw-count check and then bail per-session inside the lib.
  const [{ c: journalCount }] = await sql`
    SELECT COUNT(*)::int AS c
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE r.subject_id = ${subjectId}
      AND q.question_source_id != 3
  ` as [{ c: number }];
  if (journalCount < 3) {
    console.log(`Only ${journalCount} journal responses in corpus (need >= 3 for Markov chain). Exiting.`);
    return;
  }

  const [{ c: profileCount }] = await sql`SELECT COUNT(*)::int AS c FROM tb_personal_profile WHERE subject_id = ${subjectId}` as [{ c: number }];
  if (profileCount === 0) {
    console.log('No personal profile found. Run backfill-profile.ts first. Exiting.');
    return;
  }

  // Snapshot row count to report actual writes. computeReconstructionResidual
  // returns a structured ReconstructionOutcome that explains why each call
  // produced (or didn't produce) variants, so we no longer have to guess.
  const beforeCount = await getReconstructionResidualCount(subjectId);

  let attempted = 0;
  let alreadyExisting = 0;
  let failed = 0;
  const reasons = new Map<string, number>();
  const bumpReason = (key: string, delta = 1): void => {
    reasons.set(key, (reasons.get(key) ?? 0) + delta);
  };

  for (const { question_id } of questionIds) {
    try {
      const [existing] = await sql`
        SELECT 1 FROM tb_reconstruction_residuals WHERE subject_id = ${subjectId} AND question_id = ${question_id}
      `;
      if (existing) {
        alreadyExisting++;
        continue;
      }

      const outcome = await computeReconstructionResidual(subjectId, question_id);
      attempted++;
      if (outcome.skippedReason) {
        bumpReason(`session_skipped:${outcome.skippedReason}`);
      }
      if (outcome.variantsBailed > 0) bumpReason('variant:avatar_null', outcome.variantsBailed);
      if (outcome.variantsErrored > 0) bumpReason('variant:errored', outcome.variantsErrored);
      process.stdout.write(`\r  ${attempted + alreadyExisting}/${questionIds.length} processed (${attempted} attempted, ${alreadyExisting} existing)`);
    } catch (err) {
      failed++;
      console.error(`\n  Failed question_id=${question_id}:`, (err as Error).message);
    }
  }

  const afterCount = await getReconstructionResidualCount(subjectId);
  const newRows = afterCount - beforeCount;

  console.log(`\n\nExisting: ${alreadyExisting}, Attempted: ${attempted}, New rows: ${newRows}, Failed: ${failed}`);
  if (reasons.size > 0) {
    console.log('  Skip/bail breakdown:');
    const sorted = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
    for (const [reason, count] of sorted) {
      console.log(`    ${reason}: ${count}`);
    }
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
