/**
 * Observatory Session Integrity API
 *
 * Returns per-session profile distance scores and flag status.
 * Powers the integrity panel on the observatory overview.
 * Never surfaces raw signal values or response text.
 */
import type { APIRoute } from 'astro';
import sql, { OWNER_SUBJECT_ID } from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  // Owner-only observatory endpoint.
  // TODO(step5): review.
  const subjectId = OWNER_SUBJECT_ID;
  try {
    const sessions = await sql`
      SELECT
        si.question_id          AS "questionId",
        q.scheduled_for::text   AS date,
        q.question_source_id    AS "sourceId",
        si.profile_distance     AS "distance",
        si.dimension_count      AS "dimCount",
        si.is_flagged           AS "flagged",
        si.threshold_used       AS "threshold",
        si.profile_session_count AS "profileN",
        si.z_scores_json        AS "zScores"
      FROM tb_session_integrity si
      LEFT JOIN tb_questions q ON si.question_id = q.question_id
      WHERE si.subject_id = ${subjectId}
      ORDER BY COALESCE(q.scheduled_for, si.dttm_created_utc::date) ASC
    `;

    const distances = (sessions as any[])
      .map(s => s.distance)
      .filter(v => v != null && Number.isFinite(v));

    const mean = distances.length > 0
      ? distances.reduce((a: number, b: number) => a + b, 0) / distances.length
      : null;
    const stdDev = distances.length > 1 && mean != null
      ? Math.sqrt(distances.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / (distances.length - 1))
      : null;

    const flaggedCount = (sessions as any[]).filter(s => s.flagged).length;

    // Most deviant dimensions across all sessions
    const dimDeviations: Record<string, number[]> = {};
    for (const s of sessions as any[]) {
      const zScores = typeof s.zScores === 'string' ? JSON.parse(s.zScores) : s.zScores;
      if (!zScores) continue;
      for (const [dim, z] of Object.entries(zScores)) {
        if (!dimDeviations[dim]) dimDeviations[dim] = [];
        dimDeviations[dim]!.push(Math.abs(z as number));
      }
    }
    const dimSummary = Object.entries(dimDeviations)
      .map(([dim, vals]) => ({
        dim,
        meanAbsZ: vals.reduce((a, b) => a + b, 0) / vals.length,
        maxAbsZ: Math.max(...vals),
        count: vals.length,
      }))
      .sort((a, b) => b.meanAbsZ - a.meanAbsZ);

    return new Response(JSON.stringify({
      sessions,
      summary: {
        count: sessions.length,
        flaggedCount,
        meanDistance: mean,
        stdDevDistance: stdDev,
        dimSummary,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.observatory.integrity', err);
    return new Response(JSON.stringify({ error: 'failed to load integrity data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
