/**
 * Dynamical Signal Computation
 *
 * Computes advanced nonlinear signals from raw keystroke streams.
 * These treat the IKI (inter-key interval) series as the output of
 * a complex adaptive system rather than a bag of statistics.
 *
 * Signals:
 *   permutationEntropy  — Bandt & Pompe 2002: ordinal pattern distribution
 *   dfaAlpha            — Peng et al. 1994: fractal scaling exponent (1/f structure)
 *   rqaDeterminism      — Webber & Zbilut 2005: trajectory predictability
 *   rqaLaminarity       — Webber & Zbilut 2005: cognitive fixation
 *   rqaTrappingTime     — Webber & Zbilut 2005: absorption duration
 *   transferEntropy     — Schreiber 2000: causal coupling hold↔flight
 *
 * All signals work on series as short as 50–100 points.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface KeystrokeEvent {
  c: string;   // key code
  d: number;   // keydown offset ms
  u: number;   // keyup offset ms
}

export interface DynamicalSignals {
  // Series lengths
  ikiCount: number;
  holdFlightCount: number;

  // Permutation entropy (Bandt & Pompe 2002)
  permutationEntropy: number | null;       // 0–1 normalized
  permutationEntropyRaw: number | null;    // bits

  // DFA (Peng et al. 1994)
  dfaAlpha: number | null;                 // fractal scaling exponent

  // RQA (Webber & Zbilut 2005)
  rqaDeterminism: number | null;           // 0–1
  rqaLaminarity: number | null;            // 0–1
  rqaTrappingTime: number | null;          // mean laminar state length
  rqaRecurrenceRate: number | null;        // 0–1

  // Transfer entropy (Schreiber 2000)
  teHoldToFlight: number | null;           // bits: motor → cognitive
  teFlightToHold: number | null;           // bits: cognitive → motor
  teDominance: number | null;              // ratio: which direction dominates
}

// ─── Helpers ────────────────────────────────────────────────────────

function extractIKI(stream: KeystrokeEvent[]): number[] {
  const ikis: number[] = [];
  for (let i = 1; i < stream.length; i++) {
    const gap = stream[i].d - stream[i - 1].d;
    if (gap > 0 && gap < 5000) ikis.push(gap);
  }
  return ikis;
}

function extractHoldFlight(stream: KeystrokeEvent[]): { holds: number[]; flights: number[] } {
  const holds: number[] = [];
  const flights: number[] = [];
  for (let i = 0; i < stream.length; i++) {
    const ht = stream[i].u - stream[i].d;
    if (ht > 0 && ht < 2000) holds.push(ht);
    if (i > 0) {
      const ft = stream[i].d - stream[i - 1].u;
      if (ft > 0 && ft < 5000) flights.push(ft);
    }
  }
  return { holds, flights };
}

// ─── Permutation Entropy (Bandt & Pompe 2002) ───────────────────────

function permutationEntropy(series: number[], order: number = 3): { normalized: number; raw: number } | null {
  if (series.length < order + 10) return null;

  // Count ordinal patterns
  const patternCounts = new Map<string, number>();
  const n = series.length - order + 1;

  for (let i = 0; i < n; i++) {
    const window = series.slice(i, i + order);
    // Rank the values: create index array sorted by value
    const indices = Array.from({ length: order }, (_, k) => k);
    indices.sort((a, b) => window[a] - window[b]);
    const pattern = indices.join(',');
    patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
  }

  // Shannon entropy of pattern distribution
  let entropy = 0;
  for (const count of patternCounts.values()) {
    const p = count / n;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  // Maximum possible entropy for this order: log2(order!)
  let factorial = 1;
  for (let i = 2; i <= order; i++) factorial *= i;
  const maxEntropy = Math.log2(factorial);

  return {
    normalized: maxEntropy > 0 ? entropy / maxEntropy : 0,
    raw: entropy,
  };
}

// ─── DFA — Detrended Fluctuation Analysis (Peng et al. 1994) ────────

function dfaAlpha(series: number[]): number | null {
  if (series.length < 50) return null;

  const N = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / N;

  // Cumulative sum (integration)
  const y = new Array(N);
  y[0] = series[0] - mean;
  for (let i = 1; i < N; i++) {
    y[i] = y[i - 1] + (series[i] - mean);
  }

  // Window sizes: logarithmically spaced from 4 to N/4
  const minBox = 4;
  const maxBox = Math.floor(N / 4);
  if (maxBox < minBox) return null;

  const logSizes: number[] = [];
  const logFluctuations: number[] = [];

  // Generate ~15 logarithmically spaced window sizes
  const numSizes = Math.min(15, maxBox - minBox + 1);
  for (let i = 0; i < numSizes; i++) {
    const boxSize = Math.round(minBox * Math.pow(maxBox / minBox, i / (numSizes - 1)));
    if (logSizes.length > 0 && boxSize === logSizes[logSizes.length - 1]) continue;

    const numBoxes = Math.floor(N / boxSize);
    if (numBoxes < 2) continue;

    let sumFluctuation = 0;
    for (let b = 0; b < numBoxes; b++) {
      const start = b * boxSize;
      // Linear detrend within box
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let j = 0; j < boxSize; j++) {
        sx += j;
        sy += y[start + j];
        sxx += j * j;
        sxy += j * y[start + j];
      }
      const denom = boxSize * sxx - sx * sx;
      const slope = denom !== 0 ? (boxSize * sxy - sx * sy) / denom : 0;
      const intercept = (sy - slope * sx) / boxSize;

      // RMS fluctuation
      let sumSq = 0;
      for (let j = 0; j < boxSize; j++) {
        const trend = intercept + slope * j;
        sumSq += (y[start + j] - trend) ** 2;
      }
      sumFluctuation += Math.sqrt(sumSq / boxSize);
    }
    const F = sumFluctuation / numBoxes;
    if (F > 0) {
      logSizes.push(Math.log(boxSize));
      logFluctuations.push(Math.log(F));
    }
  }

  if (logSizes.length < 4) return null;

  // Linear regression in log-log space → slope is alpha
  const n = logSizes.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += logSizes[i];
    sy += logFluctuations[i];
    sxx += logSizes[i] * logSizes[i];
    sxy += logSizes[i] * logFluctuations[i];
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-10) return null;

  return (n * sxy - sx * sy) / denom;
}

// ─── RQA — Recurrence Quantification Analysis ──────────────────────
// Simplified: uses fixed threshold (10% of std) and embedding dim=1

function rqa(series: number[], threshold?: number): {
  determinism: number;
  laminarity: number;
  trappingTime: number;
  recurrenceRate: number;
} | null {
  const N = series.length;
  if (N < 30) return null;

  // Compute threshold as percentage of standard deviation
  const mean = series.reduce((a, b) => a + b, 0) / N;
  const std = Math.sqrt(series.reduce((s, v) => s + (v - mean) ** 2, 0) / N);
  const eps = threshold ?? std * 0.2; // 20% of std
  if (eps <= 0) return null;

  // Build recurrence matrix (upper triangle) — cap at 500 points for performance
  const M = Math.min(N, 500);

  let totalRecurrences = 0;
  let diagonalPoints = 0;  // points on diagonal lines of length >= 2
  let verticalPoints = 0;  // points on vertical lines of length >= 2
  let totalVerticalLength = 0;
  let verticalLineCount = 0;

  // Diagonal line detection: scan each diagonal
  for (let k = 1; k < M; k++) {
    let lineLen = 0;
    for (let i = 0; i < M - k; i++) {
      const j = i + k;
      if (Math.abs(series[i] - series[j]) <= eps) {
        totalRecurrences++;
        lineLen++;
      } else {
        if (lineLen >= 2) diagonalPoints += lineLen;
        lineLen = 0;
      }
    }
    if (lineLen >= 2) diagonalPoints += lineLen;
  }

  // Vertical line detection: for each column
  for (let j = 0; j < M; j++) {
    let lineLen = 0;
    for (let i = 0; i < M; i++) {
      if (i === j) continue;
      if (Math.abs(series[i] - series[j]) <= eps) {
        lineLen++;
      } else {
        if (lineLen >= 2) {
          verticalPoints += lineLen;
          totalVerticalLength += lineLen;
          verticalLineCount++;
        }
        lineLen = 0;
      }
    }
    if (lineLen >= 2) {
      verticalPoints += lineLen;
      totalVerticalLength += lineLen;
      verticalLineCount++;
    }
  }

  const possiblePairs = M * (M - 1) / 2;
  const recurrenceRate = possiblePairs > 0 ? totalRecurrences / possiblePairs : 0;
  const determinism = totalRecurrences > 0 ? diagonalPoints / totalRecurrences : 0;
  const laminarity = totalRecurrences > 0 ? verticalPoints / (totalRecurrences * 2) : 0; // *2 because vertical counts full matrix
  const trappingTime = verticalLineCount > 0 ? totalVerticalLength / verticalLineCount : 0;

  return {
    determinism: Math.min(1, determinism),
    laminarity: Math.min(1, laminarity),
    trappingTime,
    recurrenceRate,
  };
}

// ─── Transfer Entropy (Schreiber 2000) ──────────────────────────────
// Binned estimation: discretize into 3 levels (low/med/high)

function transferEntropy(
  source: number[],
  target: number[],
  lag: number = 1,
): number | null {
  const N = Math.min(source.length, target.length);
  if (N < 30) return null;

  // Discretize into 3 bins based on terciles
  function discretize(arr: number[]): number[] {
    const sorted = [...arr].sort((a, b) => a - b);
    const t1 = sorted[Math.floor(sorted.length / 3)];
    const t2 = sorted[Math.floor(2 * sorted.length / 3)];
    return arr.map(v => v <= t1 ? 0 : v <= t2 ? 1 : 2);
  }

  const S = discretize(source.slice(0, N));
  const T = discretize(target.slice(0, N));

  // Count joint and marginal probabilities
  // TE(S→T) = sum p(t+1, t, s) * log2( p(t+1|t,s) / p(t+1|t) )
  const counts: Record<string, number> = {};
  const countT: Record<string, number> = {};
  const countTS: Record<string, number> = {};
  const countTnext: Record<string, number> = {};
  let total = 0;

  for (let i = lag; i < N - 1; i++) {
    const tPrev = T[i - lag];
    const sPrev = S[i - lag];
    const tNext = T[i];

    const keyFull = `${tNext},${tPrev},${sPrev}`;
    const keyT = `${tPrev}`;
    const keyTS = `${tPrev},${sPrev}`;
    const keyTnext = `${tNext},${tPrev}`;

    counts[keyFull] = (counts[keyFull] ?? 0) + 1;
    countT[keyT] = (countT[keyT] ?? 0) + 1;
    countTS[keyTS] = (countTS[keyTS] ?? 0) + 1;
    countTnext[keyTnext] = (countTnext[keyTnext] ?? 0) + 1;
    total++;
  }

  if (total < 20) return null;

  let te = 0;
  for (const [key, count] of Object.entries(counts)) {
    const [tNext, tPrev, sPrev] = key.split(',');
    const pFull = count / total;
    const pTS = (countTS[`${tPrev},${sPrev}`] ?? 0) / total;
    const pTnext = (countTnext[`${tNext},${tPrev}`] ?? 0) / total;
    const pT = (countT[tPrev] ?? 0) / total;

    if (pTS > 0 && pT > 0 && pTnext > 0) {
      const conditional = (count / total) / pTS;
      const marginal = pTnext / pT;
      if (conditional > 0 && marginal > 0) {
        te += pFull * Math.log2(conditional / marginal);
      }
    }
  }

  return Math.max(0, te); // TE is non-negative in theory; clamp numerical noise
}

// ─── Public API ─────────────────────────────────────────────────────

export function computeDynamicalSignals(stream: KeystrokeEvent[]): DynamicalSignals {
  const ikis = extractIKI(stream);
  const { holds, flights } = extractHoldFlight(stream);
  const minLen = Math.min(holds.length, flights.length);

  // Permutation entropy
  const pe = permutationEntropy(ikis, 3);

  // DFA
  const alpha = dfaAlpha(ikis);

  // RQA
  const rqaResult = rqa(ikis);

  // Transfer entropy (both directions)
  const holdsAligned = holds.slice(0, minLen);
  const flightsAligned = flights.slice(0, minLen);
  const teHF = transferEntropy(holdsAligned, flightsAligned);
  const teFH = transferEntropy(flightsAligned, holdsAligned);

  let teDominance: number | null = null;
  if (teHF != null && teFH != null && (teHF + teFH) > 0) {
    // >1 = motor dominates, <1 = cognitive dominates
    teDominance = teFH > 0 ? teHF / teFH : (teHF > 0 ? Infinity : 1);
  }

  return {
    ikiCount: ikis.length,
    holdFlightCount: minLen,

    permutationEntropy: pe?.normalized ?? null,
    permutationEntropyRaw: pe?.raw ?? null,

    dfaAlpha: alpha,

    rqaDeterminism: rqaResult?.determinism ?? null,
    rqaLaminarity: rqaResult?.laminarity ?? null,
    rqaTrappingTime: rqaResult?.trappingTime ?? null,
    rqaRecurrenceRate: rqaResult?.recurrenceRate ?? null,

    teHoldToFlight: teHF,
    teFlightToHold: teFH,
    teDominance,
  };
}
