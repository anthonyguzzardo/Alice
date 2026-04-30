/**
 * npm run embed — drain every TEI-derivable thing in the database that's
 * currently missing, across every active subject.
 *
 * Two stages per subject:
 *
 *   1. Per-response embeddings (tb_embeddings). Calls backfillEmbeddings,
 *      which inserts a row for every tb_responses entry that has no
 *      corresponding tb_embeddings row at the active model_version_id.
 *      Idempotent — re-runs skip already-embedded responses.
 *
 *   2. Discourse coherence (tb_semantic_signals.discourse_*). For every
 *      semantic-signals row where ALL FOUR discourse fields are NULL, fetch
 *      the response text, run computeDiscourseCoherence, UPDATE the four
 *      discourse columns. Rows where the function returns all-null again
 *      (text has fewer than 5 long-enough sentences) are left NULL — that
 *      is correct function output, not a failure. Re-running on those rows
 *      is microseconds because computeDiscourseCoherence early-returns
 *      before the first TEI call.
 *
 * Both stages target the "missing" condition only — never recompute or
 * overwrite rows that already have values.
 *
 * Requires TEI running locally (default localhost:8090). The script
 * verifies TEI before doing anything; if TEI is down it exits with an
 * error. Prod has no TEI by design — submissions write rows with NULL
 * discourse / no embedding, this script fills them when run with
 * `npm run dev:full` (or TEI started separately).
 *
 * For single-subject single-stage runs, `npm run backfill -- --subject-id N`
 * still exists for embeddings only. There is no single-subject equivalent
 * for discourse on its own; pass --subject-id N to recompute-semantic-signals
 * (DELETE-then-rerun pattern) only when *repairing* corrupted rows. This
 * script is the routine drainage path.
 *
 * Usage:
 *   npm run embed
 */
import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { backfillEmbeddings, isTeiAvailable } from '../lib/libEmbeddings.ts';
import { computeDiscourseCoherence } from '../lib/libSemanticSignals.ts';
import { getResponseText } from '../lib/libDb.ts';

interface SubjectRow {
  subject_id: number;
  username: string;
  display_name: string | null;
  is_owner: boolean;
}

interface SubjectStats {
  label: string;
  embedded: number;
  embeddingFailed: number;
  discourseUpdated: number;
  discourseSkipped: number;
  discourseFailed: number;
}

async function drainDiscourseForSubject(subjectId: number): Promise<{
  updated: number;
  skipped: number;
  failed: number;
}> {
  // Find every semantic-signals row for this subject where all four
  // discourse fields are NULL. "All four NULL" is the tight missing
  // condition — leaves alone any row where the function previously
  // produced numbers, even if a degenerate edge case nulled one of them.
  const targets = (await sql`
    SELECT question_id
    FROM tb_semantic_signals
    WHERE subject_id = ${subjectId}
      AND discourse_global_coherence IS NULL
      AND discourse_local_coherence IS NULL
      AND discourse_global_local_ratio IS NULL
      AND discourse_coherence_decay_slope IS NULL
    ORDER BY question_id ASC
  `) as Array<{ question_id: number }>;

  if (targets.length === 0) {
    return { updated: 0, skipped: 0, failed: 0 };
  }

  console.log(`[discourse] ${targets.length} row${targets.length === 1 ? '' : 's'} with NULL discourse — draining`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const { question_id: questionId } of targets) {
    try {
      const text = await getResponseText(subjectId, questionId);
      if (!text) {
        // No response text on disk for this row — nothing to compute.
        // Counts as failed because the row won't fill in on a re-run either.
        failed++;
        continue;
      }

      const dc = await computeDiscourseCoherence(text);

      // Function returns all-null when text has < 5 long-enough sentences,
      // or when too many TEI calls failed. The first case is correct
      // permanent output (text is just too short for discourse metrics);
      // the second would be retried on a future run if TEI was flaky.
      // Either way: don't UPDATE — leave the row NULL.
      if (
        dc.globalCoherence === null
        && dc.localCoherence === null
        && dc.globalLocalRatio === null
        && dc.coherenceDecaySlope === null
      ) {
        skipped++;
        continue;
      }

      await sql`
        UPDATE tb_semantic_signals
        SET discourse_global_coherence      = ${dc.globalCoherence},
            discourse_local_coherence       = ${dc.localCoherence},
            discourse_global_local_ratio    = ${dc.globalLocalRatio},
            discourse_coherence_decay_slope = ${dc.coherenceDecaySlope}
        WHERE subject_id = ${subjectId} AND question_id = ${questionId}
      `;
      updated++;
    } catch (err) {
      console.error(`[discourse] q${questionId} failed:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  return { updated, skipped, failed };
}

async function main(): Promise<void> {
  // TEI gate. Both stages need TEI; check once up front and exit cleanly
  // if it's down rather than letting individual TEI calls fail with
  // ECONNREFUSED stack traces.
  if (!(await isTeiAvailable())) {
    console.error('[embed] TEI is not responding at the configured endpoint.');
    console.error('  Start TEI (e.g. via `npm run dev:full`) and re-run.');
    process.exit(1);
  }

  const subjects = (await sql`
    SELECT subject_id, username, display_name, is_owner
    FROM tb_subjects
    WHERE is_active = TRUE
    ORDER BY is_owner DESC, subject_id ASC
  `) as SubjectRow[];

  if (subjects.length === 0) {
    console.log('[embed] no active subjects — nothing to do');
    process.exit(0);
  }

  console.log(
    `[embed] ${subjects.length} active subject${subjects.length === 1 ? '' : 's'}: ` +
      subjects.map((s) => `${s.username}#${s.subject_id}`).join(', ')
  );

  const perSubject: SubjectStats[] = [];
  let totalEmbedded = 0;
  let totalEmbeddingFailed = 0;
  let totalDiscourseUpdated = 0;
  let totalDiscourseSkipped = 0;
  let totalDiscourseFailed = 0;

  for (const subject of subjects) {
    const label = `${subject.display_name || subject.username} #${subject.subject_id}`;
    console.log(`\n[embed] ${label} — start`);

    // Stage 1: per-response embeddings (tb_embeddings)
    const { embedded, failed: embeddingFailed } = await backfillEmbeddings(subject.subject_id);
    console.log(`[embed] ${label} — embeddings: embedded=${embedded} failed=${embeddingFailed}`);

    // Stage 2: discourse coherence (tb_semantic_signals.discourse_*)
    const {
      updated: discourseUpdated,
      skipped: discourseSkipped,
      failed: discourseFailed,
    } = await drainDiscourseForSubject(subject.subject_id);
    console.log(
      `[embed] ${label} — discourse: updated=${discourseUpdated} ` +
      `skipped=${discourseSkipped} failed=${discourseFailed}`
    );

    perSubject.push({
      label, embedded, embeddingFailed,
      discourseUpdated, discourseSkipped, discourseFailed,
    });
    totalEmbedded += embedded;
    totalEmbeddingFailed += embeddingFailed;
    totalDiscourseUpdated += discourseUpdated;
    totalDiscourseSkipped += discourseSkipped;
    totalDiscourseFailed += discourseFailed;
  }

  console.log('\n[embed] summary');
  for (const r of perSubject) {
    console.log(
      `  ${r.label.padEnd(30)} ` +
      `embed=${r.embedded}/${r.embeddingFailed}f ` +
      `discourse=${r.discourseUpdated}u/${r.discourseSkipped}s/${r.discourseFailed}f`
    );
  }
  console.log(
    `\n[embed] complete. ` +
    `Embeddings: ${totalEmbedded} added, ${totalEmbeddingFailed} failed. ` +
    `Discourse: ${totalDiscourseUpdated} updated, ${totalDiscourseSkipped} skipped (legitimate null), ${totalDiscourseFailed} failed.`
  );
  const exitCode = (totalEmbeddingFailed > 0 || totalDiscourseFailed > 0) ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[embed] fatal:', err);
  process.exit(1);
});
