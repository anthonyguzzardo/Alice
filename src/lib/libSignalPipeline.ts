/**
 * Derived Signal Pipeline
 *
 * Orchestrates computation and persistence of all derived signals that
 * run in the fire-and-forget block after session submission. Each signal
 * family is computed independently so one failure doesn't block the rest.
 *
 * Called from /api/respond.ts after renderWitnessState().
 */

import sql, {
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
} from './libDb.ts';
import {
  computeDynamicalSignals,
  computeMotorSignals,
  computeProcessSignals,
} from './libSignalsNative.ts';
import type { KeystrokeEvent } from './libDynamicalSignals.ts';
import { computeSemanticSignals } from './libSemanticSignals.ts';
import { computeCrossSessionSignals } from './libCrossSessionSignals.ts';
import { logError } from './utlErrorLog.ts';

async function getKeystrokeStream(questionId: number): Promise<KeystrokeEvent[] | null> {
  const rows = await sql`SELECT keystroke_stream_json FROM tb_session_events WHERE question_id = ${questionId}`;
  const row = rows[0] as { keystroke_stream_json: unknown } | undefined;

  if (!row?.keystroke_stream_json) return null;
  // JSONB auto-parsed by postgres driver; handle both parsed and string forms
  if (Array.isArray(row.keystroke_stream_json)) return row.keystroke_stream_json as KeystrokeEvent[];
  try {
    return JSON.parse(row.keystroke_stream_json as string) as KeystrokeEvent[];
  } catch {
    return null;
  }
}

async function getEventLogJson(questionId: number): Promise<string | null> {
  const rows = await sql`SELECT event_log_json FROM tb_session_events WHERE question_id = ${questionId}`;
  const row = rows[0] as { event_log_json: unknown } | undefined;
  if (!row?.event_log_json) return null;
  // JSONB auto-parsed by postgres driver; re-stringify for signal functions
  return typeof row.event_log_json === 'string'
    ? row.event_log_json
    : JSON.stringify(row.event_log_json);
}

async function getResponseText(questionId: number): Promise<string | null> {
  const rows = await sql`SELECT text FROM tb_responses WHERE question_id = ${questionId}`;
  const row = rows[0] as { text: string | null } | undefined;
  return row?.text ?? null;
}

async function getSessionInfo(questionId: number): Promise<{ totalDurationMs: number; pasteCount: number }> {
  const rows = await sql`SELECT total_duration_ms, paste_count FROM tb_session_summaries WHERE question_id = ${questionId}`;
  const row = rows[0] as { total_duration_ms: number | null; paste_count: number | null } | undefined;

  return {
    totalDurationMs: row?.total_duration_ms ?? 0,
    pasteCount: row?.paste_count ?? 0,
  };
}

export async function computeAndPersistDerivedSignals(questionId: number): Promise<void> {
  const stream = await getKeystrokeStream(questionId);

  // ── Dynamical signals (previously on-demand) ──
  if (stream && stream.length >= 10 && !(await getDynamicalSignals(questionId))) {
    try {
      const ds = computeDynamicalSignals(stream);
      await saveDynamicalSignals(questionId, {
        iki_count: ds.ikiCount,
        hold_flight_count: ds.holdFlightCount,
        permutation_entropy: ds.permutationEntropy,
        permutation_entropy_raw: ds.permutationEntropyRaw,
        pe_spectrum: ds.peSpectrum ? JSON.stringify(ds.peSpectrum) : null,
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
  if (stream && stream.length >= 10 && !(await getMotorSignals(questionId))) {
    try {
      const { totalDurationMs } = await getSessionInfo(questionId);
      const ms = computeMotorSignals(stream, totalDurationMs);
      await saveMotorSignals(questionId, {
        sample_entropy: ms.sampleEntropy,
        iki_autocorrelation_json: ms.ikiAutocorrelation ? JSON.stringify(ms.ikiAutocorrelation) : null,
        motor_jerk: ms.motorJerk,
        lapse_rate: ms.lapseRate,
        tempo_drift: ms.tempoDrift,
        iki_compression_ratio: ms.ikiCompressionRatio,
        digraph_latency_json: ms.digraphLatencyProfile ? JSON.stringify(ms.digraphLatencyProfile) : null,
        ex_gaussian_tau: ms.exGaussianTau,
        ex_gaussian_mu: ms.exGaussianMu,
        ex_gaussian_sigma: ms.exGaussianSigma,
        tau_proportion: ms.tauProportion,
        adjacent_hold_time_cov: ms.adjacentHoldTimeCov,
      });
    } catch (err) {
      logError('signal-pipeline.motor', err, { questionId });
    }
  }

  // ── Semantic signals ──
  if (!(await getSemanticSignals(questionId))) {
    try {
      const text = await getResponseText(questionId);
      if (text && text.length >= 20) {
        const { pasteCount } = await getSessionInfo(questionId);
        const ss = computeSemanticSignals(text, pasteCount);
        await saveSemanticSignals(questionId, {
          idea_density: ss.ideaDensity,
          lexical_sophistication: ss.lexicalSophistication,
          epistemic_stance: ss.epistemicStance,
          integrative_complexity: ss.integrativeComplexity,
          deep_cohesion: ss.deepCohesion,
          referential_cohesion: ss.referentialCohesion,
          emotional_valence_arc: ss.emotionalValenceArc,
          text_compression_ratio: ss.textCompressionRatio,
          lexicon_version: ss.lexiconVersion,
          paste_contaminated: ss.pasteContaminated,
        });
      }
    } catch (err) {
      logError('signal-pipeline.semantic', err, { questionId });
    }
  }

  // ── Process signals ──
  if (!(await getProcessSignals(questionId))) {
    try {
      const eventLogJson = await getEventLogJson(questionId);
      if (eventLogJson) {
        const ps = computeProcessSignals(eventLogJson);
        await saveProcessSignals(questionId, {
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
  if (!(await getCrossSessionSignals(questionId))) {
    try {
      const text = await getResponseText(questionId);
      if (text && text.length >= 20) {
        const cs = await computeCrossSessionSignals(questionId, text);
        await saveCrossSessionSignals(questionId, {
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
