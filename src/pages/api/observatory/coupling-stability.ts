/**
 * Observatory Coupling Stability API
 *
 * Computes within-person stability of emotion→behavior couplings
 * using rolling-window analysis. Prerequisite for ghost comparison:
 * if coupling is not stable, comparing to a decoupled ghost is
 * tautological.
 *
 * Returns: stable pairs, unstable pairs, stability rate, and
 * per-pair convergence trajectories for visualization.
 */
import type { APIRoute } from 'astro';
import { computeCouplingStability } from '../../../lib/libCouplingStability.ts';
import { OWNER_SUBJECT_ID } from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  // Owner-only observatory endpoint.
  // TODO(step5): review — per-subject coupling stability if subjects ever surface here.
  const subjectId = OWNER_SUBJECT_ID;
  try {
    const result = await computeCouplingStability(subjectId);

    // Serialize trajectories with condensed window data
    const serializePair = (t: typeof result.allPairs[number]) => ({
      emotionDim: t.emotionDim,
      behaviorDim: t.behaviorDim,
      finalCorrelation: t.finalCorrelation,
      finalLag: t.finalLag,
      finalDirection: t.finalDirection,
      cv: t.cv,
      isStable: t.isStable,
      trendSlope: t.trendSlope,
      trajectory: t.windowSizes.map((w, i) => ({
        n: w,
        r: t.correlations[i],
        lag: t.lags[i],
      })),
    });

    return new Response(JSON.stringify({
      entryCount: result.entryCount,
      windowCount: result.windowCount,
      stabilityRate: result.stabilityRate,
      stableCount: result.stablePairs.length,
      unstableCount: result.unstablePairs.length,
      totalPairs: result.allPairs.length,
      stable: result.stablePairs.map(serializePair),
      unstable: result.unstablePairs.map(serializePair),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.observatory.coupling-stability', err);
    return new Response(JSON.stringify({ error: 'failed to compute coupling stability' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
