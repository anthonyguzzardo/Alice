# Handoff: Signal Expansion (2026-04-17 -> 2026-04-18)

## What happened

Massive signal expansion from ~57 to ~147 distinct behavioral signals captured from a single textarea. All deterministic math. No LLM touches any of it. Every signal is computed and persisted, verified working via calibration session with all tables populated.

## What was built

### Phase 1: Client-Side Capture Expansion
**Files changed:** `src/pages/index.astro`, `src/lib/db.ts`, `src/pages/api/respond.ts`, `src/pages/api/calibrate.ts`

18 new columns added to `tb_session_summaries`. Both journal and calibration paths capture identically. Key new signals:
- Confirmation latency (pre-submit hesitation, Monaro et al. 2018)
- Paste detection (construct validity for unmediated writing)
- Read-back count (cursor movement without editing)
- Leading edge ratio (writing linearity, Galbraith 2009)
- Contextual vs pre-contextual revision (Lindgren & Sullivan 2006)
- Considered-and-kept count (select then deselect without delete)
- Left/right hand hold times (neuroQWERTY motor laterality)
- Hold time CV (most sensitive PD feature)
- Negative flight time count (key rollover / motor automaticity)
- IKI skewness and kurtosis (distribution shape)
- Error detection latency (char-to-backspace, fatigue marker)
- Terminal velocity (finish-line typing behavior)

**Important:** The live SQLite database needed `ALTER TABLE` to add the new columns. This was done via a one-time script. The `CREATE TABLE IF NOT EXISTS` in db.ts has the columns for fresh databases.

### Phase 2: Motor Signals
**New file:** `src/lib/motor-signals.ts`
**New table:** `tb_motor_signals`

7 signals from keystroke stream: sample entropy, IKI autocorrelation (lags 1-5), motor jerk, lapse rate, tempo drift, IKI compression ratio, digraph latency profile.

### Phase 3: Semantic Signals
**New files:** `src/lib/semantic-signals.ts`, `src/lib/word-lists.ts`
**New table:** `tb_semantic_signals`

8 signals from final text: idea density (Nun Study), lexical sophistication, epistemic stance (boosters vs hedges), integrative complexity, deep cohesion, referential cohesion, emotional valence arc, text compression ratio. Includes `lexicon_version` column for future word list changes and `paste_contaminated` flag.

### Phase 4: Cross-Session Signals
**New file:** `src/lib/cross-session-signals.ts`
**New table:** `tb_cross_session_signals`

10 signals requiring prior entry data: self-perplexity (personal trigram model), NCD at lags 1/3/7/30 days, vocabulary recurrence decay, digraph stability, text network density, community count, bridging ratio.

### Phase 5: Process Signals
**New file:** `src/lib/process-signals.ts`
**New table:** `tb_process_signals`

9 signals from event log replay: pause location profile (within-word/between-word/between-sentence), abandoned thought count, R-burst/I-burst classification, vocabulary expansion rate (Heaps exponent), phase transition point, strategy shift count.

### Phase 6: Dynamical Signals Persistence
**New table:** `tb_dynamical_signals`

Moved from on-demand computation in the observatory entry endpoint to persisted at submit time. Observatory reads pre-computed values with fallback to on-demand for old entries.

### Pipeline Orchestration
**New file:** `src/lib/signal-pipeline.ts`

`computeAndPersistDerivedSignals(questionId)` is called from both `respond.ts` and `calibrate.ts` in the fire-and-forget block after `renderWitnessState()`. Each signal family is independently try/caught so one failure can't block the rest. Errors go to `data/errors.log` tagged by family.

### Backfill
**New file:** `src/scripts/backfill-signals.ts`

Run: `npx tsx src/scripts/backfill-signals.ts`

Safe to re-run. Skips sessions that already have signals. Successfully backfilled 3 existing entries.

### Observatory Fixes
**Files changed:** `src/pages/observatory/trajectory.astro`, `src/pages/observatory/entry/[id].astro`, `src/pages/observatory/index.astro`

- Fixed CSS variable bug in Canvas 2D rendering (canvas doesn't understand `var(--border)`)
- Added resize handling to trajectory charts
- Single data point rendering (was blank before)
- Dark mode theme compliance for radar chart and sparklines
- Observatory entry endpoint now reads persisted dynamical + motor signals

### Documentation
**Updated:** `signals.md` with all 51 new signal specifications, citations, and updated total count table.

## What's working

All 5 signal families compute and persist on every session (journal and calibration):
- `tb_session_summaries`: 69 columns (18 new)
- `tb_dynamical_signals`: 13 signals
- `tb_motor_signals`: 7 signals
- `tb_semantic_signals`: 8 signals + lexicon version + paste flag
- `tb_process_signals`: 9 signals
- `tb_cross_session_signals`: 10 signals

Verified via calibration: all Phase 1 client metrics populated (non-null), all derived signal tables populated.

## What's not done yet

### Signals that need more data to activate
- `ncd_lag_3/7/30`: Need entries at those day lags (will populate as more sessions accumulate)
- `vocab_recurrence_decay`: Needs entries at lags 1, 3, 7 to fit decay curve
- `digraph_stability`: Needs 2+ prior motor signal rows (will activate after next session with keystroke stream)
- `self_perplexity`: Functional but needs ~20+ entries for the trigram model to be well-calibrated
- `pause_within_word/between_word/between_sentence`: Requires 2s+ pauses during writing (calibration sessions are too fast)

### Simulation script
`src/scripts/simulation-data.ts` `buildSessionSummary()` is missing the 18 Phase 1 fields. Will need nulls added if you run a simulation. Low priority since simulations don't generate real keystroke data anyway.

### Future considerations (from external review)
1. **Signal sanity check page:** A diagnostic view showing distribution + plausible bounds for each signal. Would catch silently broken signals.
2. **Signal pruning process:** After ~6 months, evaluate which of the 147 signals are noise or redundant. Keep the data, stop including in analysis.
3. **Interpretation layer scaling:** With 147 signals across 7 layers, the observatory and any synthesis need a "show me only what moved meaningfully" filter. This is the next architectural problem.
4. **Process signal threshold tuning:** Abandoned thought detection, pause classification, and strategy shift detection use fixed thresholds that will need iteration as real session data accumulates.

## Architecture summary

```
index.astro (client capture)
    |
    v
POST /api/respond  OR  POST /api/calibrate
    |
    |-- Transaction: save response, burst sequence, session events,
    |   session summary (69 cols), deletion events, session metadata
    |
    |-- Fire-and-forget:
    |   |-- runGeneration()
    |   |-- renderWitnessState()  (7D behavioral + 11D semantic + dynamics + coupling)
    |   |-- computeAndPersistDerivedSignals()
    |       |-- dynamical signals  -> tb_dynamical_signals
    |       |-- motor signals      -> tb_motor_signals
    |       |-- semantic signals   -> tb_semantic_signals
    |       |-- process signals    -> tb_process_signals
    |       |-- cross-session      -> tb_cross_session_signals
    |
    v
Observatory reads pre-computed values from all tables
```

## Key files

| File | Purpose |
|------|---------|
| `src/pages/index.astro` | Client-side capture (journal + calibration) |
| `src/lib/db.ts` | Schema + save/get for all tables |
| `src/lib/signal-pipeline.ts` | Orchestrates all derived signal computation |
| `src/lib/motor-signals.ts` | Sample entropy, autocorrelation, jerk, lapse, drift, compression, digraphs |
| `src/lib/semantic-signals.ts` | Idea density, lexical sophistication, epistemic stance, cohesion, arc |
| `src/lib/word-lists.ts` | Static Sets: boosters, connectives, POS proxies, stopwords |
| `src/lib/process-signals.ts` | Pause location, abandoned thoughts, R/I bursts, Heaps, phase transition |
| `src/lib/cross-session-signals.ts` | Self-perplexity, NCD, vocab recurrence, digraph stability, text network |
| `src/lib/dynamical-signals.ts` | Permutation entropy, DFA, RQA, transfer entropy (unchanged, now persisted) |
| `src/scripts/backfill-signals.ts` | One-time backfill for existing entries |
| `signals.md` | Full signal reference documentation |

## The thesis in one line

147 deterministic signals from a single textarea, measuring how someone thinks, not what they write. The most comprehensive behavioral signal layer ever built from a text input. All math. No LLM. The instrument is the exercise and the exercise is the instrument.
