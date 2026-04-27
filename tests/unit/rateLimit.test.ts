import { describe, it, expect, beforeEach, vi } from 'vitest';
import { consume, reset, _clearAll } from '../../src/lib/utlRateLimit.ts';

describe('utlRateLimit — fixed-window counter', () => {
  beforeEach(() => {
    _clearAll();
    vi.useRealTimers();
  });

  it('first call from a fresh key is allowed with full remaining', () => {
    const r = consume('k1', 10, 60_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
    expect(r.retryAfterSeconds).toBe(0);
  });

  it('blocks once the limit is exceeded within the window', () => {
    for (let i = 0; i < 10; i++) {
      const r = consume('k2', 10, 60_000);
      expect(r.allowed).toBe(true);
    }
    const blocked = consume('k2', 10, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('continues to block while the window is open even past 2× limit', () => {
    for (let i = 0; i < 25; i++) consume('k3', 10, 60_000);
    const r = consume('k3', 10, 60_000);
    expect(r.allowed).toBe(false);
  });

  it('different keys do not share counters', () => {
    for (let i = 0; i < 10; i++) consume('a', 10, 60_000);
    const a = consume('a', 10, 60_000);
    const b = consume('b', 10, 60_000);
    expect(a.allowed).toBe(false);
    expect(b.allowed).toBe(true);
  });

  it('reset clears a specific key', () => {
    for (let i = 0; i < 10; i++) consume('k4', 10, 60_000);
    expect(consume('k4', 10, 60_000).allowed).toBe(false);
    reset('k4');
    expect(consume('k4', 10, 60_000).allowed).toBe(true);
  });

  it('window expiry resets the counter', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    for (let i = 0; i < 10; i++) consume('k5', 10, 60_000);
    expect(consume('k5', 10, 60_000).allowed).toBe(false);
    // advance past the window
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    const r = consume('k5', 10, 60_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
  });
});
