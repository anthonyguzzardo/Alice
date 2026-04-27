/**
 * Migration 031 — at-rest encryption end-to-end test.
 *
 * Verifies the load-bearing properties of the encryption boundary:
 *
 *   1. Writes through libDb produce ciphertext on disk.
 *      A raw SELECT against tb_responses.text_ciphertext returns base64
 *      that is NOT the original plaintext.
 *
 *   2. Reads through libDb decrypt back to plaintext.
 *      libDb.getResponseText() (and friends) return the original string.
 *
 *   3. The encryption is invisible above libDb. Application callers see
 *      strings on the way in and strings on the way out — never ciphertext.
 *
 *   4. Tampering throws. A modified ciphertext column fails decryption
 *      loudly. (libCrypto's crypto.test.ts proves the underlying primitive;
 *      this re-exercises it through the libDb path to confirm the wiring.)
 *
 * The test exercises the complete column inventory (tb_responses,
 * tb_questions, tb_reflections, tb_embeddings, tb_session_events) so any
 * wiring drift is caught — not just one column. tb_calibration_context was
 * archived 2026-04-27 (INC-015) and dropped from this test.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import sql, {
  saveResponse,
  scheduleQuestion,
  saveReflection,
  saveSessionEvents,
  insertEmbeddingMeta,
  getResponseText,
  getQuestionTextById,
  getLatestReflectionWithCoverage,
  getEventLogJson,
  getKeystrokeStreamJson,
  getSessionEvents,
} from '../../src/lib/libDb.ts';

const SUBJECT_ID = 9001;

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

beforeEach(async () => {
  // Clean only this test's subject rows so we don't disturb other db-project
  // test files that share the container.
  for (const t of [
    'tb_session_events', 'tb_embeddings',
    'tb_reflections', 'tb_responses', 'tb_questions', 'tb_subjects',
  ]) {
    await sql.unsafe(`DELETE FROM ${t} WHERE subject_id = $1`, [SUBJECT_ID]);
  }
  await sql`
    INSERT INTO tb_subjects (subject_id, username, password_hash, is_owner, must_reset_password, iana_timezone)
    OVERRIDING SYSTEM VALUE
    VALUES (${SUBJECT_ID}, ${'enc-test-' + SUBJECT_ID}, 'placeholder', FALSE, FALSE, 'UTC')
  `;
});

describe('migration 031 — encryption round-trip through libDb', () => {
  it('tb_responses.text — write encrypts, read decrypts, raw SELECT shows ciphertext', async () => {
    // First we need a question (FK from response → question). scheduleQuestion
    // is also encrypted, so this also exercises tb_questions.text.
    const plaintextQuestion = 'Today, what surprised you?';
    await scheduleQuestion(SUBJECT_ID, plaintextQuestion, '2026-04-27', 'seed');
    const qRows0 = await sql`
      SELECT question_id FROM tb_questions WHERE subject_id = ${SUBJECT_ID} AND scheduled_for = '2026-04-27'
    ` as Array<{ question_id: number }>;
    const questionId = qRows0[0]!.question_id;

    const plaintext = 'I noticed I was holding my breath at the meeting.';
    await saveResponse(SUBJECT_ID, questionId, plaintext);

    // (1) raw SELECT shows ciphertext, not plaintext
    const rawRows = await sql`
      SELECT text_ciphertext, text_nonce
      FROM tb_responses
      WHERE subject_id = ${SUBJECT_ID} AND question_id = ${questionId}
    ` as Array<{ text_ciphertext: string; text_nonce: string }>;
    expect(rawRows).toHaveLength(1);
    expect(rawRows[0]!.text_ciphertext).not.toBe(plaintext);
    expect(rawRows[0]!.text_ciphertext).not.toContain('breath');
    expect(rawRows[0]!.text_ciphertext.length).toBeGreaterThan(0);
    expect(rawRows[0]!.text_nonce.length).toBeGreaterThan(0);

    // (2) libDb read returns plaintext
    const readBack = await getResponseText(SUBJECT_ID, questionId);
    expect(readBack).toBe(plaintext);
  });

  it('tb_questions.text — round-trip via getQuestionTextById', async () => {
    await scheduleQuestion(SUBJECT_ID, 'What does honesty cost you today?', '2026-04-28', 'seed');
    const qRowsX = await sql`
      SELECT question_id FROM tb_questions WHERE subject_id = ${SUBJECT_ID} AND scheduled_for = '2026-04-28'
    ` as Array<{ question_id: number }>;
    const question_id = qRowsX[0]!.question_id;

    const rawRows = await sql`
      SELECT text_ciphertext FROM tb_questions WHERE question_id = ${question_id}
    ` as Array<{ text_ciphertext: string }>;
    expect(rawRows[0]!.text_ciphertext).not.toContain('honesty');

    const info = await getQuestionTextById(SUBJECT_ID, question_id);
    expect(info?.text).toBe('What does honesty cost you today?');
    expect(info?.question_source_id).toBe(1);
  });

  it('tb_reflections.text — saveReflection / getLatestReflectionWithCoverage', async () => {
    const plaintext = 'Pattern: avoidance peaks before deadlines.';
    await saveReflection(SUBJECT_ID, plaintext, 'weekly', 999);

    const rawRows = await sql`
      SELECT text_ciphertext FROM tb_reflections WHERE subject_id = ${SUBJECT_ID}
    ` as Array<{ text_ciphertext: string }>;
    expect(rawRows[0]!.text_ciphertext).not.toContain('avoidance');

    const latest = await getLatestReflectionWithCoverage(SUBJECT_ID);
    expect(latest?.text).toBe(plaintext);
    expect(latest?.coverage_through_response_id).toBe(999);
  });

  it('tb_embeddings.embedded_text — round-trip via insertEmbeddingMeta path', async () => {
    await scheduleQuestion(SUBJECT_ID, 'placeholder', '2026-04-30', 'seed');
    const qRowsX = await sql`
      SELECT question_id FROM tb_questions WHERE subject_id = ${SUBJECT_ID} AND scheduled_for = '2026-04-30'
    ` as Array<{ question_id: number }>;
    const question_id = qRowsX[0]!.question_id;
    const responseId = await saveResponse(SUBJECT_ID, question_id, 'plaintext response');

    // insertEmbeddingMeta encrypts the embedded_text on write.
    const embeddedText = 'This is the embedded text payload.';
    await insertEmbeddingMeta(SUBJECT_ID, 1, responseId, embeddedText, '2026-04-30', 'fixture-model');

    const rawRows = await sql`
      SELECT embedded_text_ciphertext, embedded_text_nonce FROM tb_embeddings
      WHERE subject_id = ${SUBJECT_ID} AND source_record_id = ${responseId}
    ` as Array<{ embedded_text_ciphertext: string; embedded_text_nonce: string }>;
    expect(rawRows).toHaveLength(1);
    expect(rawRows[0]!.embedded_text_ciphertext).not.toContain('payload');
    expect(rawRows[0]!.embedded_text_ciphertext.length).toBeGreaterThan(0);
  });

  it('tb_session_events — event_log + keystroke_stream JSONB round-trip', async () => {
    await scheduleQuestion(SUBJECT_ID, 'placeholder', '2026-05-01', 'seed');
    const qRowsX = await sql`
      SELECT question_id FROM tb_questions WHERE subject_id = ${SUBJECT_ID} AND scheduled_for = '2026-05-01'
    ` as Array<{ question_id: number }>;
    const question_id = qRowsX[0]!.question_id;

    const eventLog = JSON.stringify([[0, 0, 0, 'h'], [120, 1, 0, 'i'], [380, 2, 0, '!']]);
    const keystrokeStream = JSON.stringify([
      { c: 'h', d: 0.0, u: 80.0 },
      { c: 'i', d: 120.5, u: 200.5 },
      { c: '!', d: 380.0, u: 460.0 },
    ]);

    await saveSessionEvents({
      subject_id: SUBJECT_ID,
      question_id,
      event_log_json: eventLog,
      total_events: 3,
      session_duration_ms: 460,
      keystroke_stream_json: keystrokeStream,
      total_input_events: 3,
      decimation_count: 0,
    });

    const rawRows = await sql`
      SELECT event_log_ciphertext, event_log_nonce,
             keystroke_stream_ciphertext, keystroke_stream_nonce
      FROM tb_session_events
      WHERE subject_id = ${SUBJECT_ID} AND question_id = ${question_id}
    ` as Array<{
      event_log_ciphertext: string; event_log_nonce: string;
      keystroke_stream_ciphertext: string | null; keystroke_stream_nonce: string | null;
    }>;
    expect(rawRows).toHaveLength(1);
    // Plaintext "insertedText" or "h" character should not appear in ciphertext
    expect(rawRows[0]!.event_log_ciphertext).not.toContain('insertedText');
    expect(rawRows[0]!.keystroke_stream_ciphertext).not.toContain('"c":"h"');

    // libDb decrypts on read
    const eventLogReadback = await getEventLogJson(SUBJECT_ID, question_id);
    expect(eventLogReadback).toBe(eventLog);

    const ksReadback = await getKeystrokeStreamJson(SUBJECT_ID, question_id);
    expect(ksReadback).toBe(keystrokeStream);

    // getSessionEvents returns the full row with both decrypted
    const events = await getSessionEvents(SUBJECT_ID, question_id);
    expect(events?.event_log_json).toBe(eventLog);
    expect(events?.keystroke_stream_json).toBe(keystrokeStream);
    expect(events?.total_events).toBe(3);
  });

  it('tampered ciphertext throws on read', async () => {
    await scheduleQuestion(SUBJECT_ID, 'placeholder', '2026-05-02', 'seed');
    const qRowsX = await sql`
      SELECT question_id FROM tb_questions WHERE subject_id = ${SUBJECT_ID} AND scheduled_for = '2026-05-02'
    ` as Array<{ question_id: number }>;
    const question_id = qRowsX[0]!.question_id;
    await saveResponse(SUBJECT_ID, question_id, 'pristine plaintext');

    // Flip a byte in the ciphertext — base64 stays valid but the auth tag fails.
    await sql`
      UPDATE tb_responses
      SET text_ciphertext = OVERLAY(text_ciphertext PLACING 'A' FROM 1 FOR 1)
      WHERE subject_id = ${SUBJECT_ID} AND question_id = ${question_id}
    `;

    await expect(getResponseText(SUBJECT_ID, question_id)).rejects.toThrow();
  });

  it('different writes of identical plaintext produce different ciphertext (nonce uniqueness)', async () => {
    // Schedule two journal questions with identical plaintext on different dates.
    await scheduleQuestion(SUBJECT_ID, 'identical question', '2026-05-03', 'seed');
    await scheduleQuestion(SUBJECT_ID, 'identical question', '2026-05-04', 'seed');

    const rawRows = await sql`
      SELECT text_ciphertext, text_nonce FROM tb_questions
      WHERE subject_id = ${SUBJECT_ID} AND scheduled_for >= '2026-05-03'
      ORDER BY scheduled_for
    ` as Array<{ text_ciphertext: string; text_nonce: string }>;
    expect(rawRows).toHaveLength(2);
    // Same plaintext, different ciphertext — proves nonce was fresh per write.
    expect(rawRows[0]!.text_ciphertext).not.toBe(rawRows[1]!.text_ciphertext);
    expect(rawRows[0]!.text_nonce).not.toBe(rawRows[1]!.text_nonce);
  });
});
