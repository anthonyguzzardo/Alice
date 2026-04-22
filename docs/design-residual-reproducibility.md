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
- Redundancy. Five variants per session, each storing the same profile blob. The profile JSON is ~2-4KB. That's 10-20KB per session, ~7MB/year at daily journaling. Not a storage concern.
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

The redundancy cost (same JSON across five variant rows) is ~15KB/session. At daily journaling, that's ~5.5MB/year. Irrelevant.

---

## Component 3: Corpus Reproducibility

The profile and seed are not the only inputs. The ghost also receives `corpusJson`: the full text of all prior responses, in chronological order. This is constructed in `libReconstruction.ts` (lines 280-285) by querying all responses ordered by `scheduled_for`.

The corpus is reproducible from the database without snapshotting, as long as:
1. No responses are deleted after residual computation.
2. The query order is deterministic (`ORDER BY q.scheduled_for ASC`).
3. Response text is immutable after submission.

All three hold in Alice's current design (single user, no edit capability, logical-FK-aware deletion). The corpus does not need to be stored inline.

However, the `corpus_size` column already exists on `tb_reconstruction_residuals`. This serves as a checksum: if regeneration produces a different corpus size than stored, the response history has changed and the regeneration is not valid against the original.

**No schema change needed.** Document the corpus reproducibility assumption and the `corpus_size` integrity check.

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
1. Loads the stored residual row (seed, profile snapshot, variant, question text, word count).
2. Reconstructs the corpus from current response history.
3. Checks `corpus_size` matches stored value. If not, returns null (corpus changed, verification impossible).
4. Calls `regenerateAvatar()` with the stored seed and profile snapshot.
5. Runs signals on the regenerated ghost's keystroke stream.
6. Computes residuals and compares against stored values.
7. Returns match status and any deltas.

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
  ADD COLUMN profile_snapshot_json JSONB;

COMMENT ON COLUMN tb_reconstruction_residuals.avatar_seed IS
  'PRNG seed (u64 decimal string) used to generate the ghost. NULL for pre-reproducibility-era rows.';

COMMENT ON COLUMN tb_reconstruction_residuals.profile_snapshot_json IS
  'Exact profile JSON passed to generateAvatar() at computation time. NULL for pre-reproducibility-era rows.';
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

2. **Rust: add `regenerate_avatar` napi entry point.** Takes explicit seed string. Calls `compute_seeded()`. Tests.

3. **Rust: avatar reproducibility CI test.** New `tests/avatar_reproducibility.rs`. Snapshot-based cross-build diff for all five variants with fixed inputs. Extend `reproducibility-check.sh` to diff avatar snapshots.

4. **Schema migration.** Add `avatar_seed` and `profile_snapshot_json` columns to `tb_reconstruction_residuals`. Update `dbAlice_Tables.sql` to include the new columns in the CREATE TABLE definition.

5. **TypeScript: persist seed and profile snapshot.** `libReconstruction.ts` captures seed from generation result and profile JSON from the already-constructed object. `saveReconstructionResidual` writes both new columns.

6. **TypeScript: `regenerateAvatar` + `verifyResidual`.** New functions in `libSignalsNative.ts` and `libReconstruction.ts`. Not wired to any API route yet; available for scripts and future use.

7. **Documentation.** Update `REPRODUCIBILITY.md`, `METHODS_PROVENANCE.md` (convert DEFERRED entry to implemented), `CLAUDE.md` if needed.

Each commit is independently shippable. Commits 1-3 are Rust-only. Commit 4 is schema-only. Commits 5-6 are TypeScript-only. Commit 7 is docs.

---

## Open questions

1. **Corpus integrity check beyond `corpus_size`.** The current design uses `corpus_size` (count of responses) as a coarse check that the corpus hasn't changed. A hash of the corpus JSON would be stronger but adds a column and computation. Is the count sufficient, or do we want a SHA-256?

2. **Question text as input.** The ghost uses `topic` (derived from question text) as a seed word for Markov generation. Question text is immutable and recoverable from `tb_questions`. No snapshot needed, but worth noting as an implicit input.

3. **`max_words` source.** Currently derived from `tb_session_summaries.word_count`. This is immutable per session. No snapshot needed, already stored as `real_word_count` on the residual row.
