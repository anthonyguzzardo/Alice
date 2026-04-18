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

import db from '../lib/db.ts';
import { computeAndPersistDerivedSignals } from '../lib/signal-pipeline.ts';

const questionIds = db.prepare(`
  SELECT DISTINCT se.question_id
  FROM tb_session_events se
  JOIN tb_responses r ON se.question_id = r.question_id
  ORDER BY se.question_id ASC
`).all() as Array<{ question_id: number }>;

console.log(`Found ${questionIds.length} sessions to backfill.`);

let success = 0;
let failed = 0;

for (const { question_id } of questionIds) {
  try {
    computeAndPersistDerivedSignals(question_id);
    success++;
    process.stdout.write(`\r  ${success}/${questionIds.length} done`);
  } catch (err) {
    failed++;
    console.error(`\n  Failed question_id=${question_id}:`, (err as Error).message);
  }
}

console.log(`\n\nBackfill complete. Success: ${success}, Failed: ${failed}`);

// Report coverage
const tables = [
  'tb_dynamical_signals',
  'tb_motor_signals',
  'tb_semantic_signals',
  'tb_process_signals',
  'tb_cross_session_signals',
];

for (const table of tables) {
  const count = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
  console.log(`  ${table}: ${count} rows`);
}
