/**
 * POST /api/subject/consent
 *
 * Body: { version: string }
 *
 * Records a subject's acknowledgment of the current consent version.
 *
 * Behavior:
 *   - Validates `body.version === getCurrentConsentVersion()`. A stale
 *     version (e.g. cached page from before a doc bump) returns 400 with
 *     the current version so the client can reload to show the new doc.
 *     This is defense-in-depth; `recordConsent` would also reject.
 *   - Idempotency: if the subject has already acknowledged the current
 *     version, skip the insert. Same response shape (`{ ok: true, ... }`)
 *     as the newly-acknowledged branch — the client doesn't have to
 *     special-case the no-op path.
 *   - Captures IP + user-agent from request headers and passes through
 *     to `recordConsent` for the audit trail.
 *
 * Auth: middleware guarantees `locals.subject` is non-null + non-owner
 * before this handler runs. `must_reset_password` blocks consent
 * acknowledgment by design — subjects must rotate the temp password
 * before doing anything else, including accepting consent terms. Once
 * the consent gate (step 5) ships, this endpoint will be in the
 * gate's whitelist so subjects can acknowledge even when otherwise gated.
 */
import type { APIRoute } from 'astro';
import { parseBody } from '../../../lib/utlParseBody.ts';
import {
  getCurrentConsentVersion,
  getSubjectConsentStatus,
  recordConsent,
} from '../../../lib/libConsent.ts';
import { extractClientIp, extractUserAgent } from '../../../lib/utlRequestContext.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  const subject = locals.subject;
  if (!subject) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await parseBody<{ version?: string }>(request);
  if (!body || typeof body.version !== 'string' || body.version.length === 0) {
    return new Response(JSON.stringify({ error: 'missing_version' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const current = getCurrentConsentVersion();
  if (body.version !== current) {
    return new Response(JSON.stringify({ error: 'stale_version', current }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const status = await getSubjectConsentStatus(subject.subject_id);
    if (status.isCurrent) {
      return new Response(JSON.stringify({ ok: true, alreadyAcknowledged: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await recordConsent({
      subjectId: subject.subject_id,
      version: current,
      ipAddress: extractClientIp(request),
      userAgent: extractUserAgent(request),
    });

    return new Response(JSON.stringify({ ok: true, alreadyAcknowledged: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('subject-consent.transaction', err, {
      subjectId: subject.subject_id,
      version: current,
    });
    return new Response(JSON.stringify({ error: 'consent_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
