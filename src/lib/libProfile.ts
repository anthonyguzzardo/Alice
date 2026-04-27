/**
 * Personal Behavioral Profile
 *
 * Computes and persists a rolling behavioral profile from journal
 * sessions only (calibration sessions excluded). Single row in
 * tb_personal_profile, rebuilt from scratch after each journal session.
 * This is the data structure the ghost avatar reads from.
 *
 * Called as the final step in the signal pipeline after all per-session
 * signals are computed. Skips calibration sessions entirely.
 */

import sql from './libDbPool.ts';
import { logError } from './utlErrorLog.ts';

// ─── Helpers ──────────────────────────────────────────────────────

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function std(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const nn = (vals: (number | null)[]): number[] => vals.filter((v): v is number => v != null);

// ─── Profile computation ──────────────────────────────────────────

export async function updateProfile(subjectId: number, questionId: number): Promise<void> {
  try {
    // Calibration sessions (question_source_id = 3) are prompted neutral writing.
    // The profile models the person's natural writing process; including calibration
    // data would contaminate the ghost's motor fingerprint, digraph latencies, and
    // pause architecture via libReconstruction.ts.
    const sourceRows = await sql`
      SELECT question_source_id FROM tb_questions
      WHERE question_id = ${questionId} AND subject_id = ${subjectId}
    `;
    if (sourceRows.length === 0) return;
    if ((sourceRows[0] as { question_source_id: number }).question_source_id === 3) return;

    // Skip if the triggering session has external input contamination (paste/drop).
    const contaminationRows = await sql`
      SELECT paste_contaminated FROM tb_semantic_signals WHERE question_id = ${questionId}
    `;
    if (contaminationRows.length > 0 && (contaminationRows[0] as { paste_contaminated: boolean }).paste_contaminated) return;

    // ── Gather all uncontaminated journal session data ──
    const summaries = await sql`
      SELECT ss.question_id,
             ss.total_duration_ms, ss.word_count, ss.total_chars_typed,
             ss.first_keystroke_ms, ss.commitment_ratio,
             ss.pause_count, ss.active_typing_ms, ss.total_pause_ms, ss.total_tab_away_ms,
             ss.inter_key_interval_mean, ss.inter_key_interval_std,
             ss.iki_skewness, ss.iki_kurtosis,
             ss.hold_time_mean, ss.hold_time_std, ss.hold_time_cv,
             ss.flight_time_mean, ss.flight_time_std,
             ss.p_burst_count, ss.avg_p_burst_length,
             ss.small_deletion_count, ss.large_deletion_count, ss.large_deletion_chars,
             ss.first_half_deletion_chars, ss.second_half_deletion_chars,
             ss.mattr
      FROM tb_session_summaries ss
      JOIN tb_questions q ON ss.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
        AND NOT EXISTS (SELECT 1 FROM tb_semantic_signals sem WHERE sem.question_id = ss.question_id AND sem.paste_contaminated = true)
      ORDER BY ss.session_summary_id ASC
    ` as any[];

    if (summaries.length === 0) return;

    // ── Motor signals (ex-Gaussian, digraph) ──
    const motorRows = await sql`
      SELECT ms.ex_gaussian_mu, ms.ex_gaussian_sigma, ms.ex_gaussian_tau,
             ms.digraph_latency_json, ms.iki_autocorrelation_json,
             ms.hold_flight_rank_corr
      FROM tb_motor_signals ms
      JOIN tb_questions q ON ms.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
        AND NOT EXISTS (SELECT 1 FROM tb_semantic_signals sem WHERE sem.question_id = ms.question_id AND sem.paste_contaminated = true)
    ` as any[];

    // ── Process signals (pause location, bursts) ──
    const processRows = await sql`
      SELECT ps.pause_within_word, ps.pause_between_word, ps.pause_between_sentence,
             ps.r_burst_count, ps.i_burst_count
      FROM tb_process_signals ps
      JOIN tb_questions q ON ps.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
        AND NOT EXISTS (SELECT 1 FROM tb_semantic_signals sem WHERE sem.question_id = ps.question_id AND sem.paste_contaminated = true)
    ` as any[];

    // ── Burst sequences for consolidation ──
    const burstRows = await sql`
      SELECT bs.question_id, bs.burst_index, bs.burst_char_count
      FROM tb_burst_sequences bs
      JOIN tb_questions q ON bs.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
        AND NOT EXISTS (SELECT 1 FROM tb_semantic_signals sem WHERE sem.question_id = bs.question_id AND sem.paste_contaminated = true)
      ORDER BY bs.question_id, bs.burst_index
    ` as any[];

    // ── R-burst sequences for revision profile ──
    const rburstRows = await sql`
      SELECT rs.question_id, rs.burst_index, rs.deleted_char_count,
             rs.burst_duration_ms, rs.is_leading_edge
      FROM tb_rburst_sequences rs
      JOIN tb_questions q ON rs.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
        AND NOT EXISTS (SELECT 1 FROM tb_semantic_signals sem WHERE sem.question_id = rs.question_id AND sem.paste_contaminated = true)
      ORDER BY rs.question_id, rs.burst_index
    ` as any[];

    // ── Response texts for trigram model + vocab ──
    const textRows = await sql`
      SELECT r.text
      FROM tb_responses r
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE q.subject_id = ${subjectId}
        AND q.question_source_id != 3
        AND NOT EXISTS (SELECT 1 FROM tb_semantic_signals sem WHERE sem.question_id = r.question_id AND sem.paste_contaminated = true)
      ORDER BY q.scheduled_for ASC
    ` as any[];

    // ── Compute motor fingerprint ──
    const muVals = nn(motorRows.map((r: any) => r.ex_gaussian_mu));
    const sigmaVals = nn(motorRows.map((r: any) => r.ex_gaussian_sigma));
    const tauVals = nn(motorRows.map((r: any) => r.ex_gaussian_tau));

    // Aggregate digraph profile: mean per bigram across all sessions
    const digraphAgg: Record<string, { holds: number[]; flights: number[] }> = {};
    for (const row of motorRows) {
      if (!row.digraph_latency_json) continue;
      const profile = typeof row.digraph_latency_json === 'string'
        ? JSON.parse(row.digraph_latency_json)
        : row.digraph_latency_json;
      for (const [key, val] of Object.entries(profile as Record<string, number>)) {
        if (!digraphAgg[key]) digraphAgg[key] = { holds: [], flights: [] };
        digraphAgg[key].holds.push(val);
      }
    }
    const digraphAggregate: Record<string, number> = {};
    for (const [key, { holds }] of Object.entries(digraphAgg)) {
      digraphAggregate[key] = mean(holds);
    }

    // ── Compute IKI autocorrelation lag-1 mean ──
    const autoLag1Vals: number[] = [];
    for (const row of motorRows) {
      if (!row.iki_autocorrelation_json) continue;
      const acf = typeof row.iki_autocorrelation_json === 'string'
        ? JSON.parse(row.iki_autocorrelation_json)
        : row.iki_autocorrelation_json;
      if (Array.isArray(acf) && acf.length > 0 && typeof acf[0] === 'number' && isFinite(acf[0])) {
        autoLag1Vals.push(acf[0]);
      }
    }

    // ── Compute hold-flight rank correlation mean ──
    const holdFlightCorrVals = nn(motorRows.map((r: any) => r.hold_flight_rank_corr));

    // ── Compute writing process shape ──
    const burstCounts = nn(summaries.map((s: any) => s.p_burst_count));
    const burstLengths = nn(summaries.map((s: any) =>
      s.avg_p_burst_length != null && s.avg_p_burst_length > 0 ? s.avg_p_burst_length : null
    ));

    // Burst consolidation: per-session second-half/first-half ratio, then average
    const consolidationRatios: number[] = [];
    const burstsByQuestion = new Map<number, Array<{ burst_index: number; burst_char_count: number }>>();
    for (const b of burstRows) {
      if (!burstsByQuestion.has(b.question_id)) burstsByQuestion.set(b.question_id, []);
      burstsByQuestion.get(b.question_id)!.push(b);
    }
    for (const [, bursts] of burstsByQuestion) {
      if (bursts.length < 4) continue;
      const mid = Math.floor(bursts.length / 2);
      const firstHalf = bursts.slice(0, mid);
      const secondHalf = bursts.slice(mid);
      const firstAvg = mean(firstHalf.map(b => b.burst_char_count));
      const secondAvg = mean(secondHalf.map(b => b.burst_char_count));
      if (firstAvg > 0) consolidationRatios.push(secondAvg / firstAvg);
    }

    // R-burst consolidation: same approach as P-burst, on deleted_char_count
    const rburstConsolidationRatios: number[] = [];
    const allRburstSizes: number[] = [];
    const allRburstDurations: number[] = [];
    let rburstLeadingEdgeCount = 0;
    let rburstTotalCount = 0;
    const rburstsByQuestion = new Map<number, Array<{ deleted_char_count: number; burst_duration_ms: number; is_leading_edge: boolean }>>();
    for (const r of rburstRows) {
      if (!rburstsByQuestion.has(r.question_id)) rburstsByQuestion.set(r.question_id, []);
      rburstsByQuestion.get(r.question_id)!.push(r);
      allRburstSizes.push(r.deleted_char_count);
      allRburstDurations.push(r.burst_duration_ms);
      rburstTotalCount++;
      if (r.is_leading_edge) rburstLeadingEdgeCount++;
    }
    for (const [, rbursts] of rburstsByQuestion) {
      if (rbursts.length < 4) continue;
      const mid = Math.floor(rbursts.length / 2);
      const firstHalf = rbursts.slice(0, mid);
      const secondHalf = rbursts.slice(mid);
      const firstAvg = mean(firstHalf.map(b => b.deleted_char_count));
      const secondAvg = mean(secondHalf.map(b => b.deleted_char_count));
      if (firstAvg > 0) rburstConsolidationRatios.push(secondAvg / firstAvg);
    }

    const durations = nn(summaries.map((s: any) => s.total_duration_ms));
    const wordCounts = nn(summaries.map((s: any) => s.word_count));

    // ── Compute pause architecture ──
    const pauseWithin = nn(processRows.map((r: any) => r.pause_within_word));
    const pauseBetween = nn(processRows.map((r: any) => r.pause_between_word));
    const pauseSent = nn(processRows.map((r: any) => r.pause_between_sentence));

    // Normalize to percentages per session
    const pausePcts = processRows
      .filter((r: any) => r.pause_within_word != null)
      .map((r: any) => {
        const total = (r.pause_within_word || 0) + (r.pause_between_word || 0) + (r.pause_between_sentence || 0);
        if (total === 0) return null;
        return {
          within: (r.pause_within_word || 0) / total,
          between: (r.pause_between_word || 0) / total,
          sentence: (r.pause_between_sentence || 0) / total,
        };
      })
      .filter((v: any): v is { within: number; between: number; sentence: number } => v != null);

    const pauseRates = summaries.map((s: any) => {
      const activeMs = s.active_typing_ms ?? Math.max(1, (s.total_duration_ms || 1) - (s.total_pause_ms || 0) - (s.total_tab_away_ms || 0));
      const activeMin = activeMs / 60000;
      return activeMin > 0 ? (s.pause_count || 0) / activeMin : null;
    });

    const firstKeystrokes = nn(summaries.map((s: any) => s.first_keystroke_ms));

    // ── Compute revision topology ──
    const smallDelRates = summaries
      .filter((s: any) => s.small_deletion_count != null && s.total_chars_typed > 0)
      .map((s: any) => s.small_deletion_count / (s.total_chars_typed / 100));
    const largeDelRates = summaries
      .filter((s: any) => s.large_deletion_count != null && s.total_chars_typed > 0)
      .map((s: any) => s.large_deletion_count / (s.total_chars_typed / 100));

    const revisionTimings = summaries
      .filter((s: any) => s.first_half_deletion_chars != null && s.second_half_deletion_chars != null)
      .map((s: any) => {
        const total = (s.first_half_deletion_chars || 0) + (s.second_half_deletion_chars || 0);
        return total > 0 ? (s.second_half_deletion_chars || 0) / total : 0.5;
      });

    const rBurstRatios = processRows
      .filter((r: any) => r.r_burst_count != null && r.i_burst_count != null)
      .map((r: any) => {
        const total = (r.r_burst_count || 0) + (r.i_burst_count || 0);
        return total > 0 ? (r.r_burst_count || 0) / total : 0;
      });

    // ── Compute language signature ──
    const allTexts = textRows.map((r: any) => r.text as string).filter(Boolean);

    // Character trigram model
    const trigramCounts: Record<string, Record<string, number>> = {};
    for (const text of allTexts) {
      const lower = text.toLowerCase();
      for (let i = 0; i < lower.length - 2; i++) {
        const ctx = lower.slice(i, i + 2);
        const next = lower[i + 2];
        if (!trigramCounts[ctx]) trigramCounts[ctx] = {};
        trigramCounts[ctx][next] = (trigramCounts[ctx][next] || 0) + 1;
      }
    }

    // Cumulative vocabulary
    const allWords = new Set<string>();
    for (const text of allTexts) {
      const words = text.toLowerCase().replace(/[^a-z'\s-]/g, '').split(/\s+/).filter((w: string) => w.length > 2);
      for (const w of words) allWords.add(w);
    }

    const mattrs = nn(summaries.map((s: any) => s.mattr));

    // ── Upsert profile ──
    const ikiMeans = nn(summaries.map((s: any) => s.inter_key_interval_mean));
    const ikiStds = nn(summaries.map((s: any) => s.inter_key_interval_std));
    const ikiSkews = nn(summaries.map((s: any) => s.iki_skewness));
    const ikiKurts = nn(summaries.map((s: any) => s.iki_kurtosis));
    const holdMeans = nn(summaries.map((s: any) => s.hold_time_mean));
    const flightMeans = nn(summaries.map((s: any) => s.flight_time_mean));
    const holdCvs = nn(summaries.map((s: any) => s.hold_time_cv));

    const digraphJson = Object.keys(digraphAggregate).length > 0
      ? JSON.stringify(digraphAggregate) : null;
    const trigramJson = Object.keys(trigramCounts).length > 0
      ? JSON.stringify(trigramCounts) : null;

    // Delete existing row and insert fresh (simpler than massive upsert)
    await sql.begin(async (tx) => {
      await tx`DELETE FROM tb_personal_profile WHERE subject_id = ${subjectId}`;
      await tx`
        INSERT INTO tb_personal_profile (
          subject_id, session_count, last_question_id,
          digraph_aggregate_json,
          ex_gaussian_mu_mean, ex_gaussian_mu_std,
          ex_gaussian_sigma_mean, ex_gaussian_sigma_std,
          ex_gaussian_tau_mean, ex_gaussian_tau_std,
          iki_mean_mean, iki_mean_std, iki_std_mean,
          iki_skewness_mean, iki_kurtosis_mean,
          hold_time_mean_mean, hold_time_mean_std,
          flight_time_mean_mean, flight_time_mean_std,
          hold_time_cv_mean,
          burst_count_mean, burst_count_std,
          burst_length_mean, burst_length_std,
          burst_consolidation,
          session_duration_mean, session_duration_std,
          word_count_mean, word_count_std,
          pause_within_word_pct, pause_between_word_pct, pause_between_sent_pct,
          pause_rate_mean, first_keystroke_mean, first_keystroke_std,
          small_del_rate_mean, large_del_rate_mean,
          revision_timing_bias, r_burst_ratio_mean,
          rburst_consolidation, rburst_mean_size, rburst_mean_duration, rburst_leading_edge_pct,
          trigram_model_json, vocab_cumulative,
          mattr_mean, mattr_std,
          iki_autocorrelation_lag1_mean, hold_flight_rank_correlation,
          dttm_updated_utc
        ) VALUES (
          ${subjectId}, ${summaries.length}, ${questionId},
          ${digraphJson},
          ${muVals.length > 0 ? mean(muVals) : null}, ${muVals.length > 1 ? std(muVals) : null},
          ${sigmaVals.length > 0 ? mean(sigmaVals) : null}, ${sigmaVals.length > 1 ? std(sigmaVals) : null},
          ${tauVals.length > 0 ? mean(tauVals) : null}, ${tauVals.length > 1 ? std(tauVals) : null},
          ${ikiMeans.length > 0 ? mean(ikiMeans) : null}, ${ikiMeans.length > 1 ? std(ikiMeans) : null},
          ${ikiStds.length > 0 ? mean(ikiStds) : null},
          ${ikiSkews.length > 0 ? mean(ikiSkews) : null},
          ${ikiKurts.length > 0 ? mean(ikiKurts) : null},
          ${holdMeans.length > 0 ? mean(holdMeans) : null}, ${holdMeans.length > 1 ? std(holdMeans) : null},
          ${flightMeans.length > 0 ? mean(flightMeans) : null}, ${flightMeans.length > 1 ? std(flightMeans) : null},
          ${holdCvs.length > 0 ? mean(holdCvs) : null},
          ${burstCounts.length > 0 ? mean(burstCounts) : null}, ${burstCounts.length > 1 ? std(burstCounts) : null},
          ${burstLengths.length > 0 ? mean(burstLengths) : null}, ${burstLengths.length > 1 ? std(burstLengths) : null},
          ${consolidationRatios.length > 0 ? mean(consolidationRatios) : null},
          ${durations.length > 0 ? mean(durations) : null}, ${durations.length > 1 ? std(durations) : null},
          ${wordCounts.length > 0 ? mean(wordCounts) : null}, ${wordCounts.length > 1 ? std(wordCounts) : null},
          ${pausePcts.length > 0 ? mean(pausePcts.map(p => p.within)) : null},
          ${pausePcts.length > 0 ? mean(pausePcts.map(p => p.between)) : null},
          ${pausePcts.length > 0 ? mean(pausePcts.map(p => p.sentence)) : null},
          ${nn(pauseRates).length > 0 ? mean(nn(pauseRates)) : null},
          ${firstKeystrokes.length > 0 ? mean(firstKeystrokes) : null},
          ${firstKeystrokes.length > 1 ? std(firstKeystrokes) : null},
          ${smallDelRates.length > 0 ? mean(smallDelRates) : null},
          ${largeDelRates.length > 0 ? mean(largeDelRates) : null},
          ${revisionTimings.length > 0 ? mean(revisionTimings) : null},
          ${rBurstRatios.length > 0 ? mean(rBurstRatios) : null},
          ${rburstConsolidationRatios.length > 0 ? mean(rburstConsolidationRatios) : null},
          ${allRburstSizes.length > 0 ? mean(allRburstSizes) : null},
          ${allRburstDurations.length > 0 ? mean(allRburstDurations) : null},
          ${rburstTotalCount > 0 ? rburstLeadingEdgeCount / rburstTotalCount : null},
          ${trigramJson}, ${allWords.size},
          ${mattrs.length > 0 ? mean(mattrs) : null}, ${mattrs.length > 1 ? std(mattrs) : null},
          ${autoLag1Vals.length > 0 ? mean(autoLag1Vals) : null},
          ${holdFlightCorrVals.length > 0 ? mean(holdFlightCorrVals) : null},
          NOW()
        )
      `;
    });
  } catch (err) {
    logError('profile.update', err, { subjectId, questionId });
  }
}
