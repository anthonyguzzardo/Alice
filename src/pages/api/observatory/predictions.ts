/**
 * Observatory Predictions API
 *
 * Returns all predictions with status, for the scoreboard and recent calls view.
 */
import type { APIRoute } from 'astro';
import simDb from '../../../lib/sim-db.ts';

export const GET: APIRoute = async () => {
  try {
    const predictions = simDb.prepare(`
      SELECT p.prediction_id, p.hypothesis,
             p.favored_frame, p.target_topic,
             s.enum_code as status,
             p.grade_rationale,
             q.scheduled_for as origin_date,
             p.dttm_created_utc,
             p.dttm_graded_utc
      FROM tb_predictions p
      JOIN te_prediction_status s ON p.prediction_status_id = s.prediction_status_id
      JOIN tb_questions q ON p.question_id = q.question_id
      ORDER BY p.dttm_created_utc DESC
    `).all();

    return new Response(JSON.stringify({ predictions }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Predictions API error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Failed to load predictions', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
