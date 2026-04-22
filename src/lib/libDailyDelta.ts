/**
 * Daily Delta Module (retrospective, day-N+1 batch)
 *
 * Computes the behavioral delta vector between same-day calibration (neutral
 * writing) and journal (reflective writing) sessions. The delta isolates what
 * the reflective question provoked, controlling for within-day confounds
 * (sleep, stress, device, time-of-day, etc.).
 *
 * Timing: calibration always happens AFTER the journal session in the daily
 * flow. Deltas are therefore computed retrospectively — the nightly batch job
 * scans for completed day-pairs (journal + calibration on the same date) and
 * fills in any missing delta rows. The output is a stored record, not a
 * real-time input to any session prompt.
 *
 * Multi-calibration rule: when multiple calibrations exist for a single day,
 * the LAST calibration is used for delta pairing. It is closest in time to
 * the journal session and reflects stabilized behavioral state after any
 * warm-up effects. This rule applies only to delta pairing — drift snapshots
 * (libCalibrationDrift.ts) continue to process every calibration submission.
 *
 * Research basis:
 *   - Pennebaker (1986): Expressive writing paradigm — neutral vs emotional
 *     writing as within-person control. The foundational design for isolating
 *     emotional processing signal from baseline cognitive state.
 *   - Toledo et al (2024): 76-89% of stress response variance is within-day,
 *     validating same-day controls over between-day baselines.
 *   - Collins et al (2025): Self-referential language from diary text detects
 *     depression with AUC 0.68 — first-person density shifts are signal.
 *   - Lambert OQ-45 (Shimokawa et al 2010): Deviation-from-expected-trajectory
 *     detects 85-100% of deteriorating therapy cases, N=6151.
 *   - Newman et al (2003): First-person pronoun drop as distancing marker.
 *   - Vrij (2000): Cognitive density as cognitive load indicator.
 *   - Epp et al (2011): Keystroke dynamics as emotional state markers.
 *   - Chenoweth & Hayes (2001): P-burst length as thought-unit fluency.
 *   - Faigley & Witte (1981): Large deletions as substantive revision.
 *
 * Delta dimensions (10 research-backed):
 *   1. deltaFirstPerson        — self-referential shift (Newman 2003)
 *   2. deltaCognitive          — cognitive load shift (Vrij)
 *   3. deltaHedging            — uncertainty/performance shift
 *   4. deltaCharsPerMinute     — production fluency disruption
 *   5. deltaCommitment         — self-censoring behavior shift
 *   6. deltaLargeDeletionCount — substantive rethinking (Faigley & Witte)
 *   7. deltaInterKeyIntervalMean — keystroke hesitation shift (Epp et al)
 *   8. deltaAvgPBurstLength    — thought-unit length shift (Chenoweth & Hayes)
 *   9. deltaHoldTimeMean       — motor press duration shift
 *  10. deltaFlightTimeMean     — inter-key cognitive pause shift
 *
 * Plus deltaMagnitude: Euclidean distance in z-score normalized delta-space.
 */

import {
  type SessionSummaryInput,
  type SessionDeltaRow,
  getSameDayCalibrationSummary,
  getSessionSummary,
  getRecentSessionDeltas,
  saveSessionDelta,
} from './libDb.ts';
import sql from './libDbPool.ts';

// ----------------------------------------------------------------------------
// DELTA DIMENSION DEFINITIONS
// ----------------------------------------------------------------------------

const DELTA_DIMENSIONS = [
  'deltaFirstPerson',
  'deltaCognitive',
  'deltaHedging',
  'deltaCharsPerMinute',
  'deltaCommitment',
  'deltaLargeDeletionCount',
  'deltaInterKeyIntervalMean',
  'deltaAvgPBurstLength',
  'deltaHoldTimeMean',
  'deltaFlightTimeMean',
] as const;

type DeltaDimension = typeof DELTA_DIMENSIONS[number];

/** Maps delta dimension -> metadata for formatting */
const DIMENSION_META: Record<DeltaDimension, {
  calField: keyof SessionSummaryInput;
  label: string;
  unit: string;
  format: (v: number) => string;
  higherMeans: string;
}> = {
  deltaFirstPerson: {
    calField: 'firstPersonDensity',
    label: 'First-person density',
    unit: '',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    higherMeans: 'more self-referential',
  },
  deltaCognitive: {
    calField: 'cognitiveDensity',
    label: 'Cognitive density',
    unit: '',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    higherMeans: 'more cognitive processing',
  },
  deltaHedging: {
    calField: 'hedgingDensity',
    label: 'Hedging density',
    unit: '',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    higherMeans: 'more uncertainty language',
  },
  deltaCharsPerMinute: {
    calField: 'charsPerMinute',
    label: 'Typing speed',
    unit: 'cpm',
    format: (v) => `${v.toFixed(0)} cpm`,
    higherMeans: 'faster production',
  },
  deltaCommitment: {
    calField: 'commitmentRatio',
    label: 'Commitment',
    unit: '',
    format: (v) => `${(v * 100).toFixed(0)}%`,
    higherMeans: 'kept more of what was typed',
  },
  deltaLargeDeletionCount: {
    calField: 'largeDeletionCount',
    label: 'Large deletions',
    unit: '',
    format: (v) => `${v.toFixed(0)}`,
    higherMeans: 'more substantive revision',
  },
  deltaInterKeyIntervalMean: {
    calField: 'interKeyIntervalMean',
    label: 'Keystroke interval',
    unit: 'ms',
    format: (v) => `${v.toFixed(0)}ms`,
    higherMeans: 'more hesitation',
  },
  deltaAvgPBurstLength: {
    calField: 'avgPBurstLength',
    label: 'P-burst length',
    unit: 'chars',
    format: (v) => `${v.toFixed(0)} chars`,
    higherMeans: 'longer thought-units',
  },
  deltaHoldTimeMean: {
    calField: 'holdTimeMean',
    label: 'Hold time',
    unit: 'ms',
    format: (v) => `${v.toFixed(0)}ms`,
    higherMeans: 'longer key press duration (motor)',
  },
  deltaFlightTimeMean: {
    calField: 'flightTimeMean',
    label: 'Flight time',
    unit: 'ms',
    format: (v) => `${v.toFixed(0)}ms`,
    higherMeans: 'longer pause between keys (cognitive)',
  },
};

// ----------------------------------------------------------------------------
// CORE COMPUTATION
// ----------------------------------------------------------------------------

function safeDelta(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null;
  return b - a; // journal minus calibration
}

export function computeSessionDelta(
  calibration: SessionSummaryInput,
  journal: SessionSummaryInput,
  date: string,
): SessionDeltaRow {
  const delta: SessionDeltaRow = {
    sessionDeltaId: 0, // assigned by DB
    sessionDate: date,
    calibrationQuestionId: calibration.questionId,
    journalQuestionId: journal.questionId,
    // Deltas (journal - calibration)
    deltaFirstPerson: safeDelta(calibration.firstPersonDensity, journal.firstPersonDensity),
    deltaCognitive: safeDelta(calibration.cognitiveDensity, journal.cognitiveDensity),
    deltaHedging: safeDelta(calibration.hedgingDensity, journal.hedgingDensity),
    deltaCharsPerMinute: safeDelta(calibration.charsPerMinute, journal.charsPerMinute),
    deltaCommitment: safeDelta(calibration.commitmentRatio, journal.commitmentRatio),
    deltaLargeDeletionCount: safeDelta(calibration.largeDeletionCount, journal.largeDeletionCount),
    deltaInterKeyIntervalMean: safeDelta(calibration.interKeyIntervalMean, journal.interKeyIntervalMean),
    deltaAvgPBurstLength: safeDelta(calibration.avgPBurstLength, journal.avgPBurstLength),
    deltaHoldTimeMean: safeDelta(calibration.holdTimeMean, journal.holdTimeMean),
    deltaFlightTimeMean: safeDelta(calibration.flightTimeMean, journal.flightTimeMean),
    deltaMagnitude: null, // computed separately with history
    // Raw values for auditability
    calibrationFirstPerson: calibration.firstPersonDensity ?? null,
    journalFirstPerson: journal.firstPersonDensity ?? null,
    calibrationCognitive: calibration.cognitiveDensity ?? null,
    journalCognitive: journal.cognitiveDensity ?? null,
    calibrationHedging: calibration.hedgingDensity ?? null,
    journalHedging: journal.hedgingDensity ?? null,
    calibrationCharsPerMinute: calibration.charsPerMinute ?? null,
    journalCharsPerMinute: journal.charsPerMinute ?? null,
    calibrationCommitment: calibration.commitmentRatio ?? null,
    journalCommitment: journal.commitmentRatio ?? null,
    calibrationLargeDeletionCount: calibration.largeDeletionCount ?? null,
    journalLargeDeletionCount: journal.largeDeletionCount ?? null,
    calibrationInterKeyIntervalMean: calibration.interKeyIntervalMean ?? null,
    journalInterKeyIntervalMean: journal.interKeyIntervalMean ?? null,
    calibrationAvgPBurstLength: calibration.avgPBurstLength ?? null,
    journalAvgPBurstLength: journal.avgPBurstLength ?? null,
    calibrationHoldTimeMean: calibration.holdTimeMean ?? null,
    journalHoldTimeMean: journal.holdTimeMean ?? null,
    calibrationFlightTimeMean: calibration.flightTimeMean ?? null,
    journalFlightTimeMean: journal.flightTimeMean ?? null,
  };

  return delta;
}

// ----------------------------------------------------------------------------
// DELTA MAGNITUDE (z-score normalized Euclidean distance)
// ----------------------------------------------------------------------------

const MIN_HISTORY_FOR_MAGNITUDE = 10;

export function computeDeltaMagnitude(
  delta: SessionDeltaRow,
  history: SessionDeltaRow[],
): number | null {
  if (history.length < MIN_HISTORY_FOR_MAGNITUDE) return null;

  let sumSqZ = 0;
  let validDims = 0;

  for (const dim of DELTA_DIMENSIONS) {
    const current = delta[dim];
    if (current == null) continue;

    const pastValues = history
      .map(h => h[dim])
      .filter((v): v is number => v != null);
    if (pastValues.length < MIN_HISTORY_FOR_MAGNITUDE) continue;

    const mean = pastValues.reduce((s, v) => s + v, 0) / pastValues.length;
    const variance = pastValues.reduce((s, v) => s + (v - mean) ** 2, 0) / pastValues.length;
    const std = Math.sqrt(variance);

    if (std < 1e-10) continue; // no variance

    const z = (current - mean) / std;
    sumSqZ += z * z;
    validDims++;
  }

  if (validDims === 0) return null;
  return Math.sqrt(sumSqZ / validDims); // RMS z-score across dimensions
}

// ----------------------------------------------------------------------------
// FORMATTING: Compact (for generate.ts)
// ----------------------------------------------------------------------------

const MIN_HISTORY_FOR_TREND = 7;

function getDeltaStats(history: SessionDeltaRow[], dim: DeltaDimension): { mean: number; std: number } | null {
  const values = history.map(h => h[dim]).filter((v): v is number => v != null);
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

function getTrend(history: SessionDeltaRow[], dim: DeltaDimension): 'rising' | 'falling' | 'stable' | null {
  const recent = history
    .slice(0, MIN_HISTORY_FOR_TREND)
    .map(h => h[dim])
    .filter((v): v is number => v != null);
  if (recent.length < 3) return null;

  const mid = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(mid); // older (history is DESC)
  const secondHalf = recent.slice(0, mid); // newer
  const firstMean = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const secondMean = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  const diff = secondMean - firstMean;
  const range = Math.max(...recent) - Math.min(...recent);
  if (range < 1e-10) return 'stable';

  const threshold = range * 0.2;
  if (diff > threshold) return 'rising';
  if (diff < -threshold) return 'falling';
  return 'stable';
}

export function formatCompactDelta(deltas: SessionDeltaRow[]): string {
  if (deltas.length === 0) return '';

  const lines: string[] = [];
  lines.push('=== DAILY DELTA TRENDS (calibration vs journal shifts) ===');

  const toShow = deltas.slice(0, 14);
  for (const d of toShow) {
    const parts: string[] = [];
    for (const dim of DELTA_DIMENSIONS) {
      const val = d[dim];
      if (val == null) continue;

      const stats = getDeltaStats(deltas, dim);
      if (stats && stats.std > 1e-10) {
        const sigma = (val - stats.mean) / stats.std;
        if (Math.abs(sigma) > 1) {
          const meta = DIMENSION_META[dim];
          parts.push(`${meta.label}:${sigma >= 0 ? '+' : ''}${sigma.toFixed(1)}s`);
        }
      }
    }
    const magStr = d.deltaMagnitude != null ? ` mag=${d.deltaMagnitude.toFixed(1)}` : '';
    const notable = parts.length > 0 ? ` [${parts.join(', ')}]` : ' [within typical]';
    lines.push(`[${d.sessionDate}]${magStr}${notable}`);
  }

  if (deltas.length >= MIN_HISTORY_FOR_TREND) {
    const trends: string[] = [];
    for (const dim of DELTA_DIMENSIONS) {
      const trend = getTrend(deltas, dim);
      if (trend && trend !== 'stable') {
        const meta = DIMENSION_META[dim];
        trends.push(`${meta.label} ${trend}`);
      }
    }
    if (trends.length > 0) {
      lines.push(`7-day trends: ${trends.join(', ')}`);
    }
  }

  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// BATCH JOB: Retrospective daily delta backfill
// ----------------------------------------------------------------------------

/**
 * Find all dates where both a journal session and at least one calibration
 * session exist, but no delta row has been computed yet.
 */
async function getEligibleDatesWithoutDelta(): Promise<Array<{ date: string; journalQuestionId: number }>> {
  const rows = await sql`
    SELECT j.scheduled_for::text AS date, j.question_id AS "journalQuestionId"
    FROM tb_questions j
    JOIN tb_session_summaries js ON j.question_id = js.question_id
    WHERE j.question_source_id != 3
      AND j.scheduled_for IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM tb_questions c
        JOIN tb_session_summaries cs ON c.question_id = cs.question_id
        WHERE c.question_source_id = 3
          AND c.dttm_created_utc::date = j.scheduled_for
      )
      AND NOT EXISTS (
        SELECT 1 FROM tb_session_delta d
        WHERE d.session_date::date = j.scheduled_for
      )
    ORDER BY j.scheduled_for ASC
  `;
  return rows as Array<{ date: string; journalQuestionId: number }>;
}

/**
 * Scan the entire history for day-pairs (journal + calibration on the same
 * date) that have no delta row yet, and compute + store deltas for each.
 *
 * Idempotent: days with existing delta rows are skipped. Uses ON CONFLICT
 * DO UPDATE as a secondary safety net. Safe to re-run after interruption.
 *
 * Called from the nightly runGeneration flow before question generation,
 * and from the standalone backfill script.
 */
export async function runDailyDeltaBackfill(): Promise<number> {
  const eligible = await getEligibleDatesWithoutDelta();
  if (eligible.length === 0) {
    console.log('[daily-delta] No new day-pairs to process.');
    return 0;
  }

  console.log(`[daily-delta] Found ${eligible.length} day-pair(s) to process.`);
  let computed = 0;

  for (const { date, journalQuestionId } of eligible) {
    try {
      // getSameDayCalibrationSummary already returns the LAST calibration
      // of the day (ORDER BY dttm_created_utc DESC LIMIT 1)
      const calibrationSummary = await getSameDayCalibrationSummary(date);
      if (!calibrationSummary) continue; // shouldn't happen given the EXISTS check

      const journalSummary = await getSessionSummary(journalQuestionId);
      if (!journalSummary) continue;

      const history = await getRecentSessionDeltas(30);
      const delta = computeSessionDelta(calibrationSummary, journalSummary, date);
      delta.deltaMagnitude = computeDeltaMagnitude(delta, history);
      await saveSessionDelta(delta);

      computed++;
      console.log(
        `[daily-delta] ${date}: magnitude=${delta.deltaMagnitude?.toFixed(2) ?? 'insufficient history'}`
      );
    } catch (err) {
      console.error(`[daily-delta] Failed for ${date}:`, (err as Error).message);
    }
  }

  console.log(`[daily-delta] Backfill complete: ${computed}/${eligible.length} deltas computed.`);
  return computed;
}
