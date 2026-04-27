/**
 * Observatory States API
 *
 * Returns per-entry behavioral 7D + semantic 11D state vectors plus session
 * metadata, joined to question text and date. Designer-facing only.
 *
 * Pulls from the live PostgreSQL database.
 */
import type { APIRoute } from 'astro';
import sql, { OWNER_SUBJECT_ID } from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  // Owner-only observatory endpoint.
  // TODO(step5): review.
  const subjectId = OWNER_SUBJECT_ID;
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
      WHERE q.subject_id = ${subjectId}
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
      WHERE subject_id = ${subjectId}
      ORDER BY semantic_state_id ASC
    ` as any[];
    const semanticByResponse = new Map<number, any>();
    for (const s of semanticRows) semanticByResponse.set(s.response_id, s);

    // Session metadata (slice-3 follow-ups) keyed by question_id
    const metaRows = await sql`
      SELECT
         question_id
        ,hour_typicality, deletion_curve_type, burst_trajectory_shape
        ,rburst_trajectory_shape
        ,inter_burst_interval_mean_ms, inter_burst_interval_std_ms
        ,deletion_during_burst_count, deletion_between_burst_count
      FROM tb_session_metadata
      WHERE subject_id = ${subjectId}
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
      WHERE subject_id = ${subjectId}
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
      WHERE subject_id = ${subjectId}
        AND (cursor_fidget_ratio IS NOT NULL OR punctuation_letter_ratio IS NOT NULL)
    ` as any[];
    const phase2ByQuestion = new Map<number, any>();
    for (const p of phase2Rows) phase2ByQuestion.set(p.question_id, p);

    // Process signals keyed by question_id
    const processRows = await sql`
      SELECT
         question_id
        ,pause_within_word, pause_between_word, pause_between_sentence
        ,abandoned_thought_count, r_burst_count, i_burst_count
        ,vocab_expansion_rate, phase_transition_point, strategy_shift_count
      FROM tb_process_signals
      WHERE subject_id = ${subjectId}
    ` as any[];
    const processByQuestion = new Map<number, any>();
    for (const p of processRows) processByQuestion.set(p.question_id, p);

    // Cross-session signals keyed by question_id
    const crossSessionRows = await sql`
      SELECT
         question_id
        ,self_perplexity, motor_self_perplexity
        ,ncd_lag_1, ncd_lag_3, ncd_lag_7, ncd_lag_30
        ,vocab_recurrence_decay, digraph_stability
        ,text_network_density, text_network_communities, bridging_ratio
      FROM tb_cross_session_signals
      WHERE subject_id = ${subjectId}
    ` as any[];
    const crossSessionByQuestion = new Map<number, any>();
    for (const c of crossSessionRows) crossSessionByQuestion.set(c.question_id, c);

    // Discourse coherence from semantic signals keyed by question_id
    const discourseRows = await sql`
      SELECT
         question_id
        ,discourse_global_coherence, discourse_local_coherence
        ,discourse_global_local_ratio, discourse_coherence_decay_slope
      FROM tb_semantic_signals
      WHERE subject_id = ${subjectId}
        AND discourse_global_coherence IS NOT NULL
    ` as any[];
    const discourseByQuestion = new Map<number, any>();
    for (const d of discourseRows) discourseByQuestion.set(d.question_id, d);

    // Replay availability: which question_ids have an event log
    const replayRows = await sql`SELECT DISTINCT question_id FROM tb_session_events WHERE subject_id = ${subjectId}` as Array<{ question_id: number }>;
    const replayAvailable = new Set(replayRows.map(r => r.question_id));

    const enriched = states.map(s => ({
      ...s,
      semantic: semanticByResponse.get(s.response_id) ?? null,
      metadata: metaByQuestion.get(s.question_id) ?? null,
      motor: motorByQuestion.get(s.question_id) ?? null,
      phase2: phase2ByQuestion.get(s.question_id) ?? null,
      process: processByQuestion.get(s.question_id) ?? null,
      crossSession: crossSessionByQuestion.get(s.question_id) ?? null,
      discourse: discourseByQuestion.get(s.question_id) ?? null,
      replayAvailable: replayAvailable.has(s.question_id),
    }));

    return new Response(JSON.stringify({ states: enriched }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.observatory.states', err);
    return new Response(JSON.stringify({ error: 'Failed to load entry states' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
