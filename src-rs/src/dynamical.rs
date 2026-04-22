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

pub(crate) struct DynamicalResult {
    pub(crate) iki_count: usize,
    pub(crate) hold_flight_count: usize,
    pub(crate) permutation_entropy: Option<f64>,
    pub(crate) permutation_entropy_raw: Option<f64>,
    /// PE at orders 3-7: complexity spectrum revealing structure at multiple scales.
    /// Index 0 = order 3, index 4 = order 7. Each value is normalized [0,1].
    pub(crate) pe_spectrum: Option<Vec<f64>>,
    pub(crate) dfa_alpha: Option<f64>,
    pub(crate) rqa: Option<RqaResult>,
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

    Ok(te.max(0.0))
}

// ─── Public API ───────────────────────────────────────────────────

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
    let rqa_result = rqa(&ikis).ok();

    let holds = &hf.holds()[..aligned];
    let flights = &hf.flights()[..aligned];
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
        rqa: rqa_result,
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
}
