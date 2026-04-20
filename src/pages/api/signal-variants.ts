/**
 * Signal Variant Tree API
 *
 * Runs ablation analysis on the full signal pipeline:
 *   - Leave-one-out: remove each family, measure deviation
 *   - Solo: keep only one family, measure what it explains
 *   - Correlation: which families are redundant
 *
 * GET /api/signal-variants
 */

import type { APIRoute } from 'astro';
import { computeVariantTree, SIGNAL_FAMILIES } from '../../lib/libSignalFamilies.ts';

export const GET: APIRoute = async () => {
  try {
    const result = await computeVariantTree();

    // Strip full baseline states to keep response lean — frontend only needs summaries
    const { baseline, ...rest } = result;

    return new Response(JSON.stringify({
      ...rest,
      families: SIGNAL_FAMILIES.map(f => ({
        id: f.id,
        label: f.label,
        description: f.description,
        sessionFields: f.sessionFields,
        feedsDimensions: f.feedsDimensions,
        citation: f.citation,
        isObservationOnly: f.feedsDimensions.length === 0,
      })),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Signal variant analysis failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
