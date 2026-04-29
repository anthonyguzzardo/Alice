# Issue 3 findings — flagging this one

**This is not the same shape as Issues 1 and 2.** Engine version drift, not just script interface drift.

## Rust signature change

The Rust function at `src-rs/src/lib.rs:495` is currently:

```rust
pub fn regenerate_avatar(
    corpus: Vec<String>,
    topic: String,
    profile: AvatarProfileInput,
    max_words: i32,
    variant: i32,
    seed: String,
) -> AvatarOutput
```

Generated TypeScript binding (`src-rs/index.d.ts`) is correct:

```ts
export declare function regenerateAvatar(
  corpus: Array<string>,
  topic: string,
  profile: AvatarProfileInput,
  maxWords: number,
  variant: number,
  seed: string,
): AvatarOutput
```

Git blame on the signature: changed in `b818a5b 2026-04-25 14:29 — 4.5 deferrement completed`. The pre-change signature was:

```rust
pub fn regenerate_avatar(
    corpus_json: String,
    topic: String,
    profile_json: String,
    ...
)
```

So **two** parameters changed type, not one:

- `corpus_json: String` → `corpus: Vec<String>`
- `profile_json: String` → `profile: AvatarProfileInput` (a typed struct)

## Script is broken on both args

`src/scripts/backfill-extended-residuals.ts` first commit: `5585eb3 2026-04-24 — ghost mig complete`. Predates the signature change by ~14 hours.

Current script at line 122:

```ts
const resolvedProfile = typeof profileJson === 'string' ? profileJson : JSON.stringify(profileJson);
const avatar = regenerateAvatar(corpusJson, topic ?? '', resolvedProfile, realWordCount, vid, seed);
```

- `corpusJson` is a JSON-stringified `string`, not `string[]` → TS catches it (the one error reported at column 37)
- `resolvedProfile` is a `string`, not `AvatarProfileInput` (an object) → TS does not report this one in the error list, but it is also wrong at runtime via napi

napi-rs is strict on type conversions. Either of these passing a string where the bound type expects something structured throws inside the napi binding. That throw is caught by `regenerateAvatar`'s wrapper in `src/lib/libSignalsNative.ts:422-425`, returns `null`, and the script's `if (!avatar)` skips the row.

**Net effect**: this script has been a no-op since 2026-04-25 (4 days). Every avatar regeneration fails, every row gets skipped, the summary prints `Updated: 0, Skipped: <total>`. Operator wouldn't catch this from typecheck (only one error reported); they would only catch it by reading the runtime log output from a real run.

## Why it is "something else, flag and stop"

Per your rules I'm flagging this:

1. **Two-arg signature change**, not one. The fix is not just "swap one string for an array" — it also requires constructing an `AvatarProfileInput` object from the stored `profile_snapshot_json` string.
2. **A helper for the profile conversion already exists** at `src/lib/libSignalsNative.ts:326` — `profileFromLegacyJson(json: string): AvatarProfileInput`. The docstring on it says: "Used by the replay path (`regenerateFromStored`) which reads `profile_snapshot_json` columns persisted before and after this refactor." That helper was written specifically for this kind of use case. The backfill script just never adopted it.
3. **The fix shape is known** — pass `textRows.map(r => r.text)` for corpus, and `profileFromLegacyJson(resolvedProfile)` for profile — but it is a 3-line change rather than a 1-line addition. Mechanically not harder than Issues 1 and 2.
4. **Production blast radius is bounded**: this is a backfill script for `extended_residuals_json`, an enrichment column on `tb_reconstruction_residuals`. If the column has been NULL on rows since 2026-04-25, that is the visible artifact of this bug. No silent corruption — affected rows are explicitly skipped, not partially updated.

## Summary

This is **engine version drift**: the Rust binding's contract changed and a downstream script was not updated. Same root cause family as Issues 1 and 2 (a phase change landing without sweeping every consumer), different in that it touches the napi boundary specifically.

Stopping here as instructed. Awaiting direction on whether to proceed with the fix as part of Step D.
