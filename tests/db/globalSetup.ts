/**
 * Vitest globalSetup for the `db` project.
 *
 * Starts a single pgvector-capable Postgres container, applies the canonical
 * schema (`db/sql/dbAlice_Tables.sql`), and exports its connection URI via
 * `process.env.ALICE_PG_URL` so libDbPool picks it up when test files import
 * libDb functions.
 *
 * The container is shared across all tests in the db project. Per-test
 * isolation comes from `TRUNCATE` in the test files' `beforeEach`. The
 * canonical schema is applied verbatim, including pgvector — so anything
 * the production app can do, the tests can do too.
 *
 * Cold start: ~3-5s on first image pull, <1s warm.
 *
 * Requires Docker. If Docker isn't running, the test run fails fast with a
 * clear error from testcontainers — there is no in-memory mock, by design
 * (pg-mem doesn't implement pgvector, FOR UPDATE SKIP LOCKED, or HNSW).
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '..', '..', 'db', 'sql', 'dbAlice_Tables.sql');

let container: StartedPostgreSqlContainer | null = null;

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg17')
    .withUsername('alice')
    .withPassword('alice')
    .withDatabase('alice')
    .start();

  const url = container.getConnectionUri();

  // Apply the canonical schema. Do not run as the test pool — use a one-shot
  // admin connection so we don't pollute the app's connection state with
  // schema-creation side effects.
  const adminSql = postgres(url, { max: 1 });
  const schemaSql = readFileSync(SCHEMA_PATH, 'utf-8');
  await adminSql.unsafe(schemaSql);
  await adminSql.end();

  // Hand the connection URI to the test process so libDbPool picks it up
  // when libDb is imported from a test.
  process.env.ALICE_PG_URL = url;

  // Migration 031: every libDb call that touches an encrypted column needs a
  // valid encryption key. Tests don't share the production key — they use a
  // fresh one per run, generated here. Do NOT overwrite an externally-set key
  // (lets a developer pin a known key for debugging).
  if (!process.env.ALICE_ENCRYPTION_KEY) {
    process.env.ALICE_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  }
}

export async function teardown(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
}
