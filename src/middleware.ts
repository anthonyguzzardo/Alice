/**
 * Astro middleware: subject session resolution and auth gate.
 *
 * Runs on every request. Reads the session cookie, resolves the subject (if
 * any) via `libSubjectAuth.verifySubjectSession`, and attaches it to
 * `Astro.locals.subject`. Enforces auth on `/api/subject/*` endpoints — only
 * `/api/subject/login` is exempt; everything else requires an active subject
 * session and rejects owner accounts (owners use the main `/api/respond` and
 * `/api/calibrate` paths).
 *
 * `must_reset_password` flow: a freshly-provisioned subject is forced through
 * `/api/subject/reset-password` before any other endpoint will respond. This
 * makes the temp password effectively single-use — the subject must rotate
 * to their own password before doing anything else.
 *
 * Owner endpoint protection (e.g. `/api/respond`, `/api/calibrate`) is NOT
 * gated by this middleware. The handoff design intentionally defers owner
 * authentication; on `fweeo.com` the owner endpoints are protected by an
 * upstream HTTP Basic Auth check in Caddy until a future phase wires
 * session-based owner auth.
 */

import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, getRequestSubject } from './lib/libSubject.ts';

const ALLOW_NO_AUTH = new Set<string>([
  '/api/subject/login',
]);

const ALLOW_DURING_MUST_RESET = new Set<string>([
  '/api/subject/reset-password',
  '/api/subject/logout',
]);

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest = defineMiddleware(async ({ request, locals }, next) => {
  // Resolve subject from session cookie (no enforcement yet).
  const subject = await getRequestSubject(request);
  locals.subject = subject;

  const url = new URL(request.url);
  const path = url.pathname;

  // Only `/api/subject/*` is gated here. Everything else passes through with
  // `locals.subject` populated for handlers that want to read it.
  if (!path.startsWith('/api/subject/')) {
    return next();
  }

  if (ALLOW_NO_AUTH.has(path)) {
    return next();
  }

  if (!subject) {
    return jsonError(401, 'unauthorized');
  }

  if (subject.is_owner) {
    // Owners use the main path; subject endpoints are not for them.
    return jsonError(403, 'owner_use_main_path');
  }

  if (subject.must_reset_password && !ALLOW_DURING_MUST_RESET.has(path)) {
    return jsonError(403, 'must_reset_password');
  }

  return next();
});

// Export for tests/tooling that want to know the cookie name without
// reaching into libSubjectAuth.
export { SESSION_COOKIE };
