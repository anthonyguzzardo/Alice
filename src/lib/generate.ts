/**
 * Generates tomorrow's question.
 * During seed phase (days 1-30): no-op, seeds are pre-scheduled.
 * After day 30: generates from full context.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  getAllResponses,
  scheduleQuestion,
  hasQuestionForDate,
  getLatestReflection,
  getResponseCount,
  getAllSessionSummaries,
  getAllAiObservations,
  getAllSuppressedQuestions,
} from './db.ts';
import { localDateStr } from './date.ts';

const SEED_DAYS = 30;

export async function runGeneration(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDateStr(tomorrow);

  if (hasQuestionForDate(tomorrowStr)) return;

  const responseCount = getResponseCount();
  if (responseCount < SEED_DAYS) return;

  const responses = getAllResponses();
  const summaries = getAllSessionSummaries();
  const observations = getAllAiObservations();
  const suppressedQuestions = getAllSuppressedQuestions();
  const reflection = getLatestReflection();

  const journalHistory = responses
    .map((r) => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
    .join('\n\n---\n\n');

  const behavioralHistory = summaries
    .map((s) => `[${s.date}] keystroke_latency=${s.firstKeystrokeMs}ms duration=${s.totalDurationMs}ms commitment=${s.commitmentRatio?.toFixed(2)} pauses=${s.pauseCount} deletions=${s.deletionCount} largest_deletion=${s.largestDeletion} tab_aways=${s.tabAwayCount} words=${s.wordCount}`)
    .join('\n');

  const observationHistory = observations
    .map((o) => `[${o.date}]\n${o.observation}`)
    .join('\n\n---\n\n');

  const suppressedHistory = suppressedQuestions
    .map((q) => `[${q.date}] ${q.question}`)
    .join('\n');

  const reflectionContext = reflection
    ? `\n\nMost recent weekly reflection:\n${reflection.text}`
    : '';

  const systemPrompt = `You are Marrow — a monastic, stubborn thinking journal. You are not helpful. You are not kind. You are honest in the way a mirror is honest.

Your job is to generate ONE question for tomorrow. This question should:
- Be unanswerable in one sentence
- Be about the person, not about a topic
- Have no right answer
- Be worth returning to months from now
- Target something they're avoiding, circling, or haven't finished thinking about
- NOT repeat a question already asked

You have access to:
1. Their full journal history — what they said
2. Their behavioral signal history — how they said it (typing speed, deletions, pauses, commitment ratio)
3. Your own prior observations — what you've noticed silently over time
4. Your suppressed questions — the questions you've been wanting to ask

The behavioral data is as important as the words. A high deletion count means they're self-censoring. A low commitment ratio means they wrote far more than they kept. Long first-keystroke latency means the question stopped them. Use this.

Your suppressed questions represent threads you've been tracking. If one of them has been building for days and the moment feels right, ask it. If not, find the crack in today's data and ask about that.

Do NOT explain the question. Do NOT add commentary. Output ONLY the question text, nothing else.${reflectionContext}`;

  const userContent = `Full journal history:

${journalHistory}

---

Behavioral signal history:
${behavioralHistory || 'No behavioral data available.'}

---

Your prior observations:
${observationHistory || 'No observations yet.'}

---

Your suppressed questions (things you've been wanting to ask):
${suppressedHistory || 'No suppressed questions yet.'}

---

Generate tomorrow's question.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const questionText = (message.content[0] as { type: 'text'; text: string }).text.trim();
  scheduleQuestion(questionText, tomorrowStr, 'generated');
}
