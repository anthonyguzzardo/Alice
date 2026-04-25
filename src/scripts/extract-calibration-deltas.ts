/**
 * Extract per-signal-family deltas between journal and calibration sessions.
 *
 * For each day with both a journal and calibration session, computes
 * journal_value - calibration_value for every signal in every family.
 * Reports descriptive statistics on the delta distribution.
 *
 * Run: npx tsx src/scripts/extract-calibration-deltas.ts
 */
import sql from '../lib/libDbPool.ts';

// ─── Find matched pairs ─────────────────────────────────────────────

interface MatchedPair {
  date: string;
  journalQuestionId: number;
  calibrationQuestionId: number;
}

async function findMatchedPairs(): Promise<MatchedPair[]> {
  const rows = await sql`
    SELECT
      j.scheduled_for::text AS date,
      j.question_id AS "journalQuestionId",
      (
        SELECT c.question_id
        FROM tb_questions c
        JOIN tb_session_summaries cs ON cs.question_id = c.question_id
        WHERE c.question_source_id = 3
          AND c.dttm_created_utc::date = j.scheduled_for
        ORDER BY c.dttm_created_utc DESC
        LIMIT 1
      ) AS "calibrationQuestionId"
    FROM tb_questions j
    JOIN tb_session_summaries js ON js.question_id = j.question_id
    WHERE j.question_source_id != 3
      AND j.scheduled_for IS NOT NULL
    ORDER BY j.scheduled_for ASC
  ` as { date: string; journalQuestionId: number; calibrationQuestionId: number | null }[];

  return rows.filter(r => r.calibrationQuestionId != null) as MatchedPair[];
}

// ─── Signal family definitions ───────────────────────────────────────

interface SignalDef {
  table: string;
  columns: string[];
  idColumn: string;
}

const FAMILIES: Record<string, SignalDef> = {
  'Dynamical': {
    table: 'tb_dynamical_signals',
    idColumn: 'question_id',
    columns: [
      'permutation_entropy', 'dfa_alpha',
      'mfdfa_spectrum_width', 'mfdfa_asymmetry', 'mfdfa_peak_alpha',
      'temporal_irreversibility',
      'iki_psd_spectral_slope', 'iki_psd_lf_hf_ratio',
      'statistical_complexity', 'forbidden_pattern_fraction', 'weighted_pe', 'lempel_ziv_complexity',
      'optn_transition_entropy',
      'rqa_determinism', 'rqa_laminarity', 'rqa_trapping_time', 'rqa_recurrence_rate',
      'rqa_recurrence_time_entropy', 'rqa_mean_recurrence_time',
      'recurrence_transitivity', 'recurrence_avg_path_length', 'recurrence_clustering', 'recurrence_assortativity',
      'effective_information', 'causal_emergence_index',
      'pid_synergy', 'pid_redundancy',
      'branching_ratio',
      'dmd_dominant_frequency', 'dmd_dominant_decay_rate', 'dmd_spectral_entropy',
      'te_hold_to_flight', 'te_flight_to_hold', 'te_dominance',
    ],
  },
  'Motor': {
    table: 'tb_motor_signals',
    idColumn: 'question_id',
    columns: [
      'sample_entropy', 'complexity_index',
      'ex_gaussian_mu', 'ex_gaussian_sigma', 'ex_gaussian_tau', 'tau_proportion',
      'ex_gaussian_fisher_trace',
      'motor_jerk', 'lapse_rate', 'tempo_drift',
      'iki_compression_ratio',
      'adjacent_hold_time_cov', 'hold_flight_rank_corr',
    ],
  },
  'Process': {
    table: 'tb_process_signals',
    idColumn: 'question_id',
    columns: [
      'pause_within_word', 'pause_between_word', 'pause_between_sentence',
      'abandoned_thought_count',
      'r_burst_count', 'i_burst_count',
      'vocab_expansion_rate',
      'phase_transition_point', 'strategy_shift_count',
    ],
  },
  'Semantic': {
    table: 'tb_semantic_signals',
    idColumn: 'question_id',
    columns: [
      'idea_density', 'lexical_sophistication', 'epistemic_stance',
      'integrative_complexity', 'deep_cohesion', 'referential_cohesion',
      'emotional_valence_arc', 'text_compression_ratio',
      'discourse_global_coherence', 'discourse_local_coherence',
      'discourse_global_local_ratio', 'discourse_coherence_decay_slope',
    ],
  },
  'Cross-Session': {
    table: 'tb_cross_session_signals',
    idColumn: 'question_id',
    columns: [
      'self_perplexity', 'motor_self_perplexity',
      'ncd_lag_1', 'ncd_lag_3', 'ncd_lag_7', 'ncd_lag_30',
      'vocab_recurrence_decay', 'digraph_stability',
      'text_network_density', 'text_network_communities', 'bridging_ratio',
    ],
  },
};

// ─── Stats helpers ───────────────────────────────────────────────────

function mean(vals: number[]): number {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function std(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}

function median(vals: number[]): number {
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const pairs = await findMatchedPairs();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CALIBRATION DELTA ANALYSIS');
  console.log('  Journal minus Calibration, per signal family');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Matched day-pairs: ${pairs.length}`);
  console.log(`  Date range: ${pairs[0]?.date ?? '?'} to ${pairs[pairs.length - 1]?.date ?? '?'}`);
  console.log('');

  for (const [familyName, def] of Object.entries(FAMILIES)) {
    console.log(`\n── ${familyName} (${def.table}, ${def.columns.length} signals) ──\n`);

    // Collect per-signal deltas across all pairs
    const signalDeltas: Record<string, number[]> = {};
    for (const col of def.columns) signalDeltas[col] = [];

    let pairsWithData = 0;

    for (const pair of pairs) {
      const colList = def.columns.join(', ');
      const journalRows = await sql.unsafe(
        `SELECT ${colList} FROM ${def.table} WHERE ${def.idColumn} = $1`,
        [pair.journalQuestionId]
      );
      const calRows = await sql.unsafe(
        `SELECT ${colList} FROM ${def.table} WHERE ${def.idColumn} = $1`,
        [pair.calibrationQuestionId]
      );

      if (journalRows.length === 0 || calRows.length === 0) continue;
      pairsWithData++;

      const j = journalRows[0] as Record<string, number | null>;
      const c = calRows[0] as Record<string, number | null>;

      for (const col of def.columns) {
        const jv = j[col];
        const cv = c[col];
        if (jv != null && cv != null && Number.isFinite(jv) && Number.isFinite(cv)) {
          signalDeltas[col]!.push(jv - cv);
        }
      }
    }

    console.log(`  Pairs with both journal + calibration rows: ${pairsWithData}/${pairs.length}`);
    console.log('');
    console.log('  Signal                             |   n | Mean Delta |   Std    | Median   | Direction');
    console.log('  ───────────────────────────────────┼─────┼────────────┼──────────┼──────────┼──────────');

    const familySummary: { signal: string; meanDelta: number; n: number }[] = [];

    for (const col of def.columns) {
      const vals = signalDeltas[col]!;
      if (vals.length === 0) {
        console.log(`  ${col.padEnd(36)} | ${' '.repeat(3)} |     (no data)`);
        continue;
      }

      const m = mean(vals);
      const s = std(vals);
      const med = median(vals);
      const dir = m > 0.001 ? 'journal >' : m < -0.001 ? 'calib >' : 'neutral';

      familySummary.push({ signal: col, meanDelta: m, n: vals.length });

      console.log(
        `  ${col.padEnd(36)} | ${String(vals.length).padStart(3)} | ${m >= 0 ? ' ' : ''}${m.toFixed(4).padStart(9)} | ${s.toFixed(4).padStart(8)} | ${med >= 0 ? ' ' : ''}${med.toFixed(4).padStart(8)} | ${dir}`
      );
    }

    // Family-level summary
    const validSignals = familySummary.filter(s => s.n > 0);
    if (validSignals.length > 0) {
      const absMeans = validSignals.map(s => Math.abs(s.meanDelta));
      const familyMeanAbsDelta = mean(absMeans);
      const journalHigher = validSignals.filter(s => s.meanDelta > 0.001).length;
      const calibHigher = validSignals.filter(s => s.meanDelta < -0.001).length;
      const neutral = validSignals.length - journalHigher - calibHigher;

      console.log('');
      console.log(`  Family mean |delta|: ${familyMeanAbsDelta.toFixed(4)}`);
      console.log(`  Signals where journal > calibration: ${journalHigher}/${validSignals.length}`);
      console.log(`  Signals where calibration > journal: ${calibHigher}/${validSignals.length}`);
      console.log(`  Neutral: ${neutral}/${validSignals.length}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
