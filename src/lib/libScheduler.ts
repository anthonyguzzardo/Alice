/**
 * Per-subject question scheduling from the shared corpus.
 *
 * Round-robin with a no-repeat window: each subject walks the corpus in
 * corpus_question_id order, never seeing the same question twice within the
 * window. When the corpus is exhausted and the window shrinks to cover
 * everything, the scheduler picks the question with the oldest last-seen date.
 *
 * Determinism guarantees:
 * - Within unseen window: same subject + same date + same active corpus = same assignment.
 * - In repeat territory: deterministic given full scheduling history.
 *
 * Storage (post migration 032): subject corpus draws live in `tb_questions`
 * with `question_source_id = 4` and `corpus_question_id` set. The legacy
 * `tb_scheduled_questions` table was dropped in Step 9 of the schema
 * unification. This module is now pure scheduling policy — every DB read
 * and write goes through libDb so the encryption + subject-scope boundaries
 * stay in one place.
 */

import sql from './libDbPool.ts';
import {
  scheduleSubjectCorpusQuestion,
  getSubjectScheduledQuestion,
  getSubjectCorpusHistory,
  getSubjectUnseenCorpusCount,
} from './libDb.ts';

// ----------------------------------------------------------------------------
// Constants (exported for test override)
// ----------------------------------------------------------------------------

/** Gap between corpus exhaustion and forced repeats. */
export const REPEAT_BUFFER = 10;

/** Unseen-question count below which a per-subject exhaustion warning fires. */
export const EXHAUSTION_WARNING_THRESHOLD = 7;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ScheduleResult {
  question_id: number;
  /** Null when the existing row is a seed/calibration/generated question (idempotency hit a non-corpus row). Set on every fresh corpus draw. */
  corpus_question_id: number | null;
  was_repeat: boolean;
}

export interface ScheduledQuestion {
  question_id: number;
  subject_id: number;
  /** Null for seed/calibration/generated rows; set only on corpus draws (question_source_id = 4). */
  corpus_question_id: number | null;
  scheduled_for: string;
  text: string;
  /** Only present on corpus rows (joined from tb_question_corpus). */
  theme_tag: string | null;
}

// ----------------------------------------------------------------------------
// Core scheduling
// ----------------------------------------------------------------------------

/**
 * Schedule a corpus question for a subject on a given date.
 *
 * Idempotent: if the subject already has a question for that date, returns
 * the existing assignment without inserting.
 */
export async function scheduleQuestionForSubject(
  subjectId: number,
  targetDate: string,
): Promise<ScheduleResult> {
  // Step 1: idempotency check
  const existing = await getSubjectScheduledQuestion(subjectId, targetDate);
  if (existing) {
    return {
      question_id: existing.question_id,
      corpus_question_id: existing.corpus_question_id,
      was_repeat: false,
    };
  }

  // Step 2: load active corpus
  const corpus = await sql`
    SELECT corpus_question_id
    FROM tb_question_corpus
    WHERE is_retired = FALSE
    ORDER BY corpus_question_id ASC
  ` as Array<{ corpus_question_id: number }>;

  if (corpus.length === 0) {
    throw new Error('Cannot schedule: no active questions in tb_question_corpus');
  }

  const corpusIds = corpus.map(r => r.corpus_question_id);
  const corpusSet = new Set(corpusIds);

  // Step 3: load subject's assignment history (chronological)
  const history = await getSubjectCorpusHistory(subjectId);

  // Step 4: compute no-repeat window
  const corpusSize = corpusIds.length;
  const windowSize = corpusSize <= REPEAT_BUFFER + 1
    ? Math.max(1, corpusSize - 1)
    : corpusSize - REPEAT_BUFFER;

  // Step 5: build recently-seen set from the tail of history
  const recentHistory = history.slice(-windowSize);
  const recentlySeen = new Set(recentHistory.map(h => h.corpus_question_id));

  // Step 6: build eligible list (active corpus minus recently seen)
  const eligible = corpusIds.filter(id => !recentlySeen.has(id));

  let pickedId: number;
  let wasRepeat: boolean;

  if (eligible.length > 0) {
    // Step 7a: unseen territory — walk from after last assignment, wrapping
    const lastId = history.length > 0
      ? history[history.length - 1]!.corpus_question_id
      : 0;

    const afterLast = eligible.filter(id => id > lastId);
    pickedId = afterLast.length > 0 ? afterLast[0]! : eligible[0]!;
    wasRepeat = false;
  } else {
    // Step 7b: repeat territory — pick the one with oldest last-seen date
    // Build a map of corpus_question_id → most recent scheduled_for
    const lastSeen = new Map<number, string>();
    for (const h of history) {
      if (corpusSet.has(h.corpus_question_id)) {
        lastSeen.set(h.corpus_question_id, String(h.scheduled_for));
      }
    }

    // Sort active corpus by (oldest last-seen, then lowest ID)
    const sorted = [...corpusIds].sort((a, b) => {
      const dateA = lastSeen.get(a) ?? '';
      const dateB = lastSeen.get(b) ?? '';
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      return a - b;
    });

    pickedId = sorted[0]!;
    wasRepeat = true;
  }

  // Step 8: insert via libDb (idempotent on conflict; reads back the
  // existing row if a concurrent insert won the race).
  const result = await scheduleSubjectCorpusQuestion(subjectId, pickedId, targetDate);
  return {
    question_id: result.question_id,
    corpus_question_id: result.corpus_question_id,
    // A race that returned an existing row is not a "repeat" in the
    // round-robin sense — it just means another worker scheduled the same
    // day already.
    was_repeat: result.was_inserted ? wasRepeat : false,
  };
}

// ----------------------------------------------------------------------------
// Reads (delegated to libDb)
// ----------------------------------------------------------------------------

/**
 * Get the scheduled corpus question for a subject on a given date.
 * Returns the question text + metadata, or null if not scheduled.
 */
export async function getScheduledQuestion(
  subjectId: number,
  targetDate: string,
): Promise<ScheduledQuestion | null> {
  const row = await getSubjectScheduledQuestion(subjectId, targetDate);
  if (!row) return null;
  return {
    question_id: row.question_id,
    subject_id: subjectId,
    corpus_question_id: row.corpus_question_id,
    scheduled_for: row.scheduled_for,
    text: row.text,
    theme_tag: row.theme_tag,
  };
}

/**
 * Count of active corpus questions this subject has NOT been assigned.
 * Used for the per-subject exhaustion warning.
 */
export async function getUnseenCount(subjectId: number): Promise<number> {
  return getSubjectUnseenCorpusCount(subjectId);
}
