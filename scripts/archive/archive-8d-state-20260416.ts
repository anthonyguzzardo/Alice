/**
 * Migration: Archive the 8D behavioral state vectors (2026-04-16 slice 3).
 *
 * Renames tb_entry_states (8D, includes `expression`), tb_trait_dynamics
 * (per-dimension dynamics computed over the 8D set), and tb_coupling_matrix
 * (lagged correlations discovered over 8D) to `zz_archive_*_8d_20260416`.
 *
 * Context: slice 3 pulls `expression` out of PersDyn behavioral space and
 * relocates it (alongside NRC + Pennebaker densities + future LLM-extracted
 * features) into a parallel first-class semantic space. The behavioral
 * engine becomes 7D. Entry states / dynamics / coupling all need to be
 * recomputed against the new dimension set; the 8D vectors are preserved
 * for the methodology paper.
 *
 * Archived tables (data preserved, renamed):
 *   tb_entry_states      → zz_archive_entry_states_8d_20260416
 *   tb_trait_dynamics    → zz_archive_trait_dynamics_8d_20260416
 *   tb_coupling_matrix   → zz_archive_coupling_matrix_8d_20260416
 *
 * Idempotent: checks for the presence of archived-name tables before acting.
 *
 * Usage: npx tsx scripts/archive-8d-state-20260416.ts
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.ALICE_DB_PATH || './data/alice.db';
const db = new Database(DB_PATH);

const ARCHIVE_SUFFIX = '_8d_20260416';

const RENAMES: Array<[string, string]> = [
  ['tb_entry_states',     `zz_archive_entry_states${ARCHIVE_SUFFIX}`],
  ['tb_trait_dynamics',   `zz_archive_trait_dynamics${ARCHIVE_SUFFIX}`],
  ['tb_coupling_matrix',  `zz_archive_coupling_matrix${ARCHIVE_SUFFIX}`],
];

function tableExists(name: string): boolean {
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(name) as { name: string } | undefined;
  return !!row;
}

console.log(`Archiving 8D behavioral-state tables in ${DB_PATH}...`);

const migrate = db.transaction(() => {
  let renamed = 0;
  let skipped = 0;
  for (const [from, to] of RENAMES) {
    if (tableExists(to)) {
      console.log(`  skip  ${from} — archive already exists as ${to}`);
      skipped++;
      continue;
    }
    if (!tableExists(from)) {
      console.log(`  skip  ${from} — source table not present`);
      skipped++;
      continue;
    }
    db.exec(`ALTER TABLE ${from} RENAME TO ${to}`);
    console.log(`  ok    ${from} → ${to}`);
    renamed++;
  }
  return { renamed, skipped };
});

const { renamed, skipped } = migrate();

console.log(`\nDone. renamed=${renamed} skipped=${skipped}`);
console.log('Archived tables retain all data. New 7D versions will be created fresh on next schema initialization.');
console.log('Behavioral state will repopulate as new sessions complete; trait_dynamics / coupling are recomputed per entry_count.');
console.log('To inspect: sqlite3 data/alice.db ".tables zz_archive_%"');

db.close();
