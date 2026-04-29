/**
 * POST /api/subject/logout
 *
 * Invalidates the current session (deletes the row in tb_subject_sessions
 * matching the cookie's token hash) and clears the cookie on the response.
 *
 * Idempotent: if the session is already gone, returns 200 anyway. The user
 * is logged out either way, so there's no value in distinguishing.
 *
 * Auth: middleware sets `locals.subject` if the cookie was valid. Even if
 * it isn't (expired token, etc.), we still clear the cookie so the client
 * cleanly returns to anonymous state.
 */

import type { APIRoute } from 'astro';
import { logoutSubject, SESSION_COOKIE } from '../../../lib/libSubjectAuth.ts';

export const POST: APIRoute = async ({ request, cookies }) => {
  const cookieHeader = request.headers.get('cookie');
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (match) {
    // match[1] is the cookie value capture group; defined whenever match itself is.
    const token = decodeURIComponent(match[1]!).trim();
    if (token) {
      await logoutSubject(token);
    }
  }

  cookies.delete(SESSION_COOKIE, { path: '/' });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
