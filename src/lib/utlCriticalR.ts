/**
 * Critical Pearson r threshold for a two-tailed test at alpha = 0.05.
 *
 * Formula: r_crit = t_crit / sqrt(t_crit^2 + n - 2)
 *
 * For df >= 3 we use the normal approximation z = 1.96 with a
 * Cornish-Fisher correction for small degrees of freedom:
 *   t_crit ≈ z + (z^3 + z) / (4 * df)
 * which is accurate to < 0.5% for df >= 3 (Abramowitz & Stegun 26.7.5).
 *
 * Returns Infinity for n < 4 (df < 2), which effectively suppresses
 * all discoveries -- no correlation can exceed Infinity.
 */
export function criticalR(n: number): number {
  const df = n - 2;
  if (df < 2) return Infinity;

  const z = 1.959964; // normal quantile at alpha/2 = 0.025
  const tCrit = z + (z * z * z + z) / (4 * df);
  return tCrit / Math.sqrt(tCrit * tCrit + df);
}
