/**
 * Semantic State Engine
 *
 * Parallel structure to state-engine.ts. Computes a per-entry semantic state
 * vector from session linguistic densities. Z-scored against personal
 * history. No AI in the deterministic path.
 *
 * Slice 3 (2026-04-16) introduced this module when `expression` was pulled
 * out of the behavioral PersDyn space. Behavioral 7D and semantic ND are
 * kept orthogonal at construction time so coupling discovery and joint
 * embedding work downstream remain meaningful.
 *
 * Dimensions (deterministic, populated now — 11):
 *   syntactic_complexity   — z(avg sentence length)               Biber 1988
 *   interrogation          — z(question density)                  Biber 1988
 *   self_focus             — z(first-person pronoun density)      Pennebaker 1997
 *   uncertainty            — z(hedging density)                   Pennebaker 1997
 *   cognitive_processing   — z(cognitive mechanism density)       Pennebaker 1997
 *   nrc_anger / nrc_fear / nrc_joy / nrc_sadness / nrc_trust /
 *   nrc_anticipation       — z(NRC emotion lexicon densities)     Mohammad & Turney 2013
 *
 * LLM-extracted features (sentiment, abstraction, agency_framing,
 * temporal_orientation) are schema-ready in tb_semantic_states but excluded
 * from SEMANTIC_DIMENSIONS until extraction is wired up.
 *
 * Convergence:
 *   Euclidean distance from personal center in semantic-D space.
 *   Normalized to [0, 1]. High convergence = a large coordinated semantic
 *   shift (multiple densities deviated together).
 */

import db from '../db.ts';
import { avg, stddev } from './helpers.ts';

// ─── Types ──────────────────────────────────────────────────────────

export const SEMANTIC_DIMENSIONS = [
  'syntactic_complexity',
  'interrogation',
  'self_focus',
  'uncertainty',
  'cognitive_processing',
  'nrc_anger',
  'nrc_fear',
  'nrc_joy',
  'nrc_sadness',
  'nrc_trust',
  'nrc_anticipation',
] as const;

export type SemanticDimension = typeof SEMANTIC_DIMENSIONS[number];

export interface SemanticEntryState {
  entryIndex: number;
  responseId: number;
  date: string;
  // Deterministic
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
  // LLM-extracted (null until extraction lands)
  sentiment: number | null;
  abstraction: number | null;
  agency_framing: number | null;
  temporal_orientation: number | null;
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

interface SemanticRaw {
  responseId: number;
  date: string;
  // Linguistic densities (raw, not z-scored)
  avgSentenceLength: number;
  questionDensity: number;
  firstPersonDensity: number;
  hedgingDensity: number;
  cognitiveDensity: number;
  nrcAngerDensity: number;
  nrcFearDensity: number;
  nrcJoyDensity: number;
  nrcSadnessDensity: number;
  nrcTrustDensity: number;
  nrcAnticipationDensity: number;
}

/**
 * Question density — questions per sentence — is not persisted as a column
 * on tb_session_summaries (only avg_sentence_length and the NRC + Pennebaker
 * densities are). Compute it on-the-fly from the response text, matching
 * what the legacy 8D state-engine did with `computeShape(text)`.
 */
function questionDensityFromText(text: string): number {
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return 0;
  const questionCount = (text.match(/\?/g) || []).length;
  return questionCount / sentences.length;
}

export function loadSemanticSessions(): SemanticRaw[] {
  const rows = db.prepare(`
    SELECT
       r.response_id
      ,q.scheduled_for as date
      ,r.text as response_text
      ,ss.avg_sentence_length
      ,ss.first_person_density
      ,ss.hedging_density
      ,ss.cognitive_density
      ,ss.nrc_anger_density
      ,ss.nrc_fear_density
      ,ss.nrc_joy_density
      ,ss.nrc_sadness_density
      ,ss.nrc_trust_density
      ,ss.nrc_anticipation_density
    FROM tb_session_summaries ss
    JOIN tb_responses r ON ss.question_id = r.question_id
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE q.question_source_id != 3
    ORDER BY ss.session_summary_id ASC
  `).all() as any[];

  return rows.map(row => ({
    responseId: row.response_id,
    date: row.date || '',
    avgSentenceLength: row.avg_sentence_length ?? 0,
    questionDensity: questionDensityFromText(row.response_text || ''),
    firstPersonDensity: row.first_person_density ?? 0,
    hedgingDensity: row.hedging_density ?? 0,
    cognitiveDensity: row.cognitive_density ?? 0,
    nrcAngerDensity: row.nrc_anger_density ?? 0,
    nrcFearDensity: row.nrc_fear_density ?? 0,
    nrcJoyDensity: row.nrc_joy_density ?? 0,
    nrcSadnessDensity: row.nrc_sadness_density ?? 0,
    nrcTrustDensity: row.nrc_trust_density ?? 0,
    nrcAnticipationDensity: row.nrc_anticipation_density ?? 0,
  }));
}

// ─── Semantic state computation ────────────────────────────────────

export function computeSemanticStates(sessions?: SemanticRaw[]): SemanticEntryState[] {
  if (!sessions) sessions = loadSemanticSessions();
  if (sessions.length < MIN_ENTRIES) return [];

  // Personal baselines for all raw densities
  const baseline = {
    avgSentenceLength:       { mean: avg(sessions.map(s => s.avgSentenceLength)),       std: stddev(sessions.map(s => s.avgSentenceLength)) },
    questionDensity:         { mean: avg(sessions.map(s => s.questionDensity)),         std: stddev(sessions.map(s => s.questionDensity)) },
    firstPersonDensity:      { mean: avg(sessions.map(s => s.firstPersonDensity)),      std: stddev(sessions.map(s => s.firstPersonDensity)) },
    hedgingDensity:          { mean: avg(sessions.map(s => s.hedgingDensity)),          std: stddev(sessions.map(s => s.hedgingDensity)) },
    cognitiveDensity:        { mean: avg(sessions.map(s => s.cognitiveDensity)),        std: stddev(sessions.map(s => s.cognitiveDensity)) },
    nrcAngerDensity:         { mean: avg(sessions.map(s => s.nrcAngerDensity)),         std: stddev(sessions.map(s => s.nrcAngerDensity)) },
    nrcFearDensity:          { mean: avg(sessions.map(s => s.nrcFearDensity)),          std: stddev(sessions.map(s => s.nrcFearDensity)) },
    nrcJoyDensity:           { mean: avg(sessions.map(s => s.nrcJoyDensity)),           std: stddev(sessions.map(s => s.nrcJoyDensity)) },
    nrcSadnessDensity:       { mean: avg(sessions.map(s => s.nrcSadnessDensity)),       std: stddev(sessions.map(s => s.nrcSadnessDensity)) },
    nrcTrustDensity:         { mean: avg(sessions.map(s => s.nrcTrustDensity)),         std: stddev(sessions.map(s => s.nrcTrustDensity)) },
    nrcAnticipationDensity:  { mean: avg(sessions.map(s => s.nrcAnticipationDensity)),  std: stddev(sessions.map(s => s.nrcAnticipationDensity)) },
  };

  const z = (key: keyof typeof baseline, value: number) =>
    zScore(value, baseline[key].mean, baseline[key].std);

  return sessions.map((session, index) => {
    const syntactic_complexity = z('avgSentenceLength', session.avgSentenceLength);
    const interrogation        = z('questionDensity', session.questionDensity);
    const self_focus           = z('firstPersonDensity', session.firstPersonDensity);
    const uncertainty          = z('hedgingDensity', session.hedgingDensity);
    const cognitive_processing = z('cognitiveDensity', session.cognitiveDensity);
    const nrc_anger            = z('nrcAngerDensity', session.nrcAngerDensity);
    const nrc_fear             = z('nrcFearDensity', session.nrcFearDensity);
    const nrc_joy              = z('nrcJoyDensity', session.nrcJoyDensity);
    const nrc_sadness          = z('nrcSadnessDensity', session.nrcSadnessDensity);
    const nrc_trust            = z('nrcTrustDensity', session.nrcTrustDensity);
    const nrc_anticipation     = z('nrcAnticipationDensity', session.nrcAnticipationDensity);

    // Convergence: Euclidean distance from personal center across all
    // populated semantic dimensions. Normalize so typical z-magnitudes
    // map into [0, 1].
    const components = [
      syntactic_complexity, interrogation, self_focus, uncertainty,
      cognitive_processing,
      nrc_anger, nrc_fear, nrc_joy, nrc_sadness, nrc_trust, nrc_anticipation,
    ];
    const raw = Math.sqrt(components.reduce((s, v) => s + v * v, 0));
    // sqrt(11) ≈ 3.32; divisor chosen so a "typical 1σ across all dims" maps
    // to ~0.3 — comparable to behavioral convergence scale.
    const convergence = Math.min(1, raw / 7);

    const convergenceLevel: SemanticEntryState['convergenceLevel'] =
      convergence >= 0.6 ? 'high' :
      convergence >= 0.35 ? 'moderate' : 'low';

    return {
      entryIndex: index,
      responseId: session.responseId,
      date: session.date,
      syntactic_complexity,
      interrogation,
      self_focus,
      uncertainty,
      cognitive_processing,
      nrc_anger,
      nrc_fear,
      nrc_joy,
      nrc_sadness,
      nrc_trust,
      nrc_anticipation,
      sentiment: null,
      abstraction: null,
      agency_framing: null,
      temporal_orientation: null,
      convergence,
      convergenceLevel,
    };
  });
}
