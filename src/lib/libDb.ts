import sql from './libDbPool.ts';
import type { TxSql } from './libDbPool.ts';
import { localDateStr } from './utlDate.ts';
import { encrypt, decrypt } from './libCrypto.ts';

// Re-export sql for callers that import it directly
export { default as sql } from './libDbPool.ts';
export type { TxSql } from './libDbPool.ts';

// ----------------------------------------------------------------------------
// AT-REST ENCRYPTION (migration 031)
// ----------------------------------------------------------------------------
// Every subject-bearing text/JSONB column listed in the encrypted-columns
// inventory is stored as a (`<col>_ciphertext`, `<col>_nonce`) pair instead of
// raw plaintext. Read helpers below return plaintext; writes accept plaintext.
// The encryption boundary lives here in libDb — application code above this
// module never sees ciphertext. Direct SELECTs against encrypted columns are
// forbidden; the `subject-scope` lint already enforces that all queries reach
// this module's helpers via the lint exemption pattern.
//
// `encryptString` / `decryptString` operate on a (string | null) value pair.
// JSONB content is JSON.stringified before encryption and JSON.parsed after
// decryption by callers that need the parsed shape.
function encryptString(plaintext: string | null): { ciphertext: string | null; nonce: string | null } {
  if (plaintext == null) return { ciphertext: null, nonce: null };
  const enc = encrypt(plaintext);
  return { ciphertext: enc.ciphertext, nonce: enc.nonce };
}

function decryptString(ciphertext: string | null | undefined, nonce: string | null | undefined): string | null {
  if (ciphertext == null || nonce == null) return null;
  return decrypt(ciphertext, nonce);
}

// ----------------------------------------------------------------------------
// OWNER_SUBJECT_ID — temporary scaffolding for the unification rollout
// ----------------------------------------------------------------------------
// Every behavioral table now carries a NOT NULL `subject_id` (migration 030).
// Public functions in this file accept `subjectId` as an explicit parameter so
// that the dependency is visible at every call site — no implicit owner.
//
// During Step 5 of the unification plan, callers without a real subject
// context will pass `OWNER_SUBJECT_ID` explicitly. Each such call site is
// reviewed individually to determine whether it should pull a real subjectId
// from request context (e.g. `locals.subject!.subject_id`) or stay
// owner-pinned (e.g. owner-only background scripts, owner-public health
// endpoints). Sites that genuinely belong owner-pinned keep the constant;
// sites that should be subject-aware are rewritten.
//
// All current uses of OWNER_SUBJECT_ID across the codebase MUST carry a
// // TODO(step5): review comment so the Step 5 sweep can grep for them.
//
// This constant is intentionally NOT a function default — defaults bury the
// dependency. The point of explicit passing is to make every subject scope
// decision visible during review.
export const OWNER_SUBJECT_ID = 1;

// ----------------------------------------------------------------------------
// DATE OVERRIDE (for simulation -- production never calls this)
// ----------------------------------------------------------------------------
// When set, save functions use this instead of CURRENT_TIMESTAMP.
// This fixes the wall-clock timestamp bug where PG's CURRENT_TIMESTAMP
// ignores JavaScript's monkey-patched Date during simulation.
let _dateOverride: string | null = null;

/** Set a date override for all save functions. Pass null to clear. */
export function setDateOverride(dateStr: string | null): void {
  _dateOverride = dateStr;
}

/** Get the current datetime string -- override if set, otherwise ISO now. */
function nowStr(): string {
  return _dateOverride ? `${_dateOverride}T12:00:00` : new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ----------------------------------------------------------------------------
// Schema is applied externally via scripts/create-postgres-schema.sql.
// No DDL or migration blocks here.
// ----------------------------------------------------------------------------

// @region queries -- getTodaysQuestion, getTodaysResponse, saveResponse, scheduleQuestion, scheduleSubjectCorpusQuestion, getSubjectScheduledQuestion, getSubjectCorpusHistory, getSubjectUnseenCorpusCount, getAllResponses, getLatestReflection, saveReflection, logInteractionEvent, hasQuestionForDate, countScheduledSeedQuestions
// ----------------------------------------------------------------------------
// QUERIES
// ----------------------------------------------------------------------------

export async function getTodaysQuestion(subjectId: number): Promise<{ question_id: number; text: string } | null> {
  const today = localDateStr();
  const rows = await sql`
    SELECT question_id, text_ciphertext, text_nonce
    FROM tb_questions
    WHERE subject_id = ${subjectId} AND scheduled_for = ${today}
  `;
  const row = rows[0] as { question_id: number; text_ciphertext: string; text_nonce: string } | undefined;
  if (!row) return null;
  return { question_id: row.question_id, text: decrypt(row.text_ciphertext, row.text_nonce) };
}

export async function getTodaysResponse(subjectId: number): Promise<{ response_id: number; text: string } | null> {
  const today = localDateStr();
  const rows = await sql`
    SELECT r.response_id, r.text_ciphertext, r.text_nonce
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.subject_id = ${subjectId} AND q.scheduled_for = ${today}
  `;
  const row = rows[0] as { response_id: number; text_ciphertext: string; text_nonce: string } | undefined;
  if (!row) return null;
  return { response_id: row.response_id, text: decrypt(row.text_ciphertext, row.text_nonce) };
}

export async function saveResponse(
  subjectId: number,
  questionId: number,
  text: string,
  tx?: TxSql,
  attestation?: { boundaryVersion: string; codePathsRef: string; commitHash: string },
): Promise<number> {
  const q = tx ?? sql;
  const bv = attestation?.boundaryVersion ?? 'v1';
  const ref = attestation?.codePathsRef ?? 'docs/contamination-boundary-v1.md';
  const hash = attestation?.commitHash ?? 'pre-attestation';
  const enc = encryptString(text);
  const [row] = await q`
    INSERT INTO tb_responses (subject_id, question_id, text_ciphertext, text_nonce, contamination_boundary_version, audited_code_paths_ref, code_commit_hash, dttm_created_utc)
    VALUES (${subjectId}, ${questionId}, ${enc.ciphertext}, ${enc.nonce}, ${bv}, ${ref}, ${hash}, ${nowStr()})
    RETURNING response_id
  `;
  return row.response_id;
}

export async function scheduleQuestion(subjectId: number, text: string, date: string, source: 'seed' | 'generated' | 'calibration' = 'seed'): Promise<void> {
  const sourceId = source === 'generated' ? 2 : source === 'calibration' ? 3 : 1;
  const enc = encryptString(text);
  // CONFLICT TARGET CHANGED (migration 030): (scheduled_for) → (subject_id, scheduled_for)
  await sql`
    INSERT INTO tb_questions (subject_id, text_ciphertext, text_nonce, question_source_id, scheduled_for)
    VALUES (${subjectId}, ${enc.ciphertext}, ${enc.nonce}, ${sourceId}, ${date})
    ON CONFLICT (subject_id, scheduled_for) DO NOTHING
  `;
}

/**
 * Schedule a corpus-drawn question for a subject on a given date (migration 032).
 *
 * Inserts a row into tb_questions with question_source_id = 4 ('corpus') and
 * the corpus_question_id pointing back to tb_question_corpus. The text is read
 * from the corpus row, encrypted with libCrypto, and stored on the question
 * row alongside every other tb_questions row (uniform encryption boundary).
 *
 * Idempotent on (subject_id, scheduled_for): if the subject already has a
 * question for that date, returns its existing question_id without re-inserting.
 * The scheduler relies on this for the race-window read-after-conflict pattern.
 *
 * Returns the question_id (existing or newly inserted).
 */
export async function scheduleSubjectCorpusQuestion(
  subjectId: number,
  corpusQuestionId: number,
  scheduledFor: string,
  tx?: TxSql,
): Promise<{ question_id: number; corpus_question_id: number; was_inserted: boolean }> {
  const q = tx ?? sql;

  const corpusRows = await q`
    SELECT text FROM tb_question_corpus WHERE corpus_question_id = ${corpusQuestionId}
  ` as Array<{ text: string }>;
  const corpusRow = corpusRows[0];
  if (!corpusRow) {
    throw new Error(`scheduleSubjectCorpusQuestion: corpus_question_id ${corpusQuestionId} not found`);
  }

  const enc = encryptString(corpusRow.text);

  const inserted = await q`
    INSERT INTO tb_questions (
       subject_id, text_ciphertext, text_nonce,
       question_source_id, scheduled_for, corpus_question_id
    )
    VALUES (
      ${subjectId}, ${enc.ciphertext}, ${enc.nonce},
      4, ${scheduledFor}, ${corpusQuestionId}
    )
    ON CONFLICT (subject_id, scheduled_for) DO NOTHING
    RETURNING question_id
  ` as Array<{ question_id: number }>;

  if (inserted.length > 0) {
    return {
      question_id: inserted[0]!.question_id,
      corpus_question_id: corpusQuestionId,
      was_inserted: true,
    };
  }

  // Race: another process inserted between our check and insert. Read the
  // existing row.
  const existing = await q`
    SELECT question_id, corpus_question_id
    FROM tb_questions
    WHERE subject_id = ${subjectId} AND scheduled_for = ${scheduledFor}
  ` as Array<{ question_id: number; corpus_question_id: number | null }>;
  const row = existing[0];
  if (!row) {
    throw new Error(
      `scheduleSubjectCorpusQuestion: insert conflict but no existing row for subject ${subjectId} on ${scheduledFor}`,
    );
  }
  if (row.corpus_question_id == null) {
    throw new Error(
      `scheduleSubjectCorpusQuestion: subject ${subjectId} already has a non-corpus question for ${scheduledFor}`,
    );
  }
  return {
    question_id: row.question_id,
    corpus_question_id: row.corpus_question_id,
    was_inserted: false,
  };
}

/**
 * Get the corpus-drawn scheduled question for a subject on a given date.
 * Returns the question text (decrypted) plus the corpus theme tag, or null.
 *
 * Queries unified tb_questions; joins tb_question_corpus only for theme_tag
 * (which is corpus metadata, not stored on tb_questions). Question text is
 * decrypted from the per-row ciphertext column on tb_questions itself, so
 * the corpus row's plaintext is never exposed beyond the JOIN result for
 * theme_tag.
 */
export async function getSubjectScheduledQuestion(
  subjectId: number,
  scheduledFor: string,
): Promise<{ question_id: number; corpus_question_id: number; text: string; theme_tag: string | null; scheduled_for: string } | null> {
  const rows = await sql`
    SELECT q.question_id, q.corpus_question_id,
           q.text_ciphertext AS "qCt", q.text_nonce AS "qNonce",
           q.scheduled_for, qc.theme_tag
    FROM tb_questions q
    JOIN tb_question_corpus qc ON q.corpus_question_id = qc.corpus_question_id
    WHERE q.subject_id = ${subjectId}
      AND q.scheduled_for = ${scheduledFor}
      AND q.question_source_id = 4
  ` as Array<{
    question_id: number;
    corpus_question_id: number;
    qCt: string;
    qNonce: string;
    scheduled_for: string;
    theme_tag: string | null;
  }>;
  const row = rows[0];
  if (!row) return null;
  return {
    question_id: row.question_id,
    corpus_question_id: row.corpus_question_id,
    text: decrypt(row.qCt, row.qNonce),
    theme_tag: row.theme_tag,
    scheduled_for: row.scheduled_for,
  };
}

/**
 * Subject's full corpus-draw assignment history, chronological. Used by the
 * round-robin scheduler to compute the no-repeat window and to fall back to
 * "oldest last-seen" once the corpus is exhausted.
 *
 * Only returns rows where corpus_question_id IS NOT NULL (subject corpus
 * draws). Owner journal questions and calibration prompts are excluded.
 */
export async function getSubjectCorpusHistory(
  subjectId: number,
): Promise<Array<{ corpus_question_id: number; scheduled_for: string }>> {
  const rows = await sql`
    SELECT corpus_question_id, scheduled_for
    FROM tb_questions
    WHERE subject_id = ${subjectId}
      AND corpus_question_id IS NOT NULL
    ORDER BY scheduled_for ASC
  ` as Array<{ corpus_question_id: number; scheduled_for: string }>;
  return rows;
}

/**
 * Count of active corpus questions this subject has NOT been assigned.
 * Used for the per-subject exhaustion warning.
 */
export async function getSubjectUnseenCorpusCount(subjectId: number): Promise<number> {
  const [row] = await sql`
    SELECT count(*)::int AS unseen
    FROM tb_question_corpus qc
    WHERE qc.is_retired = FALSE
      AND qc.corpus_question_id NOT IN (
        SELECT DISTINCT corpus_question_id
        FROM tb_questions
        WHERE subject_id = ${subjectId}
          AND corpus_question_id IS NOT NULL
      )
  `;
  return (row as { unseen: number }).unseen;
}

export async function getAllResponses(subjectId: number): Promise<Array<{ question: string; response: string; date: string }>> {
  const rows = await sql`
    SELECT q.text_ciphertext AS "qCt", q.text_nonce AS "qNonce",
           r.text_ciphertext AS "rCt", r.text_nonce AS "rNonce",
           q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
    ORDER BY q.scheduled_for ASC
  ` as Array<{ qCt: string; qNonce: string; rCt: string; rNonce: string; date: string }>;
  return rows.map(r => ({
    question: decrypt(r.qCt, r.qNonce),
    response: decrypt(r.rCt, r.rNonce),
    date: r.date,
  }));
}

export async function getLatestReflection(subjectId: number): Promise<{ text: string; dttm_created_utc: string } | null> {
  const rows = await sql`
    SELECT text_ciphertext, text_nonce, dttm_created_utc FROM tb_reflections
    WHERE subject_id = ${subjectId}
    ORDER BY dttm_created_utc DESC LIMIT 1
  `;
  const row = rows[0] as { text_ciphertext: string; text_nonce: string; dttm_created_utc: string } | undefined;
  if (!row) return null;
  return { text: decrypt(row.text_ciphertext, row.text_nonce), dttm_created_utc: row.dttm_created_utc };
}

export async function saveReflection(subjectId: number, text: string, type: 'weekly' | 'monthly' = 'weekly', coverageThroughResponseId?: number): Promise<number> {
  const typeId = type === 'monthly' ? 2 : 1;
  const enc = encryptString(text);
  const [row] = await sql`
    INSERT INTO tb_reflections (subject_id, text_ciphertext, text_nonce, reflection_type_id, coverage_through_response_id, dttm_created_utc)
    VALUES (${subjectId}, ${enc.ciphertext}, ${enc.nonce}, ${typeId}, ${coverageThroughResponseId ?? null}, ${nowStr()})
    RETURNING reflection_id
  `;
  return row.reflection_id;
}

export async function logInteractionEvent(subjectId: number, questionId: number, eventType: string, metadata?: string | Record<string, unknown>): Promise<void> {
  const typeRows = await sql`
    SELECT interaction_event_type_id FROM te_interaction_event_type WHERE enum_code = ${eventType}
  `;
  const typeRow = typeRows[0] as { interaction_event_type_id: number } | undefined;
  if (!typeRow) return;
  await sql`
    INSERT INTO tb_interaction_events (subject_id, question_id, interaction_event_type_id, metadata)
    VALUES (${subjectId}, ${questionId}, ${typeRow.interaction_event_type_id}, ${metadata ?? null})
  `;
}

export async function hasQuestionForDate(subjectId: number, date: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM tb_questions WHERE subject_id = ${subjectId} AND scheduled_for = ${date}`;
  return rows.length > 0;
}

export async function countScheduledSeedQuestions(subjectId: number): Promise<number> {
  const [row] = await sql`
    SELECT COUNT(*)::int AS c FROM tb_questions
    WHERE subject_id = ${subjectId} AND question_source_id = 1 AND scheduled_for IS NOT NULL
  `;
  return (row as { c: number }).c;
}

// @region encrypted-reads -- getResponseText, getQuestionTextById, getEventLogJson, getKeystrokeStreamJson, listEventLogJson, listKeystrokeStreams, listResponseTextsExcludingCalibration
// ----------------------------------------------------------------------------
// IN-SCOPE READ HELPERS (migration 031)
// ----------------------------------------------------------------------------
// These centralize the read paths for encrypted columns. Every direct SELECT
// against an encrypted column outside libDb was refactored to call one of
// these helpers — application code never sees ciphertext.

/** Single response text by (subject, question). Returns plaintext or null. */
export async function getResponseText(subjectId: number, questionId: number): Promise<string | null> {
  const rows = await sql`
    SELECT text_ciphertext, text_nonce
    FROM tb_responses
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
  `;
  const row = rows[0] as { text_ciphertext: string; text_nonce: string } | undefined;
  return row ? decrypt(row.text_ciphertext, row.text_nonce) : null;
}

/** Single question by id, scoped to subject. Returns plaintext text + source id, or null. */
export async function getQuestionTextById(subjectId: number, questionId: number): Promise<{ text: string; question_source_id: number } | null> {
  const rows = await sql`
    SELECT text_ciphertext, text_nonce, question_source_id
    FROM tb_questions
    WHERE question_id = ${questionId} AND subject_id = ${subjectId}
  `;
  const row = rows[0] as { text_ciphertext: string; text_nonce: string; question_source_id: number } | undefined;
  if (!row) return null;
  return { text: decrypt(row.text_ciphertext, row.text_nonce), question_source_id: row.question_source_id };
}

/** Decrypted event log JSON for a session. Returns the JSON string (caller JSON.parses if needed). */
export async function getEventLogJson(subjectId: number, questionId: number): Promise<string | null> {
  const rows = await sql`
    SELECT event_log_ciphertext, event_log_nonce
    FROM tb_session_events
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
  `;
  const row = rows[0] as { event_log_ciphertext: string; event_log_nonce: string } | undefined;
  return row ? decrypt(row.event_log_ciphertext, row.event_log_nonce) : null;
}

/** Decrypted keystroke stream JSON for a session. Returns JSON string or null. */
export async function getKeystrokeStreamJson(subjectId: number, questionId: number): Promise<string | null> {
  const rows = await sql`
    SELECT keystroke_stream_ciphertext, keystroke_stream_nonce
    FROM tb_session_events
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
  `;
  const row = rows[0] as { keystroke_stream_ciphertext: string | null; keystroke_stream_nonce: string | null } | undefined;
  if (!row) return null;
  return decryptString(row.keystroke_stream_ciphertext, row.keystroke_stream_nonce);
}

/** All session event logs for a subject. Used by backfill scripts that re-derive signals. */
export async function listEventLogJson(subjectId: number): Promise<Array<{ question_id: number; event_log_json: string }>> {
  const rows = await sql`
    SELECT question_id, event_log_ciphertext, event_log_nonce
    FROM tb_session_events
    WHERE subject_id = ${subjectId}
    ORDER BY question_id ASC
  ` as Array<{ question_id: number; event_log_ciphertext: string; event_log_nonce: string }>;
  return rows.map(r => ({
    question_id: r.question_id,
    event_log_json: decrypt(r.event_log_ciphertext, r.event_log_nonce),
  }));
}

export interface ListKeystrokeStreamsOptions {
  /** When true, exclude calibration sessions (question_source_id = 3). */
  excludeCalibration?: boolean;
  /** Only return rows where question_id < this value. */
  beforeQuestionId?: number;
  /** Only return rows where question_id = this value. */
  questionId?: number;
  /** Limit the number of rows returned (most recent question_id first when limit set). */
  limit?: number;
  /** Skip rows whose keystroke stream is NULL (default: true). */
  nonNullOnly?: boolean;
}

/** Keystroke streams for a subject under flexible filters. Decrypts each row. */
export async function listKeystrokeStreams(
  subjectId: number,
  options: ListKeystrokeStreamsOptions = {},
): Promise<Array<{ question_id: number; keystroke_stream_json: string }>> {
  const { excludeCalibration, beforeQuestionId, questionId, limit, nonNullOnly = true } = options;
  // Compose dynamically. Subject scope is always present; lint sees it.
  const rows = await sql`
    SELECT se.question_id,
           se.keystroke_stream_ciphertext,
           se.keystroke_stream_nonce
    FROM tb_session_events se
    JOIN tb_questions q ON se.question_id = q.question_id
    WHERE se.subject_id = ${subjectId}
      AND q.subject_id = ${subjectId}
      ${excludeCalibration ? sql`AND q.question_source_id != 3` : sql``}
      ${beforeQuestionId !== undefined ? sql`AND se.question_id < ${beforeQuestionId}` : sql``}
      ${questionId !== undefined ? sql`AND se.question_id = ${questionId}` : sql``}
      ${nonNullOnly ? sql`AND se.keystroke_stream_ciphertext IS NOT NULL` : sql``}
    ORDER BY se.question_id DESC
    ${limit !== undefined ? sql`LIMIT ${limit}` : sql``}
  ` as Array<{ question_id: number; keystroke_stream_ciphertext: string | null; keystroke_stream_nonce: string | null }>;
  return rows
    .map(r => ({
      question_id: r.question_id,
      keystroke_stream_json: decryptString(r.keystroke_stream_ciphertext, r.keystroke_stream_nonce),
    }))
    .filter((r): r is { question_id: number; keystroke_stream_json: string } => r.keystroke_stream_json != null);
}

export type ResponseTextOrder = 'response_id_desc' | 'scheduled_for_asc' | 'scheduled_for_desc';

export interface ListResponseTextsOptions {
  /** Default true: exclude calibration (question_source_id = 3). */
  excludeCalibration?: boolean;
  /** Default false: exclude rows whose tb_semantic_signals.paste_contaminated = true. */
  excludePasteContaminated?: boolean;
  /** Order: 'response_id_desc', 'scheduled_for_asc', 'scheduled_for_desc'. */
  orderBy?: ResponseTextOrder;
  /** Limit row count. */
  limit?: number;
  /** Exclude this question_id from results. */
  excludeQuestionId?: number;
}

/** Plaintext response texts for a subject under flexible filters. Returns
 *  rows scoped to the subject, with text decrypted via the libDb boundary.
 *  Calibration sessions are excluded by default; `excludeCalibration: false`
 *  includes them (e.g. avatar corpus that mixes journal + calibration). */
export async function listResponseTexts(
  subjectId: number,
  options: ListResponseTextsOptions = {},
): Promise<Array<{ response_id: number; question_id: number; text: string; date: string | null }>> {
  const {
    excludeCalibration = true,
    excludePasteContaminated = false,
    orderBy = 'scheduled_for_desc',
    limit,
    excludeQuestionId,
  } = options;
  const orderClause =
    orderBy === 'response_id_desc' ? sql`ORDER BY r.response_id DESC` :
    orderBy === 'scheduled_for_asc' ? sql`ORDER BY q.scheduled_for ASC` :
    sql`ORDER BY q.scheduled_for DESC`;
  const rows = await sql`
    SELECT r.response_id,
           r.question_id,
           r.text_ciphertext,
           r.text_nonce,
           q.scheduled_for::text AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
      ${excludeCalibration ? sql`AND q.question_source_id != 3` : sql``}
      ${excludeQuestionId !== undefined ? sql`AND r.question_id != ${excludeQuestionId}` : sql``}
      ${excludePasteContaminated ? sql`
        AND NOT EXISTS (
          SELECT 1 FROM tb_semantic_signals sem
          WHERE sem.subject_id = ${subjectId}
            AND sem.question_id = r.question_id
            AND sem.paste_contaminated = true
        )` : sql``}
    ${orderClause}
    ${limit !== undefined ? sql`LIMIT ${limit}` : sql``}
  ` as Array<{ response_id: number; question_id: number; text_ciphertext: string; text_nonce: string; date: string | null }>;
  return rows.map(r => ({
    response_id: r.response_id,
    question_id: r.question_id,
    text: decrypt(r.text_ciphertext, r.text_nonce),
    date: r.date,
  }));
}

/** Backwards-compatible alias used by callers wanting the default (exclude
 *  calibration) behavior. New code should call `listResponseTexts` directly. */
export const listResponseTextsExcludingCalibration = listResponseTexts;

// @region sessions -- SessionSummaryInput, saveSessionSummary, getSessionSummary, getAllSessionSummaries, getSessionSummariesForQuestions, saveSessionEvents, getSessionEvents, updateDeletionEvents, saveSessionMetadata, getSessionMetadata, getAllSessionMetadata, getMetadataQuestionIdsAlreadyComputed
// ----------------------------------------------------------------------------
// SESSION SUMMARIES
// ----------------------------------------------------------------------------

export interface SessionSummaryInput {
  subjectId: number;
  questionId: number;
  firstKeystrokeMs: number | null;
  totalDurationMs: number | null;
  totalCharsTyped: number;
  finalCharCount: number;
  commitmentRatio: number | null;
  pauseCount: number;
  totalPauseMs: number;
  deletionCount: number;
  largestDeletion: number;
  totalCharsDeleted: number;
  tabAwayCount: number;
  totalTabAwayMs: number;
  wordCount: number;
  sentenceCount: number;
  // Enriched: deletion decomposition
  smallDeletionCount: number | null;
  largeDeletionCount: number | null;
  largeDeletionChars: number | null;
  firstHalfDeletionChars: number | null;
  secondHalfDeletionChars: number | null;
  // Enriched: production fluency
  activeTypingMs: number | null;
  charsPerMinute: number | null;
  pBurstCount: number | null;
  avgPBurstLength: number | null;
  // Linguistic: NRC emotion densities + Pennebaker categories
  nrcAngerDensity: number | null;
  nrcFearDensity: number | null;
  nrcJoyDensity: number | null;
  nrcSadnessDensity: number | null;
  nrcTrustDensity: number | null;
  nrcAnticipationDensity: number | null;
  cognitiveDensity: number | null;
  hedgingDensity: number | null;
  firstPersonDensity: number | null;
  // Keystroke dynamics (Epp et al. 2011; Leijten & Van Waes 2013)
  interKeyIntervalMean: number | null;
  interKeyIntervalStd: number | null;
  revisionChainCount: number | null;
  revisionChainAvgLength: number | null;
  // Hold time + flight time decomposition (Kim et al. 2024)
  holdTimeMean: number | null;
  holdTimeStd: number | null;
  flightTimeMean: number | null;
  flightTimeStd: number | null;
  // Keystroke entropy (Ajilore et al. 2025, BiAffect)
  keystrokeEntropy: number | null;
  // Lexical diversity (McCarthy & Jarvis 2010)
  mattr: number | null;
  // Sentence metrics
  avgSentenceLength: number | null;
  sentenceLengthVariance: number | null;
  // Session metadata (Czerwinski et al. 2004)
  scrollBackCount: number | null;
  questionRereadCount: number | null;
  // Cursor behavior + writing process (Phase 1 expansion)
  confirmationLatencyMs: number | null;
  pasteCount: number | null;
  pasteCharsTotal: number | null;
  dropCount: number | null;
  readBackCount: number | null;
  leadingEdgeRatio: number | null;
  contextualRevisionCount: number | null;
  preContextualRevisionCount: number | null;
  consideredAndKeptCount: number | null;
  holdTimeMeanLeft: number | null;
  holdTimeMeanRight: number | null;
  holdTimeStdLeft: number | null;
  holdTimeStdRight: number | null;
  holdTimeCV: number | null;
  negativeFlightTimeCount: number | null;
  ikiSkewness: number | null;
  ikiKurtosis: number | null;
  errorDetectionLatencyMean: number | null;
  terminalVelocity: number | null;
  // Mouse/cursor trajectory (BioCatch, Phase 2 expansion)
  cursorDistanceDuringPauses: number | null;
  cursorFidgetRatio: number | null;
  cursorStillnessDuringPauses: number | null;
  driftToSubmitCount: number | null;
  cursorPauseSampleCount: number | null;
  // Precorrection/postcorrection latency (Springer 2021)
  deletionExecutionSpeedMean: number | null;
  postcorrectionLatencyMean: number | null;
  // Revision distance (ScriptLog)
  meanRevisionDistance: number | null;
  maxRevisionDistance: number | null;
  // Punctuation key latency (Plank 2016)
  punctuationFlightMean: number | null;
  punctuationLetterRatio: number | null;
  // Context
  deviceType: string | null;
  userAgent: string | null;
  hourOfDay: number | null;
  dayOfWeek: number | null;
}

export async function saveSessionSummary(s: SessionSummaryInput, tx?: TxSql): Promise<void> {
  const q = tx ?? sql;
  await q`
    INSERT INTO tb_session_summaries (
       subject_id, question_id, first_keystroke_ms, total_duration_ms,
       total_chars_typed, final_char_count, commitment_ratio,
       pause_count, total_pause_ms, deletion_count, largest_deletion,
       total_chars_deleted, tab_away_count, total_tab_away_ms,
       word_count, sentence_count,
       small_deletion_count, large_deletion_count, large_deletion_chars,
       first_half_deletion_chars, second_half_deletion_chars,
       active_typing_ms, chars_per_minute, p_burst_count, avg_p_burst_length,
       nrc_anger_density, nrc_fear_density, nrc_joy_density,
       nrc_sadness_density, nrc_trust_density, nrc_anticipation_density,
       cognitive_density, hedging_density, first_person_density,
       inter_key_interval_mean, inter_key_interval_std,
       revision_chain_count, revision_chain_avg_length,
       hold_time_mean, hold_time_std, flight_time_mean, flight_time_std,
       keystroke_entropy,
       mattr, avg_sentence_length, sentence_length_variance,
       scroll_back_count, question_reread_count,
       confirmation_latency_ms, paste_count, paste_chars_total, drop_count,
       read_back_count, leading_edge_ratio,
       contextual_revision_count, pre_contextual_revision_count,
       considered_and_kept_count,
       hold_time_mean_left, hold_time_mean_right,
       hold_time_std_left, hold_time_std_right, hold_time_cv,
       negative_flight_time_count,
       iki_skewness, iki_kurtosis,
       error_detection_latency_mean, terminal_velocity,
       cursor_distance_during_pauses, cursor_fidget_ratio,
       cursor_stillness_during_pauses, drift_to_submit_count,
       cursor_pause_sample_count,
       deletion_execution_speed_mean, postcorrection_latency_mean,
       mean_revision_distance, max_revision_distance,
       punctuation_flight_mean, punctuation_letter_ratio,
       device_type, user_agent, hour_of_day, day_of_week
    ) VALUES (
      ${s.subjectId}, ${s.questionId}, ${s.firstKeystrokeMs}, ${s.totalDurationMs},
      ${s.totalCharsTyped}, ${s.finalCharCount}, ${s.commitmentRatio},
      ${s.pauseCount}, ${s.totalPauseMs}, ${s.deletionCount}, ${s.largestDeletion},
      ${s.totalCharsDeleted}, ${s.tabAwayCount}, ${s.totalTabAwayMs},
      ${s.wordCount}, ${s.sentenceCount},
      ${s.smallDeletionCount}, ${s.largeDeletionCount}, ${s.largeDeletionChars},
      ${s.firstHalfDeletionChars}, ${s.secondHalfDeletionChars},
      ${s.activeTypingMs}, ${s.charsPerMinute}, ${s.pBurstCount}, ${s.avgPBurstLength},
      ${s.nrcAngerDensity}, ${s.nrcFearDensity}, ${s.nrcJoyDensity},
      ${s.nrcSadnessDensity}, ${s.nrcTrustDensity}, ${s.nrcAnticipationDensity},
      ${s.cognitiveDensity}, ${s.hedgingDensity}, ${s.firstPersonDensity},
      ${s.interKeyIntervalMean}, ${s.interKeyIntervalStd},
      ${s.revisionChainCount}, ${s.revisionChainAvgLength},
      ${s.holdTimeMean}, ${s.holdTimeStd}, ${s.flightTimeMean}, ${s.flightTimeStd},
      ${s.keystrokeEntropy},
      ${s.mattr}, ${s.avgSentenceLength}, ${s.sentenceLengthVariance},
      ${s.scrollBackCount}, ${s.questionRereadCount},
      ${s.confirmationLatencyMs}, ${s.pasteCount}, ${s.pasteCharsTotal}, ${s.dropCount},
      ${s.readBackCount}, ${s.leadingEdgeRatio},
      ${s.contextualRevisionCount}, ${s.preContextualRevisionCount},
      ${s.consideredAndKeptCount},
      ${s.holdTimeMeanLeft}, ${s.holdTimeMeanRight},
      ${s.holdTimeStdLeft}, ${s.holdTimeStdRight}, ${s.holdTimeCV},
      ${s.negativeFlightTimeCount},
      ${s.ikiSkewness}, ${s.ikiKurtosis},
      ${s.errorDetectionLatencyMean}, ${s.terminalVelocity},
      ${s.cursorDistanceDuringPauses}, ${s.cursorFidgetRatio},
      ${s.cursorStillnessDuringPauses}, ${s.driftToSubmitCount},
      ${s.cursorPauseSampleCount},
      ${s.deletionExecutionSpeedMean}, ${s.postcorrectionLatencyMean},
      ${s.meanRevisionDistance}, ${s.maxRevisionDistance},
      ${s.punctuationFlightMean}, ${s.punctuationLetterRatio},
      ${s.deviceType}, ${s.userAgent}, ${s.hourOfDay}, ${s.dayOfWeek}
    )
    ON CONFLICT (question_id) DO NOTHING
  `;
}

// @region bursts -- saveBurstSequence, getBurstSequence, saveRburstSequence, getRburstSequence
// ----------------------------------------------------------------------------
// BURST SEQUENCES
// ----------------------------------------------------------------------------

export interface BurstEntry {
  chars: number;
  startOffsetMs: number;
  durationMs: number;
}

export async function saveBurstSequence(subjectId: number, questionId: number, bursts: BurstEntry[], tx?: TxSql): Promise<void> {
  if (tx) {
    for (let i = 0; i < bursts.length; i++) {
      await tx`
        INSERT INTO tb_burst_sequences (subject_id, question_id, burst_index, burst_char_count, burst_duration_ms, burst_start_offset_ms)
        VALUES (${subjectId}, ${questionId}, ${i}, ${bursts[i].chars}, ${bursts[i].durationMs}, ${bursts[i].startOffsetMs})
      `;
    }
  } else {
    await sql.begin(async (sql) => {
      for (let i = 0; i < bursts.length; i++) {
        await sql`
          INSERT INTO tb_burst_sequences (subject_id, question_id, burst_index, burst_char_count, burst_duration_ms, burst_start_offset_ms)
          VALUES (${subjectId}, ${questionId}, ${i}, ${bursts[i].chars}, ${bursts[i].durationMs}, ${bursts[i].startOffsetMs})
        `;
      }
    });
  }
}

export async function getBurstSequence(subjectId: number, questionId: number, tx?: TxSql): Promise<Array<BurstEntry & { burstIndex: number }>> {
  const q = tx ?? sql;
  return await q`
    SELECT burst_index AS "burstIndex", burst_char_count AS chars,
           burst_duration_ms AS "durationMs", burst_start_offset_ms AS "startOffsetMs"
    FROM tb_burst_sequences
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
    ORDER BY burst_index ASC
  ` as Array<BurstEntry & { burstIndex: number }>;
}

// ----------------------------------------------------------------------------
// R-BURST SEQUENCES (parallel to P-burst sequences)
// ----------------------------------------------------------------------------

export interface RBurstEntry {
  deletedCharCount: number;
  totalCharCount: number;
  durationMs: number;
  startOffsetMs: number;
  isLeadingEdge: boolean;
}

export async function saveRburstSequence(subjectId: number, questionId: number, rbursts: RBurstEntry[], tx?: TxSql): Promise<void> {
  if (rbursts.length === 0) return;
  if (tx) {
    for (let i = 0; i < rbursts.length; i++) {
      await tx`
        INSERT INTO tb_rburst_sequences (subject_id, question_id, burst_index, deleted_char_count, total_char_count, burst_duration_ms, burst_start_offset_ms, is_leading_edge)
        VALUES (${subjectId}, ${questionId}, ${i}, ${rbursts[i].deletedCharCount}, ${rbursts[i].totalCharCount}, ${rbursts[i].durationMs}, ${rbursts[i].startOffsetMs}, ${rbursts[i].isLeadingEdge})
      `;
    }
  } else {
    await sql.begin(async (sql) => {
      for (let i = 0; i < rbursts.length; i++) {
        await sql`
          INSERT INTO tb_rburst_sequences (subject_id, question_id, burst_index, deleted_char_count, total_char_count, burst_duration_ms, burst_start_offset_ms, is_leading_edge)
          VALUES (${subjectId}, ${questionId}, ${i}, ${rbursts[i].deletedCharCount}, ${rbursts[i].totalCharCount}, ${rbursts[i].durationMs}, ${rbursts[i].startOffsetMs}, ${rbursts[i].isLeadingEdge})
        `;
      }
    });
  }
}

export async function getRburstSequence(subjectId: number, questionId: number, tx?: TxSql): Promise<Array<RBurstEntry & { burstIndex: number }>> {
  const q = tx ?? sql;
  return await q`
    SELECT burst_index AS "burstIndex",
           deleted_char_count AS "deletedCharCount",
           total_char_count AS "totalCharCount",
           burst_duration_ms AS "durationMs",
           burst_start_offset_ms AS "startOffsetMs",
           is_leading_edge AS "isLeadingEdge"
    FROM tb_rburst_sequences
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
    ORDER BY burst_index ASC
  ` as Array<RBurstEntry & { burstIndex: number }>;
}

// ----------------------------------------------------------------------------
// SESSION METADATA (slice-3 follow-up signals)
// ----------------------------------------------------------------------------

export interface SessionMetadataRow {
  session_metadata_id: number;
  subject_id: number;
  question_id: number;
  hour_typicality: number | null;
  deletion_curve_type: string | null;
  burst_trajectory_shape: string | null;
  rburst_trajectory_shape: string | null;
  inter_burst_interval_mean_ms: number | null;
  inter_burst_interval_std_ms: number | null;
  deletion_during_burst_count: number | null;
  deletion_between_burst_count: number | null;
}

export async function saveSessionMetadata(row: Omit<SessionMetadataRow, 'session_metadata_id'>, tx?: TxSql): Promise<number> {
  const q = tx ?? sql;
  const [result] = await q`
    INSERT INTO tb_session_metadata (
       subject_id, question_id, hour_typicality, deletion_curve_type, burst_trajectory_shape,
       rburst_trajectory_shape,
       inter_burst_interval_mean_ms, inter_burst_interval_std_ms,
       deletion_during_burst_count, deletion_between_burst_count
    ) VALUES (
      ${row.subject_id}, ${row.question_id}, ${row.hour_typicality}, ${row.deletion_curve_type}, ${row.burst_trajectory_shape},
      ${row.rburst_trajectory_shape},
      ${row.inter_burst_interval_mean_ms}, ${row.inter_burst_interval_std_ms},
      ${row.deletion_during_burst_count}, ${row.deletion_between_burst_count}
    )
    RETURNING session_metadata_id
  `;
  return result.session_metadata_id;
}

export async function getSessionMetadata(subjectId: number, questionId: number): Promise<SessionMetadataRow | null> {
  const rows = await sql`
    SELECT * FROM tb_session_metadata WHERE subject_id = ${subjectId} AND question_id = ${questionId} ORDER BY session_metadata_id DESC LIMIT 1
  `;
  return (rows[0] as SessionMetadataRow) ?? null;
}

export async function getAllSessionMetadata(subjectId: number): Promise<SessionMetadataRow[]> {
  return await sql`
    SELECT * FROM tb_session_metadata WHERE subject_id = ${subjectId} ORDER BY session_metadata_id ASC
  ` as SessionMetadataRow[];
}

export async function getMetadataQuestionIdsAlreadyComputed(subjectId: number): Promise<Set<number>> {
  const rows = await sql`SELECT DISTINCT question_id FROM tb_session_metadata WHERE subject_id = ${subjectId}` as Array<{ question_id: number }>;
  return new Set(rows.map(r => r.question_id));
}

// ----------------------------------------------------------------------------
// CALIBRATION BASELINES HISTORY (drift substrate)
// ----------------------------------------------------------------------------

export interface CalibrationHistoryRow {
  calibration_history_id: number;
  subject_id: number;
  calibration_session_count: number;
  device_type: string | null;
  avg_first_keystroke_ms: number | null;
  avg_commitment_ratio: number | null;
  avg_duration_ms: number | null;
  avg_pause_count: number | null;
  avg_deletion_count: number | null;
  avg_chars_per_minute: number | null;
  avg_p_burst_length: number | null;
  avg_small_deletion_count: number | null;
  avg_large_deletion_count: number | null;
  avg_iki_mean: number | null;
  avg_hold_time_mean: number | null;
  avg_flight_time_mean: number | null;
  drift_magnitude: number | null;
}

export async function saveCalibrationBaselineSnapshot(row: Omit<CalibrationHistoryRow, 'calibration_history_id'>): Promise<number> {
  const [result] = await sql`
    INSERT INTO tb_calibration_baselines_history (
       subject_id, calibration_session_count, device_type,
       avg_first_keystroke_ms, avg_commitment_ratio, avg_duration_ms,
       avg_pause_count, avg_deletion_count, avg_chars_per_minute,
       avg_p_burst_length, avg_small_deletion_count, avg_large_deletion_count,
       avg_iki_mean, avg_hold_time_mean, avg_flight_time_mean,
       drift_magnitude
    ) VALUES (
      ${row.subject_id}, ${row.calibration_session_count}, ${row.device_type},
      ${row.avg_first_keystroke_ms}, ${row.avg_commitment_ratio}, ${row.avg_duration_ms},
      ${row.avg_pause_count}, ${row.avg_deletion_count}, ${row.avg_chars_per_minute},
      ${row.avg_p_burst_length}, ${row.avg_small_deletion_count}, ${row.avg_large_deletion_count},
      ${row.avg_iki_mean}, ${row.avg_hold_time_mean}, ${row.avg_flight_time_mean},
      ${row.drift_magnitude}
    )
    RETURNING calibration_history_id
  `;
  return result.calibration_history_id;
}

export async function getCalibrationHistory(subjectId: number): Promise<CalibrationHistoryRow[]> {
  return await sql`
    SELECT * FROM tb_calibration_baselines_history WHERE subject_id = ${subjectId} ORDER BY calibration_history_id ASC
  ` as CalibrationHistoryRow[];
}

export async function getLatestCalibrationSnapshot(subjectId: number, deviceType?: string | null): Promise<CalibrationHistoryRow | null> {
  if (deviceType) {
    const rows = await sql`
      SELECT * FROM tb_calibration_baselines_history WHERE subject_id = ${subjectId} AND device_type = ${deviceType}
      ORDER BY calibration_history_id DESC LIMIT 1
    `;
    return (rows[0] as CalibrationHistoryRow) ?? null;
  }
  const rows = await sql`
    SELECT * FROM tb_calibration_baselines_history WHERE subject_id = ${subjectId} AND device_type IS NULL
    ORDER BY calibration_history_id DESC LIMIT 1
  `;
  return (rows[0] as CalibrationHistoryRow) ?? null;
}

// ----------------------------------------------------------------------------
// SESSION EVENTS (per-keystroke event log for playback)
// ----------------------------------------------------------------------------

export interface SessionEventsRow {
  session_event_id: number;
  subject_id: number;
  question_id: number;
  event_log_json: string;
  total_events: number;
  session_duration_ms: number;
  keystroke_stream_json?: string | null;
  total_input_events?: number | null;
  decimation_count?: number | null;
}

export async function saveSessionEvents(row: Omit<SessionEventsRow, 'session_event_id'>, tx?: TxSql): Promise<number> {
  const q = tx ?? sql;
  const eventLogEnc = encryptString(row.event_log_json);
  const ksEnc = encryptString(row.keystroke_stream_json ?? null);
  const [result] = await q`
    INSERT INTO tb_session_events (
       subject_id, question_id,
       event_log_ciphertext, event_log_nonce,
       total_events, session_duration_ms,
       keystroke_stream_ciphertext, keystroke_stream_nonce,
       total_input_events, decimation_count
    )
    VALUES (
      ${row.subject_id}, ${row.question_id},
      ${eventLogEnc.ciphertext}, ${eventLogEnc.nonce},
      ${row.total_events}, ${row.session_duration_ms},
      ${ksEnc.ciphertext}, ${ksEnc.nonce},
      ${row.total_input_events ?? null}, ${row.decimation_count ?? null}
    )
    RETURNING session_event_id
  `;
  return result.session_event_id;
}

export async function getSessionEvents(subjectId: number, questionId: number): Promise<SessionEventsRow | null> {
  const rows = await sql`
    SELECT session_event_id, subject_id, question_id,
           event_log_ciphertext, event_log_nonce,
           total_events, session_duration_ms,
           keystroke_stream_ciphertext, keystroke_stream_nonce,
           total_input_events, decimation_count
    FROM tb_session_events
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
    ORDER BY session_event_id DESC LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0] as {
    session_event_id: number; subject_id: number; question_id: number;
    event_log_ciphertext: string; event_log_nonce: string;
    total_events: number; session_duration_ms: number;
    keystroke_stream_ciphertext: string | null; keystroke_stream_nonce: string | null;
    total_input_events: number | null; decimation_count: number | null;
  };
  return {
    session_event_id: row.session_event_id,
    subject_id: row.subject_id,
    question_id: row.question_id,
    event_log_json: decrypt(row.event_log_ciphertext, row.event_log_nonce),
    total_events: row.total_events,
    session_duration_ms: row.session_duration_ms,
    keystroke_stream_json: decryptString(row.keystroke_stream_ciphertext, row.keystroke_stream_nonce),
    total_input_events: row.total_input_events,
    decimation_count: row.decimation_count,
  };
}

// Save deletion events JSON onto the session summary row
export async function updateDeletionEvents(subjectId: number, questionId: number, deletionEventsJson: string, tx?: TxSql): Promise<void> {
  const q = tx ?? sql;
  await q`
    UPDATE tb_session_summaries SET deletion_events_json = ${deletionEventsJson}
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
  `;
}

// Single source of truth for session summary SELECT columns.
// All queries that return SessionSummaryInput MUST use this constant.
// Uses s. prefix so it works in multi-table JOINs. Table alias must be `s`.
const SESSION_SUMMARY_COLS = `
  s.subject_id AS "subjectId",
  s.question_id AS "questionId", s.first_keystroke_ms AS "firstKeystrokeMs",
  s.total_duration_ms AS "totalDurationMs", s.total_chars_typed AS "totalCharsTyped",
  s.final_char_count AS "finalCharCount", s.commitment_ratio AS "commitmentRatio",
  s.pause_count AS "pauseCount", s.total_pause_ms AS "totalPauseMs",
  s.deletion_count AS "deletionCount", s.largest_deletion AS "largestDeletion",
  s.total_chars_deleted AS "totalCharsDeleted", s.tab_away_count AS "tabAwayCount",
  s.total_tab_away_ms AS "totalTabAwayMs", s.word_count AS "wordCount",
  s.sentence_count AS "sentenceCount",
  s.small_deletion_count AS "smallDeletionCount", s.large_deletion_count AS "largeDeletionCount",
  s.large_deletion_chars AS "largeDeletionChars",
  s.first_half_deletion_chars AS "firstHalfDeletionChars",
  s.second_half_deletion_chars AS "secondHalfDeletionChars",
  s.active_typing_ms AS "activeTypingMs", s.chars_per_minute AS "charsPerMinute",
  s.p_burst_count AS "pBurstCount", s.avg_p_burst_length AS "avgPBurstLength",
  s.nrc_anger_density AS "nrcAngerDensity", s.nrc_fear_density AS "nrcFearDensity",
  s.nrc_joy_density AS "nrcJoyDensity", s.nrc_sadness_density AS "nrcSadnessDensity",
  s.nrc_trust_density AS "nrcTrustDensity", s.nrc_anticipation_density AS "nrcAnticipationDensity",
  s.cognitive_density AS "cognitiveDensity", s.hedging_density AS "hedgingDensity",
  s.first_person_density AS "firstPersonDensity",
  s.inter_key_interval_mean AS "interKeyIntervalMean",
  s.inter_key_interval_std AS "interKeyIntervalStd",
  s.revision_chain_count AS "revisionChainCount",
  s.revision_chain_avg_length AS "revisionChainAvgLength",
  s.hold_time_mean AS "holdTimeMean", s.hold_time_std AS "holdTimeStd",
  s.flight_time_mean AS "flightTimeMean", s.flight_time_std AS "flightTimeStd",
  s.keystroke_entropy AS "keystrokeEntropy",
  s.mattr, s.avg_sentence_length AS "avgSentenceLength",
  s.sentence_length_variance AS "sentenceLengthVariance",
  s.scroll_back_count AS "scrollBackCount",
  s.question_reread_count AS "questionRereadCount",
  s.confirmation_latency_ms AS "confirmationLatencyMs",
  s.paste_count AS "pasteCount", s.paste_chars_total AS "pasteCharsTotal",
  s.drop_count AS "dropCount",
  s.read_back_count AS "readBackCount", s.leading_edge_ratio AS "leadingEdgeRatio",
  s.contextual_revision_count AS "contextualRevisionCount",
  s.pre_contextual_revision_count AS "preContextualRevisionCount",
  s.considered_and_kept_count AS "consideredAndKeptCount",
  s.hold_time_mean_left AS "holdTimeMeanLeft", s.hold_time_mean_right AS "holdTimeMeanRight",
  s.hold_time_std_left AS "holdTimeStdLeft", s.hold_time_std_right AS "holdTimeStdRight",
  s.hold_time_cv AS "holdTimeCV",
  s.negative_flight_time_count AS "negativeFlightTimeCount",
  s.iki_skewness AS "ikiSkewness", s.iki_kurtosis AS "ikiKurtosis",
  s.error_detection_latency_mean AS "errorDetectionLatencyMean",
  s.terminal_velocity AS "terminalVelocity",
  s.cursor_distance_during_pauses AS "cursorDistanceDuringPauses",
  s.cursor_fidget_ratio AS "cursorFidgetRatio",
  s.cursor_stillness_during_pauses AS "cursorStillnessDuringPauses",
  s.drift_to_submit_count AS "driftToSubmitCount",
  s.cursor_pause_sample_count AS "cursorPauseSampleCount",
  s.deletion_execution_speed_mean AS "deletionExecutionSpeedMean",
  s.postcorrection_latency_mean AS "postcorrectionLatencyMean",
  s.mean_revision_distance AS "meanRevisionDistance",
  s.max_revision_distance AS "maxRevisionDistance",
  s.punctuation_flight_mean AS "punctuationFlightMean",
  s.punctuation_letter_ratio AS "punctuationLetterRatio",
  s.device_type AS "deviceType", s.user_agent AS "userAgent",
  s.hour_of_day AS "hourOfDay", s.day_of_week AS "dayOfWeek"
`;

export async function getSessionSummary(subjectId: number, questionId: number): Promise<SessionSummaryInput | null> {
  const rows = await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS} FROM tb_session_summaries s WHERE s.subject_id = $1 AND s.question_id = $2`,
    [subjectId, questionId]
  );
  return (rows[0] as unknown as SessionSummaryInput) ?? null;
}

export async function getAllSessionSummaries(subjectId: number): Promise<Array<SessionSummaryInput & { date: string }>> {
  return await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS}, q.scheduled_for AS date
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE s.subject_id = $1
    ORDER BY q.scheduled_for ASC`,
    [subjectId]
  ) as Array<SessionSummaryInput & { date: string }>;
}

// @region calibration -- getCalibrationSessionsWithText, isCalibrationQuestion, saveCalibrationSession, getUsedCalibrationPrompts, getCalibrationPromptsByRecency, saveCalibrationBaselineSnapshot, getCalibrationHistory, getLatestCalibrationSnapshot, saveQuestionFeedback, getAllQuestionFeedback

export async function getCalibrationSessionsWithText(subjectId: number): Promise<Array<SessionSummaryInput & { date: string; responseText: string }>> {
  const rows = await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS}, q.scheduled_for AS date,
            r.text_ciphertext AS "rCt", r.text_nonce AS "rNonce"
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    JOIN tb_responses r ON q.question_id = r.question_id
    WHERE q.subject_id = $1
      AND q.question_source_id = 3
      AND s.word_count >= 10
    ORDER BY q.question_id ASC`,
    [subjectId]
  ) as Array<SessionSummaryInput & { date: string; rCt: string; rNonce: string }>;
  return rows.map(r => {
    const { rCt, rNonce, ...rest } = r;
    return { ...rest, responseText: decrypt(rCt, rNonce) };
  });
}

export async function isCalibrationQuestion(questionId: number): Promise<boolean> {
  // No subject scoping needed — question_id is globally unique and we're only
  // identifying the question's source_id, not reading subject-private data.
  // alice-lint-disable-next-query subject-scope -- PK lookup; question_id is globally unique
  const rows = await sql`
    SELECT 1 FROM tb_questions WHERE question_id = ${questionId} AND question_source_id = 3
  `;
  return rows.length > 0;
}

export async function getResponseCount(subjectId: number): Promise<number> {
  const [row] = await sql`SELECT COUNT(*)::int AS count FROM tb_responses WHERE subject_id = ${subjectId}`;
  return (row as { count: number }).count;
}

export async function getUsedCalibrationPrompts(subjectId: number): Promise<string[]> {
  const rows = await sql`
    SELECT text_ciphertext, text_nonce
    FROM tb_questions
    WHERE subject_id = ${subjectId} AND question_source_id = 3
  ` as Array<{ text_ciphertext: string; text_nonce: string }>;
  return rows.map(r => decrypt(r.text_ciphertext, r.text_nonce));
}

/** Return distinct calibration prompt texts ordered by last use, oldest first.
 *  Migration 031: text is encrypted with a fresh nonce per row, so identical
 *  plaintexts yield distinct ciphertexts. SQL `GROUP BY text` no longer
 *  collapses duplicates. We decrypt every row, then dedupe by plaintext in JS,
 *  keeping the most recent dttm per distinct plaintext. */
export async function getCalibrationPromptsByRecency(subjectId: number): Promise<string[]> {
  const rows = await sql`
    SELECT text_ciphertext, text_nonce, dttm_created_utc
    FROM tb_questions
    WHERE subject_id = ${subjectId} AND question_source_id = 3
  ` as Array<{ text_ciphertext: string; text_nonce: string; dttm_created_utc: string }>;
  const lastUseByText = new Map<string, string>();
  for (const r of rows) {
    const plaintext = decrypt(r.text_ciphertext, r.text_nonce);
    const existing = lastUseByText.get(plaintext);
    if (!existing || r.dttm_created_utc > existing) {
      lastUseByText.set(plaintext, r.dttm_created_utc);
    }
  }
  return Array.from(lastUseByText.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([text]) => text);
}

export interface SaveCalibrationSessionOptions {
  attestation?: { boundaryVersion: string; codePathsRef: string; commitHash: string };
  events?: Omit<SessionEventsRow, 'session_event_id' | 'question_id'>;
  /** Enqueue a signal pipeline job in the same transaction as the save. */
  signalJob?: { kindId: SignalJobKindId; params?: Record<string, unknown> | null };
}

export async function saveCalibrationSession(
  subjectId: number,
  promptText: string,
  responseText: string,
  summary: SessionSummaryInput,
  options?: SaveCalibrationSessionOptions,
): Promise<number> {
  const bv = options?.attestation?.boundaryVersion ?? 'v1';
  const ref = options?.attestation?.codePathsRef ?? 'docs/contamination-boundary-v1.md';
  const hash = options?.attestation?.commitHash ?? 'pre-attestation';
  return await sql.begin(async (tx) => {
    const promptEnc = encryptString(promptText);
    const responseEnc = encryptString(responseText);
    const [qRow] = await tx`
      INSERT INTO tb_questions (subject_id, text_ciphertext, text_nonce, question_source_id)
      VALUES (${subjectId}, ${promptEnc.ciphertext}, ${promptEnc.nonce}, 3)
      RETURNING question_id
    `;
    const questionId = qRow.question_id as number;

    await tx`
      INSERT INTO tb_responses (subject_id, question_id, text_ciphertext, text_nonce, contamination_boundary_version, audited_code_paths_ref, code_commit_hash)
      VALUES (${subjectId}, ${questionId}, ${responseEnc.ciphertext}, ${responseEnc.nonce}, ${bv}, ${ref}, ${hash})
    `;

    await saveSessionSummary({ ...summary, subjectId, questionId }, tx);

    // Event log + keystroke stream persisted in the same transaction so a
    // calibration session never exists without its measurement input. Pre-2026-04-25
    // this ran outside the transaction, rationalized as "session data is sacred,
    // derived data is best-effort." Keystroke streams are raw measurement input,
    // not derived data; the rationalization was wrong. See GOTCHAS.md.
    if (options?.events) {
      await saveSessionEvents({ ...options.events, subject_id: subjectId, question_id: questionId }, tx);
    }

    // Optional signal-pipeline job enqueue inside the same transaction.
    // The job row is durable from the moment the calibration session exists.
    if (options?.signalJob) {
      await enqueueSignalJob(
        {
          subjectId,
          questionId,
          kindId: options.signalJob.kindId,
          params: options.signalJob.params ?? null,
        },
        tx,
      );
    }

    return questionId;
  });
}

// Known state: question_ids 42, 63, 64 are calibration sessions (source_id=3)
// with responses but no session summaries or events. They predate the
// calibration event-logging pipeline (2026-04-14, 2026-04-17). Not orphans
// from a transaction bug. Response text is real; left in place intentionally.

// ----------------------------------------------------------------------------
// QUESTION FEEDBACK
// ----------------------------------------------------------------------------

export async function saveQuestionFeedback(subjectId: number, questionId: number, landed: boolean): Promise<void> {
  await sql`
    INSERT INTO tb_question_feedback (subject_id, question_id, landed)
    VALUES (${subjectId}, ${questionId}, ${landed})
    ON CONFLICT (question_id) DO NOTHING
  `;
}

export async function getAllQuestionFeedback(subjectId: number): Promise<Array<{ date: string; landed: boolean }>> {
  const rows = await sql`
    SELECT q.scheduled_for AS date, f.landed
    FROM tb_question_feedback f
    JOIN tb_questions q ON f.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
    ORDER BY q.scheduled_for ASC
  `;
  return rows.map((r: Record<string, unknown>) => ({ date: r.date as string, landed: !!r.landed }));
}

// ----------------------------------------------------------------------------
// @region retrieval -- getRecentResponses, getResponsesSince, getResponsesSinceId, getAllReflections, getLatestReflectionWithCoverage, getRecentFeedback, getSessionSummariesForQuestions, getMaxResponseId, insertEmbeddingMeta, isRecordEmbedded, getUnembeddedResponses, searchVecEmbeddings, getActiveEmbeddingModelVersionId, savePromptTrace
// SCOPED RETRIEVAL (for RAG-augmented prompts)
// ----------------------------------------------------------------------------

export async function getRecentResponses(subjectId: number, limit: number): Promise<Array<{
  response_id: number; question_id: number; question: string; response: string; date: string;
}>> {
  const rows = await sql`
    SELECT r.response_id, q.question_id,
           q.text_ciphertext AS "qCt", q.text_nonce AS "qNonce",
           r.text_ciphertext AS "rCt", r.text_nonce AS "rNonce",
           q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
    ORDER BY q.scheduled_for DESC
    LIMIT ${limit}
  ` as Array<{
    response_id: number; question_id: number;
    qCt: string; qNonce: string; rCt: string; rNonce: string; date: string;
  }>;
  return rows.map(r => ({
    response_id: r.response_id,
    question_id: r.question_id,
    question: decrypt(r.qCt, r.qNonce),
    response: decrypt(r.rCt, r.rNonce),
    date: r.date,
  }));
}

export async function getResponsesSince(subjectId: number, sinceDate: string): Promise<Array<{
  response_id: number; question_id: number; question: string; response: string; date: string;
}>> {
  const rows = await sql`
    SELECT r.response_id, q.question_id,
           q.text_ciphertext AS "qCt", q.text_nonce AS "qNonce",
           r.text_ciphertext AS "rCt", r.text_nonce AS "rNonce",
           q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.subject_id = ${subjectId} AND q.scheduled_for > ${sinceDate}
    ORDER BY q.scheduled_for ASC
  ` as Array<{
    response_id: number; question_id: number;
    qCt: string; qNonce: string; rCt: string; rNonce: string; date: string;
  }>;
  return rows.map(r => ({
    response_id: r.response_id,
    question_id: r.question_id,
    question: decrypt(r.qCt, r.qNonce),
    response: decrypt(r.rCt, r.rNonce),
    date: r.date,
  }));
}

export async function getResponsesSinceId(subjectId: number, sinceResponseId: number): Promise<Array<{
  response_id: number; question_id: number; question: string; response: string; date: string;
}>> {
  const rows = await sql`
    SELECT r.response_id, q.question_id,
           q.text_ciphertext AS "qCt", q.text_nonce AS "qNonce",
           r.text_ciphertext AS "rCt", r.text_nonce AS "rNonce",
           q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.subject_id = ${subjectId} AND r.response_id > ${sinceResponseId}
    ORDER BY q.scheduled_for ASC
  ` as Array<{
    response_id: number; question_id: number;
    qCt: string; qNonce: string; rCt: string; rNonce: string; date: string;
  }>;
  return rows.map(r => ({
    response_id: r.response_id,
    question_id: r.question_id,
    question: decrypt(r.qCt, r.qNonce),
    response: decrypt(r.rCt, r.rNonce),
    date: r.date,
  }));
}

export async function getAllReflections(subjectId: number): Promise<Array<{
  reflection_id: number; text: string; coverage_through_response_id: number | null;
  dttm_created_utc: string;
}>> {
  const rows = await sql`
    SELECT reflection_id, text_ciphertext, text_nonce, coverage_through_response_id, dttm_created_utc
    FROM tb_reflections
    WHERE subject_id = ${subjectId}
    ORDER BY dttm_created_utc ASC
  ` as Array<{
    reflection_id: number; text_ciphertext: string; text_nonce: string;
    coverage_through_response_id: number | null; dttm_created_utc: string;
  }>;
  return rows.map(r => ({
    reflection_id: r.reflection_id,
    text: decrypt(r.text_ciphertext, r.text_nonce),
    coverage_through_response_id: r.coverage_through_response_id,
    dttm_created_utc: r.dttm_created_utc,
  }));
}

export async function getLatestReflectionWithCoverage(subjectId: number): Promise<{
  reflection_id: number; text: string;
  coverage_through_response_id: number | null;
  dttm_created_utc: string;
} | null> {
  const rows = await sql`
    SELECT reflection_id, text_ciphertext, text_nonce, coverage_through_response_id, dttm_created_utc
    FROM tb_reflections
    WHERE subject_id = ${subjectId}
    ORDER BY dttm_created_utc DESC
    LIMIT 1
  `;
  const row = rows[0] as {
    reflection_id: number; text_ciphertext: string; text_nonce: string;
    coverage_through_response_id: number | null; dttm_created_utc: string;
  } | undefined;
  if (!row) return null;
  return {
    reflection_id: row.reflection_id,
    text: decrypt(row.text_ciphertext, row.text_nonce),
    coverage_through_response_id: row.coverage_through_response_id,
    dttm_created_utc: row.dttm_created_utc,
  };
}

export async function getRecentFeedback(subjectId: number, limit: number): Promise<Array<{ date: string; landed: boolean }>> {
  const rows = await sql`
    SELECT q.scheduled_for AS date, f.landed
    FROM tb_question_feedback f
    JOIN tb_questions q ON f.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
    ORDER BY q.scheduled_for DESC
    LIMIT ${limit}
  `;
  return rows.map((r: Record<string, unknown>) => ({ date: r.date as string, landed: !!r.landed }));
}

export async function getSessionSummariesForQuestions(subjectId: number, questionIds: number[]): Promise<Array<SessionSummaryInput & { date: string }>> {
  if (questionIds.length === 0) return [];
  return await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS}, q.scheduled_for AS date
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE s.subject_id = $1 AND s.question_id = ANY($2)
    ORDER BY q.scheduled_for ASC`,
    [subjectId, questionIds]
  ) as Array<SessionSummaryInput & { date: string }>;
}

export async function getMaxResponseId(subjectId: number): Promise<number> {
  const [row] = await sql`SELECT MAX(response_id) AS max_id FROM tb_responses WHERE subject_id = ${subjectId}`;
  return (row as { max_id: number | null }).max_id ?? 0;
}

// ----------------------------------------------------------------------------
// EMBEDDING METADATA QUERIES
// ----------------------------------------------------------------------------

export async function insertEmbeddingMeta(
  subjectId: number,
  embeddingSourceId: number,
  sourceRecordId: number,
  embeddedText: string,
  sourceDate: string | null,
  modelName: string = 'Qwen3-Embedding-0.6B',
  embedding?: number[],
  embeddingModelVersionId?: number,
): Promise<number> {
  const enc = encryptString(embeddedText);
  if (embedding) {
    const vectorString = `[${embedding.join(',')}]`;
    const [row] = await sql`
      INSERT INTO tb_embeddings (subject_id, embedding_source_id, source_record_id, embedded_text_ciphertext, embedded_text_nonce, source_date, model_name, embedding, embedding_model_version_id)
      VALUES (${subjectId}, ${embeddingSourceId}, ${sourceRecordId}, ${enc.ciphertext}, ${enc.nonce}, ${sourceDate}, ${modelName}, ${vectorString}::vector, ${embeddingModelVersionId ?? null})
      ON CONFLICT (embedding_source_id, source_record_id, embedding_model_version_id) DO NOTHING
      RETURNING embedding_id
    `;
    return row?.embedding_id ?? 0;
  }
  const [row] = await sql`
    INSERT INTO tb_embeddings (subject_id, embedding_source_id, source_record_id, embedded_text_ciphertext, embedded_text_nonce, source_date, model_name, embedding_model_version_id)
    VALUES (${subjectId}, ${embeddingSourceId}, ${sourceRecordId}, ${enc.ciphertext}, ${enc.nonce}, ${sourceDate}, ${modelName}, ${embeddingModelVersionId ?? null})
    ON CONFLICT (embedding_source_id, source_record_id, embedding_model_version_id) DO NOTHING
    RETURNING embedding_id
  `;
  return row?.embedding_id ?? 0;
}

export async function isRecordEmbedded(embeddingSourceId: number, sourceRecordId: number, embeddingModelVersionId?: number): Promise<boolean> {
  // alice-lint-disable subject-scope -- composite key (embedding_source_id, source_record_id [, embedding_model_version_id]) is globally unique
  const rows = embeddingModelVersionId
    ? await sql`
        SELECT 1 FROM tb_embeddings
        WHERE embedding_source_id = ${embeddingSourceId}
          AND source_record_id = ${sourceRecordId}
          AND embedding_model_version_id = ${embeddingModelVersionId}
          AND invalidated_at IS NULL
      `
    : await sql`
        SELECT 1 FROM tb_embeddings
        WHERE embedding_source_id = ${embeddingSourceId}
          AND source_record_id = ${sourceRecordId}
          AND invalidated_at IS NULL
      `;
  // alice-lint-enable subject-scope
  return rows.length > 0;
}

export async function getUnembeddedResponses(subjectId: number, embeddingModelVersionId?: number): Promise<Array<{
  response_id: number; question: string; response: string; date: string;
}>> {
  const rows = await sql`
    SELECT r.response_id,
           q.text_ciphertext AS "qCt", q.text_nonce AS "qNonce",
           r.text_ciphertext AS "rCt", r.text_nonce AS "rNonce",
           q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
      AND q.question_source_id != 3
      AND NOT EXISTS (
        SELECT 1 FROM tb_embeddings e
        WHERE e.embedding_source_id = 1
          AND e.source_record_id = r.response_id
          AND e.invalidated_at IS NULL
          ${embeddingModelVersionId ? sql`AND e.embedding_model_version_id = ${embeddingModelVersionId}` : sql``}
      )
    ORDER BY q.scheduled_for ASC
  ` as Array<{
    response_id: number; qCt: string; qNonce: string; rCt: string; rNonce: string; date: string;
  }>;
  return rows.map(r => ({
    response_id: r.response_id,
    question: decrypt(r.qCt, r.qNonce),
    response: decrypt(r.rCt, r.rNonce),
    date: r.date,
  }));
}


export async function searchVecEmbeddings(subjectId: number, queryVector: number[], k: number): Promise<Array<{
  embedding_id: number; distance: number; embedding_source_id: number;
  source_record_id: number; embedded_text: string; source_date: string | null;
}>> {
  try {
    const vectorString = `[${queryVector.join(',')}]`;
    const rows = await sql`
      SELECT e.embedding_id, e.embedding_source_id, e.source_record_id,
             e.embedded_text_ciphertext, e.embedded_text_nonce, e.source_date,
             (e.embedding <-> ${vectorString}::vector) AS distance
      FROM tb_embeddings e
      WHERE e.subject_id = ${subjectId}
        AND e.embedding IS NOT NULL
        AND e.invalidated_at IS NULL
      ORDER BY e.embedding <-> ${vectorString}::vector
      LIMIT ${k}
    ` as Array<{
      embedding_id: number; distance: number; embedding_source_id: number;
      source_record_id: number; embedded_text_ciphertext: string; embedded_text_nonce: string;
      source_date: string | null;
    }>;
    return rows.map(r => ({
      embedding_id: r.embedding_id,
      distance: r.distance,
      embedding_source_id: r.embedding_source_id,
      source_record_id: r.source_record_id,
      embedded_text: decrypt(r.embedded_text_ciphertext, r.embedded_text_nonce),
      source_date: r.source_date,
    }));
  } catch (err) {
    console.error('[searchVecEmbeddings] Vector search failed, returning empty:', (err as Error).message);
    return [];
  }
}

export async function getActiveEmbeddingModelVersionId(): Promise<number | null> {
  const rows = await sql`
    SELECT embedding_model_version_id FROM tb_embedding_model_versions
    WHERE active_to IS NULL
    ORDER BY active_from DESC
    LIMIT 1
  `;
  return (rows[0] as { embedding_model_version_id: number } | undefined)?.embedding_model_version_id ?? null;
}

// ----------------------------------------------------------------------------
// PROMPT TRACES
// ----------------------------------------------------------------------------

export interface PromptTraceInput {
  subjectId: number;
  type: 'generation' | 'observation' | 'reflection';
  outputRecordId?: number;
  recentEntryIds?: number[];
  ragEntryIds?: number[];
  contrarianEntryIds?: number[];
  reflectionIds?: number[];
  observationIds?: number[];
  modelName?: string;
  tokenEstimate?: number;
  difficultyLevel?: string | null;
  difficultyInputs?: { avgMATTR: number; avgCogDensity: number } | null;
}

export async function savePromptTrace(trace: PromptTraceInput): Promise<void> {
  const typeId = trace.type === 'generation' ? 1 : trace.type === 'observation' ? 2 : 3;
  await sql`
    INSERT INTO tb_prompt_traces (
       subject_id, prompt_trace_type_id, output_record_id,
       recent_entry_ids, rag_entry_ids, contrarian_entry_ids,
       reflection_ids, observation_ids,
       model_name, token_estimate,
       difficulty_level, difficulty_inputs
    ) VALUES (
      ${trace.subjectId},
      ${typeId},
      ${trace.outputRecordId ?? null},
      ${trace.recentEntryIds ? JSON.stringify(trace.recentEntryIds) : null},
      ${trace.ragEntryIds ? JSON.stringify(trace.ragEntryIds) : null},
      ${trace.contrarianEntryIds ? JSON.stringify(trace.contrarianEntryIds) : null},
      ${trace.reflectionIds ? JSON.stringify(trace.reflectionIds) : null},
      ${trace.observationIds ? JSON.stringify(trace.observationIds) : null},
      ${trace.modelName ?? 'claude-opus-4-6'},
      ${trace.tokenEstimate ?? null},
      ${trace.difficultyLevel ?? null},
      ${trace.difficultyInputs ? JSON.stringify(trace.difficultyInputs) : null}
    )
  `;
}

// ----------------------------------------------------------------------------
// @region state -- saveWitnessState, getLatestWitnessState, EntryStateRow, saveEntryState, getAllEntryStates, getEntryStateCount, SemanticStateRow, saveSemanticState, saveSemanticDynamics, saveSemanticCoupling, TraitDynamicRow, saveTraitDynamics, getLatestTraitDynamics, saveCouplingMatrix, getLatestCouplingMatrix, saveEmotionBehaviorCoupling, getLatestEmotionBehaviorCoupling
// WITNESS STATE
// ----------------------------------------------------------------------------

export async function saveWitnessState(subjectId: number, entryCount: number, traitsJson: string, signalsJson: string, modelName = 'claude-sonnet-4-20250514'): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_witness_states (subject_id, entry_count, traits_json, signals_json, model_name)
    VALUES (${subjectId}, ${entryCount}, ${traitsJson}, ${signalsJson}, ${modelName})
    RETURNING witness_state_id
  `;
  return row.witness_state_id;
}

export async function getLatestWitnessState(subjectId: number): Promise<{ witness_state_id: number; entry_count: number; traits_json: string; signals_json: string } | null> {
  const rows = await sql`
    SELECT witness_state_id, entry_count, traits_json, signals_json
    FROM tb_witness_states
    WHERE subject_id = ${subjectId}
    ORDER BY witness_state_id DESC LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  // JSONB columns auto-parsed by postgres driver; callers expect strings
  return {
    witness_state_id: row.witness_state_id as number,
    entry_count: row.entry_count as number,
    traits_json: typeof row.traits_json === 'object' ? JSON.stringify(row.traits_json) : row.traits_json as string,
    signals_json: typeof row.signals_json === 'object' ? JSON.stringify(row.signals_json) : row.signals_json as string,
  };
}

// ----------------------------------------------------------------------------
// ENTRY STATES (7D deterministic behavioral state vectors)
// ----------------------------------------------------------------------------

export interface EntryStateRow {
  entry_state_id: number;
  subject_id: number;
  response_id: number;
  fluency: number;
  deliberation: number;
  revision: number;
  commitment: number;
  volatility: number;
  thermal: number;
  presence: number;
  convergence: number;
}

export async function saveEntryState(state: Omit<EntryStateRow, 'entry_state_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_entry_states (
       subject_id, response_id, fluency, deliberation, revision,
       commitment, volatility, thermal, presence, convergence
    ) VALUES (
      ${state.subject_id}, ${state.response_id}, ${state.fluency}, ${state.deliberation},
      ${state.revision}, ${state.commitment},
      ${state.volatility}, ${state.thermal}, ${state.presence}, ${state.convergence}
    )
    RETURNING entry_state_id
  `;
  return row.entry_state_id;
}

export async function getAllEntryStates(subjectId: number): Promise<EntryStateRow[]> {
  return await sql`
    SELECT * FROM tb_entry_states WHERE subject_id = ${subjectId} ORDER BY entry_state_id ASC
  ` as EntryStateRow[];
}

export async function getEntryStateCount(subjectId: number): Promise<number> {
  const [row] = await sql`SELECT COUNT(*)::int AS c FROM tb_entry_states WHERE subject_id = ${subjectId}`;
  return (row as { c: number }).c;
}

// ----------------------------------------------------------------------------
// SEMANTIC STATES (parallel space; deterministic densities + LLM placeholders)
// ----------------------------------------------------------------------------

export interface SemanticStateRow {
  semantic_state_id: number;
  subject_id: number;
  response_id: number;
  // Deterministic dimensions (always populated)
  syntactic_complexity: number;
  interrogation: number;
  self_focus: number;
  uncertainty: number;
  cognitive_processing: number;
  nrc_anger: number;
  nrc_fear: number;
  nrc_joy: number;
  nrc_sadness: number;
  nrc_trust: number;
  nrc_anticipation: number;
  // LLM-extracted (schema-ready, null until extraction lands)
  sentiment: number | null;
  abstraction: number | null;
  agency_framing: number | null;
  temporal_orientation: number | null;
  convergence: number;
}

export async function saveSemanticState(state: Omit<SemanticStateRow, 'semantic_state_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_semantic_states (
       subject_id, response_id,
       syntactic_complexity, interrogation, self_focus, uncertainty,
       cognitive_processing,
       nrc_anger, nrc_fear, nrc_joy, nrc_sadness, nrc_trust, nrc_anticipation,
       sentiment, abstraction, agency_framing, temporal_orientation,
       convergence
    ) VALUES (
      ${state.subject_id}, ${state.response_id},
      ${state.syntactic_complexity}, ${state.interrogation}, ${state.self_focus}, ${state.uncertainty},
      ${state.cognitive_processing},
      ${state.nrc_anger}, ${state.nrc_fear}, ${state.nrc_joy}, ${state.nrc_sadness}, ${state.nrc_trust}, ${state.nrc_anticipation},
      ${state.sentiment}, ${state.abstraction}, ${state.agency_framing}, ${state.temporal_orientation},
      ${state.convergence}
    )
    RETURNING semantic_state_id
  `;
  return row.semantic_state_id;
}

export async function getSemanticStateCount(subjectId: number): Promise<number> {
  const [row] = await sql`SELECT COUNT(*)::int AS c FROM tb_semantic_states WHERE subject_id = ${subjectId}`;
  return (row as { c: number }).c;
}

export interface SemanticDynamicRow {
  semantic_dynamic_id: number;
  subject_id: number;
  entry_count: number;
  dimension: string;
  baseline: number;
  variability: number;
  attractor_force: number;
  current_state: number;
  deviation: number;
  window_size: number;
}

export async function saveSemanticDynamics(dynamics: Omit<SemanticDynamicRow, 'semantic_dynamic_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const d of dynamics) {
      await sql`
        INSERT INTO tb_semantic_dynamics (
           subject_id, entry_count, dimension, baseline, variability,
           attractor_force, current_state, deviation, window_size
        ) VALUES (
          ${d.subject_id}, ${d.entry_count}, ${d.dimension}, ${d.baseline}, ${d.variability},
          ${d.attractor_force}, ${d.current_state}, ${d.deviation}, ${d.window_size}
        )
      `;
    }
  });
}

export interface SemanticCouplingRow {
  semantic_coupling_id: number;
  subject_id: number;
  entry_count: number;
  leader: string;
  follower: string;
  lag_sessions: number;
  correlation: number;
  direction: number;
}

export async function saveSemanticCoupling(couplings: Omit<SemanticCouplingRow, 'semantic_coupling_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const c of couplings) {
      await sql`
        INSERT INTO tb_semantic_coupling (
           subject_id, entry_count, leader, follower, lag_sessions, correlation, direction
        ) VALUES (
          ${c.subject_id}, ${c.entry_count}, ${c.leader}, ${c.follower}, ${c.lag_sessions}, ${c.correlation}, ${c.direction}
        )
      `;
    }
  });
}

// ----------------------------------------------------------------------------
// TRAIT DYNAMICS (PersDyn model)
// ----------------------------------------------------------------------------

export interface TraitDynamicRow {
  trait_dynamic_id: number;
  subject_id: number;
  entry_count: number;
  dimension: string;
  baseline: number;
  variability: number;
  attractor_force: number;
  current_state: number;
  deviation: number;
  window_size: number;
}

export async function saveTraitDynamics(dynamics: Omit<TraitDynamicRow, 'trait_dynamic_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const d of dynamics) {
      await sql`
        INSERT INTO tb_trait_dynamics (
           subject_id, entry_count, dimension, baseline, variability,
           attractor_force, current_state, deviation, window_size
        ) VALUES (
          ${d.subject_id}, ${d.entry_count}, ${d.dimension}, ${d.baseline}, ${d.variability},
          ${d.attractor_force}, ${d.current_state}, ${d.deviation}, ${d.window_size}
        )
      `;
    }
  });
}

export async function getLatestTraitDynamics(subjectId: number, entryCount: number): Promise<TraitDynamicRow[]> {
  return await sql`
    SELECT * FROM tb_trait_dynamics
    WHERE subject_id = ${subjectId} AND entry_count = ${entryCount}
    ORDER BY trait_dynamic_id ASC
  ` as TraitDynamicRow[];
}

// ----------------------------------------------------------------------------
// COUPLING MATRIX
// ----------------------------------------------------------------------------

export interface CouplingRow {
  coupling_id: number;
  subject_id: number;
  entry_count: number;
  leader: string;
  follower: string;
  lag_sessions: number;
  correlation: number;
  direction: number;
}

export async function saveCouplingMatrix(couplings: Omit<CouplingRow, 'coupling_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const c of couplings) {
      await sql`
        INSERT INTO tb_coupling_matrix (
           subject_id, entry_count, leader, follower, lag_sessions, correlation, direction
        ) VALUES (
          ${c.subject_id}, ${c.entry_count}, ${c.leader}, ${c.follower}, ${c.lag_sessions}, ${c.correlation}, ${c.direction}
        )
      `;
    }
  });
}

export async function getLatestCouplingMatrix(subjectId: number, entryCount: number): Promise<CouplingRow[]> {
  return await sql`
    SELECT * FROM tb_coupling_matrix
    WHERE subject_id = ${subjectId} AND entry_count = ${entryCount}
    ORDER BY correlation DESC
  ` as CouplingRow[];
}

// ----------------------------------------------------------------------------
// EMOTION-BEHAVIOR COUPLING
// ----------------------------------------------------------------------------

export interface EmotionBehaviorCouplingRow {
  emotion_coupling_id: number;
  subject_id: number;
  entry_count: number;
  emotion_dim: string;
  behavior_dim: string;
  lag_sessions: number;
  correlation: number;
  direction: number;
}

export async function saveEmotionBehaviorCoupling(couplings: Omit<EmotionBehaviorCouplingRow, 'emotion_coupling_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const c of couplings) {
      await sql`
        INSERT INTO tb_emotion_behavior_coupling (
           subject_id, entry_count, emotion_dim, behavior_dim, lag_sessions, correlation, direction
        ) VALUES (
          ${c.subject_id}, ${c.entry_count}, ${c.emotion_dim}, ${c.behavior_dim}, ${c.lag_sessions}, ${c.correlation}, ${c.direction}
        )
      `;
    }
  });
}

export async function getLatestEmotionBehaviorCoupling(subjectId: number, entryCount: number): Promise<EmotionBehaviorCouplingRow[]> {
  return await sql`
    SELECT * FROM tb_emotion_behavior_coupling
    WHERE subject_id = ${subjectId} AND entry_count = ${entryCount}
    ORDER BY correlation DESC
  ` as EmotionBehaviorCouplingRow[];
}

// Predictions, theory confidence, intervention intent, and question candidates
// were archived 2026-04-16. Data preserved under zz_archive_* tables.
// Stub functions removed 2026-04-20 — no active callers remain.

// ----------------------------------------------------------------------------
// @region calibration-context -- saveCalibrationContext, getCalibrationContextForQuestion, getRecentCalibrationContext, getCalibrationContextNearDate, saveSessionDelta, getRecentSessionDeltas, getSameDayCalibrationSummary
// CALIBRATION CONTEXT EXTRACTION
// ----------------------------------------------------------------------------

export interface CalibrationContextTag {
  dimension: 'sleep' | 'physical_state' | 'emotional_event' | 'social_quality' | 'stress' | 'exercise' | 'routine';
  value: string;
  detail: string | null;
  confidence: number;
}

const DIMENSION_ID_MAP: Record<string, number> = {
  sleep: 1, physical_state: 2, emotional_event: 3, social_quality: 4,
  stress: 5, exercise: 6, routine: 7,
};

export async function saveCalibrationContext(subjectId: number, questionId: number, tags: CalibrationContextTag[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const tag of tags) {
      const dimId = DIMENSION_ID_MAP[tag.dimension];
      if (!dimId) continue;
      const valueEnc = encryptString(tag.value);
      const detailEnc = encryptString(tag.detail);
      await sql`
        INSERT INTO tb_calibration_context (
           subject_id, question_id, context_dimension_id,
           value_ciphertext, value_nonce,
           detail_ciphertext, detail_nonce,
           confidence
        ) VALUES (
          ${subjectId}, ${questionId}, ${dimId},
          ${valueEnc.ciphertext}, ${valueEnc.nonce},
          ${detailEnc.ciphertext}, ${detailEnc.nonce},
          ${tag.confidence}
        )
      `;
    }
  });
}

export async function getCalibrationContextForQuestion(subjectId: number, questionId: number): Promise<Array<CalibrationContextTag & { questionId: number }>> {
  const rows = await sql`
    SELECT cc.question_id AS "questionId",
           d.enum_code AS dimension,
           cc.value_ciphertext AS "valueCt", cc.value_nonce AS "valueNonce",
           cc.detail_ciphertext AS "detailCt", cc.detail_nonce AS "detailNonce",
           cc.confidence
    FROM tb_calibration_context cc
    JOIN te_context_dimension d ON cc.context_dimension_id = d.context_dimension_id
    WHERE cc.subject_id = ${subjectId} AND cc.question_id = ${questionId}
    ORDER BY cc.context_dimension_id ASC
  ` as Array<{
    questionId: number; dimension: CalibrationContextTag['dimension'];
    valueCt: string; valueNonce: string;
    detailCt: string | null; detailNonce: string | null;
    confidence: number;
  }>;
  return rows.map(r => ({
    questionId: r.questionId,
    dimension: r.dimension,
    value: decrypt(r.valueCt, r.valueNonce),
    detail: decryptString(r.detailCt, r.detailNonce),
    confidence: r.confidence,
  }));
}

export async function getRecentCalibrationContext(subjectId: number, limit: number = 10): Promise<Array<{
  questionId: number;
  promptText: string;
  sessionDate: string;
  dimension: string;
  value: string;
  detail: string | null;
  confidence: number;
}>> {
  const rows = await sql`
    SELECT cc.question_id AS "questionId",
           q.text_ciphertext AS "qCt", q.text_nonce AS "qNonce",
           q.dttm_created_utc AS "sessionDate",
           d.enum_code AS dimension,
           cc.value_ciphertext AS "valueCt", cc.value_nonce AS "valueNonce",
           cc.detail_ciphertext AS "detailCt", cc.detail_nonce AS "detailNonce",
           cc.confidence
    FROM tb_calibration_context cc
    JOIN te_context_dimension d ON cc.context_dimension_id = d.context_dimension_id
    JOIN tb_questions q ON cc.question_id = q.question_id
    WHERE cc.subject_id = ${subjectId}
    ORDER BY q.dttm_created_utc DESC, cc.context_dimension_id ASC
    LIMIT ${limit}
  ` as Array<{
    questionId: number;
    qCt: string; qNonce: string;
    sessionDate: string; dimension: string;
    valueCt: string; valueNonce: string;
    detailCt: string | null; detailNonce: string | null;
    confidence: number;
  }>;
  return rows.map(r => ({
    questionId: r.questionId,
    promptText: decrypt(r.qCt, r.qNonce),
    sessionDate: r.sessionDate,
    dimension: r.dimension,
    value: decrypt(r.valueCt, r.valueNonce),
    detail: decryptString(r.detailCt, r.detailNonce),
    confidence: r.confidence,
  }));
}

export async function getCalibrationContextNearDate(subjectId: number, targetDate: string, windowDays: number = 1): Promise<Array<{
  questionId: number;
  sessionDate: string;
  dimension: string;
  value: string;
  detail: string | null;
  confidence: number;
}>> {
  const rows = await sql`
    SELECT cc.question_id AS "questionId",
           q.dttm_created_utc AS "sessionDate",
           d.enum_code AS dimension,
           cc.value_ciphertext AS "valueCt", cc.value_nonce AS "valueNonce",
           cc.detail_ciphertext AS "detailCt", cc.detail_nonce AS "detailNonce",
           cc.confidence
    FROM tb_calibration_context cc
    JOIN te_context_dimension d ON cc.context_dimension_id = d.context_dimension_id
    JOIN tb_questions q ON cc.question_id = q.question_id
    WHERE cc.subject_id = ${subjectId}
      AND ABS(EXTRACT(EPOCH FROM (q.dttm_created_utc - ${targetDate}::timestamptz)) / 86400) <= ${windowDays}
    ORDER BY ABS(EXTRACT(EPOCH FROM (q.dttm_created_utc - ${targetDate}::timestamptz)) / 86400) ASC, cc.context_dimension_id ASC
  ` as Array<{
    questionId: number; sessionDate: string; dimension: string;
    valueCt: string; valueNonce: string;
    detailCt: string | null; detailNonce: string | null;
    confidence: number;
  }>;
  return rows.map(r => ({
    questionId: r.questionId,
    sessionDate: r.sessionDate,
    dimension: r.dimension,
    value: decrypt(r.valueCt, r.valueNonce),
    detail: decryptString(r.detailCt, r.detailNonce),
    confidence: r.confidence,
  }));
}

// ----------------------------------------------------------------------------
// SESSION DELTA (same-day calibration -> journal behavioral shift)
// ----------------------------------------------------------------------------

export interface SessionDeltaRow {
  sessionDeltaId: number;
  subjectId: number;
  sessionDate: string;
  calibrationQuestionId: number;
  journalQuestionId: number;
  deltaFirstPerson: number | null;
  deltaCognitive: number | null;
  deltaHedging: number | null;
  deltaCharsPerMinute: number | null;
  deltaCommitment: number | null;
  deltaLargeDeletionCount: number | null;
  deltaInterKeyIntervalMean: number | null;
  deltaAvgPBurstLength: number | null;
  deltaHoldTimeMean: number | null;
  deltaFlightTimeMean: number | null;
  deltaMagnitude: number | null;
  calibrationFirstPerson: number | null;
  journalFirstPerson: number | null;
  calibrationCognitive: number | null;
  journalCognitive: number | null;
  calibrationHedging: number | null;
  journalHedging: number | null;
  calibrationCharsPerMinute: number | null;
  journalCharsPerMinute: number | null;
  calibrationCommitment: number | null;
  journalCommitment: number | null;
  calibrationLargeDeletionCount: number | null;
  journalLargeDeletionCount: number | null;
  calibrationInterKeyIntervalMean: number | null;
  journalInterKeyIntervalMean: number | null;
  calibrationAvgPBurstLength: number | null;
  journalAvgPBurstLength: number | null;
  calibrationHoldTimeMean: number | null;
  journalHoldTimeMean: number | null;
  calibrationFlightTimeMean: number | null;
  journalFlightTimeMean: number | null;
}

export async function getSameDayCalibrationSummary(subjectId: number, date: string): Promise<SessionSummaryInput | null> {
  // Calibration questions have scheduled_for = NULL (see saveCalibrationSession).
  // Match by dttm_created_utc::date instead. Take most recent if multiple same-day.
  const rows = await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS}
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE q.subject_id = $1
      AND q.question_source_id = 3
      AND q.dttm_created_utc::date = $2
    ORDER BY q.dttm_created_utc DESC
    LIMIT 1`,
    [subjectId, date]
  );
  return (rows[0] as unknown as SessionSummaryInput) ?? null;
}

export async function saveSessionDelta(delta: SessionDeltaRow): Promise<void> {
  // CONFLICT TARGET CHANGED (migration 030): (session_date) → (subject_id, session_date)
  await sql`
    INSERT INTO tb_session_delta (
       subject_id
      ,session_date
      ,calibration_question_id
      ,journal_question_id
      ,delta_first_person
      ,delta_cognitive
      ,delta_hedging
      ,delta_chars_per_minute
      ,delta_commitment
      ,delta_large_deletion_count
      ,delta_inter_key_interval_mean
      ,delta_avg_p_burst_length
      ,delta_hold_time_mean
      ,delta_flight_time_mean
      ,delta_magnitude
      ,calibration_first_person
      ,journal_first_person
      ,calibration_cognitive
      ,journal_cognitive
      ,calibration_hedging
      ,journal_hedging
      ,calibration_chars_per_minute
      ,journal_chars_per_minute
      ,calibration_commitment
      ,journal_commitment
      ,calibration_large_deletion_count
      ,journal_large_deletion_count
      ,calibration_inter_key_interval_mean
      ,journal_inter_key_interval_mean
      ,calibration_avg_p_burst_length
      ,journal_avg_p_burst_length
      ,calibration_hold_time_mean
      ,journal_hold_time_mean
      ,calibration_flight_time_mean
      ,journal_flight_time_mean
    ) VALUES (
      ${delta.subjectId},
      ${delta.sessionDate},
      ${delta.calibrationQuestionId},
      ${delta.journalQuestionId},
      ${delta.deltaFirstPerson},
      ${delta.deltaCognitive},
      ${delta.deltaHedging},
      ${delta.deltaCharsPerMinute},
      ${delta.deltaCommitment},
      ${delta.deltaLargeDeletionCount},
      ${delta.deltaInterKeyIntervalMean},
      ${delta.deltaAvgPBurstLength},
      ${delta.deltaHoldTimeMean},
      ${delta.deltaFlightTimeMean},
      ${delta.deltaMagnitude},
      ${delta.calibrationFirstPerson},
      ${delta.journalFirstPerson},
      ${delta.calibrationCognitive},
      ${delta.journalCognitive},
      ${delta.calibrationHedging},
      ${delta.journalHedging},
      ${delta.calibrationCharsPerMinute},
      ${delta.journalCharsPerMinute},
      ${delta.calibrationCommitment},
      ${delta.journalCommitment},
      ${delta.calibrationLargeDeletionCount},
      ${delta.journalLargeDeletionCount},
      ${delta.calibrationInterKeyIntervalMean},
      ${delta.journalInterKeyIntervalMean},
      ${delta.calibrationAvgPBurstLength},
      ${delta.journalAvgPBurstLength},
      ${delta.calibrationHoldTimeMean},
      ${delta.journalHoldTimeMean},
      ${delta.calibrationFlightTimeMean},
      ${delta.journalFlightTimeMean}
    )
    ON CONFLICT (subject_id, session_date) DO UPDATE SET
       calibration_question_id = ${delta.calibrationQuestionId}
      ,journal_question_id = ${delta.journalQuestionId}
      ,delta_first_person = ${delta.deltaFirstPerson}
      ,delta_cognitive = ${delta.deltaCognitive}
      ,delta_hedging = ${delta.deltaHedging}
      ,delta_chars_per_minute = ${delta.deltaCharsPerMinute}
      ,delta_commitment = ${delta.deltaCommitment}
      ,delta_large_deletion_count = ${delta.deltaLargeDeletionCount}
      ,delta_inter_key_interval_mean = ${delta.deltaInterKeyIntervalMean}
      ,delta_avg_p_burst_length = ${delta.deltaAvgPBurstLength}
      ,delta_hold_time_mean = ${delta.deltaHoldTimeMean}
      ,delta_flight_time_mean = ${delta.deltaFlightTimeMean}
      ,delta_magnitude = ${delta.deltaMagnitude}
      ,calibration_first_person = ${delta.calibrationFirstPerson}
      ,journal_first_person = ${delta.journalFirstPerson}
      ,calibration_cognitive = ${delta.calibrationCognitive}
      ,journal_cognitive = ${delta.journalCognitive}
      ,calibration_hedging = ${delta.calibrationHedging}
      ,journal_hedging = ${delta.journalHedging}
      ,calibration_chars_per_minute = ${delta.calibrationCharsPerMinute}
      ,journal_chars_per_minute = ${delta.journalCharsPerMinute}
      ,calibration_commitment = ${delta.calibrationCommitment}
      ,journal_commitment = ${delta.journalCommitment}
      ,calibration_large_deletion_count = ${delta.calibrationLargeDeletionCount}
      ,journal_large_deletion_count = ${delta.journalLargeDeletionCount}
      ,calibration_inter_key_interval_mean = ${delta.calibrationInterKeyIntervalMean}
      ,journal_inter_key_interval_mean = ${delta.journalInterKeyIntervalMean}
      ,calibration_avg_p_burst_length = ${delta.calibrationAvgPBurstLength}
      ,journal_avg_p_burst_length = ${delta.journalAvgPBurstLength}
      ,calibration_hold_time_mean = ${delta.calibrationHoldTimeMean}
      ,journal_hold_time_mean = ${delta.journalHoldTimeMean}
      ,calibration_flight_time_mean = ${delta.calibrationFlightTimeMean}
      ,journal_flight_time_mean = ${delta.journalFlightTimeMean}
  `;
}

export async function getRecentSessionDeltas(subjectId: number, limit: number = 30): Promise<SessionDeltaRow[]> {
  return await sql`
    SELECT
       session_delta_id AS "sessionDeltaId"
      ,subject_id AS "subjectId"
      ,session_date AS "sessionDate"
      ,calibration_question_id AS "calibrationQuestionId"
      ,journal_question_id AS "journalQuestionId"
      ,delta_first_person AS "deltaFirstPerson"
      ,delta_cognitive AS "deltaCognitive"
      ,delta_hedging AS "deltaHedging"
      ,delta_chars_per_minute AS "deltaCharsPerMinute"
      ,delta_commitment AS "deltaCommitment"
      ,delta_large_deletion_count AS "deltaLargeDeletionCount"
      ,delta_inter_key_interval_mean AS "deltaInterKeyIntervalMean"
      ,delta_avg_p_burst_length AS "deltaAvgPBurstLength"
      ,delta_hold_time_mean AS "deltaHoldTimeMean"
      ,delta_flight_time_mean AS "deltaFlightTimeMean"
      ,delta_magnitude AS "deltaMagnitude"
      ,calibration_first_person AS "calibrationFirstPerson"
      ,journal_first_person AS "journalFirstPerson"
      ,calibration_cognitive AS "calibrationCognitive"
      ,journal_cognitive AS "journalCognitive"
      ,calibration_hedging AS "calibrationHedging"
      ,journal_hedging AS "journalHedging"
      ,calibration_chars_per_minute AS "calibrationCharsPerMinute"
      ,journal_chars_per_minute AS "journalCharsPerMinute"
      ,calibration_commitment AS "calibrationCommitment"
      ,journal_commitment AS "journalCommitment"
      ,calibration_large_deletion_count AS "calibrationLargeDeletionCount"
      ,journal_large_deletion_count AS "journalLargeDeletionCount"
      ,calibration_inter_key_interval_mean AS "calibrationInterKeyIntervalMean"
      ,journal_inter_key_interval_mean AS "journalInterKeyIntervalMean"
      ,calibration_avg_p_burst_length AS "calibrationAvgPBurstLength"
      ,journal_avg_p_burst_length AS "journalAvgPBurstLength"
      ,calibration_hold_time_mean AS "calibrationHoldTimeMean"
      ,journal_hold_time_mean AS "journalHoldTimeMean"
      ,calibration_flight_time_mean AS "calibrationFlightTimeMean"
      ,journal_flight_time_mean AS "journalFlightTimeMean"
    FROM tb_session_delta
    WHERE subject_id = ${subjectId}
    ORDER BY session_date DESC
    LIMIT ${limit}
  ` as SessionDeltaRow[];
}

// ===================================================================
// @region observatory -- getEntryStatesWithDates, getEntryStateByResponseId, getCommentsForPaper, saveComment
// OBSERVATORY QUERIES
// ===================================================================

export async function getEntryStatesWithDates(subjectId: number): Promise<Array<EntryStateRow & { date: string; question_id: number }>> {
  return await sql`
    SELECT es.*, q.scheduled_for AS date, q.question_id
    FROM tb_entry_states es
    JOIN tb_responses r ON es.response_id = r.response_id
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE es.subject_id = ${subjectId}
    ORDER BY es.entry_state_id ASC
  ` as Array<EntryStateRow & { date: string; question_id: number }>;
}

export async function getEntryStateByResponseId(subjectId: number, responseId: number): Promise<(EntryStateRow & {
  date: string; question_id: number; question_text: string;
}) | null> {
  const rows = await sql`
    SELECT es.*, q.scheduled_for AS date, q.question_id,
           q.text_ciphertext, q.text_nonce
    FROM tb_entry_states es
    JOIN tb_responses r ON es.response_id = r.response_id
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE es.subject_id = ${subjectId} AND es.response_id = ${responseId}
  `;
  const row = rows[0] as (EntryStateRow & {
    date: string; question_id: number; text_ciphertext: string; text_nonce: string;
  }) | undefined;
  if (!row) return null;
  const { text_ciphertext, text_nonce, ...rest } = row;
  return { ...rest, question_text: decrypt(text_ciphertext, text_nonce) };
}

// ===================================================================
// PAPER COMMENTS
// ===================================================================

export async function getCommentsForPaper(slug: string): Promise<Array<{
  paper_comment_id: number;
  author_name: string;
  comment_text: string;
  dttm_created_utc: string;
}>> {
  return await sql`
    SELECT paper_comment_id, author_name, comment_text, dttm_created_utc
    FROM tb_paper_comments
    WHERE paper_slug = ${slug}
    ORDER BY dttm_created_utc ASC
  ` as Array<{
    paper_comment_id: number;
    author_name: string;
    comment_text: string;
    dttm_created_utc: string;
  }>;
}

export async function saveComment(slug: string, authorName: string, commentText: string): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_paper_comments (paper_slug, author_name, comment_text, dttm_created_utc)
    VALUES (${slug}, ${authorName}, ${commentText}, ${nowStr()})
    RETURNING paper_comment_id
  `;
  return row.paper_comment_id;
}

// @region corpus -- getCorpusQuestions, getCorpusQuestionById, insertCorpusQuestion, retireCorpusQuestion, getActiveCorpusCount
// ----------------------------------------------------------------------------
// QUESTION CORPUS
// ----------------------------------------------------------------------------

export interface CorpusQuestion {
  corpus_question_id: number;
  text: string;
  theme_tag: string | null;
  is_retired: boolean;
  added_by: string;
  dttm_created_utc: string;
}

/** All corpus questions (including retired). Ordered by ID ascending. */
export async function getCorpusQuestions(): Promise<CorpusQuestion[]> {
  const rows = await sql`
    SELECT corpus_question_id, text, theme_tag, is_retired, added_by, dttm_created_utc
    FROM tb_question_corpus
    ORDER BY corpus_question_id ASC
  `;
  return rows as CorpusQuestion[];
}

/** Single corpus question by ID, or null. */
export async function getCorpusQuestionById(id: number): Promise<CorpusQuestion | null> {
  const rows = await sql`
    SELECT corpus_question_id, text, theme_tag, is_retired, added_by, dttm_created_utc
    FROM tb_question_corpus
    WHERE corpus_question_id = ${id}
  `;
  return (rows[0] as CorpusQuestion) ?? null;
}

/** Insert a new corpus question. Returns the new ID. Idempotent on text (ON CONFLICT DO NOTHING). */
export async function insertCorpusQuestion(input: {
  text: string;
  theme_tag?: string | null;
  added_by?: string;
}): Promise<number | null> {
  const [row] = await sql`
    INSERT INTO tb_question_corpus (text, theme_tag, added_by)
    VALUES (${input.text}, ${input.theme_tag ?? null}, ${input.added_by ?? 'owner'})
    ON CONFLICT (text) DO NOTHING
    RETURNING corpus_question_id
  `;
  return (row as { corpus_question_id: number })?.corpus_question_id ?? null;
}

/** Soft-retire a corpus question. Returns true if the row was updated. */
export async function retireCorpusQuestion(id: number): Promise<boolean> {
  const result = await sql`
    UPDATE tb_question_corpus
    SET is_retired = TRUE
    WHERE corpus_question_id = ${id} AND is_retired = FALSE
  `;
  return result.count > 0;
}

/** Count of active (non-retired) corpus questions. */
export async function getActiveCorpusCount(): Promise<number> {
  const [row] = await sql`
    SELECT count(*)::int AS count FROM tb_question_corpus WHERE is_retired = FALSE
  `;
  return (row as { count: number }).count;
}

// ----------------------------------------------------------------------------
// @region signals -- saveDynamicalSignals, getDynamicalSignals, saveMotorSignals, getMotorSignals, saveSemanticSignals, getSemanticSignals, saveProcessSignals, getProcessSignals, saveCrossSessionSignals, getCrossSessionSignals, saveReconstructionResidual, getReconstructionResidual, saveSessionIntegrity, getSessionIntegrity
// DYNAMICAL SIGNALS (persisted, previously on-demand)
// ----------------------------------------------------------------------------

export interface DynamicalSignalRow {
  dynamical_signal_id: number;
  question_id: number;
  iki_count: number | null;
  hold_flight_count: number | null;
  permutation_entropy: number | null;
  permutation_entropy_raw: number | null;
  pe_spectrum: string | null;
  dfa_alpha: number | null;
  mfdfa_spectrum_width: number | null;
  mfdfa_asymmetry: number | null;
  mfdfa_peak_alpha: number | null;
  temporal_irreversibility: number | null;
  iki_psd_spectral_slope: number | null;
  iki_psd_respiratory_peak_hz: number | null;
  peak_typing_frequency_hz: number | null;
  iki_psd_lf_hf_ratio: number | null;
  iki_psd_fast_slow_variance_ratio: number | null;
  statistical_complexity: number | null;
  forbidden_pattern_fraction: number | null;
  weighted_pe: number | null;
  lempel_ziv_complexity: number | null;
  optn_transition_entropy: number | null;
  optn_forbidden_transition_count: number | null;
  rqa_determinism: number | null;
  rqa_laminarity: number | null;
  rqa_trapping_time: number | null;
  rqa_recurrence_rate: number | null;
  rqa_recurrence_time_entropy: number | null;
  rqa_mean_recurrence_time: number | null;
  recurrence_transitivity: number | null;
  recurrence_avg_path_length: number | null;
  recurrence_clustering: number | null;
  recurrence_assortativity: number | null;
  effective_information: number | null;
  causal_emergence_index: number | null;
  optimal_causal_scale: number | null;
  pid_synergy: number | null;
  pid_redundancy: number | null;
  branching_ratio: number | null;
  avalanche_size_exponent: number | null;
  dmd_dominant_frequency: number | null;
  dmd_dominant_decay_rate: number | null;
  dmd_mode_count: number | null;
  dmd_spectral_entropy: number | null;
  pause_mixture_component_count: number | null;
  pause_mixture_motor_proportion: number | null;
  pause_mixture_cognitive_load_index: number | null;
  te_hold_to_flight: number | null;
  te_flight_to_hold: number | null;
  te_dominance: number | null;
}

export async function saveDynamicalSignals(subjectId: number, questionId: number, s: Omit<DynamicalSignalRow, 'dynamical_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_dynamical_signals (
       subject_id, question_id, iki_count, hold_flight_count,
       permutation_entropy, permutation_entropy_raw, pe_spectrum, dfa_alpha,
       mfdfa_spectrum_width, mfdfa_asymmetry, mfdfa_peak_alpha,
       temporal_irreversibility,
       iki_psd_spectral_slope, iki_psd_respiratory_peak_hz, peak_typing_frequency_hz,
       iki_psd_lf_hf_ratio, iki_psd_fast_slow_variance_ratio,
       statistical_complexity, forbidden_pattern_fraction, weighted_pe, lempel_ziv_complexity,
       optn_transition_entropy, optn_forbidden_transition_count,
       rqa_determinism, rqa_laminarity, rqa_trapping_time, rqa_recurrence_rate,
       rqa_recurrence_time_entropy, rqa_mean_recurrence_time,
       recurrence_transitivity, recurrence_avg_path_length, recurrence_clustering, recurrence_assortativity,
       effective_information, causal_emergence_index, optimal_causal_scale,
       pid_synergy, pid_redundancy,
       branching_ratio, avalanche_size_exponent,
       dmd_dominant_frequency, dmd_dominant_decay_rate, dmd_mode_count, dmd_spectral_entropy,
       pause_mixture_component_count, pause_mixture_motor_proportion, pause_mixture_cognitive_load_index,
       te_hold_to_flight, te_flight_to_hold, te_dominance
    ) VALUES (
      ${subjectId}, ${questionId}, ${s.iki_count}, ${s.hold_flight_count},
      ${s.permutation_entropy}, ${s.permutation_entropy_raw}, ${s.pe_spectrum}, ${s.dfa_alpha},
      ${s.mfdfa_spectrum_width}, ${s.mfdfa_asymmetry}, ${s.mfdfa_peak_alpha},
      ${s.temporal_irreversibility},
      ${s.iki_psd_spectral_slope}, ${s.iki_psd_respiratory_peak_hz}, ${s.peak_typing_frequency_hz},
      ${s.iki_psd_lf_hf_ratio}, ${s.iki_psd_fast_slow_variance_ratio},
      ${s.statistical_complexity}, ${s.forbidden_pattern_fraction}, ${s.weighted_pe}, ${s.lempel_ziv_complexity},
      ${s.optn_transition_entropy}, ${s.optn_forbidden_transition_count},
      ${s.rqa_determinism}, ${s.rqa_laminarity}, ${s.rqa_trapping_time}, ${s.rqa_recurrence_rate},
      ${s.rqa_recurrence_time_entropy}, ${s.rqa_mean_recurrence_time},
      ${s.recurrence_transitivity}, ${s.recurrence_avg_path_length}, ${s.recurrence_clustering}, ${s.recurrence_assortativity},
      ${s.effective_information}, ${s.causal_emergence_index}, ${s.optimal_causal_scale},
      ${s.pid_synergy}, ${s.pid_redundancy},
      ${s.branching_ratio}, ${s.avalanche_size_exponent},
      ${s.dmd_dominant_frequency}, ${s.dmd_dominant_decay_rate}, ${s.dmd_mode_count}, ${s.dmd_spectral_entropy},
      ${s.pause_mixture_component_count}, ${s.pause_mixture_motor_proportion}, ${s.pause_mixture_cognitive_load_index},
      ${s.te_hold_to_flight}, ${s.te_flight_to_hold}, ${s.te_dominance}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING dynamical_signal_id
  `;
  return row?.dynamical_signal_id ?? 0;
}

export async function getDynamicalSignals(subjectId: number, questionId: number): Promise<DynamicalSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_dynamical_signals WHERE subject_id = ${subjectId} AND question_id = ${questionId}`;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  // JSONB columns auto-parsed by postgres driver; callers expect strings
  return {
    ...row,
    pe_spectrum: row.pe_spectrum == null ? null : (typeof row.pe_spectrum === 'object' ? JSON.stringify(row.pe_spectrum) : row.pe_spectrum as string),
  } as DynamicalSignalRow;
}

// ----------------------------------------------------------------------------
// MOTOR SIGNALS
// ----------------------------------------------------------------------------

export interface MotorSignalRow {
  motor_signal_id: number;
  question_id: number;
  sample_entropy: number | null;
  mse_series: string | null;
  complexity_index: number | null;
  ex_gaussian_fisher_trace: number | null;
  iki_autocorrelation_json: string | null;
  motor_jerk: number | null;
  lapse_rate: number | null;
  tempo_drift: number | null;
  iki_compression_ratio: number | null;
  digraph_latency_json: string | null;
  // Phase 2 expansion (2026-04-18)
  ex_gaussian_tau: number | null;
  ex_gaussian_mu: number | null;
  ex_gaussian_sigma: number | null;
  tau_proportion: number | null;
  adjacent_hold_time_cov: number | null;
  hold_flight_rank_corr: number | null;
}

export async function saveMotorSignals(subjectId: number, questionId: number, s: Omit<MotorSignalRow, 'motor_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_motor_signals (
       subject_id, question_id, sample_entropy, mse_series, complexity_index, ex_gaussian_fisher_trace,
       iki_autocorrelation_json,
       motor_jerk, lapse_rate, tempo_drift,
       iki_compression_ratio, digraph_latency_json,
       ex_gaussian_tau, ex_gaussian_mu, ex_gaussian_sigma,
       tau_proportion, adjacent_hold_time_cov, hold_flight_rank_corr
    ) VALUES (
      ${subjectId}, ${questionId}, ${s.sample_entropy}, ${s.mse_series}, ${s.complexity_index}, ${s.ex_gaussian_fisher_trace},
      ${s.iki_autocorrelation_json},
      ${s.motor_jerk}, ${s.lapse_rate}, ${s.tempo_drift},
      ${s.iki_compression_ratio}, ${s.digraph_latency_json},
      ${s.ex_gaussian_tau}, ${s.ex_gaussian_mu}, ${s.ex_gaussian_sigma},
      ${s.tau_proportion}, ${s.adjacent_hold_time_cov}, ${s.hold_flight_rank_corr}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING motor_signal_id
  `;
  return row?.motor_signal_id ?? 0;
}

export async function getMotorSignals(subjectId: number, questionId: number): Promise<MotorSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_motor_signals WHERE subject_id = ${subjectId} AND question_id = ${questionId}`;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  // JSONB columns auto-parsed by postgres driver; callers expect strings
  return {
    ...row,
    iki_autocorrelation_json: row.iki_autocorrelation_json == null ? null : (typeof row.iki_autocorrelation_json === 'object' ? JSON.stringify(row.iki_autocorrelation_json) : row.iki_autocorrelation_json as string),
    digraph_latency_json: row.digraph_latency_json == null ? null : (typeof row.digraph_latency_json === 'object' ? JSON.stringify(row.digraph_latency_json) : row.digraph_latency_json as string),
  } as MotorSignalRow;
}

// ----------------------------------------------------------------------------
// SEMANTIC SIGNALS
// ----------------------------------------------------------------------------

export interface SemanticSignalRow {
  semantic_signal_id: number;
  question_id: number;
  idea_density: number | null;
  lexical_sophistication: number | null;
  epistemic_stance: number | null;
  integrative_complexity: number | null;
  deep_cohesion: number | null;
  referential_cohesion: number | null;
  emotional_valence_arc: string | null;
  text_compression_ratio: number | null;
  discourse_global_coherence: number | null;
  discourse_local_coherence: number | null;
  discourse_global_local_ratio: number | null;
  discourse_coherence_decay_slope: number | null;
  lexicon_version: number;
  paste_contaminated: boolean;
}

export async function saveSemanticSignals(subjectId: number, questionId: number, s: Omit<SemanticSignalRow, 'semantic_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_semantic_signals (
       subject_id, question_id, idea_density, lexical_sophistication, epistemic_stance,
       integrative_complexity, deep_cohesion, referential_cohesion,
       emotional_valence_arc, text_compression_ratio,
       discourse_global_coherence, discourse_local_coherence,
       discourse_global_local_ratio, discourse_coherence_decay_slope,
       lexicon_version, paste_contaminated
    ) VALUES (
      ${subjectId}, ${questionId}, ${s.idea_density}, ${s.lexical_sophistication}, ${s.epistemic_stance},
      ${s.integrative_complexity}, ${s.deep_cohesion}, ${s.referential_cohesion},
      ${s.emotional_valence_arc}, ${s.text_compression_ratio},
      ${s.discourse_global_coherence}, ${s.discourse_local_coherence},
      ${s.discourse_global_local_ratio}, ${s.discourse_coherence_decay_slope},
      ${s.lexicon_version}, ${s.paste_contaminated}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING semantic_signal_id
  `;
  return row?.semantic_signal_id ?? 0;
}

export async function getSemanticSignals(subjectId: number, questionId: number): Promise<SemanticSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_semantic_signals WHERE subject_id = ${subjectId} AND question_id = ${questionId}`;
  return (rows[0] as SemanticSignalRow) ?? null;
}

// ----------------------------------------------------------------------------
// PROCESS SIGNALS
// ----------------------------------------------------------------------------

export interface ProcessSignalRow {
  process_signal_id: number;
  question_id: number;
  pause_within_word: number | null;
  pause_between_word: number | null;
  pause_between_sentence: number | null;
  abandoned_thought_count: number | null;
  r_burst_count: number | null;
  i_burst_count: number | null;
  vocab_expansion_rate: number | null;
  phase_transition_point: number | null;
  strategy_shift_count: number | null;
}

export async function saveProcessSignals(subjectId: number, questionId: number, s: Omit<ProcessSignalRow, 'process_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_process_signals (
       subject_id, question_id, pause_within_word, pause_between_word, pause_between_sentence,
       abandoned_thought_count, r_burst_count, i_burst_count,
       vocab_expansion_rate, phase_transition_point, strategy_shift_count
    ) VALUES (
      ${subjectId}, ${questionId}, ${s.pause_within_word}, ${s.pause_between_word}, ${s.pause_between_sentence},
      ${s.abandoned_thought_count}, ${s.r_burst_count}, ${s.i_burst_count},
      ${s.vocab_expansion_rate}, ${s.phase_transition_point}, ${s.strategy_shift_count}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING process_signal_id
  `;
  return row?.process_signal_id ?? 0;
}

export async function getProcessSignals(subjectId: number, questionId: number): Promise<ProcessSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_process_signals WHERE subject_id = ${subjectId} AND question_id = ${questionId}`;
  return (rows[0] as ProcessSignalRow) ?? null;
}

// ----------------------------------------------------------------------------
// CROSS-SESSION SIGNALS
// ----------------------------------------------------------------------------

export interface CrossSessionSignalRow {
  cross_session_signal_id: number;
  question_id: number;
  self_perplexity: number | null;
  motor_self_perplexity: number | null;
  ncd_lag_1: number | null;
  ncd_lag_3: number | null;
  ncd_lag_7: number | null;
  ncd_lag_30: number | null;
  vocab_recurrence_decay: number | null;
  digraph_stability: number | null;
  text_network_density: number | null;
  text_network_communities: number | null;
  bridging_ratio: number | null;
}

export async function saveCrossSessionSignals(subjectId: number, questionId: number, s: Omit<CrossSessionSignalRow, 'cross_session_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_cross_session_signals (
       subject_id, question_id, self_perplexity, motor_self_perplexity,
       ncd_lag_1, ncd_lag_3, ncd_lag_7, ncd_lag_30,
       vocab_recurrence_decay, digraph_stability,
       text_network_density, text_network_communities, bridging_ratio
    ) VALUES (
      ${subjectId}, ${questionId}, ${s.self_perplexity}, ${s.motor_self_perplexity},
      ${s.ncd_lag_1}, ${s.ncd_lag_3}, ${s.ncd_lag_7}, ${s.ncd_lag_30},
      ${s.vocab_recurrence_decay}, ${s.digraph_stability},
      ${s.text_network_density}, ${s.text_network_communities}, ${s.bridging_ratio}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING cross_session_signal_id
  `;
  return row?.cross_session_signal_id ?? 0;
}

export async function getCrossSessionSignals(subjectId: number, questionId: number): Promise<CrossSessionSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_cross_session_signals WHERE subject_id = ${subjectId} AND question_id = ${questionId}`;
  return (rows[0] as CrossSessionSignalRow) ?? null;
}

// ----------------------------------------------------------------------------
// RECONSTRUCTION RESIDUALS
// ----------------------------------------------------------------------------

export interface ReconstructionResidualInput {
  adversary_variant_id: number;
  question_source_id: number | null;
  avatar_seed: string | null;
  profile_snapshot_json: string | null;
  corpus_sha256: string | null;
  avatar_topic: string | null;
  avatar_text: string | null;
  avatar_word_count: number | null;
  avatar_markov_order: number | null;
  avatar_chain_size: number | null;
  avatar_i_burst_count: number | null;
  real_word_count: number | null;
  corpus_size: number | null;
  session_count: number | null;
  real_perplexity: number | null;
  real_known_fraction: number | null;
  avatar_perplexity: number | null;
  avatar_known_fraction: number | null;
  perplexity_residual: number | null;
  real_permutation_entropy: number | null;
  avatar_permutation_entropy: number | null;
  residual_permutation_entropy: number | null;
  real_pe_spectrum: string | null;
  avatar_pe_spectrum: string | null;
  residual_pe_spectrum: string | null;
  real_dfa_alpha: number | null;
  avatar_dfa_alpha: number | null;
  residual_dfa_alpha: number | null;
  real_rqa_determinism: number | null;
  avatar_rqa_determinism: number | null;
  residual_rqa_determinism: number | null;
  real_rqa_laminarity: number | null;
  avatar_rqa_laminarity: number | null;
  residual_rqa_laminarity: number | null;
  real_te_dominance: number | null;
  avatar_te_dominance: number | null;
  residual_te_dominance: number | null;
  real_sample_entropy: number | null;
  avatar_sample_entropy: number | null;
  residual_sample_entropy: number | null;
  real_motor_jerk: number | null;
  avatar_motor_jerk: number | null;
  residual_motor_jerk: number | null;
  real_lapse_rate: number | null;
  avatar_lapse_rate: number | null;
  residual_lapse_rate: number | null;
  real_tempo_drift: number | null;
  avatar_tempo_drift: number | null;
  residual_tempo_drift: number | null;
  real_ex_gaussian_tau: number | null;
  avatar_ex_gaussian_tau: number | null;
  residual_ex_gaussian_tau: number | null;
  real_tau_proportion: number | null;
  avatar_tau_proportion: number | null;
  residual_tau_proportion: number | null;
  real_idea_density: number | null;
  avatar_idea_density: number | null;
  residual_idea_density: number | null;
  real_lexical_sophistication: number | null;
  avatar_lexical_sophistication: number | null;
  residual_lexical_sophistication: number | null;
  real_epistemic_stance: number | null;
  avatar_epistemic_stance: number | null;
  residual_epistemic_stance: number | null;
  real_integrative_complexity: number | null;
  avatar_integrative_complexity: number | null;
  residual_integrative_complexity: number | null;
  real_deep_cohesion: number | null;
  avatar_deep_cohesion: number | null;
  residual_deep_cohesion: number | null;
  real_text_compression_ratio: number | null;
  avatar_text_compression_ratio: number | null;
  residual_text_compression_ratio: number | null;
  extended_residuals_json: Record<string, { real: number | null; avatar: number | null; residual: number | null }> | null;
  dynamical_l2_norm: number | null;
  motor_l2_norm: number | null;
  semantic_l2_norm: number | null;
  total_l2_norm: number | null;
  residual_count: number | null;
  behavioral_l2_norm: number | null;
  behavioral_residual_count: number | null;
}

export async function saveReconstructionResidual(
  subjectId: number,
  questionId: number,
  s: ReconstructionResidualInput,
): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_reconstruction_residuals (
       subject_id
      ,question_id
      ,adversary_variant_id
      ,question_source_id
      ,avatar_seed, profile_snapshot_json, corpus_sha256, avatar_topic
      ,avatar_text, avatar_word_count, avatar_markov_order, avatar_chain_size
      ,avatar_i_burst_count, real_word_count, corpus_size, session_count
      ,real_perplexity, real_known_fraction, avatar_perplexity, avatar_known_fraction
      ,perplexity_residual
      ,real_permutation_entropy, avatar_permutation_entropy, residual_permutation_entropy
      ,real_pe_spectrum, avatar_pe_spectrum, residual_pe_spectrum
      ,real_dfa_alpha, avatar_dfa_alpha, residual_dfa_alpha
      ,real_rqa_determinism, avatar_rqa_determinism, residual_rqa_determinism
      ,real_rqa_laminarity, avatar_rqa_laminarity, residual_rqa_laminarity
      ,real_te_dominance, avatar_te_dominance, residual_te_dominance
      ,real_sample_entropy, avatar_sample_entropy, residual_sample_entropy
      ,real_motor_jerk, avatar_motor_jerk, residual_motor_jerk
      ,real_lapse_rate, avatar_lapse_rate, residual_lapse_rate
      ,real_tempo_drift, avatar_tempo_drift, residual_tempo_drift
      ,real_ex_gaussian_tau, avatar_ex_gaussian_tau, residual_ex_gaussian_tau
      ,real_tau_proportion, avatar_tau_proportion, residual_tau_proportion
      ,real_idea_density, avatar_idea_density, residual_idea_density
      ,real_lexical_sophistication, avatar_lexical_sophistication, residual_lexical_sophistication
      ,real_epistemic_stance, avatar_epistemic_stance, residual_epistemic_stance
      ,real_integrative_complexity, avatar_integrative_complexity, residual_integrative_complexity
      ,real_deep_cohesion, avatar_deep_cohesion, residual_deep_cohesion
      ,real_text_compression_ratio, avatar_text_compression_ratio, residual_text_compression_ratio
      ,extended_residuals_json
      ,dynamical_l2_norm, motor_l2_norm, semantic_l2_norm, total_l2_norm
      ,residual_count
      ,behavioral_l2_norm, behavioral_residual_count
    ) VALUES (
       ${subjectId}
      ,${questionId}
      ,${s.adversary_variant_id}
      ,${s.question_source_id}
      ,${s.avatar_seed}, ${s.profile_snapshot_json}, ${s.corpus_sha256}, ${s.avatar_topic}
      ,${s.avatar_text}, ${s.avatar_word_count}, ${s.avatar_markov_order}, ${s.avatar_chain_size}
      ,${s.avatar_i_burst_count}, ${s.real_word_count}, ${s.corpus_size}, ${s.session_count}
      ,${s.real_perplexity}, ${s.real_known_fraction}, ${s.avatar_perplexity}, ${s.avatar_known_fraction}
      ,${s.perplexity_residual}
      ,${s.real_permutation_entropy}, ${s.avatar_permutation_entropy}, ${s.residual_permutation_entropy}
      ,${s.real_pe_spectrum}, ${s.avatar_pe_spectrum}, ${s.residual_pe_spectrum}
      ,${s.real_dfa_alpha}, ${s.avatar_dfa_alpha}, ${s.residual_dfa_alpha}
      ,${s.real_rqa_determinism}, ${s.avatar_rqa_determinism}, ${s.residual_rqa_determinism}
      ,${s.real_rqa_laminarity}, ${s.avatar_rqa_laminarity}, ${s.residual_rqa_laminarity}
      ,${s.real_te_dominance}, ${s.avatar_te_dominance}, ${s.residual_te_dominance}
      ,${s.real_sample_entropy}, ${s.avatar_sample_entropy}, ${s.residual_sample_entropy}
      ,${s.real_motor_jerk}, ${s.avatar_motor_jerk}, ${s.residual_motor_jerk}
      ,${s.real_lapse_rate}, ${s.avatar_lapse_rate}, ${s.residual_lapse_rate}
      ,${s.real_tempo_drift}, ${s.avatar_tempo_drift}, ${s.residual_tempo_drift}
      ,${s.real_ex_gaussian_tau}, ${s.avatar_ex_gaussian_tau}, ${s.residual_ex_gaussian_tau}
      ,${s.real_tau_proportion}, ${s.avatar_tau_proportion}, ${s.residual_tau_proportion}
      ,${s.real_idea_density}, ${s.avatar_idea_density}, ${s.residual_idea_density}
      ,${s.real_lexical_sophistication}, ${s.avatar_lexical_sophistication}, ${s.residual_lexical_sophistication}
      ,${s.real_epistemic_stance}, ${s.avatar_epistemic_stance}, ${s.residual_epistemic_stance}
      ,${s.real_integrative_complexity}, ${s.avatar_integrative_complexity}, ${s.residual_integrative_complexity}
      ,${s.real_deep_cohesion}, ${s.avatar_deep_cohesion}, ${s.residual_deep_cohesion}
      ,${s.real_text_compression_ratio}, ${s.avatar_text_compression_ratio}, ${s.residual_text_compression_ratio}
      ,${s.extended_residuals_json}
      ,${s.dynamical_l2_norm}, ${s.motor_l2_norm}, ${s.semantic_l2_norm}, ${s.total_l2_norm}
      ,${s.residual_count}
      ,${s.behavioral_l2_norm}, ${s.behavioral_residual_count}
    )
    ON CONFLICT (question_id, adversary_variant_id) DO UPDATE SET
       extended_residuals_json = EXCLUDED.extended_residuals_json
      ,dynamical_l2_norm = EXCLUDED.dynamical_l2_norm
      ,motor_l2_norm = EXCLUDED.motor_l2_norm
      ,total_l2_norm = EXCLUDED.total_l2_norm
      ,residual_count = EXCLUDED.residual_count
      ,behavioral_l2_norm = EXCLUDED.behavioral_l2_norm
      ,behavioral_residual_count = EXCLUDED.behavioral_residual_count
    RETURNING reconstruction_residual_id
  `;
  return (row as { reconstruction_residual_id: number })?.reconstruction_residual_id ?? 0;
}

export async function getReconstructionResidual(subjectId: number, questionId: number, variantId: number = 1): Promise<ReconstructionResidualInput | null> {
  const rows = await sql`
    SELECT * FROM tb_reconstruction_residuals
    WHERE subject_id = ${subjectId} AND question_id = ${questionId} AND adversary_variant_id = ${variantId}
  `;
  return (rows[0] as ReconstructionResidualInput) ?? null;
}

// ----------------------------------------------------------------------------
// SESSION INTEGRITY
// ----------------------------------------------------------------------------

export interface SessionIntegrityInput {
  subjectId: number;
  questionId: number;
  profileDistance: number;
  dimensionCount: number;
  zScoresJson: string;
  isFlagged: boolean;
  thresholdUsed: number;
  profileSessionCount: number;
}

export async function saveSessionIntegrity(s: SessionIntegrityInput): Promise<void> {
  await sql`
    INSERT INTO tb_session_integrity (
       subject_id, question_id, profile_distance, dimension_count,
       z_scores_json, is_flagged, threshold_used, profile_session_count
    ) VALUES (
      ${s.subjectId}, ${s.questionId}, ${s.profileDistance}, ${s.dimensionCount},
      ${s.zScoresJson}, ${s.isFlagged}, ${s.thresholdUsed}, ${s.profileSessionCount}
    )
    ON CONFLICT (question_id) DO NOTHING
  `;
}

export async function getSessionIntegrity(subjectId: number, questionId: number): Promise<SessionIntegrityInput | null> {
  const rows = await sql`
    SELECT subject_id AS "subjectId",
           question_id AS "questionId",
           profile_distance AS "profileDistance",
           dimension_count AS "dimensionCount",
           z_scores_json AS "zScoresJson",
           is_flagged AS "isFlagged",
           threshold_used AS "thresholdUsed",
           profile_session_count AS "profileSessionCount"
    FROM tb_session_integrity
    WHERE subject_id = ${subjectId} AND question_id = ${questionId}
  `;
  return (rows[0] as SessionIntegrityInput) ?? null;
}

// ----------------------------------------------------------------------------
// @region provenance -- EngineProvenanceInput, EngineProvenanceRow, upsertEngineProvenance, getEngineProvenanceById, stampEngineProvenance
// ENGINE BINARY PROVENANCE
// ----------------------------------------------------------------------------

export interface EngineProvenanceInput {
  binary_sha256: string;
  code_commit_hash: string | null;
  cpu_model: string;
  host_arch: string;
  target_cpu_flag: string | null;
  napi_rs_version: string | null;
  rustc_version: string | null;
}

export interface EngineProvenanceRow extends EngineProvenanceInput {
  engine_provenance_id: number;
  dttm_observed_first: Date;
}

/**
 * Idempotent upsert: same (binary_sha256, cpu_model) returns the existing row's
 * id; new pairs get a new row. Called once per process at first signal save.
 */
export async function upsertEngineProvenance(input: EngineProvenanceInput): Promise<number> {
  const rows = await sql`
    INSERT INTO tb_engine_provenance (
       binary_sha256, code_commit_hash, cpu_model, host_arch,
       target_cpu_flag, napi_rs_version, rustc_version
    ) VALUES (
      ${input.binary_sha256}, ${input.code_commit_hash}, ${input.cpu_model}, ${input.host_arch},
      ${input.target_cpu_flag}, ${input.napi_rs_version}, ${input.rustc_version}
    )
    ON CONFLICT (binary_sha256, cpu_model)
    DO UPDATE SET dttm_observed_first = tb_engine_provenance.dttm_observed_first
    RETURNING engine_provenance_id
  `;
  return (rows[0] as { engine_provenance_id: number }).engine_provenance_id;
}

export async function getEngineProvenanceById(id: number): Promise<EngineProvenanceRow | null> {
  const rows = await sql`SELECT * FROM tb_engine_provenance WHERE engine_provenance_id = ${id}`;
  return (rows[0] as EngineProvenanceRow | undefined) ?? null;
}

/**
 * Stamp the engine provenance id onto every Rust-derived signal row for a
 * given question. Called by the signal worker AFTER the full pipeline
 * completes — so a failed/in-flight pipeline never leaves rows marked with
 * the wrong (or partially-applied) provenance.
 *
 * Idempotent: only updates rows whose engine_provenance_id IS NULL. Re-runs
 * of the worker (boot sweep recovery) are safe; rows already stamped stay
 * stamped, missing rows pick up the current provenance.
 *
 * Wrapped in a transaction so all 6 tables update atomically. Either every
 * Rust-derived row for this question has provenance, or none of them do.
 */
export async function stampEngineProvenance(
  subjectId: number,
  questionId: number,
  engineProvenanceId: number,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`UPDATE tb_dynamical_signals      SET engine_provenance_id = ${engineProvenanceId} WHERE subject_id = ${subjectId} AND question_id = ${questionId} AND engine_provenance_id IS NULL`;
    await tx`UPDATE tb_motor_signals          SET engine_provenance_id = ${engineProvenanceId} WHERE subject_id = ${subjectId} AND question_id = ${questionId} AND engine_provenance_id IS NULL`;
    await tx`UPDATE tb_process_signals        SET engine_provenance_id = ${engineProvenanceId} WHERE subject_id = ${subjectId} AND question_id = ${questionId} AND engine_provenance_id IS NULL`;
    await tx`UPDATE tb_cross_session_signals  SET engine_provenance_id = ${engineProvenanceId} WHERE subject_id = ${subjectId} AND question_id = ${questionId} AND engine_provenance_id IS NULL`;
    await tx`UPDATE tb_session_integrity      SET engine_provenance_id = ${engineProvenanceId} WHERE subject_id = ${subjectId} AND question_id = ${questionId} AND engine_provenance_id IS NULL`;
    await tx`UPDATE tb_reconstruction_residuals SET engine_provenance_id = ${engineProvenanceId} WHERE subject_id = ${subjectId} AND question_id = ${questionId} AND engine_provenance_id IS NULL`;
  });
}

// ----------------------------------------------------------------------------
// @region jobs -- SIGNAL_JOB_STATUS, SIGNAL_JOB_KIND, SignalJobRow, EnqueueSignalJobInput, enqueueSignalJob, claimNextSignalJob, markSignalJobCompleted, markSignalJobFailed, sweepStaleSignalJobs, getSignalJobById, getDeadLetterSignalJobs, countOpenSignalJobs
// SIGNAL JOB QUEUE (durable signal pipeline)
// ----------------------------------------------------------------------------

export const SIGNAL_JOB_STATUS = {
  QUEUED: 1,
  RUNNING: 2,
  COMPLETED: 3,
  FAILED: 4,
  DEAD_LETTER: 5,
} as const;

export const SIGNAL_JOB_KIND = {
  RESPONSE_PIPELINE: 1,
  CALIBRATION_PIPELINE: 2,
} as const;

export type SignalJobStatusId = (typeof SIGNAL_JOB_STATUS)[keyof typeof SIGNAL_JOB_STATUS];
export type SignalJobKindId = (typeof SIGNAL_JOB_KIND)[keyof typeof SIGNAL_JOB_KIND];

export interface SignalJobRow {
  signal_job_id: number;
  question_id: number;
  subject_id: number;
  signal_job_kind_id: SignalJobKindId;
  signal_job_status_id: SignalJobStatusId;
  attempts: number;
  max_attempts: number;
  next_run_at: Date;
  claimed_at: Date | null;
  completed_at: Date | null;
  last_error: string | null;
  params_json: Record<string, unknown> | null;
  dttm_created_utc: Date;
  dttm_modified_utc: Date;
}

export interface EnqueueSignalJobInput {
  subjectId: number;
  questionId: number;
  kindId: SignalJobKindId;
  params?: Record<string, unknown> | null;
  maxAttempts?: number;
}

/**
 * Enqueue a signal pipeline job. Idempotent: a partial unique index on
 * (question_id, signal_job_kind_id) WHERE status_id <> 5 ensures the same
 * (question, kind) cannot be queued twice while a prior job is still open.
 * Pass a `tx` to enqueue inside the same transaction as the response/calibration
 * save, so jobs only exist when their session also exists.
 *
 * Returns the new signal_job_id, or the existing one if a duplicate insert
 * was prevented by the unique index.
 */
export async function enqueueSignalJob(
  input: EnqueueSignalJobInput,
  tx?: TxSql,
): Promise<number> {
  const q = tx ?? sql;
  // Pass the object directly — postgres.js handles JSON encoding when binding
  // to a jsonb column. JSON.stringify here would double-encode and store the
  // value as a JSON-string rather than a JSON-object.
  const params = input.params ?? null;
  const maxAttempts = input.maxAttempts ?? 5;
  const rows = await q`
    INSERT INTO tb_signal_jobs (
       subject_id, question_id, signal_job_kind_id, signal_job_status_id,
       max_attempts, params_json
    ) VALUES (
      ${input.subjectId}, ${input.questionId}, ${input.kindId}, 1,
      ${maxAttempts}, ${params as never}
    )
    ON CONFLICT (question_id, signal_job_kind_id) WHERE signal_job_status_id <> 5
    DO UPDATE SET dttm_modified_utc = CURRENT_TIMESTAMP
    RETURNING signal_job_id
  `;
  return (rows[0] as { signal_job_id: number }).signal_job_id;
}

/**
 * Atomically claim the next runnable signal job. Uses FOR UPDATE SKIP LOCKED
 * so concurrent workers never grab the same row. Returns null if no job is
 * currently runnable (queue empty or all queued jobs have future next_run_at).
 *
 * The status flips to RUNNING and attempts is incremented in the same statement
 * the row is selected, so there is no race window where two workers could
 * observe the same job in QUEUED state.
 */
export async function claimNextSignalJob(): Promise<SignalJobRow | null> {
  // alice-lint-disable-next-query subject-scope -- worker queue is population-agnostic; claims any subject's next job in PK/status order
  const rows = await sql`
    UPDATE tb_signal_jobs
    SET signal_job_status_id = 2,
        claimed_at = CURRENT_TIMESTAMP,
        attempts = attempts + 1,
        dttm_modified_utc = CURRENT_TIMESTAMP
    WHERE signal_job_id = (
      SELECT signal_job_id
      FROM tb_signal_jobs
      WHERE signal_job_status_id = 1
        AND next_run_at <= CURRENT_TIMESTAMP
      ORDER BY next_run_at, signal_job_id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `;
  return (rows[0] as SignalJobRow | undefined) ?? null;
}

/**
 * Mark a job completed. Used by the worker after a successful pipeline run.
 */
export async function markSignalJobCompleted(signalJobId: number): Promise<void> {
  // alice-lint-disable-next-query subject-scope -- worker queue PK update; signal_job_id is globally unique
  await sql`
    UPDATE tb_signal_jobs
    SET signal_job_status_id = 3,
        completed_at = CURRENT_TIMESTAMP,
        last_error = NULL,
        dttm_modified_utc = CURRENT_TIMESTAMP
    WHERE signal_job_id = ${signalJobId}
  `;
}

/**
 * Mark a job failed. If attempts < max_attempts, the job is requeued with
 * next_run_at = NOW() + backoff. Otherwise it transitions to DEAD_LETTER for
 * manual investigation.
 *
 * The backoff is computed by `computeBackoffMs` in libSignalWorker.ts so it
 * lives near the worker logic and is unit-testable as a pure function.
 */
export async function markSignalJobFailed(
  signalJobId: number,
  error: string,
  backoffMs: number,
): Promise<void> {
  // alice-lint-disable-next-query subject-scope -- worker queue PK update; signal_job_id is globally unique
  await sql`
    UPDATE tb_signal_jobs
    SET signal_job_status_id = CASE
          WHEN attempts >= max_attempts THEN 5  -- dead_letter
          ELSE 1                                 -- back to queued
        END,
        next_run_at = CASE
          WHEN attempts >= max_attempts THEN next_run_at  -- terminal; don't reschedule
          ELSE CURRENT_TIMESTAMP + (${backoffMs}::int * INTERVAL '1 millisecond')
        END,
        claimed_at = NULL,
        last_error = ${error},
        dttm_modified_utc = CURRENT_TIMESTAMP
    WHERE signal_job_id = ${signalJobId}
  `;
}

/**
 * Boot-time recovery sweep. Any job left in RUNNING state from a prior process
 * that died mid-claim is moved back to QUEUED so the new process can pick it
 * up. `staleAfterMs` should be larger than the longest plausible job runtime
 * so we don't re-queue jobs the current process is actively running.
 *
 * Returns the count of jobs re-queued.
 */
export async function sweepStaleSignalJobs(staleAfterMs: number): Promise<number> {
  // alice-lint-disable-next-query subject-scope -- boot-time recovery is population-agnostic; sweeps stale RUNNING jobs across all subjects
  const rows = await sql`
    UPDATE tb_signal_jobs
    SET signal_job_status_id = 1,
        claimed_at = NULL,
        last_error = COALESCE(last_error, '') || ' [recovered from stale running state]',
        dttm_modified_utc = CURRENT_TIMESTAMP
    WHERE signal_job_status_id = 2
      AND claimed_at IS NOT NULL
      AND claimed_at < CURRENT_TIMESTAMP - (${staleAfterMs}::int * INTERVAL '1 millisecond')
    RETURNING signal_job_id
  `;
  return rows.length;
}

export async function getSignalJobById(signalJobId: number): Promise<SignalJobRow | null> {
  // alice-lint-disable-next-query subject-scope -- worker queue PK lookup; signal_job_id is globally unique
  const rows = await sql`SELECT * FROM tb_signal_jobs WHERE signal_job_id = ${signalJobId}`;
  return (rows[0] as SignalJobRow | undefined) ?? null;
}

export async function getDeadLetterSignalJobs(): Promise<SignalJobRow[]> {
  // alice-lint-disable-next-query subject-scope -- admin/observability listing of all dead-lettered jobs across subjects
  return await sql`
    SELECT * FROM tb_signal_jobs
    WHERE signal_job_status_id = 5
    ORDER BY dttm_modified_utc DESC
  ` as unknown as SignalJobRow[];
}

export async function countOpenSignalJobs(): Promise<number> {
  // alice-lint-disable-next-query subject-scope -- queue health metric is global by design; counts in-flight work across all subjects
  const rows = await sql`
    SELECT COUNT(*)::int AS n
    FROM tb_signal_jobs
    WHERE signal_job_status_id IN (1, 2, 4)
  `;
  return (rows[0] as { n: number }).n;
}

export default sql;
