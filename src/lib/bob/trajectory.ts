/**
 * Trajectory Engine
 *
 * Turns per-session behavioral data into a sequence of 4 independent dimensions,
 * z-scored against the person's own baseline. No AI interpretation.
 * Pure math on deterministic signals.
 *
 * Dimensions (research-validated independence):
 *   fluency      — P-burst length: sustained production flow (Chenoweth & Hayes 2001, Deane 2015)
 *   deliberation — hesitation + pause rate + revision weight: cognitive load (Deane 2015)
 *   revision     — commitment ratio + substantive deletion rate (Baaijen et al. 2012)
 *   expression   — linguistic deviation from personal norm (sentence length, questions, pronouns, hedging)
 *
 * Convergence:
 *   Euclidean distance from personal center in 4D space.
 *   High convergence = multiple dimensions moved together = something real happened.
 */

import db from '../db.ts';
import { avg, stddev, FIRST_PERSON, HEDGING_WORDS } from './helpers.ts';

// ─── Types ──────────────────────────────────────────────────────────

export interface TrajectoryPoint {
  entryIndex: number;
  responseId: number;
  date: string;
  fluency: number;
  deliberation: number;
  revision: number;
  expression: number;
  convergence: number;
  convergenceLevel: 'low' | 'moderate' | 'high';
}

export interface TrajectoryAnalysis {
  points: TrajectoryPoint[];
  velocity: number;
  phase: 'insufficient' | 'stable' | 'shifting' | 'disrupted';
  recentSpikes: number[];
  totalEntries: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

const MIN_ENTRIES = 3;

function zScore(value: number, mean: number, std: number): number {
  if (std < 0.001) return 0;
  return (value - mean) / std;
}

// ─── Per-entry shape metrics from response text ─────────────────────

interface ShapeMetrics {
  avgSentenceLength: number;
  questionDensity: number;
  firstPersonDensity: number;
  hedgingDensity: number;
}

function computeShape(text: string): ShapeMetrics {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.toLowerCase()
    .replace(/[^a-z'\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);

  const avgSentenceLength = sentences.length > 0
    ? words.length / sentences.length : 0;

  const questionCount = (text.match(/\?/g) || []).length;
  const questionDensity = sentences.length > 0
    ? questionCount / sentences.length : 0;

  const fpCount = words.filter(w => FIRST_PERSON.has(w)).length;
  const firstPersonDensity = words.length > 0 ? fpCount / words.length : 0;

  const hedgeCount = words.filter(w => HEDGING_WORDS.has(w)).length;
  const hedgingDensity = words.length > 0 ? hedgeCount / words.length : 0;

  return { avgSentenceLength, questionDensity, firstPersonDensity, hedgingDensity };
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
  // Expression
  shape: ShapeMetrics;
}

function loadSessions(): SessionRaw[] {
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
      ,ss.tab_away_count
      ,r.text
    FROM tb_session_summaries ss
    JOIN tb_responses r ON ss.question_id = r.question_id
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
    ORDER BY ss.session_summary_id ASC
  `).all() as any[];

  return rows.map(row => {
    const totalCharsTyped = row.total_chars_typed || 1;
    const durationMs = row.total_duration_ms || 1;

    // Active typing time (fallback for pre-migration)
    const activeMs = row.active_typing_ms != null
      ? Math.max(1, row.active_typing_ms)
      : Math.max(1, durationMs - (row.total_pause_ms || 0) - (row.total_tab_away_ms || 0));
    const activeMinutes = activeMs / 60000;

    // P-burst length (fallback: chars per minute as proxy)
    const avgPBurstLength = row.avg_p_burst_length != null && row.avg_p_burst_length > 0
      ? row.avg_p_burst_length
      : 0;

    const charsPerMinute = row.chars_per_minute != null
      ? row.chars_per_minute
      : totalCharsTyped / activeMinutes;

    // Pause rate per active minute
    const pauseRatePerMinute = activeMinutes > 0 ? (row.pause_count || 0) / activeMinutes : 0;

    // Revision weight (fallback for pre-migration)
    const revisionWeight = row.large_deletion_chars != null
      ? (row.large_deletion_chars / totalCharsTyped)
      : ((row.total_chars_deleted || 0) / totalCharsTyped);

    // Revision rate (large deletions per 100 chars)
    const largeDeletionCount = row.large_deletion_count != null
      ? row.large_deletion_count
      : (row.total_chars_deleted > 0 && (row.largest_deletion || 0) >= 10 ? 1 : 0);
    const revisionRate = totalCharsTyped > 0 ? largeDeletionCount / (totalCharsTyped / 100) : 0;

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
      shape: computeShape(row.text || ''),
    };
  });
}

// ─── Trajectory computation ─────────────────────────────────────────

function computePoints(sessions: SessionRaw[]): TrajectoryPoint[] {
  if (sessions.length < MIN_ENTRIES) return [];

  // Determine if we have P-burst data
  const hasBurstData = sessions.some(s => s.avgPBurstLength > 0);

  // Personal baselines
  const baseline = {
    // Fluency
    avgPBurstLength: { mean: avg(sessions.map(s => s.avgPBurstLength)), std: stddev(sessions.map(s => s.avgPBurstLength)) },
    charsPerMinute:  { mean: avg(sessions.map(s => s.charsPerMinute)),  std: stddev(sessions.map(s => s.charsPerMinute)) },
    // Deliberation
    firstKeystrokeMs:   { mean: avg(sessions.map(s => s.firstKeystrokeMs)),   std: stddev(sessions.map(s => s.firstKeystrokeMs)) },
    pauseRatePerMinute: { mean: avg(sessions.map(s => s.pauseRatePerMinute)), std: stddev(sessions.map(s => s.pauseRatePerMinute)) },
    revisionWeight:     { mean: avg(sessions.map(s => s.revisionWeight)),     std: stddev(sessions.map(s => s.revisionWeight)) },
    // Revision
    commitmentRatio: { mean: avg(sessions.map(s => s.commitmentRatio)), std: stddev(sessions.map(s => s.commitmentRatio)) },
    revisionRate:    { mean: avg(sessions.map(s => s.revisionRate)),    std: stddev(sessions.map(s => s.revisionRate)) },
    // Expression
    avgSentenceLen:     { mean: avg(sessions.map(s => s.shape.avgSentenceLength)),   std: stddev(sessions.map(s => s.shape.avgSentenceLength)) },
    questionDensity:    { mean: avg(sessions.map(s => s.shape.questionDensity)),      std: stddev(sessions.map(s => s.shape.questionDensity)) },
    firstPersonDensity: { mean: avg(sessions.map(s => s.shape.firstPersonDensity)),   std: stddev(sessions.map(s => s.shape.firstPersonDensity)) },
    hedgingDensity:     { mean: avg(sessions.map(s => s.shape.hedgingDensity)),       std: stddev(sessions.map(s => s.shape.hedgingDensity)) },
  };

  const z = (key: keyof typeof baseline, value: number) =>
    zScore(value, baseline[key].mean, baseline[key].std);

  return sessions.map((session, index) => {
    // Fluency: P-burst length (primary) or chars/min (fallback)
    const fluency = hasBurstData
      ? z('avgPBurstLength', session.avgPBurstLength)
      : z('charsPerMinute', session.charsPerMinute);

    // Deliberation: hesitation + pause rate + revision weight
    const deliberation = (
      z('firstKeystrokeMs', session.firstKeystrokeMs) +
      z('pauseRatePerMinute', session.pauseRatePerMinute) +
      z('revisionWeight', session.revisionWeight)
    ) / 3;

    // Revision: inverted commitment + substantive deletion rate
    const revision = (
      -z('commitmentRatio', session.commitmentRatio) +
      z('revisionRate', session.revisionRate)
    ) / 2;

    // Expression: absolute linguistic deviation from norm (4 components)
    const expression = (
      Math.abs(z('avgSentenceLen', session.shape.avgSentenceLength)) +
      Math.abs(z('questionDensity', session.shape.questionDensity)) +
      Math.abs(z('firstPersonDensity', session.shape.firstPersonDensity)) +
      Math.abs(z('hedgingDensity', session.shape.hedgingDensity))
    ) / 4;

    // Convergence: Euclidean distance from personal center in 4D
    const raw = Math.sqrt(
      fluency ** 2 +
      deliberation ** 2 +
      revision ** 2 +
      expression ** 2
    );
    const convergence = Math.min(1, raw / 4);

    const convergenceLevel: TrajectoryPoint['convergenceLevel'] =
      convergence >= 0.6 ? 'high' :
      convergence >= 0.35 ? 'moderate' : 'low';

    return {
      entryIndex: index,
      responseId: session.responseId,
      date: session.date,
      fluency,
      deliberation,
      revision,
      expression,
      convergence,
      convergenceLevel,
    };
  });
}

// ─── Phase detection ────────────────────────────────────────────────

function detectPhase(points: TrajectoryPoint[]): TrajectoryAnalysis['phase'] {
  if (points.length < MIN_ENTRIES) return 'insufficient';

  const recent = points.slice(-5);
  const latest = recent[recent.length - 1];
  const beforeLatest = recent.slice(0, -1);
  const priorAvgConvergence = avg(beforeLatest.map(p => p.convergence));

  if (latest.convergence > 0.6 && priorAvgConvergence < 0.35) {
    return 'disrupted';
  }

  if (recent.length >= 3) {
    const dims: Array<keyof Pick<TrajectoryPoint, 'fluency' | 'deliberation' | 'revision'>> =
      ['fluency', 'deliberation', 'revision'];
    for (const dim of dims) {
      const values = recent.map(p => p[dim]);
      let increasing = 0;
      let decreasing = 0;
      for (let i = 1; i < values.length; i++) {
        if (values[i] > values[i - 1]) increasing++;
        else if (values[i] < values[i - 1]) decreasing++;
      }
      const trend = Math.max(increasing, decreasing) / (values.length - 1);
      if (trend >= 0.75) return 'shifting';
    }
  }

  return 'stable';
}

// ─── Velocity ───────────────────────────────────────────────────────

function computeVelocity(points: TrajectoryPoint[]): number {
  if (points.length < 2) return 0;

  const recent = points.slice(-5);
  let totalDist = 0;

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    const dist = Math.sqrt(
      (curr.fluency - prev.fluency) ** 2 +
      (curr.deliberation - prev.deliberation) ** 2 +
      (curr.revision - prev.revision) ** 2 +
      (curr.expression - prev.expression) ** 2
    );
    totalDist += dist;
  }

  const avgDist = totalDist / (recent.length - 1);
  return Math.min(1, avgDist / 2);
}

// ─── Public API ─────────────────────────────────────────────────────

export function computeTrajectory(): TrajectoryAnalysis {
  const sessions = loadSessions();

  if (sessions.length < MIN_ENTRIES) {
    return {
      points: [],
      velocity: 0,
      phase: 'insufficient',
      recentSpikes: [],
      totalEntries: sessions.length,
    };
  }

  const points = computePoints(sessions);
  const velocity = computeVelocity(points);
  const phase = detectPhase(points);
  const recentSpikes = points
    .filter(p => p.convergenceLevel === 'high')
    .map(p => p.entryIndex);

  return {
    points,
    velocity,
    phase,
    recentSpikes,
    totalEntries: sessions.length,
  };
}
