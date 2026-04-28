/**
 * Observatory Calibration Drift API
 *
 * Returns the history of calibration baseline snapshots with drift magnitudes.
 * Designer-facing only — surfaces whether the writer's neutral-writing
 * reference frame has been stable or drifting over time.
 */
import type { APIRoute } from 'astro';
import { getCalibrationHistory } from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';
import { resolveObservatorySubjectId, badSubjectResponse } from '../../../lib/libObservatorySubject.ts';

export const GET: APIRoute = async ({ request }) => {
  try {
    const subjectId = await resolveObservatorySubjectId(request);
    const history = await getCalibrationHistory(subjectId);

    // Split into global and per-device tracks
    const globalTrack = history.filter(h => h.device_type == null);
    const deviceTracks: Record<string, typeof history> = {};
    for (const h of history) {
      if (h.device_type) {
        if (!deviceTracks[h.device_type]) deviceTracks[h.device_type] = [];
        deviceTracks[h.device_type].push(h);
      }
    }

    return new Response(JSON.stringify({
      globalTrack,
      deviceTracks,
      totalSnapshots: history.length,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const r = badSubjectResponse(err);
    if (r) return r;
    logError('api.observatory.calibrationDrift', err);
    return new Response(JSON.stringify({ error: 'Failed to compute drift' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
