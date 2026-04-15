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
  {
    id: 'timing',
    label: 'Timing',
    description: 'Delay from page open to first keystroke, total session duration, active typing time. First keystroke delay measures initial hesitation — how long you sit with the question before starting. Active typing strips out pauses and tab-aways to isolate actual writing time.',
    sessionFields: ['firstKeystrokeMs', 'totalDurationMs', 'activeTypingMs'],
    feedsDimensions: ['deliberation'],
    citation: 'Deane 2015',
  },
  {
    id: 'production',
    label: 'Production',
    description: 'Total characters typed (including deleted), final character count, commitment ratio (final/total — how much you kept), typing speed, word and sentence counts. Commitment ratio is the core metric: 1.0 means you kept everything, low means heavy self-editing.',
    sessionFields: ['totalCharsTyped', 'finalCharCount', 'commitmentRatio', 'charsPerMinute', 'wordCount', 'sentenceCount'],
    feedsDimensions: ['fluency', 'revision', 'commitment'],
    citation: 'Flower & Hayes 1981',
  },
  {
    id: 'engagement',
    label: 'Engagement',
    description: 'Pauses (>30s gaps), tab-aways (leaving the page), and their cumulative durations. Measures attention continuity — are you locked in or fragmented? High tab-away + high pause = low presence.',
    sessionFields: ['pauseCount', 'totalPauseMs', 'tabAwayCount', 'totalTabAwayMs'],
    feedsDimensions: ['deliberation', 'presence'],
    citation: 'Czerwinski et al 2004',
  },
  {
    id: 'deletion',
    label: 'Deletion (Faigley-Witte)',
    description: 'Small deletions (<10 chars) are corrections — typos, word swaps. Large deletions (>=10 chars) are revisions — rethinking what you meant. The split between first-half and second-half deletion chars shows whether revision happens early (planning) or late (restructuring). This decomposition is the backbone of the thermal and revision dimensions.',
    sessionFields: ['deletionCount', 'totalCharsDeleted', 'largestDeletion', 'smallDeletionCount', 'largeDeletionCount', 'largeDeletionChars', 'firstHalfDeletionChars', 'secondHalfDeletionChars'],
    feedsDimensions: ['deliberation', 'revision', 'thermal'],
    citation: 'Faigley & Witte 1981',
  },
  {
    id: 'pbursts',
    label: 'P-Bursts',
    description: 'A P-burst is a continuous run of typing with no pause longer than 2 seconds. Each burst roughly maps to one "thought unit." Longer bursts = more fluent, ideas flowing without interruption. Short bursts = fragmented, stop-and-think processing. This is the primary signal driving the fluency dimension.',
    sessionFields: ['pBurstCount', 'avgPBurstLength'],
    feedsDimensions: ['fluency'],
    citation: 'Chenoweth & Hayes 2001',
  },
  {
    id: 'keystroke',
    label: 'Keystroke Dynamics',
    description: 'IKI (inter-key interval) measures milliseconds between keystrokes — mean captures average hesitation, std dev captures consistency. Hold time (keydown to keyup) measures motor execution. Flight time (key release to next key press) measures cognitive planning — word retrieval, sentence planning. Keystroke entropy measures how unpredictable your typing rhythm is (Shannon entropy of IKI distribution). These are independent signals that most tools collapse into a single "typing speed."',
    sessionFields: ['interKeyIntervalMean', 'interKeyIntervalStd', 'holdTimeMean', 'holdTimeStd', 'flightTimeMean', 'flightTimeStd', 'keystrokeEntropy'],
    feedsDimensions: [],
    citation: 'Epp et al 2011; Kim et al 2024; Ajilore et al 2025',
  },
  {
    id: 'revision_topology',
    label: 'Revision Topology',
    description: 'Sequential deletion keystrokes within 500ms of each other count as one revision chain. More chains = more revision episodes. Longer chains = deeper per-episode rethinking. Captures editing structure that raw deletion counts miss.',
    sessionFields: ['revisionChainCount', 'revisionChainAvgLength'],
    feedsDimensions: [],
    citation: 'Leijten & Van Waes 2013',
  },
  {
    id: 'reengagement',
    label: 'Re-engagement',
    description: 'Scroll-backs (scrolling up to re-read your own text) and question re-reads (returning to the prompt). These are metacognitive loops — you\'re checking your work against the question, not just producing forward. A signal of reflective depth.',
    sessionFields: ['scrollBackCount', 'questionRereadCount'],
    feedsDimensions: [],
    citation: 'Czerwinski et al 2004',
  },
  {
    id: 'nrc_emotion',
    label: 'NRC Emotions',
    description: 'Word-level emotion densities from the NRC Emotion Lexicon: anger, fear, joy, sadness, trust, anticipation. Each is count of matching words divided by total words. The absolute values matter less than the slopes over time and deviations from personal baseline.',
    sessionFields: ['nrcAngerDensity', 'nrcFearDensity', 'nrcJoyDensity', 'nrcSadnessDensity', 'nrcTrustDensity', 'nrcAnticipationDensity'],
    feedsDimensions: [],
    citation: 'Mohammad & Turney 2013',
  },
  {
    id: 'pennebaker',
    label: 'Pennebaker Linguistic',
    description: 'Cognitive density ("think", "realize", "because") measures causal reasoning. Hedging density ("maybe", "perhaps", "might") measures uncertainty. First-person density (I, me, my) measures self-focus. These psychological distance markers shift measurably between neutral and reflective writing.',
    sessionFields: ['cognitiveDensity', 'hedgingDensity', 'firstPersonDensity'],
    feedsDimensions: ['expression'],
    citation: 'Pennebaker 1997; Vrij 2000',
  },
  {
    id: 'lexical',
    label: 'Lexical & Syntax',
    description: 'MATTR (Moving-Average Type-Token Ratio) measures vocabulary diversity independent of text length. Sentence length and its variance capture syntactic complexity and regularity — monotone sentence structure vs varied rhythm.',
    sessionFields: ['mattr', 'avgSentenceLength', 'sentenceLengthVariance'],
    feedsDimensions: ['expression'],
    citation: 'McCarthy & Jarvis 2010',
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

  // ── Families that affect the 8D state engine ──
  // Map family ID → which raw session fields to neutralize
  const familyNeutralizations: Record<string, (session: any) => any> = {
    timing: (s) => ({ ...s, firstKeystrokeMs: avg(sessions.map(x => x.firstKeystrokeMs)) }),
    production: (s) => ({
      ...s,
      charsPerMinute: avg(sessions.map(x => x.charsPerMinute)),
      commitmentRatio: avg(sessions.map(x => x.commitmentRatio)),
      revisionRate: avg(sessions.map(x => x.revisionRate)),
    }),
    engagement: (s) => ({
      ...s,
      pauseRatePerMinute: avg(sessions.map(x => x.pauseRatePerMinute)),
      tabAwayRatePerMinute: avg(sessions.map(x => x.tabAwayRatePerMinute)),
    }),
    deletion: (s) => ({
      ...s,
      revisionWeight: avg(sessions.map(x => x.revisionWeight)),
      revisionRate: avg(sessions.map(x => x.revisionRate)),
      correctionRate: avg(sessions.map(x => x.correctionRate)),
      revisionTiming: avg(sessions.map(x => x.revisionTiming)),
    }),
    pbursts: (s) => ({
      ...s,
      avgPBurstLength: avg(sessions.map(x => x.avgPBurstLength)),
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
