import type { APIRoute } from 'astro';
import { saveResponse, getTodaysQuestion, getTodaysResponse, saveSessionSummary, getResponseCount } from '../../lib/db.ts';
import { runObservation } from '../../lib/observe.ts';
import { runGeneration } from '../../lib/generate.ts';
import { runReflection } from '../../lib/reflect.ts';
import { embedResponse } from '../../lib/embeddings.ts';
import { localDateStr } from '../../lib/date.ts';

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
    .catch(err => console.error('[respond] Embedding error:', err));

  if (sessionSummary) {
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
      deviceType: sessionSummary.deviceType ?? null,
      userAgent: sessionSummary.userAgent ?? null,
      hourOfDay: sessionSummary.hourOfDay ?? null,
      dayOfWeek: sessionSummary.dayOfWeek ?? null,
    });
  }

  const responseCount = getResponseCount();

  // Determine if we should ask "did it land?" (every 5th daily response)
  const askFeedback = responseCount % 5 === 0;

  Promise.resolve()
    .then(() => runObservation())
    .then(() => runGeneration())
    .then(() => {
      if (responseCount >= 5 && responseCount % 7 === 0) {
        return runReflection();
      }
    })
    .catch((err) => {
      console.error('Background job error:', err);
    });

  return new Response(JSON.stringify({ ok: true, askFeedback, questionId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
