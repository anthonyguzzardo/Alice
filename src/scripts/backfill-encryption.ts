/**
 * Backfill script for migration 031 — at-rest encryption uniformity.
 *
 * Run AFTER `031a_add_encryption_columns.sql` and BEFORE
 * `031b_finalize_encryption.sql`.
 *
 * For every row in every in-scope table:
 *   1. Read the plaintext column (`text`, `value`, `event_log_json`, etc.).
 *   2. Encrypt via libCrypto.encrypt() — returns {ciphertext, nonce}.
 *   3. UPDATE the row to populate `<col>_ciphertext` + `<col>_nonce`.
 *   4. Verify decrypt round-trip yields the original plaintext.
 *
 * The script is idempotent — rows whose ciphertext + nonce are already
 * populated are skipped. This means a partial run can be resumed safely.
 *
 * After this script reports zero failures, run 031b to drop the plaintext
 * columns and set NOT NULL on the new ones.
 *
 * Usage:
 *   ALICE_PG_URL=postgres://... \
 *   ALICE_ENCRYPTION_KEY=<base64-32-bytes> \
 *   npx tsx src/scripts/backfill-encryption.ts [--dry-run]
 */

import sql from '../lib/libDbPool.ts';
import { encrypt, decrypt } from '../lib/libCrypto.ts';

const DRY_RUN = process.argv.includes('--dry-run');

interface BackfillStats {
  table: string;
  totalRows: number;
  alreadyEncrypted: number;
  encrypted: number;
  failed: number;
  sampleVerified: number;
}

/** Round-trip a sample row's ciphertext through decrypt to confirm correctness. */
function verifySample(plaintext: string, ciphertext: string, nonce: string): boolean {
  const roundTrip = decrypt(ciphertext, nonce);
  return roundTrip === plaintext;
}

async function backfillSingleColumn(
  table: string,
  pkColumn: string,
  plaintextColumn: string,
  ciphertextColumn: string,
  nonceColumn: string,
  options: { skipNullPlaintext?: boolean } = {},
): Promise<BackfillStats> {
  const stats: BackfillStats = {
    table: `${table}.${plaintextColumn}`,
    totalRows: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    failed: 0,
    sampleVerified: 0,
  };

  const rows = await sql.unsafe(
    `SELECT ${pkColumn} AS pk, ${plaintextColumn} AS plaintext,
            ${ciphertextColumn} AS ciphertext, ${nonceColumn} AS nonce
     FROM ${table}`,
    [] as never[],
  ) as Array<{ pk: number; plaintext: string | null; ciphertext: string | null; nonce: string | null }>;

  stats.totalRows = rows.length;

  for (const row of rows) {
    if (row.ciphertext != null && row.nonce != null) {
      stats.alreadyEncrypted++;
      // Sample-verify some already-encrypted rows for safety
      if (stats.sampleVerified < 3 && row.plaintext != null) {
        if (verifySample(row.plaintext, row.ciphertext, row.nonce)) {
          stats.sampleVerified++;
        } else {
          console.error(`[VERIFY FAIL] ${stats.table} pk=${row.pk}: round-trip mismatch`);
          stats.failed++;
        }
      }
      continue;
    }
    if (row.plaintext == null) {
      if (options.skipNullPlaintext) continue;
      console.error(`[ERROR] ${stats.table} pk=${row.pk}: plaintext is NULL but column is NOT NULL`);
      stats.failed++;
      continue;
    }

    try {
      const enc = encrypt(row.plaintext);
      // Verify before write
      if (!verifySample(row.plaintext, enc.ciphertext, enc.nonce)) {
        console.error(`[ROUND-TRIP FAIL] ${stats.table} pk=${row.pk}`);
        stats.failed++;
        continue;
      }
      if (!DRY_RUN) {
        await sql.unsafe(
          `UPDATE ${table} SET ${ciphertextColumn} = $1, ${nonceColumn} = $2
           WHERE ${pkColumn} = $3`,
          [enc.ciphertext, enc.nonce, row.pk] as never[],
        );
      }
      stats.encrypted++;
      if (stats.sampleVerified < 3) {
        stats.sampleVerified++;
      }
    } catch (err) {
      console.error(`[ENCRYPT FAIL] ${stats.table} pk=${row.pk}: ${(err as Error).message}`);
      stats.failed++;
    }
  }

  return stats;
}

/** Special-case for tb_session_events: source is JSONB, target is TEXT ciphertext.
 *  We stringify the JSONB before encrypting. The plaintext "JSON string" is the
 *  canonical form the rest of the application sees on read. */
async function backfillJsonbColumn(
  pkColumn: string,
  plaintextColumn: string,
  ciphertextColumn: string,
  nonceColumn: string,
  options: { skipNullPlaintext?: boolean } = {},
): Promise<BackfillStats> {
  const table = 'tb_session_events';
  const stats: BackfillStats = {
    table: `${table}.${plaintextColumn}`,
    totalRows: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    failed: 0,
    sampleVerified: 0,
  };

  const rows = await sql.unsafe(
    `SELECT ${pkColumn} AS pk, ${plaintextColumn} AS plaintext,
            ${ciphertextColumn} AS ciphertext, ${nonceColumn} AS nonce
     FROM ${table}`,
    [] as never[],
  ) as Array<{ pk: number; plaintext: unknown; ciphertext: string | null; nonce: string | null }>;

  stats.totalRows = rows.length;

  for (const row of rows) {
    if (row.ciphertext != null && row.nonce != null) {
      stats.alreadyEncrypted++;
      continue;
    }
    if (row.plaintext == null) {
      if (options.skipNullPlaintext) continue;
      console.error(`[ERROR] ${stats.table} pk=${row.pk}: JSONB plaintext is NULL but column is NOT NULL`);
      stats.failed++;
      continue;
    }

    try {
      // postgres.js auto-parses JSONB; stringify back for canonical form
      const plaintextString = typeof row.plaintext === 'string'
        ? row.plaintext
        : JSON.stringify(row.plaintext);
      const enc = encrypt(plaintextString);
      const roundTrip = decrypt(enc.ciphertext, enc.nonce);
      if (roundTrip !== plaintextString) {
        console.error(`[ROUND-TRIP FAIL] ${stats.table} pk=${row.pk}`);
        stats.failed++;
        continue;
      }
      if (!DRY_RUN) {
        await sql.unsafe(
          `UPDATE ${table} SET ${ciphertextColumn} = $1, ${nonceColumn} = $2
           WHERE ${pkColumn} = $3`,
          [enc.ciphertext, enc.nonce, row.pk] as never[],
        );
      }
      stats.encrypted++;
      if (stats.sampleVerified < 3) stats.sampleVerified++;
    } catch (err) {
      console.error(`[ENCRYPT FAIL] ${stats.table} pk=${row.pk}: ${(err as Error).message}`);
      stats.failed++;
    }
  }

  return stats;
}

async function main(): Promise<void> {
  console.log(`[backfill-encryption] ${DRY_RUN ? 'DRY RUN' : 'LIVE'} — ALICE_ENCRYPTION_KEY ${process.env.ALICE_ENCRYPTION_KEY ? 'set' : 'MISSING'}`);
  if (!process.env.ALICE_ENCRYPTION_KEY) {
    throw new Error('ALICE_ENCRYPTION_KEY env var is required');
  }
  if (!process.env.ALICE_PG_URL) {
    throw new Error('ALICE_PG_URL env var is required');
  }

  const allStats: BackfillStats[] = [];

  // Single-column TEXT backfills
  allStats.push(await backfillSingleColumn(
    'tb_responses', 'response_id', 'text', 'text_ciphertext', 'text_nonce',
  ));
  allStats.push(await backfillSingleColumn(
    'tb_questions', 'question_id', 'text', 'text_ciphertext', 'text_nonce',
  ));
  allStats.push(await backfillSingleColumn(
    'tb_embeddings', 'embedding_id', 'embedded_text', 'embedded_text_ciphertext', 'embedded_text_nonce',
  ));

  // JSONB backfills
  allStats.push(await backfillJsonbColumn(
    'session_event_id', 'event_log_json', 'event_log_ciphertext', 'event_log_nonce',
  ));
  allStats.push(await backfillJsonbColumn(
    'session_event_id', 'keystroke_stream_json', 'keystroke_stream_ciphertext', 'keystroke_stream_nonce',
    { skipNullPlaintext: true },
  ));

  // ── Report ────────────────────────────────────────────────────────────
  console.log('');
  console.log('Backfill summary:');
  console.log('-'.repeat(80));
  console.log(`${'column'.padEnd(48)} ${'total'.padStart(7)} ${'already'.padStart(8)} ${'enc'.padStart(6)} ${'fail'.padStart(5)}`);
  console.log('-'.repeat(80));
  let totalFailed = 0;
  for (const s of allStats) {
    console.log(
      `${s.table.padEnd(48)} ${String(s.totalRows).padStart(7)} ${String(s.alreadyEncrypted).padStart(8)} ${String(s.encrypted).padStart(6)} ${String(s.failed).padStart(5)}`,
    );
    totalFailed += s.failed;
  }
  console.log('-'.repeat(80));
  console.log(`Sample round-trips verified: ${allStats.reduce((sum, s) => sum + s.sampleVerified, 0)}`);
  console.log('');

  if (totalFailed > 0) {
    console.error(`FAILURE: ${totalFailed} rows failed to backfill. Inspect logs above before re-running.`);
    process.exit(1);
  }
  if (DRY_RUN) {
    console.log('DRY RUN complete. Re-run without --dry-run to apply.');
  } else {
    console.log('Backfill complete. Next: run db/sql/migrations/031b_finalize_encryption.sql');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
