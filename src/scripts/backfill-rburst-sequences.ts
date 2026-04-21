/**
 * Backfill: extract R-burst sequences from existing event logs.
 *
 * Reprocesses all sessions that have event_log_json, extracts per-R-burst
 * detail from the Rust engine, and persists to tb_rburst_sequences.
 * Also recomputes rburst_trajectory_shape on tb_session_metadata and
 * refreshes the personal profile with R-burst aggregation.
 *
 * Safe to re-run: skips sessions that already have R-burst rows.
 *
 * Run: npx tsx src/scripts/backfill-rburst-sequences.ts
 */

import { sql, saveRburstSequence } from '../lib/libDb.ts';
import { computeProcessSignals } from '../lib/libSignalsNative.ts';
import { updateRburstTrajectoryShape } from '../lib/libSessionMetadata.ts';
import { updateProfile } from '../lib/libProfile.ts';

async function main() {
  // Find all sessions with event logs
  const sessions = await sql`
    SELECT se.question_id, se.event_log_json
    FROM tb_session_events se
    ORDER BY se.question_id ASC
  ` as Array<{ question_id: number; event_log_json: unknown }>;

  console.log(`Found ${sessions.length} sessions with event logs.`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  let totalRbursts = 0;

  for (const row of sessions) {
    try {
      // Skip if already backfilled
      const existing = await sql`
        SELECT 1 FROM tb_rburst_sequences WHERE question_id = ${row.question_id} LIMIT 1
      `;
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const eventLogJson = typeof row.event_log_json === 'string'
        ? row.event_log_json
        : JSON.stringify(row.event_log_json);

      const ps = computeProcessSignals(eventLogJson);
      if (!ps || ps.rBurstSequences.length === 0) {
        skipped++;
        continue;
      }

      await saveRburstSequence(row.question_id, ps.rBurstSequences);
      totalRbursts += ps.rBurstSequences.length;

      // Compute trajectory shape if session metadata exists
      await updateRburstTrajectoryShape(row.question_id);

      inserted++;
      process.stdout.write(`\r  ${inserted} sessions, ${totalRbursts} R-bursts`);
    } catch (err) {
      failed++;
      console.error(`\n  Failed question_id=${row.question_id}:`, (err as Error).message);
    }
  }

  console.log(`\n\nBackfill complete. Inserted: ${inserted}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`  Total R-bursts captured: ${totalRbursts}`);

  // Refresh profile with new R-burst aggregation
  const [lastSession] = await sql`
    SELECT question_id FROM tb_session_summaries ORDER BY session_summary_id DESC LIMIT 1
  ` as Array<{ question_id: number }>;

  if (lastSession) {
    console.log('Refreshing personal profile...');
    await updateProfile(lastSession.question_id);
    console.log('Profile updated.');
  }

  // Summary stats
  const [stats] = await sql`
    SELECT
      COUNT(*) AS total_rbursts,
      COUNT(DISTINCT question_id) AS sessions_with_rbursts,
      ROUND(AVG(deleted_char_count)::numeric, 1) AS avg_del_size,
      ROUND(AVG(CASE WHEN is_leading_edge THEN 1 ELSE 0 END)::numeric, 3) AS leading_edge_pct
    FROM tb_rburst_sequences
  ` as [{ total_rbursts: number; sessions_with_rbursts: number; avg_del_size: number; leading_edge_pct: number }];

  console.log(`\n  R-burst stats: ${stats.total_rbursts} total across ${stats.sessions_with_rbursts} sessions`);
  console.log(`  Mean deletion size: ${stats.avg_del_size} chars`);
  console.log(`  Leading edge: ${(stats.leading_edge_pct * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
