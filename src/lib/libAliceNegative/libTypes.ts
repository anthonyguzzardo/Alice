// ─── Witness Types ──────────────────────────────────────────────────

/**
 * Behavioral signals from /api/alice-negative — percentile-normalized against personal history.
 * All values [0,1] except sessionCount, feedbackCount, daysSinceLastEntry (raw).
 *
 * Research basis:
 *   Production fluency  — Chenoweth & Hayes (2001), Deane (2015)
 *   Revision character  — Faigley & Witte (1981), Baaijen et al. (2012)
 *   Lexical diversity   — McCarthy & Jarvis (2010) MATTR
 *   Pause threshold     — 2s standard (Leijten & Van Waes, 2013)
 */
export interface AliceNegativeSignal {
  // ─── Core Behavioral (percentile-normalized) ──────────────
  commitmentRatio: number;          // avg final/total chars
  firstKeystrokeLatency: number;    // avg first_keystroke_ms
  pauseRatePerMinute: number;       // 30s pauses per active minute
  tabAwayRatePerMinute: number;     // tab-aways per active minute
  avgDurationNorm: number;          // session duration
  avgWordCountNorm: number;         // words per session

  // ─── Production Fluency (Chenoweth & Hayes P-bursts) ──────
  charsPerMinuteActive: number;     // typing speed during active time
  avgPBurstLength: number;          // mean P-burst length in chars
  pBurstCountNorm: number;          // bursts per session

  // ─── Revision Character (Faigley & Witte taxonomy) ────────
  correctionRate: number;           // small deletions per 100 chars typed
  revisionRate: number;             // large deletions per 100 chars typed
  revisionWeight: number;           // large_deletion_chars / total_chars_typed
  revisionTiming: number;           // 0=early, 1=late (second_half / total)
  largestRevisionNorm: number;      // largest single deletion

  // ─── Temporal ─────────────────────────────────────────────
  avgHourOfDay: number;
  daySpread: number;
  consistency: number;
  daysSinceLastEntry: number;

  // ─── Linguistic Shape ─────────────────────────────────────
  lexicalDiversity: number;         // MATTR (replaces TTR)
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  questionDensity: number;
  firstPersonDensity: number;
  hedgingDensity: number;

  // ─── Momentum (recent 7 vs all-time, 0.5 = stable) ───────
  commitmentDelta: number;
  charsPerMinuteDelta: number;
  revisionWeightDelta: number;
  pBurstLengthDelta: number;

  // ─── Stability ────────────────────────────────────────────
  commitmentVariance: number;
  fluencyVariance: number;          // variance in chars_per_minute
  sessionVolatility: number;

  // ─── Patterns ─────────────────────────────────────────────
  thematicDensity: number;
  landedRatio: number;
  feedbackCount: number;
  sessionCount: number;

  // ─── Relational ───────────────────────────────────────────
  latestSessionDeviation: number;
  outlierFrequency: number;

  // ─── Raw context for interpreter (not for shader pipeline) ─
  _raw: AliceNegativeSignalRaw;
}

/** Un-normalized values the interpreter uses for context-rich formatting */
export interface AliceNegativeSignalRaw {
  avgFirstKeystrokeMs: number;
  avgDurationMs: number;
  avgWordCount: number;
  avgCharsPerMinute: number;
  avgCommitmentRatio: number;
  avgPBurstLengthChars: number;
  latestCommitmentRatio: number | null;
  latestLargeDeletionCount: number | null;
  latestLargeDeletionChars: number | null;
  latestSmallDeletionCount: number | null;
  latestCharsPerMinute: number | null;
  latestPBurstLength: number | null;
  latestRevisionTiming: number | null;
  baselineCommitmentMean: number;
  baselineCommitmentStd: number;
  baselineCharsPerMinuteMean: number;
  baselineCharsPerMinuteStd: number;
}

/** The trait vector that defines the witness-form.
 *  Every value is 0.0–1.0. The AI sets these. The shader renders them. */
export interface WitnessTraits {
  // ─── Form ─────────────────────────────────
  topology: number;      // 0 = smooth sphere → 1 = fragmented shards
  faceting: number;      // 0 = organic curves → 1 = hard crystal planes
  stretch: number;       // 0 = compressed sphere → 1 = elongated/tendril
  hollowness: number;    // 0 = solid mass → 1 = shell/cavity
  symmetry: number;      // 0 = perfect radial → 1 = broken/chaotic
  scaleVariation: number;// 0 = uniform → 1 = regions of different size
  multiplicity: number;  // 0 = single monolith → 1 = shattered swarm
  fragility: number;     // 0 = indestructible → 1 = about to shatter (cracks, stress lines)

  // ─── Material ─────────────────────────────
  density: number;       // 0 = gaseous/diffuse → 1 = solid stone
  translucency: number;  // 0 = opaque matte → 1 = glass/crystal
  surface: number;       // 0 = polished → 1 = rough/eroded

  // ─── Light ────────────────────────────────
  internalLight: number; // 0 = dark/dead → 1 = deep glow from within
  colorDepth: number;    // 0 = monochrome → 1 = deep shifting hues
  iridescence: number;   // 0 = flat → 1 = prismatic/angle-dependent
  lightResponse: number; // 0 = absorbs all light → 1 = refracts/scatters light

  // ─── Movement ─────────────────────────────
  flow: number;          // 0 = frozen still → 1 = ferrofluid surface motion
  rhythm: number;        // 0 = constant → 1 = intense pulsing/breathing
  rotation: number;      // 0 = still → 1 = spinning violently

  // ─── Interaction with space ───────────────
  edgeCharacter: number; // 0 = sharp defined → 1 = dissolving into void
  atmosphere: number;    // 0 = clean edge, no aura → 1 = heavy halo/particles/distortion
  magnetism: number;     // 0 = inert → 1 = visibly warping space around it
  reactivity: number;    // 0 = stable/inert → 1 = volatile, about to change
  temperature: number;   // 0 = frozen/cold (blues, frost, brittle) → 1 = molten/hot (reds, embers, liquid)
  flexibility: number;   // 0 = rigid/stiff → 1 = elastic/rubbery/yielding
  storedEnergy: number;  // 0 = inert/spent → 1 = immense contained potential (compressed, charged, about to release)
  creationCost: number;  // 0 = casually assembled → 1 = required everything to exist (dense detail, sacrificial weight)
}

/** Full witness state — traits + metadata */
export interface WitnessState {
  traits: WitnessTraits;
  mass: number;             // overall scale, grows with entry count (0-1)
  thresholdDuration: number;
  thresholdCharacter: 'slow' | 'misaligned' | 'abrupt' | 'normal';
  entryCount: number;
  lastEntryDate: string | null;
  daysSinceLastEntry: number;
}

export const DEFAULT_TRAITS: WitnessTraits = {
  topology: 0.2,
  faceting: 0.1,
  stretch: 0.1,
  hollowness: 0.2,
  symmetry: 0.1,
  scaleVariation: 0.1,
  multiplicity: 0.0,
  fragility: 0.1,
  density: 0.2,
  translucency: 0.3,
  surface: 0.3,
  internalLight: 0.1,
  colorDepth: 0.1,
  iridescence: 0.0,
  lightResponse: 0.3,
  flow: 0.1,
  rhythm: 0.05,
  rotation: 0.0,
  edgeCharacter: 0.5,
  atmosphere: 0.1,
  magnetism: 0.0,
  reactivity: 0.1,
  temperature: 0.4,
  flexibility: 0.3,
  storedEnergy: 0.1,
  creationCost: 0.1,
};

export const DEFAULT_WITNESS: WitnessState = {
  traits: { ...DEFAULT_TRAITS },
  mass: 0.1,
  thresholdDuration: 8,
  thresholdCharacter: 'normal',
  entryCount: 0,
  lastEntryDate: null,
  daysSinceLastEntry: 0,
};

/** All trait keys for iteration */
export const TRAIT_KEYS: (keyof WitnessTraits)[] = [
  'topology', 'faceting', 'stretch', 'hollowness', 'symmetry',
  'scaleVariation', 'multiplicity', 'fragility',
  'density', 'translucency', 'surface',
  'internalLight', 'colorDepth', 'iridescence', 'lightResponse',
  'flow', 'rhythm', 'rotation',
  'edgeCharacter', 'atmosphere', 'magnetism', 'reactivity',
  'temperature', 'flexibility', 'storedEnergy', 'creationCost',
];
