/**
 * Unit tests for libCrypto (AES-256-GCM at-rest encryption).
 *
 * These exercise the boundaries of the library:
 *   - Round-trip integrity (encrypt → decrypt → original).
 *   - Nonce uniqueness (same plaintext → different ciphertexts).
 *   - Tamper detection (modified ciphertext / nonce / tag fails loudly).
 *   - Key validation (missing / wrong-length env throws on first use).
 *
 * Tampered-ciphertext failures are the load-bearing property: GCM's auth tag
 * is what guarantees an attacker who can flip bits in storage cannot produce
 * decryptable garbage. If this test ever passes with a modified ciphertext,
 * the library has lost its security guarantee.
 */

import { describe, expect, it, beforeEach, beforeAll } from 'vitest';
import { randomBytes } from 'node:crypto';

const TEST_KEY = randomBytes(32).toString('base64');

beforeAll(() => {
  process.env.ALICE_ENCRYPTION_KEY = TEST_KEY;
});

// Re-import after env is set; vitest cache + dynamic import ensures the
// module reads the env var fresh for each describe block.
async function freshImport() {
  const mod = await import('../../src/lib/libCrypto.ts');
  mod._resetKeyForTests();
  return mod;
}

describe('libCrypto round-trip', () => {
  beforeEach(() => {
    process.env.ALICE_ENCRYPTION_KEY = TEST_KEY;
  });

  it('encrypts and decrypts back to the original plaintext', async () => {
    const { encrypt, decrypt } = await freshImport();
    const plaintext = 'I felt anxious about the meeting today.';
    const { ciphertext, nonce } = encrypt(plaintext);
    expect(decrypt(ciphertext, nonce)).toBe(plaintext);
  });

  it('handles empty strings', async () => {
    const { encrypt, decrypt } = await freshImport();
    const { ciphertext, nonce } = encrypt('');
    expect(decrypt(ciphertext, nonce)).toBe('');
  });

  it('handles multibyte UTF-8 (emoji, accents)', async () => {
    const { encrypt, decrypt } = await freshImport();
    const plaintext = 'café — 日本語 — 🎉🌊 — déjà vu';
    const { ciphertext, nonce } = encrypt(plaintext);
    expect(decrypt(ciphertext, nonce)).toBe(plaintext);
  });

  it('handles long text (10K chars)', async () => {
    const { encrypt, decrypt } = await freshImport();
    const plaintext = 'a'.repeat(10_000);
    const { ciphertext, nonce } = encrypt(plaintext);
    expect(decrypt(ciphertext, nonce)).toBe(plaintext);
  });
});

describe('libCrypto nonce uniqueness', () => {
  beforeEach(() => {
    process.env.ALICE_ENCRYPTION_KEY = TEST_KEY;
  });

  it('uses a fresh nonce for each encryption (same plaintext → different ciphertext)', async () => {
    const { encrypt } = await freshImport();
    const a = encrypt('same plaintext');
    const b = encrypt('same plaintext');
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});

describe('libCrypto tamper detection', () => {
  beforeEach(() => {
    process.env.ALICE_ENCRYPTION_KEY = TEST_KEY;
  });

  it('throws when the ciphertext is modified (auth tag fails)', async () => {
    const { encrypt, decrypt } = await freshImport();
    const { ciphertext, nonce } = encrypt('secret message');

    // Flip a bit in the middle of the ciphertext.
    const buf = Buffer.from(ciphertext, 'base64');
    buf[5] = buf[5]! ^ 0x01;
    const tampered = buf.toString('base64');

    expect(() => decrypt(tampered, nonce)).toThrow();
  });

  it('throws when the nonce is modified', async () => {
    const { encrypt, decrypt } = await freshImport();
    const { ciphertext, nonce } = encrypt('secret message');

    const buf = Buffer.from(nonce, 'base64');
    buf[0] = buf[0]! ^ 0x01;
    const tampered = buf.toString('base64');

    expect(() => decrypt(ciphertext, tampered)).toThrow();
  });

  it('throws when the auth tag is stripped (ciphertext truncated)', async () => {
    const { encrypt, decrypt } = await freshImport();
    const { ciphertext, nonce } = encrypt('secret message');

    // Strip last 16 bytes (the auth tag) from the ciphertext.
    const buf = Buffer.from(ciphertext, 'base64');
    const stripped = buf.subarray(0, buf.length - 16).toString('base64');

    expect(() => decrypt(stripped, nonce)).toThrow();
  });
});

describe('libCrypto key validation', () => {
  it('throws when ALICE_ENCRYPTION_KEY is missing', async () => {
    delete process.env.ALICE_ENCRYPTION_KEY;
    const { encrypt, _resetKeyForTests } = await freshImport();
    _resetKeyForTests();
    expect(() => encrypt('anything')).toThrow(/ALICE_ENCRYPTION_KEY not set/);
  });

  it('throws when ALICE_ENCRYPTION_KEY is the wrong length', async () => {
    process.env.ALICE_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
    const { encrypt, _resetKeyForTests } = await freshImport();
    _resetKeyForTests();
    expect(() => encrypt('anything')).toThrow(/must decode to 32 bytes/);
  });
});
