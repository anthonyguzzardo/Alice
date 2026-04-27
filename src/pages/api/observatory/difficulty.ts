/**
 * Observatory Difficulty-Residual Correlation API
 *
 * Joins prompt traces (difficulty classification + raw inputs) with
 * reconstruction residuals (L2 norms) to answer: do harder questions
 * produce larger ghosts?
 *
 * Join path: generation trace created on day N → question scheduled
 * for day N+1 → reconstruction residual for that question.
 */
import type { APIRoute } from 'astro';
import sql, { OWNER_SUBJECT_ID } from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  // Owner-only observatory endpoint.
  // TODO(step5): review.
  const subjectId = OWNER_SUBJECT_ID;
  try {
    const rows = await sql`
      SELECT
        pt.difficulty_level        AS "difficultyLevel",
        pt.difficulty_inputs       AS "difficultyInputs",
        q.question_id              AS "questionId",
        q.scheduled_for::text      AS date,
        q.question_source_id       AS "sourceId",
        rr.behavioral_l2_norm      AS "behavioralL2",
        rr.behavioral_residual_count AS "behavioralCount",
        rr.dynamical_l2_norm       AS "dynL2",
        rr.motor_l2_norm           AS "motL2",
        rr.perplexity_residual     AS "perpResidual",
        rr.semantic_l2_norm        AS "semL2",
        rr.total_l2_norm           AS "totalL2"
      FROM tb_prompt_traces pt
      JOIN tb_questions q
        ON q.scheduled_for = (pt.dttm_created_utc::date + INTERVAL '1 day')::date
       AND q.question_source_id = 2
      JOIN tb_reconstruction_residuals rr
        ON rr.question_id = q.question_id
      WHERE pt.subject_id = ${subjectId}
        AND q.subject_id = ${subjectId}
        AND rr.subject_id = ${subjectId}
        AND pt.prompt_trace_type_id = 1
        AND pt.difficulty_level IS NOT NULL
      ORDER BY q.scheduled_for ASC
    `;

    // Group by difficulty level for summary stats
    const byLevel: Record<string, { count: number; behavioralL2s: number[]; motL2s: number[]; dynL2s: number[] }> = {};
    for (const r of rows as any[]) {
      const level = r.difficultyLevel;
      if (!byLevel[level]) byLevel[level] = { count: 0, behavioralL2s: [], motL2s: [], dynL2s: [] };
      byLevel[level].count++;
      if (r.behavioralL2 != null && Number.isFinite(r.behavioralL2)) byLevel[level].behavioralL2s.push(r.behavioralL2);
      if (r.motL2 != null && Number.isFinite(r.motL2)) byLevel[level].motL2s.push(r.motL2);
      if (r.dynL2 != null && Number.isFinite(r.dynL2)) byLevel[level].dynL2s.push(r.dynL2);
    }

    const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const summary = Object.fromEntries(
      Object.entries(byLevel).map(([level, data]) => [level, {
        count: data.count,
        avgBehavioralL2: mean(data.behavioralL2s),
        avgMotorL2: mean(data.motL2s),
        avgDynamicalL2: mean(data.dynL2s),
      }])
    );

    return new Response(JSON.stringify({ sessions: rows, summary }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.observatory.difficulty', err);
    return new Response(JSON.stringify({ error: 'failed to load difficulty data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
