/**
 * Unit tests for the pure helpers in libSubjectAuth.
 *
 * These cover:
 *   - hashPassword / verifyPassword round-trip and rejection of bad inputs.
 *   - Session-token generator: correct format, uniqueness, deterministic hash.
 *   - hashToken: deterministic, correct length, hex-encoded.
 *
 * No DB. argon2 is real (native module) — these tests are slow per assertion
 * (~100ms per hash) by design; that's the point of memory-hard hashing.
 */

import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
} from '../../src/lib/libSubjectAuth.ts';

describe('libSubjectAuth password hashing', () => {
  it('hashes and verifies the same password successfully', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('produces an Argon2id-format hash', async () => {
    const hash = await hashPassword('whatever');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash each call (random salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    // Both still verify the same plaintext — the salt is in the hash itself.
    expect(await verifyPassword(a, 'same')).toBe(true);
    expect(await verifyPassword(b, 'same')).toBe(true);
  });

  it('returns false (not throws) for a malformed hash', async () => {
    // The migration placeholder is intentionally malformed so it cannot verify
    // until set-owner-password runs. argon2.verify throws on this; we want the
    // wrapper to swallow that and return false.
    expect(
      await verifyPassword('$argon2id$placeholder$needs-set-via-cli', 'anything'),
    ).toBe(false);
  });
});

describe('libSubjectAuth session token generator', () => {
  it('issues a 64-char hex raw token (32 bytes encoded)', () => {
    const { token } = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('issues a 64-char hex hash matching SHA-256(token)', () => {
    const { token, tokenHash } = generateSessionToken();
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashToken(token));
  });

  it('produces unique tokens across calls', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken().token);
    }
    expect(tokens.size).toBe(100);
  });
});

describe('libSubjectAuth hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('foo')).toBe(hashToken('foo'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('foo')).not.toBe(hashToken('foo2'));
  });

  it('is 64 hex chars (SHA-256)', () => {
    expect(hashToken('anything')).toMatch(/^[0-9a-f]{64}$/);
  });
});
