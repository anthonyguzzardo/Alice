/**
 * 7D Deterministic Behavioral State Engine
 *
 * Computes a per-entry behavioral state vector from raw session data
 * AND Rust signal engine outputs. Each entry produces one point in
 * 7-dimensional behavioral space. All values are z-scored against
 * personal history. No AI. Pure math.
 *
 * As of 2026-04-20: state dimensions now incorporate nonlinear dynamical
 * signals (permutation entropy, DFA alpha, RQA, transfer entropy, sample
 * entropy, ex-Gaussian tau, pause location, burst classification) alongside
 * the original summary statistics. When Rust signals are unavailable for an
 * entry (e.g. pre-migration data), the engine falls back to summary-only
 * computation for that entry, preserving backwards compatibility.
 *
 * Dimensions (research-validated):
 *   fluency      — DFA alpha (long-range correlation) + P-burst length + tempo drift
 *   deliberation — pause location profile + permutation entropy + hesitation
 *   revision     — abandoned thoughts + R-burst/I-burst ratio + commitment ratio
 *   commitment   — final/typed ratio + strategy shift count + phase transition point
 *   volatility   — behavioral distance from previous entry in 4D subspace
 *   thermal      — ex-Gaussian tau (attentional lapses) + lapse rate + correction rate
 *   presence     — RQA determinism + transfer entropy dominance + inverse distraction
 *
 * Convergence:
 *   Euclidean distance from personal center in 7D space.
 *   Normalized to [0, 1]. High convergence = multiple dimensions moved together.
 */

import sql from './libDb.ts';
import { avg, stddev } from './libBehavioralHelpers.ts';

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
  // Fluency (summary)
  avgPBurstLength: number;
  charsPerMinute: number;
  // Deliberation (summary)
  firstKeystrokeMs: number;
  pauseRatePerMinute: number;
  revisionWeight: number;
  // Revision (summary)
  commitmentRatio: number;
  revisionRate: number;
  // Thermal (summary)
  correctionRate: number;
  revisionTiming: number;
  // Presence (summary)
  tabAwayRatePerMinute: number;
  // ── Rust dynamical signals ──
  dfaAlpha: number | null;
  permutationEntropy: number | null;
  rqaDeterminism: number | null;
  rqaLaminarity: number | null;
  teHoldToFlight: number | null;
  teFlightToHold: number | null;
  teDominance: number | null;
  // ── Rust motor signals ──
  sampleEntropy: number | null;
  motorJerk: number | null;
  lapseRate: number | null;
  tempoDrift: number | null;
  exGaussianTau: number | null;
  tauProportion: number | null;
  // ── Rust process signals ──
  pauseWithinWord: number | null;
  pauseBetweenWord: number | null;
  pauseBetweenSentence: number | null;
  abandonedThoughtCount: number | null;
  rBurstCount: number | null;
  iBurstCount: number | null;
  phaseTransitionPoint: number | null;
  strategyShiftCount: number | null;
}

export async function loadSessions(subjectId: number): Promise<SessionRaw[]> {
  const rows = await sql`
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
      ,ds.dfa_alpha
      ,ds.permutation_entropy
      ,ds.rqa_determinism
      ,ds.rqa_laminarity
      ,ds.te_hold_to_flight
      ,ds.te_flight_to_hold
      ,ds.te_dominance
      ,ms.sample_entropy
      ,ms.motor_jerk
      ,ms.lapse_rate
      ,ms.tempo_drift
      ,ms.ex_gaussian_tau
      ,ms.tau_proportion
      ,ps.pause_within_word
      ,ps.pause_between_word
      ,ps.pause_between_sentence
      ,ps.abandoned_thought_count
      ,ps.r_burst_count
      ,ps.i_burst_count
      ,ps.phase_transition_point
      ,ps.strategy_shift_count
    FROM tb_session_summaries ss
    JOIN tb_responses r ON ss.question_id = r.question_id
    JOIN tb_questions q ON r.question_id = q.question_id
    LEFT JOIN tb_dynamical_signals ds ON ss.question_id = ds.question_id
    LEFT JOIN tb_motor_signals ms ON ss.question_id = ms.question_id
    LEFT JOIN tb_process_signals ps ON ss.question_id = ps.question_id
    WHERE q.subject_id = ${subjectId}
      AND q.question_source_id != 3
    ORDER BY ss.session_summary_id ASC
  ` as any[];

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
      // Rust signals (null when unavailable for pre-migration entries)
      dfaAlpha: row.dfa_alpha ?? null,
      permutationEntropy: row.permutation_entropy ?? null,
      rqaDeterminism: row.rqa_determinism ?? null,
      rqaLaminarity: row.rqa_laminarity ?? null,
      teHoldToFlight: row.te_hold_to_flight ?? null,
      teFlightToHold: row.te_flight_to_hold ?? null,
      teDominance: row.te_dominance ?? null,
      sampleEntropy: row.sample_entropy ?? null,
      motorJerk: row.motor_jerk ?? null,
      lapseRate: row.lapse_rate ?? null,
      tempoDrift: row.tempo_drift ?? null,
      exGaussianTau: row.ex_gaussian_tau ?? null,
      tauProportion: row.tau_proportion ?? null,
      pauseWithinWord: row.pause_within_word ?? null,
      pauseBetweenWord: row.pause_between_word ?? null,
      pauseBetweenSentence: row.pause_between_sentence ?? null,
      abandonedThoughtCount: row.abandoned_thought_count ?? null,
      rBurstCount: row.r_burst_count ?? null,
      iBurstCount: row.i_burst_count ?? null,
      phaseTransitionPoint: row.phase_transition_point ?? null,
      strategyShiftCount: row.strategy_shift_count ?? null,
    };
  });
}

// ─── 7D State computation ──────────────────────────────────────────

export async function computeEntryStates(subjectId: number, sessions?: SessionRaw[]): Promise<EntryState[]> {
  if (!sessions) sessions = await loadSessions(subjectId);
  if (sessions.length < MIN_ENTRIES) return [];

  const hasBurstData = sessions.some(s => s.avgPBurstLength > 0);

  // Check which Rust signal families are available across sessions.
  // A signal family is "available" if at least MIN_ENTRIES sessions have it,
  // so z-scoring has a meaningful baseline.
  const hasDynamical = sessions.filter(s => s.dfaAlpha != null).length >= MIN_ENTRIES;
  const hasMotor = sessions.filter(s => s.sampleEntropy != null).length >= MIN_ENTRIES;
  const hasProcess = sessions.filter(s => s.pauseWithinWord != null).length >= MIN_ENTRIES;

  // ── Personal baselines for all metrics ──
  // Summary baselines (always available)
  const baseline = {
    avgPBurstLength:    { mean: avg(sessions.map(s => s.avgPBurstLength)),    std: stddev(sessions.map(s => s.avgPBurstLength)) },
    charsPerMinute:     { mean: avg(sessions.map(s => s.charsPerMinute)),     std: stddev(sessions.map(s => s.charsPerMinute)) },
    firstKeystrokeMs:   { mean: avg(sessions.map(s => s.firstKeystrokeMs)),   std: stddev(sessions.map(s => s.firstKeystrokeMs)) },
    pauseRatePerMinute: { mean: avg(sessions.map(s => s.pauseRatePerMinute)), std: stddev(sessions.map(s => s.pauseRatePerMinute)) },
    revisionWeight:     { mean: avg(sessions.map(s => s.revisionWeight)),     std: stddev(sessions.map(s => s.revisionWeight)) },
    commitmentRatio:    { mean: avg(sessions.map(s => s.commitmentRatio)),    std: stddev(sessions.map(s => s.commitmentRatio)) },
    revisionRate:       { mean: avg(sessions.map(s => s.revisionRate)),       std: stddev(sessions.map(s => s.revisionRate)) },
    correctionRate:     { mean: avg(sessions.map(s => s.correctionRate)),     std: stddev(sessions.map(s => s.correctionRate)) },
    revisionTiming:     { mean: avg(sessions.map(s => s.revisionTiming)),     std: stddev(sessions.map(s => s.revisionTiming)) },
    tabAwayRate:        { mean: avg(sessions.map(s => s.tabAwayRatePerMinute)), std: stddev(sessions.map(s => s.tabAwayRatePerMinute)) },
  };

  // Rust signal baselines (computed only from sessions that have them)
  const nn = (vals: (number | null)[]): number[] => vals.filter((v): v is number => v != null);

  const rustBaseline = {
    // Dynamical
    dfaAlpha:           { mean: avg(nn(sessions.map(s => s.dfaAlpha))),           std: stddev(nn(sessions.map(s => s.dfaAlpha))) },
    permutationEntropy: { mean: avg(nn(sessions.map(s => s.permutationEntropy))), std: stddev(nn(sessions.map(s => s.permutationEntropy))) },
    rqaDeterminism:     { mean: avg(nn(sessions.map(s => s.rqaDeterminism))),     std: stddev(nn(sessions.map(s => s.rqaDeterminism))) },
    rqaLaminarity:      { mean: avg(nn(sessions.map(s => s.rqaLaminarity))),      std: stddev(nn(sessions.map(s => s.rqaLaminarity))) },
    teDominance:        { mean: avg(nn(sessions.map(s => s.teDominance))),        std: stddev(nn(sessions.map(s => s.teDominance))) },
    // Motor
    sampleEntropy:      { mean: avg(nn(sessions.map(s => s.sampleEntropy))),      std: stddev(nn(sessions.map(s => s.sampleEntropy))) },
    motorJerk:          { mean: avg(nn(sessions.map(s => s.motorJerk))),          std: stddev(nn(sessions.map(s => s.motorJerk))) },
    lapseRate:          { mean: avg(nn(sessions.map(s => s.lapseRate))),          std: stddev(nn(sessions.map(s => s.lapseRate))) },
    tempoDrift:         { mean: avg(nn(sessions.map(s => s.tempoDrift))),         std: stddev(nn(sessions.map(s => s.tempoDrift))) },
    exGaussianTau:      { mean: avg(nn(sessions.map(s => s.exGaussianTau))),      std: stddev(nn(sessions.map(s => s.exGaussianTau))) },
    tauProportion:      { mean: avg(nn(sessions.map(s => s.tauProportion))),      std: stddev(nn(sessions.map(s => s.tauProportion))) },
    // Process
    pauseBetweenSentence: { mean: avg(nn(sessions.map(s => s.pauseBetweenSentence))), std: stddev(nn(sessions.map(s => s.pauseBetweenSentence))) },
    abandonedThoughtCount: { mean: avg(nn(sessions.map(s => s.abandonedThoughtCount))), std: stddev(nn(sessions.map(s => s.abandonedThoughtCount))) },
    rBurstCount:        { mean: avg(nn(sessions.map(s => s.rBurstCount))),        std: stddev(nn(sessions.map(s => s.rBurstCount))) },
    iBurstCount:        { mean: avg(nn(sessions.map(s => s.iBurstCount))),        std: stddev(nn(sessions.map(s => s.iBurstCount))) },
    phaseTransitionPoint: { mean: avg(nn(sessions.map(s => s.phaseTransitionPoint))), std: stddev(nn(sessions.map(s => s.phaseTransitionPoint))) },
    strategyShiftCount: { mean: avg(nn(sessions.map(s => s.strategyShiftCount))), std: stddev(nn(sessions.map(s => s.strategyShiftCount))) },
  };

  const z = (key: keyof typeof baseline, value: number) =>
    zScore(value, baseline[key].mean, baseline[key].std);

  const zr = (key: keyof typeof rustBaseline, value: number | null): number | null => {
    if (value == null) return null;
    return zScore(value, rustBaseline[key].mean, rustBaseline[key].std);
  };

  return sessions.map((session, index) => {

    // ── Fluency ──────────────────────────────────────────────────
    // DFA alpha: long-range temporal correlation in IKI series.
    // High alpha = persistent, flowing rhythm. Low = erratic.
    // Blended with P-burst length (sustained production) and tempo drift
    // (acceleration = warming up, deceleration = fatigue).
    let fluency: number;
    if (hasDynamical && session.dfaAlpha != null) {
      const zDfa = zr('dfaAlpha', session.dfaAlpha)!;
      const zTempo = zr('tempoDrift', session.tempoDrift);
      const zBurst = hasBurstData
        ? z('avgPBurstLength', session.avgPBurstLength)
        : z('charsPerMinute', session.charsPerMinute);
      // DFA carries the most information; burst length is the validated fallback
      fluency = zTempo != null
        ? (zDfa * 2 + zBurst + (-zTempo)) / 4  // negative tempo drift = speeding up = more fluent
        : (zDfa * 2 + zBurst) / 3;
    } else {
      fluency = hasBurstData
        ? z('avgPBurstLength', session.avgPBurstLength)
        : z('charsPerMinute', session.charsPerMinute);
    }

    // ── Deliberation ─────────────────────────────────────────────
    // Permutation entropy: rhythmic complexity of the IKI series.
    // High PE = complex, unpredictable rhythm (exploratory thinking).
    // Pause location profile: between-sentence pauses indicate
    // high-level planning (Deane 2015); within-word pauses indicate
    // lexical retrieval difficulty.
    let deliberation: number;
    if (hasDynamical && session.permutationEntropy != null) {
      const zPE = zr('permutationEntropy', session.permutationEntropy)!;
      const zFirst = z('firstKeystrokeMs', session.firstKeystrokeMs);
      const zBetweenSentence = zr('pauseBetweenSentence', session.pauseBetweenSentence);
      deliberation = zBetweenSentence != null
        ? (zPE + zFirst + zBetweenSentence) / 3
        : (zPE + zFirst + z('pauseRatePerMinute', session.pauseRatePerMinute)) / 3;
    } else {
      deliberation = (
        z('firstKeystrokeMs', session.firstKeystrokeMs) +
        z('pauseRatePerMinute', session.pauseRatePerMinute) +
        z('revisionWeight', session.revisionWeight)
      ) / 3;
    }

    // ── Revision ─────────────────────────────────────────────────
    // Abandoned thought count: started writing, deleted most of it,
    // then wrote something different. Genuine cognitive revision.
    // R-burst vs I-burst ratio: revision bursts (ending in deletion)
    // vs inscription bursts (ending in new text). High R-burst ratio
    // = revision-heavy process.
    let revision: number;
    if (hasProcess && session.abandonedThoughtCount != null) {
      const zAbandoned = zr('abandonedThoughtCount', session.abandonedThoughtCount)!;
      const zRBurst = zr('rBurstCount', session.rBurstCount);
      const zCommitInv = -z('commitmentRatio', session.commitmentRatio);
      revision = zRBurst != null
        ? (zAbandoned + zRBurst + zCommitInv) / 3
        : (zAbandoned + zCommitInv) / 2;
    } else {
      revision = (
        -z('commitmentRatio', session.commitmentRatio) +
        z('revisionRate', session.revisionRate)
      ) / 2;
    }

    // ── Commitment ───────────────────────────────────────────────
    // Phase transition point: normalized time when deletions overtake
    // insertions. Early transition = early commitment to direction.
    // Strategy shift count: changes in burst-length distribution.
    // Fewer shifts = more committed to a single approach.
    let commitment: number;
    if (hasProcess && session.phaseTransitionPoint != null) {
      const zPhase = zr('phaseTransitionPoint', session.phaseTransitionPoint)!;
      const zShifts = zr('strategyShiftCount', session.strategyShiftCount);
      const zCommit = z('commitmentRatio', session.commitmentRatio);
      // Early phase transition (low value) = high commitment; negate
      // Fewer strategy shifts = more committed; negate
      commitment = zShifts != null
        ? (zCommit + (-zPhase) + (-zShifts)) / 3
        : (zCommit + (-zPhase)) / 2;
    } else {
      commitment = z('commitmentRatio', session.commitmentRatio);
    }

    // ── Volatility ───────────────────────────────────────────────
    // Euclidean distance from previous entry in the 4D subspace
    // of fluency, deliberation, revision, commitment.
    let volatility = 0;
    if (index > 0) {
      const prev = sessions[index - 1];

      // Recompute previous entry's 4D coordinates using the same logic
      let prevFluency: number;
      if (hasDynamical && prev.dfaAlpha != null) {
        const pDfa = zr('dfaAlpha', prev.dfaAlpha)!;
        const pTempo = zr('tempoDrift', prev.tempoDrift);
        const pBurst = hasBurstData
          ? z('avgPBurstLength', prev.avgPBurstLength)
          : z('charsPerMinute', prev.charsPerMinute);
        prevFluency = pTempo != null
          ? (pDfa * 2 + pBurst + (-pTempo)) / 4
          : (pDfa * 2 + pBurst) / 3;
      } else {
        prevFluency = hasBurstData
          ? z('avgPBurstLength', prev.avgPBurstLength)
          : z('charsPerMinute', prev.charsPerMinute);
      }

      let prevDeliberation: number;
      if (hasDynamical && prev.permutationEntropy != null) {
        const pPE = zr('permutationEntropy', prev.permutationEntropy)!;
        const pFirst = z('firstKeystrokeMs', prev.firstKeystrokeMs);
        const pBS = zr('pauseBetweenSentence', prev.pauseBetweenSentence);
        prevDeliberation = pBS != null
          ? (pPE + pFirst + pBS) / 3
          : (pPE + pFirst + z('pauseRatePerMinute', prev.pauseRatePerMinute)) / 3;
      } else {
        prevDeliberation = (
          z('firstKeystrokeMs', prev.firstKeystrokeMs) +
          z('pauseRatePerMinute', prev.pauseRatePerMinute) +
          z('revisionWeight', prev.revisionWeight)
        ) / 3;
      }

      let prevRevision: number;
      if (hasProcess && prev.abandonedThoughtCount != null) {
        const pAb = zr('abandonedThoughtCount', prev.abandonedThoughtCount)!;
        const pRB = zr('rBurstCount', prev.rBurstCount);
        const pCI = -z('commitmentRatio', prev.commitmentRatio);
        prevRevision = pRB != null ? (pAb + pRB + pCI) / 3 : (pAb + pCI) / 2;
      } else {
        prevRevision = (
          -z('commitmentRatio', prev.commitmentRatio) +
          z('revisionRate', prev.revisionRate)
        ) / 2;
      }

      let prevCommitment: number;
      if (hasProcess && prev.phaseTransitionPoint != null) {
        const pPh = zr('phaseTransitionPoint', prev.phaseTransitionPoint)!;
        const pSh = zr('strategyShiftCount', prev.strategyShiftCount);
        const pC = z('commitmentRatio', prev.commitmentRatio);
        prevCommitment = pSh != null ? (pC + (-pPh) + (-pSh)) / 3 : (pC + (-pPh)) / 2;
      } else {
        prevCommitment = z('commitmentRatio', prev.commitmentRatio);
      }

      volatility = Math.sqrt(
        (fluency - prevFluency) ** 2 +
        (deliberation - prevDeliberation) ** 2 +
        (revision - prevRevision) ** 2 +
        (commitment - prevCommitment) ** 2
      );
    }

    // ── Thermal ──────────────────────────────────────────────────
    // Ex-Gaussian tau: the exponential tail of the flight time
    // distribution. High tau = more attentional lapses (Zulueta 2018,
    // BiAffect). Lapse rate: IKIs exceeding mu + 3*sigma per minute.
    // These replace the crude correction rate as a measure of
    // cognitive-motor disruption.
    let thermal: number;
    if (hasMotor && session.exGaussianTau != null) {
      const zTau = zr('exGaussianTau', session.exGaussianTau)!;
      const zLapse = zr('lapseRate', session.lapseRate);
      const zCorrection = z('correctionRate', session.correctionRate);
      thermal = zLapse != null
        ? (zTau * 2 + zLapse + zCorrection) / 4
        : (zTau + zCorrection) / 2;
    } else {
      thermal = (
        z('correctionRate', session.correctionRate) +
        z('revisionTiming', session.revisionTiming)
      ) / 2;
    }

    // ── Presence ─────────────────────────────────────────────────
    // RQA determinism: are the keystroke rhythmic patterns forming
    // repeatable structures? High determinism = sustained, coherent
    // motor engagement. Transfer entropy dominance: causal coupling
    // between hold and flight times. High dominance = motor planning
    // actively driving execution (not reactive).
    let presence: number;
    if (hasDynamical && session.rqaDeterminism != null) {
      const zDet = zr('rqaDeterminism', session.rqaDeterminism)!;
      const zDom = zr('teDominance', session.teDominance);
      const zTabAway = z('tabAwayRate', session.tabAwayRatePerMinute);
      // High determinism + high TE dominance + low tab-away = high presence
      presence = zDom != null
        ? (zDet + zDom + (-zTabAway)) / 3
        : (zDet + (-zTabAway)) / 2;
    } else {
      presence = -(
        z('tabAwayRate', session.tabAwayRatePerMinute) +
        z('pauseRatePerMinute', session.pauseRatePerMinute)
      ) / 2;
    }

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
