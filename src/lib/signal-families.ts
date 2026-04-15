/**
 * Signal Family Taxonomy & Ablation Engine
 *
 * Groups ~100 individual signals into meaningful families, maps their
 * downstream dependencies into the 8D state engine, and computes
 * ablation results: what happens when you remove one family, two families,
 * or run with only one family.
 *
 * This is deterministic variance analysis, not AI interpretation.
 * The goal: know which signals carry weight and which are redundant
 * before the pipeline grows further.
 */

import { loadSessions, computeEntryStates, STATE_DIMENSIONS, type EntryState } from './alice-negative/state-engine.ts';
import { avg, stddev } from './alice-negative/helpers.ts';

// ─── Signal Family Definitions ─────────────────────────────────────

export interface SignalFamily {
  id: string;
  label: string;
  description: string;
  /** Which raw session fields belong to this family */
  sessionFields: string[];
  /** Which 8D dimensions this family feeds into */
  feedsDimensions: string[];
  /** Research citation for the family's theoretical basis */
  citation: string;
}

export const SIGNAL_FAMILIES: SignalFamily[] = [
  // ── Families that feed the 8D state engine ──────────────────────────
  //
  // The ground truth for what feeds which dimension lives in
  // state-engine.ts → computeEntryStates(). Every feedsDimensions list
  // and every neutralization function below is derived from reading that
  // code line by line. If the engine changes, update this file to match.

  {
    id: 'timing',
    label: 'Timing',
    description: 'First keystroke delay — how long you sit with the question before starting. Measures initial hesitation, the gap between reading and writing.',
    sessionFields: ['firstKeystrokeMs'],
    feedsDimensions: ['deliberation'],
    citation: 'Deane 2015',
  },
  {
    id: 'pbursts',
    label: 'P-Bursts',
    description: 'A P-burst is a continuous run of typing with no pause longer than 2 seconds. Each burst roughly maps to one "thought unit." Longer bursts = more fluent, ideas flowing without interruption. Short bursts = fragmented, stop-and-think processing. When P-burst data is available, this is the primary driver of the fluency dimension. When absent, chars/min is the fallback.',
    sessionFields: ['pBurstCount', 'avgPBurstLength', 'charsPerMinute'],
    feedsDimensions: ['fluency'],
    citation: 'Chenoweth & Hayes 2001',
  },
  {
    id: 'deletion',
    label: 'Deletion (Faigley-Witte)',
    description: 'Revision weight (large deletion chars / total chars typed) feeds deliberation. Substantive deletion rate (large deletions per 100 chars) and inverted commitment ratio feed revision. Correction rate (small deletions per 100 chars) and revision timing (early vs late large deletions) feed thermal. This family is the most cross-cutting — it touches four dimensions because different decompositions of deletion behavior measure different cognitive processes.',
    sessionFields: ['revisionWeight', 'revisionRate', 'commitmentRatio', 'correctionRate', 'revisionTiming'],
    feedsDimensions: ['deliberation', 'revision', 'commitment', 'thermal'],
    citation: 'Faigley & Witte 1981',
  },
  {
    id: 'engagement',
    label: 'Engagement',
    description: 'Pause rate (pauses per active minute) and tab-away rate (tab-aways per active minute). Pause rate feeds deliberation (more pauses = more cognitive load). Both feed presence inversely — high pause + high tab-away = low presence.',
    sessionFields: ['pauseRatePerMinute', 'tabAwayRatePerMinute'],
    feedsDimensions: ['deliberation', 'presence'],
    citation: 'Czerwinski et al 2004',
  },
  {
    id: 'pennebaker',
    label: 'Pennebaker Linguistic',
    description: 'Hedging density ("maybe", "perhaps", "might") measures uncertainty. First-person density (I, me, my) measures self-focus. These feed the expression dimension as absolute deviations from your personal norm — any direction of shift counts.',
    sessionFields: ['hedgingDensity', 'firstPersonDensity'],
    feedsDimensions: ['expression'],
    citation: 'Pennebaker 1997',
  },
  {
    id: 'lexical',
    label: 'Lexical & Syntax',
    description: 'Average sentence length and question density (questions per sentence) feed the expression dimension as absolute deviations from your personal norm. Captures syntactic complexity and interrogative style.',
    sessionFields: ['avgSentenceLength', 'questionDensity'],
    feedsDimensions: ['expression'],
    citation: 'Biber 1988',
  },

  // ── Observation-only families ───────────────────────────────────────
  //
  // These signals are collected and fed to the LLM prompt for
  // interpretation, but do NOT feed the 8D state engine. They add
  // context the LLM can use without affecting deterministic dimensions.

  {
    id: 'keystroke',
    label: 'Keystroke Dynamics',
    description: 'IKI (inter-key interval) mean and std dev capture average hesitation and consistency. Hold time (keydown to keyup) measures motor execution. Flight time (key release to next key press) measures cognitive planning. Keystroke entropy measures typing rhythm unpredictability (Shannon entropy of IKI distribution). These are observation-only — they feed the LLM prompt but not the 8D engine.',
    sessionFields: ['interKeyIntervalMean', 'interKeyIntervalStd', 'holdTimeMean', 'holdTimeStd', 'flightTimeMean', 'flightTimeStd', 'keystrokeEntropy'],
    feedsDimensions: [],
    citation: 'Epp et al 2011',
  },
  {
    id: 'revision_topology',
    label: 'Revision Topology',
    description: 'Sequential deletion keystrokes within 500ms count as one revision chain. More chains = more revision episodes. Longer chains = deeper per-episode rethinking. Observation-only — captures editing structure that the engine\'s deletion decomposition misses.',
    sessionFields: ['revisionChainCount', 'revisionChainAvgLength'],
    feedsDimensions: [],
    citation: 'Leijten & Van Waes 2013',
  },
  {
    id: 'reengagement',
    label: 'Re-engagement',
    description: 'Scroll-backs (scrolling up to re-read your own text) and question re-reads (returning to the prompt). Metacognitive loops — checking your work against the question. Observation-only.',
    sessionFields: ['scrollBackCount', 'questionRereadCount'],
    feedsDimensions: [],
    citation: 'Bereiter & Scardamalia 1987',
  },
  {
    id: 'nrc_emotion',
    label: 'NRC Emotions',
    description: 'Word-level emotion densities from the NRC Emotion Lexicon: anger, fear, joy, sadness, trust, anticipation. Each is count of matching words divided by total words. Observation-only — the absolute values matter less than slopes over time.',
    sessionFields: ['nrcAngerDensity', 'nrcFearDensity', 'nrcJoyDensity', 'nrcSadnessDensity', 'nrcTrustDensity', 'nrcAnticipationDensity'],
    feedsDimensions: [],
    citation: 'Mohammad & Turney 2013',
  },
  {
    id: 'lexical_diversity',
    label: 'Lexical Diversity',
    description: 'MATTR (Moving-Average Type-Token Ratio) measures vocabulary diversity independent of text length. Sentence length variance captures syntactic regularity. Observation-only — these are collected but do not currently feed the 8D engine.',
    sessionFields: ['mattr', 'sentenceLengthVariance'],
    feedsDimensions: [],
    citation: 'McCarthy & Jarvis 2010',
  },
  {
    id: 'pennebaker_cognitive',
    label: 'Cognitive Density',
    description: 'Cognitive mechanism word density ("think", "realize", "because") measures causal reasoning intensity. Observation-only — collected but does not feed the 8D engine.',
    sessionFields: ['cognitiveDensity'],
    feedsDimensions: [],
    citation: 'Pennebaker 1997',
  },
];

// ─── Dependency Map ────────────────────────────────────────────────

/** Which families feed each 8D dimension */
export function getDimensionDependencies(): Record<string, string[]> {
  const deps: Record<string, string[]> = {};
  for (const dim of STATE_DIMENSIONS) {
    deps[dim] = SIGNAL_FAMILIES
      .filter(f => f.feedsDimensions.includes(dim))
      .map(f => f.id);
  }
  return deps;
}

/** Which families are "observation-only" — feed the LLM prompt but not the 8D engine */
export function getObservationOnlyFamilies(): string[] {
  return SIGNAL_FAMILIES
    .filter(f => f.feedsDimensions.length === 0)
    .map(f => f.id);
}

// ─── Ablation Engine ───────────────────────────────────────────────

export interface AblationResult {
  /** Which families were removed */
  removed: string[];
  /** Which families were kept */
  kept: string[];
  /** Per-dimension mean absolute deviation from full baseline */
  dimensionDeviation: Record<string, number>;
  /** Overall deviation (RMS across all dimensions) */
  totalDeviation: number;
  /** Per-dimension variance explained (1 - residual/total) */
  varianceRetained: Record<string, number>;
  /** Overall variance retained */
  totalVarianceRetained: number;
}

export interface VariantTreeResult {
  /** Number of entries analyzed */
  entryCount: number;
  /** Full baseline 8D states (all signals) */
  baseline: EntryState[];
  /** Per-dimension variance in baseline */
  baselineVariance: Record<string, number>;
  /** Leave-one-out ablation results */
  leaveOneOut: AblationResult[];
  /** Solo family results (one family at a time) */
  soloFamily: AblationResult[];
  /** Inter-family correlation matrix */
  correlationMatrix: Record<string, Record<string, number>>;
  /** Dimension dependency map */
  dimensionDeps: Record<string, string[]>;
  /** Families that only feed observation, not 8D engine */
  observationOnly: string[];
}

/**
 * Run the full ablation analysis against actual historical data.
 *
 * Methodology:
 *   1. Compute full 8D states (baseline)
 *   2. For each family: zero out its contribution by replacing raw values
 *      with personal means → recompute → measure deviation from baseline
 *   3. For solo: zero ALL families except one → recompute
 *   4. Compute inter-family correlations from the deviation patterns
 */
export function computeVariantTree(): VariantTreeResult {
  const sessions = loadSessions();
  const baseline = computeEntryStates(sessions);

  if (baseline.length === 0) {
    return {
      entryCount: 0,
      baseline: [],
      baselineVariance: {},
      leaveOneOut: [],
      soloFamily: [],
      correlationMatrix: {},
      dimensionDeps: getDimensionDependencies(),
      observationOnly: getObservationOnlyFamilies(),
    };
  }

  // Baseline variance per dimension
  const baselineVariance: Record<string, number> = {};
  for (const dim of STATE_DIMENSIONS) {
    const vals = baseline.map(e => e[dim]);
    baselineVariance[dim] = variance(vals);
  }

  // ── Neutralization functions ──────────────────────────────────────
  //
  // Each function replaces its family's raw SessionRaw fields with the
  // personal mean, so the 8D engine sees no signal from that family.
  // These MUST match the exact fields used in computeEntryStates().
  //
  // Shared fields: some raw fields feed multiple dimensions. Each field
  // belongs to exactly ONE family for ablation purposes to avoid overlap:
  //   - commitmentRatio → deletion (feeds revision + commitment)
  //   - pauseRatePerMinute → engagement (feeds deliberation + presence)
  //   - revisionWeight → deletion (feeds deliberation)
  //   - revisionRate → deletion (feeds revision)
  //
  const familyNeutralizations: Record<string, (session: any) => any> = {
    timing: (s) => ({
      ...s,
      firstKeystrokeMs: avg(sessions.map(x => x.firstKeystrokeMs)),
    }),
    pbursts: (s) => ({
      ...s,
      avgPBurstLength: avg(sessions.map(x => x.avgPBurstLength)),
      charsPerMinute: avg(sessions.map(x => x.charsPerMinute)),
    }),
    deletion: (s) => ({
      ...s,
      revisionWeight: avg(sessions.map(x => x.revisionWeight)),
      revisionRate: avg(sessions.map(x => x.revisionRate)),
      commitmentRatio: avg(sessions.map(x => x.commitmentRatio)),
      correctionRate: avg(sessions.map(x => x.correctionRate)),
      revisionTiming: avg(sessions.map(x => x.revisionTiming)),
    }),
    engagement: (s) => ({
      ...s,
      pauseRatePerMinute: avg(sessions.map(x => x.pauseRatePerMinute)),
      tabAwayRatePerMinute: avg(sessions.map(x => x.tabAwayRatePerMinute)),
    }),
    pennebaker: (s) => ({
      ...s,
      shape: {
        ...s.shape,
        firstPersonDensity: avg(sessions.map(x => x.shape.firstPersonDensity)),
        hedgingDensity: avg(sessions.map(x => x.shape.hedgingDensity)),
      },
    }),
    lexical: (s) => ({
      ...s,
      shape: {
        ...s.shape,
        avgSentenceLength: avg(sessions.map(x => x.shape.avgSentenceLength)),
        questionDensity: avg(sessions.map(x => x.shape.questionDensity)),
      },
    }),
  };

  // ── Leave-one-out ──
  const stateEngineFamilies = SIGNAL_FAMILIES.filter(f => f.feedsDimensions.length > 0);
  const leaveOneOut: AblationResult[] = stateEngineFamilies.map(family => {
    const neutralize = familyNeutralizations[family.id];
    if (!neutralize) return makeEmptyAblation([family.id], stateEngineFamilies.map(f => f.id).filter(id => id !== family.id));

    const ablatedSessions = sessions.map(s => neutralize(s));
    const ablatedStates = computeEntryStates(ablatedSessions);
    return measureDeviation(baseline, ablatedStates, [family.id], baselineVariance);
  });

  // ── Solo family (only one family active, rest neutralized) ──
  const soloFamily: AblationResult[] = stateEngineFamilies.map(family => {
    // Neutralize ALL families except this one
    const othersToNeutralize = stateEngineFamilies
      .filter(f => f.id !== family.id)
      .map(f => familyNeutralizations[f.id])
      .filter(Boolean);

    let soloSessions = sessions.map(s => {
      let result = { ...s, shape: { ...s.shape } };
      for (const neutralize of othersToNeutralize) {
        result = neutralize(result);
      }
      return result;
    });

    const soloStates = computeEntryStates(soloSessions);
    return measureDeviation(baseline, soloStates,
      stateEngineFamilies.filter(f => f.id !== family.id).map(f => f.id),
      baselineVariance,
    );
  });

  // ── Inter-family correlation ──
  // Use leave-one-out deviation vectors to compute how correlated families are
  const correlationMatrix: Record<string, Record<string, number>> = {};
  for (const a of stateEngineFamilies) {
    correlationMatrix[a.id] = {};
    const aResult = leaveOneOut.find(r => r.removed[0] === a.id);
    for (const b of stateEngineFamilies) {
      if (a.id === b.id) {
        correlationMatrix[a.id][b.id] = 1;
        continue;
      }
      const bResult = leaveOneOut.find(r => r.removed[0] === b.id);
      if (!aResult || !bResult) {
        correlationMatrix[a.id][b.id] = 0;
        continue;
      }
      // Correlation between deviation profiles
      const aDev = STATE_DIMENSIONS.map(d => aResult.dimensionDeviation[d] || 0);
      const bDev = STATE_DIMENSIONS.map(d => bResult.dimensionDeviation[d] || 0);
      correlationMatrix[a.id][b.id] = pearsonCorrelation(aDev, bDev);
    }
  }

  return {
    entryCount: baseline.length,
    baseline,
    baselineVariance,
    leaveOneOut,
    soloFamily,
    correlationMatrix,
    dimensionDeps: getDimensionDependencies(),
    observationOnly: getObservationOnlyFamilies(),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avg(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
}

function measureDeviation(
  baseline: EntryState[],
  ablated: EntryState[],
  removed: string[],
  baselineVariance: Record<string, number>,
): AblationResult {
  const n = Math.min(baseline.length, ablated.length);
  if (n === 0) return makeEmptyAblation(removed, []);

  const dimensionDeviation: Record<string, number> = {};
  const varianceRetained: Record<string, number> = {};

  for (const dim of STATE_DIMENSIONS) {
    // Mean absolute deviation between baseline and ablated
    let sumAbsDev = 0;
    const ablatedVals: number[] = [];
    for (let i = 0; i < n; i++) {
      const diff = Math.abs(
        (ablated[i] as any)[dim] - (baseline[i] as any)[dim]
      );
      sumAbsDev += diff;
      ablatedVals.push((ablated[i] as any)[dim]);
    }
    dimensionDeviation[dim] = sumAbsDev / n;

    // Variance retained: how much of the baseline variance survives ablation
    const ablatedVar = variance(ablatedVals);
    const baseVar = baselineVariance[dim] || 0.001;
    varianceRetained[dim] = Math.min(1, ablatedVar / baseVar);
  }

  const totalDeviation = Math.sqrt(
    Object.values(dimensionDeviation).reduce((s, v) => s + v ** 2, 0)
  );

  const totalVarianceRetained = avg(Object.values(varianceRetained));

  const kept = SIGNAL_FAMILIES
    .filter(f => f.feedsDimensions.length > 0 && !removed.includes(f.id))
    .map(f => f.id);

  return { removed, kept, dimensionDeviation, totalDeviation, varianceRetained, totalVarianceRetained };
}

function makeEmptyAblation(removed: string[], kept: string[]): AblationResult {
  const dimensionDeviation: Record<string, number> = {};
  const varianceRetained: Record<string, number> = {};
  for (const dim of STATE_DIMENSIONS) {
    dimensionDeviation[dim] = 0;
    varianceRetained[dim] = 1;
  }
  return { removed, kept, dimensionDeviation, totalDeviation: 0, varianceRetained, totalVarianceRetained: 1 };
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 0;

  const meanA = avg(a);
  const meanB = avg(b);
  let num = 0, denA = 0, denB = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  return den < 0.0001 ? 0 : num / den;
}
