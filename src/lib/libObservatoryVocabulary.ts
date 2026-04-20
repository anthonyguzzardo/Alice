/**
 * Observatory Vocabulary · Translation Dictionary
 *
 * Single source of truth for all plain-English copy the Observatory emits.
 * The Observatory describes signals in translated vocabulary. It does NOT
 * describe the writer. See notes/observatory-narration-rules.md for the
 * full constraint specification.
 *
 * Rule: line 2 (deterministic trend fact, translated vocabulary) is permitted.
 *       line 3 (describes the writer's experience) is prohibited.
 */

// ── Minimum N thresholds ────────────────────────────────────────────
// Below these counts, the synthesis API suppresses the corresponding
// insight category and emits a low-N notice instead.
export const MIN_N_TRENDS = 8;
export const MIN_N_DEVIATIONS = 5;

// ── Dimension → plain English ───────────────────────────────────────
// Signal vocabulary, not experiential vocabulary.
export const DIM_PLAIN: Record<string, string> = {
  fluency: 'writing flow',
  deliberation: 'hesitation',
  revision: 'rewriting',
  commitment: 'commitment ratio',
  volatility: 'behavioral instability',
  thermal: 'correction intensity',
  presence: 'focus duration',
  syntactic_complexity: 'sentence complexity',
  interrogation: 'questioning',
  self_focus: 'self-reference',
  uncertainty: 'hedging',
  cognitive_processing: 'reasoning language',
  nrc_anger: 'anger language',
  nrc_fear: 'fear language',
  nrc_joy: 'joy language',
  nrc_sadness: 'sadness language',
  nrc_trust: 'trust language',
  nrc_anticipation: 'anticipation language',
};

// ── Deviation descriptions (high) ───────────────────────────────────
// What the SIGNAL did, not what the writer felt.
export const DIM_HIGH: Record<string, string> = {
  fluency: 'writing flow was unusually sustained',
  deliberation: 'hesitation was elevated',
  revision: 'rewriting was significantly above baseline',
  commitment: 'commitment ratio was unusually high — very little deleted',
  volatility: 'behavioral instability spiked relative to previous entry',
  thermal: 'correction intensity was unusually high',
  presence: 'focus duration was unusually sustained',
  syntactic_complexity: 'sentence complexity was elevated',
  interrogation: 'questioning rate was above baseline',
  self_focus: 'self-reference was elevated',
  uncertainty: 'hedging was elevated',
  cognitive_processing: 'reasoning language was elevated',
  nrc_anger: 'anger language was elevated',
  nrc_fear: 'fear language was elevated',
  nrc_joy: 'joy language was elevated',
  nrc_sadness: 'sadness language was elevated',
  nrc_trust: 'trust language was elevated',
  nrc_anticipation: 'anticipation language was elevated',
};

// ── Deviation descriptions (low) ────────────────────────────────────
export const DIM_LOW: Record<string, string> = {
  fluency: 'writing flow was fragmented — shorter bursts than baseline',
  deliberation: 'hesitation was unusually low',
  revision: 'rewriting was minimal',
  commitment: 'commitment ratio was low — significant deletion',
  volatility: 'behavioral instability was unusually low — consistent with previous entry',
  thermal: 'correction intensity was unusually low',
  presence: 'focus duration was below baseline',
  syntactic_complexity: 'sentence complexity was below baseline',
  interrogation: 'questioning rate was below baseline',
  self_focus: 'self-reference was below baseline',
  uncertainty: 'hedging was below baseline',
  cognitive_processing: 'reasoning language was below baseline',
  nrc_anger: 'anger language was below baseline',
  nrc_fear: 'fear language was below baseline',
  nrc_joy: 'joy language was below baseline',
  nrc_sadness: 'sadness language was below baseline',
  nrc_trust: 'trust language was below baseline',
  nrc_anticipation: 'anticipation language was below baseline',
};

// ── Trend verbs ─────────────────────────────────────────────────────
export const TREND_VERB = {
  rising: 'climbing',
  falling: 'declining',
} as const;

// ── Emotion → plain English (cross-domain couplings) ────────────────
export const EMO_PLAIN: Record<string, string> = {
  anger: 'anger language',
  fear: 'fear language',
  joy: 'joy language',
  sadness: 'sadness language',
  trust: 'trust language',
  anticipation: 'anticipation language',
  cognitive: 'reasoning language',
  hedging: 'hedging language',
  firstPerson: 'first-person pronouns',
};

// ── Convergence copy ────────────────────────────────────────────────
export const CONVERGENCE_HIGH = 'Multiple behavioral dimensions moved together — process signature shifted as a whole.';
export const CONVERGENCE_LOW = 'All dimensions near behavioral center today.';

// ── Low-N notices ───────────────────────────────────────────────────
export const LOW_N_DEVIATIONS = (n: number) =>
  `${n} entries recorded — deviation callouts activate at ${MIN_N_DEVIATIONS}+ entries when baseline stabilizes.`;
export const LOW_N_TRENDS = (n: number) =>
  `${n} entries recorded — trend detection activates at ${MIN_N_TRENDS}+ entries.`;

// ── Intensity marker ────────────────────────────────────────────────
export const RARE_PREFIX = 'Rare — ';

// ── Banned words ────────────────────────────────────────────────────
// These words must NEVER appear in Observatory synthesis output.
// A CI linter can grep for them. If you need to add a word to this
// list, also add why.
export const BANNED_WORDS = [
  'anxious',       // affective label
  'blocked',       // affective label
  'avoiding',      // causal attribution
  'struggling',    // experiential attribution
  'stressed',      // affective label
  'calm',          // affective label
  'overwhelmed',   // affective label
  'you seem',      // second-person psychological framing
  'you\'re becoming', // second-person psychological framing
  'you tend to',   // second-person psychological framing
  'feels harder',  // experiential attribution
  'getting easier', // experiential attribution
  'because',       // causal claim
  'driven by',     // causal claim
  'in response to', // causal claim
  'suggests that', // causal claim
  'try ',          // prescriptive
  'consider ',     // prescriptive
  'might want',    // prescriptive
  'should ',       // prescriptive
] as const;
