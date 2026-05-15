/**
 * One-off remediation for the shared-corpus dedupe bug.
 *
 * Background: `getOrCreateTodayQuestion` skips corpus rows by FK match
 * (`tb_questions.corpus_question_id = tb_question_corpus.corpus_question_id`).
 * Owner's historical journal seeds (question_source_id = 1) and any
 * subject-side seed rows from earlier provisioning paths were inserted with
 * `corpus_question_id IS NULL` because the FK column post-dated them
 * (migration 032). When the corpus was later seeded with the same texts,
 * those historical rows became invisible to the dedupe and the algorithm
 * started re-serving questions every subject had already answered. Owner
 * was handed corpus_question_id=1 ("What are you pretending isn't bothering
 * you right now?") on 2026-05-15 — text he answered as a seed on 2026-04-13.
 *
 * Fix shape:
 *   1. Decrypt every `corpus_question_id IS NULL` row, look up the matching
 *      active corpus row by exact plaintext, and write the FK back. The
 *      schema invariant changes from "source 1-3 → FK NULL" to "FK is set
 *      whenever the text matches an active corpus row, regardless of source"
 *      (see updated table comment in dbAlice_Tables.sql).
 *   2. Cascade-delete today's owner row that was already mis-served. Per
 *      the project rule, every logical-FK child table is touched explicitly
 *      inside the transaction even when today's count is zero, so the
 *      delete pattern is visible at a glance and survives future child
 *      tables being added.
 *
 * Both halves run in a single `sql.begin` so a failure leaves the database
 * exactly as it started. Re-running the script is a no-op once the FKs are
 * backfilled and today's row is gone.
 */

import sql from '../lib/libDbPool.ts';
import { decrypt } from '../lib/libCrypto.ts';

interface NullCorpusRow {
  question_id: number;
  subject_id: number;
  question_source_id: number;
  ct: string;
  nonce: string;
}

async function main() {
  const corpusRows = await sql`
    SELECT corpus_question_id, text FROM tb_question_corpus WHERE is_retired = FALSE
  ` as Array<{ corpus_question_id: number; text: string }>;
  const corpusByText = new Map<string, number>();
  for (const c of corpusRows) corpusByText.set(c.text, c.corpus_question_id);

  const candidates = await sql`
    SELECT q.question_id, q.subject_id, q.question_source_id,
           q.text_ciphertext AS ct, q.text_nonce AS nonce
    FROM tb_questions q
    WHERE q.corpus_question_id IS NULL
  ` as NullCorpusRow[];

  const updates: Array<{ question_id: number; corpus_question_id: number }> = [];
  for (const r of candidates) {
    const text = decrypt(r.ct, r.nonce);
    const cid = corpusByText.get(text);
    if (cid !== undefined) updates.push({ question_id: r.question_id, corpus_question_id: cid });
  }

  // The mis-served row to cascade-delete. Owner, today, corpus_question_id=1,
  // no response, only page-open interaction events.
  const TODAY_OWNER_QID = 579;
  const todayCheck = await sql`
    SELECT q.question_id, q.subject_id, q.scheduled_for, q.corpus_question_id,
           (SELECT COUNT(*) FROM tb_responses r WHERE r.question_id = q.question_id) AS resp_count
    FROM tb_questions q WHERE q.question_id = ${TODAY_OWNER_QID}
  ` as Array<{ question_id: number; subject_id: number; scheduled_for: string; corpus_question_id: number | null; resp_count: number }>;

  if (todayCheck.length === 0) {
    console.log(`note: question_id=${TODAY_OWNER_QID} not present, skipping delete (already cleaned).`);
  } else {
    const t = todayCheck[0]!;
    if (t.subject_id !== 1) throw new Error(`refusing to delete: question_id=${TODAY_OWNER_QID} belongs to subject_id=${t.subject_id}, not owner`);
    if (Number(t.resp_count) > 0) throw new Error(`refusing to delete: question_id=${TODAY_OWNER_QID} has a response. Don't delete answered rows.`);
    if (t.corpus_question_id !== 1) console.warn(`warning: question_id=${TODAY_OWNER_QID} corpus_question_id is ${t.corpus_question_id}, expected 1.`);
  }

  await sql.begin(async (tx) => {
    let backfilled = 0;
    for (const u of updates) {
      const res = await tx`
        UPDATE tb_questions
           SET corpus_question_id = ${u.corpus_question_id},
               dttm_modified_utc = CURRENT_TIMESTAMP,
               modified_by = 'fix-corpus-fk-collision'
         WHERE question_id = ${u.question_id}
           AND corpus_question_id IS NULL
      `;
      backfilled += res.count ?? 0;
    }

    let deletedChildren: Record<string, number> = {};
    if (todayCheck.length > 0) {
      // Logical-FK cascade. Children-of-responses first (tb_embeddings),
      // then tb_responses (zero-row in this case but explicit), then every
      // child of tb_questions, then tb_questions itself last. Per project
      // rule: include zero-row deletes verbatim so the cascade shape stays
      // visible.
      const responseRows = await tx`SELECT response_id FROM tb_responses WHERE question_id = ${TODAY_OWNER_QID}` as Array<{ response_id: number }>;
      if (responseRows.length > 0) {
        const respIds = responseRows.map((r) => r.response_id);
        const eRes = await tx`DELETE FROM tb_embeddings WHERE embedding_source_id = 1 AND source_id = ANY(${respIds})`;
        deletedChildren['tb_embeddings'] = eRes.count ?? 0;
      } else {
        deletedChildren['tb_embeddings'] = 0;
      }
      deletedChildren['tb_responses']             = (await tx`DELETE FROM tb_responses             WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_session_summaries']     = (await tx`DELETE FROM tb_session_summaries     WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_session_events']        = (await tx`DELETE FROM tb_session_events        WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_session_metadata']      = (await tx`DELETE FROM tb_session_metadata      WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_burst_sequences']       = (await tx`DELETE FROM tb_burst_sequences       WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_rburst_sequences']      = (await tx`DELETE FROM tb_rburst_sequences      WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_dynamical_signals']     = (await tx`DELETE FROM tb_dynamical_signals     WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_motor_signals']         = (await tx`DELETE FROM tb_motor_signals         WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_semantic_signals']      = (await tx`DELETE FROM tb_semantic_signals      WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_process_signals']       = (await tx`DELETE FROM tb_process_signals       WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_cross_session_signals'] = (await tx`DELETE FROM tb_cross_session_signals WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_session_integrity']     = (await tx`DELETE FROM tb_session_integrity     WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_question_feedback']     = (await tx`DELETE FROM tb_question_feedback     WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_interaction_events']    = (await tx`DELETE FROM tb_interaction_events    WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_reconstruction_residuals'] = (await tx`DELETE FROM tb_reconstruction_residuals WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_signal_jobs']           = (await tx`DELETE FROM tb_signal_jobs           WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
      deletedChildren['tb_questions']             = (await tx`DELETE FROM tb_questions             WHERE question_id = ${TODAY_OWNER_QID}`).count ?? 0;
    }

    console.log(`backfilled ${backfilled} of ${updates.length} candidate rows`);
    if (todayCheck.length > 0) {
      console.log(`deleted today's mis-served owner row (q=${TODAY_OWNER_QID}, corpus_question_id=1):`);
      for (const [tbl, n] of Object.entries(deletedChildren)) console.log(`  ${tbl.padEnd(34)} ${n}`);
    }
  });

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('fix-corpus-fk-collision failed:', err);
  void sql.end({ timeout: 5 });
  process.exit(1);
});
