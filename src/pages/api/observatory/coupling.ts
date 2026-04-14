/**
 * Observatory Coupling API — hardcoded to simulation DB.
 */
import type { APIRoute } from 'astro';
import simDb from '../../../lib/sim-db.ts';

export const GET: APIRoute = async () => {
  try {
    const entryCount = (simDb.prepare(
      'SELECT COUNT(*) as c FROM tb_entry_states'
    ).get() as any).c;

    const couplings = simDb.prepare(`
      SELECT leader, follower, lag_sessions, correlation, direction
      FROM tb_coupling_matrix
      WHERE entry_count = ?
      ORDER BY correlation DESC
    `).all(entryCount);

    const emotionCouplings = simDb.prepare(`
      SELECT emotion_dim, behavior_dim, lag_sessions, correlation, direction
      FROM tb_emotion_behavior_coupling
      WHERE entry_count = ?
      ORDER BY correlation DESC
    `).all(entryCount);

    const dynamics = simDb.prepare(`
      SELECT dimension, baseline, variability, attractor_force, current_state, deviation, window_size
      FROM tb_trait_dynamics
      WHERE entry_count = ?
      ORDER BY dimension
    `).all(entryCount);

    const theories = simDb.prepare(`
      SELECT theory_key, description, alpha, beta, total_predictions,
             log_bayes_factor, status
      FROM tb_theory_confidence
      ORDER BY ABS(log_bayes_factor) DESC
    `).all();

    return new Response(JSON.stringify({
      entryCount,
      couplings,
      emotionCouplings,
      dynamics,
      theories,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to load coupling data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
