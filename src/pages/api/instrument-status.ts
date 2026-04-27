/**
 * Instrument Status API
 *
 * Returns instrument-level statistics for the research page.
 * Never surfaces user data (no response text, no signal values,
 * no traits). Only instrument metadata: counts, dates, convergence
 * status, family coverage.
 */
import type { APIRoute } from 'astro';
import sql, { OWNER_SUBJECT_ID } from '../../lib/libDb.ts';
import { hasNativeEngine } from '../../lib/libSignalsNative.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export interface InstrumentStatusCounts {
  responses: number;
  sessions: number;
  dynamical: number;
  motor: number;
  semantic: number;
  process: number;
  cross_session: number;
  residuals: number;
  calibration_questions: number;
  first_date: string | null;
  latest_date: string | null;
}

/** Per-subject row-counts and date-bounds across every behavioral
 *  table the research page surfaces. Eleven scoping sites — one per
 *  subselect / aggregate. The endpoint owns one row per subject; we
 *  return a single row per call. */
export async function getInstrumentStatusCounts(subjectId: number): Promise<InstrumentStatusCounts> {
  const [row] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM tb_responses WHERE subject_id = ${subjectId}) AS responses,
      (SELECT COUNT(*)::int FROM tb_session_summaries WHERE subject_id = ${subjectId}) AS sessions,
      (SELECT COUNT(*)::int FROM tb_dynamical_signals WHERE subject_id = ${subjectId}) AS dynamical,
      (SELECT COUNT(*)::int FROM tb_motor_signals WHERE subject_id = ${subjectId}) AS motor,
      (SELECT COUNT(*)::int FROM tb_semantic_signals WHERE subject_id = ${subjectId}) AS semantic,
      (SELECT COUNT(*)::int FROM tb_process_signals WHERE subject_id = ${subjectId}) AS process,
      (SELECT COUNT(*)::int FROM tb_cross_session_signals WHERE subject_id = ${subjectId}) AS cross_session,
      (SELECT COUNT(*)::int FROM tb_reconstruction_residuals WHERE subject_id = ${subjectId}) AS residuals,
      (SELECT COUNT(*)::int FROM tb_questions WHERE subject_id = ${subjectId} AND question_source_id = 3) AS calibration_questions,
      (SELECT MIN(scheduled_for)::text FROM tb_questions WHERE subject_id = ${subjectId} AND scheduled_for IS NOT NULL) AS first_date,
      (SELECT MAX(scheduled_for)::text FROM tb_questions WHERE subject_id = ${subjectId} AND scheduled_for IS NOT NULL) AS latest_date
  ` as [InstrumentStatusCounts];
  return row;
}

export interface ConvergenceRow {
  behavioralL2: string | null;
  behavioralSignals: string | null;
  motorL2: string | null;
  dynamicalL2: string | null;
  perpResidual: string | null;
  journalBehavioralL2: string | null;
  calibrationBehavioralL2: string | null;
  semanticL2: string | null;
  totalL2: string | null;
}

/** Per-variant convergence aggregates over tb_reconstruction_residuals.
 *  One row per (subjectId, variantId) — used by the research page to
 *  compare the baseline reconstruction against full-adversary. */
export async function getConvergenceForVariant(subjectId: number, variantId: number): Promise<ConvergenceRow | null> {
  const rows = await sql`
    SELECT
      ROUND(AVG(behavioral_l2_norm)::numeric, 1)   AS "behavioralL2",
      ROUND(AVG(behavioral_residual_count)::numeric, 1) AS "behavioralSignals",
      ROUND(AVG(motor_l2_norm)::numeric, 1)         AS "motorL2",
      ROUND(AVG(dynamical_l2_norm)::numeric, 3)     AS "dynamicalL2",
      ROUND(AVG(perplexity_residual)::numeric, 1)   AS "perpResidual",
      ROUND(AVG(CASE WHEN question_source_id != 3 THEN behavioral_l2_norm END)::numeric, 1) AS "journalBehavioralL2",
      ROUND(AVG(CASE WHEN question_source_id = 3 THEN behavioral_l2_norm END)::numeric, 1)  AS "calibrationBehavioralL2",
      ROUND(AVG(semantic_l2_norm)::numeric, 3)      AS "semanticL2",
      ROUND(AVG(total_l2_norm)::numeric, 1)         AS "totalL2"
    FROM tb_reconstruction_residuals
    WHERE subject_id = ${subjectId} AND adversary_variant_id = ${variantId}
  ` as ConvergenceRow[];
  return rows[0] ?? null;
}

export interface VariantSummaryRow {
  variantId: number;
  behavioralL2: string | null;
  motorL2: string | null;
  dynamicalL2: string | null;
  semanticL2: string | null;
  sessions: number;
}

/** Per-variant row-counts and L2 aggregates for the multi-adversary
 *  comparison panel. */
export async function getVariantSummary(subjectId: number): Promise<VariantSummaryRow[]> {
  return await sql`
    SELECT
      adversary_variant_id AS "variantId",
      ROUND(AVG(behavioral_l2_norm)::numeric, 1) AS "behavioralL2",
      ROUND(AVG(motor_l2_norm)::numeric, 1) AS "motorL2",
      ROUND(AVG(dynamical_l2_norm)::numeric, 3) AS "dynamicalL2",
      ROUND(AVG(semantic_l2_norm)::numeric, 3) AS "semanticL2",
      COUNT(*)::int AS "sessions"
    FROM tb_reconstruction_residuals
    WHERE subject_id = ${subjectId}
    GROUP BY adversary_variant_id
    ORDER BY adversary_variant_id
  ` as VariantSummaryRow[];
}

export const GET: APIRoute = async () => {
  // Owner-pinned because the research page is the owner's n=1 paper claim.
  // If multi-subject rollup is ever wanted, build a separate endpoint
  // (e.g. /api/population-stats); do NOT mix populations here. Mixing would
  // silently invalidate the n=1 framing the page is anchored on.
  const subjectId = OWNER_SUBJECT_ID;
  try {
    const counts = await getInstrumentStatusCounts(subjectId);

    const c = counts;

    // Days of continuous data
    const firstDate = c.first_date ? new Date(c.first_date) : null;
    const latestDate = c.latest_date ? new Date(c.latest_date) : null;
    const daysActive = firstDate && latestDate
      ? Math.floor((latestDate.getTime() - firstDate.getTime()) / 86400000) + 1
      : 0;

    // Signal families active (has at least 1 row)
    const families = [
      { name: 'dynamical', count: c.dynamical },
      { name: 'motor', count: c.motor },
      { name: 'semantic', count: c.semantic },
      { name: 'process', count: c.process },
      { name: 'cross-session', count: c.cross_session },
    ];
    const activeFamilies = families.filter(f => f.count > 0).length;

    // Per-variant behavioral L2 summary for multi-adversary comparison
    const variantSummary = await getVariantSummary(subjectId);

    const [baselineRow, fullAdversaryRow] = await Promise.all([
      getConvergenceForVariant(subjectId, 1),
      getConvergenceForVariant(subjectId, 5),
    ]);

    const parseConv = (row: ConvergenceRow | null) => {
      const r = (row ?? {}) as Record<string, string | null>;
      return {
        behavioralL2: r.behavioralL2 ? Number(r.behavioralL2) : null,
        behavioralSignals: r.behavioralSignals ? Number(r.behavioralSignals) : null,
        motorL2: r.motorL2 ? Number(r.motorL2) : null,
        dynamicalL2: r.dynamicalL2 ? Number(r.dynamicalL2) : null,
        perpResidual: r.perpResidual ? Number(r.perpResidual) : null,
        journalBehavioralL2: r.journalBehavioralL2 ? Number(r.journalBehavioralL2) : null,
        calibrationBehavioralL2: r.calibrationBehavioralL2 ? Number(r.calibrationBehavioralL2) : null,
        // Semantic and total preserved as diagnostics (not paper-reported)
        semanticL2: r.semanticL2 ? Number(r.semanticL2) : null,
        totalL2: r.totalL2 ? Number(r.totalL2) : null,
      };
    };

    const baseline = parseConv(baselineRow);
    const fullAdversary = parseConv(fullAdversaryRow);

    return new Response(JSON.stringify({
      daysActive,
      firstDate: c.first_date,
      latestDate: c.latest_date,
      sessions: c.sessions,
      responses: c.responses,
      calibrationSessions: c.calibration_questions,
      signalFamilies: { active: activeFamilies, total: 5 },
      reconstructionResiduals: c.residuals,
      rustEngine: hasNativeEngine,
      // Baseline (variant 1) for backward compat with paper's published numbers
      convergence: baseline,
      // Full adversary (variant 5) for the strongest claim
      fullAdversary,
      // Per-variant summary for multi-adversary comparison
      variants: variantSummary.map(v => ({
        variantId: Number(v.variantId),
        behavioralL2: v.behavioralL2 ? Number(v.behavioralL2) : null,
        motorL2: v.motorL2 ? Number(v.motorL2) : null,
        dynamicalL2: v.dynamicalL2 ? Number(v.dynamicalL2) : null,
        semanticL2: v.semanticL2 ? Number(v.semanticL2) : null,
        sessions: Number(v.sessions),
      })),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.instrument-status', err);
    return new Response(JSON.stringify({ error: 'unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
