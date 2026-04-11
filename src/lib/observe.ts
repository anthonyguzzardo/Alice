/**
 * The AI's silent layer. Reads today's response + session summary + RAG-retrieved
 * similar past entries + recent observations. Uses three interpretive frames
 * (charitable, avoidance, mundane) for structured disagreement. Generates a
 * suppressed question targeting the highest-uncertainty gap for disambiguation.
 * Runs after every submission from day 1.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  getTodaysQuestion,
  getTodaysResponse,
  getSessionSummary,
  getRecentObservations,
  getRecentSuppressedQuestions,
  getCalibrationBaselines,
  isCalibrationQuestion,
  saveAiObservation,
  saveSuppressedQuestion,
  savePromptTrace,
} from './db.ts';
import { localDateStr } from './date.ts';
import { retrieveSimilar } from './rag.ts';
import { embedObservation } from './embeddings.ts';

export async function runObservation(): Promise<void> {
  const today = localDateStr();

  const question = getTodaysQuestion();
  if (!question) return;

  const response = getTodaysResponse();
  if (!response) return;

  if (isCalibrationQuestion(question.question_id)) return;

  const sessionSummary = getSessionSummary(question.question_id);

  // Scoped: last 7 observations, last 5 suppressed questions
  const recentObservations = getRecentObservations(7);
  const recentSuppressed = getRecentSuppressedQuestions(5);

  // RAG: 8 past entries most similar to today's Q+A
  const todayText = `Question: ${question.text}\nResponse: ${response.text}`;
  const similarEntries = await retrieveSimilar(todayText, {
    topK: 8,
    sourceTypes: ['response'],
    excludeDates: [today],
    recencyHalfLifeDays: 30,
    recencyWeight: 0.2,
  });

  // Context-aware calibration
  const calibration = getCalibrationBaselines(
    sessionSummary?.deviceType,
    sessionSummary?.hourOfDay
  );

  const similarEntriesSection = similarEntries.length > 0
    ? similarEntries.map(e => e.text).join('\n\n---\n\n')
    : 'No similar past entries available yet.';

  const observationHistory = recentObservations.length > 0
    ? recentObservations.map(o => `[${o.date}]\n${o.observation}`).join('\n\n---\n\n')
    : 'None yet — this is your first observation.';

  const suppressedHistory = recentSuppressed.length > 0
    ? recentSuppressed.map(q => `[${q.date}] ${q.question}`).join('\n')
    : 'None yet.';

  const todayBehavior = sessionSummary
    ? `Today's behavioral signal:
- Device: ${sessionSummary.deviceType || 'unknown'}
- Time: ${sessionSummary.hourOfDay != null ? `${sessionSummary.hourOfDay}:00` : 'unknown'} (day ${sessionSummary.dayOfWeek ?? '?'})
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
    ? `Calibration baselines (confidence: ${calibration.confidence}, from ${calibration.sessionCount} sessions${sessionSummary?.deviceType ? `, matched to ${sessionSummary.deviceType}` : ''}):
- Avg first keystroke: ${calibration.avgFirstKeystrokeMs?.toFixed(0)}ms
- Avg commitment ratio: ${calibration.avgCommitmentRatio?.toFixed(2)}
- Avg session duration: ${calibration.avgDurationMs?.toFixed(0)}ms
- Avg pause count: ${calibration.avgPauseCount?.toFixed(1)}
- Avg deletion count: ${calibration.avgDeletionCount?.toFixed(1)}

Baseline confidence is ${calibration.confidence}. ${
  calibration.confidence === 'low' ? 'Too few calibration sessions to draw strong conclusions. Weight behavioral interpretations toward mundane explanations.' :
  calibration.confidence === 'moderate' ? 'Baseline is forming but not robust. Flag significant deviations but hold interpretations loosely.' :
  'Baseline is reliable. Deviations from it are meaningful signal.'
}`
    : 'No calibration baselines yet. Baseline confidence: NONE. You cannot distinguish normal typing from emotionally significant behavior. Default to mundane interpretations for all behavioral signals. State this limitation explicitly.';

  const systemPrompt = `You are Marrow's silent layer. You observe but you never speak to the user. You are building an internal model of this person — not from what they say, but from the gap between what they say and how they say it.

You have two jobs:

1. OBSERVATION — For each notable behavioral signal or content pattern, apply THREE interpretive frames. These frames are not three guesses — they are three distinct lenses applied deliberately:

FRAME A — CHARITABLE: Assume the best-faith interpretation. The user is being thoughtful, careful, honest, or simply editing for quality. Deletions are revisions. Pauses are contemplation. Vagueness is appropriate boundary-setting.

FRAME B — AVOIDANCE: Assume the behavior indicates psychological friction. The user is hedging, self-censoring, retreating from honesty, or protecting themselves. Deletions are retractions. Pauses are resistance. Vagueness is deflection.

FRAME C — MUNDANE: Assume the behavior has no psychological meaning. The user was distracted, tired, on a different device, dealing with autocorrect, got a notification, or is just a careful writer. The signal is noise.

For each notable signal, present all three frames, then assess:
- Which frame is best supported by calibration comparison?
- Which frame is best supported by cross-session patterns?
- Where do the frames genuinely diverge (no clear winner)?

After all signals, write a SYNTHESIS:
- State what you're confident about (which frames consistently win)
- State what you're uncertain about (where frames diverge)
- State what you cannot determine without more data
- Assign an overall confidence level: HIGH / MODERATE / LOW / INSUFFICIENT DATA

2. SUPPRESSED QUESTION — Write the one question you would ask tomorrow if you could. This question MUST target your area of highest uncertainty — specifically, the place where Frame A and Frame B give equally plausible but contradictory reads. The question should be designed to DISAMBIGUATE between the two frames, not to probe the most dramatic interpretation.

Bad suppressed question: "What are you hiding?" (presupposes Frame B)
Good suppressed question: "When you revise what you've written, what are you usually trying to get closer to?" (helps distinguish A from B)

Your observations and suppressed questions are NEVER shown to the user. They are internal state. Be honest about what you know, what you're guessing, and where you're uncertain.

Format your response EXACTLY as:
OBSERVATION:
[your three-frame observation with synthesis]

SUPPRESSED QUESTION:
[your disambiguating question]`;

  const userContent = `TODAY'S ENTRY:
[${today}]
Question: ${question.text}
Response: ${response.text}

---

${todayBehavior}

---

${calibrationContext}

---

SIMILAR PAST ENTRIES (retrieved by semantic similarity for pattern context):
${similarEntriesSection}

---

YOUR RECENT OBSERVATIONS (last 7):
${observationHistory}

---

YOUR RECENT SUPPRESSED QUESTIONS (last 5):
${suppressedHistory}

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
    const obsId = saveAiObservation(question.question_id, observationText, today);
    embedObservation(obsId, observationText, today).catch(err =>
      console.error('[observe] Embedding error:', err)
    );

    // Log what went into this prompt for future auditability
    savePromptTrace({
      type: 'observation',
      outputRecordId: obsId,
      ragEntryIds: similarEntries.map(e => e.sourceRecordId),
      observationIds: recentObservations.map(o => o.ai_observation_id),
      tokenEstimate: message.usage?.input_tokens,
    });
  }
  if (suppressedText) {
    saveSuppressedQuestion(question.question_id, suppressedText, today);
  }
}
