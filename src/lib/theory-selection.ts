/**
 * Programmatic Theory Selection
 *
 * Replaces prompt-based theory distribution guidance with deterministic
 * algorithms. The LLM generates predictions for pre-selected theories;
 * it no longer decides which theories to test.
 *
 * Three mechanisms:
 *   1. Thompson Sampling — exploration/exploitation via posterior sampling
 *   2. Bayes Factor Lifecycle — principled pruning/graduation thresholds
 *   3. Expected Information Gain — entropy-based selection ranking
 *
 * Research basis:
 *   - Thompson (1933): Posterior sampling for multi-armed bandits
 *   - Agrawal & Goyal (Columbia, COLT 2012): Logarithmic regret proof
 *   - Kass & Raftery (CMU/UW, JASA 1995): Bayes factor thresholds
 *   - Lindley (UCL, 1956): Expected information gain as design criterion
 *   - Sharma & Perez (Anthropic, ICLR 2024): Sycophancy makes prompt-based
 *     distribution guidance unreliable — programmatic control required
 */

// ─── Types ─────────────────────────────────────────────────────────────

export type TheoryStatus = 'active' | 'established' | 'retired';

export interface TheoryWithConfidence {
  theoryKey: string;
  description: string;
  alpha: number;
  beta: number;
  totalPredictions: number;
  posteriorMean: number;
  logBayesFactor: number;
  status: TheoryStatus;
}

// ─── Seeded PRNG ───────────────────────────────────────────────────────

/**
 * xorshift128+ — fast, seedable, good statistical properties.
 * Used to make Thompson sampling deterministic in simulation mode.
 */
function createRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;

  let s0 = seed >>> 0 || 1;
  let s1 = (seed * 2654435761) >>> 0 || 1;

  return () => {
    let a = s0;
    const b = s1;
    s0 = b;
    a ^= a << 23;
    a ^= a >>> 17;
    a ^= b;
    a ^= b >>> 26;
    s1 = a;
    return ((s0 + s1) >>> 0) / 4294967296;
  };
}

// ─── Gamma / Beta Samplers ─────────────────────────────────────────────

/**
 * Sample from Gamma(alpha, 1) using Marsaglia-Tsang method.
 * Requires alpha >= 1 (always true — our priors start at 1.0 and only increment).
 */
function sampleGamma(alpha: number, rng: () => number): number {
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (;;) {
    let x: number;
    let v: number;

    // Generate normal via Box-Muller
    do {
      const u1 = rng();
      const u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = rng();

    // Squeeze test
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Sample from Beta(alpha, beta) via ratio of Gamma variates.
 */
function sampleBeta(alpha: number, beta: number, rng: () => number): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  return x / (x + y);
}

// ─── Thompson Sampling ─────────────────────────────────────────────────

/**
 * Select top-k theories via Thompson sampling.
 *
 * For each theory, draws a sample from its Beta(alpha, beta) posterior.
 * Returns the k theories with the highest sampled values — these are
 * the theories where exploration is most valuable.
 *
 * Provably optimal exploration-exploitation tradeoff (Agrawal & Goyal 2012).
 */
export function thompsonSample(
  theories: TheoryWithConfidence[],
  k: number = 3,
  seed?: number,
): TheoryWithConfidence[] {
  if (theories.length === 0) return [];
  const effectiveK = Math.min(k, theories.length);
  const rng = createRng(seed);

  const sampled = theories.map(t => ({
    theory: t,
    sample: sampleBeta(t.alpha, t.beta, rng),
  }));

  sampled.sort((a, b) => b.sample - a.sample);
  return sampled.slice(0, effectiveK).map(s => s.theory);
}

// ─── Bayes Factor Lifecycle ────────────────────────────────────────────

/** Thresholds from Kass & Raftery (1995), Jeffreys scale */
const LOG_BF_ESTABLISHED = Math.log(10);   // ~2.302, BF > 10
const LOG_BF_RETIRED = -Math.log(10);      // ~-2.302, BF < 1/10
const MIN_PREDICTIONS_FOR_RETIREMENT = 3;

/**
 * Compute the incremental log Bayes factor update for a single observation.
 *
 * Uses alpha/beta BEFORE the increment. The update is the log ratio of
 * the predictive probability under the theory vs a null (coin-flip) model:
 *   hit:  log(alpha / (alpha + beta)) - log(0.5)
 *   miss: log(beta / (alpha + beta)) - log(0.5)
 */
export function computeLogBayesFactorUpdate(
  alpha: number,
  beta: number,
  hit: boolean,
): number {
  const total = alpha + beta;
  const predictiveProb = hit ? alpha / total : beta / total;
  return Math.log(predictiveProb) - Math.log(0.5);
}

/**
 * Classify a theory's lifecycle status based on cumulative Bayes factor.
 *
 * - 'retired':     BF < 1/10 AND at least MIN_PREDICTIONS_FOR_RETIREMENT grades
 * - 'established': BF > 10
 * - 'active':      everything in between
 */
export function classifyStatus(
  logBayesFactor: number,
  totalPredictions: number,
): TheoryStatus {
  if (logBayesFactor >= LOG_BF_ESTABLISHED) return 'established';
  if (logBayesFactor <= LOG_BF_RETIRED && totalPredictions >= MIN_PREDICTIONS_FOR_RETIREMENT) return 'retired';
  return 'active';
}

// ─── Expected Information Gain ─────────────────────────────────────────

/**
 * Binary entropy H(p) = -p*log(p) - (1-p)*log(1-p).
 * Maximum at p=0.5 (most uncertain), zero at p=0 or p=1 (settled).
 * Used for logging/debugging — Thompson sampling handles selection.
 */
export function computeEIG(alpha: number, beta: number): number {
  const p = alpha / (alpha + beta);
  if (p <= 0 || p >= 1) return 0;
  return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}

// ─── Prompt Formatting ─────────────────────────────────────────────────

/**
 * Format the selected theories for injection into the predict prompt.
 *
 * Key differences from the old full-table injection:
 *   - No posterior values shown (removes anchoring signal)
 *   - No distribution guidelines (Thompson sampling handles it)
 *   - Framing: "assigned theories" not "existing theories to choose from"
 *   - Escape hatch for novel theories preserved but de-emphasized
 */
export function formatSelectedTheories(theories: TheoryWithConfidence[]): string {
  if (theories.length === 0) return '';

  const rows = theories
    .map(t => `| ${t.theoryKey} | ${t.description} |`)
    .join('\n');

  return `ASSIGNED THEORIES (generate predictions that test these):
| Theory | Description |
|--------|-------------|
${rows}

If today's data reveals a pattern not covered by any assigned theory, you may create a prediction for a new theory.

---

`;
}
