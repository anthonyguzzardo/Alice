# Observatory

The observatory is Alice's behavioral analysis layer. It watches *how* you write — not what you write — and builds a falsifiable model of your patterns over time.

## What it does

Every journal entry produces a session summary from keystroke dynamics: how long before the first keystroke, how fast you typed, how many times you deleted large chunks, how often you left the page, your production burst patterns. From these raw signals, the system computes an 8-dimensional behavioral state, makes predictions about future entries, and tests those predictions against what actually happens.

The observatory surfaces this process — and, critically, makes the system's learning visible. Not just what it measured, but whether its model of you is getting smarter.

---

## Design principles

**Narrative over data.** The observatory leads with plain-English interpretation, not raw numbers. Every section answers "so what?" before showing the underlying evidence.

**The loop is visible.** The core value of this system isn't any single measurement — it's the compound loop: responses shape observations, observations shape predictions, predictions shape questions, questions shape responses. The observatory makes this loop legible at every level.

**Progressive disclosure.** The main view is interpretable by anyone. Power-user visualizations (heatmap, coupling matrix) are accessible but don't compete for attention.

**Human-readable by default.** Behavioral dimensions use plain language labels ("notably high", "slightly lower", "typical") with raw z-scores as subtle secondary labels. The sigma notation exists for those who want it but never leads.

---

## Pages

### `/observatory` — Main view

**Prediction arc timeline** (hero)
Canvas visualization showing every prediction as an arc from the day it was made to the day it resolved. Green arcs = confirmed, red = falsified, gray dashed = still open. Longer-span predictions arc higher. Entry dots sit along the baseline. Hovering shows the hypothesis text; clicking an entry dot opens the inline detail panel.

**Scoreboard**
Compact row: total entries, total predictions, confirmed count, falsified count, open count.

**System calibration**
Rolling accuracy curve showing the system's prediction hit rate over time. Each dot is colored by outcome (green/red). The line shows rolling accuracy over a 6-prediction window. Right side displays current accuracy percentage and trend direction (improving / declining / holding steady). This answers: "Is the system getting smarter about you?"

**Right now** (narrative)
Plain-English insights about the latest entry. Translates behavioral state into readable language: "You wrote with unusually sustained flow" or "Your hesitation has been climbing for 4 straight sessions." Notable deviations get a blue accent; rare ones (>2σ) get red. Also surfaces sustained trends (arcs) — monotonic runs across dimensions.

**Recent calls**
Compact rows showing the 8 most recently resolved predictions. Each row: status badge, hypothesis text (truncated), resolution date. One line per prediction — scannable at a glance.

**Running theories**
Compact list with colored status dots (blue = active, green = established, red = retired), theory name, description (single line, truncated), inline confidence bar, and accuracy/count. Sorted: active first by prediction count, then established, then retired.

**Behavioral dimensions** (grouped sparklines)
8 dimensions organized into 3 interpretive groups:
- **Flow** — fluency + presence (how you engaged)
- **Process** — deliberation + revision + corrections (how you edited)
- **Shape** — expression + commitment + volatility (what came out)

Each group has a one-line summary derived from the latest values ("fluency is notably high" or "all within normal range"). Each dimension row shows a sparkline with the current value as a human-readable label ("higher than usual") and a subtle raw number (+1.52).

**Behavioral heatmap** (collapsible)
Collapsed by default. Click to expand. Compact 8-row × N-column heatmap. One row per dimension, one column per entry. Warm colors = positive z-scores, cool colors = negative. Only renders when opened (lazy draw).

**Inline entry panel**
Expands when you click any entry dot, sparkline point, or heatmap column. Shows:

- **The loop** — A trace showing how this entry connects to the system's learning:
  - Predictions this entry *resolved* (confirmed/falsified), with origin date and hypothesis
  - Theories *updated* by those graded predictions, with current confidence and status
  - New predictions *generated* from this entry
- The question Alice asked
- Bob's three-frame observation (Charitable / Avoidance / Mundane)
- Predictions generated from that entry with status badges
- The suppressed question (what Alice wanted to ask but didn't)
- A mini radar chart showing the entry's behavioral shape
- Arrow keys and prev/next buttons for navigation, ESC to close

**Patterns**
Plain-English descriptions of discovered behavioral couplings and emotion-behavior links, with correlation evidence.

### `/observatory/coupling` — Data deep-dive

**Discoveries** — top behavioral couplings rendered as plain-English findings with correlation evidence.

**Theories** — all theory cards with posterior mean progress bars and log Bayes factors.

**Behavioral coupling matrix** — 8×8 heatmap showing signed Pearson correlations between all dimension pairs. Blue cells = positive coupling, red = negative. Click a cell to overlay the two coupled time series with lag shift applied.

**Emotion-behavior coupling table** — top 15 emotion-to-behavior correlations with lag, direction, and strength.

**Dynamics per dimension** — 8 cards showing baseline, variability, attractor force, current state, and deviation from baseline for each dimension.

### `/observatory/entry/[id]` — Single entry detail

Question text, three-frame observation, loop trace (predictions resolved, theory impact, predictions generated), predictions with status, suppressed question, collapsible behavioral detail section with radar chart and full metrics grid (timing, production, revision, engagement, fluency, emotion, linguistic).

---

## The loop

The observatory exists to make visible something that would otherwise be invisible: the system is learning.

```
Question (shaped by uncertain theories)
    ↓
Response (user writes)
    ↓
Observation (3-frame analysis: charitable / avoidance / mundane)
    ↓
Predictions created (falsifiable, with structured grading criteria)
    ↓
Predictions graded (by future entries, deterministically or interpretively)
    ↓
Theory confidence updated (Bayesian Beta-Binomial, log Bayes factors)
    ↓
Next question shaped (Thompson sampling targets uncertain theories)
    ↓
... cycle repeats
```

Each entry turns the loop once. The calibration curve shows whether the accumulated structure is outperforming what any single inference call could produce. The loop trace in the entry panel shows the causal chain for each individual turn.

The system gets meaningfully smarter about you every cycle without spending a dollar on training. The constraint — one entry per day — is what makes each turn honest.

---

## The 8 behavioral dimensions

All dimensions are z-scored against personal history. A value of +1.5 means 1.5 standard deviations above that person's mean. Every signal is relative — only meaningful compared to your own baseline.

Human-readable labels translate z-scores for the UI:

| Z-score range | Label |
|---------------|-------|
| |z| < 0.5 | typical |
| 0.5 ≤ |z| < 1.0 | slightly higher / lower |
| 1.0 ≤ |z| < 1.5 | higher / lower than usual |
| 1.5 ≤ |z| < 2.0 | notably high / low |
| |z| ≥ 2.0 | unusually high / low |

| Dimension | Group | What it measures | Raw signals |
|-----------|-------|-----------------|-------------|
| **Fluency** | Flow | Sustained production flow | Average P-burst length (chars), chars per minute. P-bursts are continuous typing bounded by 2-second pauses. |
| **Presence** | Flow | Focus and attention | Negated average of tab-away rate and pause rate. High = stayed focused, low = distracted. |
| **Deliberation** | Process | Cognitive load and hesitation | First keystroke delay, pause rate (30s+ pauses per minute), revision weight (large deletion chars / total typed). Average of three z-scores. |
| **Revision** | Process | How much rethinking happens | Inverted commitment ratio + substantive deletion rate (large deletions per 100 chars). Large deletion = 10+ chars. |
| **Thermal** | Process | Correction intensity | Small deletion rate (typo fixes) + revision timing (fraction of large deletions in second half of session). |
| **Expression** | Shape | Deviation from personal style | Absolute z-scores of sentence length, question density, first-person density, hedging density. Average of four. |
| **Commitment** | Shape | How much text is retained | Final char count / total chars typed, z-scored. High = kept almost everything. |
| **Volatility** | Shape | Session-to-session instability | Euclidean distance from previous entry in 4D subspace (fluency, deliberation, revision, commitment). |

**Convergence** — Euclidean distance from personal center in 8D space, normalized to [0, 1]. High convergence means multiple dimensions moved together (coordinated behavioral shift).

---

## Trait dynamics

Computed per dimension when 5+ entries exist. Rolling window of 30 entries.

**Baseline** — Rolling mean. Your stable set point in that dimension.

**Variability** — Rolling standard deviation. How much you fluctuate.

**Attractor force** — How quickly deviations snap back to baseline. Estimated from lag-1 autocorrelation of deviations (Ornstein-Uhlenbeck mean-reversion). Range 0-1:
- Near 0 (malleable): deviations persist, the dimension drifts
- Near 0.5 (moderate): normal variability
- Near 1 (rigid): snaps back to baseline immediately

**Current state** — Latest z-score.

**Deviation** — How far current state is from baseline in sigma units.

---

## Coupling discovery

Identifies lagged cross-correlations between dimension pairs. Tests lags from -3 to +3 sessions. Reports signed Pearson correlations above |r| >= 0.3.

**Behavioral coupling**: any pair of the 8 dimensions can lead or follow another. Example: fluency increases, then commitment drops 2 sessions later (r = -0.68).

**Emotion-behavior coupling**: NRC emotion densities (anger, fear, joy, sadness, trust, anticipation) and Pennebaker categories (cognitive, hedging, first-person) tested against the 8 behavioral dimensions. Positive lags only (emotion leads behavior). Example: fear language increases, then presence drops 2 sessions later (r = -0.59).

Minimum 10 entries required for coupling discovery.

---

## Prediction system

### How predictions are made

After each entry, the observation pipeline runs three sequential steps:

1. **Observe** — Claude reads the response text + behavioral signals + dynamics context + recent history. Produces a three-frame observation (Charitable reading / Avoidance reading / Mundane reading) plus a synthesis. This is not shown to the user.

2. **Suppress** — Claude generates one question it considered asking but held back, targeting the area of highest uncertainty.

3. **Predict** — Claude generates 1-2 new falsifiable predictions using structured criteria. Each prediction specifies:
   - A hypothesis in natural language
   - Confirmation criteria (what would make it true)
   - Falsification criteria (what would make it false)
   - A time window (how many future sessions to evaluate)
   - A window mode (any/all/majority/latest)

Theory selection uses Thompson sampling from active theories to balance exploration vs. exploitation.

### How predictions are graded

All predictions are graded deterministically by code, not by the LLM. The grader evaluates structured criteria against computed signals.

**Criterion types:**
- **Threshold** — Signal above/below/between specific values
- **Percentile** — Signal in top/bottom N% of personal history
- **Direction** — Signal increased/decreased from a reference value
- **Text search** — Regex match against response text
- **Compound** — Logical AND/OR of sub-criteria

**Window modes:**
- `latest` — Only the most recent session counts
- `any` — Confirmed if any session in the window matches
- `all` — Confirmed only if every session matches
- `majority` — Confirmed if >50% of sessions match

Falsification is checked first. If falsification criteria are met, the prediction is falsified regardless of confirmation criteria.

### Signal sources

Predictions can reference ~70 signals across three domains:

- **Session signals** (~30): raw keystroke and linguistic metrics from `tb_session_summaries`
- **Delta signals** (~10): difference between calibration and journal session on the same day
- **Dynamics signals** (~42): 8 dimensions × 5 parameters + velocity + system entropy

---

## Theory confidence

Each theory tracks a Beta(alpha, beta) posterior distribution.

- Prior: Beta(1, 1) — uniform, no bias
- Each confirmed prediction: alpha += 1
- Each falsified prediction: beta += 1
- Posterior mean: alpha / (alpha + beta) — estimated success rate

**Log Bayes factor** — cumulative evidence score using Sequential Probability Ratio Test. Each hit adds ln(2), each miss subtracts ln(2).

**Status thresholds:**
- **Established**: log BF >= ln(10) ~ 2.30 (Bayes factor > 10, strong evidence)
- **Retired**: log BF <= -ln(10) ~ -2.30 AND >= 3 predictions tested (strong counter-evidence)
- **Active**: everything in between

**Expected Information Gain (EIG)** — binary entropy of the posterior. High EIG (near 0.5) = uncertain, worth testing. Low EIG = settled, deprioritize. Used by Thompson sampling to balance exploration.

---

## System calibration

The calibration curve computes rolling prediction accuracy over a 6-prediction window, sorted by grading date. This answers the compound-learning question: is the accumulated structure (signals → observations → predictions → theories → questions) producing better predictions over time than any single inference call could?

The trend is classified as:
- **Improving**: second-half average accuracy > first-half by ≥ 5 percentage points
- **Declining**: second-half average accuracy < first-half by ≥ 5 percentage points
- **Holding steady**: difference < 5 percentage points

Requires at least 4 graded predictions to display.

---

## Phase detection

The dynamics engine classifies the current behavioral phase from the most recent 5 entries:

- **Disrupted** — Latest convergence >= 0.6 and prior 4 sessions averaged < 0.35. Sudden coordinated shift.
- **Shifting** — Any dimension shows a monotonic trend (3+ of 4 consecutive steps in the same direction).
- **Stable** — No disruption, no sustained trends.
- **Insufficient** — Fewer than 5 entries.

**Velocity** — rate of movement through 8D space over the last 5 entries. Normalized to [0, 1].

**System entropy** — Shannon entropy of rolling variabilities across all 8 dimensions, normalized by max entropy (ln 8). High entropy = all dimensions equally variable. Low entropy = some rigid, some volatile.

---

## Light mode

All observatory pages support light/dark mode via the `alice-theme` localStorage key and CSS custom properties. Theme toggle button in the nav bar. The journal index page controls the same localStorage key, so theme persists across all pages.

Pages that remain dark-only: alice-negative, lab, gallery.

---

## Key thresholds

| Constant | Value | Purpose |
|----------|-------|---------|
| Min entries for 8D state | 3 | Need enough history for z-scoring |
| Min entries for dynamics | 5 | Need enough for baseline/variability |
| Min entries for coupling | 10 | Need enough for meaningful correlations |
| Min graded for calibration | 4 | Need enough for rolling accuracy |
| Rolling window | 30 entries | Baseline and variability calculation |
| Calibration window | 6 predictions | Rolling accuracy smoothing |
| Max coupling lag | 3 sessions | How far ahead/behind to test |
| Coupling threshold | \|r\| >= 0.3 | Minimum correlation to report |
| Large deletion | 10+ chars | Distinguishes correction from revision |
| Convergence high | >= 0.6 | Coordinated behavioral shift |
| Log BF established | ~2.30 | Bayes factor > 10 |
| Log BF retired | ~-2.30 | Bayes factor < 0.1, min 3 predictions |
| Percentile min history | 5 | Minimum for percentile-based grading |

---

## Research foundations

- **P-bursts**: Chenoweth & Hayes (2001), Deane (2015) — production bursts as fluency measure
- **Revision taxonomy**: Faigley & Witte (1981) — surface vs. meaning-changing revisions
- **Editing behavior**: Baaijen et al. (2012) — revision as cognitive process
- **Emotion lexicon**: NRC Emotion Lexicon, Mohammad & Turney (2013)
- **Linguistic markers**: Pennebaker (2011) — function words as psychological markers
- **Mean reversion**: Ornstein-Uhlenbeck process — attractor force estimation
- **Theory testing**: Sequential Probability Ratio Test — cumulative Bayes factors
- **Exploration**: Thompson sampling — balancing exploration vs. exploitation in theory selection
