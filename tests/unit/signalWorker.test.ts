import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeBackoffMs } from '../../src/lib/libSignalWorker.ts';

describe('computeBackoffMs', () => {
  // ── Golden values pinned at the boundaries that matter for the queue ──

  it('attempt 1 returns 1 second floor', () => {
    expect(computeBackoffMs(1)).toBe(1000);
  });

  it('attempt 2 returns 4 seconds (quadratic)', () => {
    expect(computeBackoffMs(2)).toBe(4000);
  });

  it('attempt 3 returns 9 seconds', () => {
    expect(computeBackoffMs(3)).toBe(9000);
  });

  it('attempt 5 returns 25 seconds', () => {
    expect(computeBackoffMs(5)).toBe(25_000);
  });

  it('attempt 17 saturates at 5-minute cap', () => {
    // 17^2 * 1000 = 289_000 < 300_000, last value below cap
    expect(computeBackoffMs(17)).toBe(289_000);
  });

  it('attempt 18 hits 5-minute cap', () => {
    // 18^2 * 1000 = 324_000 > 300_000, capped
    expect(computeBackoffMs(18)).toBe(300_000);
  });

  it('attempt 100 stays at 5-minute cap', () => {
    expect(computeBackoffMs(100)).toBe(300_000);
  });

  it('attempt 0 returns the 1-second floor (defensive)', () => {
    // Defensive: a bug somewhere shouldn't produce zero-delay tight loop.
    expect(computeBackoffMs(0)).toBe(1000);
  });

  // ── Property tests ──

  it('is monotone non-decreasing in attempts up to the cap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 17 }),
        fc.integer({ min: 0, max: 17 }),
        (a, b) => {
          if (a <= b) {
            return computeBackoffMs(a) <= computeBackoffMs(b);
          }
          return computeBackoffMs(a) >= computeBackoffMs(b);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('is bounded above by the 5-minute cap for all attempts', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (n) => {
        return computeBackoffMs(n) <= 300_000;
      }),
      { numRuns: 200 },
    );
  });

  it('is bounded below by the 1-second floor for all attempts', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (n) => {
        return computeBackoffMs(n) >= 1000;
      }),
      { numRuns: 200 },
    );
  });

  it('returns a finite integer for any attempt count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (n) => {
        const v = computeBackoffMs(n);
        return Number.isFinite(v) && Number.isInteger(v);
      }),
      { numRuns: 200 },
    );
  });
});
