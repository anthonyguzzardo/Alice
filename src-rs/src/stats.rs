//! Shared statistical helpers.

/// Arithmetic mean. Returns 0.0 for empty slices.
#[inline]
pub(crate) fn mean(arr: &[f64]) -> f64 {
    if arr.is_empty() {
        return 0.0;
    }
    arr.iter().sum::<f64>() / arr.len() as f64
}

/// Population standard deviation. Returns 0.0 for empty slices.
#[inline]
pub(crate) fn std_dev(arr: &[f64], mu: Option<f64>) -> f64 {
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
pub(crate) fn extract_iki(downs: &[f64]) -> Vec<f64> {
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
pub(crate) fn linreg_slope(x: &[f64], y: &[f64]) -> Option<f64> {
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

/// Digamma (psi) function. Used by KSG transfer entropy estimator.
/// Asymptotic expansion with recurrence for small arguments.
#[inline]
pub(crate) fn digamma(mut x: f64) -> f64 {
    let mut result = 0.0;
    // Shift x up to >= 6 for accurate asymptotic expansion
    while x < 6.0 {
        result -= 1.0 / x;
        x += 1.0;
    }
    // Abramowitz & Stegun 6.3.18
    result += x.ln() - 0.5 / x;
    let inv_x2 = 1.0 / (x * x);
    result -= inv_x2 * (1.0 / 12.0 - inv_x2 * (1.0 / 120.0 - inv_x2 / 252.0));
    result
}

/// Complementary error function erfc(x) = 1 - erf(x).
/// Abramowitz & Stegun 7.1.26 rational approximation (|ε| < 1.5×10⁻⁷).
#[inline]
pub(crate) fn erfc(x: f64) -> f64 {
    let t = 1.0 / 0.3275911f64.mul_add(x.abs(), 1.0);
    let poly = t * (0.254829592f64
        + t * (-0.284496736f64
            + t * (1.421413741f64 + t * (-1.453152027f64 + t * 1.061405429f64))));
    let val = poly * (-x * x).exp();
    if x >= 0.0 {
        val
    } else {
        2.0 - val
    }
}

/// Normalize a series to zero mean, unit variance.
/// Returns the original values if variance is zero.
#[inline]
pub(crate) fn normalize(arr: &[f64]) -> Vec<f64> {
    let mu = mean(arr);
    let sd = std_dev(arr, Some(mu));
    if sd < 1e-12 {
        return arr.to_vec();
    }
    arr.iter().map(|&v| (v - mu) / sd).collect()
}

/// Signed Pearson correlation coefficient.
/// Returns 0.0 for series shorter than 3 or with zero variance.
#[inline]
pub(crate) fn pearson(a: &[f64], b: &[f64]) -> f64 {
    let n = a.len().min(b.len());
    if n < 3 {
        return 0.0;
    }
    let ma = mean(&a[..n]);
    let mb = mean(&b[..n]);
    let mut num = 0.0;
    let mut da = 0.0;
    let mut db = 0.0;
    for i in 0..n {
        let ai = a[i] - ma;
        let bi = b[i] - mb;
        num = ai.mul_add(bi, num);
        da = ai.mul_add(ai, da);
        db = bi.mul_add(bi, db);
    }
    let denom = (da * db).sqrt();
    if denom < 1e-10 {
        0.0
    } else {
        num / denom
    }
}

/// Compute z-scores given session values, profile means, and profile stds.
/// Returns (z_scores, l2_distance). Skips dimensions where std <= 0.
pub(crate) fn z_scores_and_distance(
    values: &[f64],
    means: &[f64],
    stds: &[f64],
) -> (Vec<f64>, f64) {
    let n = values.len().min(means.len()).min(stds.len());
    let mut z_scores = Vec::with_capacity(n);
    let mut sum_sq = 0.0;
    for i in 0..n {
        if stds[i] > 0.0 {
            let z = (values[i] - means[i]) / stds[i];
            z_scores.push(z);
            sum_sq = z.mul_add(z, sum_sq);
        }
    }
    let distance = sum_sq.sqrt();
    (z_scores, distance)
}

/// Compute best lagged Pearson correlation (emotion leads behavior).
/// Tests lags 0..=max_lag. Returns (best_corr, best_lag) or None if
/// insufficient data.
pub(crate) fn best_lagged_correlation(
    a: &[f64],
    b: &[f64],
    max_lag: usize,
) -> Option<(f64, usize)> {
    let n = a.len().min(b.len());
    if n < max_lag * 2 + 3 {
        return None;
    }
    let mut best_corr: f64 = 0.0;
    let mut best_lag = 0;
    for lag in 0..=max_lag {
        let end = n - lag;
        let r = pearson(&a[..end], &b[lag..lag + end]);
        if r.abs() > best_corr.abs() {
            best_corr = r;
            best_lag = lag;
        }
    }
    Some((best_corr, best_lag))
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
    fn erfc_known_values() {
        // erfc(0) = 1.0
        assert!((erfc(0.0) - 1.0).abs() < 1e-6);
        // erfc(∞) → 0
        assert!(erfc(5.0) < 1e-10);
        // erfc(-∞) → 2
        assert!((erfc(-5.0) - 2.0).abs() < 1e-10);
        // erfc(1) ≈ 0.1572992
        assert!((erfc(1.0) - 0.1572992).abs() < 1e-5);
    }

    #[test]
    fn extract_iki_filters_outliers() {
        let downs = vec![0.0, 100.0, 200.0, 10000.0, 10100.0];
        let ikis = extract_iki(&downs);
        // 100 ok, 100 ok, 9800 rejected, 100 ok
        assert_eq!(ikis.len(), 3);
        assert!((ikis[0] - 100.0).abs() < 1e-10);
    }

    #[test]
    fn digamma_known_values() {
        // ψ(1) = -γ (Euler-Mascheroni constant)
        let euler_mascheroni = 0.5772156649015329;
        assert!(
            (digamma(1.0) - (-euler_mascheroni)).abs() < 1e-8,
            "ψ(1) should be -γ, got {}",
            digamma(1.0)
        );
        // ψ(2) = 1 - γ
        assert!(
            (digamma(2.0) - (1.0 - euler_mascheroni)).abs() < 1e-8,
            "ψ(2) should be 1-γ, got {}",
            digamma(2.0)
        );
        // ψ(0.5) = -γ - 2*ln(2) ≈ -1.9635100260214235
        let expected_half = -euler_mascheroni - 2.0 * 2.0_f64.ln();
        assert!(
            (digamma(0.5) - expected_half).abs() < 1e-6,
            "ψ(0.5) should be -γ-2ln2, got {}",
            digamma(0.5)
        );
    }

    #[test]
    fn digamma_large_argument() {
        // For large x: ψ(x) ≈ ln(x) - 1/(2x)
        // ψ(100) ≈ 4.60016 (known to high precision: 4.600161852738087)
        let expected = 4.600161852738087;
        assert!(
            (digamma(100.0) - expected).abs() < 1e-6,
            "ψ(100) should be ~4.6002, got {}",
            digamma(100.0)
        );
    }

    #[test]
    fn normalize_zero_mean_unit_variance() {
        let data = vec![2.0, 4.0, 6.0, 8.0, 10.0];
        let normed = normalize(&data);

        // Mean should be ~0
        let m = mean(&normed);
        assert!(m.abs() < 1e-10, "normalized mean should be 0, got {m}");

        // Std should be ~1
        let sd = std_dev(&normed, None);
        assert!((sd - 1.0).abs() < 1e-10, "normalized std should be 1, got {sd}");
    }

    #[test]
    fn normalize_constant_returns_original() {
        let data = vec![5.0, 5.0, 5.0];
        let normed = normalize(&data);
        // Zero variance: returns original values unchanged
        assert_eq!(normed, data);
    }

    #[test]
    fn normalize_preserves_relative_order() {
        let data = vec![10.0, 20.0, 30.0, 40.0];
        let normed = normalize(&data);
        for i in 1..normed.len() {
            assert!(normed[i] > normed[i - 1], "normalization should preserve order");
        }
    }

    #[test]
    fn pearson_perfect_positive() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let b = vec![2.0, 4.0, 6.0, 8.0, 10.0];
        let r = pearson(&a, &b);
        assert!((r - 1.0).abs() < 1e-10, "perfect positive correlation, got {r}");
    }

    #[test]
    fn pearson_perfect_negative() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let b = vec![10.0, 8.0, 6.0, 4.0, 2.0];
        let r = pearson(&a, &b);
        assert!((r - (-1.0)).abs() < 1e-10, "perfect negative correlation, got {r}");
    }

    #[test]
    fn pearson_uncorrelated() {
        let a = vec![1.0, 0.0, -1.0, 0.0];
        let b = vec![0.0, 1.0, 0.0, -1.0];
        let r = pearson(&a, &b);
        assert!(r.abs() < 1e-10, "orthogonal series should have r=0, got {r}");
    }

    #[test]
    fn pearson_insufficient_data() {
        assert_eq!(pearson(&[1.0, 2.0], &[3.0, 4.0]), 0.0);
    }

    #[test]
    fn z_scores_basic() {
        let values = vec![12.0, 25.0];
        let means = vec![10.0, 20.0];
        let stds = vec![2.0, 5.0];
        let (z, dist) = z_scores_and_distance(&values, &means, &stds);
        assert_eq!(z.len(), 2);
        assert!((z[0] - 1.0).abs() < 1e-10, "z[0] should be 1.0, got {}", z[0]);
        assert!((z[1] - 1.0).abs() < 1e-10, "z[1] should be 1.0, got {}", z[1]);
        assert!((dist - 2.0_f64.sqrt()).abs() < 1e-10, "distance should be sqrt(2), got {dist}");
    }

    #[test]
    fn z_scores_skips_zero_std() {
        let values = vec![5.0, 10.0];
        let means = vec![5.0, 8.0];
        let stds = vec![0.0, 2.0]; // first dim has zero std, should be skipped
        let (z, dist) = z_scores_and_distance(&values, &means, &stds);
        assert_eq!(z.len(), 1);
        assert!((z[0] - 1.0).abs() < 1e-10);
        assert!((dist - 1.0).abs() < 1e-10);
    }

    #[test]
    fn best_lagged_correlation_concurrent() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
        let b = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
        let (corr, lag) = best_lagged_correlation(&a, &b, 3).unwrap();
        assert!((corr - 1.0).abs() < 1e-10, "same series should correlate at 1.0");
        assert_eq!(lag, 0, "same series should have lag 0");
    }

    #[test]
    fn best_lagged_correlation_insufficient() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![1.0, 2.0, 3.0];
        assert!(best_lagged_correlation(&a, &b, 3).is_none());
    }
}
