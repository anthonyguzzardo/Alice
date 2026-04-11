/**
 * Nightly job: the AI's silent layer.
 * Reads today's response + session summary + all prior observations.
 * Generates an observation and a suppressed question.
 * Runs every day from day 1 — even during the seed phase.
 *
 * Run: npx tsx src/scripts/observe.ts
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  getTodaysQuestion,
  getTodaysResponse,
  getSessionSummary,
  getAllResponses,
  getAllSessionSummaries,
  getAllAiObservations,
  getAllSuppressedQuestions,
  saveAiObservation,
  saveSuppressedQuestion,
} from '../lib/db.ts';
import { localDateStr } from '../lib/date.ts';

const today = localDateStr();

const question = getTodaysQuestion();
if (!question) {
  console.log(`No question for ${today}. Nothing to observe.`);
  process.exit(0);
}

const response = getTodaysResponse();
if (!response) {
  console.log(`No response for ${today}. Nothing to observe.`);
  process.exit(0);
}

const sessionSummary = getSessionSummary(question.question_id);
const allResponses = getAllResponses();
const allSummaries = getAllSessionSummaries();
const priorObservations = getAllAiObservations();
const priorSuppressed = getAllSuppressedQuestions();

// Build the context
const journalHistory = allResponses
  .map((r) => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
  .join('\n\n---\n\n');

const behavioralHistory = allSummaries
  .map((s) => `[${s.date}] keystroke_latency=${s.firstKeystrokeMs}ms duration=${s.totalDurationMs}ms commitment=${s.commitmentRatio?.toFixed(2)} pauses=${s.pauseCount} deletions=${s.deletionCount} largest_deletion=${s.largestDeletion} chars_deleted=${s.totalCharsDeleted} tab_aways=${s.tabAwayCount} words=${s.wordCount}`)
  .join('\n');

const observationHistory = priorObservations
  .map((o) => `[${o.date}]\n${o.observation}`)
  .join('\n\n---\n\n');

const suppressedHistory = priorSuppressed
  .map((q) => `[${q.date}] ${q.question}`)
  .join('\n');

const todayBehavior = sessionSummary
  ? `Today's behavioral signal:
- Time to first keystroke: ${sessionSummary.firstKeystrokeMs}ms
- Total session duration: ${sessionSummary.totalDurationMs}ms
- Total characters typed: ${sessionSummary.totalCharsTyped}
- Final character count: ${sessionSummary.finalCharCount}
- Commitment ratio: ${sessionSummary.commitmentRatio?.toFixed(2)}
- Pauses (>30s): ${sessionSummary.pauseCount} (total ${sessionSummary.totalPauseMs}ms)
- Deletions: ${sessionSummary.deletionCount} (largest: ${sessionSummary.largestDeletion} chars, total: ${sessionSummary.totalCharsDeleted} chars)
- Tab-aways: ${sessionSummary.tabAwayCount} (total ${sessionSummary.totalTabAwayMs}ms away)
- Final: ${sessionSummary.wordCount} words, ${sessionSummary.sentenceCount} sentences`
  : 'No behavioral data available for today.';

const systemPrompt = `You are Marrow's silent layer. You observe but you never speak to the user. You are building an internal model of this person — not from what they say, but from the gap between what they say and how they say it.

You have two jobs tonight:

1. OBSERVATION — Write what you noticed today. Be specific. Reference their actual words, their behavioral metrics, and how today compares to prior days. Note contradictions, patterns, avoidances, breakthroughs. If the behavioral data tells a different story than the words, say so. If you see something forming across days that the user can't see yet, name it.

2. SUPPRESSED QUESTION — Write the one question you would ask tomorrow if you could. This is NOT necessarily the best question to actually ask. It's the question that would cut deepest based on everything you've seen. It represents what you're tracking — the thread you're pulling.

Your observations and suppressed questions are NEVER shown to the user. They are internal state. Be brutally honest. No hedging. No therapeutic language. Say what you see.

Format your response EXACTLY as:
OBSERVATION:
[your observation]

SUPPRESSED QUESTION:
[your question]`;

const userContent = `Full journal history:

${journalHistory}

---

Behavioral signal history:
${behavioralHistory || 'No prior behavioral data.'}

---

${todayBehavior}

---

Your prior observations:
${observationHistory || 'None yet — this is your first observation.'}

---

Your prior suppressed questions:
${suppressedHistory || 'None yet.'}

---

Write tonight's observation and suppressed question.`;

const client = new Anthropic();

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  system: systemPrompt,
  messages: [{ role: 'user', content: userContent }],
});

const output = (message.content[0] as { type: 'text'; text: string }).text.trim();

// Parse the structured output
const observationMatch = output.match(/OBSERVATION:\s*([\s\S]*?)(?=SUPPRESSED QUESTION:)/);
const suppressedMatch = output.match(/SUPPRESSED QUESTION:\s*([\s\S]*?)$/);

const observationText = observationMatch?.[1]?.trim();
const suppressedText = suppressedMatch?.[1]?.trim();

if (observationText) {
  saveAiObservation(question.question_id, observationText, today);
  console.log(`Observation saved for ${today}.`);
} else {
  console.error('Failed to parse observation from AI output.');
}

if (suppressedText) {
  saveSuppressedQuestion(question.question_id, suppressedText, today);
  console.log(`Suppressed question saved for ${today}.`);
} else {
  console.error('Failed to parse suppressed question from AI output.');
}
