# Handoff — April 12, 2026 (Session 5)

## What This Session Did

Built the calibration content extraction pipeline — the foundational infrastructure for the causal prediction layer. This is Feature 5 from the six-feature proposal: the system stops throwing away the content of calibration responses and starts extracting structured life-context labels that will eventually feed behavioral clustering.

Also fixed a long-standing TypeScript error in `embeddings.ts` and conducted a full audit of the Session 4 handoff (all claims verified).

---

## Feature: Calibration Content Extraction Pipeline

### The Concept

Calibration responses to neutral prompts ("Describe what you did this morning") contain observable facts about the user's life — sleep quality, physical state, social interactions, stress, etc. The system was capturing behavioral metrics from these sessions but ignoring the text. That text, paired with behavioral data from subsequent journal sessions, provides free causal labels for future clustering.

This is **incidental supervision** (Roth, AAAI 2017) — supervision signals that exist in the data independently of the task at hand. The user does nothing different. The system just stops being wasteful.

### Research Basis

**Extraction approach:**
- Incidental supervision (Roth, AAAI 2017) + data programming (Ratner et al. 2017, Snorkel)
- LLM extraction over rules: Nature Digital Medicine (2025) shows micro-F1 >0.9 vs 0.60-0.72 for rule-based
- Calibration prompts function as involuntary EMAs (EMA/ESM literature, Conner & Lehman 2012)

**Dimension selection** (ranked by effect size on cognitive/behavioral output):
1. `sleep` — Pilcher & Huffcutt (1996) d=-1.55; Abdullah et al. (2016) keystroke evidence
2. `physical_state` — Moriarty et al. (2011) d=0.40-0.80; Eccleston & Crombez (1999)
3. `emotional_event` — Amabile et al. (2005) 12K diary entries; Fredrickson (2001)
4. `social_quality` — Reis et al. (2000) quality > quantity; Sun et al. (2020) PNAS
5. `stress` — Sliwinski et al. (2009) same-day WM decrement; Almeida (2005) carry-over
6. `exercise` — Hillman et al. (2008) d=0.20-0.50; temporally bounded
7. `routine` — Torous et al. (2016) circadian disruption

**Dropped (insufficient evidence):**
- `meals` — d=0.12-0.25 (Hoyland et al.). Too small for individual-level detection
- `environment` — no evidence linking location to writing behavioral signatures
- `caffeine` — d=0.10-0.20 net for habitual users (mostly withdrawal reversal)

### What Was Built

**New table: `te_context_dimension`** — 7 research-backed enum values with citations in header comments.

**New table: `tb_calibration_context`** — stores extracted tags: question_id, dimension, value, detail, confidence. Append-only.

**New module: `src/lib/calibration-extract.ts`**
- Claude Sonnet (not Haiku — labels feed clustering, quality matters more than cost)
- Tool-use with structured output schema constraining to 7 valid dimensions
- `extractCalibrationContext()` — returns validated, typed tags
- `runCalibrationExtraction()` — fire-and-forget wrapper, non-blocking, logs errors
- Extraction prompt instructs: only extract what is STATED or CLEARLY IMPLIED, confidence scoring (1.0 explicit, 0.7 implied, 0.4 weak), emotional_event requires a discrete event not just mood

**New DB functions:**
- `saveCalibrationContext(questionId, tags)`
- `getCalibrationContextForQuestion(questionId)`
- `getRecentCalibrationContext(limit)` — for generate/reflect
- `getCalibrationContextNearDate(targetDate, windowDays)` — for observe

**Wired into `calibrate.ts`:**
- Captures `questionId` from `saveCalibrationSession()` (was previously unused)
- Calls `runCalibrationExtraction(questionId, text, prompt)` after save, fire-and-forget

**Wired into `observe.ts`:**
- Imports `getCalibrationContextNearDate`
- Fetches 2-day window of tags around today
- Formats via `formatLifeContext()` — groups by date, filters confidence >= 0.5
- Included in user prompt after calibration deviation section
- System prompt explains LIFE CONTEXT with research-backed dimension descriptions and effect sizes
- Instructs: use as CONTEXT for frame interpretation, not as primary signal

**Wired into `generate.ts`:**
- Imports `getRecentCalibrationContext`
- Fetches 20 most recent tags
- Formats via `formatGenerateLifeContext()` — compact one-liner per date
- Included in user prompt in signal data section
- System prompt explains: use for question TIMING (disruption = low-friction prompt, stability = deeper challenge)

**Wired into `reflect.ts`:**
- Imports `getRecentCalibrationContext`
- Fetches 30 recent tags (covers reflection window)
- Formats via `formatReflectLifeContext()` — compact grouped by date
- Included in user prompt after calibration context
- System prompt explains: use to contextualize behavioral patterns

### Files Modified
- `src/lib/db.ts` — new tables, migration for enum update, 4 new query functions, CalibrationContextTag type
- `src/lib/calibration-extract.ts` — **new file**, extraction module
- `src/pages/api/calibrate.ts` — captures questionId, fires extraction
- `src/lib/observe.ts` — imports, retrieval, formatting, prompt updates
- `src/lib/generate.ts` — imports, retrieval, formatting, prompt updates
- `src/lib/reflect.ts` — imports, retrieval, formatting, prompt updates

---

## Fix: VoyageAI TypeScript Errors in embeddings.ts

**Problem:** `embeddings.ts` had 4 pre-existing TypeScript errors because the `voyageai` package is imported via `createRequire` (CJS shim in ESM) and types don't resolve cleanly through that path.

**Fix:**
- Extracted module reference separately so `typeof VoyageAIClient` works
- Created `VoyageClient` type alias via `InstanceType<typeof VoyageAIClient>`
- Cast embed responses to `{ data?: Array<{ embedding?: number[] }> }`

**Added note to CLAUDE.md** under "Known Gotchas" so this doesn't get re-investigated.

### Files Modified
- `src/lib/embeddings.ts` — type fixes
- `CLAUDE.md` — added Known Gotchas section

---

## Session 4 Handoff Audit

Full audit of all Session 4 claims against actual codebase. **All claims verified, zero discrepancies.** Gaps 1-3 (dynamics wiring, burst KT, keystroke signals), compilation state, calibration prompt count, and "what's not done" claims all accurate.

---

## README Updated

- Scientific Foundation: added "Calibration Content Extraction (Incidental Supervision)" section with full citations
- Architecture: added calibration content extraction pipeline description
- Stack: updated Claude API line to include Sonnet's extraction role
- Event-Driven Architecture: updated "On Submission (Free Write)" to include extraction step

---

## Verification

TypeScript compiles with **zero errors** — including the previously broken `embeddings.ts`.

Extraction pipeline tested live:
- API key auth issue found and fixed (missing `import 'dotenv/config'` in extraction module)
- 3 calibration sessions submitted, extraction ran successfully on all 3
- No tags extracted (correct — prompts were "what's on the walls," "walk through entering your building," "what does this time of year feel like" — none contain life-context facts matching the 7 dimensions)

---

## Current State of the Data

- **3 real entries:** April 10, 11, 12
- **17+ calibration sessions.** All have behavioral metrics + linguistic densities. Sessions from today have keystroke dynamics.
- **0 calibration context tags extracted yet.** Pipeline is live but the 3 test prompts didn't surface extractable life context. Tags will accumulate as the user hits daily routine / morning / social prompts.
- **1 observation** (April 12)
- **2 open predictions**
- **Generation: still in seed phase** through ~May 11

---

## What's NOT Done

1. **Behavioral clustering** — the math layer (PCA/UMAP + HDBSCAN on 8D dynamics states) that groups sessions by behavioral similarity and uses calibration context tags as labels. Not needed until ~100 sessions. Research says: cluster on dynamics states not raw features, use stability-based validation (bootstrap), expect coarse clusters (4-6) by month 4-6.

2. **Ambient byproduct signals** — time-of-day drift and inter-session interval as features in the behavioral vector. Free signals from session metadata already captured. Research supports them (Althoff et al. 2017, every digital phenotyping study). Should be next build.

3. **Retrodiction prediction type** — adding `retrodiction` to `te_prediction_type` and letting the existing prediction/grading/Bayesian pipeline handle backward-looking predictions. Needs clustering first.

4. **Full DTW for coupling** — dynamic time warping for dimension coupling. Cross-correlation is the current proxy. Revisit around day 60.

5. **Test suite** — still not built.

6. **Einstein interaction surface** — not started.

---

## Research Conducted This Session

Extensive literature review across 4 parallel research agents covering:

**Keystroke-based state classification:** BiAffect (Zulueta et al. 2018, R²=0.63), Epp et al. 2011 (75-88%), Vizer & Sears 2009 (75%). Binary/continuous detection validated. Multi-category classification NOT validated.

**Behavioral clustering:** Baaijen & Galbraith PCA on writing process data validates dimensionality reduction. Individual-level unsupervised clustering of writing process data is a genuine gap. UMAP + HDBSCAN recommended (McInnes et al. 2017/2018).

**Digital phenotyping:** Onnela Lab/Beiwe, StudentLife (Wang et al. 2014), mindLAMP. Within-person idiographic models dramatically outperform population-level (npj Digital Medicine 2024: R²≥0.80). Field can detect THAT something changed, not WHAT caused it. Calibration content extraction bridges this gap.

**Labeling paradigms:** Incidental supervision (Roth, AAAI 2017), Snorkel data programming (Ratner et al. 2017). Semi-supervised clustering reliable at 5-10 labels per cluster, converges to supervised at 20+.

**Dimension selection:** Cross-referenced cognitive psychology (Pilcher & Huffcutt, Moriarty et al., Amabile et al., Hillman et al.), EMA/ESM literature (Conner & Lehman, Kahneman DRM), digital phenotyping ground truth schemas (StudentLife, Beiwe, mindLAMP), and Pennebaker's LIWC daily diary work. Convergent answer: sleep and emotional events are Tier 1; physical state, social quality, stress are Tier 2; exercise and routine are Tier 3.

**Mindstrong cautionary tale:** Raised $160M, published one study (27 subjects, 7 days), ceased operations 2023. Don't build inference on unvalidated detection.

Full research saved to memory: `project_causal_layer_research.md`

---

## Architecture Note for Future Sessions

The causal prediction layer does NOT need a new prediction engine. The existing architecture handles it:
- **Math** computes signals (state-engine, dynamics, future clustering)
- **LLM** generates and grades predictions (observe.ts — same pipeline, pointed backward)
- **Math** tracks confidence (Beta-Binomial, existing `tb_theory_confidence`)

The clustering layer produces structured data → fed into existing LLM prompts → LLM generates retrodictions → graded by user confirmation or next-session data → Bayesian update. Same architecture as forward predictions, different direction.
