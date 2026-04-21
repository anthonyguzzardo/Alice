/**
 * Observatory Ghost API
 *
 * Returns reconstruction residual data: per-session deltas between
 * real signals and the Markov avatar's signals, plus aggregates.
 * Powers the "Ghost in the Shell" observatory page.
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDb.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

export const GET: APIRoute = async () => {
  try {
    // All residual rows joined with question date and source label
    const sessions = await sql`
      SELECT
        r.question_id            AS "questionId",
        q.scheduled_for::text    AS date,
        r.question_source_id     AS "sourceId",
        r.total_l2_norm          AS "totalL2",
        r.dynamical_l2_norm      AS "dynL2",
        r.motor_l2_norm          AS "motL2",
        r.semantic_l2_norm       AS "semL2",
        r.residual_count         AS "residualCount",
        r.real_perplexity        AS "realPerplexity",
        r.avatar_perplexity      AS "avatarPerplexity",
        r.perplexity_residual    AS "perplexityResidual",
        r.residual_pe_spectrum   AS "peSpectrumResidual",
        r.real_pe_spectrum       AS "peSpectrumReal",
        r.avatar_pe_spectrum     AS "peSpectrumAvatar",
        r.residual_permutation_entropy  AS "resPE",
        r.residual_dfa_alpha            AS "resDFA",
        r.residual_rqa_determinism      AS "resRQADet",
        r.residual_rqa_laminarity       AS "resRQALam",
        r.residual_te_dominance         AS "resTEDom",
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
        r.corpus_size            AS "corpusSize",
        r.avatar_word_count      AS "avatarWordCount",
        r.real_word_count        AS "realWordCount",
        r.dttm_created_utc       AS "createdAt"
      FROM tb_reconstruction_residuals r
      LEFT JOIN tb_questions q ON r.question_id = q.question_id
      ORDER BY COALESCE(q.scheduled_for, r.dttm_created_utc::date) ASC
    `;

    // Aggregate stats
    const journalSessions = sessions.filter((s: any) => s.sourceId !== 3);
    const calSessions = sessions.filter((s: any) => s.sourceId === 3);

    const avg = (arr: any[], key: string) => {
      const vals = arr.map((s: any) => s[key]).filter((v: any) => v != null && Number.isFinite(v));
      return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
    };

    const latest = sessions.length > 0 ? sessions[sessions.length - 1] : null;

    const summary = {
      count: sessions.length,
      journalCount: journalSessions.length,
      calibrationCount: calSessions.length,
      avgTotalL2: avg(sessions as any[], 'totalL2'),
      journalAvgL2: avg(journalSessions as any[], 'totalL2'),
      calibrationAvgL2: avg(calSessions as any[], 'totalL2'),
      latestTotalL2: (latest as any)?.totalL2 ?? null,
      avgRealPerplexity: avg(sessions as any[], 'realPerplexity'),
      avgAvatarPerplexity: avg(sessions as any[], 'avatarPerplexity'),
    };

    return new Response(JSON.stringify({ sessions, summary }), {
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
