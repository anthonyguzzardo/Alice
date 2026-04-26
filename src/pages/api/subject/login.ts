/**
 * POST /api/subject/login
 *
 * Body: { username: string, password: string }
 *
 * On success: sets the session cookie (HttpOnly, Secure, SameSite=Lax,
 * 30-day Max-Age) and returns `{ ok: true, mustResetPassword }`. On any
 * failure (wrong username, wrong password, deactivated account) returns
 * 401 without distinguishing — auth handlers must not leak which condition
 * failed.
 *
 * No auth required (this is the entry point). Middleware exempts this route
 * via `ALLOW_NO_AUTH`.
 */

import type { APIRoute } from 'astro';
import { loginSubject, SESSION_COOKIE } from '../../../lib/libSubjectAuth.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const POST: APIRoute = async ({ request, cookies }) => {
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

  if (result.isOwner) {
    // Owners never log in via the subject endpoint. They use the main path
    // (today: no auth, single-user; phase 6e: owner-side session). If we
    // accidentally matched an owner row, refuse to issue a subject session.
    return new Response(JSON.stringify({ error: 'owner_use_main_path' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  cookies.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return new Response(JSON.stringify({
    ok: true,
    mustResetPassword: result.mustResetPassword,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
