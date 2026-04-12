# Handoff — April 12, 2026

## Two Parallel Sessions

Two agents worked on Marrow today. One built the Marrow-side linguistic density pipeline and per-burst capture. The other overhauled Bob's entire architecture from LLM-as-interpreter to a deterministic behavioral dynamics engine. The work converged: the linguistic densities computed by the first agent feed into the emotion profile layer built by the second.

---

## Session 1: Linguistic Density Pipeline + Per-Burst Capture

### What Was Built

**Per-burst sequence capture** — the frontend now tracks timing per burst (character count, duration, start offset) and sends the full array to the server. New `tb_burst_sequences` table stores each burst individually. Previously, burst data was averaged to a single `avg_p_burst_length` at submit time and the sequence was discarded. Every session from April 13 onward captures the within-session temporal structure needed for Baaijen & Galbraith (2012) knowledge-transforming signature detection.

**NRC Emotion Lexicon integration** — downloaded and parsed the NRC Emotion Lexicon v0.92 (Mohammad & Turney, 2013; National Research Council Canada). 6 emotion categories (~6,660 words): anger, fear, joy, sadness, trust, anticipation. Stored as TypeScript `Set`s in `src/lib/bob/nrc-emotions.ts`.

**Linguistic density computation** — new module `src/lib/linguistic.ts` computes 9 word category densities in a single pass: 6 NRC emotions + cognitive mechanism words (Pennebaker) + hedging language + first-person pronouns. All computed server-side from response text at save time.

**Database wiring** — 9 new `REAL` columns on `tb_session_summaries` for the density values. Migration block handles existing databases. Both `respond.ts` and `calibrate.ts` compute and persist densities.

**Signal formatting** — new "LINGUISTIC PROFILE" section in observation prompts (deep verbalized with percentile context). Compact emotion notation in generation/reflection prompts. Enables incongruence detection (emotional word profile mismatched with content) and cross-session slope tracking.

**Backfill** — all 17 existing sessions (3 journal + 14 calibration) backfilled with linguistic densities.

**Re-ran April 12 observation** — cleared the old observation and re-ran with the full linguistic pipeline. Key improvement: the AI detected emotional incongruence (zero anger words in an entry about cutting off a family member, high trust/joy that's incongruent with content). Also used calibration-relative deviation ("27% below calibration baseline" instead of just "0th percentile"). Sharper suppressed question. More specific falsifiable predictions.

### Files Modified
- `src/pages/index.astro` — per-burst timing capture in frontend
- `src/lib/db.ts` — `tb_burst_sequences` table, 9 density columns, migration, CRUD functions
- `src/pages/api/respond.ts` — computes densities, saves burst sequences
- `src/pages/api/calibrate.ts` — computes densities for calibration
- `src/lib/observe.ts` — updated fallback SessionSummaryInput
- `src/lib/signals.ts` — linguistic profile section in prompts

### New Files
- `src/lib/linguistic.ts` — single-pass density computation
- `src/lib/bob/nrc-emotions.ts` — NRC word sets (79KB)

---

## Session 2: Bob Dynamics Engine + Emotion Profile Layer

### What Was Built

Complete architectural overhaul of Bob from LLM-as-interpreter to a four-phase pipeline separating science from art.

**Phase 1 — 8D State Engine** (`state-engine.ts`): Each entry produces a point in 8D behavioral space (fluency, deliberation, revision, expression, commitment, volatility, thermal, presence). All z-scored. Deterministic. Persisted to `tb_entry_states`.

**Phase 2 — PersDyn Dynamics** (`dynamics.ts`): Per-dimension baseline, variability, and attractor force. Ornstein-Uhlenbeck mean-reversion. Phase detection, velocity, system entropy (ECTO framework). Persisted to `tb_trait_dynamics`.

**Phase 3 — Coupling Matrix** (`dynamics.ts`): Signed lagged cross-correlations across all 28 dimension pairs. Discovers causal relationships between behavioral dimensions. Persisted to `tb_coupling_matrix`.

**Phase 3.5 — Emotion Profile Layer** (`emotion-profile.ts`): Reads the 9 stored linguistic density columns (from Session 1). Computes personal percentiles, z-scores, dominant emotion, intensity, diversity. Cross-correlates 9 emotion × 8 behavioral dimensions to discover emotion→behavior causal chains. Persisted to `tb_emotion_behavior_coupling`. Critical design decision: emotion densities stay SEPARATE from the 8D behavioral state space. Process and content don't mix.

**Phase 4 — LLM Renderer** (`interpreter.ts` rewritten): Claude Opus receives validated dynamics + coupling + emotion profile. Translates into 26 visual traits. The LLM decides what dynamics *look like*, not what they *mean*.

**Shader v5** — strategy architecture with 5 vertex deformation strategies and 6 fragment material strategies.

### New Files
- `src/lib/bob/state-engine.ts`
- `src/lib/bob/dynamics.ts`
- `src/lib/bob/emotion-profile.ts`
- `src/pages/api/dynamics.ts`

### Files Modified
- `src/lib/bob/interpreter.ts` — complete rewrite
- `src/pages/api/witness.ts` — runs full 4-phase pipeline
- `src/lib/db.ts` — 4 new tables (`tb_entry_states`, `tb_trait_dynamics`, `tb_coupling_matrix`, `tb_emotion_behavior_coupling`)
- `scripts/reinterpret.ts` — full pipeline recomputation
- `BOB.md` — complete rewrite

---

## How The Two Sessions Connect

```
Session 1 built the sensors:
  linguistic.ts → computes 9 densities from response text
  respond.ts    → stores densities in tb_session_summaries
  signals.ts    → feeds densities to observation/prediction AI

Session 2 built the consumer:
  emotion-profile.ts → reads stored densities from tb_session_summaries
  dynamics.ts        → cross-correlates emotion × behavior
  interpreter.ts     → renders emotion profile into Bob's visual form
```

The linguistic densities flow two directions:
1. **Into Marrow's AI layer** — observation, generation, reflection prompts see emotion profiles alongside behavioral signals
2. **Into Bob's visual form** — emotion profile feeds the renderer (Phase 4) and emotion→behavior coupling is tracked separately from behavioral dynamics

---

## Current State of the Data

- **3 real entries:** April 10, 11, 12. April 10+11 have no session summaries. April 12 has full enriched data + linguistic densities.
- **14 calibration sessions:** All now have linguistic densities (backfilled).
- **17 total sessions with linguistic densities.** Baselines seeded.
- **0 sessions with burst sequence data.** Capture starts April 13.
- **1 observation** (April 12) — re-generated with linguistic pipeline. Includes incongruence detection + calibration-relative deviation.
- **2 open predictions** — re-generated with linguistic context.
- **18 entry states** in 8D behavioral space (Phase 1).
- **21 behavioral couplings** discovered (Phase 3).
- **53 emotion→behavior couplings** discovered (Phase 3.5).
- **Generation: still in seed phase** through May 11.

---

## Audit Trail

- `README_AUDIT/V11/V11_README.md` — linguistic pipeline + per-burst capture (Session 1)
- `README_AUDIT/V12/V12_README.md` — dynamics engine + emotion profile (Session 2)
- `BOB_AUDIT/V6/V6_BOB.md` — current BOB.md snapshot
- `BOB_AUDIT/V6/CHANGELOG.md` — combined V6 changelog

---

## What's NOT Done

1. **Within-session KT detection from burst sequences** — data is now captured but the short→long consolidation algorithm isn't built. Needs sessions with burst data to establish a baseline.

2. **Dynamics not fed into generate/observe/reflect** — the dynamics engine is available but only Bob consumes it. The AI layer still uses the legacy trajectory engine + signals.ts.

3. **Full DTW for coupling** — cross-correlation is the proxy. Full Dynamic Time Warping would handle non-linear lag relationships better.

4. **Test suite** — still not built.

5. **Trajectory → Einstein personality** — Einstein doesn't have an interaction surface yet.
