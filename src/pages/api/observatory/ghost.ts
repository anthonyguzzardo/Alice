/**
 * Observatory Ghost API
 *
 * Returns reconstruction residual data: per-session deltas between
 * real signals and the avatar's signals, plus aggregates.
 * Powers the "Ghost in the Shell" observatory page.
 *
 * Query params:
 *   ?variant=all  (default) - returns data grouped by variant
 *   ?variant=1..5           - returns data for a single variant
 */
import type { APIRoute } from 'astro';
import sql, { OWNER_SUBJECT_ID } from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

const VARIANT_NAMES: Record<number, string> = {
  1: 'baseline',
  2: 'conditional_timing',
  3: 'copula_motor',
  4: 'ppm_text',
  5: 'full_adversary',
};

function buildSummary(sessions: any[]) {
  const journalSessions = sessions.filter((s: any) => s.sourceId !== 3);
  const calSessions = sessions.filter((s: any) => s.sourceId === 3);

  const avg = (arr: any[], key: string) => {
    const vals = arr.map((s: any) => s[key]).filter((v: any) => v != null && Number.isFinite(v));
    return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
  };

  const latest = sessions.length > 0 ? sessions[sessions.length - 1] : null;

  const finiteTE = sessions
    .map((s: any) => s.resTEDom)
    .filter((v: any) => v != null && Number.isFinite(v));
  const teMean = finiteTE.length > 0
    ? finiteTE.reduce((a: number, b: number) => a + b, 0) / finiteTE.length
    : null;
  const teStdDev = finiteTE.length > 1 && teMean != null
    ? Math.sqrt(finiteTE.reduce((s: number, v: number) => s + (v - teMean) ** 2, 0) / (finiteTE.length - 1))
    : null;
  const teCV = teMean != null && teStdDev != null && Math.abs(teMean) > 0.001
    ? teStdDev / Math.abs(teMean)
    : null;

  return {
    count: sessions.length,
    journalCount: journalSessions.length,
    calibrationCount: calSessions.length,
    // Primary: behavioral L2 (paper-reported, ghost-validated)
    avgBehavioralL2: avg(sessions, 'behavioralL2'),
    journalBehavioralL2: avg(journalSessions, 'behavioralL2'),
    calibrationBehavioralL2: avg(calSessions, 'behavioralL2'),
    latestBehavioralL2: latest?.behavioralL2 ?? null,
    // Component breakdowns
    avgDynL2: avg(sessions, 'dynL2'),
    avgMotL2: avg(sessions, 'motL2'),
    avgRealPerplexity: avg(sessions, 'realPerplexity'),
    avgAvatarPerplexity: avg(sessions, 'avatarPerplexity'),
    avgSelfPerplexity: avg(sessions, 'selfPerplexity'),
    te: { finiteCount: finiteTE.length, mean: teMean, stdDev: teStdDev, cv: teCV },
    // Semantic: stored but NOT ghost-validated (Phase 2 baseline system)
    avgSemL2: avg(sessions, 'semL2'),
    // Deprecated: total includes semantic, not paper-reported
    avgTotalL2: avg(sessions, 'totalL2'),
  };
}

export const GET: APIRoute = async ({ request }) => {
  // Owner-only observatory endpoint.
  // TODO(step5): review.
  const subjectId = OWNER_SUBJECT_ID;
  try {
    const url = new URL(request.url);
    const variantParam = url.searchParams.get('variant') ?? 'all';

    // All residual rows joined with question date, source, and cross-session perplexity
    const allRows = await sql`
      SELECT
        r.question_id            AS "questionId",
        r.adversary_variant_id   AS "variantId",
        q.scheduled_for::text    AS date,
        r.question_source_id     AS "sourceId",
        r.behavioral_l2_norm     AS "behavioralL2",
        r.behavioral_residual_count AS "behavioralCount",
        r.total_l2_norm          AS "totalL2",
        r.dynamical_l2_norm      AS "dynL2",
        r.motor_l2_norm          AS "motL2",
        r.semantic_l2_norm       AS "semL2",
        r.residual_count         AS "residualCount",
        r.real_perplexity        AS "realPerplexity",
        r.avatar_perplexity      AS "avatarPerplexity",
        r.perplexity_residual    AS "perplexityResidual",
        cs.self_perplexity       AS "selfPerplexity",
        r.residual_pe_spectrum   AS "peSpectrumResidual",
        r.real_pe_spectrum       AS "peSpectrumReal",
        r.avatar_pe_spectrum     AS "peSpectrumAvatar",
        r.residual_permutation_entropy  AS "resPE",
        r.residual_dfa_alpha            AS "resDFA",
        r.residual_rqa_determinism      AS "resRQADet",
        r.residual_rqa_laminarity       AS "resRQALam",
        r.residual_te_dominance         AS "resTEDom",
        r.real_te_dominance             AS "realTEDom",
        r.avatar_te_dominance           AS "avatarTEDom",
        r.residual_sample_entropy       AS "resSampEn",
        r.residual_motor_jerk           AS "resJerk",
        r.residual_lapse_rate           AS "resLapse",
        r.residual_tempo_drift          AS "resDrift",
        r.residual_ex_gaussian_tau      AS "resTau",
        r.residual_tau_proportion       AS "resTauProp",
        r.residual_idea_density         AS "resIdea",
        r.residual_lexical_sophistication AS "resLex",
        r.residual_epistemic_stance     AS "resEpist",
        r.residual_integrative_complexity AS "resInteg",
        r.residual_deep_cohesion        AS "resCohes",
        r.residual_text_compression_ratio AS "resCompress",
        r.extended_residuals_json AS "extendedResiduals",
        r.corpus_size            AS "corpusSize",
        r.avatar_word_count      AS "avatarWordCount",
        r.real_word_count        AS "realWordCount",
        r.dttm_created_utc       AS "createdAt"
      FROM tb_reconstruction_residuals r
      LEFT JOIN tb_questions q ON r.question_id = q.question_id
      LEFT JOIN tb_cross_session_signals cs ON r.question_id = cs.question_id
      WHERE r.subject_id = ${subjectId}
      ORDER BY COALESCE(q.scheduled_for, r.dttm_created_utc::date) ASC, r.adversary_variant_id ASC
    `;

    // Single variant mode (backward compatible)
    if (variantParam !== 'all') {
      const vId = parseInt(variantParam, 10) || 1;
      const sessions = (allRows as any[]).filter((r: any) => r.variantId === vId);
      return new Response(JSON.stringify({
        sessions,
        summary: buildSummary(sessions),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // All variants mode: group by variant
    const variantGroups: Record<number, any[]> = {};
    for (const row of allRows as any[]) {
      const vid = row.variantId ?? 1;
      if (!variantGroups[vid]) variantGroups[vid] = [];
      variantGroups[vid].push(row);
    }

    const variants = Object.entries(variantGroups).map(([idStr, sessions]) => {
      const id = parseInt(idStr, 10);
      return {
        id,
        name: VARIANT_NAMES[id] ?? `variant_${id}`,
        sessions,
        summary: buildSummary(sessions),
      };
    });

    // Comparison: avg L2 norms per variant (behavioral is primary)
    const comparison: Record<number, { avgBehavioral: number | null; avgDyn: number | null; avgMot: number | null; avgSem: number | null }> = {};
    for (const v of variants) {
      const avg = (key: string) => {
        const vals = v.sessions.map((s: any) => s[key]).filter((x: any) => x != null && Number.isFinite(x));
        return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
      };
      comparison[v.id] = {
        avgBehavioral: avg('behavioralL2'),
        avgDyn: avg('dynL2'),
        avgMot: avg('motL2'),
        avgSem: avg('semL2'),
      };
    }

    return new Response(JSON.stringify({ variants, comparison }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError('api.observatory.ghost', err);
    return new Response(JSON.stringify({ error: 'failed to load ghost data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
