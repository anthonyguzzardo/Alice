import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readRecentErrors, logError } from '../../src/lib/utlErrorLog.ts';

const LOG_PATH = path.join(process.cwd(), 'data', 'errors.log');

function freshLog(records: string[]): void {
  fs.writeFileSync(LOG_PATH, records.join('') + '\n');
}

function record(timestamp: string, job: string, message = 'something failed'): string {
  return `[${timestamp}] [${job}]\n${message}\n\n`;
}

describe('readRecentErrors — time window + limit', () => {
  // Capture the pre-test state ONCE so per-test mutations don't poison the restore.
  // CI workspaces don't ship with data/ (it's gitignored), so ensure the dir
  // exists before any writeFileSync calls. Tracks whether we created it so
  // afterAll can clean up after itself when the dir wasn't there to begin with.
  let originalContent: string | null = null;
  let createdDataDir = false;

  beforeAll(() => {
    const dataDir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      createdDataDir = true;
    }
    originalContent = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf8') : null;
  });

  afterAll(() => {
    if (originalContent === null) {
      if (fs.existsSync(LOG_PATH)) fs.unlinkSync(LOG_PATH);
    } else {
      fs.writeFileSync(LOG_PATH, originalContent);
    }
    if (createdDataDir && fs.existsSync(path.dirname(LOG_PATH))) {
      try {
        fs.rmdirSync(path.dirname(LOG_PATH));
      } catch {
        // dir not empty (something else wrote there); leave it
      }
    }
  });

  it('returns [] when the log does not exist', () => {
    if (fs.existsSync(LOG_PATH)) fs.unlinkSync(LOG_PATH);
    expect(readRecentErrors()).toEqual([]);
  });

  it('returns records inside the time window, drops records outside', () => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    freshLog([
      record(threeDaysAgo, 'old.job'),
      record(oneHourAgo, 'fresh.job'),
    ]);
    const recent = readRecentErrors(20);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toContain('fresh.job');
  });

  it('respects a custom withinMs window', () => {
    const now = Date.now();
    const fortyFiveMinAgo = new Date(now - 45 * 60 * 1000).toISOString();
    const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
    freshLog([
      record(fortyFiveMinAgo, 'older.job'),
      record(tenMinAgo, 'newer.job'),
    ]);
    const within30min = readRecentErrors(20, 30 * 60 * 1000);
    expect(within30min).toHaveLength(1);
    expect(within30min[0]).toContain('newer.job');
  });

  it('respects the limit when more records fit the window than limit allows', () => {
    const now = Date.now();
    freshLog(
      Array.from({ length: 25 }, (_, i) =>
        record(new Date(now - i * 60 * 1000).toISOString(), `job.${i}`)
      ).reverse()
    );
    const recent = readRecentErrors(5);
    expect(recent).toHaveLength(5);
    expect(recent.at(-1)).toContain('job.0');
  });

  it('includes records with unparseable timestamps (fail-safe)', () => {
    freshLog([
      'not a normal record\nsome trailing text\n\n',
    ]);
    const recent = readRecentErrors(20);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toContain('not a normal record');
  });

  it('logError appends a record and readRecentErrors picks it up', () => {
    fs.writeFileSync(LOG_PATH, '');
    logError('test.job', new Error('boom'), { foo: 'bar' });
    const recent = readRecentErrors(20);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toContain('test.job');
    expect(recent[0]).toContain('"foo":"bar"');
  });
});
