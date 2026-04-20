//! Motor Signal Computation
//!
//! Motor and rhythmic features from raw keystroke streams.
//! Sample entropy, autocorrelation, jerk, lapse rate, tempo drift,
//! IKI compression, digraph latency, ex-Gaussian fit, adjacent hold-time covariance.

use std::cmp::Reverse;
use std::collections::HashMap;
use std::io::Write;

use flate2::write::GzEncoder;
use flate2::Compression;

use crate::stats::{mean, std_dev};
use crate::types::{FlightTimes, IkiSeries, KeystrokeEvent, SignalError, SignalResult};

// ─── Result types ─────────────────────────────────────────────────

pub struct ExGaussianValues {
    pub tau: f64,
    pub mu: f64,
    pub sigma: f64,
    pub tau_proportion: f64,
}

pub struct MotorResult {
    pub sample_entropy: Option<f64>,
    pub iki_autocorrelation: Option<Vec<f64>>,
    pub motor_jerk: Option<f64>,
    pub lapse_rate: Option<f64>,
    pub tempo_drift: Option<f64>,
    pub iki_compression_ratio: Option<f64>,
    pub digraph_latency_profile: Option<String>,
    pub ex_gaussian: Option<ExGaussianValues>,
    pub adjacent_hold_time_cov: Option<f64>,
}

// ─── Sample Entropy helpers ───────────────────────────────────────

/// Count pairs of subsequences of `template_len` that match within tolerance `r`.
fn count_template_matches(data: &[f64], template_len: usize, r: f64) -> u64 {
    let n = data.len();
    let mut count: u64 = 0;
    for i in 0..(n - template_len) {
        for j in (i + 1)..(n - template_len) {
            let matched = (0..template_len).all(|k| (data[i + k] - data[j + k]).abs() <= r);
            if matched {
                count += 1;
            }
        }
    }
    count
}

// ─── Sample Entropy (Richman & Moorman 2000) ──────────────────────

#[allow(clippy::many_single_char_names)] // m, n, s, r, a, b are standard notation
fn sample_entropy(series: &[f64], m: usize, r_factor: f64) -> SignalResult<f64> {
    let n = series.len();
    if n < 30 {
        return Err(SignalError::InsufficientData { needed: 30, got: n });
    }

    let s = std_dev(series, None);
    let r = r_factor * s;
    if r <= 0.0 {
        return Err(SignalError::ZeroVariance { len: n });
    }

    // Cap at 500 points for O(n^2*m) feasibility
    let data = if n > 500 { &series[n - 500..] } else { series };

    let b = count_template_matches(data, m, r);
    let a = count_template_matches(data, m + 1, r);

    if b == 0 {
        return Err(SignalError::DegenerateValue(
            "zero template matches at length m",
        ));
    }

    Ok(-(a as f64 / b as f64).ln())
}

// ─── IKI Autocorrelation ──────────────────────────────────────────

fn iki_autocorrelation(ikis: &[f64], max_lag: usize) -> SignalResult<Vec<f64>> {
    let n = ikis.len();
    if n < max_lag + 10 {
        return Err(SignalError::InsufficientData {
            needed: max_lag + 10,
            got: n,
        });
    }

    let mu = mean(ikis);
    let variance = ikis.iter().map(|v| (v - mu).powi(2)).sum::<f64>() / n as f64;
    if variance == 0.0 {
        return Err(SignalError::ZeroVariance { len: n });
    }

    let mut result = Vec::with_capacity(max_lag);
    for lag in 1..=max_lag {
        let mut sum = 0.0;
        for i in 0..(n - lag) {
            sum += (ikis[i] - mu) * (ikis[i + lag] - mu);
        }
        result.push(sum / ((n - lag) as f64 * variance));
    }
    Ok(result)
}

// ─── Motor Jerk ───────────────────────────────────────────────────

fn motor_jerk(ikis: &[f64]) -> SignalResult<f64> {
    if ikis.len() < 10 {
        return Err(SignalError::InsufficientData {
            needed: 10,
            got: ikis.len(),
        });
    }

    let jerks: Vec<f64> = (2..ikis.len())
        .map(|i| {
            let accel1 = ikis[i] - ikis[i - 1];
            let accel0 = ikis[i - 1] - ikis[i - 2];
            (accel1 - accel0).abs()
        })
        .collect();

    Ok(mean(&jerks))
}

// ─── Lapse Rate (Haag et al. 2020) ───────────────────────────────

fn lapse_rate(ikis: &[f64], total_duration_ms: f64) -> SignalResult<f64> {
    if ikis.len() < 20 {
        return Err(SignalError::InsufficientData {
            needed: 20,
            got: ikis.len(),
        });
    }

    let mu = mean(ikis);
    let s = std_dev(ikis, Some(mu));
    let threshold = 3.0f64.mul_add(s, mu);

    let lapse_count = ikis.iter().filter(|&&v| v > threshold).count();
    let minutes = total_duration_ms / 60000.0;

    if minutes > 0.0 {
        Ok(lapse_count as f64 / minutes)
    } else {
        Err(SignalError::DegenerateValue("zero duration"))
    }
}

// ─── Tempo Drift ──────────────────────────────────────────────────

fn tempo_drift(ikis: &[f64]) -> SignalResult<f64> {
    if ikis.len() < 20 {
        return Err(SignalError::InsufficientData {
            needed: 20,
            got: ikis.len(),
        });
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
    for (i, &qm) in quartile_means.iter().enumerate() {
        let xi = i as f64;
        num += (xi - x_mean) * (qm - y_mean);
        den += (xi - x_mean).powi(2);
    }

    if den > 0.0 {
        Ok(num / den)
    } else {
        Err(SignalError::DegenerateValue(
            "zero denominator in tempo regression",
        ))
    }
}

// ─── IKI Compression Ratio ───────────────────────────────────────

fn iki_compression_ratio(ikis: &[f64]) -> SignalResult<f64> {
    if ikis.len() < 10 {
        return Err(SignalError::InsufficientData {
            needed: 10,
            got: ikis.len(),
        });
    }

    let raw: String = ikis
        .iter()
        .map(|v| v.round().to_string())
        .collect::<Vec<_>>()
        .join(",");
    let raw_bytes = raw.as_bytes();

    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(raw_bytes)
        .map_err(|_| SignalError::DegenerateValue("gzip write failed"))?;
    let compressed = encoder
        .finish()
        .map_err(|_| SignalError::DegenerateValue("gzip finish failed"))?;

    Ok(compressed.len() as f64 / raw_bytes.len() as f64)
}

// ─── Digraph Latency Profile ─────────────────────────────────────

fn digraph_latency_profile(stream: &[KeystrokeEvent]) -> Option<String> {
    if stream.len() < 20 {
        return None;
    }

    let mut digraphs: HashMap<String, Vec<f64>> = HashMap::new();

    for i in 1..stream.len() {
        let ft = stream[i].key_down_ms - stream[i - 1].key_up_ms;
        if ft > 0.0 && ft < 5000.0 {
            let key = format!("{}>{}", stream[i - 1].character, stream[i].character);
            digraphs.entry(key).or_default().push(ft);
        }
    }

    let mut sorted: Vec<(String, Vec<f64>)> = digraphs
        .into_iter()
        .filter(|(_, v)| v.len() >= 2)
        .collect();
    sorted.sort_by_key(|item| Reverse(item.1.len()));
    sorted.truncate(10);

    if sorted.is_empty() {
        return None;
    }

    let profile: HashMap<String, f64> = sorted
        .iter()
        .map(|(key, values)| (key.clone(), mean(values)))
        .collect();

    serde_json::to_string(&profile).ok()
}

// ─── Ex-Gaussian Fit (BiAffect / Zulueta 2018) ───────────────────

fn ex_gaussian_fit(flight_times: &[f64]) -> SignalResult<ExGaussianValues> {
    if flight_times.len() < 50 {
        return Err(SignalError::InsufficientData {
            needed: 50,
            got: flight_times.len(),
        });
    }

    // Remove extreme outliers: cap at Q3 + 3*IQR
    let mut sorted = flight_times.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let q1 = sorted[sorted.len() / 4];
    let q3 = sorted[3 * sorted.len() / 4];
    let iqr = q3 - q1;
    let cap = 3.0f64.mul_add(iqr, q3);

    let filtered: Vec<f64> = flight_times.iter().filter(|&&v| v <= cap).copied().collect();
    if filtered.len() < 50 {
        return Err(SignalError::InsufficientData {
            needed: 50,
            got: filtered.len(),
        });
    }

    let m = mean(&filtered);
    let s = std_dev(&filtered, Some(m));
    if s <= 0.0 {
        return Err(SignalError::ZeroVariance {
            len: filtered.len(),
        });
    }

    // Skewness (third standardized moment)
    let n = filtered.len() as f64;
    let m3: f64 = filtered.iter().map(|v| ((v - m) / s).powi(3)).sum::<f64>() / n;

    if m3 <= 0.0 {
        return Err(SignalError::DegenerateValue("non-positive skewness"));
    }

    // Method of moments: tau = std * (skewness/2)^(1/3)
    let tau = s * (m3 / 2.0).cbrt();
    let variance = s * s;
    let tau_sq = tau * tau;

    let gaussian_var = variance - tau_sq;
    if gaussian_var <= 0.0 {
        return Err(SignalError::DegenerateValue("negative gaussian variance"));
    }

    let sigma = gaussian_var.sqrt();
    let mu = m - tau;

    if mu <= 0.0 {
        return Err(SignalError::DegenerateValue("non-positive mu"));
    }

    // m > 0 guaranteed (flight times are positive after filtering)
    let tau_proportion = tau / m;

    Ok(ExGaussianValues {
        tau,
        mu,
        sigma,
        tau_proportion,
    })
}

// ─── Adjacent Hold-Time Covariance (neuroQWERTY, Giancardo 2016) ──

fn adjacent_hold_time_cov(stream: &[KeystrokeEvent]) -> SignalResult<f64> {
    let mut hold_times = Vec::with_capacity(stream.len());
    for evt in stream {
        let ht = evt.key_up_ms - evt.key_down_ms;
        if ht > 0.0 && ht < 2000.0 {
            hold_times.push(ht);
        }
    }
    if hold_times.len() < 30 {
        return Err(SignalError::InsufficientData {
            needed: 30,
            got: hold_times.len(),
        });
    }

    let x = &hold_times[..hold_times.len() - 1];
    let y = &hold_times[1..];
    let n = x.len();

    let mx = mean(x);
    let my = mean(y);
    let sx = std_dev(x, Some(mx));
    let sy = std_dev(y, Some(my));

    if sx == 0.0 || sy == 0.0 {
        return Err(SignalError::ZeroVariance { len: n });
    }

    let cov: f64 = x
        .iter()
        .zip(y.iter())
        .map(|(xi, yi)| (xi - mx) * (yi - my))
        .sum();

    Ok(cov / (n as f64 * sx * sy))
}

// ─── Public API ───────────────────────────────────────────────────

pub fn compute(stream: &[KeystrokeEvent], total_duration_ms: f64) -> MotorResult {
    let ikis = IkiSeries::from_stream(stream);
    let flights = FlightTimes::from_stream(stream);

    MotorResult {
        sample_entropy: sample_entropy(&ikis, 2, 0.2).ok(),
        iki_autocorrelation: iki_autocorrelation(&ikis, 5).ok(),
        motor_jerk: motor_jerk(&ikis).ok(),
        lapse_rate: lapse_rate(&ikis, total_duration_ms).ok(),
        tempo_drift: tempo_drift(&ikis).ok(),
        iki_compression_ratio: iki_compression_ratio(&ikis).ok(),
        digraph_latency_profile: digraph_latency_profile(stream),
        ex_gaussian: ex_gaussian_fit(&flights).ok(),
        adjacent_hold_time_cov: adjacent_hold_time_cov(stream).ok(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sample_entropy_constant_fails() {
        let constant = vec![100.0; 50];
        assert!(matches!(
            sample_entropy(&constant, 2, 0.2),
            Err(SignalError::ZeroVariance { .. })
        ));
    }

    #[test]
    fn sample_entropy_non_negative() {
        let data: Vec<f64> = (0..100)
            .map(|i| ((i as f64) * 0.5).sin() * 50.0 + 100.0)
            .collect();
        let se = sample_entropy(&data, 2, 0.2).unwrap();
        assert!(se >= 0.0, "Sample entropy should be non-negative, got {se}");
    }

    #[test]
    fn motor_jerk_insufficient_data() {
        let short = vec![1.0; 5];
        assert!(matches!(
            motor_jerk(&short),
            Err(SignalError::InsufficientData { .. })
        ));
    }

    #[test]
    fn compression_ratio_reasonable() {
        let data: Vec<f64> = (0..50).map(|i| (i as f64) * 10.0).collect();
        let ratio = iki_compression_ratio(&data).unwrap();
        assert!(
            ratio > 0.0 && ratio < 2.0,
            "Compression ratio should be reasonable, got {ratio}"
        );
    }

    #[test]
    fn tempo_drift_constant_is_zero() {
        let constant = vec![100.0; 40];
        let drift = tempo_drift(&constant).unwrap();
        assert!(
            drift.abs() < 1e-10,
            "Tempo drift of constant should be 0, got {drift}"
        );
    }

    #[test]
    fn autocorrelation_length() {
        let data: Vec<f64> = (0..50).map(|i| ((i as f64) * 0.3).sin() * 100.0).collect();
        let acf = iki_autocorrelation(&data, 5).unwrap();
        assert_eq!(acf.len(), 5);
    }

    #[test]
    fn lapse_rate_no_lapses() {
        // Constant series: no value exceeds mu + 3*std (std = 0)
        // Zero variance -> error
        let constant = vec![100.0; 30];
        assert!(lapse_rate(&constant, 60000.0).is_ok());
        let rate = lapse_rate(&constant, 60000.0).unwrap();
        assert!(
            rate.abs() < 1e-10,
            "Lapse rate of constant should be 0, got {rate}"
        );
    }
}
