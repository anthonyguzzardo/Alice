import sql from './libDbPool.ts';
import type { TxSql } from './libDbPool.ts';
import { localDateStr } from './utlDate.ts';

// Re-export sql for callers that import it directly
export { default as sql } from './libDbPool.ts';
export type { TxSql } from './libDbPool.ts';

// ----------------------------------------------------------------------------
// DATE OVERRIDE (for simulation -- production never calls this)
// ----------------------------------------------------------------------------
// When set, save functions use this instead of CURRENT_TIMESTAMP.
// This fixes the wall-clock timestamp bug where PG's CURRENT_TIMESTAMP
// ignores JavaScript's monkey-patched Date during simulation.
let _dateOverride: string | null = null;

/** Set a date override for all save functions. Pass null to clear. */
export function setDateOverride(dateStr: string | null): void {
  _dateOverride = dateStr;
}

/** Get the current datetime string -- override if set, otherwise ISO now. */
function nowStr(): string {
  return _dateOverride ? `${_dateOverride}T12:00:00` : new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ----------------------------------------------------------------------------
// Schema is applied externally via scripts/create-postgres-schema.sql.
// No DDL or migration blocks here.
// ----------------------------------------------------------------------------

// @region queries -- getTodaysQuestion, getTodaysResponse, saveResponse, scheduleQuestion, getAllResponses, getLatestReflection, saveReflection, logInteractionEvent, hasQuestionForDate, countScheduledSeedQuestions
// ----------------------------------------------------------------------------
// QUERIES
// ----------------------------------------------------------------------------

export async function getTodaysQuestion(): Promise<{ question_id: number; text: string } | null> {
  const today = localDateStr();
  const rows = await sql`SELECT question_id, text FROM tb_questions WHERE scheduled_for = ${today}`;
  return (rows[0] as { question_id: number; text: string }) ?? null;
}

export async function getTodaysResponse(): Promise<{ response_id: number; text: string } | null> {
  const today = localDateStr();
  const rows = await sql`
    SELECT r.response_id, r.text
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.scheduled_for = ${today}
  `;
  return (rows[0] as { response_id: number; text: string }) ?? null;
}

export async function saveResponse(
  questionId: number,
  text: string,
  tx?: TxSql,
  attestation?: { boundaryVersion: string; codePathsRef: string; commitHash: string },
): Promise<number> {
  const q = tx ?? sql;
  const bv = attestation?.boundaryVersion ?? 'v1';
  const ref = attestation?.codePathsRef ?? 'docs/contamination-boundary-v1.md';
  const hash = attestation?.commitHash ?? 'pre-attestation';
  const [row] = await q`
    INSERT INTO tb_responses (question_id, text, contamination_boundary_version, audited_code_paths_ref, code_commit_hash, dttm_created_utc)
    VALUES (${questionId}, ${text}, ${bv}, ${ref}, ${hash}, ${nowStr()})
    RETURNING response_id
  `;
  return row.response_id;
}

export async function scheduleQuestion(text: string, date: string, source: 'seed' | 'generated' | 'calibration' = 'seed'): Promise<void> {
  const sourceId = source === 'generated' ? 2 : source === 'calibration' ? 3 : 1;
  await sql`
    INSERT INTO tb_questions (text, question_source_id, scheduled_for)
    VALUES (${text}, ${sourceId}, ${date})
    ON CONFLICT (scheduled_for) DO NOTHING
  `;
}

export async function getAllResponses(): Promise<Array<{ question: string; response: string; date: string }>> {
  return await sql`
    SELECT q.text AS question, r.text AS response, q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY q.scheduled_for ASC
  ` as Array<{ question: string; response: string; date: string }>;
}

export async function getLatestReflection(): Promise<{ text: string; dttm_created_utc: string } | null> {
  const rows = await sql`
    SELECT text, dttm_created_utc FROM tb_reflections ORDER BY dttm_created_utc DESC LIMIT 1
  `;
  return (rows[0] as { text: string; dttm_created_utc: string }) ?? null;
}

export async function saveReflection(text: string, type: 'weekly' | 'monthly' = 'weekly', coverageThroughResponseId?: number): Promise<number> {
  const typeId = type === 'monthly' ? 2 : 1;
  const [row] = await sql`
    INSERT INTO tb_reflections (text, reflection_type_id, coverage_through_response_id, dttm_created_utc)
    VALUES (${text}, ${typeId}, ${coverageThroughResponseId ?? null}, ${nowStr()})
    RETURNING reflection_id
  `;
  return row.reflection_id;
}

export async function logInteractionEvent(questionId: number, eventType: string, metadata?: string | Record<string, unknown>): Promise<void> {
  const typeRows = await sql`
    SELECT interaction_event_type_id FROM te_interaction_event_type WHERE enum_code = ${eventType}
  `;
  const typeRow = typeRows[0] as { interaction_event_type_id: number } | undefined;
  if (!typeRow) return;
  await sql`
    INSERT INTO tb_interaction_events (question_id, interaction_event_type_id, metadata)
    VALUES (${questionId}, ${typeRow.interaction_event_type_id}, ${metadata ?? null})
  `;
}

export async function hasQuestionForDate(date: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM tb_questions WHERE scheduled_for = ${date}`;
  return rows.length > 0;
}

export async function countScheduledSeedQuestions(): Promise<number> {
  const [row] = await sql`
    SELECT COUNT(*)::int AS c FROM tb_questions
    WHERE question_source_id = 1 AND scheduled_for IS NOT NULL
  `;
  return (row as { c: number }).c;
}

// @region sessions -- SessionSummaryInput, saveSessionSummary, getSessionSummary, getAllSessionSummaries, getSessionSummariesForQuestions, saveSessionEvents, getSessionEvents, updateDeletionEvents, saveSessionMetadata, getSessionMetadata, getAllSessionMetadata, getMetadataQuestionIdsAlreadyComputed
// ----------------------------------------------------------------------------
// SESSION SUMMARIES
// ----------------------------------------------------------------------------

export interface SessionSummaryInput {
  questionId: number;
  firstKeystrokeMs: number | null;
  totalDurationMs: number | null;
  totalCharsTyped: number;
  finalCharCount: number;
  commitmentRatio: number | null;
  pauseCount: number;
  totalPauseMs: number;
  deletionCount: number;
  largestDeletion: number;
  totalCharsDeleted: number;
  tabAwayCount: number;
  totalTabAwayMs: number;
  wordCount: number;
  sentenceCount: number;
  // Enriched: deletion decomposition
  smallDeletionCount: number | null;
  largeDeletionCount: number | null;
  largeDeletionChars: number | null;
  firstHalfDeletionChars: number | null;
  secondHalfDeletionChars: number | null;
  // Enriched: production fluency
  activeTypingMs: number | null;
  charsPerMinute: number | null;
  pBurstCount: number | null;
  avgPBurstLength: number | null;
  // Linguistic: NRC emotion densities + Pennebaker categories
  nrcAngerDensity: number | null;
  nrcFearDensity: number | null;
  nrcJoyDensity: number | null;
  nrcSadnessDensity: number | null;
  nrcTrustDensity: number | null;
  nrcAnticipationDensity: number | null;
  cognitiveDensity: number | null;
  hedgingDensity: number | null;
  firstPersonDensity: number | null;
  // Keystroke dynamics (Epp et al. 2011; Leijten & Van Waes 2013)
  interKeyIntervalMean: number | null;
  interKeyIntervalStd: number | null;
  revisionChainCount: number | null;
  revisionChainAvgLength: number | null;
  // Hold time + flight time decomposition (Kim et al. 2024)
  holdTimeMean: number | null;
  holdTimeStd: number | null;
  flightTimeMean: number | null;
  flightTimeStd: number | null;
  // Keystroke entropy (Ajilore et al. 2025, BiAffect)
  keystrokeEntropy: number | null;
  // Lexical diversity (McCarthy & Jarvis 2010)
  mattr: number | null;
  // Sentence metrics
  avgSentenceLength: number | null;
  sentenceLengthVariance: number | null;
  // Session metadata (Czerwinski et al. 2004)
  scrollBackCount: number | null;
  questionRereadCount: number | null;
  // Cursor behavior + writing process (Phase 1 expansion)
  confirmationLatencyMs: number | null;
  pasteCount: number | null;
  pasteCharsTotal: number | null;
  dropCount: number | null;
  readBackCount: number | null;
  leadingEdgeRatio: number | null;
  contextualRevisionCount: number | null;
  preContextualRevisionCount: number | null;
  consideredAndKeptCount: number | null;
  holdTimeMeanLeft: number | null;
  holdTimeMeanRight: number | null;
  holdTimeStdLeft: number | null;
  holdTimeStdRight: number | null;
  holdTimeCV: number | null;
  negativeFlightTimeCount: number | null;
  ikiSkewness: number | null;
  ikiKurtosis: number | null;
  errorDetectionLatencyMean: number | null;
  terminalVelocity: number | null;
  // Mouse/cursor trajectory (BioCatch, Phase 2 expansion)
  cursorDistanceDuringPauses: number | null;
  cursorFidgetRatio: number | null;
  cursorStillnessDuringPauses: number | null;
  driftToSubmitCount: number | null;
  cursorPauseSampleCount: number | null;
  // Precorrection/postcorrection latency (Springer 2021)
  deletionExecutionSpeedMean: number | null;
  postcorrectionLatencyMean: number | null;
  // Revision distance (ScriptLog)
  meanRevisionDistance: number | null;
  maxRevisionDistance: number | null;
  // Punctuation key latency (Plank 2016)
  punctuationFlightMean: number | null;
  punctuationLetterRatio: number | null;
  // Context
  deviceType: string | null;
  userAgent: string | null;
  hourOfDay: number | null;
  dayOfWeek: number | null;
}

export async function saveSessionSummary(s: SessionSummaryInput, tx?: TxSql): Promise<void> {
  const q = tx ?? sql;
  await q`
    INSERT INTO tb_session_summaries (
       question_id, first_keystroke_ms, total_duration_ms,
       total_chars_typed, final_char_count, commitment_ratio,
       pause_count, total_pause_ms, deletion_count, largest_deletion,
       total_chars_deleted, tab_away_count, total_tab_away_ms,
       word_count, sentence_count,
       small_deletion_count, large_deletion_count, large_deletion_chars,
       first_half_deletion_chars, second_half_deletion_chars,
       active_typing_ms, chars_per_minute, p_burst_count, avg_p_burst_length,
       nrc_anger_density, nrc_fear_density, nrc_joy_density,
       nrc_sadness_density, nrc_trust_density, nrc_anticipation_density,
       cognitive_density, hedging_density, first_person_density,
       inter_key_interval_mean, inter_key_interval_std,
       revision_chain_count, revision_chain_avg_length,
       hold_time_mean, hold_time_std, flight_time_mean, flight_time_std,
       keystroke_entropy,
       mattr, avg_sentence_length, sentence_length_variance,
       scroll_back_count, question_reread_count,
       confirmation_latency_ms, paste_count, paste_chars_total, drop_count,
       read_back_count, leading_edge_ratio,
       contextual_revision_count, pre_contextual_revision_count,
       considered_and_kept_count,
       hold_time_mean_left, hold_time_mean_right,
       hold_time_std_left, hold_time_std_right, hold_time_cv,
       negative_flight_time_count,
       iki_skewness, iki_kurtosis,
       error_detection_latency_mean, terminal_velocity,
       cursor_distance_during_pauses, cursor_fidget_ratio,
       cursor_stillness_during_pauses, drift_to_submit_count,
       cursor_pause_sample_count,
       deletion_execution_speed_mean, postcorrection_latency_mean,
       mean_revision_distance, max_revision_distance,
       punctuation_flight_mean, punctuation_letter_ratio,
       device_type, user_agent, hour_of_day, day_of_week
    ) VALUES (
      ${s.questionId}, ${s.firstKeystrokeMs}, ${s.totalDurationMs},
      ${s.totalCharsTyped}, ${s.finalCharCount}, ${s.commitmentRatio},
      ${s.pauseCount}, ${s.totalPauseMs}, ${s.deletionCount}, ${s.largestDeletion},
      ${s.totalCharsDeleted}, ${s.tabAwayCount}, ${s.totalTabAwayMs},
      ${s.wordCount}, ${s.sentenceCount},
      ${s.smallDeletionCount}, ${s.largeDeletionCount}, ${s.largeDeletionChars},
      ${s.firstHalfDeletionChars}, ${s.secondHalfDeletionChars},
      ${s.activeTypingMs}, ${s.charsPerMinute}, ${s.pBurstCount}, ${s.avgPBurstLength},
      ${s.nrcAngerDensity}, ${s.nrcFearDensity}, ${s.nrcJoyDensity},
      ${s.nrcSadnessDensity}, ${s.nrcTrustDensity}, ${s.nrcAnticipationDensity},
      ${s.cognitiveDensity}, ${s.hedgingDensity}, ${s.firstPersonDensity},
      ${s.interKeyIntervalMean}, ${s.interKeyIntervalStd},
      ${s.revisionChainCount}, ${s.revisionChainAvgLength},
      ${s.holdTimeMean}, ${s.holdTimeStd}, ${s.flightTimeMean}, ${s.flightTimeStd},
      ${s.keystrokeEntropy},
      ${s.mattr}, ${s.avgSentenceLength}, ${s.sentenceLengthVariance},
      ${s.scrollBackCount}, ${s.questionRereadCount},
      ${s.confirmationLatencyMs}, ${s.pasteCount}, ${s.pasteCharsTotal}, ${s.dropCount},
      ${s.readBackCount}, ${s.leadingEdgeRatio},
      ${s.contextualRevisionCount}, ${s.preContextualRevisionCount},
      ${s.consideredAndKeptCount},
      ${s.holdTimeMeanLeft}, ${s.holdTimeMeanRight},
      ${s.holdTimeStdLeft}, ${s.holdTimeStdRight}, ${s.holdTimeCV},
      ${s.negativeFlightTimeCount},
      ${s.ikiSkewness}, ${s.ikiKurtosis},
      ${s.errorDetectionLatencyMean}, ${s.terminalVelocity},
      ${s.cursorDistanceDuringPauses}, ${s.cursorFidgetRatio},
      ${s.cursorStillnessDuringPauses}, ${s.driftToSubmitCount},
      ${s.cursorPauseSampleCount},
      ${s.deletionExecutionSpeedMean}, ${s.postcorrectionLatencyMean},
      ${s.meanRevisionDistance}, ${s.maxRevisionDistance},
      ${s.punctuationFlightMean}, ${s.punctuationLetterRatio},
      ${s.deviceType}, ${s.userAgent}, ${s.hourOfDay}, ${s.dayOfWeek}
    )
    ON CONFLICT (question_id) DO NOTHING
  `;
}

// @region bursts -- saveBurstSequence, getBurstSequence, saveRburstSequence, getRburstSequence
// ----------------------------------------------------------------------------
// BURST SEQUENCES
// ----------------------------------------------------------------------------

export interface BurstEntry {
  chars: number;
  startOffsetMs: number;
  durationMs: number;
}

export async function saveBurstSequence(questionId: number, bursts: BurstEntry[], tx?: TxSql): Promise<void> {
  if (tx) {
    // Already in a transaction; use the handle directly
    for (let i = 0; i < bursts.length; i++) {
      await tx`
        INSERT INTO tb_burst_sequences (question_id, burst_index, burst_char_count, burst_duration_ms, burst_start_offset_ms)
        VALUES (${questionId}, ${i}, ${bursts[i].chars}, ${bursts[i].durationMs}, ${bursts[i].startOffsetMs})
      `;
    }
  } else {
    await sql.begin(async (sql) => {
      for (let i = 0; i < bursts.length; i++) {
        await sql`
          INSERT INTO tb_burst_sequences (question_id, burst_index, burst_char_count, burst_duration_ms, burst_start_offset_ms)
          VALUES (${questionId}, ${i}, ${bursts[i].chars}, ${bursts[i].durationMs}, ${bursts[i].startOffsetMs})
        `;
      }
    });
  }
}

export async function getBurstSequence(questionId: number, tx?: TxSql): Promise<Array<BurstEntry & { burstIndex: number }>> {
  const q = tx ?? sql;
  return await q`
    SELECT burst_index AS "burstIndex", burst_char_count AS chars,
           burst_duration_ms AS "durationMs", burst_start_offset_ms AS "startOffsetMs"
    FROM tb_burst_sequences
    WHERE question_id = ${questionId}
    ORDER BY burst_index ASC
  ` as Array<BurstEntry & { burstIndex: number }>;
}

// ----------------------------------------------------------------------------
// R-BURST SEQUENCES (parallel to P-burst sequences)
// ----------------------------------------------------------------------------

export interface RBurstEntry {
  deletedCharCount: number;
  totalCharCount: number;
  durationMs: number;
  startOffsetMs: number;
  isLeadingEdge: boolean;
}

export async function saveRburstSequence(questionId: number, rbursts: RBurstEntry[], tx?: TxSql): Promise<void> {
  if (rbursts.length === 0) return;
  if (tx) {
    for (let i = 0; i < rbursts.length; i++) {
      await tx`
        INSERT INTO tb_rburst_sequences (question_id, burst_index, deleted_char_count, total_char_count, burst_duration_ms, burst_start_offset_ms, is_leading_edge)
        VALUES (${questionId}, ${i}, ${rbursts[i].deletedCharCount}, ${rbursts[i].totalCharCount}, ${rbursts[i].durationMs}, ${rbursts[i].startOffsetMs}, ${rbursts[i].isLeadingEdge})
      `;
    }
  } else {
    await sql.begin(async (sql) => {
      for (let i = 0; i < rbursts.length; i++) {
        await sql`
          INSERT INTO tb_rburst_sequences (question_id, burst_index, deleted_char_count, total_char_count, burst_duration_ms, burst_start_offset_ms, is_leading_edge)
          VALUES (${questionId}, ${i}, ${rbursts[i].deletedCharCount}, ${rbursts[i].totalCharCount}, ${rbursts[i].durationMs}, ${rbursts[i].startOffsetMs}, ${rbursts[i].isLeadingEdge})
        `;
      }
    });
  }
}

export async function getRburstSequence(questionId: number, tx?: TxSql): Promise<Array<RBurstEntry & { burstIndex: number }>> {
  const q = tx ?? sql;
  return await q`
    SELECT burst_index AS "burstIndex",
           deleted_char_count AS "deletedCharCount",
           total_char_count AS "totalCharCount",
           burst_duration_ms AS "durationMs",
           burst_start_offset_ms AS "startOffsetMs",
           is_leading_edge AS "isLeadingEdge"
    FROM tb_rburst_sequences
    WHERE question_id = ${questionId}
    ORDER BY burst_index ASC
  ` as Array<RBurstEntry & { burstIndex: number }>;
}

// ----------------------------------------------------------------------------
// SESSION METADATA (slice-3 follow-up signals)
// ----------------------------------------------------------------------------

export interface SessionMetadataRow {
  session_metadata_id: number;
  question_id: number;
  hour_typicality: number | null;
  deletion_curve_type: string | null;
  burst_trajectory_shape: string | null;
  rburst_trajectory_shape: string | null;
  inter_burst_interval_mean_ms: number | null;
  inter_burst_interval_std_ms: number | null;
  deletion_during_burst_count: number | null;
  deletion_between_burst_count: number | null;
}

export async function saveSessionMetadata(row: Omit<SessionMetadataRow, 'session_metadata_id'>, tx?: TxSql): Promise<number> {
  const q = tx ?? sql;
  const [result] = await q`
    INSERT INTO tb_session_metadata (
       question_id, hour_typicality, deletion_curve_type, burst_trajectory_shape,
       rburst_trajectory_shape,
       inter_burst_interval_mean_ms, inter_burst_interval_std_ms,
       deletion_during_burst_count, deletion_between_burst_count
    ) VALUES (
      ${row.question_id}, ${row.hour_typicality}, ${row.deletion_curve_type}, ${row.burst_trajectory_shape},
      ${row.rburst_trajectory_shape},
      ${row.inter_burst_interval_mean_ms}, ${row.inter_burst_interval_std_ms},
      ${row.deletion_during_burst_count}, ${row.deletion_between_burst_count}
    )
    RETURNING session_metadata_id
  `;
  return result.session_metadata_id;
}

export async function getSessionMetadata(questionId: number): Promise<SessionMetadataRow | null> {
  const rows = await sql`
    SELECT * FROM tb_session_metadata WHERE question_id = ${questionId} ORDER BY session_metadata_id DESC LIMIT 1
  `;
  return (rows[0] as SessionMetadataRow) ?? null;
}

export async function getAllSessionMetadata(): Promise<SessionMetadataRow[]> {
  return await sql`
    SELECT * FROM tb_session_metadata ORDER BY session_metadata_id ASC
  ` as SessionMetadataRow[];
}

export async function getMetadataQuestionIdsAlreadyComputed(): Promise<Set<number>> {
  const rows = await sql`SELECT DISTINCT question_id FROM tb_session_metadata` as Array<{ question_id: number }>;
  return new Set(rows.map(r => r.question_id));
}

// ----------------------------------------------------------------------------
// CALIBRATION BASELINES HISTORY (drift substrate)
// ----------------------------------------------------------------------------

export interface CalibrationHistoryRow {
  calibration_history_id: number;
  calibration_session_count: number;
  device_type: string | null;
  avg_first_keystroke_ms: number | null;
  avg_commitment_ratio: number | null;
  avg_duration_ms: number | null;
  avg_pause_count: number | null;
  avg_deletion_count: number | null;
  avg_chars_per_minute: number | null;
  avg_p_burst_length: number | null;
  avg_small_deletion_count: number | null;
  avg_large_deletion_count: number | null;
  avg_iki_mean: number | null;
  avg_hold_time_mean: number | null;
  avg_flight_time_mean: number | null;
  drift_magnitude: number | null;
}

export async function saveCalibrationBaselineSnapshot(row: Omit<CalibrationHistoryRow, 'calibration_history_id'>): Promise<number> {
  const [result] = await sql`
    INSERT INTO tb_calibration_baselines_history (
       calibration_session_count, device_type,
       avg_first_keystroke_ms, avg_commitment_ratio, avg_duration_ms,
       avg_pause_count, avg_deletion_count, avg_chars_per_minute,
       avg_p_burst_length, avg_small_deletion_count, avg_large_deletion_count,
       avg_iki_mean, avg_hold_time_mean, avg_flight_time_mean,
       drift_magnitude
    ) VALUES (
      ${row.calibration_session_count}, ${row.device_type},
      ${row.avg_first_keystroke_ms}, ${row.avg_commitment_ratio}, ${row.avg_duration_ms},
      ${row.avg_pause_count}, ${row.avg_deletion_count}, ${row.avg_chars_per_minute},
      ${row.avg_p_burst_length}, ${row.avg_small_deletion_count}, ${row.avg_large_deletion_count},
      ${row.avg_iki_mean}, ${row.avg_hold_time_mean}, ${row.avg_flight_time_mean},
      ${row.drift_magnitude}
    )
    RETURNING calibration_history_id
  `;
  return result.calibration_history_id;
}

export async function getCalibrationHistory(): Promise<CalibrationHistoryRow[]> {
  return await sql`
    SELECT * FROM tb_calibration_baselines_history ORDER BY calibration_history_id ASC
  ` as CalibrationHistoryRow[];
}

export async function getLatestCalibrationSnapshot(deviceType?: string | null): Promise<CalibrationHistoryRow | null> {
  if (deviceType) {
    const rows = await sql`
      SELECT * FROM tb_calibration_baselines_history WHERE device_type = ${deviceType}
      ORDER BY calibration_history_id DESC LIMIT 1
    `;
    return (rows[0] as CalibrationHistoryRow) ?? null;
  }
  const rows = await sql`
    SELECT * FROM tb_calibration_baselines_history WHERE device_type IS NULL
    ORDER BY calibration_history_id DESC LIMIT 1
  `;
  return (rows[0] as CalibrationHistoryRow) ?? null;
}

// ----------------------------------------------------------------------------
// SESSION EVENTS (per-keystroke event log for playback)
// ----------------------------------------------------------------------------

export interface SessionEventsRow {
  session_event_id: number;
  question_id: number;
  event_log_json: string;
  total_events: number;
  session_duration_ms: number;
  keystroke_stream_json?: string | null;
  total_input_events?: number | null;
  decimation_count?: number | null;
}

export async function saveSessionEvents(row: Omit<SessionEventsRow, 'session_event_id'>, tx?: TxSql): Promise<number> {
  const q = tx ?? sql;
  const [result] = await q`
    INSERT INTO tb_session_events (question_id, event_log_json, total_events, session_duration_ms, keystroke_stream_json, total_input_events, decimation_count)
    VALUES (${row.question_id}, ${row.event_log_json}, ${row.total_events}, ${row.session_duration_ms}, ${row.keystroke_stream_json ?? null}, ${row.total_input_events ?? null}, ${row.decimation_count ?? null})
    RETURNING session_event_id
  `;
  return result.session_event_id;
}

export async function getSessionEvents(questionId: number): Promise<SessionEventsRow | null> {
  const rows = await sql`
    SELECT * FROM tb_session_events WHERE question_id = ${questionId} ORDER BY session_event_id DESC LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  // JSONB columns auto-parsed by postgres driver; callers expect strings
  return {
    session_event_id: row.session_event_id as number,
    question_id: row.question_id as number,
    event_log_json: typeof row.event_log_json === 'object' ? JSON.stringify(row.event_log_json) : row.event_log_json as string,
    total_events: row.total_events as number,
    session_duration_ms: row.session_duration_ms as number,
    keystroke_stream_json: row.keystroke_stream_json == null ? null : (typeof row.keystroke_stream_json === 'object' ? JSON.stringify(row.keystroke_stream_json) : row.keystroke_stream_json as string),
    total_input_events: row.total_input_events as number | null,
    decimation_count: row.decimation_count as number | null,
  };
}

// Save deletion events JSON onto the session summary row
export async function updateDeletionEvents(questionId: number, deletionEventsJson: string, tx?: TxSql): Promise<void> {
  const q = tx ?? sql;
  await q`
    UPDATE tb_session_summaries SET deletion_events_json = ${deletionEventsJson} WHERE question_id = ${questionId}
  `;
}

// Single source of truth for session summary SELECT columns.
// All queries that return SessionSummaryInput MUST use this constant.
// Uses s. prefix so it works in multi-table JOINs. Table alias must be `s`.
const SESSION_SUMMARY_COLS = `
  s.question_id AS "questionId", s.first_keystroke_ms AS "firstKeystrokeMs",
  s.total_duration_ms AS "totalDurationMs", s.total_chars_typed AS "totalCharsTyped",
  s.final_char_count AS "finalCharCount", s.commitment_ratio AS "commitmentRatio",
  s.pause_count AS "pauseCount", s.total_pause_ms AS "totalPauseMs",
  s.deletion_count AS "deletionCount", s.largest_deletion AS "largestDeletion",
  s.total_chars_deleted AS "totalCharsDeleted", s.tab_away_count AS "tabAwayCount",
  s.total_tab_away_ms AS "totalTabAwayMs", s.word_count AS "wordCount",
  s.sentence_count AS "sentenceCount",
  s.small_deletion_count AS "smallDeletionCount", s.large_deletion_count AS "largeDeletionCount",
  s.large_deletion_chars AS "largeDeletionChars",
  s.first_half_deletion_chars AS "firstHalfDeletionChars",
  s.second_half_deletion_chars AS "secondHalfDeletionChars",
  s.active_typing_ms AS "activeTypingMs", s.chars_per_minute AS "charsPerMinute",
  s.p_burst_count AS "pBurstCount", s.avg_p_burst_length AS "avgPBurstLength",
  s.nrc_anger_density AS "nrcAngerDensity", s.nrc_fear_density AS "nrcFearDensity",
  s.nrc_joy_density AS "nrcJoyDensity", s.nrc_sadness_density AS "nrcSadnessDensity",
  s.nrc_trust_density AS "nrcTrustDensity", s.nrc_anticipation_density AS "nrcAnticipationDensity",
  s.cognitive_density AS "cognitiveDensity", s.hedging_density AS "hedgingDensity",
  s.first_person_density AS "firstPersonDensity",
  s.inter_key_interval_mean AS "interKeyIntervalMean",
  s.inter_key_interval_std AS "interKeyIntervalStd",
  s.revision_chain_count AS "revisionChainCount",
  s.revision_chain_avg_length AS "revisionChainAvgLength",
  s.hold_time_mean AS "holdTimeMean", s.hold_time_std AS "holdTimeStd",
  s.flight_time_mean AS "flightTimeMean", s.flight_time_std AS "flightTimeStd",
  s.keystroke_entropy AS "keystrokeEntropy",
  s.mattr, s.avg_sentence_length AS "avgSentenceLength",
  s.sentence_length_variance AS "sentenceLengthVariance",
  s.scroll_back_count AS "scrollBackCount",
  s.question_reread_count AS "questionRereadCount",
  s.confirmation_latency_ms AS "confirmationLatencyMs",
  s.paste_count AS "pasteCount", s.paste_chars_total AS "pasteCharsTotal",
  s.drop_count AS "dropCount",
  s.read_back_count AS "readBackCount", s.leading_edge_ratio AS "leadingEdgeRatio",
  s.contextual_revision_count AS "contextualRevisionCount",
  s.pre_contextual_revision_count AS "preContextualRevisionCount",
  s.considered_and_kept_count AS "consideredAndKeptCount",
  s.hold_time_mean_left AS "holdTimeMeanLeft", s.hold_time_mean_right AS "holdTimeMeanRight",
  s.hold_time_std_left AS "holdTimeStdLeft", s.hold_time_std_right AS "holdTimeStdRight",
  s.hold_time_cv AS "holdTimeCV",
  s.negative_flight_time_count AS "negativeFlightTimeCount",
  s.iki_skewness AS "ikiSkewness", s.iki_kurtosis AS "ikiKurtosis",
  s.error_detection_latency_mean AS "errorDetectionLatencyMean",
  s.terminal_velocity AS "terminalVelocity",
  s.cursor_distance_during_pauses AS "cursorDistanceDuringPauses",
  s.cursor_fidget_ratio AS "cursorFidgetRatio",
  s.cursor_stillness_during_pauses AS "cursorStillnessDuringPauses",
  s.drift_to_submit_count AS "driftToSubmitCount",
  s.cursor_pause_sample_count AS "cursorPauseSampleCount",
  s.deletion_execution_speed_mean AS "deletionExecutionSpeedMean",
  s.postcorrection_latency_mean AS "postcorrectionLatencyMean",
  s.mean_revision_distance AS "meanRevisionDistance",
  s.max_revision_distance AS "maxRevisionDistance",
  s.punctuation_flight_mean AS "punctuationFlightMean",
  s.punctuation_letter_ratio AS "punctuationLetterRatio",
  s.device_type AS "deviceType", s.user_agent AS "userAgent",
  s.hour_of_day AS "hourOfDay", s.day_of_week AS "dayOfWeek"
`;

export async function getSessionSummary(questionId: number): Promise<SessionSummaryInput | null> {
  const rows = await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS} FROM tb_session_summaries s WHERE s.question_id = $1`,
    [questionId]
  );
  return (rows[0] as unknown as SessionSummaryInput) ?? null;
}

export async function getAllSessionSummaries(): Promise<Array<SessionSummaryInput & { date: string }>> {
  return await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS}, q.scheduled_for AS date
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    ORDER BY q.scheduled_for ASC`
  ) as Array<SessionSummaryInput & { date: string }>;
}

// @region calibration -- getCalibrationSessionsWithText, isCalibrationQuestion, saveCalibrationSession, getUsedCalibrationPrompts, getCalibrationPromptsByRecency, saveCalibrationBaselineSnapshot, getCalibrationHistory, getLatestCalibrationSnapshot, saveQuestionFeedback, getAllQuestionFeedback

export async function getCalibrationSessionsWithText(): Promise<Array<SessionSummaryInput & { date: string; responseText: string }>> {
  return await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS}, q.scheduled_for AS date, r.text AS "responseText"
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    JOIN tb_responses r ON q.question_id = r.question_id
    WHERE q.question_source_id = 3
      AND s.word_count >= 10
    ORDER BY q.question_id ASC`
  ) as Array<SessionSummaryInput & { date: string; responseText: string }>;
}

export async function isCalibrationQuestion(questionId: number): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM tb_questions WHERE question_id = ${questionId} AND question_source_id = 3
  `;
  return rows.length > 0;
}

export async function getResponseCount(): Promise<number> {
  const [row] = await sql`SELECT COUNT(*)::int AS count FROM tb_responses`;
  return (row as { count: number }).count;
}

export async function getUsedCalibrationPrompts(): Promise<string[]> {
  const rows = await sql`SELECT text FROM tb_questions WHERE question_source_id = 3` as Array<{ text: string }>;
  return rows.map(r => r.text);
}

/** Return calibration prompt texts ordered by last use, oldest first. */
export async function getCalibrationPromptsByRecency(): Promise<string[]> {
  const rows = await sql`
    SELECT sub.text FROM (
      SELECT text, MAX(dttm_created_utc) AS last_used
      FROM tb_questions
      WHERE question_source_id = 3
      GROUP BY text
    ) sub
    ORDER BY sub.last_used ASC
  ` as Array<{ text: string }>;
  return rows.map(r => r.text);
}

export async function saveCalibrationSession(
  promptText: string,
  responseText: string,
  summary: SessionSummaryInput,
  attestation?: { boundaryVersion: string; codePathsRef: string; commitHash: string },
): Promise<number> {
  const bv = attestation?.boundaryVersion ?? 'v1';
  const ref = attestation?.codePathsRef ?? 'docs/contamination-boundary-v1.md';
  const hash = attestation?.commitHash ?? 'pre-attestation';
  return await sql.begin(async (tx) => {
    const [qRow] = await tx`
      INSERT INTO tb_questions (text, question_source_id)
      VALUES (${promptText}, 3)
      RETURNING question_id
    `;
    const questionId = qRow.question_id as number;

    await tx`
      INSERT INTO tb_responses (question_id, text, contamination_boundary_version, audited_code_paths_ref, code_commit_hash)
      VALUES (${questionId}, ${responseText}, ${bv}, ${ref}, ${hash})
    `;

    await saveSessionSummary({ ...summary, questionId }, tx);

    return questionId;
  });
}

// Known state: question_ids 42, 63, 64 are calibration sessions (source_id=3)
// with responses but no session summaries or events. They predate the
// calibration event-logging pipeline (2026-04-14, 2026-04-17). Not orphans
// from a transaction bug. Response text is real; left in place intentionally.

// ----------------------------------------------------------------------------
// QUESTION FEEDBACK
// ----------------------------------------------------------------------------

export async function saveQuestionFeedback(questionId: number, landed: boolean): Promise<void> {
  await sql`
    INSERT INTO tb_question_feedback (question_id, landed)
    VALUES (${questionId}, ${landed})
    ON CONFLICT (question_id) DO NOTHING
  `;
}

export async function getAllQuestionFeedback(): Promise<Array<{ date: string; landed: boolean }>> {
  const rows = await sql`
    SELECT q.scheduled_for AS date, f.landed
    FROM tb_question_feedback f
    JOIN tb_questions q ON f.question_id = q.question_id
    ORDER BY q.scheduled_for ASC
  `;
  return rows.map((r: Record<string, unknown>) => ({ date: r.date as string, landed: !!r.landed }));
}

// ----------------------------------------------------------------------------
// @region retrieval -- getRecentResponses, getResponsesSince, getResponsesSinceId, getAllReflections, getLatestReflectionWithCoverage, getRecentFeedback, getSessionSummariesForQuestions, getMaxResponseId, insertEmbeddingMeta, isRecordEmbedded, getUnembeddedResponses, searchVecEmbeddings, getActiveEmbeddingModelVersionId, savePromptTrace
// SCOPED RETRIEVAL (for RAG-augmented prompts)
// ----------------------------------------------------------------------------

export async function getRecentResponses(limit: number): Promise<Array<{
  response_id: number; question_id: number; question: string; response: string; date: string;
}>> {
  return await sql`
    SELECT r.response_id, q.question_id, q.text AS question, r.text AS response, q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY q.scheduled_for DESC
    LIMIT ${limit}
  ` as Array<{
    response_id: number; question_id: number; question: string; response: string; date: string;
  }>;
}

export async function getResponsesSince(sinceDate: string): Promise<Array<{
  response_id: number; question_id: number; question: string; response: string; date: string;
}>> {
  return await sql`
    SELECT r.response_id, q.question_id, q.text AS question, r.text AS response, q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.scheduled_for > ${sinceDate}
    ORDER BY q.scheduled_for ASC
  ` as Array<{
    response_id: number; question_id: number; question: string; response: string; date: string;
  }>;
}

export async function getResponsesSinceId(sinceResponseId: number): Promise<Array<{
  response_id: number; question_id: number; question: string; response: string; date: string;
}>> {
  return await sql`
    SELECT r.response_id, q.question_id, q.text AS question, r.text AS response, q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE r.response_id > ${sinceResponseId}
    ORDER BY q.scheduled_for ASC
  ` as Array<{
    response_id: number; question_id: number; question: string; response: string; date: string;
  }>;
}

export async function getAllReflections(): Promise<Array<{
  reflection_id: number; text: string; coverage_through_response_id: number | null;
  dttm_created_utc: string;
}>> {
  return await sql`
    SELECT reflection_id, text, coverage_through_response_id, dttm_created_utc
    FROM tb_reflections
    ORDER BY dttm_created_utc ASC
  ` as Array<{
    reflection_id: number; text: string; coverage_through_response_id: number | null;
    dttm_created_utc: string;
  }>;
}

export async function getLatestReflectionWithCoverage(): Promise<{
  reflection_id: number; text: string;
  coverage_through_response_id: number | null;
  dttm_created_utc: string;
} | null> {
  const rows = await sql`
    SELECT reflection_id, text, coverage_through_response_id, dttm_created_utc
    FROM tb_reflections
    ORDER BY dttm_created_utc DESC
    LIMIT 1
  `;
  return (rows[0] as {
    reflection_id: number; text: string;
    coverage_through_response_id: number | null;
    dttm_created_utc: string;
  }) ?? null;
}

export async function getRecentFeedback(limit: number): Promise<Array<{ date: string; landed: boolean }>> {
  const rows = await sql`
    SELECT q.scheduled_for AS date, f.landed
    FROM tb_question_feedback f
    JOIN tb_questions q ON f.question_id = q.question_id
    ORDER BY q.scheduled_for DESC
    LIMIT ${limit}
  `;
  return rows.map((r: Record<string, unknown>) => ({ date: r.date as string, landed: !!r.landed }));
}

export async function getSessionSummariesForQuestions(questionIds: number[]): Promise<Array<SessionSummaryInput & { date: string }>> {
  if (questionIds.length === 0) return [];
  return await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS}, q.scheduled_for AS date
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE s.question_id = ANY($1)
    ORDER BY q.scheduled_for ASC`,
    [questionIds]
  ) as Array<SessionSummaryInput & { date: string }>;
}

export async function getMaxResponseId(): Promise<number> {
  const [row] = await sql`SELECT MAX(response_id) AS max_id FROM tb_responses`;
  return (row as { max_id: number | null }).max_id ?? 0;
}

// ----------------------------------------------------------------------------
// EMBEDDING METADATA QUERIES
// ----------------------------------------------------------------------------

export async function insertEmbeddingMeta(
  embeddingSourceId: number,
  sourceRecordId: number,
  embeddedText: string,
  sourceDate: string | null,
  modelName: string = 'Qwen3-Embedding-0.6B',
  embedding?: number[],
  embeddingModelVersionId?: number,
): Promise<number> {
  if (embedding) {
    const vectorString = `[${embedding.join(',')}]`;
    const [row] = await sql`
      INSERT INTO tb_embeddings (embedding_source_id, source_record_id, embedded_text, source_date, model_name, embedding, embedding_model_version_id)
      VALUES (${embeddingSourceId}, ${sourceRecordId}, ${embeddedText}, ${sourceDate}, ${modelName}, ${vectorString}::vector, ${embeddingModelVersionId ?? null})
      ON CONFLICT (embedding_source_id, source_record_id, embedding_model_version_id) DO NOTHING
      RETURNING embedding_id
    `;
    return row?.embedding_id ?? 0;
  }
  const [row] = await sql`
    INSERT INTO tb_embeddings (embedding_source_id, source_record_id, embedded_text, source_date, model_name, embedding_model_version_id)
    VALUES (${embeddingSourceId}, ${sourceRecordId}, ${embeddedText}, ${sourceDate}, ${modelName}, ${embeddingModelVersionId ?? null})
    ON CONFLICT (embedding_source_id, source_record_id, embedding_model_version_id) DO NOTHING
    RETURNING embedding_id
  `;
  return row?.embedding_id ?? 0;
}

export async function isRecordEmbedded(embeddingSourceId: number, sourceRecordId: number, embeddingModelVersionId?: number): Promise<boolean> {
  const rows = embeddingModelVersionId
    ? await sql`
        SELECT 1 FROM tb_embeddings
        WHERE embedding_source_id = ${embeddingSourceId}
          AND source_record_id = ${sourceRecordId}
          AND embedding_model_version_id = ${embeddingModelVersionId}
          AND invalidated_at IS NULL
      `
    : await sql`
        SELECT 1 FROM tb_embeddings
        WHERE embedding_source_id = ${embeddingSourceId}
          AND source_record_id = ${sourceRecordId}
          AND invalidated_at IS NULL
      `;
  return rows.length > 0;
}

export async function getUnembeddedResponses(embeddingModelVersionId?: number): Promise<Array<{
  response_id: number; question: string; response: string; date: string;
}>> {
  return await sql`
    SELECT r.response_id, q.text AS question, r.text AS response, q.scheduled_for AS date
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
      AND NOT EXISTS (
        SELECT 1 FROM tb_embeddings e
        WHERE e.embedding_source_id = 1
          AND e.source_record_id = r.response_id
          AND e.invalidated_at IS NULL
          ${embeddingModelVersionId ? sql`AND e.embedding_model_version_id = ${embeddingModelVersionId}` : sql``}
      )
    ORDER BY q.scheduled_for ASC
  ` as Array<{
    response_id: number; question: string; response: string; date: string;
  }>;
}


export async function searchVecEmbeddings(queryVector: number[], k: number): Promise<Array<{
  embedding_id: number; distance: number; embedding_source_id: number;
  source_record_id: number; embedded_text: string; source_date: string | null;
}>> {
  try {
    const vectorString = `[${queryVector.join(',')}]`;
    return await sql`
      SELECT e.embedding_id, e.embedding_source_id, e.source_record_id,
             e.embedded_text, e.source_date,
             (e.embedding <-> ${vectorString}::vector) AS distance
      FROM tb_embeddings e
      WHERE e.embedding IS NOT NULL
        AND e.invalidated_at IS NULL
      ORDER BY e.embedding <-> ${vectorString}::vector
      LIMIT ${k}
    ` as Array<{
      embedding_id: number; distance: number; embedding_source_id: number;
      source_record_id: number; embedded_text: string; source_date: string | null;
    }>;
  } catch (err) {
    console.error('[searchVecEmbeddings] Vector search failed, returning empty:', (err as Error).message);
    return [];
  }
}

export async function getActiveEmbeddingModelVersionId(): Promise<number | null> {
  const rows = await sql`
    SELECT embedding_model_version_id FROM tb_embedding_model_versions
    WHERE active_to IS NULL
    ORDER BY active_from DESC
    LIMIT 1
  `;
  return (rows[0] as { embedding_model_version_id: number } | undefined)?.embedding_model_version_id ?? null;
}

// ----------------------------------------------------------------------------
// PROMPT TRACES
// ----------------------------------------------------------------------------

export interface PromptTraceInput {
  type: 'generation' | 'observation' | 'reflection';
  outputRecordId?: number;
  recentEntryIds?: number[];
  ragEntryIds?: number[];
  contrarianEntryIds?: number[];
  reflectionIds?: number[];
  observationIds?: number[];
  modelName?: string;
  tokenEstimate?: number;
  difficultyLevel?: string | null;
  difficultyInputs?: { avgMATTR: number; avgCogDensity: number } | null;
}

export async function savePromptTrace(trace: PromptTraceInput): Promise<void> {
  const typeId = trace.type === 'generation' ? 1 : trace.type === 'observation' ? 2 : 3;
  await sql`
    INSERT INTO tb_prompt_traces (
       prompt_trace_type_id, output_record_id,
       recent_entry_ids, rag_entry_ids, contrarian_entry_ids,
       reflection_ids, observation_ids,
       model_name, token_estimate,
       difficulty_level, difficulty_inputs
    ) VALUES (
      ${typeId},
      ${trace.outputRecordId ?? null},
      ${trace.recentEntryIds ? JSON.stringify(trace.recentEntryIds) : null},
      ${trace.ragEntryIds ? JSON.stringify(trace.ragEntryIds) : null},
      ${trace.contrarianEntryIds ? JSON.stringify(trace.contrarianEntryIds) : null},
      ${trace.reflectionIds ? JSON.stringify(trace.reflectionIds) : null},
      ${trace.observationIds ? JSON.stringify(trace.observationIds) : null},
      ${trace.modelName ?? 'claude-opus-4-6'},
      ${trace.tokenEstimate ?? null},
      ${trace.difficultyLevel ?? null},
      ${trace.difficultyInputs ? JSON.stringify(trace.difficultyInputs) : null}
    )
  `;
}

// ----------------------------------------------------------------------------
// @region state -- saveWitnessState, getLatestWitnessState, EntryStateRow, saveEntryState, getAllEntryStates, getEntryStateCount, SemanticStateRow, saveSemanticState, saveSemanticDynamics, saveSemanticCoupling, TraitDynamicRow, saveTraitDynamics, getLatestTraitDynamics, saveCouplingMatrix, getLatestCouplingMatrix, saveEmotionBehaviorCoupling, getLatestEmotionBehaviorCoupling
// WITNESS STATE
// ----------------------------------------------------------------------------

export async function saveWitnessState(entryCount: number, traitsJson: string, signalsJson: string, modelName = 'claude-sonnet-4-20250514'): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_witness_states (entry_count, traits_json, signals_json, model_name)
    VALUES (${entryCount}, ${traitsJson}, ${signalsJson}, ${modelName})
    RETURNING witness_state_id
  `;
  return row.witness_state_id;
}

export async function getLatestWitnessState(): Promise<{ witness_state_id: number; entry_count: number; traits_json: string; signals_json: string } | null> {
  const rows = await sql`
    SELECT witness_state_id, entry_count, traits_json, signals_json
    FROM tb_witness_states
    ORDER BY witness_state_id DESC LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  // JSONB columns auto-parsed by postgres driver; callers expect strings
  return {
    witness_state_id: row.witness_state_id as number,
    entry_count: row.entry_count as number,
    traits_json: typeof row.traits_json === 'object' ? JSON.stringify(row.traits_json) : row.traits_json as string,
    signals_json: typeof row.signals_json === 'object' ? JSON.stringify(row.signals_json) : row.signals_json as string,
  };
}

// ----------------------------------------------------------------------------
// ENTRY STATES (7D deterministic behavioral state vectors)
// ----------------------------------------------------------------------------

export interface EntryStateRow {
  entry_state_id: number;
  response_id: number;
  fluency: number;
  deliberation: number;
  revision: number;
  commitment: number;
  volatility: number;
  thermal: number;
  presence: number;
  convergence: number;
}

export async function saveEntryState(state: Omit<EntryStateRow, 'entry_state_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_entry_states (
       response_id, fluency, deliberation, revision,
       commitment, volatility, thermal, presence, convergence
    ) VALUES (
      ${state.response_id}, ${state.fluency}, ${state.deliberation},
      ${state.revision}, ${state.commitment},
      ${state.volatility}, ${state.thermal}, ${state.presence}, ${state.convergence}
    )
    RETURNING entry_state_id
  `;
  return row.entry_state_id;
}

export async function getAllEntryStates(): Promise<EntryStateRow[]> {
  return await sql`
    SELECT * FROM tb_entry_states ORDER BY entry_state_id ASC
  ` as EntryStateRow[];
}

export async function getEntryStateCount(): Promise<number> {
  const [row] = await sql`SELECT COUNT(*)::int AS c FROM tb_entry_states`;
  return (row as { c: number }).c;
}

// ----------------------------------------------------------------------------
// SEMANTIC STATES (parallel space; deterministic densities + LLM placeholders)
// ----------------------------------------------------------------------------

export interface SemanticStateRow {
  semantic_state_id: number;
  response_id: number;
  // Deterministic dimensions (always populated)
  syntactic_complexity: number;
  interrogation: number;
  self_focus: number;
  uncertainty: number;
  cognitive_processing: number;
  nrc_anger: number;
  nrc_fear: number;
  nrc_joy: number;
  nrc_sadness: number;
  nrc_trust: number;
  nrc_anticipation: number;
  // LLM-extracted (schema-ready, null until extraction lands)
  sentiment: number | null;
  abstraction: number | null;
  agency_framing: number | null;
  temporal_orientation: number | null;
  convergence: number;
}

export async function saveSemanticState(state: Omit<SemanticStateRow, 'semantic_state_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_semantic_states (
       response_id,
       syntactic_complexity, interrogation, self_focus, uncertainty,
       cognitive_processing,
       nrc_anger, nrc_fear, nrc_joy, nrc_sadness, nrc_trust, nrc_anticipation,
       sentiment, abstraction, agency_framing, temporal_orientation,
       convergence
    ) VALUES (
      ${state.response_id},
      ${state.syntactic_complexity}, ${state.interrogation}, ${state.self_focus}, ${state.uncertainty},
      ${state.cognitive_processing},
      ${state.nrc_anger}, ${state.nrc_fear}, ${state.nrc_joy}, ${state.nrc_sadness}, ${state.nrc_trust}, ${state.nrc_anticipation},
      ${state.sentiment}, ${state.abstraction}, ${state.agency_framing}, ${state.temporal_orientation},
      ${state.convergence}
    )
    RETURNING semantic_state_id
  `;
  return row.semantic_state_id;
}

export async function getSemanticStateCount(): Promise<number> {
  const [row] = await sql`SELECT COUNT(*)::int AS c FROM tb_semantic_states`;
  return (row as { c: number }).c;
}

export interface SemanticDynamicRow {
  semantic_dynamic_id: number;
  entry_count: number;
  dimension: string;
  baseline: number;
  variability: number;
  attractor_force: number;
  current_state: number;
  deviation: number;
  window_size: number;
}

export async function saveSemanticDynamics(dynamics: Omit<SemanticDynamicRow, 'semantic_dynamic_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const d of dynamics) {
      await sql`
        INSERT INTO tb_semantic_dynamics (
           entry_count, dimension, baseline, variability,
           attractor_force, current_state, deviation, window_size
        ) VALUES (
          ${d.entry_count}, ${d.dimension}, ${d.baseline}, ${d.variability},
          ${d.attractor_force}, ${d.current_state}, ${d.deviation}, ${d.window_size}
        )
      `;
    }
  });
}

export interface SemanticCouplingRow {
  semantic_coupling_id: number;
  entry_count: number;
  leader: string;
  follower: string;
  lag_sessions: number;
  correlation: number;
  direction: number;
}

export async function saveSemanticCoupling(couplings: Omit<SemanticCouplingRow, 'semantic_coupling_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const c of couplings) {
      await sql`
        INSERT INTO tb_semantic_coupling (
           entry_count, leader, follower, lag_sessions, correlation, direction
        ) VALUES (
          ${c.entry_count}, ${c.leader}, ${c.follower}, ${c.lag_sessions}, ${c.correlation}, ${c.direction}
        )
      `;
    }
  });
}

// ----------------------------------------------------------------------------
// TRAIT DYNAMICS (PersDyn model)
// ----------------------------------------------------------------------------

export interface TraitDynamicRow {
  trait_dynamic_id: number;
  entry_count: number;
  dimension: string;
  baseline: number;
  variability: number;
  attractor_force: number;
  current_state: number;
  deviation: number;
  window_size: number;
}

export async function saveTraitDynamics(dynamics: Omit<TraitDynamicRow, 'trait_dynamic_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const d of dynamics) {
      await sql`
        INSERT INTO tb_trait_dynamics (
           entry_count, dimension, baseline, variability,
           attractor_force, current_state, deviation, window_size
        ) VALUES (
          ${d.entry_count}, ${d.dimension}, ${d.baseline}, ${d.variability},
          ${d.attractor_force}, ${d.current_state}, ${d.deviation}, ${d.window_size}
        )
      `;
    }
  });
}

export async function getLatestTraitDynamics(entryCount: number): Promise<TraitDynamicRow[]> {
  return await sql`
    SELECT * FROM tb_trait_dynamics
    WHERE entry_count = ${entryCount}
    ORDER BY trait_dynamic_id ASC
  ` as TraitDynamicRow[];
}

// ----------------------------------------------------------------------------
// COUPLING MATRIX
// ----------------------------------------------------------------------------

export interface CouplingRow {
  coupling_id: number;
  entry_count: number;
  leader: string;
  follower: string;
  lag_sessions: number;
  correlation: number;
  direction: number;
}

export async function saveCouplingMatrix(couplings: Omit<CouplingRow, 'coupling_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const c of couplings) {
      await sql`
        INSERT INTO tb_coupling_matrix (
           entry_count, leader, follower, lag_sessions, correlation, direction
        ) VALUES (
          ${c.entry_count}, ${c.leader}, ${c.follower}, ${c.lag_sessions}, ${c.correlation}, ${c.direction}
        )
      `;
    }
  });
}

export async function getLatestCouplingMatrix(entryCount: number): Promise<CouplingRow[]> {
  return await sql`
    SELECT * FROM tb_coupling_matrix
    WHERE entry_count = ${entryCount}
    ORDER BY correlation DESC
  ` as CouplingRow[];
}

// ----------------------------------------------------------------------------
// EMOTION-BEHAVIOR COUPLING
// ----------------------------------------------------------------------------

export interface EmotionBehaviorCouplingRow {
  emotion_coupling_id: number;
  entry_count: number;
  emotion_dim: string;
  behavior_dim: string;
  lag_sessions: number;
  correlation: number;
  direction: number;
}

export async function saveEmotionBehaviorCoupling(couplings: Omit<EmotionBehaviorCouplingRow, 'emotion_coupling_id'>[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const c of couplings) {
      await sql`
        INSERT INTO tb_emotion_behavior_coupling (
           entry_count, emotion_dim, behavior_dim, lag_sessions, correlation, direction
        ) VALUES (
          ${c.entry_count}, ${c.emotion_dim}, ${c.behavior_dim}, ${c.lag_sessions}, ${c.correlation}, ${c.direction}
        )
      `;
    }
  });
}

export async function getLatestEmotionBehaviorCoupling(entryCount: number): Promise<EmotionBehaviorCouplingRow[]> {
  return await sql`
    SELECT * FROM tb_emotion_behavior_coupling
    WHERE entry_count = ${entryCount}
    ORDER BY correlation DESC
  ` as EmotionBehaviorCouplingRow[];
}

// Predictions, theory confidence, intervention intent, and question candidates
// were archived 2026-04-16. Data preserved under zz_archive_* tables.
// Stub functions removed 2026-04-20 — no active callers remain.

// ----------------------------------------------------------------------------
// @region calibration-context -- saveCalibrationContext, getCalibrationContextForQuestion, getRecentCalibrationContext, getCalibrationContextNearDate, saveSessionDelta, getRecentSessionDeltas, getSameDayCalibrationSummary
// CALIBRATION CONTEXT EXTRACTION
// ----------------------------------------------------------------------------

export interface CalibrationContextTag {
  dimension: 'sleep' | 'physical_state' | 'emotional_event' | 'social_quality' | 'stress' | 'exercise' | 'routine';
  value: string;
  detail: string | null;
  confidence: number;
}

const DIMENSION_ID_MAP: Record<string, number> = {
  sleep: 1, physical_state: 2, emotional_event: 3, social_quality: 4,
  stress: 5, exercise: 6, routine: 7,
};

export async function saveCalibrationContext(questionId: number, tags: CalibrationContextTag[]): Promise<void> {
  await sql.begin(async (sql) => {
    for (const tag of tags) {
      const dimId = DIMENSION_ID_MAP[tag.dimension];
      if (!dimId) continue;
      await sql`
        INSERT INTO tb_calibration_context (
           question_id, context_dimension_id, value, detail, confidence
        ) VALUES (
          ${questionId}, ${dimId}, ${tag.value}, ${tag.detail}, ${tag.confidence}
        )
      `;
    }
  });
}

export async function getCalibrationContextForQuestion(questionId: number): Promise<Array<CalibrationContextTag & { questionId: number }>> {
  return await sql`
    SELECT cc.question_id AS "questionId",
           d.enum_code AS dimension,
           cc.value,
           cc.detail,
           cc.confidence
    FROM tb_calibration_context cc
    JOIN te_context_dimension d ON cc.context_dimension_id = d.context_dimension_id
    WHERE cc.question_id = ${questionId}
    ORDER BY cc.context_dimension_id ASC
  ` as Array<CalibrationContextTag & { questionId: number }>;
}

export async function getRecentCalibrationContext(limit: number = 10): Promise<Array<{
  questionId: number;
  promptText: string;
  sessionDate: string;
  dimension: string;
  value: string;
  detail: string | null;
  confidence: number;
}>> {
  return await sql`
    SELECT cc.question_id AS "questionId",
           q.text AS "promptText",
           q.dttm_created_utc AS "sessionDate",
           d.enum_code AS dimension,
           cc.value,
           cc.detail,
           cc.confidence
    FROM tb_calibration_context cc
    JOIN te_context_dimension d ON cc.context_dimension_id = d.context_dimension_id
    JOIN tb_questions q ON cc.question_id = q.question_id
    ORDER BY q.dttm_created_utc DESC, cc.context_dimension_id ASC
    LIMIT ${limit}
  ` as Array<{
    questionId: number;
    promptText: string;
    sessionDate: string;
    dimension: string;
    value: string;
    detail: string | null;
    confidence: number;
  }>;
}

export async function getCalibrationContextNearDate(targetDate: string, windowDays: number = 1): Promise<Array<{
  questionId: number;
  sessionDate: string;
  dimension: string;
  value: string;
  detail: string | null;
  confidence: number;
}>> {
  return await sql`
    SELECT cc.question_id AS "questionId",
           q.dttm_created_utc AS "sessionDate",
           d.enum_code AS dimension,
           cc.value,
           cc.detail,
           cc.confidence
    FROM tb_calibration_context cc
    JOIN te_context_dimension d ON cc.context_dimension_id = d.context_dimension_id
    JOIN tb_questions q ON cc.question_id = q.question_id
    WHERE ABS(EXTRACT(EPOCH FROM (q.dttm_created_utc - ${targetDate}::timestamptz)) / 86400) <= ${windowDays}
    ORDER BY ABS(EXTRACT(EPOCH FROM (q.dttm_created_utc - ${targetDate}::timestamptz)) / 86400) ASC, cc.context_dimension_id ASC
  ` as Array<{
    questionId: number;
    sessionDate: string;
    dimension: string;
    value: string;
    detail: string | null;
    confidence: number;
  }>;
}

// ----------------------------------------------------------------------------
// SESSION DELTA (same-day calibration -> journal behavioral shift)
// ----------------------------------------------------------------------------

export interface SessionDeltaRow {
  sessionDeltaId: number;
  sessionDate: string;
  calibrationQuestionId: number;
  journalQuestionId: number;
  deltaFirstPerson: number | null;
  deltaCognitive: number | null;
  deltaHedging: number | null;
  deltaCharsPerMinute: number | null;
  deltaCommitment: number | null;
  deltaLargeDeletionCount: number | null;
  deltaInterKeyIntervalMean: number | null;
  deltaAvgPBurstLength: number | null;
  deltaHoldTimeMean: number | null;
  deltaFlightTimeMean: number | null;
  deltaMagnitude: number | null;
  calibrationFirstPerson: number | null;
  journalFirstPerson: number | null;
  calibrationCognitive: number | null;
  journalCognitive: number | null;
  calibrationHedging: number | null;
  journalHedging: number | null;
  calibrationCharsPerMinute: number | null;
  journalCharsPerMinute: number | null;
  calibrationCommitment: number | null;
  journalCommitment: number | null;
  calibrationLargeDeletionCount: number | null;
  journalLargeDeletionCount: number | null;
  calibrationInterKeyIntervalMean: number | null;
  journalInterKeyIntervalMean: number | null;
  calibrationAvgPBurstLength: number | null;
  journalAvgPBurstLength: number | null;
  calibrationHoldTimeMean: number | null;
  journalHoldTimeMean: number | null;
  calibrationFlightTimeMean: number | null;
  journalFlightTimeMean: number | null;
}

export async function getSameDayCalibrationSummary(date: string): Promise<SessionSummaryInput | null> {
  // Calibration questions have scheduled_for = NULL (see saveCalibrationSession).
  // Match by dttm_created_utc::date instead. Take most recent if multiple same-day.
  const rows = await sql.unsafe(
    `SELECT ${SESSION_SUMMARY_COLS}
    FROM tb_session_summaries s
    JOIN tb_questions q ON s.question_id = q.question_id
    WHERE q.question_source_id = 3
      AND q.dttm_created_utc::date = $1
    ORDER BY q.dttm_created_utc DESC
    LIMIT 1`,
    [date]
  );
  return (rows[0] as unknown as SessionSummaryInput) ?? null;
}

export async function saveSessionDelta(delta: SessionDeltaRow): Promise<void> {
  await sql`
    INSERT INTO tb_session_delta (
       session_date
      ,calibration_question_id
      ,journal_question_id
      ,delta_first_person
      ,delta_cognitive
      ,delta_hedging
      ,delta_chars_per_minute
      ,delta_commitment
      ,delta_large_deletion_count
      ,delta_inter_key_interval_mean
      ,delta_avg_p_burst_length
      ,delta_hold_time_mean
      ,delta_flight_time_mean
      ,delta_magnitude
      ,calibration_first_person
      ,journal_first_person
      ,calibration_cognitive
      ,journal_cognitive
      ,calibration_hedging
      ,journal_hedging
      ,calibration_chars_per_minute
      ,journal_chars_per_minute
      ,calibration_commitment
      ,journal_commitment
      ,calibration_large_deletion_count
      ,journal_large_deletion_count
      ,calibration_inter_key_interval_mean
      ,journal_inter_key_interval_mean
      ,calibration_avg_p_burst_length
      ,journal_avg_p_burst_length
      ,calibration_hold_time_mean
      ,journal_hold_time_mean
      ,calibration_flight_time_mean
      ,journal_flight_time_mean
    ) VALUES (
      ${delta.sessionDate},
      ${delta.calibrationQuestionId},
      ${delta.journalQuestionId},
      ${delta.deltaFirstPerson},
      ${delta.deltaCognitive},
      ${delta.deltaHedging},
      ${delta.deltaCharsPerMinute},
      ${delta.deltaCommitment},
      ${delta.deltaLargeDeletionCount},
      ${delta.deltaInterKeyIntervalMean},
      ${delta.deltaAvgPBurstLength},
      ${delta.deltaHoldTimeMean},
      ${delta.deltaFlightTimeMean},
      ${delta.deltaMagnitude},
      ${delta.calibrationFirstPerson},
      ${delta.journalFirstPerson},
      ${delta.calibrationCognitive},
      ${delta.journalCognitive},
      ${delta.calibrationHedging},
      ${delta.journalHedging},
      ${delta.calibrationCharsPerMinute},
      ${delta.journalCharsPerMinute},
      ${delta.calibrationCommitment},
      ${delta.journalCommitment},
      ${delta.calibrationLargeDeletionCount},
      ${delta.journalLargeDeletionCount},
      ${delta.calibrationInterKeyIntervalMean},
      ${delta.journalInterKeyIntervalMean},
      ${delta.calibrationAvgPBurstLength},
      ${delta.journalAvgPBurstLength},
      ${delta.calibrationHoldTimeMean},
      ${delta.journalHoldTimeMean},
      ${delta.calibrationFlightTimeMean},
      ${delta.journalFlightTimeMean}
    )
    ON CONFLICT (session_date) DO UPDATE SET
       calibration_question_id = ${delta.calibrationQuestionId}
      ,journal_question_id = ${delta.journalQuestionId}
      ,delta_first_person = ${delta.deltaFirstPerson}
      ,delta_cognitive = ${delta.deltaCognitive}
      ,delta_hedging = ${delta.deltaHedging}
      ,delta_chars_per_minute = ${delta.deltaCharsPerMinute}
      ,delta_commitment = ${delta.deltaCommitment}
      ,delta_large_deletion_count = ${delta.deltaLargeDeletionCount}
      ,delta_inter_key_interval_mean = ${delta.deltaInterKeyIntervalMean}
      ,delta_avg_p_burst_length = ${delta.deltaAvgPBurstLength}
      ,delta_hold_time_mean = ${delta.deltaHoldTimeMean}
      ,delta_flight_time_mean = ${delta.deltaFlightTimeMean}
      ,delta_magnitude = ${delta.deltaMagnitude}
      ,calibration_first_person = ${delta.calibrationFirstPerson}
      ,journal_first_person = ${delta.journalFirstPerson}
      ,calibration_cognitive = ${delta.calibrationCognitive}
      ,journal_cognitive = ${delta.journalCognitive}
      ,calibration_hedging = ${delta.calibrationHedging}
      ,journal_hedging = ${delta.journalHedging}
      ,calibration_chars_per_minute = ${delta.calibrationCharsPerMinute}
      ,journal_chars_per_minute = ${delta.journalCharsPerMinute}
      ,calibration_commitment = ${delta.calibrationCommitment}
      ,journal_commitment = ${delta.journalCommitment}
      ,calibration_large_deletion_count = ${delta.calibrationLargeDeletionCount}
      ,journal_large_deletion_count = ${delta.journalLargeDeletionCount}
      ,calibration_inter_key_interval_mean = ${delta.calibrationInterKeyIntervalMean}
      ,journal_inter_key_interval_mean = ${delta.journalInterKeyIntervalMean}
      ,calibration_avg_p_burst_length = ${delta.calibrationAvgPBurstLength}
      ,journal_avg_p_burst_length = ${delta.journalAvgPBurstLength}
      ,calibration_hold_time_mean = ${delta.calibrationHoldTimeMean}
      ,journal_hold_time_mean = ${delta.journalHoldTimeMean}
      ,calibration_flight_time_mean = ${delta.calibrationFlightTimeMean}
      ,journal_flight_time_mean = ${delta.journalFlightTimeMean}
  `;
}

export async function getRecentSessionDeltas(limit: number = 30): Promise<SessionDeltaRow[]> {
  return await sql`
    SELECT
       session_delta_id AS "sessionDeltaId"
      ,session_date AS "sessionDate"
      ,calibration_question_id AS "calibrationQuestionId"
      ,journal_question_id AS "journalQuestionId"
      ,delta_first_person AS "deltaFirstPerson"
      ,delta_cognitive AS "deltaCognitive"
      ,delta_hedging AS "deltaHedging"
      ,delta_chars_per_minute AS "deltaCharsPerMinute"
      ,delta_commitment AS "deltaCommitment"
      ,delta_large_deletion_count AS "deltaLargeDeletionCount"
      ,delta_inter_key_interval_mean AS "deltaInterKeyIntervalMean"
      ,delta_avg_p_burst_length AS "deltaAvgPBurstLength"
      ,delta_hold_time_mean AS "deltaHoldTimeMean"
      ,delta_flight_time_mean AS "deltaFlightTimeMean"
      ,delta_magnitude AS "deltaMagnitude"
      ,calibration_first_person AS "calibrationFirstPerson"
      ,journal_first_person AS "journalFirstPerson"
      ,calibration_cognitive AS "calibrationCognitive"
      ,journal_cognitive AS "journalCognitive"
      ,calibration_hedging AS "calibrationHedging"
      ,journal_hedging AS "journalHedging"
      ,calibration_chars_per_minute AS "calibrationCharsPerMinute"
      ,journal_chars_per_minute AS "journalCharsPerMinute"
      ,calibration_commitment AS "calibrationCommitment"
      ,journal_commitment AS "journalCommitment"
      ,calibration_large_deletion_count AS "calibrationLargeDeletionCount"
      ,journal_large_deletion_count AS "journalLargeDeletionCount"
      ,calibration_inter_key_interval_mean AS "calibrationInterKeyIntervalMean"
      ,journal_inter_key_interval_mean AS "journalInterKeyIntervalMean"
      ,calibration_avg_p_burst_length AS "calibrationAvgPBurstLength"
      ,journal_avg_p_burst_length AS "journalAvgPBurstLength"
      ,calibration_hold_time_mean AS "calibrationHoldTimeMean"
      ,journal_hold_time_mean AS "journalHoldTimeMean"
      ,calibration_flight_time_mean AS "calibrationFlightTimeMean"
      ,journal_flight_time_mean AS "journalFlightTimeMean"
    FROM tb_session_delta
    ORDER BY session_date DESC
    LIMIT ${limit}
  ` as SessionDeltaRow[];
}

// ===================================================================
// @region observatory -- getEntryStatesWithDates, getEntryStateByResponseId, getCommentsForPaper, saveComment
// OBSERVATORY QUERIES
// ===================================================================

export async function getEntryStatesWithDates(): Promise<Array<EntryStateRow & { date: string; question_id: number }>> {
  return await sql`
    SELECT es.*, q.scheduled_for AS date, q.question_id
    FROM tb_entry_states es
    JOIN tb_responses r ON es.response_id = r.response_id
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY es.entry_state_id ASC
  ` as Array<EntryStateRow & { date: string; question_id: number }>;
}

export async function getEntryStateByResponseId(responseId: number): Promise<(EntryStateRow & {
  date: string; question_id: number; question_text: string;
}) | null> {
  const rows = await sql`
    SELECT es.*, q.scheduled_for AS date, q.question_id, q.text AS question_text
    FROM tb_entry_states es
    JOIN tb_responses r ON es.response_id = r.response_id
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE es.response_id = ${responseId}
  `;
  return (rows[0] as (EntryStateRow & {
    date: string; question_id: number; question_text: string;
  })) ?? null;
}

// ===================================================================
// PAPER COMMENTS
// ===================================================================

export async function getCommentsForPaper(slug: string): Promise<Array<{
  paper_comment_id: number;
  author_name: string;
  comment_text: string;
  dttm_created_utc: string;
}>> {
  return await sql`
    SELECT paper_comment_id, author_name, comment_text, dttm_created_utc
    FROM tb_paper_comments
    WHERE paper_slug = ${slug}
    ORDER BY dttm_created_utc ASC
  ` as Array<{
    paper_comment_id: number;
    author_name: string;
    comment_text: string;
    dttm_created_utc: string;
  }>;
}

export async function saveComment(slug: string, authorName: string, commentText: string): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_paper_comments (paper_slug, author_name, comment_text, dttm_created_utc)
    VALUES (${slug}, ${authorName}, ${commentText}, ${nowStr()})
    RETURNING paper_comment_id
  `;
  return row.paper_comment_id;
}

// ----------------------------------------------------------------------------
// @region signals -- saveDynamicalSignals, getDynamicalSignals, saveMotorSignals, getMotorSignals, saveSemanticSignals, getSemanticSignals, saveProcessSignals, getProcessSignals, saveCrossSessionSignals, getCrossSessionSignals, saveReconstructionResidual, getReconstructionResidual, saveSessionIntegrity, getSessionIntegrity
// DYNAMICAL SIGNALS (persisted, previously on-demand)
// ----------------------------------------------------------------------------

export interface DynamicalSignalRow {
  dynamical_signal_id: number;
  question_id: number;
  iki_count: number | null;
  hold_flight_count: number | null;
  permutation_entropy: number | null;
  permutation_entropy_raw: number | null;
  pe_spectrum: string | null;
  dfa_alpha: number | null;
  mfdfa_spectrum_width: number | null;
  mfdfa_asymmetry: number | null;
  mfdfa_peak_alpha: number | null;
  temporal_irreversibility: number | null;
  iki_psd_spectral_slope: number | null;
  iki_psd_respiratory_peak_hz: number | null;
  peak_typing_frequency_hz: number | null;
  iki_psd_lf_hf_ratio: number | null;
  iki_psd_fast_slow_variance_ratio: number | null;
  rqa_determinism: number | null;
  rqa_laminarity: number | null;
  rqa_trapping_time: number | null;
  rqa_recurrence_rate: number | null;
  te_hold_to_flight: number | null;
  te_flight_to_hold: number | null;
  te_dominance: number | null;
}

export async function saveDynamicalSignals(questionId: number, s: Omit<DynamicalSignalRow, 'dynamical_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_dynamical_signals (
       question_id, iki_count, hold_flight_count,
       permutation_entropy, permutation_entropy_raw, pe_spectrum, dfa_alpha,
       mfdfa_spectrum_width, mfdfa_asymmetry, mfdfa_peak_alpha,
       temporal_irreversibility,
       iki_psd_spectral_slope, iki_psd_respiratory_peak_hz, peak_typing_frequency_hz,
       iki_psd_lf_hf_ratio, iki_psd_fast_slow_variance_ratio,
       rqa_determinism, rqa_laminarity, rqa_trapping_time, rqa_recurrence_rate,
       te_hold_to_flight, te_flight_to_hold, te_dominance
    ) VALUES (
      ${questionId}, ${s.iki_count}, ${s.hold_flight_count},
      ${s.permutation_entropy}, ${s.permutation_entropy_raw}, ${s.pe_spectrum}, ${s.dfa_alpha},
      ${s.mfdfa_spectrum_width}, ${s.mfdfa_asymmetry}, ${s.mfdfa_peak_alpha},
      ${s.temporal_irreversibility},
      ${s.iki_psd_spectral_slope}, ${s.iki_psd_respiratory_peak_hz}, ${s.peak_typing_frequency_hz},
      ${s.iki_psd_lf_hf_ratio}, ${s.iki_psd_fast_slow_variance_ratio},
      ${s.rqa_determinism}, ${s.rqa_laminarity}, ${s.rqa_trapping_time}, ${s.rqa_recurrence_rate},
      ${s.te_hold_to_flight}, ${s.te_flight_to_hold}, ${s.te_dominance}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING dynamical_signal_id
  `;
  return row?.dynamical_signal_id ?? 0;
}

export async function getDynamicalSignals(questionId: number): Promise<DynamicalSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_dynamical_signals WHERE question_id = ${questionId}`;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  // JSONB columns auto-parsed by postgres driver; callers expect strings
  return {
    ...row,
    pe_spectrum: row.pe_spectrum == null ? null : (typeof row.pe_spectrum === 'object' ? JSON.stringify(row.pe_spectrum) : row.pe_spectrum as string),
  } as DynamicalSignalRow;
}

// ----------------------------------------------------------------------------
// MOTOR SIGNALS
// ----------------------------------------------------------------------------

export interface MotorSignalRow {
  motor_signal_id: number;
  question_id: number;
  sample_entropy: number | null;
  iki_autocorrelation_json: string | null;
  motor_jerk: number | null;
  lapse_rate: number | null;
  tempo_drift: number | null;
  iki_compression_ratio: number | null;
  digraph_latency_json: string | null;
  // Phase 2 expansion (2026-04-18)
  ex_gaussian_tau: number | null;
  ex_gaussian_mu: number | null;
  ex_gaussian_sigma: number | null;
  tau_proportion: number | null;
  adjacent_hold_time_cov: number | null;
  hold_flight_rank_corr: number | null;
}

export async function saveMotorSignals(questionId: number, s: Omit<MotorSignalRow, 'motor_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_motor_signals (
       question_id, sample_entropy, iki_autocorrelation_json,
       motor_jerk, lapse_rate, tempo_drift,
       iki_compression_ratio, digraph_latency_json,
       ex_gaussian_tau, ex_gaussian_mu, ex_gaussian_sigma,
       tau_proportion, adjacent_hold_time_cov, hold_flight_rank_corr
    ) VALUES (
      ${questionId}, ${s.sample_entropy}, ${s.iki_autocorrelation_json},
      ${s.motor_jerk}, ${s.lapse_rate}, ${s.tempo_drift},
      ${s.iki_compression_ratio}, ${s.digraph_latency_json},
      ${s.ex_gaussian_tau}, ${s.ex_gaussian_mu}, ${s.ex_gaussian_sigma},
      ${s.tau_proportion}, ${s.adjacent_hold_time_cov}, ${s.hold_flight_rank_corr}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING motor_signal_id
  `;
  return row?.motor_signal_id ?? 0;
}

export async function getMotorSignals(questionId: number): Promise<MotorSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_motor_signals WHERE question_id = ${questionId}`;
  if (!rows[0]) return null;
  const row = rows[0] as Record<string, unknown>;
  // JSONB columns auto-parsed by postgres driver; callers expect strings
  return {
    ...row,
    iki_autocorrelation_json: row.iki_autocorrelation_json == null ? null : (typeof row.iki_autocorrelation_json === 'object' ? JSON.stringify(row.iki_autocorrelation_json) : row.iki_autocorrelation_json as string),
    digraph_latency_json: row.digraph_latency_json == null ? null : (typeof row.digraph_latency_json === 'object' ? JSON.stringify(row.digraph_latency_json) : row.digraph_latency_json as string),
  } as MotorSignalRow;
}

// ----------------------------------------------------------------------------
// SEMANTIC SIGNALS
// ----------------------------------------------------------------------------

export interface SemanticSignalRow {
  semantic_signal_id: number;
  question_id: number;
  idea_density: number | null;
  lexical_sophistication: number | null;
  epistemic_stance: number | null;
  integrative_complexity: number | null;
  deep_cohesion: number | null;
  referential_cohesion: number | null;
  emotional_valence_arc: string | null;
  text_compression_ratio: number | null;
  lexicon_version: number;
  paste_contaminated: boolean;
}

export async function saveSemanticSignals(questionId: number, s: Omit<SemanticSignalRow, 'semantic_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_semantic_signals (
       question_id, idea_density, lexical_sophistication, epistemic_stance,
       integrative_complexity, deep_cohesion, referential_cohesion,
       emotional_valence_arc, text_compression_ratio, lexicon_version, paste_contaminated
    ) VALUES (
      ${questionId}, ${s.idea_density}, ${s.lexical_sophistication}, ${s.epistemic_stance},
      ${s.integrative_complexity}, ${s.deep_cohesion}, ${s.referential_cohesion},
      ${s.emotional_valence_arc}, ${s.text_compression_ratio}, ${s.lexicon_version}, ${s.paste_contaminated}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING semantic_signal_id
  `;
  return row?.semantic_signal_id ?? 0;
}

export async function getSemanticSignals(questionId: number): Promise<SemanticSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_semantic_signals WHERE question_id = ${questionId}`;
  return (rows[0] as SemanticSignalRow) ?? null;
}

// ----------------------------------------------------------------------------
// PROCESS SIGNALS
// ----------------------------------------------------------------------------

export interface ProcessSignalRow {
  process_signal_id: number;
  question_id: number;
  pause_within_word: number | null;
  pause_between_word: number | null;
  pause_between_sentence: number | null;
  abandoned_thought_count: number | null;
  r_burst_count: number | null;
  i_burst_count: number | null;
  vocab_expansion_rate: number | null;
  phase_transition_point: number | null;
  strategy_shift_count: number | null;
}

export async function saveProcessSignals(questionId: number, s: Omit<ProcessSignalRow, 'process_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_process_signals (
       question_id, pause_within_word, pause_between_word, pause_between_sentence,
       abandoned_thought_count, r_burst_count, i_burst_count,
       vocab_expansion_rate, phase_transition_point, strategy_shift_count
    ) VALUES (
      ${questionId}, ${s.pause_within_word}, ${s.pause_between_word}, ${s.pause_between_sentence},
      ${s.abandoned_thought_count}, ${s.r_burst_count}, ${s.i_burst_count},
      ${s.vocab_expansion_rate}, ${s.phase_transition_point}, ${s.strategy_shift_count}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING process_signal_id
  `;
  return row?.process_signal_id ?? 0;
}

export async function getProcessSignals(questionId: number): Promise<ProcessSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_process_signals WHERE question_id = ${questionId}`;
  return (rows[0] as ProcessSignalRow) ?? null;
}

// ----------------------------------------------------------------------------
// CROSS-SESSION SIGNALS
// ----------------------------------------------------------------------------

export interface CrossSessionSignalRow {
  cross_session_signal_id: number;
  question_id: number;
  self_perplexity: number | null;
  ncd_lag_1: number | null;
  ncd_lag_3: number | null;
  ncd_lag_7: number | null;
  ncd_lag_30: number | null;
  vocab_recurrence_decay: number | null;
  digraph_stability: number | null;
  text_network_density: number | null;
  text_network_communities: number | null;
  bridging_ratio: number | null;
}

export async function saveCrossSessionSignals(questionId: number, s: Omit<CrossSessionSignalRow, 'cross_session_signal_id' | 'question_id'>): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_cross_session_signals (
       question_id, self_perplexity, ncd_lag_1, ncd_lag_3, ncd_lag_7, ncd_lag_30,
       vocab_recurrence_decay, digraph_stability,
       text_network_density, text_network_communities, bridging_ratio
    ) VALUES (
      ${questionId}, ${s.self_perplexity}, ${s.ncd_lag_1}, ${s.ncd_lag_3}, ${s.ncd_lag_7}, ${s.ncd_lag_30},
      ${s.vocab_recurrence_decay}, ${s.digraph_stability},
      ${s.text_network_density}, ${s.text_network_communities}, ${s.bridging_ratio}
    )
    ON CONFLICT (question_id) DO NOTHING
    RETURNING cross_session_signal_id
  `;
  return row?.cross_session_signal_id ?? 0;
}

export async function getCrossSessionSignals(questionId: number): Promise<CrossSessionSignalRow | null> {
  const rows = await sql`SELECT * FROM tb_cross_session_signals WHERE question_id = ${questionId}`;
  return (rows[0] as CrossSessionSignalRow) ?? null;
}

// ----------------------------------------------------------------------------
// RECONSTRUCTION RESIDUALS
// ----------------------------------------------------------------------------

export interface ReconstructionResidualInput {
  adversary_variant_id: number;
  question_source_id: number | null;
  avatar_seed: string | null;
  profile_snapshot_json: string | null;
  corpus_sha256: string | null;
  avatar_topic: string | null;
  avatar_text: string | null;
  avatar_word_count: number | null;
  avatar_markov_order: number | null;
  avatar_chain_size: number | null;
  avatar_i_burst_count: number | null;
  real_word_count: number | null;
  corpus_size: number | null;
  session_count: number | null;
  real_perplexity: number | null;
  real_known_fraction: number | null;
  avatar_perplexity: number | null;
  avatar_known_fraction: number | null;
  perplexity_residual: number | null;
  real_permutation_entropy: number | null;
  avatar_permutation_entropy: number | null;
  residual_permutation_entropy: number | null;
  real_pe_spectrum: string | null;
  avatar_pe_spectrum: string | null;
  residual_pe_spectrum: string | null;
  real_dfa_alpha: number | null;
  avatar_dfa_alpha: number | null;
  residual_dfa_alpha: number | null;
  real_rqa_determinism: number | null;
  avatar_rqa_determinism: number | null;
  residual_rqa_determinism: number | null;
  real_rqa_laminarity: number | null;
  avatar_rqa_laminarity: number | null;
  residual_rqa_laminarity: number | null;
  real_te_dominance: number | null;
  avatar_te_dominance: number | null;
  residual_te_dominance: number | null;
  real_sample_entropy: number | null;
  avatar_sample_entropy: number | null;
  residual_sample_entropy: number | null;
  real_motor_jerk: number | null;
  avatar_motor_jerk: number | null;
  residual_motor_jerk: number | null;
  real_lapse_rate: number | null;
  avatar_lapse_rate: number | null;
  residual_lapse_rate: number | null;
  real_tempo_drift: number | null;
  avatar_tempo_drift: number | null;
  residual_tempo_drift: number | null;
  real_ex_gaussian_tau: number | null;
  avatar_ex_gaussian_tau: number | null;
  residual_ex_gaussian_tau: number | null;
  real_tau_proportion: number | null;
  avatar_tau_proportion: number | null;
  residual_tau_proportion: number | null;
  real_idea_density: number | null;
  avatar_idea_density: number | null;
  residual_idea_density: number | null;
  real_lexical_sophistication: number | null;
  avatar_lexical_sophistication: number | null;
  residual_lexical_sophistication: number | null;
  real_epistemic_stance: number | null;
  avatar_epistemic_stance: number | null;
  residual_epistemic_stance: number | null;
  real_integrative_complexity: number | null;
  avatar_integrative_complexity: number | null;
  residual_integrative_complexity: number | null;
  real_deep_cohesion: number | null;
  avatar_deep_cohesion: number | null;
  residual_deep_cohesion: number | null;
  real_text_compression_ratio: number | null;
  avatar_text_compression_ratio: number | null;
  residual_text_compression_ratio: number | null;
  dynamical_l2_norm: number | null;
  motor_l2_norm: number | null;
  semantic_l2_norm: number | null;
  total_l2_norm: number | null;
  residual_count: number | null;
  behavioral_l2_norm: number | null;
  behavioral_residual_count: number | null;
}

export async function saveReconstructionResidual(
  questionId: number,
  s: ReconstructionResidualInput,
): Promise<number> {
  const [row] = await sql`
    INSERT INTO tb_reconstruction_residuals (
       question_id
      ,adversary_variant_id
      ,question_source_id
      ,avatar_seed, profile_snapshot_json, corpus_sha256, avatar_topic
      ,avatar_text, avatar_word_count, avatar_markov_order, avatar_chain_size
      ,avatar_i_burst_count, real_word_count, corpus_size, session_count
      ,real_perplexity, real_known_fraction, avatar_perplexity, avatar_known_fraction
      ,perplexity_residual
      ,real_permutation_entropy, avatar_permutation_entropy, residual_permutation_entropy
      ,real_pe_spectrum, avatar_pe_spectrum, residual_pe_spectrum
      ,real_dfa_alpha, avatar_dfa_alpha, residual_dfa_alpha
      ,real_rqa_determinism, avatar_rqa_determinism, residual_rqa_determinism
      ,real_rqa_laminarity, avatar_rqa_laminarity, residual_rqa_laminarity
      ,real_te_dominance, avatar_te_dominance, residual_te_dominance
      ,real_sample_entropy, avatar_sample_entropy, residual_sample_entropy
      ,real_motor_jerk, avatar_motor_jerk, residual_motor_jerk
      ,real_lapse_rate, avatar_lapse_rate, residual_lapse_rate
      ,real_tempo_drift, avatar_tempo_drift, residual_tempo_drift
      ,real_ex_gaussian_tau, avatar_ex_gaussian_tau, residual_ex_gaussian_tau
      ,real_tau_proportion, avatar_tau_proportion, residual_tau_proportion
      ,real_idea_density, avatar_idea_density, residual_idea_density
      ,real_lexical_sophistication, avatar_lexical_sophistication, residual_lexical_sophistication
      ,real_epistemic_stance, avatar_epistemic_stance, residual_epistemic_stance
      ,real_integrative_complexity, avatar_integrative_complexity, residual_integrative_complexity
      ,real_deep_cohesion, avatar_deep_cohesion, residual_deep_cohesion
      ,real_text_compression_ratio, avatar_text_compression_ratio, residual_text_compression_ratio
      ,dynamical_l2_norm, motor_l2_norm, semantic_l2_norm, total_l2_norm
      ,residual_count
      ,behavioral_l2_norm, behavioral_residual_count
    ) VALUES (
       ${questionId}
      ,${s.adversary_variant_id}
      ,${s.question_source_id}
      ,${s.avatar_seed}, ${s.profile_snapshot_json}, ${s.corpus_sha256}, ${s.avatar_topic}
      ,${s.avatar_text}, ${s.avatar_word_count}, ${s.avatar_markov_order}, ${s.avatar_chain_size}
      ,${s.avatar_i_burst_count}, ${s.real_word_count}, ${s.corpus_size}, ${s.session_count}
      ,${s.real_perplexity}, ${s.real_known_fraction}, ${s.avatar_perplexity}, ${s.avatar_known_fraction}
      ,${s.perplexity_residual}
      ,${s.real_permutation_entropy}, ${s.avatar_permutation_entropy}, ${s.residual_permutation_entropy}
      ,${s.real_pe_spectrum}, ${s.avatar_pe_spectrum}, ${s.residual_pe_spectrum}
      ,${s.real_dfa_alpha}, ${s.avatar_dfa_alpha}, ${s.residual_dfa_alpha}
      ,${s.real_rqa_determinism}, ${s.avatar_rqa_determinism}, ${s.residual_rqa_determinism}
      ,${s.real_rqa_laminarity}, ${s.avatar_rqa_laminarity}, ${s.residual_rqa_laminarity}
      ,${s.real_te_dominance}, ${s.avatar_te_dominance}, ${s.residual_te_dominance}
      ,${s.real_sample_entropy}, ${s.avatar_sample_entropy}, ${s.residual_sample_entropy}
      ,${s.real_motor_jerk}, ${s.avatar_motor_jerk}, ${s.residual_motor_jerk}
      ,${s.real_lapse_rate}, ${s.avatar_lapse_rate}, ${s.residual_lapse_rate}
      ,${s.real_tempo_drift}, ${s.avatar_tempo_drift}, ${s.residual_tempo_drift}
      ,${s.real_ex_gaussian_tau}, ${s.avatar_ex_gaussian_tau}, ${s.residual_ex_gaussian_tau}
      ,${s.real_tau_proportion}, ${s.avatar_tau_proportion}, ${s.residual_tau_proportion}
      ,${s.real_idea_density}, ${s.avatar_idea_density}, ${s.residual_idea_density}
      ,${s.real_lexical_sophistication}, ${s.avatar_lexical_sophistication}, ${s.residual_lexical_sophistication}
      ,${s.real_epistemic_stance}, ${s.avatar_epistemic_stance}, ${s.residual_epistemic_stance}
      ,${s.real_integrative_complexity}, ${s.avatar_integrative_complexity}, ${s.residual_integrative_complexity}
      ,${s.real_deep_cohesion}, ${s.avatar_deep_cohesion}, ${s.residual_deep_cohesion}
      ,${s.real_text_compression_ratio}, ${s.avatar_text_compression_ratio}, ${s.residual_text_compression_ratio}
      ,${s.dynamical_l2_norm}, ${s.motor_l2_norm}, ${s.semantic_l2_norm}, ${s.total_l2_norm}
      ,${s.residual_count}
      ,${s.behavioral_l2_norm}, ${s.behavioral_residual_count}
    )
    ON CONFLICT (question_id, adversary_variant_id) DO NOTHING
    RETURNING reconstruction_residual_id
  `;
  return (row as { reconstruction_residual_id: number })?.reconstruction_residual_id ?? 0;
}

export async function getReconstructionResidual(questionId: number, variantId: number = 1): Promise<ReconstructionResidualInput | null> {
  const rows = await sql`
    SELECT * FROM tb_reconstruction_residuals
    WHERE question_id = ${questionId} AND adversary_variant_id = ${variantId}
  `;
  return (rows[0] as ReconstructionResidualInput) ?? null;
}

// ----------------------------------------------------------------------------
// SESSION INTEGRITY
// ----------------------------------------------------------------------------

export interface SessionIntegrityInput {
  questionId: number;
  profileDistance: number;
  dimensionCount: number;
  zScoresJson: string;
  isFlagged: boolean;
  thresholdUsed: number;
  profileSessionCount: number;
}

export async function saveSessionIntegrity(s: SessionIntegrityInput): Promise<void> {
  await sql`
    INSERT INTO tb_session_integrity (
       question_id, profile_distance, dimension_count,
       z_scores_json, is_flagged, threshold_used, profile_session_count
    ) VALUES (
      ${s.questionId}, ${s.profileDistance}, ${s.dimensionCount},
      ${s.zScoresJson}, ${s.isFlagged}, ${s.thresholdUsed}, ${s.profileSessionCount}
    )
    ON CONFLICT (question_id) DO NOTHING
  `;
}

export async function getSessionIntegrity(questionId: number): Promise<SessionIntegrityInput | null> {
  const rows = await sql`
    SELECT question_id AS "questionId",
           profile_distance AS "profileDistance",
           dimension_count AS "dimensionCount",
           z_scores_json AS "zScoresJson",
           is_flagged AS "isFlagged",
           threshold_used AS "thresholdUsed",
           profile_session_count AS "profileSessionCount"
    FROM tb_session_integrity
    WHERE question_id = ${questionId}
  `;
  return (rows[0] as SessionIntegrityInput) ?? null;
}

export default sql;
