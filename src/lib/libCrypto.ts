/**
 * AES-256-GCM at-rest encryption for subject data.
 *
 * Threat model: Supabase is a hosted third party. Subject journal text must
 * land there as gibberish so that a DB breach, rogue admin read, or accidental
 * dump-to-public-bucket does not expose anyone's writing. The master key
 * never leaves operator control (lives in systemd EnvironmentFile on the
 * application host + a backup copy in the operator's password manager).
 *
 * GCM, not CBC: the tag is an authenticated MAC over ciphertext + AAD. A
 * tampered ciphertext, tampered nonce, or wrong key fails decryption loudly
 * with an exception, not silently with corrupt plaintext. We append the 16-byte
 * tag to the ciphertext for storage; decrypt splits them back apart.
 *
 * Key rotation is deferred to a future phase. v1 has a single key for the
 * deployment lifetime. Lose the key, lose the data — by design.
 *
 * Generate the key once with: `openssl rand -base64 32`
 * Set in env as: ALICE_ENCRYPTION_KEY=<base64-encoded-32-bytes>
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;       // AES-256
const NONCE_BYTES = 12;     // GCM standard
const TAG_BYTES = 16;       // GCM auth tag size

let cachedKey: Buffer | null = null;

/**
 * Lazy key load. Read from `ALICE_ENCRYPTION_KEY` env on first call, validate,
 * cache for the process lifetime. Tests can override by setting the env var
 * before importing this module (or by clearing the cache via _resetKeyForTests).
 *
 * Validation is strict: if the env var is missing, the wrong base64 length, or
 * decodes to anything other than 32 bytes, we throw at first use rather than
 * silently truncating or padding. There is no silent failure mode where the
 * "wrong key" is used — it either matches what was used to encrypt or it doesn't.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ALICE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ALICE_ENCRYPTION_KEY not set. Generate with: openssl rand -base64 32'
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error('ALICE_ENCRYPTION_KEY is not valid base64');
  }
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ALICE_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}. ` +
      `Regenerate with: openssl rand -base64 32`
    );
  }
  cachedKey = key;
  return key;
}

export interface Encrypted {
  /** Base64-encoded ciphertext concatenated with the 16-byte GCM auth tag. */
  ciphertext: string;
  /** Base64-encoded 12-byte random nonce. Different per encryption. */
  nonce: string;
}

/**
 * Encrypt a UTF-8 string with AES-256-GCM. Each call generates a fresh random
 * nonce, so encrypting the same plaintext twice yields different ciphertexts.
 * The auth tag is appended to the ciphertext (last 16 bytes).
 */
export function encrypt(plaintext: string): Encrypted {
  const key = getKey();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString('base64'),
    nonce: nonce.toString('base64'),
  };
}

/**
 * Decrypt a (ciphertext, nonce) pair previously produced by `encrypt`. Throws
 * on tampered ciphertext, tampered nonce, wrong key, or any structural problem.
 * Never returns garbage; either the original plaintext or an exception.
 */
export function decrypt(ciphertext: string, nonce: string): string {
  const key = getKey();
  const combined = Buffer.from(ciphertext, 'base64');
  if (combined.length < TAG_BYTES) {
    throw new Error('ciphertext too short to contain auth tag');
  }
  const enc = combined.subarray(0, combined.length - TAG_BYTES);
  const tag = combined.subarray(combined.length - TAG_BYTES);
  const nonceBuf = Buffer.from(nonce, 'base64');
  if (nonceBuf.length !== NONCE_BYTES) {
    throw new Error(`nonce must decode to ${NONCE_BYTES} bytes, got ${nonceBuf.length}`);
  }
  const decipher = createDecipheriv(ALGORITHM, key, nonceBuf);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Test-only cache reset. Production code never calls this; the cached key is
 * intended to live for the process lifetime so that misconfiguring the env
 * mid-process can't silently produce inconsistent ciphertexts.
 */
export function _resetKeyForTests(): void {
  cachedKey = null;
}
