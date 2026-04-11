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
  getAllQuestionFeedback,
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
  const feedback = getAllQuestionFeedback();

  const journalHistory = responses
    .map((r) => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
    .join('\n\n---\n\n');

  const behavioralHistory = summaries
    .map((s) => `[${s.date}] device=${s.deviceType || '?'} hour=${s.hourOfDay ?? '?'} keystroke_latency=${s.firstKeystrokeMs}ms duration=${s.totalDurationMs}ms commitment=${s.commitmentRatio?.toFixed(2)} pauses=${s.pauseCount} deletions=${s.deletionCount} largest_deletion=${s.largestDeletion} tab_aways=${s.tabAwayCount} words=${s.wordCount}`)
    .join('\n');

  const feedbackContext = feedback.length > 0
    ? `\n\nQuestion feedback ("did it land?"):\n${feedback.map((f) => `[${f.date}] ${f.landed ? 'YES' : 'NO'}`).join('\n')}\n\nUse this to calibrate question quality. "NO" means recalibrate — that line of questioning missed. "YES" is weaker signal — could mean insightful, uncomfortable, or just emotionally loaded.`
    : '';

  const observationHistory = observations
    .map((o) => `[${o.date}]\n${o.observation}`)
    .join('\n\n---\n\n');

  const suppressedHistory = suppressedQuestions
    .map((q) => `[${q.date}] ${q.question}`)
    .join('\n');

  const reflectionContext = reflection
    ? `\n\nMost recent weekly reflection (includes multi-model audit):\n${reflection.text}`
    : '';

  const feedbackSection = feedbackContext;

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
3. Your own prior observations — what you've noticed silently over time, including three-frame analysis with confidence levels
4. Your suppressed questions — the questions you've been wanting to ask
5. Question feedback — "did it land?" responses where available

Weight your sources appropriately:
- The journal text is your primary signal. What they said matters most.
- Behavioral data is secondary signal. It may indicate friction, comfort, or nothing at all. Only trust behavioral patterns that appear across multiple sessions with consistent context (same device type, similar time of day). Single-session behavioral anomalies are noise until proven otherwise.
- Your prior observations include confidence levels (HIGH / MODERATE / LOW / INSUFFICIENT DATA). Weight them accordingly. A LOW-confidence observation is a hypothesis, not a fact. Do not build questions on uncertain observations as though they were established patterns.
- Recent observations are more relevant than early ones. Your model should evolve, not calcify.
- Suppressed questions represent threads you've been tracking. Recent suppressed questions reflect your current understanding; older ones may reflect reads you've since corrected. If a weekly reflection or audit flagged an observation as wrong, discount the suppressed question that came from it.
- A "no" on "did it land?" means that line of questioning missed — but you don't know why (boring, too painful, already resolved, poorly worded). Weight away from that territory without assuming the reason.

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
${feedbackSection}
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
