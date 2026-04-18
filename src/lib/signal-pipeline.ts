/**
 * Derived Signal Pipeline
 *
 * Orchestrates computation and persistence of all derived signals that
 * run in the fire-and-forget block after session submission. Each signal
 * family is computed independently so one failure doesn't block the rest.
 *
 * Called from /api/respond.ts after renderWitnessState().
 */

import db, {
  saveDynamicalSignals,
  saveMotorSignals,
  saveSemanticSignals,
  saveProcessSignals,
  saveCrossSessionSignals,
  getDynamicalSignals,
  getMotorSignals,
  getSemanticSignals,
  getProcessSignals,
  getCrossSessionSignals,
} from './db.ts';
import { computeDynamicalSignals, type KeystrokeEvent } from './dynamical-signals.ts';
import { computeMotorSignals } from './motor-signals.ts';
import { computeSemanticSignals } from './semantic-signals.ts';
import { computeProcessSignals } from './process-signals.ts';
import { computeCrossSessionSignals } from './cross-session-signals.ts';
import { logError } from './error-log.ts';

function getKeystrokeStream(questionId: number): KeystrokeEvent[] | null {
  const row = db.prepare(
    `SELECT keystroke_stream_json FROM tb_session_events WHERE question_id = ?`
  ).get(questionId) as { keystroke_stream_json: string | null } | undefined;

  if (!row?.keystroke_stream_json) return null;
  try {
    return JSON.parse(row.keystroke_stream_json) as KeystrokeEvent[];
  } catch {
    return null;
  }
}

function getEventLogJson(questionId: number): string | null {
  const row = db.prepare(
    `SELECT event_log_json FROM tb_session_events WHERE question_id = ?`
  ).get(questionId) as { event_log_json: string | null } | undefined;
  return row?.event_log_json ?? null;
}

function getResponseText(questionId: number): string | null {
  const row = db.prepare(
    `SELECT text FROM tb_responses WHERE question_id = ?`
  ).get(questionId) as { text: string | null } | undefined;
  return row?.text ?? null;
}

function getSessionInfo(questionId: number): { totalDurationMs: number; pasteCount: number } {
  const row = db.prepare(
    `SELECT total_duration_ms FROM tb_session_summaries WHERE question_id = ?`
  ).get(questionId) as { total_duration_ms: number | null } | undefined;

  // paste_count may not exist in pre-Phase-1 rows; query separately with fallback
  let pasteCount = 0;
  try {
    const pcRow = db.prepare(
      `SELECT paste_count FROM tb_session_summaries WHERE question_id = ?`
    ).get(questionId) as { paste_count: number | null } | undefined;
    pasteCount = pcRow?.paste_count ?? 0;
  } catch { /* column doesn't exist in old schema */ }

  return {
    totalDurationMs: row?.total_duration_ms ?? 0,
    pasteCount,
  };
}

export function computeAndPersistDerivedSignals(questionId: number): void {
  const stream = getKeystrokeStream(questionId);

  // ── Dynamical signals (previously on-demand) ──
  if (stream && stream.length >= 10 && !getDynamicalSignals(questionId)) {
    try {
      const ds = computeDynamicalSignals(stream);
      saveDynamicalSignals(questionId, {
        iki_count: ds.ikiCount,
        hold_flight_count: ds.holdFlightCount,
        permutation_entropy: ds.permutationEntropy,
        permutation_entropy_raw: ds.permutationEntropyRaw,
        dfa_alpha: ds.dfaAlpha,
        rqa_determinism: ds.rqaDeterminism,
        rqa_laminarity: ds.rqaLaminarity,
        rqa_trapping_time: ds.rqaTrappingTime,
        rqa_recurrence_rate: ds.rqaRecurrenceRate,
        te_hold_to_flight: ds.teHoldToFlight,
        te_flight_to_hold: ds.teFlightToHold,
        te_dominance: ds.teDominance,
      });
    } catch (err) {
      logError('signal-pipeline.dynamical', err, { questionId });
    }
  }

  // ── Motor signals ──
  if (stream && stream.length >= 10 && !getMotorSignals(questionId)) {
    try {
      const { totalDurationMs } = getSessionInfo(questionId);
      const ms = computeMotorSignals(stream, totalDurationMs);
      saveMotorSignals(questionId, {
        sample_entropy: ms.sampleEntropy,
        iki_autocorrelation_json: ms.ikiAutocorrelation ? JSON.stringify(ms.ikiAutocorrelation) : null,
        motor_jerk: ms.motorJerk,
        lapse_rate: ms.lapseRate,
        tempo_drift: ms.tempoDrift,
        iki_compression_ratio: ms.ikiCompressionRatio,
        digraph_latency_json: ms.digraphLatencyProfile ? JSON.stringify(ms.digraphLatencyProfile) : null,
      });
    } catch (err) {
      logError('signal-pipeline.motor', err, { questionId });
    }
  }

  // ── Semantic signals ──
  if (!getSemanticSignals(questionId)) {
    try {
      const text = getResponseText(questionId);
      if (text && text.length >= 20) {
        const { pasteCount } = getSessionInfo(questionId);
        const ss = computeSemanticSignals(text, pasteCount);
        saveSemanticSignals(questionId, {
          idea_density: ss.ideaDensity,
          lexical_sophistication: ss.lexicalSophistication,
          epistemic_stance: ss.epistemicStance,
          integrative_complexity: ss.integrativeComplexity,
          deep_cohesion: ss.deepCohesion,
          referential_cohesion: ss.referentialCohesion,
          emotional_valence_arc: ss.emotionalValenceArc,
          text_compression_ratio: ss.textCompressionRatio,
          lexicon_version: ss.lexiconVersion,
          paste_contaminated: ss.pasteContaminated ? 1 : 0,
        });
      }
    } catch (err) {
      logError('signal-pipeline.semantic', err, { questionId });
    }
  }

  // ── Process signals ──
  if (!getProcessSignals(questionId)) {
    try {
      const eventLogJson = getEventLogJson(questionId);
      if (eventLogJson) {
        const ps = computeProcessSignals(eventLogJson);
        saveProcessSignals(questionId, {
          pause_within_word: ps.pauseWithinWord,
          pause_between_word: ps.pauseBetweenWord,
          pause_between_sentence: ps.pauseBetweenSentence,
          abandoned_thought_count: ps.abandonedThoughtCount,
          r_burst_count: ps.rBurstCount,
          i_burst_count: ps.iBurstCount,
          vocab_expansion_rate: ps.vocabExpansionRate,
          phase_transition_point: ps.phaseTransitionPoint,
          strategy_shift_count: ps.strategyShiftCount,
        });
      }
    } catch (err) {
      logError('signal-pipeline.process', err, { questionId });
    }
  }

  // ── Cross-session signals (depends on motor signals being persisted first) ──
  if (!getCrossSessionSignals(questionId)) {
    try {
      const text = getResponseText(questionId);
      if (text && text.length >= 20) {
        const cs = computeCrossSessionSignals(questionId, text);
        saveCrossSessionSignals(questionId, {
          self_perplexity: cs.selfPerplexity,
          ncd_lag_1: cs.ncdLag1,
          ncd_lag_3: cs.ncdLag3,
          ncd_lag_7: cs.ncdLag7,
          ncd_lag_30: cs.ncdLag30,
          vocab_recurrence_decay: cs.vocabRecurrenceDecay,
          digraph_stability: cs.digraphStability,
          text_network_density: cs.textNetworkDensity,
          text_network_communities: cs.textNetworkCommunities,
          bridging_ratio: cs.bridgingRatio,
        });
      }
    } catch (err) {
      logError('signal-pipeline.crossSession', err, { questionId });
    }
  }
}
