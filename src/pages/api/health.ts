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
import db from '../../lib/db.ts';
import { localDateStr } from '../../lib/date.ts';
import { readRecentErrors } from '../../lib/error-log.ts';

interface PipelineCoverage {
  embedded: boolean;
  entryState: boolean;
  observed: boolean;
  suppressedQuestion: boolean;
  witnessRendered: boolean;
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
  overall: 'green' | 'yellow' | 'red';
}

export const GET: APIRoute = () => {
  const today = localDateStr();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // --- TODAY ---------------------------------------------------------------
  const todayQuestion = db.prepare(`
    SELECT question_id, question_source_id
    FROM tb_questions WHERE scheduled_for = ?
  `).get(today) as { question_id: number; question_source_id: number } | undefined;

  const sessionSubmittedToday = todayQuestion
    ? !!db.prepare(`
        SELECT 1 FROM tb_responses r
        JOIN tb_questions q ON r.question_id = q.question_id
        WHERE q.scheduled_for = ? AND q.question_source_id != 3
      `).get(today)
    : false;

  // --- LAST SESSION --------------------------------------------------------
  const lastSession = db.prepare(`
    SELECT r.response_id, r.question_id, DATE(r.dttm_created_utc) AS day
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
    ORDER BY r.response_id DESC LIMIT 1
  `).get() as { response_id: number; question_id: number; day: string } | undefined;

  let lastSessionStatus: LastSessionStatus | null = null;
  if (lastSession) {
    const coverage = db.prepare(`
      SELECT
        (SELECT 1 FROM tb_embeddings WHERE source_record_id = ? AND embedding_source_id = 1) AS embedded,
        (SELECT 1 FROM tb_entry_states WHERE response_id = ?) AS entry_state,
        (SELECT 1 FROM tb_ai_observations WHERE question_id = ?) AS observed,
        (SELECT 1 FROM tb_ai_suppressed_questions WHERE question_id = ?) AS suppressed_q,
        (SELECT 1 FROM tb_trait_dynamics WHERE entry_count = (
           SELECT COUNT(*) FROM tb_session_summaries ss
           JOIN tb_questions q ON ss.question_id = q.question_id
           WHERE q.question_source_id != 3
         )) AS witness_rendered
    `).get(
      lastSession.response_id,
      lastSession.response_id,
      lastSession.question_id,
      lastSession.question_id,
    ) as { embedded: number | null; entry_state: number | null; observed: number | null; suppressed_q: number | null; witness_rendered: number | null };

    const pipeline: PipelineCoverage = {
      embedded: !!coverage.embedded,
      entryState: !!coverage.entry_state,
      observed: !!coverage.observed,
      suppressedQuestion: !!coverage.suppressed_q,
      witnessRendered: !!coverage.witness_rendered,
    };
    const missing: string[] = [];
    if (!pipeline.embedded) missing.push('embedding');
    if (!pipeline.entryState) missing.push('entry_state');
    if (!pipeline.observed) missing.push('observation');
    if (!pipeline.suppressedQuestion) missing.push('suppressed_question');
    if (!pipeline.witnessRendered) missing.push('witness');

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
  const sessionCount = (db.prepare(`
    SELECT COUNT(*) AS c FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
  `).get() as { c: number }).c;

  // Reflection cadence: fires when responseCount >= 5 && responseCount % 7 === 0
  // responseCount in respond.ts is total responses (see getResponseCount), not
  // sessions-only. We surface the next fire count as informational; if the
  // cadence is session-scoped instead, this number just reads differently.
  const totalResponses = (db.prepare(
    `SELECT COUNT(*) AS c FROM tb_responses`
  ).get() as { c: number }).c;
  let nextReflectionAt: number | null = null;
  if (totalResponses < 5) {
    nextReflectionAt = 7;
  } else {
    nextReflectionAt = Math.ceil((totalResponses + 1) / 7) * 7;
  }

  // --- TOMORROW -----------------------------------------------------------
  const tomorrowQuestion = db.prepare(`
    SELECT 1 FROM tb_questions WHERE scheduled_for = ?
  `).get(tomorrow);

  // --- ANOMALIES -----------------------------------------------------------
  const duplicateScheduledQuestions = (db.prepare(`
    SELECT COUNT(*) AS c FROM (
      SELECT text FROM tb_questions
      WHERE scheduled_for >= ?
      GROUP BY text HAVING COUNT(*) > 1
    )
  `).get(today) as { c: number }).c;

  const sessionsMissingSummary = (db.prepare(`
    SELECT COUNT(*) AS c
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    LEFT JOIN tb_session_summaries ss ON ss.question_id = r.question_id
    WHERE q.question_source_id != 3 AND ss.question_id IS NULL
  `).get() as { c: number }).c;

  const recentErrors = readRecentErrors(20);
  const recentErrorJobs: string[] = [];
  for (const record of recentErrors) {
    const match = record.match(/\] \[([^\]]+)\]/);
    if (match) recentErrorJobs.push(match[1]);
  }
  const uniqueErrorJobs = Array.from(new Set(recentErrorJobs));

  // --- OVERALL -------------------------------------------------------------
  let overall: 'green' | 'yellow' | 'red' = 'green';
  if (lastSessionStatus && !lastSessionStatus.fullyProcessed) overall = 'red';
  else if (recentErrors.length > 0) overall = 'red';
  else if (!todayQuestion || !tomorrowQuestion) overall = 'yellow';
  else if (duplicateScheduledQuestions > 0 || sessionsMissingSummary > 0) overall = 'yellow';

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
    overall,
  };

  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
};
