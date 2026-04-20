/**
 * Persistent error log for background/fire-and-forget jobs.
 *
 * Problem this solves: every background job in respond.ts (embed, observe,
 * generate, reflect, renderWitnessState) runs detached from the HTTP response
 * and uses .catch(err => console.error(...)). Those errors go to the dev
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
 * Read the last N lines of the error log for surfacing in the UI.
 * Returns [] if the log doesn't exist yet.
 */
export function readRecentErrors(limit = 20): string[] {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const content = fs.readFileSync(LOG_PATH, 'utf8');
    const records = content.split(/\n\n/).filter(r => r.trim().length > 0);
    return records.slice(-limit);
  } catch {
    return [];
  }
}
