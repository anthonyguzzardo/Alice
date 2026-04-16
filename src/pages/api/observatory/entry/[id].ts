/**
 * Observatory Entry API — hardcoded to simulation DB.
 */
import type { APIRoute } from 'astro';
import simDb from '../../../../lib/sim-db.ts';

export const GET: APIRoute = async ({ params }) => {
  try {
    const responseId = parseInt(params.id ?? '', 10);
    if (isNaN(responseId)) {
      return new Response(JSON.stringify({ error: 'Invalid response ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Entry state + question context
    const entryState = simDb.prepare(`
      SELECT es.*, q.scheduled_for as date, q.question_id, q.text as question_text
      FROM tb_entry_states es
      JOIN tb_responses r ON es.response_id = r.response_id
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE es.response_id = ?
    `).get(responseId) as any;

    if (!entryState) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Session summary
    const sessionSummary = simDb.prepare(`
      SELECT
        question_id as questionId,
        first_keystroke_ms as firstKeystrokeMs,
        total_duration_ms as totalDurationMs,
        active_typing_ms as activeTypingMs,
        total_chars_typed as totalCharsTyped,
        final_char_count as finalCharCount,
        commitment_ratio as commitmentRatio,
        chars_per_minute as charsPerMinute,
        word_count as wordCount,
        sentence_count as sentenceCount,
        pause_count as pauseCount,
        total_pause_ms as totalPauseMs,
        small_deletion_count as smallDeletionCount,
        large_deletion_count as largeDeletionCount,
        large_deletion_chars as largeDeletionChars,
        tab_away_count as tabAwayCount,
        total_tab_away_ms as totalTabAwayMs,
        p_burst_count as pBurstCount,
        avg_p_burst_length as avgPBurstLength,
        inter_key_interval_mean as interKeyIntervalMean,
        inter_key_interval_std as interKeyIntervalStd,
        hold_time_mean as holdTimeMean,
        hold_time_std as holdTimeStd,
        flight_time_mean as flightTimeMean,
        flight_time_std as flightTimeStd,
        keystroke_entropy as keystrokeEntropy,
        mattr,
        avg_sentence_length as avgSentenceLength,
        sentence_length_variance as sentenceLengthVariance,
        nrc_anger_density as nrcAngerDensity,
        nrc_fear_density as nrcFearDensity,
        nrc_joy_density as nrcJoyDensity,
        nrc_sadness_density as nrcSadnessDensity,
        nrc_trust_density as nrcTrustDensity,
        nrc_anticipation_density as nrcAnticipationDensity,
        cognitive_density as cognitiveDensity,
        hedging_density as hedgingDensity,
        first_person_density as firstPersonDensity,
        device_type as deviceType,
        hour_of_day as hourOfDay,
        day_of_week as dayOfWeek
      FROM tb_session_summaries
      WHERE question_id = ?
    `).get(entryState.question_id) as any;

    // Observation / predictions / suppressed question / theory impact
    // archived 2026-04-16 (interpretive-layer restructure). Data preserved
    // under zz_archive_*_20260416 tables; not surfaced by the current app.
    const observation = null;
    const predictions: any[] = [];
    const suppressedQuestion = null;
    const resolvedByThis: any[] = [];
    const theoryImpact: any[] = [];

    // Navigation: prev/next
    const prev = simDb.prepare(`
      SELECT response_id FROM tb_entry_states
      WHERE entry_state_id < (SELECT entry_state_id FROM tb_entry_states WHERE response_id = ?)
      ORDER BY entry_state_id DESC LIMIT 1
    `).get(responseId) as any;

    const next = simDb.prepare(`
      SELECT response_id FROM tb_entry_states
      WHERE entry_state_id > (SELECT entry_state_id FROM tb_entry_states WHERE response_id = ?)
      ORDER BY entry_state_id ASC LIMIT 1
    `).get(responseId) as any;

    return new Response(JSON.stringify({
      entryState,
      sessionSummary,
      observation,
      predictions,
      resolvedByThis,
      theoryImpact,
      suppressedQuestion,
      navigation: {
        prev: prev?.response_id ?? null,
        next: next?.response_id ?? null,
      },
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to load entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
