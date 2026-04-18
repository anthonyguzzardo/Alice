# Handoff: Phase 2 Signal Expansion (2026-04-18)

## What happened this session

Deep research across intelligence programs (DARPA, IARPA SCITE, BioCatch/Unit 8200), academic labs (Antwerp/Inputlog, BiAffect, neuroQWERTY, ScriptLog), startups (TypingDNA, nQ Medical, NeuraMetrix), and novel analytical techniques. Scored, ranked, and implemented the highest-priority signals. Signal count went from ~147 to ~163 captured, with architectural decisions locked for the Stage 1 paper.

## What was built

### Phase 2 Client-Side Capture (11 new columns on tb_session_summaries)
**Files changed:** `src/pages/index.astro`, `src/lib/db.ts`, `src/pages/api/respond.ts`, `src/pages/api/calibrate.ts`, `src/scripts/simulation-data.ts`

Both journal AND calibration paths capture identically. New signals:

**Mouse/cursor trajectory (BioCatch cognitive biometrics):**
- `cursor_distance_during_pauses` -- total mouse px during >2s pauses
- `cursor_fidget_ratio` -- cursorDistance / activeTypingMs
- `cursor_stillness_during_pauses` -- proportion of samples <5px movement
- `drift_to_submit_count` -- cursor entered submit button during pause then left
- `cursor_pause_sample_count` -- 200ms samples taken during pauses

**Precorrection/postcorrection latency (Springer 2021):**
- `deletion_execution_speed_mean` -- mean IKI within deletion chains (phase 2 of error correction)
- `postcorrection_latency_mean` -- mean ms from last delete to next insert (phase 3)

**Revision distance (ScriptLog, Lindgren & Sullivan 2006):**
- `mean_revision_distance` -- mean chars from leading edge per contextual revision
- `max_revision_distance` -- deepest revision in session

**Punctuation key latency (Plank 2016 COLING):**
- `punctuation_flight_mean` -- mean flight time before punctuation keys
- `punctuation_letter_ratio` -- punctuation flight / letter flight

### Phase 2 Motor Signals (5 new columns on tb_motor_signals)
**Files changed:** `src/lib/motor-signals.ts`, `src/lib/signal-pipeline.ts`, `src/lib/db.ts`

**Ex-Gaussian tau (BiAffect / Zulueta 2018):**
- `ex_gaussian_tau` -- exponential tail of flight time distribution (cognitive slowing)
- `ex_gaussian_mu` -- Gaussian mean (motor baseline speed)
- `ex_gaussian_sigma` -- Gaussian std (motor noise)
- `tau_proportion` -- tau / mean flight time (cognitive fraction)
- Uses Q3+3*IQR outlier removal before method-of-moments fitting (fixes heavy-tail blowup)

**Adjacent hold-time covariance (neuroQWERTY, Giancardo 2016):**
- `adjacent_hold_time_cov` -- Pearson corr of consecutive hold times (motor coordination)

### Backfill Script
**New file:** `scripts/backfill-motor-signals-phase2.ts`

Run: `npx tsx scripts/backfill-motor-signals-phase2.ts`

Idempotent. Updates existing tb_motor_signals rows with ex-Gaussian and adjacent hold-time covariance computed from stored keystroke streams. Already run against all 5 existing sessions.

### Observatory Updates
**Files changed:** `src/pages/observatory/entry/[id].astro`, `src/pages/api/observatory/entry/[id].ts`, `src/pages/api/observatory/states.ts`, `src/pages/observatory/trajectory.astro`

- Entry detail page: new **Motor signals** panel (tau, mu, sigma, tau proportion, adjacent hold cov, sample entropy, jerk, lapse, drift, compression) + new **Phase 2 signals** panel (all cursor/revision/punctuation/error correction signals)
- Entry API: sessionSummary SELECT now includes all Phase 1 + Phase 2 cursor/revision/punctuation columns
- States API: now returns `motor` and `phase2` objects per entry
- Trajectory page: new **Motor signals** chart section (6 time-series) + **Phase 2** chart section (5 time-series) with auto-scaling raw-value charts

### Signal Sandbox
**File changed:** `src/pages/dev/signals.astro`

Three new live sections: Mouse/Cursor (BioCatch), Error Correction (Springer 2021), Punctuation (Plank 2016). All update in real-time as you type.

### Documentation
- `signals.md` -- 16 new signal entries, count table updated to ~163
- `SIGNAL_EXPANSION.md` -- full research synthesis, scoring matrix, implementation roadmap for future phases

## Bugs fixed this session

- **Placeholder count mismatch:** saveSessionSummary had 81 placeholders for 80 columns. Fixed before it hit production.
- **Ex-Gaussian blowup:** Method-of-moments fails when skewness > ~3 (tau exceeds total std). Fixed with Q3+3*IQR outlier removal before fitting.
- **Entry page initialization error:** `const summary` declared after `phase2Panel` used it. Moved declaration before use.
- **Calibration missing Phase 2:** Calibration surface had its own separate signal capture block that wasn't updated. Added all Phase 2 tracking to calibration path.

## Architecture after this session

```
index.astro (client capture: journal + calibration)
    |
    |  ~80 columns captured client-side including Phase 2:
    |  mouse trajectory, precorrection/postcorrection,
    |  revision distance, punctuation latency
    |
    v
POST /api/respond  OR  POST /api/calibrate
    |
    |-- Transaction: save response, burst sequence, session events,
    |   session summary (80 cols), deletion events, session metadata
    |
    |-- Fire-and-forget:
    |   |-- embedResponse()
    |   |-- runGeneration()
    |   |-- renderWitnessState()
    |   |-- computeAndPersistDerivedSignals()
    |       |-- dynamical signals  -> tb_dynamical_signals (13 cols)
    |       |-- motor signals      -> tb_motor_signals (12 cols incl. ex-Gaussian + adj cov)
    |       |-- semantic signals   -> tb_semantic_signals (10 cols)
    |       |-- process signals    -> tb_process_signals (9 cols)
    |       |-- cross-session      -> tb_cross_session_signals (10 cols)
    |
    v
Observatory reads pre-computed values from all tables
    |-- Entry detail: 7D radar + 11D radar + metadata + dynamical + motor + phase2 + summary
    |-- Trajectory: behavioral + semantic + emotion + motor + phase2 time-series
    |-- States API: enriches with motor + phase2 objects per entry
```

## What's NOT done (deferred by design)

### Capture signals that can't be backfilled (data lost for days 1-5)
Mouse trajectory, precorrection/postcorrection, revision distance, punctuation latency were added on day 6. First 5 entries have nulls. Note in paper methods section.

### Backfill analysis pass (can be done anytime, raw data stored)
MF-DFA, multiscale entropy, cross-recurrence (CRQA), Markov transition entropy rate, visibility graph, symbolic dynamics, wavelet energy ratio. All computed from `tb_session_events.keystroke_stream_json` which has been stored since day 1. Build one script, run once, backfill all sessions. No rush.

### Circadian-adjusted baselines (must decide before day 30)
Store both global z-scores AND circadian z-scores in parallel. Add `bucket_session_count` stamp for trustworthiness filtering. This changes the z-scoring denominator for all 7D + 11D dimensions. The other model correctly flagged this as a measurement definition, not an optimization.

### Question-as-treatment-variable (post-hoc, not formalized)
Tag question properties retroactively after 90 days. Don't condition generation on behavioral response during Stage 1. Paper stays "passive instrument." Treatment-variable analysis goes in discussion or second paper.

### Joint behavioral-semantic embedding (Phase 6)
Concatenate state vectors with text embeddings for cognitive-mode-aware RAG. Deferred until signal set is mature.

### Acoustic keystroke force (excluded from Stage 1)
Opt-in mic permission breaks monastic UX. Selection bias. Wrong for validation paper.

## Paper framing (from external review)

- **7D behavioral as spine.** 11D semantic as parallel validation with explicit granularity caveat on short-text NRC densities.
- **Report expanded signal set.** Raw capture substrate was stored from day 1. Backfill signals are analysis of that substrate, not "new signals added mid-study." Tier 2 capture additions (day 6+) noted in methods.
- **Three tiers in methods:** (1) captured from day 1, analyzed from stored data; (2) new capture added day 6, available 85/90 days; (3) not captured (acoustic force).

## Known issues

- `data/errors.log` has 70 lines of stale errors from a prior backfill script (`no such column: response_text`). These trigger red status on the pipeline health endpoint. Clear the file or the health check will stay red.
- Simulation script (`src/scripts/simulation-data.ts`) has been updated with null stubs for all Phase 1 + Phase 2 fields but doesn't generate realistic values for them.

## Key files changed this session

| File | What changed |
|------|-------------|
| `src/pages/index.astro` | Phase 2 capture (journal + calibration paths) |
| `src/lib/db.ts` | 11 new tb_session_summaries cols, 5 new tb_motor_signals cols, migrations |
| `src/lib/motor-signals.ts` | Ex-Gaussian tau fitting + adjacent hold-time covariance |
| `src/lib/signal-pipeline.ts` | Pass new motor signals through |
| `src/pages/api/respond.ts` | Pass Phase 2 fields to saveSessionSummary |
| `src/pages/api/calibrate.ts` | Pass Phase 2 fields to saveSessionSummary |
| `src/scripts/simulation-data.ts` | Null stubs for Phase 1 + Phase 2 fields |
| `src/pages/dev/signals.astro` | 3 new live metric sections |
| `src/pages/observatory/entry/[id].astro` | Motor + Phase 2 panels |
| `src/pages/api/observatory/entry/[id].ts` | Phase 2 columns in SELECT |
| `src/pages/api/observatory/states.ts` | Motor + Phase 2 joins |
| `src/pages/observatory/trajectory.astro` | Motor + Phase 2 trajectory charts |
| `scripts/backfill-motor-signals-phase2.ts` | One-time backfill for ex-Gaussian + adj cov |
| `signals.md` | 16 new signal entries, count ~163 |
| `SIGNAL_EXPANSION.md` | Full research synthesis + scoring + roadmap |
