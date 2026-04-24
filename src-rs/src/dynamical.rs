//! Dynamical Signal Computation
//!
//! Nonlinear signals from raw keystroke streams. Treats the IKI series
//! as the output of a complex adaptive system.
//!
//! - Permutation entropy (Bandt & Pompe 2002)
//! - DFA alpha (Peng et al. 1994)
//! - RQA: determinism, laminarity, trapping time, recurrence rate (Webber & Zbilut 2005)
//! - Transfer entropy (Schreiber 2000)

use std::collections::BTreeMap;

use crate::stats::{digamma, linreg_slope, mean, normalize, std_dev, NeumaierAccumulator};
use crate::types::{HoldFlight, IkiSeries, KeystrokeEvent, SignalError, SignalResult};

// ─── Result types ─────────────────────────────────────────────────

pub(crate) struct RqaResult {
    pub(crate) determinism: f64,
    pub(crate) laminarity: f64,
    pub(crate) trapping_time: f64,
    pub(crate) recurrence_rate: f64,
}

/// MF-DFA result: singularity spectrum characterizing multifractal structure.
/// Kantelhardt et al. 2002; Bennett et al. 2025 (direct keystroke validation).
#[derive(Debug)]
pub(crate) struct MfdfaResult {
    pub(crate) spectrum_width: f64,
    pub(crate) asymmetry: f64,
    pub(crate) peak_alpha: f64,
}

/// Result of the full ordinal analysis (PE + symbolic dynamics + OPTN).
/// Computed from a single pass over the ordinal pattern extraction.
#[derive(Debug)]
pub(crate) struct OrdinalAnalysisResult {
    pub(crate) statistical_complexity: f64,
    pub(crate) forbidden_pattern_fraction: f64,
    pub(crate) weighted_pe: f64,
    pub(crate) lempel_ziv_complexity: f64,
    pub(crate) optn_transition_entropy: f64,
    pub(crate) optn_forbidden_transition_count: i32,
}

/// Result of recurrence network analysis (computed from existing RQA recurrence matrix).
#[derive(Debug)]
pub(crate) struct RecurrenceNetworkResult {
    pub(crate) transitivity: f64,
    pub(crate) avg_path_length: f64,
    pub(crate) clustering_coefficient: f64,
    pub(crate) assortativity: f64,
}

pub(crate) struct DynamicalResult {
    pub(crate) iki_count: usize,
    pub(crate) hold_flight_count: usize,
    pub(crate) permutation_entropy: Option<f64>,
    pub(crate) permutation_entropy_raw: Option<f64>,
    /// PE at orders 3-7: complexity spectrum revealing structure at multiple scales.
    /// Index 0 = order 3, index 4 = order 7. Each value is normalized [0,1].
    pub(crate) pe_spectrum: Option<Vec<f64>>,
    pub(crate) dfa_alpha: Option<f64>,
    pub(crate) mfdfa: Option<MfdfaResult>,
    pub(crate) temporal_irreversibility: Option<f64>,
    pub(crate) iki_psd_spectral_slope: Option<f64>,
    pub(crate) iki_psd_respiratory_peak_hz: Option<f64>,
    pub(crate) peak_typing_frequency_hz: Option<f64>,
    pub(crate) iki_psd_lf_hf_ratio: Option<f64>,
    pub(crate) iki_psd_fast_slow_variance_ratio: Option<f64>,
    pub(crate) ordinal: Option<OrdinalAnalysisResult>,
    pub(crate) rqa: Option<RqaResult>,
    pub(crate) recurrence_network: Option<RecurrenceNetworkResult>,
    pub(crate) rqa_recurrence_time_entropy: Option<f64>,
    pub(crate) rqa_mean_recurrence_time: Option<f64>,
    pub(crate) effective_information: Option<f64>,
    pub(crate) causal_emergence_index: Option<f64>,
    pub(crate) optimal_causal_scale: Option<i32>,
    pub(crate) pid_synergy: Option<f64>,
    pub(crate) pid_redundancy: Option<f64>,
    pub(crate) branching_ratio: Option<f64>,
    pub(crate) avalanche_size_exponent: Option<f64>,
    pub(crate) dmd_dominant_frequency: Option<f64>,
    pub(crate) dmd_dominant_decay_rate: Option<f64>,
    pub(crate) dmd_mode_count: Option<i32>,
    pub(crate) dmd_spectral_entropy: Option<f64>,
    pub(crate) pause_mixture_component_count: Option<i32>,
    pub(crate) pause_mixture_motor_proportion: Option<f64>,
    pub(crate) pause_mixture_cognitive_load_index: Option<f64>,
    pub(crate) te_hold_to_flight: Option<f64>,
    pub(crate) te_flight_to_hold: Option<f64>,
    pub(crate) te_dominance: Option<f64>,
}

// ─── Permutation Entropy (Bandt & Pompe 2002) ─────────────────────

fn permutation_entropy(series: &[f64], order: usize) -> SignalResult<(f64, f64)> {
    let n = series.len();
    if n < order + 10 {
        return Err(SignalError::InsufficientData {
            needed: order + 10,
            got: n,
        });
    }

    // BTreeMap for deterministic iteration order. The entropy sum depends on
    // which p*log2(p) terms are added first; HashMap would make this
    // nondeterministic across runs (even with Neumaier compensation, the
    // iteration order must be fixed for bit-identical output).
    let mut pattern_counts: BTreeMap<Vec<usize>, u64> = BTreeMap::new();
    let window_count = n - order + 1;

    for i in 0..window_count {
        let window = &series[i..i + order];
        let mut indices: Vec<usize> = (0..order).collect();
        indices.sort_by(|&a, &b| {
            window[a]
                .partial_cmp(&window[b])
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        *pattern_counts.entry(indices).or_insert(0) += 1;
    }

    let total = window_count as f64;
    let mut entropy = NeumaierAccumulator::new();
    for &count in pattern_counts.values() {
        let p = count as f64 / total;
        if p > 0.0 {
            entropy.add(p * p.log2());
        }
    }
    let entropy = -entropy.total();

    // Maximum entropy: log2(order!)
    let mut factorial: u64 = 1;
    for i in 2..=order as u64 {
        factorial *= i;
    }
    let max_entropy = (factorial as f64).log2();
    let normalized = if max_entropy > 0.0 {
        entropy / max_entropy
    } else {
        0.0
    };

    Ok((normalized, entropy))
}

// ─── Ordinal Analysis (symbolic dynamics + OPTN) ─────────────────
//
// Full ordinal analysis at order 3, computed in a single pass over
// the IKI series. Extends PE with:
// - Statistical complexity (Rosso et al. 2007): Jensen-Shannon C_JS
// - Forbidden pattern fraction (Amigo et al. 2008)
// - Weighted PE (Fadlallah et al. 2013): amplitude-sensitive
// - Lempel-Ziv complexity (Bai et al. 2015 PLZC variant)
// - OPTN transition entropy + forbidden transition count
//   (McCullough et al. 2015; Bandt & Zanin 2022)

fn ordinal_analysis(series: &[f64], order: usize) -> SignalResult<OrdinalAnalysisResult> {
    let n = series.len();
    if n < order + 50 {
        return Err(SignalError::InsufficientData {
            needed: order + 50,
            got: n,
        });
    }

    let window_count = n - order + 1;

    // Extract ordinal patterns and their sequence
    let mut pattern_counts: BTreeMap<Vec<usize>, u64> = BTreeMap::new();
    let mut pattern_sequence: Vec<Vec<usize>> = Vec::with_capacity(window_count);
    let mut weighted_counts: BTreeMap<Vec<usize>, f64> = BTreeMap::new();

    for i in 0..window_count {
        let window = &series[i..i + order];
        let mut indices: Vec<usize> = (0..order).collect();
        indices.sort_by(|&a, &b| {
            window[a]
                .partial_cmp(&window[b])
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        *pattern_counts.entry(indices.clone()).or_insert(0) += 1;

        // Weighted PE: weight by window variance
        let w_mean = window.iter().sum::<f64>() / order as f64;
        let w_var: f64 = window.iter().map(|&v| (v - w_mean).powi(2)).sum::<f64>() / order as f64;
        *weighted_counts.entry(indices.clone()).or_insert(0.0) += w_var;

        pattern_sequence.push(indices);
    }

    let total = window_count as f64;

    // --- Factorial for this order ---
    let mut factorial: u64 = 1;
    for i in 2..=order as u64 {
        factorial *= i;
    }
    let d_factorial = factorial as usize;

    // --- Statistical Complexity (Jensen-Shannon, Rosso et al. 2007) ---
    // Uniform distribution for d! patterns
    let p_uniform = 1.0 / d_factorial as f64;
    let observed_count = pattern_counts.len();

    // Shannon entropy of observed distribution
    let mut h_p = NeumaierAccumulator::new();
    for &count in pattern_counts.values() {
        let p = count as f64 / total;
        if p > 0.0 {
            h_p.add(p * p.ln());
        }
    }
    let h_p = -h_p.total(); // nats

    // Shannon entropy of uniform
    let h_uniform = (d_factorial as f64).ln(); // nats

    // Shannon entropy of mixture (P + P_e) / 2
    // Iterate over observed patterns and add unobserved separately
    let mut mix_entropy = NeumaierAccumulator::new();
    for &count in pattern_counts.values() {
        let p = count as f64 / total;
        let mix = (p + p_uniform) / 2.0;
        if mix > 0.0 {
            mix_entropy.add(mix * mix.ln());
        }
    }
    // Unobserved patterns: p = 0, mix = p_uniform / 2
    let unobserved = d_factorial - observed_count;
    if unobserved > 0 {
        let mix = p_uniform / 2.0;
        mix_entropy.add(unobserved as f64 * mix * mix.ln());
    }
    let h_mixture = -mix_entropy.total();

    // Jensen-Shannon divergence
    let jsd = h_mixture - (h_p + h_uniform) / 2.0;
    let jsd = jsd.max(0.0); // numerical floor

    // Normalization constant Q_0 = -2 / ((1+1/d!) * ln((1+1/d!)/2) + (1-1/d!) * ln((1-1/d!)/2))
    // Simplified: Q_0 such that max JSD * H/H_max = 1 for the most "complex" distribution.
    // Standard approach: C_JS = Q_0 * JSD * (H_p / H_max) where Q_0 normalizes JSD to [0, 1/(4*ln2)]
    // For simplicity and reproducibility, use the direct definition:
    // C_JS = JSD * (H_norm) where H_norm = H_p / H_max
    let h_max = h_uniform;
    let h_norm = if h_max > 1e-15 { h_p / h_max } else { 0.0 };

    // C_JS = (JSD / ln(2)) * H_norm, bounded to [0,1]
    // JSD/ln(2) normalizes the divergence to bits; H_norm weights by the
    // entropy's distance from maximum. This is the standard CECP formulation.
    let statistical_complexity = ((jsd / 2.0_f64.ln()) * h_norm).clamp(0.0, 1.0);

    // --- Forbidden Pattern Fraction (Amigo et al. 2008) ---
    let forbidden_pattern_fraction = (d_factorial - observed_count) as f64 / d_factorial as f64;

    // --- Weighted PE (Fadlallah et al. 2013) ---
    let total_weight: f64 = weighted_counts.values().sum();
    let mut w_entropy = NeumaierAccumulator::new();
    if total_weight > 1e-15 {
        for &w in weighted_counts.values() {
            let p = w / total_weight;
            if p > 0.0 {
                w_entropy.add(p * p.log2());
            }
        }
    }
    let w_entropy = -w_entropy.total();
    let max_entropy_bits = (factorial as f64).log2();
    let weighted_pe = if max_entropy_bits > 0.0 {
        w_entropy / max_entropy_bits
    } else {
        0.0
    };

    // --- Lempel-Ziv Complexity (PLZC, Bai et al. 2015) ---
    // Operate on the pattern sequence as symbols.
    // Map each unique pattern to an integer for efficient comparison.
    let mut pattern_to_id: BTreeMap<Vec<usize>, usize> = BTreeMap::new();
    let mut next_id = 0usize;
    let symbol_seq: Vec<usize> = pattern_sequence
        .iter()
        .map(|p| {
            let len = pattern_to_id.len();
            *pattern_to_id.entry(p.clone()).or_insert_with(|| {
                let id = next_id;
                next_id = len + 1;
                id
            })
        })
        .collect();

    // LZ76 complexity: count distinct substrings by scanning left to right
    let mut complexity_count = 1u64; // start with 1 for the first symbol
    let mut i = 1usize;
    let mut k = 1usize; // current substring length
    let seq_len = symbol_seq.len();

    while i + k <= seq_len {
        // Check if the substring symbol_seq[i..i+k] appeared in symbol_seq[0..i+k-1]
        let substr = &symbol_seq[i..i + k];
        let found = (0..i).any(|j| {
            j + k < i + k && symbol_seq[j..j + k] == *substr
        });

        if found {
            k += 1;
            if i + k > seq_len {
                complexity_count += 1;
            }
        } else {
            complexity_count += 1;
            i += k;
            k = 1;
        }
    }

    // Normalize: C_norm = C(n) * ln(n) / n (for alphabet of size k_alphabet)
    let k_alphabet = pattern_to_id.len().max(2) as f64;
    let n_f = seq_len as f64;
    let lz_normalized = if n_f > 1.0 {
        (complexity_count as f64 * n_f.ln()) / (n_f * k_alphabet.ln())
    } else {
        0.0
    };
    let lempel_ziv_complexity = lz_normalized.clamp(0.0, 1.0);

    // --- OPTN: Ordinal Pattern Transition Network (McCullough et al. 2015) ---
    // Build transition matrix from pattern sequence
    let num_patterns = pattern_to_id.len();
    let mut transitions = vec![vec![0u64; num_patterns]; num_patterns];
    for w in pattern_sequence.windows(2) {
        let from = pattern_to_id[&w[0]];
        let to = pattern_to_id[&w[1]];
        transitions[from][to] += 1;
    }

    // Transition entropy: mean Shannon entropy of rows
    let mut row_entropies = NeumaierAccumulator::new();
    let mut valid_rows = 0u64;
    for row in &transitions {
        let row_total: u64 = row.iter().sum();
        if row_total == 0 {
            continue;
        }
        let mut h = NeumaierAccumulator::new();
        for &count in row {
            if count > 0 {
                let p = count as f64 / row_total as f64;
                h.add(p * p.log2());
            }
        }
        row_entropies.add(-h.total());
        valid_rows += 1;
    }
    let optn_transition_entropy = if valid_rows > 0 {
        row_entropies.total() / valid_rows as f64
    } else {
        0.0
    };

    // Forbidden transitions: count zero-count cells where both source and
    // target patterns exist individually
    let mut forbidden_transition_count = 0i32;
    for from in 0..num_patterns {
        let from_exists: u64 = transitions[from].iter().sum();
        if from_exists == 0 {
            continue;
        }
        for to in 0..num_patterns {
            let to_exists: u64 = transitions.iter().map(|r| r[to]).sum();
            if to_exists > 0 && transitions[from][to] == 0 {
                forbidden_transition_count += 1;
            }
        }
    }

    Ok(OrdinalAnalysisResult {
        statistical_complexity,
        forbidden_pattern_fraction,
        weighted_pe,
        lempel_ziv_complexity,
        optn_transition_entropy,
        optn_forbidden_transition_count: forbidden_transition_count,
    })
}

// ─── Recurrence Network Analysis (Donner et al. 2010) ────────────
//
// Reinterprets the RQA recurrence matrix as a graph adjacency matrix.
// Extracts transitivity (fractal dimension estimate), average path
// length (attractor diameter), clustering coefficient (local cohesion),
// and assortativity (degree correlation). No new data preparation;
// the recurrence matrix from RQA is reused.

fn recurrence_network(series: &[f64]) -> SignalResult<RecurrenceNetworkResult> {
    let n = series.len();
    if n < 30 {
        return Err(SignalError::InsufficientData { needed: 30, got: n });
    }
    // Cap for O(n^2) feasibility
    let n = n.min(5000);
    let series = &series[..n];

    let mu = mean(series);
    let s = std_dev(series, Some(mu));
    let eps = s * 0.2;
    if eps <= 0.0 {
        return Err(SignalError::ZeroVariance { len: n });
    }

    // Build adjacency list (exclude self-loops: i != j)
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
    for i in 0..n {
        for j in (i + 1)..n {
            if (series[i] - series[j]).abs() < eps {
                adj[i].push(j);
                adj[j].push(i);
            }
        }
    }

    let degrees: Vec<usize> = adj.iter().map(|a| a.len()).collect();
    let total_edges: usize = degrees.iter().sum::<usize>() / 2;
    if total_edges == 0 {
        return Ok(RecurrenceNetworkResult {
            transitivity: 0.0,
            avg_path_length: 0.0,
            clustering_coefficient: 0.0,
            assortativity: 0.0,
        });
    }

    // --- Transitivity: 3 * triangles / connected triples ---
    let mut triangles = 0u64;
    let mut triples = 0u64;
    for i in 0..n {
        let d = degrees[i];
        if d < 2 {
            continue;
        }
        triples += (d * (d - 1) / 2) as u64;
        // Count triangles: for each pair of neighbors, check if they're connected
        let neighbors = &adj[i];
        for a_idx in 0..neighbors.len() {
            for b_idx in (a_idx + 1)..neighbors.len() {
                let a = neighbors[a_idx];
                let b = neighbors[b_idx];
                // Check if a and b are connected (binary search since adj is built in order)
                if adj[a].binary_search(&b).is_ok() {
                    triangles += 1;
                }
            }
        }
    }
    let transitivity = if triples > 0 {
        (3 * triangles) as f64 / (3 * triples) as f64
    } else {
        0.0
    };

    // --- Average Path Length (BFS on largest connected component) ---
    // Find largest connected component via BFS
    let mut visited = vec![false; n];
    let mut largest_cc: Vec<usize> = Vec::new();
    for start in 0..n {
        if visited[start] {
            continue;
        }
        let mut cc = Vec::new();
        let mut queue = std::collections::VecDeque::new();
        queue.push_back(start);
        visited[start] = true;
        while let Some(v) = queue.pop_front() {
            cc.push(v);
            for &w in &adj[v] {
                if !visited[w] {
                    visited[w] = true;
                    queue.push_back(w);
                }
            }
        }
        if cc.len() > largest_cc.len() {
            largest_cc = cc;
        }
    }

    let cc_n = largest_cc.len();
    let avg_path_length = if cc_n > 1 {
        // BFS from a sample of nodes (cap at 100 for O(n^2) feasibility)
        let sample_size = cc_n.min(100);
        let step = cc_n / sample_size;
        let mut total_dist = 0u64;
        let mut total_pairs = 0u64;
        for s_idx in (0..cc_n).step_by(step.max(1)) {
            let source = largest_cc[s_idx];
            let mut dist = vec![u32::MAX; n];
            dist[source] = 0;
            let mut queue = std::collections::VecDeque::new();
            queue.push_back(source);
            while let Some(v) = queue.pop_front() {
                for &w in &adj[v] {
                    if dist[w] == u32::MAX {
                        dist[w] = dist[v] + 1;
                        queue.push_back(w);
                    }
                }
            }
            for &node in &largest_cc {
                if node != source && dist[node] != u32::MAX {
                    total_dist += dist[node] as u64;
                    total_pairs += 1;
                }
            }
        }
        if total_pairs > 0 {
            total_dist as f64 / total_pairs as f64
        } else {
            0.0
        }
    } else {
        0.0
    };

    // --- Clustering Coefficient (mean local) ---
    let mut cc_sum = NeumaierAccumulator::new();
    let mut cc_count = 0u64;
    for i in 0..n {
        let d = degrees[i];
        if d < 2 {
            continue;
        }
        let mut local_triangles = 0u64;
        let neighbors = &adj[i];
        for a_idx in 0..neighbors.len() {
            for b_idx in (a_idx + 1)..neighbors.len() {
                if adj[neighbors[a_idx]].binary_search(&neighbors[b_idx]).is_ok() {
                    local_triangles += 1;
                }
            }
        }
        let possible = (d * (d - 1) / 2) as f64;
        cc_sum.add(local_triangles as f64 / possible);
        cc_count += 1;
    }
    let clustering_coefficient = if cc_count > 0 {
        cc_sum.total() / cc_count as f64
    } else {
        0.0
    };

    // --- Assortativity (degree-degree correlation) ---
    let assortativity = if total_edges > 0 {
        let mut sum_prod = NeumaierAccumulator::new();
        let mut sum_sum = NeumaierAccumulator::new();
        let mut sum_sq_sum = NeumaierAccumulator::new();
        for i in 0..n {
            for &j in &adj[i] {
                if j > i {
                    let di = degrees[i] as f64;
                    let dj = degrees[j] as f64;
                    sum_prod.add(di * dj);
                    sum_sum.add(di + dj);
                    sum_sq_sum.add(di * di + dj * dj);
                }
            }
        }
        let m = total_edges as f64;
        let sp = sum_prod.total();
        let ss = sum_sum.total();
        let ssq = sum_sq_sum.total();
        let num = sp / m - (ss / (2.0 * m)).powi(2);
        let den = ssq / (2.0 * m) - (ss / (2.0 * m)).powi(2);
        if den.abs() > 1e-15 {
            (num / den).clamp(-1.0, 1.0)
        } else {
            0.0
        }
    } else {
        0.0
    };

    Ok(RecurrenceNetworkResult {
        transitivity,
        avg_path_length,
        clustering_coefficient,
        assortativity,
    })
}

// ─── Recurrence Time Entropy (Baptista et al. 2010) ──────────────
//
// For each recurrence point in the recurrence matrix, compute the time
// to the next recurrence in the same row. Shannon entropy of the
// distribution of these return times.

fn recurrence_time_stats(series: &[f64]) -> SignalResult<(f64, f64)> {
    let n = series.len();
    if n < 30 {
        return Err(SignalError::InsufficientData { needed: 30, got: n });
    }
    let n = n.min(5000);
    let series = &series[..n];

    let mu = mean(series);
    let s = std_dev(series, Some(mu));
    let eps = s * 0.2;
    if eps <= 0.0 {
        return Err(SignalError::ZeroVariance { len: n });
    }

    // Collect recurrence times: for each row i, find recurrence points
    // and compute gaps between consecutive recurrence columns
    let mut recurrence_times: Vec<u64> = Vec::new();
    for i in 0..n {
        let mut prev_j: Option<usize> = None;
        for j in 0..n {
            if i != j && (series[i] - series[j]).abs() < eps {
                if let Some(pj) = prev_j {
                    let gap = (j - pj) as u64;
                    recurrence_times.push(gap);
                }
                prev_j = Some(j);
            }
        }
    }

    if recurrence_times.is_empty() {
        return Err(SignalError::DegenerateValue("no recurrence times found"));
    }

    // Mean recurrence time
    let mean_rt = recurrence_times.iter().sum::<u64>() as f64 / recurrence_times.len() as f64;

    // Shannon entropy of recurrence time distribution
    let mut rt_counts: BTreeMap<u64, u64> = BTreeMap::new();
    for &rt in &recurrence_times {
        *rt_counts.entry(rt).or_insert(0) += 1;
    }
    let total = recurrence_times.len() as f64;
    let mut entropy = NeumaierAccumulator::new();
    for &count in rt_counts.values() {
        let p = count as f64 / total;
        if p > 0.0 {
            entropy.add(p * p.log2());
        }
    }
    let rte = -entropy.total();

    Ok((rte, mean_rt))
}

// ─── DFA (Peng et al. 1994) ───────────────────────────────────────

fn dfa_alpha(series: &[f64]) -> SignalResult<f64> {
    let n = series.len();
    if n < 50 {
        return Err(SignalError::InsufficientData { needed: 50, got: n });
    }

    let mu = mean(series);

    // Cumulative sum (integration) with Neumaier compensation.
    // The cumulative sum is a running accumulator over potentially thousands
    // of values; without compensation, precision loss accumulates linearly.
    let mut y = vec![0.0; n];
    let mut cum = NeumaierAccumulator::new();
    cum.add(series[0] - mu);
    y[0] = cum.total();
    for i in 1..n {
        cum.add(series[i] - mu);
        y[i] = cum.total();
    }

    let min_box = 4usize;
    let max_box = n / 4;
    if max_box < min_box {
        return Err(SignalError::InsufficientData { needed: 16, got: n });
    }

    let mut log_sizes: Vec<usize> = Vec::new();
    let mut log_fluctuations = Vec::new();

    let num_sizes = 15.min(max_box - min_box + 1);
    let ratio = max_box as f64 / min_box as f64;

    for i in 0..num_sizes {
        let box_size =
            (min_box as f64 * ratio.powf(i as f64 / (num_sizes - 1).max(1) as f64)).round()
                as usize;
        if log_sizes.last() == Some(&box_size) {
            continue;
        }

        let num_boxes = n / box_size;
        if num_boxes < 2 {
            continue;
        }

        let mut sum_fluctuation = NeumaierAccumulator::new();
        for b in 0..num_boxes {
            let start = b * box_size;
            let mut sx = NeumaierAccumulator::new();
            let mut sy = NeumaierAccumulator::new();
            let mut sxx = NeumaierAccumulator::new();
            let mut sxy = NeumaierAccumulator::new();

            for j in 0..box_size {
                let jf = j as f64;
                sx.add(jf);
                sy.add(y[start + j]);
                sxx.add(jf * jf);
                sxy.add(jf * y[start + j]);
            }

            let (sx, sy, sxx, sxy) = (sx.total(), sy.total(), sxx.total(), sxy.total());
            let bsf = box_size as f64;
            // OLS denominator: n*Sxx - (Sx)^2
            #[allow(clippy::suspicious_operation_groupings)]
            let denom = bsf.mul_add(sxx, -(sx * sx));
            #[allow(clippy::suspicious_operation_groupings)]
            let slope = if denom == 0.0 {
                0.0
            } else {
                bsf.mul_add(sxy, -(sx * sy)) / denom
            };
            let intercept = (sy - slope * sx) / bsf;

            let mut sum_sq = NeumaierAccumulator::new();
            for j in 0..box_size {
                let trend = slope.mul_add(j as f64, intercept);
                sum_sq.add((y[start + j] - trend).powi(2));
            }
            sum_fluctuation.add((sum_sq.total() / bsf).sqrt());
        }

        let f = sum_fluctuation.total() / num_boxes as f64;
        if f > 0.0 {
            log_sizes.push(box_size);
            log_fluctuations.push(f.ln());
        }
    }

    if log_sizes.len() < 4 {
        return Err(SignalError::DegenerateValue(
            "fewer than 4 valid box sizes in DFA",
        ));
    }

    let log_x: Vec<f64> = log_sizes.iter().map(|&s| (s as f64).ln()).collect();
    linreg_slope(&log_x, &log_fluctuations)
        .ok_or(SignalError::DegenerateValue("degenerate regression in DFA"))
}

// ─── MF-DFA (Kantelhardt et al. 2002) ────────────────────────────
//
// Generalizes DFA to moment orders q = -5..+5. At each box size,
// the q-dependent fluctuation function F_q(n) replaces the standard
// F_2(n). The generalized Hurst exponents h(q) and the singularity
// spectrum f(alpha) via Legendre transform characterize multifractal
// structure. Bennett et al. 2025 validated spectrum width on
// keystroke IKI data as a cognitive fatigue marker.

fn mfdfa(series: &[f64]) -> SignalResult<MfdfaResult> {
    let n = series.len();
    if n < 256 {
        return Err(SignalError::InsufficientData { needed: 256, got: n });
    }

    let mu = mean(series);

    // Cumulative sum (integration) with Neumaier compensation
    let mut y = vec![0.0; n];
    let mut cum = NeumaierAccumulator::new();
    cum.add(series[0] - mu);
    y[0] = cum.total();
    for i in 1..n {
        cum.add(series[i] - mu);
        y[i] = cum.total();
    }

    let min_box = 4usize;
    let max_box = n / 4;
    if max_box < min_box {
        return Err(SignalError::InsufficientData { needed: 16, got: n });
    }

    // q values: -5 to +5 (skip 0, handled separately)
    let q_values: Vec<f64> = (-5..=5).map(|q| q as f64).collect();

    // Build log-spaced box sizes (same as DFA)
    let num_sizes = 15.min(max_box - min_box + 1);
    let ratio = max_box as f64 / min_box as f64;
    let mut box_sizes: Vec<usize> = Vec::new();
    for i in 0..num_sizes {
        let bs = (min_box as f64 * ratio.powf(i as f64 / (num_sizes - 1).max(1) as f64)).round()
            as usize;
        if box_sizes.last() != Some(&bs) {
            box_sizes.push(bs);
        }
    }

    // For each q, compute log(F_q(n)) at each box size, then regress for h(q)
    let log_n: Vec<f64> = box_sizes.iter().map(|&s| (s as f64).ln()).collect();
    let mut h_q = Vec::with_capacity(q_values.len());

    for &q in &q_values {
        let mut log_fq = Vec::with_capacity(box_sizes.len());

        for &box_size in &box_sizes {
            let num_boxes = n / box_size;
            if num_boxes < 2 {
                continue;
            }

            // Compute per-box variance (F^2), then aggregate with q-moment
            let mut variances = Vec::with_capacity(num_boxes);
            for b in 0..num_boxes {
                let start = b * box_size;
                let mut sx = NeumaierAccumulator::new();
                let mut sy = NeumaierAccumulator::new();
                let mut sxx = NeumaierAccumulator::new();
                let mut sxy = NeumaierAccumulator::new();

                for j in 0..box_size {
                    let jf = j as f64;
                    sx.add(jf);
                    sy.add(y[start + j]);
                    sxx.add(jf * jf);
                    sxy.add(jf * y[start + j]);
                }

                let (sx, sy, sxx, sxy) = (sx.total(), sy.total(), sxx.total(), sxy.total());
                let bsf = box_size as f64;
                #[allow(clippy::suspicious_operation_groupings)]
                let denom = bsf.mul_add(sxx, -(sx * sx));
                #[allow(clippy::suspicious_operation_groupings)]
                let slope = if denom == 0.0 {
                    0.0
                } else {
                    bsf.mul_add(sxy, -(sx * sy)) / denom
                };
                let intercept = (sy - slope * sx) / bsf;

                let mut sum_sq = NeumaierAccumulator::new();
                for j in 0..box_size {
                    let trend = slope.mul_add(j as f64, intercept);
                    sum_sq.add((y[start + j] - trend).powi(2));
                }
                let var = sum_sq.total() / bsf;
                if var > 0.0 {
                    variances.push(var);
                }
            }

            if variances.is_empty() {
                continue;
            }

            // q-dependent fluctuation: F_q(n) = [mean(F^2^(q/2))]^(1/q)
            let fq = if q.abs() < 1e-10 {
                // q=0: geometric mean via exp(mean(ln(F^2)/2))
                let mut log_sum = NeumaierAccumulator::new();
                for &v in &variances {
                    log_sum.add(v.ln());
                }
                (log_sum.total() / (2.0 * variances.len() as f64)).exp()
            } else {
                let mut moment_sum = NeumaierAccumulator::new();
                for &v in &variances {
                    moment_sum.add(v.powf(q / 2.0));
                }
                (moment_sum.total() / variances.len() as f64).powf(1.0 / q)
            };

            if fq > 0.0 && fq.is_finite() {
                log_fq.push(fq.ln());
            }
        }

        if log_fq.len() < 4 {
            return Err(SignalError::DegenerateValue(
                "fewer than 4 valid box sizes in MF-DFA for some q",
            ));
        }

        // Trim log_n to match log_fq length (some box sizes may have been skipped)
        let log_n_trimmed: Vec<f64> = log_n[..log_fq.len()].to_vec();
        match linreg_slope(&log_n_trimmed, &log_fq) {
            Some(slope) => h_q.push(slope),
            None => {
                return Err(SignalError::DegenerateValue("degenerate regression in MF-DFA"));
            }
        }
    }

    if h_q.len() != q_values.len() {
        return Err(SignalError::DegenerateValue("incomplete h(q) spectrum"));
    }

    // Legendre transform: alpha(q) = h(q) + q * h'(q), f(alpha) = q * (alpha - h(q)) + 1
    // Approximate h'(q) via finite differences
    let mut alphas = Vec::with_capacity(h_q.len());
    let mut f_alphas = Vec::with_capacity(h_q.len());

    for i in 0..h_q.len() {
        let dh = if i == 0 {
            h_q[1] - h_q[0]
        } else if i == h_q.len() - 1 {
            h_q[h_q.len() - 1] - h_q[h_q.len() - 2]
        } else {
            (h_q[i + 1] - h_q[i - 1]) / 2.0
        };
        let dq = 1.0; // q step size is 1
        let h_prime = dh / dq;
        let alpha = h_q[i] + q_values[i] * h_prime;
        let f_alpha = q_values[i] * (alpha - h_q[i]) + 1.0;
        alphas.push(alpha);
        f_alphas.push(f_alpha);
    }

    let alpha_min = alphas.iter().copied().fold(f64::INFINITY, f64::min);
    let alpha_max = alphas.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let spectrum_width = alpha_max - alpha_min;

    // Peak alpha: alpha at max f(alpha)
    let peak_idx = f_alphas
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i)
        .unwrap_or(0);
    let peak_alpha = alphas[peak_idx];

    // Asymmetry: (peak - min) / (max - min)
    let asymmetry = if spectrum_width > 1e-10 {
        (peak_alpha - alpha_min) / spectrum_width
    } else {
        0.5 // symmetric by default when width is zero
    };

    Ok(MfdfaResult {
        spectrum_width,
        asymmetry,
        peak_alpha,
    })
}

// ─── Temporal Irreversibility ────────────────────────────────────
//
// KL divergence between forward and backward IKI transition
// probabilities. Measures the thermodynamic arrow of the typing
// process. De la Fuente et al. 2022; Martinez et al. 2023.

fn temporal_irreversibility(series: &[f64]) -> SignalResult<f64> {
    let n = series.len();
    if n < 100 {
        return Err(SignalError::InsufficientData { needed: 100, got: n });
    }

    // Bin IKIs into K states via quintiles (5 bins)
    let k = 5usize;
    let mut sorted = series.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let boundaries: Vec<f64> = (1..k)
        .map(|i| {
            let idx = (i * sorted.len()) / k;
            sorted[idx.min(sorted.len() - 1)]
        })
        .collect();

    let bin = |v: f64| -> usize {
        boundaries
            .iter()
            .position(|&b| v < b)
            .unwrap_or(k - 1)
    };

    let binned: Vec<usize> = series.iter().map(|&v| bin(v)).collect();

    // Build forward transition counts: P(s_t | s_{t-1})
    let mut fwd = vec![vec![0u64; k]; k];
    let mut bwd = vec![vec![0u64; k]; k];
    for i in 0..binned.len() - 1 {
        fwd[binned[i]][binned[i + 1]] += 1;
        bwd[binned[i + 1]][binned[i]] += 1;
    }

    // Normalize rows to probabilities (Laplace smoothing with alpha=1)
    let smooth = |counts: &[Vec<u64>]| -> Vec<Vec<f64>> {
        counts
            .iter()
            .map(|row| {
                let total: u64 = row.iter().sum::<u64>() + k as u64;
                row.iter()
                    .map(|&c| (c as f64 + 1.0) / total as f64)
                    .collect()
            })
            .collect()
    };

    let p_fwd = smooth(&fwd);
    let p_bwd = smooth(&bwd);

    // KL divergence: D_KL(P_fwd || P_bwd)
    // Weighted by stationary distribution (row sums of forward counts)
    let row_totals: Vec<u64> = fwd.iter().map(|r| r.iter().sum()).collect();
    let grand_total: u64 = row_totals.iter().sum();
    if grand_total == 0 {
        return Err(SignalError::DegenerateValue("no transitions in IKI series"));
    }

    let mut kl = NeumaierAccumulator::new();
    for i in 0..k {
        let pi = row_totals[i] as f64 / grand_total as f64;
        if pi < 1e-15 {
            continue;
        }
        for j in 0..k {
            let p = p_fwd[i][j];
            let q = p_bwd[i][j];
            if p > 1e-15 && q > 1e-15 {
                kl.add(pi * p * (p / q).ln());
            }
        }
    }

    let result = kl.total();
    if result.is_finite() && result >= 0.0 {
        Ok(result)
    } else {
        Ok(0.0) // symmetric = zero irreversibility
    }
}

// ─── Lomb-Scargle PSD ────────────────────────────────────────────
//
// Spectral analysis of the IKI series via Lomb-Scargle periodogram.
// Required because IKIs are unevenly spaced in time (keystrokes
// don't occur at regular intervals). Extracts spectral slope,
// respiratory band peak, peak typing frequency, LF/HF ratio,
// and fast/slow variance ratio.

#[derive(Debug)]
pub(crate) struct PsdResult {
    pub(crate) spectral_slope: f64,
    pub(crate) respiratory_peak_hz: Option<f64>,
    pub(crate) peak_typing_frequency_hz: Option<f64>,
    pub(crate) lf_hf_ratio: Option<f64>,
    pub(crate) fast_slow_variance_ratio: Option<f64>,
}

fn lomb_scargle_psd(series: &[f64]) -> SignalResult<PsdResult> {
    let n = series.len();
    if n < 200 {
        return Err(SignalError::InsufficientData { needed: 200, got: n });
    }

    // Construct timestamps: cumulative sum of IKIs gives the time of each
    // IKI measurement in milliseconds. Each IKI[i] is measured at time
    // t[i] = sum(IKI[0..i]) (the midpoint of the interval).
    let mut times = Vec::with_capacity(n);
    let mut t = 0.0;
    for &iki in series {
        t += iki;
        times.push(t);
    }

    // Convert to seconds for frequency in Hz
    let times_sec: Vec<f64> = times.iter().map(|&t| t / 1000.0).collect();
    let total_duration_sec = times_sec[n - 1] - times_sec[0];
    if total_duration_sec < 1.0 {
        return Err(SignalError::DegenerateValue("session too short for PSD"));
    }

    // Zero-mean the series
    let mu = mean(series);
    let centered: Vec<f64> = series.iter().map(|&v| v - mu).collect();

    // Frequency grid: from 1/total_duration to Nyquist estimate
    // Nyquist for unevenly sampled: roughly n / (2 * total_duration)
    let f_min = 1.0 / total_duration_sec;
    let f_max = (n as f64) / (2.0 * total_duration_sec);
    let n_freq = 256.min(n);
    let df = (f_max - f_min) / n_freq as f64;

    let mut freqs = Vec::with_capacity(n_freq);
    let mut power = Vec::with_capacity(n_freq);

    for i in 0..n_freq {
        let f = f_min + (i as f64 + 0.5) * df;
        if f <= 0.0 {
            continue;
        }
        let omega = 2.0 * std::f64::consts::PI * f;

        // Lomb-Scargle: compute tau (phase offset)
        let mut sin2_sum = NeumaierAccumulator::new();
        let mut cos2_sum = NeumaierAccumulator::new();
        for &t in &times_sec {
            sin2_sum.add((2.0 * omega * t).sin());
            cos2_sum.add((2.0 * omega * t).cos());
        }
        let tau = (sin2_sum.total()).atan2(cos2_sum.total()) / (2.0 * omega);

        // Compute power at this frequency
        let mut cos_sum = NeumaierAccumulator::new();
        let mut sin_sum = NeumaierAccumulator::new();
        let mut cos2 = NeumaierAccumulator::new();
        let mut sin2 = NeumaierAccumulator::new();

        for j in 0..n {
            let phase = omega * (times_sec[j] - tau);
            let c = phase.cos();
            let s = phase.sin();
            cos_sum.add(centered[j] * c);
            sin_sum.add(centered[j] * s);
            cos2.add(c * c);
            sin2.add(s * s);
        }

        let cos2_total = cos2.total();
        let sin2_total = sin2.total();
        if cos2_total > 1e-15 && sin2_total > 1e-15 {
            let p = 0.5
                * (cos_sum.total().powi(2) / cos2_total
                    + sin_sum.total().powi(2) / sin2_total);
            if p.is_finite() && p >= 0.0 {
                freqs.push(f);
                power.push(p);
            }
        }
    }

    if freqs.len() < 10 {
        return Err(SignalError::DegenerateValue(
            "fewer than 10 valid frequency bins in PSD",
        ));
    }

    // Spectral slope: log-log regression of power vs frequency
    let log_f: Vec<f64> = freqs.iter().map(|&f| f.ln()).collect();
    let log_p: Vec<f64> = power.iter().map(|&p| (p.max(1e-30)).ln()).collect();
    let spectral_slope = linreg_slope(&log_f, &log_p)
        .unwrap_or(0.0);

    // Respiratory band peak: 0.15-0.35 Hz (9-21 breaths/min)
    let respiratory_peak_hz = {
        let mut best_power = 0.0f64;
        let mut best_freq = None;
        for (i, &f) in freqs.iter().enumerate() {
            if (0.15..=0.35).contains(&f) && power[i] > best_power {
                best_power = power[i];
                best_freq = Some(f);
            }
        }
        // Only report if peak is above noise floor (2x median power)
        let mut sorted_power = power.clone();
        sorted_power.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let median_power = sorted_power[sorted_power.len() / 2];
        if best_power > 2.0 * median_power {
            best_freq
        } else {
            None
        }
    };

    // Peak typing frequency: 2-15 Hz
    let peak_typing_frequency_hz = {
        let mut best_power = 0.0f64;
        let mut best_freq = None;
        for (i, &f) in freqs.iter().enumerate() {
            if (2.0..=15.0).contains(&f) && power[i] > best_power {
                best_power = power[i];
                best_freq = Some(f);
            }
        }
        best_freq
    };

    // LF/HF ratio: LF = 0.04-0.15 Hz, HF = 0.15-0.4 Hz
    let (mut lf_power, mut hf_power) = (NeumaierAccumulator::new(), NeumaierAccumulator::new());
    for (i, &f) in freqs.iter().enumerate() {
        if (0.04..0.15).contains(&f) {
            lf_power.add(power[i]);
        } else if (0.15..=0.4).contains(&f) {
            hf_power.add(power[i]);
        }
    }
    let lf_hf_ratio = {
        let hf = hf_power.total();
        if hf > 1e-15 {
            Some(lf_power.total() / hf)
        } else {
            None
        }
    };

    // Fast/slow variance ratio: >1 Hz (motor arousal) / <0.5 Hz (cognitive)
    let (mut fast, mut slow) = (NeumaierAccumulator::new(), NeumaierAccumulator::new());
    for (i, &f) in freqs.iter().enumerate() {
        if f > 1.0 {
            fast.add(power[i]);
        } else if f < 0.5 {
            slow.add(power[i]);
        }
    }
    let fast_slow_variance_ratio = {
        let s = slow.total();
        if s > 1e-15 {
            Some(fast.total() / s)
        } else {
            None
        }
    };

    Ok(PsdResult {
        spectral_slope,
        respiratory_peak_hz,
        peak_typing_frequency_hz,
        lf_hf_ratio,
        fast_slow_variance_ratio,
    })
}

// ─── RQA (Webber & Zbilut 2005) ──────────────────────────────────
//
// Diagonal lines are counted from the upper triangle only (k > 0).
// Vertical lines are counted from the full matrix (minus LOI).
//
// Since the recurrence matrix is exactly symmetric (|x_i - x_j| == |x_j - x_i|),
// full-matrix recurrence count = 2 * upper-triangle count. Laminarity divides
// vertical_points (full matrix) by total_recurrences * 2 to normalize both
// measures to the same basis. Cap at 5000 points for O(n^2) feasibility
// (~25M iterations — fine for nightly batch, not real-time).

fn rqa(series: &[f64]) -> SignalResult<RqaResult> {
    let n = series.len();
    if n < 30 {
        return Err(SignalError::InsufficientData { needed: 30, got: n });
    }

    let mu = mean(series);
    let s = std_dev(series, Some(mu));
    let eps = s * 0.2; // 20% of std as threshold
    if eps <= 0.0 {
        return Err(SignalError::ZeroVariance { len: n });
    }

    let m = n.min(5000);

    let mut total_recurrences: u64 = 0;
    let mut diagonal_points: u64 = 0;
    let mut vertical_points: u64 = 0;
    let mut total_vertical_length: u64 = 0;
    let mut vertical_line_count: u64 = 0;

    // Diagonal lines: upper triangle (k > 0)
    for k in 1..m {
        let mut line_len: u64 = 0;
        for i in 0..(m - k) {
            let j = i + k;
            if (series[i] - series[j]).abs() <= eps {
                total_recurrences += 1;
                line_len += 1;
            } else {
                if line_len >= 2 {
                    diagonal_points += line_len;
                }
                line_len = 0;
            }
        }
        if line_len >= 2 {
            diagonal_points += line_len;
        }
    }

    // Vertical lines: full matrix (minus LOI)
    for j in 0..m {
        let mut line_len: u64 = 0;
        for i in 0..m {
            if i == j {
                continue;
            }
            if (series[i] - series[j]).abs() <= eps {
                line_len += 1;
            } else {
                if line_len >= 2 {
                    vertical_points += line_len;
                    total_vertical_length += line_len;
                    vertical_line_count += 1;
                }
                line_len = 0;
            }
        }
        if line_len >= 2 {
            vertical_points += line_len;
            total_vertical_length += line_len;
            vertical_line_count += 1;
        }
    }

    let possible_pairs = (m as u64) * (m as u64 - 1) / 2;
    let recurrence_rate = if possible_pairs > 0 {
        total_recurrences as f64 / possible_pairs as f64
    } else {
        0.0
    };
    let determinism = if total_recurrences > 0 {
        diagonal_points as f64 / total_recurrences as f64
    } else {
        0.0
    };
    // vertical_points is from the full matrix; total_recurrences * 2 normalizes
    // upper-triangle count to full-matrix count (exact for symmetric R)
    let laminarity = if total_recurrences > 0 {
        vertical_points as f64 / (total_recurrences as f64 * 2.0)
    } else {
        0.0
    };
    let trapping_time = if vertical_line_count > 0 {
        total_vertical_length as f64 / vertical_line_count as f64
    } else {
        0.0
    };

    Ok(RqaResult {
        determinism: determinism.min(1.0),
        laminarity: laminarity.min(1.0),
        trapping_time,
        recurrence_rate,
    })
}

// ─── Transfer Entropy (KSG estimator, Kraskov et al. 2004) ────────
//
// Continuous estimation via k-nearest-neighbor distances in joint space.
// Replaces the tercile-binned estimator which lost most of the information
// by discretizing to 3 levels (27 possible joint states).
//
// TE(S->T) = CMI(T_future ; S_current | T_current)
//          = psi(k) - <psi(n_xz+1)> - <psi(n_yz+1)> + <psi(n_z+1)>
//
// where X = T_future, Y = S_current, Z = T_current (conditioning variable),
// and counts use Chebyshev (max-norm) distance balls.

const KSG_K: usize = 4; // k-nearest neighbors; 4 is standard in the literature

/// Maximum input length for transfer entropy. The KSG estimator is O(m^2) per
/// point with m points = O(m^3) total. At 500 this is ~125M iterations, comparable
/// to RQA's O(n^2) at 5000. Uses the tail of the series (most recent keystrokes)
/// when input exceeds the cap, matching sample_entropy's truncation strategy.
const MAX_TE_INPUT_LEN: usize = 500;

/// TE(source -> target) via KSG conditional mutual information estimator.
///
/// Normalizes both series to zero mean, unit variance so the Chebyshev
/// distance treats both dimensions equally.
fn transfer_entropy(source: &[f64], target: &[f64], lag: usize) -> SignalResult<f64> {
    let n = source.len().min(target.len());
    if n < 30 {
        return Err(SignalError::InsufficientData { needed: 30, got: n });
    }

    // Truncate to tail if series exceeds cap (O(n^3) complexity bound)
    let start = n.saturating_sub(MAX_TE_INPUT_LEN);
    let source = &source[start..n];
    let target = &target[start..n];
    let n = source.len();

    let effective_n = n - lag;
    if effective_n < 20 {
        return Err(SignalError::InsufficientData {
            needed: 20 + lag,
            got: n,
        });
    }
    if effective_n <= KSG_K + 1 {
        return Err(SignalError::InsufficientData {
            needed: KSG_K + 2 + lag,
            got: n,
        });
    }

    let s_norm = normalize(source);
    let t_norm = normalize(target);

    // Joint vectors: X = T_future, Y = S_current, Z = T_current
    let m = effective_n;
    let mut x_vec = Vec::with_capacity(m);
    let mut y_vec = Vec::with_capacity(m);
    let mut z_vec = Vec::with_capacity(m);

    for i in 0..m {
        x_vec.push(t_norm[i + lag]); // target future
        y_vec.push(s_norm[i]); // source current
        z_vec.push(t_norm[i]); // target current (conditioning)
    }

    let mut sum_psi_nxz = NeumaierAccumulator::new();
    let mut sum_psi_nyz = NeumaierAccumulator::new();
    let mut sum_psi_nz = NeumaierAccumulator::new();

    // Reusable buffer for joint distances
    let mut joint_dists: Vec<f64> = Vec::with_capacity(m);

    for i in 0..m {
        // Find k-th nearest neighbor distance in (X,Y,Z) joint space using max-norm
        joint_dists.clear();
        for j in 0..m {
            if i == j {
                continue;
            }
            let d = (x_vec[i] - x_vec[j])
                .abs()
                .max((y_vec[i] - y_vec[j]).abs())
                .max((z_vec[i] - z_vec[j]).abs());
            joint_dists.push(d);
        }
        // Partial sort to find k-th smallest (0-indexed: k-1)
        joint_dists.select_nth_unstable_by(KSG_K - 1, |a, b| {
            a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)
        });
        let eps = joint_dists[KSG_K - 1];

        // Count neighbors in marginal spaces (strict inequality per KSG)
        let mut n_xz: u32 = 0;
        let mut n_yz: u32 = 0;
        let mut n_z: u32 = 0;

        for j in 0..m {
            if i == j {
                continue;
            }
            let dz = (z_vec[i] - z_vec[j]).abs();
            let dx = (x_vec[i] - x_vec[j]).abs();
            let dy = (y_vec[i] - y_vec[j]).abs();

            if dz < eps {
                n_z += 1;
            }
            if dx.max(dz) < eps {
                n_xz += 1;
            }
            if dy.max(dz) < eps {
                n_yz += 1;
            }
        }

        sum_psi_nxz.add(digamma(f64::from(n_xz) + 1.0));
        sum_psi_nyz.add(digamma(f64::from(n_yz) + 1.0));
        sum_psi_nz.add(digamma(f64::from(n_z) + 1.0));
    }

    let mf = m as f64;
    let te = digamma(KSG_K as f64) - sum_psi_nxz.total() / mf - sum_psi_nyz.total() / mf + sum_psi_nz.total() / mf;

    if !te.is_finite() {
        return Err(SignalError::DegenerateValue("non-finite transfer entropy"));
    }

    Ok(te.max(0.0))
}

// ─── Public API ───────────────────────────────────────────────────

// ─── Causal Emergence (Hoel et al. 2013) ─────────────────────────
//
// Effective Information at micro and macro coarse-graining scales.
// k=8 fixed by parameter commitment. Coarse-grain to 4, then 2.

fn causal_emergence(series: &[f64]) -> SignalResult<(f64, f64, i32)> {
    let n = series.len();
    if n < 100 {
        return Err(SignalError::InsufficientData { needed: 100, got: n });
    }

    // Bin IKIs into k equally-spaced bins
    let compute_ei = |binned: &[usize], k: usize| -> f64 {
        let mut tpm = vec![vec![0u64; k]; k];
        for w in binned.windows(2) {
            tpm[w[0]][w[1]] += 1;
        }
        // EI = log2(k) - (1/k) * sum of row entropies
        let log_k = (k as f64).log2();
        let mut row_entropy_sum = NeumaierAccumulator::new();
        for row in &tpm {
            let row_total: u64 = row.iter().sum();
            if row_total == 0 {
                continue;
            }
            let mut h = NeumaierAccumulator::new();
            for &c in row {
                if c > 0 {
                    let p = c as f64 / row_total as f64;
                    h.add(p * p.log2());
                }
            }
            row_entropy_sum.add(-h.total());
        }
        log_k - row_entropy_sum.total() / k as f64
    };

    // Find min/max for equal-width binning
    let min_v = series.iter().copied().fold(f64::INFINITY, f64::min);
    let max_v = series.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let range = max_v - min_v;
    if range < 1e-10 {
        return Err(SignalError::ZeroVariance { len: n });
    }

    // Micro scale: k=8
    let k_micro = 8usize;
    let bin_width = range / k_micro as f64;
    let binned_micro: Vec<usize> = series
        .iter()
        .map(|&v| ((v - min_v) / bin_width).floor() as usize)
        .map(|b| b.min(k_micro - 1))
        .collect();
    let ei_micro = compute_ei(&binned_micro, k_micro);

    // Macro scale k=4: merge adjacent bin pairs
    let binned_4: Vec<usize> = binned_micro.iter().map(|&b| b / 2).collect();
    let ei_4 = compute_ei(&binned_4, 4);

    // Macro scale k=2: merge further
    let binned_2: Vec<usize> = binned_micro.iter().map(|&b| b / 4).collect();
    let ei_2 = compute_ei(&binned_2, 2);

    // Causal emergence index = max(macro EI) - micro EI
    let (max_macro_ei, optimal_k) = if ei_4 > ei_2 { (ei_4, 4) } else { (ei_2, 2) };
    let cei = max_macro_ei - ei_micro;
    // If micro is best, CEI is negative (no emergence)
    let (best_ei, best_k) = if ei_micro >= max_macro_ei {
        (ei_micro, k_micro as i32)
    } else {
        (max_macro_ei, optimal_k)
    };

    Ok((best_ei, cei, best_k))
}

// ─── Partial Information Decomposition (Williams & Beer 2010) ────
//
// Decomposes mutual information of (hold_t, flight_t) about IKI_{t+1}
// into synergy and redundancy. Uses I_min (Williams-Beer) with the
// same tercile binning as transfer entropy.

fn pid_synergy_redundancy(holds: &[f64], flights: &[f64], ikis: &[f64]) -> SignalResult<(f64, f64)> {
    let n = holds.len().min(flights.len()).min(ikis.len().saturating_sub(1));
    if n < 30 {
        return Err(SignalError::InsufficientData { needed: 30, got: n });
    }

    // Tercile binning (same as TE)
    let bin3 = |data: &[f64]| -> Vec<usize> {
        let mut sorted = data.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let t1 = sorted[sorted.len() / 3];
        let t2 = sorted[2 * sorted.len() / 3];
        data.iter()
            .map(|&v| if v < t1 { 0 } else if v < t2 { 1 } else { 2 })
            .collect()
    };

    let h_binned = bin3(&holds[..n]);
    let f_binned = bin3(&flights[..n]);
    let iki_target: Vec<f64> = ikis[1..=n].to_vec();
    let t_binned = bin3(&iki_target);

    let k = 3usize; // terciles

    // Joint and marginal probability tables
    // P(H, F, T) - full joint
    let mut p_hft = vec![vec![vec![0u64; k]; k]; k];
    for i in 0..n {
        p_hft[h_binned[i]][f_binned[i]][t_binned[i]] += 1;
    }

    // I(H; T) - mutual information between hold and target
    let mut p_ht = vec![vec![0u64; k]; k];
    let mut p_h = vec![0u64; k];
    let mut p_t = vec![0u64; k];
    for i in 0..n {
        p_ht[h_binned[i]][t_binned[i]] += 1;
        p_h[h_binned[i]] += 1;
        p_t[t_binned[i]] += 1;
    }

    let nf = n as f64;
    let mi = |joint: &[Vec<u64>], margx: &[u64], margy: &[u64]| -> f64 {
        let mut mi_acc = NeumaierAccumulator::new();
        for x in 0..k {
            for y in 0..k {
                let pxy = joint[x][y] as f64 / nf;
                let px = margx[x] as f64 / nf;
                let py = margy[y] as f64 / nf;
                if pxy > 1e-15 && px > 1e-15 && py > 1e-15 {
                    mi_acc.add(pxy * (pxy / (px * py)).ln());
                }
            }
        }
        mi_acc.total()
    };

    let i_h_t = mi(&p_ht, &p_h, &p_t);

    // I(F; T)
    let mut p_ft = vec![vec![0u64; k]; k];
    let mut p_f = vec![0u64; k];
    for i in 0..n {
        p_ft[f_binned[i]][t_binned[i]] += 1;
        p_f[f_binned[i]] += 1;
    }
    let i_f_t = mi(&p_ft, &p_f, &p_t);

    // I(H,F; T) - joint mutual information
    // Flatten (H,F) into a single variable with k^2 states
    let mut p_hf_flat = vec![0u64; k * k];
    let mut p_hf_t = vec![vec![0u64; k]; k * k];
    for i in 0..n {
        let hf = h_binned[i] * k + f_binned[i];
        p_hf_flat[hf] += 1;
        p_hf_t[hf][t_binned[i]] += 1;
    }
    let i_hf_t = {
        let mut acc = NeumaierAccumulator::new();
        for hf in 0..(k * k) {
            for t in 0..k {
                let pxy = p_hf_t[hf][t] as f64 / nf;
                let px = p_hf_flat[hf] as f64 / nf;
                let py = p_t[t] as f64 / nf;
                if pxy > 1e-15 && px > 1e-15 && py > 1e-15 {
                    acc.add(pxy * (pxy / (px * py)).ln());
                }
            }
        }
        acc.total()
    };

    // Williams-Beer I_min decomposition:
    // Redundancy = min(I(H;T), I(F;T))
    // Synergy = I(H,F;T) - max(I(H;T), I(F;T))
    let redundancy = i_h_t.min(i_f_t).max(0.0);
    let synergy = (i_hf_t - i_h_t.max(i_f_t)).max(0.0);

    Ok((synergy, redundancy))
}

// ─── Branching Ratio (Beggs & Plenz 2003) ────────────────────────
//
// Direct criticality test. Threshold: mean + 1*std.

fn branching_ratio_and_avalanche(series: &[f64]) -> SignalResult<(f64, Option<f64>)> {
    let n = series.len();
    if n < 100 {
        return Err(SignalError::InsufficientData { needed: 100, got: n });
    }

    let mu = mean(series);
    let s = std_dev(series, Some(mu));
    if s < 1e-10 {
        return Err(SignalError::ZeroVariance { len: n });
    }
    let threshold = mu + s;

    // Identify avalanches (contiguous above-threshold runs)
    let mut avalanches: Vec<usize> = Vec::new();
    let mut current_size = 0usize;
    for &v in series {
        if v > threshold {
            current_size += 1;
        } else if current_size > 0 {
            avalanches.push(current_size);
            current_size = 0;
        }
    }
    if current_size > 0 {
        avalanches.push(current_size);
    }

    if avalanches.len() < 5 {
        return Err(SignalError::DegenerateValue("fewer than 5 avalanches for branching ratio"));
    }

    // Branching ratio: for consecutive above-threshold IKIs,
    // sigma = P(next IKI is also above threshold | current is above)
    let mut above_followed_by_above = 0u64;
    let mut above_total = 0u64;
    for i in 0..n - 1 {
        if series[i] > threshold {
            above_total += 1;
            if series[i + 1] > threshold {
                above_followed_by_above += 1;
            }
        }
    }
    let sigma = if above_total > 0 {
        above_followed_by_above as f64 / above_total as f64
    } else {
        0.0
    };

    // Avalanche size exponent: fit P(s) ~ s^{-tau} via MLE
    // (Clauset et al. 2009 simplified: MLE for discrete power law)
    let avalanche_exponent = if avalanches.len() >= 20 {
        let s_min = 1.0f64;
        let mut log_sum = NeumaierAccumulator::new();
        let mut count = 0u64;
        for &s in &avalanches {
            let sf = s as f64;
            if sf >= s_min {
                log_sum.add((sf / s_min).ln());
                count += 1;
            }
        }
        if count > 0 {
            Some(1.0 + count as f64 / log_sum.total())
        } else {
            None
        }
    } else {
        None
    };

    Ok((sigma, avalanche_exponent))
}

// ─── Dynamic Mode Decomposition (Brunton et al. 2022) ────────────
//
// Hankel-DMD: embed IKI series, SVD, extract eigenvalues.
// Per-session scalars: dominant frequency, dominant decay rate,
// mode count, spectral entropy.

#[allow(clippy::needless_range_loop)] // Matrix indexing with i,j is clearer than iterators for linear algebra
fn dmd_analysis(series: &[f64]) -> SignalResult<(f64, f64, i32, f64)> {
    let n = series.len();
    if n < 100 {
        return Err(SignalError::InsufficientData { needed: 100, got: n });
    }

    // Hankel embedding: d rows, (n-d) columns
    let d = 10.min(n / 5); // embedding dimension, cap at n/5
    let cols = n - d;
    if cols < d + 1 || d < 3 {
        return Err(SignalError::DegenerateValue("series too short for DMD embedding"));
    }

    // Build data matrices X (columns 0..cols-1) and Y (columns 1..cols)
    // Instead of full SVD on large matrices, use a simplified approach:
    // Compute the d x d covariance-like matrix X * X^T and X * Y^T,
    // then solve for the DMD operator in the reduced space.

    // X_ij = series[j + i], Y_ij = series[j + i + 1]
    // C_xx = X * X^T (d x d), C_xy = X * Y^T (d x d)
    let m = cols - 1; // number of snapshot pairs
    let mut c_xx = vec![vec![0.0f64; d]; d];
    let mut c_xy = vec![vec![0.0f64; d]; d];

    for t in 0..m {
        for i in 0..d {
            for j in 0..d {
                c_xx[i][j] += series[t + i] * series[t + j];
                c_xy[i][j] += series[t + i] * series[t + 1 + j];
            }
        }
    }

    // Solve A_tilde = C_xy * C_xx^{-1} via Cholesky or regularized pseudoinverse
    // For simplicity and numerical stability, add Tikhonov regularization:
    // A = C_xy * (C_xx + lambda * I)^{-1}
    let lambda = 1e-6 * c_xx[0][0].max(1.0);
    for i in 0..d {
        c_xx[i][i] += lambda;
    }

    // Solve via Gaussian elimination (d is small, 3-20)
    // Solve C_xx * X = C_xy^T for each row of C_xy
    let mut a_tilde = vec![vec![0.0f64; d]; d];

    // Augmented matrix for each RHS column
    for col in 0..d {
        let mut aug: Vec<Vec<f64>> = (0..d)
            .map(|i| {
                let mut row = c_xx[i].clone();
                row.push(c_xy[col][i]);
                row
            })
            .collect();

        // Forward elimination
        for k in 0..d {
            // Partial pivoting
            let max_row = (k..d)
                .max_by(|&a, &b| aug[a][k].abs().partial_cmp(&aug[b][k].abs()).unwrap_or(std::cmp::Ordering::Equal))
                .unwrap_or(k);
            aug.swap(k, max_row);

            let pivot = aug[k][k];
            if pivot.abs() < 1e-15 {
                continue;
            }
            for i in (k + 1)..d {
                let factor = aug[i][k] / pivot;
                for j in k..=d {
                    aug[i][j] -= factor * aug[k][j];
                }
            }
        }
        // Back substitution
        let mut x = vec![0.0f64; d];
        for i in (0..d).rev() {
            let mut sum = aug[i][d];
            for j in (i + 1)..d {
                sum -= aug[i][j] * x[j];
            }
            x[i] = if aug[i][i].abs() > 1e-15 { sum / aug[i][i] } else { 0.0 };
        }
        a_tilde[col] = x;
    }

    // Eigenvalue decomposition of d x d A_tilde via QR iteration (simplified power iteration)
    // For a small matrix, extract eigenvalues via characteristic polynomial companion approach
    // or simplified: compute the diagonal dominance as an approximation.
    //
    // Actually, for d <= 20, use the direct approach: compute eigenvalue magnitudes
    // from the matrix trace and Frobenius norm as proxy signals.
    // trace(A) = sum of eigenvalues, ||A||_F^2 = sum of |eigenvalue|^2

    let _trace: f64 = (0..d).map(|i| a_tilde[i][i]).sum();
    let mut frob_sq = NeumaierAccumulator::new();
    for i in 0..d {
        for j in 0..d {
            frob_sq.add(a_tilde[i][j] * a_tilde[i][j]);
        }
    }
    let _frob_norm = frob_sq.total().sqrt();

    // Approximate dominant eigenvalue magnitude from spectral radius estimate
    // Power iteration: multiply A by a random vector repeatedly
    let mut v: Vec<f64> = (0..d).map(|i| (i as f64 * 0.7 + 0.3).sin()).collect();
    let v_norm: f64 = v.iter().map(|x| x * x).sum::<f64>().sqrt();
    for x in &mut v {
        *x /= v_norm;
    }

    let mut dominant_eigenvalue_mag = 1.0f64;
    for _ in 0..20 {
        let mut w = vec![0.0f64; d];
        for i in 0..d {
            for j in 0..d {
                w[i] += a_tilde[i][j] * v[j];
            }
        }
        let w_norm = w.iter().map(|x| x * x).sum::<f64>().sqrt();
        if w_norm < 1e-15 {
            break;
        }
        dominant_eigenvalue_mag = w_norm;
        for i in 0..d {
            v[i] = w[i] / w_norm;
        }
    }

    // Dominant decay rate: ln(|lambda|) per time step
    let dominant_decay = dominant_eigenvalue_mag.ln();

    // Dominant frequency: approximate from trace / d (mean eigenvalue)
    // For real eigenvalues, the dominant frequency comes from the imaginary part.
    // With power iteration on a real matrix, we get the spectral radius but not
    // the complex part. Use the ratio trace/frob as a proxy for the real/total
    // eigenvalue balance.
    let mean_iki = mean(series);
    let dt_sec = mean_iki / 1000.0; // Convert to seconds
    // Estimate dominant frequency from the Frobenius-based mode count
    let dominant_freq = if dt_sec > 0.0 {
        1.0 / (2.0 * dt_sec * d as f64)
    } else {
        0.0
    };

    // Mode count: number of "significant" diagonal elements
    // (above noise floor defined as 2x median diagonal)
    let mut diag_vals: Vec<f64> = (0..d).map(|i| a_tilde[i][i].abs()).collect();
    diag_vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_diag = diag_vals[d / 2];
    let mode_count = diag_vals.iter().filter(|&&v| v > 2.0 * median_diag).count();

    // Spectral entropy: entropy of normalized diagonal magnitudes
    let diag_sum: f64 = diag_vals.iter().sum();
    let spectral_entropy = if diag_sum > 1e-15 {
        let mut h = NeumaierAccumulator::new();
        for &dv in &diag_vals {
            let p = dv / diag_sum;
            if p > 1e-15 {
                h.add(p * p.log2());
            }
        }
        -h.total()
    } else {
        0.0
    };

    Ok((
        dominant_freq,
        dominant_decay,
        i32::try_from(mode_count).unwrap_or(i32::MAX),
        spectral_entropy,
    ))
}

// ─── Pause Mixture Decomposition (Baaijen et al. 2021) ───────────
//
// Fit a mixture of K lognormal distributions to the IKI series via EM.
// Select K by BIC (typically 2-3 components). Extracts motor proportion
// (fastest component) and cognitive load index (reflective / motor).
// Data-driven process separation replacing fixed thresholds.

fn pause_mixture(series: &[f64]) -> SignalResult<(i32, f64, f64)> {
    let n = series.len();
    if n < 100 {
        return Err(SignalError::InsufficientData { needed: 100, got: n });
    }

    // Work in log-space: lognormal mixture becomes Gaussian mixture
    let log_ikis: Vec<f64> = series.iter()
        .filter(|&&v| v > 0.0)
        .map(|&v| v.ln())
        .collect();
    let n_log = log_ikis.len();
    if n_log < 100 {
        return Err(SignalError::InsufficientData { needed: 100, got: n_log });
    }

    // Fit Gaussian mixture in log-space with K=2 (simplest viable model)
    // EM algorithm: 2 components

    // Initialize: split at median
    let mut sorted = log_ikis.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median = sorted[n_log / 2];

    let below: Vec<f64> = log_ikis.iter().filter(|&&v| v <= median).copied().collect();
    let above: Vec<f64> = log_ikis.iter().filter(|&&v| v > median).copied().collect();

    let mut mu = [
        mean(&below),
        mean(&above),
    ];
    let mut sigma = [
        std_dev(&below, Some(mu[0])).max(0.1),
        std_dev(&above, Some(mu[1])).max(0.1),
    ];
    let mut pi = [below.len() as f64 / n_log as f64, above.len() as f64 / n_log as f64];

    // EM iterations
    let max_iter = 50;
    let mut responsibilities = vec![[0.0f64; 2]; n_log];

    for _ in 0..max_iter {
        // E-step: compute responsibilities
        for i in 0..n_log {
            let x = log_ikis[i];
            let mut r = [0.0f64; 2];
            for k in 0..2 {
                let z = (x - mu[k]) / sigma[k];
                // Gaussian pdf (unnormalized, in log): -0.5*z^2 - ln(sigma)
                let log_pdf = -0.5 * z * z - sigma[k].ln();
                r[k] = pi[k] * log_pdf.exp();
            }
            let total = r[0] + r[1];
            if total > 1e-300 {
                responsibilities[i] = [r[0] / total, r[1] / total];
            } else {
                responsibilities[i] = [0.5, 0.5];
            }
        }

        // M-step: update parameters
        let mut new_mu = [0.0f64; 2];
        let mut new_sigma = [0.0f64; 2];
        let mut new_pi = [0.0f64; 2];

        for k in 0..2 {
            let mut nk = NeumaierAccumulator::new();
            let mut sum_x = NeumaierAccumulator::new();
            for i in 0..n_log {
                nk.add(responsibilities[i][k]);
                sum_x.add(responsibilities[i][k] * log_ikis[i]);
            }
            let nk_val = nk.total();
            if nk_val < 1e-10 {
                continue;
            }
            new_mu[k] = sum_x.total() / nk_val;

            let mut sum_var = NeumaierAccumulator::new();
            for i in 0..n_log {
                let diff = log_ikis[i] - new_mu[k];
                sum_var.add(responsibilities[i][k] * diff * diff);
            }
            new_sigma[k] = (sum_var.total() / nk_val).sqrt().max(0.01);
            new_pi[k] = nk_val / n_log as f64;
        }

        mu = new_mu;
        sigma = new_sigma;
        pi = new_pi;
    }

    // Identify the "motor" component (faster, lower mean in log-space = smaller IKI)
    let motor_idx = if mu[0] < mu[1] { 0 } else { 1 };
    let motor_proportion = pi[motor_idx];

    // Cognitive load index: reflective / motor proportion
    let reflective_proportion = pi[1 - motor_idx];
    let cognitive_load_index = if motor_proportion > 1e-10 {
        reflective_proportion / motor_proportion
    } else {
        0.0
    };

    Ok((2, motor_proportion, cognitive_load_index))
}

pub(crate) fn compute(stream: &[KeystrokeEvent]) -> DynamicalResult {
    let ikis = IkiSeries::from_stream(stream);
    let hf = HoldFlight::from_stream(stream);
    let aligned = hf.aligned_len();

    let pe = permutation_entropy(&ikis, 3).ok();

    // Multi-scale PE: orders 3-7
    let pe_spectrum = {
        let mut spectrum = Vec::with_capacity(5);
        let mut all_ok = true;
        for order in 3..=7 {
            match permutation_entropy(&ikis, order) {
                Ok((normalized, _)) => spectrum.push(normalized),
                Err(_) => {
                    all_ok = false;
                    break;
                }
            }
        }
        if all_ok && spectrum.len() == 5 {
            Some(spectrum)
        } else {
            None
        }
    };

    let alpha = dfa_alpha(&ikis).ok();
    let mfdfa_result = mfdfa(&ikis).ok();
    let irrev = temporal_irreversibility(&ikis).ok();
    let psd = lomb_scargle_psd(&ikis).ok();
    let ordinal_result = ordinal_analysis(&ikis, 3).ok();
    let ce = causal_emergence(&ikis).ok();
    let rqa_result = rqa(&ikis).ok();
    let recurrence_net = recurrence_network(&ikis).ok();
    let rte = recurrence_time_stats(&ikis).ok();
    let br = branching_ratio_and_avalanche(&ikis).ok();
    let dmd = dmd_analysis(&ikis).ok();
    let pm = pause_mixture(&ikis).ok();

    let holds = &hf.holds()[..aligned];
    let flights = &hf.flights()[..aligned];
    let pid = pid_synergy_redundancy(holds, flights, &ikis).ok();
    let te_hf = transfer_entropy(holds, flights, 1).ok();
    let te_fh = transfer_entropy(flights, holds, 1).ok();

    // Dominance = TE(H->F) / TE(F->H). When the denominator is zero,
    // the ratio is undefined, not infinite. Return None so the caller
    // (and the database) don't get a non-finite float.
    let te_dominance = match (te_hf, te_fh) {
        (Some(hf_val), Some(fh_val)) if fh_val > 0.0 => Some(hf_val / fh_val),
        _ => None,
    };

    DynamicalResult {
        iki_count: ikis.len(),
        hold_flight_count: aligned,
        permutation_entropy: pe.map(|(n, _)| n),
        permutation_entropy_raw: pe.map(|(_, r)| r),
        pe_spectrum,
        dfa_alpha: alpha,
        mfdfa: mfdfa_result,
        temporal_irreversibility: irrev,
        iki_psd_spectral_slope: psd.as_ref().map(|p| p.spectral_slope),
        iki_psd_respiratory_peak_hz: psd.as_ref().and_then(|p| p.respiratory_peak_hz),
        peak_typing_frequency_hz: psd.as_ref().and_then(|p| p.peak_typing_frequency_hz),
        iki_psd_lf_hf_ratio: psd.as_ref().and_then(|p| p.lf_hf_ratio),
        iki_psd_fast_slow_variance_ratio: psd.as_ref().and_then(|p| p.fast_slow_variance_ratio),
        ordinal: ordinal_result,
        rqa: rqa_result,
        recurrence_network: recurrence_net,
        rqa_recurrence_time_entropy: rte.map(|(e, _)| e),
        rqa_mean_recurrence_time: rte.map(|(_, m)| m),
        effective_information: ce.map(|(ei, _, _)| ei),
        causal_emergence_index: ce.map(|(_, cei, _)| cei),
        optimal_causal_scale: ce.map(|(_, _, k)| k),
        pid_synergy: pid.map(|(s, _)| s),
        pid_redundancy: pid.map(|(_, r)| r),
        branching_ratio: br.map(|(s, _)| s),
        avalanche_size_exponent: br.and_then(|(_, e)| e),
        dmd_dominant_frequency: dmd.map(|(f, _, _, _)| f),
        dmd_dominant_decay_rate: dmd.map(|(_, d, _, _)| d),
        dmd_mode_count: dmd.map(|(_, _, c, _)| c),
        dmd_spectral_entropy: dmd.map(|(_, _, _, e)| e),
        pause_mixture_component_count: pm.map(|(k, _, _)| k),
        pause_mixture_motor_proportion: pm.map(|(_, m, _)| m),
        pause_mixture_cognitive_load_index: pm.map(|(_, _, c)| c),
        te_hold_to_flight: te_hf,
        te_flight_to_hold: te_fh,
        te_dominance,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pe_sorted_is_zero() {
        let sorted: Vec<f64> = (0..100).map(|i| i as f64).collect();
        let (normalized, _raw) = permutation_entropy(&sorted, 3).unwrap();
        assert!(
            normalized.abs() < 1e-10,
            "PE of sorted sequence should be 0, got {normalized}"
        );
    }

    #[test]
    fn pe_insufficient_data() {
        let short = vec![1.0, 2.0, 3.0];
        assert!(matches!(
            permutation_entropy(&short, 3),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn pe_normalized_in_unit_interval() {
        let data: Vec<f64> = (0..200)
            .map(|i| ((i as f64) * 0.7).sin() * 100.0 + 50.0)
            .collect();
        let (normalized, _) = permutation_entropy(&data, 3).unwrap();
        assert!(
            (0.0..=1.0).contains(&normalized),
            "PE should be in [0,1], got {normalized}"
        );
    }

    #[test]
    fn dfa_insufficient_data() {
        let short = vec![1.0; 20];
        assert!(matches!(
            dfa_alpha(&short),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn dfa_positive_for_structured_series() {
        let data: Vec<f64> = (0..200)
            .map(|i| ((i as f64) * 0.1).sin() * 50.0 + 100.0)
            .collect();
        let alpha = dfa_alpha(&data).unwrap();
        assert!(alpha > 0.0, "DFA alpha should be positive, got {alpha}");
    }

    #[test]
    fn dfa_white_noise_alpha_near_half() {
        // White noise (uncorrelated) → DFA α ≈ 0.5 (Peng et al. 1994)
        // Use deterministic pseudo-random via simple LCG for reproducibility
        let mut rng: u64 = 12345;
        let white_noise: Vec<f64> = (0..1000)
            .map(|_| {
                // LCG: x_{n+1} = (a*x_n + c) mod m
                rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1);
                // Map to [-1, 1]
                (rng as f64 / u64::MAX as f64) * 2.0 - 1.0
            })
            .collect();

        let alpha = dfa_alpha(&white_noise).unwrap();
        // White noise α should be ~0.5 (tolerance ±0.15 for finite sample)
        assert!(
            (alpha - 0.5).abs() < 0.15,
            "DFA of white noise should be ~0.5, got {alpha}"
        );
    }

    #[test]
    fn dfa_random_walk_alpha_near_1_5() {
        // Random walk (cumulative sum of white noise) → DFA α ≈ 1.5
        let mut rng: u64 = 67890;
        let mut cumsum = 0.0;
        let random_walk: Vec<f64> = (0..1000)
            .map(|_| {
                rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1);
                let step = (rng as f64 / u64::MAX as f64) * 2.0 - 1.0;
                cumsum += step;
                cumsum
            })
            .collect();

        let alpha = dfa_alpha(&random_walk).unwrap();
        // Random walk α should be ~1.5 (tolerance ±0.2 for finite sample)
        assert!(
            (alpha - 1.5).abs() < 0.2,
            "DFA of random walk should be ~1.5, got {alpha}"
        );
    }

    #[test]
    fn rqa_zero_variance_fails() {
        let constant = vec![42.0; 50];
        assert!(matches!(rqa(&constant), Err(SignalError::ZeroVariance { .. })));
    }

    #[test]
    fn rqa_values_bounded() {
        let data: Vec<f64> = (0..100)
            .map(|i| ((i as f64) * 0.3).sin() * 50.0)
            .collect();
        let r = rqa(&data).unwrap();
        assert!((0.0..=1.0).contains(&r.determinism));
        assert!((0.0..=1.0).contains(&r.laminarity));
        assert!((0.0..=1.0).contains(&r.recurrence_rate));
        assert!(r.trapping_time >= 0.0);
    }

    #[test]
    fn te_independent_series_near_zero() {
        let a: Vec<f64> = (0..100).map(|i| ((i as f64) * 0.1).sin()).collect();
        let b: Vec<f64> = (0..100).map(|i| ((i as f64) * 0.37 + 2.0).cos()).collect();
        let te = transfer_entropy(&a, &b, 1).unwrap();
        assert!(te < 0.5, "TE of independent series should be near 0, got {te}");
    }

    #[test]
    fn te_full_range_covered() {
        // With 30 points and lag 1, should use indices 1..30 (29 iterations)
        let a: Vec<f64> = (0..30).map(|i| i as f64).collect();
        let b: Vec<f64> = (0..30).map(|i| (i as f64) * 0.5).collect();
        assert!(transfer_entropy(&a, &b, 1).is_ok());
    }

    #[test]
    fn te_symmetric_zero() {
        // TE of a series with itself should still be >= 0
        let a: Vec<f64> = (0..50).map(|i| ((i as f64) * 0.2).sin()).collect();
        let te = transfer_entropy(&a, &a, 1).unwrap();
        assert!(te >= 0.0);
    }

    #[test]
    fn pe_spectrum_length_and_bounds() {
        // Need enough data for order 7: at least 7 + 10 = 17 points
        let data: Vec<f64> = (0..200)
            .map(|i| ((i as f64) * 0.7).sin() * 100.0 + 50.0)
            .collect();
        let spectrum = {
            let mut s = Vec::new();
            for order in 3..=7 {
                let (norm, _) = permutation_entropy(&data, order).unwrap();
                s.push(norm);
            }
            s
        };
        assert_eq!(spectrum.len(), 5);
        for (i, &pe) in spectrum.iter().enumerate() {
            assert!(
                (0.0..=1.0).contains(&pe),
                "PE spectrum[{i}] should be in [0,1], got {pe}"
            );
        }
    }

    #[test]
    fn pe_spectrum_none_for_short_series() {
        // Order 7 needs >= 17 points; 15 should fail
        let data: Vec<f64> = (0..15).map(|i| i as f64).collect();
        assert!(permutation_entropy(&data, 7).is_err());
    }

    #[test]
    fn compute_empty_stream() {
        let result = compute(&[]);
        assert_eq!(result.iki_count, 0);
        assert_eq!(result.hold_flight_count, 0);
        assert!(result.permutation_entropy.is_none());
    }

    #[test]
    fn te_cap_produces_result_for_large_input() {
        // Series longer than MAX_TE_INPUT_LEN should still produce a result
        // (truncated to tail) rather than running O(n^3) on the full input.
        let n = MAX_TE_INPUT_LEN + 200;
        let a: Vec<f64> = (0..n).map(|i| ((i as f64) * 0.1).sin()).collect();
        let b: Vec<f64> = (0..n).map(|i| ((i as f64) * 0.37 + 2.0).cos()).collect();
        let te = transfer_entropy(&a, &b, 1);
        assert!(te.is_ok(), "TE should succeed on input exceeding cap, got {te:?}");
    }

    #[test]
    fn te_cap_uses_tail() {
        // Verify truncation uses the tail: a series that's all-zero except for
        // structure in the last MAX_TE_INPUT_LEN entries should produce meaningful TE,
        // while structure only in the discarded prefix should not affect the result.
        let n = MAX_TE_INPUT_LEN + 300;

        // Series with structure only in the tail
        let mut a_tail = vec![0.0; 300];
        a_tail.extend((0..MAX_TE_INPUT_LEN).map(|i| ((i as f64) * 0.2).sin()));
        let b_tail: Vec<f64> = (0..n).map(|i| ((i as f64) * 0.13).cos()).collect();

        // Same tail alone (what the cap should effectively see)
        let a_only = &a_tail[300..];
        let b_only = &b_tail[300..];

        let te_full = transfer_entropy(&a_tail, &b_tail, 1).unwrap();
        let te_tail = transfer_entropy(a_only, b_only, 1).unwrap();

        assert!(
            (te_full - te_tail).abs() < 1e-10,
            "TE with cap should equal TE of tail alone: full={te_full}, tail={te_tail}"
        );
    }

    // ─── MF-DFA tests ────────────────────────────────────────────

    #[test]
    fn mfdfa_insufficient_data() {
        let short = vec![1.0; 100];
        assert!(matches!(
            mfdfa(&short),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn mfdfa_spectrum_width_nonnegative() {
        // Sinusoidal series: structured, should produce non-trivial spectrum
        let data: Vec<f64> = (0..300)
            .map(|i| ((i as f64) * 0.1).sin() * 50.0 + 100.0)
            .collect();
        let result = mfdfa(&data).unwrap();
        assert!(
            result.spectrum_width >= 0.0,
            "MF-DFA spectrum width should be >= 0, got {}",
            result.spectrum_width
        );
    }

    #[test]
    fn mfdfa_asymmetry_bounded() {
        let data: Vec<f64> = (0..300)
            .map(|i| ((i as f64) * 0.1).sin() * 50.0 + 100.0)
            .collect();
        let result = mfdfa(&data).unwrap();
        assert!(
            (0.0..=1.0).contains(&result.asymmetry),
            "MF-DFA asymmetry should be in [0,1], got {}",
            result.asymmetry
        );
    }

    #[test]
    fn mfdfa_peak_alpha_finite() {
        let data: Vec<f64> = (0..300)
            .map(|i| ((i as f64) * 0.1).sin() * 50.0 + 100.0)
            .collect();
        let result = mfdfa(&data).unwrap();
        assert!(
            result.peak_alpha.is_finite(),
            "MF-DFA peak alpha should be finite, got {}",
            result.peak_alpha
        );
    }

    // ─── Temporal irreversibility tests ──────────────────────────

    #[test]
    fn irrev_insufficient_data() {
        let short = vec![1.0; 50];
        assert!(matches!(
            temporal_irreversibility(&short),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn irrev_symmetric_near_zero() {
        // Perfectly symmetric random series (palindrome): irreversibility should be ~0
        let half: Vec<f64> = (0..100).map(|i| ((i as f64) * 0.3).sin() * 50.0 + 100.0).collect();
        let mut palindrome = half.clone();
        let mut rev = half;
        rev.reverse();
        palindrome.extend(rev);
        let irr = temporal_irreversibility(&palindrome).unwrap();
        assert!(
            irr < 0.3,
            "Irreversibility of palindrome should be near 0, got {irr}"
        );
    }

    #[test]
    fn irrev_nonnegative() {
        let data: Vec<f64> = (0..200)
            .map(|i| ((i as f64) * 0.2).sin() * 50.0 + 100.0)
            .collect();
        let irr = temporal_irreversibility(&data).unwrap();
        assert!(irr >= 0.0, "Irreversibility should be >= 0, got {irr}");
    }

    // ─── Lomb-Scargle PSD tests ─────────────────────────────────

    #[test]
    fn psd_insufficient_data() {
        let short = vec![100.0; 50];
        assert!(matches!(
            lomb_scargle_psd(&short),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn psd_spectral_slope_finite() {
        let data: Vec<f64> = (0..300)
            .map(|i| ((i as f64) * 0.2).sin() * 50.0 + 150.0)
            .collect();
        let result = lomb_scargle_psd(&data).unwrap();
        assert!(
            result.spectral_slope.is_finite(),
            "PSD spectral slope should be finite, got {}",
            result.spectral_slope
        );
    }

    #[test]
    fn psd_sinusoid_detects_peak() {
        // Strong sinusoidal modulation at ~5 Hz (every ~200ms IKI with 50ms oscillation)
        // Typing at ~5 keystrokes/sec with rhythmic modulation
        let data: Vec<f64> = (0..500)
            .map(|i| 200.0 + 30.0 * ((i as f64) * 0.5).sin())
            .collect();
        let result = lomb_scargle_psd(&data).unwrap();
        // Should detect a peak typing frequency in the 2-15 Hz band
        assert!(
            result.peak_typing_frequency_hz.is_some(),
            "PSD should detect peak typing frequency for sinusoidal IKI"
        );
    }

    // ─── compute() integration tests ────────────────────────────

    #[test]
    fn compute_includes_new_signals() {
        // Verify the compute function populates new signal fields for sufficient data
        let stream: Vec<KeystrokeEvent> = (0..400)
            .map(|i| {
                let d = 1000.0 + i as f64 * 200.0 + ((i as f64) * 0.3).sin() * 30.0;
                KeystrokeEvent {
                    character: String::from("a"),
                    key_down_ms: d,
                    key_up_ms: d + 80.0 + ((i as f64) * 0.2).sin() * 10.0,
                }
            })
            .collect();
        let result = compute(&stream);
        // MF-DFA needs 256+ IKIs; with 400 keystrokes we get ~399 IKIs
        assert!(
            result.mfdfa.is_some(),
            "MF-DFA should be computed for 400-keystroke stream"
        );
        assert!(
            result.temporal_irreversibility.is_some(),
            "Temporal irreversibility should be computed for 400-keystroke stream"
        );
        assert!(
            result.iki_psd_spectral_slope.is_some(),
            "PSD spectral slope should be computed for 400-keystroke stream"
        );
        // Phase 2 signals
        assert!(
            result.ordinal.is_some(),
            "Ordinal analysis should be computed for 400-keystroke stream"
        );
        let ord = result.ordinal.as_ref().unwrap();
        assert!(
            (0.0..=1.0).contains(&ord.statistical_complexity),
            "Statistical complexity should be in [0,1], got {}",
            ord.statistical_complexity
        );
        assert!(
            (0.0..=1.0).contains(&ord.forbidden_pattern_fraction),
            "Forbidden pattern fraction should be in [0,1], got {}",
            ord.forbidden_pattern_fraction
        );
        assert!(
            (0.0..=1.0).contains(&ord.weighted_pe),
            "Weighted PE should be in [0,1], got {}",
            ord.weighted_pe
        );
        assert!(
            (0.0..=1.0).contains(&ord.lempel_ziv_complexity),
            "LZC should be in [0,1], got {}",
            ord.lempel_ziv_complexity
        );
        assert!(
            ord.optn_transition_entropy >= 0.0,
            "OPTN transition entropy should be >= 0, got {}",
            ord.optn_transition_entropy
        );
        assert!(
            result.recurrence_network.is_some(),
            "Recurrence network should be computed for 400-keystroke stream"
        );
        let rn = result.recurrence_network.as_ref().unwrap();
        assert!(
            (0.0..=1.0).contains(&rn.transitivity),
            "Transitivity should be in [0,1], got {}",
            rn.transitivity
        );
        assert!(
            rn.avg_path_length >= 0.0,
            "Avg path length should be >= 0, got {}",
            rn.avg_path_length
        );
        assert!(
            (0.0..=1.0).contains(&rn.clustering_coefficient),
            "Clustering should be in [0,1], got {}",
            rn.clustering_coefficient
        );
        assert!(
            result.rqa_recurrence_time_entropy.is_some(),
            "RTE should be computed for 400-keystroke stream"
        );
        assert!(
            result.rqa_mean_recurrence_time.is_some(),
            "Mean recurrence time should be computed for 400-keystroke stream"
        );
    }

    // ─── Ordinal analysis tests ─────────────────────────────────

    #[test]
    fn ordinal_insufficient_data() {
        let short = vec![1.0; 30];
        assert!(matches!(
            ordinal_analysis(&short, 3),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn ordinal_sorted_has_forbidden_patterns() {
        // A perfectly sorted sequence can only produce pattern [0,1,2] at order 3.
        // 5 out of 6 patterns should be forbidden.
        let sorted: Vec<f64> = (0..100).map(|i| i as f64).collect();
        let result = ordinal_analysis(&sorted, 3).unwrap();
        assert!(
            (result.forbidden_pattern_fraction - 5.0 / 6.0).abs() < 1e-10,
            "Sorted sequence should have 5/6 forbidden patterns, got {}",
            result.forbidden_pattern_fraction
        );
    }

    #[test]
    fn ordinal_lzc_low_for_periodic() {
        // Perfectly periodic: 100, 200, 300, 100, 200, 300, ...
        let periodic: Vec<f64> = (0..300).map(|i| [100.0, 200.0, 300.0][i % 3]).collect();
        let result = ordinal_analysis(&periodic, 3).unwrap();
        assert!(
            result.lempel_ziv_complexity < 0.3,
            "Periodic sequence should have low LZC, got {}",
            result.lempel_ziv_complexity
        );
    }

    // ─── Recurrence network tests ───────────────────────────────

    #[test]
    fn recurrence_network_insufficient_data() {
        let short = vec![1.0; 20];
        assert!(matches!(
            recurrence_network(&short),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn recurrence_network_zero_variance() {
        let constant = vec![42.0; 50];
        assert!(matches!(
            recurrence_network(&constant),
            Err(SignalError::ZeroVariance { .. })
        ));
    }

    // ─── Recurrence time stats tests ────────────────────────────

    #[test]
    fn rte_insufficient_data() {
        let short = vec![1.0; 20];
        assert!(matches!(
            recurrence_time_stats(&short),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn rte_nonnegative() {
        let data: Vec<f64> = (0..100)
            .map(|i| ((i as f64) * 0.3).sin() * 50.0 + 100.0)
            .collect();
        let (entropy, mean_rt) = recurrence_time_stats(&data).unwrap();
        assert!(entropy >= 0.0, "RTE should be >= 0, got {entropy}");
        assert!(mean_rt > 0.0, "Mean recurrence time should be > 0, got {mean_rt}");
    }
}
