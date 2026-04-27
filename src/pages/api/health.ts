/**
 * Pipeline health endpoint.
 *
 * Safe for the black box: this endpoint returns NO user-generated content.
 * No response text. No question text beyond ids/dates. No signal values.
 * No trait floats. No error messages (only job tags). Counts and booleans
 * only. Its purpose is to tell the user, before they commit to a session,
 * whether the prior session was fully processed and whether anything is
 * silently failing.
 *
 * See src/lib/error-log.ts for the persistent error trail — this endpoint
 * surfaces only the count of recent errors and which jobs produced them.
 */
import type { APIRoute } from 'astro';
import sql, { OWNER_SUBJECT_ID } from '../../lib/libDb.ts';
import { localDateStr } from '../../lib/utlDate.ts';
import { readRecentErrors } from '../../lib/utlErrorLog.ts';
import { hasNativeEngine } from '../../lib/libSignalsNative.ts';
import { isTeiAvailable } from '../../lib/libEmbeddings.ts';
import { decrypt } from '../../lib/libCrypto.ts';

interface PipelineCoverage {
  embedded: boolean;
  entryState: boolean;
}

interface LastSessionStatus {
  date: string;
  responseId: number;
  questionId: number;
  pipeline: PipelineCoverage;
  missing: string[];
  fullyProcessed: boolean;
}

interface HealthResponse {
  today: {
    date: string;
    questionReady: boolean;
    sessionSubmittedToday: boolean;
  };
  lastSession: LastSessionStatus | null;
  sessions: {
    count: number;
    nextReflectionAt: number | null;
  };
  tomorrow: {
    questionReady: boolean;
  };
  anomalies: {
    duplicateScheduledQuestions: number;
    sessionsMissingSummary: number;
    recentErrorCount: number;
    recentErrorJobs: string[];
  };
  pendingWork: {
    embeds: number;
    embedsBySubject: Array<{ subject_id: number; username: string; count: number }>;
    extractions: number;
    extractionsBySubject: Array<{ subject_id: number; username: string; count: number }>;
    seedAlerts: Array<{ subject_id: number; username: string; remaining: number }>;
    teiAvailable: boolean;
    anthropicAvailable: boolean;
  };
  rustEngine: boolean;
  overall: 'green' | 'yellow' | 'red';
}

export const GET: APIRoute = async () => {
  // Owner-only endpoint (Caddy basic-auth gated). subjectId pinned to OWNER_SUBJECT_ID.
  // TODO(step5): review — if a per-subject health view ever lands, accept ?subjectId.
  const subjectId = OWNER_SUBJECT_ID;
  const today = localDateStr();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // --- TODAY ---------------------------------------------------------------
  const todayQuestionRows = await sql`
    SELECT question_id, question_source_id
    FROM tb_questions WHERE subject_id = ${subjectId} AND scheduled_for = ${today}
  `;
  const todayQuestion = todayQuestionRows[0] as { question_id: number; question_source_id: number } | undefined;

  let sessionSubmittedToday = false;
  if (todayQuestion) {
    const submittedRows = await sql`
      SELECT 1 FROM tb_responses r
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.scheduled_for = ${today}
        AND q.question_source_id != 3
    `;
    sessionSubmittedToday = submittedRows.length > 0;
  }

  // --- LAST SESSION --------------------------------------------------------
  const lastSessionRows = await sql`
    SELECT r.response_id, r.question_id, DATE(r.dttm_created_utc) AS day
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
      AND q.question_source_id != 3
    ORDER BY r.response_id DESC LIMIT 1
  `;
  const lastSession = lastSessionRows[0] as { response_id: number; question_id: number; day: string } | undefined;

  let lastSessionStatus: LastSessionStatus | null = null;
  if (lastSession) {
    // Observation + suppressed-question coverage checks removed 2026-04-16.
    const coverageRows = await sql`
      SELECT
        (SELECT 1 FROM tb_embeddings WHERE subject_id = ${subjectId} AND source_record_id = ${lastSession.response_id} AND embedding_source_id = 1 LIMIT 1) AS embedded,
        (SELECT 1 FROM tb_entry_states WHERE subject_id = ${subjectId} AND response_id = ${lastSession.response_id} LIMIT 1) AS entry_state
    `;
    const coverage = coverageRows[0] as { embedded: number | null; entry_state: number | null };

    const pipeline: PipelineCoverage = {
      embedded: !!coverage.embedded,
      entryState: !!coverage.entry_state,
    };
    const missing: string[] = [];
    if (!pipeline.embedded) missing.push('embedding');
    if (!pipeline.entryState) missing.push('entry_state');

    lastSessionStatus = {
      date: lastSession.day,
      responseId: lastSession.response_id,
      questionId: lastSession.question_id,
      pipeline,
      missing,
      fullyProcessed: missing.length === 0,
    };
  }

  // --- SESSIONS COUNT + REFLECTION CADENCE --------------------------------
  const [sessionCountRow] = await sql`
    SELECT COUNT(*)::int AS c FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
      AND q.question_source_id != 3
  `;
  const sessionCount = (sessionCountRow as { c: number }).c;

  // Reflection cadence: fires when responseCount >= 5 && responseCount % 7 === 0
  // responseCount in respond.ts is total responses (see getResponseCount), not
  // sessions-only. We surface the next fire count as informational; if the
  // cadence is session-scoped instead, this number just reads differently.
  const [totalResponsesRow] = await sql`
    SELECT COUNT(*)::int AS c FROM tb_responses WHERE subject_id = ${subjectId}
  `;
  const totalResponses = (totalResponsesRow as { c: number }).c;
  let nextReflectionAt: number | null = null;
  if (totalResponses < 5) {
    nextReflectionAt = 7;
  } else {
    nextReflectionAt = Math.ceil((totalResponses + 1) / 7) * 7;
  }

  // --- TOMORROW -----------------------------------------------------------
  const tomorrowQuestionRows = await sql`
    SELECT 1 FROM tb_questions WHERE subject_id = ${subjectId} AND scheduled_for = ${tomorrow}
  `;
  const tomorrowQuestion = tomorrowQuestionRows[0];

  // --- ANOMALIES -----------------------------------------------------------
  // Migration 031: text is encrypted with a fresh nonce per row, so SQL
  // `GROUP BY text` no longer collapses identical plaintexts. Decrypt the
  // upcoming-window questions and count duplicates by plaintext in JS. The
  // window (scheduled_for >= today) is small in practice (< 30 rows).
  const upcomingRows = await sql`
    SELECT text_ciphertext, text_nonce
    FROM tb_questions
    WHERE subject_id = ${subjectId} AND scheduled_for >= ${today}
  ` as Array<{ text_ciphertext: string; text_nonce: string }>;
  const counts = new Map<string, number>();
  for (const r of upcomingRows) {
    const t = decrypt(r.text_ciphertext, r.text_nonce);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let duplicateScheduledQuestions = 0;
  for (const c of counts.values()) if (c > 1) duplicateScheduledQuestions++;

  // Note: this intentionally excludes calibration sessions (source_id = 3).
  // Three early calibration sessions (question_ids 42, 63, 64) have responses
  // but no session summaries because they predate the calibration event-logging
  // pipeline (2026-04-14 and 2026-04-17). They are not orphans from a
  // transaction bug. The response text is real and left in place.
  const [missingRow] = await sql`
    SELECT COUNT(*)::int AS c
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    LEFT JOIN tb_session_summaries ss ON ss.question_id = r.question_id
    WHERE q.subject_id = ${subjectId}
      AND q.question_source_id != 3
      AND ss.question_id IS NULL
  `;
  const sessionsMissingSummary = (missingRow as { c: number }).c;

  const recentErrors = readRecentErrors(20);
  const recentErrorJobs: string[] = [];
  for (const record of recentErrors) {
    const match = record.match(/\] \[([^\]]+)\]/);
    if (match) recentErrorJobs.push(match[1]);
  }
  const uniqueErrorJobs = Array.from(new Set(recentErrorJobs));

  // --- PENDING WORK --------------------------------------------------------
  // Embed work pending across ALL subjects (owner + subjects). When TEI is
  // offline (running `npm run dev` instead of `dev:full`) embeds accumulate
  // here and the operator drains them via `npm run backfill`.
  const embedRows = await sql`
    SELECT s.subject_id AS "subjectId", s.username, COUNT(*)::int AS cnt
    FROM tb_subjects s
    JOIN tb_responses r ON r.subject_id = s.subject_id
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
      AND NOT EXISTS (
        SELECT 1 FROM tb_embeddings e
        WHERE e.embedding_source_id = 1
          AND e.source_record_id = r.response_id
          AND e.invalidated_at IS NULL
      )
    GROUP BY s.subject_id, s.username
    HAVING COUNT(*) > 0
    ORDER BY cnt DESC
  ` as Array<{ subjectId: number; username: string; cnt: number }>;
  const embedsBySubject = embedRows.map(r => ({
    subject_id: r.subjectId, username: r.username, count: r.cnt,
  }));
  const pendingEmbeds = embedsBySubject.reduce((sum, r) => sum + r.count, 0);
  const teiAvailable = await isTeiAvailable();

  // Calibration extractions pending — calibration sessions (source_id = 3)
  // with no `tb_calibration_context` rows. The runCalibrationExtraction LLM
  // call writes these tags; on `npm run dev` (no ANTHROPIC_API_KEY) the call
  // fails and the row count stays 0. Operator drains by re-running with the
  // key set (currently manual: see followup queue).
  const extractionRows = await sql`
    SELECT s.subject_id AS "subjectId", s.username, COUNT(*)::int AS cnt
    FROM tb_subjects s
    JOIN tb_responses r ON r.subject_id = s.subject_id
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id = 3
      AND NOT EXISTS (
        SELECT 1 FROM tb_calibration_context cc
        WHERE cc.subject_id = s.subject_id AND cc.question_id = q.question_id
      )
    GROUP BY s.subject_id, s.username
    HAVING COUNT(*) > 0
    ORDER BY cnt DESC
  ` as Array<{ subjectId: number; username: string; cnt: number }>;
  const extractionsBySubject = extractionRows.map(r => ({
    subject_id: r.subjectId, username: r.username, count: r.cnt,
  }));
  const pendingExtractions = extractionsBySubject.reduce((sum, r) => sum + r.count, 0);
  const anthropicAvailable = !!process.env.ANTHROPIC_API_KEY;

  // Seed alerts — any subject with 0 < unanswered_seeds ≤ 5. Triggers the
  // owner to manually run an LLM corpus refresh (additive to tb_question_corpus,
  // never overwrites a subject's personal queue). See METHODS_PROVENANCE.md
  // INC-014 for the corpus-refresh pivot rationale.
  const seedAlertRows = await sql`
    SELECT subject_id AS "subjectId", username, remaining
    FROM (
      SELECT s.subject_id, s.username,
        COUNT(q.question_id) FILTER (
          WHERE q.question_source_id = 1
            AND NOT EXISTS (SELECT 1 FROM tb_responses r WHERE r.question_id = q.question_id)
        )::int AS remaining
      FROM tb_subjects s
      LEFT JOIN tb_questions q ON q.subject_id = s.subject_id
      GROUP BY s.subject_id, s.username
    ) t
    WHERE remaining > 0 AND remaining <= 5
    ORDER BY remaining ASC
  ` as Array<{ subjectId: number; username: string; remaining: number }>;
  const seedAlerts = seedAlertRows.map(r => ({
    subject_id: r.subjectId, username: r.username, remaining: r.remaining,
  }));

  // --- OVERALL -------------------------------------------------------------
  let overall: 'green' | 'yellow' | 'red' = 'green';
  if (lastSessionStatus && !lastSessionStatus.fullyProcessed) overall = 'red';
  else if (recentErrors.length > 0) overall = 'red';
  else if (!todayQuestion || !tomorrowQuestion) overall = 'yellow';
  else if (duplicateScheduledQuestions > 0 || sessionsMissingSummary > 0) overall = 'yellow';
  else if (pendingEmbeds > 0 || pendingExtractions > 0 || seedAlerts.length > 0) overall = 'yellow';

  const body: HealthResponse = {
    today: {
      date: today,
      questionReady: !!todayQuestion,
      sessionSubmittedToday,
    },
    lastSession: lastSessionStatus,
    sessions: {
      count: sessionCount,
      nextReflectionAt,
    },
    tomorrow: {
      questionReady: !!tomorrowQuestion,
    },
    anomalies: {
      duplicateScheduledQuestions,
      sessionsMissingSummary,
      recentErrorCount: recentErrors.length,
      recentErrorJobs: uniqueErrorJobs,
    },
    pendingWork: {
      embeds: pendingEmbeds,
      embedsBySubject,
      extractions: pendingExtractions,
      extractionsBySubject,
      seedAlerts,
      teiAvailable,
      anthropicAvailable,
    },
    rustEngine: hasNativeEngine,
    overall,
  };

  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
};
