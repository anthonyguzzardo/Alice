/**
 * npm run embed — backfill embeddings across every active subject.
 *
 * Loops `tb_subjects WHERE is_active = TRUE` and calls
 * `backfillEmbeddings(subjectId)` for each. Each call is idempotent
 * (rows that already have an embedding are skipped), so re-runs after
 * a partial completion or a TEI hiccup are safe.
 *
 * Requires TEI running locally (default localhost:8090). Owner runs this
 * manually after `npm run dev:full` brings TEI up. Prod has no TEI by
 * design — submission pipelines on prod log "TEI offline" and skip the
 * embed stage; this script drains the accumulated debt.
 *
 * Use `npm run backfill -- --subject-id N` if you only want one subject.
 *
 * Usage:
 *   npm run embed
 */
import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { backfillEmbeddings } from '../lib/libEmbeddings.ts';

interface SubjectRow {
  subject_id: number;
  username: string;
  display_name: string | null;
  is_owner: boolean;
}

async function main(): Promise<void> {
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

  let totalEmbedded = 0;
  let totalFailed = 0;
  const perSubject: Array<{ label: string; embedded: number; failed: number }> = [];

  for (const subject of subjects) {
    const label = `${subject.display_name || subject.username} #${subject.subject_id}`;
    console.log(`\n[embed] ${label} — start`);
    const { embedded, failed } = await backfillEmbeddings(subject.subject_id);
    console.log(`[embed] ${label} — embedded=${embedded} failed=${failed}`);
    perSubject.push({ label, embedded, failed });
    totalEmbedded += embedded;
    totalFailed += failed;
  }

  console.log('\n[embed] summary');
  for (const r of perSubject) {
    console.log(`  ${r.label.padEnd(30)} embedded=${r.embedded} failed=${r.failed}`);
  }
  console.log(`\n[embed] complete. Total embedded: ${totalEmbedded}, failed: ${totalFailed}`);
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[embed] fatal:', err);
  process.exit(1);
});
