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
    WHERE q.question_source_id = 1
    ORDER BY s.subject_id, q.scheduled_for
  `;

  let curSubj = -1;
  for (const r of rows) {
    if (r.subject_id !== curSubj) {
      console.log(`\n=== ${r.username} (subject ${r.subject_id}) ===`);
      curSubj = r.subject_id;
    }
    const text = decrypt(r.text_ciphertext, r.text_nonce);
    const matchAlmost = text.toLowerCase().includes('almost saying') ? ' <-- ALMOST SAYING' : '';
    console.log(`  q${r.question_id} ${r.scheduled_for}: ${text}${matchAlmost}`);
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
