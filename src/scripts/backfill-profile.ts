/**
 * Backfill personal profile from all existing journal sessions.
 *
 * Run once: npx tsx src/scripts/backfill-profile.ts
 */
import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { updateProfile } from '../lib/libProfile.ts';

async function main() {
  // Get the most recent journal question ID to pass as the "latest"
  const rows = await sql`
    SELECT q.question_id
    FROM tb_session_summaries ss
    JOIN tb_questions q ON ss.question_id = q.question_id
    WHERE q.question_source_id != 3
    ORDER BY ss.session_summary_id DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.log('No journal sessions found. Nothing to backfill.');
    process.exit(0);
  }

  const latestQuestionId = (rows[0] as { question_id: number }).question_id;
  console.log(`Backfilling profile from all sessions (latest question_id: ${latestQuestionId})...`);

  await updateProfile(latestQuestionId);

  // Verify
  const profile = await sql`SELECT session_count, vocab_cumulative, burst_count_mean, ex_gaussian_tau_mean FROM tb_personal_profile LIMIT 1`;
  if (profile.length > 0) {
    const p = profile[0] as any;
    console.log(`Profile created: ${p.session_count} sessions, ${p.vocab_cumulative} unique words, burst_count_mean=${p.burst_count_mean?.toFixed(1)}, tau_mean=${p.ex_gaussian_tau_mean?.toFixed(1)}`);
  } else {
    console.log('Warning: profile row not found after backfill.');
  }

  await sql.end();
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
