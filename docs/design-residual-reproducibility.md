# Design: Reproducible Reconstruction Residuals

**Date:** 2026-04-22
**Status:** Design review (no code yet)
**Claim:** Reconstruction residuals become reproducible scientific artifacts. Given a stored seed and profile snapshot, any future build of Alice can regenerate the exact ghost that produced a given residual, and verify the residual against the regenerated output.

---

## Why this matters

A reconstruction residual is the difference between a real person's signals and a ghost's signals for the same session. It is the cognitive signature: the part of behavior that cannot be reconstructed from statistical aggregates.

Today, residuals are frozen numbers. The ghost that produced them is ephemeral (time-seeded, never stored). The profile used to generate the ghost is a rolling aggregate that updates with every new session. If either changes, the residual cannot be rederived.

This means:
- **No verification.** A stored residual cannot be checked against a fresh computation. If a bug in the signal pipeline produced a wrong residual, there is no way to detect it after the fact.
- **No reanalysis.** If the profile model improves (new fields, better aggregation), historical residuals cannot be recomputed under the new model to assess whether the improvement actually changed anything.
- **No provenance.** The residual is a number with no derivation trail. A methods section can describe the procedure, but cannot point to reproducible inputs.

The fix is not "store more data." The fix is: make the ghost a reproducible function of its inputs, and persist those inputs alongside the output.

---

## Component 1: Seed Persistence

### What changes

**Rust side (`avatar.rs`, `lib.rs`):**

`compute()` currently generates a time-based seed and passes it to `compute_seeded()`. The seed is discarded. Change: `compute()` returns the seed alongside the `AvatarResult`.

```rust
// New return type from compute()
pub(crate) struct SeededAvatarResult {
    pub(crate) result: AvatarResult,
    pub(crate) seed: u64,
}
```

`compute_seeded()` is unchanged. `compute()` becomes a thin wrapper that generates the seed, calls `compute_seeded()`, and bundles both into `SeededAvatarResult`.

**napi boundary (`lib.rs`):**

`AvatarOutput` gains a `seed` field:

```rust
#[napi(object)]
pub struct AvatarOutput {
    // ... existing fields ...
    /// PRNG seed used for this generation. Store this to reproduce the ghost.
    pub seed: String,  // u64 as decimal string (JS can't represent u64 exactly)
}
```

Note: `u64` cannot cross napi as a number (JS `Number` loses precision above 2^53). Serialize as a decimal string. The TS side receives `seed: string` and stores it as `TEXT` in Postgres.

**TypeScript side (`libSignalsNative.ts`):**

`AvatarResult` interface gains `seed: string`. `generateAvatar()` passes it through unchanged.

**Schema (`tb_reconstruction_residuals`):**

```sql
-- Migration: add seed column
ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN avatar_seed TEXT;

COMMENT ON COLUMN tb_reconstruction_residuals.avatar_seed IS
  'PRNG seed (u64 decimal string) used to generate the ghost. NULL for pre-reproducibility-era rows.';
```

**`libReconstruction.ts`:**

`computeForVariant()` captures `avatar.seed` from the generation result and includes it in the `ReconstructionResidualInput`. The INSERT adds the column.

### Backfill

Existing rows get `NULL`. They are pre-reproducibility-era artifacts. No attempt to reconstruct seeds retroactively (impossible by definition: the seed was `SystemTime::now()` at generation time and was never recorded).

---

## Component 2: Profile Snapshotting

This is the harder question. The profile is a rolling aggregate that updates after every session. To regenerate a January ghost in June, we need the January profile state.

### Option A: Inline profile JSON

Store the full profile JSON blob that was passed to `generateAvatar()` as a column on `tb_reconstruction_residuals`.

```sql
ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN profile_snapshot_json JSONB;
```

**Pros:**
- Self-contained. Each residual row carries everything needed for regeneration. No joins, no version lookups.
- Simple migration. Backfill existing rows as `NULL` (pre-reproducibility-era).
- No new tables. No new foreign key relationships (logical or otherwise).
- The profile JSON is already constructed in `libReconstruction.ts` (lines 329-356). Just persist what's already in memory.

**Cons:**
- Redundancy. Five variants per session, each storing the same profile blob. **Measured:** the profile JSON as constructed by `libReconstruction.ts` (the curated object with field renaming, not the full database row) is **3,134 bytes** for a real profile. The full database row is 31KB, but that includes `trigram_model_json` (26.8KB) and `digraph_aggregate_json` (2.3KB raw), neither of which are passed in full. The curated object is what matters. That's ~15KB per session across five variants, ~5.5MB/year at daily journaling. Not a storage concern.
- Schema coupling. If the profile JSON shape changes (new fields), old snapshots have the old shape. This is actually a feature, not a bug: the snapshot records what was used, not what's current.

### Option B: Versioned profile table

Each `updateProfile()` call creates a new row in `tb_personal_profile_versions` with an auto-incrementing `profile_version_id`. Residual rows reference the version.

```sql
CREATE TABLE tb_personal_profile_versions (
  profile_version_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- all columns from tb_personal_profile --
  dttm_created_utc TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN profile_version_id INT;
```

**Pros:**
- No redundancy across the five variants. One version row per session, referenced five times.
- Enables profile-level queries ("show me how the profile evolved over time") without parsing JSONB.
- Clean relational modeling.

**Cons:**
- New table with ~40 columns, duplicating the profile schema. Schema changes to `tb_personal_profile` must be mirrored in the versions table.
- New logical foreign key to maintain (no physical FK, per project convention).
- `updateProfile()` must now INSERT into the versions table AND UPDATE the main profile table, atomically.
- The profile passed to the ghost is not the raw database row. It's a curated JSON object constructed in `libReconstruction.ts` (lines 329-356) with field renaming and null coalescing. The versions table would store the raw profile; regeneration would need to reconstruct the same JSON mapping. Two places to maintain.
- Backfill is harder: existing rows have no version reference, and the profile versions that existed at generation time are gone.

### Recommendation: Option A (inline JSON)

The deciding factor: the profile snapshot that matters is not the database row. It's the exact JSON string that was passed to `generateAvatar()`. That's the input to the function. Storing it inline means the residual row contains the exact function inputs (seed + profile JSON + corpus, where corpus is reconstructible from the response history at that point in time).

Option B stores a normalized approximation of the input, then requires a mapping layer to reconstruct the actual input. That mapping layer is itself a source of irreproducibility if it changes.

The redundancy cost (same 3.1KB JSON across five variant rows) is ~15KB/session. At daily journaling, that's ~5.5MB/year. Irrelevant.

---

## Component 3: Corpus Reproducibility

The profile and seed are not the only inputs. The ghost also receives `corpusJson`: the full text of all prior responses, in chronological order. This is constructed in `libReconstruction.ts` (lines 280-285) by querying all responses ordered by `scheduled_for`.

The corpus is reproducible from the database without snapshotting, as long as:
1. No responses are deleted after residual computation.
2. The query order is deterministic (`ORDER BY q.scheduled_for ASC`).
3. Response text is immutable after submission.

All three hold in Alice's current design (single user, no edit capability, logical-FK-aware deletion). The corpus does not need to be stored inline.

**Integrity check: SHA-256 hash.** The existing `corpus_size` column is a coarse check (response count). It would not detect a future "edit response" feature or a text corruption. Store a SHA-256 hash of the serialized `corpusJson` string as a new column. At verification time, reconstruct the corpus from `tb_responses`, hash it, and compare. If the hash doesn't match, the corpus has changed and regeneration is not valid against the original.

```sql
ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN corpus_sha256 TEXT;

COMMENT ON COLUMN tb_reconstruction_residuals.corpus_sha256 IS
  'SHA-256 hex digest of the corpusJson string passed to generateAvatar(). NULL for pre-reproducibility-era rows.';
```

Computation: `crypto.createHash('sha256').update(corpusJson).digest('hex')` in `libReconstruction.ts`. One hash per session (shared across all five variants; same corpus for each).

## Component 3a: Topic Persistence

The ghost receives `topic` as a seed word for Markov text generation. Currently this is the raw question text, passed directly from `tb_questions.text` through `libReconstruction.ts` (line 100) to `generateAvatar()`. There is no intermediate `topic_from_question()` function today, but if one were introduced later, it would become an implicit source of regeneration drift.

Store the resolved topic string alongside the residual:

```sql
ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN avatar_topic TEXT;

COMMENT ON COLUMN tb_reconstruction_residuals.avatar_topic IS
  'Topic string passed to generateAvatar(). Currently equals question text. NULL for pre-reproducibility-era rows.';
```

Cost: a few hundred bytes per row. Closes the door on topic derivation drift permanently. At regeneration time, use the stored topic, not a re-derivation from question text.

---

## Component 4: Regeneration API

### Rust side

No change to `compute_seeded()`. It already takes all the inputs needed:

```rust
pub(crate) fn compute_seeded(
    corpus_json: &str,
    topic: &str,
    profile_json: &str,
    max_words: usize,
    variant: AdversaryVariant,
    seed: u64,
) -> SignalResult<AvatarResult>
```

**New napi entry point** in `lib.rs`:

```rust
#[napi]
pub fn regenerate_avatar(
    corpus_json: String,
    topic: String,
    profile_json: String,
    max_words: i32,
    variant: i32,
    seed: String,  // u64 as decimal string from JS
) -> AvatarOutput
```

This is identical to `generate_avatar` except it takes an explicit seed instead of using `SystemTime`. Internally it parses the seed string to `u64` and calls `compute_seeded()`.

### TypeScript side

**New function in `libSignalsNative.ts`:**

```typescript
export function regenerateAvatar(
  corpusJson: string,
  topic: string,
  profileJson: string,
  maxWords: number,
  variant: number,
  seed: string,
): AvatarResult | null
```

**New function in `libReconstruction.ts`:**

```typescript
export async function verifyResidual(
  questionId: number,
  variantId: number,
): Promise<{
  match: boolean;
  storedResidual: number | null;
  recomputedResidual: number | null;
  delta: number | null;
} | null>
```

This function:
1. Loads the stored residual row (seed, profile snapshot, topic, corpus hash, variant, word count).
2. Gates on reproducibility: if `avatar_seed` or `profile_snapshot_json` is NULL, returns null (historical row, cannot verify).
3. Reconstructs the corpus from current response history.
4. Computes SHA-256 of reconstructed corpus. If it doesn't match `corpus_sha256`, returns null (corpus changed, verification impossible). `corpus_size` serves as a fast pre-check before hashing.
5. Calls `regenerateAvatar()` with the stored seed, stored profile snapshot, and stored topic.
6. Runs signals on the regenerated ghost's keystroke stream.
7. Computes residuals and compares against stored values.
8. Returns match status and per-signal deltas.

This is the consumer of cross-build ghost determinism. If the ghost engine is not build-stable for a given seed, this function returns false positives.

---

## Component 5: CI Enforcement

### What to test

The existing `reproducibility-check.sh` tests signal computation (PE, DFA, RQA, motor signals) across clean rebuilds. Extend it to also test ghost generation.

**New fixture:** A deterministic ghost generation test case.

```
Input:
  corpus_json: fixed 5-entry corpus (committed as fixture)
  topic: "morning"
  profile_json: fixed profile with all fields populated (committed as fixture)
  max_words: 50
  variant: each of 1-5
  seed: 99999
  
Output (per variant):
  text: string
  delays: [f64]
  keystroke_stream_json: string
```

**Test structure:**

New integration test file `src-rs/tests/avatar_reproducibility.rs`:

```rust
#[test]
fn avatar_cross_build_determinism() {
    // For each variant:
    // 1. Call compute_seeded with fixed inputs
    // 2. Serialize full output (text + delays + keystroke events) to JSON
    // 3. Write to REPRO_SNAPSHOT_DIR/avatar_v{N}.json
}
```

The existing `reproducibility-check.sh` already iterates over snapshot files and diffs them. Adding `avatar_v1.json` through `avatar_v5.json` to the snapshot directory is sufficient. The diff logic picks them up automatically.

**What this proves:** For a given (corpus, profile, seed, variant), the ghost produces bit-identical text, timing delays, and keystroke events across clean rebuilds. Combined with the existing signal reproducibility check, this means the full chain (ghost generation -> signal computation -> residual) is build-stable.

### CI workflow change

The existing `.github/workflows/signal-reproducibility.yml` needs no structural change. The reproducibility test binary already runs all tests in the `tests/` directory. Adding the new test file is sufficient.

---

## Component 6: Migration Plan

### Schema migration

Single migration file: `db/sql/migrations/NNN_residual_reproducibility.sql`

```sql
-- Residual reproducibility: store ghost generation inputs for regeneration.
-- See docs/design-residual-reproducibility.md for the full design.

ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN avatar_seed TEXT,
  ADD COLUMN profile_snapshot_json JSONB,
  ADD COLUMN corpus_sha256 TEXT,
  ADD COLUMN avatar_topic TEXT;

COMMENT ON COLUMN tb_reconstruction_residuals.avatar_seed IS
  'PRNG seed (u64 decimal string) used to generate the ghost. NULL for pre-reproducibility-era rows.';

COMMENT ON COLUMN tb_reconstruction_residuals.profile_snapshot_json IS
  'Exact profile JSON passed to generateAvatar() at computation time. NULL for pre-reproducibility-era rows.';

COMMENT ON COLUMN tb_reconstruction_residuals.corpus_sha256 IS
  'SHA-256 hex digest of the corpusJson string passed to generateAvatar(). NULL for pre-reproducibility-era rows.';

COMMENT ON COLUMN tb_reconstruction_residuals.avatar_topic IS
  'Topic string passed to generateAvatar(). Currently equals question text. NULL for pre-reproducibility-era rows.';
```

### Historical residuals

Existing rows (all residuals computed before this change) have `avatar_seed = NULL` and `profile_snapshot_json = NULL`. They are **pre-reproducibility-era artifacts**.

They are not invalid. The stored residual numbers are still the numbers that were computed. The `real_*` and `avatar_*` signal columns still hold the values that produced the delta. What's lost is the ability to regenerate the ghost independently.

**Status classification:**
- `avatar_seed IS NOT NULL AND profile_snapshot_json IS NOT NULL`: **reproducible**. Can be verified or recomputed.
- `avatar_seed IS NULL OR profile_snapshot_json IS NULL`: **historical**. Frozen artifact. Cannot be independently verified.

No recomputation of historical residuals. The ghosts that produced them are gone. Going forward, every new residual is reproducible.

**Cutoff:** The migration date. Any residual computed after the migration is reproducible. The `dttm_created_utc` column already exists and provides the timestamp.

### Do we regenerate historical residuals?

No. The original ghost was generated from a profile state that no longer exists (it has been updated by subsequent sessions). Even if we stored the current profile and re-ran with a new seed, the result would be a different residual, not a corrected version of the original. The original residual is what it is. It was computed correctly at the time, from the profile and ghost that existed then.

If a future profile model improvement warrants reanalysis, the correct approach is to compute *new* residuals under the new model and compare them against the historical ones. The historical residuals become the baseline, not the thing being fixed.

---

## What this enables

### Scientific claim (draft for REPRODUCIBILITY.md)

> **Reconstruction residual reproducibility.** Every reconstruction residual computed after [migration date] is a reproducible artifact. The PRNG seed and exact profile snapshot used to generate the ghost are stored alongside the residual. Given these inputs and the response corpus (recoverable from `tb_responses`), any build of Alice on the pinned toolchain can regenerate the identical ghost and verify the residual.
>
> This guarantee composes with signal reproducibility (INC-002/INC-005): the signal computation applied to both the real keystroke stream and the ghost's synthetic stream is bit-identical across clean rebuilds. The ghost generation itself is seed-deterministic and build-stable (verified by CI). The full chain from stored inputs to stored residual is reproducible end to end.
>
> Residuals computed before [migration date] are historical artifacts. They carry `NULL` seed and profile snapshot columns. Their stored values are the permanent record; they cannot be independently regenerated.

### Methods section (draft)

> Reconstruction residuals are computed by generating a synthetic keystroke stream (ghost) from the participant's statistical writing profile and comparing the signals of the ghost against the signals of the real session. Five adversary variants isolate which behavioral dimensions carry signal. The residual -- what the ghost cannot reproduce -- is the cognitive signature.
>
> Each residual is a reproducible artifact. The PRNG seed and profile state used for generation are persisted alongside the result. Independent verification is possible by regenerating the ghost from stored inputs and recomputing signals. Cross-build determinism of both the ghost engine and the signal pipeline is enforced by CI on every code change.

---

## Implementation sequence

Commit order for clean review:

1. **Rust: expose seed from `compute()`.** New `SeededAvatarResult` struct, `AvatarOutput` gains `seed: String` field. No behavior change; existing callers receive the seed and can ignore it.

   **Caller audit (verified 2026-04-22):**
   - `avatar::compute()` is called by exactly one site: `lib.rs:241` (`generate_avatar` napi entry point). Update in this commit.
   - `avatar::compute_seeded()` is called by: `avatar::compute()` (line 1808), plus 8 test call sites in `avatar.rs` (lines 2483-2541). Tests call `compute_seeded` directly and are unaffected by the `compute()` return type change.
   - No other Rust-internal callers. No examples directory. Clean upgrade path.

2. **Rust: add `regenerate_avatar` napi entry point.** Takes explicit seed string. Calls `compute_seeded()`. Tests.

3. **Rust: avatar reproducibility CI test.** New `tests/avatar_reproducibility.rs`. Snapshot-based cross-build diff for all five variants with fixed inputs. Extend `reproducibility-check.sh` to diff avatar snapshots.

4. **Schema migration.** Add `avatar_seed`, `profile_snapshot_json`, `corpus_sha256`, and `avatar_topic` columns to `tb_reconstruction_residuals`. Update `dbAlice_Tables.sql` to include the new columns in the CREATE TABLE definition.

5. **TypeScript: persist seed, profile snapshot, corpus hash, and topic.** `libReconstruction.ts` captures seed from generation result, profile JSON from the already-constructed object, SHA-256 of corpus JSON, and the topic string. `saveReconstructionResidual` writes all new columns.

6. **TypeScript: `regenerateAvatar` + `verifyResidual` + integration test.** New functions in `libSignalsNative.ts` and `libReconstruction.ts`. Integration test script (`src/scripts/verify-residual-integration.ts`) exercises the full chain on a real stored residual. Not wired to any API route; available for scripts, manual verification, and future automated sweeps.

7. **Documentation.** Update `REPRODUCIBILITY.md`, `METHODS_PROVENANCE.md` (convert DEFERRED entry to implemented), `CLAUDE.md` if needed.

Each commit is independently shippable. Commits 1-3 are Rust-only. Commit 4 is schema-only. Commits 5-6 are TypeScript-only. Commit 7 is docs.

---

## Component 7: Verification Failure Procedure

`verifyResidual()` returns `match: false` when stored and recomputed residuals diverge. Three possible causes, each with different scientific implications:

### Cause 1: Pipeline bug introduced post-hoc

A code change after the residual was computed altered signal behavior. The stored residual was correct at computation time; recomputation produces a different result because the signal pipeline changed.

**Detection:** The divergence appears only for residuals computed before a specific commit. Residuals computed after the same commit verify successfully.

**Procedure:**
1. Identify the commit that introduced the divergence (bisect against known-good verification).
2. Log to METHODS_PROVENANCE.md as an incident.
3. Flag affected residuals: `verification_status = 'mismatch_post_hoc'`, `verification_note = 'pipeline change in commit {sha}'`.
4. Do not overwrite stored residuals. They are the historical record. The mismatch itself is the evidence of the pipeline change.

### Cause 2: Pipeline bug present at original computation

The residual was wrong when it was computed. Recomputation with the same inputs (which is now possible) reveals the error. This is the scenario that reproducibility was designed to catch.

**Detection:** The divergence is present for a specific session regardless of when verification runs. The recomputed value is consistent across multiple verification runs.

**Procedure:**
1. Investigate the original computation. What was wrong?
2. Log to METHODS_PROVENANCE.md as an incident with full root cause analysis.
3. Flag affected residuals: `verification_status = 'mismatch_original_bug'`, `verification_note = 'original computation was incorrect; see INC-NNN'`.
4. Optionally store the corrected residual in a parallel column or new row (do not overwrite the original).

### Cause 3: Cross-build determinism failure

The ghost engine or signal pipeline produces different output across builds for the same inputs. Should be impossible given CI enforcement, but CI tests a fixture, not every possible input.

**Detection:** Verification fails intermittently (different results on different machines or after recompilation), but succeeds on the same binary that computed the original.

**Procedure:**
1. This is a reproducibility incident. Treat as severity: produces-wrong-number.
2. Identify the non-determinism source (new HashMap iteration? uncovered summation site? LLVM codegen change?).
3. Fix, add regression test to CI reproducibility suite.
4. Flag affected residuals: `verification_status = 'mismatch_nondeterminism'`, `verification_note = 'cross-build drift; see INC-NNN'`.

### Schema support

Add a `verification_status` column in a future migration (not part of the initial rollout). For now, verification results are logged and any mismatches become METHODS_PROVENANCE incidents manually. The column becomes necessary when verification is automated (e.g., a nightly sweep of recent residuals).

```sql
-- Future migration, not part of initial rollout:
ALTER TABLE tb_reconstruction_residuals
  ADD COLUMN verification_status TEXT,       -- NULL, 'verified', 'mismatch_post_hoc', 'mismatch_original_bug', 'mismatch_nondeterminism'
  ADD COLUMN verification_note TEXT,
  ADD COLUMN dttm_verified_utc TIMESTAMPTZ;
```

---

## Component 8: TypeScript Integration Test

Commit 6 includes a TypeScript-level integration test that exercises the full `verifyResidual` chain on a real stored residual (one computed after the migration, with seed and profile snapshot present).

### What it tests

The Rust CI test (Commit 3) verifies ghost generation is bit-identical across clean rebuilds. The TS integration test verifies the **full pipeline**: regeneration from stored inputs, signal computation on regenerated ghost, residual comparison against stored values.

### Test structure

Script: `src/scripts/verify-residual-integration.ts`

```typescript
// 1. Pick the most recent reproducible residual (avatar_seed IS NOT NULL)
// 2. Call verifyResidual(questionId, variantId)
// 3. Assert match === true
// 4. Assert recomputed signals are within tolerance (exact match for
//    dynamical/motor signals on same build; semantic signals may have
//    external API drift if they call Claude/Voyage)
```

### Semantic signal caveat

Semantic signals (`libSemanticSignals.ts`) may call external APIs (Claude for idea density, Voyage for embeddings). These are not deterministic across API versions. The integration test should:
- Verify dynamical and motor residuals match exactly (same Rust engine, same build).
- Verify semantic residuals match within a tolerance, or skip them with a documented reason if external API responses have drifted.

This caveat does not weaken the reproducibility claim for the signal engine (Rust). It bounds the claim honestly: dynamical and motor residuals are bit-reproducible end to end; semantic residuals are reproducible to the extent that external NLP APIs are stable.

---

## Resolved questions

1. **Corpus integrity:** SHA-256 hash of the serialized `corpusJson` string. Stored as `corpus_sha256 TEXT`. Catches edits, deletions, and corruption that a simple count would miss.

2. **Topic as input:** Stored as `avatar_topic TEXT`. Currently equals question text (passed directly, no derivation function). Closes the door on future topic derivation drift.

3. **`max_words` source:** Already stored as `real_word_count` on the residual row. No additional persistence needed. Derived from `tb_session_summaries.word_count`, which is immutable per session.
