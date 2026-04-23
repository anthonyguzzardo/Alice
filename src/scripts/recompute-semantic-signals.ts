/**
 * Recompute semantic signals for all journal responses.
 * Part of coordinated recompute after decontamination fixes.
 *
 * Usage: npx tsx src/scripts/recompute-semantic-signals.ts
 */
import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { computeSemanticSignals } from '../lib/libSemanticSignals.ts';
import { saveSemanticSignals } from '../lib/libDb.ts';

async function main() {
  // Get all journal responses with their text and paste_count
  const rows = await sql`
    SELECT r.question_id, r.text,
           COALESCE(ss.paste_count, 0)::int AS paste_count
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    LEFT JOIN tb_session_summaries ss ON r.question_id = ss.question_id
    WHERE q.question_source_id != 3
    ORDER BY q.scheduled_for ASC
  ` as Array<{ question_id: number; text: string; paste_count: number }>;

  console.log(`[recompute-semantic] ${rows.length} journal responses to process`);

  let ok = 0;
  for (const row of rows) {
    if (!row.text || row.text.length < 20) {
      console.log(`  q${row.question_id}: skipped (text too short: ${row.text?.length ?? 0} chars)`);
      continue;
    }

    const ss = computeSemanticSignals(row.text, row.paste_count);
    await saveSemanticSignals(row.question_id, {
      idea_density: ss.ideaDensity,
      lexical_sophistication: ss.lexicalSophistication,
      epistemic_stance: ss.epistemicStance,
      integrative_complexity: ss.integrativeComplexity,
      deep_cohesion: ss.deepCohesion,
      referential_cohesion: ss.referentialCohesion,
      emotional_valence_arc: ss.emotionalValenceArc,
      text_compression_ratio: ss.textCompressionRatio,
      lexicon_version: ss.lexiconVersion,
      paste_contaminated: ss.pasteContaminated,
    });

    console.log(`  q${row.question_id}: idea=${ss.ideaDensity?.toFixed(3) ?? 'null'} lex=${ss.lexicalSophistication?.toFixed(3) ?? 'null'} refCoh=${ss.referentialCohesion?.toFixed(3) ?? 'null'} arc=${ss.emotionalValenceArc ?? 'null'}`);
    ok++;
  }

  // Verify
  const count = await sql`SELECT COUNT(*)::int AS c FROM tb_semantic_signals`;
  console.log(`\n[recompute-semantic] done: ${ok} computed, ${(count[0] as { c: number }).c} rows in tb_semantic_signals`);

  await sql.end();
}

main().catch(err => {
  console.error('Recompute failed:', err);
  process.exit(1);
});
