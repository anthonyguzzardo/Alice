/**
 * Verify decryption pipeline against live data.
 *
 * Pulls the most recent owner calibration entry (subject_id=1,
 * question_source_id=3), decrypts both the question text and response text
 * with libCrypto, prints plaintext. Pre-rebuild safety check: if this fails
 * or returns garbage, the ALICE_ENCRYPTION_KEY in env does NOT match the
 * key the data was encrypted with — abort the rebuild.
 *
 * Usage on prod (as alice user with secrets.env sourced):
 *   set -a; source /etc/alice/secrets.env; set +a
 *   cd /opt/alice && tsx src/scripts/verify-decryption.ts
 */

import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { decrypt } from '../lib/libCrypto.ts';

async function main() {
  console.log('--- Verifying ALICE_ENCRYPTION_KEY against most recent owner calibration entry ---\n');

  const rows = await sql`
    SELECT q.question_id          AS "questionId"
         , q.text_ciphertext       AS "questionCiphertext"
         , q.text_nonce            AS "questionNonce"
         , q.dttm_created_utc      AS "questionCreatedUtc"
         , r.response_id           AS "responseId"
         , r.text_ciphertext       AS "responseCiphertext"
         , r.text_nonce            AS "responseNonce"
         , r.dttm_created_utc      AS "responseCreatedUtc"
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE r.subject_id = 1
      AND q.question_source_id = 3
    ORDER BY r.dttm_created_utc DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.error('No owner calibration responses found (subject_id=1, question_source_id=3).');
    console.error('Cannot verify decryption without a sample row. ABORT rebuild.');
    process.exit(2);
  }

  const row = rows[0];
  console.log(`Question ID:    ${row.questionId}`);
  console.log(`Question UTC:   ${row.questionCreatedUtc}`);
  console.log(`Response ID:    ${row.responseId}`);
  console.log(`Response UTC:   ${row.responseCreatedUtc}`);
  console.log();

  let questionText: string;
  let responseText: string;

  try {
    questionText = decrypt(row.questionCiphertext, row.questionNonce);
    responseText = decrypt(row.responseCiphertext, row.responseNonce);
  } catch (err) {
    console.error('DECRYPTION FAILED:', err instanceof Error ? err.message : err);
    console.error('The ALICE_ENCRYPTION_KEY in env does NOT match the key used to encrypt this data.');
    console.error('ABORT rebuild — investigate before doing anything destructive.');
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  console.log('--- QUESTION (decrypted plaintext) ---');
  console.log(questionText);
  console.log();
  console.log('--- RESPONSE (decrypted plaintext) ---');
  console.log(responseText);
  console.log();
  console.log(`Question length: ${questionText.length} chars`);
  console.log(`Response length: ${responseText.length} chars`);
  console.log();
  console.log('SUCCESS: key + ciphertext + nonce -> plaintext. Decryption pipeline verified.');

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('verify-decryption failed:', err);
  void sql.end({ timeout: 5 });
  process.exit(1);
});
