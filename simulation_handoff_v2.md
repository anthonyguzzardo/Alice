# Simulation Handoff v2

**Date:** 2026-04-14
**Last run:** v14 (Sonnet quality with Thompson sampling)
**Previous handoff:** `simulation_handoff.md` (v1 post-mortem, now outdated)

---

## What Happened This Session

17 simulation runs (v1-v14) across two sessions. Started with a broken v1 pipeline, ended with programmatic theory selection via Thompson sampling, deterministic Bayes factor lifecycle, and model configuration for production.

### Architecture Changes Made

1. **Three-call observation split** (`observe.ts`)
   - Call 1 — OBSERVE: three-frame observation only
   - Call 2 — SUPPRESS: dedicated suppressed question generation (`max_tokens: 500`)
   - Call 3 — PREDICT: grade predictions + generate new ones via tool use
   - Solved: suppressed question truncation (2/10 → 10/10)

2. **Tool use for predictions** (`observe.ts`)
   - `create_prediction` tool with typed schema — no more regex parsing
   - `grade_prediction` tool for interpretive grading
   - `tool_choice: { type: 'any' }` — forces at least one tool call
   - Solved: prediction format drift across models (4-5 missing/day → 0-1)

3. **Criteria normalization** (`observe.ts`)
   - `gradeMethod` defaults from top-level `grade_method` when missing from nested criteria
   - `windowSessions` defaults to 1, `windowMode` defaults to `'any'`
   - `falsifies_summary` defaults to "Opposite of confirmation criteria"
   - Solved: validation rejecting valid predictions due to field placement

4. **Regex flag handling** (`grader.ts`)
   - Strips Python-style inline flags (`(?i)`, `(?m)`, etc.) from text_search patterns
   - Applies case-insensitivity via JS `RegExp` flags instead
   - Solved: text_search criteria rejected for using Python regex syntax

5. **Programmatic theory selection** (`theory-selection.ts`) — NEW
   - Thompson sampling from Beta(alpha, beta) posteriors selects top-3 theories
   - Replaces prompt-based distribution guidance entirely
   - LLM receives 2-3 pre-selected theories with no posteriors visible, no behavioral instructions
   - Zero dependencies, seedable PRNG for simulation reproducibility
   - Research: Thompson (1933), Agrawal & Goyal (Columbia COLT 2012), Sharma & Perez (Anthropic ICLR 2024)
   - Solved: theory fixation on Sonnet (0 confirmed → 5 confirmed)

6. **Bayes factor lifecycle** (`db.ts`, `theory-selection.ts`) — NEW
   - Sequential log Bayes factor tracked per theory
   - SPRT formulation: +log(2) per hit, -log(2) per miss
   - Status: active (eligible for Thompson sampling), established (BF > 10, stop testing), retired (BF < 1/10 after 3+ predictions, never shown to LLM again)
   - Thresholds from Kass & Raftery (JASA 1995)
   - Solved: dead theories (posterior < 0.1) persisting in the LLM's view

7. **windowMode 'majority'** (`grader.ts`) — NEW
   - Confirmed if >50% of session checks confirm
   - Fixes bug where LLM could emit 'majority' but grader rejected it

8. **DB archiving** (`simulate.ts`)
   - Previous DB archived to `data/simulation/archive/sim-v{N}.db` before wipe
   - Report version number used as archive name

9. **Plain English report summaries** (`simulate.ts`) — NEW
   - "What Happened" section auto-generated from prediction stats and theory lifecycle
   - Context-aware commentary (different language for 0% vs 40% hit rate)
   - Theory distribution warnings, retirement/establishment reporting

10. **Production model configuration** — NEW
    - Daily calls (observe, suppress, predict, generate): Sonnet
    - Weekly reflection primary: Sonnet
    - Weekly reflection audit: **Opus** (independence preserved, one expensive call/week)
    - Simulation still uses its own model flags (Haiku/Sonnet)

11. **Gallery date fix** (`gallery.astro`) — NEW
    - Was hardcoded to "april 12, 2026"
    - Now pulls from most recent gallery entry dynamically

---

## Current State

### What Works
- 10/10 or 15/15 suppressed questions (every run since v5)
- 18-30 predictions per run with tool use
- 16-21 code-graded predictions per run (deterministic, no LLM)
- Thompson sampling distributes theories programmatically
- Bayes factor lifecycle retires dead theories, graduates established ones
- Ground truth: **5/5 planted patterns detected** (Sonnet v11), **4/5** (Sonnet v14)
- **5 confirmed predictions on Sonnet** (v14) — up from 0 (v11)
- Cost: ~$0.55 Haiku mechanics, ~$1.20 Sonnet quality
- DB archiving preserves all prior run data
- Pipeline is model-independent (same code, swap models, mechanics hold)
- Production wired: same observe.ts/generate.ts/reflect.ts used by simulation and app

### What's Fixed Since Last Handoff

**1. Theory distribution over-correction — FIXED (was HIGH PRIORITY)**
Thompson sampling replaced prompt-based distribution guidance. The LLM no longer decides which theories to test. Programmatic selection eliminates fixation regardless of model capability. Sonnet went from 0/19 confirmed (v11) to 5/13 confirmed (v14).

**2. `windowMode: 'majority'` — FIXED (was LOW)**
Added to grader type union, resolveWindowedGrade, and validateCriteria.

### What's Still Open

**1. `tool_choice: 'any'` doesn't guarantee `create_prediction` (MEDIUM)**
When interpretive predictions need grading, the model calls `grade_prediction` and stops. No new predictions created. Happens on ~20% of days. v13 had a Day 8 gap from this.

Options:
- Two-pass approach: if no `create_prediction` in response, make a second call with only that tool
- Separate the predict call into two: grade call + create call
- Use `tool_choice: { type: 'tool', name: 'create_prediction' }` for a follow-up call

Best approach is probably the two-pass: try once with both tools, if `create_prediction` missing, call again with just that tool.

**2. P5 (vulnerability hangover) detection regression (LOW)**
Detected in v11 (Sonnet, old system) but MISSED in v14 (Sonnet, Thompson). This is the lag-1 cross-day pattern — hardest to detect. Likely noise, not a Thompson sampling issue. A computed signal for lag-1 first-keystroke correlation would make it code-gradeable.

**3. F2 false signal flagged (LOW)**
Tab-away × creative mentions was FLAGGED (bad) in v14 — Sonnet sees the correlation and can't resist calling it meaningful. Low priority since it's 1 of 2 false signals and the other was correctly ignored.

---

## Key Files

| File | What it does |
|------|-------------|
| `src/lib/observe.ts` | Three-call observation pipeline (observe → suppress → predict) |
| `src/lib/theory-selection.ts` | **NEW.** Thompson sampling, Bayes factor lifecycle, EIG, prompt formatting |
| `src/lib/grader.ts` | Deterministic code-based prediction grading (now with 'majority' mode) |
| `src/lib/signal-registry.ts` | Canonical 150+ signal vocabulary |
| `src/lib/db.ts` | All DB operations including theory confidence with log_bayes_factor and status |
| `src/lib/generate.ts` | Question generation (Sonnet in production) |
| `src/lib/reflect.ts` | Weekly reflection (Sonnet primary, Opus audit) |
| `src/scripts/simulate.ts` | Simulation runner (mechanics + quality modes) |
| `src/scripts/simulation-data.ts` | Jordan Chen ground truth (30 entries, P1-P5, F1-F2) |
| `src/pages/gallery.astro` | Alice Negative gallery (date now dynamic) |
| `data/simulation/iteration-log.md` | Running log of all simulation iterations v1-v14 |
| `data/simulation/reports/` | Auto-versioned markdown reports per run |
| `data/simulation/archive/` | Archived DBs from prior runs |
| `docs/THEORY_SELECTION.md` | **NEW.** Full research documentation for theory selection system |
| `README_AUDIT.md` | **NEW.** README change log with v18 entry |

---

## Simulation Results Summary

| Version | Model | Theories | Distribution | Confirmed | Falsified | Key Change |
|---------|-------|----------|-------------|-----------|-----------|------------|
| v10 | Haiku | 3 | 5/4/1 | 3 | 7 | Distribution guidance added |
| v11 | Sonnet | 2 | 12/7 | **0** | 19 | Guidance over-corrected on Sonnet |
| v12 | Haiku | 3 | 10/2/1 | 0 | 13 | Thompson sampling (BF bug) |
| v13 | Haiku | 2 | 11/3 | **4** | 10 | BF fix (SPRT formulation) |
| v14 | Sonnet | 2 | 9/4 | **5** | 8 | Thompson + fixed BF on Sonnet |

---

## Production Configuration

| Component | Model | Cost/call |
|-----------|-------|-----------|
| Observation (3 frames) | Sonnet | ~$0.02 |
| Suppressed question | Sonnet | ~$0.005 |
| Predictions (grade + create) | Sonnet | ~$0.01 |
| Question generation (day 31+) | Sonnet | ~$0.02 |
| Weekly reflection (primary) | Sonnet | ~$0.02 |
| Weekly reflection (audit) | **Opus** | ~$0.15 |
| Calibration extraction | Sonnet | ~$0.01 |

Estimated daily cost: ~$0.05-0.10 (Sonnet daily) + ~$0.15/week (Opus audit)
Estimated monthly cost: ~$2-4

---

## What the Simulation Can't Test

The simulation validates pipeline mechanics and interpretation quality against planted patterns. It cannot test the **feedback loop** — the thing that makes Alice different from a chatbot reading 30 journal entries.

In the simulation, Jordan's entries are pre-scripted. Day 10's entry is the same regardless of what the system observed on day 9. The questions don't shape what Jordan writes because Jordan is a script.

The real test is a real person, where:
- Today's observation shapes tomorrow's question
- Tomorrow's question shapes what the person writes
- What they write produces new signals that update the model
- The model shapes the next question

This compounding loop is the entire value proposition. The simulation proves the machinery works. A real user proves the product works.

**Status: Production database reset. Day 1 is today (2026-04-14).**

---

## Next Steps (Recommended Order)

1. **Use it** — answer questions daily, calibrate with free writes
2. **Fix prediction gap on grade-only days** — two-pass tool call approach (when it becomes annoying)
3. **Add cross-day lag correlation as computed signal** — P5 detection improvement (when enough data exists)
4. **Feed theory table into question generation** — close the loop between measurement and intervention (after day 31)
5. **Evaluate question quality at day 31+** — if Sonnet questions feel shallow, upgrade generation to Opus

---

## Commands

```bash
npm run dev                             # Start local dev server
npm run simulate                        # Haiku mechanics (10 days, ~$0.55)
npm run simulate -- --quality           # Sonnet quality (15 days, ~$1.20)
npm run simulate -- --dry-run           # Data only, no AI calls
npm run simulate -- --start 5           # Resume from day 5
npm run simulate -- --embed             # Include VoyageAI embeddings
```

---

## Philosophy Note

The architectural goal is **model-interchangeability with graceful degradation**. Three layers:

1. **Measurement (Layer 1)** — keystroke dynamics, NRC densities, deletion decomposition, 8D behavioral state. All code. Model-independent.
2. **Evaluation (Layer 2)** — deterministic code grading against structured criteria. Model-independent if the model outputs valid structured criteria (which tool use now ensures). Theory selection via Thompson sampling — model-independent.
3. **Interpretation (Layer 3)** — observation prose, suppressed questions, reflections. Inherently model-dependent. A better model writes sharper observations and more precise suppressed questions.

Push as much as possible from Layer 3 into Layers 1 and 2. The LLM should only do what only an LLM can do.
