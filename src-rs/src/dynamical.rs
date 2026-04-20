//! Dynamical Signal Computation
//!
//! Nonlinear signals from raw keystroke streams. Treats the IKI series
//! as the output of a complex adaptive system.
//!
//! - Permutation entropy (Bandt & Pompe 2002)
//! - DFA alpha (Peng et al. 1994)
//! - RQA: determinism, laminarity, trapping time, recurrence rate (Webber & Zbilut 2005)
//! - Transfer entropy (Schreiber 2000)

use std::collections::HashMap;

use crate::stats::{linreg_slope, mean, std_dev};
use crate::types::{HoldFlight, IkiSeries, KeystrokeEvent, SignalError, SignalResult};

// ─── Result types ─────────────────────────────────────────────────

pub struct RqaResult {
    pub determinism: f64,
    pub laminarity: f64,
    pub trapping_time: f64,
    pub recurrence_rate: f64,
}

pub struct DynamicalResult {
    pub iki_count: usize,
    pub hold_flight_count: usize,
    pub permutation_entropy: Option<f64>,
    pub permutation_entropy_raw: Option<f64>,
    pub dfa_alpha: Option<f64>,
    pub rqa: Option<RqaResult>,
    pub te_hold_to_flight: Option<f64>,
    pub te_flight_to_hold: Option<f64>,
    pub te_dominance: Option<f64>,
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

    let mut pattern_counts: HashMap<Vec<usize>, u64> = HashMap::new();
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
    let mut entropy = 0.0;
    for &count in pattern_counts.values() {
        let p = count as f64 / total;
        if p > 0.0 {
            entropy -= p * p.log2();
        }
    }

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

    // Cumulative sum (integration)
    let mut y = vec![0.0; n];
    y[0] = series[0] - mu;
    for i in 1..n {
        y[i] = y[i - 1] + (series[i] - mu);
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

        let mut sum_fluctuation = 0.0;
        for b in 0..num_boxes {
            let start = b * box_size;
            let mut sx = 0.0f64;
            let mut sy = 0.0f64;
            let mut sxx = 0.0f64;
            let mut sxy = 0.0f64;

            for j in 0..box_size {
                let jf = j as f64;
                sx += jf;
                sy += y[start + j];
                sxx += jf * jf;
                sxy += jf * y[start + j];
            }

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

            let mut sum_sq = 0.0;
            for j in 0..box_size {
                let trend = slope.mul_add(j as f64, intercept);
                sum_sq += (y[start + j] - trend).powi(2);
            }
            sum_fluctuation += (sum_sq / bsf).sqrt();
        }

        let f = sum_fluctuation / num_boxes as f64;
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
// measures to the same basis. Cap at 500 points for O(n^2) feasibility.

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

    let m = n.min(500);

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

// ─── Transfer Entropy (Schreiber 2000) ────────────────────────────
// Binned estimation: discretize into 3 levels (terciles).

fn discretize(arr: &[f64]) -> Vec<u8> {
    let mut sorted = arr.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let t1 = sorted[sorted.len() / 3];
    let t2 = sorted[2 * sorted.len() / 3];
    arr.iter()
        .map(|&v| {
            if v <= t1 {
                0
            } else if v <= t2 {
                1
            } else {
                2
            }
        })
        .collect()
}

/// TE(source -> target): does knowing source's past reduce uncertainty
/// about target's future, beyond what target's own past provides?
///
/// `TE(S->T) = sum p(t_fut, t_cur, s_cur) * log2[ p(t_fut|t_cur,s_cur) / p(t_fut|t_cur) ]`
fn transfer_entropy(source: &[f64], target: &[f64], lag: usize) -> SignalResult<f64> {
    let n = source.len().min(target.len());
    if n < 30 {
        return Err(SignalError::InsufficientData { needed: 30, got: n });
    }

    let s = discretize(&source[..n]);
    let t = discretize(&target[..n]);

    let mut joint: HashMap<(u8, u8, u8), u32> = HashMap::new(); // (t_fut, t_cur, s_cur)
    let mut count_t_cur: HashMap<u8, u32> = HashMap::new();
    let mut count_t_cur_s_cur: HashMap<(u8, u8), u32> = HashMap::new();
    let mut count_t_fut_t_cur: HashMap<(u8, u8), u32> = HashMap::new();
    let mut total: u32 = 0;

    for i in lag..n {
        let t_cur = t[i - lag];
        let s_cur = s[i - lag];
        let t_fut = t[i];

        *joint.entry((t_fut, t_cur, s_cur)).or_insert(0) += 1;
        *count_t_cur.entry(t_cur).or_insert(0) += 1;
        *count_t_cur_s_cur.entry((t_cur, s_cur)).or_insert(0) += 1;
        *count_t_fut_t_cur.entry((t_fut, t_cur)).or_insert(0) += 1;
        total += 1;
    }

    if total < 20 {
        return Err(SignalError::InsufficientData {
            needed: 20,
            got: total as usize,
        });
    }

    let tf = f64::from(total);
    let mut te = 0.0;

    for (&(t_fut, t_cur, s_cur), &count) in &joint {
        let p_joint = f64::from(count) / tf;
        let p_ts =
            f64::from(*count_t_cur_s_cur.get(&(t_cur, s_cur)).unwrap_or(&0)) / tf;
        #[allow(clippy::similar_names)] // p_ts and p_tt are standard TE notation
        let p_tt =
            f64::from(*count_t_fut_t_cur.get(&(t_fut, t_cur)).unwrap_or(&0)) / tf;
        let p_t = f64::from(*count_t_cur.get(&t_cur).unwrap_or(&0)) / tf;

        if p_ts > 0.0 && p_t > 0.0 && p_tt > 0.0 {
            let conditional = f64::from(count) / tf / p_ts;
            let marginal = p_tt / p_t;
            if conditional > 0.0 && marginal > 0.0 {
                te += p_joint * (conditional / marginal).log2();
            }
        }
    }

    Ok(te.max(0.0))
}

// ─── Public API ───────────────────────────────────────────────────

pub fn compute(stream: &[KeystrokeEvent]) -> DynamicalResult {
    let ikis = IkiSeries::from_stream(stream);
    let hf = HoldFlight::from_stream(stream);
    let aligned = hf.aligned_len();

    let pe = permutation_entropy(&ikis, 3).ok();
    let alpha = dfa_alpha(&ikis).ok();
    let rqa_result = rqa(&ikis).ok();

    let holds = &hf.holds[..aligned];
    let flights = &hf.flights[..aligned];
    let te_hf = transfer_entropy(holds, flights, 1).ok();
    let te_fh = transfer_entropy(flights, holds, 1).ok();

    let te_dominance = match (te_hf, te_fh) {
        (Some(hf_val), Some(fh_val)) if (hf_val + fh_val) > 0.0 => {
            if fh_val > 0.0 {
                Some(hf_val / fh_val)
            } else if hf_val > 0.0 {
                Some(f64::INFINITY)
            } else {
                Some(1.0)
            }
        }
        _ => None,
    };

    DynamicalResult {
        iki_count: ikis.len(),
        hold_flight_count: aligned,
        permutation_entropy: pe.map(|(n, _)| n),
        permutation_entropy_raw: pe.map(|(_, r)| r),
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
    fn compute_empty_stream() {
        let result = compute(&[]);
        assert_eq!(result.iki_count, 0);
        assert_eq!(result.hold_flight_count, 0);
        assert!(result.permutation_entropy.is_none());
    }
}
