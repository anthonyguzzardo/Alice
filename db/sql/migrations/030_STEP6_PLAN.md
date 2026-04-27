# Migration 030 — Step 6 Plan: Aggregation Hotspots

Written 2026-04-26, post-Step-5 wrap. Read `030_HANDOFF.md` first for context.

This document is **review material only**. No tests are written, no code is
edited, until the user approves the plan or requests changes.

## 0. Provenance of the §C list

The Step 0 §C inventory ("12 aggregation hotspots") was produced as part of
the Step 0 surface-unknowns pass and referenced in `030_HANDOFF.md`. The full
letter-keyed list is **not preserved verbatim in the repo**. The handoff
preserves these mentions, which I take as ground-truth anchors:

- §3 batch-1 entry: "Hotspot C — six SELECTs that need `subject_id` scoping" (`libProfile`)
- §3 batch-1 entry: "Hotspots A & B — owner baseline + dispersion" (`libCalibrationDrift`)
- §3 batch-1 entry: "Hotspot D — avatar corpus per subject" (`libReconstruction`)
- §3 batch-1 entry: "Hotspot E" (`libCrossSessionSignals`)
- §3 batch-1 entry: "Hotspot F" (`libSemanticBaseline`)
- §3 batch-1 entry: "overlap hotspots I/J/K" (`libDailyDelta`)

That's nine letters confirmed. Three (G, H, L) are not named in the handoff.
Rather than invent a guess, the plan below treats the nine confirmed hotspots
as the spine and **separately surfaces four additional aggregation sites this
audit found in the post-Step-5 codebase**, framed as "candidate hotspots
G/H/L/M — Step 0 §C may or may not have included these; treat as additions
unless review says otherwise."

If the user has the original §C list, please drop it in and I will reconcile
before any test is written. The risk of working from a reconstructed list is
that a real hotspot from the original audit is silently dropped.

## 1. Refreshed hotspot table (post-Step-5)

| ID | File | Line | What it aggregates | Current scoping (post-Step-5) | Risk if scoping fails |
|---|---|---|---|---|---|
| **A** | `libCalibrationDrift.ts` | 87–129 | Owner calibration baseline (12 AVG / COUNT over `tb_session_summaries` ⋈ `tb_questions`, optional `device_type`) | Threaded in batch 1 — `WHERE q.subject_id = ${subjectId}` on both branches | Owner drift baseline contaminated with subject calibrations → the entire drift trajectory becomes meaningless |
| **B** | `libCalibrationDrift.ts` | 158–164 | Per-person dispersion (sample std of `s.${sourceCol}` over journal sessions) | Threaded in batch 1 — `WHERE q.subject_id = $1 AND q.question_source_id != 3` | Drift z-scores divided by wrong-population variance → false stable / false drifting verdicts |
| **C** | `libProfile.ts` | 73–137 | Owner personal profile rebuild — six SELECTs: `tb_session_summaries`, `tb_motor_signals`, `tb_process_signals`, `tb_burst_sequences`, `tb_rburst_sequences`, `tb_responses`, all gated on `q.question_source_id != 3` and a `paste_contaminated` EXISTS subquery | Threaded in batch 1 — `WHERE q.subject_id = ${subjectId}` on every JOIN | Personal profile contaminated → the ghost reconstruction is built from another subject's motor fingerprint, breaking the entire residual measurement |
| **D** | `libReconstruction.ts` | 393–401, 422–448 | Corpus assembly + personal profile fetch for ghost generation | Threaded in batch 1 — corpus query scopes `q.subject_id`, profile query scopes `WHERE subject_id` | Ghost generated from wrong corpus → reconstruction residual becomes a between-subject distance metric, paper claim invalidated |
| **E** | `libCrossSessionSignals.ts` | 47–78, 138–164, 327–353 | Cross-session aggregations: prior-text corpus (`getPriorTexts`), motor self-perplexity model (50 prior IKI streams), digraph stability baseline (last 5 motor profiles) | Threaded in batch 1 — `WHERE q.subject_id` / `WHERE se.subject_id` on every query | Self-perplexity + digraph stability computed against wrong baseline → "novelty" claims are between-subject not within-subject |
| **F** | `libSemanticBaseline.ts` | 117–212, 268–321 | Welford running baseline lookup, topic-matched k-NN over `tb_embeddings`, idempotency check on `tb_semantic_trajectory` | Threaded in batch 1 — baseline scoped, trajectory idempotency scoped, HNSW lookup scopes `e.subject_id` and `q.subject_id` on the joined paths | Within-person z-scores computed against another person's distribution → trajectory points marked anomalous when they aren't (or vice versa) |
| **I** | `libDailyDelta.ts` | 405–446 | `computePriorDayDelta` — finds the most recent eligible prior-day pair via correlated EXISTS subqueries against `tb_questions`, `tb_session_summaries`, `tb_session_delta` | Threaded in batch 1 — outer + EXISTS + NOT EXISTS all scope by `subject_id` | A day-pair from another subject treated as eligible → delta computed cross-subject, polluting daily-trends prompt input |
| **J** | `libDailyDelta.ts` | 456–476 | `getEligibleDatesWithoutDelta` — same shape as I but for backfill (returns the full eligible list) | Threaded in batch 1 — same scoping pattern as I | Backfill writes cross-subject delta rows en masse |
| **K** | `libDailyDelta.ts` | 218–298, calls into `libDb.getRecentSessionDeltas` | RMS z-score across history (`computeDeltaMagnitude` + `formatCompactDelta` 14-day window + 7-day trend) | `getRecentSessionDeltas(subjectId, limit)` is scoped at the libDb call. The compute functions accept the array and never see subject_id; correctness depends on caller scoping | Pure-compute — but if a caller of `getRecentSessionDeltas` ever forgets to pass `subjectId`, the magnitude is computed against the wrong distribution |
| **G?** *(candidate)* | `libIntegrity.ts` | 101–125 | Historical threshold computation — reads ALL prior `profile_distance` values from `tb_session_integrity` and computes `mean + 2·std` | Threaded in batch 1 — `WHERE subject_id = ${subjectId}` | Mediation-detection threshold computed against another subject's distance distribution → false flagged or false clean per session |
| **H?** *(candidate)* | `libGenerate.ts` | 63–162 | Generation prompt assembly — touches recentResponses (14d), allReflections, RAG retrieval (HNSW), recentFeedback, allSummaries, recentLifeContext, recentDeltas | Threaded in batch 1 — every libDb call passes `subjectId`; RAG `retrieveSimilarMulti` / `retrieveContrarian` accept `subjectId` and forward to `searchVecEmbeddings` | LLM-orchestration only, owner-pinned today (`OWNER_SUBJECT_ID` at call site). Lower direct risk; flagged because a missed scope here cross-pollutes the LLM context window with another subject's text |
| **L?** *(candidate)* | `libAliceNegative/libRenderWitness.ts` | 35–40 | `SELECT COUNT(*) FROM tb_session_summaries ⋈ tb_questions` to derive current witness `entry_count` | Threaded in batch 1 — `WHERE q.subject_id = ${subjectId}` | Witness rendered with wrong `entry_count` → wrong dynamics row matched downstream. AN-deprioritized but still load-bearing for the current witness reading |
| **M?** *(candidate)* | `libDb.getLatestReflectionWithCoverage` (file:lines TBD) | — | Reflection coverage check used by the question-generation feedback loop | NOT verified yet — needs source-read in the actual hotspot pass | Unknown — surface as deferred for verification |

**Bookkeeping confirmation:** every "current scoping" line above was verified by reading the post-Step-5 source. The audit found no aggregation site in `src/lib/*.ts` or `src/pages/api/**` that lacks a `WHERE subject_id = ?` clause. **The Step 5 mechanical sweep landed correctly at the syntactic level.** The Step 6 task is therefore not "find missing scopes" — it is "prove the scopes that are there are functionally correct under a two-subject fixture, and catch any aggregation that compiles fine but silently mixes populations."

## 2. The 13th hotspot: `instrument-status.ts`

`instrument-status.ts:14–94` was the structural-finding endpoint flagged in
batch 2. Current state (post-batch-2 + the L17 comment refinement):

```ts
const subjectId = OWNER_SUBJECT_ID;
const [counts] = await sql`SELECT
  (SELECT COUNT(*) FROM tb_responses WHERE subject_id = ${subjectId}) AS responses,
  ...
```

**Status: scoping is in place.** Owner-pinned with the explicit comment that
multi-subject rollup belongs in a separate endpoint, never mixed here.

**Step 6 treatment:** treat as **resolved-during-batch-2 pending verification
test**. The verification test should:

1. Insert one journal session for `subject_id = 1` (owner) and one for
   `subject_id = 2` (synthetic subject)
2. Hit `/api/instrument-status`
3. Assert `responses === 1`, `sessions === 1`, `calibrationSessions === 0`
4. Assert no count or aggregate equals 2 (the cross-subject sum)

This test goes in the sub-batch 4 work (smallest, confidence-building) at the
end of Step 6, not at the start.

## 3. Test-first protocol (per hotspot)

Each hotspot follows the exact same loop. No exceptions.

```
1. Set up the test file
   - Add `tests/db/<lib-or-route>.subjectScope.test.ts`
   - Use the existing `tests/db/globalSetup.ts` container + per-test TRUNCATE
   - Insert two subjects: subject_id = 1 (owner, already in seed) and
     subject_id = 999 (synthetic test subject — high number to avoid
     collision with future provisioning)

2. Insert distinguishable rows for both subjects
   - Owner: a fixture that produces a known aggregation result (e.g. 5
     calibration sessions with first_keystroke_ms ∈ {100,200,300,400,500},
     mean=300)
   - Subject 999: a deliberately offset fixture (e.g. 5 calibration
     sessions with first_keystroke_ms ∈ {1000,2000,3000,4000,5000},
     mean=3000)

3. Write a failing test
   - Call the function with `subjectId = 1`
   - Assert the aggregation returns the OWNER value (mean=300), NOT the
     pooled mean (1650), NOT the subject-999 mean (3000)
   - At this stage, the test SHOULD pass on the post-Step-5 code (because
     the scoping landed). To prove the test exercises the bug:

4. Prove the test catches the bug
   - Temporarily remove the `subject_id = ?` clause from the query in
     question (in a local edit, NOT committed)
   - Re-run the test
   - Assert it fails (with the pooled or wrong-subject value)
   - Restore the scoping
   - Re-run, assert it passes

   This temporary mutation step is what distinguishes "test that asserts
   correct behavior" from "test that catches the bug we're guarding against."
   Without it, a test that always passes is indistinguishable from a test
   that doesn't exercise the fix.

5. Run the full test suite
   - `npx vitest run` (all projects)
   - Confirm no regression elsewhere

6. Stop and report before moving to the next hotspot
   - Hotspot summary, fixture used, mutation result (failed as expected),
     final result (passes), tsc + test count delta
```

The cost of this protocol per hotspot is ~30 min (test write + mutation
verify + suite run). Twelve hotspots = 6 hours of focused work. The user can
fold-back at any point.

## 4. Order of attack

Sequenced by measurement-instrument criticality (highest first). The earliest
hotspots are where silent corruption would do the most damage to the paper's
core claims; the last are the confidence-building / lowest-risk ones.

| Order | Hotspot | Reason for priority |
|---|---|---|
| 1 | **C** (libProfile) | The personal profile feeds the ghost. A wrong profile produces a wrong ghost, which produces meaningless reconstruction residuals. This is the most measurement-instrument-critical hotspot. |
| 2 | **D** (libReconstruction) | The other half of the residual — the corpus the ghost is trained on. C and D together determine whether the reconstruction residual measures what it claims to measure. |
| 3 | **A** (libCalibrationDrift baseline) | The reference frame for all drift analysis. If the baseline is contaminated, every drift snapshot afterward is wrong. |
| 4 | **B** (libCalibrationDrift dispersion) | The denominator of every drift z-score. Different failure mode from A — A breaks the reference frame, B breaks the scaling. |
| 5 | **F** (libSemanticBaseline) | Within-person z-scores are the mechanism for surfacing trajectory anomalies. If the running mean/m2 is built from another person, every flagged anomaly is meaningless. |
| 6 | **E** (libCrossSessionSignals) | Self-perplexity + digraph stability claim "novelty within this person's history." If history pulls from another person, the claim is false. |
| 7 | **G?** (libIntegrity threshold) | Mediation-detection threshold is dynamic and reads all prior distances. Wrong distribution → false flags or false clean. |
| 8 | **I** (libDailyDelta — prior day) | Single-day-pair scope. Contained but feeds the question-generation prompt. |
| 9 | **J** (libDailyDelta — backfill) | Multi-day scope. Same shape as I, but writes more rows on a bad invocation. |
| 10 | **K** (libDailyDelta — magnitude) | Pure-compute on a scoped array. Lowest direct DB risk; tested by giving it deliberately-mixed input arrays and asserting it would have produced the wrong magnitude (defensive test for a future caller bug). |
| 11 | **L?** (libRenderWitness count) | AN-deprioritized. Test it because it feeds witness rendering, but expect minimal real risk. |
| 12 | **H?** (libGenerate prompt assembly) | Owner-pinned by Caddy auth today. Lowest direct risk because the call site never sees a subject context. Test confirms scoping is correct so a future subject-aware generation pipeline doesn't cross-pollute. |
| 13 | **instrument-status.ts** verification | Owner-pinned, public-facing. Test confirms n=1 paper claim cannot accidentally widen to a population aggregate. |

Three **deferred** items not in the active sequence:
- **M?** (`getLatestReflectionWithCoverage`) — verify file:lines and scoping before deciding whether to test.
- The **original §C list reconciliation** — if user surfaces it, reconcile before continuing.
- Any hotspot the user wants to add to the list.

## 5. What I expect to find

Predictions exist so divergence from reality is visible. Right or wrong, each
prediction is a falsifiable claim.

| Hotspot | Prediction |
|---|---|
| **C** (libProfile) | Test passes on first run after scoping is removed — because the six SELECTs are highly redundant in their `q.subject_id` clauses. The mutation step will likely require removing it from MORE than one SELECT to force a divergence (because the contamination check + source-id check would still filter most rows). Expect to need to remove scoping from 2-3 of the six SELECTs to make the test fail. |
| **D** (libReconstruction) | Clean catch. The corpus query is the single load-bearing query — removing its `q.subject_id` will pull subject 999's text into the Markov chain, and the ghost will be measurably different. |
| **A**, **B** (libCalibrationDrift) | Clean catch on both. The two-subject fixture with offset means (300 vs 3000) will produce a pooled mean (1650) that's clearly wrong against the assertion. |
| **F** (libSemanticBaseline) | Clean catch. Welford state is per (subject_id, signal_name); removing the subject scope mixes two subjects' running means in the same row, which the test will detect via z-score divergence. |
| **E** (libCrossSessionSignals) | Possibly *unexpected* result: the `getPriorTexts` query is fine, but the digraph_stability and motor_self_perplexity queries pull from `tb_session_events` and `tb_motor_signals`. If the row-level scoping there is intact but the aggregation logic re-mixes the streams, the test might fail in a way that reveals an internal mixing bug. Watch this one. |
| **I**, **J** (libDailyDelta) | Clean catch on both. The correlated EXISTS subqueries are the textbook example of where scoping fails are easy to miss. |
| **K** (libDailyDelta magnitude) | Pure-compute test. No mutation step needed; the test just constructs a deliberately-mixed array and asserts the function would compute a wrong magnitude — establishing the load-bearing role of caller scoping. |
| **G?** (libIntegrity) | Clean catch. The historical-distances query is single-table single-WHERE, very simple. |
| **L?** (libRenderWitness) | Clean catch. Single COUNT query. |
| **H?** (libGenerate) | Test will pass on the post-Step-5 code, but the *mutation* step is interesting: there are ~7 libDb calls inside `runGeneration`, and removing scoping from any one of them produces a different failure mode in the LLM prompt input. This hotspot is worth testing not because it's high-risk today but because it documents a much wider attack surface. The test will probably end up parameterized across the 7 calls. |
| **instrument-status.ts** | Clean catch. Each of the COUNT(*)s is independent; the test inserts one row per subject and asserts the API returns 1, not 2. |

**Where I'd expect to be most surprised:** hotspot E. The cross-session
self-perplexity model builds a Markov chain from prior IKI sequences and then
scores the current session against it. If the scoping at the `tb_session_events`
SELECT is correct but the model-build loop accidentally pools across subjects
internally (e.g. via a global Map<context,counts>), the test would catch a
*deeper* issue than mere SQL scoping. I should write the E test prepared for
that finding.

## 6. Out-of-scope flags

These are NOT being addressed in Step 6. Listed here so they aren't quietly
dropped.

- **Lint rule for unscoped queries** — Step 7 (separate concern).
- **The pre-existing `tb_session_events.subject_id` index** — already added by
  Block 5 of `030_unify_subject_id.sql`; Step 6 verifies query correctness,
  not query performance.
- **Subject API (`/api/subject/respond`, `/api/subject/today`)** — operates on
  variant tables (`tb_subject_responses`, `tb_subject_session_summaries`)
  until Step 9 cutover. Not a Step 6 hotspot.
- **`scripts/archive/*`** — untouched per §8 of handoff.
- **Strict-null / TransactionSql / SQLite-era tsc noise** — followup queue.
- **Documentation hygiene pass on "collecting now, using later" modules** —
  followup queue.

## 7. Decision points for review

Three things I want explicit confirmation on before any test is written:

1. **Original §C list.** Do you have it? If yes, reconcile. If no, accept the
   reconstructed list above with the four candidate hotspots (G/H/L/M)
   flagged as additions.

2. **Order of attack.** I've ranked by measurement-instrument criticality.
   Is that the right priority axis, or do you want simpler-first (gallery,
   instrument-status) for confidence-building?

3. **The mutation verification step.** Section 3 step 4 has the test
   temporarily remove the scoping to prove the test catches the bug. This is
   essential discipline but adds ~5 min per hotspot. Confirm you want this
   in the protocol — vs. accepting "test passes on correctly-scoped code" as
   sufficient evidence of correctness.

End of plan. No tests written, no code edited. Awaiting review.
