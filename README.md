# Marrow

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## What It Does

Marrow asks you one question every day. You answer it. That's it.

There is no feed, no streak counter, no summary of your progress. Your responses go into a black box. You never see them again. The system sees them. You don't.

## How It Works

### The Two Phases

Marrow operates in two distinct phases. The transition is invisible to the user.

#### Phase 1: Seed (Days 1-30)

Thirty questions delivered one per day in a fixed sequence. Twenty-six are deep, designed to create friction:

1. Unanswerable in one sentence
2. About you, not a topic
3. No right answer
4. Worth returning to in three months

Four are **calibration questions** — intentionally low-stakes prompts ("Describe what you did this morning in as much detail as you can remember") mixed into the sequence at days 6, 13, 20, and 27. These look like normal questions. They establish a behavioral baseline: what your typing speed, deletion patterns, and pause behavior look like when you're not emotionally engaged. Without this baseline, the system can't tell the difference between "this question hit a nerve" and "this is just how you type."

During this phase, **the questions do not adapt**. But the system is not idle. Every submission triggers the AI's silent observation layer, building an internal model of the user from day 1. The questions are fixed. The watching is not.

#### Phase 2: Generated (Day 31+)

After the seeds run out, the system generates tomorrow's question from the full accumulated context — every response, every behavioral signal, every silent observation, every suppressed question the AI has been holding, and the calibration baselines that tell it what's noise and what's real.

No question is generated in advance. Tomorrow's question doesn't exist until you submit today's response. There is nothing to preview, leak, or game.

### Data Collection

Marrow captures three layers of data per session, all invisible to the user.

#### Layer 1: Response Text

What you submitted. Stored as-is. Never surfaced back to you.

#### Layer 2: Behavioral Signal

The system silently captures raw input events throughout the session — keystrokes, deletions, pauses, tab-aways, resumptions. On submission, these raw events are crunched into a session summary: a single row of derived behavioral metrics.

The variables that contribute to signal:

- **First-keystroke latency** — how long you sat with the question before starting. Only meaningful relative to your calibration baseline. If your neutral latency is 40 seconds, a 47-second pause on a deep question is not signal.
- **Velocity curve** — not average typing speed, but how speed changes within a session. Starting fast and slowing down is gaining resistance. Starting slow and accelerating means you found your thread.
- **Commitment ratio** — total characters typed vs. final character count. Heavy editing could mean avoidance, or it could mean careful writing. The system doesn't assume — it generates competing interpretations and compares against your calibration baseline to determine which is more likely.
- **Deletion behavior** — single-character backspaces are typo corrections (noise). Deleting 20+ characters could be a retraction, or it could be restructuring a sentence. The length, frequency, and timing of deletions are tracked, but interpretation requires cross-session context and calibration comparison.
- **Pause topology** — where in the response you stall matters, but only relative to where you normally stall. Early pauses on a deep question mean something different than early pauses on a calibration question.
- **Session rhythm** — the temporal shape of the session. Burst-pause-burst is a different thinking mode than slow-and-steady. A long pause followed by a fast burst usually means something clicked. Multiple short pauses means self-negotiation.
- **Tab-away behavior** — leaving the page and returning. Duration of absence. Whether typing speed changes after return.
- **Punctuation and structure** — ellipses, dashes, question marks, sentence length, paragraph breaks. These are tracked but interpreted cautiously — punctuation habits are shaped by device, platform, and personal style as much as by psychological state.

Any single session's behavioral data is noisy. The system knows this. That's why calibration baselines exist — to separate "this is how they type" from "something is different today."

#### Layer 3: The AI's Silent Layer

Every day after submission, the AI reads the response, the behavioral signal, calibration baselines, and all of its own prior observations. It generates three things:

1. **Competing interpretations** — for each notable signal, the AI must generate three possible explanations and rank them by likelihood. Not one confident story. Three hypotheses with reasoning. "A: They deleted that sentence because it was too revealing (medium likelihood). B: They deleted it because it was poorly written (high likelihood). C: They were distracted (low likelihood). Basis: commitment ratio matches calibration baseline, suggesting normal editing behavior." This is the difference between analysis and storytelling.

2. **A synthesis** — the AI's overall read of the day, explicitly stating what it's confident about and what it's guessing.

3. **A suppressed question** — the question the AI would ask tomorrow if it could. During the seed phase, it can't — the questions are fixed. These accumulate. By day 31, the AI has 30 suppressed questions it's been refining. But unlike a system without self-correction, these questions have been stress-tested against competing interpretations at every step.

### Error Correction

The system is designed to catch its own mistakes.

**The problem it solves:** any system that interprets behavior and then uses those interpretations to generate future prompts can drift. An early wrong guess shapes later questions, which shape later responses, which appear to confirm the original guess. The system manufactures its own evidence. Three mechanisms prevent this:

**1. Calibration baselines.** The system knows what your "normal" looks like on low-stakes questions. It only flags behavioral metrics that deviate significantly from your personal baseline. A 47-second pause is not "meaningful" if your baseline is 40 seconds.

**2. Competing interpretations.** The AI cannot write a single confident narrative. It must present alternatives and rank them. This forces intellectual honesty at every observation and prevents the most dramatic interpretation from winning by default.

**3. Weekly self-correction.** Every 7th response, the AI runs a reflection that includes a mandatory self-correction section. It must:
- Identify which prior observations were likely wrong
- Flag where it picked the most dramatic interpretation over a more mundane one
- Name suppressed questions that were based on flawed reads and should be dropped
- Identify narratives it has been building that might be stories rather than evidence
- State what it's confident about vs. uncertain about vs. needs more data on

If it cannot identify at least one error, it's not being honest. Every model drifts. The system is designed to name the drift.

### Event-Driven Architecture

Everything fires on a single event: the user hitting submit.

#### On Submission

1. **Response + session summary saved** — the response text and all derived behavioral metrics are written to the database.
2. **AI observation runs** — reads today's data in the context of all prior days and calibration baselines. Generates competing interpretations and a suppressed question. Skipped on calibration days (just stores the behavioral data).
3. **Question generation runs** — during the seed phase (days 1-30), this is a no-op. After day 30, it reads the full context — responses, behavioral data, observations, suppressed questions, weekly reflections — and generates tomorrow's question.
4. **Weekly reflection runs** — every 7th response, the system does a deeper pass with mandatory self-correction.

The user sees none of this. They get their done message instantly. The background jobs run after the response is returned.

There are no cron jobs, no scheduled tasks, no server dependencies. The system is fully event-driven. If the user submits, everything runs. If they don't, nothing runs. The system's heartbeat is the user's engagement.

### What Marrow Feeds

Marrow is the data layer for [Einstein](https://github.com/anthonyguzzardo/Einstein), a longitudinal thinking partner. Einstein consumes everything Marrow collects — response text, behavioral signals, AI observations with competing interpretations, suppressed questions, weekly reflections with self-corrections — as persistent context. Where Marrow asks, Einstein converses. The depth of that conversation is bounded by the depth of the data Marrow has accumulated.

## What This Looks Like

### Day 3

The question: *"What decision are you quietly avoiding?"*

You open the page. Stare at it for 47 seconds before typing. You write: "I think I need to leave my job but I keep telling myself the timing isn't right." Then you delete "I think I need to leave my job" and replace it with "There's a career thing I haven't figured out yet." You submit.

**What you see:** A done message. "That's enough for today."

**What the system captured:**
- First-keystroke latency: 47,000ms
- Commitment ratio: 0.38 (you typed 140 characters, kept 53)
- Largest deletion: 36 characters (a full sentence, retracted)
- Total session: 4 minutes

**What the AI wrote that night (you never see this):**

> Signal: 47-second first-keystroke latency
> - A: The question landed immediately — user knew the answer before typing (medium)
> - B: User was distracted or reading the question carefully (medium)
> - C: User was composing mentally before starting (low)
> - Basis: No calibration baseline yet to compare against. Cannot distinguish A from B with confidence.
>
> Signal: 36-character deletion replacing direct statement with vague one
> - A: Self-censorship — user retracted something too honest (medium)
> - B: User decided the first phrasing was melodramatic and revised for accuracy (medium)
> - C: User reconsidered scope and chose to keep the answer abstract (low)
> - Basis: Without calibration data, deletion could be normal editing behavior. The shift from specific ("leave my job") to vague ("career thing") is notable but not conclusive.
>
> Synthesis: Two signals suggest possible avoidance but both have plausible mundane explanations. Confidence is low without calibration baselines. The specificity gap (job → career thing) is the most interesting data point — worth tracking but not enough to build a narrative on.

**Suppressed question:**
> *"When you edit what you write, are you getting closer to the truth or further from it?"*

### Day 6 (Calibration)

The question: *"Describe what you did this morning in as much detail as you can remember."*

You type for 3 minutes. First-keystroke latency: 12 seconds. Commitment ratio: 0.89. Two deletions, both under 5 characters. No pauses over 30 seconds.

The AI doesn't interpret this day. It just stores the numbers. Now it knows: on a question that doesn't challenge you, your baseline latency is 12 seconds, your commitment ratio is 0.89, and you barely delete anything.

Day 3's 47-second latency and 0.38 commitment ratio look very different now.

### Day 11

The question: *"What have you outgrown but haven't let go of yet?"*

You type fast. No pauses. No deletions. 280 words in 6 minutes. Commitment ratio: 0.97.

**What the AI wrote:**

> Signal: Commitment ratio 0.97 vs calibration baseline 0.89
> - A: User had a prepared answer — this topic is already processed (high)
> - B: User is fluent on this topic because they've rehearsed it mentally many times (medium)
> - C: The question didn't challenge them enough to trigger friction (low)
> - Basis: Ratio is only slightly above calibration, suggesting this is close to their natural writing style. Day 3 (0.38) was the anomaly, not today.
>
> Synthesis: The contrast with Day 3 is the real data point. Day 3 had extreme deviation from baseline — this day doesn't. Whatever is happening with the "career thing" on Day 3 is producing friction that other deep questions aren't. That's worth tracking, but interpreting Day 3's deletion as "hiding" rather than "editing" is still a 50/50 call.

### Day 31

Seeds are done. The AI has 26 observations with competing interpretations. 30 suppressed questions. A behavioral fingerprint calibrated against neutral baselines. Four self-correction cycles where it identified its own errors and dropped bad threads.

It generates tomorrow's question. Not from a single confident narrative about who you are. From a model that knows what it's sure about, what it's guessing, and where it needs more data.

The question it asks targets the gap where the competing interpretations haven't converged — the thing about you that the system still can't tell if it's understanding correctly.

## Stack

- **Astro** (SSR, Node adapter)
- **SQLite** via better-sqlite3
- **Claude API** (`@anthropic-ai/sdk`) for question generation and pattern analysis
- **TypeScript** (strict)

## Architecture

- Single user, no auth
- SQLite database at `data/marrow.db`
- Seed questions (with calibration) in `src/lib/seeds.ts`
- All analysis triggered on submit — no cron, no scheduler
- Manual script fallbacks available for debugging

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server at `localhost:4321` |
| `npm run build` | Build for production |
| `npm run observe` | Manually trigger AI observation |
| `npm run generate` | Manually trigger question generation |
| `npm run reflect` | Manually trigger weekly reflection |

## Philosophy

Every technical decision serves depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.
