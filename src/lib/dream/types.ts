// ─── Witness Types ──────────────────────────────────────────────────
// The Black Box is a single evolving presence in a threshold-space.
// These types define its state.

/** Raw signals from /api/blackbox */
export interface BlackboxSignal {
  avgCommitment: number;
  avgHesitation: number;
  deletionIntensity: number;
  pauseFrequency: number;
  sessionCount: number;
  observationCount: number;
  reflectionCount: number;
  suppressedCount: number;
  embeddingCount: number;
  latestConfidence: string | null;
  thematicDensity: number;
  landedRatio: number;
  feedbackCount: number;
}

/** The witness-form's current state — drives the mesh */
export interface WitnessState {
  // Form properties (0-1 unless noted)
  density: number;        // how much "there" is there — edge definition, surface detail
  coherence: number;      // how unified vs fragmented the form is
  asymmetry: number;      // how lopsided — driven by contradiction
  concavity: number;      // how many inward depressions — driven by suppression
  erosion: number;        // how dissolved the edges are — driven by evasion/low commitment
  mass: number;           // overall scale/weight — grows with entry count
  breathRate: number;     // seconds per oscillation cycle (15-30)
  breathDepth: number;    // how much the breathing displaces (0-1)

  // Threshold properties
  thresholdDuration: number;  // seconds before form becomes visible (3-15)
  thresholdCharacter: 'slow' | 'misaligned' | 'abrupt' | 'normal';

  // Meta
  entryCount: number;
  lastEntryDate: string | null;
  daysSinceLastEntry: number;
}

export const DEFAULT_WITNESS: WitnessState = {
  density: 0.1,
  coherence: 0.5,
  asymmetry: 0,
  concavity: 0,
  erosion: 0.8,
  mass: 0.1,
  breathRate: 25,
  breathDepth: 0.02,
  thresholdDuration: 8,
  thresholdCharacter: 'normal',
  entryCount: 0,
  lastEntryDate: null,
  daysSinceLastEntry: 0,
};
