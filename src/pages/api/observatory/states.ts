/**
 * Observatory States API
 *
 * Returns a per-entry envelope keyed on tb_responses, joined to question
 * text + date and to live signal tables (motor, phase2, process,
 * cross-session, discourse). Designer-facing only.
 *
 * Pre-2026-04-27 this endpoint anchored on tb_entry_states and surfaced
 * 7D behavioral z-scores. tb_entry_states was archived (migration 036,
 * INC-017) along with the radar UI that consumed it; the endpoint was
 * re-anchored on tb_responses to keep the rest of the trajectory page alive.
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDb.ts';
import { decrypt } from '../../../lib/libCrypto.ts';
import { logError } from '../../../lib/utlErrorLog.ts';
import { resolveObservatorySubjectId, badSubjectResponse } from '../../../lib/libObservatorySubject.ts';

export const GET: APIRoute = async ({ request }) => {
  try {
    const subjectId = await resolveObservatorySubjectId(request);
    // One row per journal response (calibration sessions excluded).
    // Migration 031: question text is encrypted at rest (text_ciphertext +
    // text_nonce). Bulk-select the ciphertext columns and decrypt in JS so
    // we don't fan out to N libDb getQuestionTextById calls.
    const stateRows = await sql`
      SELECT
         r.response_id
        ,r.question_id
        ,q.scheduled_for as date
        ,q.text_ciphertext as "qCt"
        ,q.text_nonce as "qNonce"
      FROM tb_responses r
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
      ORDER BY r.response_id ASC
    ` as Array<Record<string, unknown> & { qCt: string; qNonce: string }>;
    const states = stateRows.map(({ qCt, qNonce, ...rest }) => ({
      ...rest,
      question: decrypt(qCt, qNonce),
    })) as any[];

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
    const r = badSubjectResponse(err);
    if (r) return r;
    logError('api.observatory.states', err);
    return new Response(JSON.stringify({ error: 'Failed to load entries' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
