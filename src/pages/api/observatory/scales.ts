/**
 * Observatory Scales API
 *
 * Returns all dynamical + motor complexity signals for every session,
 * organized for time-series rendering on the Scales page.
 * Includes pe_spectrum and mse_series arrays for multi-scale visualization.
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDbPool.ts';
import { logError } from '../../../lib/utlErrorLog.ts';
import { resolveObservatorySubjectId, badSubjectResponse } from '../../../lib/libObservatorySubject.ts';

export const GET: APIRoute = async ({ request }) => {
  try {
    const subjectId = await resolveObservatorySubjectId(request);
    const sessions = await sql`
      SELECT
        ds.question_id,
        q.scheduled_for::text AS date,
        ds.iki_count,
        ds.hold_flight_count,
        ds.permutation_entropy,
        ds.permutation_entropy_raw,
        ds.pe_spectrum,
        ds.dfa_alpha,
        ds.mfdfa_spectrum_width,
        ds.mfdfa_asymmetry,
        ds.mfdfa_peak_alpha,
        ds.temporal_irreversibility,
        ds.iki_psd_spectral_slope,
        ds.iki_psd_respiratory_peak_hz,
        ds.peak_typing_frequency_hz,
        ds.iki_psd_lf_hf_ratio,
        ds.iki_psd_fast_slow_variance_ratio,
        ds.statistical_complexity,
        ds.forbidden_pattern_fraction,
        ds.weighted_pe,
        ds.lempel_ziv_complexity,
        ds.optn_transition_entropy,
        ds.optn_forbidden_transition_count,
        ds.rqa_determinism,
        ds.rqa_laminarity,
        ds.rqa_trapping_time,
        ds.rqa_recurrence_rate,
        ds.rqa_recurrence_time_entropy,
        ds.rqa_mean_recurrence_time,
        ds.recurrence_transitivity,
        ds.recurrence_avg_path_length,
        ds.recurrence_clustering,
        ds.recurrence_assortativity,
        ds.effective_information,
        ds.causal_emergence_index,
        ds.optimal_causal_scale,
        ds.pid_synergy,
        ds.pid_redundancy,
        ds.branching_ratio,
        ds.avalanche_size_exponent,
        ds.dmd_dominant_frequency,
        ds.dmd_dominant_decay_rate,
        ds.dmd_mode_count,
        ds.dmd_spectral_entropy,
        ds.pause_mixture_component_count,
        ds.pause_mixture_motor_proportion,
        ds.pause_mixture_cognitive_load_index,
        ds.te_hold_to_flight,
        ds.te_flight_to_hold,
        ds.te_dominance,
        ms.mse_series,
        ms.complexity_index,
        ms.ex_gaussian_fisher_trace
      FROM tb_dynamical_signals ds
      JOIN tb_questions q ON ds.question_id = q.question_id
      LEFT JOIN tb_motor_signals ms ON ds.question_id = ms.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
      ORDER BY q.scheduled_for ASC
    `;

    return new Response(JSON.stringify({ sessions }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const r = badSubjectResponse(err);
    if (r) return r;
    logError('api.observatory.scales', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch scales data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
