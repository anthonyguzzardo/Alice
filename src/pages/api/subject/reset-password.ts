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
import { resetPassword, SESSION_COOKIE } from '../../../lib/libSubjectAuth.ts';
import { parseBody } from '../../../lib/utlParseBody.ts';

const MIN_PASSWORD_LENGTH = 12;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const subject = locals.subject;
  if (!subject) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
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

  // resetPassword wipes all sessions; clear the cookie too.
  cookies.delete(SESSION_COOKIE, { path: '/' });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
