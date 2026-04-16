/**
 * Observatory Coupling API
 *
 * Returns the latest behavioral 7D + semantic 11D dynamics + couplings, plus
 * cross-domain emotion→behavior coupling. Designer-facing only.
 */
import type { APIRoute } from 'astro';
import db from '../../../lib/db.ts';

export const GET: APIRoute = async () => {
  try {
    const behavioralCount = (db.prepare(
      'SELECT COUNT(*) as c FROM tb_entry_states'
    ).get() as { c: number }).c;
    const semanticCount = (db.prepare(
      'SELECT COUNT(*) as c FROM tb_semantic_states'
    ).get() as { c: number }).c;

    // Latest behavioral coupling + dynamics for the current entry count
    const behavioralCouplings = db.prepare(`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_coupling_matrix
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_coupling_matrix)
      ORDER BY correlation DESC
    `).all();

    const behavioralDynamics = db.prepare(`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation, window_size
      FROM tb_trait_dynamics
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_trait_dynamics)
      ORDER BY dimension
    `).all();

    // Semantic dynamics + coupling
    const semanticCouplings = db.prepare(`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_semantic_coupling
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_semantic_coupling)
      ORDER BY correlation DESC
    `).all();

    const semanticDynamics = db.prepare(`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation, window_size
      FROM tb_semantic_dynamics
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_semantic_dynamics)
      ORDER BY dimension
    `).all();

    // Emotion → behavior cross-domain coupling
    const emotionCouplings = db.prepare(`
      SELECT emotion_dim, behavior_dim, lag_sessions, correlation, direction
      FROM tb_emotion_behavior_coupling
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_emotion_behavior_coupling)
      ORDER BY correlation DESC
    `).all();

    return new Response(JSON.stringify({
      behavioralCount,
      semanticCount,
      behavioralDynamics,
      behavioralCouplings,
      semanticDynamics,
      semanticCouplings,
      emotionCouplings,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Observatory coupling error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Failed to load coupling data', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
