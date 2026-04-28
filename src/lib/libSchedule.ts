import { SEED_QUESTIONS } from './libSeeds.ts';
import { scheduleQuestion, hasQuestionForDate, countScheduledSeedQuestions } from './libDb.ts';
import { addDays, localDateStr } from './utlDate.ts';

/**
 * One-shot seeder: plants all SEED_QUESTIONS forward from today on first run.
 *
 * "Today" is computed in the subject's IANA timezone so day-1 aligns with
 * the subject's local midnight. The schema-level intent of
 * `tb_subjects.iana_timezone` is the calendar-flip for journal entries —
 * see CLAUDE.md "Subject creation contract". Owner provisioning passes
 * 'UTC' explicitly.
 *
 * Idempotent by design — bails if any seed already exists. This prevents the
 * sliding-window bug where re-running on a later day would leave slot
 * today+(days-1) empty and fill it with SEED_QUESTIONS[days-1], producing
 * duplicates of the last seed on each subsequent run.
 *
 * After the personal seeds run out, the corpus scheduler takes over. There
 * is no valid reason to re-seed.
 */
export async function seedUpcomingQuestions(
  subjectId: number,
  ianaTimezone: string,
  days = 30,
): Promise<void> {
  if (await countScheduledSeedQuestions(subjectId) > 0) return;

  const startDate = localDateStr(new Date(), ianaTimezone);
  for (let i = 0; i < days && i < SEED_QUESTIONS.length; i++) {
    const dateStr = addDays(startDate, i);

    if (!(await hasQuestionForDate(subjectId, dateStr))) {
      await scheduleQuestion(subjectId, SEED_QUESTIONS[i]!, dateStr, 'seed');
    }
  }
}
