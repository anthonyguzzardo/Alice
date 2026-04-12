/**
 * Returns behavioral signals derived from the user's writing patterns.
 * No content is exposed — only shapes, intensities, and patterns.
 *
 * Normalization: personal percentile rank (not hardcoded divisors).
 * Research basis:
 *   Production fluency  — Chenoweth & Hayes (2001), Deane (2015)
 *   Revision character  — Faigley & Witte (1981), Baaijen et al. (2012)
 *   Lexical diversity   — McCarthy & Jarvis (2010) MATTR
 */
import type { APIRoute } from 'astro';
import db from '../../lib/db.ts';
import type { BobSignal, BobSignalRaw } from '../../lib/bob/types.ts';
import {
  avg, variance, stddev, clamp, percentileRank,
  rescaleDelta, normVariance, computeMATTR,
  HEDGING_WORDS, FIRST_PERSON,
} from '../../lib/bob/helpers.ts';

const RECENT_WINDOW = 7;

// ─── Shape metrics ──────────────────────────────────────────────────

function computeShapeMetrics(texts: string[]) {
  if (texts.length === 0) {
    return {
      lexicalDiversity: 0.5,
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

  // MATTR replaces TTR
  const lexicalDiversity = computeMATTR(words);

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
    lexicalDiversity: clamp(lexicalDiversity),
    avgSentenceLength: clamp(avgSentLen / 30),
    sentenceLengthVariance: clamp(sentLenVar / 200),
    questionDensity: clamp(questionDensity),
    firstPersonDensity: clamp(firstPersonDensity * 5),
    hedgingDensity: clamp(hedgingDensity * 10),
  };
}

// ─── Session data with derived rates ────────────────────────────────

interface SessionDerived {
  commitmentRatio: number;
  firstKeystrokeMs: number;
  durationMs: number;
  wordCount: number;
  // Time-normalized rates
  pauseRatePerMin: number;
  tabAwayRatePerMin: number;
  charsPerMinute: number;
  // Revision character
  correctionRate: number;    // small deletions per 100 chars
  revisionRate: number;      // large deletions per 100 chars
  revisionWeight: number;    // large_deletion_chars / total_chars_typed
  revisionTiming: number;    // 0=early, 1=late
  largestDeletion: number;
  // P-bursts
  pBurstCount: number;
  avgPBurstLength: number;
}

function deriveSession(row: any): SessionDerived {
  const totalCharsTyped = row.total_chars_typed || 1;
  const durationMs = row.total_duration_ms || 1;

  // Compute active typing time (fallback for old rows without active_typing_ms)
  const activeMs = row.active_typing_ms != null
    ? Math.max(1, row.active_typing_ms)
    : Math.max(1, durationMs - (row.total_pause_ms || 0) - (row.total_tab_away_ms || 0));
  const activeMinutes = activeMs / 60000;

  // Chars per minute (use stored value or compute)
  const charsPerMinute = row.chars_per_minute != null
    ? row.chars_per_minute
    : totalCharsTyped / activeMinutes;

  // Deletion decomposition (fallback for old rows)
  let smallDelCount = row.small_deletion_count;
  let largeDelCount = row.large_deletion_count;
  let largeDelChars = row.large_deletion_chars;

  if (smallDelCount == null || largeDelCount == null) {
    // Heuristic for pre-migration rows
    const delCount = row.deletion_count || 0;
    const largest = row.largest_deletion || 0;
    if (largest >= 10 && delCount > 0) {
      largeDelCount = 1;
      smallDelCount = Math.max(0, delCount - 1);
      largeDelChars = largest; // best guess — only know the largest
    } else {
      largeDelCount = 0;
      smallDelCount = delCount;
      largeDelChars = 0;
    }
  }

  // Revision timing (fallback: 0.5 = unknown)
  let revisionTiming = 0.5;
  const totalLargeDel = (row.first_half_deletion_chars || 0) + (row.second_half_deletion_chars || 0);
  if (totalLargeDel > 0) {
    revisionTiming = (row.second_half_deletion_chars || 0) / totalLargeDel;
  }

  // P-bursts (fallback: estimate from typing speed)
  const pBurstCount = row.p_burst_count != null ? row.p_burst_count : 0;
  const avgPBurstLength = row.avg_p_burst_length != null ? row.avg_p_burst_length : 0;

  return {
    commitmentRatio: clamp(row.commitment_ratio ?? 0.5),
    firstKeystrokeMs: row.first_keystroke_ms || 0,
    durationMs,
    wordCount: row.word_count || 0,
    pauseRatePerMin: activeMinutes > 0 ? (row.pause_count || 0) / activeMinutes : 0,
    tabAwayRatePerMin: activeMinutes > 0 ? (row.tab_away_count || 0) / activeMinutes : 0,
    charsPerMinute,
    correctionRate: totalCharsTyped > 0 ? (smallDelCount || 0) / (totalCharsTyped / 100) : 0,
    revisionRate: totalCharsTyped > 0 ? (largeDelCount || 0) / (totalCharsTyped / 100) : 0,
    revisionWeight: totalCharsTyped > 0 ? (largeDelChars || 0) / totalCharsTyped : 0,
    revisionTiming,
    largestDeletion: row.largest_deletion || 0,
    pBurstCount,
    avgPBurstLength,
  };
}

// ─── Session volatility ─────────────────────────────────────────────

function computeVolatility(sessions: SessionDerived[]): number {
  if (sessions.length < 2) return 0;
  let totalDiff = 0;
  for (let i = 0; i < sessions.length - 1; i++) {
    const diff = (
      Math.abs(sessions[i].commitmentRatio - sessions[i + 1].commitmentRatio) +
      Math.abs(sessions[i].charsPerMinute / 200 - sessions[i + 1].charsPerMinute / 200) +
      Math.abs(sessions[i].revisionWeight - sessions[i + 1].revisionWeight)
    ) / 3;
    totalDiff += diff;
  }
  return Math.min(1, totalDiff / (sessions.length - 1));
}

// ─── Latest session deviation ───────────────────────────────────────

function computeDeviation(latest: SessionDerived, all: SessionDerived[]): number {
  if (all.length < 3) return 0;
  const keys: Array<keyof Pick<SessionDerived, 'commitmentRatio' | 'charsPerMinute' | 'revisionWeight'>> =
    ['commitmentRatio', 'charsPerMinute', 'revisionWeight'];
  let totalZ = 0;
  let count = 0;
  for (const key of keys) {
    const vals = all.map(s => s[key]);
    const std = stddev(vals);
    if (std > 0.001) {
      totalZ += Math.abs((latest[key] - avg(vals)) / std);
      count++;
    }
  }
  const avgZ = count > 0 ? totalZ / count : 0;
  return Math.min(1, avgZ / 3);
}

// ─── Outlier frequency ──────────────────────────────────────────────

function computeOutlierFreq(all: SessionDerived[]): number {
  if (all.length < 3) return 0;
  const keys: Array<keyof Pick<SessionDerived, 'commitmentRatio' | 'charsPerMinute' | 'revisionWeight'>> =
    ['commitmentRatio', 'charsPerMinute', 'revisionWeight'];
  const means: Record<string, number> = {};
  const stds: Record<string, number> = {};
  for (const key of keys) {
    const vals = all.map(s => s[key]);
    means[key] = avg(vals);
    stds[key] = stddev(vals);
  }

  let outlierCount = 0;
  for (const session of all) {
    for (const key of keys) {
      if (stds[key] > 0.001 && Math.abs(session[key] - means[key]) > 2 * stds[key]) {
        outlierCount++;
        break;
      }
    }
  }
  return outlierCount / all.length;
}

// ─── Main handler ───────────────────────────────────────────────────

export const GET: APIRoute = async () => {
  try {
    // ── Load all session rows ─────────────────────────────────────
    const allRows = db.prepare(`
      SELECT * FROM tb_session_summaries
      ORDER BY session_summary_id ASC
    `).all() as any[];

    const allSessions = allRows.map(deriveSession);
    const sc = allSessions.length;

    if (sc === 0) {
      // Return neutral defaults
      const emptySignal: BobSignal = {
        commitmentRatio: 0.5, firstKeystrokeLatency: 0.5, pauseRatePerMinute: 0.5,
        tabAwayRatePerMinute: 0.5, avgDurationNorm: 0.5, avgWordCountNorm: 0.5,
        charsPerMinuteActive: 0.5, avgPBurstLength: 0.5, pBurstCountNorm: 0.5,
        correctionRate: 0, revisionRate: 0, revisionWeight: 0,
        revisionTiming: 0.5, largestRevisionNorm: 0.5,
        avgHourOfDay: 0.5, daySpread: 0, consistency: 0.5, daysSinceLastEntry: 0,
        lexicalDiversity: 0.5, avgSentenceLength: 0.5, sentenceLengthVariance: 0,
        questionDensity: 0, firstPersonDensity: 0.5, hedgingDensity: 0,
        commitmentDelta: 0.5, charsPerMinuteDelta: 0.5,
        revisionWeightDelta: 0.5, pBurstLengthDelta: 0.5,
        commitmentVariance: 0, fluencyVariance: 0, sessionVolatility: 0,
        thematicDensity: 0.5, landedRatio: 0.5, feedbackCount: 0, sessionCount: 0,
        latestSessionDeviation: 0, outlierFrequency: 0,
        _raw: {
          avgFirstKeystrokeMs: 0, avgDurationMs: 0, avgWordCount: 0,
          avgCharsPerMinute: 0, avgCommitmentRatio: 0, avgPBurstLengthChars: 0,
          latestCommitmentRatio: null, latestLargeDeletionCount: null,
          latestLargeDeletionChars: null, latestSmallDeletionCount: null,
          latestCharsPerMinute: null, latestPBurstLength: null,
          latestRevisionTiming: null,
          baselineCommitmentMean: 0, baselineCommitmentStd: 0,
          baselineCharsPerMinuteMean: 0, baselineCharsPerMinuteStd: 0,
        },
      };
      return new Response(JSON.stringify(emptySignal), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Compute percentile arrays ─────────────────────────────────
    const commitmentValues = allSessions.map(s => s.commitmentRatio);
    const keystrokeValues = allSessions.map(s => s.firstKeystrokeMs);
    const durationValues = allSessions.map(s => s.durationMs);
    const wordCountValues = allSessions.map(s => s.wordCount);
    const cpmValues = allSessions.map(s => s.charsPerMinute);
    const burstLenValues = allSessions.filter(s => s.avgPBurstLength > 0).map(s => s.avgPBurstLength);
    const burstCountValues = allSessions.filter(s => s.pBurstCount > 0).map(s => s.pBurstCount);
    const pauseRateValues = allSessions.map(s => s.pauseRatePerMin);
    const tabRateValues = allSessions.map(s => s.tabAwayRatePerMin);
    const largestDelValues = allSessions.map(s => s.largestDeletion);

    // Averages for percentile normalization
    const avgCommitment = avg(commitmentValues);
    const avgKeystroke = avg(keystrokeValues);
    const avgDuration = avg(durationValues);
    const avgWordCount = avg(wordCountValues);
    const avgCPM = avg(cpmValues);
    const avgBurstLen = burstLenValues.length > 0 ? avg(burstLenValues) : 0;
    const avgPauseRate = avg(pauseRateValues);
    const avgTabRate = avg(tabRateValues);

    // ── Core behavioral (percentile of the average) ───────────────
    const commitmentRatio = percentileRank(avgCommitment, commitmentValues);
    const firstKeystrokeLatency = percentileRank(avgKeystroke, keystrokeValues);
    const pauseRatePerMinute = percentileRank(avgPauseRate, pauseRateValues);
    const tabAwayRatePerMinute = percentileRank(avgTabRate, tabRateValues);
    const avgDurationNorm = percentileRank(avgDuration, durationValues);
    const avgWordCountNorm = percentileRank(avgWordCount, wordCountValues);

    // ── Production fluency ────────────────────────────────────────
    const charsPerMinuteActive = percentileRank(avgCPM, cpmValues);
    const avgPBurstLengthNorm = burstLenValues.length > 0
      ? percentileRank(avgBurstLen, burstLenValues) : 0.5;
    const avgBurstCount = burstCountValues.length > 0 ? avg(burstCountValues) : 0;
    const pBurstCountNorm = burstCountValues.length > 0
      ? percentileRank(avgBurstCount, burstCountValues) : 0.5;

    // ── Revision character ────────────────────────────────────────
    const correctionRates = allSessions.map(s => s.correctionRate);
    const revisionRates = allSessions.map(s => s.revisionRate);
    const revisionWeights = allSessions.map(s => s.revisionWeight);

    const correctionRate = clamp(avg(correctionRates));
    const revisionRate = clamp(avg(revisionRates));
    const revisionWeight = clamp(avg(revisionWeights));
    const latestSession = allSessions[allSessions.length - 1];
    const revisionTiming = latestSession.revisionTiming;
    const largestRevisionNorm = percentileRank(
      avg(largestDelValues), largestDelValues
    );

    // ── Recent window vs long-term ────────────────────────────────
    const recentSessions = allSessions.slice(-RECENT_WINDOW);

    const recentCommitment = avg(recentSessions.map(s => s.commitmentRatio));
    const recentCPM = avg(recentSessions.map(s => s.charsPerMinute));
    const recentRevWeight = avg(recentSessions.map(s => s.revisionWeight));
    const recentBurstLen = recentSessions.filter(s => s.avgPBurstLength > 0).length > 0
      ? avg(recentSessions.filter(s => s.avgPBurstLength > 0).map(s => s.avgPBurstLength))
      : avgBurstLen;

    const commitmentDelta = rescaleDelta(recentCommitment - avgCommitment);
    const charsPerMinuteDelta = avgCPM > 0
      ? rescaleDelta((recentCPM - avgCPM) / Math.max(avgCPM, 1))
      : 0.5;
    const revisionWeightDelta = rescaleDelta(recentRevWeight - avg(revisionWeights));
    const pBurstLengthDelta = avgBurstLen > 0
      ? rescaleDelta((recentBurstLen - avgBurstLen) / Math.max(avgBurstLen, 1))
      : 0.5;

    // ── Variance / stability ──────────────────────────────────────
    const commitmentVariance = normVariance(variance(commitmentValues));
    const fluencyVariance = normVariance(variance(cpmValues), 2500); // CPM variance
    const sessionVolatility = computeVolatility(allSessions);

    // ── Temporal ──────────────────────────────────────────────────
    const hourValues = allRows.map((r: any) => r.hour_of_day).filter((h: any) => h != null);
    const avgHourOfDay = hourValues.length > 0 ? clamp(avg(hourValues) / 24) : 0.5;

    const uniqueDays = new Set(allRows.map((r: any) => r.day_of_week).filter((d: any) => d != null)).size;
    const daySpread = clamp(uniqueDays / 7);

    // Consistency: regularity of gaps
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
      const meanGap = avg(gaps);
      const gapStd = stddev(gaps);
      consistency = meanGap > 0 ? Math.max(0, Math.min(1, 1 - gapStd / (meanGap + 1))) : 0.5;
    }

    let daysSinceLastEntry = 0;
    if (entryDates.length > 0) {
      const lastDate = new Date(entryDates[entryDates.length - 1].dttm_created_utc + 'Z');
      daysSinceLastEntry = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
    }

    // ── Patterns ──────────────────────────────────────────────────
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
        ? 1 - (uniqueWords.size / allWords.length) : 0.5;
    }

    const feedback = db.prepare(`
      SELECT COUNT(*) as total, SUM(landed) as landed
      FROM tb_question_feedback
    `).get() as any;

    // ── Shape ─────────────────────────────────────────────────────
    const shapeTexts = db.prepare(`
      SELECT r.text FROM tb_responses r
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE q.question_source_id != 3
      ORDER BY r.response_id DESC LIMIT ${RECENT_WINDOW}
    `).all() as Array<{ text: string }>;

    const shape = computeShapeMetrics(shapeTexts.map(r => r.text));

    // ── Relational ────────────────────────────────────────────────
    const latestSessionDeviation = allSessions.length > 0
      ? computeDeviation(allSessions[allSessions.length - 1], allSessions) : 0;
    const outlierFrequency = computeOutlierFreq(allSessions);

    // ── Raw context for interpreter ───────────────────────────────
    const _raw: BobSignalRaw = {
      avgFirstKeystrokeMs: avg(keystrokeValues),
      avgDurationMs: avg(durationValues),
      avgWordCount: avg(wordCountValues),
      avgCharsPerMinute: avgCPM,
      avgCommitmentRatio: avgCommitment,
      avgPBurstLengthChars: avgBurstLen,
      latestCommitmentRatio: latestSession.commitmentRatio,
      latestLargeDeletionCount: latestSession.revisionRate > 0
        ? Math.round(latestSession.revisionRate * latestSession.wordCount / 100) || null
        : null,
      latestLargeDeletionChars: latestSession.revisionWeight > 0
        ? Math.round(latestSession.revisionWeight * (allRows[allRows.length - 1].total_chars_typed || 0))
        : null,
      latestSmallDeletionCount: allRows[allRows.length - 1].small_deletion_count ?? null,
      latestCharsPerMinute: latestSession.charsPerMinute,
      latestPBurstLength: latestSession.avgPBurstLength > 0 ? latestSession.avgPBurstLength : null,
      latestRevisionTiming: latestSession.revisionTiming !== 0.5 ? latestSession.revisionTiming : null,
      baselineCommitmentMean: avgCommitment,
      baselineCommitmentStd: stddev(commitmentValues),
      baselineCharsPerMinuteMean: avgCPM,
      baselineCharsPerMinuteStd: stddev(cpmValues),
    };

    // ── Assemble signal ───────────────────────────────────────────
    const signal: BobSignal = {
      commitmentRatio,
      firstKeystrokeLatency,
      pauseRatePerMinute,
      tabAwayRatePerMinute,
      avgDurationNorm,
      avgWordCountNorm,

      charsPerMinuteActive,
      avgPBurstLength: avgPBurstLengthNorm,
      pBurstCountNorm,

      correctionRate,
      revisionRate,
      revisionWeight,
      revisionTiming,
      largestRevisionNorm,

      avgHourOfDay,
      daySpread,
      consistency,
      daysSinceLastEntry,

      ...shape,

      commitmentDelta,
      charsPerMinuteDelta,
      revisionWeightDelta,
      pBurstLengthDelta,

      commitmentVariance,
      fluencyVariance,
      sessionVolatility,

      thematicDensity: clamp(thematicDensity),
      landedRatio: feedback.total > 0 ? (feedback.landed ?? 0) / feedback.total : 0.5,
      feedbackCount: feedback.total ?? 0,
      sessionCount: sc,

      latestSessionDeviation,
      outlierFrequency,

      _raw,
    };

    return new Response(JSON.stringify(signal), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[bob] Error computing signal:', err);
    return new Response(JSON.stringify({ error: 'Failed to compute signal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
