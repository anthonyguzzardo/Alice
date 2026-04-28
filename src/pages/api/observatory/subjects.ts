/**
 * Observatory Subjects API
 *
 * Lists active subjects for the observatory subject picker. Designer-facing
 * only — Caddy basic-auth gates /observatory/* on prod. Returns plaintext
 * username + display_name (these columns are not encrypted).
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDbPool.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  try {
    const rows = await sql`
      SELECT subject_id     AS "subject_id"
            ,username        AS "username"
            ,display_name    AS "display_name"
            ,is_owner        AS "is_owner"
      FROM tb_subjects
      WHERE is_active = TRUE
      ORDER BY is_owner DESC, subject_id ASC
    `;
    return new Response(JSON.stringify({ subjects: rows }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.observatory.subjects', err);
    return new Response(JSON.stringify({ error: 'failed to load subjects' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
