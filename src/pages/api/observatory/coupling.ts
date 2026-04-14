/**
 * Observatory Coupling API
 *
 * Returns the coupling matrix, emotion-behavior couplings,
 * and per-dimension dynamics for the latest entry count.
 */
import type { APIRoute } from 'astro';
import {
  getEntryStateCount,
  getLatestCouplingMatrix,
  getLatestEmotionBehaviorCoupling,
  getLatestTraitDynamics,
} from '../../../lib/db.ts';

export const GET: APIRoute = async () => {
  try {
    const entryCount = getEntryStateCount();
    const couplings = getLatestCouplingMatrix(entryCount);
    const emotionCouplings = getLatestEmotionBehaviorCoupling(entryCount);
    const dynamics = getLatestTraitDynamics(entryCount);

    return new Response(JSON.stringify({
      entryCount,
      couplings,
      emotionCouplings,
      dynamics,
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
