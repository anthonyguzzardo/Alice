/**
 * Integration tests for libSubjectAuth against a real Postgres testcontainer.
 *
 * Covers the contract production relies on:
 *   - createSubject + loginSubject round-trip (issues a usable token)
 *   - verifySubjectSession returns the right subject for a valid token
 *   - verifySubjectSession returns null for expired / unknown / inactive subjects
 *   - resetPassword: requires correct current password, invalidates all sessions
 *   - logoutSubject deletes only the matching token
 *   - sweepExpiredSessions reaps past-due rows
 *   - setOwnerPassword bootstraps the owner row
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import sql from '../../src/lib/libDbPool.ts';
import {
  hashPassword,
  loginSubject,
  verifySubjectSession,
  resetPassword,
  logoutSubject,
  sweepExpiredSessions,
  createSubject,
  setOwnerPassword,
  hashToken,
} from '../../src/lib/libSubjectAuth.ts';

beforeAll(async () => {
  if (!process.env.ALICE_PG_URL?.includes('@')) {
    throw new Error(
      'tests/db expected ALICE_PG_URL to be set by globalSetup; got: ' +
        String(process.env.ALICE_PG_URL),
    );
  }

  // Seed an owner row so setOwnerPassword has something to update. The
  // canonical schema's CREATE TABLE doesn't seed one (that lived in migration
  // 024). For test purposes, a placeholder is fine.
  await sql`
    INSERT INTO tb_subjects (username, password_hash, is_owner, must_reset_password, iana_timezone)
    VALUES ('owner', ${'$argon2id$placeholder$bad'}, TRUE, TRUE, 'UTC')
    ON CONFLICT (username) DO NOTHING
  `;
});

beforeEach(async () => {
  // Wipe sessions between tests; keep tb_subjects stable but clear non-owner rows.
  await sql`DELETE FROM tb_subject_sessions`;
  await sql`DELETE FROM tb_subjects WHERE is_owner = FALSE`;
});

describe('createSubject + loginSubject', () => {
  it('lets a freshly-created subject log in with their temp password', async () => {
    const subjectId = await createSubject({
      username: 'alice',
      tempPassword: 'temp-password-1',
      ianaTimezone: 'America/Los_Angeles',
    });
    expect(subjectId).toBeGreaterThan(0);

    const result = await loginSubject('alice', 'temp-password-1');
    expect(result).not.toBeNull();
    expect(result!.subjectId).toBe(subjectId);
    expect(result!.mustResetPassword).toBe(true);
    expect(result!.isOwner).toBe(false);
    expect(result!.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns null on wrong password', async () => {
    await createSubject({ username: 'bob', tempPassword: 'right-password' });
    const result = await loginSubject('bob', 'wrong-password');
    expect(result).toBeNull();
  });

  it('returns null for an unknown username', async () => {
    const result = await loginSubject('does-not-exist', 'whatever');
    expect(result).toBeNull();
  });

  it('returns null for an inactive subject', async () => {
    const subjectId = await createSubject({ username: 'inactive', tempPassword: 'pw' });
    await sql`UPDATE tb_subjects SET is_active = FALSE WHERE subject_id = ${subjectId}`;
    const result = await loginSubject('inactive', 'pw');
    expect(result).toBeNull();
  });

  it('persists the session row with the SHA-256 hash, not the raw token', async () => {
    await createSubject({ username: 'carol', tempPassword: 'pw' });
    const result = await loginSubject('carol', 'pw');
    const rows = await sql`SELECT token_hash FROM tb_subject_sessions WHERE subject_id = ${result!.subjectId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).toBe(hashToken(result!.token));
    expect(rows[0]!.token_hash).not.toBe(result!.token);
  });
});

describe('verifySubjectSession', () => {
  it('resolves a valid token to the subject', async () => {
    const subjectId = await createSubject({ username: 'dave', tempPassword: 'pw' });
    const { token } = (await loginSubject('dave', 'pw'))!;
    const subject = await verifySubjectSession(token);
    expect(subject).not.toBeNull();
    expect(subject!.subject_id).toBe(subjectId);
    expect(subject!.username).toBe('dave');
  });

  it('returns null for an unknown token', async () => {
    const subject = await verifySubjectSession('a'.repeat(64));
    expect(subject).toBeNull();
  });

  it('returns null for an empty token', async () => {
    expect(await verifySubjectSession('')).toBeNull();
  });

  it('returns null for an expired session', async () => {
    const subjectId = await createSubject({ username: 'expired', tempPassword: 'pw' });
    const { token } = (await loginSubject('expired', 'pw'))!;
    // Expire the session by hand.
    await sql`
      UPDATE tb_subject_sessions
      SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
      WHERE subject_id = ${subjectId}
    `;
    expect(await verifySubjectSession(token)).toBeNull();
  });

  it('returns null when the subject has been deactivated', async () => {
    const subjectId = await createSubject({ username: 'deactivated', tempPassword: 'pw' });
    const { token } = (await loginSubject('deactivated', 'pw'))!;
    await sql`UPDATE tb_subjects SET is_active = FALSE WHERE subject_id = ${subjectId}`;
    expect(await verifySubjectSession(token)).toBeNull();
  });
});

describe('resetPassword', () => {
  it('rotates the password and clears must_reset_password', async () => {
    const subjectId = await createSubject({ username: 'eve', tempPassword: 'temp' });
    const ok = await resetPassword(subjectId, 'temp', 'new-password');
    expect(ok).toBe(true);

    // Old password no longer works
    expect(await loginSubject('eve', 'temp')).toBeNull();

    // New password works and must_reset_password is now false
    const result = await loginSubject('eve', 'new-password');
    expect(result).not.toBeNull();
    expect(result!.mustResetPassword).toBe(false);
  });

  it('rejects when the current password is wrong', async () => {
    const subjectId = await createSubject({ username: 'frank', tempPassword: 'real' });
    const ok = await resetPassword(subjectId, 'wrong-current', 'new-password');
    expect(ok).toBe(false);

    // Original password still works
    expect(await loginSubject('frank', 'real')).not.toBeNull();
  });

  it('invalidates all existing sessions on reset', async () => {
    const subjectId = await createSubject({ username: 'grace', tempPassword: 'temp' });
    const a = (await loginSubject('grace', 'temp'))!;
    const b = (await loginSubject('grace', 'temp'))!;
    expect(await verifySubjectSession(a.token)).not.toBeNull();
    expect(await verifySubjectSession(b.token)).not.toBeNull();

    await resetPassword(subjectId, 'temp', 'fresh');

    expect(await verifySubjectSession(a.token)).toBeNull();
    expect(await verifySubjectSession(b.token)).toBeNull();
  });
});

describe('logoutSubject + sweepExpiredSessions', () => {
  it('logoutSubject deletes only the matching token', async () => {
    await createSubject({ username: 'henry', tempPassword: 'pw' });
    const a = (await loginSubject('henry', 'pw'))!;
    const b = (await loginSubject('henry', 'pw'))!;

    await logoutSubject(a.token);

    expect(await verifySubjectSession(a.token)).toBeNull();
    expect(await verifySubjectSession(b.token)).not.toBeNull();
  });

  it('sweepExpiredSessions only reaps past-due rows', async () => {
    const subjectId = await createSubject({ username: 'irene', tempPassword: 'pw' });
    const live = (await loginSubject('irene', 'pw'))!;
    const stale = (await loginSubject('irene', 'pw'))!;
    await sql`
      UPDATE tb_subject_sessions
      SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
      WHERE token_hash = ${hashToken(stale.token)}
    `;

    const deleted = await sweepExpiredSessions();
    expect(deleted).toBeGreaterThanOrEqual(1);

    // Live session still resolvable; stale gone.
    expect(await verifySubjectSession(live.token)).not.toBeNull();
    expect(await verifySubjectSession(stale.token)).toBeNull();

    // Confirm only the past-due row was removed.
    const remaining = await sql`SELECT COUNT(*)::int AS n FROM tb_subject_sessions WHERE subject_id = ${subjectId}`;
    expect((remaining[0] as { n: number }).n).toBe(1);
  });
});

describe('setOwnerPassword', () => {
  it('updates the owner row and clears must_reset_password', async () => {
    await setOwnerPassword('owner-real-password');

    const result = await loginSubject('owner', 'owner-real-password');
    expect(result).not.toBeNull();
    expect(result!.isOwner).toBe(true);
    expect(result!.mustResetPassword).toBe(false);
  });

  it('throws if no owner row exists', async () => {
    // Temporarily delete the owner row, restore at end.
    const placeholder = await hashPassword('temp-owner-restore-after-test');
    await sql`DELETE FROM tb_subjects WHERE is_owner = TRUE`;
    try {
      await expect(setOwnerPassword('whatever')).rejects.toThrow(/expected exactly 1 owner row/);
    } finally {
      await sql`
        INSERT INTO tb_subjects (username, password_hash, is_owner, must_reset_password, iana_timezone)
        VALUES ('owner', ${placeholder}, TRUE, TRUE, 'UTC')
      `;
    }
  });
});
