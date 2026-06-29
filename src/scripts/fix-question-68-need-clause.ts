/**
 * One-off reword of corpus question #68.
 *
 * Background: the question's second clause presupposed a *mechanism* of how a
 * need ends. "Walk through how you noticed the need was gone" assumes the need
 * faded and you registered its absence as a quiet internal observation. That
 * frame fits emotional/relational needs (no longer craving someone's approval)
 * but breaks on resolved or material ones: you don't "notice" the need for
 * mortgage money vanish, you pay it off; you don't notice the need for physical
 * therapy vanish, you recover and stop going. By the corpus design rule
 * (second clauses open, never narrow) the old clause narrowed by smuggling in
 * the mechanism. The replacement is agnostic to *how* the need ended: it accepts
 * "circumstances changed," "it got satisfied," and "I changed" equally.
 *
 *   old: What's something you used to need that you don't anymore?
 *        Walk through how you noticed the need was gone.
 *   new: What's something you used to need that you don't anymore?
 *        Why did you stop needing it? Do you miss it?
 *
 * Fix shape (single `sql.begin`, so a failure leaves the DB untouched):
 *   1. Rewrite the corpus master text (tb_question_corpus #68, plaintext column).
 *   2. Re-encrypt the new text into every *unanswered* served snapshot that
 *      points at corpus #68 (tb_questions.corpus_question_id = 68 with no
 *      response yet). Served rows are frozen copies, so the master edit alone
 *      would leave anyone currently staring at today's question on the stale
 *      wording. Already-answered rows are left as-is: their wording is part of
 *      the historical record and must not be rewritten.
 *
 * Idempotent: re-running rewrites the corpus to the same text and re-encrypts
 * the same (already-correct) plaintext into the same unanswered rows.
 *
 * Run: npx tsx src/scripts/fix-question-68-need-clause.ts
 */

import sql from '../lib/libDbPool.ts';
import { encrypt } from '../lib/libCrypto.ts';

const CORPUS_ID = 68;
const NEW_TEXT =
  "What's something you used to need that you don't anymore? Why did you stop needing it? Do you miss it?";

interface ServedRow {
  question_id: number;
  subject_id: number;
}

async function main(): Promise<void> {
  await sql.begin(async (tx) => {
    // 1. Rewrite the corpus master (plaintext).
    const corpusUpdated = await tx<{ corpus_question_id: number }[]>`
      UPDATE tb_question_corpus
         SET text = ${NEW_TEXT}
       WHERE corpus_question_id = ${CORPUS_ID}
      RETURNING corpus_question_id
    `;
    if (corpusUpdated.length === 0) {
      throw new Error(`corpus #${CORPUS_ID} not found; aborting`);
    }
    console.log(`  corpus #${CORPUS_ID} text rewritten`);

    // 2. Re-encrypt into every unanswered served snapshot of this corpus row.
    const served = await tx<ServedRow[]>`
      SELECT q.question_id, q.subject_id
        FROM tb_questions q
       WHERE q.corpus_question_id = ${CORPUS_ID}
         AND NOT EXISTS (
               SELECT 1 FROM tb_responses r
                WHERE r.question_id = q.question_id
             )
    `;

    for (const row of served) {
      const { ciphertext, nonce } = encrypt(NEW_TEXT);
      await tx`
        UPDATE tb_questions
           SET text_ciphertext   = ${ciphertext},
               text_nonce        = ${nonce},
               dttm_modified_utc = now(),
               modified_by       = 'fix-question-68-need-clause'
         WHERE question_id = ${row.question_id}
      `;
      console.log(
        `  re-encrypted served row q${row.question_id} (subject ${row.subject_id})`
      );
    }

    if (served.length === 0) {
      console.log('  no unanswered served rows to re-encrypt');
    }
  });

  console.log('Done.');
  await sql.end();
}

main().catch(async (err) => {
  console.error('fix-question-68-need-clause failed:', err);
  await sql.end();
  process.exit(1);
});
