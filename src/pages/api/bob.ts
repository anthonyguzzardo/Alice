/**
 * Returns behavioral signals derived from the user's writing patterns.
 * No content is exposed — only shapes, intensities, and patterns.
 * Bob is a mirror of the person, not the system.
 */
import type { APIRoute } from 'astro';
import db from '../../lib/db.ts';

import type { BobSignal } from '../../lib/bob/types.ts';

export const GET: APIRoute = async () => {
  try {
    // Behavioral averages
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

    // Temporal signals
    const lastEntry = db.prepare(`
      SELECT dttm_created_utc FROM tb_session_summaries
      ORDER BY session_summary_id DESC LIMIT 1
    `).get() as any;

    let daysSinceLastEntry = 0;
    if (lastEntry?.dttm_created_utc) {
      const lastDate = new Date(lastEntry.dttm_created_utc + 'Z');
      daysSinceLastEntry = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
    }

    // Consistency: how evenly spaced are entries? (stddev of gaps)
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
      const variance = gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length;
      const stddev = Math.sqrt(variance);
      // Normalize: low stddev relative to mean = consistent = closer to 1.0
      consistency = meanGap > 0 ? Math.max(0, Math.min(1, 1 - stddev / (meanGap + 1))) : 0.5;
    }

    // Thematic density from last 7 entries
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
        ? 1 - (uniqueWords.size / allWords.length)  // higher = more repetitive
        : 0.5;
    }

    // Feedback ratio
    const feedback = db.prepare(`
      SELECT COUNT(*) as total, SUM(landed) as landed
      FROM tb_question_feedback
    `).get() as any;

    const clamp = (v: number, fallback = 0) => Math.min(1, Math.max(0, v ?? fallback));
    const sc = behavioral.sessionCount ?? 0;

    const signal: BobSignal = {
      // Behavioral
      avgCommitment: clamp(behavioral.avgCommitment, 0.5),
      avgHesitation: clamp(behavioral.avgHesitation, 0.5),
      deletionIntensity: clamp(behavioral.deletionIntensity),
      pauseFrequency: clamp(behavioral.pauseFrequency),
      avgDuration: clamp(behavioral.avgDuration),
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
