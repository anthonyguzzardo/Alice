# Signal Reference

Technical specification of every signal Alice captures, how it is captured, and why it matters.

## Infrastructure

- **Timing source:** `performance.now()` (DOMHighResTimestamp, ~5 microsecond resolution). All timing values are fractional milliseconds (e.g., `1523.456789`), not integer milliseconds.
- **Timing storage:** PostgreSQL `DOUBLE PRECISION` (IEEE 754 float64, 15-17 significant digits). No precision loss from capture through storage.
- **Signal computation:** Dynamical, motor, and process signals computed by Rust native engine via napi-rs (`src-rs/`). Semantic and cross-session signals remain in TypeScript. No TS fallback; if Rust is unavailable, signals are null for that session. The health endpoint exposes `rustEngine: true/false` to surface this state.
- **Rust type alignment:** All signal values are `f64` in Rust, `number` in TypeScript, `DOUBLE PRECISION` in PostgreSQL. IEEE 754 at every boundary, no conversion loss.

---

## Raw Production

### firstKeystrokeMs
- **Capture:** Elapsed time from page open to first `input` event with positive delta
- **Unit:** fractional milliseconds (microsecond precision via `performance.now()`)
- **Why:** Measures initial hesitation, the gap between reading and committing to write. Long delays suggest the question landed somewhere uncomfortable or complex. Short delays suggest immediacy or familiarity.
- **Feeds:** 7D deliberation dimension
- **Citation:** Deane 2015

### totalDurationMs
- **Capture:** Page open timestamp to submit button click
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** Wall-clock session length. Meaningful only in combination with active typing time, since raw duration includes pauses and tab-aways.
- **Feeds:** Active typing normalization

### activeTypingMs
- **Capture:** `totalDurationMs - totalPauseMs - totalTabAwayMs`
- **Unit:** fractional milliseconds (microsecond precision)
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
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** Total thinking time. Subtracted from totalDurationMs to compute activeTypingMs.
- **Feeds:** Speed normalization

### tabAwayCount
- **Capture:** `visibilitychange` events where `document.hidden` becomes true
- **Unit:** count
- **Why:** Each tab-away is a context switch. High tab-away counts during a short session suggest distraction or avoidance. Zero tab-aways suggest absorption.
- **Feeds:** 7D presence (inverted)

### totalTabAwayMs
- **Capture:** Sum of time between tab blur and tab focus events
- **Unit:** fractional milliseconds (microsecond precision)
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
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** Average hesitation between keystrokes. Slower intervals indicate deliberate word retrieval or cognitive load. Faster intervals indicate automatic production.
- **Feeds:** Observation-only
- **Citation:** Epp et al. 2011

### interKeyIntervalStd
- **Capture:** Standard deviation of inter-key intervals
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** Rhythm variability. High variability (CV > 0.8) suggests cognitive switching or hesitation patterns. Low variability (CV < 0.4) suggests flow state or automatic writing.
- **Feeds:** Observation-only
- **Citation:** Epp et al. 2011

### holdTimeMean / holdTimeStd
- **Capture:** Duration from `keydown` to `keyup` per key, capped at 2 seconds. Tracked via a Map keyed by `e.code`. Auto-repeat events (`e.repeat`) are excluded.
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** Hold time measures motor execution, how long the finger physically presses the key. It is largely independent of cognitive planning. Changes in hold time across sessions may reflect fatigue, motor state, or physical tension.
- **Feeds:** Observation-only, dynamical signals (transfer entropy source)
- **Citation:** Kim et al. 2024 (JMIR)

### flightTimeMean / flightTimeStd
- **Capture:** Duration from previous `keyup` to current `keydown`, capped at 5 seconds
- **Unit:** fractional milliseconds (microsecond precision)
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
- **Capture:** Array of `{c: e.code, d: downOffsetMs, u: upOffsetMs}` tuples, recorded in the `keyup` handler when hold time is valid (> 0, < 2000ms). Offsets are fractional milliseconds relative to page open via `performance.now()` (e.g., `d: 1523.456, u: 1603.891`).
- **Unit:** array of objects, timing in fractional milliseconds (microsecond precision)
- **Why:** The raw material for dynamical and motor signal computation via the Rust native engine. Every other keystroke signal (IKI mean, hold time mean, etc.) is a summary statistic that collapses the temporal structure. The raw stream preserves sequential dependencies, fractal scaling, recurrence patterns, and causal coupling between motor and cognitive channels. Microsecond precision enables sub-millisecond digraph latency profiles and tighter recurrence thresholds in RQA.
- **Feeds:** Rust signal engine (dynamical signals: permutation entropy, DFA, RQA, transfer entropy; motor signals: sample entropy, ex-Gaussian, autocorrelation, jerk, digraph latency, adjacent hold-time covariance)
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
- **Unit:** fractional milliseconds (microsecond precision)
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

Computed from the raw keystroke stream by the Rust native engine (`src-rs/dynamical.rs`). These treat the IKI series as the output of a complex adaptive system rather than a bag of statistics. Full computation on a 500-keystroke stream: ~0.6ms.

### permutationEntropy
- **Computation:** Bandt & Pompe ordinal pattern distribution. Takes every consecutive triplet of IKI values, classifies by rank order (6 possible patterns for order-3), computes Shannon entropy of the pattern distribution, normalizes by log2(3!) = 2.585 bits.
- **Unit:** normalized [0, 1]
- **Why:** Captures temporal structure that mean/std completely miss. High permutation entropy means all ordinal patterns are equally likely, genuinely novel composition with no temporal habits. Low permutation entropy means certain patterns dominate, habitual rhythm, cognitive autopilot. Invariant to nonlinear distortions of the signal (robust to device differences, fatigue, caffeine).
- **Minimum series:** 50 IKI values
- **Citation:** Bandt & Pompe 2002

### permutationEntropyRaw
- **Computation:** Same ordinal pattern distribution as `permutationEntropy`, but returns the raw Shannon entropy in bits without normalizing by log2(order!).
- **Unit:** bits
- **Why:** The normalized version maps to [0, 1] for cross-order comparison. The raw version preserves the absolute information content, which matters when comparing sessions with different IKI series lengths or when the normalization constant itself is analytically relevant.
- **Minimum series:** 50 IKI values
- **Table:** tb_dynamical_signals
- **Citation:** Bandt & Pompe 2002

### peSpectrum
- **Computation:** Permutation entropy computed at orders 3 through 7, returning a 5-element array. Each order captures complexity at a different temporal scale: order 3 sees local triplet patterns, order 7 sees longer-range sequential dependencies across 7 consecutive IKIs.
- **Unit:** array of 5 normalized values [0, 1] per order
- **Why:** A single PE value collapses temporal structure across scales. The spectrum separates local complexity from global structure. A session with high PE at order 3 but low PE at order 7 has locally irregular but globally structured timing. This is the difference between deliberation (irregular at small scale, patterned at large scale) and volatility (irregular at all scales).
- **Minimum series:** order + 10 IKI values per order (most restrictive: order 7 needs 17)
- **Table:** tb_dynamical_signals (JSONB)
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
- **Unit:** fractional milliseconds (microsecond precision)
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
- **Unit:** fractional milliseconds (microsecond precision)
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
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** How quickly the writer detects their own errors. Leading indicator of fatigue that appears before general speed declines.
- **Table:** tb_session_summaries
- **Citation:** Haag et al. 2020

### terminalVelocity
- **Capture:** Mean IKI of final 10% of keystrokes / session mean IKI
- **Unit:** ratio
- **Why:** Finish-line behavior. > 1 = slowing down (careful, metacognitive). < 1 = speeding up (rushing, satisficing).
- **Table:** tb_session_summaries

---

## Motor Signals (from keystroke stream, Rust engine)

### sampleEntropy
- **Capture:** Richman & Moorman (2000) SampEn algorithm, m=2, r=0.2*std, on IKI series. Computed in Rust (`src-rs/motor.rs`). O(n^2*m) complexity; runs in ~0.9ms for 500 keystrokes vs ~300ms in TypeScript.
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
- **Capture:** `gzip(IKI series as comma-separated values).length / raw.length`. Computed in Rust (`src-rs/motor.rs`) via flate2.
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

## Process Signals (from event log replay, Rust engine)

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

## Mouse/Cursor Trajectory (Phase 2 Expansion, 2026-04-18)

Captures motor restlessness, absorption, and drift-to-submit behavior during cognitive pauses. A pause for mouse tracking is >2s since last input event (aligns with P-burst threshold). Sampled every 200ms.

### cursorDistanceDuringPauses
- **Capture:** Sum of Euclidean distances between consecutive 200ms mouse position samples during pauses. `sum(sqrt((x2-x1)^2 + (y2-y1)^2))`
- **Unit:** pixels
- **Why:** Total cursor movement during thinking time. High distance = motor restlessness or fidgeting. Low distance = absorption or disengagement. BioCatch's 3,000-signal system treats mouse behavior during non-mouse tasks as a primary cognitive channel.
- **Table:** tb_session_summaries
- **Citation:** BioCatch cognitive biometrics; Pusara & Brodley 2004

### cursorFidgetRatio
- **Capture:** `cursorDistanceDuringPauses / activeTypingMs`
- **Unit:** pixels per millisecond
- **Why:** Motor restlessness normalized by session length. Independent of how many pauses occurred. High ratio = agitated or distracted. Low ratio = still, whether from absorption or fatigue.
- **Table:** tb_session_summaries

### cursorStillnessDuringPauses
- **Capture:** Proportion of 200ms pause samples where cursor displacement < 5px
- **Unit:** ratio (0-1)
- **Why:** Absorption proxy. High stillness (>0.9) means the writer is frozen in place during pauses, thinking without moving. Low stillness means the hands are active even when the keys aren't.
- **Table:** tb_session_summaries

### driftToSubmitCount
- **Capture:** Number of pauses where cursor entered the submit button bounding rect then left without clicking
- **Unit:** count
- **Why:** "Almost done" moments. The writer considered submitting, moved toward the button, then pulled back to continue writing. Each drift is a metacognitive decision to extend the session.
- **Table:** tb_session_summaries

### cursorPauseSampleCount
- **Capture:** Total 200ms samples taken during pauses
- **Unit:** count
- **Why:** Denominator for stillness ratio. Also a proxy for total pause time (samples * 200ms).
- **Table:** tb_session_summaries

---

## Precorrection / Postcorrection Latency (Phase 2 Expansion, 2026-04-18)

Extends the error-correction model from a single phase (error detection, already captured as `errorDetectionLatencyMean`) to three phases. Based on Springer 2021 (automated revision extraction from keystroke logs).

### deletionExecutionSpeedMean
- **Capture:** Mean IKI between consecutive deletion keystrokes within revision chains (sequential backspace/delete keys within 500ms of each other)
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** How fast the writer executes a deletion once the decision is made. Slow deletion = tentative, reconsidering mid-delete. Fast deletion = decisive, committed to the cut. This is phase 2 of the three-phase error correction model.
- **Table:** tb_session_summaries
- **Citation:** Springer 2021; Lindgren & Sullivan 2006

### postcorrectionLatencyMean
- **Capture:** Mean time from last deletion keystroke to next insertion keystroke
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** How long it takes to re-engage after correcting. Long re-orientation = the error disrupted the train of thought. Short re-orientation = seamless recovery. This is phase 3: the "getting back on track" cost of each error.
- **Table:** tb_session_summaries
- **Citation:** Springer 2021

---

## Revision Distance (Phase 2 Expansion, 2026-04-18)

### meanRevisionDistance
- **Capture:** Mean character offset from leading edge across all contextual revisions (deletions where `selectionStart < value.length - 1`)
- **Formula:** `mean(value.length - selectionStart)` per contextual revision
- **Unit:** characters
- **Why:** `contextualRevisionCount` counts how many times the writer navigated back. Revision distance measures how FAR back. A revision 5 characters from the end is a typo fix at the leading edge. A revision 200 characters back is structural rethinking. The depth distribution distinguishes surface editing from deep restructuring.
- **Table:** tb_session_summaries
- **Citation:** Lindgren & Sullivan 2006 (ScriptLog); Severinson Eklundh & Kollberg 2003

### maxRevisionDistance
- **Capture:** Maximum character offset from leading edge across all contextual revisions
- **Unit:** characters
- **Why:** The single deepest revision in the session. A max distance of 500 characters means the writer went back to the opening and restructured. A max distance of 10 means all revisions were near the cursor.
- **Table:** tb_session_summaries

---

## Punctuation Key Latency (Phase 2 Expansion, 2026-04-18)

### punctuationFlightMean
- **Capture:** Mean flight time (keyup to keydown) before punctuation keystrokes (Period, Comma, Slash, Quote, Semicolon, BracketLeft, BracketRight, Minus, Equal, Backquote, Backslash)
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** Punctuation requires syntactic decision-making (where does this clause end? comma or period?), a different cognitive process than letter production (motor execution of a known word). Clinical keystroke research shows punctuation-adjacent latencies cluster separately as a distinct "cognition score."
- **Table:** tb_session_summaries
- **Citation:** Plank 2016 (COLING); clinical keystroke dynamics literature

### punctuationLetterRatio
- **Capture:** `punctuationFlightMean / letterFlightMean` where letter flight times are filtered to `Key*` codes only
- **Unit:** ratio
- **Why:** Relative cognitive cost of punctuation decisions vs. letter production. Ratio near 1.0 = punctuation is automatic, no syntactic hesitation. Ratio > 1.5 = punctuation requires substantially more planning than letter typing. Longitudinal changes may indicate shifts in syntactic planning capacity.
- **Table:** tb_session_summaries

---

## Motor Signals: Phase 2 Additions (2026-04-18)

### exGaussianTau
- **Capture:** Fit ex-Gaussian distribution to per-session flight time array (outliers above Q3 + 3*IQR removed before fitting). MLE via Expectation-Maximization (Lacouture & Cousineau 2008), with Method of Moments as initial estimates. If MLE fails to improve over MoM, falls back honestly to MoM rather than returning bad estimates. Computed in Rust (`src-rs/motor.rs`).
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** The ex-Gaussian decomposes flight time into a Gaussian component (motor execution speed) and an exponential tail (cognitive slowing). Mean flight time conflates both. Tau isolates the cognitive part. BiAffect demonstrated that tau shifts predict mood episodes in bipolar disorder before summary statistics (mean, std) move. This is the single most validated digital phenotyping signal from the keystroke dynamics literature.
- **Minimum data:** 50+ flight times with positive skewness after outlier removal
- **Table:** tb_motor_signals
- **Citation:** Zulueta et al. 2018 (BiAffect); Luce 1986; Heathcote et al. 1991; Lacouture & Cousineau 2008

### exGaussianMu
- **Capture:** Gaussian mean component from ex-Gaussian MLE/EM fit (after outlier removal)
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** The Gaussian mean: motor execution speed stripped of cognitive slowing. Pure motor baseline.
- **Table:** tb_motor_signals

### exGaussianSigma
- **Capture:** Gaussian standard deviation component from ex-Gaussian MLE/EM fit (after outlier removal)
- **Unit:** fractional milliseconds (microsecond precision)
- **Why:** The Gaussian standard deviation: motor noise stripped of cognitive slowing. Motor consistency independent of thinking pauses.
- **Table:** tb_motor_signals

### tauProportion
- **Capture:** `tau / mean(flightTimes)`
- **Unit:** ratio (0-1)
- **Why:** What fraction of mean flight time is attributable to cognitive slowing vs. motor speed. High tau proportion (>0.5) means most of the inter-key delay is thinking, not moving. Low tau proportion means the delay is mostly motor execution.
- **Table:** tb_motor_signals

### adjacentHoldTimeCov
- **Capture:** Pearson correlation between consecutive hold times: `corr(holdTime[0:n-1], holdTime[1:n])`
- **Unit:** correlation coefficient (-1 to 1)
- **Minimum data:** 30+ consecutive hold times
- **Why:** Measures sequential motor coordination. Lateralized hold times (left/right hand) measure spatial asymmetry. This measures temporal coupling: does the duration of one keypress predict the next? In neuroQWERTY research, this covariance degrades before mean hold time shifts in Parkinson's. It is a leading indicator of motor coordination decline.
- **Table:** tb_motor_signals
- **Citation:** Giancardo et al. 2016 (neuroQWERTY); nQ Medical clinical validation

### holdFlightRankCorr
- **Capture:** Spearman rank correlation between aligned hold times and flight times: `spearman(holds[0:n], flights[0:n])`
- **Unit:** correlation coefficient (-1 to 1)
- **Minimum data:** 30+ aligned hold/flight pairs
- **Why:** Measures the monotonic coupling between motor execution (how long a key is held) and cognitive planning (how long until the next key). Positive correlation means longer holds predict longer flights (deliberate, coupled). Negative or zero means the channels are decoupled (automatic production). Also used as the Spearman rho input for the Gaussian copula in the avatar engine's motor synthesis (variant 3+).
- **Table:** tb_motor_signals

---

## R-Burst Sequences (per-burst detail)

Stored in `tb_rburst_sequences`, one row per R-burst. Derived from the Rust process signal computation alongside the aggregate `r_burst_count`.

### deletedCharCount
- **Capture:** UTF-16 code units deleted in this R-burst episode
- **Unit:** characters (UTF-16)
- **Why:** The size of the revision. A 3-char R-burst is a typo fix. A 40-char R-burst is a clause deletion.
- **Table:** tb_rburst_sequences

### totalCharCount
- **Capture:** UTF-16 code units inserted during the burst that ended with deletion
- **Unit:** characters (UTF-16)
- **Why:** Total production in the burst before the revision. Combined with deletedCharCount, reveals how much of the burst survived.
- **Table:** tb_rburst_sequences

### burstDurationMs
- **Capture:** Time from first to last event in the burst
- **Unit:** fractional milliseconds
- **Why:** How long the writer spent on the thought they ultimately revised.
- **Table:** tb_rburst_sequences

### burstStartOffsetMs
- **Capture:** Timestamp of the burst's first event, relative to session start
- **Unit:** fractional milliseconds
- **Why:** Temporal position in the session. Enables R-burst consolidation analysis (do R-bursts get smaller or larger as the session progresses).
- **Table:** tb_rburst_sequences

### isLeadingEdge
- **Capture:** True if the deletion endpoint was at or beyond the end of the text (deletion at the cursor's current position, not navigated back)
- **Unit:** boolean
- **Why:** Leading-edge R-bursts are immediate self-correction ("type then fix"). Non-leading-edge R-bursts require navigation, indicating retrospective revision.
- **Table:** tb_rburst_sequences
- **Citation:** Deane 2015

---

## Avatar / Ghost Engine

The reconstruction adversary system (`src-rs/avatar.rs`). Generates synthetic keystroke streams from a person's statistical profile. Not a signal in itself but the measurement validation layer: comparing real signals against what a statistical model can reproduce isolates the residual that requires the actual person.

### Adversary Variants

Five variants, each adding one modeling improvement to isolate which dimension carries signal:

| Variant | Text Model | IKI Model | Hold Model | Tests |
|---------|-----------|-----------|-----------|-------|
| 1 Baseline | Order-2 Markov | Independent ex-Gaussian | Fixed mean | Minimum viable reconstruction |
| 2 ConditionalTiming | Order-2 Markov | AR(1) correlated | Fixed mean | Does IKI correlation matter? |
| 3 CopulaMotor | Order-2 Markov | Independent | Gaussian copula hold/flight | Does motor coupling matter? |
| 4 PpmText | Variable-order PPM | Independent | Fixed mean | Does text prediction matter? |
| 5 FullAdversary | Variable-order PPM | AR(1) correlated | Copula hold/flight | Best possible reconstruction |

### Reconstruction Residuals

Stored in `tb_reconstruction_residuals`. For each signal, the residual is `real_value - avatar_value`. Signals where the residual is consistently large across variants are the ones that carry genuine individual signature. Signals where the residual collapses to zero under the full adversary are reproducible from statistical profile alone.

### TimingProfile (avatar input)

The avatar consumes a `TimingProfile` built from the person's historical signals: ex-Gaussian parameters (mu, sigma, tau), digraph latencies, burst structure, deletion rates, revision timing bias, R-burst characteristics, autocorrelation coefficients, hold-flight rank correlation (for copula), and hold time distribution. This profile is the statistical summary of the person's motor-cognitive fingerprint.

---

## Computation Utilities (Rust)

NAPI-exposed functions that support signal infrastructure but are not signal families themselves.

### computeProfileDistance
- **Computation:** Z-scores each value against provided means/stds, then computes Euclidean distance in the resulting space.
- **Returns:** z-scores array, distance, dimension count
- **Why:** Used for convergence scoring and behavioral state engine distance calculations.

### computeBatchCorrelations
- **Computation:** Lagged cross-correlation between two signal series across configurable window sizes, returning the best correlation and optimal lag for each window.
- **Returns:** per-window correlation coefficient, lag, and window metadata
- **Why:** Detects temporal coupling between different signal families (e.g., does PE lead or lag tau across sessions).

### computePerplexity
- **Computation:** Character trigram model built from corpus text, scored against target text. Laplace-smoothed conditional probabilities.
- **Returns:** perplexity value, token count, log probability
- **Why:** Rust-side implementation of the self-perplexity calculation for cross-session signals. Used when the corpus is large enough that TypeScript performance becomes a bottleneck.

---

## Somatic Signals (Potential)

Signals derivable from the existing keystroke stream that measure the body producing the keystrokes, not the mind composing the text. These introduce a second measurement axis (somatic) orthogonal to the existing axis (cognitive/temporal). The somatic axis acts as a control channel: when a cognitive signal changes, the somatic axis disambiguates whether the change is cognitive (somatic stable) or motor (somatic drifting).

None of these require hardware changes. All are computable from the existing keystroke stream.

### Rollover Distribution (negative flight time analysis)
- **Source:** Flight times where `keydown[n] < keyup[n-1]` (already captured as `negativeFlightTimeCount`)
- **Computation:** Extract the distribution of negative flight times (not just the count). Compute mean, std, skewness of negative flights. Partition by hand pair (left-left, left-right, right-left, right-right). Track session trajectory (first half vs second half).
- **Unit:** distribution statistics (ms), per-hand-pair breakdowns
- **Why:** The magnitude of key overlap is a force proxy. Aggressive, high-energy typing produces deeper rollover (more negative flight times). Deliberate, soft typing produces cleaner releases (flight times near zero or positive). The current system counts rollovers but discards their depth. The distribution of rollover depth is a continuous intensity signal independent of timing.
- **Literature:** Teh et al. 2013 establish rollover as a biometric feature. Force correlation with rollover depth is supported by the biomechanical coupling between strike velocity and finger lift timing.

### Error Topology (spatial pattern of typing errors)
- **Source:** Text reconstruction in `process.rs` already captures deletions and replacements
- **Computation:** Map each error (deleted character vs. replacement character) to physical key positions on QWERTY layout. Classify errors by spatial relationship: adjacent-key (motor precision), same-finger (finger confusion), cross-hand (coordination), non-adjacent (cognitive). Track spatial bias per hand and per finger over time.
- **Unit:** error counts per spatial category, per-hand/per-finger breakdowns
- **Why:** Adjacent-key errors are motor precision failures that increase with fatigue. The spatial pattern of where precision degrades (left hand? right pinky?) is a per-finger somatic signal. Error count alone is ambiguous (could be speed-accuracy tradeoff); error topology isolates the motor component.
- **Literature:** Dhakal et al. 2018 (analysis of 136M keystrokes) found systematic spatial error patterns correlated with typing proficiency and fatigue.

### Thumb Channel (space bar as independent motor stream)
- **Source:** Hold times and IKIs for space bar events (identifiable by key code in keystroke stream)
- **Computation:** Separate space bar hold time distribution from all-finger hold time distribution. Compute mean, std, CV for each. Track the ratio (thumb hold CV / finger hold CV) and its drift over sessions.
- **Unit:** hold time statistics (ms), thumb-to-finger ratios
- **Why:** The thumb has disproportionate cortical motor representation and is biomechanically independent from the fingers. Its timing distribution is an independent motor stream. If thumb and finger hold times drift at different rates over months, that is a differential motor signal. The space bar is the most frequently pressed key, providing massive N per session.
- **Literature:** Giancardo et al. 2016 (neuroQWERTY) demonstrated that per-finger motor features differentiate healthy controls from early PD.

### Correction Strategy (hold vs. tap backspace)
- **Source:** Backspace key events in the keystroke stream
- **Computation:** Classify each deletion episode as held-backspace (single keydown with auto-repeat, detectable via long hold time or `e.repeat` flag) or tapped-backspace (multiple discrete keydown/keyup cycles within 500ms). Compute the ratio (held episodes / total episodes) and track within-session trajectory.
- **Unit:** ratio (0-1), episode counts
- **Why:** Held-backspace is fast, coarse, and overshoots. Tapped-backspace is controlled and precise. The ratio tracks the person's relationship to error in that moment. A shift from tapping to holding within a session may indicate frustration or fatigue. Across sessions, a drift toward holding may indicate reduced motor patience or increased cognitive load during revision.

### Shift Anticipation (motor planning from modifier timing)
- **Source:** Shift key events paired with the next letter keydown in the keystroke stream
- **Computation:** Measure the interval from Shift keydown to the next letter keydown. Long anticipation (Shift pressed well before the letter) indicates early motor planning. Short or near-simultaneous press indicates chunked/reflexive execution. Partition by context: sentence-initial (habitual) vs. proper noun (deliberate) vs. single-letter word "I" (high-frequency).
- **Unit:** fractional milliseconds, context-partitioned distributions
- **Why:** The Shift-letter interval is a pure motor planning measurement. It captures how far in advance the motor system commits to the capitalization decision. Variation by context reveals whether the planning is habitual or deliberate, and shifts over time may indicate changes in motor planning efficiency.

### Key Geography (distance-weighted motor efficiency)
- **Source:** Key identities and IKIs from the keystroke stream, mapped to physical QWERTY positions
- **Computation:** Assign each key a physical coordinate (row, column) on the QWERTY layout. For each consecutive key pair, compute physical distance (Euclidean on the key grid). Regress IKI against physical distance. The slope is the timing cost per unit of reach. Track the slope over sessions.
- **Unit:** ms per key-unit of distance
- **Why:** Hands have a home row. Keys further from home require more reach, more forearm rotation, more motor planning. The timing cost per unit of physical distance is a motor efficiency ratio. If that ratio changes over time, fine motor coordination is changing. This is independent of overall typing speed (which may vary with cognitive load) because it measures the distance-dependent component specifically.
- **Literature:** Dhakal et al. 2018 found systematic latency variation by key position. Feit et al. 2016 modeled finger-travel optimization in skilled typists.

### Bilateral Rhythm Coherence (inter-hemispheric motor coordination)
- **Source:** IKI sub-series partitioned by QWERTY left/right hand key mapping
- **Computation:** Extract left-hand IKI series and right-hand IKI series from the keystroke stream (using the same key-to-hand mapping as holdTimeMeanLeft/Right). Compute windowed cross-correlation between the two series within a session. High coherence means the hands are rhythmically coupled, operating as a unified motor instrument. Low coherence means one hand is being managed independently.
- **Unit:** cross-correlation coefficient (-1 to 1), windowed trajectory
- **Why:** This measures inter-hemispheric motor coordination, not just per-hand speed (which holdTimeMeanLeft/Right already capture). Two hands can have identical mean hold times but completely decoupled rhythms. The coherence is the signal. Interhemispheric transfer degrades early in neurodegenerative conditions and under asymmetric cognitive load. High N per session (every alternating-hand digraph contributes). This is the highest-value somatic signal available from a standard keyboard.
- **Literature:** Serrien et al. 2006 (intermanual coordination and aging); Bangert & Schlaug 2006 (corpus callosum and bimanual coordination); Giancardo et al. 2016 (neuroQWERTY lateral motor features).

### Post-Pause Motor Signature (motor re-engagement quality)
- **Source:** IKI and hold time values for the first 3-5 keystrokes after each pause (>2s), compared to mid-burst keystrokes
- **Computation:** For each pause, extract the IKI and hold time distributions of the first N keystrokes after resumption. Compare to the mid-burst distribution (keystrokes 5+ within a burst). The restart penalty ratio (post-pause mean IKI / mid-burst mean IKI) measures how cleanly the motor system re-engages. Track the restart penalty trajectory across the session and across sessions.
- **Unit:** ratio (post-pause / mid-burst), session trajectory
- **Why:** Measures motor resilience after cognitive interruption. Independent of pause duration (which is cognitive) because it measures what happens *after* the pause ends. Independent of mid-burst speed (motor baseline) because it's a ratio. If the restart penalty increases through a session, the motor system is losing its ability to re-engage cleanly. Over months, a drifting restart penalty is a motor resilience signal that nothing else in the system captures.
- **Literature:** Popp et al. 2019 (cognitive-motor dual task restart costs); Springer 2021 (post-correction re-engagement latency).

### Deletion Kinematics (feedback-loop motor integrity)
- **Source:** IKI and hold time values during deletion sequences vs. production sequences in the keystroke stream
- **Computation:** Partition all keystrokes into production mode (inserting text) and deletion mode (backspace/delete sequences). Compute IKI mean, std, and CV for each mode independently. The ratio of deletion-IKI-variance to production-IKI-variance isolates feedback-loop motor quality from feedforward motor quality. Production typing is largely feedforward (central motor commands). Deletion is feedback-driven (watching text disappear, deciding when to stop).
- **Unit:** variance ratio (deletion / production), per-mode distribution statistics
- **Why:** This is the only signal that decomposes motor behavior into its two constituent control loops. Everything else in the system conflates feedforward and feedback motor performance. If the variance ratio increases over months, the feedback system is getting noisier independent of the feedforward system. Moderate N per session (depends on deletion volume, but most journal sessions produce enough deletion keystrokes).
- **Literature:** Salthouse 1986 (feedforward vs. feedback in typing skill); Logan & Crump 2011 (hierarchical control of skilled typing: outer loop monitors, inner loop executes).

### Digraph Asymmetry (directional motor planning)
- **Source:** Digraph latency profiles from the keystroke stream (extends existing digraphLatencyProfile)
- **Computation:** For each digraph pair AB, find its reverse BA. Compute the asymmetry ratio: `flight_time(AB) / flight_time(BA)` for pairs where both directions have sufficient occurrences. Aggregate by finger pair (e.g., left-index to right-middle vs. right-middle to left-index). Track per-finger-pair asymmetry ratios over sessions.
- **Unit:** ratio per digraph pair, per-finger-pair aggregates
- **Why:** The same two fingers produce different latencies depending on direction (AB vs BA). This directional asymmetry isolates motor planning from finger identity, key distance, and overall speed (all of which cancel in the ratio). If specific finger-pair asymmetry ratios drift over time, directional motor planning is changing asymmetrically. Best computed as a rolling cross-session measure due to sparsity of some BA pairs within a single session.
- **Literature:** Gentner 1983 (digraph frequency and latency in skilled typing); Salthouse 1984 (directional effects in keystroke latency).

### Tremor Frequency Estimation (involuntary oscillation detection)
- **Source:** Flight time series from the keystroke stream
- **Computation:** Swept-frequency sinusoidal interpolation across 0.5-12 Hz range. For each candidate frequency, compute interpolation variance ratio (tremor amplitude). Apply phase angle filtering: require at least 3 of 4 adjacent detection frequencies to have phase angles within 50 degrees of the candidate. Detection thresholds: frequency must appear in at least 4 of 8+ keystroke sequence replications, mean amplitude >= 0.15, strength >= 4.2. Output: tremor frequency (Hz), amplitude, and strength score.
- **Unit:** Hz (frequency), dimensionless (amplitude and strength)
- **Minimum data:** 8+ keystroke sequences of sufficient length for frequency detection
- **Why:** Physiological tremor (8-12 Hz), essential tremor (5-8 Hz), and parkinsonian tremor (4-6 Hz) superimpose on voluntary finger movements during typing. No current signal performs frequency-domain decomposition to isolate involuntary oscillatory components from voluntary motor timing. A person can have high IKI variability from cognitive pauses with zero tremor. The longitudinal trajectory is the signal: progressive frequency decrease toward pathological ranges combined with increasing amplitude and detection rate across sessions.
- **Literature:** Adams 2018 (bioRxiv 385286, sensitivity 67%, specificity 80% for PD tremor detection on n=76; also discriminated PD tremor from essential tremor). Dataset published at Mendeley Data (500+ subjects).

### Per-Finger Hold-Time Drift (finger-specific motor fatigue topology)
- **Source:** Hold times partitioned by canonical QWERTY finger assignment from the keystroke stream
- **Computation:** Map each key to its canonical finger group (4 fingers x 2 hands, thumbs excluded). Compute linear trend of hold times per finger group across the session. Output: 8-element vector of trend slopes (ms per session-fraction), plus scalar summary (max slope minus min slope across finger groups). Finger groups: left pinky (q/a/z), left ring (w/s/x), left middle (e/d/c), left index (r/t/f/g/v/b), right index (y/u/h/j/n/m), right middle (i/k/,), right ring (o/l/.), right pinky (p/;/'/[/]).
- **Unit:** ms per session-fraction (slopes), ms (divergence scalar)
- **Minimum data:** 30 keystrokes per finger group per session half
- **Why:** EMG research shows extensor muscles fatigue faster than flexors during typing (72-84% fatigue after 1-4 hours vs. less in FDS), and the pinky and ring finger fatigue first. The 8-element drift vector gives a motor topology of fatigue within a single session. All existing motor signals operate at the hand level (left/right) or global level. Per-finger decomposition is a different anatomical resolution. Over months, if the session-start pinky hold time drifts while the index remains stable, that is a finger-specific motor change distinct from overall slowing or cognitive load.
- **Literature:** PMC9798874 (FDS muscle potentiation after 6h keyboard use); PMC3256245 (keystroke duration decreased 5% after finger exercises, extensor muscles fatigue faster than flexors); Giancardo et al. 2016 (per-finger motor features differentiate healthy controls from early PD).

---

## Dynamical Signal Extensions (Potential)

Extensions to the existing dynamical signal family in `src-rs/dynamical.rs`. These build on existing infrastructure (DFA box-fitting, PE ordinal pattern extraction, RQA recurrence matrix computation) with minimal new code. All are computable from the existing IKI and hold/flight time series. None are yet implemented.

### MF-DFA (Multifractal Generalization of DFA)

The existing DFA implementation computes a single alpha exponent, assuming monofractal scaling (the same power law governs all moment orders). MF-DFA generalizes this by computing fluctuation functions for a range of moment orders q, producing a singularity spectrum f(alpha) that reveals whether the typing dynamics have adaptive multifractal structure or rigid monofractal scaling. Direct keystroke IKI validation: Bennett, Roudaut & Metatla (2025, Int. J. Human-Computer Studies) demonstrated that MF-DFA spectrum width correlates with cognitive fatigue more strongly than any standard keystroke metric.

### mfdfaSpectrumWidth
- **Source:** IKI series (same input as existing DFA)
- **Computation:** Extend existing DFA over moment orders q = -5 to +5 (11 values). For each q, compute generalized fluctuation function F_q(n) = [mean(F^2(n, v))^(q/2)]^(1/q) across box sizes n. Fit log(F_q) vs log(n) for each q to get generalized Hurst exponent h(q). Apply Legendre transform: alpha(q) = h(q) + q*h'(q), f(alpha) = q*(alpha - h(q)) + 1. Spectrum width = max(alpha) - min(alpha).
- **Unit:** dimensionless
- **Minimum data:** 256+ IKI values
- **Why:** Wide spectrum = multifractal, meaning small and large fluctuations follow different scaling laws. This is adaptive cognitive variability: the person can shift between automatic production and deliberate thinking. Narrow spectrum = monofractal, meaning the system is locked into one mode. Spectrum width narrowing over months that does not recover after rest periods is among the earliest indicators of eroding cognitive flexibility. The existing DFA alpha can remain in the healthy range while the spectrum collapses, because alpha captures average scaling while the spectrum captures scaling diversity.
- **Literature:** Kantelhardt et al. 2002 (original MF-DFA); Ihlen & Vereijken 2010 (spectrum width correlates with adaptive motor flexibility); Bennett, Roudaut & Metatla 2025 (direct keystroke IKI validation for fatigue).

### mfdfaAsymmetry
- **Source:** Singularity spectrum f(alpha) from MF-DFA computation
- **Computation:** `(alpha_peak - alpha_min) / (alpha_max - alpha_min)` where alpha_peak is the alpha value at maximum f(alpha).
- **Unit:** ratio (0-1)
- **Minimum data:** 256+ IKI values
- **Why:** Left-skewed (asymmetry < 0.5) = large fluctuations (deep pauses) dominate the scaling structure. Right-skewed (asymmetry > 0.5) = small fluctuations (micro-timing variations) dominate. Two sessions with identical spectrum width but different asymmetry are in different cognitive states: one is dominated by occasional deep processing episodes, the other by pervasive fine-grained timing variability.
- **Literature:** Kantelhardt et al. 2002; Ihlen 2012 (Frontiers in Physiology tutorial).

### mfdfaPeakAlpha
- **Source:** Singularity spectrum f(alpha) from MF-DFA computation
- **Computation:** The alpha value at maximum f(alpha). The dominant scaling behavior.
- **Unit:** dimensionless
- **Minimum data:** 256+ IKI values
- **Why:** Anchors the spectrum to a dominant Holder exponent, which characterizes the session's prevailing temporal structure independent of the spectrum's width or shape. Backward compatible: h(2) from MF-DFA equals the standard DFA alpha.
- **Literature:** Kantelhardt et al. 2002.

### Symbolic Dynamics Extensions (beyond Permutation Entropy)

The existing PE implementation computes normalized Shannon entropy of ordinal patterns. These extensions extract additional information from the same ordinal pattern distribution at near-zero computational cost. They answer a question no existing signal can: is the session's IKI sequence deterministic (structured attractor) or stochastic (random noise)?

### statisticalComplexity
- **Source:** Ordinal pattern distribution (already computed by existing PE)
- **Computation:** Jensen-Shannon statistical complexity C_JS. Compute the Jensen-Shannon divergence between the observed ordinal pattern distribution P and the uniform distribution P_e: JSD(P, P_e) = H((P + P_e)/2) - (H(P) + H(P_e))/2. Normalize by the maximum possible JSD for that alphabet size. C_JS = Q_0 * JSD * H[P] / H_max, where Q_0 is a normalization constant.
- **Unit:** dimensionless [0, 1]
- **Minimum data:** 50 IKI values (same as existing PE)
- **Why:** PE alone cannot distinguish a stochastic process from a chaotic deterministic one, because both can produce PE near 1.0. The complexity-entropy causality plane plots (H, C_JS) in a 2D space where stochastic processes cluster in the low-C_JS region and deterministic processes cluster in the high-C_JS region. A session with PE = 0.87 and C_JS = 0.38 is deterministic (structured cognitive exploration). A session with PE = 0.88 and C_JS = 0.12 is stochastic (noise). PE sees these as identical. Over a year, the trajectory in the (H, C_JS) plane tracks whether cognitive dynamics are becoming more random or more structured, independent of complexity level.
- **Literature:** Rosso et al. 2007 (complexity-entropy causality plane, foundational paper).

### forbiddenPatternFraction
- **Source:** Ordinal pattern distribution (already computed by existing PE)
- **Computation:** At order d, there are d! possible ordinal patterns. Count the number of patterns with zero occurrences in the session. Fraction = absent_count / d!. Reliable at orders 3-5 with 500 keystrokes (order 3: 6 patterns, order 5: 120 patterns).
- **Unit:** ratio [0, 1]
- **Minimum data:** 50+ IKI values at order 3; 130+ at order 5
- **Why:** In a deterministic system, certain ordinal patterns are topologically forbidden by the attractor geometry. They literally cannot occur. Random noise produces all patterns. The forbidden fraction is a direct test of determinism in the keystroke rhythm. A fraction trending toward zero over months means the cognitive constraints that made certain timing sequences impossible are dissolving. The system is losing its structure, not just its speed or regularity.
- **Literature:** Amigo et al. 2008 (forbidden ordinal patterns and determinism); Zanin et al. 2012 (forbidden patterns in time series analysis).

### weightedPermutationEntropy
- **Source:** IKI series and ordinal pattern extraction (extends existing PE)
- **Computation:** Standard PE ignores amplitude: a pattern (2,1,3) from values [100, 99, 101] is treated identically to one from [100, 10, 500]. Weighted PE assigns each pattern occurrence a weight proportional to the variance of the values in its embedding window, so high-amplitude fluctuations (deep pauses) contribute more to the entropy than low-amplitude ones (micro-timing jitter). The weighted distribution is then normalized and Shannon entropy computed.
- **Unit:** normalized [0, 1]
- **Minimum data:** 50 IKI values (same as existing PE)
- **Why:** More robust to noise and more sensitive to "spiky" features like sudden long pauses. Standard PE treats a session with one 3-second pause and 499 fast keystrokes the same as a session with uniformly moderate timing. Weighted PE gives the 3-second pause proportionally more influence on the entropy estimate, making it a better measure of cognitive disruption events embedded in otherwise fluent typing.
- **Literature:** Fadlallah et al. 2013 (Physical Review E; demonstrated better noise robustness and sensitivity to spiky features in EEG data).

### Recurrence Network Analysis (extensions of existing RQA)

The existing RQA computes determinism, laminarity, trapping time, and recurrence rate from the recurrence matrix. Recurrence network analysis reinterprets the same matrix as a complex network adjacency matrix and computes graph-theoretic properties. No new data preparation is needed; the recurrence matrix computed in `dynamical.rs` is reused directly.

### recurrenceTransitivity
- **Source:** Recurrence matrix (already computed by existing RQA)
- **Computation:** Treat the recurrence matrix as an adjacency matrix of an unweighted, undirected graph. Compute global transitivity: ratio of triangles to connected triples.
- **Unit:** ratio [0, 1]
- **Minimum data:** 30 IKI values (same as existing RQA)
- **Why:** Transitivity approximates the fractal dimension of the cognitive attractor, providing an independent dimension estimate that does not require the box-fitting procedure of DFA. When DFA alpha and recurrence transitivity diverge, the scaling structure is not simple and warrants investigation. RQA determinism measures "how much of the trajectory follows predictable paths." Transitivity measures "what shape is the space those paths live in."
- **Literature:** Donner et al. 2010, 2011 (recurrence networks, transitivity maps to attractor dimension); Zou et al. 2019 (Physics Reports, comprehensive review).

### recurrenceAvgPathLength
- **Source:** Recurrence matrix (already computed by existing RQA)
- **Computation:** Mean shortest path length in the recurrence network (BFS from each node). Computed only on the largest connected component if the network is disconnected.
- **Unit:** mean path length (dimensionless)
- **Minimum data:** 30 IKI values
- **Why:** Measures the geometric diameter of the cognitive attractor in phase space. Short path length means the system revisits everything quickly (tight cognitive loop, rumination). Long path length means the system traverses widely before returning (exploration or disorientation). In a depressive episode, path length would be expected to shrink as the cognitive state space contracts.
- **Literature:** Donner et al. 2010; Marwan et al. 2009 (complex network analysis of recurrences).

### recurrenceClusteringCoefficient
- **Source:** Recurrence matrix (already computed by existing RQA)
- **Computation:** Mean local clustering coefficient across all nodes in the recurrence network. For each node, compute the proportion of its neighbors that are also neighbors of each other.
- **Unit:** ratio [0, 1]
- **Minimum data:** 30 IKI values
- **Why:** Captures local cohesion of the attractor. High clustering means the system's recurrent states form tight local neighborhoods (stable attractor regions). Low clustering means the recurrent states are dispersed (diffuse, wandering dynamics). Complements transitivity (which is global) with local structure information.
- **Literature:** Donner et al. 2010.

### recurrenceAssortativity
- **Source:** Recurrence matrix (already computed by existing RQA)
- **Computation:** Pearson correlation between degrees of connected node pairs in the recurrence network. Positive assortativity means high-degree nodes connect to other high-degree nodes.
- **Unit:** correlation coefficient (-1 to 1)
- **Minimum data:** 30 IKI values
- **Why:** Whether extreme-timing states cluster together temporally. Positive assortativity means the most recurrent IKI values (timing states visited most often) are adjacent to each other in the sequence, indicating temporal concentration of habitual rhythms. Negative assortativity means habitual states are separated by unusual states, indicating alternation between familiar and novel cognitive patterns. RQA's global recurrence rate averages over this structure.
- **Literature:** Donner et al. 2011; Zou et al. 2019.

### Pause Duration Mixture Decomposition (data-driven process separation)

### pauseMixtureDecomposition
- **Source:** All inter-keystroke intervals within a session
- **Computation:** Fit a mixture of K lognormal distributions to the IKI series using Expectation-Maximization, selecting K by BIC (typically K=2-3). Extract per-component: means (mu_1, mu_2, ...) representing characteristic timescales, mixing proportions (pi_1, pi_2, ...) representing time spent in each process, and standard deviations representing process precision. The cognitive load index = pi_reflective / pi_motor (ratio of reflective to automatic mixing proportions).
- **Unit:** ms (component means), ratio (proportions and cognitive load index), count (component count)
- **Minimum data:** 100+ IKIs for 2-component fit; 200+ for 3-component fit
- **Why:** All current pause analysis uses fixed thresholds (2s for P-bursts, 30s for pause count). These thresholds are universal, not personal. The mixture model discovers data-driven boundaries between qualitatively different cognitive processes: motor execution, lexical retrieval, and reflective planning. These boundaries are person-specific and session-specific. Two sessions with identical mean IKI can have radically different mixture structures (one dominated by many short motor pauses, the other by fewer but longer cognitive pauses). The mixing proportion ratio directly quantifies how much deliberation occurs relative to fluent execution.
- **Literature:** Baaijen et al. 2021 (Frontiers in Psychology, validated on ~1000 essays, sensitive to writing task complexity); Medimorec & Risko 2022 (Reading and Writing, theoretically informed pause duration measures).

---

## Frequency-Domain Signals (Potential)

The existing signal pipeline operates entirely in the time domain (IKI statistics, DFA), the ordinal domain (PE), or the distributional domain (ex-Gaussian). No signal performs spectral analysis of the keystroke time series. The frequency domain is a structural blind spot. A single Lomb-Scargle periodogram of the IKI series opens this axis, producing multiple new signals from one computation. Lomb-Scargle is required rather than Welch because IKIs are unevenly spaced in time (keystrokes do not occur at regular intervals).

None of these require hardware changes. All are computable from the existing keystroke stream.

### ikiPsdRespiratoryPeakHz
- **Source:** IKI series from the keystroke stream
- **Computation:** Lomb-Scargle periodogram of the IKI time series (treating each IKI value as occurring at its midpoint timestamp). Identify spectral peak in the 0.15-0.35 Hz band (corresponding to 9-21 breaths per minute). Output: peak frequency (Hz), peak power, and peak-to-noise-floor ratio in this band. The noise floor is the median power across all frequencies.
- **Unit:** Hz (frequency), dimensionless (power and ratio)
- **Minimum data:** 200+ keystrokes spanning 2+ minutes of continuous typing (to capture 4-6 respiratory cycles)
- **Why:** Respiratory cycles modulate motor timing involuntarily. Voluntary actions synchronize preferentially with exhalation phases. Breathing rate entrains to repetitive motor tasks when they are close in frequency. Respiratory phase modulates cortical oscillatory activity across 2-150 Hz. The respiratory band peak in the IKI spectrum is a direct physiological signal that no time-domain statistic captures. Changes in respiratory coupling strength over months may reflect autonomic changes, anxiety (shallow breathing decouples from motor tasks), or respiratory pathology.
- **Literature:** Shibata et al. 2026 (Psychophysiology, respiratory-motor coupling in voluntary actions); Haas et al. (entrainment of respiration to repetitive tapping); Zelano et al. (PMC5226946, breathing as fundamental rhythm of brain function).

### peakTypingFrequencyHz
- **Source:** Keystroke onset timestamps from the keystroke stream
- **Computation:** Compute power spectral density of the binary keystroke onset signal (a point process at each keydown timestamp) using Lomb-Scargle with appropriate windowing. The peak frequency in the 2-15 Hz range is the peak typing frequency (PTF).
- **Unit:** Hz
- **Minimum data:** 200+ keystrokes
- **Why:** The PTF is an individual's characteristic motor oscillation frequency, reflecting the tuning of their cortico-basal ganglia-thalamic motor loop. Duprez et al. (2021) validated against simultaneous EEG recordings: PTF correlates with individual peak neural oscillation frequency. PTF is idiosyncratic (differs between individuals) but stable within an individual, making it a motor trait marker. A progressive drift in PTF over months is a frequency-domain signal of basal ganglia oscillator change that no time-domain statistic (mean IKI, DFA alpha, hold time CV) can detect. The cortico-basal ganglia loop is the primary target in PD and Huntington's.
- **Literature:** Duprez et al. 2021 (Journal of Cognitive Neuroscience, EEG-validated on n=30 healthy participants).

### ikiPsdLfHfRatio
- **Source:** IKI power spectral density (from Lomb-Scargle computation)
- **Computation:** Ratio of integrated spectral power in the low-frequency band (0.04-0.15 Hz) to the high-frequency band (0.15-0.4 Hz). Follows the frequency-band framework established for cardiac HRV analysis.
- **Unit:** ratio (dimensionless)
- **Minimum data:** 200+ keystrokes spanning 2+ minutes
- **Why:** The motor analog of the cardiac sympathetic/parasympathetic balance, computed from keystrokes instead of heartbeats. LF power reflects slow attention cycles (~0.1 Hz). HF power reflects respiratory-band motor modulation. On days of scattered attention, LF dominates. On days of focused flow, HF is proportionally stronger. Speculative in the keystroke domain but grounded in the established HRV frequency-band framework.
- **Literature:** ESC/NASPE Task Force 1996 (HRV frequency-band standards); PMC7381285 (Mayer wave, sympathetically mediated 0.1 Hz oscillations).

### ikiPsdSpectralSlope
- **Source:** IKI power spectral density (from Lomb-Scargle computation)
- **Computation:** Linear regression of log(power) vs log(frequency) across the full frequency range. The slope characterizes the noise color of the IKI series: slope near 0 = white noise (no temporal structure), slope near -1 = pink (1/f) noise (healthy long-range correlations), slope near -2 = brown noise (over-correlated drift).
- **Unit:** dimensionless (exponent)
- **Minimum data:** 200+ keystrokes
- **Why:** Provides an independent characterization of long-range temporal structure that complements DFA alpha. DFA works in the time domain via detrended box-fitting; spectral slope works in the frequency domain via power-law regression. Agreement between DFA alpha and spectral slope confirms the scaling is genuine. Disagreement indicates the scaling structure is more complex (e.g., crossover between regimes) and warrants investigation.
- **Literature:** Rangarajan & Ding 2000 (relationship between DFA exponent and spectral slope); Pilgram & Kaplan 1998.

### ikiPsdFastSlowVarianceRatio
- **Source:** IKI power spectral density (from Lomb-Scargle computation)
- **Computation:** Ratio of integrated spectral power above 1 Hz (fast motor variability) to integrated power below 0.5 Hz (slow cognitive variability).
- **Unit:** ratio (dimensionless)
- **Minimum data:** 200+ keystrokes spanning 2+ minutes
- **Why:** Decomposes IKI variability into timescale-specific components corresponding to different physiological processes. The fast component reflects arousal-level motor activation (~220ms timescale). The slow component reflects valence-related cognitive processing and attention cycles (~420ms+ timescale). Ex-Gaussian tau captures fast vs. slow in a distributional sense (exponential tail vs. Gaussian core), but that is a static decomposition. This is a temporal decomposition at specific frequency cutoffs, isolating the dynamic contribution of arousal-level processes from deliberation-level processes within the same session.
- **Literature:** Epp et al. 2011 (arousal effects on keystroke duration at fast timescale); Hofmann et al. 2009 (spreading activation timescales for arousal vs. valence).

---

## Cross-Session Motor Signals (Potential)

Cross-session signals that track motor system trajectory over time. These complement the existing cross-session family (which tracks semantic and linguistic drift) with motor distribution tracking. Both require prior session data. Neither requires hardware changes.

### distributionShapeChangeRate
- **Source:** Hold time and flight time distributions from consecutive sessions
- **Computation:** For each session, compute kernel density estimation (KDE) of hold times and flight times with fixed bandwidth. Represent each session as a binned probability vector. Compute the Wasserstein distance (earth mover's distance) between consecutive sessions' probability vectors. Two per-session values: `wassersteinHoldTime` and `wassersteinFlightTime`. The distribution shape change rate is the linear trend slope of Wasserstein distances over a rolling window (e.g., 30 sessions).
- **Unit:** Wasserstein distance (ms per session pair), slope (ms per session for trend)
- **Minimum data:** 2+ consecutive sessions for distance; 10+ for meaningful slope
- **Why:** The motor analog of self-perplexity. Self-perplexity asks "is my language becoming more predictable?" Wasserstein distance asks "is the shape of my motor timing distribution changing?" The shape can change (developing heavier tails, becoming bimodal, losing symmetry) while the mean and standard deviation remain stable. Lam et al. (2024) showed this pattern in ALS: the Wasserstein distance accelerates months before mean speed declines. The shape degrades first, because the tails change before the center does.
- **Literature:** Lam et al. 2024 (Scientific Reports, ALS n=93, longitudinal 3/6/9 months, distinguished ALS from controls even with mild dysfunction); Lam et al. 2021 (Multiple Sclerosis Journal, MS n=102, ICC 0.760-0.965 reliability).

### motorConsolidationIndex
- **Source:** Digraph latencies from consecutive-day sessions
- **Computation:** Track high-frequency digraphs (e.g., "th", "er", "in", "he", "an") across sessions on consecutive days. For each qualifying digraph (minimum 5 occurrences per session), compute improvement ratio: `(IKI_end_dayN - IKI_start_dayN+1) / IKI_end_dayN`. Positive = offline improvement (motor skill improved during sleep without practice). Negative = offline decay. Aggregate across qualifying digraphs for a session-level consolidation score.
- **Unit:** ratio (positive = overnight improvement, negative = overnight decay)
- **Minimum data:** 2 consecutive-day sessions with 5+ overlapping high-frequency digraphs each
- **Why:** Measures sleep-dependent motor memory consolidation, the only signal in the system capturing a physiological process that occurs when the user is not at the keyboard. During sleep, the striatum replays recently practiced motor sequences during sleep spindles, stabilizing and sometimes enhancing them. Degraded consolidation is an early marker of hippocampal and striatal dysfunction. Motor consolidation degrades early in MCI and Alzheimer's (before explicit memory consolidation does), making it a leading indicator from a system (procedural memory) separate from what most cognitive tests measure (declarative memory).
- **Literature:** Bonstrup et al. 2019, 2020 (Current Biology, rapid micro-learning gains during rest); Walker et al. 2003 (Neuron, practice with sleep makes perfect); motor consolidation validated as degraded in MCI, early AD, PD, and depression.

---

## Cognitive-Linguistic Signal Extensions (Potential)

Signals that bridge the motor-timing and linguistic-structural axes. The existing signal inventory treats the IKI stream as pure motor output and the final text as a separate surface-level linguistic product. These extensions model the interaction between what is being typed and how it is being typed.

### Temporal Irreversibility (thermodynamic arrow of keystroke dynamics)

### temporalIrreversibility
- **Source:** IKI series from the keystroke stream
- **Computation:** Bin IKI values into K discrete states (e.g., terciles or quintiles). Compute the forward transition matrix P_fwd(s_t | s_{t-1}) and the backward transition matrix P_bwd(s_{t-1} | s_t) from the binned series. Compute KL divergence: D_KL(P_fwd || P_bwd) = sum over all (i,j) of P_fwd(i,j) * log(P_fwd(i,j) / P_bwd(i,j)). Laplace smoothing on zero-count transitions to avoid log(0).
- **Unit:** bits (KL divergence)
- **Minimum data:** 100+ IKI values (sufficient transitions per bin)
- **Why:** Every existing dynamical signal (PE, DFA, SampEn, RQA) is symmetric under time reversal. Run the IKI series backward and you get the same PE, the same DFA alpha, the same sample entropy. But cognition has a thermodynamic arrow: engaged thinking is an out-of-equilibrium process that produces entropy. High irreversibility means the cognitive system is operating far from equilibrium (active, engaged, complex processing with asymmetric transitions: fast-to-slow is more common than slow-to-fast, or vice versa). Low irreversibility means near equilibrium (disengaged, automatic, or degraded). A flat session with high PE (symmetric disorder) shows low irreversibility. A session with the same PE but asymmetric transitions shows high irreversibility. PE cannot see this distinction. Over months, declining irreversibility would indicate the cognitive system is losing its out-of-equilibrium character, becoming more thermodynamically passive.
- **Literature:** De la Fuente et al. 2022 (Cerebral Cortex, temporal irreversibility of neural dynamics distinguishes conscious wakefulness from deep sleep and anesthesia); Martinez et al. 2023 (J. Neuroscience, irreversibility reduced in Alzheimer's). Validation is on neural dynamics (EEG), not keystroke dynamics. The thermodynamic argument transfers but has not been validated on motor timing data.

### Lexical Surprisal Decomposition (IKI = motor + linguistic)

**STATUS: NOT IMPLEMENTING.** The full version requires running an LLM over session text to compute per-word contextual surprisal. This introduces an external model dependency into the measurement pipeline, breaking the bit-reproducibility guarantee (INC-002, INC-005, INC-006) and the single-source-of-truth principle for measurements. The decomposition would be only as stable as the LLM producing the surprisal values, which is exactly the provenance problem INC-010 fixed for embeddings. Conceptually top-5 in the entire signal inventory; architecturally incompatible with the instrument's self-contained measurement philosophy. A word-frequency-only version (static lookup table, e.g., SUBTLEX-US log frequency) would preserve determinism but captures only the lexical frequency effect, not contextual prediction. Deferred until the architectural tension can be resolved.

### wordFrequencyIkiResidual (narrow deterministic version)
- **Source:** IKI series + final text + static word frequency table (SUBTLEX-US or equivalent)
- **Computation:** Align word boundaries to keystroke positions via text reconstruction. For each word-initial IKI, look up log word frequency from a frozen corpus frequency table. Regress word-initial IKI against log frequency. The regression slope is the lexical access cost per log-frequency unit. The residuals (actual IKI minus frequency-predicted IKI) are motor fluency stripped of lexical difficulty. Aggregate: mean residual (pure motor baseline), residual variance (motor consistency), and slope (lexical access sensitivity).
- **Unit:** ms (residuals), ms per log-frequency-unit (slope)
- **Minimum data:** 30+ word-initial IKIs with frequency lookup hits
- **Why:** Every IKI in the system conflates motor cost (moving fingers) and cognitive cost (deciding what to type). Pinet, Scaltritti & Alario (2016) proved word frequency affects first-keystroke latency (~36ms effect). The word-frequency regression strips the lexical component, leaving a purer motor signal. This is weaker than full contextual surprisal (which captures "how surprising is THIS word in THIS context") but uses a frozen lookup table with no model dependency. The slope (ms per log-frequency-unit) is itself a signal: increasing slope over months means lexical access is becoming more effortful.
- **Literature:** Pinet, Scaltritti & Alario 2016 (Psychonomic Bulletin & Review, word frequency affects first-keystroke latency); Wilcox et al. 2023 (TACL, ~3ms/bit surprisal-latency relationship across 11 languages, validates the broader principle but requires LLM for full implementation).

### Syntactic Dependency Distance

**STATUS: NOT IMPLEMENTING.** Requires a dependency parser (spaCy or Stanza), which are Python libraries. The current stack is TypeScript + Rust. Adding Python to the signal pipeline is an infrastructure decision, not a signal implementation decision. Additionally, Alice sessions are typically 50-200 words (3-10 sentences). MDD estimates on 3-sentence texts have very high variance. The clinical validation (Zhang et al. 2024, Lancashire & Hirst 2009) used substantially longer texts (novels, extended narratives). Clinically among the strongest NLP biomarkers for cognitive decline, but not implementable without a stack change and not reliable at Alice's session lengths. A lightweight approximation (mean clause length, subordination index via regex) could approximate MDD without Python (Oya 2011, r > 0.85 correlation), but would be a rough proxy. Deferred.

### meanDependencyDistance (documented for future reference)
- **Source:** Final submitted text, parsed via dependency parser
- **Computation:** For each sentence, build the dependency parse tree. For each dependency arc, compute the linear distance (word positions) between head and dependent. Mean dependency distance = mean arc length across all arcs in the response. Additional signals: max tree depth, proportion clausal vs. phrasal constructions, embedding depth distribution.
- **Unit:** word positions (MDD), depth levels (tree depth), ratio (clausal/phrasal)
- **Minimum data:** 5+ sentences for stable MDD estimates
- **Why:** Every linguistic measure in the system is surface-level (word counts, densities, sentence lengths, lexicon matches). None require a parse tree. Syntactic complexity is not sentence length. "I went to the store" and "The person who I told you about went to the store that I mentioned" have different dependency distances that sentence length approximates but cannot measure. AD patients produce shorter MDD and shift from hierarchical to linear constructions. The Iris Murdoch case study showed syntactic complexity declining in her novels years before clinical diagnosis. MDD occupies the syntactic-structural axis, orthogonal to lexical sophistication (MATTR, idea density) and semantic coherence (Coh-Metrix signals). High lexical sophistication with simple syntax is "smart but rigid." Low lexical sophistication with complex syntax is "simple words in elaborate structures." The combination creates a 2D space neither axis provides alone.
- **Literature:** Zhang et al. 2024 (Humanities and Social Sciences Communications, AD patients shorter MDD, shift from hierarchical to linear); Lancashire & Hirst 2009 (Iris Murdoch case study, syntactic complexity decline years before diagnosis); Liu 2008 (dependency distance as syntactic complexity measure).

### Ecological Stop-Signal Reaction Time (inhibition latency)

**STATUS: NOT IMPLEMENTING as a separate signal.** The core measurement already exists as `errorDetectionLatencyMean` in `tb_session_summaries` (mean interval from last non-delete keystroke to backspace press). The proposal adds distribution shape, within-session trajectory, and the Logan point-of-no-return framework (~200ms threshold distinguishing genuine inhibition from post-hoc cleanup). These are analytical extensions of an existing measurement, not a new measurement. The distribution shape and trajectory can be derived from the existing keystroke stream and deletion episode data in `process.rs` if needed, but the marginal information gain over the existing mean does not justify a new signal family. Documented here for the inhibition-theoretic framing, which is valuable context for interpreting the existing `errorDetectionLatencyMean`.

### ecologicalSsrt (documented for interpretive context)
- **Source:** Keystroke stream, deletion episode boundaries (already identified in `process.rs`)
- **Computation:** For each deletion episode, extract onset latency: time from last non-delete keystroke to first delete keystroke. Compute distribution shape (mean, std, skewness), within-session trajectory (first half vs. second half), and proportion of episodes with onset latency < 200ms (below the Logan point of no return, indicating inhibition occurred before the motor sequence completed, i.e., genuine stopping rather than post-hoc correction).
- **Unit:** ms (latency), ratio (sub-200ms proportion)
- **Minimum data:** 10+ deletion episodes per session
- **Why:** SSRT is the most widely used clinical measure of inhibitory control (Logan 1982). The deletion onset latency in natural typing is an ecologically valid SSRT computed passively and longitudinally. Jana et al. (Frontiers in Computational Neuroscience, 2020) validated that typing provides both hard lower and soft upper SSRT bounds. The sub-200ms proportion distinguishes genuine inhibition from cleanup. Executive function has three components: updating (captured by burst structure), shifting (captured by strategy shift count), and inhibition (partially captured by `errorDetectionLatencyMean` but without distribution analysis or the inhibition threshold framework).
- **Literature:** Logan 1982 (SSRT foundational); Logan, PMC4417067 (point of no return); Jana et al. 2020 (Frontiers in Computational Neuroscience, typing as SSRT source).

### Phonological Loading Index (inner speech from keystroke timing)

**STATUS: NOT IMPLEMENTING.** The effect is real and replicated (Wilkinson & Van Selst 2013) but the effect size is ~15-30ms at syllable boundaries, on top of IKI variance ranging 50-2000ms+ from all other sources. Alice sessions are 50-200 words. Many words appear once. Per-session signal-to-noise ratio is too poor for individual measurement. Over 100+ sessions the aggregate might reveal something, but the same phonological loading effect would be captured more reliably by the word-frequency IKI residual (which subsumes syllable boundary effects as part of lexical access cost). Conceptually elegant but practically marginal at Alice's session lengths.

### phonologicalLoadingIndex (documented for future reference)
- **Source:** IKI series + final text + syllable dictionary (CMU Pronouncing Dictionary or rule-based hyphenation)
- **Computation:** For each polysyllabic word in the produced text, identify syllable boundaries and map to keystroke positions. Compute mean IKI at syllable boundaries vs. mean IKI within syllables. The ratio (boundary-IKI / within-syllable-IKI) is the phonological loading index.
- **Unit:** ratio (>1.0 indicates syllable boundary inflation)
- **Minimum data:** 20+ polysyllabic words with sufficient within-word keystrokes
- **Why:** IKIs at syllable boundaries are significantly longer than within-syllable IKIs, even for pseudowords (Wilkinson & Van Selst 2013, Writing Systems Research). This holds for deaf typists, meaning it is orthographic-phonological, not articulatory. The effect reveals inner speech interfering with motor execution. A person whose phonological loading ratio increases over months may be experiencing increased reliance on phonological mediation during writing, a known compensatory mechanism when lexical access degrades. This would be the only signal bridging motor timing and sub-lexical linguistic structure.
- **Literature:** Wilkinson & Van Selst 2013 (Writing Systems Research, syllable boundary IKI inflation, replicated, holds for deaf typists).

### Discourse-Level Global Coherence

### discourseGlobalCoherence
- **Source:** Final submitted text, sentence-level embeddings via Qwen3-Embedding-0.6B (existing TEI infrastructure)
- **Computation:** Split the response into sentences. Embed each sentence. Compute cosine similarity of each sentence to the first sentence (global coherence: is the response maintaining its thematic thread?). Compute cosine similarity of each sentence to the immediately preceding sentence (local coherence: are adjacent ideas connected?). Output: mean global coherence, mean local coherence, global/local ratio, and global coherence decay slope (does thematic consistency erode through the response?). Minimum sentence gate: 5+ sentences required; shorter responses return null.
- **Unit:** cosine similarity (0-1), ratio (global/local), slope (decay)
- **Minimum data:** 5+ sentences per response
- **Why:** The system can detect vocabulary shrinking (lexical sophistication), language becoming more predictable (self-perplexity), and text networks thinning (text network density). It cannot detect that responses are becoming incoherent at the discourse level while remaining locally fluent. That is the clinical pattern: local coherence stays intact while global coherence collapses. Referential cohesion and text network density measure sentence-to-sentence connectivity and word co-occurrence structure. Discourse coherence is a higher-order construct about maintaining thematic intent across the full response. Asgari et al. (EMNLP, 2023) showed global coherence declined in MCI patients over 6 months while local coherence did not, and neither MoCA nor ADAS-Cog detected change over the same period.
- **Literature:** Asgari et al. 2023 (EMNLP, global coherence more sensitive than clinical instruments for MCI); Reagan et al. 2016 (emotional arc methodology, related structural analysis).

---

## Signal Count

Counted at the database column level (ground truth). Arrays count as 1 column. Derived state dimensions (7D, 11D) are not double-counted against their source columns.

### Base measurements (database columns)

| Table | Columns | Notes |
|---|---|---|
| tb_session_summaries | 76 | All raw production, pause, deletion, P-burst, keystroke dynamics, revision, re-engagement, linguistic densities, session metadata, Phase 1 cursor/writing, Phase 2 mouse/correction/revision/punctuation |
| tb_dynamical_signals | 13 | 11 scalar + pe_spectrum (JSONB) + iki_count/hold_flight_count metadata |
| tb_motor_signals | 13 | 11 scalar + iki_autocorrelation (JSONB) + digraph_latency (JSONB) |
| tb_semantic_signals | 8 | TS-computed linguistic analysis |
| tb_process_signals | 9 | Rust-computed text reconstruction signals |
| tb_cross_session_signals | 10 | TS-computed longitudinal signals |
| **Column total** | **129** | arrays counted as 1 |

### Expanded dimensions (if counting array elements)

| Array | Elements | Expanded total |
|---|---|---|
| pe_spectrum | 5 (orders 3-7) | +4 |
| iki_autocorrelation | 5 (lags 1-5) | +4 |
| digraph_latency | ~10-30 (top bigrams) | +~9-29 |
| **Dimension total** | | **~146-162** |

### Derived state dimensions (computed from base, not double-counted)

| Table | Dimensions | Source |
|---|---|---|
| tb_entry_states | 8 | 7D behavioral + volatility + convergence, from session summary fields |
| tb_semantic_states | 11 | 11D semantic, from linguistic density fields |
| tb_calibration_context | 7 | Categorical tags from calibration free-writes |

### Additional structures

| Structure | Fields | Notes |
|---|---|---|
| tb_rburst_sequences | 5 per burst | Per-burst detail, not per-session |
| Avatar / ghost engine | 5 variants, 22 profile fields | Reconstruction adversary, not counted as signals |
| Reconstruction residuals | per-signal | Stored in tb_reconstruction_residuals |

### Somatic signals (potential, not yet implemented)

12 signals derivable from existing keystroke stream: rollover distribution, error topology, thumb channel, correction strategy, shift anticipation, key geography, bilateral rhythm coherence, post-pause motor signature, deletion kinematics, digraph asymmetry, tremor frequency estimation, per-finger hold-time drift.

### Dynamical signal extensions (potential, not yet implemented)

~13 columns across 4 sub-families: MF-DFA (spectrum width, asymmetry, peak alpha), symbolic dynamics (statistical complexity, forbidden pattern fraction, weighted PE), recurrence networks (transitivity, avg path length, clustering coefficient, assortativity), pause mixture decomposition (component count, motor proportion, cognitive load index).

### Frequency-domain signals (potential, not yet implemented)

~5 columns from a single Lomb-Scargle periodogram: respiratory band peak Hz, peak typing frequency Hz, LF/HF ratio, spectral slope, fast/slow variance ratio.

### Cross-session motor signals (potential, not yet implemented)

~4 columns: Wasserstein distance for hold times, Wasserstein distance for flight times, distribution shape change rate (slope), motor consolidation index.

### Cognitive-linguistic signal extensions (potential, mixed implementation status)

6 signals documented. 2 implementing (temporal irreversibility, discourse global coherence). 1 implementing in narrow form (word frequency IKI residual, static lookup only). 3 not implementing (full lexical surprisal decomposition, syntactic dependency distance, phonological loading index). 1 existing signal reframed (ecological SSRT maps to existing `errorDetectionLatencyMean`). ~5-7 new columns from the implementing set.

### Summary

The "~163" historically referenced in the codebase approximated column count + expanded arrays + digraph estimate. The precise count depends on methodology:

| Methodology | Count |
|---|---|
| Database columns (arrays as 1) | 129 |
| Expanded dimensions (arrays expanded, digraph ~30) | ~165 |
| With derived state dimensions | ~191 |
| With potential somatic signals | ~203 |
| With all potential extensions (somatic + dynamical + frequency + cross-session motor) | ~225 |
| With cognitive-linguistic extensions (implementing subset) | ~232 |
