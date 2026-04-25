/**
 * Schedule tomorrow's question for all active subjects.
 *
 * Iterates active non-owner subjects, assigns a corpus question for tomorrow
 * via round-robin, and prints per-subject exhaustion warnings when unseen
 * questions drop below threshold.
 *
 * The owner is excluded — they have their own generation pipeline.
 *
 * Exit code: 0 on success (even with warnings), nonzero on errors.
 *
 * Run: npx tsx src/scripts/schedule-questions.ts
 */

import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import {
  scheduleQuestionForSubject,
  getUnseenCount,
  getScheduledQuestion,
  EXHAUSTION_WARNING_THRESHOLD,
} from '../lib/libScheduler.ts';

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const targetDate = tomorrowStr();
  console.log(`Scheduling for: ${targetDate}\n`);

  // Active non-owner subjects only
  const subjects = await sql`
    SELECT subject_id, display_name, invite_code
    FROM tb_subjects
    WHERE is_owner = FALSE AND is_active = TRUE
    ORDER BY subject_id ASC
  ` as Array<{ subject_id: number; display_name: string | null; invite_code: string }>;

  if (subjects.length === 0) {
    console.log('No active subjects to schedule.');
    return;
  }

  let warnings = 0;

  for (const subj of subjects) {
    const label = subj.display_name ?? subj.invite_code;

    const result = await scheduleQuestionForSubject(subj.subject_id, targetDate);
    const scheduled = await getScheduledQuestion(subj.subject_id, targetDate);
    const questionText = scheduled?.text ?? '(unknown)';

    console.log(`Scheduled subject "${label}" → corpus question ${result.corpus_question_id}: "${questionText}" (repeat: ${result.was_repeat})`);

    const unseen = await getUnseenCount(subj.subject_id);
    if (unseen < EXHAUSTION_WARNING_THRESHOLD) {
      warnings++;
      console.log(`  ⚠ Subject "${label}" has ${unseen} unseen questions remaining (threshold: ${EXHAUSTION_WARNING_THRESHOLD}).`);
      console.log(`    Run: npx tsx src/scripts/expand-corpus.ts`);
    }
  }

  console.log(`\nScheduled ${subjects.length} subjects, ${warnings} warnings.`);
}

main().catch((err) => {
  console.error('schedule-questions failed:', err);
  process.exit(1);
});
