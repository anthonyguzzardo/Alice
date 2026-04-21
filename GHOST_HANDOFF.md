# Handoff: The Ghost (2026-04-20, Session 3)

## What happened this session

Cross-sectional examination of the entire project (papers, pages, data pipeline, avatar engine) revealed 10 hidden upside potentials living in the gaps between systems. The single largest: the avatar and signal pipeline had never touched each other. They do now. The reconstruction residual pipeline was designed and built in full. Your statistical ghost writes next to you starting with the next journal entry.

This might be the most important day of the entire project.

## What was built

### The Reconstruction Residual Pipeline

After every journal and calibration session, Alice now:
1. Generates a ghost response for the same question (Markov chain + motor profile)
2. Runs the signal pipeline on the ghost's keystroke stream
3. Computes the delta between real and ghost signals per family
4. Computes Markov perplexity of both texts against the corpus model
5. Stores per-signal triplets (real, ghost, residual) + L2 norms + PE spectrum residual

The residual is what the ghost gets wrong. Everything it gets right is pattern. Everything it gets wrong is cognition.

### Files created

| File | What |
|------|------|
| `src/lib/libReconstruction.ts` | Core module: `computeReconstructionResidual(questionId)` orchestrates ghost generation, signal comparison, residual computation |
| `db/sql/migrations/005_add_reconstruction_residuals.sql` | New table with 17 signal triplets, perplexity comparison, PE spectrum JSONB, L2 norms |
| `GHOST.md` | Design document explaining the full system |

### Files modified

| File | Change |
|------|--------|
| `src/lib/libSignalsNative.ts` | Wired `generateAvatar()` and `computePerplexity()` from Rust FFI into TypeScript. Added `PerplexityResult` and `AvatarResult` interfaces. |
| `src/lib/libSignalPipeline.ts` | Reconstruction runs as final stage after `updateProfile()`. Both respond.ts and calibrate.ts get it automatically. |
| `src/lib/libDb.ts` | Added `ReconstructionResidualInput` type, `saveReconstructionResidual()`, `getReconstructionResidual()` |
| `db/sql/dbAlice_Tables.sql` | Added `tb_reconstruction_residuals` to schema file |

### Verified

- Migration applied: `CREATE TABLE` + `COMMENT` clean
- Astro build: `Complete!` with zero new errors
- Table structure confirmed in database (67 columns)

---

## What was NOT built yet (the remaining 9 potentials)

Everything below comes from the cross-sectional analysis in `HIDDEN_UPSIDE.md`. Potential #1 (reconstruction residual) is done. The rest are ordered by leverage.

### IMMEDIATE: Backfill existing sessions

**Priority: Do this first. Before anything else.**

Write a script (`scripts/backfill-reconstruction.ts`) that iterates over all existing question_ids with signal data, runs `computeReconstructionResidual(questionId)` on each. This gives you a residual trajectory from day one instead of waiting for new entries. The function is idempotent (skips if row exists). Needs >= 3 entries in corpus to produce data.

### IMMEDIATE: Observatory integration

The residuals go into a table nobody can see yet. Surface them in the observatory:
- Convergence trajectory: `total_l2_norm` over time (should decrease, then plateau)
- Per-family norms: dynamical vs motor vs semantic L2 over time
- Calibration vs journal gap: split by `question_source_id` (3 = calibration, 1/2 = journal) to show the cognitive contribution
- Perplexity comparison: real vs ghost perplexity over time
- PE spectrum heatmap: per-order residuals across sessions

Consider adding `question_source_id` to the residual table to avoid JOIN for this split.

### IMMEDIATE: Source column on residual table

Add `question_source_id SMALLINT` to `tb_reconstruction_residuals` so calibration vs journal filtering is trivial. Small migration, big query convenience.

---

### MEDIUM: Two-scale perplexity tracking (Potential #2)

Two independent perplexity measures exist and never talk:
- **Cross-session** `selfPerplexity` in `libCrossSessionSignals.ts:83`: character-trigram model, measures how novel today's text is relative to all prior texts
- **Ghost** `real_perplexity` in `tb_reconstruction_residuals`: word-level Markov with Absolute Discounting, measures generative model fit

Their divergence is meaningful. If trigram perplexity stays flat but Markov perplexity rises, the person uses familiar characters in unfamiliar word sequences. If Markov perplexity drops faster, the word model overfits to surface patterns.

**Work needed:** Observatory panel showing both perplexities over time. The data already exists in two tables; this is a visualization/query task.

### MEDIUM: Transfer entropy as falsifiable reconstruction test (Potential #3)

TE dominance (hold-to-flight vs flight-to-hold causality) is already stored as `residual_te_dominance` in the reconstruction table. The ghost synthesizes timing with content-process coupling, but genuine cognitive-motor coupling is more complex.

**Work needed:** Track `residual_te_dominance` stability across sessions. If it's consistent within-person but the absolute value is non-zero, you've isolated a signal irreducible to statistical patterns. This is a novel claim for the Reconstruction Validity paper. Observatory panel + paper section.

### MEDIUM: Calibration as publishable psychometric innovation (Potential #4)

The within-day calibration design (neutral prompt before journal, same-day delta) eliminates most confounds in longitudinal behavioral studies. No existing keystroke study uses same-day baselines.

**Work needed:** Mostly a paper argument, not code. The data infrastructure exists (`tb_calibration_context`, `tb_session_delta`, `tb_calibration_baselines_history`). The reconstruction residual now adds the calibration-vs-journal residual gap. Write this up as a standalone methodological contribution or weave it into the Closing Window paper.

### MEDIUM: PE spectrum fingerprinting (Potential #5)

PE spectrum (orders 3-7) residual is already stored as `residual_pe_spectrum` JSONB in the reconstruction table. The ghost's timing synthesis operates at the individual-event level, not the multi-scale structure level.

**Work needed:** Visualize per-order residuals across sessions. The spectral shape of the residual is a higher-dimensional cognitive fingerprint. Observatory panel showing 5 lines (one per order) over time.

---

### LARGER: Adaptive cognitive challenge protocol (Potential #6)

Question generation already classifies complexity and adjusts difficulty (Bjork & Bjork). Track the relationship between question difficulty and response signal richness (residual magnitude, PE complexity, semantic depth) to build a dose-response curve for cognitive engagement.

**Work needed:** Extend `libGenerate.ts` to log difficulty classification in `tb_prompt_traces`. Build observatory panel correlating difficulty with residual magnitude. This turns Alice from a measurement instrument into a cognitive training instrument.

### LARGER: Emotion-behavior coupling as AI detector (Potential #7)

`tb_emotion_behavior_coupling` stores how NRC emotions correlate with behavioral dimensions per person. How your emotions affect your typing is personal and not reproducible by mediated input.

**Work needed:** Compare real emotion-behavior coupling to ghost emotion-behavior coupling. If the ghost shows no coupling (it shouldn't, since its emotional content is random), the coupling itself becomes a construct replacement detector. Surface in observatory + write up for Construct Replacement paper.

### LARGER: Profile-based mediation detection (Potential #8)

`tb_personal_profile` is a complete behavioral biometric template. Incoming keystroke streams diverging from the stored profile could flag construct replacement in real time.

**Work needed:** Real-time comparison layer. On session submission, compute a profile-match score before running the full pipeline. Flag sessions that fall outside N standard deviations of the profile. This is the practical implementation of the Construct Replacement paper's thesis.

### LARGER: Research page live metadata (Potential #9)

The research page argues the theoretical case. The instrument produces data against those arguments. They barely cross-reference.

**Work needed:** API endpoint returning instrument metadata (session count, signal families active, reconstruction convergence status, days of continuous data). Research page pulls this on load. Never surfaces user data, only instrument statistics.

### ONGOING: Longitudinal DFA dataset (Potential #10)

DFA alpha is already captured daily. Over months and years, this becomes the first longitudinal keystroke DFA time series in the literature. No code needed. Just time. The infrastructure is already running.

**Work needed (eventually):** Paper describing the dataset and initial trajectory analysis once sufficient data exists (6+ months of daily entries).

---

## Architecture reference

```
src/lib/libReconstruction.ts     -- ghost generation + signal comparison
src/lib/libSignalsNative.ts      -- generateAvatar() + computePerplexity() FFI
src/lib/libSignalPipeline.ts     -- reconstruction as final pipeline stage
src/lib/libDb.ts                 -- save/get reconstruction residuals
src-rs/src/avatar.rs             -- Markov chain + timing synthesis (Rust)
src-rs/src/lib.rs                -- napi boundary
db/sql/migrations/005            -- tb_reconstruction_residuals
```

### Data flow

```
Session submission (journal or calibration)
  |
  v
Signal pipeline (dynamical -> motor -> semantic -> process -> cross-session)
  |
  v
Profile update (rolling behavioral aggregate)
  |
  v
Ghost generation (same question, same profile, Markov + motor timing)
  |
  v
Ghost signal computation (dynamical, motor, semantic on ghost stream/text)
  |
  v
Residual computation (real - ghost per signal, L2 norms, perplexity delta)
  |
  v
tb_reconstruction_residuals (one row per session, 67 columns)
```

## Priority order for next session

1. **Backfill script** -- Run reconstruction on all existing sessions. Immediate data.
2. **Source column** -- Add `question_source_id` to residual table.
3. **Observatory panels** -- Convergence trajectory, per-family norms, calibration vs journal gap, perplexity comparison.
4. **Two-scale perplexity panel** -- Trigram vs Markov perplexity divergence.
5. **PE spectrum visualization** -- Per-order residual heatmap.
6. Then: paper updates, adaptive challenge, emotion-behavior coupling, mediation detection.

## Key documents

- `GHOST.md` -- Design document explaining the full reconstruction residual system
- `HIDDEN_UPSIDE.md` -- The original cross-sectional analysis with all 10 potentials
- `AVATAR.md` -- Avatar engine documentation (updated last session)
- `papers/option_f_draft.md` -- Reconstruction Validity paper (v2)
