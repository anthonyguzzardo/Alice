/**
 * Observatory Cross-Session Signals API
 *
 * Returns longitudinal cross-session signals for every journal session:
 * self-perplexity, motor self-perplexity, NCD at multiple lags,
 * vocab recurrence decay, digraph stability, text network metrics.
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDbPool.ts';
import { logError } from '../../../lib/utlErrorLog.ts';
import { resolveObservatorySubjectId, badSubjectResponse } from '../../../lib/libObservatorySubject.ts';

export const GET: APIRoute = async ({ request }) => {
  try {
    const subjectId = await resolveObservatorySubjectId(request);
    const sessions = await sql`
      SELECT
        cs.question_id,
        q.scheduled_for::text AS date,
        cs.self_perplexity,
        cs.motor_self_perplexity,
        cs.ncd_lag_1,
        cs.ncd_lag_3,
        cs.ncd_lag_7,
        cs.ncd_lag_30,
        cs.vocab_recurrence_decay,
        cs.digraph_stability,
        cs.text_network_density,
        cs.text_network_communities,
        cs.bridging_ratio
      FROM tb_cross_session_signals cs
      JOIN tb_questions q ON cs.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
      ORDER BY q.scheduled_for ASC
    `;

    return new Response(JSON.stringify({ sessions }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const r = badSubjectResponse(err);
    if (r) return r;
    logError('api.observatory.crossSession', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch cross-session data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
