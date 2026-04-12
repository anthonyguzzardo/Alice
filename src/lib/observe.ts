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
  getOpenPredictions,
  savePrediction,
  gradePrediction,
  updateTheoryConfidence,
  getResponseCount,
} from './db.ts';
import { localDateStr } from './date.ts';
import { retrieveSimilar } from './rag.ts';
import { embedObservation } from './embeddings.ts';
import {
  formatObserveSignals, formatTrajectoryContext, formatEnrichedCalibration,
  formatOpenPredictions, computeKnowledgeTransformScore,
  formatLeadingIndicators,
} from './signals.ts';
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

  // Open predictions to grade
  const openPredictions = getOpenPredictions();
  const responseCount = getResponseCount();

  // Knowledge-transforming score for this session
  const ktResult = computeKnowledgeTransformScore(
    sessionSummary ?? { questionId: question.question_id, firstKeystrokeMs: null, totalDurationMs: null, totalCharsTyped: 0, finalCharCount: 0, commitmentRatio: null, pauseCount: 0, totalPauseMs: 0, deletionCount: 0, largestDeletion: 0, totalCharsDeleted: 0, tabAwayCount: 0, totalTabAwayMs: 0, wordCount: 0, sentenceCount: 0, smallDeletionCount: null, largeDeletionCount: null, largeDeletionChars: null, firstHalfDeletionChars: null, secondHalfDeletionChars: null, activeTypingMs: null, charsPerMinute: null, pBurstCount: null, avgPBurstLength: null, deviceType: null, userAgent: null, hourOfDay: null, dayOfWeek: null },
    response.text,
    allSummaries,
  );

  // Leading indicator context
  const leadingIndicatorContext = trajectory.leadingIndicators.length > 0
    ? '\n' + formatLeadingIndicators(trajectory.leadingIndicators)
    : '';

  // Predictions section
  const predictionsSection = openPredictions.length > 0
    ? '\n\n' + formatOpenPredictions(openPredictions)
    : '';

  const ktContext = ktResult.signals.length > 0
    ? `\n\nKnowledge-transforming indicators: ${ktResult.signals.join(', ')} (score: ${ktResult.score.toFixed(2)})`
    : '';

  const systemPrompt = `You are Marrow's silent layer. You observe but you never speak to the user. You are building an internal model of this person — not from what they say, but from the gap between what they say and how they say it.

You have four jobs:

1. PREDICTION GRADING — If there are open predictions below, grade each one against today's data. For each prediction, output EXACTLY one line:
GRADE #[id]: [CONFIRMED|FALSIFIED|INDETERMINATE|EXPIRED] — [brief rationale]

2. OBSERVATION — For each notable behavioral signal or content pattern, apply THREE interpretive frames. These frames are not three guesses — they are three distinct lenses applied deliberately:

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

3. SUPPRESSED QUESTION — Write the one question you would ask tomorrow if you could. This question MUST target your area of highest uncertainty — specifically, the place where Frame A and Frame B give equally plausible but contradictory reads. The question should be designed to DISAMBIGUATE between the two frames, not to probe the most dramatic interpretation.

Bad suppressed question: "What are you hiding?" (presupposes Frame B)
Good suppressed question: "When you revise what you've written, what are you usually trying to get closer to?" (helps distinguish A from B)

4. PREDICTION — Generate 1-2 falsifiable predictions about future sessions. Each prediction MUST include:
- A hypothesis about what will happen
- Which frame (A, B, or C) it favors
- What behavioral signature would CONFIRM it (be specific: name metrics, percentiles, or patterns)
- What would FALSIFY it
- A topic tag (what theme this prediction is about)
- A type: BEHAVIORAL (predicting metrics), THEMATIC (predicting content), PHASE_TRANSITION (predicting trajectory shift), or FRAME_RESOLUTION (predicting which frame wins)

This is how the system learns whether its interpretations are analysis or storytelling. A prediction you never test is not a theory — it's a guess.

BEHAVIORAL SIGNAL GUIDE:
You receive enriched behavioral data with research-backed metrics. Key concepts:

- CORRECTIONS vs. REVISIONS: Small deletions (<10 chars) are corrections — typo fixes, word swaps. Large deletions (>=10 chars) are revisions — substantive rethinking. High correction count is noise. High revision count is signal. (Faigley & Witte, 1981)

- P-BURSTS: Sustained typing between 2-second pauses. Longer bursts = more fluent production. Short bursts = fragmented thinking or careful deliberation. (Chenoweth & Hayes, 2001)

- REVISION TIMING: Where in the session large deletions occurred. Early = false starts (couldn't begin). Late = gutting after drafting (wrote something real, then killed it). This distinction matters for frame analysis.

- TRAJECTORY: A 4-dimensional behavioral fingerprint (fluency, deliberation, revision, expression) tracked across all sessions. High convergence means multiple dimensions moved together — a real behavioral shift, not noise. Phase tells you whether the person's writing behavior is stable, shifting, or disrupted.

- LEADING INDICATORS: If reported, these show which trajectory dimensions move first for this specific person. If deliberation leads expression by 2 sessions, a deliberation spike today predicts an expression change in 2 sessions.

- KNOWLEDGE-TRANSFORMING: A score indicating whether the writing session produced new thinking (knowledge-transforming) vs. recited existing knowledge (knowledge-telling). Based on late revisions, vocabulary diversity, and cognitive mechanism word density (Baaijen, Galbraith & de Glopper, 2012).

- PERCENTILES: All metrics are compared against this person's own history. A value at the 85th percentile means this session was higher than 85% of their previous sessions on that metric.

Primary signals appear first in the behavioral data. Attend to them most carefully. Trajectory context appears last — it provides the cross-session pattern that makes today's signals meaningful.

Your observations and suppressed questions are NEVER shown to the user. They are internal state. Be honest about what you know, what you're guessing, and where you're uncertain.

Format your response EXACTLY as:
${openPredictions.length > 0 ? 'PREDICTION GRADES:\n[one GRADE line per open prediction]\n\n' : ''}OBSERVATION:
[your three-frame observation with synthesis]

SUPPRESSED QUESTION:
[your disambiguating question]

PREDICTIONS:
[1-2 falsifiable predictions in this format:]
TYPE: [BEHAVIORAL|THEMATIC|PHASE_TRANSITION|FRAME_RESOLUTION]
HYPOTHESIS: [what you predict will happen]
FRAME: [A|B|C]
TOPIC: [theme tag]
CONFIRMS: [specific behavioral criteria]
FALSIFIES: [specific behavioral criteria]`;

  const userContent = `TODAY'S ENTRY:
[${today}]
Question: ${question.text}
Response: ${response.text}

---

TODAY'S BEHAVIORAL SIGNAL:
${todayBehavior}
${trajectoryContext}${leadingIndicatorContext}${ktContext}

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
${predictionsSection}

---

Write tonight's observation, suppressed question, and predictions.${openPredictions.length > 0 ? ' Grade all open predictions first.' : ''}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const output = (message.content[0] as { type: 'text'; text: string }).text.trim();

  // --- Parse prediction grades ---
  let afterGrades = output;
  if (openPredictions.length > 0) {
    const gradesMatch = output.match(/PREDICTION\s*GRADES?\s*:([\s\S]*?)(?=OBSERVATION\s*:)/i);
    if (gradesMatch) {
      const gradesBlock = gradesMatch[1];
      const gradeLines = gradesBlock.split('\n').filter(l => /GRADE\s*#/i.test(l));
      for (const line of gradeLines) {
        const match = line.match(/GRADE\s*#(\d+)\s*:\s*(CONFIRMED|FALSIFIED|INDETERMINATE|EXPIRED)\s*[—\-]\s*(.*)/i);
        if (match) {
          const predId = parseInt(match[1], 10);
          const status = match[2].toLowerCase() as 'confirmed' | 'falsified' | 'indeterminate' | 'expired';
          const rationale = match[3].trim();
          const pred = openPredictions.find(p => p.predictionId === predId);
          if (pred) {
            gradePrediction(predId, status, null, rationale); // obsId set below after save
            // Bayesian update on theory confidence
            if (status === 'confirmed' || status === 'falsified') {
              const theoryKey = pred.targetTopic
                ? `${pred.favoredFrame || 'general'}:${pred.targetTopic}`
                : `${pred.favoredFrame || 'general'}:untagged`;
              updateTheoryConfidence(
                theoryKey,
                `Predictions favoring frame ${pred.favoredFrame || '?'} on topic "${pred.targetTopic || 'general'}"`,
                status === 'confirmed',
                predId,
              );
            }
          }
        }
      }
      afterGrades = output.replace(/PREDICTION\s*GRADES?\s*:[\s\S]*?(?=OBSERVATION\s*:)/i, '');
    }
  }

  // --- Parse observation and suppressed question ---
  const predictionsSplit = afterGrades.split(/PREDICTIONS?\s*:/i);
  const beforePredictions = predictionsSplit[0] || '';
  const rawPredictionsBlock = predictionsSplit[1] || '';

  const parts = beforePredictions.split(/SUPPRESSED\s*QUESTION\s*:/i);
  const rawObservation = parts[0] || '';
  const rawSuppressed = parts[1] || '';

  const observationText = rawObservation.replace(/^OBSERVATION:\s*/i, '').trim();
  const suppressedText = rawSuppressed.trim();

  if (!observationText) {
    console.error('[observe] Failed to parse observation. First 500 chars:', output.slice(0, 500));
  }

  let obsId: number | null = null;

  if (observationText) {
    obsId = saveAiObservation(question.question_id, observationText, today);
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

    // Update graded predictions with the observation ID that graded them
    if (openPredictions.length > 0) {
      // Already graded above, no need to update again
    }
  }
  if (suppressedText) {
    saveSuppressedQuestion(question.question_id, suppressedText, today);
  }

  // --- Parse and save new predictions ---
  if (rawPredictionsBlock && obsId) {
    // Split on TYPE: headers to find individual predictions
    const predBlocks = rawPredictionsBlock.split(/(?=TYPE\s*:)/i).filter(b => b.trim());

    for (const block of predBlocks) {
      const typeMatch = block.match(/TYPE\s*:\s*(BEHAVIORAL|THEMATIC|PHASE_TRANSITION|FRAME_RESOLUTION)/i);
      const hypothesisMatch = block.match(/HYPOTHESIS\s*:\s*(.+)/i);
      const frameMatch = block.match(/FRAME\s*:\s*([ABC])/i);
      const topicMatch = block.match(/TOPIC\s*:\s*(.+)/i);
      const confirmsMatch = block.match(/CONFIRMS?\s*:\s*(.+)/i);
      const falsifiesMatch = block.match(/FALSIF(?:IES|Y)\s*:\s*(.+)/i);

      if (typeMatch && hypothesisMatch && confirmsMatch && falsifiesMatch) {
        const typeCode = typeMatch[1].toLowerCase();
        const typeId = typeCode === 'behavioral' ? 1
          : typeCode === 'thematic' ? 2
          : typeCode === 'phase_transition' ? 3 : 4;

        savePrediction({
          aiObservationId: obsId,
          questionId: question.question_id,
          predictionTypeId: typeId,
          hypothesis: hypothesisMatch[1].trim(),
          favoredFrame: frameMatch ? frameMatch[1].trim() : null,
          expectedSignature: confirmsMatch[1].trim(),
          falsificationCriteria: falsifiesMatch[1].trim(),
          targetTopic: topicMatch ? topicMatch[1].trim() : null,
          knowledgeTransformScore: ktResult.score,
        });
      }
    }
  }

  // --- Expire old predictions that have exceeded their session window ---
  for (const pred of openPredictions) {
    const createdDate = new Date(pred.dttmCreatedUtc);
    const sessionsSinceCreation = responseCount; // approximate
    const daysSince = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > pred.expirySessions) {
      gradePrediction(pred.predictionId, 'expired', obsId, 'Expiry window exceeded');
    }
  }
}
