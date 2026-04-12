> **Note:** This document predates the renames: Marrow → Alice, Bob → Alice Negative, Einstein → Bob (2026-04-12).

# V6 Changelog — Behavioral Dynamics Engine + Linguistic Density Pipeline

## What Was Wrong

### Bob's Interpretation Gap (Pre-V6)

Bob's previous architecture sent raw behavioral signals directly to an LLM and asked it to guess 26 trait floats. That was art pretending to be science. The LLM was an interpreter making subjective decisions about what signals meant — single point estimates where the research says you need density distributions. No dynamics, no coupling between dimensions, no way to know if the form was responding to real behavioral physics or to the LLM's narrative preferences.

### Missing Linguistic Dimension

The signal pipeline captured *how* you typed (behavioral) but not the emotional register of *what* you typed (linguistic). The observation layer could see you had a low commitment ratio but couldn't see that your word choices were incongruent with the content — zero anger words in an entry about cutting off your mother, for instance. Without linguistic densities, the system was blind to an entire axis of signal that Pennebaker's research identifies as the most predictive of cognitive processing depth: the *slopes* of word category densities over time.

### Missing Burst Granularity

P-burst data was averaged at submit time — the full within-session sequence was discarded. The Baaijen & Galbraith (2012) knowledge-transforming signature is a *within-session transition* from short fragmented bursts to longer sustained ones, not a session average. Without the raw sequence, this detection was impossible.

## What Changed

### Behavioral Dynamics Engine (Phases 1-3)

Complete architectural overhaul separating science from art into four phases:

**Phase 1 — 8D State Vector (deterministic):**
- Each journal entry produces a point in 8-dimensional behavioral space
- Dimensions: fluency, deliberation, revision, expression, commitment, volatility, thermal, presence
- All z-scored against personal history
- Persisted to `tb_entry_states`

**Phase 2 — PersDyn Dynamics (deterministic):**
- Per-dimension parameters: baseline, variability, attractor force
- Ornstein-Uhlenbeck mean-reversion estimation from lag-1 autocorrelation
- Phase detection (insufficient/stable/shifting/disrupted), velocity, system entropy
- Research: Sosnowska, Kuppens, De Fruyt & Hofmans (KU Leuven, 2019); Fleeson & Jayawickreme Whole Trait Theory (2015, 2025)
- Persisted to `tb_trait_dynamics`

**Phase 3 — Coupling Matrix (deterministic):**
- Signed lagged cross-correlations across all 28 dimension pairs
- Discovers which dimensions causally influence each other for this specific person
- Active coupling effects: when a dimension is deviated AND has known coupling, generates predictions
- Research: Critcher (Berkeley xLab) Causal Trait Theories
- Persisted to `tb_coupling_matrix`

**Phase 4 — Visual Rendering (LLM — art, not science):**
- Claude Opus receives validated dynamics + coupling + narrative
- Translates behavioral physics into 26 visual traits
- The LLM decides what the dynamics *look like*, not what they *mean*
- Persisted to `tb_witness_states`

### Shader v5 — Strategy Architecture

Complete rewrite of the WebGL rendering:
- Single IcosahedronGeometry mesh, subdivision 64
- 5 vertex deformation strategies: Liquid, Crystal, Organic, Shatter, Vapor
- 6 fragment material strategies: Stone, Liquid, Crystal, Metal, Gas, Ember
- Blend weights derived from 26 traits via pure function (`deriveShaderWeights`)

### System Entropy

Shannon entropy of variability distribution across all 8 dimensions (Rodriguez, 2025 ECTO framework):
- High entropy = uniformly unpredictable, unstructured
- Low entropy = defined behavioral architecture, some dimensions rigid, others volatile

### New Database Tables

- `tb_entry_states` — per-entry 8D state vector (Phase 1 output)
- `tb_trait_dynamics` — PersDyn parameters per dimension (Phase 2 output)
- `tb_coupling_matrix` — empirical dimension couplings (Phase 3 output)
- `tb_burst_sequences` — per-burst production data for within-session KT analysis

### Linguistic Density Pipeline

Server-side computation of 9 word category densities per session:

**NRC Emotion Lexicon v0.92 (Mohammad & Turney, 2013; National Research Council Canada):**
- 6 emotion categories: anger, fear, joy, sadness, trust, anticipation
- ~6,660 validated words across categories
- Computed as word count per category / total words

**Pennebaker LIWC categories:**
- Cognitive mechanism words (23 words: "because," "realize," "whether," etc.)
- Hedging language (16 words: "maybe," "perhaps," "seems," etc.)
- First-person pronouns (5 words: "I," "me," "my," "mine," "myself")

**Storage and usage:**
- 9 new `REAL` columns on `tb_session_summaries`
- Computed server-side at save time (respond.ts, calibrate.ts)
- Backfilled for all 17 existing sessions
- Fed into observation prompts (deep verbalized linguistic profile section)
- Fed into generation/reflection prompts (compact notation)
- Percentile-ranked against personal history for cross-session slope tracking
- Enables incongruence detection: emotional word profile mismatched with content

### Per-Burst Sequence Capture

Full temporal structure of P-bursts now stored per session:
- Character count, duration (ms), start offset (ms) per burst
- `tb_burst_sequences` table with one row per burst per session
- Frontend (`index.astro`) tracks timing per burst, sends full array
- Enables future within-session KT signature detection (Baaijen & Galbraith 2012)

### New Files

- `src/lib/bob/state-engine.ts` — 8D deterministic state vector computation (Phase 1)
- `src/lib/bob/dynamics.ts` — PersDyn dynamics + coupling matrix (Phase 2 & 3)
- `src/lib/bob/nrc-emotions.ts` — NRC Emotion Lexicon word sets (6 categories, ~6,660 words)
- `src/lib/linguistic.ts` — single-pass word category density computation
- `src/pages/api/dynamics.ts` — behavioral dynamics API endpoint
- `src/assets/shaders/witness.vert` — vertex shader (5 deformation strategies)
- `src/assets/shaders/witness.frag` — fragment shader (6 material strategies)
- `scripts/reinterpret.ts` — full dynamics pipeline recomputation

### Modified Files

- `src/lib/db.ts` — 4 new tables, 9 new columns, migration blocks, burst sequence CRUD
- `src/lib/signals.ts` — linguistic profile section in observation prompts, compact emotion notation in generation/reflection
- `src/lib/observe.ts` — updated fallback SessionSummaryInput with density fields
- `src/pages/api/respond.ts` — computes linguistic densities, saves burst sequences
- `src/pages/api/calibrate.ts` — computes linguistic densities for calibration sessions
- `src/pages/api/witness.ts` — runs full 4-phase dynamics pipeline
- `src/pages/index.astro` — per-burst timing capture
- `src/pages/bob.astro` — threshold + shader rendering
- `src/lib/bob/shader-weights.ts` — trait-to-strategy derivation (v5)
- `src/lib/bob/interpreter.ts` — dynamics-aware LLM renderer (Phase 4)
- `src/lib/bob/helpers.ts` — existing word sets (COGNITIVE_WORDS, HEDGING_WORDS, FIRST_PERSON)

## Research Basis

| Framework | Source | What It Does Here |
|---|---|---|
| PersDyn | Sosnowska et al. (KU Leuven, 2019) | Baseline + variability + attractor force per dimension |
| Whole Trait Theory | Fleeson & Jayawickreme (2015, 2025) | Traits as distributions, not points |
| Ornstein-Uhlenbeck | Kuppens, Oravecz & Tuerlinckx (2010) | Attractor force from lag-1 autocorrelation |
| ECTO | Rodriguez (2025) | Shannon entropy as system-level behavioral metric |
| Causal Trait Theories | Critcher (Berkeley xLab) | Empirical coupling between dimensions |
| NRC Emotion Lexicon | Mohammad & Turney (NRC Canada, 2013) | 6 emotion word categories for density tracking |
| LIWC word categories | Pennebaker (UT Austin); Tausczik & Pennebaker (2010) | Cognitive, hedging, self-reference — slopes over time |
| P-burst analysis | Chenoweth & Hayes (2001), Deane (2015) | Fluency dimension + per-burst sequence storage |
| KT within-session | Baaijen, Galbraith & de Glopper (2012) | Short→long burst transition signature (data capture ready) |
| Revision taxonomy | Faigley & Witte (1981) | Thermal dimension |
| MATTR | McCarthy & Jarvis (2010) | Expression dimension |
| Keystroke dynamics | BiAffect / Zulueta et al. (2018) | Presence dimension |

## What's NOT Done

### Linguistic Densities → Bob's State Space
NRC emotion densities are stored per session but not yet wired into the 8D state engine or coupling matrix. Could become a 9th dimension or feed into the existing Expression dimension. Design question: adding emotional content to a behavioral-only state space changes what the coupling matrix discovers.

### Within-Session KT Detection from Burst Sequences
Per-burst data is now captured and stored. The algorithm to detect the short→long consolidation pattern within a session is not yet implemented. Needs enough sessions with burst data to establish a personal baseline for burst-sequence shape.

### Full DTW Implementation
Cross-correlation remains the proxy for Dynamic Time Warping. Full DTW (Mesbah et al. 2024) would be more robust for non-linear temporal lag relationships in the coupling matrix. Worth implementing when data density allows.
