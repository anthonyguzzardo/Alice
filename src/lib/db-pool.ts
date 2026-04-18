/**
 * PostgreSQL Connection Pool
 *
 * Exports a tagged-template `sql` function from porsager/postgres.
 * All database access goes through this module.
 *
 * Connection string from ALICE_PG_URL env var.
 * Default: postgres://localhost/alice
 */

import postgres from 'postgres';

const connectionString = process.env.ALICE_PG_URL || 'postgres://localhost/alice';

const sql = postgres(connectionString, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  types: {
    // pgvector sends vector as text like "[0.1,0.2,...]"
    // We handle conversion at the query level
  },
});

export default sql;

export async function close(): Promise<void> {
  await sql.end();
}
