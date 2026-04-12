/**
 * Same-Day Session Delta Module
 *
 * Computes the behavioral delta vector between same-day calibration (neutral
 * writing) and journal (reflective writing) sessions. The delta isolates what
 * the reflective question provoked, controlling for within-day confounds
 * (sleep, stress, device, time-of-day, etc.).
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
 * Delta dimensions (8 research-backed):
 *   1. deltaFirstPerson        — self-referential shift (Newman 2003)
 *   2. deltaCognitive          — cognitive load shift (Vrij)
 *   3. deltaHedging            — uncertainty/performance shift
 *   4. deltaCharsPerMinute     — production fluency disruption
 *   5. deltaCommitment         — self-censoring behavior shift
 *   6. deltaLargeDeletionCount — substantive rethinking (Faigley & Witte)
 *   7. deltaInterKeyIntervalMean — keystroke hesitation shift (Epp et al)
 *   8. deltaAvgPBurstLength    — thought-unit length shift (Chenoweth & Hayes)
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
} from './db.ts';

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
] as const;

type DeltaDimension = typeof DELTA_DIMENSIONS[number];

/** Maps delta dimension → [calibration field, journal field, label, unit] */
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

    if (std < 1e-10) continue; // no variance — skip dimension

    const z = (current - mean) / std;
    sumSqZ += z * z;
    validDims++;
  }

  if (validDims === 0) return null;
  return Math.sqrt(sumSqZ / validDims); // RMS z-score across dimensions
}

// ----------------------------------------------------------------------------
// FORMATTING: Full (for observe.ts)
// ----------------------------------------------------------------------------

const MIN_HISTORY_FOR_RANGE = 15;
const MIN_HISTORY_FOR_TREND = 7;

function getDeltaStats(history: SessionDeltaRow[], dim: DeltaDimension): { mean: number; std: number } | null {
  const values = history.map(h => h[dim]).filter((v): v is number => v != null);
  if (values.length < MIN_HISTORY_FOR_RANGE) return null;
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

  // Simple linear trend: compare first half mean to second half mean
  const mid = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(mid); // older (history is DESC)
  const secondHalf = recent.slice(0, mid); // newer
  const firstMean = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const secondMean = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  const diff = secondMean - firstMean;
  // Use 20% of the range as threshold for "meaningful" trend
  const allValues = recent;
  const range = Math.max(...allValues) - Math.min(...allValues);
  if (range < 1e-10) return 'stable';

  const threshold = range * 0.2;
  if (diff > threshold) return 'rising';
  if (diff < -threshold) return 'falling';
  return 'stable';
}

function directionLabel(delta: number): string {
  if (delta > 0) return 'increased';
  if (delta < 0) return 'decreased';
  return 'unchanged';
}

export function formatSessionDelta(
  delta: SessionDeltaRow,
  history: SessionDeltaRow[],
): string {
  const lines: string[] = [];
  lines.push('=== SAME-DAY SESSION DELTA (calibration → journal shift) ===');
  lines.push('');
  lines.push('Raw deltas (positive = higher in journal, negative = lower):');

  let hasDelta = false;
  for (const dim of DELTA_DIMENSIONS) {
    const meta = DIMENSION_META[dim];
    const deltaVal = delta[dim];
    if (deltaVal == null) continue;

    // Get raw values for context
    const calKey = `calibration${dim.slice(5)}` as keyof SessionDeltaRow; // e.g., deltaFirstPerson → calibrationFirstPerson
    const journalKey = `journal${dim.slice(5)}` as keyof SessionDeltaRow;
    const calVal = delta[calKey] as number | null;
    const journalVal = delta[journalKey] as number | null;

    const calStr = calVal != null ? meta.format(calVal) : '?';
    const journalStr = journalVal != null ? meta.format(journalVal) : '?';
    const direction = directionLabel(deltaVal);

    lines.push(`- ${meta.label}: ${calStr} → ${journalStr} (delta: ${deltaVal >= 0 ? '+' : ''}${meta.format(deltaVal)}) — ${direction} ${direction !== 'unchanged' ? meta.higherMeans.replace(/^more /, deltaVal > 0 ? 'more ' : 'less ').replace(/^faster /, deltaVal > 0 ? 'faster ' : 'slower ').replace(/^longer /, deltaVal > 0 ? 'longer ' : 'shorter ').replace(/^kept more/, deltaVal > 0 ? 'kept more' : 'kept less') : ''}`);
    hasDelta = true;
  }

  if (!hasDelta) return '';

  // Delta magnitude
  if (delta.deltaMagnitude != null) {
    lines.push('');
    lines.push(`Delta magnitude: ${delta.deltaMagnitude.toFixed(2)} (RMS z-score across dimensions)`);
  } else {
    lines.push('');
    lines.push(`Delta magnitude: insufficient history (need ${MIN_HISTORY_FOR_MAGNITUDE}+ days)`);
  }

  // Personal delta range (if enough history)
  if (history.length >= MIN_HISTORY_FOR_RANGE) {
    lines.push('');
    lines.push('PERSONAL DELTA RANGE (how typical is today\'s shift):');
    for (const dim of DELTA_DIMENSIONS) {
      const deltaVal = delta[dim];
      if (deltaVal == null) continue;
      const stats = getDeltaStats(history, dim);
      if (!stats) continue;

      const sigma = stats.std > 1e-10 ? (deltaVal - stats.mean) / stats.std : 0;
      const label = Math.abs(sigma) > 2 ? 'WELL OUTSIDE typical'
        : Math.abs(sigma) > 1 ? 'outside typical'
        : 'within typical';
      const meta = DIMENSION_META[dim];
      lines.push(`- ${meta.label}: ${label} range (today: ${meta.format(deltaVal)}, typical: ${meta.format(stats.mean)} ± ${meta.format(stats.std)}, ${sigma >= 0 ? '+' : ''}${sigma.toFixed(1)}σ)`);
    }
  }

  // Delta trend (if enough history)
  if (history.length >= MIN_HISTORY_FOR_TREND) {
    const trends: string[] = [];
    for (const dim of DELTA_DIMENSIONS) {
      const trend = getTrend(history, dim);
      if (trend && trend !== 'stable') {
        const meta = DIMENSION_META[dim];
        trends.push(`- ${meta.label} delta trending ${trend === 'rising' ? 'UP' : 'DOWN'} over last 7 days`);
      }
    }
    if (trends.length > 0) {
      lines.push('');
      lines.push('DELTA TREND (7-day direction):');
      lines.push(...trends);
    }
  }

  lines.push('');
  lines.push('Same-day deltas control for sleep, stress, device, and time-of-day. A delta near zero means the question provoked no behavioral change beyond neutral writing. When available, prefer this over the historical-average calibration deviation.');

  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// FORMATTING: Compact (for generate.ts and reflect.ts)
// ----------------------------------------------------------------------------

export function formatCompactDelta(deltas: SessionDeltaRow[]): string {
  if (deltas.length === 0) return '';

  const lines: string[] = [];
  lines.push('=== SESSION DELTA TRENDS (calibration → journal shifts) ===');

  // Show recent deltas (one line per date, only notable dimensions)
  const toShow = deltas.slice(0, 14); // most recent 14
  for (const d of toShow) {
    const parts: string[] = [];
    for (const dim of DELTA_DIMENSIONS) {
      const val = d[dim];
      if (val == null) continue;

      // Only flag dimensions that seem notable (non-trivial delta)
      const stats = getDeltaStats(deltas, dim);
      if (stats && stats.std > 1e-10) {
        const sigma = (val - stats.mean) / stats.std;
        if (Math.abs(sigma) > 1) {
          const meta = DIMENSION_META[dim];
          parts.push(`${meta.label}:${sigma >= 0 ? '+' : ''}${sigma.toFixed(1)}σ`);
        }
      }
    }
    const magStr = d.deltaMagnitude != null ? ` mag=${d.deltaMagnitude.toFixed(1)}` : '';
    const notable = parts.length > 0 ? ` [${parts.join(', ')}]` : ' [within typical]';
    lines.push(`[${d.sessionDate}]${magStr}${notable}`);
  }

  // 7-day trends
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
// FIRE-AND-FORGET WRAPPER
// ----------------------------------------------------------------------------

export function runSessionDelta(journalQuestionId: number, date: string): void {
  try {
    const calibrationSummary = getSameDayCalibrationSummary(date);
    if (!calibrationSummary) {
      console.log(`[session-delta] No same-day calibration for ${date}, skipping`);
      return;
    }

    const journalSummary = getSessionSummary(journalQuestionId);
    if (!journalSummary) {
      console.log(`[session-delta] No journal session summary for question ${journalQuestionId}, skipping`);
      return;
    }

    const history = getRecentSessionDeltas(30);
    const delta = computeSessionDelta(calibrationSummary, journalSummary, date);
    delta.deltaMagnitude = computeDeltaMagnitude(delta, history);
    saveSessionDelta(delta);

    console.log(
      `[session-delta] Computed delta for ${date}, magnitude: ${delta.deltaMagnitude?.toFixed(2) ?? 'insufficient history'}`
    );
  } catch (err) {
    console.error('[session-delta] Computation failed (non-blocking):', (err as Error).message);
  }
}
