# Simulation Handoff v2

**Date:** 2026-04-14
**Last run:** v11 (Sonnet quality with theory injection)
**Previous handoff:** `simulation_handoff.md` (v1 post-mortem, now outdated)

---

## What Happened This Session

11 simulation runs (v1-v11) across one session. Started with a broken v1 pipeline, ended with a working three-call observation system, deterministic code grading, tool use for structured predictions, DB archiving, and theory injection.

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

5. **Theory injection** (`observe.ts`)
   - `getAllTheoryConfidences()` injected into predict call user content
   - Distribution guidance: stop testing below 0.2, stop above 0.8, spread across theories
   - Solved (partially): theories went from 11 with 1 prediction each to 2-3 with meaningful accumulation

6. **DB archiving** (`simulate.ts`)
   - Previous DB archived to `data/simulation/archive/sim-v{N}.db` before wipe
   - Report version number used as archive name

---

## Current State

### What Works
- 10/10 or 15/15 suppressed questions (every run since v5)
- 18-24 predictions per run with tool use
- 16-21 code-graded predictions per run (deterministic, no LLM)
- Bayesian theory confidence updating correctly
- Ground truth: **5/5 planted patterns detected, 2/2 false signals ignored** (Sonnet)
- Cost: ~$0.55 Haiku mechanics, ~$1.20 Sonnet quality
- DB archiving preserves all prior run data
- Pipeline is model-independent (same code, swap models, mechanics hold)

### What's Broken

**1. Theory distribution over-correction (HIGH PRIORITY)**
The theory injection works on Haiku v10 (3 theories, spread 5/4/1) but over-corrects on Sonnet v11 (2 theories, spread 12/7). Sonnet locks onto theories and hammers them despite continuous falsification. The distribution guidance ("stop below 0.2") kicks in too late.

Options:
- Hard cap: "never test the same theory more than 3 consecutive times"
- Programmatic enforcement: after N falsifications, remove the theory from the injected table
- Different prompt tuning for different models (breaks model-independence goal)

Best approach is probably programmatic — don't show dead theories (posterior < 0.15) in the injected table at all. Let the prompt guidance handle the rest.

**2. `tool_choice: 'any'` doesn't guarantee `create_prediction` (MEDIUM)**
When interpretive predictions need grading, Sonnet calls `grade_prediction` and stops. No new predictions created. Happens on ~20% of days.

Options:
- Two-pass approach: if no `create_prediction` in response, make a second call with only that tool
- Separate the predict call into two: grade call + create call
- Use `tool_choice: { type: 'tool', name: 'create_prediction' }` for a follow-up call

Best approach is probably the two-pass: try once with both tools, if `create_prediction` missing, call again with just that tool and `tool_choice: { type: 'tool', name: 'create_prediction' }`.

**3. `windowMode: 'majority'` not implemented (LOW)**
Sonnet consistently requests this mode. Currently rejected by validator. Easy to implement — resolve windowed grade as confirmed if >50% of session checks confirm.

Location: `resolveWindowedGrade()` in `grader.ts`

**4. v8 Sonnet had 0 confirmed predictions in v11 (INVESTIGATE)**
May be a theory quality issue (bad theories get tested repeatedly) or a criteria calibration issue (thresholds too aggressive). Worth comparing the actual prediction hypotheses between v8 (6 confirmed) and v11 (0 confirmed) to see if theory injection changed what gets predicted.

---

## Key Files

| File | What it does |
|------|-------------|
| `src/lib/observe.ts` | Three-call observation pipeline (observe → suppress → predict) |
| `src/lib/grader.ts` | Deterministic code-based prediction grading |
| `src/lib/signal-registry.ts` | Canonical 150+ signal vocabulary |
| `src/lib/db.ts` | All DB operations including `getAllTheoryConfidences()` |
| `src/scripts/simulate.ts` | Simulation runner (mechanics + quality modes) |
| `src/scripts/simulation-data.ts` | Jordan Chen ground truth (30 entries, P1-P5, F1-F2) |
| `data/simulation/iteration-log.md` | Running log of all simulation iterations v1-v11 |
| `data/simulation/reports/` | Auto-versioned markdown reports per run |
| `data/simulation/archive/` | Archived DBs from prior runs |

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

---

## Next Steps (Recommended Order)

1. **Fix theory distribution** — filter dead theories from injection, don't just instruct the model to avoid them
2. **Implement `windowMode: 'majority'`** — easy win, Sonnet wants it
3. **Fix prediction gap on grade-only days** — two-pass tool call approach
4. **Run Sonnet quality with fixes** — compare to v8 and v11
5. **Feed theory table into question generation** — close the loop between measurement and intervention
6. **Add cross-day lag correlation as a computed signal** — P5 (vulnerability hangover) should be detectable by code, not left to LLM interpretation

---

## Commands

```bash
npm run simulate                    # Haiku mechanics (10 days, ~$0.55)
npm run simulate -- --quality       # Sonnet quality (15 days, ~$1.20)
npm run simulate -- --dry-run       # Data only, no AI calls
npm run simulate -- --start 5       # Resume from day 5
npm run simulate -- --embed         # Include VoyageAI embeddings
```

---

## Philosophy Note

The architectural goal is **model-interchangeability with graceful degradation**. Three layers:

1. **Measurement (Layer 1)** — keystroke dynamics, NRC densities, deletion decomposition, 8D behavioral state. All code. Model-independent.
2. **Evaluation (Layer 2)** — deterministic code grading against structured criteria. Model-independent if the model outputs valid structured criteria (which tool use now ensures).
3. **Interpretation (Layer 3)** — observation prose, suppressed questions, reflections. Inherently model-dependent. A better model writes sharper observations and more precise suppressed questions.

Push as much as possible from Layer 3 into Layers 1 and 2. The LLM should only do what only an LLM can do.
