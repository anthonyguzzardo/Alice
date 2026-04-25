import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCpuinfoModelName, sha256OfFile } from '../../src/lib/libEngineProvenance.ts';

describe('parseCpuinfoModelName', () => {
  it('extracts model name from a typical /proc/cpuinfo block', () => {
    const cpuinfo = `processor	: 0
vendor_id	: AuthenticAMD
cpu family	: 25
model		: 17
model name	: AMD EPYC 9654 96-Core Processor
stepping	: 1`;
    expect(parseCpuinfoModelName(cpuinfo)).toBe('AMD EPYC 9654 96-Core Processor');
  });

  it('extracts the FIRST model name when multiple cores are listed', () => {
    const cpuinfo = `processor	: 0
model name	: AMD EPYC 9654 96-Core Processor

processor	: 1
model name	: AMD EPYC 9654 96-Core Processor`;
    expect(parseCpuinfoModelName(cpuinfo)).toBe('AMD EPYC 9654 96-Core Processor');
  });

  it('returns null when there is no model name line', () => {
    expect(parseCpuinfoModelName('vendor_id\t: GenuineIntel\nfamily\t: 6')).toBeNull();
  });

  it('handles unusual whitespace around the colon', () => {
    expect(parseCpuinfoModelName('model name      :Intel Xeon Platinum 8480+')).toBe(
      'Intel Xeon Platinum 8480+',
    );
  });
});

describe('sha256OfFile', () => {
  it('computes a 64-character lowercase hex digest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'alice-sha-'));
    const path = join(dir, 'sample.bin');
    writeFileSync(path, 'hello world');
    try {
      const hash = sha256OfFile(path);
      // Known SHA-256 of "hello world"
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      unlinkSync(path);
    }
  });

  it('produces different hashes for different content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'alice-sha-'));
    const a = join(dir, 'a.bin');
    const b = join(dir, 'b.bin');
    writeFileSync(a, 'one');
    writeFileSync(b, 'two');
    try {
      expect(sha256OfFile(a)).not.toBe(sha256OfFile(b));
    } finally {
      unlinkSync(a);
      unlinkSync(b);
    }
  });
});
