import { SEED_QUESTIONS } from './libSeeds.ts';
import { scheduleQuestion, hasQuestionForDate, countScheduledSeedQuestions } from './libDb.ts';
import { localDateStr } from './utlDate.ts';

/**
 * One-shot seeder: plants all SEED_QUESTIONS forward from today on first run.
 *
 * Idempotent by design — bails if any seed already exists. This prevents the
 * sliding-window bug where re-running on a later day would leave slot
 * today+(days-1) empty and fill it with SEED_QUESTIONS[days-1], producing
 * duplicates of the last seed on each subsequent run.
 *
 * After day 30, generate.ts takes over. There is no valid reason to re-seed.
 */
export async function seedUpcomingQuestions(subjectId: number, days = 30): Promise<void> {
  if (await countScheduledSeedQuestions(subjectId) > 0) return;

  const today = new Date();
  for (let i = 0; i < days && i < SEED_QUESTIONS.length; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = localDateStr(date);

    if (!(await hasQuestionForDate(subjectId, dateStr))) {
      await scheduleQuestion(subjectId, SEED_QUESTIONS[i]!, dateStr, 'seed');
    }
  }
}
