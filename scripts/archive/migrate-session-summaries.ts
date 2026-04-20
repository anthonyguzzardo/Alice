/**
 * Migration: Expand tb_session_summaries with research-informed behavioral columns.
 *
 * New columns:
 *   small_deletion_count       — deletions <10 chars (typo corrections)
 *   large_deletion_count       — deletions >=10 chars (substantive revisions)
 *   large_deletion_chars       — total chars in large deletions
 *   first_half_deletion_chars  — deletion chars in first half of session
 *   second_half_deletion_chars — deletion chars in second half of session
 *   active_typing_ms           — duration minus pauses minus tab-aways
 *   chars_per_minute           — total_chars_typed / active_minutes
 *   p_burst_count              — 2s-bounded production bursts (Chenoweth & Hayes)
 *   avg_p_burst_length         — mean burst length in chars
 *
 * Pattern: rename old → create new → insert with NULLs → drop old
 * Convention: no ALTER TABLE (per CLAUDE.md)
 *
 * Usage: npx tsx scripts/migrate-session-summaries.ts
 */
import Database from 'better-sqlite3';

const DB_PATH = './data/alice.db';
const db = new Database(DB_PATH);

// Check if migration is already done
const cols = db.prepare(`PRAGMA table_info(tb_session_summaries)`).all() as Array<{ name: string }>;
const colNames = cols.map(c => c.name);

if (colNames.includes('small_deletion_count')) {
  console.log('Migration already applied — tb_session_summaries has new columns.');
  process.exit(0);
}

console.log(`Migrating tb_session_summaries (${DB_PATH})...`);
console.log(`Existing columns: ${colNames.length}`);

const migrate = db.transaction(() => {
  // 1. Rename old table
  db.exec(`ALTER TABLE tb_session_summaries RENAME TO tb_session_summaries_old`);

  // 2. Create new table with expanded schema
  db.exec(`
    CREATE TABLE tb_session_summaries (
       session_summary_id         INTEGER PRIMARY KEY AUTOINCREMENT
      ,question_id                INTEGER NOT NULL UNIQUE
      ,first_keystroke_ms         INTEGER
      ,total_duration_ms          INTEGER
      ,total_chars_typed          INTEGER
      ,final_char_count           INTEGER
      ,commitment_ratio           REAL
      ,pause_count                INTEGER
      ,total_pause_ms             INTEGER
      ,deletion_count             INTEGER
      ,largest_deletion           INTEGER
      ,total_chars_deleted        INTEGER
      ,tab_away_count             INTEGER
      ,total_tab_away_ms          INTEGER
      ,word_count                 INTEGER
      ,sentence_count             INTEGER
      -- ENRICHED: deletion decomposition (Faigley & Witte taxonomy)
      ,small_deletion_count       INTEGER
      ,large_deletion_count       INTEGER
      ,large_deletion_chars       INTEGER
      ,first_half_deletion_chars  INTEGER
      ,second_half_deletion_chars INTEGER
      -- ENRICHED: production fluency (Chenoweth & Hayes P-bursts)
      ,active_typing_ms           INTEGER
      ,chars_per_minute           REAL
      ,p_burst_count              INTEGER
      ,avg_p_burst_length         REAL
      -- CONTEXT
      ,device_type                TEXT
      ,user_agent                 TEXT
      ,hour_of_day                INTEGER
      ,day_of_week                INTEGER
      -- FOOTER
      ,dttm_created_utc           TEXT    NOT NULL DEFAULT (datetime('now'))
      ,created_by                 TEXT    NOT NULL DEFAULT 'system'
    )
  `);

  // 3. Copy existing data — new columns get NULL
  db.exec(`
    INSERT INTO tb_session_summaries (
       session_summary_id, question_id, first_keystroke_ms, total_duration_ms,
       total_chars_typed, final_char_count, commitment_ratio,
       pause_count, total_pause_ms, deletion_count, largest_deletion,
       total_chars_deleted, tab_away_count, total_tab_away_ms,
       word_count, sentence_count,
       device_type, user_agent, hour_of_day, day_of_week,
       dttm_created_utc, created_by
    )
    SELECT
       session_summary_id, question_id, first_keystroke_ms, total_duration_ms,
       total_chars_typed, final_char_count, commitment_ratio,
       pause_count, total_pause_ms, deletion_count, largest_deletion,
       total_chars_deleted, tab_away_count, total_tab_away_ms,
       word_count, sentence_count,
       device_type, user_agent, hour_of_day, day_of_week,
       dttm_created_utc, created_by
    FROM tb_session_summaries_old
  `);

  // 4. Verify row count
  const oldCount = (db.prepare('SELECT COUNT(*) as c FROM tb_session_summaries_old').get() as any).c;
  const newCount = (db.prepare('SELECT COUNT(*) as c FROM tb_session_summaries').get() as any).c;
  if (oldCount !== newCount) {
    throw new Error(`Row count mismatch: old=${oldCount}, new=${newCount}`);
  }

  // 5. Drop old table
  db.exec(`DROP TABLE tb_session_summaries_old`);

  console.log(`Migrated ${newCount} rows. New columns added (all NULL for existing rows).`);
});

migrate();

// Verify
const newCols = db.prepare(`PRAGMA table_info(tb_session_summaries)`).all() as Array<{ name: string }>;
console.log(`New column count: ${newCols.length}`);
console.log(`New columns: ${newCols.map(c => c.name).join(', ')}`);
