/**
 * Integration test: verify the full residual reproducibility chain.
 *
 * This script exercises the production path end-to-end:
 * 1. Finds a question with full signal coverage
 * 2. Deletes one pre-reproducibility-era residual (variant 1)
 * 3. Recomputes it via the production pipeline (which now stores seed + profile)
 * 4. Verifies the stored residual by regenerating the ghost from stored inputs
 * 5. Reports per-signal comparison: stored avatar signals vs recomputed
 *
 * Expected result:
 * - Dynamical signals: bit-identical (same ghost, same Rust engine, same build)
 * - Motor signals: bit-identical (same reasoning)
 * - Perplexity: bit-identical (deterministic Markov model)
 * - Semantic signals: NOT tested (external API dependence)
 *
 * If dynamical or motor signals diverge, that is a reproducibility failure
 * and must be investigated, not papered over with tolerances.
 *
 * Usage: npx tsx src/scripts/verify-residual-integration.ts
 */

import sql from '../lib/libDb.ts';
import { computeReconstructionResidual, verifyResidual } from '../lib/libReconstruction.ts';

async function main(): Promise<void> {
  console.log('=== Residual Reproducibility Integration Test ===\n');

  // 1. Find a question with full signal coverage and an existing residual
  const candidates = await sql`
    SELECT r.question_id
    FROM tb_reconstruction_residuals r
    WHERE r.adversary_variant_id = 1
      AND r.avatar_seed IS NULL
    ORDER BY r.question_id DESC
    LIMIT 1
  ` as Array<{ question_id: number }>;

  if (candidates.length === 0) {
    console.log('No pre-reproducibility-era residuals found. Nothing to test.');
    await sql.end();
    process.exit(0);
  }

  const questionId = candidates[0]!.question_id;
  console.log(`Selected question_id: ${questionId}`);

  // 2. Delete the pre-reproducibility-era variant-1 residual
  const deleted = await sql`
    DELETE FROM tb_reconstruction_residuals
    WHERE question_id = ${questionId} AND adversary_variant_id = 1
    RETURNING reconstruction_residual_id
  `;
  console.log(`Deleted pre-reproducibility residual: id=${(deleted[0] as Record<string, unknown>)?.reconstruction_residual_id}`);

  // 3. Recompute via production pipeline (stores seed + profile + hash + topic)
  console.log('Recomputing residual via production pipeline...');
  await computeReconstructionResidual(questionId);

  // 4. Verify the new residual has reproducibility data
  const check = await sql`
    SELECT avatar_seed, corpus_sha256, avatar_topic,
           pg_column_size(profile_snapshot_json::text) AS profile_bytes
    FROM tb_reconstruction_residuals
    WHERE question_id = ${questionId} AND adversary_variant_id = 1
  ` as Array<Record<string, unknown>>;

  if (!check[0]?.avatar_seed) {
    console.error('FAIL: Recomputed residual has NULL avatar_seed. Pipeline did not persist seed.');
    await sql.end();
    process.exit(1);
  }

  console.log(`  seed: ${check[0].avatar_seed}`);
  console.log(`  corpus_sha256: ${(check[0].corpus_sha256 as string)?.substring(0, 16)}...`);
  console.log(`  avatar_topic: ${(check[0].avatar_topic as string)?.substring(0, 60)}...`);
  console.log(`  profile_snapshot_json: ${check[0].profile_bytes} bytes`);
  console.log('');

  // 5. Verify: regenerate ghost from stored inputs and compare signals
  console.log('Verifying residual via regeneration...\n');
  const result = await verifyResidual(questionId, 1);

  if (!result) {
    console.error('FAIL: verifyResidual returned null (missing seed/profile or corpus mismatch).');
    await sql.end();
    process.exit(1);
  }

  // 6. Report results
  console.log(`Corpus integrity: ${result.corpusValid ? 'VALID' : 'MISMATCH'}`);
  console.log('');

  console.log('Signal-by-signal comparison (stored avatar vs recomputed):');
  console.log('─'.repeat(90));
  console.log(
    'Signal'.padEnd(25) +
    'Family'.padEnd(14) +
    'Stored'.padEnd(20) +
    'Recomputed'.padEnd(20) +
    'Match',
  );
  console.log('─'.repeat(90));

  for (const s of result.signals) {
    const storedStr = s.stored != null ? s.stored.toFixed(10) : 'null';
    const recompStr = s.recomputed != null ? s.recomputed.toFixed(10) : 'null';
    const matchStr = s.match ? 'EXACT' : `DELTA=${s.delta?.toExponential(4)}`;
    console.log(
      s.name.padEnd(25) +
      s.family.padEnd(14) +
      storedStr.padEnd(20) +
      recompStr.padEnd(20) +
      matchStr,
    );
  }

  console.log('─'.repeat(90));
  console.log('');

  console.log(`Dynamical signals: ${result.dynamicalMatch ? 'ALL EXACT' : 'MISMATCH'}`);
  console.log(`Motor signals:     ${result.motorMatch ? 'ALL EXACT' : 'MISMATCH'}`);
  console.log(`Semantic signals:  SKIPPED (externally-dependent, per design)`);
  console.log('');

  if (result.allMatch) {
    console.log('PASS: All dynamical and motor signals are bit-identical after regeneration.');
    console.log('The reproducibility chain works end-to-end on production data.');
  } else {
    console.log('FAIL: Signal mismatch detected. This is a reproducibility failure.');
    console.log('Do NOT adjust tolerances. Investigate the divergence source.');
    const mismatches = result.signals.filter(s => !s.match);
    for (const m of mismatches) {
      console.log(`  ${m.name}: stored=${m.stored}, recomputed=${m.recomputed}, delta=${m.delta?.toExponential(6)}`);
    }
  }

  await sql.end();
  process.exit(result.allMatch ? 0 : 1);
}

main().catch((err) => {
  console.error('Integration test failed with error:', err);
  process.exit(1);
});
