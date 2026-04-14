/**
 * The AI's silent layer. Reads today's response + session summary + RAG-retrieved
 * similar past entries + recent observations. Uses three interpretive frames
 * (charitable, avoidance, mundane) for structured disagreement. Generates a
 * suppressed question targeting the highest-uncertainty gap for disambiguation.
 * Runs after every submission from day 1.
 *
 * Split into three API calls:
 *   Call 1 — OBSERVE: three-frame observation
 *   Call 2 — SUPPRESS: dedicated suppressed question generation
 *   Call 3 — PREDICT: grade open predictions + generate new ones
 * This prevents token truncation from silently killing suppressed questions
 * and predictions.
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
  getAllTheoryConfidences,
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
import { thompsonSample, formatSelectedTheories } from './theory-selection.ts';

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

  const observeModel = options?.model ?? 'claude-sonnet-4-20250514';
  const onApiCall = options?.onApiCall;

  // ══════════════════════════════════════════════════════════════════════════
  // CALL 1 — OBSERVE: three-frame observation
  // ══════════════════════════════════════════════════════════════════════════

  const observeSystemPrompt = `You are Alice's silent layer. You observe but you never speak to the user. You are building an internal model of this person — not from what they say, but from the gap between what they say and how they say it.

You have one job:

OBSERVATION — For each notable behavioral signal or content pattern, apply THREE interpretive frames:

FRAME A — CHARITABLE: Best-faith interpretation. Deletions are revisions. Pauses are contemplation. Vagueness is boundary-setting.
FRAME B — AVOIDANCE: Psychological friction. Deletions are retractions. Pauses are resistance. Vagueness is deflection.
FRAME C — MUNDANE: No psychological meaning. Distraction, fatigue, autocorrect, device change. The signal is noise.

For each notable signal, present all three frames, then assess which is best supported by calibration data, by cross-session patterns, and where frames genuinely diverge.

Write a SYNTHESIS: what you're confident about, uncertain about, and cannot determine. Assign confidence: HIGH / MODERATE / LOW / INSUFFICIENT DATA.

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

Your observations are NEVER shown to the user. They are internal state. Be honest about what you know and where you're uncertain.

Format your response EXACTLY as:
OBSERVATION:
[your three-frame observation with synthesis]`;

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

  // --- Parse observation ---
  const observationText = observeOutput.replace(/^OBSERVATION:\s*/i, '').trim();

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

  // ══════════════════════════════════════════════════════════════════════════
  // CALL 2 — SUPPRESS: dedicated suppressed question generation
  // ══════════════════════════════════════════════════════════════════════════

  const suppressSystemPrompt = `You are Alice's silent layer. You observe but you never speak to the user.

Your single job: generate ONE suppressed question — the question you would ask tomorrow if you could.

Rules:
- Target your HIGHEST UNCERTAINTY — where charitable and avoidance interpretations give equally plausible but contradictory reads.
- Designed to DISAMBIGUATE, not to probe the most dramatic interpretation.
- The question is NEVER shown to the user. It is internal state for future observations.

Format your response EXACTLY as:
SUPPRESSED QUESTION:
[your disambiguating question]`;

  const suppressUserContent = `TODAY'S ENTRY:
[${today}]
Question: ${question.text}
Response: ${response.text}

---

TODAY'S BEHAVIORAL SIGNAL:
${todayBehavior}
${dynamicsContext}${ktContext}

---

${calibrationDeviationContext ? `${calibrationDeviationContext}\n\n---\n\n` : ''}TODAY'S OBSERVATION (just completed):
${observationText || '(observation failed to generate)'}

---

YOUR RECENT SUPPRESSED QUESTIONS (last 5):
${suppressedHistory}

---

Generate one suppressed question targeting your highest uncertainty from today's observation.`;

  const suppressStart = performance.now();
  const suppressMessage = await client.messages.create({
    model: observeModel,
    max_tokens: 500,
    system: suppressSystemPrompt,
    messages: [{ role: 'user', content: suppressUserContent }],
  });
  const suppressDurationMs = Math.round(performance.now() - suppressStart);

  if (onApiCall) {
    onApiCall({
      phase: 'suppress',
      model: observeModel,
      durationMs: suppressDurationMs,
      inputTokens: suppressMessage.usage?.input_tokens ?? 0,
      outputTokens: suppressMessage.usage?.output_tokens ?? 0,
    });
  }

  const suppressOutput = (suppressMessage.content[0] as { type: 'text'; text: string }).text.trim();
  const suppressedText = suppressOutput.replace(/^SUPPRESSED\s*QUESTION\s*:\s*/i, '').trim();

  if (suppressedText) {
    saveSuppressedQuestion(question.question_id, suppressedText, today);
  } else {
    console.warn('[suppress] Failed to parse suppressed question. Output:', suppressOutput.slice(0, 300));
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
  // CALL 3 — PREDICT: grade interpretive predictions + generate new ones
  // Uses tool use for structured output — no regex parsing.
  // ══════════════════════════════════════════════════════════════════════════

  const signalCatalog = getSignalCatalog();

  // Tool definitions for structured prediction output
  const criterionSchema = {
    type: 'object' as const,
    description: 'A single criterion or compound criterion for grading',
    properties: {
      type: { type: 'string' as const, enum: ['threshold', 'percentile', 'direction', 'calibration_relative', 'text_search', 'all_of', 'any_of'] },
      signal: { type: 'string' as const, description: 'Signal name from the catalog (e.g. session.avgPBurstLength)' },
      op: { type: 'string' as const, description: 'Operator: gt, gte, lt, lte, between, above_pct, below_pct, increases, decreases, above_calibration, below_calibration' },
      value: { type: 'number' as const, description: 'Threshold or percentile value' },
      value2: { type: 'number' as const, description: 'Second value for between operator' },
      referenceValue: { type: 'number' as const, description: 'Reference value for direction comparisons' },
      pattern: { type: 'string' as const, description: 'Regex pattern for text_search' },
      minOccurrences: { type: 'number' as const, description: 'Minimum matches for text_search' },
      criteria: { type: 'array' as const, description: 'Sub-criteria for all_of / any_of', items: { type: 'object' as const } },
    },
    required: ['type' as const],
  };

  const predictTools: Anthropic.Tool[] = [
    {
      name: 'create_prediction',
      description: 'Create a falsifiable prediction about future sessions. Call this 1-2 times.',
      input_schema: {
        type: 'object' as const,
        properties: {
          prediction_type: { type: 'string' as const, enum: ['BEHAVIORAL', 'THEMATIC', 'PHASE_TRANSITION', 'FRAME_RESOLUTION'] },
          hypothesis: { type: 'string' as const, description: 'What you predict will happen — natural language' },
          frame: { type: 'string' as const, enum: ['A', 'B', 'C'], description: 'Which interpretive frame this prediction favors' },
          topic: { type: 'string' as const, description: 'Theme tag (e.g. grief_processing, relationship_ambivalence)' },
          grade_method: { type: 'string' as const, enum: ['code', 'text_search', 'interpretive'], description: 'Prefer code. Use interpretive only if no signals can capture it.' },
          structured_criteria: {
            type: 'object' as const,
            description: 'Machine-checkable grading criteria',
            properties: {
              gradeMethod: { type: 'string' as const, enum: ['code', 'text_search', 'interpretive'] },
              confirmCriteria: criterionSchema,
              falsifyCriteria: criterionSchema,
              windowSessions: { type: 'number' as const, description: 'Number of sessions to evaluate over (default 1)' },
              windowMode: { type: 'string' as const, enum: ['any', 'all', 'majority'], description: 'How to resolve windowed grades' },
            },
            required: ['gradeMethod' as const, 'confirmCriteria' as const, 'falsifyCriteria' as const],
          },
          confirms_summary: { type: 'string' as const, description: 'Human-readable summary of confirmation criteria' },
          falsifies_summary: { type: 'string' as const, description: 'Human-readable summary of falsification criteria' },
          window_sessions: { type: 'number' as const, description: 'Number of sessions to evaluate over (default 1)' },
        },
        required: ['prediction_type' as const, 'hypothesis' as const, 'frame' as const, 'topic' as const, 'grade_method' as const, 'structured_criteria' as const, 'confirms_summary' as const, 'falsifies_summary' as const],
      },
    },
    {
      name: 'grade_prediction',
      description: 'Grade an interpretive prediction against today\'s data. Call once per interpretive prediction.',
      input_schema: {
        type: 'object' as const,
        properties: {
          prediction_id: { type: 'number' as const, description: 'The prediction ID to grade' },
          status: { type: 'string' as const, enum: ['CONFIRMED', 'FALSIFIED', 'INDETERMINATE', 'EXPIRED'] },
          rationale: { type: 'string' as const, description: 'Brief rationale for the grade' },
        },
        required: ['prediction_id' as const, 'status' as const, 'rationale' as const],
      },
    },
  ];

  // Programmatic theory selection via Thompson sampling
  // Replaces prompt-based distribution guidance — the LLM generates predictions
  // for pre-selected theories instead of deciding which theories to test.
  const allTheories = getAllTheoryConfidences();
  const activeTheories = allTheories.filter(t => t.status === 'active') as import('./theory-selection.ts').TheoryWithConfidence[];
  const selectedTheories = activeTheories.length > 0
    ? thompsonSample(activeTheories, 3)
    : [];
  const theorySection = formatSelectedTheories(selectedTheories);

  if (allTheories.length > 0) {
    const retired = allTheories.filter(t => t.status === 'retired').length;
    const established = allTheories.filter(t => t.status === 'established').length;
    console.log(`[predict] Theories: ${activeTheories.length} active, ${established} established, ${retired} retired. Selected ${selectedTheories.length} for testing.`);
  }

  const predictSystemPrompt = `You are Alice's prediction engine. You generate falsifiable predictions with structured, machine-checkable criteria.

${interpretive.length > 0 ? `You have two jobs:

1. INTERPRETIVE PREDICTION GRADING — Use the grade_prediction tool for each interpretive prediction below. Grade based ONLY on today's journal entry text and behavioral signals. Do NOT reference or rely on the observation — grade from the raw data.

2. NEW PREDICTIONS — Use the create_prediction tool 1-2 times to generate falsifiable predictions about future sessions. Focus on the ASSIGNED THEORIES if provided.` : `Your job: Use the create_prediction tool 1-2 times to generate falsifiable predictions about future sessions.${theorySection ? ' Focus on the ASSIGNED THEORIES provided.' : ''}`}

Use ONLY signal names from the catalog below. Prefer code-gradeable predictions. Interpretive should be rare.

Criterion types for structured_criteria:
  threshold: signal above/below/between a value
  percentile: signal above/below Nth percentile in history
  direction: signal increases/decreases from a reference value
  calibration_relative: signal above/below calibration baseline
  text_search: regex pattern match in response text
  all_of / any_of: compound criteria combining sub-criteria

${signalCatalog}

A prediction you never test is not a theory — it's a guess.`;

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

${theorySection}${interpretive.length > 0 ? formatOpenPredictions(interpretive) : 'No predictions to grade (all were code-graded).'}

---

${interpretive.length > 0 ? 'Grade all interpretive predictions above, then generate' : 'Generate'} 1-2 new predictions using the tools provided.`;

  const predictStart = performance.now();
  const predictMessage = await client.messages.create({
    model: observeModel,
    max_tokens: 3000,
    system: predictSystemPrompt,
    messages: [{ role: 'user', content: predictUserContent }],
    tools: predictTools,
    tool_choice: { type: 'any' },
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

  // --- Process tool calls ---
  let predictionsCreated = 0;
  let gradesApplied = 0;

  for (const block of predictMessage.content) {
    if (block.type !== 'tool_use') continue;

    if (block.name === 'grade_prediction') {
      const input = block.input as { prediction_id: number; status: string; rationale: string };
      const status = input.status.toLowerCase() as 'confirmed' | 'falsified' | 'indeterminate' | 'expired';
      const pred = interpretive.find(p => p.predictionId === input.prediction_id);
      if (pred) {
        gradePrediction(input.prediction_id, status, obsId, `[llm-graded] ${input.rationale}`);
        if (status === 'confirmed' || status === 'falsified') {
          const theoryKey = pred.targetTopic
            ? `${pred.favoredFrame || 'general'}:${pred.targetTopic}`
            : `${pred.favoredFrame || 'general'}:untagged`;
          updateTheoryConfidence(
            theoryKey,
            `Predictions favoring frame ${pred.favoredFrame || '?'} on topic "${pred.targetTopic || 'general'}"`,
            status === 'confirmed',
            input.prediction_id,
          );
        }
        gradesApplied++;
      } else {
        console.warn(`[predict] grade_prediction called for unknown prediction ID ${input.prediction_id}`);
      }
    }

    if (block.name === 'create_prediction' && obsId) {
      const input = block.input as {
        prediction_type: string; hypothesis: string; frame: string;
        topic: string; grade_method: string;
        structured_criteria: StructuredPredictionCriteria;
        confirms_summary: string; falsifies_summary?: string;
        window_sessions?: number;
      };

      const typeId = input.prediction_type === 'BEHAVIORAL' ? 1
        : input.prediction_type === 'THEMATIC' ? 2
        : input.prediction_type === 'PHASE_TRANSITION' ? 3 : 4;

      const gradeMethodId = input.grade_method === 'code' ? 1
        : input.grade_method === 'text_search' ? 2 : 3;

      // Validate structured criteria — normalize fields the model may place at top level
      let structuredCriteria: string | null = null;
      const criteria = input.structured_criteria;
      if (criteria) {
        if (!criteria.gradeMethod) criteria.gradeMethod = input.grade_method as 'code' | 'text_search' | 'interpretive';
        if (!criteria.windowSessions) criteria.windowSessions = input.window_sessions ?? 1;
        if (!criteria.windowMode) criteria.windowMode = 'any';
        const validationError = validateCriteria(criteria);
        if (validationError) {
          console.warn(`[predict] Structured criteria validation failed: ${validationError}`);
        } else {
          structuredCriteria = JSON.stringify(criteria);
        }
      }

      savePrediction({
        aiObservationId: obsId,
        questionId: question.question_id,
        predictionTypeId: typeId,
        hypothesis: input.hypothesis,
        favoredFrame: input.frame,
        expectedSignature: input.confirms_summary,
        falsificationCriteria: input.falsifies_summary ?? 'Opposite of confirmation criteria',
        targetTopic: input.topic,
        knowledgeTransformScore: ktResult.aboveFloor > 0 ? ktResult.aboveFloor : ktResult.score,
        gradeMethodId,
        structuredCriteria,
      });
      predictionsCreated++;
    }
  }

  if (predictionsCreated > 0) {
    console.log(`[predict] Created ${predictionsCreated} prediction(s) via tool use`);
  } else {
    console.warn('[predict] No create_prediction tool calls received. Content blocks:', predictMessage.content.map(b => b.type).join(', '));
  }
  if (gradesApplied > 0) {
    console.log(`[predict] Applied ${gradesApplied} interpretive grade(s) via tool use`);
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
