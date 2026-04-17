# Simulation Handoff

**Date:** 2026-04-13
**Context:** Major overhaul of Alice's simulation pipeline. Audit found critical flaws in v1, rebuilt as v2 with fixes and two test modes.

---

## What Happened

We audited the v1 simulation (30-day Jordan Chen trial run) and found major flaws:

1. **Prediction blackout** — Single API call in `observe.ts` tried to do 4 jobs (observation, suppressed question, prediction grading, new predictions). Token truncation silently killed predictions for 18/30 days. The learning mechanism was offline for 60% of the simulation.
2. **NULL grading observation IDs** — Predictions were graded before the observation was saved, so `graded_by_observation_id` was always NULL.
3. **Wall-clock timestamps** — SQLite's `datetime('now')` ignored the JavaScript Date monkey-patch. All rows had real April 13 timestamps instead of simulated March dates.
4. **Ghost response** — Resuming with `--start 22` created a duplicate response (31 rows for 30 days), shifting reflection triggers.
5. **`largestDeletion` wrong** — Used total chars across all large deletions, not the max single one.
6. **Deletion halves random** — Revision timing signal (early vs late) was noise. P1 entries should have late-heavy deletions.
7. **Generation never tested** — All 30 questions pre-scheduled, `runGeneration()` was always a no-op.
8. **All times 0.0s** — Timing used `Date.now()` which was monkey-patched. Fixed post-run to use `performance.now()`.

## What We Changed

### Pipeline fixes (production code, affects real journal too):

- **`src/lib/observe.ts`** — Split into two API calls: (1) observation + suppressed question, (2) prediction grading + new predictions. Added `ObservationOptions` with `model` override and `onApiCall` timing callback. Trimmed behavioral signal guide from ~70 lines to ~15.
- **`src/lib/db.ts`** — Added `setDateOverride(dateStr)` / `nowStr()`. Updated all critical save functions to use explicit timestamps. Exported `setDateOverride`.
- **`src/lib/reflect.ts`** — Added `ReflectionOptions` with `primaryModel`, `auditModel`, `onApiCall`.
- **`src/lib/generate.ts`** — Added `GenerationOptions` with `model`, `seedDaysOverride`, `onApiCall`.
- **All three pipeline files** — Timing uses `performance.now()` (immune to Date monkey-patch). Embedding errors downgraded from `console.error` (full stack trace) to `console.warn` (one-liner).

### Simulation fixes:

- **`src/scripts/simulation-data.ts`** — Fixed `largestDeletion` calc, made deletion halves pattern-driven (P1=late-heavy, P4=early-heavy), added `patterns` parameter to `buildSessionSummary`.
- **`src/scripts/simulate.ts`** — New v2 runner with two modes. Old version preserved as `simulate-v1.ts`.
- **`data/sim-reports/`** — Auto-versioned markdown reports after every run.

## Current State

### v2 Mechanics Run (Haiku, 10 days, $0.48)

**Report:** `data/sim-reports/sim-v2-mechanics-2026-04-13.md`

**Results:**
- 10/10 observations
- 7/10 suppressed questions (days 8-10 lost — Haiku's observation fills the 4000 token budget, suppressed question gets truncated)
- 20/20 predictions (2 per day, every day — v1 had 8 in 30 days)
- 18/20 predictions graded INDETERMINATE (Haiku too wishy-washy to commit to confirmed/falsified)
- 0 theory confidence updates (Bayesian engine never fired because nothing was confirmed/falsified)
- 1/1 reflection triggered
- 3 generation calls (days 8-10, seed threshold override working)
- All timestamps correct (simulated dates)
- graded_by_observation_id populated on all graded predictions (was NULL in v1)
- Timing all 0.0s (Date.now() bug — fixed for next run with performance.now())

### Open Issues

1. **Suppressed question truncation on late days** — Observation output grows as context grows. By day 8 with Haiku, observation fills the token budget and suppressed question disappears. Options:
   - Add conciseness instruction to observe prompt
   - Split into three calls (observation, suppressed question, predictions) — expensive
   - Accept as Haiku limitation, verify with Sonnet
   
2. **INDETERMINATE grading** — Haiku grades everything indeterminate. Theory confidence engine is starved. Need Sonnet or Opus for decisive grading. The mechanics work; the model just isn't strong enough.

3. **Long-range memory** — Observations use a sliding window of 7. Old observations drop off. RAG covers semantic similarity. Reflections compress weekly. But there's no persistent "running model" document that carries forward the system's full understanding. This is a future feature, not a simulation fix.

## How to Run

```bash
# Mechanics test — Haiku, 10 days, ~$0.50, validates pipeline
npm run simulate

# Quality test — Sonnet, 15 days, ~$3-4, scores against ground truth
npm run simulate -- --quality

# Dry run — data only, no AI calls, no cost
npm run simulate -- --dry-run

# Resume from day N
npm run simulate -- --start 5

# Quality + embeddings
npm run simulate -- --quality --embed
```

Reports auto-generate to `data/sim-reports/sim-v{N}-{mode}-{date}.md`.

## Next Steps

1. **Run quality mode** (`npm run simulate -- --quality`) to see if Sonnet produces better grading and keeps suppressed questions alive through all 15 days.
2. **Fix suppressed question truncation** if it persists with Sonnet — add conciseness instruction or split further.
3. **Add calibration entries** to simulation data (neutral "describe your morning" entries) so Frame C has a baseline. Currently Frame C is decorative.
4. **Build "running model" document** — persistent summary updated after each reflection, carried forward into every observation. Closes the long-range memory gap.
5. **Consider conciseness instruction in observe prompt** — something like "Keep observation under 2500 tokens. Be precise, not exhaustive."

## Key Files

| File | What it does |
|------|-------------|
| `src/lib/observe.ts` | Two-call observation pipeline (observe + predict) |
| `src/lib/reflect.ts` | Weekly reflection with Sonnet audit |
| `src/lib/generate.ts` | Question generation with seed threshold override |
| `src/lib/db.ts` | Database with `setDateOverride()` for simulation timestamps |
| `src/scripts/simulate.ts` | v2 simulation runner (mechanics + quality modes) |
| `src/scripts/simulate-v1.ts` | Old runner, preserved for reference |
| `src/scripts/simulation-data.ts` | 30 Jordan Chen entries with ground truth patterns |
| `data/sim-reports/` | Auto-versioned simulation reports |
| `simulation-postmortem.md` | Original v1 post-mortem (pre-audit) |
