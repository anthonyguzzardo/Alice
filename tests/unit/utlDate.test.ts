import { describe, it, expect } from 'vitest';
import { localDateStr, addDays } from '../../src/lib/utlDate.ts';

describe('localDateStr', () => {
  it('returns YYYY-MM-DD in the supplied IANA timezone', () => {
    // 2026-04-28 02:49:00 UTC = 2026-04-27 21:49 in Chicago (CDT, UTC-5).
    // This is the exact moment ash submitted her first journal entry; the
    // bug was that without the TZ arg the server (UTC) handed her the wrong
    // calendar day's question. With the TZ arg, "today" is her local day.
    const utc = new Date(Date.UTC(2026, 3, 28, 2, 49, 0));
    expect(localDateStr(utc, 'America/Chicago')).toBe('2026-04-27');
    expect(localDateStr(utc, 'UTC')).toBe('2026-04-28');
    expect(localDateStr(utc, 'Asia/Tokyo')).toBe('2026-04-28'); // UTC+9 — already 11:49 AM next day
  });

  it('handles DST transitions in the subject TZ', () => {
    // 2026-03-08 07:00 UTC: Chicago has just sprung forward to CDT (UTC-5).
    // 07:00 UTC = 02:00 CDT — local clock skipped 02:00->03:00 but the date
    // is unambiguously 2026-03-08.
    const dst = new Date(Date.UTC(2026, 2, 8, 7, 0, 0));
    expect(localDateStr(dst, 'America/Chicago')).toBe('2026-03-08');
  });

  it('falls back to server-local TZ when no IANA arg', () => {
    // No assertions on exact value — depends on the host. Just verify the
    // shape is YYYY-MM-DD.
    expect(localDateStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('addDays', () => {
  it('adds calendar days TZ-independent', () => {
    expect(addDays('2026-04-27', 0)).toBe('2026-04-27');
    expect(addDays('2026-04-27', 1)).toBe('2026-04-28');
    expect(addDays('2026-04-27', 30)).toBe('2026-05-27');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('crosses DST without drift', () => {
    // Chicago DST starts 2026-03-08. Adding 1 day to 03-07 must give 03-08
    // regardless of any TZ Date math could accidentally apply.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });
});
