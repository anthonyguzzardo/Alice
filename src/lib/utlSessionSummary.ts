/**
 * Session summary coercion utility.
 *
 * Converts the raw client-side sessionSummary object (untyped JSON from the
 * browser) into a typed SessionSummaryInput for database persistence. Both
 * calibrate.ts and respond.ts use this to avoid duplicating ~70 lines of
 * field-by-field ?? null coercion.
 *
 * Also computes server-side text metrics (MATTR, sentence length stats) and
 * merges linguistic densities into the result.
 */
import type { SessionSummaryInput } from './libDb.ts';
import { computeLinguisticDensities } from './libLinguistic.ts';
import { computeMATTR } from './libAliceNegative/libHelpers.ts';

/**
 * Coerce a raw client sessionSummary into a typed SessionSummaryInput.
 * questionId is passed separately because calibrate.ts uses 0 (assigned
 * later by saveCalibrationSession) while respond.ts uses the real ID.
 */
export function coerceSessionSummary(
  subjectId: number,
  sessionSummary: Record<string, unknown>,
  questionId: number,
  responseText: string,
): SessionSummaryInput {
  const densities = computeLinguisticDensities(responseText);

  const mattrWords = responseText.toLowerCase().replace(/[^a-z'\s-]/g, '').split(/\s+/).filter((w: string) => w.length > 0);
  const mattr = mattrWords.length >= 25 ? computeMATTR(mattrWords) : null;
  const sentences = responseText.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  const sentWordCounts = sentences.map((s: string) => s.trim().split(/\s+/).filter(Boolean).length);
  const avgSentenceLength = sentWordCounts.length > 0
    ? sentWordCounts.reduce((a: number, b: number) => a + b, 0) / sentWordCounts.length : null;
  const sentenceLengthVariance = sentWordCounts.length > 1 && avgSentenceLength != null
    ? sentWordCounts.reduce((sum: number, c: number) => sum + (c - avgSentenceLength) ** 2, 0) / (sentWordCounts.length - 1) : null;

  return {
    subjectId,
    questionId,
    firstKeystrokeMs: (sessionSummary.firstKeystrokeMs as number) ?? null,
    totalDurationMs: (sessionSummary.totalDurationMs as number) ?? null,
    totalCharsTyped: (sessionSummary.totalCharsTyped as number) ?? 0,
    finalCharCount: (sessionSummary.finalCharCount as number) ?? 0,
    commitmentRatio: (sessionSummary.commitmentRatio as number) ?? null,
    pauseCount: (sessionSummary.pauseCount as number) ?? 0,
    totalPauseMs: (sessionSummary.totalPauseMs as number) ?? 0,
    deletionCount: (sessionSummary.deletionCount as number) ?? 0,
    largestDeletion: (sessionSummary.largestDeletion as number) ?? 0,
    totalCharsDeleted: (sessionSummary.totalCharsDeleted as number) ?? 0,
    tabAwayCount: (sessionSummary.tabAwayCount as number) ?? 0,
    totalTabAwayMs: (sessionSummary.totalTabAwayMs as number) ?? 0,
    wordCount: (sessionSummary.wordCount as number) ?? 0,
    sentenceCount: (sessionSummary.sentenceCount as number) ?? 0,
    smallDeletionCount: (sessionSummary.smallDeletionCount as number) ?? null,
    largeDeletionCount: (sessionSummary.largeDeletionCount as number) ?? null,
    largeDeletionChars: (sessionSummary.largeDeletionChars as number) ?? null,
    firstHalfDeletionChars: (sessionSummary.firstHalfDeletionChars as number) ?? null,
    secondHalfDeletionChars: (sessionSummary.secondHalfDeletionChars as number) ?? null,
    activeTypingMs: (sessionSummary.activeTypingMs as number) ?? null,
    charsPerMinute: (sessionSummary.charsPerMinute as number) ?? null,
    pBurstCount: (sessionSummary.pBurstCount as number) ?? null,
    avgPBurstLength: (sessionSummary.avgPBurstLength as number) ?? null,
    ...densities,
    interKeyIntervalMean: (sessionSummary.interKeyIntervalMean as number) ?? null,
    interKeyIntervalStd: (sessionSummary.interKeyIntervalStd as number) ?? null,
    revisionChainCount: (sessionSummary.revisionChainCount as number) ?? null,
    revisionChainAvgLength: (sessionSummary.revisionChainAvgLength as number) ?? null,
    holdTimeMean: (sessionSummary.holdTimeMean as number) ?? null,
    holdTimeStd: (sessionSummary.holdTimeStd as number) ?? null,
    flightTimeMean: (sessionSummary.flightTimeMean as number) ?? null,
    flightTimeStd: (sessionSummary.flightTimeStd as number) ?? null,
    keystrokeEntropy: (sessionSummary.keystrokeEntropy as number) ?? null,
    mattr,
    avgSentenceLength,
    sentenceLengthVariance,
    scrollBackCount: (sessionSummary.scrollBackCount as number) ?? null,
    questionRereadCount: (sessionSummary.questionRereadCount as number) ?? null,
    confirmationLatencyMs: (sessionSummary.confirmationLatencyMs as number) ?? null,
    pasteCount: (sessionSummary.pasteCount as number) ?? null,
    pasteCharsTotal: (sessionSummary.pasteCharsTotal as number) ?? null,
    dropCount: (sessionSummary.dropCount as number) ?? null,
    readBackCount: (sessionSummary.readBackCount as number) ?? null,
    leadingEdgeRatio: (sessionSummary.leadingEdgeRatio as number) ?? null,
    contextualRevisionCount: (sessionSummary.contextualRevisionCount as number) ?? null,
    preContextualRevisionCount: (sessionSummary.preContextualRevisionCount as number) ?? null,
    consideredAndKeptCount: (sessionSummary.consideredAndKeptCount as number) ?? null,
    holdTimeMeanLeft: (sessionSummary.holdTimeMeanLeft as number) ?? null,
    holdTimeMeanRight: (sessionSummary.holdTimeMeanRight as number) ?? null,
    holdTimeStdLeft: (sessionSummary.holdTimeStdLeft as number) ?? null,
    holdTimeStdRight: (sessionSummary.holdTimeStdRight as number) ?? null,
    holdTimeCV: (sessionSummary.holdTimeCV as number) ?? null,
    negativeFlightTimeCount: (sessionSummary.negativeFlightTimeCount as number) ?? null,
    ikiSkewness: (sessionSummary.ikiSkewness as number) ?? null,
    ikiKurtosis: (sessionSummary.ikiKurtosis as number) ?? null,
    errorDetectionLatencyMean: (sessionSummary.errorDetectionLatencyMean as number) ?? null,
    terminalVelocity: (sessionSummary.terminalVelocity as number) ?? null,
    cursorDistanceDuringPauses: (sessionSummary.cursorDistanceDuringPauses as number) ?? null,
    cursorFidgetRatio: (sessionSummary.cursorFidgetRatio as number) ?? null,
    cursorStillnessDuringPauses: (sessionSummary.cursorStillnessDuringPauses as number) ?? null,
    driftToSubmitCount: (sessionSummary.driftToSubmitCount as number) ?? null,
    cursorPauseSampleCount: (sessionSummary.cursorPauseSampleCount as number) ?? null,
    deletionExecutionSpeedMean: (sessionSummary.deletionExecutionSpeedMean as number) ?? null,
    postcorrectionLatencyMean: (sessionSummary.postcorrectionLatencyMean as number) ?? null,
    meanRevisionDistance: (sessionSummary.meanRevisionDistance as number) ?? null,
    maxRevisionDistance: (sessionSummary.maxRevisionDistance as number) ?? null,
    punctuationFlightMean: (sessionSummary.punctuationFlightMean as number) ?? null,
    punctuationLetterRatio: (sessionSummary.punctuationLetterRatio as number) ?? null,
    deviceType: (sessionSummary.deviceType as string) ?? null,
    userAgent: (sessionSummary.userAgent as string) ?? null,
    hourOfDay: (sessionSummary.hourOfDay as number) ?? null,
    dayOfWeek: (sessionSummary.dayOfWeek as number) ?? null,
  };
}
