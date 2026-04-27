/**
 * Hotspot E — libCrossSessionSignals.ts:47–79. getPriorTexts: fetches all
 * prior journal responses for the subject, ordered by scheduled_for DESC,
 * annotated with daysAgo relative to the current entry. Feeds into:
 *   - selfPerplexity (char trigram model trained on prior texts)
 *   - ncdAtLag (compression distance to closest entry at lag {1, 3, 7, 30})
 *   - vocabRecurrenceDecay (Jaccard decay across lags 1, 3, 7)
 *
 * Origin: canonical Step 0 §C list. See db/sql/migrations/030_STEP6_PLAN.md.
 *
 * Internal-pooling prediction outcome: NEGATIVE.
 *   This hotspot was the prediction-target for Step 6's "internal pooling
 *   survives correct outer SQL scoping" failure mode. Pre-test investigation
 *   (see report) confirmed the function and all its callees are stateless
 *   per call: zero module-level mutable state, Markov chain built fresh from
 *   priorTexts argument, no caches, no closures retaining data across calls.
 *   All three predicted sites (libProfile, libReconstruction,
 *   libCrossSessionSignals) come back clean. The Step 5 syntactic sweep is
 *   genuinely complete.
 *
 * What this verifies (E1):
 *   getPriorTexts(subjectId, currentQuestionId) returns ONLY the requested
 *   subject's prior journal responses. The Step 5 scoping
 *   (`q.subject_id = ${subjectId}`) confines the result set; downstream
 *   signals (perplexity, NCD, vocab decay) are then within-subject by
 *   construction.
 *
 * Silent-corruption failure mode (what this test guards against):
 *   If the WHERE clause is unscoped, priorTexts contains entries from
 *   other subjects. Every downstream signal — self-perplexity (trigram
 *   model trained on cross-subject corpus), NCD (compression distance to
 *   wrong subject's text at the matched lag), vocabRecurrenceDecay
 *   (Jaccard against another person's vocabulary) — is corrupted. The
 *   "novelty within this person's history" claim becomes between-subject
 *   distance.
 *
 * Rule 1 (LIMIT / heap order): partial. The query has ORDER BY
 * scheduled_for DESC but no tiebreaker on rows with the same date. More
 * importantly, downstream consumers use `priorTexts.find(...)` on the
 * fixture-ordered list — first match wins. The fixture controls dates so
 * other's entry sorts strictly BEFORE owner's lag-1 entry under pooled
 * scoping (other's apr_15 has scheduled_for > owner's apr_14), making the
 * mutation deterministically detectable via ncdLag1.
 *
 * Carry-forward applied: the assertion is on ncdLag1 (a magnitude check)
 * because the function returns derived signals — there's no exposed
 * `priorTexts.length` to count. The magnitude separation is dramatic
 * (~0 correct vs ~1 mutated) so the threshold is robust.
 *
 * Mutation log (verified during test development, see report):
 *   E1: WHERE q.subject_id removed from getPriorTexts → ncdLag1 jumps from
 *       near-zero (owner's identical apr_14 text) to near-one (other's
 *       structurally-disjoint apr_15 text). vocabRecurrenceDecay and
 *       selfPerplexity also shift but ncdLag1 is the cleanest single
 *       signal.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { computeCrossSessionSignals } from '../../../src/lib/libCrossSessionSignals.ts';
import {
  OWNER_ID,
  OTHER_ID,
  OWNER_PROFILE,
  OTHER_PROFILE,
  cleanupFixtureRows,
  seedTwoSubjects,
  insertJournalSession,
} from './_fixtures.ts';

// Highly distinctive, structurally-disjoint texts. Each is ~330 chars of a
// single repeated signature word — gzip compresses each one heavily on its
// own (NCD ≈ 0 for self-vs-self). Concatenated, the two share no substrings
// of length > 1, so gzip cannot compress the combined string much beyond
// the sum of the parts (NCD ≈ 1).
const OWNER_TEXT = ('alphabravo ').repeat(30).trim();
const OTHER_TEXT = ('zetafoxtrot ').repeat(30).trim();

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

describe('hotspot E — libCrossSessionSignals getPriorTexts scoping', () => {
  it('builds prior-text-derived signals from only the requested subject\'s journal corpus', async () => {
    await seedTwoSubjects(sql);

    // Helper: insert a journal session for subjectId at the given date,
    // then overwrite the response text with the supplied custom text.
    const insertWithText = async (
      subjectId: number,
      profile: typeof OWNER_PROFILE,
      scheduledFor: string,
      sessionIndex: number,
      customText: string,
    ): Promise<number> => {
      const qid = await insertJournalSession(sql, {
        subjectId,
        profile,
        scheduledFor,
        sessionIndex,
      });
      await sql`UPDATE tb_responses SET text = ${customText} WHERE question_id = ${qid}`;
      return qid;
    };

    // ── OTHER's journals — INSERTED FIRST so their question_ids are lower
    // and (when pooled) they sort to the top of getPriorTexts results by
    // virtue of having scheduled_for >= any owner prior date (apr_15) and
    // therefore appearing first under ORDER BY scheduled_for DESC.
    //
    // Critically, other_apr_15 has the SAME scheduled_for as owner's current
    // session. Under correct scoping it's filtered out (different subject).
    // Under unscoped scoping it appears in priorTexts with daysAgo=0, which
    // passes the lag-1 filter (|0 - 1| <= 1) and wins find() because it sorts
    // before owner's apr_14 entry (daysAgo=1) by scheduled_for DESC.
    await insertWithText(OTHER_ID, OTHER_PROFILE, '2026-04-15', 0, OTHER_TEXT);
    await insertWithText(OTHER_ID, OTHER_PROFILE, '2026-04-13', 1, OTHER_TEXT);
    await insertWithText(OTHER_ID, OTHER_PROFILE, '2026-04-10', 2, OTHER_TEXT);
    await insertWithText(OTHER_ID, OTHER_PROFILE, '2026-04-07', 3, OTHER_TEXT);
    await insertWithText(OTHER_ID, OTHER_PROFILE, '2026-04-04', 4, OTHER_TEXT);

    // ── OWNER's prior journals (5 entries; selfPerplexity gates on >=5) ──
    // Owner's apr_14 entry is exactly daysAgo=1 from owner's current
    // (apr_15). Under correct scoping it is the first match for ncdAtLag(1).
    // Its text matches OWNER_TEXT exactly so ncd(current, prior) ≈ 0.
    await insertWithText(OWNER_ID, OWNER_PROFILE, '2026-04-14', 0, OWNER_TEXT);
    await insertWithText(OWNER_ID, OWNER_PROFILE, '2026-04-12', 1, OWNER_TEXT);
    await insertWithText(OWNER_ID, OWNER_PROFILE, '2026-04-11', 2, OWNER_TEXT);
    await insertWithText(OWNER_ID, OWNER_PROFILE, '2026-04-09', 3, OWNER_TEXT);
    await insertWithText(OWNER_ID, OWNER_PROFILE, '2026-04-08', 4, OWNER_TEXT);

    // ── Owner's CURRENT journal session (the trigger) ──
    const ownerCurrentQid = await insertWithText(
      OWNER_ID,
      OWNER_PROFILE,
      '2026-04-15',
      100,
      OWNER_TEXT,
    );

    // ── Run the production path ──
    const signals = await computeCrossSessionSignals(
      OWNER_ID,
      ownerCurrentQid,
      OWNER_TEXT,
    );

    expect(signals).not.toBeNull();
    const s = signals!;

    // ── E1 assertion: ncdLag1 reflects owner-only prior at apr_14 ──
    // Correct scoping → ncd(OWNER_TEXT, OWNER_TEXT) ≈ near-zero (gzip
    // recognizes the duplicate). Mutation → ncd(OWNER_TEXT, OTHER_TEXT) ≈
    // near-one (no shared substrings). Threshold of 0.3 cleanly separates.
    expect(s.ncdLag1).not.toBeNull();
    expect(s.ncdLag1!).toBeLessThan(0.3);

    // ── Defense in depth: selfPerplexity computable + sane ──
    // The trigram model is trained on the 5 owner priors. Current text is
    // structurally identical (same repeated signature word). Perplexity
    // should be near 1 (perfect fit). Pooled trigrams from OTHER's text
    // would dilute owner's bigram/trigram counts and inflate perplexity.
    expect(s.selfPerplexity).not.toBeNull();
    expect(s.selfPerplexity!).toBeLessThan(20);

    // Note on vocabRecurrenceDecay: this fixture deliberately uses a
    // single repeated signature word (for clean NCD separation), so
    // currentWords.size = 1 < 5 and vocabRecurrenceDecay returns null
    // by design. We don't assert on it here — ncdLag1 and selfPerplexity
    // are sufficient to catch E1 mutation. A future hotspot test that
    // needs vocabRecurrenceDecay coverage would use a multi-word fixture
    // (still disjoint between subjects).
  });
});
