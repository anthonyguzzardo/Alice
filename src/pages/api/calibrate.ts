import type { APIRoute } from 'astro';
import { saveCalibrationSession, getUsedCalibrationPrompts, saveSessionEvents } from '../../lib/libDb.ts';
import { CALIBRATION_PROMPTS } from '../../lib/libCalibrationPrompts.ts';
import { computeLinguisticDensities } from '../../lib/libLinguistic.ts';
import { computeMATTR } from '../../lib/libAliceNegative/libHelpers.ts';
import { runCalibrationExtraction } from '../../lib/libCalibrationExtract.ts';
import { snapshotCalibrationBaselinesAfterSubmit } from '../../lib/libCalibrationDrift.ts';
import { computeAndPersistDerivedSignals } from '../../lib/libSignalPipeline.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  const used = new Set(await getUsedCalibrationPrompts());
  const available = CALIBRATION_PROMPTS.filter(p => !used.has(p));
  const pool = available.length > 0 ? available : CALIBRATION_PROMPTS; // cycle if all used
  const prompt = pool[Math.floor(Math.random() * pool.length)];
  return new Response(JSON.stringify({ prompt }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { prompt, text, sessionSummary } = body;

  if (!prompt || !text?.trim() || !sessionSummary) {
    return new Response(JSON.stringify({ error: 'Missing prompt, text, or sessionSummary' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const densities = computeLinguisticDensities(text.trim());

  // Compute MATTR + sentence metrics server-side
  const trimmedText = text.trim();
  const mattrWords = trimmedText.toLowerCase().replace(/[^a-z'\s-]/g, '').split(/\s+/).filter((w: string) => w.length > 0);
  const mattrValue = mattrWords.length >= 25 ? computeMATTR(mattrWords) : null;
  const sentences = trimmedText.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  const sentWordCounts = sentences.map((s: string) => s.trim().split(/\s+/).filter(Boolean).length);
  const avgSentLen = sentWordCounts.length > 0
    ? sentWordCounts.reduce((a: number, b: number) => a + b, 0) / sentWordCounts.length : null;
  const sentLenVar = sentWordCounts.length > 1 && avgSentLen != null
    ? sentWordCounts.reduce((sum: number, c: number) => sum + (c - avgSentLen) ** 2, 0) / (sentWordCounts.length - 1) : null;

  const questionId = await saveCalibrationSession(prompt, text.trim(), {
    questionId: 0,
    firstKeystrokeMs: sessionSummary.firstKeystrokeMs ?? null,
    totalDurationMs: sessionSummary.totalDurationMs ?? null,
    totalCharsTyped: sessionSummary.totalCharsTyped ?? 0,
    finalCharCount: sessionSummary.finalCharCount ?? 0,
    commitmentRatio: sessionSummary.commitmentRatio ?? null,
    pauseCount: sessionSummary.pauseCount ?? 0,
    totalPauseMs: sessionSummary.totalPauseMs ?? 0,
    deletionCount: sessionSummary.deletionCount ?? 0,
    largestDeletion: sessionSummary.largestDeletion ?? 0,
    totalCharsDeleted: sessionSummary.totalCharsDeleted ?? 0,
    tabAwayCount: sessionSummary.tabAwayCount ?? 0,
    totalTabAwayMs: sessionSummary.totalTabAwayMs ?? 0,
    wordCount: sessionSummary.wordCount ?? 0,
    sentenceCount: sessionSummary.sentenceCount ?? 0,
    smallDeletionCount: sessionSummary.smallDeletionCount ?? null,
    largeDeletionCount: sessionSummary.largeDeletionCount ?? null,
    largeDeletionChars: sessionSummary.largeDeletionChars ?? null,
    firstHalfDeletionChars: sessionSummary.firstHalfDeletionChars ?? null,
    secondHalfDeletionChars: sessionSummary.secondHalfDeletionChars ?? null,
    activeTypingMs: sessionSummary.activeTypingMs ?? null,
    charsPerMinute: sessionSummary.charsPerMinute ?? null,
    pBurstCount: sessionSummary.pBurstCount ?? null,
    avgPBurstLength: sessionSummary.avgPBurstLength ?? null,
    ...densities,
    interKeyIntervalMean: sessionSummary.interKeyIntervalMean ?? null,
    interKeyIntervalStd: sessionSummary.interKeyIntervalStd ?? null,
    revisionChainCount: sessionSummary.revisionChainCount ?? null,
    revisionChainAvgLength: sessionSummary.revisionChainAvgLength ?? null,
    holdTimeMean: sessionSummary.holdTimeMean ?? null,
    holdTimeStd: sessionSummary.holdTimeStd ?? null,
    flightTimeMean: sessionSummary.flightTimeMean ?? null,
    flightTimeStd: sessionSummary.flightTimeStd ?? null,
    keystrokeEntropy: sessionSummary.keystrokeEntropy ?? null,
    mattr: mattrValue,
    avgSentenceLength: avgSentLen,
    sentenceLengthVariance: sentLenVar,
    scrollBackCount: sessionSummary.scrollBackCount ?? null,
    questionRereadCount: sessionSummary.questionRereadCount ?? null,
    confirmationLatencyMs: sessionSummary.confirmationLatencyMs ?? null,
    pasteCount: sessionSummary.pasteCount ?? null,
    pasteCharsTotal: sessionSummary.pasteCharsTotal ?? null,
    readBackCount: sessionSummary.readBackCount ?? null,
    leadingEdgeRatio: sessionSummary.leadingEdgeRatio ?? null,
    contextualRevisionCount: sessionSummary.contextualRevisionCount ?? null,
    preContextualRevisionCount: sessionSummary.preContextualRevisionCount ?? null,
    consideredAndKeptCount: sessionSummary.consideredAndKeptCount ?? null,
    holdTimeMeanLeft: sessionSummary.holdTimeMeanLeft ?? null,
    holdTimeMeanRight: sessionSummary.holdTimeMeanRight ?? null,
    holdTimeStdLeft: sessionSummary.holdTimeStdLeft ?? null,
    holdTimeStdRight: sessionSummary.holdTimeStdRight ?? null,
    holdTimeCV: sessionSummary.holdTimeCV ?? null,
    negativeFlightTimeCount: sessionSummary.negativeFlightTimeCount ?? null,
    ikiSkewness: sessionSummary.ikiSkewness ?? null,
    ikiKurtosis: sessionSummary.ikiKurtosis ?? null,
    errorDetectionLatencyMean: sessionSummary.errorDetectionLatencyMean ?? null,
    terminalVelocity: sessionSummary.terminalVelocity ?? null,
    // Phase 2 expansion signals
    cursorDistanceDuringPauses: sessionSummary.cursorDistanceDuringPauses ?? null,
    cursorFidgetRatio: sessionSummary.cursorFidgetRatio ?? null,
    cursorStillnessDuringPauses: sessionSummary.cursorStillnessDuringPauses ?? null,
    driftToSubmitCount: sessionSummary.driftToSubmitCount ?? null,
    cursorPauseSampleCount: sessionSummary.cursorPauseSampleCount ?? null,
    deletionExecutionSpeedMean: sessionSummary.deletionExecutionSpeedMean ?? null,
    postcorrectionLatencyMean: sessionSummary.postcorrectionLatencyMean ?? null,
    meanRevisionDistance: sessionSummary.meanRevisionDistance ?? null,
    maxRevisionDistance: sessionSummary.maxRevisionDistance ?? null,
    punctuationFlightMean: sessionSummary.punctuationFlightMean ?? null,
    punctuationLetterRatio: sessionSummary.punctuationLetterRatio ?? null,
    deviceType: sessionSummary.deviceType ?? null,
    userAgent: sessionSummary.userAgent ?? null,
    hourOfDay: sessionSummary.hourOfDay ?? null,
    dayOfWeek: sessionSummary.dayOfWeek ?? null,
  });

  // Store event log + keystroke stream for calibration sessions (same as journal)
  if (Array.isArray(sessionSummary.eventLog) && sessionSummary.eventLog.length > 0) {
    await saveSessionEvents({
      question_id: questionId,
      event_log_json: JSON.stringify(sessionSummary.eventLog),
      total_events: sessionSummary.eventLog.length,
      session_duration_ms: sessionSummary.totalDurationMs ?? 0,
      keystroke_stream_json: Array.isArray(sessionSummary.keystrokeStream) && sessionSummary.keystrokeStream.length > 0
        ? JSON.stringify(sessionSummary.keystrokeStream)
        : null,
    });
  }

  // Fire-and-forget: extract life-context tags from calibration response text.
  // Non-blocking — extraction failure never prevents calibration from succeeding.
  runCalibrationExtraction(questionId, text.trim(), prompt);

  // Fire-and-forget: compute derived signals (motor, semantic, process, cross-session)
  try { await computeAndPersistDerivedSignals(questionId); }
  catch (err) { logError('calibrate.derived-signals', err, { questionId }); }

  // Snapshot calibration baselines after this submission so drift can be
  // tracked over time. Pure deterministic, fire-and-forget.
  try {
    await snapshotCalibrationBaselinesAfterSubmit(sessionSummary.deviceType ?? null);
  } catch (err) {
    logError('calibrate.driftSnapshot', err, { questionId });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
