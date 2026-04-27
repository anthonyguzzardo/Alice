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

export const GET: APIRoute = async () => {
  // Owner-pinned because the research page is the owner's n=1 paper claim.
  // If multi-subject rollup is ever wanted, build a separate endpoint
  // (e.g. /api/population-stats); do NOT mix populations here. Mixing would
  // silently invalidate the n=1 framing the page is anchored on.
  const subjectId = OWNER_SUBJECT_ID;
  try {
    const [counts] = await sql`
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
    ` as [Record<string, unknown>];

    const c = counts as {
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
    };

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

    // Reconstruction convergence: baseline (variant 1) for paper continuity,
    // full adversary (variant 5) for the strongest claim, both needed by research page.
    // Prior to multi-adversary (migration 010), all rows have adversary_variant_id = 1.
    const convergenceQuery = (variantId: number) => sql`
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
    `;

    // Per-variant behavioral L2 summary for multi-adversary comparison
    const variantSummary = await sql`
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
    ` as Array<Record<string, unknown>>;

    const [baselineRows, fullAdversaryRows] = await Promise.all([
      convergenceQuery(1),
      convergenceQuery(5),
    ]);

    const parseConv = (rows: Array<Record<string, unknown>>) => {
      const r = (rows[0] ?? {}) as Record<string, string | null>;
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

    const baseline = parseConv(baselineRows as Array<Record<string, unknown>>);
    const fullAdversary = parseConv(fullAdversaryRows as Array<Record<string, unknown>>);

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
