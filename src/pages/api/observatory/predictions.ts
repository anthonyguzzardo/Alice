/**
 * Observatory Predictions API — ARCHIVED 2026-04-16
 *
 * Prediction registry was removed in the interpretive-layer restructure.
 * Data preserved under zz_archive_predictions_20260416.
 * Endpoint returns empty to keep frontend code non-crashing during slice 2.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ predictions: [] }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
