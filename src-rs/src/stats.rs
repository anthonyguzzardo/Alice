//! Shared statistical helpers.

/// Arithmetic mean. Returns 0.0 for empty slices.
#[inline]
pub fn mean(arr: &[f64]) -> f64 {
    if arr.is_empty() {
        return 0.0;
    }
    arr.iter().sum::<f64>() / arr.len() as f64
}

/// Population standard deviation. Returns 0.0 for empty slices.
#[inline]
pub fn std_dev(arr: &[f64], mu: Option<f64>) -> f64 {
    if arr.is_empty() {
        return 0.0;
    }
    let m = mu.unwrap_or_else(|| mean(arr));
    let variance = arr.iter().map(|v| (v - m).powi(2)).sum::<f64>() / arr.len() as f64;
    variance.sqrt()
}

/// Extract inter-key intervals from keystroke down-times.
/// Filters to 0 < gap < 5000 ms.
#[inline]
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

/// Ordinary least-squares slope.
#[inline]
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
    // Denominator of OLS slope: n*Sxx - (Sx)^2
    #[allow(clippy::suspicious_operation_groupings)]
    let denom = nf.mul_add(sxx, -(sx * sx));
    if denom.abs() < 1e-10 {
        return None;
    }

    #[allow(clippy::suspicious_operation_groupings)]
    Some(nf.mul_add(sxy, -(sx * sy)) / denom)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mean_empty() {
        assert_eq!(mean(&[]), 0.0);
    }

    #[test]
    fn mean_single() {
        assert!((mean(&[42.0]) - 42.0).abs() < 1e-10);
    }

    #[test]
    fn mean_symmetric() {
        assert!((mean(&[1.0, 2.0, 3.0]) - 2.0).abs() < 1e-10);
    }

    #[test]
    fn std_dev_constant() {
        assert!(std_dev(&[5.0, 5.0, 5.0], None).abs() < 1e-10);
    }

    #[test]
    fn std_dev_known() {
        // Population std of [1,2,3] = sqrt(2/3)
        let sd = std_dev(&[1.0, 2.0, 3.0], None);
        assert!((sd - (2.0_f64 / 3.0).sqrt()).abs() < 1e-10);
    }

    #[test]
    fn linreg_perfect_line() {
        let x = vec![0.0, 1.0, 2.0, 3.0];
        let y = vec![1.0, 3.0, 5.0, 7.0]; // y = 2x + 1
        let slope = linreg_slope(&x, &y).unwrap();
        assert!((slope - 2.0).abs() < 1e-10);
    }

    #[test]
    fn linreg_insufficient() {
        assert!(linreg_slope(&[1.0], &[2.0]).is_none());
    }

    #[test]
    fn extract_iki_filters_outliers() {
        let downs = vec![0.0, 100.0, 200.0, 10000.0, 10100.0];
        let ikis = extract_iki(&downs);
        // 100 ok, 100 ok, 9800 rejected, 100 ok
        assert_eq!(ikis.len(), 3);
        assert!((ikis[0] - 100.0).abs() < 1e-10);
    }
}
