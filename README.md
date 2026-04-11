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

During this phase, **the questions do not adapt**. But the system is not idle. Every submission triggers the AI's silent observation layer, building an internal model of the user from day 1. The questions are fixed. The watching is not.

#### Phase 2: Generated (Day 31+)

After the seeds run out, the system generates tomorrow's question from the full accumulated context — every response, every behavioral signal, every silent observation, every suppressed question the AI has been holding. The system is now a feedback loop: your behavior shapes the question, the question shapes your behavior.

No question is generated in advance. Tomorrow's question doesn't exist until you submit today's response. There is nothing to preview, leak, or game.

### Data Collection

Marrow captures three layers of data per session, all invisible to the user.

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

#### Layer 3: The AI's Silent Layer

Every day after submission, the AI reads the response, the behavioral signal, and all of its own prior observations. It generates two things:

1. **An observation** — what it noticed today. Contradictions with prior days. Behavioral patterns the user can't see. The gap between what was said and how it was said. These are brutally honest, never shown to the user, and never hedged.

2. **A suppressed question** — the question the AI would ask tomorrow if it could. During the seed phase, it can't — the questions are fixed. So these accumulate. They represent what the AI is tracking, the thread it's pulling. By day 31, the AI has 30 days of questions it's been waiting to ask. The first generated question isn't a cold read. It's something the AI has been building toward.

The compounding effect is the point. The response text tells you what someone thinks. The behavioral signal tells you how much it cost them to say it. The AI's silent observations tell you what's forming underneath that neither layer can see alone. No single layer produces the insight. The three layers compounding together over months is what makes the system work.

### Event-Driven Architecture

Everything fires on a single event: the user hitting submit.

#### On Submission

1. **Response + session summary saved** — the response text and all derived behavioral metrics are written to the database.
2. **AI observation runs** — reads today's data in the context of all prior days. Generates tonight's observation and suppressed question. Stored silently.
3. **Question generation runs** — during the seed phase (days 1-30), this is a no-op. After day 30, it reads the full context — responses, behavioral data, observations, suppressed questions, weekly reflections — and generates tomorrow's question.
4. **Weekly reflection runs** — every 7th response, the system does a deeper pass. Surfaces recurring themes, contradictions, avoidances, behavioral trajectory shifts, and the AI's own evolving read of the user.

The user sees none of this. They get their done message instantly. The background jobs run after the response is returned.

There are no cron jobs, no scheduled tasks, no server dependencies. The system is fully event-driven. If the user submits, everything runs. If they don't, nothing runs. The system's heartbeat is the user's engagement.

### What Marrow Feeds

Marrow is the data layer for [Einstein](https://github.com/anthonyguzzardo/Einstein), a longitudinal thinking partner. Einstein consumes everything Marrow collects — response text, behavioral signals, AI observations, suppressed questions, weekly reflections — as persistent context. Where Marrow asks, Einstein converses. The depth of that conversation is bounded by the depth of the data Marrow has accumulated.

## What This Looks Like

### Day 3

The question: *"What decision are you quietly avoiding?"*

You open the page. Stare at it for 47 seconds before typing. You write: "I think I need to leave my job but I keep telling myself the timing isn't right." Then you delete "I think I need to leave my job" and replace it with "There's a career thing I haven't figured out yet." You submit.

**What you see:** A done message. "That's enough for today."

**What the system captured:**
- First-keystroke latency: 47,000ms (you sat with this one)
- Commitment ratio: 0.38 (you typed 140 characters, kept 53 — heavy editing)
- Largest deletion: 36 characters (a full sentence, retracted)
- Total session: 4 minutes

**What the AI wrote that night (you never see this):**
> *"The user's first instinct was direct — 'I need to leave my job.' They deleted it and replaced it with something vague and safe. The commitment ratio is the lowest so far. The 47-second initial pause suggests the question landed immediately — they knew the answer before they started typing. The editing wasn't about finding the answer. It was about hiding it."*

**Suppressed question (what the AI wanted to ask but couldn't):**
> *"What did you almost type today that you deleted?"*

### Day 11

The question: *"What have you outgrown but haven't let go of yet?"*

You type fast. No pauses. No deletions. 280 words in 6 minutes. Commitment ratio: 0.97. You barely edited anything.

**What the AI wrote:**
> *"This is the fastest session to date and the highest commitment ratio. No friction at all. Two interpretations: either this question tapped something they've already processed, or they gave a rehearsed answer. Cross-referencing with day 3 — the 'career thing' was vague and heavily edited. Today's response about outgrowing a friendship was fluent and polished. The user engages freely with topics that feel resolved and locks up around ones that aren't. The job is still the thread."*

**Suppressed question:**
> *"Why was today so easy for you?"*

### Day 31

Seeds are done. The AI has 30 observations. 30 suppressed questions. A full behavioral fingerprint.

It generates tomorrow's question. Not from a list. From everything it's been watching.

The question it asks isn't *"Tell me about your job."* That's too obvious. It's not *"What are you afraid of?"* That's too broad.

It's the question the AI has been refining for 28 days — the one that makes the distance between what you type and what you delete irrelevant.

You'll know it when you see it.

## Stack

- **Astro** (SSR, Node adapter)
- **SQLite** via better-sqlite3
- **Claude API** (`@anthropic-ai/sdk`) for question generation and pattern analysis
- **TypeScript** (strict)

## Architecture

- Single user, no auth
- SQLite database at `data/marrow.db`
- Seed questions in `src/lib/seeds.ts`
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
