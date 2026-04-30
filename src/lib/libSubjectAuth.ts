/**
 * Subject authentication: Argon2id password hashing + opaque session tokens.
 *
 * Auth model (Path 2-lite): the owner manually provisions accounts via CLI,
 * issues each subject a username + temporary password, and the subject resets
 * the password on first login (`must_reset_password` flips to false). No
 * self-service signup, no email service, no recovery link flow. The owner is
 * the recovery mechanism.
 *
 * Token model: a 32-byte random token is issued at login. The raw token is
 * placed in a cookie and sent to the subject's browser. The DB stores ONLY
 * SHA-256(token), so a DB leak does not grant active sessions — the attacker
 * would need both the DB row and the live cookie value to impersonate. Passwords
 * are hashed with Argon2id (memory-hard, side-channel resistant) so a leaked
 * `password_hash` column does not expose plaintext.
 *
 * Sessions expire after 7 days with no sliding-window extension (was 30 days
 * pre-2026-04-27 — shortened during the auth-hardening pass to bound the
 * stolen-cookie window). A password reset deletes ALL sessions for that
 * subject (forces re-login everywhere).
 */

import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import sql, { type TxSql } from './libDbPool.ts';

// ─── Tunables ──────────────────────────────────────────────────────────────

/**
 * Argon2id parameters. Defaults follow OWASP Password Storage Cheat Sheet
 * (2024) recommendations: 64MB memory, 3 iterations, 1 parallel lane. Tune
 * upward if the deploy target has comfortable headroom; downward only with
 * benchmarks justifying the change.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
};

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Cookie name carrying the raw session token. */
export const SESSION_COOKIE = 'alice_session';

// ─── Pure helpers ──────────────────────────────────────────────────────────

export async function hashPassword(plaintext: string): Promise<string> {
  return await argon2.hash(plaintext, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    // argon2.verify throws on a malformed hash (e.g. the migration placeholder
    // before set-owner-password runs). Treat as authentication failure rather
    // than propagating — the caller has no remediation other than "wrong password".
    return false;
  }
}

/**
 * Lazily-cached Argon2id hash used to equalize the timing cost of "user does
 * not exist" against "user exists, wrong password." Without this, the missing-user
 * path returns in microseconds while the wrong-password path eats the ~100ms
 * Argon2 verify cost — observable as a username-enumeration side channel. We
 * always run one verify before deciding.
 *
 * The dummy plaintext is never accepted as a real password (login flow only
 * checks the verify result against the real stored hash; the dummy is discarded).
 */
let dummyHashPromise: Promise<string> | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('alice-constant-time-dummy-never-matches-anything');
  }
  return dummyHashPromise;
}

export interface IssuedToken {
  /** Raw token value. Set this as the cookie value sent to the client. */
  token: string;
  /** SHA-256(token) as hex. Persisted in tb_subject_sessions.token_hash. */
  tokenHash: string;
}

export function generateSessionToken(): IssuedToken {
  const raw = randomBytes(32).toString('hex');
  return { token: raw, tokenHash: hashToken(raw) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─── DB types ──────────────────────────────────────────────────────────────

export interface SubjectAuthRow {
  subject_id: number;
  username: string;
  password_hash: string;
  must_reset_password: boolean;
  iana_timezone: string;
  is_owner: boolean;
  is_active: boolean;
}

// ─── Login / verify / logout ───────────────────────────────────────────────

/**
 * Verify (username, password). On success, insert a session row and return the
 * raw token. Returns null on any failure (wrong username, wrong password,
 * inactive subject) without distinguishing — error messages should not reveal
 * which condition failed.
 */
export async function loginSubject(
  username: string,
  password: string,
): Promise<{ token: string; subjectId: number; mustResetPassword: boolean; isOwner: boolean } | null> {
  const rows = await sql`
    SELECT subject_id, username, password_hash, must_reset_password,
           iana_timezone, is_owner, is_active
    FROM tb_subjects
    WHERE username = ${username} AND is_active = TRUE
  `;
  const subject = rows[0] as SubjectAuthRow | undefined;
  if (!subject) {
    // Constant-time path: run a verify against a dummy hash so the missing-user
    // branch takes the same wall-clock time as the wrong-password branch.
    // Defeats username enumeration via login-latency side channel.
    await verifyPassword(await getDummyHash(), password);
    return null;
  }
  const ok = await verifyPassword(subject.password_hash, password);
  if (!ok) return null;

  const session = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await sql`
    INSERT INTO tb_subject_sessions (subject_id, token_hash, expires_at)
    VALUES (${subject.subject_id}, ${session.tokenHash}, ${expiresAt})
  `;
  return {
    token: session.token,
    subjectId: subject.subject_id,
    mustResetPassword: subject.must_reset_password,
    isOwner: subject.is_owner,
  };
}

/**
 * Resolve a raw cookie token to the underlying subject. Returns null when the
 * token is missing, unknown, expired, or the subject has been deactivated.
 * Does NOT extend the session; v1 has no sliding-window renewal.
 *
 * Side effect: on a successful resolve, updates `last_seen_at` and `last_ip`
 * on the matching session row, throttled so the write fires at most once per
 * 5 minutes per session. Telemetry only — auth still resolves on token_hash +
 * expires_at alone. The throttle keeps a chatty client (every page load) from
 * generating an unbounded write rate.
 */
export async function verifySubjectSession(
  token: string,
  ip?: string | null,
): Promise<SubjectAuthRow | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await sql`
    SELECT s.subject_id, s.username, s.password_hash, s.must_reset_password,
           s.iana_timezone, s.is_owner, s.is_active
    FROM tb_subject_sessions sess
    JOIN tb_subjects s ON sess.subject_id = s.subject_id
    WHERE sess.token_hash = ${tokenHash}
      AND sess.expires_at > CURRENT_TIMESTAMP
      AND s.is_active = TRUE
  `;
  const subject = (rows[0] as SubjectAuthRow | undefined) ?? null;
  if (subject) {
    // Throttle: only update if last_seen_at is NULL (first verify post-rollout)
    // or older than 5 minutes. The conditional in the WHERE clause keeps the
    // write a no-op when the row is fresh.
    await sql`
      UPDATE tb_subject_sessions
      SET last_seen_at = CURRENT_TIMESTAMP,
          last_ip      = ${ip ?? null}
      WHERE token_hash = ${tokenHash}
        AND (
          last_seen_at IS NULL
          OR last_seen_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        )
    `;
  }
  return subject;
}

/** Invalidate a single session by token. No-op if the token doesn't exist. */
export async function logoutSubject(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await sql`DELETE FROM tb_subject_sessions WHERE token_hash = ${tokenHash}`;
}

/** Sweep all sessions past their expires_at. Returns the number deleted. */
export async function sweepExpiredSessions(): Promise<number> {
  const result = await sql`
    DELETE FROM tb_subject_sessions WHERE expires_at < CURRENT_TIMESTAMP
  `;
  return result.count;
}

// ─── Password lifecycle ────────────────────────────────────────────────────

/**
 * Reset a subject's password. Verifies the current password before applying
 * the new hash; returns false on mismatch (or if the subject row is missing).
 * On success, clears must_reset_password and invalidates all existing sessions
 * for the subject — forcing re-login everywhere with the new credential.
 */
export async function resetPassword(
  subjectId: number,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  return await sql.begin(async (tx) => {
    const rows = await tx`
      SELECT password_hash FROM tb_subjects
      WHERE subject_id = ${subjectId} AND is_active = TRUE
    `;
    const row = rows[0] as { password_hash: string } | undefined;
    if (!row) return false;
    const ok = await verifyPassword(row.password_hash, currentPassword);
    if (!ok) return false;
    const newHash = await hashPassword(newPassword);
    await tx`
      UPDATE tb_subjects
      SET password_hash       = ${newHash}
        , must_reset_password = FALSE
        , dttm_modified_utc   = CURRENT_TIMESTAMP
      WHERE subject_id = ${subjectId}
    `;
    await tx`DELETE FROM tb_subject_sessions WHERE subject_id = ${subjectId}`;
    return true;
  });
}

// ─── Provisioning (CLI scripts) ────────────────────────────────────────────

/**
 * Create a new non-owner subject. The owner runs this via
 * `npm run create-subject`. The temp password is hashed and stored;
 * must_reset_password is TRUE so the subject is forced to reset on first login.
 */
export async function createSubject(
  input: {
    username: string;
    tempPassword: string;
    ianaTimezone?: string;
    displayName?: string | null;
  },
  tx?: TxSql,
): Promise<number> {
  const conn = tx ?? sql;
  const passwordHash = await hashPassword(input.tempPassword);
  const rows = await conn`
    INSERT INTO tb_subjects (username, password_hash, iana_timezone, display_name, must_reset_password)
    VALUES (
      ${input.username},
      ${passwordHash},
      ${input.ianaTimezone ?? 'UTC'},
      ${input.displayName ?? null},
      TRUE
    )
    RETURNING subject_id
  `;
  return (rows[0] as { subject_id: number }).subject_id;
}

/**
 * Set the owner's password. Used by `npm run set-owner-password` during
 * initial deploy and any time the owner needs to rotate their password.
 *
 * On a fresh database with no owner row, INSERTs a row with
 * username='owner', is_owner=TRUE, and the supplied password.
 * On a database that already has an owner row, UPDATEs the password.
 * Idempotent in both directions.
 */
export async function setOwnerPassword(plaintextPassword: string): Promise<void> {
  const passwordHash = await hashPassword(plaintextPassword);
  const updated = await sql`
    UPDATE tb_subjects
    SET password_hash       = ${passwordHash}
      , must_reset_password = FALSE
      , dttm_modified_utc   = CURRENT_TIMESTAMP
    WHERE is_owner = TRUE
  `;
  if (updated.count === 1) return;
  if (updated.count > 1) {
    throw new Error(`multiple owner rows found (${updated.count}); expected 0 or 1`);
  }
  const inserted = await sql`
    INSERT INTO tb_subjects (
      username, password_hash, must_reset_password,
      iana_timezone, display_name, is_owner
    ) VALUES (
      'owner', ${passwordHash}, FALSE,
      'UTC', 'Owner', TRUE
    )
  `;
  if (inserted.count !== 1) {
    throw new Error(`failed to insert owner row, got ${inserted.count}`);
  }
}
