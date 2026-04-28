/**
 * Returns a YYYY-MM-DD string in the given IANA timezone, or the server's
 * local timezone if `ianaTimezone` is omitted.
 *
 * Subject-facing code MUST pass the subject's `iana_timezone` so the
 * "today's question" calendar flip happens at the subject's local midnight,
 * not the server's. Owner code (server is UTC) can omit the TZ arg.
 */
export function localDateStr(date: Date = new Date(), ianaTimezone?: string): string {
  if (ianaTimezone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find(p => p.type === 'year')!.value;
    const m = parts.find(p => p.type === 'month')!.value;
    const d = parts.find(p => p.type === 'day')!.value;
    return `${y}-${m}-${d}`;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Pure calendar arithmetic on a YYYY-MM-DD string. TZ-independent — adding
 * one day to "2026-04-27" always returns "2026-04-28" regardless of the
 * server or any subject TZ. Used by the seed planter so seeds increment in
 * the subject's calendar (not in server-local Date math).
 */
export function addDays(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
