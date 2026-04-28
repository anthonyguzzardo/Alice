/**
 * Observatory Inbox API
 *
 * Lists subject submissions since `?since=<ISO>` for the inbox badge + page.
 * Excludes the owner's own entries. Returns metadata only (no response text,
 * no question text — those are still encrypted at rest and only decrypted
 * at the per-entry detail page where the operator has clicked through).
 *
 * Designer-facing only — Caddy basic-auth gates /api/observatory/* on prod.
 */
import type { APIRoute } from 'astro';
import sql, { OWNER_SUBJECT_ID } from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

const MAX_ROWS = 100;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const sinceParam = url.searchParams.get('since');
    // Default to epoch when no cursor present so a fresh observer sees
    // every subject submission ever recorded (capped at MAX_ROWS).
    const since = sinceParam ?? '1970-01-01T00:00:00Z';

    const rows = await sql`
      SELECT
         r.response_id          AS "responseId"
        ,r.question_id          AS "questionId"
        ,r.subject_id           AS "subjectId"
        ,s.username             AS "username"
        ,s.display_name         AS "displayName"
        ,r.dttm_created_utc     AS "createdAt"
        ,q.scheduled_for::text  AS "scheduledFor"
      FROM tb_responses r
      JOIN tb_subjects s ON r.subject_id = s.subject_id
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE r.subject_id != ${OWNER_SUBJECT_ID}
        AND r.dttm_created_utc > ${since}::timestamptz
      ORDER BY r.dttm_created_utc DESC
      LIMIT ${MAX_ROWS}
    `;

    return new Response(JSON.stringify({
      submissions: rows,
      count: rows.length,
      cursor: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.observatory.inbox', err);
    return new Response(JSON.stringify({ error: 'failed to load inbox' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
