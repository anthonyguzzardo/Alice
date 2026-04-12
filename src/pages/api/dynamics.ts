/**
 * Behavioral Dynamics API
 *
 * Returns the full PersDyn dynamics analysis: per-dimension parameters,
 * empirical coupling matrix, phase, velocity, and system entropy.
 *
 * No AI involved. Pure math on deterministic signals.
 *
 * Research basis:
 *   PersDyn     — Sosnowska, Kuppens, De Fruyt & Hofmans (KU Leuven, 2019)
 *   Coupling    — Critcher (Berkeley xLab) causal trait theories
 *   Entropy     — Rodriguez (2025) ECTO framework
 */
import type { APIRoute } from 'astro';
import { computeEntryStates } from '../../lib/alice-negative/state-engine.ts';
import { computeDynamics } from '../../lib/alice-negative/dynamics.ts';

export const GET: APIRoute = async () => {
  try {
    const states = computeEntryStates();
    const dynamics = computeDynamics(states);

    return new Response(JSON.stringify({
      ...dynamics,
      states: states.slice(-20), // Include last 20 entry states for context
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to compute dynamics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
