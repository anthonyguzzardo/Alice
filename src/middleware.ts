/**
 * Astro middleware: session resolution + universal auth gate.
 *
 * Runs on every request. Reads the session cookie, resolves the subject (if
 * any) via `libSubjectAuth.verifySubjectSession`, and attaches it to
 * `Astro.locals.subject`. Both subjects and the owner share the same
 * session-cookie auth model (Path 2-lite); Caddy basic-auth was retired
 * 2026-04-28 in favor of this universal gate.
 *
 * Path policy:
 *   - PUBLIC: `/login`, `/api/subject/login`, static assets — pass through.
 *   - SUBJECT-ONLY APIs (`/api/subject/*` minus login): require an active
 *     non-owner session, plus the must-reset and consent gates below.
 *   - OWNER-ONLY APIs (`/api/respond`, `/api/calibrate`, `/api/today`,
 *     `/api/observatory/*`): require an active owner session.
 *   - OWNER-ONLY PAGES (`/`, `/observatory/*`): require an active owner
 *     session; missing/invalid → 302 to `/login?next=<path>`.
 *   - SUBJECT-ONLY PAGES (`/subject`, `/subject/*`, `/account`,
 *     `/account/*`, `/consent`, `/reset-password`): require an active
 *     non-owner session; missing/invalid → 302 to `/login?next=<path>`.
 *
 * Three-stage gating for authenticated SUBJECTS (each stage runs only
 * after the previous passes):
 *   1. `must_reset_password` — temp-password subjects rotate before they
 *      can do anything else; only `/reset-password`, `/api/subject/reset-password`,
 *      and `/api/subject/logout` are reachable.
 *   2. consent gate — subjects whose most-recent acknowledgment differs
 *      from `CONSENT_VERSION` must re-acknowledge; only `/consent`,
 *      `/api/subject/consent`, `/api/subject/logout`,
 *      `/api/subject/export`, `/api/subject/account/delete`, and the
 *      consent doc page are reachable.
 *   3. (Anything past consent runs through to the handler.)
 *
 * The owner skips both gates: owner has no consent doc to acknowledge and
 * `set-owner-password` clears `must_reset_password` at provisioning.
 */

import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, getRequestSubject } from './lib/libSubject.ts';
import { getSubjectConsentStatus } from './lib/libConsent.ts';

// Routes that do not require auth at all. Login itself, the static
// assets Astro serves out of the build (handled below by extension), and
// logout (works for owner + subject; idempotent if no session exists).
// `/api/subject/logout` lives under `/api/subject/*` for path consistency
// with login but is universal — owner must be able to call it without
// hitting the subject-only gate downstream.
const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/subject/login',
  '/api/subject/logout',
  '/favicon.ico',
  '/robots.txt',
]);

// Subject-only APIs that the must-reset gate exempts (so the subject can
// finish the reset and log out without hitting the gate forever).
const ALLOW_DURING_MUST_RESET = new Set<string>([
  '/api/subject/reset-password',
  '/api/subject/logout',
]);

// Whitelist for the consent gate. The right to leave (logout, export,
// delete) and the right to acknowledge a new consent version are
// unconditional — a subject who refuses a new version still keeps these.
const ALLOW_DURING_CONSENT_GATE = new Set<string>([
  '/api/subject/consent',
  '/api/subject/logout',
  '/api/subject/export',
  '/api/subject/account/delete',
  '/consent',
]);

// Owner-only API surface (full match or prefix). Subject sessions hitting
// these get 403; missing sessions get 401.
const OWNER_API_EXACT = new Set<string>([
  '/api/respond',
  '/api/calibrate',
  '/api/today',
  '/api/health',
  '/api/backfill-status',
]);
const OWNER_API_PREFIXES = ['/api/observatory/', '/api/dev/'];

// Owner-only pages: the journal at `/` and the observatory tree.
function isOwnerPage(path: string): boolean {
  if (path === '/') return true;
  if (path === '/observatory' || path.startsWith('/observatory/')) return true;
  return false;
}

// Subject-only pages: the journal at `/subject`, account, consent, reset.
function isSubjectPage(path: string): boolean {
  if (path === '/subject' || path.startsWith('/subject/')) return true;
  if (path === '/account' || path.startsWith('/account/')) return true;
  if (path === '/consent') return true;
  if (path === '/reset-password') return true;
  return false;
}

function isOwnerApi(path: string): boolean {
  if (OWNER_API_EXACT.has(path)) return true;
  return OWNER_API_PREFIXES.some(p => path.startsWith(p));
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function redirectToLogin(originalPath: string, search: string): Response {
  const next = encodeURIComponent(originalPath + (search || ''));
  return new Response(null, {
    status: 302,
    headers: { Location: `/login?next=${next}` },
  });
}

// Static assets that Astro serves directly (built bundles, images, fonts).
// These never need auth — they're public artifacts and embedding the gate
// would block rendering of any authenticated page.
function isStaticAsset(path: string): boolean {
  return path.startsWith('/_astro/')
    || path.startsWith('/assets/')
    || /\.(?:js|mjs|css|png|jpg|jpeg|svg|ico|woff2?|webp|map)$/.test(path);
}

export const onRequest = defineMiddleware(async ({ request, locals }, next) => {
  const subject = await getRequestSubject(request);
  locals.subject = subject;

  const url = new URL(request.url);
  const path = url.pathname;

  // Already-authenticated visitors to /login bounce to their home surface.
  // Saves a redundant re-login + makes "/login" idempotent.
  if (path === '/login' && subject) {
    return new Response(null, {
      status: 302,
      headers: { Location: subject.is_owner ? '/' : '/subject' },
    });
  }

  if (PUBLIC_PATHS.has(path) || isStaticAsset(path)) {
    return next();
  }

  // ───── Owner-only APIs ─────────────────────────────────────────────────
  if (isOwnerApi(path)) {
    if (!subject) return jsonError(401, 'unauthorized');
    if (!subject.is_owner) return jsonError(403, 'owner_only');
    return next();
  }

  // ───── Subject-only APIs ───────────────────────────────────────────────
  if (path.startsWith('/api/subject/')) {
    if (!subject) return jsonError(401, 'unauthorized');
    if (subject.is_owner) return jsonError(403, 'owner_use_main_path');

    if (subject.must_reset_password && !ALLOW_DURING_MUST_RESET.has(path)) {
      return jsonError(403, 'must_reset_password');
    }

    if (!ALLOW_DURING_CONSENT_GATE.has(path)) {
      const consentStatus = await getSubjectConsentStatus(subject.subject_id);
      if (!consentStatus.isCurrent) {
        return jsonError(403, 'consent_required');
      }
    }
    return next();
  }

  // ───── Owner-only pages (HTML) ─────────────────────────────────────────
  if (isOwnerPage(path)) {
    if (!subject) return redirectToLogin(path, url.search);
    if (!subject.is_owner) {
      // Subject hit an owner page — bounce them home. Not a 403 because
      // the subject HAS a valid session, just for the wrong surface.
      return new Response(null, { status: 302, headers: { Location: '/subject' } });
    }
    return next();
  }

  // ───── Subject-only pages (HTML) ───────────────────────────────────────
  if (isSubjectPage(path)) {
    if (!subject) return redirectToLogin(path, url.search);
    if (subject.is_owner) {
      // Owner browsed to a subject page; bounce home.
      return new Response(null, { status: 302, headers: { Location: '/' } });
    }
    if (subject.must_reset_password && path !== '/reset-password') {
      return new Response(null, { status: 302, headers: { Location: '/reset-password' } });
    }
    if (path !== '/consent') {
      const consentStatus = await getSubjectConsentStatus(subject.subject_id);
      if (!consentStatus.isCurrent) {
        return new Response(null, { status: 302, headers: { Location: '/consent' } });
      }
    }
    return next();
  }

  // Default: anything not classified above (e.g. dev pages, papers) passes
  // through. If a new public surface is added, list it in PUBLIC_PATHS or
  // give it its own classification above.
  return next();
});

// Export for tests/tooling that want the cookie name without reaching into
// libSubjectAuth.
export { SESSION_COOKIE };
