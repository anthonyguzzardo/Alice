> **Note:** This document predates the renames: Marrow → Alice, Bob → Alice Negative, Einstein → Bob (2026-04-12).

# BOB_AUDIT V3 — Signal Pipeline Redesign

## What Was Wrong With V2

V2 expanded Bob from 18 to 36 signals and added a trajectory engine. The trajectory was the right idea. The signals feeding it were not.

### The normalizations were guesses

Every signal was divided by a hardcoded constant and clamped to [0,1]. `avgHesitation` divided by 60000ms. `avgDuration` divided by 600000ms. `avgWordCount` divided by 500. These numbers were invented before any real data existed. They defined the scale of what "normal" looked like without knowing what normal was.

The result: someone who hesitates 47 seconds and someone who hesitates 5 minutes produced the same clamped value. The interpreter received `0.783` and had to guess what it meant. The signal was technically correct and practically useless.

### Compound signals were ambiguous

`deletionIntensity` = total_chars_deleted / total_chars_typed. This conflated two completely different behaviors:
- 50 small backspaces fixing typos
- 2 large deletions where someone wrote a paragraph and killed it

Both could produce `deletionIntensity: 0.31`. A person correcting spelling and a person fighting with their own thoughts looked identical to the interpreter. The interpreter had to guess which one it was — and it shouldn't have to guess.

`commitmentRatio` had the same problem. `pauseFrequency` was a raw count not normalized by session length, so 3 pauses in a 2-minute session looked the same as 3 pauses in a 20-minute session.

### The interpreter was working with ambiguous inputs

The interpreter prompt was good. The guidelines for mapping signals to traits were thoughtful and well-tuned. The problem was upstream: the signals themselves carried ambiguity that no amount of prompt engineering could resolve. When Opus sees `hesitation: 0.783`, it doesn't know the actual time, doesn't know the personal baseline, doesn't know if this is a 2-sigma event or business as usual. It gets a float and vibes it.

### The trajectory dimensions were provably correlated

Engagement = (z(duration) + z(wordCount) + z(sentenceCount)) / 3. Those three are near-perfectly correlated: write more words → more sentences → takes longer. This was one signal measured three redundant ways, pretending to be a dimension.

Processing = z(firstKeystrokeMs). A single raw measurement. One phone notification and it's noise.

These weren't four independent dimensions. They were two-and-a-half proxies for "output volume" plus two thin signals.

### The pause threshold was wrong

The system tracked pauses at a 30-second threshold. The standard in writing process research is 2 seconds. At 30 seconds, we were capturing "breaks" — someone getting up, making coffee. All the meaningful cognitive processing pauses (the ones that predict writing quality and indicate deliberation) were invisible.

### The event stream was wasted

`tb_interaction_events` captured every keystroke, deletion, pause, and tab event with timestamps. This raw temporal data was written to the database and then ignored. The session summary flattened it into aggregates and threw away the shape of composition — when deletions happened, burst patterns, revision timing.

### TTR was length-dependent

`vocabularyRichness` used a raw type-token ratio. TTR decreases mechanically as text gets longer — longer entries always had lower diversity scores regardless of actual vocabulary. This confounded lexical diversity with word count.

---

## What V3 Changes

### Percentile normalization replaces hardcoded divisors

Every signal is now normalized against the person's own history using percentile rank. If your average hesitation is 47 seconds and the signal reports 0.65, that means 65% of your sessions had lower hesitation than your average. The scale is defined by your data, not by a guess.

### Deletion decomposition (Faigley & Witte taxonomy)

Small deletions (<10 chars) are tracked separately as **corrections** (typo fixes). Large deletions (>=10 chars) are tracked as **revisions** (substantive rethinking). The interpreter now sees "3 corrections, 1 large revision of 84 chars" instead of "deletion intensity: 0.31."

**Revision timing** is new: tracks whether large deletions happened in the first half of the session (false starts — couldn't begin) or the second half (gutted after drafting — wrote it and killed it). These are psychologically different.

### P-burst tracking (Chenoweth & Hayes, 2001)

Text produced between 2-second pauses ("P-bursts") is the single strongest behavioral predictor of writing quality in writing process research. The client now tracks burst boundaries at a 2-second threshold and reports:
- `pBurstCount` — number of distinct production bursts
- `avgPBurstLength` — mean burst length in characters

The existing 30-second pause tracking remains as "break" events — still meaningful as a different signal.

### Active typing time

`activeTypingMs` = total duration minus pause time minus tab-away time. All behavioral rates (pauses per minute, deletions per 100 chars, chars per minute) are now computed against active time, removing session length as a confound.

### MATTR replaces TTR (McCarthy & Jarvis, 2010)

Moving-Average Type-Token Ratio with a 25-word window. Validated as length-independent for texts of 100-500 words. A 200-word entry and a 400-word entry are now comparable.

### Context-rich interpreter input

The interpreter now receives each signal with its raw value, personal baseline, and z-score:

```
Commitment ratio: 0.72 (personal baseline: 0.81, z: -1.4 — kept less than usual)
Revisions: 1 large deletion (84 chars — substantive rewrite)
Corrections: 3 small deletions (<10 chars — typo fixes)
Typing speed: 42 chars/min active (personal avg: 38, percentile: 0.65)
P-burst length: avg 47 chars per burst (personal avg: 31, percentile: 0.82)
```

The system prompt guidelines are mostly unchanged — they were already good. The input format now removes the ambiguity that was forcing the interpreter to guess.

### Four independent trajectory dimensions

Based on Baaijen et al. (2012) PCA on 80 keystroke logs and Deane (2015) factor analysis on large-scale assessment data.

| V2 Dimension | V2 Problem | V3 Dimension | V3 Source |
|---|---|---|---|
| Engagement (duration + word count + sentence count) | Three correlated proxies for output volume | **Fluency** (P-burst length) | Chenoweth & Hayes (2001) — validated strongest predictor |
| Processing (first-keystroke latency only) | Single fragile signal | **Deliberation** (hesitation + pause rate/min + revision weight) | Deane (2015) — three sub-signals validated as independent factor |
| Revision (commitment ratio + deletion intensity) | Conflated corrections with revisions | **Revision** (commitment ratio + large deletion rate only) | Baaijen et al. (2012) — validated as independent factor |
| Structure (sentence length + question density + first-person density) | 3 components | **Expression** (+ hedging density, 4 components) | Extended with tentativeness marker |

---

## Research Basis

This redesign is informed by established writing process research, not intuition:

- **Baaijen, Galbraith & de Glopper (2012)** — PCA on 80 keystroke logs found 3 independent factors: planned text production, within-sentence revision, global text restructuring. Our V2 dimensions didn't map to any of these.
- **Deane (2015, ETS)** — Factor analysis on large-scale keystroke data found 3 process factors: latency/hesitancy, editing, burst span. R²=.68 predicting writing quality.
- **Chenoweth & Hayes (2001)** — Established P-bursts as the standard unit of analysis. Burst length is the strongest behavioral predictor of writing quality.
- **McCarthy & Jarvis (2010)** — Validated MATTR and HD-D as length-independent lexical diversity measures. TTR fails for texts under 500 words.
- **Faigley & Witte (1981)** — Foundational revision taxonomy: surface changes (don't alter meaning) vs. text-base changes (alter meaning). Our small/large threshold is a practical proxy.
- **BiAffect / Zulueta et al. (2018)** — Validated backspace rate as correlate of mood disturbance from keystroke data.
- **Medimorec & Risko (2017)** — Pause location matters more than frequency, but since we're in a textarea we can't track location. We track rate per active minute instead.

---

## Files Changed

| File | Change |
|---|---|
| `scripts/migrate-session-summaries.ts` | **NEW** — migration adding 9 enriched columns to tb_session_summaries |
| `src/pages/index.astro` | Client capture: P-burst tracking, deletion decomposition, active typing time, revision timing |
| `src/lib/db.ts` | Schema, SessionSummaryInput interface, all CRUD helpers expanded |
| `src/pages/api/respond.ts` | Accepts 9 new session summary fields |
| `src/pages/api/calibrate.ts` | Same |
| `src/lib/bob/types.ts` | New BobSignal interface (percentile-normalized), BobSignalRaw for interpreter context |
| `src/pages/api/bob.ts` | Full rewrite — percentile normalization, MATTR, decomposed revision, P-bursts, _raw context |
| `src/lib/bob/interpreter.ts` | System prompt signal name updates, user message format with raw values + baselines + z-scores |
| `src/lib/bob/trajectory.ts` | New dimensions: fluency, deliberation, revision, expression |
| `src/pages/trajectory.astro` | Label renames |
| `src/pages/api/witness.ts` | Field reference updates |

## What's NOT in V3

- **Trajectory → generation integration.** The trajectory produces phase, convergence, velocity — but question generation doesn't consume it yet. That's the loop that isn't closed.
- **Trajectory → Einstein.** Einstein's personality should emerge from trajectory data, not raw signals. Conceptual — nothing built.
- **Sound.** Bob is still visual only.
- **Pause location tracking.** Research says where pauses happen (within-word vs. sentence boundary) matters more than frequency. We can't track this in a textarea without building a custom editor.
- **Cursor repositioning detection.** Lindgren & Sullivan (2006) distinguish pre-contextual revisions (at cursor) from contextual revisions (going back to earlier text). We can't detect this from textarea input events.

## Open Questions (V2 answers)

V2 asked:
1. *Should the baseline use all entries or a rolling window?* → V3 uses all entries. With percentile normalization, early entries naturally carry less weight as history grows. Rolling window is worth revisiting at 50+ entries.
2. *Should trajectory pass raw dimension values or just phase + convergence?* → Still open. Depends on what generation needs.
3. *Should structure use absolute z-scores?* → Yes. Expression (renamed from structure) uses absolute z-scores because we care about deviation magnitude, not direction. A shift toward more questions and fewer questions are both unusual.
