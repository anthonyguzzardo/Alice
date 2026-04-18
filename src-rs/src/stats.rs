//! Shared statistical helpers.

pub fn mean(arr: &[f64]) -> f64 {
    if arr.is_empty() {
        return 0.0;
    }
    arr.iter().sum::<f64>() / arr.len() as f64
}

pub fn std_dev(arr: &[f64], mu: Option<f64>) -> f64 {
    if arr.is_empty() {
        return 0.0;
    }
    let m = mu.unwrap_or_else(|| mean(arr));
    let variance = arr.iter().map(|v| (v - m).powi(2)).sum::<f64>() / arr.len() as f64;
    variance.sqrt()
}

/// Extract inter-key intervals from keystroke stream.
/// Filters to 0 < gap < 5000 ms.
pub fn extract_iki(downs: &[f64]) -> Vec<f64> {
    let mut ikis = Vec::with_capacity(downs.len().saturating_sub(1));
    for i in 1..downs.len() {
        let gap = downs[i] - downs[i - 1];
        if gap > 0.0 && gap < 5000.0 {
            ikis.push(gap);
        }
    }
    ikis
}

/// Linear regression slope.
pub fn linreg_slope(x: &[f64], y: &[f64]) -> Option<f64> {
    let n = x.len().min(y.len());
    if n < 2 {
        return None;
    }

    let mut sx = 0.0;
    let mut sy = 0.0;
    let mut sxx = 0.0;
    let mut sxy = 0.0;

    for i in 0..n {
        sx += x[i];
        sy += y[i];
        sxx += x[i] * x[i];
        sxy += x[i] * y[i];
    }

    let nf = n as f64;
    let denom = nf * sxx - sx * sx;
    if denom.abs() < 1e-10 {
        return None;
    }

    Some((nf * sxy - sx * sy) / denom)
}
