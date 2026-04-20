/**
 * Observatory Calibration Drift API
 *
 * Returns the history of calibration baseline snapshots with drift magnitudes.
 * Designer-facing only — surfaces whether the writer's neutral-writing
 * reference frame has been stable or drifting over time.
 */
import type { APIRoute } from 'astro';
import { getCalibrationHistory } from '../../../lib/libDb.ts';

export const GET: APIRoute = async () => {
  try {
    const history = await getCalibrationHistory();

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
  } catch (err: any) {
    console.error('Calibration drift error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Failed to load calibration drift', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
