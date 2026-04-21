/**
 * Backfill session integrity scores for all existing sessions.
 *
 * Computes profile distance against the CURRENT profile state.
 * This is retrospective (real-time checks compare against the
 * profile at time of submission), but establishes the baseline
 * distribution for threshold calibration.
 *
 * Usage: npx tsx src/scripts/backfill-integrity.ts
 */
import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { computeSessionIntegrity } from '../lib/libIntegrity.ts';
import { saveSessionIntegrity } from '../lib/libDb.ts';

async function main() {
  const rows = await sql`
    SELECT ss.question_id
    FROM tb_session_summaries ss
    LEFT JOIN tb_session_integrity si ON ss.question_id = si.question_id
    WHERE si.session_integrity_id IS NULL
    ORDER BY ss.session_summary_id ASC
  `;

  console.log(`[backfill-integrity] ${rows.length} sessions to process`);

  let ok = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const qid = (row as { question_id: number }).question_id;
    try {
      const result = await computeSessionIntegrity(qid);
      if (!result) {
        skipped++;
        continue;
      }
      await saveSessionIntegrity({
        questionId: result.questionId,
        profileDistance: result.profileDistance,
        dimensionCount: result.dimensionCount,
        zScoresJson: JSON.stringify(result.zScores),
        isFlagged: result.isFlagged,
        thresholdUsed: result.thresholdUsed,
        profileSessionCount: result.profileSessionCount,
      });
      const flag = result.isFlagged ? ' [FLAGGED]' : '';
      console.log(`  q${qid}: distance=${result.profileDistance.toFixed(2)}, dims=${result.dimensionCount}${flag}`);
      ok++;
    } catch (err) {
      console.error(`  q${qid}: ERROR`, err);
      failed++;
    }
  }

  console.log(`[backfill-integrity] done: ${ok} ok, ${skipped} skipped, ${failed} failed`);
  await sql.end();
}

main();
