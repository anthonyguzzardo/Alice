/**
 * One-off backfill: reconstruct deletion_events_json for question_id=4
 * from tb_session_events.event_log_json.
 *
 * Why: respond.ts had an ordering bug where updateDeletionEvents() ran before
 * saveSessionSummary(), causing the UPDATE to affect zero rows for q_id=4.
 * The bug is fixed going forward, but q_id=4's deletion_events_json is NULL.
 *
 * Reconstruction strategy: walk consecutive snapshots [t_ms, text]. Wherever
 * text_len shrank from prev to curr, emit { c: prev_len - curr_len, t: curr_t }.
 * This is a derived view — it cannot distinguish coalesced back-to-back deletes
 * between snapshots, but the per-keystroke cadence makes it very close to the
 * in-memory deletionEvents array that was lost.
 *
 * Idempotent: if deletion_events_json is already non-null, skip.
 * Safe to re-run.
 */

import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const DB_PATH = resolve(process.cwd(), 'data/alice.db');
const QUESTION_ID = 4;

const db = new Database(DB_PATH);

const existing = db
  .prepare('SELECT deletion_events_json FROM tb_session_summaries WHERE question_id = ?')
  .get(QUESTION_ID) as { deletion_events_json: string | null } | undefined;

if (!existing) {
  console.error(`No tb_session_summaries row for question_id=${QUESTION_ID}`);
  process.exit(1);
}

if (existing.deletion_events_json && existing.deletion_events_json.length > 0) {
  console.log(`question_id=${QUESTION_ID} already has deletion_events_json (${existing.deletion_events_json.length} chars). Skipping.`);
  process.exit(0);
}

const eventRow = db
  .prepare('SELECT event_log_json, total_events FROM tb_session_events WHERE question_id = ?')
  .get(QUESTION_ID) as { event_log_json: string; total_events: number } | undefined;

if (!eventRow) {
  console.error(`No tb_session_events row for question_id=${QUESTION_ID} — cannot reconstruct.`);
  process.exit(1);
}

const events: Array<[number, string]> = JSON.parse(eventRow.event_log_json);
console.log(`Walking ${events.length} events (total_events=${eventRow.total_events})...`);

const deletionEvents: Array<{ c: number; t: number }> = [];

for (let i = 1; i < events.length; i++) {
  const [, prevText] = events[i - 1];
  const [currT, currText] = events[i];
  const delta = prevText.length - currText.length;
  if (delta > 0) {
    deletionEvents.push({ c: delta, t: currT });
  }
}

console.log(`Reconstructed ${deletionEvents.length} deletion events.`);
if (deletionEvents.length > 0) {
  const totalCharsDeleted = deletionEvents.reduce((s, d) => s + d.c, 0);
  const firstT = deletionEvents[0].t;
  const lastT = deletionEvents[deletionEvents.length - 1].t;
  console.log(`Total chars deleted (reconstructed): ${totalCharsDeleted}`);
  console.log(`First deletion at t=${firstT}ms, last at t=${lastT}ms`);
}

const json = JSON.stringify(deletionEvents);
db.prepare(
  'UPDATE tb_session_summaries SET deletion_events_json = ? WHERE question_id = ?'
).run(json, QUESTION_ID);

const verify = db
  .prepare('SELECT length(deletion_events_json) AS len FROM tb_session_summaries WHERE question_id = ?')
  .get(QUESTION_ID) as { len: number };

console.log(`Persisted to tb_session_summaries.deletion_events_json (${verify.len} chars).`);
db.close();
