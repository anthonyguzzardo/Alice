/**
 * The AI's silent layer. Reads today's response + session summary + RAG-retrieved
 * similar past entries + recent observations. Uses three interpretive frames
 * (charitable, avoidance, mundane) for structured disagreement. Generates a
 * suppressed question targeting the highest-uncertainty gap for disambiguation.
 * Runs after every submission from day 1.
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  getTodaysQuestion,
  getTodaysResponse,
  getSessionSummary,
  getAllSessionSummaries,
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
import { formatObserveSignals, formatTrajectoryContext, formatEnrichedCalibration } from './signals.ts';
import { computeTrajectory } from './bob/trajectory.ts';

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

  // Enriched behavioral signals (research-backed verbalization)
  const allSummaries = getAllSessionSummaries();
  const todayBehavior = sessionSummary
    ? formatObserveSignals(sessionSummary, allSummaries)
    : 'No behavioral data available for today.';

  // Trajectory context (4D behavioral fingerprint)
  const trajectory = computeTrajectory();
  const trajectoryContext = trajectory.points.length > 0
    ? formatTrajectoryContext(trajectory, 'observe')
    : '';

  const calibrationContext = formatEnrichedCalibration(calibration, sessionSummary?.deviceType);

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

BEHAVIORAL SIGNAL GUIDE:
You receive enriched behavioral data with research-backed metrics. Key concepts:

- CORRECTIONS vs. REVISIONS: Small deletions (<10 chars) are corrections — typo fixes, word swaps. Large deletions (>=10 chars) are revisions — substantive rethinking. High correction count is noise. High revision count is signal. (Faigley & Witte, 1981)

- P-BURSTS: Sustained typing between 2-second pauses. Longer bursts = more fluent production. Short bursts = fragmented thinking or careful deliberation. (Chenoweth & Hayes, 2001)

- REVISION TIMING: Where in the session large deletions occurred. Early = false starts (couldn't begin). Late = gutting after drafting (wrote something real, then killed it). This distinction matters for frame analysis.

- TRAJECTORY: A 4-dimensional behavioral fingerprint (fluency, deliberation, revision, expression) tracked across all sessions. High convergence means multiple dimensions moved together — a real behavioral shift, not noise. Phase tells you whether the person's writing behavior is stable, shifting, or disrupted.

- PERCENTILES: All metrics are compared against this person's own history. A value at the 85th percentile means this session was higher than 85% of their previous sessions on that metric.

Primary signals appear first in the behavioral data. Attend to them most carefully. Trajectory context appears last — it provides the cross-session pattern that makes today's signals meaningful.

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

TODAY'S BEHAVIORAL SIGNAL:
${todayBehavior}
${trajectoryContext}

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

  // Split on SUPPRESSED QUESTION: header — handle various formatting
  const parts = output.split(/SUPPRESSED\s*QUESTION\s*:/i);
  const rawObservation = parts[0] || '';
  const rawSuppressed = parts[1] || '';

  // Strip the OBSERVATION: prefix
  const observationText = rawObservation.replace(/^OBSERVATION:\s*/i, '').trim();
  const suppressedText = rawSuppressed.trim();

  if (!observationText) {
    console.error('[observe] Failed to parse observation. First 500 chars:', output.slice(0, 500));
  }

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
