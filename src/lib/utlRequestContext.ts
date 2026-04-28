/**
 * Request-context helpers: extract client IP + user-agent from a Fetch
 * `Request`, with the truncation discipline used everywhere else in the
 * codebase.
 *
 * Centralized after the third caller showed up (libSubject session
 * telemetry, /api/subject/consent, /api/subject/export). Below that
 * threshold the helpers were inlined; above it, a single source of truth
 * is cheaper than three drifting copies.
 *
 * Truncation lengths match the schema columns these values land in:
 *   - `ip_address`: 45 chars (IPv6 textual maximum)
 *   - `user_agent`: 200 chars (audit-log column ceiling)
 */

/**
 * Extract the client IP from forwarded-for headers. Caddy sets these on
 * the proxied request. Falls back to the first hop of `x-forwarded-for`,
 * then `x-real-ip`. Returns null when neither is present (local dev
 * without a proxy). Result is truncated to 45 chars to fit the IPv6
 * textual maximum and resist log injection.
 */
export function extractClientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim().slice(0, 45);
  return null;
}

/**
 * Extract the user-agent string from the request. Returns null when the
 * header is absent. Truncated to 200 chars matching the audit-log column.
 */
export function extractUserAgent(request: Request): string | null {
  const ua = request.headers.get('user-agent');
  return ua ? ua.slice(0, 200) : null;
}
