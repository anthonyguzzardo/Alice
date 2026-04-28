/**
 * POST /api/subject/login
 *
 * Body: { username: string, password: string }
 *
 * On success: sets the session cookie (HttpOnly, Secure, SameSite=Lax, no
 * Max-Age — the cookie expires when the browser closes; the server-side
 * row in `tb_subject_sessions` still has its 7-day hard cap as the upper
 * bound). Returns `{ ok: true, mustResetPassword, isOwner }`. The same
 * endpoint serves both subjects and the owner; the response body's
 * `isOwner` flag tells the login page where to dispatch (owner → `/`,
 * subject → `/subject`).
 *
 * On any failure (wrong username, wrong password, deactivated account)
 * returns 401 without distinguishing — auth handlers must not leak which
 * condition failed.
 *
 * No auth required (this is the entry point). Middleware exempts this route
 * via `ALLOW_NO_AUTH`.
 */

import type { APIRoute } from 'astro';
import { loginSubject, SESSION_COOKIE } from '../../../lib/libSubjectAuth.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';
import { consume, reset as resetRateLimit } from '../../../lib/utlRateLimit.ts';

// Rate limit: 10 login attempts per 15 minutes per IP. Argon2id already adds
// ~100ms per verify, so the absolute upper bound on guesses-per-window is low
// to begin with; this caps it to a number that defeats credential stuffing
// without inconveniencing a human who fat-fingers their password.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function clientIpKey(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return `login:${first.slice(0, 45)}`;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return `login:${real.trim().slice(0, 45)}`;
  return 'login:unknown';
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const rateKey = clientIpKey(request);
  const limited = consume(rateKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limited.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(limited.retryAfterSeconds),
      },
    });
  }

  const body = await parseBody<{ username?: string; password?: string }>(request);
  if (!body) {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const username = body.username?.trim();
  const password = body.password;
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'missing_credentials' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await loginSubject(username, password);
  if (!result) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Successful auth: reset this IP's rate-limit bucket so a legitimate user
  // who mistypes their password a few times before getting it right does not
  // get throttled on their next session.
  resetRateLimit(rateKey);

  // No `maxAge` — this is a session cookie. Browser drops it when it
  // closes; refreshes and tab-switches keep the session alive. The
  // server-side `tb_subject_sessions` row still has its 7-day hard cap.
  cookies.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
  });

  return new Response(JSON.stringify({
    ok: true,
    mustResetPassword: result.mustResetPassword,
    isOwner: result.isOwner,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
