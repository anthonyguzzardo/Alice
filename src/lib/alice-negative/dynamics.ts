/**
 * PersDyn Behavioral Dynamics Engine
 *
 * Computes three parameters per behavioral dimension from entry state history:
 *   baseline       — stable set point (rolling mean)
 *   variability    — fluctuation width (rolling standard deviation)
 *   attractor_force — how quickly deviations snap back to baseline
 *
 * Also discovers empirical coupling between dimensions via lagged
 * cross-correlations (signed Pearson, not just magnitude).
 *
 * Research basis:
 *   PersDyn model  — Sosnowska, Kuppens, De Fruyt & Hofmans (KU Leuven, 2019)
 *                    "A Unified Dynamic Systems Model"
 *   Attractor      — Kuppens, Oravecz & Tuerlinckx (2010) Dynamics-of-Affect
 *   Coupling       — Critcher (Berkeley xLab) causal trait theories
 *   Whole Trait    — Fleeson & Jayawickreme (2015, updated 2025)
 *                    traits as density distributions of states
 *
 * Attractor force estimation:
 *   For each dimension, compute the sequence of deviations from baseline.
 *   The attractor force is the negative of the lag-1 autocorrelation of
 *   those deviations. High autocorrelation = slow return = LOW attractor
 *   force. Low autocorrelation = fast snap-back = HIGH attractor force.
 *   This is the Ornstein-Uhlenbeck mean-reversion parameter estimate.
 */

import { avg, stddev, crossCorrelation, type LeadLagResult } from './helpers.ts';
import { type EntryState, STATE_DIMENSIONS, type StateDimension } from './state-engine.ts';

// ─── Types ──────────────────────────────────────────────────────────

export interface DimensionDynamic {
  dimension: StateDimension;
  baseline: number;
  variability: number;
  attractorForce: number;
  currentState: number;
  deviation: number;
  windowSize: number;
}

export interface CouplingEdge {
  leader: StateDimension;
  follower: StateDimension;
  lagSessions: number;
  correlation: number;
  direction: number; // +1 = positive coupling, -1 = negative coupling
}

export interface DynamicsAnalysis {
  dimensions: DimensionDynamic[];
  coupling: CouplingEdge[];
  entryCount: number;
  phase: 'insufficient' | 'stable' | 'shifting' | 'disrupted';
  velocity: number;
  systemEntropy: number;
}

// ─── Configuration ──────────────────────────────────────────────────

const MIN_ENTRIES_FOR_DYNAMICS = 5;
const MIN_ENTRIES_FOR_COUPLING = 10;
const ROLLING_WINDOW = 30;
const MAX_LAG = 3;
const COUPLING_THRESHOLD = 0.3; // minimum |r| to report a coupling

// ─── Attractor Force Estimation ─────────────────────────────────────
// Ornstein-Uhlenbeck mean-reversion parameter from lag-1 autocorrelation
// of deviations from baseline.
//
// If deviations persist (high autocorrelation), attractor force is low.
// If deviations decay quickly (low autocorrelation), attractor force is high.

function estimateAttractorForce(deviations: number[]): number {
  if (deviations.length < 4) return 0.5; // insufficient data, assume moderate

  // Lag-1 autocorrelation
  const n = deviations.length;
  const m = avg(deviations);
  let num = 0;
  let denom = 0;
  for (let i = 0; i < n; i++) {
    denom += (deviations[i] - m) ** 2;
  }
  if (denom < 1e-10) return 0.5; // no variance, moderate default

  for (let i = 0; i < n - 1; i++) {
    num += (deviations[i] - m) * (deviations[i + 1] - m);
  }
  const autocorr = num / denom;

  // Convert: high autocorrelation → low attractor force, and vice versa
  // autocorr ranges roughly from -1 to 1
  // attractor force: 0 = no pull back, 1 = instant snap back
  // Map: autocorr 1.0 → force 0.0, autocorr 0.0 → force 0.5, autocorr -1.0 → force 1.0
  return Math.max(0, Math.min(1, 0.5 - autocorr * 0.5));
}

// ─── Dimension Dynamics ─────────────────────────────────────────────

function computeDimensionDynamic(
  states: EntryState[],
  dim: StateDimension,
): DimensionDynamic {
  const values = states.map(s => s[dim] as number);
  const windowSize = Math.min(ROLLING_WINDOW, values.length);
  const window = values.slice(-windowSize);

  const baseline = avg(window);
  const variability = stddev(window);
  const currentState = values[values.length - 1];

  // Deviation: how far current state is from baseline in std units
  const deviation = variability > 0.001
    ? (currentState - baseline) / variability
    : 0;

  // Attractor force from full history of deviations
  const fullBaseline = avg(values);
  const deviations = values.map(v => v - fullBaseline);
  const attractorForce = estimateAttractorForce(deviations);

  return {
    dimension: dim,
    baseline,
    variability,
    attractorForce,
    currentState,
    deviation,
    windowSize,
  };
}

// ─── Signed Cross-Correlation for Coupling ──────────────────────────
// Unlike the existing crossCorrelation in helpers.ts (which uses |r|),
// we need the sign to know if dimensions move together (+) or oppose (-).

function signedPearson(a: number[], b: number[]): number {
  if (a.length < 3 || a.length !== b.length) return 0;
  const n = a.length;
  const ma = avg(a);
  const mb = avg(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i] - ma;
    const bi = b[i] - mb;
    num += ai * bi;
    da += ai * ai;
    db += bi * bi;
  }
  const denom = Math.sqrt(da * db);
  return denom < 1e-10 ? 0 : num / denom;
}

function discoverCoupling(states: EntryState[]): CouplingEdge[] {
  if (states.length < MIN_ENTRIES_FOR_COUPLING) return [];

  const series: Record<string, number[]> = {};
  for (const dim of STATE_DIMENSIONS) {
    series[dim] = states.map(s => s[dim] as number);
  }

  const edges: CouplingEdge[] = [];

  for (let i = 0; i < STATE_DIMENSIONS.length; i++) {
    for (let j = i + 1; j < STATE_DIMENSIONS.length; j++) {
      const dimA = STATE_DIMENSIONS[i];
      const dimB = STATE_DIMENSIONS[j];
      const seriesA = series[dimA];
      const seriesB = series[dimB];
      const n = Math.min(seriesA.length, seriesB.length);

      if (n < MAX_LAG * 2 + 3) continue;

      let bestCorr = 0;
      let bestLag = 0;
      let bestSign = 0;

      for (let lag = -MAX_LAG; lag <= MAX_LAG; lag++) {
        const start = Math.max(0, lag);
        const end = Math.min(n, n + lag);
        const a = seriesA.slice(start, end);
        const b = seriesB.slice(start - lag, end - lag);
        const r = signedPearson(a, b);
        if (Math.abs(r) > Math.abs(bestCorr)) {
          bestCorr = r;
          bestLag = lag;
          bestSign = r >= 0 ? 1 : -1;
        }
      }

      if (Math.abs(bestCorr) < COUPLING_THRESHOLD) continue;

      // Positive lag = A leads B. Negative = B leads A. Zero = concurrent.
      const leader = bestLag >= 0 ? dimA : dimB;
      const follower = bestLag >= 0 ? dimB : dimA;

      edges.push({
        leader: leader as StateDimension,
        follower: follower as StateDimension,
        lagSessions: Math.abs(bestLag),
        correlation: Math.abs(bestCorr),
        direction: bestSign,
      });
    }
  }

  // Sort by coupling strength
  edges.sort((a, b) => b.correlation - a.correlation);
  return edges;
}

// ─── Phase Detection (8D) ──────────────────────────────────────────

function detectPhase(states: EntryState[]): DynamicsAnalysis['phase'] {
  if (states.length < MIN_ENTRIES_FOR_DYNAMICS) return 'insufficient';

  const recent = states.slice(-5);
  const latest = recent[recent.length - 1];
  const beforeLatest = recent.slice(0, -1);
  const priorAvgConvergence = avg(beforeLatest.map(p => p.convergence));

  // Disrupted: latest entry is a big outlier
  if (latest.convergence > 0.6 && priorAvgConvergence < 0.35) {
    return 'disrupted';
  }

  // Shifting: monotonic trend in any dimension over recent window
  if (recent.length >= 3) {
    for (const dim of STATE_DIMENSIONS) {
      const values = recent.map(p => p[dim] as number);
      let increasing = 0;
      let decreasing = 0;
      for (let i = 1; i < values.length; i++) {
        if (values[i] > values[i - 1]) increasing++;
        else if (values[i] < values[i - 1]) decreasing++;
      }
      const trend = Math.max(increasing, decreasing) / (values.length - 1);
      if (trend >= 0.75) return 'shifting';
    }
  }

  return 'stable';
}

// ─── Velocity (rate of change in 8D space) ──────────────────────────

function computeVelocity(states: EntryState[]): number {
  if (states.length < 2) return 0;

  const recent = states.slice(-5);
  let totalDist = 0;

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    let sumSq = 0;
    for (const dim of STATE_DIMENSIONS) {
      sumSq += ((curr[dim] as number) - (prev[dim] as number)) ** 2;
    }
    totalDist += Math.sqrt(sumSq);
  }

  const avgDist = totalDist / (recent.length - 1);
  return Math.min(1, avgDist / 3); // Normalize to [0, 1]
}

// ─── System Entropy (Shannon entropy of variabilities) ──────────────
// ECTO framework (Rodriguez, 2025): entropy from psychometric distributions
// serves as both a compression mechanism and an active driver of evolution.
// High entropy = behavioral dimensions are all similarly variable (unpredictable).
// Low entropy = some dimensions are rigid while others are volatile (structured).

function computeSystemEntropy(dynamics: DimensionDynamic[]): number {
  const variabilities = dynamics.map(d => d.variability);
  const total = variabilities.reduce((s, v) => s + v, 0);
  if (total < 1e-10) return 0;

  // Normalize to probability distribution
  const probs = variabilities.map(v => v / total);

  // Shannon entropy, normalized to [0, 1]
  const maxEntropy = Math.log(probs.length);
  if (maxEntropy < 1e-10) return 0;

  let entropy = 0;
  for (const p of probs) {
    if (p > 1e-10) {
      entropy -= p * Math.log(p);
    }
  }

  return entropy / maxEntropy;
}

// ─── Public API ─────────────────────────────────────────────────────

export function computeDynamics(states: EntryState[]): DynamicsAnalysis {
  if (states.length < MIN_ENTRIES_FOR_DYNAMICS) {
    return {
      dimensions: STATE_DIMENSIONS.map(dim => ({
        dimension: dim,
        baseline: 0,
        variability: 0,
        attractorForce: 0.5,
        currentState: 0,
        deviation: 0,
        windowSize: 0,
      })),
      coupling: [],
      entryCount: states.length,
      phase: 'insufficient',
      velocity: 0,
      systemEntropy: 0,
    };
  }

  const dimensions = STATE_DIMENSIONS.map(dim => computeDimensionDynamic(states, dim));
  const coupling = discoverCoupling(states);
  const phase = detectPhase(states);
  const velocity = computeVelocity(states);
  const systemEntropy = computeSystemEntropy(dimensions);

  return {
    dimensions,
    coupling,
    entryCount: states.length,
    phase,
    velocity,
    systemEntropy,
  };
}

// ─── Format dynamics for LLM renderer ──────────────────────────────
// Produces a human-readable summary of the dynamics state for the
// visual trait renderer (the LLM's new role: art, not science).

export function formatDynamicsForRenderer(analysis: DynamicsAnalysis): string {
  const lines: string[] = [];

  lines.push(`=== BEHAVIORAL DYNAMICS (${analysis.entryCount} entries) ===`);
  lines.push(`Phase: ${analysis.phase} | Velocity: ${analysis.velocity.toFixed(3)} | System entropy: ${analysis.systemEntropy.toFixed(3)}`);
  lines.push('');

  lines.push('=== DIMENSION DYNAMICS (PersDyn model) ===');
  for (const d of analysis.dimensions) {
    const attractorLabel =
      d.attractorForce >= 0.7 ? 'rigid' :
      d.attractorForce >= 0.4 ? 'moderate' : 'malleable';
    const deviationLabel =
      Math.abs(d.deviation) >= 2.0 ? '⚠ EXTREME' :
      Math.abs(d.deviation) >= 1.5 ? 'notable' :
      Math.abs(d.deviation) >= 1.0 ? 'mild' : 'normal';

    lines.push(
      `${d.dimension.padEnd(14)} baseline=${d.baseline > 0 ? '+' : ''}${d.baseline.toFixed(2)}  ` +
      `variability=${d.variability.toFixed(2)}  ` +
      `attractor=${d.attractorForce.toFixed(2)} (${attractorLabel})  ` +
      `current=${d.currentState > 0 ? '+' : ''}${d.currentState.toFixed(2)}  ` +
      `deviation=${d.deviation > 0 ? '+' : ''}${d.deviation.toFixed(2)} (${deviationLabel})`
    );
  }

  if (analysis.coupling.length > 0) {
    lines.push('');
    lines.push('=== DIMENSION COUPLING (empirically discovered) ===');
    for (const c of analysis.coupling) {
      const sign = c.direction > 0 ? '+' : '−';
      const lagLabel = c.lagSessions === 0 ? 'concurrent' : `${c.lagSessions}-entry lag`;
      lines.push(
        `${c.leader} → ${c.follower}  ` +
        `r=${sign}${c.correlation.toFixed(2)}  ` +
        `(${lagLabel})`
      );
    }
  }

  // Narrative summary for the renderer
  lines.push('');
  lines.push('=== BEHAVIORAL NARRATIVE ===');

  // Find extreme deviations
  const extremes = analysis.dimensions
    .filter(d => Math.abs(d.deviation) >= 1.5)
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  if (extremes.length > 0) {
    lines.push('Active deviations from baseline:');
    for (const e of extremes) {
      const dir = e.deviation > 0 ? 'above' : 'below';
      lines.push(`  - ${e.dimension} is ${Math.abs(e.deviation).toFixed(1)}σ ${dir} baseline (attractor: ${e.attractorForce.toFixed(2)})`);
      if (e.attractorForce >= 0.7) {
        lines.push(`    → This deviation is unusual for this rigid dimension — likely to snap back soon`);
      } else if (e.attractorForce <= 0.3) {
        lines.push(`    → This dimension is malleable — deviation may represent a genuine shift`);
      }
    }
  } else {
    lines.push('All dimensions within normal range of baseline.');
  }

  // Find rigid vs malleable dimensions
  const rigid = analysis.dimensions.filter(d => d.attractorForce >= 0.7);
  const malleable = analysis.dimensions.filter(d => d.attractorForce <= 0.3);

  if (rigid.length > 0) {
    lines.push(`Rigid dimensions (strong attractor): ${rigid.map(d => d.dimension).join(', ')}`);
  }
  if (malleable.length > 0) {
    lines.push(`Malleable dimensions (weak attractor): ${malleable.map(d => d.dimension).join(', ')}`);
  }

  // Entropy interpretation
  if (analysis.systemEntropy >= 0.85) {
    lines.push('System entropy is HIGH — behavioral dimensions are uniformly variable. Unpredictable.');
  } else if (analysis.systemEntropy <= 0.5) {
    lines.push('System entropy is LOW — behavioral structure is well-defined. Some dimensions rigid, others volatile.');
  }

  // Active coupling narratives
  const activeCouplings = analysis.coupling.filter(c => {
    const leaderDyn = analysis.dimensions.find(d => d.dimension === c.leader);
    return leaderDyn && Math.abs(leaderDyn.deviation) >= 1.0;
  });

  if (activeCouplings.length > 0) {
    lines.push('');
    lines.push('Active coupling effects:');
    for (const c of activeCouplings) {
      const leaderDyn = analysis.dimensions.find(d => d.dimension === c.leader)!;
      const dir = c.direction > 0 ? 'same direction' : 'opposite direction';
      const lagLabel = c.lagSessions === 0 ? 'concurrently' : `in ~${c.lagSessions} entries`;
      lines.push(
        `  - ${c.leader} deviated ${leaderDyn.deviation > 0 ? '+' : ''}${leaderDyn.deviation.toFixed(1)}σ → ` +
        `expect ${c.follower} to respond ${dir} ${lagLabel} (r=${c.correlation.toFixed(2)})`
      );
    }
  }

  return lines.join('\n');
}
