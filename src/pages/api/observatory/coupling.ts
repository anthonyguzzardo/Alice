/**
 * Observatory Coupling API
 *
 * Returns the latest behavioral 7D + semantic 11D dynamics + couplings, plus
 * cross-domain emotion→behavior coupling. Designer-facing only.
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  try {
    const [behCountRow] = await sql`SELECT COUNT(*)::int as c FROM tb_entry_states`;
    const behavioralCount = (behCountRow as { c: number }).c;
    const [semCountRow] = await sql`SELECT COUNT(*)::int as c FROM tb_semantic_states`;
    const semanticCount = (semCountRow as { c: number }).c;

    // Latest behavioral coupling + dynamics for the current entry count
    const behavioralCouplings = await sql`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_coupling_matrix
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_coupling_matrix)
      ORDER BY correlation DESC
    `;

    const behavioralDynamics = await sql`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation, window_size
      FROM tb_trait_dynamics
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_trait_dynamics)
      ORDER BY dimension
    `;

    // Semantic dynamics + coupling
    const semanticCouplings = await sql`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_semantic_coupling
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_semantic_coupling)
      ORDER BY correlation DESC
    `;

    const semanticDynamics = await sql`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation, window_size
      FROM tb_semantic_dynamics
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_semantic_dynamics)
      ORDER BY dimension
    `;

    // Emotion → behavior cross-domain coupling
    const emotionCouplings = await sql`
      SELECT emotion_dim, behavior_dim, lag_sessions, correlation, direction
      FROM tb_emotion_behavior_coupling
      WHERE entry_count = (SELECT MAX(entry_count) FROM tb_emotion_behavior_coupling)
      ORDER BY correlation DESC
    `;

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
  } catch (err) {
    logError('api.observatory.coupling', err);
    return new Response(JSON.stringify({ error: 'Failed to compute coupling' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
