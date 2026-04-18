//! Motor Signal Computation
//!
//! Motor and rhythmic features from raw keystroke streams.
//! Sample entropy, autocorrelation, jerk, lapse rate, tempo drift,
//! IKI compression, digraph latency, ex-Gaussian fit, adjacent hold-time covariance.

use std::collections::HashMap;
use std::io::Write;

use flate2::write::GzEncoder;
use flate2::Compression;

use crate::stats::{self, mean, std_dev};
use crate::{KeystrokeEvent, MotorSignals};

// ─── Sample Entropy (Richman & Moorman 2000) ───────────────────────

fn sample_entropy(series: &[f64], m: usize, r_factor: f64) -> Option<f64> {
    let n = series.len();
    if n < 30 {
        return None;
    }

    let s = std_dev(series, None);
    let r = r_factor * s;
    if r <= 0.0 {
        return None;
    }

    // Cap at 500 points for performance
    let data = if n > 500 { &series[n - 500..] } else { series };
    fn count_matches(data: &[f64], template_len: usize, r: f64) -> u64 {
        let n = data.len();
        let mut count: u64 = 0;
        for i in 0..(n - template_len) {
            for j in (i + 1)..(n - template_len) {
                let mut matched = true;
                for k in 0..template_len {
                    if (data[i + k] - data[j + k]).abs() > r {
                        matched = false;
                        break;
                    }
                }
                if matched {
                    count += 1;
                }
            }
        }
        count
    }

    let b = count_matches(data, m, r);
    let a = count_matches(data, m + 1, r);

    if b == 0 {
        return None;
    }

    Some(-(a as f64 / b as f64).ln())
}

// ─── IKI Autocorrelation ───────────────────────────────────────────

fn iki_autocorrelation(ikis: &[f64], max_lag: usize) -> Option<Vec<f64>> {
    let n = ikis.len();
    if n < max_lag + 10 {
        return None;
    }

    let mu = mean(ikis);
    let variance = ikis.iter().map(|v| (v - mu).powi(2)).sum::<f64>() / n as f64;
    if variance == 0.0 {
        return None;
    }

    let mut result = Vec::with_capacity(max_lag);
    for lag in 1..=max_lag {
        let mut sum = 0.0;
        for i in 0..(n - lag) {
            sum += (ikis[i] - mu) * (ikis[i + lag] - mu);
        }
        result.push(sum / ((n - lag) as f64 * variance));
    }
    Some(result)
}

// ─── Motor Jerk ────────────────────────────────────────────────────

fn motor_jerk(ikis: &[f64]) -> Option<f64> {
    if ikis.len() < 10 {
        return None;
    }

    let mut jerks = Vec::with_capacity(ikis.len() - 2);
    for i in 2..ikis.len() {
        let accel1 = ikis[i] - ikis[i - 1];
        let accel0 = ikis[i - 1] - ikis[i - 2];
        jerks.push((accel1 - accel0).abs());
    }

    if jerks.is_empty() {
        None
    } else {
        Some(mean(&jerks))
    }
}

// ─── Lapse Rate (Haag et al. 2020) ────────────────────────────────

fn lapse_rate(ikis: &[f64], total_duration_ms: f64) -> Option<f64> {
    if ikis.len() < 20 {
        return None;
    }

    let mu = mean(ikis);
    let s = std_dev(ikis, Some(mu));
    let threshold = mu + 3.0 * s;

    let lapse_count = ikis.iter().filter(|&&v| v > threshold).count();
    let minutes = total_duration_ms / 60000.0;

    if minutes > 0.0 {
        Some(lapse_count as f64 / minutes)
    } else {
        None
    }
}

// ─── Tempo Drift ───────────────────────────────────────────────────

fn tempo_drift(ikis: &[f64]) -> Option<f64> {
    if ikis.len() < 20 {
        return None;
    }

    let q = ikis.len() / 4;
    let mut quartile_means = Vec::with_capacity(4);
    for i in 0..4 {
        let start = i * q;
        let end = if i == 3 { ikis.len() } else { (i + 1) * q };
        quartile_means.push(mean(&ikis[start..end]));
    }

    let x_mean = 1.5;
    let y_mean = mean(&quartile_means);
    let mut num = 0.0;
    let mut den = 0.0;
    for i in 0..4 {
        let xi = i as f64;
        num += (xi - x_mean) * (quartile_means[i] - y_mean);
        den += (xi - x_mean).powi(2);
    }

    if den > 0.0 { Some(num / den) } else { None }
}

// ─── IKI Compression Ratio ─────────────────────────────────────────

fn iki_compression_ratio(ikis: &[f64]) -> Option<f64> {
    if ikis.len() < 10 {
        return None;
    }

    let raw: String = ikis.iter()
        .map(|v| v.round().to_string())
        .collect::<Vec<_>>()
        .join(",");
    let raw_bytes = raw.as_bytes();

    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(raw_bytes).ok()?;
    let compressed = encoder.finish().ok()?;

    Some(compressed.len() as f64 / raw_bytes.len() as f64)
}

// ─── Digraph Latency Profile ───────────────────────────────────────

fn digraph_latency_profile(stream: &[KeystrokeEvent]) -> Option<String> {
    if stream.len() < 20 {
        return None;
    }

    let mut digraphs: HashMap<String, Vec<f64>> = HashMap::new();

    for i in 1..stream.len() {
        let ft = stream[i].d - stream[i - 1].u;
        if ft > 0.0 && ft < 5000.0 {
            let key = format!("{}>{}", stream[i - 1].c, stream[i].c);
            digraphs.entry(key).or_default().push(ft);
        }
    }

    let mut sorted: Vec<(String, Vec<f64>)> = digraphs
        .into_iter()
        .filter(|(_, v)| v.len() >= 2)
        .collect();
    sorted.sort_by(|a, b| b.1.len().cmp(&a.1.len()));
    sorted.truncate(10);

    if sorted.is_empty() {
        return None;
    }

    let mut profile: HashMap<String, f64> = HashMap::new();
    for (key, values) in &sorted {
        profile.insert(key.clone(), mean(values));
    }

    serde_json::to_string(&profile).ok()
}

// ─── Ex-Gaussian Fit (BiAffect / Zulueta 2018) ────────────────────

struct ExGaussianResult {
    tau: Option<f64>,
    mu: Option<f64>,
    sigma: Option<f64>,
    tau_proportion: Option<f64>,
}

fn ex_gaussian_fit(flight_times: &[f64]) -> ExGaussianResult {
    let null = ExGaussianResult { tau: None, mu: None, sigma: None, tau_proportion: None };
    if flight_times.len() < 50 {
        return null;
    }

    // Remove extreme outliers: cap at Q3 + 3*IQR
    let mut sorted = flight_times.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let q1 = sorted[sorted.len() / 4];
    let q3 = sorted[3 * sorted.len() / 4];
    let iqr = q3 - q1;
    let cap = q3 + 3.0 * iqr;

    let filtered: Vec<f64> = flight_times.iter().filter(|&&v| v <= cap).copied().collect();
    if filtered.len() < 50 {
        return null;
    }

    let m = mean(&filtered);
    let s = std_dev(&filtered, Some(m));
    if s <= 0.0 {
        return null;
    }

    // Skewness (third standardized moment)
    let n = filtered.len() as f64;
    let m3: f64 = filtered.iter().map(|v| ((v - m) / s).powi(3)).sum::<f64>() / n;

    if m3 <= 0.0 {
        return null;
    }

    // Method of moments: tau = std * (skewness/2)^(1/3)
    let tau = s * (m3 / 2.0).cbrt();
    let variance = s * s;
    let tau_sq = tau * tau;

    let gaussian_var = variance - tau_sq;
    if gaussian_var <= 0.0 {
        return null;
    }

    let sigma = gaussian_var.sqrt();
    let mu = m - tau;

    if mu <= 0.0 {
        return null;
    }

    let tau_proportion = if m > 0.0 { Some(tau / m) } else { None };

    ExGaussianResult {
        tau: Some(tau),
        mu: Some(mu),
        sigma: Some(sigma),
        tau_proportion,
    }
}

// ─── Adjacent Hold-Time Covariance (neuroQWERTY, Giancardo 2016) ───

fn adjacent_hold_time_cov(stream: &[KeystrokeEvent]) -> Option<f64> {
    let mut hold_times = Vec::with_capacity(stream.len());
    for evt in stream {
        let ht = evt.u - evt.d;
        if ht > 0.0 && ht < 2000.0 {
            hold_times.push(ht);
        }
    }
    if hold_times.len() < 30 {
        return None;
    }

    let x = &hold_times[..hold_times.len() - 1];
    let y = &hold_times[1..];
    let n = x.len();

    let mx = mean(x);
    let my = mean(y);
    let sx = std_dev(x, Some(mx));
    let sy = std_dev(y, Some(my));

    if sx == 0.0 || sy == 0.0 {
        return None;
    }

    let cov: f64 = x.iter().zip(y.iter()).map(|(xi, yi)| (xi - mx) * (yi - my)).sum();

    Some(cov / (n as f64 * sx * sy))
}

// ─── Public API ────────────────────────────────────────────────────

pub fn compute(stream: &[KeystrokeEvent], total_duration_ms: f64) -> MotorSignals {
    let downs: Vec<f64> = stream.iter().map(|e| e.d).collect();
    let ikis = stats::extract_iki(&downs);

    // Extract flight times for ex-Gaussian fitting
    let mut flight_times = Vec::with_capacity(stream.len());
    for i in 1..stream.len() {
        let ft = stream[i].d - stream[i - 1].u;
        if ft > 0.0 && ft < 5000.0 {
            flight_times.push(ft);
        }
    }
    let exg = ex_gaussian_fit(&flight_times);

    MotorSignals {
        sample_entropy: sample_entropy(&ikis, 2, 0.2),
        iki_autocorrelation: iki_autocorrelation(&ikis, 5),
        motor_jerk: motor_jerk(&ikis),
        lapse_rate: lapse_rate(&ikis, total_duration_ms),
        tempo_drift: tempo_drift(&ikis),
        iki_compression_ratio: iki_compression_ratio(&ikis),
        digraph_latency_profile: digraph_latency_profile(stream),
        ex_gaussian_tau: exg.tau,
        ex_gaussian_mu: exg.mu,
        ex_gaussian_sigma: exg.sigma,
        tau_proportion: exg.tau_proportion,
        adjacent_hold_time_cov: adjacent_hold_time_cov(stream),
    }
}
