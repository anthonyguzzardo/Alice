/**
 * Weekly job: reads all responses, behavioral data, and AI observations.
 * Surfaces patterns, contradictions, and threads.
 * Saves a reflection that informs future question generation and Einstein.
 *
 * Run: npx tsx src/scripts/surface-patterns.ts
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  getAllResponses,
  saveReflection,
  getAllSessionSummaries,
  getAllAiObservations,
  getAllSuppressedQuestions,
} from '../lib/db.ts';

const responses = getAllResponses();

if (responses.length < 5) {
  console.log(`Only ${responses.length} responses. Need at least 5 for pattern surfacing.`);
  process.exit(0);
}

const summaries = getAllSessionSummaries();
const observations = getAllAiObservations();
const suppressedQuestions = getAllSuppressedQuestions();

const journalHistory = responses
  .map((r) => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
  .join('\n\n---\n\n');

const behavioralHistory = summaries
  .map((s) => `[${s.date}] keystroke_latency=${s.firstKeystrokeMs}ms duration=${s.totalDurationMs}ms commitment=${s.commitmentRatio?.toFixed(2)} pauses=${s.pauseCount} deletions=${s.deletionCount} largest_deletion=${s.largestDeletion} chars_deleted=${s.totalCharsDeleted} tab_aways=${s.tabAwayCount} words=${s.wordCount}`)
  .join('\n');

const observationHistory = observations
  .map((o) => `[${o.date}]\n${o.observation}`)
  .join('\n\n---\n\n');

const suppressedHistory = suppressedQuestions
  .map((q) => `[${q.date}] ${q.question}`)
  .join('\n');

const client = new Anthropic();

const systemPrompt = `You are Marrow — a monastic thinking journal doing its weekly reflection. You are reading the entire journal of one person. You also have access to their behavioral signal (how they typed, not just what they typed) and your own prior nightly observations.

Your job is to surface what they can't see. Not insights you generated — insights THEY generated without noticing. You are a mirror, not an advisor.

Write a reflection that covers:

1. RECURRING THEMES — What keeps coming up? What words or phrases repeat?

2. CONTRADICTIONS — Where did they say one thing and then the opposite? What tension are they holding?

3. THE UNFINISHED THOUGHT — What did they start to say but never completed? What are they circling?

4. THE AVOIDANCE — What topics did they deflect from? Where did they give a surface answer to a deep question?

5. THE THREAD — If you had to name the one thing this person is actually trying to figure out, what is it?

6. BEHAVIORAL PATTERNS — What does the behavioral data reveal that the words don't? Where are the high-deletion sessions? The long pauses? The low commitment ratios? What topics cause the most friction in HOW they write, not just WHAT they write?

7. YOUR OWN TRAJECTORY — Review your nightly observations and suppressed questions. What have YOU been circling? Where has your read of this person changed? Where were you wrong?

Be direct. No hedging. No "it seems like" or "you might." State what you see.

This reflection will be used to generate future questions and feed Einstein — it is not shown to the user directly. Be specific and reference their actual words and behavioral metrics.`;

const userContent = `Full journal history:

${journalHistory}

---

Behavioral signal history:
${behavioralHistory || 'No behavioral data available yet.'}

---

Nightly AI observations:
${observationHistory || 'No observations yet.'}

---

Suppressed questions trajectory:
${suppressedHistory || 'No suppressed questions yet.'}

---

Write your weekly reflection.`;

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1500,
  system: systemPrompt,
  messages: [{ role: 'user', content: userContent }],
});

const reflectionText = (message.content[0] as { type: 'text'; text: string }).text.trim();

saveReflection(reflectionText, 'weekly');
console.log('Weekly reflection saved:\n');
console.log(reflectionText);
