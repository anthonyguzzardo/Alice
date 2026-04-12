import type { APIRoute } from 'astro';
import { saveCalibrationSession } from '../../lib/db.ts';
import { CALIBRATION_PROMPTS } from '../../lib/calibration-prompts.ts';

export const GET: APIRoute = () => {
  const prompt = CALIBRATION_PROMPTS[Math.floor(Math.random() * CALIBRATION_PROMPTS.length)];
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

  saveCalibrationSession(prompt, text.trim(), {
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
    deviceType: sessionSummary.deviceType ?? null,
    userAgent: sessionSummary.userAgent ?? null,
    hourOfDay: sessionSummary.hourOfDay ?? null,
    dayOfWeek: sessionSummary.dayOfWeek ?? null,
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
