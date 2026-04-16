/**
 * 7D Deterministic Behavioral State Engine
 *
 * Computes a per-entry behavioral state vector from raw session data.
 * Each entry produces one point in 7-dimensional behavioral space.
 * All values are z-scored against personal history. No AI. Pure math.
 *
 * As of 2026-04-16 (slice 3): `expression` was pulled out of PersDyn and
 * relocated to a parallel semantic state space (see semantic-space.ts).
 * The behavioral and semantic spaces are kept orthogonal at construction
 * time so coupling discovery and joint-embedding work downstream remain
 * meaningful. Prior 8D vectors are archived under
 * zz_archive_entry_states_8d_20260416.
 *
 * Dimensions (research-validated):
 *   fluency      — P-burst length: sustained production flow (Chenoweth & Hayes 2001, Deane 2015)
 *   deliberation — hesitation + pause rate + revision weight: cognitive load (Deane 2015)
 *   revision     — commitment ratio + substantive deletion rate (Baaijen et al. 2012)
 *   commitment   — final/typed ratio: how much they kept (z-scored)
 *   volatility   — behavioral distance from previous entry: session-to-session instability
 *   thermal      — correction intensity + revision timing: editing heat (Faigley & Witte 1981)
 *   presence     — inverse distraction: low tab-away + low pause rate = high presence
 *
 * Convergence:
 *   Euclidean distance from personal center in 7D space.
 *   Normalized to [0, 1]. High convergence = multiple dimensions moved together.
 */

import db from '../db.ts';
import { avg, stddev } from './helpers.ts';

// ─── Types ──────────────────────────────────────────────────────────

export const STATE_DIMENSIONS = [
  'fluency', 'deliberation', 'revision',
  'commitment', 'volatility', 'thermal', 'presence',
] as const;

export type StateDimension = typeof STATE_DIMENSIONS[number];

export interface EntryState {
  entryIndex: number;
  responseId: number;
  date: string;
  fluency: number;
  deliberation: number;
  revision: number;
  commitment: number;
  volatility: number;
  thermal: number;
  presence: number;
  convergence: number;
  convergenceLevel: 'low' | 'moderate' | 'high';
}

// ─── Helpers ────────────────────────────────────────────────────────

const MIN_ENTRIES = 3;

function zScore(value: number, mean: number, std: number): number {
  if (std < 0.001) return 0;
  return (value - mean) / std;
}

// ─── Raw session data ───────────────────────────────────────────────

interface SessionRaw {
  responseId: number;
  date: string;
  // Fluency
  avgPBurstLength: number;
  charsPerMinute: number;
  // Deliberation
  firstKeystrokeMs: number;
  pauseRatePerMinute: number;
  revisionWeight: number;
  // Revision
  commitmentRatio: number;
  revisionRate: number;
  // Thermal
  correctionRate: number;
  revisionTiming: number;
  // Presence
  tabAwayRatePerMinute: number;
}

export function loadSessions(): SessionRaw[] {
  const rows = db.prepare(`
    SELECT
       ss.session_summary_id
      ,r.response_id
      ,q.scheduled_for as date
      ,ss.first_keystroke_ms
      ,ss.commitment_ratio
      ,ss.pause_count
      ,ss.total_pause_ms
      ,ss.total_tab_away_ms
      ,ss.total_duration_ms
      ,ss.total_chars_typed
      ,ss.total_chars_deleted
      ,ss.active_typing_ms
      ,ss.chars_per_minute
      ,ss.p_burst_count
      ,ss.avg_p_burst_length
      ,ss.large_deletion_count
      ,ss.large_deletion_chars
      ,ss.small_deletion_count
      ,ss.tab_away_count
      ,ss.second_half_deletion_chars
      ,ss.first_half_deletion_chars
    FROM tb_session_summaries ss
    JOIN tb_responses r ON ss.question_id = r.question_id
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY ss.session_summary_id ASC
  `).all() as any[];

  return rows.map(row => {
    const totalCharsTyped = row.total_chars_typed || 1;
    const durationMs = row.total_duration_ms || 1;

    const activeMs = row.active_typing_ms != null
      ? Math.max(1, row.active_typing_ms)
      : Math.max(1, durationMs - (row.total_pause_ms || 0) - (row.total_tab_away_ms || 0));
    const activeMinutes = activeMs / 60000;

    const avgPBurstLength = row.avg_p_burst_length != null && row.avg_p_burst_length > 0
      ? row.avg_p_burst_length
      : 0;

    const charsPerMinute = row.chars_per_minute != null
      ? row.chars_per_minute
      : totalCharsTyped / activeMinutes;

    const pauseRatePerMinute = activeMinutes > 0 ? (row.pause_count || 0) / activeMinutes : 0;

    const revisionWeight = row.large_deletion_chars != null
      ? (row.large_deletion_chars / totalCharsTyped)
      : ((row.total_chars_deleted || 0) / totalCharsTyped);

    const largeDeletionCount = row.large_deletion_count != null
      ? row.large_deletion_count
      : (row.total_chars_deleted > 0 && (row.largest_deletion || 0) >= 10 ? 1 : 0);
    const revisionRate = totalCharsTyped > 0 ? largeDeletionCount / (totalCharsTyped / 100) : 0;

    // Correction rate: small deletions per 100 chars typed
    let smallDelCount = row.small_deletion_count;
    if (smallDelCount == null) {
      const delCount = row.deletion_count || 0;
      const largest = row.largest_deletion || 0;
      smallDelCount = largest >= 10 && delCount > 0 ? Math.max(0, delCount - 1) : delCount;
    }
    const correctionRate = totalCharsTyped > 0 ? smallDelCount / (totalCharsTyped / 100) : 0;

    // Revision timing: 0 = early revisions, 1 = late revisions
    let revisionTiming = 0.5;
    const totalLargeDel = (row.first_half_deletion_chars || 0) + (row.second_half_deletion_chars || 0);
    if (totalLargeDel > 0) {
      revisionTiming = (row.second_half_deletion_chars || 0) / totalLargeDel;
    }

    // Tab-away rate per active minute
    const tabAwayRatePerMinute = activeMinutes > 0 ? (row.tab_away_count || 0) / activeMinutes : 0;

    return {
      responseId: row.response_id,
      date: row.date || '',
      avgPBurstLength,
      charsPerMinute,
      firstKeystrokeMs: row.first_keystroke_ms ?? 0,
      pauseRatePerMinute,
      revisionWeight,
      commitmentRatio: row.commitment_ratio ?? 1,
      revisionRate,
      correctionRate,
      revisionTiming,
      tabAwayRatePerMinute,
    };
  });
}

// ─── 7D State computation ──────────────────────────────────────────

export function computeEntryStates(sessions?: SessionRaw[]): EntryState[] {
  if (!sessions) sessions = loadSessions();
  if (sessions.length < MIN_ENTRIES) return [];

  const hasBurstData = sessions.some(s => s.avgPBurstLength > 0);

  // Personal baselines for all raw metrics
  const baseline = {
    // Fluency
    avgPBurstLength:    { mean: avg(sessions.map(s => s.avgPBurstLength)),    std: stddev(sessions.map(s => s.avgPBurstLength)) },
    charsPerMinute:     { mean: avg(sessions.map(s => s.charsPerMinute)),     std: stddev(sessions.map(s => s.charsPerMinute)) },
    // Deliberation
    firstKeystrokeMs:   { mean: avg(sessions.map(s => s.firstKeystrokeMs)),   std: stddev(sessions.map(s => s.firstKeystrokeMs)) },
    pauseRatePerMinute: { mean: avg(sessions.map(s => s.pauseRatePerMinute)), std: stddev(sessions.map(s => s.pauseRatePerMinute)) },
    revisionWeight:     { mean: avg(sessions.map(s => s.revisionWeight)),     std: stddev(sessions.map(s => s.revisionWeight)) },
    // Revision
    commitmentRatio:    { mean: avg(sessions.map(s => s.commitmentRatio)),    std: stddev(sessions.map(s => s.commitmentRatio)) },
    revisionRate:       { mean: avg(sessions.map(s => s.revisionRate)),       std: stddev(sessions.map(s => s.revisionRate)) },
    // Thermal
    correctionRate:     { mean: avg(sessions.map(s => s.correctionRate)),     std: stddev(sessions.map(s => s.correctionRate)) },
    revisionTiming:     { mean: avg(sessions.map(s => s.revisionTiming)),     std: stddev(sessions.map(s => s.revisionTiming)) },
    // Presence
    tabAwayRate:        { mean: avg(sessions.map(s => s.tabAwayRatePerMinute)), std: stddev(sessions.map(s => s.tabAwayRatePerMinute)) },
  };

  const z = (key: keyof typeof baseline, value: number) =>
    zScore(value, baseline[key].mean, baseline[key].std);

  return sessions.map((session, index) => {
    // ── Fluency: P-burst length (primary) or chars/min (fallback) ──
    const fluency = hasBurstData
      ? z('avgPBurstLength', session.avgPBurstLength)
      : z('charsPerMinute', session.charsPerMinute);

    // ── Deliberation: hesitation + pause rate + revision weight ──
    const deliberation = (
      z('firstKeystrokeMs', session.firstKeystrokeMs) +
      z('pauseRatePerMinute', session.pauseRatePerMinute) +
      z('revisionWeight', session.revisionWeight)
    ) / 3;

    // ── Revision: inverted commitment + substantive deletion rate ──
    const revision = (
      -z('commitmentRatio', session.commitmentRatio) +
      z('revisionRate', session.revisionRate)
    ) / 2;

    // ── Commitment: how much they kept (z-scored, positive = kept more) ──
    const commitment = z('commitmentRatio', session.commitmentRatio);

    // ── Volatility: behavioral distance from previous entry ──
    let volatility = 0;
    if (index > 0) {
      const prev = sessions[index - 1];
      const prevFluency = hasBurstData
        ? z('avgPBurstLength', prev.avgPBurstLength)
        : z('charsPerMinute', prev.charsPerMinute);
      const prevDeliberation = (
        z('firstKeystrokeMs', prev.firstKeystrokeMs) +
        z('pauseRatePerMinute', prev.pauseRatePerMinute) +
        z('revisionWeight', prev.revisionWeight)
      ) / 3;
      const prevRevision = (
        -z('commitmentRatio', prev.commitmentRatio) +
        z('revisionRate', prev.revisionRate)
      ) / 2;
      const prevCommitment = z('commitmentRatio', prev.commitmentRatio);

      volatility = Math.sqrt(
        (fluency - prevFluency) ** 2 +
        (deliberation - prevDeliberation) ** 2 +
        (revision - prevRevision) ** 2 +
        (commitment - prevCommitment) ** 2
      );
    }

    // ── Thermal: editing heat — correction intensity + late revision timing ──
    // High thermal = lots of corrections AND late-stage revisions (Faigley & Witte 1981)
    const thermal = (
      z('correctionRate', session.correctionRate) +
      z('revisionTiming', session.revisionTiming)
    ) / 2;

    // ── Presence: inverse distraction — low tab-away + low pause rate ──
    // Negate both so high presence = low distraction
    const presence = -(
      z('tabAwayRate', session.tabAwayRatePerMinute) +
      z('pauseRatePerMinute', session.pauseRatePerMinute)
    ) / 2;

    // ── Convergence: Euclidean distance from personal center in 7D ──
    const raw = Math.sqrt(
      fluency ** 2 +
      deliberation ** 2 +
      revision ** 2 +
      commitment ** 2 +
      volatility ** 2 +
      thermal ** 2 +
      presence ** 2
    );
    // Expected max ≈ sqrt(7) * typical-z-magnitude; keep prior normalization
    // scale (was /6 for 8D — 7D divisor is /5.6 to preserve [0,1] bounds for
    // typical z-deviations).
    const convergence = Math.min(1, raw / 5.6);

    const convergenceLevel: EntryState['convergenceLevel'] =
      convergence >= 0.6 ? 'high' :
      convergence >= 0.35 ? 'moderate' : 'low';

    return {
      entryIndex: index,
      responseId: session.responseId,
      date: session.date,
      fluency,
      deliberation,
      revision,
      commitment,
      volatility,
      thermal,
      presence,
      convergence,
      convergenceLevel,
    };
  });
}
