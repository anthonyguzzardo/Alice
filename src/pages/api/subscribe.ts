import type { APIRoute } from 'astro';
import sql from '../../lib/libDbPool.ts';
import { parseBody } from '../../lib/utlParseBody.ts';

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody<{ email: string; source?: string }>(request);
  if (!body?.email) {
    return new Response(JSON.stringify({ error: 'Missing email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const source = body.source?.trim().slice(0, 50) || null;

  try {
    await sql`INSERT INTO tb_subscribers (email, source) VALUES (${email}, ${source})`;
  } catch (err: any) {
    if (err?.code === '23505') {
      return new Response(JSON.stringify({ ok: true, existing: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to subscribe' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
