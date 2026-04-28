/**
 * POST /api/subject/account/delete
 *
 * Body: { confirmation: string }   // must equal subject's current username
 *
 * Subject-initiated full account deletion. Wipes journal content +
 * behavioral signals + sessions in one transaction; soft-deletes the
 * tb_subjects row (rename + deactivate, subject_id preserved); writes
 * one audit row. Consent + audit trails are preserved per the consent
 * doc's research-integrity claim.
 *
 * Confirmation: the request body must contain `confirmation` equal to
 * the subject's current username. Mismatch returns 400. With a stolen
 * session this is weak (the attacker has the username), but it costs
 * the legitimate subject nothing. Rate-limiting + the operator being
 * the recovery channel is the actual security posture; see
 * `feedback_subject_content_opacity` and the operator-as-god trust
 * model documented in handoff §9.
 *
 * Idempotency: re-clicks (double-submit, browser back-button + retry)
 * land on a soft-deleted subject. The cascade rejects with
 * `AlreadyDeletedError` → 410 Gone, not 500. The cookie is wiped on
 * both branches so the second response is the cleanup of the first.
 *
 * Auth: middleware guarantees `locals.subject` is non-null + non-owner.
 * When the consent gate ships in step 5, this route is whitelisted —
 * a subject who refuses a new consent version can still close their
 * account. Right to leave is unconditional.
 */
import type { APIRoute } from 'astro';
import { parseBody } from '../../../../lib/utlParseBody.ts';
import {
  deleteSubjectAndData,
  AlreadyDeletedError,
  SubjectNotFoundError,
  OwnerProtectedError,
} from '../../../../lib/libDelete.ts';
import {
  extractClientIp,
  extractUserAgent,
} from '../../../../lib/utlRequestContext.ts';
import { SESSION_COOKIE } from '../../../../lib/libSubjectAuth.ts';
import { logError } from '../../../../lib/utlErrorLog.ts';

function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error, ...(extra ?? {}) }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const subject = locals.subject;
  if (!subject) return jsonError(401, 'unauthorized');

  const body = await parseBody<{ confirmation?: string }>(request);
  if (!body || typeof body.confirmation !== 'string') {
    return jsonError(400, 'missing_confirmation');
  }
  if (body.confirmation !== subject.username) {
    return jsonError(400, 'confirmation_mismatch');
  }

  try {
    const result = await deleteSubjectAndData({
      subjectId: subject.subject_id,
      actor: 'subject',
      actorSubjectId: subject.subject_id,
      ipAddress: extractClientIp(request),
      userAgent: extractUserAgent(request),
    });

    // Wipe the cookie. The session row was deleted as part of the cascade,
    // so the cookie is already invalid server-side; this just tells the
    // browser to drop it.
    cookies.delete(SESSION_COOKIE, { path: '/' });

    return new Response(JSON.stringify({
      ok: true,
      dataAccessLogId: result.dataAccessLogId,
      rowCounts: result.rowCounts,
      softDeletedUsername: result.softDeletedUsername,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof AlreadyDeletedError) {
      // Idempotent re-entry: the row is already tombstoned. Wipe the
      // cookie just in case the client kept it.
      cookies.delete(SESSION_COOKIE, { path: '/' });
      return jsonError(410, 'already_deleted');
    }
    if (err instanceof SubjectNotFoundError) {
      // Should not happen — middleware verified locals.subject. If it
      // does, treat as 410 (the row was deleted out from under us by
      // the operator CLI between auth + cascade).
      cookies.delete(SESSION_COOKIE, { path: '/' });
      return jsonError(410, 'already_deleted');
    }
    if (err instanceof OwnerProtectedError) {
      // Middleware already 403s owners on /api/subject/* but include the
      // branch in case a path bypass ever surfaces.
      return jsonError(403, 'owner_protected');
    }
    logError('subject-account-delete.transaction', err, { subjectId: subject.subject_id });
    return jsonError(500, 'delete_failed');
  }
};
