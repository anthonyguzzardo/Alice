/**
 * Migration: Archive the interpretive layer (2026-04-16 restructure).
 *
 * Renames all tables/enums related to the three-frame analysis, prediction
 * registry, theory confidence, and suppressed question machinery to
 * `zz_archive_*_20260416`. Data is preserved; writes and reads from these
 * tables are removed in the code surgery that accompanies this migration.
 *
 * Context: Alice is restructuring away from LLM-narrated interpretation
 * toward retrieval + juxtaposition over a behavioral + semantic joint space.
 * The prediction/theory machinery created false epistemic confidence on
 * N=1 self-built data and is being removed.
 *
 * Archived tables (data preserved, renamed):
 *   tb_predictions                → zz_archive_predictions_20260416
 *   tb_theory_confidence          → zz_archive_theory_confidence_20260416
 *   tb_ai_observations            → zz_archive_ai_observations_20260416
 *   tb_ai_suppressed_questions    → zz_archive_ai_suppressed_questions_20260416
 *   tb_question_candidates        → zz_archive_question_candidates_20260416
 *   te_prediction_status          → zz_archive_prediction_status_20260416
 *   te_prediction_type            → zz_archive_prediction_type_20260416
 *   te_grade_method               → zz_archive_grade_method_20260416
 *   te_intervention_intent        → zz_archive_intervention_intent_20260416
 *
 * Idempotent: checks for the presence of archived-name tables before acting.
 *
 * Usage: npx tsx scripts/archive-interpretive-layer-20260416.ts
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.ALICE_DB_PATH || './data/alice.db';
const db = new Database(DB_PATH);

const ARCHIVE_SUFFIX = '_20260416';

const RENAMES: Array<[string, string]> = [
  ['tb_predictions',              `zz_archive_predictions${ARCHIVE_SUFFIX}`],
  ['tb_theory_confidence',        `zz_archive_theory_confidence${ARCHIVE_SUFFIX}`],
  ['tb_ai_observations',          `zz_archive_ai_observations${ARCHIVE_SUFFIX}`],
  ['tb_ai_suppressed_questions',  `zz_archive_ai_suppressed_questions${ARCHIVE_SUFFIX}`],
  ['tb_question_candidates',      `zz_archive_question_candidates${ARCHIVE_SUFFIX}`],
  ['te_prediction_status',        `zz_archive_prediction_status${ARCHIVE_SUFFIX}`],
  ['te_prediction_type',          `zz_archive_prediction_type${ARCHIVE_SUFFIX}`],
  ['te_grade_method',             `zz_archive_grade_method${ARCHIVE_SUFFIX}`],
  ['te_intervention_intent',      `zz_archive_intervention_intent${ARCHIVE_SUFFIX}`],
];

function tableExists(name: string): boolean {
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(name) as { name: string } | undefined;
  return !!row;
}

console.log(`Archiving interpretive-layer tables in ${DB_PATH}...`);

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
console.log('Archived tables retain all data. No writes or reads from current code will reference them.');
console.log('To inspect: sqlite3 data/alice.db ".tables zz_archive_%"');

db.close();
