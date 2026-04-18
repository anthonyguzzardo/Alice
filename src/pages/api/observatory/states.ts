/**
 * Observatory States API
 *
 * Returns per-entry behavioral 7D + semantic 11D state vectors plus session
 * metadata, joined to question text and date. Designer-facing only.
 *
 * Pulls from the live alice.db (no more simulation hardcoding).
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/db.ts';

export const GET: APIRoute = async () => {
  try {
    // Behavioral 7D states with question + replay availability
    const states = await sql`
      SELECT
         es.response_id
        ,r.question_id
        ,q.scheduled_for as date
        ,q.text as question
        ,es.fluency, es.deliberation, es.revision
        ,es.commitment, es.volatility, es.thermal, es.presence
        ,es.convergence
      FROM tb_entry_states es
      JOIN tb_responses r ON es.response_id = r.response_id
      JOIN tb_questions q ON r.question_id = q.question_id
      ORDER BY es.entry_state_id ASC
    ` as any[];

    // Semantic 11D states keyed by response_id
    const semanticRows = await sql`
      SELECT
         response_id
        ,syntactic_complexity, interrogation, self_focus, uncertainty
        ,cognitive_processing
        ,nrc_anger, nrc_fear, nrc_joy, nrc_sadness, nrc_trust, nrc_anticipation
        ,convergence as semantic_convergence
      FROM tb_semantic_states
      ORDER BY semantic_state_id ASC
    ` as any[];
    const semanticByResponse = new Map<number, any>();
    for (const s of semanticRows) semanticByResponse.set(s.response_id, s);

    // Session metadata (slice-3 follow-ups) keyed by question_id
    const metaRows = await sql`
      SELECT
         question_id
        ,hour_typicality, deletion_curve_type, burst_trajectory_shape
        ,inter_burst_interval_mean_ms, inter_burst_interval_std_ms
        ,deletion_during_burst_count, deletion_between_burst_count
      FROM tb_session_metadata
    ` as any[];
    const metaByQuestion = new Map<number, any>();
    for (const m of metaRows) metaByQuestion.set(m.question_id, m);

    // Motor signals keyed by question_id (Phase 2 expansion)
    const motorRows = await sql`
      SELECT
         question_id
        ,ex_gaussian_tau, ex_gaussian_mu, ex_gaussian_sigma
        ,tau_proportion, adjacent_hold_time_cov
        ,sample_entropy, motor_jerk, lapse_rate, tempo_drift
      FROM tb_motor_signals
    ` as any[];
    const motorByQuestion = new Map<number, any>();
    for (const m of motorRows) motorByQuestion.set(m.question_id, m);

    // Phase 2 cursor/revision/punctuation signals keyed by question_id
    const phase2Rows = await sql`
      SELECT
         question_id
        ,cursor_fidget_ratio, cursor_stillness_during_pauses
        ,deletion_execution_speed_mean, postcorrection_latency_mean
        ,mean_revision_distance, punctuation_letter_ratio
      FROM tb_session_summaries
      WHERE cursor_fidget_ratio IS NOT NULL OR punctuation_letter_ratio IS NOT NULL
    ` as any[];
    const phase2ByQuestion = new Map<number, any>();
    for (const p of phase2Rows) phase2ByQuestion.set(p.question_id, p);

    // Replay availability: which question_ids have an event log
    const replayRows = await sql`SELECT DISTINCT question_id FROM tb_session_events` as Array<{ question_id: number }>;
    const replayAvailable = new Set(replayRows.map(r => r.question_id));

    const enriched = states.map(s => ({
      ...s,
      semantic: semanticByResponse.get(s.response_id) ?? null,
      metadata: metaByQuestion.get(s.question_id) ?? null,
      motor: motorByQuestion.get(s.question_id) ?? null,
      phase2: phase2ByQuestion.get(s.question_id) ?? null,
      replayAvailable: replayAvailable.has(s.question_id),
    }));

    return new Response(JSON.stringify({ states: enriched }, null, 2), {
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
