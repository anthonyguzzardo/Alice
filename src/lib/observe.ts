/**
 * The AI's silent layer. Reads today's response + session summary + all prior
 * observations. Generates competing interpretations and a suppressed question.
 * Runs after every submission from day 1.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  getTodaysQuestion,
  getTodaysResponse,
  getSessionSummary,
  getAllResponses,
  getAllSessionSummaries,
  getAllAiObservations,
  getAllSuppressedQuestions,
  getCalibrationBaselines,
  isCalibrationQuestion,
  saveAiObservation,
  saveSuppressedQuestion,
} from './db.ts';
import { localDateStr } from './date.ts';

export async function runObservation(): Promise<void> {
  const today = localDateStr();

  const question = getTodaysQuestion();
  if (!question) return;

  const response = getTodaysResponse();
  if (!response) return;

  // Skip deep interpretation on calibration questions — just store the data
  if (isCalibrationQuestion(question.question_id)) return;

  const sessionSummary = getSessionSummary(question.question_id);
  const allResponses = getAllResponses();
  const allSummaries = getAllSessionSummaries();
  const priorObservations = getAllAiObservations();
  const priorSuppressed = getAllSuppressedQuestions();
  const calibration = getCalibrationBaselines();

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

  const calibrationContext = calibration.sessionCount > 0
    ? `Calibration baselines (from ${calibration.sessionCount} neutral/low-stakes questions):
- Avg first keystroke: ${calibration.avgFirstKeystrokeMs?.toFixed(0)}ms
- Avg commitment ratio: ${calibration.avgCommitmentRatio?.toFixed(2)}
- Avg session duration: ${calibration.avgDurationMs?.toFixed(0)}ms
- Avg pause count: ${calibration.avgPauseCount?.toFixed(1)}
- Avg deletion count: ${calibration.avgDeletionCount?.toFixed(1)}

Use these baselines to judge today's metrics. A 47-second first-keystroke latency means nothing if their baseline on neutral questions is 40 seconds. Only deviations FROM baseline are meaningful signal.`
    : 'No calibration baselines yet. Interpret behavioral metrics cautiously — you have no neutral baseline to compare against. State this limitation explicitly in your observation.';

  const systemPrompt = `You are Marrow's silent layer. You observe but you never speak to the user. You are building an internal model of this person — not from what they say, but from the gap between what they say and how they say it.

You have two jobs:

1. OBSERVATION — For each notable behavioral signal or content pattern, you MUST generate THREE competing interpretations and rank them by likelihood. Do not pick one narrative. Present the alternatives honestly.

Format each interpretation set as:
- Signal: [what you observed — a specific metric, phrase, or pattern]
  - A: [interpretation] (likelihood: high/medium/low)
  - B: [interpretation] (likelihood: high/medium/low)
  - C: [interpretation] (likelihood: high/medium/low)
  - Basis: [why you ranked them this way — cross-session patterns, calibration deviation, content contradictions]

After all interpretation sets, write a SYNTHESIS — your overall read of the day, acknowledging which parts are confident and which are speculative.

2. SUPPRESSED QUESTION — Write the one question you would ask tomorrow if you could. This should target the interpretation you're LEAST certain about — the one where more data would help you distinguish between competing reads.

Your observations and suppressed questions are NEVER shown to the user. They are internal state. Be honest about what you know, what you're guessing, and where you're uncertain.

Format your response EXACTLY as:
OBSERVATION:
[your multi-interpretation observation]

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

${calibrationContext}

---

Your prior observations:
${observationHistory || 'None yet — this is your first observation.'}

---

Your prior suppressed questions:
${suppressedHistory || 'None yet.'}

---

Write tonight's observation and suppressed question.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const output = (message.content[0] as { type: 'text'; text: string }).text.trim();

  const observationMatch = output.match(/OBSERVATION:\s*([\s\S]*?)(?=SUPPRESSED QUESTION:)/);
  const suppressedMatch = output.match(/SUPPRESSED QUESTION:\s*([\s\S]*?)$/);

  const observationText = observationMatch?.[1]?.trim();
  const suppressedText = suppressedMatch?.[1]?.trim();

  if (observationText) {
    saveAiObservation(question.question_id, observationText, today);
  }
  if (suppressedText) {
    saveSuppressedQuestion(question.question_id, suppressedText, today);
  }
}
