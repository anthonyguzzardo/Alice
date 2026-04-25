/**
 * Schema-alignment test: tb_session_summaries vs tb_subject_session_summaries.
 *
 * Reads column names from both tables via information_schema, computes the
 * symmetric difference, and checks it against the allowlist at
 * db/sql/session_summary_divergence.allow.
 *
 * Fails if any column exists in one table but not the other AND is not
 * listed in the allowlist.
 *
 * Run: npx tsx src/scripts/test-session-summary-alignment.ts
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import sql from '../lib/libDbPool.ts';

async function main(): Promise<void> {
  // Load allowlist
  const allowRaw = readFileSync('db/sql/session_summary_divergence.allow', 'utf-8');
  const allowed = new Set(
    allowRaw.split('\n')
      .map(l => l.replace(/#.*$/, '').trim())
      .filter(Boolean),
  );

  // Query columns from both tables
  const ownerCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'alice' AND table_name = 'tb_session_summaries'
    ORDER BY ordinal_position
  ` as Array<{ column_name: string }>;

  const subjectCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'alice' AND table_name = 'tb_subject_session_summaries'
    ORDER BY ordinal_position
  ` as Array<{ column_name: string }>;

  const ownerSet = new Set(ownerCols.map(r => r.column_name));
  const subjectSet = new Set(subjectCols.map(r => r.column_name));

  // Symmetric difference
  const onlyOwner = [...ownerSet].filter(c => !subjectSet.has(c) && !allowed.has(c));
  const onlySubject = [...subjectSet].filter(c => !ownerSet.has(c) && !allowed.has(c));

  if (onlyOwner.length === 0 && onlySubject.length === 0) {
    console.log(`PASS: ${ownerSet.size} owner columns, ${subjectSet.size} subject columns, ${allowed.size} allowed divergences.`);
    console.log('Tables are aligned.');
    process.exit(0);
  }

  console.log('FAIL: unexpected schema divergence.\n');
  if (onlyOwner.length > 0) {
    console.log('Columns in tb_session_summaries but NOT in tb_subject_session_summaries:');
    for (const c of onlyOwner) console.log(`  - ${c}`);
  }
  if (onlySubject.length > 0) {
    console.log('Columns in tb_subject_session_summaries but NOT in tb_session_summaries:');
    for (const c of onlySubject) console.log(`  - ${c}`);
  }
  console.log('\nTo fix: add the column to the other table, or add it to');
  console.log('db/sql/session_summary_divergence.allow with a justification comment.');
  process.exit(1);
}

main().catch((err) => {
  console.error('Alignment test failed:', err);
  process.exit(1);
});
