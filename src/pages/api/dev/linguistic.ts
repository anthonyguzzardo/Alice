/**
 * Dev-only endpoint: computes linguistic densities from raw text.
 * No DB, no persistence — just the math.
 */
import type { APIRoute } from 'astro';
import { computeLinguisticDensities } from '../../../lib/linguistic.ts';

export const POST: APIRoute = async ({ request }) => {
  const { text } = await request.json();
  if (typeof text !== 'string') {
    return new Response(JSON.stringify({ error: 'text required' }), { status: 400 });
  }
  const densities = computeLinguisticDensities(text);
  return new Response(JSON.stringify(densities), {
    headers: { 'Content-Type': 'application/json' },
  });
};
