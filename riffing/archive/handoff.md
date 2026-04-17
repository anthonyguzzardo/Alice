# Handoff — April 16, 2026 (post slice-3 + observatory rebuild)

Pick up here. The prior session shipped slices 1, 2, 3 *and* the slice-3 follow-up sprint that was originally scoped as "next 1-2 weeks." Everything below is on disk and **uncommitted** pending Anthony's smoke test.

---

## Read these first, in order

1. `CLAUDE.md` — project conventions (table prefixes, surrogate keys, footer columns, no ALTER TABLE except idempotent additive migrations, etc.). Non-negotiable.
2. `README.md` — current architecture as of V20 (also at `README_AUDIT/V20/README.md`).
3. This file — what changed and what's next.
4. `src/lib/signal-registry.ts` — the ~100 deterministic signals; substrate documentation.
5. `notes/architectural-pivot-postmortem.md` — drafted, not for publication. Read for context on *why* the deletions happened.

The top-of-file ARCHIVE INDEX in `src/lib/db.ts` is the canonical map of what's gone (and where its data is preserved).

---

## What just shipped — uncommitted, three nominal commits

### Commit A — Slices 1+2+3 (interpretive layer removed; PersDyn 8D → 7D + parallel semantic)

Already documented in the prior handoff revision; condensed here.

**Slice 1 (data archive + neutralization).** Nine tables renamed to `zz_archive_*_20260416` via `scripts/archive-interpretive-layer-20260416.ts` (idempotent, already run). Predictions / theories / observations / suppressed-questions / question-candidates / supporting enums all preserved, schema no longer recreated. `db.ts` carries 24 stub functions returning empty/no-op. Five API routes neutralized.

**Slice 2 (dead code removal).** Deleted `observe.ts`, `grader.ts`, `theory-selection.ts`, `observe.ts` script, `surface-patterns.ts`, `simulate-v1.ts` (~1,830 lines). `reflect.ts` rewritten as ~90-line deterministic structured-receipt writer (no LLM). `generate.ts` and `signals.ts` pruned. `package.json` lost `observe` and `reflect` scripts.

**Slice 3 (PersDyn 8D → 7D + parallel semantic 11D).**
- `state-engine.ts`: STATE_DIMENSIONS = 7 (dropped `expression`); convergence over 7D; no longer loads response text.
- `dynamics.ts`: generic over a dimension list (defaults to STATE_DIMENSIONS); same engine reused on either space.
- `semantic-space.ts`: NEW. SEMANTIC_DIMENSIONS = 11 (4 expression components + 5 Pennebaker/cognitive + 6 NRC). Schema-ready null columns for 4 LLM-extracted dims (sentiment, abstraction, agency_framing, temporal_orientation).
- `db.ts`: rewrote `tb_entry_states` without expression; added `tb_semantic_states`, `tb_semantic_dynamics`, `tb_semantic_coupling`. Save functions for all three.
- `render-witness.ts` + `simulate.ts`: compute and persist behavioral 7D and semantic ND separately, each with its own dynamics / coupling pass.
- `signals.ts` `formatDynamicsContext`: dim count auto-derived from analysis (no hard-coded 8D).
- `signal-families.ts`: pennebaker_linguistic + lexical families have `feedsDimensions: []` with descriptions noting they feed semantic-space; their state-engine neutralizers removed.
- `scripts/archive-8d-state-20260416.ts`: idempotent migration; archived 22 8D entry_states + 24 trait_dynamics rows + 46 coupling_matrix rows.

### Commit B — Slice-3 follow-ups + Observatory rebuild + playback + calibration drift + slider + bug fix

This is the bigger, more interesting commit.

**Per-session metadata signals (slice-3 follow-ups from prior handoff).** New file `src/lib/session-metadata.ts`. Computes:
- `hour_typicality` — circular-density z-score on personal hour distribution.
- `deletion_curve_type` — early / late / terminal / bimodal / uniform / none, from a 10-bin histogram of weighted deletion chars across session time.
- `burst_trajectory_shape` — monotonic_up / monotonic_down / u_shaped / inverted_u / flat / none, from per-burst length sequence.
- `inter_burst_interval_mean_ms` + `_std_ms` — gap-time distribution.
- `deletion_during_burst_count` + `deletion_between_burst_count` — proximity classification.

Persisted to `tb_session_metadata`. Wired into `respond.ts`. New column `deletion_events_json` on `tb_session_summaries` (idempotent migration). Client-side capture in `index.astro` posts `deletionEvents` (ms-offsets) and `eventLog` (text snapshots) in the payload.

**Calibration drift engine.** New file `src/lib/calibration-drift.ts`. On every calibration submit, snapshots baselines (global + per-device) into new `tb_calibration_baselines_history`, computes `drift_magnitude` as z-norm L2 distance from prior snapshot scaled per-dim by journal-session dispersion. Wired into `calibrate.ts`. Designer-facing only — never surfaced to user.

**Per-keystroke event log + read-only playback.** New table `tb_session_events` stores compact JSON `[t_ms_offset, text_snapshot]` array (capped at 5000 events, every-other decimation if exceeded). Capture in `index.astro` on each input event. New API `/api/observatory/playback/[questionId]`. New page `/observatory/replay/[questionId].astro` — play / pause / scrub / speed (0.5×–8×). Designer-only initially.

**Observatory rebuild.** Deleted `src/lib/sim-db.ts` and `src/pages/api/observatory/predictions.ts`. Rewrote four observatory APIs against live `data/alice.db`:
- `states.ts` — entry states + semantic states + session metadata + replay availability.
- `synthesis.ts` — rightNow / arcs / discoveries (drops predictions+theories), now spans behavioral *and* semantic.
- `coupling.ts` — behavioral dynamics + semantic dynamics + coupling tables for each + emotion-behavior cross-domain.
- `entry/[id].ts` — full per-entry detail with both radars + slice-3 metadata + replay availability + nav.

Two new APIs: `/api/observatory/calibration-drift` and `/api/observatory/playback/[questionId]`.

Three Observatory pages rewritten from scratch (the old pages had ~2,700 lines of prediction-scoreboard / theory-table / suppressed-question chrome that is all deleted):
- `observatory/index.astro` — overview with insights, arcs, discoveries, calibration drift sparkline, entries table with metadata pills + replay links.
- `observatory/coupling.astro` — paired behavioral + semantic dynamics tables + three coupling tables.
- `observatory/entry/[id].astro` — dual radars (7D + 11D) + metadata pills + full session-summary stat grid + replay CTA.

**Calibration UI slider.** Opt-in target-length toggle in the free-write modal. When enabled: 50–500 word slider + live progress indicator. Choice persists in localStorage. Default OFF — backward compatible.

**Bug fix (real architectural clarification).** `state-engine.ts` and `semantic-space.ts` were not filtering out calibration sessions. Both `loadSessions()` calls now `WHERE q.question_source_id != 3`. Calibrations are the *reference frame*; they should never appear as data points in the behavioral or semantic state vectors. Pre-restructure 8D entry_states had the same pollution — it persisted because nothing relied on the distinction. Now it does.

**Backfill script.** `scripts/backfill-slice3-history.ts`. Idempotent. Recomputes 7D + semantic + per-session-metadata + calibration drift from existing `tb_session_summaries` + `tb_burst_sequences` data. Already run. Result: 3 journal entries → 3 behavioral states + 3 semantic states + 3 metadata rows + 3 calibration baseline snapshots. (Dynamics + coupling need ≥5 entries; will populate naturally.) `tb_session_events` cannot be backfilled — old sessions never captured per-keystroke events.

**db.ts comment hygiene.** Added top-of-file ARCHIVE INDEX block listing every archived table, source-of-archival reason, and migration script. Updated stale `tb_reflections` comment (was "AI-generated pattern reflections"; now correctly described as deterministic structured receipt). Updated `tb_witness_states` comment to flag the slice-3 repurposing direction.

### Commit C — README V20 + V19 audit snapshot

`README.md` rewritten end-to-end. New sections: Why This Architecture, Layer 2.6 (per-session metadata), Calibration target-length slider, Calibration drift, Designer-Facing Observatory, Read-only playback. Updated: Layer 2.5 (calibration-filter clarification), Event-Driven Architecture (new pipeline writes), Architecture / Key Modules (new files), What's Archived (split into slice-1+2 vs slice-3). 390 lines, +26 over V19.

Snapshotted to `README_AUDIT/V20/README.md`. V19 also exists at `README_AUDIT/V19/README.md`.

### Optional Commit D — post-mortem (or leave uncommitted)

`notes/architectural-pivot-postmortem.md` — ~2,400-word drafted post-mortem on the deletion of the interpretive layer. Three-loop circularity argument, GPT-N filter, decorated-confirmation pattern in three-frame analysis. Anthony delegated drafting and explicitly does not care about it; it's preserved as private notes. Not for publication unless/until the new architecture proves itself.

---

## Build status

`npm run build` clean. All schema initializes correctly. Backfill ran successfully after the calibration-pollution bug fix.

## Data status (as of last backfill run)

| Table | Count | Notes |
|---|---|---|
| `tb_responses` | 23 | All journal + calibration text intact |
| `tb_session_summaries` | 22 | 3 journal + 19 calibration |
| `tb_burst_sequences` | 28 | Per-burst data preserved |
| `tb_embeddings` | 26 | Voyage AI vectors intact |
| `tb_calibration_context` | 14 | Sonnet life-context tags |
| `tb_session_delta` | 2 | Same-day deltas |
| `tb_interaction_events` | 363 | High-level event log |
| `tb_entry_states` (NEW 7D) | 3 | One per journal entry |
| `tb_semantic_states` | 3 | One per journal entry |
| `tb_session_metadata` | 3 | Hour typicality + burst shape; deletion-curve null for old sessions |
| `tb_calibration_baselines_history` | 3 | Anchor seed (global + global + desktop) |
| `tb_session_events` | 0 | Cannot backfill; populates from new submissions |
| `tb_trait_dynamics` / `tb_coupling_matrix` | 0 | Need ≥5 entries |
| `tb_semantic_dynamics` / `tb_semantic_coupling` | 0 | Need ≥5 entries |
| `tb_emotion_behavior_coupling` | 0 | Need ≥5 entries |
| `zz_archive_*_20260416` (interpretive) | preserved | 9 tables |
| `zz_archive_*_8d_20260416` (PersDyn 8D) | preserved | 3 tables |

---

## Architecture as of now

**Three interlocking systems:**
- **Alice** — writing interface + signal capture (`src/pages/index.astro`).
- **Bob** — interaction layer surfacing today's question. Underspecified; rhyme retrieval scheduled post-joint-embedding.
- **Alice Negative** — repurposed from user-facing aesthetic figure → designer-only coupling-graph / mode-landscape visualization. Renderer still runs; consumer surface is being redesigned. Do not invest further in user-facing witness UI per slice-3 decision.

**On submit (journal):** save response + summary + deletion-event timing + per-keystroke event log → background pipeline (embed for RAG → generate tomorrow's question → render witness state, which now includes computing + persisting both behavioral 7D and semantic 11D states + dynamics + couplings + emotion→behavior coupling, plus per-session metadata).

**On submit (calibration):** save tagged session → fire-and-forget life-context extraction (Sonnet) → calibration-baseline snapshot + drift computation. No interpretation.

**Signal inventory:** ~100 deterministic signals (session, delta, behavioral 7D, semantic 11D, per-session metadata, calibration drift). All in `signal-registry.ts` or the new modules; nothing surfaces to user.

---

## Non-negotiable design principles (unchanged)

1. **Black box sacred.** Never surface response text back at the user.
2. **No signal surfacing to user.** No dashboards, no trend lines, no numerical metrics, no trait floats. The Observatory exists for the designer only.
3. **No future-question reveal.** Tomorrow's question is not visible today.
4. **N=1 by design.** Not a limitation; a chosen scope.
5. **Anti-engagement.** No streaks, notifications, retention mechanics.
6. **GPT-6 filter on every new feature.** If a future frontier model with the same chat transcript could reproduce it, it's commodity. Invest only where the keystroke substrate is load-bearing.
7. **Signal-anchored interpretation only.** Anything an LLM could produce without behavioral-signal evidence is commodity.

---

## Decisions already made (do not relitigate)

1. **Bob's rhyme utterance has retrieval.** Single-query application of the joint-embedding distance function; tap-to-open side-by-side juxtaposition of past and present session. Black box stays intact because the system juxtaposes but does not interpret. Not built yet — gated on joint embedding.
2. **No structural-noticing Bob utterance yet** — ("This session predicts X downstream.") Defer until couplings are validated at N > 5. Brain processes structural-noticing as prediction regardless of framing.
3. **Alice Negative becomes designer-only coupling-graph visualization.** Strict wall against user-facing drift. Existing trait renderer still runs but is deprioritized; new investment goes into Observatory.
4. **Behavioral 7D and semantic 11D kept orthogonal at construction time.** Joint embedding is downstream work, not at-construction work.
5. **Calibration sessions are the reference frame, not data points.** State engines filter `q.question_source_id != 3` at the load-query level. Bug-fixed this session; now load-bearing.
6. **Archived data kept under `zz_archive_*` tables.** Do not drop. Methodology paper may need receipts.
7. **Weekly reflection is a structured receipt, not narrative.** Already implemented in the new `reflect.ts`. No LLM call.
8. **Observatory is designer-facing only.** Do not surface any of it (or anything derived from it) into the user-facing journal flow.
9. **Read-only playback is designer-only initially.** If 30 days of personal use does not erode the black-box guarantee, consider opening it. Not before.
10. **Calibration target-length slider is opt-in, default OFF.** Adds research flexibility without forcing new constraints on existing users.

---

## What's next — in roughly priority order

### Highest information per dollar (Anthony's homework, not code)

**Recruit one other person to do calibration + journal for 30 days.** Most important item in the queue. Everything Alice is calibrated against is *one person's* typing, vocabulary, devices, seed-question landings. The dynamics computations have hidden assumptions that only hold because they've only ever seen one body. Joint embedding will ossify those assumptions if it ships before validation against a second person. Cost: a beer. Information: enormous. Do this *before* the joint-embedding sprint.

### Pre-registration exercise (Anthony's homework)

Before touching the joint-embedding distance function, hand-write 10 sessions you remember well with their remembered-rhyme pairs and the *why* for each. This is the feature-importance prior. Without it, the distance metric is just `cosine(concat(7D, 11D))` against nothing.

### Sprint A — Joint embedding + distance function

Gated on pre-registration list + ≥14 days of friend's data.
- Concat behavioral 7D + semantic 11D + selected per-session metadata coordinates.
- Cosine similarity baseline.
- Validate against pre-registered rhyme pairs.
- Learned metric (e.g., Mahalanobis with diagonal weights from pre-reg) only if simple cosine fails.

### Sprint B — Rhyme retrieval (Bob's first utterance)

Single-query application of the joint-embedding distance. On submit, find closest past session, surface "this rhymes with [date]" with tap-to-open side-by-side view. Black box intact: system juxtaposes, does not interpret.

### Sprint C — Archive query layer (designer-only)

General-case of rhyme retrieval. Designer-facing query surface over the joint space ("find sessions where my body was calm but my content was spiraling"). Pre-canned filters first; consider natural-language → joint-space search later. Designer use only for at least 30 days before any user-facing surface is even considered.

### Sprint D — Mode clustering scaffolding

k-means or HDBSCAN on joint embedding. Don't run yet; validate on synthetic. Triggers at N ≥ 20 (across both subjects).

### Sprint E — First real clustering pass + LLM mode-naming on cluster representatives

Coupling graph visualization for designer becomes interpretable.

### Background — research moves (not code)

- **Coffee chat with Giancardo (UTHealth, neuroQWERTY).** Cheap, methodology-mentor conversation. No commitment.
- **Email Boyd (UT Dallas, LIWC) re: collaboration on the 4 schema-ready LLM-extracted semantic dimensions.** Worth one email.
- **Cold email Flanagan (UT Health San Antonio, Nun Study) — but only after methodology paper draft exists.** The contrast pitch ("retrospective autopsy-confirmed vs. prospective instrument-based") only works if you can show how. Have the artifact ready.

### Eventual — calibration-as-independent-longitudinal-corpus analysis

Becomes a methodology paper section at N ≥ 90 calibration sessions. Pure analysis pass on `tb_questions WHERE question_source_id = 3` text. Within-subject longitudinal idea-density / linguistic-complexity trajectory on structurally-controlled mundane prose. Nothing Nun Study can do.

### Hard-deferred (do not pursue)

- Cross-modality (voice / handwriting capture) — different substrate, defer until joint embedding works for keystrokes on two people.
- Device-matched-baselines refinement at high N — methodology-paper claim, not engineering work.
- Generative counterfactual ("project past-self writing today's question") — exactly the LLM-narrated layer just deleted, in costume. Pass.
- Open-sourcing the signal pipeline — gives away the moat. Pass.
- All clinical / consumer / B2B product framings (therapy augmentation, cognitive-gift, exec coaching, $99 fingerprint cert, IDE plugin). Considered and declined.
- Writing-as-meditation / Headspace positioning — would dilute the philosophy, not just the clinical narrative. Pass.
- Pair journaling — violates N=1 + anti-engagement. Pass.

---

## Smoke-test path (before commit)

```bash
npm run dev
# 1. Submit a daily question. Verify done message renders.
# 2. Check db:
sqlite3 data/alice.db "SELECT response_id FROM tb_entry_states ORDER BY entry_state_id DESC LIMIT 1;"
sqlite3 data/alice.db "SELECT response_id FROM tb_semantic_states ORDER BY semantic_state_id DESC LIMIT 1;"
sqlite3 data/alice.db "SELECT question_id, deletion_curve_type, burst_trajectory_shape FROM tb_session_metadata ORDER BY session_metadata_id DESC LIMIT 1;"
sqlite3 data/alice.db "SELECT total_events, session_duration_ms FROM tb_session_events ORDER BY session_event_id DESC LIMIT 1;"
# 3. Free-write a calibration. Verify drift snapshot:
sqlite3 data/alice.db "SELECT calibration_session_count, device_type, drift_magnitude FROM tb_calibration_baselines_history ORDER BY calibration_history_id DESC LIMIT 3;"
# 4. Hit the Observatory:
#    /observatory                 — overview with arcs / discoveries / drift sparkline / entries table
#    /observatory/coupling        — dynamics tables (will say "insufficient" until N≥5)
#    /observatory/entry/<id>      — dual radars + metadata pills + session summary
#    /observatory/replay/<qid>    — for the entry just submitted: play / pause / scrub / speed
```

Do not commit until at least one new journal session populates the new tables and the Observatory pages render without 500s.

---

## Commit message drafts

### Commit A (slices 1+2+3)

```
refactor: remove interpretive layer, split PersDyn into behavioral 7D + semantic 11D

slice 1: archive 9 interpretive-layer tables to zz_archive_*_20260416
  (predictions, theories, observations, suppressed questions, candidates,
  supporting enums). Stub the called surfaces.

slice 2: delete observe.ts, grader.ts, theory-selection.ts, surface-patterns.ts,
  simulate-v1.ts (~1,830 lines). Rewrite reflect.ts as deterministic structured
  receipt. Prune generate.ts and signals.ts.

slice 3: pull `expression` from PersDyn. behavioral 7D persists to
  tb_entry_states; new parallel semantic 11D persists to tb_semantic_states
  (schema-ready for 4 LLM-extracted dims). dynamics.ts generic over a dim
  list, runs on each space separately. Archive 8D vectors to
  zz_archive_*_8d_20260416. signal-families lexical/pennebaker move to
  semantic-feeding (state-engine ablation no-op).

rationale: predict-and-grade on N=1 self-built data has three-loop
circularity (designer = subject = stimulus source) that deterministic
grounding doesn't fix. text-only narrative is commoditizable by future
frontier models. behavioral keystroke substrate + parallel semantic ND
is the moat; orthogonal at construction so joint-embedding work downstream
remains meaningful. see notes/architectural-pivot-postmortem.md.
```

### Commit B (slice-3 follow-ups + observatory rebuild)

```
feat: slice-3 follow-up signals, Observatory rebuild, read-only playback,
       calibration drift, target-length slider, calibration-filter bug fix

new modules:
  src/lib/session-metadata.ts — hour typicality, deletion-density curve,
    burst trajectory shape, inter-burst rhythm, burst-deletion proximity
  src/lib/calibration-drift.ts — z-norm L2 drift on baseline snapshots,
    designer-facing health metric on the reference frame itself

new schema:
  tb_session_metadata, tb_calibration_baselines_history, tb_session_events
  + deletion_events_json column on tb_session_summaries (idempotent migration)

bug fix: state-engine + semantic-space were not filtering out calibration
  sessions. Both load queries now WHERE q.question_source_id != 3.
  Calibrations are the reference frame, not data points within it.

read-only playback: per-keystroke event log captured client-side,
  persisted to tb_session_events, replayed at /observatory/replay/[qid]
  with play/pause/scrub/speed controls.

observatory: deleted src/lib/sim-db.ts. Rewrote 4 APIs against live
  alice.db. Added 2 new APIs (calibration-drift, playback). Three pages
  rewritten end-to-end around the new architecture. No prediction/theory/
  suppressed-question chrome anywhere.

calibration UI: opt-in target-length slider in free-write modal,
  default OFF, persists in localStorage.

backfill: scripts/backfill-slice3-history.ts (idempotent). Recomputed
  3 journal entries into the new tables.

db.ts comment hygiene: top-of-file ARCHIVE INDEX block; corrected stale
  tb_reflections comment; flagged tb_witness_states slice-3 repurposing.
```

### Commit C (README V20 + V19 snapshot)

```
docs: README V20 — Layer 2.6 metadata, calibration drift, Observatory,
      playback, slider, calibration-filter clarification

V20 snapshotted to README_AUDIT/V20/README.md (V19 also preserved).
```

### Optional Commit D (post-mortem)

```
docs: drafted architectural-pivot post-mortem (private notes)

notes/architectural-pivot-postmortem.md — three-loop circularity argument,
GPT-N filter, decorated-confirmation pattern. Not for publication.
The new architecture has to prove itself first.
```

---

## Gotchas

- `voyageai` in `embeddings.ts` has a CJS-in-ESM type issue. Existing workaround uses `createRequire`. Do not touch unless fixing type errors there specifically.
- `tb_reflections` table is retained. The structured receipt still writes to it; embeddings consume it for RAG resurfacing at generation time. Do not assume it's orphaned.
- `data/alice.db` has real data (Anthony's day-1 through day-3 sessions + 19 calibrations + archived tables). Do not `rm` it. Do not re-run migrations — they're idempotent but there's no reason to.
- `CLAUDE.md` says "no ALTER TABLE" — but additive `ADD COLUMN` migrations have established precedent in db.ts (4 such blocks); the rule is about destructive ALTERs, not backfill columns. The slice-3 archive script uses RENAME TABLE — a one-time exception, do not generalize.
- `STATE_DIMENSIONS` in `state-engine.ts` is imported by `signal-registry.ts` to programmatically generate `dynamics.{dim}.{param}` entries. Changing it ripples through the registry automatically. The semantic-space module exports its own `SEMANTIC_DIMENSIONS` analogously.
- `tb_session_events` cannot be backfilled. Replay only works for sessions submitted after slice-3 ships. This is permanent; old sessions never had per-keystroke capture.
- The Observatory reads from live `data/alice.db`, not the simulation DB (which was deleted along with `src/lib/sim-db.ts`). If you re-introduce simulation work, do not point Observatory at it; use the simulate runner against the main db with appropriate isolation.
- `tb_witness_states` is still being written on every journal submit because the renderer hasn't been ripped out. Per slice-3 decision the visual rendering is being repurposed, but the table and writer still operate. Don't delete; don't extend the user-facing witness UI either.

---

## The thing to hold in mind

The project's telos is daily practice, primary. Dataset + methodology paper are durable byproducts. Do not invert these. Do not propose consumer-product, clinical-instrument, or company-pivot framings — those were considered and declined. If a new feature doesn't survive the GPT-6 filter and doesn't serve the practice, it doesn't ship.

The substrate is the work. Everything that survives — keystroke pipeline, parallel orthogonal dynamics, calibration drift, Inputlog-style playback, joint-embedding rhyme retrieval — is something a transcript-only frontier model cannot reproduce. Everything that was deleted was something a frontier model could reproduce trivially. The architectural test is not "is this useful" but "does this require the substrate, or could a chat-only model do it." If the answer is the latter, it's commodity; defer or skip.

Anthony's role at this point is to write daily, recruit a second person, hand-write the pre-registration list, and resist the temptation to add interpretive layers back. The system's role is to capture, compute, juxtapose, and surface to the designer through an Observatory the user never sees. The system measures, retrieves, juxtaposes. It does not narrate.
