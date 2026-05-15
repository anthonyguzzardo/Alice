/**
 * PostgreSQL Connection Pool
 *
 * Exports a tagged-template `sql` function from porsager/postgres.
 * All database access goes through this module.
 *
 * Connection string is read from `ALICE_PG_URL`. There is no fallback. The
 * production database is Supabase (us-west-2); no local Postgres instance is
 * supported or expected. If `ALICE_PG_URL` is unset, this module throws on
 * load so a misconfigured shell fails loudly instead of silently hitting some
 * default.
 */

import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.ALICE_PG_URL;
if (!connectionString) {
  throw new Error(
    'libDbPool: ALICE_PG_URL is not set. Source .env (`set -a; source .env; set +a`) before running, or export the variable directly. There is no localhost fallback.',
  );
}

const sql = postgres(connectionString, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: {
    // `extensions` is included so the pgvector `vector` type resolves on
    // Supabase (which installs the extension in the extensions schema).
    // Without it, INSERTs into tb_embeddings fail with "type vector does
    // not exist" — the column type is `vector(512)` and cast resolution
    // walks the search_path.
    search_path: 'alice,public,extensions',
  },
  types: {
    // pgvector sends vector as text like "[0.1,0.2,...]"
    // We handle conversion at the query level
  },
});

export default sql;

/**
 * Transaction handle type. Both the pool connection (sql) and the transaction
 * handle (tx from sql.begin callback) can execute tagged-template queries.
 * Union covers postgres.js's two distinct shapes — Sql<{}> (full pool) and
 * TransactionSql<{}> (the narrower handle the begin() callback receives).
 * Without the union, every `saveX(payload, tx)` call inside `sql.begin` errors
 * because TransactionSql lacks CLOSE/END/etc. Both share ISql for the tagged-
 * template capability, which is all our write functions actually use.
 */
export type TxSql = postgres.Sql<{}> | postgres.TransactionSql<{}>;

export async function close(): Promise<void> {
  await sql.end();
}
