/**
 * Recompute semantic signals for all journal responses.
 * Part of coordinated recompute after decontamination fixes.
 *
 * Usage: npx tsx src/scripts/recompute-semantic-signals.ts
 */
import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { computeSemanticSignals } from '../lib/libSemanticSignals.ts';
import { saveSemanticSignals, listResponseTexts } from '../lib/libDb.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';

async function main() {
  const subjectId = parseSubjectIdArg();

  // Get all journal responses with text (decrypted) and paste/drop counts.
  const texts = await listResponseTexts(subjectId, { orderBy: 'scheduled_for_asc' });
  const summaryRows = await sql`
    SELECT question_id, COALESCE(paste_count, 0)::int AS paste_count,
           COALESCE(drop_count, 0)::int AS drop_count
    FROM tb_session_summaries
    WHERE subject_id = ${subjectId}
  ` as Array<{ question_id: number; paste_count: number; drop_count: number }>;
  const counts = new Map(summaryRows.map(r => [r.question_id, r]));
  const rows = texts.map(t => ({
    question_id: t.question_id,
    text: t.text,
    paste_count: counts.get(t.question_id)?.paste_count ?? 0,
    drop_count: counts.get(t.question_id)?.drop_count ?? 0,
  }));

  console.log(`[recompute-semantic] ${rows.length} journal responses to process`);

  let ok = 0;
  for (const row of rows) {
    if (!row.text || row.text.length < 20) {
      console.log(`  q${row.question_id}: skipped (text too short: ${row.text?.length ?? 0} chars)`);
      continue;
    }

    const ss = computeSemanticSignals(row.text, row.paste_count, row.drop_count);
    await saveSemanticSignals(subjectId, row.question_id, {
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
  const count = await sql`SELECT COUNT(*)::int AS c FROM tb_semantic_signals WHERE subject_id = ${subjectId}`;
  console.log(`\n[recompute-semantic] done: ${ok} computed, ${(count[0] as { c: number }).c} rows in tb_semantic_signals`);

  await sql.end();
}

main().catch(err => {
  console.error('Recompute failed:', err);
  process.exit(1);
});
