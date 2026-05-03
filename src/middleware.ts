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
 *      from `CONSENT_VERSION` must re-acknowledge. Right-to-leave is
 *      unconditional, so the gate exempts both the consent flow itself AND
 *      the leave paths: `CONSENT_GATE_ALLOW_PAGES` for HTML surfaces
 *      (`/consent`, `/account/delete`) and `CONSENT_GATE_ALLOW_APIS` for
 *      backing endpoints (`/api/subject/consent`, `/api/subject/export`,
 *      `/api/subject/account/delete`). Logout is universal via PUBLIC_PATHS.
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
//
// `/desktop-only` is here because the mobile-UA gate redirects every
// other route here; if it were not in PUBLIC_PATHS the gate's destination
// would itself be blocked, and the redirect would loop.
const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/subject/login',
  '/api/subject/logout',
  '/desktop-only',
  '/favicon.ico',
  '/robots.txt',
]);

/**
 * User-Agent matcher for mobile / tablet devices. Catches phones, most
 * Android tablets, and the traditional iPad UA token. Does NOT catch
 * iPad on iPadOS 13+ (which advertises itself as Mac Safari by default
 * with no `iPad` token); that case is caught client-side via
 * `navigator.maxTouchPoints` checks on each subject-facing page.
 *
 * Alice's keystroke-timing instrument cannot run reliably on touch
 * keyboards, so the policy is "laptop only, full stop." Operator can
 * unblock specific routes later by listing them in MOBILE_ALLOW_PATHS.
 */
const MOBILE_UA_REGEX = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone|Kindle|Silk/i;

function isMobileUserAgent(ua: string | null): boolean {
  if (!ua) return false;
  return MOBILE_UA_REGEX.test(ua);
}

// Subject-only APIs that the must-reset gate exempts (so the subject can
// finish the reset and log out without hitting the gate forever).
const ALLOW_DURING_MUST_RESET = new Set<string>([
  '/api/subject/reset-password',
  '/api/subject/logout',
]);

// Consent-gate whitelists. The right to leave (export + close account) and
// the right to acknowledge a new consent version are unconditional — a
// subject who refuses a new version still keeps these.
//
// Two parallel sets because the API gate and page gate consult them
// independently (each gate only ever fires for its own path class). Adding
// a path requires picking the correct set; mis-classification is caught at
// review time, not by the type system. Logout is intentionally NOT here:
// it lives in `PUBLIC_PATHS` and short-circuits before either gate runs.
const CONSENT_GATE_ALLOW_APIS = new Set<string>([
  '/api/subject/consent',
  '/api/subject/export',
  '/api/subject/account/delete',
]);

const CONSENT_GATE_ALLOW_PAGES = new Set<string>([
  '/consent',
  '/account/delete',
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

// Subject-only pages: the journal at `/subject`, account, consent, reset,
// and the welcome / how-to-use orientation page. Distinct from the public
// `/how-it-works` page, which is a marketing/architecture walkthrough for
// visitors and not a subject-facing surface.
function isSubjectPage(path: string): boolean {
  if (path === '/subject' || path.startsWith('/subject/')) return true;
  if (path === '/account' || path.startsWith('/account/')) return true;
  if (path === '/consent') return true;
  if (path === '/reset-password') return true;
  if (path === '/welcome') return true;
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

/**
 * Belt-and-suspenders Origin check for state-changing requests. Astro's
 * built-in `security.checkOrigin` is disabled because the Node adapter
 * behind Caddy reconstructs URL scheme from Host header (X-Forwarded-Proto
 * is not trusted by default), so even matching Origin headers fail the
 * check. SameSite=Lax cookies already block cross-origin POSTs, but a
 * second layer here costs nothing.
 *
 * Default allowed origins:
 *   - https://fweeo.com (production canonical)
 *   - http://localhost:4321 (`astro dev` default port)
 *   - missing Origin (browsers omit Origin on top-level navigation; Lax
 *     cookies handle the rest, and same-origin GETs from the page are fine)
 *
 * Override with `ALICE_ALLOWED_ORIGINS` (comma-separated). When set, it
 * REPLACES the defaults — list every origin you want to allow, including
 * the production one if it's still in scope. Use case: dev on a non-default
 * port (e.g. `ALICE_ALLOWED_ORIGINS=http://localhost:4567`).
 */
const ALLOWED_ORIGINS: ReadonlySet<string> = (() => {
  const raw = process.env.ALICE_ALLOWED_ORIGINS;
  if (raw && raw.trim().length > 0) {
    const list = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    if (list.length > 0) return new Set(list);
  }
  return new Set(['https://fweeo.com', 'http://localhost:4321']);
})();

function failsOriginCheck(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return !ALLOWED_ORIGINS.has(origin);
}

export const onRequest = defineMiddleware(async ({ request, locals }, next) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // ───── Mobile / tablet block ──────────────────────────────────────────
  // Alice is laptop-only by design. Block early — before session resolve,
  // before any auth check — so a phone visiting any path other than
  // `/desktop-only` itself or a static asset always sees the block page.
  // Static assets pass through so `/desktop-only` can render its CSS and
  // fonts. Server-side UA matching does NOT catch iPad-as-Mac (iPadOS 13+);
  // each subject-facing page handles that case via inline maxTouchPoints
  // detection.
  if (
    path !== '/desktop-only'
    && !isStaticAsset(path)
    && isMobileUserAgent(request.headers.get('user-agent'))
  ) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/desktop-only' },
    });
  }

  const subject = await getRequestSubject(request);
  locals.subject = subject;

  // Already-authenticated visitors to /login bounce to their home surface.
  // Saves a redundant re-login + makes "/login" idempotent. For subjects in
  // a gated state we redirect directly to the gating page rather than to
  // their nominal home, since the page-gate would just bounce them again
  // (`/login → /subject → /reset-password` collapses to `/login → /reset-password`).
  if (path === '/login' && subject) {
    let location: string;
    if (subject.is_owner) {
      location = '/';
    } else if (subject.must_reset_password) {
      location = '/reset-password';
    } else {
      const consentStatus = await getSubjectConsentStatus(subject.subject_id);
      location = consentStatus.isCurrent ? '/subject' : '/consent';
    }
    return new Response(null, { status: 302, headers: { Location: location } });
  }

  if (PUBLIC_PATHS.has(path) || isStaticAsset(path)) {
    if (failsOriginCheck(request)) return jsonError(403, 'bad_origin');
    return next();
  }

  if (failsOriginCheck(request)) return jsonError(403, 'bad_origin');

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

    if (subject.must_reset_password) {
      if (!ALLOW_DURING_MUST_RESET.has(path)) {
        return jsonError(403, 'must_reset_password');
      }
      return next();
    }

    if (!CONSENT_GATE_ALLOW_APIS.has(path)) {
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
    if (subject.must_reset_password) {
      if (path !== '/reset-password') {
        return new Response(null, { status: 302, headers: { Location: '/reset-password' } });
      }
      return next();
    }
    if (!CONSENT_GATE_ALLOW_PAGES.has(path)) {
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
