# Handoff — April 12, 2026 (Session 6)

## What This Session Did

Built the same-day session delta pipeline — a within-person control system that computes the behavioral difference between calibration (neutral writing) and journal (reflective writing) on the same day. This isolates what the real question provoked, controlling for daily confounds (sleep, stress, device, time-of-day).

Also conducted extensive literature research validating the approach and updated the README.

---

## Feature: Same-Day Session Delta Pipeline

### The Concept

Every day with both a calibration session and a journal session is a mini within-subjects experiment (Pennebaker & Beall, 1986). The calibration session captures how the person writes when nothing is at stake. The journal session captures how they write when the question matters. The delta between them — computed across 8 research-backed dimensions — is the cleanest behavioral signal available because it controls for everything that happened that day. Toledo et al. (2024) showed 76-89% of stress response variance is within-day, validating same-day controls over between-day baselines.

The existing `formatCalibrationDeviation` compared journal sessions against the rolling average of all past calibration sessions. That's useful but blurry — the average includes tired days, wired days, stressed days. The same-day delta compares against today's calibration only, isolating the question-specific response.

### Research Basis

**Core methodology:**
- Pennebaker & Beall (1986) — PMID 3745650. Expressive writing paradigm: neutral vs emotional writing as within-person control. The foundational design.
- Toledo et al. (2024) — PMID 39530726, *Stress and Health*. Multilevel models with moments nested within days nested within persons. 76-89% of reactivity/recovery variance is within-day.
- Shimokawa, Lambert & Smart (2010) — PMID 20515206, BYU, N=6,151. OQ-45 deviation-from-expected-trajectory detects 85-100% of deteriorating cases. Reduced deterioration from 20.1% to 5.5%.

**Delta dimension selection:**
- First-person density — Newman et al. (2003) PMID 14599238. Distancing marker; strongest single linguistic deception cue.
- Cognitive density — Vrij (2000-2020s). Cognitive load from managing dual representations leaks into word choice.
- Hedging density — uncertainty/performance language.
- Typing speed (chars/min) — production fluency disruption.
- Commitment ratio — self-censoring (wrote a lot, kept little).
- Large deletion count — Faigley & Witte (1981). Substantive rethinking, not surface correction.
- Inter-key interval mean — Epp, Lippold & Mandryk (2011). Keystroke hesitation as affect signal.
- P-burst length — Chenoweth & Hayes (2001). Thought-unit fluency.

**Supporting research:**
- Collins et al. (2025) — PMID 40208744, N=258, 90 days. Self-referential language in diary text detects depression AUC 0.68.
- Shin et al. (2024) — PMID 39292502, N=91. LLM analysis of diary text detects depression with 90.2% accuracy.
- Bogaard et al. (2022) — DOI 10.1002/acp.3990, N=138. Automated feature coding detects truth/lie differences from personal baselines; naive observers cannot.
- Yoshizawa (2022) — arXiv 2201.02325. Standard Bayesian Online Change Point Detection fails on permanently shifting baselines. Extended version handles evolving baselines.
- Fisher, Medaglia & Jeronimus (2018) — PNAS. Group-level structures don't replicate at individual level. Individual models stabilize at ~50-60 observations.

### What Was Built

**New table: `tb_session_delta`** — stores computed delta vectors per date. 8 delta dimensions, composite magnitude, plus 16 raw value columns (calibration + journal per dimension) for auditability. Append-only, one row per date.

**New module: `src/lib/session-delta.ts`**
- `computeSessionDelta(calibration, journal, date)` — pure arithmetic, journal minus calibration across 8 dimensions. Null-safe.
- `computeDeltaMagnitude(delta, history)` — RMS z-score across dimensions using personal delta history. Returns null if < 10 historical deltas (cold start).
- `formatSessionDelta(delta, history)` — full format for observe.ts. Shows raw deltas with direction labels. After 15+ days: PERSONAL DELTA RANGE section (sigma deviations from typical). After 7+ days: DELTA TREND section (7-day moving direction per dimension).
- `formatCompactDelta(deltas)` — compact format for generate.ts and reflect.ts. One line per date, only flagging dimensions outside 1σ. 7-day trend summary.
- `runSessionDelta(journalQuestionId, date)` — fire-and-forget wrapper.

**New DB functions:**
- `getSameDayCalibrationSummary(date)` — uses `DATE(q.dttm_created_utc)` since calibration questions have `scheduled_for = NULL`. Takes most recent if multiple same-day calibrations.
- `saveSessionDelta(delta)` — INSERT OR REPLACE.
- `getRecentSessionDeltas(limit)` — for history and trend computation.

**Wired into `observe.ts`:**
- Imports delta computation and formatting
- After existing calibration baseline fetch, checks for same-day calibration
- If both sessions exist: computes delta, saves it, formats it
- Added to user content after calibration deviation section
- System prompt updated: SAME-DAY SESSION DELTA explanation, instructs AI to prefer same-day delta over historical-average deviation when available

**Wired into `generate.ts`:**
- Imports `getRecentSessionDeltas` and `formatCompactDelta`
- Fetches 14 most recent deltas
- Included in user prompt after life context section

**Wired into `reflect.ts`:**
- Same pattern as generate, but fetches 30 recent deltas (covers reflection window)

### Files Modified
- `src/lib/db.ts` — new table DDL, `SessionDeltaRow` type, 3 new query functions
- `src/lib/session-delta.ts` — **new file**, delta computation and formatting module
- `src/lib/observe.ts` — imports, delta computation + save, prompt section, system prompt update
- `src/lib/generate.ts` — imports, compact delta trends in prompt
- `src/lib/reflect.ts` — imports, compact delta trends in prompt

---

## README Updated

- Scientific Foundation: added "Same-Day Session Delta (Within-Person Control)" section with 6 citations (Pennebaker 1986, Toledo 2024, Collins 2025, Shimokawa/Lambert 2010, Bogaard 2022, Yoshizawa 2022)
- Calibration: expanded to describe same-day delta computation and its 8 dimensions
- Event-Driven Architecture: updated observation step to mention delta computation
- What Alice Feeds: updated to include session deltas with personal range context

Copied to `README_AUDIT/V16/V16_README.md`.

---

## Verification

TypeScript compiles with **zero errors**.

Delta pipeline is structurally complete. Live testing requires a day with both a calibration session and a journal session. The module gracefully skips days without same-day calibration (logs a message, no errors). Delta magnitude and personal range context degrade gracefully with insufficient history.

---

## Current State of the Data

- **3 real entries:** April 10, 11, 12
- **17+ calibration sessions.** All have behavioral metrics + linguistic densities. Sessions from today have keystroke dynamics.
- **0 session deltas computed yet.** Pipeline is live but no day has had both calibration and journal submission processed through this code path. Deltas will accumulate from the next day both occur.
- **0 calibration context tags extracted yet.** Pipeline is live but test prompts didn't surface extractable life context.
- **1 observation** (April 12)
- **2 open predictions**
- **Generation: still in seed phase** through ~May 11

---

## What's NOT Done

1. **Behavioral clustering** — PCA/UMAP + HDBSCAN on 8D dynamics states. Not needed until ~100 sessions. Session deltas will feed into this as additional feature dimensions when the time comes.

2. **Ambient byproduct signals** — time-of-day drift and inter-session interval as features in the behavioral vector. Free signals from session metadata already captured. Should be next build.

3. **Retrodiction prediction type** — needs clustering first.

4. **Full DTW for coupling** — revisit around day 60.

5. **Test suite** — still not built.

6. **Alice Negative interaction surface** — not started.

7. **Anomaly detection / honesty signal** — the same-day delta is the foundational infrastructure for this. The delta itself IS the detection channel. When delta baseline stabilizes (30-50 days per Fisher 2018), deviations from the delta become the three-way signal: flatline delta (disengagement), spike delta with effort markers (performance/construction), drifting delta (genuine change). This is not a separate feature — it emerges from tracking the delta over time. The system adapts its behavior based on confidence without surfacing any diagnosis.

---

## Research Conducted This Session

**Anomaly detection / honesty-as-residual concept:**
Extensive literature search across deception detection, digital phenotyping, idiographic modeling, and change point detection. Key findings:

- Within-person deception detection from text is theoretically endorsed (Vrij) but empirically almost unstudied. The field is stuck on between-subjects designs.
- "Model normal, detect abnormal" is validated at scale (Lambert OQ-45, N=6,151; insurance fraud; intrusion detection; stylometric verification).
- Minimum baseline for reliable within-person models: 30-50 daily observations for moderate complexity (convergent finding from Fisher 2018 PNAS, Bolger & Laurenceau 2013, single-case design literature).
- Three-way discrimination (disengagement vs. deception vs. genuine change) is NOT validated as a classification task. The field hasn't solved two-way reliably within-person. But the trajectory signatures are theoretically distinguishable: flat (disengagement), effortful-but-inconsistent (deception), gradual-and-persistent (genuine change).
- Standard change point detection breaks on permanently shifting baselines (Yoshizawa 2022). The system needs to handle evolving baselines, which is exactly what genuine psychological change looks like.
- Anthropic's own honesty research (2025) achieved AUROC 0.88 for lie detection — described as "borderline adequate for offline monitoring."

**Key architectural insight:** The anomaly detection idea doesn't require a new system. It falls out of the existing plan: cluster fit distance (from clustering) + calibration-behavior agreement (from session deltas) + prediction confidence drops (from prediction engine) = the anomaly signal, for free. The only future addition is the response layer — how Alice Negative adjusts behavior when confidence drops.

---

## Architecture Note for Future Sessions

The same-day session delta is the bridge between the calibration system and the eventual anomaly detection layer. The data flow is:

```
Calibration session → tb_session_summaries (neutral metrics)
Journal session    → tb_session_summaries (reflective metrics)
                          ↓
            computeSessionDelta() [8D arithmetic]
                          ↓
              tb_session_delta (delta vector per day)
                          ↓
            formatSessionDelta() → observe.ts prompt
            formatCompactDelta() → generate.ts / reflect.ts prompts
                          ↓
         [future: delta baseline → deviation-from-delta → anomaly signal]
         [future: delta vectors → clustering feature dimensions]
```

The delta module reads from the same `tb_session_summaries` table as Alice Negative (state-engine, dynamics) but they don't interact. They're parallel readers feeding into the same AI prompts from different angles. Alice Negative says "here's where you are in 8D behavioral space." The delta says "here's how today's neutral and real writing differ."

## Pending Rename

System renamed from "Marrow" to "Alice" (Alice sends, Alice Negative receives — the canonical communication protocol metaphor). Naming change only, no product philosophy changes. Executed 2026-04-12.
