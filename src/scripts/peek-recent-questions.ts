import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { decrypt } from '../lib/libCrypto.ts';

async function main() {
  const rows = await sql<Array<{
    subject_id: number;
    username: string;
    question_id: number;
    scheduled_for: string;
    question_source_id: number;
    corpus_question_id: number | null;
    text_ciphertext: string;
    text_nonce: string;
  }>>`
    SELECT s.subject_id, s.username, q.question_id, q.scheduled_for::text AS scheduled_for,
           q.question_source_id, q.corpus_question_id, q.text_ciphertext, q.text_nonce
    FROM tb_questions q
    JOIN tb_subjects s ON q.subject_id = s.subject_id
    WHERE q.question_source_id IN (1,2,4) AND q.scheduled_for IS NOT NULL
    ORDER BY q.scheduled_for DESC, q.question_id DESC
    LIMIT 40
  `;

  for (const r of rows) {
    const text = decrypt(r.text_ciphertext, r.text_nonce);
    console.log(`${r.scheduled_for} | ${r.username} | q${r.question_id} src=${r.question_source_id} corpus=${r.corpus_question_id ?? '-'}\n  ${text}\n`);
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
