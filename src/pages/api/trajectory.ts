/**
 * Returns the trajectory analysis — per-entry dimensions,
 * convergence scores, velocity, and phase detection.
 *
 * No AI involved. Pure math on deterministic signals.
 */
import type { APIRoute } from 'astro';
import { computeTrajectory } from '../../lib/alice-negative/trajectory.ts';

export const GET: APIRoute = async () => {
  try {
    const analysis = computeTrajectory();
    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to compute trajectory' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
