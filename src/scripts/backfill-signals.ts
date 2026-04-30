/**
 * Backfill: compute derived signals for all existing sessions.
 *
 * Computes and persists: dynamical, motor, semantic, process, and
 * cross-session signals from existing data in tb_session_events,
 * tb_responses, and tb_session_summaries.
 *
 * Safe to re-run: skips sessions that already have signals persisted.
 *
 * Run: npx tsx src/scripts/backfill-signals.ts
 */

import { sql } from '../lib/libDb.ts';
import { computeAndPersistDerivedSignals } from '../lib/libSignalPipeline.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';

async function main() {
  const subjectId = parseSubjectIdArg();

  const questionIds = await sql`
    SELECT DISTINCT se.question_id
    FROM tb_session_events se
    JOIN tb_responses r ON se.question_id = r.question_id
    WHERE se.subject_id = ${subjectId}
    ORDER BY se.question_id ASC
  ` as Array<{ question_id: number }>;

  // Snapshot row counts before the loop so we can report actual writes
  // instead of just loop iterations. The pipeline is idempotent: every per-
  // family compute is gated by `if (!(await getXSignals(...)))`, so re-running
  // when nothing is missing is a no-op. The honest log is the row delta.
  const tables = [
    'tb_dynamical_signals',
    'tb_motor_signals',
    'tb_semantic_signals',
    'tb_process_signals',
    'tb_cross_session_signals',
  ];
  const before: Record<string, number> = {};
  for (const table of tables) {
    const [row] = await sql.unsafe(`SELECT COUNT(*) as c FROM ${table} WHERE subject_id = $1`, [subjectId]) as [{ c: number }];
    before[table] = Number(row.c);
  }

  console.log(`Inspecting ${questionIds.length} sessions (idempotent — only sessions missing signals are computed).`);

  let inspected = 0;
  let failed = 0;

  for (const { question_id } of questionIds) {
    try {
      await computeAndPersistDerivedSignals(subjectId, question_id);
      inspected++;
      process.stdout.write(`\r  ${inspected}/${questionIds.length} inspected`);
    } catch (err) {
      failed++;
      console.error(`\n  Failed question_id=${question_id}:`, (err as Error).message);
    }
  }

  let totalWritten = 0;
  const after: Record<string, number> = {};
  for (const table of tables) {
    const [row] = await sql.unsafe(`SELECT COUNT(*) as c FROM ${table} WHERE subject_id = $1`, [subjectId]) as [{ c: number }];
    const beforeCount = before[table] ?? 0;
    const afterCount = Number(row.c);
    after[table] = afterCount;
    totalWritten += afterCount - beforeCount;
  }

  console.log(`\n\nInspected: ${inspected}, Failed: ${failed}, Rows written: ${totalWritten}`);
  for (const table of tables) {
    const beforeCount = before[table] ?? 0;
    const afterCount = after[table] ?? 0;
    const delta = afterCount - beforeCount;
    const tag = delta > 0 ? ` (+${delta})` : '';
    console.log(`  ${table}: ${afterCount} rows${tag}`);
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
