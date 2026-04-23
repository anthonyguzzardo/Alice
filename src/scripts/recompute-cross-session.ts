/**
 * Recompute cross-session signals for all journal sessions.
 * Part of coordinated recompute after decontamination fixes.
 *
 * Usage: npx tsx src/scripts/recompute-cross-session.ts
 */
import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { computeCrossSessionSignals } from '../lib/libCrossSessionSignals.ts';
import { saveCrossSessionSignals } from '../lib/libDb.ts';

async function main() {
  const rows = await sql`
    SELECT r.question_id, r.text
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
    ORDER BY q.scheduled_for ASC
  ` as Array<{ question_id: number; text: string }>;

  console.log(`[recompute-cross-session] ${rows.length} journal sessions to process`);

  let ok = 0, skipped = 0;
  for (const row of rows) {
    if (!row.text || row.text.length < 20) {
      console.log(`  q${row.question_id}: skipped (text too short)`);
      skipped++;
      continue;
    }

    const cs = await computeCrossSessionSignals(row.question_id, row.text);
    if (!cs) {
      console.log(`  q${row.question_id}: skipped (null return — calibration guard)`);
      skipped++;
      continue;
    }

    await saveCrossSessionSignals(row.question_id, {
      self_perplexity: cs.selfPerplexity,
      ncd_lag_1: cs.ncdLag1,
      ncd_lag_3: cs.ncdLag3,
      ncd_lag_7: cs.ncdLag7,
      ncd_lag_30: cs.ncdLag30,
      vocab_recurrence_decay: cs.vocabRecurrenceDecay,
      digraph_stability: cs.digraphStability,
      text_network_density: cs.textNetworkDensity,
      text_network_communities: cs.textNetworkCommunities,
      bridging_ratio: cs.bridgingRatio,
    });

    console.log(`  q${row.question_id}: perp=${cs.selfPerplexity?.toFixed(2) ?? 'null'} ncd1=${cs.ncdLag1?.toFixed(3) ?? 'null'} vocab=${cs.vocabRecurrenceDecay?.toFixed(4) ?? 'null'} digraph=${cs.digraphStability?.toFixed(4) ?? 'null'}`);
    ok++;
  }

  const count = await sql`SELECT COUNT(*)::int AS c FROM tb_cross_session_signals`;
  console.log(`\n[recompute-cross-session] done: ${ok} computed, ${skipped} skipped, ${(count[0] as { c: number }).c} rows in tb_cross_session_signals`);

  await sql.end();
}

main().catch(err => {
  console.error('Recompute failed:', err);
  process.exit(1);
});
