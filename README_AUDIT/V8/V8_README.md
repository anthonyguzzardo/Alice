> **Note:** This document predates the rename from Marrow to Alice (2026-04-12).

# Marrow

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## What It Does

Marrow asks you one question every day. You answer it. That's it.

There is no feed, no streak counter, no summary of your progress. Your responses go into a black box. You never see them again. The system sees them. You don't.

## How It Works

### The Two Phases

Marrow operates in two distinct phases. The transition is invisible to the user.

#### Phase 1: Seed (Days 1-30)

Thirty questions delivered one per day in a fixed sequence. All thirty are deep, designed to create friction:

1. Unanswerable in one sentence
2. About you, not a topic
3. No right answer
4. Worth returning to in three months

During this phase, **the questions do not adapt**. But the system is not idle. Every submission triggers the AI's silent observation layer, building an internal model of the user from day 1. The questions are fixed. The watching is not.

#### Phase 2: Generated (Day 31+)

After the seeds run out, the system generates tomorrow's question from a bounded, relevant context window — not the entire history. Every response is embedded as a vector (via Voyage AI) and stored for semantic retrieval. When generating a question, the system assembles:

- **Recent entries** (last 14, verbatim) — the raw, uncompressed source of truth
- **Resonant older entries** (retrieved by semantic similarity) — past entries that echo current themes, pulled from the full history regardless of age
- **Contrarian entries** (deliberately dissimilar) — entries that are the *most different* from current themes. These break the echo chamber by forcing the system to remember threads it's been ignoring. If you've been writing about your career for weeks, the contrarian slot surfaces the entry about your dad from three months ago.
- **Recent reflections** (last 4, in full) — the model's weekly pattern analyses, explicitly marked as hypothesis, not fact. If a reflection contradicts a raw entry, the entry wins.
- **Resurfaced older reflections** (via semantic retrieval) — older reflections are not permanently included in every prompt. They only reappear if the system detects their themes are relevant to the current moment. An old hypothesis has to earn its way back — but it's never permanently gone.
- **Recent observations, suppressed questions, behavioral data, and feedback** — scoped to recent context, not the entire archive

The prompt grows to a fixed size and stays there. Day 50 and day 500 produce prompts of the same scale, but the semantic retrieval ensures the system always reaches back to what's relevant — including entries from months ago that resonate with the current moment. The contrarian retrieval ensures it doesn't only reach back to what's *similar*.

No question is generated in advance. Tomorrow's question doesn't exist until you submit today's response. There is nothing to preview, leak, or game.

### Data Collection

Marrow captures three layers of data per session, all invisible to the user.

#### Layer 1: Response Text

What you submitted. Stored as-is. Never surfaced back to you.

#### Layer 2: Behavioral Signal

The system silently captures raw input events throughout the session — keystrokes, deletions, pauses, tab-aways, resumptions. On submission, these raw events are crunched into a session summary: a single row of derived behavioral metrics plus context metadata.

The variables that contribute to signal:

- **First-keystroke latency** — how long you sat with the question before starting. Only meaningful relative to your calibration baseline *on the same device type and similar time of day*. A 47-second pause on your phone at midnight is a different signal than 47 seconds on your laptop at 9am.
- **P-burst metrics** (Chenoweth & Hayes, 2001) — text produced between 2-second pauses. Burst count and average burst length measure production fluency. Long, sustained bursts indicate flow states. Short, fragmented bursts indicate cognitive load or deliberate composition. The single strongest behavioral predictor of writing quality in process research.
- **Commitment ratio** — total characters typed vs. final character count. Heavy editing could mean avoidance, or it could mean careful writing. The system applies three interpretive frames to determine which is more likely.
- **Deletion decomposition** (Faigley & Witte, 1981) — small deletions (<10 characters) are corrections (typo fixes, word swaps). Large deletions (>=10 characters) are revisions (substantive rethinking, sentence-level rewrites). The system tracks counts, character volumes, and timing of each type independently. The distinction matters: 50 small backspaces is noise, 2 large deletions where someone wrote a paragraph and killed it is signal.
- **Revision timing** — whether large deletions occurred in the first or second half of the session. Early revisions indicate false starts — couldn't settle on an opening. Late revisions indicate writing a draft and then gutting sections — a qualitatively different signal that changes how the three frames interpret the same commitment ratio.
- **Active typing speed** — characters per minute measured only during active typing time (excluding pauses and tab-aways). Removes session length as a confound.
- **Pause topology** — where in the response you stall matters, but only relative to where you normally stall on the same device in similar conditions.
- **Session rhythm** — the temporal shape of the session. Burst-pause-burst is a different thinking mode than slow-and-steady.
- **Tab-away behavior** — leaving the page and returning. Duration of absence. Whether typing speed changes after return.
- **Lexical diversity** (McCarthy & Jarvis, 2010) — MATTR (moving-average type-token ratio) with a 25-word window. Length-independent, validated for short texts. Tracks whether vocabulary is narrowing or expanding across sessions.
- **Punctuation and structure** — tracked but interpreted cautiously. Punctuation habits are shaped by device, platform, and personal style as much as by psychological state.

Every session also captures **context metadata**: device type (mobile/desktop), user agent, hour of day, and day of week. This prevents the system from comparing your exhausted Friday-night phone session against your focused Tuesday-morning laptop session and concluding you were "avoidant."

All behavioral metrics are normalized as personal percentiles — compared against the user's own history, not population norms. A "high" P-burst length means high relative to this person's baseline, not high in absolute terms. When the AI reads behavioral data, it receives each metric verbalized with its percentile rank and personal baseline, structured by signal importance — primary signals first (deletion character, production fluency, commitment), supporting context middle (duration, pauses, tab-aways), trajectory context last.

#### Layer 3: The AI's Silent Layer

Every day after submission, the AI reads the response, the behavioral signal, context-matched calibration baselines, and all of its own prior observations. It applies **three interpretive frames** to every notable signal:

**Frame A — Charitable:** The user is being thoughtful, careful, honest, or simply editing for quality. Deletions are revisions. Pauses are contemplation. Vagueness is appropriate boundary-setting.

**Frame B — Avoidance:** The user is hedging, self-censoring, retreating from honesty, or protecting themselves. Deletions are retractions. Pauses are resistance. Vagueness is deflection.

**Frame C — Mundane:** The behavior has no psychological meaning. The user was distracted, tired, on a different device, dealing with autocorrect, or is just a careful writer. The signal is noise.

These are not three guesses from the same perspective. They are three deliberately opposed lenses. For each signal, the system applies all three, then assesses which frame the calibration data and cross-session patterns support. Where the frames genuinely diverge with no clear winner, the system says so and assigns an overall confidence level (HIGH / MODERATE / LOW / INSUFFICIENT DATA).

The system also generates a **suppressed question** — the question the AI would ask tomorrow if it could. This question must target the highest-uncertainty gap: the place where Frame A and Frame B give equally plausible but contradictory reads. It is designed to *disambiguate*, not to probe the most dramatic interpretation.

A bad suppressed question: "What are you hiding?" (presupposes Frame B)
A good suppressed question: "When you revise what you've written, what are you usually trying to get closer to?" (helps distinguish A from B)

### Calibration

The system needs to know what "normal" looks like for you. Without a baseline, every pause looks meaningful and every deletion looks like avoidance.

Calibration is on-demand. After you submit your daily question, a "free write" option appears. Click it, get a neutral prompt — "Describe what you did this morning" or "What's on your desk right now?" — and write. Same textarea. Same invisible behavioral capture. Same session summary with full context metadata. But tagged as calibration data, not interpreted by the AI.

You can do as many as you want. Three in one sitting, or none for a week. The baseline gets richer over time at your own pace.

Calibration baselines are **context-matched**. The system compares your deep question session against calibration sessions from the same device type and similar time of day. When it lacks calibration data for a specific context, it falls back to global baselines and flags the reduced confidence. Baseline confidence is a spectrum — none, low, moderate, strong — not a binary.

The daily question always comes first. You cannot access free writes until you've answered. The daily question is sacred. Calibration is secondary.

### Error Correction

The system is designed to catch its own mistakes. Seven mechanisms prevent interpretive drift:

**1. Context-matched calibration baselines.** The system knows what your "normal" looks like on the same device at a similar time of day. It only flags behavioral metrics that deviate significantly from your personal baseline in that context. A 47-second pause is not "meaningful" if your baseline on the same device at the same hour is 40 seconds.

**2. Three interpretive frames.** The AI cannot collapse to a single narrative. It must apply charitable, avoidance, and mundane frames to every signal and assess which one the data supports. This produces structured disagreement along axes that matter, not three variations of the same story.

**3. "Did it land?" feedback.** Every 5th daily submission, a simple yes/no prompt appears: "Did today's question land?" One bit of external signal. A "no" is clear — the system's line of questioning missed. A "yes" is weaker signal — could mean insightful, uncomfortable, or just emotionally loaded. This tunes question generation without breaking the black box.

**4. Weekly self-correction.** Every 7th response, the AI runs a reflection that includes a mandatory self-correction section. It must:
- Identify which observations were likely wrong — where the charitable or mundane frame fit better than the avoidance frame
- Flag where the three frames converged too much, producing "decorated confirmation bias" rather than genuine disagreement
- Name suppressed questions that presupposed an interpretation rather than disambiguating between frames
- Identify narratives it has been building that might be stories rather than evidence
- Flag where it lacked calibration data for a specific context and should have been more cautious
- State what it's confident about vs. uncertain about vs. needs more data on

If it cannot identify at least one error, it's not being honest. Every model drifts. The system is designed to name the drift.

**5. Multi-model audit.** Every weekly reflection runs two passes. The primary reflection is generated by Claude Opus 4.6. A secondary audit is then run by Claude Sonnet 4.6, which reviews the primary reflection against the same raw data and checks for: overconfident claims, confirmation bias, dishonest self-correction (identifying minor errors while protecting major narratives), and missed patterns. The audit is appended to the reflection and becomes context for all future analysis.

One model generating three interpretations is structured self-disagreement. Two different models reviewing each other's work is genuine independence. The daily observations use the first approach (cheaper, controlled). The weekly reflection uses both.

**6. Contrarian retrieval.** Semantic retrieval has its own bias: it surfaces entries with similar *language*, which reinforces dominant themes. If the user writes about their career every week, RAG keeps pulling career entries, and the system asks more career questions. Contrarian retrieval deliberately surfaces entries that are the *most dissimilar* to the current cluster — threads the system has been ignoring. This breaks semantic lock-in at the retrieval layer, before the interpretive frames are even applied.

**7. Reflection decay.** Old reflections can become self-reinforcing. A hypothesis from month 2 — "this person is avoiding a career decision" — could sit in every prompt at month 8, shaping how the model reads new entries even if the pattern is long gone. The system includes only the last 4 reflections in full. Older reflections are stored and embedded but only resurface via semantic retrieval when their themes are relevant to the current moment. An old hypothesis has to earn its way back into the prompt — but it's never permanently gone.

### Event-Driven Architecture

Everything fires on a single event: the user hitting submit.

#### On Submission (Daily Question)

1. **Response + session summary + context metadata saved** — the response text, all derived behavioral metrics, and device/time context are written to the database.
2. **AI observation runs** — reads today's data with context-matched calibration baselines. Applies three interpretive frames. Generates a disambiguating suppressed question. Skipped on calibration sessions.
3. **Response embedding runs** — the new entry is vectorized via Voyage AI and stored in sqlite-vec for future semantic retrieval. Failures are non-blocking — the system degrades to recency-only retrieval if the embedding service is unavailable.
4. **Question generation runs** — during the seed phase (days 1-30), this is a no-op. After day 30, it assembles a bounded context window via semantic retrieval (recent entries + resonant older entries + reflections as hypothesis layer) and generates tomorrow's question.
5. **Weekly reflection + audit runs** — every 7th response. Primary reflection on Opus, then secondary audit on Sonnet. The reflection only processes entries since the last reflection (its "compression window"), augmented with RAG-retrieved older entries for long-range pattern detection. After saving, the reflection is embedded and its coverage boundary is recorded so future prompts know which entries have been digested.

#### On Submission (Free Write)

1. **Response + session summary + context metadata saved** — tagged as calibration. The behavioral data feeds into context-matched baselines.
2. **No AI observation, no question generation, no reflection.** Pure data collection.

The user sees none of the background processing. They get their done message instantly. The background jobs run after the response is returned.

There are no cron jobs, no scheduled tasks, no server dependencies. The system is fully event-driven. If the user submits, everything runs. If they don't, nothing runs. The system's heartbeat is the user's engagement.

### What Marrow Feeds

Marrow is the data layer for [Einstein](https://github.com/anthonyguzzardo/Einstein), a longitudinal thinking partner. Einstein consumes everything Marrow collects — response text, behavioral signals with context, AI observations with three-frame analysis, suppressed questions, weekly reflections with multi-model audits, and question feedback — as persistent context. Where Marrow asks, Einstein converses. The depth of that conversation is bounded by the depth of the data Marrow has accumulated.

## What This Looks Like

### Day 3

The question: *"What decision are you quietly avoiding?"*

You open the page on your laptop at 9pm. Stare at it for 47 seconds before typing. You write: "I think I need to leave my job but I keep telling myself the timing isn't right." Then you delete "I think I need to leave my job" and replace it with "There's a career thing I haven't figured out yet." You submit.

**What you see:** A done message. "That's enough for today." Below it, a subtle "free write" link.

**What the system captured:**
- Device: desktop, 21:00, Friday
- First-keystroke latency: 47,000ms
- Commitment ratio: 0.38 (you typed 140 characters, kept 53)
- Largest deletion: 36 characters (a full sentence, retracted)
- Total session: 4 minutes

**What the AI wrote (you never see this):**

> Signal: 47-second first-keystroke latency
> - Frame A (Charitable): User was composing thoughtfully before starting. The question requires introspection. (medium)
> - Frame B (Avoidance): The question landed immediately — user knew the answer and hesitated to commit. (medium)
> - Frame C (Mundane): User was distracted, reading the question carefully, or settling in. (medium)
> - Calibration: NONE. No baseline exists for this device or time of day. Cannot distinguish between frames.
>
> Signal: 36-character deletion replacing direct statement with vague one
> - Frame A (Charitable): User decided the first phrasing was melodramatic and revised for accuracy. (medium)
> - Frame B (Avoidance): Self-censorship — user retracted something too honest. (medium)
> - Frame C (Mundane): Normal editing behavior — user reconsidered scope. (low-medium)
> - Calibration: No data. The shift from specific ("leave my job") to vague ("career thing") is notable but interpretation is underdetermined.
>
> Synthesis: Two signals suggest possible avoidance but both have equally plausible charitable explanations. Overall confidence: INSUFFICIENT DATA. The specificity gap (job → career thing) is the most interesting data point — worth tracking but not enough to build a narrative on.

**Suppressed question:**
> *"When you revise what you've written, what are you usually trying to get closer to?"*

This question doesn't presuppose avoidance. It helps the system distinguish Frame A (editing toward accuracy) from Frame B (editing away from honesty) on future sessions.

### After Day 3 — Free Write

You click "free write." The prompt: *"What did you eat yesterday? Walk through it meal by meal."*

You type for 3 minutes on the same laptop at 9:15pm. First-keystroke latency: 12 seconds. Commitment ratio: 0.89. Two deletions, both under 5 characters. No pauses over 30 seconds. You click "another one." New prompt. Similar numbers.

The AI doesn't interpret any of this. It stores the behavioral data with context: desktop, 21:00, Friday. Now it has a context-matched baseline. On this device at this time: latency is 12 seconds, commitment ratio is 0.89, and you barely delete.

Day 3's 47-second latency and 0.38 commitment ratio deviate significantly from this baseline. The system's confidence in flagging those signals just went from INSUFFICIENT DATA to MODERATE.

### Day 10 — "Did It Land?"

You submit your response. This is every 5th submission, so below the done message you see: *"did it land?"* with two buttons: *yes* and *no*.

You tap "no." One bit of signal. The system knows this question missed. When it generates questions in Phase 2, it will weight away from this line of inquiry.

### Day 11

The question: *"What have you outgrown but haven't let go of yet?"*

You type fast on your phone during lunch. No pauses. No deletions. 280 words in 6 minutes. Commitment ratio: 0.97.

**What the AI wrote:**

> Signal: Commitment ratio 0.97 on mobile at 12:00
> - Frame A (Charitable): User had a clear, processed answer. This topic is resolved for them. (high)
> - Frame B (Avoidance): User gave a rehearsed answer — fluency indicates performance, not honesty. (low)
> - Frame C (Mundane): Mobile typing tends toward fewer deletions. Ratio may reflect device, not psychology. (medium)
> - Calibration: No mobile calibration data exists. Comparing against desktop baseline (0.89) is unreliable — flagging device mismatch.
>
> Synthesis: Frame A is most likely but Frame C introduces legitimate doubt. The system needs mobile calibration sessions before it can interpret phone-based behavioral data with confidence. Overall confidence: LOW due to device mismatch.

### Day 14 — Weekly Reflection

The AI runs its weekly reflection on Opus. Then Sonnet audits it.

**Sonnet's audit (appended to the reflection):**

> The primary reflection identifies the "career thing" thread as the strongest signal but correctly notes calibration weakness. However, the self-correction section identifies only one minor error (over-interpreting Day 7's pause count) while protecting the career-avoidance narrative across four other observations. The reflection would be stronger if it considered that the Day 3 specificity gap could reflect the user learning the system's format rather than psychological avoidance. The primary model's revised model section states "moderate confidence" in the career thread — given the calibration gaps and device mismatches flagged elsewhere, "low confidence" would be more honest.

### Day 31

Seeds are done. The AI has 30 observations with three-frame analysis. 30 suppressed questions designed to disambiguate, not dramatize. A behavioral fingerprint calibrated across devices and times of day. Four self-correction cycles with multi-model audits. Question feedback data on which questions landed and which didn't.

It generates tomorrow's question. Not from a single confident narrative. From a model that knows what it's sure about, what it's guessing, where its calibration is weak, and where an independent auditor disagreed with its read.

## Stack

- **Astro** (SSR, Node adapter)
- **SQLite** via better-sqlite3 + **sqlite-vec** (vector search in the same database)
- **Claude API** (`@anthropic-ai/sdk`) — Claude Opus 4.6 for primary analysis, Claude Sonnet 4.6 for weekly audit
- **Voyage AI** (`voyageai`) — voyage-3-lite embeddings for semantic retrieval
- **TypeScript** (strict)

## Architecture

- Single user, no auth
- SQLite database at `data/marrow.db` (includes vector embeddings via sqlite-vec)
- Seed questions in `src/lib/seeds.ts`
- RAG-based memory: every entry is embedded and retrievable by semantic similarity with recency weighting
- Contrarian retrieval: deliberately surfaces entries that are most *dissimilar* to current themes, preventing semantic lock-in
- Bounded prompt assembly: recent entries (verbatim) + RAG-retrieved older entries (by resonance) + contrarian entries (by dissimilarity) + reflections (hypothesis layer)
- Reflection decay: last 4 reflections included in full, older reflections only resurface via RAG when their themes are relevant again
- Prompts explicitly separate source of truth (raw entries) from hypothesis (model's interpretations)
- On-demand calibration via free writes with context metadata
- Three interpretive frames (charitable, avoidance, mundane)
- Context-matched baselines with confidence scoring
- Multi-model audit (Opus + Sonnet) on weekly reflections
- Reflection coverage tracking — each reflection records which entries it digested
- Prompt tracing — every AI call logs which entries, reflections, and observations went into the prompt, for future auditability
- "Did it land?" feedback every 5th submission
- Graceful degradation — if Voyage AI is unavailable, falls back to recency-only retrieval
- All analysis triggered on submit — no cron, no scheduler
- **Bob** — a witness-form rendered as a 3D object from 36 behavioral signals interpreted into a 26-trait genome by Opus. See `BOB.md` for full documentation.
- **Trajectory engine** — pure math on raw per-session data (no AI). Collapses behavioral and language-shape metrics into 4 z-scored dimensions: fluency (P-burst length), deliberation (hesitation + pause rate + revision weight), revision (commitment ratio + substantive deletion rate), expression (linguistic deviation from personal norm). Computes convergence (Euclidean distance in 4D — did multiple dimensions move together?) and phase detection (stable/shifting/disrupted). Feeds into observation, generation, and reflection as cross-session context. See `BOB.md` for details.

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server at `localhost:4321` |
| `npm run build` | Build for production |
| `npm run observe` | Manually trigger AI observation |
| `npm run generate` | Manually trigger question generation |
| `npm run reflect` | Manually trigger weekly reflection |
| `npm run backfill` | Embed all existing entries for RAG retrieval |

## Future: Einstein Lab

The system currently has no way to evaluate whether it is getting better. It generates questions but never audits whether the sequence of questions is producing depth over time. A future addition — **Einstein Lab** — would address this as a sealed, isolated metacognitive layer.

### Design Principles (Not Yet Implemented)

- **Separate database.** The Lab reads from `marrow.db` but writes to its own `einstein-lab.db`. Nothing in Marrow's pipeline ever opens the Lab's database. The isolation is physical, not just logical.
- **Advisory, not executive.** The Lab can flag problems — "questions are converging on one theme" — but cannot directly influence question generation. The human is the only bridge.
- **Evidence-backed findings.** Every Lab output follows a structured format: claim, evidence, confidence, expiry, falsifier. No vibes, no narrative.

### Planned Modes

1. **Question audit** — reviews generated questions for thematic diversity, presupposition load, feedback correlation, whether suppressed questions are consistently sharper than actual questions, and whether contrarian retrieval is changing output.
2. **Discrepancy scan** — searches for contradictions across raw entries, reflections, observations, and self-critiques. Flags where the system's claims don't fit the data.
3. **System audit** — inspects architecture, retrieval patterns, and confidence language. Evaluates whether philosophy and implementation have diverged.

### Why Not Now

At 30 entries there is nothing meaningful to audit. No question-generation history, no retrieval bias to detect, no narrative drift to catch. The Lab becomes valuable at day 60-120, when real patterns exist. The prompt tracing infrastructure (`tb_prompt_traces`) is already recording what goes into every AI call, so when the Lab is built, the evidence trail is waiting.

## Philosophy

Every technical decision serves depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.
