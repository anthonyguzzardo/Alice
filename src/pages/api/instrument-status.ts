/**
 * Instrument Status API
 *
 * Returns instrument-level statistics for the research page.
 * Never surfaces user data (no response text, no signal values,
 * no traits). Only instrument metadata: counts, dates, convergence
 * status, family coverage.
 */
import type { APIRoute } from 'astro';
import sql from '../../lib/libDb.ts';
import { hasNativeEngine } from '../../lib/libSignalsNative.ts';
import { logError } from '../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  try {
    const [counts] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM tb_responses) AS responses,
        (SELECT COUNT(*)::int FROM tb_session_summaries) AS sessions,
        (SELECT COUNT(*)::int FROM tb_dynamical_signals) AS dynamical,
        (SELECT COUNT(*)::int FROM tb_motor_signals) AS motor,
        (SELECT COUNT(*)::int FROM tb_semantic_signals) AS semantic,
        (SELECT COUNT(*)::int FROM tb_process_signals) AS process,
        (SELECT COUNT(*)::int FROM tb_cross_session_signals) AS cross_session,
        (SELECT COUNT(*)::int FROM tb_reconstruction_residuals) AS residuals,
        (SELECT COUNT(*)::int FROM tb_questions WHERE question_source_id = 3) AS calibration_questions,
        (SELECT MIN(scheduled_for)::text FROM tb_questions WHERE scheduled_for IS NOT NULL) AS first_date,
        (SELECT MAX(scheduled_for)::text FROM tb_questions WHERE scheduled_for IS NOT NULL) AS latest_date
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

    // Reconstruction convergence (L2 norms by family, no raw signals)
    const convergence = await sql`
      SELECT
        ROUND(AVG(motor_l2_norm)::numeric, 1)       AS "motorL2",
        ROUND(AVG(semantic_l2_norm)::numeric, 3)     AS "semanticL2",
        ROUND(AVG(dynamical_l2_norm)::numeric, 3)    AS "dynamicalL2",
        ROUND(AVG(total_l2_norm)::numeric, 1)        AS "totalL2",
        ROUND(AVG(residual_count)::numeric, 1)       AS "avgSignals",
        ROUND(AVG(perplexity_residual)::numeric, 1)  AS "perpResidual"
      FROM tb_reconstruction_residuals
    ` as [Record<string, unknown>];

    const conv = (convergence[0] ?? {}) as {
      motorL2: string | null;
      semanticL2: string | null;
      dynamicalL2: string | null;
      totalL2: string | null;
      avgSignals: string | null;
      perpResidual: string | null;
    };

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
      convergence: {
        motorL2: conv.motorL2 ? Number(conv.motorL2) : null,
        semanticL2: conv.semanticL2 ? Number(conv.semanticL2) : null,
        dynamicalL2: conv.dynamicalL2 ? Number(conv.dynamicalL2) : null,
        totalL2: conv.totalL2 ? Number(conv.totalL2) : null,
        avgSignals: conv.avgSignals ? Number(conv.avgSignals) : null,
        perpResidual: conv.perpResidual ? Number(conv.perpResidual) : null,
      },
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
