# Handoff: The Ghost (2026-04-20, Sessions 3-4)

## What happened

Session 3 built the reconstruction residual pipeline. Session 4 brought it to life: backfilled all existing sessions, built the observatory page, wired live metadata into the research page, and added two-scale perplexity and TE dominance stability analysis.

The ghost is running. The research page and the instrument are now visibly the same project.

## What was built (Session 4)

### Migration 006: source column
- Added `question_source_id SMALLINT` to `tb_reconstruction_residuals`
- Schema file updated, type/save function updated, `libReconstruction.ts` looks up and passes source ID
- Calibration (3) vs journal (1/2) filtering is now a direct column lookup

### Backfill script
- `src/scripts/backfill-reconstruction.ts`: iterates all question_ids with signal data, runs `computeReconstructionResidual()` on each
- 20/20 sessions backfilled, zero failures
- Idempotent (skips existing rows, ON CONFLICT DO NOTHING)

### L2 norm fix
- `libReconstruction.ts`: `l2()` and `residualCount` now exclude non-finite values (Infinity, NaN)
- Avatar produces Infinity TE dominance on ~40% of sessions (zero flight-to-hold TE). These are honest measurement failures, not signal magnitudes.

### Ghost in the Shell observatory page
- **Page**: `src/pages/observatory/ghost.astro`
- **API**: `src/pages/api/observatory/ghost.ts`
- **Nav**: ghost link added to all observatory pages (index, trajectory, coupling, entry)

Page sections:
1. KPI row (latest/mean total L2, journal/calibration means, perplexity averages)
2. Convergence trajectory (total L2 norm over sessions)
3. Per-family norms (dynamical, motor, semantic L2 as three charts)
4. Calibration vs journal split (dot plot by source type)
5. Perplexity (real vs ghost Markov + two-scale trigram divergence + ratio chart)
6. PE spectrum residual (5 lines, orders 3-7)
7. TE dominance stability (residual + real TE over sessions, KPI strip with mean/stddev/CV)
8. Per-signal residual table (latest session breakdown, color-coded)

### Research page live metadata
- **API**: `src/pages/api/instrument-status.ts` (instrument-only statistics, never surfaces user data)
- **Integration**: Research page reconstruction validity section now shows measured values alongside predictions on the three residual cards + instrument status strip
- Motor: Expected small, Measured L2 = 90.0
- Content: Expected decreasing, Measured perplexity gap = -57.2
- Cognitive: Expected persistent, Measured total L2 = 52.4
- Strip: 30 days active, 54 sessions, 5/5 signal families, 20 reconstruction residuals

## Key findings from the data

**Motor signals dominate the residual.** Dynamical L2 < 1.3, semantic L2 < 0.35, motor L2 ranges 46-144. The ghost can approximate temporal complexity and semantic content but cannot reconstruct motor execution. Motor execution is the signature.

**Ghost perplexity is always higher than real perplexity.** Avg real = 21.3, avg ghost = 78.5. You are more internally consistent than your statistical profile predicts.

**Journal vs calibration gap.** Journal avg L2 = 59.6, calibration avg L2 = 51.1. Cognitive contribution is larger when the question demands depth.

**Two-scale divergence.** Markov perplexity avg = 21.3, trigram avg = 9.0, ratio ~2.4x. Familiar characters in unfamiliar word sequences.

**TE dominance stability.** Mean residual = 0.350, CV = 3.08. Non-zero but high variability. Not yet stable enough for "consistent within-person" paper claim. More sessions will clarify.

**Motor residual challenges the schematic prediction.** The research page predicted motor residual would be "small" (ghost draws from same distributions). Measured = 90.0, the largest family. This means motor execution goes beyond the statistical profile.

## Files created this session

| File | What |
|------|------|
| `db/sql/migrations/006_add_source_to_residuals.sql` | Adds `question_source_id` column |
| `src/scripts/backfill-reconstruction.ts` | Backfill script for reconstruction residuals |
| `src/pages/observatory/ghost.astro` | Ghost in the Shell observatory page |
| `src/pages/api/observatory/ghost.ts` | Ghost API endpoint |
| `src/pages/api/instrument-status.ts` | Instrument metadata API for research page |

## Files modified this session

| File | Change |
|------|--------|
| `db/sql/dbAlice_Tables.sql` | Added `question_source_id` to `tb_reconstruction_residuals` CREATE TABLE |
| `src/lib/libDb.ts` | Added `question_source_id` to `ReconstructionResidualInput` type and INSERT |
| `src/lib/libReconstruction.ts` | Looks up `question_source_id`, passes to save. L2 norm excludes non-finite values. |
| `src/pages/observatory/index.astro` | Added ghost nav link |
| `src/pages/observatory/trajectory.astro` | Added ghost nav link |
| `src/pages/observatory/coupling.astro` | Added ghost nav link |
| `src/pages/observatory/entry/[id].astro` | Added ghost nav link |
| `src/pages/research.astro` | Added measured values to residual cards, instrument status strip, fetch script |

## Priority order for next session

### 1. Adaptive cognitive challenge (#6)

Correlate question difficulty with residual magnitude. Does harder questioning produce larger ghosts?

**Work needed:**
- Extend `libGenerate.ts` to log difficulty classification in `tb_prompt_traces`
- **Log raw difficulty signal inputs** (MATTR, cognitive density, whatever feeds the classifier) alongside the final difficulty label. Classifiers change, measurements don't. Losing the inputs means losing the ability to re-analyze with a better classifier without re-running sessions.
- Build observatory panel (on Ghost page or standalone) correlating difficulty with residual magnitude
- Clear predicted direction: harder questions should produce larger residuals if the signals are cognitive

### 2. Emotion-behavior coupling stability (prerequisite for #7)

**Do not build the ghost comparison yet.** The ghost has no emotion-behavior coupling by construction (its emotions are random Markov output). Comparing real coupling to a deliberately-decoupled generator is tautological. It will "fail" because it was built to fail. That is not a finding.

The actual falsifiable claim: real emotion-behavior coupling is stable within-person across sessions. If it is not stable, it is noise, and the ghost comparison is meaningless regardless.

**Work needed:**
- Compute within-person stability of emotion-behavior coupling across sessions using existing `tb_emotion_behavior_coupling` data
- Establish whether coupling is consistent (low CV) or noisy
- Only if stable: proceed to ghost comparison

### 3. Profile-based mediation detection (#8)

Real-time profile-match scoring on session submission. Flag sessions outside N standard deviations.

### 4. Research page live metadata enhancements (#9, ongoing)

The metadata is wired. As new data accumulates and new capabilities come online, the research page will reflect them automatically. No additional code needed unless new metrics are added.

## Architecture reference

```
src/lib/libReconstruction.ts      -- ghost generation + signal comparison + L2 norm
src/lib/libSignalsNative.ts       -- generateAvatar() + computePerplexity() FFI
src/lib/libSignalPipeline.ts      -- reconstruction as final pipeline stage
src/lib/libDb.ts                  -- save/get reconstruction residuals
src/scripts/backfill-reconstruction.ts -- backfill all existing sessions
src/pages/observatory/ghost.astro -- Ghost in the Shell observatory page
src/pages/api/observatory/ghost.ts     -- ghost data API
src/pages/api/instrument-status.ts     -- research page metadata API
src-rs/src/avatar.rs              -- Markov chain + timing synthesis (Rust)
src-rs/src/lib.rs                 -- napi boundary
db/sql/migrations/005             -- tb_reconstruction_residuals
db/sql/migrations/006             -- question_source_id column
```

## Key design decisions

- **Non-finite L2 exclusion**: Infinity TE dominance from avatar is an honest measurement failure. The aggregate norm excludes it, same as null. The per-signal residual preserves the raw value.
- **Two-scale perplexity**: trigram (character-level, cross-session) and Markov (word-level, reconstruction) are independent measures. Their ratio characterizes the scale at which the person's writing is predictable.
- **Tautology guard**: Never frame a ghost comparison as a finding when the ghost is decoupled on that dimension by construction. Establish within-person stability of the real signal first.
- **Raw input logging**: When adding classifiers, always log the raw signal inputs alongside the label. The inputs are the durable asset.
