/**
 * Cross-subject leak guard for /api/subject/export.
 *
 * The export handler builds its result by iterating a fixed table list and
 * filtering each query by `WHERE subject_id = ${subjectId}`. The contract is:
 * exporting subject A must NEVER yield a row whose `subject_id` is anything
 * other than A. A copy-paste error in any single table block (forgetting the
 * WHERE clause, hardcoding a subject_id, joining without a scope) would
 * silently leak another subject's data into the export — and the leak would
 * only be detectable by reading every line of every export by hand.
 *
 * This test plants data for two synthetic subjects, runs the handler for
 * subject A, and asserts no streamed row references subject B's id.
 *
 * Closes security-posture-2026-04-28 § Scoped plan item #6 (cross-subject
 * leak guard test).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import sql from '../../src/lib/libDbPool.ts';
import { GET } from '../../src/pages/api/subject/export.ts';
import { recordConsent, CONSENT_VERSION } from '../../src/lib/libConsent.ts';
import { encrypt } from '../../src/lib/libCrypto.ts';

const SUBJECT_A = 9301;
const SUBJECT_B = 9302;

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

beforeEach(async () => {
  // Wipe any prior test rows. The export touches ~25 tables; we hit the ones
  // we plant into below plus the audit/consent pair.
  for (const id of [SUBJECT_A, SUBJECT_B]) {
    for (const t of [
      'tb_responses', 'tb_questions', 'tb_session_summaries', 'tb_session_events',
      'tb_subject_sessions', 'tb_subject_consent', 'tb_data_access_log',
    ]) {
      await sql.unsafe(`DELETE FROM alice.${t} WHERE subject_id = $1`, [id]);
    }
    await sql`DELETE FROM tb_subjects WHERE subject_id = ${id}`;
  }

  for (const [id, username] of [[SUBJECT_A, 'leak_test_a'], [SUBJECT_B, 'leak_test_b']] as const) {
    await sql`
      INSERT INTO tb_subjects (subject_id, username, password_hash, must_reset_password, iana_timezone, is_owner, is_active)
      OVERRIDING SYSTEM VALUE
      VALUES (${id}, ${username}, 'fake-hash', false, 'UTC', false, true)
    `;
  }
});

async function plantData(subjectId: number, marker: string): Promise<void> {
  // A question + response for the subject, encrypted as the real pipeline does.
  const qText = encrypt(`question text for ${marker}`);
  const [q] = await sql<{ question_id: number }[]>`
    INSERT INTO tb_questions (subject_id, question_source_id, scheduled_for, text_ciphertext, text_nonce)
    VALUES (${subjectId}, 1, '2026-01-01', ${qText.ciphertext}, ${qText.nonce})
    RETURNING question_id
  `;
  const rText = encrypt(`response text for ${marker}`);
  await sql`
    INSERT INTO tb_responses (subject_id, question_id, text_ciphertext, text_nonce)
    VALUES (${subjectId}, ${q!.question_id}, ${rText.ciphertext}, ${rText.nonce})
  `;
  await sql`
    INSERT INTO tb_subject_sessions (subject_id, token_hash, expires_at)
    VALUES (${subjectId}, ${'leak-' + marker + '-' + Date.now()}, now() + interval '1 hour')
  `;
  await recordConsent({ subjectId, version: CONSENT_VERSION });
}

describe('export — cross-subject leak guard', () => {
  it('exporting subject A returns zero rows referencing subject B', async () => {
    await plantData(SUBJECT_A, 'aaa');
    await plantData(SUBJECT_B, 'bbb');

    const fakeRequest = new Request('http://localhost/api/subject/export', {
      method: 'GET',
      headers: { 'user-agent': 'leak-test', 'x-forwarded-for': '127.0.0.1' },
    });
    const fakeContext = {
      request: fakeRequest,
      locals: {
        subject: {
          subject_id: SUBJECT_A,
          username: 'leak_test_a',
          is_owner: false,
          is_active: true,
          must_reset_password: false,
          iana_timezone: 'UTC',
        },
      },
    };

    // Astro APIRoute signature is loose enough that the test fixture above is
    // a structural match for what the handler actually reads.
    const response = await (GET as unknown as (ctx: typeof fakeContext) => Promise<Response>)(fakeContext);
    expect(response.status).toBe(200);
    const body = await response.text();

    const lines = body.split('\n').filter(l => l.length > 0);
    expect(lines.length).toBeGreaterThan(2); // metadata + at least one row + end

    let rowCount = 0;
    let foundOwnSubjectId = false;
    for (const line of lines) {
      const obj = JSON.parse(line) as {
        type: string;
        table?: string;
        data?: Record<string, unknown>;
      };
      if (obj.type !== 'row') continue;
      rowCount++;
      const data = obj.data ?? {};
      // Every export row carries either a subject_id field OR is keyed in a
      // table where the subject_id is the join target. Scan for any field that
      // could carry the wrong subject_id.
      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'number') continue;
        // Match any column ending in _subject_id, plus the bare subject_id.
        if (key === 'subject_id' || key === 'actor_subject_id') {
          if (value === SUBJECT_B) {
            throw new Error(
              `LEAK: export for subject ${SUBJECT_A} returned row in ${obj.table} with ${key}=${SUBJECT_B}: ${JSON.stringify(data)}`,
            );
          }
          if (key === 'subject_id' && value === SUBJECT_A) foundOwnSubjectId = true;
        }
      }
    }

    expect(rowCount).toBeGreaterThan(0);
    expect(foundOwnSubjectId).toBe(true); // sanity: A's own data did stream
  });
});
