/**
 * Regenerate semantic baselines and trajectory z-scores from scratch.
 *
 * Clears tb_semantic_trajectory and resets tb_semantic_baselines, then
 * reprocesses all non-calibration sessions in chronological order.
 * This is necessary after embedding model changes (topic z-scores depend
 * on HNSW similarity against the current embeddings).
 *
 * Run: npx tsx src/scripts/backfill-semantic-baselines.ts
 */
import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { updateSemanticBaselines } from '../lib/libSemanticBaseline.ts';

async function main() {
  // Clear existing trajectory and baselines
  console.log('[semantic-backfill] Clearing tb_semantic_trajectory...');
  const deleted = await sql`DELETE FROM tb_semantic_trajectory`;
  console.log(`[semantic-backfill] Deleted ${deleted.count} trajectory rows`);

  console.log('[semantic-backfill] Resetting tb_semantic_baselines...');
  await sql`
    UPDATE tb_semantic_baselines
    SET running_mean = 0, running_m2 = 0, session_count = 0, last_question_id = NULL,
        dttm_modified_utc = CURRENT_TIMESTAMP, modified_by = 'semantic-backfill'
  `;

  // Get all non-calibration question IDs in chronological order
  const questions = await sql`
    SELECT q.question_id
    FROM tb_questions q
    JOIN tb_responses r ON q.question_id = r.question_id
    WHERE q.question_source_id != 3
    ORDER BY q.scheduled_for ASC
  ` as Array<{ question_id: number }>;

  console.log(`[semantic-backfill] Reprocessing ${questions.length} sessions...`);

  for (let i = 0; i < questions.length; i++) {
    const qid = questions[i].question_id;
    await updateSemanticBaselines(qid);
    console.log(`[semantic-backfill] ${i + 1}/${questions.length}: question_id=${qid}`);
  }

  // Report final state
  const baselines = await sql`
    SELECT signal_name, session_count, running_mean FROM tb_semantic_baselines ORDER BY signal_name
  `;
  console.log('\n[semantic-backfill] Final baselines:');
  for (const b of baselines) {
    const row = b as { signal_name: string; session_count: number; running_mean: number };
    console.log(`  ${row.signal_name}: n=${row.session_count}, mean=${row.running_mean.toFixed(6)}`);
  }

  const stats = await sql`
    SELECT COUNT(*) AS total,
           COUNT(topic_z_score) AS with_topic_z,
           COUNT(*) FILTER (WHERE gated) AS gated_count
    FROM tb_semantic_trajectory
  `;
  const s = stats[0] as { total: number; with_topic_z: number; gated_count: number };
  console.log(`\n[semantic-backfill] Trajectory: ${s.total} rows, ${s.with_topic_z} with topic z-scores, ${s.gated_count} gated`);

  await sql.end();
}

main().catch(err => {
  console.error('[semantic-backfill] Fatal:', err);
  process.exit(1);
});
