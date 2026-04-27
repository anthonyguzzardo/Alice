/**
 * Hotspot N1 — libIntegrity.ts:101–126. computeThreshold: reads ALL prior
 * profile_distance values from tb_session_integrity for the subject,
 * computes sample mean and stddev, returns mean + 2σ as the mediation-
 * detection threshold (floored at sqrt(dimensionCount) to avoid flagging
 * normal multivariate-normal variance).
 *
 * Origin: net-new finding from the §C reconciliation (mapped as N1 in
 * 030_STEP6_PLAN.md). Not in canonical Step 0 §C, but surfaced during
 * the post-Step-5 audit as measurement-instrument-critical.
 *
 * What this verifies:
 *   computeSessionIntegrity(subjectId, questionId) — the public entry
 *   point — calls computeThreshold internally to derive the dynamic
 *   mediation cutoff. The threshold scales with this person's historical
 *   distance distribution: typical sessions sit near the mean, mediation
 *   events sit beyond mean+2σ.
 *
 * Silent-corruption failure mode (what this test guards against):
 *   If tb_session_integrity reads pool across subjects, the threshold
 *   reflects the population midpoint rather than this person's
 *   distribution. Mediation events for OWNER (sessions where the
 *   profile_distance jumps because the writer is mediated by an LLM)
 *   would be evaluated against a chimerized threshold — events that
 *   should flag don't (when pooled threshold is too high), or events
 *   that shouldn't flag do (when pooled threshold is too low).
 *
 *   This is the canonical case for why population-statistics
 *   aggregations need scoping. The whole point of the personal-history
 *   threshold is "what's normal FOR THIS PERSON" — population stats
 *   defeat the design.
 *
 * Rule 1 (LIMIT / heap order): N/A. Reads ALL rows; order doesn't
 * affect mean/stddev. ORDER BY session_integrity_id ASC is for
 * deterministic output, not row selection.
 *
 * Carry-forward: lead with the strongest divergent signal. For
 * threshold-computation hotspots, that's the threshold value itself.
 * Owner-only threshold ≈ 2.21, pooled threshold ≈ 14.37 — ~6.5x
 * separation. Threshold of 5.0 cleanly distinguishes.
 *
 * Mutation log (verified during test development, see report):
 *   N1: WHERE subject_id removed from computeThreshold's SELECT →
 *       thresholdUsed jumps from ~2.21 to ~14.37 (pooled mean+2σ over
 *       a bimodal distribution at 2.05 and 10.05).
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { computeSessionIntegrity } from '../../../src/lib/libIntegrity.ts';
import {
  OWNER_ID,
  OTHER_ID,
  OWNER_PROFILE,
  cleanupFixtureRows,
  seedTwoSubjects,
  insertJournalSession,
} from './_fixtures.ts';

// Profile distance distributions, deliberately disjoint and tightly
// clustered so the means are well-separated.
//   Owner: mean=2.05, sample stddev ≈ 0.0791, mean+2σ ≈ 2.21
//   Other: mean=10.05, sample stddev ≈ 0.0791, mean+2σ ≈ 10.21
//   Pooled (10 rows): mean ≈ 6.05, sample stddev ≈ 4.16, mean+2σ ≈ 14.37
const OWNER_DISTANCES = [1.95, 2.00, 2.05, 2.10, 2.15];
const OTHER_DISTANCES = [9.95, 10.00, 10.05, 10.10, 10.15];

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

describe('hotspot N1 — libIntegrity threshold scoping', () => {
  it('computes mediation-detection threshold over only the requested subject\'s historical distances', async () => {
    await seedTwoSubjects(sql);

    // ── Owner journal session (the trigger for computeSessionIntegrity) ──
    // The function reads tb_session_summaries for this question_id to get
    // current-session values, then reads tb_personal_profile for owner's
    // baseline mean/std. We populate three dims (iki_mean, hold_time,
    // flight_time) so dimNames.length >= 3 (the function returns null
    // otherwise). dimensionCount = 3 → floor sqrt(3) ≈ 1.732, which sits
    // below both the correct (2.21) and pooled (14.37) thresholds, so
    // the floor does NOT mask the contamination signal.
    const ownerCurrentQid = await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-05-01',
      sessionIndex: 0,
    });

    // ── Personal profile: only the three dims the test exercises ──
    // Inline because the existing insertPersonalProfileRow fixture helper
    // populates many more fields, which would make dimensionCount higher
    // and push the sqrt(dimensionCount) floor above OWNER's 2.21 threshold.
    // Three dims → floor 1.732, leaving the actual mean+2σ threshold
    // exposed for assertion.
    await sql`
      INSERT INTO tb_personal_profile (
        subject_id, session_count, last_question_id,
        iki_mean_mean, iki_mean_std,
        hold_time_mean_mean, hold_time_mean_std,
        flight_time_mean_mean, flight_time_mean_std
      ) VALUES (
        ${OWNER_ID}, 5, ${ownerCurrentQid},
        ${OWNER_PROFILE.ikiMean}, ${OWNER_PROFILE.ikiStd},
        ${OWNER_PROFILE.holdTimeMean}, ${OWNER_PROFILE.holdTimeStd},
        ${OWNER_PROFILE.flightTimeMean}, ${OWNER_PROFILE.flightTimeStd}
      )
    `;

    // ── tb_session_integrity historical rows ──
    // These are the population computeThreshold reads. We need 5+ rows for
    // OWNER (the function bypasses to the chi-squared heuristic if < 3),
    // and 5 rows for OTHER as the contamination source. The question_id
    // values are arbitrary (the threshold computation only reads
    // profile_distance), but the schema requires non-null subject_id and
    // question_id.
    for (let i = 0; i < OWNER_DISTANCES.length; i++) {
      // Each historical integrity row needs a distinct question_id;
      // produce one by inserting a journal session for owner.
      const qid = await insertJournalSession(sql, {
        subjectId: OWNER_ID,
        profile: OWNER_PROFILE,
        scheduledFor: `2026-04-${String(i + 1).padStart(2, '0')}`,
        sessionIndex: 100 + i,
      });
      await sql`
        INSERT INTO tb_session_integrity (
          subject_id, question_id, profile_distance, dimension_count,
          z_scores_json, is_flagged, threshold_used, profile_session_count
        ) VALUES (
          ${OWNER_ID}, ${qid}, ${OWNER_DISTANCES[i]!}, 3,
          '[]'::jsonb, false, 1.732, 5
        )
      `;
    }
    for (let i = 0; i < OTHER_DISTANCES.length; i++) {
      const qid = await insertJournalSession(sql, {
        subjectId: OTHER_ID,
        profile: OWNER_PROFILE,  // profile values irrelevant; just need a valid row
        scheduledFor: `2026-04-${String(i + 11).padStart(2, '0')}`,
        sessionIndex: 200 + i,
      });
      await sql`
        INSERT INTO tb_session_integrity (
          subject_id, question_id, profile_distance, dimension_count,
          z_scores_json, is_flagged, threshold_used, profile_session_count
        ) VALUES (
          ${OTHER_ID}, ${qid}, ${OTHER_DISTANCES[i]!}, 3,
          '[]'::jsonb, false, 1.732, 5
        )
      `;
    }

    // ── Run the production path ──
    const result = await computeSessionIntegrity(OWNER_ID, ownerCurrentQid);

    expect(result).not.toBeNull();
    const r = result!;

    // ── N1 assertion: thresholdUsed reflects owner-only mean+2σ ──
    // Owner-only: mean=2.05, sample stddev≈0.0791, mean+2σ≈2.21.
    // Pooled: mean=6.05, sample stddev≈4.16, mean+2σ≈14.37.
    // Floor: sqrt(3)≈1.732 (below both, doesn't mask the signal).
    expect(r.thresholdUsed).toBeGreaterThan(2.0);   // above floor
    expect(r.thresholdUsed).toBeLessThan(5.0);      // catches mutation (~14.37)
    expect(r.thresholdUsed).toBeCloseTo(2.21, 1);   // owner-only mean+2σ

    // ── Defense in depth: dimensionCount as expected ──
    // Confirms the fixture set up the dim-counting correctly. If a future
    // refactor changes how DIMENSIONS are filtered, this catches the test
    // running against a different baseline than designed.
    expect(r.dimensionCount).toBe(3);

    // ── Defense in depth: profile_session_count threading ──
    // Confirms loadProfile read OWNER's profile (session_count=5), not
    // OTHER's. Independent of N1's mutation but a useful sanity check.
    expect(r.profileSessionCount).toBe(5);
  });
});
