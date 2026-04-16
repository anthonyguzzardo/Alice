/**
 * Weekly structured receipt.
 *
 * 2026-04-16 restructure: the narrative reflection layer (LLM-generated
 * "what the system thinks you're doing" with self-correction + audit) was
 * removed. This file previously ran two Anthropic calls per week to produce
 * 2-3K tokens of narrative interpretation. That is exactly the text-only
 * interpretive surface flagged as commoditizable and epistemically brittle
 * on single-subject data.
 *
 * What replaces it: a structured Observe-format digest of the last 7
 * sessions. No narrative. No comparisons-to-goals. No trends. No LLM call.
 * Pure deterministic formatting of signals the user already has a right to
 * read as the designer. The digest is saved to tb_reflections so historical
 * infrastructure (embeddings, RAG retrieval at generation time) continues
 * to work, but the payload is structured data rather than prose.
 *
 * This function is currently NOT called by respond.ts; it is retained for
 * manual/scheduled invocation once the designer-facing viewer is built.
 */
import {
  getRecentResponses,
  getResponsesSinceId,
  getLatestReflectionWithCoverage,
  getSessionSummariesForQuestions,
  getAllSessionSummaries,
  getCalibrationBaselines,
  getMaxResponseId,
  saveReflection,
  getRecentSessionDeltas,
} from './db.ts';
import {
  formatCompactSignals,
  formatDynamicsContext,
  formatEnrichedCalibration,
} from './signals.ts';
import { computeEntryStates } from './alice-negative/state-engine.ts';
import { computeDynamics } from './alice-negative/dynamics.ts';
import { formatCompactDelta } from './session-delta.ts';

export async function runReflection(): Promise<void> {
  const previousReflection = getLatestReflectionWithCoverage();

  let newEntries: Array<{
    response_id: number; question_id: number; question: string; response: string; date: string;
  }>;

  if (previousReflection?.coverage_through_response_id) {
    newEntries = getResponsesSinceId(previousReflection.coverage_through_response_id);
  } else {
    newEntries = getRecentResponses(7).reverse();
  }

  if (newEntries.length < 5) return;

  const maxResponseId = getMaxResponseId();

  const questionIds = newEntries.map(r => r.question_id);
  const summaries = getSessionSummariesForQuestions(questionIds);
  const allSummaries = getAllSessionSummaries();
  const calibration = getCalibrationBaselines();

  const behavioralSection = summaries.length > 0
    ? formatCompactSignals(summaries, allSummaries)
    : 'No behavioral data available.';

  const entryStates = computeEntryStates();
  const dynamics = computeDynamics(entryStates);
  const dynamicsSection = dynamics.entryCount > 0
    ? formatDynamicsContext(dynamics, 'compact')
    : '';

  const calibrationContext = formatEnrichedCalibration(calibration);

  const recentDeltas = getRecentSessionDeltas(30);
  const deltaTrendSection = recentDeltas.length > 0
    ? formatCompactDelta(recentDeltas)
    : '';

  const receipt = [
    `=== WEEKLY STRUCTURED RECEIPT (${newEntries.length} sessions, through response ${maxResponseId}) ===`,
    '',
    'Behavioral signals:',
    behavioralSection,
    dynamicsSection ? `\n${dynamicsSection}` : '',
    '',
    calibrationContext,
    deltaTrendSection ? `\n${deltaTrendSection}` : '',
  ].filter(Boolean).join('\n');

  saveReflection(receipt, 'weekly', maxResponseId);
}
