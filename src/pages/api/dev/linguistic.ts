/**
 * Dev-only endpoint: computes linguistic densities from raw text.
 * No DB, no persistence — just the math.
 */
import type { APIRoute } from 'astro';
import { computeLinguisticDensities } from '../../../lib/libLinguistic.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody<{ text: string }>(request);
  if (!body || typeof body.text !== 'string') {
    return new Response(JSON.stringify({ error: 'text required' }), { status: 400 });
  }
  const { text } = body;
  const densities = computeLinguisticDensities(text);
  return new Response(JSON.stringify(densities), {
    headers: { 'Content-Type': 'application/json' },
  });
};
