/**
 * Observatory Calibration Drift API
 *
 * Returns the history of calibration baseline snapshots with drift magnitudes.
 * Designer-facing only — surfaces whether the writer's neutral-writing
 * reference frame has been stable or drifting over time.
 */
import type { APIRoute } from 'astro';
import { getCalibrationHistory, OWNER_SUBJECT_ID } from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  // Owner-only observatory endpoint (Caddy basic-auth gated).
  // TODO(step5): review — per-subject drift view if subjects ever surface here.
  const subjectId = OWNER_SUBJECT_ID;
  try {
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
    logError('api.observatory.calibrationDrift', err);
    return new Response(JSON.stringify({ error: 'Failed to compute drift' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
