/**
 * Extract per-family residual decomposition from reconstruction residuals.
 *
 * Produces the data table for Option H (residual decomposition paper).
 * Run: npx tsx src/scripts/extract-residual-decomposition.ts
 */
import sql from '../lib/libDbPool.ts';

// ─── Family definitions ──────────────────────────────────────────────
// Maps theoretical families to signal names.
// Extended signals are in extended_residuals_json JSONB.
// Original signals are in fixed columns (residual_*).

interface FamilyDef {
  name: string;
  signals: { key: string; source: 'extended' | 'fixed' }[];
}

const FAMILIES: FamilyDef[] = [
  {
    name: 'Multifractal',
    signals: [
      { key: 'mfdfa_spectrum_width', source: 'extended' },
      { key: 'mfdfa_asymmetry', source: 'extended' },
    ],
  },
  {
    name: 'Temporal Irreversibility',
    signals: [
      { key: 'temporal_irreversibility', source: 'extended' },
    ],
  },
  {
    name: 'Motor Complexity',
    signals: [
      { key: 'complexity_index', source: 'extended' },
      { key: 'ex_gaussian_fisher_trace', source: 'extended' },
    ],
  },
  {
    name: 'Motor Distribution',
    signals: [
      { key: 'sample_entropy', source: 'fixed' },
      { key: 'motor_jerk', source: 'fixed' },
      { key: 'lapse_rate', source: 'fixed' },
      { key: 'tempo_drift', source: 'fixed' },
      { key: 'ex_gaussian_tau', source: 'fixed' },
      { key: 'tau_proportion', source: 'fixed' },
    ],
  },
  {
    name: 'Recurrence (RQA)',
    signals: [
      { key: 'rqa_determinism', source: 'fixed' },
      { key: 'rqa_laminarity', source: 'fixed' },
      { key: 'rqa_recurrence_time_entropy', source: 'extended' },
      { key: 'rqa_mean_recurrence_time', source: 'extended' },
    ],
  },
  {
    name: 'Recurrence Networks',
    signals: [
      { key: 'recurrence_transitivity', source: 'extended' },
      { key: 'recurrence_avg_path_length', source: 'extended' },
      { key: 'recurrence_clustering', source: 'extended' },
      { key: 'recurrence_assortativity', source: 'extended' },
    ],
  },
  {
    name: 'Causal Emergence',
    signals: [
      { key: 'effective_information', source: 'extended' },
      { key: 'causal_emergence_index', source: 'extended' },
      { key: 'pid_synergy', source: 'extended' },
      { key: 'pid_redundancy', source: 'extended' },
      { key: 'branching_ratio', source: 'extended' },
      { key: 'avalanche_size_exponent', source: 'extended' },
    ],
  },
  {
    name: 'Spectral',
    signals: [
      { key: 'iki_psd_spectral_slope', source: 'extended' },
      { key: 'iki_psd_respiratory_peak_hz', source: 'extended' },
      { key: 'iki_psd_lf_hf_ratio', source: 'extended' },
    ],
  },
  {
    name: 'Dynamic Modes',
    signals: [
      { key: 'dmd_dominant_frequency', source: 'extended' },
      { key: 'dmd_dominant_decay_rate', source: 'extended' },
      { key: 'dmd_spectral_entropy', source: 'extended' },
    ],
  },
  {
    name: 'Scaling (DFA)',
    signals: [
      { key: 'dfa_alpha', source: 'fixed' },
    ],
  },
  {
    name: 'Transfer Entropy',
    signals: [
      { key: 'te_dominance', source: 'fixed' },
    ],
  },
  {
    name: 'Permutation Entropy',
    signals: [
      { key: 'permutation_entropy', source: 'fixed' },
    ],
  },
  {
    name: 'Ordinal Statistics',
    signals: [
      { key: 'statistical_complexity', source: 'extended' },
      { key: 'forbidden_pattern_fraction', source: 'extended' },
      { key: 'weighted_pe', source: 'extended' },
      { key: 'lempel_ziv_complexity', source: 'extended' },
      { key: 'optn_transition_entropy', source: 'extended' },
    ],
  },
];

const VARIANT_NAMES: Record<number, string> = {
  1: 'Baseline',
  2: 'Conditional Timing',
  3: 'Copula Motor',
  4: 'PPM Text',
  5: 'Full Adversary',
};

// ─── Data extraction ─────────────────────────────────────────────────

interface ResidualRow {
  question_id: number;
  adversary_variant_id: number;
  extended_residuals_json: Record<string, { real: number | null; avatar: number | null; residual: number | null }> | null;
  residual_permutation_entropy: number | null;
  residual_dfa_alpha: number | null;
  residual_rqa_determinism: number | null;
  residual_rqa_laminarity: number | null;
  residual_te_dominance: number | null;
  residual_sample_entropy: number | null;
  residual_motor_jerk: number | null;
  residual_lapse_rate: number | null;
  residual_tempo_drift: number | null;
  residual_ex_gaussian_tau: number | null;
  residual_tau_proportion: number | null;
}

function getResidualValue(row: ResidualRow, key: string, source: 'extended' | 'fixed'): number | null {
  if (source === 'extended') {
    const ext = row.extended_residuals_json;
    if (!ext || !ext[key]) return null;
    const v = ext[key].residual;
    return v != null && Number.isFinite(v) ? v : null;
  }
  const colName = `residual_${key}` as keyof ResidualRow;
  const v = row[colName] as number | null;
  return v != null && Number.isFinite(v) ? v : null;
}

function mean(vals: number[]): number {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function std(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}

async function main() {
  const rows = await sql`
    SELECT
      question_id,
      adversary_variant_id,
      extended_residuals_json,
      residual_permutation_entropy,
      residual_dfa_alpha,
      residual_rqa_determinism,
      residual_rqa_laminarity,
      residual_te_dominance,
      residual_sample_entropy,
      residual_motor_jerk,
      residual_lapse_rate,
      residual_tempo_drift,
      residual_ex_gaussian_tau,
      residual_tau_proportion
    FROM tb_reconstruction_residuals
    WHERE question_source_id != 3
    ORDER BY adversary_variant_id, question_id
  ` as ResidualRow[];

  const sessions = new Set(rows.map(r => r.question_id));
  const withExtended = rows.filter(r => r.extended_residuals_json != null);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RECONSTRUCTION RESIDUAL DECOMPOSITION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total residual rows: ${rows.length}`);
  console.log(`  Unique journal sessions: ${sessions.size}`);
  console.log(`  Rows with extended residuals: ${withExtended.length}`);
  console.log(`  Variants: ${[...new Set(rows.map(r => r.adversary_variant_id))].sort().join(', ')}`);
  console.log('');

  // ── Per-variant, per-family analysis ─────────────────────────────
  for (const variantId of [5, 1, 2, 3, 4]) {
    const variantRows = rows.filter(r => r.adversary_variant_id === variantId);
    console.log(`\n── Variant ${variantId}: ${VARIANT_NAMES[variantId]} (n=${variantRows.length} sessions) ──\n`);

    const familyResults: { name: string; meanAbsResidual: number; stdAbsResidual: number; n: number; signals: number }[] = [];

    for (const family of FAMILIES) {
      // Collect per-session family-level mean absolute residuals
      const sessionMeans: number[] = [];

      for (const row of variantRows) {
        const absResiduals: number[] = [];
        for (const sig of family.signals) {
          const v = getResidualValue(row, sig.key, sig.source);
          if (v != null) absResiduals.push(Math.abs(v));
        }
        if (absResiduals.length > 0) {
          sessionMeans.push(mean(absResiduals));
        }
      }

      if (sessionMeans.length > 0) {
        familyResults.push({
          name: family.name,
          meanAbsResidual: mean(sessionMeans),
          stdAbsResidual: std(sessionMeans),
          n: sessionMeans.length,
          signals: family.signals.length,
        });
      }
    }

    // Sort by mean residual descending
    familyResults.sort((a, b) => b.meanAbsResidual - a.meanAbsResidual);

    const minResidual = Math.min(...familyResults.map(f => f.meanAbsResidual));

    // Print table
    console.log('  Family                    | Signals | Mean |Res|  Std     | n  | Ratio');
    console.log('  ──────────────────────────┼─────────┼──────────┼──────────┼────┼──────');
    for (const f of familyResults) {
      const ratio = minResidual > 0 ? (f.meanAbsResidual / minResidual).toFixed(1) : '-';
      console.log(
        `  ${f.name.padEnd(26)} | ${String(f.signals).padStart(7)} | ${f.meanAbsResidual.toFixed(4).padStart(8)} | ${f.stdAbsResidual.toFixed(4).padStart(8)} | ${String(f.n).padStart(2)} | ${ratio}x`
      );
    }

    // Per-signal detail for the full adversary
    if (variantId === 5) {
      console.log('\n  ── Per-signal detail (Full Adversary) ──\n');
      for (const family of FAMILIES) {
        console.log(`  [${family.name}]`);
        for (const sig of family.signals) {
          const vals: number[] = [];
          for (const row of variantRows) {
            const v = getResidualValue(row, sig.key, sig.source);
            if (v != null) vals.push(Math.abs(v));
          }
          if (vals.length > 0) {
            console.log(`    ${sig.key.padEnd(35)} mean=${mean(vals).toFixed(4)}  std=${std(vals).toFixed(4)}  n=${vals.length}`);
          } else {
            console.log(`    ${sig.key.padEnd(35)} (no data)`);
          }
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
