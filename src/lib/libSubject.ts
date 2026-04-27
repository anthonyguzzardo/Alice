/**
 * Subject identity model.
 *
 * Auth is session-based (Path 2-lite, 2026-04-25): the owner provisions
 * accounts via CLI (`npm run create-subject`), each subject logs in with
 * username + password at /api/subject/login, and the resulting session
 * cookie carries an opaque token that resolves back to a row in
 * `tb_subject_sessions`. Cookies hold raw tokens; the DB stores SHA-256(token)
 * so a DB leak does not grant active sessions.
 *
 * `getRequestSubject()` is a pure resolver — reads the cookie, verifies via
 * `libSubjectAuth.verifySubjectSession`, returns the subject row or null.
 *
 * History note: pre-2026-04-25 this file authenticated subjects via a static
 * `invite_code` cookie. The column still exists on `tb_subjects` (nullable
 * for backward compat with any unmigrated read paths) but new code must use
 * session-based auth. See GOTCHAS.md historical entry.
 */

import sql from './libDbPool.ts';
import {
  SESSION_COOKIE,
  verifySubjectSession,
  type SubjectAuthRow,
} from './libSubjectAuth.ts';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Subject {
  subject_id: number;
  username: string;
  display_name: string | null;
  is_owner: boolean;
  is_active: boolean;
  must_reset_password: boolean;
  iana_timezone: string;
  invite_code: string | null;
  dttm_created_utc: string;
}

export { SESSION_COOKIE };

// ----------------------------------------------------------------------------
// Cookie resolver
// ----------------------------------------------------------------------------

/**
 * Resolve a request to a Subject by reading the session cookie and verifying
 * the token against `tb_subject_sessions`. Returns null if the cookie is
 * absent, the token is unknown, the session is expired, or the subject has
 * been deactivated. Does not extend or rotate the session; the only side
 * effect is the throttled telemetry update inside `verifySubjectSession`
 * (last_seen_at + last_ip on the matching session row, at most once per
 * 5 minutes per session).
 */
export async function getRequestSubject(request: Request): Promise<Subject | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;

  const token = decodeURIComponent(match[1]).trim();
  if (!token) return null;

  const ip = extractClientIp(request);
  const auth = await verifySubjectSession(token, ip);
  return auth ? authRowToSubject(auth) : null;
}

/**
 * Extract the client IP from forwarded-for headers (Caddy sets these on the
 * proxied request). Falls back to the first hop of x-forwarded-for, then
 * x-real-ip. Returns null when neither is present (local dev without a proxy).
 * Truncated to 45 chars to fit IPv6 textual maximum and resist log injection.
 */
function extractClientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim().slice(0, 45);
  return null;
}

function authRowToSubject(row: SubjectAuthRow): Subject {
  // verifySubjectSession returns the auth-shaped row; flesh it out by reading
  // the rest of the columns once we know the subject_id is valid.
  // (We could JOIN them all in verifySubjectSession, but keeping the boundaries
  // tight makes the auth path easy to audit.)
  return {
    subject_id: row.subject_id,
    username: row.username,
    display_name: null,
    is_owner: row.is_owner,
    is_active: row.is_active,
    must_reset_password: row.must_reset_password,
    iana_timezone: row.iana_timezone,
    invite_code: null,
    dttm_created_utc: '',
  };
}

// ----------------------------------------------------------------------------
// ID + owner lookups (used by the scheduler and by CLI tooling)
// ----------------------------------------------------------------------------

/** Look up a subject by ID. Returns the full row or null. */
export async function getSubjectById(id: number): Promise<Subject | null> {
  const rows = await sql`
    SELECT subject_id, username, display_name, is_owner, is_active,
           must_reset_password, iana_timezone, invite_code, dttm_created_utc
    FROM tb_subjects
    WHERE subject_id = ${id}
  `;
  return (rows[0] as Subject | undefined) ?? null;
}

/** Look up the owner row. Throws if no owner exists (broken deploy). */
export async function getOwner(): Promise<Subject> {
  const rows = await sql`
    SELECT subject_id, username, display_name, is_owner, is_active,
           must_reset_password, iana_timezone, invite_code, dttm_created_utc
    FROM tb_subjects
    WHERE is_owner = TRUE
  `;
  const owner = rows[0] as Subject | undefined;
  if (!owner) throw new Error('No owner row in tb_subjects — seed data missing');
  return owner;
}

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------

/**
 * Deactivate a subject by id. Returns true if the row was updated.
 * Owner row cannot be deactivated.
 */
export async function deactivateSubject(id: number): Promise<boolean> {
  const result = await sql`
    UPDATE tb_subjects
    SET is_active = FALSE, dttm_modified_utc = CURRENT_TIMESTAMP
    WHERE subject_id = ${id} AND is_active = TRUE AND is_owner = FALSE
  `;
  return result.count > 0;
}
