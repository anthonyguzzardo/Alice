/**
 * Phase 6c — libConsent integration tests.
 *
 * Covers the load-bearing properties of the consent + audit boundary:
 *   - recordConsent atomicity (consent row + audit row land together or not at all)
 *   - recordConsent rejects non-current versions and unknown versions
 *   - recordDataAccess writes JSONB notes as objects (not stringified — the
 *     bug discovered during step 7 smoke testing)
 *   - getSubjectConsentStatus shape for never-consented vs. acknowledged
 *   - getSubjectConsentHistory deduplication via DISTINCT ON
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import sql from '../../src/lib/libDbPool.ts';
import {
  CONSENT_VERSION,
  recordConsent,
  recordDataAccess,
  getSubjectConsentStatus,
  getSubjectConsentHistory,
} from '../../src/lib/libConsent.ts';

const SUBJECT_ID = 9101;

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

beforeEach(async () => {
  // Clean only this test's subject rows.
  await sql`DELETE FROM tb_data_access_log WHERE subject_id = ${SUBJECT_ID}`;
  await sql`DELETE FROM tb_subject_consent WHERE subject_id = ${SUBJECT_ID}`;
  await sql`DELETE FROM tb_subjects WHERE subject_id = ${SUBJECT_ID}`;
  // Insert the test subject. id is forced via OVERRIDING SYSTEM VALUE so the
  // identity sequence stays in sync with the production schema.
  await sql`
    INSERT INTO tb_subjects (subject_id, username, password_hash, must_reset_password, iana_timezone, is_owner, is_active)
    OVERRIDING SYSTEM VALUE
    VALUES (${SUBJECT_ID}, 'consent_test_subject', 'fake-hash', false, 'UTC', false, true)
  `;
});

describe('getSubjectConsentStatus', () => {
  it('returns null + isCurrent=false for a subject that has never consented', async () => {
    const status = await getSubjectConsentStatus(SUBJECT_ID);
    expect(status).toEqual({
      subjectId: SUBJECT_ID,
      currentVersion: null,
      acknowledgedAtUtc: null,
      isCurrent: false,
    });
  });

  it('returns isCurrent=true when the most-recent acknowledgment matches CONSENT_VERSION', async () => {
    await recordConsent({ subjectId: SUBJECT_ID, version: CONSENT_VERSION });
    const status = await getSubjectConsentStatus(SUBJECT_ID);
    expect(status.isCurrent).toBe(true);
    expect(status.currentVersion).toBe(CONSENT_VERSION);
    expect(status.acknowledgedAtUtc).toBeTruthy();
    // Type contract: acknowledgedAtUtc is a string (post-step-9 ::text cast).
    expect(typeof status.acknowledgedAtUtc).toBe('string');
  });
});

describe('recordConsent', () => {
  it('atomically writes a consent row + an audit row in the same transaction', async () => {
    const result = await recordConsent({
      subjectId: SUBJECT_ID,
      version: CONSENT_VERSION,
      ipAddress: '203.0.113.5',
      userAgent: 'test-ua',
    });

    expect(result.subjectConsentId).toBeGreaterThan(0);
    expect(result.dataAccessLogId).toBeGreaterThan(0);

    const consentRows = await sql`
      SELECT subject_consent_id, consent_version, ip_address, user_agent
      FROM tb_subject_consent WHERE subject_id = ${SUBJECT_ID}
    ` as Array<{ subject_consent_id: number; consent_version: string; ip_address: string; user_agent: string }>;
    expect(consentRows).toHaveLength(1);
    expect(consentRows[0]!.subject_consent_id).toBe(result.subjectConsentId);
    expect(consentRows[0]!.consent_version).toBe(CONSENT_VERSION);
    expect(consentRows[0]!.ip_address).toBe('203.0.113.5');

    const auditRows = await sql`
      SELECT data_access_log_id, data_access_action_id, data_access_actor_id, notes
      FROM tb_data_access_log WHERE subject_id = ${SUBJECT_ID}
    ` as Array<{ data_access_log_id: number; data_access_action_id: number; data_access_actor_id: number; notes: Record<string, unknown> }>;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.data_access_log_id).toBe(result.dataAccessLogId);
    expect(auditRows[0]!.data_access_action_id).toBe(4); // 'consent'
    expect(auditRows[0]!.data_access_actor_id).toBe(1);  // 'subject'
    // Audit notes round-trips as a JS object (not a string — the JSONB
    // double-encoding bug fixed in step 7 must stay fixed).
    expect(typeof auditRows[0]!.notes).toBe('object');
    expect(auditRows[0]!.notes['subjectConsentId']).toBe(result.subjectConsentId);
  });

  it('refuses any version other than CONSENT_VERSION', async () => {
    await expect(
      recordConsent({ subjectId: SUBJECT_ID, version: 'v0' }),
    ).rejects.toThrow(/refusing to acknowledge version "v0"/);

    await expect(
      recordConsent({ subjectId: SUBJECT_ID, version: 'v999' }),
    ).rejects.toThrow(/refusing to acknowledge version "v999"/);

    // No rows landed despite the throws.
    const consentCount = await sql`SELECT count(*)::int AS c FROM tb_subject_consent WHERE subject_id = ${SUBJECT_ID}` as Array<{ c: number }>;
    expect(consentCount[0]!.c).toBe(0);
    const auditCount = await sql`SELECT count(*)::int AS c FROM tb_data_access_log WHERE subject_id = ${SUBJECT_ID}` as Array<{ c: number }>;
    expect(auditCount[0]!.c).toBe(0);
  });

  it('flips getSubjectConsentStatus.isCurrent to true after recording', async () => {
    expect((await getSubjectConsentStatus(SUBJECT_ID)).isCurrent).toBe(false);
    await recordConsent({ subjectId: SUBJECT_ID, version: CONSENT_VERSION });
    expect((await getSubjectConsentStatus(SUBJECT_ID)).isCurrent).toBe(true);
  });
});

describe('recordDataAccess', () => {
  it('writes JSONB notes that round-trip as an object (not a stringified JSON)', async () => {
    const id = await recordDataAccess({
      subjectId: SUBJECT_ID,
      action: 'export',
      actor: 'subject',
      actorSubjectId: SUBJECT_ID,
      notes: { status: 'started', schemaVersion: '1', count: 42 },
    });

    const rows = await sql`
      SELECT notes, jsonb_typeof(notes) AS shape
      FROM tb_data_access_log WHERE data_access_log_id = ${id}
    ` as Array<{ notes: Record<string, unknown>; shape: string }>;

    expect(rows[0]!.shape).toBe('object'); // not 'string'
    expect(typeof rows[0]!.notes).toBe('object');
    expect(rows[0]!.notes['status']).toBe('started');
    expect(rows[0]!.notes['count']).toBe(42);
  });

  it('truncates ip_address to 45 chars and user_agent to 200 chars', async () => {
    const longIp = 'a'.repeat(60);
    const longUa = 'b'.repeat(300);
    const id = await recordDataAccess({
      subjectId: SUBJECT_ID,
      action: 'export',
      actor: 'subject',
      actorSubjectId: SUBJECT_ID,
      ipAddress: longIp,
      userAgent: longUa,
    });
    const rows = await sql`SELECT ip_address, user_agent FROM tb_data_access_log WHERE data_access_log_id = ${id}` as Array<{ ip_address: string; user_agent: string }>;
    expect(rows[0]!.ip_address).toHaveLength(45);
    expect(rows[0]!.user_agent).toHaveLength(200);
  });
});

describe('getSubjectConsentHistory dedup', () => {
  it('returns one row per consent_version even when the subject acknowledged the same version multiple times', async () => {
    // First acknowledgment of v1
    await recordConsent({ subjectId: SUBJECT_ID, version: CONSENT_VERSION });
    // Re-acknowledgment (would happen if endpoint idempotency check fails)
    // — directly insert a duplicate row to simulate the case the dedup is
    // supposed to handle.
    await sql`
      INSERT INTO tb_subject_consent (subject_id, consent_version)
      VALUES (${SUBJECT_ID}, ${CONSENT_VERSION})
    `;
    await sql`
      INSERT INTO tb_subject_consent (subject_id, consent_version)
      VALUES (${SUBJECT_ID}, ${CONSENT_VERSION})
    `;

    // Three rows in the table, but the history view dedups to one.
    const rawCount = await sql`SELECT count(*)::int AS c FROM tb_subject_consent WHERE subject_id = ${SUBJECT_ID}` as Array<{ c: number }>;
    expect(rawCount[0]!.c).toBe(3);

    const history = await getSubjectConsentHistory(SUBJECT_ID);
    expect(history).toHaveLength(1);
    expect(history[0]!.version).toBe(CONSENT_VERSION);
  });

  it('returns empty array for a subject with no acknowledgments', async () => {
    const history = await getSubjectConsentHistory(SUBJECT_ID);
    expect(history).toHaveLength(0);
  });
});
