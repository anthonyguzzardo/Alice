# Marrow

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## What It Does

Marrow asks you one question every day. You answer it. That's it.

There is no feed, no streak counter, no summary of your progress. Your responses go into a black box. You never see them again. The system sees them. You don't.

## How It Works

### The Two Phases

Marrow operates in two distinct phases. The transition is invisible to the user.

#### Phase 1: Seed (Days 1-30)

Thirty handcrafted questions, delivered one per day in a fixed sequence. These questions follow four principles:

1. Unanswerable in one sentence — forces friction
2. About you, not a topic — not a seminar prompt
3. No right answer — you're thinking, not performing
4. Worth returning to — your answer today differs from your answer in three months

During this phase, **nothing adapts**. The questions do not respond to your answers. The system is building a behavioral baseline.

#### Phase 2: Generated (Day 31+)

A nightly job reads your full history — every response, every behavioral signal, every weekly reflection — and generates tomorrow's question using the Claude API. The system is now a feedback loop: your behavior shapes the question, the question shapes your behavior.

No question is generated in advance. Tomorrow's question doesn't exist until the night before. There is nothing to preview, leak, or game.

### Data Collection

Marrow captures two layers of data per session, both invisible to the user.

#### Layer 1: Response Text

What you submitted. Stored as-is. Never surfaced back to you.

#### Layer 2: Behavioral Signal

The system silently captures raw input events throughout the session — keystrokes, deletions, pauses, tab-aways, resumptions. On submission, these raw events are crunched into a session summary: a single row of derived behavioral metrics.

The variables that contribute to signal:

- **First-keystroke latency** — how long you sat with the question before starting. Tracked over months, this measures your willingness to engage.
- **Velocity curve** — not average typing speed, but how speed changes within a session. Starting fast and slowing down is gaining resistance. Starting slow and accelerating means you found your thread.
- **Commitment ratio** — total characters typed vs. final character count. Someone who typed 800 characters and submitted 200 edited heavily. Someone who typed 210 and submitted 200 wrote with conviction.
- **Deletion behavior** — single-character backspaces are typo corrections (noise). Deleting 20+ characters is a retraction. Deleting everything is a full rejection of your own thinking. The length, frequency, and timing of deletions within the session all carry signal.
- **Pause topology** — where in the response you stall matters. Early pauses suggest the question is hard. Late pauses suggest the answer is hard. Mid-sentence vs. between-sentence pauses are different kinds of friction.
- **Session rhythm** — the temporal shape of the session. Burst-pause-burst is a different thinking mode than slow-and-steady. A long pause followed by a fast burst usually means something clicked. Multiple short pauses means self-negotiation.
- **Tab-away behavior** — leaving the page and returning. Duration of absence. Whether typing speed changes after return. This captures offline thinking.
- **Punctuation as signal** — ellipses indicate hedging. Dashes are self-interruption. Question marks in a journal response indicate unresolved uncertainty. Period frequency maps to declarative confidence.
- **Structural patterns** — sentence length variation, paragraph breaks, overall composition shape. Short sentences after long ones typically mark arrival at a conclusion. A single unbroken paragraph is stream-of-consciousness. These patterns shifting over months reveal how your relationship to reflection evolves.

Any single session's behavioral data is noisy. Ninety sessions of velocity curves, commitment ratios, and friction patterns form a behavioral fingerprint of how you think. Changes in that fingerprint are the actual signal.

### Analysis Cadence

#### On Submission

Raw input events are computed into a session summary. No AI involved — just math. One row of derived metrics per day.

#### Nightly (`npm run generate`)

Active only in Phase 2 (day 31+). Reads all past response text, all session summaries, and all weekly reflections. Feeds everything to the Claude API. Outputs one question for tomorrow.

During Phase 1, this job checks if tomorrow's seed question exists and exits. The data accumulates but doesn't influence the sequence.

#### Weekly (`npm run reflect`)

Reads all responses and all session summaries accumulated to date. Uses the Claude API to surface longitudinal patterns — behavioral trajectories that span weeks. These reflections are stored and become input to the nightly question generation and to Einstein.

### What Marrow Feeds

Marrow is the data layer for [Einstein](https://github.com/anthonyguzzardo/Einstein), a longitudinal thinking partner. Einstein consumes everything Marrow collects — response text, behavioral signals, weekly reflections — as persistent context. Where Marrow asks, Einstein converses. The depth of that conversation is bounded by the depth of the data Marrow has accumulated.

## Stack

- **Astro** (SSR, Node adapter)
- **SQLite** via better-sqlite3
- **Claude API** (`@anthropic-ai/sdk`) for question generation and pattern analysis
- **TypeScript** (strict)

## Architecture

- Single user, no auth
- SQLite database at `data/marrow.db`
- Seed questions in `src/lib/seeds.ts`
- Nightly generation: `npm run generate`
- Weekly reflection: `npm run reflect`

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server at `localhost:4321` |
| `npm run build` | Build for production |
| `npm run generate` | Generate tomorrow's question from past data |
| `npm run observe` | Run the AI's nightly silent observation |
| `npm run reflect` | Surface patterns across all responses |

## Philosophy

Every technical decision serves depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.
