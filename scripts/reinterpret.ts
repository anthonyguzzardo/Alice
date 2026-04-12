/**
 * Manual trigger for Bob reinterpretation.
 * Fetches signals from the running dev server and triggers a fresh interpretation.
 *
 * Usage: npx tsx scripts/reinterpret.ts
 * Requires: dev server running at localhost:4321
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import { interpretTraits } from '../src/lib/bob/interpreter.ts';
import type { BobSignal } from '../src/lib/bob/types.ts';

const SERVER = 'http://localhost:4321';

const db = new Database('./data/marrow.db');
const { count } = db.prepare('SELECT COUNT(*) as count FROM tb_session_summaries').get() as any;

// Delete existing witness state so interpretation runs fresh
db.prepare('DELETE FROM tb_witness_states WHERE entry_count = ?').run(count);

console.log(`Fetching signals from ${SERVER}/api/bob ...`);
const res = await fetch(`${SERVER}/api/bob`);
if (!res.ok) {
  console.error('Failed to fetch signals:', res.status, await res.text());
  process.exit(1);
}

const sig: BobSignal = await res.json();
console.log(`Got ${Object.keys(sig).length} signals for entry count: ${count}`);

const traits = await interpretTraits(sig, count);
console.log('Done. Opus interpretation saved.');
console.log('Traits:', JSON.stringify(traits, null, 2));
db.close();
