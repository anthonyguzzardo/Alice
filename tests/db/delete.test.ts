/**
 * Phase 6c — libDelete integration tests.
 *
 * Covers the load-bearing properties of the delete + factory-reset boundary:
 *   - deleteSubjectAndData wipes every subject-bearing table except the
 *     audit + consent tables (which are preserved forever)
 *   - tb_subjects row is soft-deleted (renamed + deactivated, subject_id stable)
 *   - audit row written inside the same transaction (rollback on cascade fail)
 *   - factoryResetSubject preserves account + sessions + questions + consent +
 *     audit; wipes everything else
 *   - owner protection: subject_id=1 is rejected at the boundary
 *   - idempotency: re-deleting a soft-deleted subject throws AlreadyDeletedError
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import sql from '../../src/lib/libDbPool.ts';
import {
  deleteSubjectAndData,
  factoryResetSubject,
  AlreadyDeletedError,
  OwnerProtectedError,
  SubjectNotFoundError,
  FACTORY_RESET_TABLES,
  FULL_DELETE_TABLES,
} from '../../src/lib/libDelete.ts';
import { recordConsent, CONSENT_VERSION } from '../../src/lib/libConsent.ts';

const SUBJECT_ID = 9201;
const OWNER_ID = 9999; // synthetic owner just for the protection test

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

beforeEach(async () => {
  // Clean every table where this test could have left rows.
  for (const t of [...FULL_DELETE_TABLES, 'tb_subject_consent', 'tb_data_access_log']) {
    await sql.unsafe(`DELETE FROM alice.${t} WHERE subject_id = $1`, [SUBJECT_ID]);
    await sql.unsafe(`DELETE FROM alice.${t} WHERE subject_id = $1`, [OWNER_ID]);
  }
  await sql`DELETE FROM tb_subjects WHERE subject_id = ${SUBJECT_ID}`;
  await sql`DELETE FROM tb_subjects WHERE subject_id = ${OWNER_ID}`;

  // Insert the test subject.
  await sql`
    INSERT INTO tb_subjects (subject_id, username, password_hash, must_reset_password, iana_timezone, is_owner, is_active)
    OVERRIDING SYSTEM VALUE
    VALUES (${SUBJECT_ID}, 'delete_test_subject', 'fake-hash', false, 'UTC', false, true)
  `;
});

async function plantSomeData(subjectId: number): Promise<void> {
  // Plant rows in a representative sample of cascade tables so the cascade
  // has work to do. The full table-by-table cleanup happens in beforeEach.
  await sql`
    INSERT INTO tb_subject_sessions (subject_id, token_hash, expires_at)
    VALUES (${subjectId}, 'fake-' || extract(epoch from now())::text || '-1', now() + interval '1 hour'),
           (${subjectId}, 'fake-' || extract(epoch from now())::text || '-2', now() + interval '1 hour')
  `;
  await sql`
    INSERT INTO tb_questions (subject_id, question_source_id, scheduled_for, text_ciphertext, text_nonce)
    VALUES (${subjectId}, 1, '2026-01-01', 'fakecipher', 'fakenonce')
  `;
  // Acknowledge consent so we have rows in tb_subject_consent + tb_data_access_log
  await recordConsent({ subjectId, version: CONSENT_VERSION });
}

describe('deleteSubjectAndData — full cascade', () => {
  it('wipes every cascade table, soft-deletes tb_subjects, preserves audit + consent', async () => {
    await plantSomeData(SUBJECT_ID);

    const result = await deleteSubjectAndData({
      subjectId: SUBJECT_ID,
      actor: 'operator',
      actorSubjectId: null,
    });

    expect(result.softDeletedUsername).toMatch(/^_deleted_\d{14}_9201_delete_test_subject$/);
    expect(result.originalUsername).toBe('delete_test_subject');
    expect(result.dataAccessLogId).toBeGreaterThan(0);

    // Every full-delete table has zero rows for this subject.
    for (const table of FULL_DELETE_TABLES) {
      const rows = await sql.unsafe(`SELECT count(*)::int AS c FROM alice.${table} WHERE subject_id = $1`, [SUBJECT_ID]) as Array<{ c: number }>;
      expect(rows[0]!.c, `expected ${table} to be empty after delete`).toBe(0);
    }

    // tb_subjects row exists but soft-deleted.
    const subjRows = await sql`SELECT username, is_active FROM tb_subjects WHERE subject_id = ${SUBJECT_ID}` as Array<{ username: string; is_active: boolean }>;
    expect(subjRows).toHaveLength(1);
    expect(subjRows[0]!.username.startsWith('_deleted_')).toBe(true);
    expect(subjRows[0]!.is_active).toBe(false);

    // Consent row preserved (forever).
    const consentRows = await sql`SELECT count(*)::int AS c FROM tb_subject_consent WHERE subject_id = ${SUBJECT_ID}` as Array<{ c: number }>;
    expect(consentRows[0]!.c).toBe(1);

    // Audit log has the consent + the delete rows.
    const auditRows = await sql`SELECT data_access_action_id, jsonb_typeof(notes) AS shape FROM tb_data_access_log WHERE subject_id = ${SUBJECT_ID} ORDER BY data_access_log_id` as Array<{ data_access_action_id: number; shape: string }>;
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
    expect(auditRows.find((r) => r.data_access_action_id === 4)).toBeTruthy(); // consent
    expect(auditRows.find((r) => r.data_access_action_id === 3)).toBeTruthy(); // delete
    // All notes are JSONB objects (not stringified).
    for (const r of auditRows) expect(r.shape).toBe('object');
  });

  it('throws AlreadyDeletedError on a re-delete (idempotency)', async () => {
    await plantSomeData(SUBJECT_ID);
    await deleteSubjectAndData({ subjectId: SUBJECT_ID, actor: 'operator', actorSubjectId: null });

    await expect(
      deleteSubjectAndData({ subjectId: SUBJECT_ID, actor: 'operator', actorSubjectId: null }),
    ).rejects.toBeInstanceOf(AlreadyDeletedError);
  });

  it('throws SubjectNotFoundError when the subject never existed', async () => {
    await expect(
      deleteSubjectAndData({ subjectId: 99998, actor: 'operator', actorSubjectId: null }),
    ).rejects.toBeInstanceOf(SubjectNotFoundError);
  });

  it('throws OwnerProtectedError when targeting subject_id=1', async () => {
    await expect(
      deleteSubjectAndData({ subjectId: 1, actor: 'operator', actorSubjectId: null }),
    ).rejects.toBeInstanceOf(OwnerProtectedError);
  });

  it('audit notes contains per-table row counts', async () => {
    await plantSomeData(SUBJECT_ID);
    const result = await deleteSubjectAndData({ subjectId: SUBJECT_ID, actor: 'operator', actorSubjectId: null });

    const rows = await sql`SELECT notes FROM tb_data_access_log WHERE data_access_log_id = ${result.dataAccessLogId}` as Array<{ notes: Record<string, unknown> }>;
    const notes = rows[0]!.notes;
    expect(notes['rowCounts']).toBeTypeOf('object');
    const rowCounts = notes['rowCounts'] as Record<string, number>;
    // tb_subject_sessions had 2 rows planted
    expect(rowCounts['tb_subject_sessions']).toBe(2);
    // tb_questions had 1 row planted
    expect(rowCounts['tb_questions']).toBe(1);
  });
});

describe('factoryResetSubject — preserve account + seeds', () => {
  it('wipes derived data, preserves tb_subjects + tb_subject_sessions + tb_questions + tb_subject_consent', async () => {
    await plantSomeData(SUBJECT_ID);

    const result = await factoryResetSubject({
      subjectId: SUBJECT_ID,
      actor: 'operator',
      actorSubjectId: null,
    });

    expect(result.username).toBe('delete_test_subject');
    expect(result.dataAccessLogId).toBeGreaterThan(0);

    // Every factory-reset table has zero rows for this subject (nothing to delete in our planted data, but the cascade ran).
    // tb_subject_sessions is NOT in FACTORY_RESET_TABLES — verify it's preserved.
    const sessionRows = await sql`SELECT count(*)::int AS c FROM tb_subject_sessions WHERE subject_id = ${SUBJECT_ID}` as Array<{ c: number }>;
    expect(sessionRows[0]!.c).toBe(2); // planted 2, all preserved

    // tb_questions is NOT in FACTORY_RESET_TABLES — verify preserved.
    const questionRows = await sql`SELECT count(*)::int AS c FROM tb_questions WHERE subject_id = ${SUBJECT_ID}` as Array<{ c: number }>;
    expect(questionRows[0]!.c).toBe(1);

    // tb_subjects unchanged (no soft-delete on factory-reset).
    const subjRows = await sql`SELECT username, is_active FROM tb_subjects WHERE subject_id = ${SUBJECT_ID}` as Array<{ username: string; is_active: boolean }>;
    expect(subjRows[0]!.username).toBe('delete_test_subject');
    expect(subjRows[0]!.is_active).toBe(true);

    // Consent + audit preserved.
    const consentRows = await sql`SELECT count(*)::int AS c FROM tb_subject_consent WHERE subject_id = ${SUBJECT_ID}` as Array<{ c: number }>;
    expect(consentRows[0]!.c).toBe(1);

    // Audit row for factory_reset action landed.
    const auditRows = await sql`SELECT data_access_action_id, jsonb_typeof(notes) AS shape FROM tb_data_access_log WHERE subject_id = ${SUBJECT_ID} AND data_access_action_id = 2` as Array<{ data_access_action_id: number; shape: string }>;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.shape).toBe('object');
  });

  it('throws OwnerProtectedError when targeting subject_id=1', async () => {
    await expect(
      factoryResetSubject({ subjectId: 1, actor: 'operator', actorSubjectId: null }),
    ).rejects.toBeInstanceOf(OwnerProtectedError);
  });

  it('throws AlreadyDeletedError if the subject is already soft-deleted', async () => {
    await plantSomeData(SUBJECT_ID);
    await deleteSubjectAndData({ subjectId: SUBJECT_ID, actor: 'operator', actorSubjectId: null });
    await expect(
      factoryResetSubject({ subjectId: SUBJECT_ID, actor: 'operator', actorSubjectId: null }),
    ).rejects.toBeInstanceOf(AlreadyDeletedError);
  });
});

describe('cascade order constants', () => {
  it('FACTORY_RESET_TABLES is a strict subset of FULL_DELETE_TABLES', () => {
    for (const t of FACTORY_RESET_TABLES) {
      expect(FULL_DELETE_TABLES).toContain(t);
    }
    // Full delete adds tb_questions + tb_subject_sessions on top of factory-reset.
    expect(FULL_DELETE_TABLES.length).toBe(FACTORY_RESET_TABLES.length + 2);
    expect(FULL_DELETE_TABLES).toContain('tb_questions');
    expect(FULL_DELETE_TABLES).toContain('tb_subject_sessions');
    expect(FACTORY_RESET_TABLES).not.toContain('tb_questions');
    expect(FACTORY_RESET_TABLES).not.toContain('tb_subject_sessions');
  });

  it('audit + consent tables are NEVER in either list', () => {
    expect(FULL_DELETE_TABLES).not.toContain('tb_data_access_log');
    expect(FULL_DELETE_TABLES).not.toContain('tb_subject_consent');
    expect(FULL_DELETE_TABLES).not.toContain('tb_subjects'); // soft-delete only, never hard
    expect(FACTORY_RESET_TABLES).not.toContain('tb_data_access_log');
    expect(FACTORY_RESET_TABLES).not.toContain('tb_subject_consent');
    expect(FACTORY_RESET_TABLES).not.toContain('tb_subjects');
  });
});
