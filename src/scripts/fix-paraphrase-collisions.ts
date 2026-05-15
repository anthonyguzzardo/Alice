/**
 * Operator-curated paraphrase pairing for the corpus dedupe.
 *
 * fix-corpus-fk-collision.ts handled exact-string matches between subject
 * seeds and tb_question_corpus (28 rows total). Several more seeds turned
 * out to be paraphrases of corpus rows: same question, different wording.
 * Exact-string match cannot see them, but a human reading the texts side
 * by side absolutely can. This script encodes the human-curated pairings
 * and treats them as ground truth.
 *
 * Pairings:
 *   subject_id=1  (owner)
 *     q= 21 "Where are you performing competence instead of becoming competent?"
 *       → corpus= 21 "Where are you performing competence instead of actually learning?"
 *     q= 28 "Describe a recent decision you made on autopilot. If you had
 *            paused and actually chosen, what would have been different?"
 *       → corpus= 28 "What would it mean to stop optimizing and start choosing?"
 *   subject_id=16 (alexandra)
 *     q=510 "What are you pretending isn't bothering you, and what's the cost
 *            of continuing to pretend?"
 *       → corpus=  1 "What are you pretending isn't bothering you right now?"
 *     q=511 "If you couldn't work on anything you're currently working on,
 *            what would fill the time? Describe what you'd reach for first,
 *            and what you'd reach for after that stopped working."
 *       → corpus=  2 "If you couldn't work on anything you're currently
 *            working on, what would you do instead?"
 *   subject_id=17 (badger)
 *     q=539 "What are you pretending isn't bothering you, and what's the cost
 *            of continuing to pretend?"
 *       → corpus=  1 "What are you pretending isn't bothering you right now?"
 *
 * The badger pairing is hygiene-only — corpus=1 is already covered by his
 * other seed q=442 which is verbatim corpus=1, so dedupe behavior doesn't
 * change. The other four pairings are load-bearing: without them the next
 * corpus draw for the affected subject is a repeat of a question they have
 * already answered as a seed.
 *
 * After the pairings, the owner's wrongly-served today row (q=580, corpus=21)
 * gets cascade-deleted. No response exists on it. Next /today load picks the
 * lowest unseen corpus row, which post-pair is corpus_question_id=29.
 *
 * No subject (ash / alexandra / badger) has a row for today. Their next
 * /today load picks correctly post-pair: alexandra → corpus=3, badger →
 * corpus=3, ash → corpus=2 (still unseen for ash because she only has the
 * corpus=1 link).
 *
 * The script runs in one sql.begin transaction. Failure rolls back cleanly.
 */
import sql from '../lib/libDbPool.ts';

const PAIRS: Array<{ subject_id: number; question_id: number; corpus_question_id: number; note: string }> = [
  { subject_id:  1, question_id:  21, corpus_question_id: 21, note: 'owner: becoming competent / actually learning' },
  { subject_id:  1, question_id:  28, corpus_question_id: 28, note: 'owner: autopilot decision / stop optimizing start choosing' },
  { subject_id: 16, question_id: 510, corpus_question_id:  1, note: 'alexandra: cost of continuing to pretend / pretending isn’t bothering you' },
  { subject_id: 16, question_id: 511, corpus_question_id:  2, note: 'alexandra: what would fill the time / what would you do instead' },
  { subject_id: 17, question_id: 539, corpus_question_id:  1, note: 'badger: cost of continuing to pretend / pretending isn’t bothering you (hygiene only)' },
];

const TODAY_OWNER_QID = 580;

/**
 * Corpus rows that are functional duplicates of other corpus rows when
 * answered side by side. These were eyeballed against owner's full
 * answered set after the 5 paraphrase pairings landed; the call is to
 * retire them rather than pair, because the redundancy is corpus-internal
 * (any subject who has answered the canonical row would feel the dupe,
 * not just owner).
 *
 *   corpus=45 ("avoiding admitting")  ≈ corpus= 1 ("pretending isn't bothering")
 *   corpus=53 ("completely present")  ≈ corpus=11 ("most yourself") +
 *                                         corpus=36 ("most alive")
 *   corpus=58 ("alone, wouldn't do
 *               if someone watching") ≈ corpus= 9 ("if nobody was watching")
 *
 * Setting is_retired = TRUE keeps the row in the table for historical
 * reference and stops getOrCreateTodayQuestion from drawing it. Subject
 * rows that already answered these via a corpus draw stay valid; the
 * retirement only affects future picks.
 */
const CORPUS_TO_RETIRE: Array<{ corpus_question_id: number; reason: string }> = [
  { corpus_question_id: 45, reason: 'paraphrase of corpus=1 (pretending / avoiding admitting)' },
  { corpus_question_id: 53, reason: 'overlaps with corpus=11 (most yourself) and corpus=36 (most alive)' },
  { corpus_question_id: 58, reason: 'paraphrase of corpus=9 (alone, wouldn’t do if watched / nobody was watching)' },
];

async function main() {
  // Sanity: refuse to clobber a row that already has a different FK or that
  // belongs to a different subject than the pairing claims.
  for (const p of PAIRS) {
    const rows = await sql`
      SELECT subject_id, corpus_question_id FROM tb_questions WHERE question_id = ${p.question_id}
    ` as Array<{ subject_id: number; corpus_question_id: number | null }>;
    const r = rows[0];
    if (!r) throw new Error(`pairing target question_id=${p.question_id} not found`);
    if (r.subject_id !== p.subject_id) throw new Error(`pairing target question_id=${p.question_id} belongs to subject_id=${r.subject_id}, expected ${p.subject_id}`);
    if (r.corpus_question_id !== null && r.corpus_question_id !== p.corpus_question_id) {
      throw new Error(`pairing target question_id=${p.question_id} already linked to corpus_question_id=${r.corpus_question_id}, refusing to overwrite to ${p.corpus_question_id}`);
    }
  }

  const todayCheck = await sql`
    SELECT q.question_id, q.subject_id, q.corpus_question_id,
           (SELECT COUNT(*) FROM tb_responses r WHERE r.question_id = q.question_id) AS resp_count
    FROM tb_questions q WHERE q.question_id = ${TODAY_OWNER_QID}
  ` as Array<{ question_id: number; subject_id: number; corpus_question_id: number | null; resp_count: number }>;
  const today = todayCheck[0];
  if (today) {
    if (today.subject_id !== 1) throw new Error(`refusing: q=${TODAY_OWNER_QID} belongs to subject_id=${today.subject_id}`);
    if (Number(today.resp_count) > 0) throw new Error(`refusing: q=${TODAY_OWNER_QID} already has a response`);
  }

  await sql.begin(async (tx) => {
    let pairedCount = 0;
    for (const p of PAIRS) {
      const res = await tx`
        UPDATE tb_questions
           SET corpus_question_id = ${p.corpus_question_id},
               dttm_modified_utc = CURRENT_TIMESTAMP,
               modified_by = 'fix-paraphrase-collisions'
         WHERE question_id = ${p.question_id}
           AND subject_id = ${p.subject_id}
           AND corpus_question_id IS DISTINCT FROM ${p.corpus_question_id}
      `;
      if ((res.count ?? 0) > 0) {
        pairedCount++;
        console.log(`paired subject=${p.subject_id} q=${p.question_id} → corpus_question_id=${p.corpus_question_id}  (${p.note})`);
      } else {
        console.log(`already paired subject=${p.subject_id} q=${p.question_id} → corpus_question_id=${p.corpus_question_id}, skip`);
      }
    }

    let retiredCount = 0;
    for (const r of CORPUS_TO_RETIRE) {
      const res = await tx`
        UPDATE tb_question_corpus
           SET is_retired = TRUE
         WHERE corpus_question_id = ${r.corpus_question_id}
           AND is_retired = FALSE
      `;
      if ((res.count ?? 0) > 0) {
        retiredCount++;
        console.log(`retired corpus_question_id=${r.corpus_question_id}  (${r.reason})`);
      } else {
        console.log(`already retired corpus_question_id=${r.corpus_question_id}, skip`);
      }
    }

    let deletedChildren: Record<string, number> = {};
    if (today) {
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

    console.log(`\npaired ${pairedCount} of ${PAIRS.length} pairs, retired ${retiredCount} of ${CORPUS_TO_RETIRE.length} corpus rows`);
    if (today) {
      console.log(`deleted today's owner row q=${TODAY_OWNER_QID} (corpus_question_id=${today.corpus_question_id}):`);
      for (const [tbl, n] of Object.entries(deletedChildren)) console.log(`  ${tbl.padEnd(34)} ${n}`);
    } else {
      console.log(`note: q=${TODAY_OWNER_QID} not present, skip delete.`);
    }
  });

  // Show next-pick + runway for every subject so the post-fix state is auditable.
  const subjects = await sql`SELECT subject_id, username FROM tb_subjects ORDER BY subject_id` as Array<{ subject_id: number; username: string }>;
  console.log(`\n=== POST-FIX NEXT-PICK PER SUBJECT ===`);
  for (const s of subjects) {
    const next = await sql`
      SELECT c.corpus_question_id, c.text
      FROM tb_question_corpus c
      WHERE c.is_retired = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM tb_questions q
          WHERE q.subject_id = ${s.subject_id} AND q.corpus_question_id = c.corpus_question_id
        )
      ORDER BY c.corpus_question_id ASC LIMIT 1
    ` as Array<{ corpus_question_id: number; text: string }>;
    const runway = await sql`
      SELECT COUNT(*)::int AS unseen
      FROM tb_question_corpus c
      WHERE c.is_retired = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM tb_questions q
          WHERE q.subject_id = ${s.subject_id} AND q.corpus_question_id = c.corpus_question_id
        )
    ` as Array<{ unseen: number }>;
    if (next.length > 0) {
      console.log(`  subject=${s.subject_id} (${s.username}): next=corpus_${next[0]!.corpus_question_id}, ${runway[0]!.unseen} unseen rows of runway`);
      console.log(`    "${next[0]!.text}"`);
    } else {
      console.log(`  subject=${s.subject_id} (${s.username}): exhausted, fallback to oldest`);
    }
  }

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('fix-paraphrase-collisions failed:', err);
  void sql.end({ timeout: 5 });
  process.exit(1);
});
