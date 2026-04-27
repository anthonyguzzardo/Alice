/**
 * Observatory Process Signals API
 *
 * Returns writing process signals for every journal session:
 * pause architecture, burst classification, vocab expansion,
 * phase transitions, strategy shifts.
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDbPool.ts';
import { OWNER_SUBJECT_ID } from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  // Owner-only observatory endpoint.
  // TODO(step5): review.
  const subjectId = OWNER_SUBJECT_ID;
  try {
    const sessions = await sql`
      SELECT
        ps.question_id,
        q.scheduled_for::text AS date,
        ps.pause_within_word,
        ps.pause_between_word,
        ps.pause_between_sentence,
        ps.abandoned_thought_count,
        ps.r_burst_count,
        ps.i_burst_count,
        ps.vocab_expansion_rate,
        ps.phase_transition_point,
        ps.strategy_shift_count
      FROM tb_process_signals ps
      JOIN tb_questions q ON ps.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
      ORDER BY q.scheduled_for ASC
    `;

    return new Response(JSON.stringify({ sessions }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.observatory.process', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch process data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
