/**
 * Just-in-time question flow.
 *
 * One shared corpus, advanced on answer. Every active subject (owner included)
 * draws from `tb_question_corpus` in `corpus_question_id` order, skipping
 * questions they've already been served. Today's question is created the
 * moment the subject loads `/today` or `/subject/today`. No cron. No
 * pre-planted queue.
 *
 * The "one per day" rule is enforced at the data layer by the UNIQUE constraint
 * `(subject_id, scheduled_for)`: a subject's local-TZ date can only hold one
 * `tb_questions` row. Once that row has a response, this function returns it
 * unchanged with the existing response text, which the UI treats as the
 * locked-until-tomorrow state. At the subject's local midnight the date flips,
 * a fresh row gets created on the next page load, and the cycle continues.
 *
 * Corpus exhaustion: when a subject has been served every active corpus row,
 * fall back to the row with the oldest assignment date. This produces repeats
 * (by design) rather than a locked-out state. Operator can grow the corpus
 * via `npm run corpus:refresh` to keep this from biting.
 */

import sql from './libDbPool.ts';
import {
  getSubjectTimezone,
  getSubjectScheduledQuestion,
  scheduleSubjectCorpusQuestion,
  getResponseText,
} from './libDb.ts';
import { localDateStr } from './utlDate.ts';

export interface TodayQuestion {
  questionId: number;
  text: string;
  themeTag: string | null;
  scheduledFor: string;
  existingResponseText: string | null;
}

/**
 * Returns today's question for the subject, creating it from the next unseen
 * corpus row if none exists yet. If the subject already answered today (in
 * their own timezone), the returned object's `existingResponseText` is non-null
 * and the UI renders the locked state.
 *
 * Throws only if `tb_question_corpus` has no active rows.
 */
export async function getOrCreateTodayQuestion(subjectId: number): Promise<TodayQuestion> {
  const tz = await getSubjectTimezone(subjectId);
  const today = localDateStr(new Date(), tz);

  const existing = await getSubjectScheduledQuestion(subjectId, today);
  if (existing) {
    const existingResponseText = await getResponseText(subjectId, existing.question_id);
    return {
      questionId: existing.question_id,
      text: existing.text,
      themeTag: existing.theme_tag,
      scheduledFor: existing.scheduled_for,
      existingResponseText,
    };
  }

  // Pick the lowest corpus_question_id this subject has never been served.
  // "Served" = any tb_questions row, answered or not. The UNIQUE constraint
  // on (subject_id, scheduled_for) means a row's existence is enough to mark
  // the corpus question as consumed for this subject's history.
  const unseenRows = await sql`
    SELECT c.corpus_question_id
    FROM tb_question_corpus c
    WHERE c.is_retired = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM tb_questions q
        WHERE q.subject_id = ${subjectId}
          AND q.corpus_question_id = c.corpus_question_id
      )
    ORDER BY c.corpus_question_id ASC
    LIMIT 1
  ` as Array<{ corpus_question_id: number }>;

  let pickedCorpusId: number | undefined = unseenRows[0]?.corpus_question_id;

  if (pickedCorpusId === undefined) {
    // Exhausted: every active corpus row has been served at least once.
    // Pick the one served longest ago. Ties broken by lowest id for
    // determinism.
    const fallbackRows = await sql`
      SELECT c.corpus_question_id,
             COALESCE(MAX(q.scheduled_for), '1970-01-01'::date) AS last_seen
      FROM tb_question_corpus c
      LEFT JOIN tb_questions q
        ON q.corpus_question_id = c.corpus_question_id
       AND q.subject_id = ${subjectId}
      WHERE c.is_retired = FALSE
      GROUP BY c.corpus_question_id
      ORDER BY last_seen ASC, c.corpus_question_id ASC
      LIMIT 1
    ` as Array<{ corpus_question_id: number; last_seen: string }>;

    if (fallbackRows.length === 0) {
      throw new Error('getOrCreateTodayQuestion: tb_question_corpus has no active rows');
    }
    pickedCorpusId = fallbackRows[0]!.corpus_question_id;
  }

  // Insert today's row. Idempotent on (subject_id, scheduled_for) so two
  // concurrent loads (e.g. double-clicking refresh) cannot create two rows.
  await scheduleSubjectCorpusQuestion(subjectId, pickedCorpusId, today);

  // Read it back through the same path the idempotent branch would have used.
  // Guarantees a single source of truth for the returned shape.
  const planted = await getSubjectScheduledQuestion(subjectId, today);
  if (!planted) {
    throw new Error(`getOrCreateTodayQuestion: planted row for subject ${subjectId} on ${today} not readable`);
  }
  return {
    questionId: planted.question_id,
    text: planted.text,
    themeTag: planted.theme_tag,
    scheduledFor: planted.scheduled_for,
    existingResponseText: null,
  };
}
