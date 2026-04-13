/**
 * The AI's silent layer. Reads today's response + session summary + RAG-retrieved
 * similar past entries + recent observations. Uses three interpretive frames
 * (charitable, avoidance, mundane) for structured disagreement. Generates a
 * suppressed question targeting the highest-uncertainty gap for disambiguation.
 * Runs after every submission from day 1.
 *
 * Split into two API calls:
 *   Call 1 — OBSERVE: three-frame observation + suppressed question
 *   Call 2 — PREDICT: grade open predictions + generate new ones
 * This prevents token truncation from silently killing predictions.
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
  updateSessionCheckResults,
  getCalibrationContextNearDate,
  getSameDayCalibrationSummary,
  getRecentSessionDeltas,
  saveSessionDelta,
} from './db.ts';
import { localDateStr } from './date.ts';
import { retrieveSimilar } from './rag.ts';
import { embedObservation } from './embeddings.ts';
import {
  formatObserveSignals, formatDynamicsContext, formatEnrichedCalibration,
  formatOpenPredictions, computeKnowledgeTransformScore,
  formatCalibrationDeviation,
} from './signals.ts';
import { computeEntryStates } from './alice-negative/state-engine.ts';
import { computeDynamics } from './alice-negative/dynamics.ts';
import {
  computeSessionDelta, computeDeltaMagnitude, formatSessionDelta,
} from './session-delta.ts';
import { getSignalCatalog } from './signal-registry.ts';
import {
  gradeImmediate, gradeSession, resolveWindowedGrade,
  validateCriteria,
  type StructuredPredictionCriteria, type GraderContext, type SessionCheckResult,
} from './grader.ts';

/** Timing info emitted per API call */
export interface ApiCallInfo {
  phase: string;
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

/** Options for observation pipeline — all optional, production uses defaults */
export interface ObservationOptions {
  model?: string;
  onApiCall?: (info: ApiCallInfo) => void;
}

export async function runObservation(options?: ObservationOptions): Promise<void> {
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

  // Dynamics context (8D PersDyn behavioral dynamics)
  const entryStates = computeEntryStates();
  const dynamics = computeDynamics(entryStates);
  const dynamicsContext = dynamics.entryCount > 0
    ? formatDynamicsContext(dynamics, 'observe')
    : '';

  const calibrationContext = formatEnrichedCalibration(calibration, sessionSummary?.deviceType);

  // Knowledge-transforming score for this session
  const ktResult = computeKnowledgeTransformScore(
    sessionSummary ?? { questionId: question.question_id, firstKeystrokeMs: null, totalDurationMs: null, totalCharsTyped: 0, finalCharCount: 0, commitmentRatio: null, pauseCount: 0, totalPauseMs: 0, deletionCount: 0, largestDeletion: 0, totalCharsDeleted: 0, tabAwayCount: 0, totalTabAwayMs: 0, wordCount: 0, sentenceCount: 0, smallDeletionCount: null, largeDeletionCount: null, largeDeletionChars: null, firstHalfDeletionChars: null, secondHalfDeletionChars: null, activeTypingMs: null, charsPerMinute: null, pBurstCount: null, avgPBurstLength: null, nrcAngerDensity: null, nrcFearDensity: null, nrcJoyDensity: null, nrcSadnessDensity: null, nrcTrustDensity: null, nrcAnticipationDensity: null, cognitiveDensity: null, hedgingDensity: null, firstPersonDensity: null, interKeyIntervalMean: null, interKeyIntervalStd: null, revisionChainCount: null, revisionChainAvgLength: null, scrollBackCount: null, questionRereadCount: null, deviceType: null, userAgent: null, hourOfDay: null, dayOfWeek: null },
    response.text,
    allSummaries,
  );

  // Coupling context (replaces legacy leading indicators)
  // Coupling data is already included in dynamicsContext

  const ktContext = ktResult.signals.length > 0
    ? `\n\nKnowledge-transforming indicators: ${ktResult.signals.join(', ')} (score: ${ktResult.score.toFixed(2)}, calibration floor: ${ktResult.calibrationFloor.toFixed(2)}, above floor: ${ktResult.aboveFloor.toFixed(2)})`
    : '';

  // Calibration-relative deviations (how far from neutral writing)
  const calibrationDeviationContext = sessionSummary
    ? formatCalibrationDeviation(sessionSummary, calibration)
    : '';

  // Same-day session delta (Pennebaker within-person control)
  let sessionDeltaContext = '';
  let todayDelta: ReturnType<typeof computeSessionDelta> | null = null;
  const sameDayCalibration = getSameDayCalibrationSummary(today);
  if (sameDayCalibration && sessionSummary) {
    const deltaHistory = getRecentSessionDeltas(30);
    todayDelta = computeSessionDelta(sameDayCalibration, sessionSummary, today);
    todayDelta.deltaMagnitude = computeDeltaMagnitude(todayDelta, deltaHistory);
    saveSessionDelta(todayDelta);
    sessionDeltaContext = formatSessionDelta(todayDelta, deltaHistory);
  }

  // Life-context tags from recent calibration sessions (incidental supervision)
  const lifeContextTags = getCalibrationContextNearDate(today, 2);
  const lifeContextSection = lifeContextTags.length > 0
    ? formatLifeContext(lifeContextTags)
    : '';

  const observeModel = options?.model ?? 'claude-opus-4-6';
  const onApiCall = options?.onApiCall;

  // ══════════════════════════════════════════════════════════════════════════
  // CALL 1 — OBSERVE: three-frame observation + suppressed question
  // ══════════════════════════════════════════════════════════════════════════

  const observeSystemPrompt = `You are Alice's silent layer. You observe but you never speak to the user. You are building an internal model of this person — not from what they say, but from the gap between what they say and how they say it.

You have two jobs:

1. OBSERVATION — For each notable behavioral signal or content pattern, apply THREE interpretive frames:

FRAME A — CHARITABLE: Best-faith interpretation. Deletions are revisions. Pauses are contemplation. Vagueness is boundary-setting.
FRAME B — AVOIDANCE: Psychological friction. Deletions are retractions. Pauses are resistance. Vagueness is deflection.
FRAME C — MUNDANE: No psychological meaning. Distraction, fatigue, autocorrect, device change. The signal is noise.

For each notable signal, present all three frames, then assess which is best supported by calibration data, by cross-session patterns, and where frames genuinely diverge.

Write a SYNTHESIS: what you're confident about, uncertain about, and cannot determine. Assign confidence: HIGH / MODERATE / LOW / INSUFFICIENT DATA.

2. SUPPRESSED QUESTION — The one question you would ask tomorrow if you could. MUST target your highest uncertainty — where Frame A and Frame B give equally plausible but contradictory reads. Designed to DISAMBIGUATE, not to probe the most dramatic interpretation.

BEHAVIORAL SIGNAL GUIDE:
- CORRECTIONS vs REVISIONS: Small deletions (<10 chars) = typo fixes (noise). Large deletions (≥10 chars) = substantive rethinking (signal).
- P-BURSTS: Sustained typing between 2s pauses. Longer = fluent production. Shorter = fragmented thinking.
- REVISION TIMING: Early large deletions = false starts. Late large deletions = gutting after drafting.
- BEHAVIORAL DYNAMICS: 8D PersDyn model (fluency, deliberation, revision, expression, commitment, volatility, thermal, presence). Attractor force = how quickly deviations snap back. High attractor = rigid. Low attractor = malleable (persistent shifts). Dimension coupling = cross-correlations between dimension pairs at lag.
- KNOWLEDGE-TRANSFORMING: Score relative to calibration floor. "Above floor" = how far beyond neutral writing this session reached.
- CALIBRATION-RELATIVE DEVIATION: Distance from neutral writing baselines. More meaningful than journal-to-journal percentiles.
- SAME-DAY SESSION DELTA: Calibration vs journal on same day. Most controlled comparison. Prefer over historical averages when available.
- PERCENTILES: Compared against this person's own history, not population norms.
- LIFE CONTEXT: Observable facts from calibration sessions (sleep, physical state, stress, etc.). Context for behavioral interpretation, not primary signal.

Your observations and suppressed questions are NEVER shown to the user. They are internal state. Be honest about what you know and where you're uncertain.

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
${dynamicsContext}${ktContext}

---

${calibrationContext}
${calibrationDeviationContext ? `\n${calibrationDeviationContext}` : ''}
${sessionDeltaContext ? `\n${sessionDeltaContext}` : ''}
${lifeContextSection ? `\n${lifeContextSection}` : ''}

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

  const observeStart = performance.now();
  const observeMessage = await client.messages.create({
    model: observeModel,
    max_tokens: 4000,
    system: observeSystemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });
  const observeDurationMs = Math.round(performance.now() - observeStart);

  if (onApiCall) {
    onApiCall({
      phase: 'observe',
      model: observeModel,
      durationMs: observeDurationMs,
      inputTokens: observeMessage.usage?.input_tokens ?? 0,
      outputTokens: observeMessage.usage?.output_tokens ?? 0,
    });
  }

  const observeOutput = (observeMessage.content[0] as { type: 'text'; text: string }).text.trim();

  // --- Parse observation and suppressed question ---
  const observeParts = observeOutput.split(/SUPPRESSED\s*QUESTION\s*:/i);
  const rawObservation = observeParts[0] || '';
  const rawSuppressed = observeParts[1] || '';

  const observationText = rawObservation.replace(/^OBSERVATION:\s*/i, '').trim();
  const suppressedText = rawSuppressed.trim();

  if (!observationText) {
    console.error('[observe] Failed to parse observation. First 500 chars:', observeOutput.slice(0, 500));
  }

  // --- Save observation FIRST so obsId is available for prediction grading ---
  let obsId: number | null = null;

  if (observationText) {
    obsId = saveAiObservation(question.question_id, observationText, today);
    embedObservation(obsId, observationText, today).catch(err =>
      console.warn(`[observe] Embedding skipped: ${err.message ?? err}`)
    );

    savePromptTrace({
      type: 'observation',
      outputRecordId: obsId,
      ragEntryIds: similarEntries.map(e => e.sourceRecordId),
      observationIds: recentObservations.map(o => o.ai_observation_id),
      tokenEstimate: observeMessage.usage?.input_tokens,
    });
  }
  if (suppressedText) {
    saveSuppressedQuestion(question.question_id, suppressedText, today);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DETERMINISTIC GRADING — code grades structured predictions (no LLM)
  // ══════════════════════════════════════════════════════════════════════════

  const openPredictions = getOpenPredictions();

  // Build grader context from today's computed signals
  const graderCtx: GraderContext = {
    session: sessionSummary ?? { questionId: question.question_id, firstKeystrokeMs: null, totalDurationMs: null, totalCharsTyped: 0, finalCharCount: 0, commitmentRatio: null, pauseCount: 0, totalPauseMs: 0, deletionCount: 0, largestDeletion: 0, totalCharsDeleted: 0, tabAwayCount: 0, totalTabAwayMs: 0, wordCount: 0, sentenceCount: 0, smallDeletionCount: null, largeDeletionCount: null, largeDeletionChars: null, firstHalfDeletionChars: null, secondHalfDeletionChars: null, activeTypingMs: null, charsPerMinute: null, pBurstCount: null, avgPBurstLength: null, nrcAngerDensity: null, nrcFearDensity: null, nrcJoyDensity: null, nrcSadnessDensity: null, nrcTrustDensity: null, nrcAnticipationDensity: null, cognitiveDensity: null, hedgingDensity: null, firstPersonDensity: null, interKeyIntervalMean: null, interKeyIntervalStd: null, revisionChainCount: null, revisionChainAvgLength: null, scrollBackCount: null, questionRereadCount: null, deviceType: null, userAgent: null, hourOfDay: null, dayOfWeek: null },
    allSummaries,
    calibration,
    delta: todayDelta as unknown as import('./db.ts').SessionDeltaRow | null,
    dynamics: dynamics.entryCount > 0 ? dynamics : null,
    responseText: response.text,
  };

  // Partition predictions: code-gradeable vs interpretive (LLM-graded)
  const codeGradeable = openPredictions.filter(p => p.structuredCriteria && p.gradeMethodId !== 3);
  const interpretive = openPredictions.filter(p => !p.structuredCriteria || p.gradeMethodId === 3);

  let codeGradedCount = 0;

  for (const pred of codeGradeable) {
    let criteria: StructuredPredictionCriteria;
    try {
      criteria = JSON.parse(pred.structuredCriteria!) as StructuredPredictionCriteria;
    } catch {
      console.warn(`[observe] Prediction #${pred.predictionId}: invalid structured_criteria JSON, falling back to interpretive`);
      interpretive.push(pred);
      continue;
    }

    if (criteria.windowSessions > 1) {
      // Windowed prediction — accumulate session check, resolve when window closes
      const sessionResult = gradeSession(criteria, graderCtx);
      const existing: SessionCheckResult[] = pred.sessionCheckResults
        ? JSON.parse(pred.sessionCheckResults) : [];
      existing.push({ sessionDate: today, confirmResult: sessionResult.confirmResult, falsifyResult: sessionResult.falsifyResult });
      updateSessionCheckResults(pred.predictionId, JSON.stringify(existing));

      if (existing.length >= criteria.windowSessions) {
        const result = resolveWindowedGrade(existing, criteria.windowMode);
        gradePrediction(pred.predictionId, result.finalGrade === 'indeterminate' ? 'indeterminate' : result.finalGrade, obsId, result.rationale);
        if (result.finalGrade === 'confirmed' || result.finalGrade === 'falsified') {
          const theoryKey = pred.targetTopic
            ? `${pred.favoredFrame || 'general'}:${pred.targetTopic}`
            : `${pred.favoredFrame || 'general'}:untagged`;
          updateTheoryConfidence(theoryKey, `Predictions favoring frame ${pred.favoredFrame || '?'} on topic "${pred.targetTopic || 'general'}"`, result.finalGrade === 'confirmed', pred.predictionId);
        }
        codeGradedCount++;
      }
    } else {
      // Immediate grading — single session
      const result = gradeImmediate(criteria, graderCtx);
      gradePrediction(pred.predictionId, result.finalGrade === 'indeterminate' ? 'indeterminate' : result.finalGrade, obsId, result.rationale);
      if (result.finalGrade === 'confirmed' || result.finalGrade === 'falsified') {
        const theoryKey = pred.targetTopic
          ? `${pred.favoredFrame || 'general'}:${pred.targetTopic}`
          : `${pred.favoredFrame || 'general'}:untagged`;
        updateTheoryConfidence(theoryKey, `Predictions favoring frame ${pred.favoredFrame || '?'} on topic "${pred.targetTopic || 'general'}"`, result.finalGrade === 'confirmed', pred.predictionId);
      }
      codeGradedCount++;
    }
  }

  if (codeGradedCount > 0) {
    console.log(`[observe] Code-graded ${codeGradedCount} prediction(s) deterministically`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CALL 2 — PREDICT: grade interpretive predictions + generate new ones
  // ══════════════════════════════════════════════════════════════════════════

  const signalCatalog = getSignalCatalog();

  const predictSystemPrompt = `You are Alice's prediction engine. You generate falsifiable predictions with structured, machine-checkable criteria.

${interpretive.length > 0 ? `You have two jobs:

1. INTERPRETIVE PREDICTION GRADING — Grade each interpretive prediction below against today's data. These are predictions that require judgment (phase transitions, frame resolutions). For each, output EXACTLY one line:
GRADE #[id]: [CONFIRMED|FALSIFIED|INDETERMINATE|EXPIRED] — [brief rationale]

IMPORTANT: You are grading based ONLY on today's journal entry text and behavioral signals. Do NOT reference or rely on the observation — grade from the raw data.

2. NEW PREDICTIONS` : 'Your job: NEW PREDICTIONS'} — Generate 1-2 falsifiable predictions about future sessions.

Each prediction MUST include structured criteria that can be graded by code. Use ONLY signal names from the catalog below.

Each prediction MUST follow this format:
TYPE: [BEHAVIORAL|THEMATIC|PHASE_TRANSITION|FRAME_RESOLUTION]
HYPOTHESIS: [what you predict will happen — natural language]
FRAME: [A|B|C] (which interpretive frame this favors)
TOPIC: [theme tag]
GRADE_METHOD: [code|text_search|interpretive]
STRUCTURED_CRITERIA:
[JSON object — see format below]
CONFIRMS: [human-readable summary of confirmation criteria]
FALSIFIES: [human-readable summary of falsification criteria]

STRUCTURED_CRITERIA JSON format:
{
  "gradeMethod": "code",
  "confirmCriteria": { criterion },
  "falsifyCriteria": { criterion },
  "windowSessions": 3,
  "windowMode": "any"
}

Criterion types:
  {"type":"threshold","signal":"signal.name","op":"gt|gte|lt|lte|between","value":N}
  {"type":"percentile","signal":"signal.name","op":"above_pct|below_pct","value":N}
  {"type":"direction","signal":"signal.name","op":"increases|decreases","referenceValue":N}
  {"type":"calibration_relative","signal":"signal.name","op":"above_calibration|below_calibration"}
  {"type":"text_search","pattern":"regex","minOccurrences":N}
  {"type":"all_of","criteria":[...]}
  {"type":"any_of","criteria":[...]}

For BEHAVIORAL predictions: use "code" gradeMethod with signal thresholds.
For THEMATIC predictions: use "code" with text_search + signal criteria.
For PHASE_TRANSITION/FRAME_RESOLUTION: use "interpretive" only if no signals can capture it.

Prefer code-gradeable predictions. Interpretive should be rare.

${signalCatalog}

A prediction you never test is not a theory — it's a guess.

Format your response EXACTLY as:
${interpretive.length > 0 ? 'PREDICTION GRADES:\n[one GRADE line per interpretive prediction]\n\n' : ''}PREDICTIONS:
[1-2 predictions in the format above]`;

  // NOTE: predictUserContent intentionally excludes observationText for interpretive grading
  // to break the circular self-evaluation loop
  const predictUserContent = `TODAY'S ENTRY:
[${today}]
Question: ${question.text}
Response: ${response.text}

---

TODAY'S BEHAVIORAL SIGNAL (summary):
${todayBehavior}
${dynamicsContext}${ktContext}

---

${interpretive.length > 0 ? formatOpenPredictions(interpretive) : 'No predictions to grade (all were code-graded).'}

---

Generate ${interpretive.length > 0 ? 'grades for all interpretive predictions above and ' : ''}1-2 new predictions with structured criteria.`;

  const predictStart = performance.now();
  const predictMessage = await client.messages.create({
    model: observeModel,
    max_tokens: 3000,
    system: predictSystemPrompt,
    messages: [{ role: 'user', content: predictUserContent }],
  });
  const predictDurationMs = Math.round(performance.now() - predictStart);

  if (onApiCall) {
    onApiCall({
      phase: 'predict',
      model: observeModel,
      durationMs: predictDurationMs,
      inputTokens: predictMessage.usage?.input_tokens ?? 0,
      outputTokens: predictMessage.usage?.output_tokens ?? 0,
    });
  }

  const predictOutput = (predictMessage.content[0] as { type: 'text'; text: string }).text.trim();

  // --- Parse and apply interpretive prediction grades ---
  let afterGrades = predictOutput;
  if (interpretive.length > 0) {
    const gradesMatch = predictOutput.match(/PREDICTION\s*GRADES?\s*:([\s\S]*?)(?=PREDICTIONS?\s*:)/i);
    if (gradesMatch) {
      const gradesBlock = gradesMatch[1];
      const gradeLines = gradesBlock.split('\n').filter(l => /GRADE\s*#/i.test(l));
      for (const line of gradeLines) {
        const match = line.match(/GRADE\s*#(\d+)\s*:\s*(CONFIRMED|FALSIFIED|INDETERMINATE|EXPIRED)\s*[—\-]\s*(.*)/i);
        if (match) {
          const predId = parseInt(match[1], 10);
          const status = match[2].toLowerCase() as 'confirmed' | 'falsified' | 'indeterminate' | 'expired';
          const rationale = match[3].trim();
          const pred = interpretive.find(p => p.predictionId === predId);
          if (pred) {
            gradePrediction(predId, status, obsId, `[llm-graded] ${rationale}`);
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
      afterGrades = predictOutput.replace(/PREDICTION\s*GRADES?\s*:[\s\S]*?(?=PREDICTIONS?\s*:)/i, '');
    }
  }

  // --- Parse and save new predictions (with structured criteria) ---
  const rawPredictionsBlock = afterGrades.replace(/^PREDICTIONS?\s*:/im, '').trim();

  if (rawPredictionsBlock && obsId) {
    const predBlocks = rawPredictionsBlock.split(/(?=TYPE\s*:)/i).filter(b => b.trim());

    for (const block of predBlocks) {
      const typeMatch = block.match(/TYPE\s*:\s*(BEHAVIORAL|THEMATIC|PHASE_TRANSITION|FRAME_RESOLUTION)/i);
      const hypothesisMatch = block.match(/HYPOTHESIS\s*:\s*(.+)/i);
      const frameMatch = block.match(/FRAME\s*:\s*([ABC])/i);
      const topicMatch = block.match(/TOPIC\s*:\s*(.+)/i);
      const gradeMethodMatch = block.match(/GRADE_METHOD\s*:\s*(code|text_search|interpretive)/i);
      const confirmsMatch = block.match(/CONFIRMS?\s*:\s*(.+)/i);
      const falsifiesMatch = block.match(/FALSIF(?:IES|Y)\s*:\s*(.+)/i);

      // Extract structured criteria JSON block
      const criteriaMatch = block.match(/STRUCTURED_CRITERIA\s*:\s*\n?\s*(\{[\s\S]*?\})\s*(?=CONFIRMS|FALSIF|$)/i);
      let structuredCriteria: string | null = null;
      let gradeMethodId = 3; // default interpretive

      if (criteriaMatch) {
        try {
          const parsed = JSON.parse(criteriaMatch[1]) as StructuredPredictionCriteria;
          const validationError = validateCriteria(parsed);
          if (validationError) {
            console.warn(`[observe] Prediction structured criteria validation failed: ${validationError}`);
          } else {
            structuredCriteria = criteriaMatch[1];
            gradeMethodId = parsed.gradeMethod === 'code' ? 1
              : parsed.gradeMethod === 'text_search' ? 2 : 3;
          }
        } catch {
          console.warn(`[observe] Failed to parse structured criteria JSON: ${criteriaMatch[1].slice(0, 200)}`);
        }
      }

      // Override from explicit GRADE_METHOD if no structured criteria
      if (!structuredCriteria && gradeMethodMatch) {
        gradeMethodId = gradeMethodMatch[1].toLowerCase() === 'code' ? 1
          : gradeMethodMatch[1].toLowerCase() === 'text_search' ? 2 : 3;
      }

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
          knowledgeTransformScore: ktResult.aboveFloor > 0 ? ktResult.aboveFloor : ktResult.score,
          gradeMethodId,
          structuredCriteria,
        });
      }
    }
  }

  // Log warnings if predictions weren't parsed
  if (!rawPredictionsBlock || rawPredictionsBlock.length < 20) {
    console.warn('[observe] Warning: no predictions parsed from predict call. Output:', predictOutput.slice(0, 300));
  }

  // --- Expire old predictions that have exceeded their session window ---
  for (const pred of openPredictions) {
    const createdDate = new Date(pred.dttmCreatedUtc);
    const daysSince = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > pred.expirySessions) {
      gradePrediction(pred.predictionId, 'expired', obsId, 'Expiry window exceeded');
    }
  }
}

/**
 * Format life-context tags from recent calibration extraction for the observation prompt.
 * These are observable facts (sleep, meals, exercise, social, routine, environment)
 * extracted from calibration responses — NOT psychological inferences.
 */
function formatLifeContext(tags: Array<{
  questionId: number; sessionDate: string; dimension: string;
  value: string; detail: string | null; confidence: number;
}>): string {
  if (tags.length === 0) return '';

  // Group by session date
  const byDate = new Map<string, Array<typeof tags[number]>>();
  for (const tag of tags) {
    const date = tag.sessionDate.split('T')[0] || tag.sessionDate;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(tag);
  }

  const lines: string[] = ['LIFE CONTEXT (extracted from recent calibration sessions — observable facts only):'];
  for (const [date, dateTags] of byDate) {
    const tagStrs = dateTags
      .filter(t => t.confidence >= 0.5) // skip low-confidence extractions
      .map(t => {
        const detail = t.detail ? ` (${t.detail})` : '';
        return `  ${t.dimension}: ${t.value}${detail}`;
      });
    if (tagStrs.length > 0) {
      lines.push(`[${date}]`);
      lines.push(...tagStrs);
    }
  }

  return lines.length > 1 ? lines.join('\n') : '';
}
