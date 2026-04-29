/**
 * Recompute cross-session signals for all journal sessions.
 * Part of coordinated recompute after decontamination fixes.
 *
 * Usage: npx tsx src/scripts/recompute-cross-session.ts
 */
import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { computeCrossSessionSignals } from '../lib/libCrossSessionSignals.ts';
import { saveCrossSessionSignals, listResponseTexts } from '../lib/libDb.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';

async function main() {
  const subjectId = parseSubjectIdArg();

  // Plaintext through libDb's decryption boundary.
  const rows = (await listResponseTexts(subjectId, { orderBy: 'scheduled_for_asc' }))
    .map(r => ({ question_id: r.question_id, text: r.text }));

  console.log(`[recompute-cross-session] ${rows.length} journal sessions to process`);

  let ok = 0, skipped = 0;
  for (const row of rows) {
    if (!row.text || row.text.length < 20) {
      console.log(`  q${row.question_id}: skipped (text too short)`);
      skipped++;
      continue;
    }

    const cs = await computeCrossSessionSignals(subjectId, row.question_id, row.text);
    if (!cs) {
      console.log(`  q${row.question_id}: skipped (null return — calibration guard)`);
      skipped++;
      continue;
    }

    await saveCrossSessionSignals(subjectId, row.question_id, {
      self_perplexity: cs.selfPerplexity,
      motor_self_perplexity: cs.motorSelfPerplexity,
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

  const count = await sql`SELECT COUNT(*)::int AS c FROM tb_cross_session_signals WHERE subject_id = ${subjectId}`;
  console.log(`\n[recompute-cross-session] done: ${ok} computed, ${skipped} skipped, ${(count[0] as { c: number }).c} rows in tb_cross_session_signals`);

  await sql.end();
}

main().catch(err => {
  console.error('Recompute failed:', err);
  process.exit(1);
});
