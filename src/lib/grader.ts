/**
 * Deterministic Prediction Grader
 *
 * Grades predictions against computed signals using code, not an LLM.
 * This breaks the circular self-evaluation loop where the observer
 * grades its own predictions using its own future observations.
 *
 * The grader evaluates structured criteria (JSON) against the signal
 * registry. Every grade is deterministic and reproducible — the same
 * inputs always produce the same output.
 *
 * Research basis:
 *   - Shumailov et al (Nature 2024): Deterministic anchors prevent
 *     model collapse in self-consuming loops.
 *   - Kenton et al (DeepMind, NeurIPS 2024): Separating evaluation
 *     from generation outperforms self-assessment.
 *   - Tetlock (2015): Predictions must be granular, time-bounded,
 *     and checkable against specific measurements.
 */

import { SIGNAL_REGISTRY, isValidSignal } from './signal-registry.ts';
import type { SessionSummaryInput, CalibrationBaseline, SessionDeltaRow } from './db.ts';
import type { DynamicsAnalysis } from './alice-negative/dynamics.ts';
import { percentileRank } from './alice-negative/helpers.ts';

// ─── Criterion Types ────────────────────────────────────────────────

type ComparisonOp = 'gt' | 'gte' | 'lt' | 'lte' | 'between';

export interface ThresholdCriterion {
  type: 'threshold';
  signal: string;
  op: ComparisonOp;
  value: number;
  value2?: number;   // only for 'between'
}

export interface PercentileCriterion {
  type: 'percentile';
  signal: string;
  op: 'above_pct' | 'below_pct';
  value: number;     // e.g. 75 means 75th percentile
}

export interface DirectionCriterion {
  type: 'direction';
  signal: string;
  op: 'increases' | 'decreases';
  referenceValue: number;
}

export interface CalibrationRelativeCriterion {
  type: 'calibration_relative';
  signal: string;
  op: 'above_calibration' | 'below_calibration';
}

export interface TextSearchCriterion {
  type: 'text_search';
  pattern: string;
  caseSensitive?: boolean;
  minOccurrences?: number;
}

export interface CompoundCriterion {
  type: 'all_of' | 'any_of';
  criteria: GradeCriterion[];
}

export type GradeCriterion =
  | ThresholdCriterion
  | PercentileCriterion
  | DirectionCriterion
  | CalibrationRelativeCriterion
  | TextSearchCriterion
  | CompoundCriterion;

export type GradeMethod = 'code' | 'text_search' | 'interpretive';

export interface StructuredPredictionCriteria {
  gradeMethod: GradeMethod;
  confirmCriteria: GradeCriterion;
  falsifyCriteria: GradeCriterion;
  windowSessions: number;
  windowMode: 'any' | 'all' | 'latest';
}

// ─── Grader Context ─────────────────────────────────────────────────

export interface GraderContext {
  session: SessionSummaryInput;
  allSummaries: SessionSummaryInput[];
  calibration: CalibrationBaseline;
  delta: SessionDeltaRow | null;
  dynamics: DynamicsAnalysis | null;
  responseText: string;
}

// ─── Grade Result ───────────────────────────────────────────────────

export type CriterionResult = 'confirmed' | 'falsified' | 'indeterminate';

export interface GradeOutput {
  finalGrade: CriterionResult;
  confirmResult: CriterionResult;
  falsifyResult: CriterionResult;
  rationale: string;
}

export interface SessionCheckResult {
  sessionDate: string;
  confirmResult: CriterionResult;
  falsifyResult: CriterionResult;
}

// ─── Signal Resolution ──────────────────────────────────────────────

/** Map calibration signal names to CalibrationBaseline fields */
const CALIBRATION_MAP: Record<string, keyof CalibrationBaseline> = {
  'session.firstKeystrokeMs':   'avgFirstKeystrokeMs',
  'session.commitmentRatio':    'avgCommitmentRatio',
  'session.totalDurationMs':    'avgDurationMs',
  'session.pauseCount':         'avgPauseCount',
  'session.deletionCount':      'avgDeletionCount',
  'session.smallDeletionCount': 'avgSmallDeletionCount',
  'session.largeDeletionCount': 'avgLargeDeletionCount',
  'session.largeDeletionChars': 'avgLargeDeletionChars',
  'session.charsPerMinute':     'avgCharsPerMinute',
  'session.pBurstCount':        'avgPBurstCount',
  'session.avgPBurstLength':    'avgPBurstLength',
};

/**
 * Resolve a signal name to its current numeric value from the grader context.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fieldAccess(obj: any, field: string): unknown { return obj[field]; }

function resolveSignal(signalName: string, ctx: GraderContext): number | null {
  const def = SIGNAL_REGISTRY[signalName];
  if (!def) return null;

  if (def.source === 'session') {
    const val = fieldAccess(ctx.session, def.field);
    return typeof val === 'number' ? val : null;
  }

  if (def.source === 'delta') {
    if (!ctx.delta) return null;
    const val = fieldAccess(ctx.delta, def.field);
    return typeof val === 'number' ? val : null;
  }

  if (def.source === 'dynamics') {
    if (!ctx.dynamics) return null;

    // Top-level dynamics fields (velocity, systemEntropy)
    if (!def.field.includes('.')) {
      const val = fieldAccess(ctx.dynamics, def.field);
      return typeof val === 'number' ? val : null;
    }

    // Per-dimension: field is "fluency.baseline", etc.
    const [dimName, param] = def.field.split('.');
    const dimData = ctx.dynamics.dimensions.find(d => d.dimension === dimName);
    if (!dimData) return null;
    const val = fieldAccess(dimData, param);
    return typeof val === 'number' ? val : null;
  }

  return null;
}

/**
 * Get historical values for a signal across all past sessions.
 * Used for percentile calculations.
 */
function getHistoricalValues(signalName: string, ctx: GraderContext): number[] {
  const def = SIGNAL_REGISTRY[signalName];
  if (!def || def.source !== 'session') return [];

  return ctx.allSummaries
    .map(s => fieldAccess(s, def.field))
    .filter((v): v is number => typeof v === 'number');
}

// ─── Criterion Evaluation ───────────────────────────────────────────

function evaluateThreshold(c: ThresholdCriterion, ctx: GraderContext): CriterionResult {
  const val = resolveSignal(c.signal, ctx);
  if (val === null) return 'indeterminate';

  switch (c.op) {
    case 'gt':      return val > c.value ? 'confirmed' : 'falsified';
    case 'gte':     return val >= c.value ? 'confirmed' : 'falsified';
    case 'lt':      return val < c.value ? 'confirmed' : 'falsified';
    case 'lte':     return val <= c.value ? 'confirmed' : 'falsified';
    case 'between': return (val >= c.value && val <= (c.value2 ?? c.value)) ? 'confirmed' : 'falsified';
  }
}

function evaluatePercentile(c: PercentileCriterion, ctx: GraderContext): CriterionResult {
  const val = resolveSignal(c.signal, ctx);
  if (val === null) return 'indeterminate';

  const history = getHistoricalValues(c.signal, ctx);
  if (history.length < 5) return 'indeterminate'; // not enough data for meaningful percentile

  const pct = percentileRank(val, history) * 100;

  if (c.op === 'above_pct') return pct >= c.value ? 'confirmed' : 'falsified';
  if (c.op === 'below_pct') return pct <= c.value ? 'confirmed' : 'falsified';
  return 'indeterminate';
}

function evaluateDirection(c: DirectionCriterion, ctx: GraderContext): CriterionResult {
  const val = resolveSignal(c.signal, ctx);
  if (val === null) return 'indeterminate';

  if (c.op === 'increases') return val > c.referenceValue ? 'confirmed' : 'falsified';
  if (c.op === 'decreases') return val < c.referenceValue ? 'confirmed' : 'falsified';
  return 'indeterminate';
}

function evaluateCalibrationRelative(c: CalibrationRelativeCriterion, ctx: GraderContext): CriterionResult {
  const val = resolveSignal(c.signal, ctx);
  if (val === null) return 'indeterminate';

  const calibField = CALIBRATION_MAP[c.signal];
  if (!calibField) return 'indeterminate';

  const calibVal = ctx.calibration[calibField];
  if (typeof calibVal !== 'number') return 'indeterminate';

  if (c.op === 'above_calibration') return val > calibVal ? 'confirmed' : 'falsified';
  if (c.op === 'below_calibration') return val < calibVal ? 'confirmed' : 'falsified';
  return 'indeterminate';
}

function evaluateTextSearch(c: TextSearchCriterion, ctx: GraderContext): CriterionResult {
  const flags = c.caseSensitive ? 'g' : 'gi';
  let regex: RegExp;
  try {
    regex = new RegExp(c.pattern, flags);
  } catch {
    return 'indeterminate'; // invalid regex
  }

  const matches = ctx.responseText.match(regex);
  const count = matches ? matches.length : 0;
  const min = c.minOccurrences ?? 1;

  return count >= min ? 'confirmed' : 'falsified';
}

function evaluateCompound(c: CompoundCriterion, ctx: GraderContext): CriterionResult {
  const results = c.criteria.map(sub => evaluateCriterion(sub, ctx));

  if (c.type === 'all_of') {
    if (results.every(r => r === 'confirmed')) return 'confirmed';
    if (results.some(r => r === 'falsified')) return 'falsified';
    return 'indeterminate';
  }

  // any_of
  if (results.some(r => r === 'confirmed')) return 'confirmed';
  if (results.every(r => r === 'falsified')) return 'falsified';
  return 'indeterminate';
}

/** Evaluate a single criterion against the grader context */
export function evaluateCriterion(criterion: GradeCriterion, ctx: GraderContext): CriterionResult {
  switch (criterion.type) {
    case 'threshold':             return evaluateThreshold(criterion, ctx);
    case 'percentile':            return evaluatePercentile(criterion, ctx);
    case 'direction':             return evaluateDirection(criterion, ctx);
    case 'calibration_relative':  return evaluateCalibrationRelative(criterion, ctx);
    case 'text_search':           return evaluateTextSearch(criterion, ctx);
    case 'all_of':
    case 'any_of':                return evaluateCompound(criterion, ctx);
  }
}

// ─── Full Prediction Grading ────────────────────────────────────────

/**
 * Grade a single session check for a structured prediction.
 * Returns confirm/falsify results for this session.
 */
export function gradeSession(
  criteria: StructuredPredictionCriteria,
  ctx: GraderContext,
): { confirmResult: CriterionResult; falsifyResult: CriterionResult } {
  return {
    confirmResult: evaluateCriterion(criteria.confirmCriteria, ctx),
    falsifyResult: evaluateCriterion(criteria.falsifyCriteria, ctx),
  };
}

/**
 * Resolve a windowed prediction's final grade from accumulated session checks.
 * Called when the window closes (enough sessions checked or prediction expires).
 */
export function resolveWindowedGrade(
  checks: SessionCheckResult[],
  windowMode: 'any' | 'all' | 'latest',
): GradeOutput {
  if (checks.length === 0) {
    return { finalGrade: 'indeterminate', confirmResult: 'indeterminate', falsifyResult: 'indeterminate', rationale: 'No session checks recorded' };
  }

  let confirmResult: CriterionResult;
  let falsifyResult: CriterionResult;

  if (windowMode === 'latest') {
    const last = checks[checks.length - 1];
    confirmResult = last.confirmResult;
    falsifyResult = last.falsifyResult;
  } else if (windowMode === 'any') {
    confirmResult = checks.some(c => c.confirmResult === 'confirmed') ? 'confirmed'
      : checks.every(c => c.confirmResult === 'falsified') ? 'falsified'
      : 'indeterminate';
    falsifyResult = checks.some(c => c.falsifyResult === 'confirmed') ? 'confirmed'
      : checks.every(c => c.falsifyResult === 'falsified') ? 'falsified'
      : 'indeterminate';
  } else {
    // 'all'
    confirmResult = checks.every(c => c.confirmResult === 'confirmed') ? 'confirmed'
      : checks.some(c => c.confirmResult === 'falsified') ? 'falsified'
      : 'indeterminate';
    falsifyResult = checks.every(c => c.falsifyResult === 'confirmed') ? 'confirmed'
      : checks.some(c => c.falsifyResult === 'falsified') ? 'falsified'
      : 'indeterminate';
  }

  const finalGrade = deriveFinalGrade(confirmResult, falsifyResult);
  const rationale = buildRationale(confirmResult, falsifyResult, checks, windowMode);
  return { finalGrade, confirmResult, falsifyResult, rationale };
}

/**
 * Grade a non-windowed prediction (windowSessions === 1) in a single pass.
 */
export function gradeImmediate(
  criteria: StructuredPredictionCriteria,
  ctx: GraderContext,
): GradeOutput {
  const { confirmResult, falsifyResult } = gradeSession(criteria, ctx);
  const finalGrade = deriveFinalGrade(confirmResult, falsifyResult);
  const rationale = buildImmediateRationale(criteria, confirmResult, falsifyResult, ctx);
  return { finalGrade, confirmResult, falsifyResult, rationale };
}

// ─── Helpers ────────────────────────────────────────────────────────

function deriveFinalGrade(confirmResult: CriterionResult, falsifyResult: CriterionResult): CriterionResult {
  // Falsification takes priority — if falsification criteria are met, it's falsified
  if (falsifyResult === 'confirmed') return 'falsified';
  // Confirmation only if confirm criteria met (falsify already checked above)
  if (confirmResult === 'confirmed') return 'confirmed';
  return 'indeterminate';
}

function buildImmediateRationale(
  criteria: StructuredPredictionCriteria,
  confirmResult: CriterionResult,
  falsifyResult: CriterionResult,
  ctx: GraderContext,
): string {
  const parts: string[] = [`[code-graded]`];

  // Collect signal values referenced in criteria for the rationale
  const signals = collectSignalNames(criteria.confirmCriteria)
    .concat(collectSignalNames(criteria.falsifyCriteria));
  const unique = [...new Set(signals)];
  const values = unique.map(s => {
    const v = resolveSignal(s, ctx);
    return `${s}=${v !== null ? v.toFixed(3) : 'null'}`;
  });

  if (values.length > 0) parts.push(`Signals: ${values.join(', ')}`);
  parts.push(`Confirm criteria: ${confirmResult}`);
  parts.push(`Falsify criteria: ${falsifyResult}`);

  return parts.join('. ');
}

function buildRationale(
  confirmResult: CriterionResult,
  falsifyResult: CriterionResult,
  checks: SessionCheckResult[],
  windowMode: string,
): string {
  const parts: string[] = [`[code-graded, windowed]`];
  parts.push(`Window: ${checks.length} sessions, mode=${windowMode}`);
  const confirmCount = checks.filter(c => c.confirmResult === 'confirmed').length;
  const falsifyCount = checks.filter(c => c.falsifyResult === 'confirmed').length;
  parts.push(`Confirm hits: ${confirmCount}/${checks.length}`);
  parts.push(`Falsify hits: ${falsifyCount}/${checks.length}`);
  parts.push(`Result: confirm=${confirmResult}, falsify=${falsifyResult}`);
  return parts.join('. ');
}

/** Recursively collect all signal names from a criterion tree */
function collectSignalNames(c: GradeCriterion): string[] {
  switch (c.type) {
    case 'all_of':
    case 'any_of':
      return c.criteria.flatMap(sub => collectSignalNames(sub));
    case 'text_search':
      return [];
    case 'threshold':
    case 'percentile':
    case 'direction':
    case 'calibration_relative':
      return [c.signal];
  }
}

// ─── Validation ─────────────────────────────────────────────────────

/**
 * Validate structured prediction criteria.
 * Returns null if valid, or an error message describing the problem.
 */
export function validateCriteria(criteria: StructuredPredictionCriteria): string | null {
  const errors: string[] = [];

  if (!['code', 'text_search', 'interpretive'].includes(criteria.gradeMethod)) {
    errors.push(`Invalid gradeMethod: ${criteria.gradeMethod}`);
  }
  if (!['any', 'all', 'latest'].includes(criteria.windowMode)) {
    errors.push(`Invalid windowMode: ${criteria.windowMode}`);
  }
  if (typeof criteria.windowSessions !== 'number' || criteria.windowSessions < 1) {
    errors.push(`Invalid windowSessions: ${criteria.windowSessions}`);
  }

  validateCriterionSignals(criteria.confirmCriteria, 'confirmCriteria', errors);
  validateCriterionSignals(criteria.falsifyCriteria, 'falsifyCriteria', errors);

  return errors.length > 0 ? errors.join('; ') : null;
}

function validateCriterionSignals(c: GradeCriterion, path: string, errors: string[]): void {
  switch (c.type) {
    case 'all_of':
    case 'any_of':
      c.criteria.forEach((sub, i) => validateCriterionSignals(sub, `${path}.${c.type}[${i}]`, errors));
      return;
    case 'text_search':
      try { new RegExp(c.pattern); } catch { errors.push(`${path}: invalid regex pattern "${c.pattern}"`); }
      return;
    case 'threshold':
    case 'percentile':
    case 'direction':
    case 'calibration_relative':
      if (!isValidSignal(c.signal)) {
        errors.push(`${path}: unknown signal "${c.signal}"`);
      }
      return;
  }
}
