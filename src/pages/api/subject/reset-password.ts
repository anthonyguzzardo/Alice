/**
 * POST /api/subject/reset-password
 *
 * Body: { currentPassword: string, newPassword: string }
 *
 * Verifies `currentPassword`, updates `password_hash` to a fresh Argon2id
 * hash of `newPassword`, clears `must_reset_password`, and invalidates ALL
 * existing sessions for this subject (forcing re-login). The current session
 * cookie is also cleared on the response since it's no longer valid.
 *
 * Auth: middleware has already verified `locals.subject` is non-null and
 * not the owner. This endpoint is allowed during `must_reset_password = TRUE`
 * (it is the way out of that state).
 */

import type { APIRoute } from 'astro';
import {
  resetPassword,
  SESSION_COOKIE,
  POST_RESET_NEXT_COOKIE,
  isValidPostResetNextPath,
} from '../../../lib/libSubjectAuth.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';
import { consume, reset as resetRateLimit } from '../../../lib/utlRateLimit.ts';

const MIN_PASSWORD_LENGTH = 12;

// Rate limit: 10 reset attempts per 15 minutes per subject. Mirrors the
// login handler's shape exactly because the threat profile is identical —
// per-attempt Argon2id verify cost (~100ms) dominates either way, and
// capping attempt count is the primary CPU-DoS defense for both endpoints.
//
// Key shape is `reset:<subject_id>` rather than `reset:<subject_id>:<ip>`.
// An attacker with a stolen session cookie can burn the legit user's
// bucket and lock them out of the reset endpoint for one window. We
// accept that — anyone who has the session has bigger problems than a
// 15-minute reset DoS, and the simpler key shape makes the primary
// defense (CPU-DoS protection) more obviously correct. Revisit with a
// composite (subject + IP) key only if session-cookie compromise becomes
// a realistic threat.
const RESET_LIMIT = 10;
const RESET_WINDOW_MS = 15 * 60 * 1000;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const subject = locals.subject;
  if (!subject) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rateKey = `reset:${subject.subject_id}`;
  const limited = consume(rateKey, RESET_LIMIT, RESET_WINDOW_MS);
  if (!limited.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(limited.retryAfterSeconds),
      },
    });
  }

  const body = await parseBody<{ currentPassword?: string; newPassword?: string }>(request);
  if (!body) {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return new Response(JSON.stringify({ error: 'missing_passwords' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return new Response(JSON.stringify({ error: 'password_too_short', minLength: MIN_PASSWORD_LENGTH }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (newPassword === currentPassword) {
    return new Response(JSON.stringify({ error: 'password_unchanged' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ok = await resetPassword(subject.subject_id, currentPassword, newPassword);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'wrong_current_password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Successful reset: clear the rate-limit bucket so a subject who
  // fat-fingered their current password a few times before getting it
  // right starts fresh. Mirrors the login handler's resetRateLimit pattern.
  resetRateLimit(rateKey);

  // resetPassword wipes all sessions; clear the cookie too.
  cookies.delete(SESSION_COOKIE, { path: '/' });

  // Read + consume the post-reset `next` cookie if present. Re-validate on
  // read: the cookie was server-set (not user-controlled at runtime), but a
  // belt-and-suspenders check guards against any future code path that
  // might set this cookie without validating, plus a manually-edited cookie
  // jar. Failure is silent: response carries no `next`, client falls back
  // to /subject after re-login.
  const rawNext = cookies.get(POST_RESET_NEXT_COOKIE)?.value;
  const next = isValidPostResetNextPath(rawNext) ? rawNext : null;
  cookies.delete(POST_RESET_NEXT_COOKIE, { path: '/' });

  return new Response(JSON.stringify({ ok: true, next }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
