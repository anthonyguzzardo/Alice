/**
 * Observatory Entry API
 *
 * Returns full per-entry detail: behavioral 7D state + semantic 11D state
 * + session summary + session metadata + replay availability + nav.
 *
 * Pulls from the live alice.db.
 */
import type { APIRoute } from 'astro';
import db from '../../../../lib/db.ts';
import { computeDynamicalSignals, type KeystrokeEvent } from '../../../../lib/dynamical-signals.ts';

export const GET: APIRoute = async ({ params }) => {
  try {
    const responseId = parseInt(params.id ?? '', 10);
    if (isNaN(responseId)) {
      return new Response(JSON.stringify({ error: 'Invalid response ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Behavioral state + question context
    const entryState = db.prepare(`
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

    // Semantic state
    const semanticState = db.prepare(`
      SELECT
         syntactic_complexity, interrogation, self_focus, uncertainty
        ,cognitive_processing
        ,nrc_anger, nrc_fear, nrc_joy, nrc_sadness, nrc_trust, nrc_anticipation
        ,sentiment, abstraction, agency_framing, temporal_orientation
        ,convergence as semantic_convergence
      FROM tb_semantic_states
      WHERE response_id = ?
    `).get(responseId) as any;

    // Session summary
    const sessionSummary = db.prepare(`
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
        first_half_deletion_chars as firstHalfDeletionChars,
        second_half_deletion_chars as secondHalfDeletionChars,
        tab_away_count as tabAwayCount,
        total_tab_away_ms as totalTabAwayMs,
        p_burst_count as pBurstCount,
        avg_p_burst_length as avgPBurstLength,
        inter_key_interval_mean as interKeyIntervalMean,
        inter_key_interval_std as interKeyIntervalStd,
        revision_chain_count as revisionChainCount,
        revision_chain_avg_length as revisionChainAvgLength,
        hold_time_mean as holdTimeMean,
        hold_time_std as holdTimeStd,
        flight_time_mean as flightTimeMean,
        flight_time_std as flightTimeStd,
        keystroke_entropy as keystrokeEntropy,
        mattr,
        avg_sentence_length as avgSentenceLength,
        sentence_length_variance as sentenceLengthVariance,
        scroll_back_count as scrollBackCount,
        question_reread_count as questionRereadCount,
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

    // Session metadata (slice-3 follow-ups)
    const metadata = db.prepare(`
      SELECT hour_typicality, deletion_curve_type, burst_trajectory_shape,
             inter_burst_interval_mean_ms, inter_burst_interval_std_ms,
             deletion_during_burst_count, deletion_between_burst_count
      FROM tb_session_metadata
      WHERE question_id = ?
      ORDER BY session_metadata_id DESC LIMIT 1
    `).get(entryState.question_id) as any;

    // Burst sequence (for replay timeline scrubber)
    const burstSequence = db.prepare(`
      SELECT burst_index, burst_char_count, burst_duration_ms, burst_start_offset_ms
      FROM tb_burst_sequences
      WHERE question_id = ?
      ORDER BY burst_index ASC
    `).all(entryState.question_id) as any[];

    // Replay availability + keystroke stream
    const replayRow = db.prepare(`
      SELECT total_events, session_duration_ms, keystroke_stream_json FROM tb_session_events
      WHERE question_id = ? ORDER BY session_event_id DESC LIMIT 1
    `).get(entryState.question_id) as any;

    // Compute dynamical signals from keystroke stream if available
    let dynamicalSignals = null;
    if (replayRow?.keystroke_stream_json) {
      try {
        const stream: KeystrokeEvent[] = JSON.parse(replayRow.keystroke_stream_json);
        if (stream.length > 0) {
          dynamicalSignals = computeDynamicalSignals(stream);
        }
      } catch { /* malformed JSON — skip */ }
    }

    // Navigation
    const prev = db.prepare(`
      SELECT response_id FROM tb_entry_states
      WHERE entry_state_id < (SELECT entry_state_id FROM tb_entry_states WHERE response_id = ?)
      ORDER BY entry_state_id DESC LIMIT 1
    `).get(responseId) as any;

    const next = db.prepare(`
      SELECT response_id FROM tb_entry_states
      WHERE entry_state_id > (SELECT entry_state_id FROM tb_entry_states WHERE response_id = ?)
      ORDER BY entry_state_id ASC LIMIT 1
    `).get(responseId) as any;

    return new Response(JSON.stringify({
      entryState,
      semanticState,
      sessionSummary,
      metadata,
      burstSequence,
      dynamicalSignals,
      replay: replayRow ? {
        available: true,
        totalEvents: replayRow.total_events,
        durationMs: replayRow.session_duration_ms,
      } : { available: false },
      navigation: {
        prev: prev?.response_id ?? null,
        next: next?.response_id ?? null,
      },
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Observatory entry error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Failed to load entry', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
