/**
 * Trajectory Engine
 *
 * Turns per-session behavioral data into a sequence of 4 honest dimensions,
 * z-scored against the person's own baseline. No AI interpretation.
 * Pure math on deterministic signals.
 *
 * Dimensions:
 *   engagement  — how much they gave (duration + word count + sentence count)
 *   processing  — how hard it was to start (first-keystroke latency)
 *   revision    — how much they changed their mind (commitment ratio + deletion intensity)
 *   structure   — how differently they wrote vs. their norm (sentence length + question density + first-person density)
 *
 * Convergence:
 *   Euclidean distance from personal center in 4D space.
 *   High convergence = multiple dimensions moved together = something real happened.
 */

import db from '../db.ts';

// ─── Types ──────────────────────────────────────────────────────────

export interface TrajectoryPoint {
  entryIndex: number;
  responseId: number;
  date: string;
  engagement: number;
  processing: number;
  revision: number;
  structure: number;
  convergence: number;
  convergenceLevel: 'low' | 'moderate' | 'high';
}

export interface TrajectoryAnalysis {
  points: TrajectoryPoint[];
  velocity: number;                  // how fast the trajectory is currently moving
  phase: 'insufficient' | 'stable' | 'shifting' | 'disrupted';
  recentSpikes: number[];            // indices of high-convergence entries
  totalEntries: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

const FIRST_PERSON = new Set(['i', 'me', 'my', 'mine', 'myself']);
const MIN_ENTRIES = 3; // need at least this many for a meaningful baseline

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avg(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function zScore(value: number, mean: number, std: number): number {
  if (std < 0.001) return 0;
  return (value - mean) / std;
}

// ─── Per-entry shape metrics from response text ─────────────────────

interface ShapeMetrics {
  avgSentenceLength: number;
  questionDensity: number;
  firstPersonDensity: number;
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

  return { avgSentenceLength, questionDensity, firstPersonDensity };
}

// ─── Raw session data ───────────────────────────────────────────────

interface SessionRaw {
  responseId: number;
  date: string;
  durationMs: number;
  wordCount: number;
  sentenceCount: number;
  firstKeystrokeMs: number;
  commitmentRatio: number;
  deletionIntensity: number;
  shape: ShapeMetrics;
}

function loadSessions(): SessionRaw[] {
  const rows = db.prepare(`
    SELECT
       ss.session_summary_id
      ,r.response_id
      ,q.scheduled_for as date
      ,ss.total_duration_ms
      ,ss.word_count
      ,ss.sentence_count
      ,ss.first_keystroke_ms
      ,ss.commitment_ratio
      ,CASE WHEN ss.total_chars_typed > 0
            THEN CAST(ss.total_chars_deleted AS REAL) / ss.total_chars_typed
            ELSE 0 END as deletion_intensity
      ,r.text
    FROM tb_session_summaries ss
    JOIN tb_responses r ON ss.question_id = r.question_id
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
    ORDER BY ss.session_summary_id ASC
  `).all() as any[];

  return rows.map(row => ({
    responseId: row.response_id,
    date: row.date || '',
    durationMs: row.total_duration_ms ?? 0,
    wordCount: row.word_count ?? 0,
    sentenceCount: row.sentence_count ?? 0,
    firstKeystrokeMs: row.first_keystroke_ms ?? 0,
    commitmentRatio: row.commitment_ratio ?? 1,
    deletionIntensity: row.deletion_intensity ?? 0,
    shape: computeShape(row.text || ''),
  }));
}

// ─── Trajectory computation ─────────────────────────────────────────

function computePoints(sessions: SessionRaw[]): TrajectoryPoint[] {
  if (sessions.length < MIN_ENTRIES) return [];

  // Personal baselines
  const baseline = {
    durationMs:       { mean: avg(sessions.map(s => s.durationMs)),       std: stddev(sessions.map(s => s.durationMs)) },
    wordCount:        { mean: avg(sessions.map(s => s.wordCount)),        std: stddev(sessions.map(s => s.wordCount)) },
    sentenceCount:    { mean: avg(sessions.map(s => s.sentenceCount)),    std: stddev(sessions.map(s => s.sentenceCount)) },
    firstKeystrokeMs: { mean: avg(sessions.map(s => s.firstKeystrokeMs)), std: stddev(sessions.map(s => s.firstKeystrokeMs)) },
    commitmentRatio:  { mean: avg(sessions.map(s => s.commitmentRatio)),  std: stddev(sessions.map(s => s.commitmentRatio)) },
    deletionIntensity:{ mean: avg(sessions.map(s => s.deletionIntensity)),std: stddev(sessions.map(s => s.deletionIntensity)) },
    avgSentenceLen:   { mean: avg(sessions.map(s => s.shape.avgSentenceLength)),   std: stddev(sessions.map(s => s.shape.avgSentenceLength)) },
    questionDensity:  { mean: avg(sessions.map(s => s.shape.questionDensity)),  std: stddev(sessions.map(s => s.shape.questionDensity)) },
    firstPersonDen:   { mean: avg(sessions.map(s => s.shape.firstPersonDensity)),   std: stddev(sessions.map(s => s.shape.firstPersonDensity)) },
  };

  const z = (key: keyof typeof baseline, value: number) =>
    zScore(value, baseline[key].mean, baseline[key].std);

  return sessions.map((session, index) => {
    // Engagement: duration + word count + sentence count (averaged)
    const engagement = (
      z('durationMs', session.durationMs) +
      z('wordCount', session.wordCount) +
      z('sentenceCount', session.sentenceCount)
    ) / 3;

    // Processing: first-keystroke latency
    const processing = z('firstKeystrokeMs', session.firstKeystrokeMs);

    // Revision: inverted commitment (low commitment = high revision) + deletion intensity
    const revision = (
      -z('commitmentRatio', session.commitmentRatio) +
      z('deletionIntensity', session.deletionIntensity)
    ) / 2;

    // Structure: absolute deviation in sentence length, question density, first-person density
    // Absolute because we care about HOW DIFFERENT, not which direction
    const structure = (
      Math.abs(z('avgSentenceLen', session.shape.avgSentenceLength)) +
      Math.abs(z('questionDensity', session.shape.questionDensity)) +
      Math.abs(z('firstPersonDen', session.shape.firstPersonDensity))
    ) / 3;

    // Convergence: Euclidean distance from personal center in 4D space
    const raw = Math.sqrt(
      engagement ** 2 +
      processing ** 2 +
      revision ** 2 +
      structure ** 2
    );
    // Normalize: distance of 2 (all dimensions at 1σ) → 0.5, distance of 4+ → 1.0
    const convergence = Math.min(1, raw / 4);

    const convergenceLevel: TrajectoryPoint['convergenceLevel'] =
      convergence >= 0.6 ? 'high' :
      convergence >= 0.35 ? 'moderate' : 'low';

    return {
      entryIndex: index,
      responseId: session.responseId,
      date: session.date,
      engagement,
      processing,
      revision,
      structure,
      convergence,
      convergenceLevel,
    };
  });
}

// ─── Phase detection ────────────────────────────────────────────────

function detectPhase(points: TrajectoryPoint[]): TrajectoryAnalysis['phase'] {
  if (points.length < MIN_ENTRIES) return 'insufficient';

  const recent = points.slice(-5);

  // Check for disruption: latest point has high convergence after stable period
  const latest = recent[recent.length - 1];
  const beforeLatest = recent.slice(0, -1);
  const priorAvgConvergence = avg(beforeLatest.map(p => p.convergence));

  if (latest.convergence > 0.6 && priorAvgConvergence < 0.35) {
    return 'disrupted';
  }

  // Check for shifting: consistent directional movement in any dimension
  if (recent.length >= 3) {
    const dims: Array<keyof Pick<TrajectoryPoint, 'engagement' | 'processing' | 'revision'>> =
      ['engagement', 'processing', 'revision'];
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
      (curr.engagement - prev.engagement) ** 2 +
      (curr.processing - prev.processing) ** 2 +
      (curr.revision - prev.revision) ** 2 +
      (curr.structure - prev.structure) ** 2
    );
    totalDist += dist;
  }

  const avgDist = totalDist / (recent.length - 1);
  // Normalize: average movement of 2 (significant shift each entry) → 1.0
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
