/**
 * Hotspot F — libSemanticBaseline.ts:117–212. Three aggregation sites:
 *
 *   F1: getBaseline (L117–126). Reads tb_semantic_baselines for
 *       (subject_id, signal_name). Composite-key lookup, function uses
 *       rows[0]. Heap-order matters under unscoped mutation.
 *
 *   F2: upsertBaseline (L128–140). INSERT ... ON CONFLICT (subject_id,
 *       signal_name) DO UPDATE — Welford running-mean update. The conflict
 *       target is load-bearing; reverting it to (signal_name) alone fails
 *       to match a unique constraint and the upsert errors out.
 *
 *   F3: getTopicMatchedValues (L173–218). HNSW k-nearest-neighbor query
 *       over tb_embeddings, joined to tb_responses, tb_questions, and
 *       tb_semantic_signals. Properly ordered by vector distance, not
 *       heap. Failure mode: OTHER's vectors positioned closer to OWNER's
 *       query embedding than OWNER's other vectors, so unscoped k-NN
 *       returns OTHER's neighbors.
 *
 * Origin: canonical Step 0 §C list. See db/sql/migrations/030_STEP6_PLAN.md.
 *
 * What this verifies:
 *   updateSemanticBaselines(subjectId, questionId) is the public entry
 *   point that exercises all three sites. For each baseline signal:
 *     1. getBaseline (F1) reads the running Welford state for this subject
 *     2. getTopicMatchedValues (F3) finds the k nearest prior journals
 *     3. saveTrajectoryPoint writes a tb_semantic_trajectory row
 *     4. upsertBaseline (F2) updates the Welford state via ON CONFLICT
 *
 * Silent-corruption failure mode:
 *   F1: contaminated baseline N inflates the Welford increment, producing
 *       a wrong running_mean for OWNER (seeded from OTHER's N).
 *   F2: wrong conflict target fails the upsert at runtime. Errors are
 *       swallowed by the outer try/catch, so the symptom is "OWNER's
 *       baseline row never gets written" — drift detection silently
 *       breaks for that signal.
 *   F3: wrong neighbors → wrong topic-matched stats → wrong topic_z_score.
 *       The within-person trajectory mechanism becomes a between-subject
 *       distance metric.
 *
 * Rule 1 (LIMIT / heap order):
 *   F1 — APPLIES. SELECT with no ORDER BY; rows[0] picks heap-first row
 *        when subject_id is removed. Fixture inserts OTHER's baseline
 *        first so an unscoped query returns OTHER's row.
 *   F2 — N/A (INSERT ... ON CONFLICT path; no SELECT).
 *   F3 — N/A in the heap-order sense; vector distance ordering is the
 *        scoping mechanism. Failure mode is geometric: OTHER's vectors
 *        positioned closer to OWNER's query than OWNER's other vectors.
 *
 * Mutation log (verified during test development, see report):
 *   F1: WHERE subject_id removed from getBaseline → OWNER's
 *       session_count post-call reflects (OTHER's seeded N) + 1, not 1.
 *   F2: ON CONFLICT (subject_id, signal_name) reverted to (signal_name)
 *       only → upsert errors at runtime ("no matching unique constraint"),
 *       caught by outer try/catch; OWNER has no baseline row written.
 *   F3: BOTH e.subject_id AND q.subject_id removed from k-NN →
 *       topic_z_score reflects OTHER's distribution (mean ≈ 0.1), not
 *       OWNER's (mean ≈ 0.5). Test threshold separates by ~25 z-units.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import { updateSemanticBaselines } from '../../../src/lib/libSemanticBaseline.ts';
import {
  OWNER_ID,
  OTHER_ID,
  OWNER_PROFILE,
  OTHER_PROFILE,
  FIXTURE_OWNED_SUBJECT_IDS,
  cleanupFixtureRows,
  seedTwoSubjects,
  insertJournalSession,
  insertSemanticBaselineSeed,
  insertSemanticSignalsRow,
  insertEmbeddingRow,
} from './_fixtures.ts';

const SIGNAL_UNDER_TEST = 'idea_density';

// idea_density values — tight clusters per subject, far apart between subjects.
// Owner: cluster around 0.5; Other: cluster around 0.1. Stddev within each
// cluster is small but non-zero so distributionStats won't reject.
const OWNER_PRIOR_VALUES = [0.45, 0.48, 0.50, 0.52, 0.55];
const OTHER_PRIOR_VALUES = [0.08, 0.09, 0.10, 0.11, 0.12];
// Owner's CURRENT session value matches owner's distribution (z near 0).
const OWNER_CURRENT_VALUE = 0.50;

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

describe('hotspot F — libSemanticBaseline running-mean and topic-matched scoping', () => {
  it('runs Welford update and topic-z computation on only the requested subject\'s baseline state and prior embeddings', async () => {
    await seedTwoSubjects(sql);

    // ── F1 setup: pre-existing OTHER baseline as contamination source ──
    // OTHER has a tb_semantic_baselines row for idea_density with N=999
    // and a clearly-wrong running_mean. INSERTED FIRST so heap-order in an
    // unscoped getBaseline returns OTHER's row.
    await insertSemanticBaselineSeed(
      sql,
      OTHER_ID,
      SIGNAL_UNDER_TEST,
      999,    // session_count — wildly different from owner's expected 1
      0.1,    // running_mean — matches OTHER's signal distribution
      0.05,   // running_m2
    );

    // ── Insert journal sessions for both subjects + tb_semantic_signals ──
    // Each prior session needs (a) a tb_responses row for the embedding to
    // point at, (b) a tb_semantic_signals row with the signal value k-NN
    // will return, (c) a tb_embeddings row with the geometry F3 needs.
    const ownerPriorQids: number[] = [];
    for (let i = 0; i < OWNER_PRIOR_VALUES.length; i++) {
      const qid = await insertJournalSession(sql, {
        subjectId: OWNER_ID,
        profile: OWNER_PROFILE,
        scheduledFor: `2026-04-${String(i + 1).padStart(2, '0')}`,
        sessionIndex: i,
      });
      ownerPriorQids.push(qid);
      await insertSemanticSignalsRow(sql, OWNER_ID, qid, {
        idea_density: OWNER_PRIOR_VALUES[i]!,
        paste_contaminated: 0,  // boolean column — 0/false
      });
    }

    const otherPriorQids: number[] = [];
    for (let i = 0; i < OTHER_PRIOR_VALUES.length; i++) {
      const qid = await insertJournalSession(sql, {
        subjectId: OTHER_ID,
        profile: OTHER_PROFILE,
        scheduledFor: `2026-04-${String(i + 11).padStart(2, '0')}`,
        sessionIndex: i,
      });
      otherPriorQids.push(qid);
      await insertSemanticSignalsRow(sql, OTHER_ID, qid, {
        idea_density: OTHER_PRIOR_VALUES[i]!,
        paste_contaminated: 0,
      });
    }

    // ── OWNER current session — the trigger for updateSemanticBaselines ──
    const ownerCurrentQid = await insertJournalSession(sql, {
      subjectId: OWNER_ID,
      profile: OWNER_PROFILE,
      scheduledFor: '2026-05-01',
      sessionIndex: 100,
    });
    await insertSemanticSignalsRow(sql, OWNER_ID, ownerCurrentQid, {
      idea_density: OWNER_CURRENT_VALUE,
      paste_contaminated: 0,
    });

    // ── F3 setup: embedding geometry ──
    // Owner's "current" embedding (the query): a unit vector at dim 0.
    //   [1, 0, 0, ..., 0]
    // Owner's prior embeddings: orthogonal to query, so DISTANT.
    //   [0, 1, 0, ..., 0]  → L2 distance to query = sqrt(2) ≈ 1.414
    // Other's prior embeddings: nearly aligned with query, so CLOSE.
    //   [0.99, 0.001*i, 0, ..., 0]  → L2 distance to query ≈ 0.01
    //
    // With correct scoping, k-NN finds OWNER's [0,1,...] vectors (dist 1.414)
    // and returns their idea_density values (cluster around 0.5).
    // With unscoped, k-NN finds OTHER's [0.99, ...] vectors (dist ~0.01)
    // first and returns their idea_density values (cluster around 0.1).

    // Get response_id for the current owner question (needed for embedding)
    const [ownerCurrentResp] = await sql<{ response_id: number }[]>`
      SELECT response_id FROM tb_responses WHERE question_id = ${ownerCurrentQid}
    `;
    await insertEmbeddingRow(sql, OWNER_ID, ownerCurrentResp!.response_id, [1, 0, 0]);

    for (let i = 0; i < ownerPriorQids.length; i++) {
      const [resp] = await sql<{ response_id: number }[]>`
        SELECT response_id FROM tb_responses WHERE question_id = ${ownerPriorQids[i]!}
      `;
      // Distant from query: orthogonal direction.
      await insertEmbeddingRow(sql, OWNER_ID, resp!.response_id, [0, 1, 0]);
    }
    for (let i = 0; i < otherPriorQids.length; i++) {
      const [resp] = await sql<{ response_id: number }[]>`
        SELECT response_id FROM tb_responses WHERE question_id = ${otherPriorQids[i]!}
      `;
      // Close to query: nearly aligned with [1,0,0], tiny perturbation by index.
      await insertEmbeddingRow(sql, OTHER_ID, resp!.response_id, [0.99, 0.001 * (i + 1), 0]);
    }

    // ── Run the function under test ──
    await updateSemanticBaselines(OWNER_ID, ownerCurrentQid);

    // ── F1 + F2 assertion: OWNER's baseline row exists, with N = 1 ──
    // F1 catches if N reflects OTHER's seeded count (999) plus owner's
    // increment.  F2 catches if no row exists for OWNER (upsert errored).
    const ownerBaselines = await sql<Array<{
      subject_id: number;
      signal_name: string;
      session_count: number;
      running_mean: number;
      last_question_id: number | null;
    }>>`
      SELECT subject_id, signal_name, session_count, running_mean, last_question_id
      FROM tb_semantic_baselines
      WHERE subject_id = ${OWNER_ID} AND signal_name = ${SIGNAL_UNDER_TEST}
    `;
    expect(ownerBaselines.length).toBe(1);
    expect(ownerBaselines[0]!.session_count).toBe(1);
    expect(ownerBaselines[0]!.last_question_id).toBe(ownerCurrentQid);
    // Welford starts from {n: 0, mean: 0, m2: 0} when no prior. After one
    // step with x = OWNER_CURRENT_VALUE: n=1, mean=x. Confirms the function
    // started from a ZERO-initialized state, not OTHER's seeded N=999.
    expect(ownerBaselines[0]!.running_mean).toBeCloseTo(OWNER_CURRENT_VALUE, 5);

    // ── F2 assertion: OTHER's pre-existing row is UNTOUCHED ──
    // The conflict target (subject_id, signal_name) means OWNER's INSERT
    // creates a separate row; OTHER's row remains at session_count=999.
    // If F2 mutation silently corrupted OTHER's row (via wrong conflict
    // target), this assertion would fail.
    const otherBaselines = await sql<Array<{ session_count: number; running_mean: number }>>`
      SELECT session_count, running_mean
      FROM tb_semantic_baselines
      WHERE subject_id = ${OTHER_ID} AND signal_name = ${SIGNAL_UNDER_TEST}
    `;
    expect(otherBaselines.length).toBe(1);
    expect(otherBaselines[0]!.session_count).toBe(999);
    expect(otherBaselines[0]!.running_mean).toBeCloseTo(0.1, 5);

    // ── F3 assertion: topic_z_score reflects OWNER's neighbor distribution ──
    // The trajectory row carries the topic z-score computed from k-NN.
    // OWNER's neighbors have idea_density ~0.5 (mean=0.5, low stddev).
    // Current value 0.50 → topic_z ≈ 0 (right around the mean).
    //
    // Under F3 mutation, k-NN returns OTHER's neighbors (mean ~0.1, stddev
    // tiny). Current value 0.50 against that distribution → topic_z huge
    // (~25). Threshold of |topic_z| < 5 cleanly catches the mutation.
    const trajectory = await sql<Array<{
      topic_z_score: number | null;
      topic_match_count: number | null;
      gated: boolean;
    }>>`
      SELECT topic_z_score, topic_match_count, gated
      FROM tb_semantic_trajectory
      WHERE subject_id = ${OWNER_ID}
        AND question_id = ${ownerCurrentQid}
        AND signal_name = ${SIGNAL_UNDER_TEST}
    `;
    expect(trajectory.length).toBe(1);
    const traj = trajectory[0]!;
    expect(traj.topic_match_count).toBe(OWNER_PRIOR_VALUES.length);
    expect(traj.topic_z_score).not.toBeNull();
    // |topic_z| < 5 with correct scoping; ~25 with F3 contamination.
    expect(Math.abs(traj.topic_z_score!)).toBeLessThan(5);
  });
});
