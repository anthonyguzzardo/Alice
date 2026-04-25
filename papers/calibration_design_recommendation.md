---
title: "Calibration Design Recommendation"
slug: calibration-design-recommendation
author: Anthony Guzzardo
date: 2026-04-24
status: draft
version: 1
---

# Calibration Design Recommendation

The Phase 1 confound battery surfaced two structural problems: a 2.5x length asymmetry between journal and calibration sessions, and a systematic 10-hour time-of-day gap with fixed journal-first ordering. Three options for addressing the length asymmetry, plus an ordering recommendation.

---

## Option A: Extend the calibration prompt to target equal length

**What it does.** Add a target word count or minimum writing time to the calibration UI. The current calibration sessions average 56 words and 97 seconds. Journal sessions average 146 words and 240 seconds. A floor of "write for at least 2 minutes" or "aim for 100+ words" would narrow the gap.

**What it fixes.** Eliminates the series-length confound for all dynamical signals. No post-hoc length-matching needed. Increases the number of calibration sessions with enough IKIs for advanced signals (MF-DFA needs 256+; currently only sessions from April 18 onward have this).

**What it doesn't fix.** Time-of-day gap. Fixed ordering. Potential change in the cognitive character of the calibration task: writing 150 words about a paperclip may shift from knowledge-telling to knowledge-transforming as the participant searches for things to say. The neutral task becomes less neutral.

**What it costs.** Doubles calibration session time from ~1.5 minutes to ~4 minutes. Increases daily instrument burden. May reduce compliance or introduce frustration, which itself becomes a confound.

**New confounds.** If the participant runs out of things to say and starts padding, the trailing portion of the calibration session has different cognitive properties than the natural portion. This creates a within-session inhomogeneity that doesn't exist in journal sessions (where the reflective question provides enough material for longer writing).

---

## Option B: Accept length asymmetry, standardize length-matching in analysis

**What it does.** Keep calibration sessions at their natural length. Apply the length-matched recomputation from the confound battery as a standard step in all delta analyses: truncate journal IKI series to calibration length before computing dynamical deltas.

**What it fixes.** Eliminates the series-length confound without changing the instrument. Preserves the natural character of both sessions. No increase in participant burden.

**What it doesn't fix.** Time-of-day gap. Fixed ordering. Wastes the majority of journal keystroke data for dynamical comparisons (only the first ~40% of keystrokes are used). Semantic signals (text-based) still use the full response and are not affected.

**What it costs.** Reduces statistical power for dynamical signals because the effective N per session drops from ~1150 IKIs to ~470. Signals requiring 256+ IKIs (MF-DFA) may fall below minimum thresholds on short calibration days. Requires discipline to always report both original and length-matched results.

**New confounds.** The first N keystrokes of a journal session may be systematically different from the calibration session's full keystroke stream. Journal opening behavior (high initial hesitation, false starts) differs from calibration opening behavior (immediate production of known content). Truncating to the first N keystrokes selects for journal opening behavior, which may not represent the session as a whole.

---

## Option C: Multiple short calibration sessions bracketing the journal

**What it does.** Instead of one calibration session per day, run two: one before the journal and one after. Each calibration session stays at its natural short length (~1-2 minutes). The pre-journal calibration controls for time-of-day and fatigue state at journal time. The post-journal calibration captures within-day change.

**What it fixes.** Time-of-day gap (pre-journal calibration is at the same time as journal). Fixed ordering (one calibration on each side). Enables a pre/post design: the delta between pre-journal calibration and journal isolates the question's effect at matched time-of-day; the delta between pre and post calibration isolates within-day change independent of the question.

**What it doesn't fix.** Length asymmetry persists (each calibration is still ~60 words). Requires length-matching for dynamical signals (same as Option B).

**What it costs.** Triples daily session count (from 2 to 3). Significantly increases instrument burden. Requires a new prompt selection mechanism to avoid giving two calibration prompts from the same category on the same day. The pre-journal calibration must not prime or contaminate the journal response (prompt must be from a different cognitive domain than the journal question).

**New confounds.** Practice effects within the day: the second calibration benefits from having already written once (journal) and once (first calibration). Priming: even a neutral calibration prompt before the journal may anchor the participant's cognitive state in a way that changes the journal response. The matched-pair design becomes a matched-triple design, complicating analysis.

---

## Recommendation

**Option B (accept asymmetry, standardize length-matching) for immediate use. Option A (extend calibration) for evaluation at n=25.**

Rationale: Option B costs nothing, introduces no new confounds, and the Phase 1 confound battery already demonstrated that length-matching works. The three artifact signals collapsed cleanly under truncation, confirming the method is valid. The surviving signal (integrative complexity) is text-based and unaffected by length-matching. For the dynamical family, length-matching is the honest analysis.

Option A should be evaluated, not implemented now. At n=25, if no dynamical signals survive length-matching, the length asymmetry is not just a confound but a design limitation that prevents dynamical delta analysis entirely. At that point, extending calibration to target equal length is warranted. But extending now, before establishing what the natural calibration length produces, would lose the ability to compare against the current baseline.

Option C is intellectually appealing but operationally heavy. A pre-journal calibration session solves the time-of-day confound cleanly, but the tripled daily burden risks compliance degradation. Defer unless the time-of-day regression becomes significant at larger N.

### Ordering

Independent of the length decision: randomize the order of journal and calibration within each day. If the participant is willing, alternate which comes first on odd vs even days. This breaks the fixed-ordering confound without requiring any code changes to the instrument (only a behavioral change in when the participant opens each session).

---

### Calibration drift and prompt rotation

Two signals show calibration baseline drift (DMD dominant frequency falling, lexical sophistication rising). The prompt pool is large (303 prompts across 12 categories) and already implements maximum-temporal-spacing recycling. With 56 calibration sessions over 12 days, the pool is not near exhaustion. The drift is more likely a participant familiarity effect with the calibration task itself (becoming more practiced at neutral writing) than a prompt repetition effect. Prompt rotation within the existing pool is already implemented and adequate. The drift should be monitored at replication checkpoints; if it accelerates or spreads to more signals, a redesign of the prompt categories (not just rotation within them) may be needed.
