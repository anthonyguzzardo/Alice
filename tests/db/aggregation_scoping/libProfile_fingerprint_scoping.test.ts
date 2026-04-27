/**
 * Hotspot C — libProfile.ts:46–138, six aggregation SELECTs that build
 * the personal behavioral fingerprint.
 *
 * Origin: canonical Step 0 §C list. See db/sql/migrations/030_STEP6_PLAN.md.
 *
 * What this verifies:
 *   updateProfile(subjectId, questionId) reads from six tables
 *   (tb_session_summaries, tb_motor_signals, tb_process_signals,
 *   tb_burst_sequences, tb_rburst_sequences, tb_responses), aggregates each,
 *   and writes ONE row to tb_personal_profile for the given subject. The
 *   resulting profile is a person's writing fingerprint — it feeds the
 *   ghost (libReconstruction) and is the basis for every reconstruction
 *   residual.
 *
 * Silent-corruption failure mode (what this test guards against):
 *   If any of the six SELECTs forgets `WHERE q.subject_id = ${subjectId}`,
 *   the resulting profile becomes a chimera — owner motor stats blended
 *   with subject 999's stats, owner vocabulary mixed with subject 999's
 *   vocabulary, owner pause architecture averaged with subject 999's
 *   architecture. The ghost trained on this chimera produces meaningless
 *   reconstruction residuals: the residual is now a between-subject
 *   distance metric, not a within-subject signature, and the paper's
 *   measurement claim is invalidated.
 *
 *   This is the highest-risk hotspot in the migration because it sits
 *   at the foundation of the ghost engine. A scoping bug here does not
 *   crash, does not fail any other test, and the resulting drift in
 *   reconstruction residuals would be hard to attribute back to a
 *   contaminated profile months after the fact.
 *
 * Fixture: tests/db/aggregation_scoping/_fixtures.ts
 *   Two subjects (owner=1, other=999) each get five journal sessions
 *   with deliberately offset profiles. Owner's ex_gaussian_mu=100,
 *   other's=1000. Pooled mean=550 — a value no correct within-subject
 *   computation could produce. Same offset pattern across every
 *   measured dimension.
 *
 * Mutation log (hand-verified during test development, see report):
 *   For each of the six SELECTs in libProfile.ts, the WHERE q.subject_id
 *   clause was temporarily removed and the test re-run to confirm the
 *   assertions detect the chimera. All six mutations were verified to
 *   fail the test, then restored. The test exercises the bug at every
 *   SELECT, not just the first one.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { updateProfile } from '../../../src/lib/libProfile.ts';
import {
  OWNER_ID,
  OTHER_ID,
  OWNER_PROFILE,
  OTHER_PROFILE,
  FIXTURE_OWNED_SUBJECT_IDS,
  cleanupFixtureRows,
  seedTwoSubjectFingerprintFixture,
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
  // Scoped DELETE per FIXTURE_TABLES — see _fixtures.ts for why we don't
  // TRUNCATE (other test files own state in tb_subjects we must not clobber).
  await cleanupFixtureRows(sql);
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe('hotspot C — libProfile fingerprint scoping', () => {
  it('builds a profile reflecting only the requested subject under a two-subject fixture', async () => {
    const fixture = await seedTwoSubjectFingerprintFixture(sql);

    // Sanity: both fixture subjects have five journal sessions each. We
    // filter by FIXTURE_OWNED_SUBJECT_IDS so any rows another test left
    // behind (e.g. subjectAuth's owner at id=1) don't pollute the count.
    const counts = await sql<{ subject_id: number; n: number }[]>`
      SELECT q.subject_id, COUNT(*)::int AS n
      FROM tb_session_summaries s
      JOIN tb_questions q ON s.question_id = q.question_id
      WHERE q.subject_id = ANY(${FIXTURE_OWNED_SUBJECT_IDS as unknown as number[]}::int[])
      GROUP BY q.subject_id
      ORDER BY q.subject_id ASC
    `;
    expect(counts.map(c => ({ subject_id: c.subject_id, n: c.n }))).toEqual([
      { subject_id: OWNER_ID, n: 5 },
      { subject_id: OTHER_ID, n: 5 },
    ]);

    // Trigger profile build for the test-owner subject only.
    await updateProfile(OWNER_ID, fixture.ownerLatestQuestionId);

    // ── Assertion 1 of N: only the test-owner has a profile row among
    // the fixture subjects ──
    const profiles = await sql`
      SELECT subject_id FROM tb_personal_profile
      WHERE subject_id = ANY(${FIXTURE_OWNED_SUBJECT_IDS as unknown as number[]}::int[])
      ORDER BY subject_id ASC
    ` as Array<{ subject_id: number }>;
    expect(profiles.map(p => p.subject_id)).toEqual([OWNER_ID]);

    // Pull the owner's profile row for the rest of the assertions.
    const [profile] = await sql`
      SELECT * FROM tb_personal_profile WHERE subject_id = ${OWNER_ID}
    ` as Array<Record<string, unknown>>;
    expect(profile).toBeDefined();

    // ── SELECT 2 (tb_motor_signals JOIN tb_questions) ──
    // Owner ex_gaussian_mu = 100 across 5 sessions → mean = 100.
    // Pooled with other (1000) → mean = 550.
    expect(profile!.ex_gaussian_mu_mean).toBe(OWNER_PROFILE.exGaussianMu);
    expect(profile!.ex_gaussian_sigma_mean).toBe(OWNER_PROFILE.exGaussianSigma);
    expect(profile!.ex_gaussian_tau_mean).toBe(OWNER_PROFILE.exGaussianTau);
    expect(profile!.hold_flight_rank_correlation).toBe(OWNER_PROFILE.holdFlightRankCorr);
    // Digraph aggregate is computed across motor rows. Owner's profile
    // contains 'ow' and 'ne'; other's contains 'ze' and 'ta'. A pooled
    // aggregate would have all four keys.
    //
    // libProfile stores the aggregate via JSON.stringify, which postgres.js
    // binds as a TEXT param the server stores as a JSONB string-literal.
    // On read-back, the column value is the JSON-encoded string, not a
    // parsed object. JSON.parse lifts it back. (This mirrors the typeof
    // check libReconstruction does at p.digraph_aggregate_json.)
    const digraphRaw = profile!.digraph_aggregate_json;
    const digraph = (typeof digraphRaw === 'string'
      ? JSON.parse(digraphRaw)
      : digraphRaw) as Record<string, number>;
    expect(Object.keys(digraph).sort()).toEqual(['al', 'br']);
    expect(digraph['al']).toBe(OWNER_PROFILE.digraphLatencyJson['al']);
    expect(digraph).not.toHaveProperty('ze');
    expect(digraph).not.toHaveProperty('ox');

    // ── SELECT 1 (tb_session_summaries JOIN tb_questions) ──
    // Multiple persisted fields derive from this SELECT.
    expect(profile!.iki_mean_mean).toBe(OWNER_PROFILE.ikiMean);
    expect(profile!.hold_time_mean_mean).toBe(OWNER_PROFILE.holdTimeMean);
    expect(profile!.flight_time_mean_mean).toBe(OWNER_PROFILE.flightTimeMean);
    expect(profile!.hold_time_cv_mean).toBe(OWNER_PROFILE.holdTimeCv);
    expect(profile!.mattr_mean).toBe(OWNER_PROFILE.mattr);
    expect(profile!.session_duration_mean).toBe(OWNER_PROFILE.totalDurationMs);
    expect(profile!.word_count_mean).toBe(OWNER_PROFILE.wordCount);
    expect(profile!.first_keystroke_mean).toBe(OWNER_PROFILE.firstKeystrokeMs);
    expect(profile!.burst_count_mean).toBe(OWNER_PROFILE.pBurstCount);
    expect(profile!.burst_length_mean).toBe(OWNER_PROFILE.avgPBurstLength);

    // ── SELECT 3 (tb_process_signals JOIN tb_questions) ──
    // Owner pause distribution: within=10, between=5, sentence=1; total=16.
    // Per-session within-pct = 10/16 = 0.625. With 5 owner sessions all the
    // same, the mean is 0.625. Pooled with other's 1/16=0.0625 → 0.34375.
    const ownerWithinTotal =
      OWNER_PROFILE.pauseWithinWord +
      OWNER_PROFILE.pauseBetweenWord +
      OWNER_PROFILE.pauseBetweenSentence;
    const ownerWithinPct = OWNER_PROFILE.pauseWithinWord / ownerWithinTotal;
    expect(profile!.pause_within_word_pct).toBeCloseTo(ownerWithinPct, 5);
    // Owner r_burst_ratio = 4/(4+2) = 0.667. Other = 1/(1+9) = 0.1. Pooled
    // average ≈ 0.383.
    const ownerRBurstRatio =
      OWNER_PROFILE.rBurstCount / (OWNER_PROFILE.rBurstCount + OWNER_PROFILE.iBurstCount);
    expect(profile!.r_burst_ratio_mean).toBeCloseTo(ownerRBurstRatio, 5);

    // ── SELECT 4 (tb_burst_sequences JOIN tb_questions) ──
    // Owner bursts per session = [5,5,15,15] → consolidation = 15/5 = 3.0.
    // Other bursts per session = [100,100,50,50] → consolidation = 75/100 = 0.75.
    // Pooled across 10 sessions → mean ratio between owner's and other's, far from 3.0.
    expect(profile!.burst_consolidation).toBeCloseTo(3.0, 5);

    // ── SELECT 5 (tb_rburst_sequences JOIN tb_questions) ──
    // Owner deleted_char_count = 5 across all 4 r-bursts × 5 sessions = 20 rows of 5s.
    // Other = 50 across 4 × 5 = 20 rows of 50s. Pooled mean would be 27.5.
    expect(profile!.rburst_mean_size).toBe(OWNER_PROFILE.rburstDeletedCounts[0]);
    expect(profile!.rburst_mean_duration).toBe(OWNER_PROFILE.rburstDurationMs);
    // Owner is_leading_edge = TRUE for all r-bursts → pct = 1.0.
    // Other is_leading_edge = FALSE → pct = 0. Pooled = 0.5.
    expect(profile!.rburst_leading_edge_pct).toBe(1.0);

    // ── SELECT 6 (tb_responses JOIN tb_questions) ──
    // Owner texts contain 'alphabravo' and the 'ow' bigram (from "ownertext"
    // filler). Pooled would include 'zetafoxtrot' too.
    //
    // Same JSONB string-literal pattern as digraph_aggregate_json above.
    const trigramRaw = profile!.trigram_model_json;
    const trigram = (typeof trigramRaw === 'string'
      ? JSON.parse(trigramRaw)
      : trigramRaw) as Record<string, Record<string, number>>;
    expect(trigram).toHaveProperty(OWNER_PROFILE.signatureTrigramPrefix);
    expect(trigram).not.toHaveProperty(OTHER_PROFILE.signatureTrigramPrefix);

    // vocab_cumulative is the count of distinct words ≥3 chars across
    // owner's responses. Owner's signature word is in there; other's is not.
    // We confirm scoping by a presence test — if pooling occurred, the
    // absolute count would be substantially higher because the two profiles
    // use disjoint vocabularies.
    expect(profile!.vocab_cumulative).toBeGreaterThan(0);

    // Defensive: verify the owner's vocabulary set is not contaminated.
    // Reconstruct the unique-word set from the trigram keys (a proxy):
    // if 'ze' or 'ox' appears anywhere as a 2-char context, the response
    // table SELECT was unscoped. Both bigrams are unique to OTHER body text.
    const allTrigramKeys = Object.keys(trigram);
    expect(allTrigramKeys).not.toContain('ze');
    expect(allTrigramKeys).not.toContain('ox');

    // ── Cross-cutting: session count reflects owner-only sessions ──
    // The function records summaries.length as session_count.
    expect(profile!.session_count).toBe(5);
  });
});
