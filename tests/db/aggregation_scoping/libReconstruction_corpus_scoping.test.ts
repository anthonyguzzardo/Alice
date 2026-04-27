/**
 * Hotspot D — libReconstruction.ts:382–448 (corpus + profile build) and
 * L549–557 (regen path corpus rebuild).
 *
 * Origin: canonical Step 0 §C list. See db/sql/migrations/030_STEP6_PLAN.md.
 *
 * What this verifies:
 *   computeReconstructionResidual(subjectId, questionId) reads two
 *   aggregations the avatar (ghost) is trained on:
 *
 *     D1 — corpus: tb_responses ⋈ tb_questions (L396–403). Every journal
 *          response for this subject becomes a row that feeds the
 *          Markov/PPM language model in src-rs/avatar.rs. The chain's
 *          word transition probabilities, the PPM trie, and the trigram
 *          backoff all sample from this corpus.
 *
 *     D2 — profile: tb_personal_profile (L427–444). The motor / pause /
 *          revision / digraph fingerprint that drives the avatar's
 *          keystroke timing synthesis.
 *
 *     D3 — regen-path corpus (L549–557, in verifyResidual): same shape
 *          as D1, called from the verification pipeline. If this scopes
 *          differently than D1 the bit-identity claim breaks.
 *
 * Silent-corruption failure mode (what this test guards against):
 *   The reconstruction residual is THE measurement claim of the paper.
 *   It is the L2 distance between a real session and an avatar trained
 *   on that subject's own statistical fingerprint — a within-subject
 *   distance.
 *
 *   If the corpus SELECT (D1) is unscoped, the avatar samples words and
 *   transitions from another subject's vocabulary. The resulting
 *   reconstruction residual is a between-subject distance metric, not
 *   a within-subject signature. The paper's measurement claim is
 *   invalidated.
 *
 *   If the profile SELECT (D2) is unscoped (and there are multiple
 *   profile rows due to a join bug or a missing WHERE), the avatar's
 *   keystroke timing is synthesized from the wrong person's motor
 *   fingerprint. Same downstream invalidation.
 *
 *   If D3 disagrees with D1, the verification pipeline's bit-identity
 *   claim breaks: a stored residual computed under D1's corpus would
 *   verify against D3's corpus and report a corpus_sha256 mismatch.
 *
 * Internal-pooling watch (per the user's hotspot E prediction extending
 * to hotspot D): the corpus is JSON-serialized and passed across the
 * napi boundary. The Markov chain and PPM trie are built INSIDE Rust
 * (avatar.rs). If the SQL scoping is correct, only the requested
 * subject's text crosses the boundary, and the trie cannot pool. The
 * test still asserts on avatar_text — if a future refactor moves trie
 * construction to TypeScript and accidentally pools per-subject state,
 * the avatar's vocabulary will betray it.
 *
 * Fixture: extends _fixtures.ts with insertPersonalProfileRow so D2 has
 * rows to read, plus reuses seedTwoSubjectFingerprintFixture for D1.
 *
 * Mutation log (verified during test development, see report):
 *   D1: corpus SELECT WHERE q.subject_id removed → avatar_text contains
 *       OTHER's signature word 'zetafoxtrot'.
 *   D2: profile SELECT WHERE subject_id removed (LIMIT 1 returns whichever
 *       row Postgres surfaces first, which on a fresh fixture is typically
 *       the lower-id row but is order-dependent) → profile_snapshot_json.mu
 *       reflects the wrong subject's fingerprint.
 *   D3: verifyResidual corpus SELECT WHERE q.subject_id removed →
 *       corpus_sha256 mismatch on round-trip; verifyResidual returns
 *       corpusValid=false for a freshly-stored residual.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql from '../../../src/lib/libDbPool.ts';
import {
  computeReconstructionResidual,
  verifyResidual,
} from '../../../src/lib/libReconstruction.ts';
import {
  OWNER_ID,
  OTHER_ID,
  OWNER_PROFILE,
  OTHER_PROFILE,
  FIXTURE_OWNED_SUBJECT_IDS,
  cleanupFixtureRows,
  insertPersonalProfileRow,
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
  await cleanupFixtureRows(sql);
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe('hotspot D — libReconstruction corpus + profile scoping', () => {
  it('builds an avatar from only the requested subject\'s corpus and profile under a two-subject fixture', async () => {
    const fixture = await seedTwoSubjectFingerprintFixture(sql);

    // D2 prereq: pre-insert tb_personal_profile rows for both subjects with
    // distinguishable values. The function under test reads OWNER's profile;
    // OTHER's row is the contamination source we test against.
    //
    // INSERTION ORDER MATTERS HERE — and that's the point. libReconstruction
    // reads the profile via `SELECT ... FROM tb_personal_profile WHERE
    // subject_id = ? LIMIT 1`. If the WHERE clause is removed, Postgres
    // returns the LIMIT 1 row in heap-page order — typically whichever was
    // inserted FIRST. We insert OTHER first so an unscoped query returns
    // OTHER's profile, making the bug detectable. Without this ordering,
    // the test could pass for the wrong reason: heap order coincidentally
    // returning OWNER's row even when scoping is missing.
    //
    // Production failure mode this mirrors: with two subjects in the table,
    // an unscoped `LIMIT 1` is non-deterministic across deployments. The
    // ordering chosen here forces the test to surface the bug rather than
    // depend on coincidence.
    await insertPersonalProfileRow(
      sql,
      OTHER_ID,
      OTHER_PROFILE,
      fixture.otherQuestionIds[fixture.otherQuestionIds.length - 1]!,
    );
    await insertPersonalProfileRow(
      sql,
      OWNER_ID,
      OWNER_PROFILE,
      fixture.ownerLatestQuestionId,
    );

    // ── Run the production reconstruction pipeline ──
    // Computes residuals for all 5 adversary variants. Each variant gets
    // its own row in tb_reconstruction_residuals. The corpus and profile
    // are loaded ONCE (in the outer function) and shared across variants,
    // so a scoping bug at D1 or D2 contaminates all 5 rows.
    await computeReconstructionResidual(OWNER_ID, fixture.ownerLatestQuestionId);

    // ── Read back the residuals for the test-owner subject ──
    const residuals = await sql<Array<{
      subject_id: number;
      question_id: number;
      adversary_variant_id: number;
      avatar_text: string | null;
      profile_snapshot_json: string | null;
      corpus_sha256: string | null;
      avatar_seed: string | null;
    }>>`
      SELECT subject_id, question_id, adversary_variant_id,
             avatar_text, profile_snapshot_json, corpus_sha256, avatar_seed
      FROM tb_reconstruction_residuals
      WHERE subject_id = ANY(${FIXTURE_OWNED_SUBJECT_IDS as unknown as number[]}::int[])
      ORDER BY adversary_variant_id ASC
    `;

    // 5 variants, all for owner only. No residual rows for OTHER (the
    // function was only invoked for OWNER).
    expect(residuals.length).toBe(5);
    for (const r of residuals) {
      expect(r.subject_id).toBe(OWNER_ID);
      expect(r.question_id).toBe(fixture.ownerLatestQuestionId);
    }

    // ── D1 verification: avatar_text reflects only OWNER's vocabulary ──
    // Owner corpus contains 'alphabravo' (signature word, repeated 7x per
    // session, 35 occurrences across 5 sessions). Other corpus contains
    // 'zetafoxtrot' (same shape). With correct scoping, the Markov/PPM
    // trie is built only from owner text, and 'zetafoxtrot' as a word
    // CANNOT appear in avatar_text.
    //
    // We check across all 5 variants — the corpus is loaded once and
    // shared across variants, so a scoping bug shows on every row. We
    // assert on at least one variant containing the owner signature, to
    // confirm the test is exercising real text generation (not asserting
    // on null avatar_text from a degenerate run).
    const allAvatarText = residuals.map(r => r.avatar_text ?? '').join(' ');
    expect(allAvatarText).not.toContain(OTHER_PROFILE.signatureWord);
    // At least one variant should produce non-trivial text. Markov word
    // chain over a 5-session corpus of ~70 words each will sample owner
    // tokens; we assert the owner signature appears at least once.
    expect(allAvatarText).toContain(OWNER_PROFILE.signatureWord);

    // ── D2 verification: profile_snapshot_json reflects OWNER's profile ──
    // Each residual row carries the profile JSON the avatar was generated
    // with. If the profile SELECT was unscoped, OTHER's profile (mu=1000,
    // tau=500) could be substituted for OWNER's (mu=100, tau=50).
    //
    // profile_snapshot_json is a JSON string (the function does
    // JSON.stringify before INSERT — same JSONB pattern as hotspot C).
    for (const r of residuals) {
      expect(r.profile_snapshot_json).toBeTruthy();
      const snap = JSON.parse(r.profile_snapshot_json!);
      expect(snap.mu).toBe(OWNER_PROFILE.exGaussianMu);
      expect(snap.sigma).toBe(OWNER_PROFILE.exGaussianSigma);
      expect(snap.tau).toBe(OWNER_PROFILE.exGaussianTau);
      // Defensive: the digraph aggregate carried in the profile snapshot
      // must contain only owner bigram keys, never other's.
      expect(Object.keys(snap.digraph as Record<string, number>).sort())
        .toEqual(['al', 'br']);
    }

    // ── D3 verification: regen-path corpus SHA matches D1 corpus SHA ──
    // verifyResidual reconstructs the corpus from tb_responses (L549–557)
    // and compares its SHA to the stored corpus_sha256. If D3 scopes
    // differently than D1 — e.g. one drops `q.subject_id` while the
    // other keeps it — the SHAs diverge and verifyResidual returns
    // corpusValid: false even on a freshly-stored residual.
    //
    // We verify a freshly-stored owner residual round-trips cleanly.
    const verifyResult = await verifyResidual(
      OWNER_ID,
      fixture.ownerLatestQuestionId,
      1, // baseline variant
    );
    expect(verifyResult).not.toBeNull();
    expect(verifyResult!.corpusValid).toBe(true);
  });
});
