/**
 * Persistent error log for background/fire-and-forget jobs.
 *
 * Problem this solves: every background job in respond.ts (embed, observe,
 * generate, reflect) runs detached from the HTTP response and uses
 * .catch(err => console.error(...)). Those errors go to the dev
 * server stdout and vanish when the terminal scrolls or the process restarts.
 * Result: silent pipeline failures (observations not written, entry_states
 * stuck, duplicate questions) that only surface when the user queries the
 * database and counts rows.
 *
 * This module appends structured error records to data/errors.log so there is
 * always a permanent, inspectable trail of what failed and when.
 *
 * Usage:
 *   import { logError } from './error-log.ts';
 *   doThing().catch(err => logError('respond.embed', err, { responseId }));
 */
import fs from 'node:fs';
import path from 'node:path';

const LOG_PATH = path.join(process.cwd(), 'data', 'errors.log');

export function logError(
  job: string,
  err: unknown,
  context?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
  const ctx = context && Object.keys(context).length > 0
    ? ' ' + JSON.stringify(context)
    : '';
  const line = `[${timestamp}] [${job}]${ctx}\n${message}\n\n`;
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch (writeErr) {
    console.error('[error-log] failed to write error log:', writeErr);
  }
  console.error(`[${job}]`, err);
}

/**
 * Read the most recent error records for surfacing in the UI.
 *
 * Filters by time first (only records whose ISO timestamp falls within
 * `withinMs` of now), then takes the trailing `limit` of those. The default
 * 24h window keeps stale debug output from earlier days from flagging the
 * health dot red indefinitely; the file remains append-only as a forensic
 * trail, but the UI signal reflects current state.
 *
 * Returns [] if the log doesn't exist yet. Records whose timestamp is
 * unparseable are included (fail-safe — better to surface a malformed
 * record than to silently drop a real error).
 */
export function readRecentErrors(limit = 20, withinMs = 24 * 60 * 60 * 1000): string[] {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const content = fs.readFileSync(LOG_PATH, 'utf8');
    const records = content.split(/\n\n/).filter(r => r.trim().length > 0);
    const cutoff = Date.now() - withinMs;
    const fresh = records.filter(r => {
      const match = r.match(/^\[([0-9T:.Z\-]+)\]/);
      if (!match) return true;
      const ts = Date.parse(match[1]!);
      if (Number.isNaN(ts)) return true;
      return ts >= cutoff;
    });
    return fresh.slice(-limit);
  } catch {
    return [];
  }
}
