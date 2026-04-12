/**
 * Returns behavioral signals derived from the user's writing patterns.
 * No content is exposed — only shapes, intensities, and patterns.
 * Bob is a mirror of the person, not the system.
 *
 * Signal categories:
 *   Behavioral (11) — long-term averages of how you write
 *   Temporal (4)     — when and how consistently you show up
 *   Patterns (3)     — thematic density, feedback ratios
 *   Recency (6)      — recent window vs. long-term, with deltas
 *   Variance (4)     — stability vs. volatility across sessions
 *   Shape (6)        — texture of language structure (not content)
 *   Relational (2)   — how unusual recent behavior is vs. personal baseline
 */
import type { APIRoute } from 'astro';
import db from '../../lib/db.ts';
import type { BobSignal } from '../../lib/bob/types.ts';

// ─── Helpers ────────────────────────────────────────────────────────

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avg(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
}

function stddev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/** Rescale a delta from [-1, 1] to [0, 1] where 0.5 = no change */
function rescaleDelta(delta: number): number {
  return Math.max(0, Math.min(1, 0.5 + delta));
}

/** Normalize variance to 0–1 scale (commitment/ratio variance maxes ~0.25) */
function normVariance(v: number, maxExpected: number = 0.25): number {
  return Math.min(1, v / maxExpected);
}

const clamp = (v: number, fallback = 0) => Math.min(1, Math.max(0, v ?? fallback));

const RECENT_WINDOW = 7;

const HEDGING_WORDS = new Set([
  'maybe', 'perhaps', 'possibly', 'probably', 'might', 'could',
  'somewhat', 'guess', 'suppose', 'seem', 'seems', 'seemed',
  'apparently', 'arguably', 'basically', 'honestly',
]);

const FIRST_PERSON = new Set(['i', 'me', 'my', 'mine', 'myself']);

// ─── Shape metrics ──────────────────────────────────────────────────

function computeShapeMetrics(texts: string[]) {
  if (texts.length === 0) {
    return {
      vocabularyRichness: 0.5,
      avgSentenceLength: 0.5,
      sentenceLengthVariance: 0,
      questionDensity: 0,
      firstPersonDensity: 0.5,
      hedgingDensity: 0,
    };
  }

  const allText = texts.join(' ');
  const words = allText.toLowerCase()
    .replace(/[^a-z'\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);
  const uniqueWords = new Set(words);

  // Type-token ratio
  const vocabularyRichness = words.length > 0
    ? uniqueWords.size / words.length : 0.5;

  // Sentence analysis
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSentLen = avg(sentenceLengths);
  const sentLenVar = variance(sentenceLengths);

  // Question marks per sentence
  const questionCount = (allText.match(/\?/g) || []).length;
  const questionDensity = sentences.length > 0
    ? questionCount / sentences.length : 0;

  // First-person pronoun density
  const fpCount = words.filter(w => FIRST_PERSON.has(w)).length;
  const firstPersonDensity = words.length > 0 ? fpCount / words.length : 0.5;

  // Hedging word density
  const hedgeCount = words.filter(w => HEDGING_WORDS.has(w)).length;
  const hedgingDensity = words.length > 0 ? hedgeCount / words.length : 0;

  return {
    vocabularyRichness: clamp(vocabularyRichness),
    avgSentenceLength: clamp(avgSentLen / 30),     // 30 words/sentence → 1.0
    sentenceLengthVariance: clamp(sentLenVar / 200),// normalize
    questionDensity: clamp(questionDensity),
    firstPersonDensity: clamp(firstPersonDensity * 5),  // 20% → 1.0
    hedgingDensity: clamp(hedgingDensity * 10),         // 10% → 1.0
  };
}

// ─── Session volatility ─────────────────────────────────────────────

function computeVolatility(sessions: Array<{ commitment: number; hesitation: number; duration: number }>): number {
  if (sessions.length < 2) return 0;
  let totalDiff = 0;
  for (let i = 0; i < sessions.length - 1; i++) {
    const diff = (
      Math.abs(sessions[i].commitment - sessions[i + 1].commitment) +
      Math.abs(sessions[i].hesitation - sessions[i + 1].hesitation) +
      Math.abs(sessions[i].duration - sessions[i + 1].duration)
    ) / 3;
    totalDiff += diff;
  }
  return Math.min(1, totalDiff / (sessions.length - 1));
}

// ─── Latest session deviation ───────────────────────────────────────

function computeDeviation(
  latest: { commitment: number; hesitation: number; duration: number },
  allValues: Array<{ commitment: number; hesitation: number; duration: number }>,
): number {
  if (allValues.length < 3) return 0;
  const keys: Array<keyof typeof latest> = ['commitment', 'hesitation', 'duration'];
  let totalZ = 0;
  let count = 0;
  for (const key of keys) {
    const vals = allValues.map(s => s[key]);
    const std = stddev(vals);
    if (std > 0.01) {
      totalZ += Math.abs((latest[key] - avg(vals)) / std);
      count++;
    }
  }
  const avgZ = count > 0 ? totalZ / count : 0;
  return Math.min(1, avgZ / 3); // 3 sigma → 1.0
}

// ─── Outlier frequency ──────────────────────────────────────────────

function computeOutlierFreq(
  allValues: Array<{ commitment: number; hesitation: number; duration: number }>,
): number {
  if (allValues.length < 3) return 0;
  const keys: Array<keyof (typeof allValues)[0]> = ['commitment', 'hesitation', 'duration'];
  const means: Record<string, number> = {};
  const stds: Record<string, number> = {};
  for (const key of keys) {
    const vals = allValues.map(s => s[key]);
    means[key] = avg(vals);
    stds[key] = stddev(vals);
  }

  let outlierCount = 0;
  for (const session of allValues) {
    for (const key of keys) {
      if (stds[key] > 0.01 && Math.abs(session[key] - means[key]) > 2 * stds[key]) {
        outlierCount++;
        break;
      }
    }
  }
  return outlierCount / allValues.length;
}

// ─── Main handler ───────────────────────────────────────────────────

export const GET: APIRoute = async () => {
  try {
    // ── Long-term behavioral averages ──────────────────────────────
    const behavioral = db.prepare(`
      SELECT
         AVG(commitment_ratio) as avgCommitment
        ,AVG(CAST(first_keystroke_ms AS REAL) / 60000.0) as avgHesitation
        ,AVG(CASE WHEN total_chars_typed > 0
             THEN CAST(total_chars_deleted AS REAL) / total_chars_typed
             ELSE 0 END) as deletionIntensity
        ,AVG(CAST(pause_count AS REAL) / 10.0) as pauseFrequency
        ,AVG(CAST(total_duration_ms AS REAL) / 600000.0) as avgDuration
        ,MAX(largest_deletion) as maxLargestDeletion
        ,AVG(CAST(largest_deletion AS REAL)) as avgLargestDeletion
        ,AVG(CAST(tab_away_count AS REAL)) as avgTabAways
        ,AVG(CAST(total_tab_away_ms AS REAL) / 60000.0) as avgTabAwayDuration
        ,AVG(CAST(word_count AS REAL)) as avgWordCount
        ,AVG(CAST(sentence_count AS REAL)) as avgSentenceCount
        ,AVG(CAST(hour_of_day AS REAL)) as avgHourOfDay
        ,COUNT(DISTINCT day_of_week) as uniqueDays
        ,COUNT(*) as sessionCount
      FROM tb_session_summaries
    `).get() as any;

    // ── Individual session data (for variance, recency, deviation) ─
    const allSessionRows = db.prepare(`
      SELECT
         commitment_ratio
        ,CAST(first_keystroke_ms AS REAL) / 60000.0 as hesitation
        ,CAST(total_duration_ms AS REAL) / 600000.0 as duration
      FROM tb_session_summaries
      ORDER BY session_summary_id DESC
    `).all() as Array<{ commitment_ratio: number; hesitation: number; duration: number }>;

    const allSessions = allSessionRows.map(s => ({
      commitment: clamp(s.commitment_ratio ?? 0),
      hesitation: clamp(s.hesitation ?? 0),
      duration: clamp(s.duration ?? 0),
    }));

    const recentSessions = allSessions.slice(0, RECENT_WINDOW);
    const sc = behavioral.sessionCount ?? 0;

    // ── Recency signals ────────────────────────────────────────────
    const longCommitment = clamp(behavioral.avgCommitment, 0.5);
    const longHesitation = clamp(behavioral.avgHesitation, 0.5);
    const longDuration = clamp(behavioral.avgDuration, 0.5);

    const recentCommitment = recentSessions.length > 0
      ? avg(recentSessions.map(s => s.commitment)) : longCommitment;
    const recentHesitation = recentSessions.length > 0
      ? avg(recentSessions.map(s => s.hesitation)) : longHesitation;
    const recentDuration = recentSessions.length > 0
      ? avg(recentSessions.map(s => s.duration)) : longDuration;

    const commitmentDelta = rescaleDelta(recentCommitment - longCommitment);
    const hesitationDelta = rescaleDelta(recentHesitation - longHesitation);
    const durationDelta = rescaleDelta(recentDuration - longDuration);

    // ── Variance signals ───────────────────────────────────────────
    const commitmentValues = allSessions.map(s => s.commitment);
    const hesitationValues = allSessions.map(s => s.hesitation);
    const durationValues = allSessions.map(s => s.duration);

    const commitmentVariance = normVariance(variance(commitmentValues));
    const hesitationVariance = normVariance(variance(hesitationValues));
    const durationVariance = normVariance(variance(durationValues));
    const sessionVolatility = computeVolatility(allSessions);

    // ── Relational signals ─────────────────────────────────────────
    const latestSessionDeviation = allSessions.length > 0
      ? computeDeviation(allSessions[0], allSessions) : 0;
    const outlierFrequency = computeOutlierFreq(allSessions);

    // ── Temporal signals ───────────────────────────────────────────
    const lastEntry = db.prepare(`
      SELECT dttm_created_utc FROM tb_session_summaries
      ORDER BY session_summary_id DESC LIMIT 1
    `).get() as any;

    let daysSinceLastEntry = 0;
    if (lastEntry?.dttm_created_utc) {
      const lastDate = new Date(lastEntry.dttm_created_utc + 'Z');
      daysSinceLastEntry = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
    }

    // Consistency: stddev of gaps between entries
    const entryDates = db.prepare(`
      SELECT dttm_created_utc FROM tb_session_summaries
      ORDER BY session_summary_id ASC
    `).all() as any[];

    let consistency = 0.5;
    if (entryDates.length >= 3) {
      const gaps: number[] = [];
      for (let i = 1; i < entryDates.length; i++) {
        const a = new Date(entryDates[i - 1].dttm_created_utc + 'Z').getTime();
        const b = new Date(entryDates[i].dttm_created_utc + 'Z').getTime();
        gaps.push((b - a) / 86400000);
      }
      const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const gapVariance = gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length;
      const gapStddev = Math.sqrt(gapVariance);
      consistency = meanGap > 0 ? Math.max(0, Math.min(1, 1 - gapStddev / (meanGap + 1))) : 0.5;
    }

    // ── Pattern signals ────────────────────────────────────────────
    // Thematic density from last 7 non-calibration entries
    const recentTexts = db.prepare(`
      SELECT r.text FROM tb_responses r
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE q.question_source_id != 3
      ORDER BY q.scheduled_for DESC LIMIT 7
    `).all() as Array<{ text: string }>;

    let thematicDensity = 0.5;
    if (recentTexts.length >= 2) {
      const allWords = recentTexts.map(r => r.text.toLowerCase()).join(' ')
        .replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const uniqueWords = new Set(allWords);
      thematicDensity = allWords.length > 0
        ? 1 - (uniqueWords.size / allWords.length)
        : 0.5;
    }

    // Feedback ratio
    const feedback = db.prepare(`
      SELECT COUNT(*) as total, SUM(landed) as landed
      FROM tb_question_feedback
    `).get() as any;

    // ── Shape signals (from response text) ─────────────────────────
    const shapeTexts = db.prepare(`
      SELECT r.text FROM tb_responses r
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE q.question_source_id != 3
      ORDER BY r.response_id DESC LIMIT ${RECENT_WINDOW}
    `).all() as Array<{ text: string }>;

    const shape = computeShapeMetrics(shapeTexts.map(r => r.text));

    // ── Assemble signal ────────────────────────────────────────────
    const signal: BobSignal = {
      // Behavioral (long-term)
      avgCommitment: longCommitment,
      avgHesitation: longHesitation,
      deletionIntensity: clamp(behavioral.deletionIntensity),
      pauseFrequency: clamp(behavioral.pauseFrequency),
      avgDuration: longDuration,
      largestDeletion: clamp((behavioral.avgLargestDeletion ?? 0) / 500),
      avgTabAways: clamp((behavioral.avgTabAways ?? 0) / 5),
      avgTabAwayDuration: clamp(behavioral.avgTabAwayDuration),
      avgWordCount: clamp((behavioral.avgWordCount ?? 0) / 500),
      avgSentenceCount: clamp((behavioral.avgSentenceCount ?? 0) / 30),
      sessionCount: sc,

      // Temporal
      avgHourOfDay: clamp((behavioral.avgHourOfDay ?? 12) / 24),
      daySpread: clamp((behavioral.uniqueDays ?? 1) / 7),
      consistency,
      daysSinceLastEntry,

      // Patterns
      thematicDensity: clamp(thematicDensity),
      landedRatio: feedback.total > 0 ? (feedback.landed ?? 0) / feedback.total : 0.5,
      feedbackCount: feedback.total ?? 0,

      // Recency
      recentCommitment: clamp(recentCommitment),
      commitmentDelta,
      recentHesitation: clamp(recentHesitation),
      hesitationDelta,
      recentDuration: clamp(recentDuration),
      durationDelta,

      // Variance
      commitmentVariance,
      hesitationVariance,
      durationVariance,
      sessionVolatility,

      // Shape
      ...shape,

      // Relational
      latestSessionDeviation,
      outlierFrequency,
    };

    return new Response(JSON.stringify(signal), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to compute signal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
