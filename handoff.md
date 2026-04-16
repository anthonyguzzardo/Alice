# Handoff — April 16, 2026

Pick up here. The prior session executed a major restructure. Slices 1 and 2 are done on disk but **uncommitted**. Slice 3 (and follow-ups) are next.

---

## Read these first, in order

1. `CLAUDE.md` — project conventions (table prefixes, surrogate keys, footer columns, no ALTER TABLE, etc.). Non-negotiable.
2. `ROADMAP.md` — the thesis. The practice that protects your mind is the same one that would detect if something changes.
3. This file — what changed and what's next.
4. `src/lib/signal-registry.ts` — the ~100 deterministic signals, the system's actual moat.

Don't re-read the theory docs (theory-5, 6, 7). They're superseded by the restructure below.

---

## What just shipped (uncommitted)

The entire LLM-narrated interpretive layer was removed. The epistemic case: predict-and-grade on N=1 self-built data has a three-loop circularity (designer = subject = stimulus source) that deterministic grounding doesn't fix. Text-only narrative reflection is commoditizable by any future frontier model. The behavioral signal pipeline (keystroke dynamics, P-bursts, revision topology, calibration deltas) is the actual moat and survives arbitrarily capable future models.

**Slice 1 — data archive + neutralization.** 9 tables renamed to `zz_archive_*_20260416` via `scripts/archive-interpretive-layer-20260416.ts` (idempotent, already run). `tb_predictions`, `tb_theory_confidence`, `tb_ai_observations`, `tb_ai_suppressed_questions`, `tb_question_candidates`, `te_prediction_status`, `te_prediction_type`, `te_grade_method`, `te_intervention_intent`. Schema no longer recreates them. `db.ts` has 24 stub functions returning empty/noop to keep signatures. Five API routes neutralized: `observatory/predictions`, `observatory/entry/[id]`, `observatory/synthesis`, `observatory/coupling`, `health`. `respond.ts` no longer calls `runObservation` or `runReflection`.

**Slice 2 — dead code removal.** Deleted entirely: `src/lib/observe.ts`, `src/lib/grader.ts`, `src/lib/theory-selection.ts`, `src/scripts/observe.ts`, `src/scripts/surface-patterns.ts`, `src/scripts/simulate-v1.ts` (~1,830 lines). `src/lib/reflect.ts` rewritten from ~400 lines to ~90 lines as a deterministic structured-receipt writer (no LLM calls, no narrative). `src/lib/generate.ts` pruned of all prediction/theory/observation/suppressed context. `src/lib/signals.ts` lost `formatOpenPredictions` and `formatPredictionTrackRecord`. `src/scripts/simulate.ts` updated to drop observation pipeline. `package.json` lost `observe` and `reflect` scripts.

**Build:** `npm run build` clean.

**Not done:** frontend pages (`observatory/entry/[id].astro`, `observatory/index.astro`, `coupling.astro`) still contain rendering blocks for predictions/observations/suppressed/theories. They consume empty API responses, so they don't crash — they render empty cards. UX cleanup is pending.

---

## Architecture as of now

**Three interlocking systems, same as before:**
- **Alice** — writing interface + signal capture (`src/pages/index.astro`).
- **Bob** — interaction layer surfacing today's question with conviction. Underspecified; see decisions below.
- **Alice Negative** — designer-facing visualization (decision 3 below): repurposed from user-facing aesthetic rendering to designer-only coupling graph / mode landscape.

**What runs on submit now (`src/pages/api/respond.ts`):**
1. `saveResponse`, `saveSessionSummary`, `saveBurstSequence` — signal capture.
2. Background: `embedResponse` (RAG), `runGeneration` (question for tomorrow), `renderWitnessState` (Alice Negative).
3. **No three-frame analysis. No predictions. No narrative reflection. No suppressed questions.**

**Signal inventory:** ~100 deterministic signals across session / delta / dynamics sources. See `src/lib/signal-registry.ts` — canonical registry. Per-session signals (~52) include timing, production, pauses, deletion decomposition (Faigley & Witte), P-bursts (Chenoweth & Hayes), inter-key intervals (Epp), hold/flight time (Kim), keystroke entropy (Ajilore/BiAffect), revision chains (Leijten & Van Waes), MATTR, NRC emotions, Pennebaker densities, sentence metrics, scrollback. Delta signals (~11) via same-day calibration control. Dynamics signals (~42) from the 8D PersDyn engine in `src/lib/alice-negative/state-engine.ts`.

**What the LLM still does:**
- Question generation (`generate.ts`) — for tomorrow, conditioned on recent entries + RAG + behavioral signals + dynamics. After day-30 seed phase.
- Witness rendering (`render-witness.ts`) — Alice Negative visual.
- That's it. ~80% of prior LLM footprint is gone.

---

## Non-negotiable design principles

These are chosen positions, not defaults. Do not propose alternatives.

1. **Black box sacred.** The system never surfaces response text back at the user. Ever.
2. **No signal surfacing to user.** No dashboards, no trend lines, no numerical metrics, no trait floats.
3. **No future-question reveal.** One question per day. Tomorrow's is not visible today.
4. **N=1 by design.** Not a limitation. A chosen scope.
5. **Anti-engagement.** No streaks, notifications, retention mechanics.
6. **GPT-6 filter on every new feature.** If a future frontier model with the same chat transcript could reproduce it, it's commodity. Invest only where the keystroke substrate is load-bearing.
7. **Signal-anchored interpretation only.** Any LLM output that could read the same without behavioral signal evidence goes in the commodity zone. Rework or cut.

---

## Decisions already made (do not relitigate)

1. **Bob's rhyme utterance has retrieval.** At submit, Bob will say "this rhymes with [date]" with a tap-to-open affordance opening both responses side by side. Not built yet. The black box stays intact because *the system* still says nothing about what either session means — it just juxtaposes.
2. **No structural-noticing Bob utterance yet.** ("This session's position predicts X downstream.") Defer until couplings are validated at N > 5. Risk: brain processes it as prediction regardless of framing.
3. **Alice Negative becomes designer-only coupling-graph visualization.** Strict wall against user-facing drift.
4. **Expression pulled out of PersDyn.** 7D behavioral (fluency, deliberation, revision, commitment, volatility, thermal, presence). Expression moves into a parallel first-class semantic space along with NRC, Pennebaker, and future LLM-extracted features. This is slice 3 work.
5. **Archived data kept under `zz_archive_*_20260416`.** Do not drop. Methodology paper may need receipts of what the old architecture attempted.
6. **Weekly reflection is a structured receipt, not narrative.** Already implemented in the new `reflect.ts`. No LLM call. No comparisons-to-goals, no trends, no interpretation.

---

## Next up — slice 3 (7D PersDyn + semantic space)

This is the substantial architectural change. Do not skip to signal additions until this is done — the joint embedding quality depends on behavioral and semantic spaces being orthogonal at construction time.

**Files that must change:**
- `src/lib/alice-negative/state-engine.ts` — remove expression from the 8D array, recompute convergence over 7D. `STATE_DIMENSIONS` becomes 7.
- `src/lib/alice-negative/dynamics.ts` — coupling discovery runs over 7 dimensions.
- `src/lib/signal-registry.ts` — `DYNAMICS_PER_DIM` generated from the new 7.
- `src/lib/signals.ts` — `formatDynamicsContext` dimension labels.
- Any consumer that reads the 8D vector (trajectory page, observatory entry page, Alice Negative renderer).

**New file to create:** `src/lib/semantic-space.ts` — parallel structure to state-engine. Inputs: expression components (avgSentenceLength, questionDensity, firstPersonDensity, hedgingDensity), NRC emotion densities, Pennebaker densities, and LLM-extracted features (sentiment, abstraction, agency framing, temporal orientation — placeholder for now, schema-ready). Outputs: semantic state vector z-scored against personal history. Same treatment as behavioral: baselines, attractor force, coupling-discoverable.

**Key engineering question:** how to extract the LLM-based semantic features cheaply. Probably one call per submit, structured output schema, Haiku. Defer the actual LLM feature extraction until after the orthogonal space is stood up — the schema can be populated from NRC + Pennebaker alone for now.

**Phase classification, systemEntropy, velocity** all recompute over 7D (or 7D + semantic, if doing combined). Decide: run phase/entropy/velocity separately on behavioral vs semantic spaces, or on the concatenated joint space? My instinct: separately. Joint space is for the distance-function work later.

---

## Then, in order

**Week 1–2: Signal additions (pure pipeline, no LLM).** Build into the clean 7D architecture:
- Deletion-density curve classification over session time (early-loaded / late-loaded / uniform / bimodal / terminal-burst). Use the existing `deletionTimestamps[]` which is collected but only binarized at midpoint.
- Burst trajectory shape classification (monotonic up / down / U / inverted-U / flat) from `tb_burst_sequences`.
- Burst rhythm metric: inter-burst interval distribution, separate from `avgPBurstLength`.
- Burst-deletion proximity: deletions during bursts vs. between bursts.

Decision already made: these live as session metadata, feed joint embedding, do not perturb 7D z-score discipline.

**Week 2 (parallel): Pre-registration exercise.** Before touching distance-function code, Anthony hand-writes 10 sessions he remembers well with their remembered-rhyme pairs and the "why" for each. This is the feature-importance prior for the distance metric. Prepare the template document but this is Anthony's homework, not yours to fill in.

**Week 2–4: Joint embedding + distance function.** Simple concat(behavioral 7D, semantic ND) + cosine first. Validate against the pre-registered list. Learned metric only if simple fails.

**Week 4–8: Mode clustering scaffolding.** k-means or HDBSCAN on joint embedding. Don't run yet; validate on synthetic. Triggers at N ≥ 20.

**Week 8+: First real clustering pass + mode naming by LLM on cluster representatives. Coupling graph visualization for Anthony becomes interpretable.**

**Ongoing: systemEntropy regime-change analysis.** Log weekly, look at it.

---

## Frontend cleanup — pending, not blocking

Three `.astro` pages still render blocks for predictions/observations/suppressed/theories:
- `src/pages/observatory/entry/[id].astro` — three-frame cards, prediction cards, suppressed block
- `src/pages/observatory/index.astro` — prediction scoreboard, theory table, prediction/suppressed in entry loop
- `src/pages/observatory/coupling.astro` — theory heatmap

They currently render empty. Clean them up when doing slice 3 or any adjacent work; no rush.

---

## Commands

```bash
# Verify build
npm run build

# Dev server
npm run dev

# Inspect archived tables
sqlite3 data/alice.db ".tables zz_archive_%"

# Force-regenerate tomorrow's question (after day-30 threshold)
npm run generate

# Simulation (dev/research only)
npm run simulate
```

---

## Uncommitted changes

Anthony is testing before committing. When ready, slices 1+2 make one clean commit:

```
refactor: remove interpretive layer (three-frame, prediction, theory, narrative reflection)

- archive 9 tables to zz_archive_*_20260416 (data preserved)
- delete observe.ts, grader.ts, theory-selection.ts (~1,830 lines)
- rewrite reflect.ts as deterministic structured receipt (no LLM)
- prune generate.ts and signals.ts of prediction/theory context
- neutralize 5 API routes; remove runObservation/runReflection from respond.ts
- signal pipeline, PersDyn, calibration, session deltas, witness rendering intact

rationale: LLM-narrated interpretation on N=1 self-built data has a
three-loop circularity that deterministic grounding doesn't fix, and the
text-only narrative layer is commoditizable by future frontier models.
the behavioral signal substrate is the moat. see handoff.md.
```

Do not commit without testing: `npm run dev`, submit a session, verify no 500s.

---

## Gotchas

- `voyageai` in `embeddings.ts` has a CJS-in-ESM type issue. Existing workaround uses `createRequire`. Do not touch unless you're fixing type errors there specifically.
- `tb_reflections` table is retained. The structured receipt still writes to it. Do not assume it's orphaned.
- `data/alice.db` has real data (Anthony's day-1 through day-3 sessions + archived tables). Do not `rm` it. Do not re-run the migration — it's idempotent but there's no reason to.
- `CLAUDE.md` says "no ALTER TABLE" — except the archive migration uses it to rename tables. One-time migration, acceptable departure. Don't generalize.
- The `STATE_DIMENSIONS` constant in `state-engine.ts` is imported by `signal-registry.ts` to programmatically generate `dynamics.{dim}.{param}` entries. Changing it from 8 to 7 ripples through the registry automatically — but double-check anything that hard-codes dimension names.

---

## The thing to hold in mind

The project's telos is daily practice, primary. Dataset + methodology paper are durable byproducts. Do not invert these. Do not propose consumer-product, clinical-instrument, or company-pivot framings — those were considered and declined. If a new feature doesn't survive the GPT-6 filter and doesn't serve the practice, it doesn't ship.
