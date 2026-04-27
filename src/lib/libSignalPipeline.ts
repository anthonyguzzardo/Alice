/**
 * Derived Signal Pipeline
 *
 * Orchestrates computation and persistence of all derived signals that
 * run in the fire-and-forget block after session submission. Each signal
 * family is computed independently so one failure doesn't block the rest.
 *
 * Called from /api/respond.ts after embedResponse() completes.
 * The semantic baseline updater queries tb_embeddings via HNSW for
 * topic-matched z-scores, so the current session's embedding must
 * exist before this function runs.
 */

import sql, {
  saveDynamicalSignals,
  saveMotorSignals,
  saveSemanticSignals,
  saveProcessSignals,
  saveCrossSessionSignals,
  saveRburstSequence,
  getDynamicalSignals,
  getMotorSignals,
  getSemanticSignals,
  getProcessSignals,
  getCrossSessionSignals,
  getResponseText as dbGetResponseText,
  getEventLogJson as dbGetEventLogJson,
  getKeystrokeStreamJson as dbGetKeystrokeStreamJson,
} from './libDb.ts';
import {
  computeDynamicalSignals,
  computeMotorSignals,
  computeProcessSignals,
} from './libSignalsNative.ts';
import type { KeystrokeEvent } from './libSignalsNative.ts';
import { computeSemanticSignals, computeDiscourseCoherence } from './libSemanticSignals.ts';
import { computeCrossSessionSignals } from './libCrossSessionSignals.ts';
import { updateProfile } from './libProfile.ts';
import { computeReconstructionResidual } from './libReconstruction.ts';
import { computeSessionIntegrity } from './libIntegrity.ts';
import { saveSessionIntegrity, getSessionIntegrity } from './libDb.ts';
import { updateRburstTrajectoryShape } from './libSessionMetadata.ts';
import { updateSemanticBaselines } from './libSemanticBaseline.ts';
import { logError } from './utlErrorLog.ts';

async function getKeystrokeStream(subjectId: number, questionId: number): Promise<KeystrokeEvent[] | null> {
  const json = await dbGetKeystrokeStreamJson(subjectId, questionId);
  if (!json) return null;
  try {
    return JSON.parse(json) as KeystrokeEvent[];
  } catch {
    return null;
  }
}

async function getEventLogJson(subjectId: number, questionId: number): Promise<string | null> {
  return dbGetEventLogJson(subjectId, questionId);
}

async function getResponseText(subjectId: number, questionId: number): Promise<string | null> {
  return dbGetResponseText(subjectId, questionId);
}

async function getSessionInfo(subjectId: number, questionId: number): Promise<{ totalDurationMs: number; pasteCount: number; dropCount: number }> {
  const rows = await sql`SELECT total_duration_ms, paste_count, drop_count FROM tb_session_summaries WHERE subject_id = ${subjectId} AND question_id = ${questionId}`;
  const row = rows[0] as { total_duration_ms: number | null; paste_count: number | null; drop_count: number | null } | undefined;

  return {
    totalDurationMs: row?.total_duration_ms ?? 0,
    pasteCount: row?.paste_count ?? 0,
    dropCount: row?.drop_count ?? 0,
  };
}

export async function computeAndPersistDerivedSignals(subjectId: number, questionId: number): Promise<void> {
  const stream = await getKeystrokeStream(subjectId, questionId);

  // ── Dynamical signals (previously on-demand) ──
  if (stream && stream.length >= 10 && !(await getDynamicalSignals(subjectId, questionId))) {
    try {
      const ds = computeDynamicalSignals(stream);
      if (ds) {
        await saveDynamicalSignals(subjectId, questionId, {
          iki_count: ds.ikiCount ?? null,
          hold_flight_count: ds.holdFlightCount ?? null,
          permutation_entropy: ds.permutationEntropy ?? null,
          permutation_entropy_raw: ds.permutationEntropyRaw ?? null,
          pe_spectrum: ds.peSpectrum ? JSON.stringify(ds.peSpectrum) : null,
          dfa_alpha: ds.dfaAlpha ?? null,
          mfdfa_spectrum_width: ds.mfdfaSpectrumWidth ?? null,
          mfdfa_asymmetry: ds.mfdfaAsymmetry ?? null,
          mfdfa_peak_alpha: ds.mfdfaPeakAlpha ?? null,
          temporal_irreversibility: ds.temporalIrreversibility ?? null,
          iki_psd_spectral_slope: ds.ikiPsdSpectralSlope ?? null,
          iki_psd_respiratory_peak_hz: ds.ikiPsdRespiratoryPeakHz ?? null,
          peak_typing_frequency_hz: ds.peakTypingFrequencyHz ?? null,
          iki_psd_lf_hf_ratio: ds.ikiPsdLfHfRatio ?? null,
          iki_psd_fast_slow_variance_ratio: ds.ikiPsdFastSlowVarianceRatio ?? null,
          statistical_complexity: ds.statisticalComplexity ?? null,
          forbidden_pattern_fraction: ds.forbiddenPatternFraction ?? null,
          weighted_pe: ds.weightedPe ?? null,
          lempel_ziv_complexity: ds.lempelZivComplexity ?? null,
          optn_transition_entropy: ds.optnTransitionEntropy ?? null,
          optn_forbidden_transition_count: ds.optnForbiddenTransitionCount ?? null,
          rqa_determinism: ds.rqaDeterminism ?? null,
          rqa_laminarity: ds.rqaLaminarity ?? null,
          rqa_trapping_time: ds.rqaTrappingTime ?? null,
          rqa_recurrence_rate: ds.rqaRecurrenceRate ?? null,
          rqa_recurrence_time_entropy: ds.rqaRecurrenceTimeEntropy ?? null,
          rqa_mean_recurrence_time: ds.rqaMeanRecurrenceTime ?? null,
          recurrence_transitivity: ds.recurrenceTransitivity ?? null,
          recurrence_avg_path_length: ds.recurrenceAvgPathLength ?? null,
          recurrence_clustering: ds.recurrenceClustering ?? null,
          recurrence_assortativity: ds.recurrenceAssortativity ?? null,
          effective_information: ds.effectiveInformation ?? null,
          causal_emergence_index: ds.causalEmergenceIndex ?? null,
          optimal_causal_scale: ds.optimalCausalScale ?? null,
          pid_synergy: ds.pidSynergy ?? null,
          pid_redundancy: ds.pidRedundancy ?? null,
          branching_ratio: ds.branchingRatio ?? null,
          avalanche_size_exponent: ds.avalancheSizeExponent ?? null,
          dmd_dominant_frequency: ds.dmdDominantFrequency ?? null,
          dmd_dominant_decay_rate: ds.dmdDominantDecayRate ?? null,
          dmd_mode_count: ds.dmdModeCount ?? null,
          dmd_spectral_entropy: ds.dmdSpectralEntropy ?? null,
          pause_mixture_component_count: ds.pauseMixtureComponentCount ?? null,
          pause_mixture_motor_proportion: ds.pauseMixtureMotorProportion ?? null,
          pause_mixture_cognitive_load_index: ds.pauseMixtureCognitiveLoadIndex ?? null,
          te_hold_to_flight: ds.teHoldToFlight ?? null,
          te_flight_to_hold: ds.teFlightToHold ?? null,
          te_dominance: ds.teDominance ?? null,
        });
      }
    } catch (err) {
      logError('signal-pipeline.dynamical', err, { questionId });
    }
  }

  // ── Motor signals ──
  if (stream && stream.length >= 10 && !(await getMotorSignals(subjectId, questionId))) {
    try {
      const { totalDurationMs } = await getSessionInfo(subjectId, questionId);
      const ms = computeMotorSignals(stream, totalDurationMs);
      if (ms) {
        await saveMotorSignals(subjectId, questionId, {
          sample_entropy: ms.sampleEntropy ?? null,
          mse_series: ms.mseSeries ? JSON.stringify(ms.mseSeries) : null,
          complexity_index: ms.complexityIndex ?? null,
          ex_gaussian_fisher_trace: ms.exGaussianFisherTrace ?? null,
          iki_autocorrelation_json: ms.ikiAutocorrelation ? JSON.stringify(ms.ikiAutocorrelation) : null,
          motor_jerk: ms.motorJerk ?? null,
          lapse_rate: ms.lapseRate ?? null,
          tempo_drift: ms.tempoDrift ?? null,
          iki_compression_ratio: ms.ikiCompressionRatio ?? null,
          // Storage format intentionally preserved as `Record<digraph, latencyMs>`
          // for backward compatibility with existing readers (libProfile,
          // libCrossSessionSignals). The FFI is now typed `Vec<DigraphEntry>`;
          // we collapse back to Record at the JSONB boundary so historical rows
          // and analytical queries keep working unchanged.
          digraph_latency_json: ms.digraphLatencyProfile
            ? JSON.stringify(Object.fromEntries(ms.digraphLatencyProfile.map((e) => [e.digraph, e.latencyMs])))
            : null,
          ex_gaussian_tau: ms.exGaussianTau ?? null,
          ex_gaussian_mu: ms.exGaussianMu ?? null,
          ex_gaussian_sigma: ms.exGaussianSigma ?? null,
          tau_proportion: ms.tauProportion ?? null,
          adjacent_hold_time_cov: ms.adjacentHoldTimeCov ?? null,
          hold_flight_rank_corr: ms.holdFlightRankCorr ?? null,
        });
      }
    } catch (err) {
      logError('signal-pipeline.motor', err, { questionId });
    }
  }

  // ── Semantic signals ──
  if (!(await getSemanticSignals(subjectId, questionId))) {
    try {
      const text = await getResponseText(subjectId, questionId);
      if (text && text.length >= 20) {
        const { pasteCount, dropCount } = await getSessionInfo(subjectId, questionId);
        const ss = computeSemanticSignals(text, pasteCount, dropCount);
        const dc = await computeDiscourseCoherence(text);
        await saveSemanticSignals(subjectId, questionId, {
          idea_density: ss.ideaDensity,
          lexical_sophistication: ss.lexicalSophistication,
          epistemic_stance: ss.epistemicStance,
          integrative_complexity: ss.integrativeComplexity,
          deep_cohesion: ss.deepCohesion,
          referential_cohesion: ss.referentialCohesion,
          emotional_valence_arc: ss.emotionalValenceArc,
          text_compression_ratio: ss.textCompressionRatio,
          discourse_global_coherence: dc.globalCoherence,
          discourse_local_coherence: dc.localCoherence,
          discourse_global_local_ratio: dc.globalLocalRatio,
          discourse_coherence_decay_slope: dc.coherenceDecaySlope,
          lexicon_version: ss.lexiconVersion,
          paste_contaminated: ss.pasteContaminated,
        });
      }
    } catch (err) {
      logError('signal-pipeline.semantic', err, { questionId });
    }
  }

  // ── Semantic baselines (longitudinal z-scores, runs after semantic signals) ──
  try {
    await updateSemanticBaselines(subjectId, questionId);
  } catch (err) {
    logError('signal-pipeline.semantic-baseline', err, { questionId });
  }

  // ── Process signals ──
  if (!(await getProcessSignals(subjectId, questionId))) {
    try {
      const eventLogJson = await getEventLogJson(subjectId, questionId);
      if (eventLogJson) {
        const ps = computeProcessSignals(eventLogJson);
        if (ps) {
          await saveProcessSignals(subjectId, questionId, {
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

          // Persist per-R-burst sequences and compute trajectory shape
          if (ps.rBurstSequences.length > 0) {
            await saveRburstSequence(subjectId, questionId, ps.rBurstSequences);
            await updateRburstTrajectoryShape(subjectId, questionId);
          }
        }
      }
    } catch (err) {
      logError('signal-pipeline.process', err, { questionId });
    }
  }

  // ── Cross-session signals (depends on motor signals being persisted first) ──
  if (!(await getCrossSessionSignals(subjectId, questionId))) {
    try {
      const text = await getResponseText(subjectId, questionId);
      if (text && text.length >= 20) {
        const cs = await computeCrossSessionSignals(subjectId, questionId, text);
        if (cs) {
          await saveCrossSessionSignals(subjectId, questionId, {
            self_perplexity: cs.selfPerplexity ?? null,
            motor_self_perplexity: cs.motorSelfPerplexity ?? null,
            ncd_lag_1: cs.ncdLag1 ?? null,
            ncd_lag_3: cs.ncdLag3 ?? null,
            ncd_lag_7: cs.ncdLag7 ?? null,
            ncd_lag_30: cs.ncdLag30 ?? null,
            vocab_recurrence_decay: cs.vocabRecurrenceDecay ?? null,
            digraph_stability: cs.digraphStability ?? null,
            text_network_density: cs.textNetworkDensity ?? null,
            text_network_communities: cs.textNetworkCommunities ?? null,
            bridging_ratio: cs.bridgingRatio ?? null,
          });
        }
      }
    } catch (err) {
      logError('signal-pipeline.crossSession', err, { questionId });
    }
  }

  // ── Session integrity (BEFORE profile update — compares against prior profile) ──
  if (!(await getSessionIntegrity(subjectId, questionId))) {
    try {
      const integrity = await computeSessionIntegrity(subjectId, questionId);
      if (integrity) {
        await saveSessionIntegrity({
          subjectId,
          questionId: integrity.questionId,
          profileDistance: integrity.profileDistance,
          dimensionCount: integrity.dimensionCount,
          zScoresJson: JSON.stringify(integrity.zScores),
          isFlagged: integrity.isFlagged,
          thresholdUsed: integrity.thresholdUsed,
          profileSessionCount: integrity.profileSessionCount,
        });
      }
    } catch (err) {
      logError('signal-pipeline.integrity', err, { subjectId, questionId });
    }
  }

  // ── Personal profile (rolling aggregate, depends on all signals above) ──
  try {
    await updateProfile(subjectId, questionId);
  } catch (err) {
    logError('signal-pipeline.profile', err, { subjectId, questionId });
  }

  // ── Reconstruction residual (depends on profile being current) ──
  try {
    await computeReconstructionResidual(subjectId, questionId);
  } catch (err) {
    logError('signal-pipeline.reconstruction', err, { subjectId, questionId });
  }
}
