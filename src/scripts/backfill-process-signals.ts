/**
 * Backfill: recompute process signals for all existing sessions.
 *
 * Unlike backfill-signals.ts (which skips existing rows via ON CONFLICT DO NOTHING),
 * this script UPDATEs existing tb_process_signals rows with recomputed values.
 *
 * Motivation: F-02 audit fix -- i_burst_count was computed with tautological logic
 * (any burst starting with >= 3 bytes of insertion counted as I-burst, regardless
 * of cursor position). The fix requires cursor_pos < text_length for a true I-burst
 * per Deane 2015. F-01 also fixed UTF-16 unit confusion in abandoned_thought_count.
 *
 * Safe to re-run: idempotent UPDATE with recomputed values.
 *
 * Run: npx tsx src/scripts/backfill-process-signals.ts
 */

import { sql, listEventLogJson } from '../lib/libDb.ts';
import { computeProcessSignals } from '../lib/libSignalsNative.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';

async function main() {
  const subjectId = parseSubjectIdArg();

  // Plaintext event logs come back through libDb's decryption boundary.
  // Filter to sessions that already have process signals (recompute target).
  const allEventLogs = await listEventLogJson(subjectId);
  const havingProcess = await sql`
    SELECT question_id FROM tb_process_signals WHERE subject_id = ${subjectId}
  ` as Array<{ question_id: number }>;
  const havingSet = new Set(havingProcess.map(r => r.question_id));
  const sessions = allEventLogs.filter(r => havingSet.has(r.question_id));

  console.log(`Found ${sessions.length} sessions to recompute.`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of sessions) {
    try {
      const eventLogJson = row.event_log_json;

      const ps = computeProcessSignals(eventLogJson);
      if (!ps) {
        // null = Rust engine unavailable (no .node binary) or compute threw.
        // Either way, no values to write — count as failed and continue.
        failed++;
        continue;
      }

      await sql`
        UPDATE tb_process_signals SET
           pause_within_word       = ${ps.pauseWithinWord}
          ,pause_between_word      = ${ps.pauseBetweenWord}
          ,pause_between_sentence  = ${ps.pauseBetweenSentence}
          ,abandoned_thought_count = ${ps.abandonedThoughtCount}
          ,r_burst_count           = ${ps.rBurstCount}
          ,i_burst_count           = ${ps.iBurstCount}
          ,vocab_expansion_rate    = ${ps.vocabExpansionRate}
          ,phase_transition_point  = ${ps.phaseTransitionPoint}
          ,strategy_shift_count    = ${ps.strategyShiftCount}
        WHERE subject_id = ${subjectId} AND question_id = ${row.question_id}
      `;

      updated++;
      process.stdout.write(`\r  ${updated}/${sessions.length} updated`);
    } catch (err) {
      failed++;
      console.error(`\n  Failed question_id=${row.question_id}:`, (err as Error).message);
    }
  }

  console.log(`\n\nBackfill complete. Updated: ${updated}, Failed: ${failed}`);

  // Show before/after summary for i_burst_count
  const [stats] = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(i_burst_count) AS non_null,
      ROUND(AVG(i_burst_count)::numeric, 2) AS avg_i_burst,
      SUM(i_burst_count) AS total_i_bursts
    FROM tb_process_signals
    WHERE subject_id = ${subjectId}
  ` as [{ total: number; non_null: number; avg_i_burst: number; total_i_bursts: number }];

  console.log(`  Post-backfill i_burst_count: ${stats.non_null}/${stats.total} non-null, avg=${stats.avg_i_burst}, sum=${stats.total_i_bursts}`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
