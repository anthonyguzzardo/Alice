/**
 * Observatory States API — hardcoded to simulation DB.
 * Returns 8D states + question text + event annotations per entry.
 */
import type { APIRoute } from 'astro';
import simDb from '../../../lib/sim-db.ts';

export const GET: APIRoute = async () => {
  try {
    const states = simDb.prepare(`
      SELECT es.response_id, q.scheduled_for as date, q.text as question,
             es.fluency, es.deliberation, es.revision, es.expression,
             es.commitment, es.volatility, es.thermal, es.presence, es.convergence
      FROM tb_entry_states es
      JOIN tb_responses r ON es.response_id = r.response_id
      JOIN tb_questions q ON r.question_id = q.question_id
      ORDER BY es.entry_state_id ASC
    `).all() as any[];

    // Build date→scheduled_for lookup
    const dateSet = new Set(states.map((s: any) => s.date));

    // Predictions graded on each date (confirmed/falsified)
    const gradedPredictions = simDb.prepare(`
      SELECT p.prediction_id, p.question_id as origin_question_id,
             q_origin.scheduled_for as origin_date,
             s.enum_code as status,
             p.dttm_graded_utc,
             p.hypothesis, p.favored_frame, p.target_topic,
             p.grade_rationale
      FROM tb_predictions p
      JOIN te_prediction_status s ON p.prediction_status_id = s.prediction_status_id
      JOIN tb_questions q_origin ON p.question_id = q_origin.question_id
      WHERE p.prediction_status_id IN (2, 3)
      ORDER BY p.dttm_graded_utc
    `).all() as any[];

    // Map graded predictions to the date they were graded on
    const gradedByDate = new Map<string, any[]>();
    for (const p of gradedPredictions) {
      const gradedDate = p.dttm_graded_utc?.slice(0, 10);
      if (!gradedDate) continue;
      if (!gradedByDate.has(gradedDate)) gradedByDate.set(gradedDate, []);
      gradedByDate.get(gradedDate)!.push(p);
    }

    // Theory retirements
    const theories = simDb.prepare(`
      SELECT theory_key, status, log_bayes_factor,
             total_predictions, dttm_modified_utc
      FROM tb_theory_confidence
      WHERE status = 'retired'
    `).all() as any[];

    // Map theory retirements to the date they were retired
    const theoriesByDate = new Map<string, any[]>();
    for (const t of theories) {
      const retiredDate = t.dttm_modified_utc?.slice(0, 10);
      if (!retiredDate) continue;
      if (!theoriesByDate.has(retiredDate)) theoriesByDate.set(retiredDate, []);
      theoriesByDate.get(retiredDate)!.push(t);
    }

    // Suppressed questions per entry
    const suppressed = simDb.prepare(`
      SELECT question_id, suppressed_text
      FROM tb_ai_suppressed_questions
    `).all() as any[];
    const suppressedByQ = new Map<number, string>();
    for (const sq of suppressed) {
      suppressedByQ.set(sq.question_id, sq.suppressed_text);
    }

    // Question ID lookup for suppressed questions
    const qIdRows = simDb.prepare(`
      SELECT r.response_id, q.question_id
      FROM tb_entry_states es
      JOIN tb_responses r ON es.response_id = r.response_id
      JOIN tb_questions q ON r.question_id = q.question_id
    `).all() as any[];
    const qIdByResponseId = new Map<number, number>();
    for (const row of qIdRows) {
      qIdByResponseId.set(row.response_id, row.question_id);
    }

    // Attach annotations to each state
    const enrichedStates = states.map((s: any) => {
      const events: any[] = [];

      // Predictions graded on this date
      const graded = gradedByDate.get(s.date) || [];
      for (const p of graded) {
        events.push({
          type: p.status, // 'confirmed' or 'falsified'
          hypothesis: p.hypothesis,
          originDate: p.origin_date,
          rationale: p.grade_rationale,
        });
      }

      // Theories retired on this date
      const retired = theoriesByDate.get(s.date) || [];
      for (const t of retired) {
        events.push({
          type: 'theory_retired',
          theoryKey: t.theory_key,
          bayesFactor: t.log_bayes_factor,
          predictionCount: t.total_predictions,
        });
      }

      const qId = qIdByResponseId.get(s.response_id);
      const suppressedText = qId ? suppressedByQ.get(qId) : undefined;

      return {
        ...s,
        events: events.length > 0 ? events : undefined,
        suppressed: suppressedText || undefined,
      };
    });

    return new Response(JSON.stringify({ states: enrichedStates }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Observatory states error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Failed to load entry states', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
