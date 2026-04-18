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

use crate::stats::{self, mean, std_dev};
use crate::{DynamicalSignals, KeystrokeEvent};

// ─── Extraction ────────────────────────────────────────────────────

fn extract_iki(stream: &[KeystrokeEvent]) -> Vec<f64> {
    let downs: Vec<f64> = stream.iter().map(|e| e.d).collect();
    stats::extract_iki(&downs)
}

struct HoldFlight {
    holds: Vec<f64>,
    flights: Vec<f64>,
}

fn extract_hold_flight(stream: &[KeystrokeEvent]) -> HoldFlight {
    let mut holds = Vec::with_capacity(stream.len());
    let mut flights = Vec::with_capacity(stream.len());

    for (i, evt) in stream.iter().enumerate() {
        let ht = evt.u - evt.d;
        if ht > 0.0 && ht < 2000.0 {
            holds.push(ht);
        }
        if i > 0 {
            let ft = evt.d - stream[i - 1].u;
            if ft > 0.0 && ft < 5000.0 {
                flights.push(ft);
            }
        }
    }

    HoldFlight { holds, flights }
}

// ─── Permutation Entropy (Bandt & Pompe 2002) ──────────────────────

fn permutation_entropy(series: &[f64], order: usize) -> Option<(f64, f64)> {
    if series.len() < order + 10 {
        return None;
    }

    let mut pattern_counts: HashMap<Vec<usize>, u64> = HashMap::new();
    let n = series.len() - order + 1;

    for i in 0..n {
        let window = &series[i..i + order];
        let mut indices: Vec<usize> = (0..order).collect();
        indices.sort_by(|&a, &b| window[a].partial_cmp(&window[b]).unwrap_or(std::cmp::Ordering::Equal));
        *pattern_counts.entry(indices).or_insert(0) += 1;
    }

    let nf = n as f64;
    let mut entropy = 0.0;
    for &count in pattern_counts.values() {
        let p = count as f64 / nf;
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

    let normalized = if max_entropy > 0.0 { entropy / max_entropy } else { 0.0 };
    Some((normalized, entropy))
}

// ─── DFA (Peng et al. 1994) ────────────────────────────────────────

fn dfa_alpha(series: &[f64]) -> Option<f64> {
    let n = series.len();
    if n < 50 {
        return None;
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
        return None;
    }

    let mut log_sizes = Vec::new();
    let mut log_fluctuations = Vec::new();

    let num_sizes = 15.min(max_box - min_box + 1);
    let ratio = max_box as f64 / min_box as f64;

    for i in 0..num_sizes {
        let box_size = (min_box as f64 * ratio.powf(i as f64 / (num_sizes - 1).max(1) as f64)).round() as usize;
        if !log_sizes.is_empty() && box_size == *log_sizes.last().unwrap() {
            continue;
        }

        let num_boxes = n / box_size;
        if num_boxes < 2 {
            continue;
        }

        let mut sum_fluctuation = 0.0;
        for b in 0..num_boxes {
            let start = b * box_size;
            // Linear detrend within box
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
            let denom = bsf * sxx - sx * sx;
            let slope = if denom != 0.0 { (bsf * sxy - sx * sy) / denom } else { 0.0 };
            let intercept = (sy - slope * sx) / bsf;

            let mut sum_sq = 0.0;
            for j in 0..box_size {
                let trend = intercept + slope * j as f64;
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
        return None;
    }

    let log_x: Vec<f64> = log_sizes.iter().map(|&s| (s as f64).ln()).collect();
    stats::linreg_slope(&log_x, &log_fluctuations)
}

// ─── RQA (Webber & Zbilut 2005) ────────────────────────────────────
// Fixed threshold (20% of std), embedding dim=1. Cap at 500 points.

struct RqaResult {
    determinism: f64,
    laminarity: f64,
    trapping_time: f64,
    recurrence_rate: f64,
}

fn rqa(series: &[f64], threshold: Option<f64>) -> Option<RqaResult> {
    let n = series.len();
    if n < 30 {
        return None;
    }

    let mu = mean(series);
    let s = std_dev(series, Some(mu));
    let eps = threshold.unwrap_or(s * 0.2);
    if eps <= 0.0 {
        return None;
    }

    let m = n.min(500);

    let mut total_recurrences: u64 = 0;
    let mut diagonal_points: u64 = 0;
    let mut vertical_points: u64 = 0;
    let mut total_vertical_length: u64 = 0;
    let mut vertical_line_count: u64 = 0;

    // Diagonal line detection: scan each diagonal
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

    // Vertical line detection: for each column
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

    Some(RqaResult {
        determinism: determinism.min(1.0),
        laminarity: laminarity.min(1.0),
        trapping_time,
        recurrence_rate,
    })
}

// ─── Transfer Entropy (Schreiber 2000) ─────────────────────────────
// Binned estimation: discretize into 3 levels (terciles).

fn discretize(arr: &[f64]) -> Vec<u8> {
    let mut sorted = arr.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let t1 = sorted[sorted.len() / 3];
    let t2 = sorted[2 * sorted.len() / 3];
    arr.iter()
        .map(|&v| if v <= t1 { 0 } else if v <= t2 { 1 } else { 2 })
        .collect()
}

fn transfer_entropy(source: &[f64], target: &[f64], lag: usize) -> Option<f64> {
    let n = source.len().min(target.len());
    if n < 30 {
        return None;
    }

    let s = discretize(&source[..n]);
    let t = discretize(&target[..n]);

    // Count joint and marginal probabilities
    // TE(S->T) = sum p(t+1, t, s) * log2( p(t+1|t,s) / p(t+1|t) )
    let mut counts: HashMap<(u8, u8, u8), u32> = HashMap::new();     // (tNext, tPrev, sPrev)
    let mut count_t: HashMap<u8, u32> = HashMap::new();               // tPrev
    let mut count_ts: HashMap<(u8, u8), u32> = HashMap::new();        // (tPrev, sPrev)
    let mut count_tnext: HashMap<(u8, u8), u32> = HashMap::new();     // (tNext, tPrev)
    let mut total: u32 = 0;

    for i in lag..(n - 1) {
        let t_prev = t[i - lag];
        let s_prev = s[i - lag];
        let t_next = t[i];

        *counts.entry((t_next, t_prev, s_prev)).or_insert(0) += 1;
        *count_t.entry(t_prev).or_insert(0) += 1;
        *count_ts.entry((t_prev, s_prev)).or_insert(0) += 1;
        *count_tnext.entry((t_next, t_prev)).or_insert(0) += 1;
        total += 1;
    }

    if total < 20 {
        return None;
    }

    let tf = total as f64;
    let mut te = 0.0;

    for (&(t_next, t_prev, s_prev), &count) in &counts {
        let p_full = count as f64 / tf;
        let p_ts = *count_ts.get(&(t_prev, s_prev)).unwrap_or(&0) as f64 / tf;
        let p_tnext = *count_tnext.get(&(t_next, t_prev)).unwrap_or(&0) as f64 / tf;
        let p_t = *count_t.get(&t_prev).unwrap_or(&0) as f64 / tf;

        if p_ts > 0.0 && p_t > 0.0 && p_tnext > 0.0 {
            let conditional = (count as f64 / tf) / p_ts;
            let marginal = p_tnext / p_t;
            if conditional > 0.0 && marginal > 0.0 {
                te += p_full * (conditional / marginal).log2();
            }
        }
    }

    Some(te.max(0.0))
}

// ─── Public API ────────────────────────────────────────────────────

pub fn compute(stream: &[KeystrokeEvent]) -> DynamicalSignals {
    let ikis = extract_iki(stream);
    let hf = extract_hold_flight(stream);
    let min_len = hf.holds.len().min(hf.flights.len());

    // Permutation entropy
    let pe = permutation_entropy(&ikis, 3);

    // DFA
    let alpha = dfa_alpha(&ikis);

    // RQA
    let rqa_result = rqa(&ikis, None);

    // Transfer entropy (both directions)
    let holds_aligned = &hf.holds[..min_len];
    let flights_aligned = &hf.flights[..min_len];
    let te_hf = transfer_entropy(holds_aligned, flights_aligned, 1);
    let te_fh = transfer_entropy(flights_aligned, holds_aligned, 1);

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

    DynamicalSignals {
        iki_count: ikis.len() as i32,
        hold_flight_count: min_len as i32,
        permutation_entropy: pe.map(|(n, _)| n),
        permutation_entropy_raw: pe.map(|(_, r)| r),
        dfa_alpha: alpha,
        rqa_determinism: rqa_result.as_ref().map(|r| r.determinism),
        rqa_laminarity: rqa_result.as_ref().map(|r| r.laminarity),
        rqa_trapping_time: rqa_result.as_ref().map(|r| r.trapping_time),
        rqa_recurrence_rate: rqa_result.as_ref().map(|r| r.recurrence_rate),
        te_hold_to_flight: te_hf,
        te_flight_to_hold: te_fh,
        te_dominance,
    }
}
