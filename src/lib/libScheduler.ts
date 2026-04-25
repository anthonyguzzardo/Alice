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
 */

import sql from './libDbPool.ts';

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
  scheduled_question_id: number;
  corpus_question_id: number;
  was_repeat: boolean;
}

export interface ScheduledQuestion {
  scheduled_question_id: number;
  subject_id: number;
  corpus_question_id: number;
  scheduled_for: string;
  text: string;
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
  const existing = await getExistingSchedule(subjectId, targetDate);
  if (existing) {
    return { ...existing, was_repeat: false };
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
  const history = await sql`
    SELECT corpus_question_id, scheduled_for
    FROM tb_scheduled_questions
    WHERE subject_id = ${subjectId}
    ORDER BY scheduled_for ASC
  ` as Array<{ corpus_question_id: number; scheduled_for: string }>;

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
      ? history[history.length - 1].corpus_question_id
      : 0;

    const afterLast = eligible.filter(id => id > lastId);
    pickedId = afterLast.length > 0 ? afterLast[0] : eligible[0];
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

    pickedId = sorted[0];
    wasRepeat = true;
  }

  // Step 8: insert (ON CONFLICT for race condition safety)
  const [row] = await sql`
    INSERT INTO tb_scheduled_questions (subject_id, corpus_question_id, scheduled_for)
    VALUES (${subjectId}, ${pickedId}, ${targetDate})
    ON CONFLICT (subject_id, scheduled_for) DO NOTHING
    RETURNING scheduled_question_id, corpus_question_id
  `;

  if (row) {
    return {
      scheduled_question_id: (row as { scheduled_question_id: number }).scheduled_question_id,
      corpus_question_id: (row as { corpus_question_id: number }).corpus_question_id,
      was_repeat: wasRepeat,
    };
  }

  // Race: another process inserted between our check and insert. Read it.
  const raced = await getExistingSchedule(subjectId, targetDate);
  if (!raced) throw new Error(`Schedule insert conflict but no row found for subject ${subjectId} on ${targetDate}`);
  return { ...raced, was_repeat: false };
}

// ----------------------------------------------------------------------------
// Reads
// ----------------------------------------------------------------------------

/**
 * Get the scheduled question for a subject on a given date.
 * Returns the corpus question text + metadata, or null if not scheduled.
 */
export async function getScheduledQuestion(
  subjectId: number,
  targetDate: string,
): Promise<ScheduledQuestion | null> {
  const rows = await sql`
    SELECT sq.scheduled_question_id, sq.subject_id, sq.corpus_question_id,
           sq.scheduled_for, qc.text, qc.theme_tag
    FROM tb_scheduled_questions sq
    JOIN tb_question_corpus qc ON sq.corpus_question_id = qc.corpus_question_id
    WHERE sq.subject_id = ${subjectId} AND sq.scheduled_for = ${targetDate}
  `;
  return (rows[0] as ScheduledQuestion) ?? null;
}

/**
 * Count of active corpus questions this subject has NOT been assigned.
 * Used for the per-subject exhaustion warning.
 */
export async function getUnseenCount(subjectId: number): Promise<number> {
  const [row] = await sql`
    SELECT count(*)::int AS unseen
    FROM tb_question_corpus qc
    WHERE qc.is_retired = FALSE
      AND qc.corpus_question_id NOT IN (
        SELECT DISTINCT corpus_question_id
        FROM tb_scheduled_questions
        WHERE subject_id = ${subjectId}
      )
  `;
  return (row as { unseen: number }).unseen;
}

// ----------------------------------------------------------------------------
// Internal
// ----------------------------------------------------------------------------

async function getExistingSchedule(
  subjectId: number,
  targetDate: string,
): Promise<{ scheduled_question_id: number; corpus_question_id: number } | null> {
  const rows = await sql`
    SELECT scheduled_question_id, corpus_question_id
    FROM tb_scheduled_questions
    WHERE subject_id = ${subjectId} AND scheduled_for = ${targetDate}
  `;
  return (rows[0] as { scheduled_question_id: number; corpus_question_id: number }) ?? null;
}
