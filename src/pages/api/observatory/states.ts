/**
 * Observatory States API
 *
 * Returns per-entry behavioral 7D + semantic 11D state vectors plus session
 * metadata, joined to question text and date. Designer-facing only.
 *
 * Pulls from the live alice.db (no more simulation hardcoding).
 */
import type { APIRoute } from 'astro';
import db from '../../../lib/db.ts';

export const GET: APIRoute = async () => {
  try {
    // Behavioral 7D states with question + replay availability
    const states = db.prepare(`
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
    `).all() as any[];

    // Semantic 11D states keyed by response_id
    const semanticRows = db.prepare(`
      SELECT
         response_id
        ,syntactic_complexity, interrogation, self_focus, uncertainty
        ,cognitive_processing
        ,nrc_anger, nrc_fear, nrc_joy, nrc_sadness, nrc_trust, nrc_anticipation
        ,convergence as semantic_convergence
      FROM tb_semantic_states
      ORDER BY semantic_state_id ASC
    `).all() as any[];
    const semanticByResponse = new Map<number, any>();
    for (const s of semanticRows) semanticByResponse.set(s.response_id, s);

    // Session metadata (slice-3 follow-ups) keyed by question_id
    const metaRows = db.prepare(`
      SELECT
         question_id
        ,hour_typicality, deletion_curve_type, burst_trajectory_shape
        ,inter_burst_interval_mean_ms, inter_burst_interval_std_ms
        ,deletion_during_burst_count, deletion_between_burst_count
      FROM tb_session_metadata
    `).all() as any[];
    const metaByQuestion = new Map<number, any>();
    for (const m of metaRows) metaByQuestion.set(m.question_id, m);

    // Replay availability: which question_ids have an event log
    const replayRows = db.prepare(`SELECT DISTINCT question_id FROM tb_session_events`).all() as Array<{ question_id: number }>;
    const replayAvailable = new Set(replayRows.map(r => r.question_id));

    const enriched = states.map(s => ({
      ...s,
      semantic: semanticByResponse.get(s.response_id) ?? null,
      metadata: metaByQuestion.get(s.question_id) ?? null,
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
