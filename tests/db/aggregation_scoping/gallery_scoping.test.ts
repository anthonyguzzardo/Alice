/**
 * Hotspot G — src/pages/api/gallery.ts:18-40 (now extracted as
 * getGallerySessionDays + getGalleryWitnesses helpers).
 *
 *   G-1 (sessionDays q.subject_id): SELECT q.scheduled_for, MIN(...),
 *       COUNT(...) FROM tb_responses JOIN tb_questions GROUP BY
 *       scheduled_for. Subject scope on the journal questions.
 *   G-2 (witnesses subject_id): SELECT FROM tb_witness_states WHERE
 *       subject_id = $1. Single-table per-subject ordered list.
 *
 * Origin: handoff item G. Public-facing AN gallery; the GET handler is
 * owner-pinned via OWNER_SUBJECT_ID. The two queries are extracted as
 * exported helpers so this test exercises them with a fixture subject
 * (OWNER_ID=1001) without needing to seed at subject_id=1 (which is
 * shared with subjectAuth.test.ts).
 *
 * Silent-corruption failure mode:
 *   The gallery is consumed by Alice Negative. A scoping bug renders
 *   another subject's session days as gallery cells, with traits drawn
 *   from a chimerized witness sequence — the gallery becomes a public
 *   surface that displays the wrong person's behavioral fingerprint.
 *
 * Mutation log:
 *   G-1 (sessionDays q.subject_id): result.length grows from 2 to 3
 *       (adds OTHER's 2026-04-15 session day).
 *   G-2 (witnesses subject_id): witnesses.length grows from 2 to 3
 *       (adds OTHER's witness state).
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import {
  getGallerySessionDays,
  getGalleryWitnesses,
} from '../../../src/pages/api/gallery.ts';
import {
  OWNER_ID,
  OTHER_ID,
  OWNER_PROFILE,
  OTHER_PROFILE,
  cleanupFixtureRows,
  seedTwoSubjects,
  insertJournalSession,
} from './_fixtures.ts';

beforeAll(async () => {
  if (!process.env.ALICE_PG_URL?.includes('@')) {
    throw new Error(
      'tests/db expected ALICE_PG_URL to be set by globalSetup; got: ' +
        String(process.env.ALICE_PG_URL),
    );
  }
});

beforeEach(async () => {
  await cleanupFixtureRows(sql);
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

async function insertWitness(
  subjectId: number,
  entryCount: number,
  traits: Record<string, unknown> = {},
  dttm?: string,
): Promise<void> {
  await sql`
    INSERT INTO tb_witness_states (subject_id, entry_count, traits_json, signals_json, dttm_created_utc)
    VALUES (
      ${subjectId},
      ${entryCount},
      ${JSON.stringify(traits)}::jsonb,
      ${JSON.stringify({})}::jsonb,
      COALESCE(${dttm ?? null}::timestamptz, CURRENT_TIMESTAMP)
    )
  `;
}

describe('hotspot G — gallery scoping', () => {
  it('returns OWNER-only session days and witnesses', async () => {
    await seedTwoSubjects(sql);

    // OWNER: 2 journal day-pairs.
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-04-10',
      sessionIndex: 0,
    });
    await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-04-12',
      sessionIndex: 1,
    });

    // OWNER: 2 witness states.
    await insertWitness(OWNER_ID, 1, { mood: 'owner-1' }, '2026-04-10T13:00:00Z');
    await insertWitness(OWNER_ID, 2, { mood: 'owner-2' }, '2026-04-12T13:00:00Z');

    // OTHER: 1 journal day, 1 witness — would contaminate either query
    // if its subject scope is removed.
    await insertJournalSession(sql, {
      subjectId: OTHER_ID,
      profile: OTHER_PROFILE,
      scheduledFor: '2026-04-15',
      sessionIndex: 200,
    });
    await insertWitness(OTHER_ID, 1, { mood: 'other-1' }, '2026-04-15T13:00:00Z');

    // ── G-1: getGallerySessionDays ──────────────────────────────────────
    // postgres.js returns DATE columns as JS Date objects despite the
    // TypeScript cast `as string`; normalize via toISOString().slice(0,10).
    const sessionDays = await getGallerySessionDays(OWNER_ID);
    expect(sessionDays.length).toBe(2);
    const dateStrs = sessionDays
      .map((d) => new Date(d.scheduled_for as unknown as Date).toISOString().slice(0, 10))
      .sort();
    expect(dateStrs).toEqual(['2026-04-10', '2026-04-12']);

    // ── G-2: getGalleryWitnesses ────────────────────────────────────────
    const witnesses = await getGalleryWitnesses(OWNER_ID);
    expect(witnesses.length).toBe(2);
    const moods = witnesses.map((w) =>
      (typeof w.traits_json === 'string'
        ? JSON.parse(w.traits_json)
        : (w.traits_json as Record<string, unknown>))['mood'] as string
    );
    expect(moods).toEqual(['owner-1', 'owner-2']);
  });
});
