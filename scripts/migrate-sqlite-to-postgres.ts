/**
 * migrate-sqlite-to-postgres.ts
 *
 * One-shot data migration from SQLite (better-sqlite3 + sqlite-vec) to
 * PostgreSQL 17 (postgres.js + pgvector).
 *
 * Assumes:
 *   - PostgreSQL schema is already applied (scripts/create-postgres-schema.sql)
 *   - All PG tables are empty
 *   - SQLite DB is at data/alice.db
 *
 * Usage: npx tsx scripts/migrate-sqlite-to-postgres.ts
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import postgres from 'postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sqliteDb = new Database(path.resolve(__dirname, '../data/alice.db'));
sqliteVec.load(sqliteDb);

const pg = postgres('postgres://localhost/alice');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise SQLite TEXT datetimes to something TIMESTAMPTZ can parse. */
function fixTimestamp(val: unknown): string | null {
  if (val == null || val === '') return null;
  const s = String(val);
  // Already has timezone info
  if (s.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(s)) return s;
  // Bare ISO-ish string -- treat as UTC
  return s + '+00';
}

/** Return an array of column names for a PG table. */
async function pgColumns(table: string): Promise<string[]> {
  const rows = await pg`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `;
  return rows.map((r: { column_name: string }) => r.column_name);
}

/** Return PG row count for a table. */
async function pgCount(table: string): Promise<number> {
  const [row] = await pg`SELECT COUNT(*)::int AS c FROM ${pg(table)}`;
  return row.c;
}

/** Return SQLite row count for a table (returns 0 if the table does not exist). */
function sqliteCount(table: string): number {
  try {
    return (sqliteDb.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
  } catch {
    return 0;
  }
}

/** Columns whose PG type is TIMESTAMPTZ but are TEXT in SQLite. */
const TIMESTAMP_COLUMNS = new Set([
  'dttm_created_utc',
  'dttm_modified_utc',
]);

/** Columns whose PG type is JSONB but are TEXT in SQLite. */
const JSONB_COLUMNS = new Set([
  'deletion_events_json',
  'event_log_json',
  'keystroke_stream_json',
  'traits_json',
  'signals_json',
  'iki_autocorrelation_json',
  'digraph_latency_json',
  'recent_entry_ids',
  'rag_entry_ids',
  'contrarian_entry_ids',
  'reflection_ids',
  'observation_ids',
]);

// ---------------------------------------------------------------------------
// Generic table migrator
// ---------------------------------------------------------------------------

interface MigrateOpts {
  table: string;
  pkColumn: string;
  hasIdentity: boolean;
  /** Override column list -- if omitted we derive from PG schema. */
  columns?: string[];
  /** Extra transform per row. */
  transform?: (row: Record<string, unknown>) => Record<string, unknown>;
}

async function migrateTable(opts: MigrateOpts): Promise<void> {
  const { table, pkColumn, hasIdentity } = opts;
  const sqliteRows = sqliteDb.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  if (sqliteRows.length === 0) {
    console.log(`  ${table}: 0 rows in SQLite -- skipping.`);
    return;
  }

  const cols = opts.columns ?? await pgColumns(table);
  // Filter to columns that exist in the PG table, exclude 'embedding' (handled separately)
  const pgCols = new Set(await pgColumns(table));
  const useCols = cols.filter(c => pgCols.has(c) && c !== 'embedding');

  // Batch in groups of 50
  const BATCH = 50;
  for (let i = 0; i < sqliteRows.length; i += BATCH) {
    const batch = sqliteRows.slice(i, i + BATCH);
    const rows = batch.map(raw => {
      const row = opts.transform ? opts.transform({ ...raw }) : { ...raw };
      const cleaned: Record<string, unknown> = {};
      for (const col of useCols) {
        let val = row[col];
        if (TIMESTAMP_COLUMNS.has(col)) {
          val = fixTimestamp(val);
        }
        if (JSONB_COLUMNS.has(col)) {
          // If it is a valid JSON string pass through; null stays null.
          if (val != null && typeof val === 'string') {
            try {
              JSON.parse(val);
              // val stays as-is -- postgres.js handles TEXT->JSONB
            } catch {
              val = null;
            }
          }
        }
        cleaned[col] = val ?? null;
      }
      return cleaned;
    });

    if (hasIdentity) {
      // Build a raw INSERT with OVERRIDING SYSTEM VALUE
      // postgres.js tagged template does not support this clause directly,
      // so we construct the query manually.
      const colList = useCols.map(c => `"${c}"`).join(', ');
      const placeholders = rows.map((_, ri) => {
        const inner = useCols.map((_, ci) => `$${ri * useCols.length + ci + 1}`).join(', ');
        return `(${inner})`;
      }).join(', ');
      const values = rows.flatMap(r => useCols.map(c => r[c]));
      const query = `INSERT INTO ${table} (${colList}) OVERRIDING SYSTEM VALUE VALUES ${placeholders}`;

      await pg.unsafe(query, values);
    } else {
      // Enum tables -- simple insert, no identity
      const colList = useCols.map(c => `"${c}"`).join(', ');
      const placeholders = rows.map((_, ri) => {
        const inner = useCols.map((_, ci) => `$${ri * useCols.length + ci + 1}`).join(', ');
        return `(${inner})`;
      }).join(', ');
      const values = rows.flatMap(r => useCols.map(c => r[c]));
      const query = `INSERT INTO ${table} (${colList}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
      await pg.unsafe(query, values);
    }
  }

  // Verify
  const pgN = await pgCount(table);
  const sqliteN = sqliteRows.length;
  const status = pgN === sqliteN ? 'OK' : 'MISMATCH';
  console.log(`  ${table}: SQLite=${sqliteN}, PG=${pgN} [${status}]`);

  // Reset identity sequence
  if (hasIdentity) {
    const [maxRow] = await pg.unsafe(`SELECT COALESCE(MAX("${pkColumn}"), 0) + 1 AS next_val FROM ${table}`);
    await pg.unsafe(`ALTER TABLE ${table} ALTER COLUMN "${pkColumn}" RESTART WITH ${maxRow.next_val}`);
  }
}

// ---------------------------------------------------------------------------
// Embedding migration (special)
// ---------------------------------------------------------------------------

async function migrateEmbeddings(): Promise<void> {
  // Step 1: Migrate tb_embeddings metadata
  const metaRows = sqliteDb.prepare('SELECT * FROM tb_embeddings').all() as Record<string, unknown>[];
  if (metaRows.length === 0) {
    console.log('  tb_embeddings: 0 rows -- skipping.');
    return;
  }

  const pgCols = await pgColumns('tb_embeddings');
  // All columns except 'embedding' (the vector column)
  const metaCols = pgCols.filter(c => c !== 'embedding');

  const BATCH = 50;
  for (let i = 0; i < metaRows.length; i += BATCH) {
    const batch = metaRows.slice(i, i + BATCH);
    const colList = metaCols.map(c => `"${c}"`).join(', ');
    const placeholders = batch.map((_, ri) => {
      const inner = metaCols.map((_, ci) => `$${ri * metaCols.length + ci + 1}`).join(', ');
      return `(${inner})`;
    }).join(', ');
    const values = batch.flatMap(row =>
      metaCols.map(c => {
        let val = row[c];
        if (TIMESTAMP_COLUMNS.has(c)) val = fixTimestamp(val);
        return val ?? null;
      })
    );
    const query = `INSERT INTO tb_embeddings (${colList}) OVERRIDING SYSTEM VALUE VALUES ${placeholders}`;
    await pg.unsafe(query, values);
  }

  // Step 2: Read vec_embeddings and UPDATE the embedding column
  let vecRows: Array<{ embedding_id: number; embedding: Buffer }>;
  try {
    vecRows = sqliteDb.prepare('SELECT embedding_id, embedding FROM vec_embeddings').all() as Array<{ embedding_id: number; embedding: Buffer }>;
  } catch {
    console.log('  vec_embeddings: table not readable -- skipping vectors.');
    vecRows = [];
  }

  let vectorCount = 0;
  for (const row of vecRows) {
    const buf = row.embedding;
    if (!buf || buf.length === 0) continue;
    const floats = new Float32Array(
      buf.buffer,
      buf.byteOffset,
      buf.byteLength / 4
    );
    const vectorStr = '[' + Array.from(floats).join(',') + ']';
    await pg.unsafe(
      `UPDATE tb_embeddings SET embedding = $1::vector WHERE embedding_id = $2`,
      [vectorStr, row.embedding_id]
    );
    vectorCount++;
  }

  // Verify
  const pgN = await pgCount('tb_embeddings');
  const sqliteN = metaRows.length;
  const status = pgN === sqliteN ? 'OK' : 'MISMATCH';
  console.log(`  tb_embeddings: SQLite=${sqliteN}, PG=${pgN} [${status}] (${vectorCount} vectors)`);

  // Reset identity
  const [maxRow] = await pg.unsafe(`SELECT COALESCE(MAX(embedding_id), 0) + 1 AS next_val FROM tb_embeddings`);
  await pg.unsafe(`ALTER TABLE tb_embeddings ALTER COLUMN embedding_id RESTART WITH ${maxRow.next_val}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== SQLite -> PostgreSQL Migration ===\n');

  // ------------------------------------------------------------------
  // 1. Enum tables (no identity columns, already seeded -- verify/fill)
  // ------------------------------------------------------------------
  console.log('Enum tables:');

  const enumTables: MigrateOpts[] = [
    { table: 'te_question_source',         pkColumn: 'question_source_id',         hasIdentity: false },
    { table: 'te_reflection_type',         pkColumn: 'reflection_type_id',         hasIdentity: false },
    { table: 'te_interaction_event_type',  pkColumn: 'interaction_event_type_id',  hasIdentity: false },
    { table: 'te_prompt_trace_type',       pkColumn: 'prompt_trace_type_id',       hasIdentity: false },
    { table: 'te_embedding_source',        pkColumn: 'embedding_source_id',        hasIdentity: false },
    { table: 'te_context_dimension',       pkColumn: 'context_dimension_id',       hasIdentity: false },
  ];

  for (const t of enumTables) {
    await migrateTable(t);
  }

  // ------------------------------------------------------------------
  // 2. Core tables (dependency order, identity columns)
  // ------------------------------------------------------------------
  console.log('\nCore tables:');

  const coreTables: MigrateOpts[] = [
    { table: 'tb_questions',                    pkColumn: 'question_id',                  hasIdentity: true },
    { table: 'tb_responses',                    pkColumn: 'response_id',                  hasIdentity: true },
    { table: 'tb_interaction_events',           pkColumn: 'interaction_event_id',          hasIdentity: true },
    { table: 'tb_reflections',                  pkColumn: 'reflection_id',                hasIdentity: true },
    { table: 'tb_question_feedback',            pkColumn: 'question_feedback_id',         hasIdentity: true },
    { table: 'tb_session_summaries',            pkColumn: 'session_summary_id',           hasIdentity: true },
    { table: 'tb_prompt_traces',                pkColumn: 'prompt_trace_id',              hasIdentity: true },
    { table: 'tb_burst_sequences',              pkColumn: 'burst_sequence_id',            hasIdentity: true },
    { table: 'tb_session_metadata',             pkColumn: 'session_metadata_id',          hasIdentity: true },
    { table: 'tb_calibration_baselines_history', pkColumn: 'calibration_history_id',       hasIdentity: true },
    { table: 'tb_session_events',               pkColumn: 'session_event_id',             hasIdentity: true },
    { table: 'tb_witness_states',               pkColumn: 'witness_state_id',             hasIdentity: true },
    { table: 'tb_entry_states',                 pkColumn: 'entry_state_id',               hasIdentity: true },
    { table: 'tb_trait_dynamics',               pkColumn: 'trait_dynamic_id',             hasIdentity: true },
    { table: 'tb_coupling_matrix',              pkColumn: 'coupling_id',                  hasIdentity: true },
    { table: 'tb_emotion_behavior_coupling',    pkColumn: 'emotion_coupling_id',          hasIdentity: true },
    { table: 'tb_semantic_states',              pkColumn: 'semantic_state_id',            hasIdentity: true },
    { table: 'tb_semantic_dynamics',            pkColumn: 'semantic_dynamic_id',          hasIdentity: true },
    { table: 'tb_semantic_coupling',            pkColumn: 'semantic_coupling_id',         hasIdentity: true },
    { table: 'tb_dynamical_signals',            pkColumn: 'dynamical_signal_id',          hasIdentity: true },
    { table: 'tb_motor_signals',                pkColumn: 'motor_signal_id',              hasIdentity: true },
    { table: 'tb_semantic_signals',             pkColumn: 'semantic_signal_id',           hasIdentity: true },
    { table: 'tb_process_signals',              pkColumn: 'process_signal_id',            hasIdentity: true },
    { table: 'tb_cross_session_signals',        pkColumn: 'cross_session_signal_id',      hasIdentity: true },
    { table: 'tb_calibration_context',          pkColumn: 'calibration_context_id',       hasIdentity: true },
    { table: 'tb_session_delta',                pkColumn: 'session_delta_id',             hasIdentity: true },
    { table: 'tb_paper_comments',               pkColumn: 'paper_comment_id',            hasIdentity: true },
  ];

  for (const t of coreTables) {
    await migrateTable(t);
  }

  // ------------------------------------------------------------------
  // 3. Embeddings (special: metadata + vec_embeddings vectors)
  // ------------------------------------------------------------------
  console.log('\nEmbeddings:');
  await migrateEmbeddings();

  // ------------------------------------------------------------------
  // Done
  // ------------------------------------------------------------------
  console.log('\nMigration complete!');
  sqliteDb.close();
  await pg.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  sqliteDb.close();
  pg.end().finally(() => process.exit(1));
});
