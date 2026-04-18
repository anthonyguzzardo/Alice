# Signal Reference

Technical specification of every signal Alice captures, how it is captured, and why it matters.

---

## Raw Production

### firstKeystrokeMs
- **Capture:** Elapsed time from page open to first `input` event with positive delta
- **Unit:** milliseconds
- **Why:** Measures initial hesitation, the gap between reading and committing to write. Long delays suggest the question landed somewhere uncomfortable or complex. Short delays suggest immediacy or familiarity.
- **Feeds:** 7D deliberation dimension
- **Citation:** Deane 2015

### totalDurationMs
- **Capture:** Page open timestamp to submit button click
- **Unit:** milliseconds
- **Why:** Wall-clock session length. Meaningful only in combination with active typing time, since raw duration includes pauses and tab-aways.
- **Feeds:** Active typing normalization

### activeTypingMs
- **Capture:** `totalDurationMs - totalPauseMs - totalTabAwayMs`
- **Unit:** milliseconds
- **Why:** Isolates genuine production time from thinking time and distraction time. This is the denominator for speed calculations. The pause bug we fixed on 2026-04-17 was inflating this value by failing to detect pauses after deleting to empty.
- **Feeds:** Speed normalization for charsPerMinute

### totalCharsTyped
- **Capture:** Cumulative sum of all positive `input` event deltas
- **Unit:** characters
- **Why:** Total production volume including deleted text. Combined with finalCharCount, reveals how much work happened beneath the surface.
- **Feeds:** 7D commitment (via commitmentRatio), revision weight

### finalCharCount
- **Capture:** `textarea.value.length` at submit
- **Unit:** characters
- **Why:** What survived. The gap between totalCharsTyped and finalCharCount is the invisible labor.
- **Feeds:** Observation-only

### wordCount
- **Capture:** Final text split on `/\s+/`
- **Unit:** words
- **Why:** Semantic density baseline. Short responses with high deletion counts tell a different story than short responses written quickly.
- **Feeds:** Observation-only, linguistic density denominators

### sentenceCount
- **Capture:** Final text split on `/[.!?]+/`
- **Unit:** sentences
- **Why:** Structural complexity indicator. Combined with wordCount, yields average sentence length.
- **Feeds:** Semantic space (syntactic_complexity)

### commitmentRatio
- **Capture:** `finalCharCount / totalCharsTyped`
- **Unit:** ratio [0, 1]
- **Why:** Fraction of typed text kept. Low commitment (0.3-0.5) means heavy revision, the writer is fighting with the material. High commitment (0.9+) means the words came out right the first time, or the writer did not care enough to revise.
- **Feeds:** 7D revision, 7D commitment

### charsPerMinute
- **Capture:** `totalCharsTyped / (activeTypingMs / 60000)`
- **Unit:** characters per minute
- **Why:** Active typing speed, excluding pauses and tab-aways. Speed shifts between sessions reveal cognitive load changes. Unusually slow typing often correlates with word-finding difficulty or emotional weight.
- **Feeds:** 7D fluency (fallback when P-burst data unavailable)
- **Citation:** Kim et al. 2024

---

## Pause and Engagement

### pauseCount
- **Capture:** Number of times the 30-second inactivity timer fires after at least one keystroke has occurred. The timer resets on every `input` event (including deletions, which is correct per Leijten & Van Waes 2013: deletion is active writing behavior).
- **Unit:** count
- **Why:** Pauses of 30+ seconds during writing indicate cognitive load, uncertainty, or emotional processing. The threshold distinguishes thinking-while-writing (normal inter-key gaps) from stopping-to-think (genuine pauses). Higher pause counts correlate with more deliberate, less fluent writing.
- **Feeds:** 7D deliberation (via pauseRatePerMinute), 7D presence (inverted)
- **Citation:** Czerwinski et al. 2004

### totalPauseMs
- **Capture:** Sum of all pause durations. Each pause starts when the 30-second timer fires and ends on the next `input` event.
- **Unit:** milliseconds
- **Why:** Total thinking time. Subtracted from totalDurationMs to compute activeTypingMs.
- **Feeds:** Speed normalization

### tabAwayCount
- **Capture:** `visibilitychange` events where `document.hidden` becomes true
- **Unit:** count
- **Why:** Each tab-away is a context switch. High tab-away counts during a short session suggest distraction or avoidance. Zero tab-aways suggest absorption.
- **Feeds:** 7D presence (inverted)

### totalTabAwayMs
- **Capture:** Sum of time between tab blur and tab focus events
- **Unit:** milliseconds
- **Why:** Total distraction time. Subtracted from totalDurationMs alongside pause time.
- **Feeds:** Speed normalization, 7D presence

---

## Deletion Decomposition

Based on Faigley & Witte (1981): not all deletions are the same. Small deletions (< 10 chars) are surface corrections, typo fixes. Large deletions (>= 10 chars) are substantive revisions, rethinking what you actually want to say.

### deletionCount
- **Capture:** Every `input` event where delta < 0
- **Unit:** count
- **Why:** Legacy total. Superseded by the small/large decomposition but retained for backward compatibility.
- **Feeds:** Legacy observation

### totalCharsDeleted
- **Capture:** Sum of `|delta|` for all negative-delta input events
- **Unit:** characters
- **Why:** Raw volume of removed text.
- **Feeds:** Legacy observation

### largestDeletion
- **Capture:** Maximum `|delta|` across all negative-delta input events
- **Unit:** characters
- **Why:** The single biggest cut. A 200-char deletion is a fundamentally different act than 200 single-char backspaces.
- **Feeds:** Observation-only

### smallDeletionCount
- **Capture:** Count of deletion events where `|delta|` < 10
- **Unit:** count
- **Why:** Surface corrections. Typos, minor word swaps. High counts indicate fast-but-sloppy typing or uncertainty about spelling/word choice. Does not indicate rethinking.
- **Feeds:** 7D thermal (correction rate = smallDeletionCount / (totalCharsTyped / 100))
- **Citation:** Faigley & Witte 1981

### largeDeletionCount
- **Capture:** Count of deletion events where `|delta|` >= 10
- **Unit:** count
- **Why:** Substantive revisions. Each one represents a decision that what you wrote was wrong, not just how you wrote it. These are the signal.
- **Feeds:** 7D revision (revision rate = largeDeletionCount / (totalCharsTyped / 100))
- **Citation:** Faigley & Witte 1981

### largeDeletionChars
- **Capture:** Sum of `|delta|` for deletions >= 10 chars
- **Unit:** characters
- **Why:** Total volume of substantive revision. Combined with totalCharsTyped, yields revision weight, which measures how much of the cognitive effort went into restructuring vs. producing.
- **Feeds:** 7D deliberation (revision weight = largeDeletionChars / totalCharsTyped)
- **Citation:** Faigley & Witte 1981

### firstHalfDeletionChars
- **Capture:** Large deletion chars occurring before the session midpoint (`pageOpenTime + totalDurationMs / 2`)
- **Unit:** characters
- **Why:** Early revisions suggest false starts, inability to find an opening. Combined with secondHalfDeletionChars, reveals revision timing.
- **Feeds:** 7D thermal (revision timing), knowledge-transforming detection
- **Citation:** Faigley & Witte 1981

### secondHalfDeletionChars
- **Capture:** Large deletion chars occurring after the session midpoint
- **Unit:** characters
- **Why:** Late revisions suggest the writer built something, then gutted it. This is the knowledge-transforming signature from Baaijen, Galbraith & de Glopper (2012): writing that generates new understanding tends to produce late-stage structural revision.
- **Feeds:** 7D thermal (revision timing), knowledge-transforming detection
- **Citation:** Faigley & Witte 1981, Baaijen et al. 2012

### deletionEvents
- **Capture:** Array of `{chars, time}` tuples for every deletion, with time as ms offset from page open
- **Unit:** array
- **Why:** Full temporal distribution of deletions. Fed into session metadata to classify deletion curve shape (early, late, terminal, bimodal, uniform).
- **Feeds:** Session metadata classification

---

## P-Bursts

A P-burst (production burst) is a continuous run of typing with no pause longer than 2 seconds. Each burst roughly maps to one "thought unit." The 2-second threshold comes from Chenoweth & Hayes (2001): gaps under 2 seconds are motor hesitation; gaps over 2 seconds are cognitive pauses between ideas.

### pBurstCount
- **Capture:** Number of bursts separated by 2+ second gaps during insertion (not deletion)
- **Unit:** count
- **Why:** How many discrete thought units the session produced. More bursts with shorter lengths suggest fragmented processing. Fewer bursts with longer lengths suggest flow.
- **Feeds:** Observation-only
- **Citation:** Chenoweth & Hayes 2001

### avgPBurstLength
- **Capture:** Mean characters per burst
- **Unit:** characters
- **Why:** The primary fluency signal. Longer bursts mean ideas are flowing without interruption. Short bursts mean stop-and-think processing. This is the single most validated behavioral writing signal in the research literature.
- **Feeds:** 7D fluency (primary driver)
- **Citation:** Chenoweth & Hayes 2001

### burstSequence
- **Capture:** Array of `{chars, startOffsetMs, durationMs}` per burst
- **Unit:** array
- **Why:** Full temporal burst structure. Used to detect burst consolidation (the knowledge-transforming signature: short fragmented bursts early, longer sustained bursts later as thinking consolidates during writing).
- **Feeds:** Session metadata (burst trajectory shape), knowledge-transforming detection
- **Citation:** Chenoweth & Hayes 2001, Baaijen et al. 2012

---

## Keystroke Dynamics

### interKeyIntervalMean
- **Capture:** Mean of gaps between consecutive non-repeat `keydown` events, filtered to < 5 seconds
- **Unit:** milliseconds
- **Why:** Average hesitation between keystrokes. Slower intervals indicate deliberate word retrieval or cognitive load. Faster intervals indicate automatic production.
- **Feeds:** Observation-only
- **Citation:** Epp et al. 2011

### interKeyIntervalStd
- **Capture:** Standard deviation of inter-key intervals
- **Unit:** milliseconds
- **Why:** Rhythm variability. High variability (CV > 0.8) suggests cognitive switching or hesitation patterns. Low variability (CV < 0.4) suggests flow state or automatic writing.
- **Feeds:** Observation-only
- **Citation:** Epp et al. 2011

### holdTimeMean / holdTimeStd
- **Capture:** Duration from `keydown` to `keyup` per key, capped at 2 seconds. Tracked via a Map keyed by `e.code`. Auto-repeat events (`e.repeat`) are excluded.
- **Unit:** milliseconds
- **Why:** Hold time measures motor execution, how long the finger physically presses the key. It is largely independent of cognitive planning. Changes in hold time across sessions may reflect fatigue, motor state, or physical tension.
- **Feeds:** Observation-only, dynamical signals (transfer entropy source)
- **Citation:** Kim et al. 2024 (JMIR)

### flightTimeMean / flightTimeStd
- **Capture:** Duration from previous `keyup` to current `keydown`, capped at 5 seconds
- **Unit:** milliseconds
- **Why:** Flight time measures the gap between releasing one key and pressing the next, the cognitive planning interval. This is where word retrieval, syntactic planning, and hesitation live. Flight time dominance (high flight-to-hold ratio) indicates deliberate, top-down writing.
- **Feeds:** Observation-only, dynamical signals (transfer entropy source)
- **Citation:** Kim et al. 2024 (JMIR)

### keystrokeEntropy
- **Capture:** Shannon entropy of the IKI distribution, binned into 40 bins of 50ms width over 0-2000ms range
- **Unit:** bits
- **Why:** Measures typing rhythm unpredictability. High entropy means irregular timing, each keystroke interval is different. Low entropy means metronomic regularity. A proxy for cognitive complexity of the ongoing writing process.
- **Feeds:** Observation-only
- **Citation:** Ajilore et al. 2025 (BiAffect)

---

## Revision Chains

### revisionChainCount
- **Capture:** Number of sequential deletion keystroke runs where consecutive backspace/delete keys occur within 500ms of each other
- **Unit:** count
- **Why:** Each chain is one revision episode. More chains means more revision attempts, which maps to iterative rethinking. One chain of 20 deletions is different from 10 chains of 2 deletions.
- **Feeds:** Observation-only
- **Citation:** Leijten & Van Waes 2013

### revisionChainAvgLength
- **Capture:** Mean keystrokes per revision chain
- **Unit:** keystrokes
- **Why:** Chain length reveals revision depth. Short chains (1-2) are surface correction (typo fixing). Long chains (5+) are deep structural revision, rethinking, not fixing.
- **Feeds:** Observation-only
- **Citation:** Leijten & Van Waes 2013

---

## Re-engagement Behavior

### scrollBackCount
- **Capture:** Textarea `scroll` events where `scrollTop` decreased (user scrolled up to re-read their own text)
- **Unit:** count
- **Why:** Metacognitive monitoring. Re-reading your own text mid-session correlates with deeper engagement and higher-quality revision. The writer is checking their work against their intent.
- **Feeds:** Observation-only
- **Citation:** Czerwinski et al. 2004, Bereiter & Scardamalia 1987

### questionRereadCount
- **Capture:** Window `scroll` events where `scrollY < 50` while text has been entered (user scrolled up to re-read the question prompt)
- **Unit:** count
- **Why:** Recalibrating against the prompt. Returning to the question after writing suggests the response is being shaped by the question rather than free-associating away from it.
- **Feeds:** Observation-only
- **Citation:** Bereiter & Scardamalia 1987

---

## Raw Keystroke Stream

### keystrokeStream
- **Capture:** Array of `{c: e.code, d: downOffsetMs, u: upOffsetMs}` tuples, recorded in the `keyup` handler when hold time is valid (> 0, < 2000ms). Offset is relative to page open.
- **Unit:** array of objects
- **Why:** The raw material for dynamical signal computation. Every other keystroke signal (IKI mean, hold time mean, etc.) is a summary statistic that collapses the temporal structure. The raw stream preserves sequential dependencies, fractal scaling, recurrence patterns, and causal coupling between motor and cognitive channels. This is the difference between knowing "average temperature was 72F" and having the minute-by-minute weather record.
- **Feeds:** Dynamical signals (permutation entropy, DFA, RQA, transfer entropy)
- **Citation:** Enables Peng et al. 1994, Bandt & Pompe 2002, Webber & Zbilut 2005, Schreiber 2000

### eventLog
- **Capture:** Delta-encoded array of `[offsetMs, cursorPos, deletedCount, insertedText]` tuples, recorded on every `input` event. No cap, no decimation. Captured for both journal and calibration sessions. Legacy sessions (pre-2026-04-17) used snapshot format `[offsetMs, fullText]` with a 5000-entry cap and decimation; the playback API detects format automatically and reconstructs full text from deltas.
- **Unit:** array of tuples
- **Why:** Full text-state replay substrate. Enables read-only playback of the writing session at original tempo. Delta encoding reduces per-event payload from hundreds of bytes (full text snapshot growing with response length) to ~20-30 bytes, eliminating the need for caps or decimation at any typing speed or session length. Also enables post-hoc pause detection (gaps between consecutive events), deletion reconstruction, and IKI approximation for sessions that predate keystroke stream capture.
- **Feeds:** Playback, post-hoc analysis

---

## Linguistic Densities

Computed server-side from the final submitted text using lexicon-based word matching.

### nrcAngerDensity / nrcFearDensity / nrcJoyDensity / nrcSadnessDensity / nrcTrustDensity / nrcAnticipationDensity
- **Capture:** Count of words matching the NRC Emotion Lexicon for each emotion category, divided by total word count
- **Unit:** density [0, 1]
- **Why:** Word-level emotional content. The absolute values matter less than trajectories over time. A single session's anger density of 0.03 is meaningless; a shift from 0.01 baseline to 0.05 is signal.
- **Feeds:** 11D semantic state (one dimension per emotion)
- **Citation:** Mohammad & Turney 2013

### cognitiveDensity
- **Capture:** Count of cognitive mechanism words (think, realize, because, know, understand, consider, etc.) divided by total words
- **Unit:** density [0, 1]
- **Why:** Causal reasoning intensity. High cognitive density indicates the writer is explaining, analyzing, or making sense of something rather than describing or narrating.
- **Feeds:** 11D semantic state (cognitive_processing), knowledge-transforming detection
- **Citation:** Pennebaker 1997

### hedgingDensity
- **Capture:** Count of uncertainty words (maybe, perhaps, might, possibly, probably, sort of, etc.) divided by total words
- **Unit:** density [0, 1]
- **Why:** Linguistic uncertainty. High hedging suggests the writer is holding conclusions loosely, qualifying claims, or genuinely unsure. Low hedging suggests conviction or disengagement.
- **Feeds:** 11D semantic state (uncertainty)
- **Citation:** Pennebaker 1997

### firstPersonDensity
- **Capture:** Count of first-person pronouns (I, me, my, mine, we, us, our) divided by total words
- **Unit:** density [0, 1]
- **Why:** Self-focus. Elevated first-person density is one of the most robust linguistic markers of emotional processing and self-reflection. Depressed individuals show higher first-person singular density; people in flow show lower.
- **Feeds:** 11D semantic state (self_focus)
- **Citation:** Pennebaker 1997

### mattr
- **Capture:** Moving-Average Type-Token Ratio computed over a sliding window of 25 words
- **Unit:** ratio [0, 1]
- **Why:** Vocabulary diversity independent of text length (unlike raw TTR which decreases with length). High MATTR means the writer is drawing from a wider vocabulary, which correlates with cognitive flexibility and knowledge-transforming writing.
- **Feeds:** Observation-only, knowledge-transforming detection
- **Citation:** McCarthy & Jarvis 2010

### avgSentenceLength
- **Capture:** Total words divided by sentence count
- **Unit:** words per sentence
- **Why:** Syntactic complexity proxy. Longer sentences indicate more complex embedding and subordination. Short sentences indicate declarative, paratactic style.
- **Feeds:** 11D semantic state (syntactic_complexity)
- **Citation:** Biber 1988

### sentenceLengthVariance
- **Capture:** Variance of individual sentence word counts
- **Unit:** variance
- **Why:** Syntactic regularity. Low variance means uniform sentence structure (each sentence about the same length). High variance means mixed structure, some short punchy sentences interleaved with long complex ones.
- **Feeds:** Observation-only
- **Citation:** Biber 1988

---

## Session Metadata

Derived server-side from burst sequences and deletion event timestamps.

### hour_typicality
- **Capture:** Z-score of the session's hour against the personal hour density distribution (24-bin, circular-smoothed)
- **Unit:** z-score
- **Why:** Writing at an unusual hour (3am when you normally write at 2pm) is context. It does not tell you what is happening, but it tells you something is different.
- **Feeds:** Observation-only

### deletion_curve_type
- **Capture:** Classification of deletion event temporal distribution into: early, late, terminal, bimodal, uniform
- **Unit:** categorical
- **Why:** When during the session deletions cluster reveals the revision strategy. Early = false starts. Late = wrote then gutted. Terminal = last-minute cleanup. Bimodal = two distinct revision phases.
- **Feeds:** Observation-only
- **Citation:** Faigley & Witte 1981

### burst_trajectory_shape
- **Capture:** Classification of P-burst length sequence into: monotonic_up, monotonic_down, u_shaped, inverted_u, flat, none
- **Unit:** categorical
- **Why:** Monotonic up (short bursts then longer ones) is the knowledge-transforming signature: fragmented thinking consolidating into flow. Monotonic down is the reverse: starting fluent and losing coherence.
- **Feeds:** Observation-only
- **Citation:** Baaijen et al. 2012

### inter_burst_interval_mean_ms / inter_burst_interval_std_ms
- **Capture:** Mean and standard deviation of gaps between consecutive burst boundaries
- **Unit:** milliseconds
- **Why:** How long the writer pauses between thought units. Long, variable gaps suggest deep between-burst processing. Short, consistent gaps suggest rapid-fire idea generation.
- **Feeds:** Observation-only
- **Citation:** Chenoweth & Hayes 2001

### deletion_during_burst_count / deletion_between_burst_count
- **Capture:** Count of deletion events occurring within burst windows vs. between bursts
- **Unit:** count
- **Why:** Deletions during bursts are inline corrections (fix as you go). Deletions between bursts are retrospective revision (go back and change what you wrote). The ratio reveals the revision mode.
- **Feeds:** Observation-only

---

## 7D Behavioral State Engine

All dimensions are z-scored against personal history. No AI. Pure math.

### fluency
- **Composition:** `z(avgPBurstLength)` when P-burst data exists; `z(charsPerMinute)` as fallback
- **Why:** Sustained production flow. Positive fluency means longer-than-usual bursts, the ideas are coming faster than you can type them. Negative fluency means fragmented, stop-and-think processing.
- **Citation:** Chenoweth & Hayes 2001, Deane 2015

### deliberation
- **Composition:** `(z(firstKeystrokeMs) + z(pauseRatePerMinute) + z(revisionWeight)) / 3`
- **Why:** Cognitive load composite. High deliberation means long initial hesitation + frequent pauses + heavy revision weight. The writer is working hard. Low deliberation means quick start, few pauses, light revision, the words came easily.
- **Citation:** Deane 2015

### revision
- **Composition:** `(-z(commitmentRatio) + z(revisionRate)) / 2`
- **Why:** Substantive editing intensity. High revision means low commitment ratio + high substantive deletion rate. The writer is restructuring, not just producing.
- **Citation:** Baaijen et al. 2012

### commitment
- **Composition:** `z(commitmentRatio)`
- **Why:** How much the writer kept of what they typed. Positive commitment means above-baseline retention. Negative means below-baseline, more was discarded than usual.

### volatility
- **Composition:** Euclidean distance from the previous entry's state in the 4D subspace of fluency, deliberation, revision, commitment
- **Why:** Session-to-session behavioral instability. High volatility means your writing behavior shifted dramatically from last time. Low volatility means consistency. Persistent high volatility may indicate external disruption.

### thermal
- **Composition:** `(z(correctionRate) + z(revisionTiming)) / 2`
- **Why:** Editing heat. High thermal means lots of surface corrections AND late-stage revision. The writer is both sloppy and restructuring, a high-friction session. Named for the thermodynamic metaphor: high thermal = high entropy editing.
- **Citation:** Faigley & Witte 1981

### presence
- **Composition:** `-(z(tabAwayRate) + z(pauseRatePerMinute)) / 2`
- **Why:** Inverse distraction. High presence means few tab-aways and few pauses, sustained focus. Low presence means frequent interruptions or thinking breaks. Negated so that higher values mean more present.
- **Citation:** Czerwinski et al. 2004

### convergence
- **Composition:** Euclidean distance from personal center in 7D space, normalized to [0, 1] by dividing by 5.6
- **Why:** When multiple dimensions move together, something real is happening. High convergence means the session was unusual across several behavioral axes simultaneously, not just one noisy metric spiking.

---

## 11D Semantic State Engine

All dimensions are z-scored against personal history. Kept orthogonal to the behavioral space at construction time.

| Dimension | Input | Citation |
|---|---|---|
| syntactic_complexity | z(avgSentenceLength) | Biber 1988 |
| interrogation | z(questionDensity) | Biber 1988 |
| self_focus | z(firstPersonDensity) | Pennebaker 1997 |
| uncertainty | z(hedgingDensity) | Pennebaker 1997 |
| cognitive_processing | z(cognitiveDensity) | Pennebaker 1997 |
| nrc_anger | z(nrcAngerDensity) | Mohammad & Turney 2013 |
| nrc_fear | z(nrcFearDensity) | Mohammad & Turney 2013 |
| nrc_joy | z(nrcJoyDensity) | Mohammad & Turney 2013 |
| nrc_sadness | z(nrcSadnessDensity) | Mohammad & Turney 2013 |
| nrc_trust | z(nrcTrustDensity) | Mohammad & Turney 2013 |
| nrc_anticipation | z(nrcAnticipationDensity) | Mohammad & Turney 2013 |

---

## Dynamical Signals

Computed from the raw keystroke stream. These treat the IKI series as the output of a complex adaptive system rather than a bag of statistics.

### permutationEntropy
- **Computation:** Bandt & Pompe ordinal pattern distribution. Takes every consecutive triplet of IKI values, classifies by rank order (6 possible patterns for order-3), computes Shannon entropy of the pattern distribution, normalizes by log2(3!) = 2.585 bits.
- **Unit:** normalized [0, 1]
- **Why:** Captures temporal structure that mean/std completely miss. High permutation entropy means all ordinal patterns are equally likely, genuinely novel composition with no temporal habits. Low permutation entropy means certain patterns dominate, habitual rhythm, cognitive autopilot. Invariant to nonlinear distortions of the signal (robust to device differences, fatigue, caffeine).
- **Minimum series:** 50 IKI values
- **Citation:** Bandt & Pompe 2002

### dfaAlpha
- **Computation:** Detrended Fluctuation Analysis. Integrates the mean-subtracted IKI series, divides into boxes of logarithmically spaced sizes, detrends each box with linear regression, computes RMS fluctuation per box size, regresses log(fluctuation) on log(box size). The slope is alpha.
- **Unit:** exponent
- **Why:** Measures whether keystroke timing has fractal structure (1/f noise). Alpha ~ 0.5 = white noise, no temporal structure, each interval independent (copying or rehearsed content). Alpha ~ 0.7-0.9 = pink noise, long-range correlations, healthy engaged cognition. Alpha ~ 1.0-1.5 = brown noise, over-correlated, locked drift (perseveration or high cognitive load). The DFA exponent shifts under cognitive load, emotional arousal, and fatigue before any summary statistic moves.
- **Minimum series:** 50 IKI values
- **Citation:** Peng et al. 1994, Van Orden, Holden & Turvey 2003, Gilden 2001

### rqaDeterminism
- **Computation:** Recurrence Quantification Analysis. Builds a recurrence matrix (which IKI values are within 20% of std of each other), identifies diagonal lines of length >= 2 in the recurrence plot. Determinism = diagonal line points / total recurrence points.
- **Unit:** ratio [0, 1]
- **Why:** How much of the cognitive trajectory follows predictable paths. High determinism means structured, repeatable cognitive process, the system revisits similar states in similar sequences. Low determinism means exploratory, chaotic processing.
- **Minimum series:** 30 IKI values
- **Citation:** Webber & Zbilut 2005

### rqaLaminarity
- **Computation:** Vertical line density in the recurrence matrix. Vertical lines indicate the system getting "stuck" in a state.
- **Unit:** ratio [0, 1]
- **Why:** Cognitive fixation. High laminarity means the system enters states and stays there, rumination or deep absorption. Low laminarity means fluid transitions between states.
- **Minimum series:** 30 IKI values
- **Citation:** Webber & Zbilut 2005

### rqaTrappingTime
- **Computation:** Mean length of vertical lines in the recurrence matrix
- **Unit:** mean laminar state length
- **Why:** Average duration of fixation episodes. Long trapping time = deep absorption in a single cognitive state. Short trapping time = rapid scanning across states.
- **Minimum series:** 30 IKI values
- **Citation:** Webber & Zbilut 2005

### rqaRecurrenceRate
- **Computation:** Total recurrence points / possible pairs in the recurrence matrix
- **Unit:** ratio [0, 1]
- **Why:** Overall density of the recurrence structure. Higher rates mean the system frequently revisits similar timing states.
- **Minimum series:** 30 IKI values
- **Citation:** Webber & Zbilut 2005

### teHoldToFlight (transfer entropy: motor to cognitive)
- **Computation:** Binned transfer entropy estimation. Discretizes hold times and flight times into 3 levels (terciles), computes conditional mutual information: how much does knowing the previous hold time reduce uncertainty about the next flight time, beyond what the previous flight time already tells you.
- **Unit:** bits
- **Why:** Measures directed causal information flow from motor execution to cognitive planning. High TE(hold to flight) means the physical act of pressing keys is driving the thinking rhythm. The fingers know what to do before the mind catches up, automatic, bottom-up production.
- **Minimum series:** 30 hold/flight pairs
- **Citation:** Schreiber 2000, Kraskov et al. 2004

### teFlightToHold (transfer entropy: cognitive to motor)
- **Computation:** Same as above, reversed direction. How much does knowing the previous flight time reduce uncertainty about the next hold time.
- **Unit:** bits
- **Why:** Measures directed causal information flow from cognitive planning to motor execution. High TE(flight to hold) means thinking is driving typing, every keystroke is being "decided." Deliberate, top-down writing.
- **Minimum series:** 30 hold/flight pairs
- **Citation:** Schreiber 2000

### teDominance
- **Computation:** `teHoldToFlight / teFlightToHold`
- **Unit:** ratio
- **Why:** Which direction of causal coupling dominates. > 1 means motor drives cognitive (automatic writing). < 1 means cognitive drives motor (deliberate writing). The shift in this ratio within or across sessions tracks the transition between controlled and automatic processing.
- **Citation:** Schreiber 2000

---

## Calibration Context

Extracted from calibration (free-write) responses via Claude Sonnet. These are categorical life-context tags, not continuous signals. They exist so that behavioral patterns can be clustered against external conditions.

| Dimension | Valid Values | Citation |
|---|---|---|
| sleep | good, poor, disrupted, insufficient, restless, late_night, early_wake, oversleep | Pilcher & Huffcutt 1996 |
| physical_state | energetic, fatigued, sick, pain, rested, sluggish, headache, hungover, well_rested | Moriarty et al. 2011 |
| emotional_event | positive_event, negative_event, exciting_news, disappointing_news, achievement, loss, surprise | Amabile et al. 2005 |
| social_quality | meaningful_connection, isolation, conflict, positive_interaction, family_time, loneliness | Reis et al. 2000 |
| stress | high, moderate, low, work_pressure, deadline, overwhelmed, calm, demanding_day | Sliwinski et al. 2009 |
| exercise | done, skipped, light, intense, walk, run, gym, active_day, sedentary | Hillman et al. 2008 |
| routine | normal, disrupted, rushed, lazy, productive, chaotic, travel, schedule_change | Torous et al. 2016 |

---

## Device and Temporal Context

### deviceType
- **Capture:** Regex test on `navigator.userAgent` for mobile indicators
- **Unit:** `desktop` or `mobile`
- **Why:** Typing behavior differs fundamentally between keyboard and touchscreen. All behavioral baselines and percentiles should be device-matched.

### hourOfDay
- **Capture:** `new Date().getHours()` at page open
- **Unit:** hour [0-23]
- **Why:** Time-of-day context. Combined across sessions, enables hour typicality scoring.

### dayOfWeek
- **Capture:** `new Date().getDay()` at page open
- **Unit:** day [0-6, Sunday=0]
- **Why:** Day-of-week context.

---

---

## Cursor Behavior and Writing Process (Phase 1 Expansion, 2026-04-17)

### confirmationLatencyMs
- **Capture:** `submitTime - lastInputTime`
- **Unit:** milliseconds
- **Why:** The hesitation between finishing writing and pressing submit. Measures the "is it done?" metacognitive moment. Validated by Monaro et al. 2018 (95% deception detection accuracy).
- **Table:** tb_session_summaries
- **Citation:** Monaro et al. 2018

### pasteCount
- **Capture:** `paste` event listener on textarea with `e.preventDefault()`. Paste is **blocked at the interface level**; the text never enters the box. Attempts are still counted.
- **Unit:** count (of blocked attempts)
- **Why:** Construct isolation, not construct compliance. Paste being structurally impossible means every downstream signal is guaranteed to reflect unmediated cognitive production. The attempt count is itself a signal: it measures moments of construct pressure where the writer reached for cognitive offloading and was forced to continue producing unaided. Sessions with elevated attempt counts likely have distinctive signatures in the keystroke stream immediately following the blocked attempt.
- **Table:** tb_session_summaries

### pasteCharsTotal
- **Capture:** Sum of `e.clipboardData.getData('text/plain').length` across blocked paste attempts. Records what was attempted, not what entered the box.
- **Unit:** characters
- **Why:** The volume of text the writer tried to offload. A blocked paste of 3 characters is a typo shortcut. A blocked paste of 200 characters is an attempt to import external thinking.
- **Table:** tb_session_summaries

### readBackCount
- **Capture:** `selectionchange` events where cursor moves but no `input` follows within 500ms
- **Unit:** count
- **Why:** Metacognitive monitoring. The writer re-reads what they wrote without changing it. Pure observation behavior that produces no text trace.
- **Table:** tb_session_summaries
- **Citation:** Lindgren & Sullivan 2006

### leadingEdgeRatio
- **Capture:** `leadingEdgeInputCount / totalInputActionCount` where leading edge = `selectionStart >= value.length`
- **Unit:** ratio (0-1)
- **Why:** Writing linearity. 1.0 = perfectly linear (knowledge-telling). Lower = recursive, navigating back to restructure (knowledge-transforming).
- **Table:** tb_session_summaries
- **Citation:** Galbraith 2009

### contextualRevisionCount
- **Capture:** Deletions where `selectionStart < value.length - 1` (navigated back into text)
- **Unit:** count
- **Why:** Higher-order review and restructuring. Distinguished from pre-contextual revision (immediate self-correction at leading edge).
- **Table:** tb_session_summaries
- **Citation:** Lindgren & Sullivan 2006

### preContextualRevisionCount
- **Capture:** Deletions at leading edge (`selectionStart >= value.length - 1`)
- **Unit:** count
- **Why:** Immediate self-monitoring during formulation.
- **Table:** tb_session_summaries

### consideredAndKeptCount
- **Capture:** `selectionchange` events where a range selection collapses without deletion
- **Unit:** count
- **Why:** The writer selected text, considered cutting it, and decided it stays. A decision-confidence signal that captures deliberation producing no text change.
- **Table:** tb_session_summaries

### holdTimeMeanLeft / holdTimeMeanRight / holdTimeStdLeft / holdTimeStdRight
- **Capture:** Hold times partitioned by QWERTY left/right hand key mapping
- **Unit:** milliseconds
- **Why:** Motor laterality asymmetry. Non-dominant hand degrades first under cognitive load. Increasing asymmetry may indicate motor decline or sustained stress.
- **Table:** tb_session_summaries
- **Citation:** Giancardo et al. 2016 (neuroQWERTY)

### holdTimeCV
- **Capture:** `holdTimeStd / holdTimeMean`
- **Unit:** dimensionless
- **Why:** Motor consistency independent of speed. Most sensitive single feature for detecting early motor impairment in neuroQWERTY research.
- **Table:** tb_session_summaries
- **Citation:** Giancardo et al. 2016

### negativeFlightTimeCount
- **Capture:** Flight times where `keydown[n] < keyup[n-1]` (key rollover)
- **Unit:** count
- **Why:** Motor automaticity. High rollover = fingers running ahead of conscious control. Low rollover = deliberate key-by-key typing.
- **Table:** tb_session_summaries
- **Citation:** Teh et al. 2013

### ikiSkewness
- **Capture:** Third standardized moment of IKI distribution
- **Unit:** dimensionless
- **Why:** How often deep thinking interrupts flow. Right-skewed = many short intervals with occasional long pauses.
- **Table:** tb_session_summaries
- **Citation:** Heliyon 2021

### ikiKurtosis
- **Capture:** Fourth standardized moment minus 3 (excess kurtosis)
- **Unit:** dimensionless
- **Why:** How extreme are the pauses when they happen. High kurtosis = more extreme outlier events.
- **Table:** tb_session_summaries

### errorDetectionLatencyMean
- **Capture:** Mean interval from last non-delete keystroke to backspace press
- **Unit:** milliseconds
- **Why:** How quickly the writer detects their own errors. Leading indicator of fatigue that appears before general speed declines.
- **Table:** tb_session_summaries
- **Citation:** Haag et al. 2020

### terminalVelocity
- **Capture:** Mean IKI of final 10% of keystrokes / session mean IKI
- **Unit:** ratio
- **Why:** Finish-line behavior. > 1 = slowing down (careful, metacognitive). < 1 = speeding up (rushing, satisficing).
- **Table:** tb_session_summaries

---

## Motor Signals (from keystroke stream)

### sampleEntropy
- **Capture:** Richman & Moorman (2000) SampEn algorithm, m=2, r=0.2*std, on IKI series
- **Unit:** nats
- **Why:** Temporal regularity of keystroke rhythm. Distinct from Shannon entropy (distribution shape) and permutation entropy (ordinal patterns). Lower = more rigid cognitive control. Higher = more erratic motor-cognitive coupling. Correlated r=0.59 with executive function in BiAffect research.
- **Table:** tb_motor_signals
- **Citation:** Richman & Moorman 2000; Ajilore et al. 2025

### ikiAutocorrelation
- **Capture:** Pearson correlation of IKI[t] vs IKI[t+lag] for lags 1-5
- **Unit:** JSON array of 5 correlation coefficients
- **Why:** Cognitive rhythm fingerprint. High autocorrelation at short lags = rhythmic, metronomic typing. Rapid decay = stochastic, interrupt-driven. Individually distinctive and shifts under stress.
- **Table:** tb_motor_signals
- **Citation:** DARPA Active Authentication

### motorJerk
- **Capture:** Mean absolute second derivative of the IKI series
- **Unit:** ms/step^2
- **Why:** Motor planning smoothness. High jerk = jerky, poorly planned motor execution. Low jerk = smooth, well-planned. Standard in digitized handwriting analysis but novel for keyboard typing.
- **Table:** tb_motor_signals

### lapseRate
- **Capture:** Count of IKIs > mean + 3*std, divided by session minutes
- **Unit:** lapses per minute
- **Why:** Micro-dropouts in sustained attention. Not deliberate pauses. Fatigue manifests as increased lapse frequency before general speed declines.
- **Table:** tb_motor_signals
- **Citation:** Haag et al. 2020

### tempoDrift
- **Capture:** Linear regression slope of mean IKI across session quartiles
- **Unit:** ms/quartile
- **Why:** Positive = slowing down (fatigue). Negative = speeding up (warming up). Distinct from burst trajectory shape (which measures deletion timing).
- **Table:** tb_motor_signals

### ikiCompressionRatio
- **Capture:** `gzip(IKI series as comma-separated integers).length / raw.length`
- **Unit:** ratio
- **Why:** Multi-scale complexity of timing sequence. High = repetitive/metronomic. Low = varied/complex. Captures patterns that summary statistics miss.
- **Table:** tb_motor_signals

### digraphLatencyProfile
- **Capture:** Mean flight time for top 10 most frequent consecutive key pairs
- **Unit:** JSON: `{digraph: meanFlightMs}`
- **Why:** Individually distinctive biometric. Deviations from personal baseline indicate cognitive disruption, stress, or altered motor state. CMU's keystroke dynamics lab showed these are more stable than aggregate speed metrics.
- **Table:** tb_motor_signals
- **Citation:** Killourhy & Maxion (CMU)

---

## Extended Semantic Signals (from final text)

### ideaDensity
- **Capture:** (verbs + adjectives + adverbs + prepositions + conjunctions) / total words, via POS-proxy word lists
- **Unit:** ratio
- **Why:** Propositions per word. The Nun Study found low idea density at age 22 predicted Alzheimer's 58 years later. As a cognitive reserve marker, it captures the density of conceptual thinking.
- **Table:** tb_semantic_signals
- **Citation:** Snowdon et al. 1996

### lexicalSophistication
- **Capture:** Proportion of content words NOT in the top ~2000 most common English words
- **Unit:** ratio (0-1)
- **Why:** Under cognitive load or fatigue, people regress to higher-frequency, earlier-acquired words. Longitudinal shifts toward simpler vocabulary may indicate cognitive reserve depletion.
- **Table:** tb_semantic_signals
- **Citation:** Kyle & Crossley 2017 (TAALES)

### epistemicStance
- **Capture:** boosterDensity / (boosterDensity + hedgingDensity)
- **Unit:** ratio (0-1), null if no markers
- **Why:** The full confidence spectrum. 0 = all hedging. 1 = all certainty. In depressive states, boosters collapse. In manic states, boosters spike.
- **Table:** tb_semantic_signals
- **Citation:** Hyland 2005

### integrativeComplexity
- **Capture:** (contrastive connectives + integrative connectives) / sentence count
- **Unit:** connectives per sentence
- **Why:** Low IC = black-and-white thinking, cognitive rigidity. High IC = nuanced, multi-perspective processing. Longitudinal decline associated with stress and depression.
- **Table:** tb_semantic_signals
- **Citation:** Suedfeld & Tetlock

### deepCohesion
- **Capture:** (causal + temporal + intentional connectives) / total words
- **Unit:** density
- **Why:** Whether the writer is building explicit causal chains and temporal sequences rather than listing observations. Longitudinal decline may indicate reduced capacity for structured causal thinking.
- **Table:** tb_semantic_signals
- **Citation:** McNamara et al. (Coh-Metrix)

### referentialCohesion
- **Capture:** Mean content-word overlap between adjacent sentence pairs
- **Unit:** ratio (0-1)
- **Why:** How well ideas connect across sentences. High = maintains thread. Low = disconnected ideas.
- **Table:** tb_semantic_signals
- **Citation:** Graesser et al. (Coh-Metrix)

### emotionalValenceArc
- **Capture:** NRC valence (joy+trust - anger+fear+sadness) computed in thirds, classified as ascending/descending/vee/peak/flat
- **Unit:** categorical
- **Why:** The shape of emotional processing through the entry. Does the writer arrive at resolution, escalate into distress, or maintain flatness?
- **Table:** tb_semantic_signals
- **Citation:** Reagan et al. 2016

### textCompressionRatio
- **Capture:** `gzip(text).length / text.length`
- **Unit:** ratio
- **Why:** Information density. Highly compressible = repetitive/predictable. Low compression = information-dense, varied.
- **Table:** tb_semantic_signals

---

## Process Signals (from event log replay)

### pauseWithinWord / pauseBetweenWord / pauseBetweenSentence
- **Capture:** Classify each pause > 2s by surrounding character context in reconstructed text state
- **Unit:** count
- **Why:** Skilled writers pause at sentence boundaries (planning). Less skilled pause within words (transcription difficulty). A shift from within-word to between-sentence pausing tracks improving cognitive fluency.
- **Table:** tb_process_signals
- **Citation:** Deane 2015; Baaijen & Galbraith 2018

### abandonedThoughtCount
- **Capture:** Pattern detection: pause > 2s, then type 3-50 chars, then delete >= 70% of those chars, then type new text
- **Unit:** count
- **Why:** Captures self-censorship and suppressed ideas. The cognitive labor that left zero trace in the final text. Not a deletion (those are corrections). This is a thought the writer considered, began to commit to, and abandoned.
- **Table:** tb_process_signals

### rBurstCount / iBurstCount
- **Capture:** R-burst = production burst ending with deletion. I-burst = burst starting with cursor navigation backward.
- **Unit:** count
- **Why:** R-bursts = immediate self-monitoring ("generate then correct"). I-bursts = reflective revision ("step back and rethink"). Higher I-burst ratio indicates more sophisticated writing.
- **Table:** tb_process_signals
- **Citation:** Deane 2015

### vocabExpansionRate
- **Capture:** Heaps' law exponent from vocabulary growth curve within session
- **Unit:** dimensionless (0-1, typically 0.4-0.8)
- **Why:** Near 1 = every word is new (no repetition). Near 0 = early saturation (circular writing).
- **Table:** tb_process_signals
- **Citation:** Heaps' Law

### phaseTransitionPoint
- **Capture:** Session position (0-1) where deletion rate first exceeds insertion rate in a sliding window
- **Unit:** ratio (0-1)
- **Why:** Divides the session into composition and revision phases. Early transition = quick draft then extensive revision. Late/null = continuous composition.
- **Table:** tb_process_signals

### strategyShiftCount
- **Capture:** Count of positions where running mean burst length shifts by > 1 std from previous window
- **Unit:** count
- **Why:** Detects when the writer changes cognitive strategy mid-session.
- **Table:** tb_process_signals

---

## Cross-Session Signals (require prior entries)

### selfPerplexity
- **Capture:** Character trigram model built from all prior entries, scored against today's text. Laplace-smoothed conditional probabilities.
- **Unit:** perplexity (higher = more novel)
- **Why:** The direct mathematical operationalization of the Option C thesis. If cognitive reserve is eroding, language becomes more predictable against personal baseline. Requires 5+ prior entries to be meaningful.
- **Table:** tb_cross_session_signals

### ncdLag1 / ncdLag3 / ncdLag7 / ncdLag30
- **Capture:** Normalized Compression Distance between today's text and the entry N days ago. NCD = (C(xy) - min(C(x),C(y))) / max(C(x),C(y)) via gzip.
- **Unit:** distance (0-1), null if no entry at that lag
- **Why:** Pure mathematical measure of "cognitive rut" vs "cognitive expansion." NCD near 0 = texts are essentially the same. NCD near 1 = completely different.
- **Table:** tb_cross_session_signals
- **Citation:** Cilibrasi & Vitanyi 2005

### vocabRecurrenceDecay
- **Capture:** Exponential decay rate of Jaccard similarity of content words across lags 1, 3, 7 days
- **Unit:** decay rate (higher = faster vocabulary refresh)
- **Why:** Measures whether the writer is circling the same ideas (slow decay) or generating new territory (fast decay).
- **Table:** tb_cross_session_signals

### digraphStability
- **Capture:** Cosine similarity between today's digraph latency profile and rolling mean of last 5 sessions
- **Unit:** similarity (0-1)
- **Why:** Your cognitive fingerprint's drift. Not "how you're typing today" but "how much has your typing changed from your own baseline."
- **Table:** tb_cross_session_signals
- **Citation:** CMU Keystroke Dynamics Lab

### textNetworkDensity
- **Capture:** Co-occurrence graph (window=5, stopwords removed). Density = 2*edges / (nodes*(nodes-1)).
- **Unit:** density (0-1)
- **Why:** How interconnected the concepts are. Dense = tightly argued, recursive thinking. Sparse = linear, list-like thinking.
- **Table:** tb_cross_session_signals
- **Citation:** InfraNodus methodology

### textNetworkCommunities
- **Capture:** Connected component count in co-occurrence graph
- **Unit:** count
- **Why:** Number of distinct concept clusters. More communities with weak bridges = more fragmented thinking.
- **Table:** tb_cross_session_signals

### bridgingRatio
- **Capture:** Proportion of nodes with degree in top 20% (high-betweenness proxy)
- **Unit:** ratio (0-1)
- **Why:** High bridging = integrative, synthesizing thinking. Low bridging = compartmentalized thinking.
- **Table:** tb_cross_session_signals

---

## Signal Count

| Category | Count |
|---|---|
| Raw production | 9 |
| Pause and engagement | 4 |
| Deletion decomposition | 9 |
| P-bursts | 3 |
| Keystroke dynamics | 7 |
| Revision chains | 2 |
| Re-engagement | 2 |
| Raw streams | 2 |
| Linguistic densities | 10 |
| Session metadata | 7 |
| 7D behavioral state | 8 |
| 11D semantic state | 12 |
| Dynamical signals | 11 |
| Calibration context | 7 dimensions |
| Device/temporal | 3 |
| Cursor behavior / writing process (Phase 1) | 17 |
| Motor signals | 7 |
| Extended semantic signals | 8 |
| Process signals | 9 |
| Cross-session signals | 10 |
| **Total** | **~147 distinct signals** |
