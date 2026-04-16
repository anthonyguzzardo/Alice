import type { APIRoute } from 'astro';
import { saveResponse, getTodaysQuestion, getTodaysResponse, saveSessionSummary, saveBurstSequence, getResponseCount } from '../../lib/db.ts';
import { runGeneration } from '../../lib/generate.ts';
import { embedResponse } from '../../lib/embeddings.ts';
import { logError } from '../../lib/error-log.ts';
import { localDateStr } from '../../lib/date.ts';
import { computeLinguisticDensities } from '../../lib/linguistic.ts';
import { computeMATTR } from '../../lib/alice-negative/helpers.ts';
import { renderWitnessState } from '../../lib/alice-negative/render-witness.ts';

// Note: runObservation (three-frame + prediction + suppressed question) and
// runReflection (weekly narrative) removed 2026-04-16 in interpretive-layer
// restructure. The background pipeline now only generates tomorrow's question
// and renders the witness state.

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { questionId, text, sessionSummary } = body;

  if (!questionId || !text?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing questionId or text' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const question = getTodaysQuestion();
  if (!question || question.question_id !== questionId) {
    return new Response(JSON.stringify({ error: 'Invalid question' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = getTodaysResponse();
  if (existing) {
    return new Response(JSON.stringify({ error: 'Already responded today' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const responseId = saveResponse(questionId, text.trim());

  // Fire-and-forget: embed the new response for RAG retrieval
  embedResponse(responseId, question.text, text.trim(), localDateStr())
    .catch(err => logError('respond.embed', err, { responseId, questionId }));

  // Compute linguistic densities server-side from response text
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

  if (sessionSummary) {
    if (Array.isArray(sessionSummary.burstSequence) && sessionSummary.burstSequence.length > 0) {
      saveBurstSequence(questionId, sessionSummary.burstSequence);
    }
    saveSessionSummary({
      questionId: sessionSummary.questionId,
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
      deviceType: sessionSummary.deviceType ?? null,
      userAgent: sessionSummary.userAgent ?? null,
      hourOfDay: sessionSummary.hourOfDay ?? null,
      dayOfWeek: sessionSummary.dayOfWeek ?? null,
    });
  }

  const responseCount = getResponseCount();

  // Determine if we should ask "did it land?" (every 5th daily response)
  const askFeedback = responseCount % 5 === 0;

  // Background pipeline — each stage runs independently so one failure
  // cannot silently skip the others. Each error lands in data/errors.log
  // tagged with its stage so you can see exactly what broke.
  (async () => {
    const ctx = { questionId, responseId, responseCount };
    try { await runGeneration(); }
    catch (err) { logError('respond.generation', err, ctx); }

    try { await renderWitnessState(); }
    catch (err) { logError('respond.witness', err, ctx); }
  })();

  return new Response(JSON.stringify({ ok: true, askFeedback, questionId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
