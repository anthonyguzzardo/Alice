/**
 * Prove that the row decrypted by verify-decryption.ts is in fact the most
 * recent owner calibration entry. No plaintext — only IDs, timestamps, and
 * subject/source identity columns. Same WHERE clause as verify-decryption.ts.
 *
 * Usage on prod (as alice user with secrets.env sourced):
 *   set -a; source /etc/alice/secrets.env; set +a
 *   cd /opt/alice && npx tsx src/scripts/verify-ordering.ts
 */

import 'dotenv/config';
import sql from '../lib/libDbPool.ts';

async function main() {
  console.log('--- Proving ordering: subject_id=1, question_source_id=3, ORDER BY dttm DESC ---\n');

  const subjectRow = await sql`
    SELECT subject_id, username, is_owner
    FROM tb_subjects WHERE subject_id = 1
  `;
  console.log('Subject identity (subject_id=1):');
  console.log(' ', subjectRow[0]);
  console.log();

  const sourceRow = await sql`
    SELECT question_source_id, enum_code, name
    FROM te_question_source WHERE question_source_id = 3
  `;
  console.log('Question-source identity (question_source_id=3):');
  console.log(' ', sourceRow[0]);
  console.log();

  const totalRow = await sql`
    SELECT COUNT(*)::int AS n
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE r.subject_id = 1 AND q.question_source_id = 3
  `;
  console.log(`Total owner-calibration responses on prod: ${totalRow[0].n}`);
  console.log();

  const rows = await sql`
    SELECT r.response_id, r.question_id, r.dttm_created_utc
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE r.subject_id = 1 AND q.question_source_id = 3
    ORDER BY r.dttm_created_utc DESC
    LIMIT 5
  `;
  console.log('Top 5 most recent owner calibrations (no plaintext):');
  for (const [i, r] of rows.entries()) {
    const marker = r.response_id === 96 ? '   <-- decrypted by verify-decryption.ts' : '';
    console.log(`  #${i + 1}  response_id=${r.response_id}  question_id=${r.question_id}  ${r.dttm_created_utc.toISOString()}${marker}`);
  }

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('verify-ordering failed:', err);
  void sql.end({ timeout: 5 });
  process.exit(1);
});
