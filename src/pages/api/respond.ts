import type { APIRoute } from 'astro';
import { saveResponse, getTodaysQuestion, getTodaysResponse, saveSessionSummary } from '../../lib/db.ts';

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

  saveResponse(questionId, text.trim());

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
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
