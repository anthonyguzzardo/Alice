/**
 * Emotion Profile Layer
 *
 * Loads stored NRC emotion densities + Pennebaker categories from
 * tb_session_summaries, computes personal percentiles, and discovers
 * emotion→behavior causal chains via lagged cross-correlations against
 * the 8D behavioral state history.
 *
 * This layer is SEPARATE from the behavioral state space by design.
 * The 8D state space measures HOW you write (motor, cognitive, editing).
 * Emotion densities measure WHAT emotion words you used (content).
 * Mixing them would create a conceptual impurity. Instead:
 *   - Emotion densities feed the visual renderer directly (art)
 *   - Emotion→behavior couplings are discovered separately (science)
 *   - Both inform the witness form without contaminating behavioral physics
 *
 * Research basis:
 *   NRC Emotion Lexicon — Mohammad & Turney (NRC Canada, 2013)
 *   Word category slopes — Pennebaker (2011), Tausczik & Pennebaker (2010)
 *   Cross-domain coupling — extends Critcher (Berkeley xLab) causal trait theories
 */

import db from '../db.ts';
import { avg, stddev, percentileRank } from './helpers.ts';
import { type EntryState, STATE_DIMENSIONS, type StateDimension } from './state-engine.ts';

// ─── Types ──────────────────────────────────────────────────────────

export const EMOTION_DIMENSIONS = [
  'anger', 'fear', 'joy', 'sadness', 'trust', 'anticipation',
  'cognitive', 'hedging', 'firstPerson',
] as const;

export type EmotionDimension = typeof EMOTION_DIMENSIONS[number];

export interface EmotionEntry {
  responseId: number;
  anger: number;
  fear: number;
  joy: number;
  sadness: number;
  trust: number;
  anticipation: number;
  cognitive: number;
  hedging: number;
  firstPerson: number;
}

export interface EmotionProfile {
  current: EmotionEntry | null;
  percentiles: Record<EmotionDimension, number>;
  deviations: Record<EmotionDimension, number>;
  dominantEmotion: EmotionDimension | null;
  emotionalIntensity: number; // sum of all 6 NRC densities
  emotionalDiversity: number; // Shannon entropy of NRC densities
}

export interface EmotionBehaviorCoupling {
  emotionDim: EmotionDimension;
  behaviorDim: StateDimension;
  lagSessions: number;
  correlation: number;
  direction: number; // +1 or -1
}

export interface EmotionAnalysis {
  profile: EmotionProfile;
  emotionBehaviorCoupling: EmotionBehaviorCoupling[];
  entryCount: number;
}

// ─── Configuration ──────────────────────────────────────────────────

const MIN_ENTRIES_FOR_COUPLING = 10;
const MAX_LAG = 3;
const COUPLING_THRESHOLD = 0.3;

// ─── Load emotion densities from DB ─────────────────────────────────

export function loadEmotionEntries(): EmotionEntry[] {
  const rows = db.prepare(`
    SELECT
       r.response_id
      ,ss.nrc_anger_density
      ,ss.nrc_fear_density
      ,ss.nrc_joy_density
      ,ss.nrc_sadness_density
      ,ss.nrc_trust_density
      ,ss.nrc_anticipation_density
      ,ss.cognitive_density
      ,ss.hedging_density
      ,ss.first_person_density
    FROM tb_session_summaries ss
    JOIN tb_responses r ON ss.question_id = r.question_id
    JOIN tb_questions q ON r.question_id = q.question_id
    ORDER BY ss.session_summary_id ASC
  `).all() as any[];

  return rows.map(row => ({
    responseId: row.response_id,
    anger: row.nrc_anger_density ?? 0,
    fear: row.nrc_fear_density ?? 0,
    joy: row.nrc_joy_density ?? 0,
    sadness: row.nrc_sadness_density ?? 0,
    trust: row.nrc_trust_density ?? 0,
    anticipation: row.nrc_anticipation_density ?? 0,
    cognitive: row.cognitive_density ?? 0,
    hedging: row.hedging_density ?? 0,
    firstPerson: row.first_person_density ?? 0,
  }));
}

// ─── Emotion Profile ────────────────────────────────────────────────

function computeEmotionProfile(entries: EmotionEntry[]): EmotionProfile {
  if (entries.length === 0) {
    const zeros = Object.fromEntries(EMOTION_DIMENSIONS.map(d => [d, 0])) as Record<EmotionDimension, number>;
    return {
      current: null,
      percentiles: { ...zeros },
      deviations: { ...zeros },
      dominantEmotion: null,
      emotionalIntensity: 0,
      emotionalDiversity: 0,
    };
  }

  const current = entries[entries.length - 1];

  // Personal percentiles and z-scores for each dimension
  const percentiles = {} as Record<EmotionDimension, number>;
  const deviations = {} as Record<EmotionDimension, number>;

  for (const dim of EMOTION_DIMENSIONS) {
    const allValues = entries.map(e => e[dim]);
    const currentVal = current[dim];
    percentiles[dim] = percentileRank(currentVal, allValues);

    const mean = avg(allValues);
    const std = stddev(allValues);
    deviations[dim] = std > 0.001 ? (currentVal - mean) / std : 0;
  }

  // Dominant NRC emotion (highest density in current entry)
  const nrcDims: EmotionDimension[] = ['anger', 'fear', 'joy', 'sadness', 'trust', 'anticipation'];
  let maxDensity = 0;
  let dominantEmotion: EmotionDimension | null = null;
  for (const dim of nrcDims) {
    if (current[dim] > maxDensity) {
      maxDensity = current[dim];
      dominantEmotion = dim;
    }
  }

  // Emotional intensity: sum of all 6 NRC densities
  const emotionalIntensity = nrcDims.reduce((sum, dim) => sum + current[dim], 0);

  // Emotional diversity: Shannon entropy of NRC densities (normalized 0-1)
  let emotionalDiversity = 0;
  if (emotionalIntensity > 0) {
    const maxEntropy = Math.log(nrcDims.length);
    for (const dim of nrcDims) {
      const p = current[dim] / emotionalIntensity;
      if (p > 1e-10) {
        emotionalDiversity -= p * Math.log(p);
      }
    }
    emotionalDiversity = maxEntropy > 0 ? emotionalDiversity / maxEntropy : 0;
  }

  return {
    current,
    percentiles,
    deviations,
    dominantEmotion,
    emotionalIntensity,
    emotionalDiversity,
  };
}

// ─── Signed Pearson (same as in dynamics.ts) ────────────────────────

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

// ─── Emotion→Behavior Cross-Correlation ─────────────────────────────
// Discovers causal chains between emotional word usage and behavioral
// state changes. E.g., "anger density spike → deliberation follows 2 entries later"

function discoverEmotionBehaviorCoupling(
  emotionEntries: EmotionEntry[],
  behaviorStates: EntryState[],
): EmotionBehaviorCoupling[] {
  // Align by index (both are ordered by session_summary_id ASC)
  const n = Math.min(emotionEntries.length, behaviorStates.length);
  if (n < MIN_ENTRIES_FOR_COUPLING) return [];

  const emotionSeries: Record<string, number[]> = {};
  for (const dim of EMOTION_DIMENSIONS) {
    emotionSeries[dim] = emotionEntries.slice(0, n).map(e => e[dim]);
  }

  const behaviorSeries: Record<string, number[]> = {};
  for (const dim of STATE_DIMENSIONS) {
    behaviorSeries[dim] = behaviorStates.slice(0, n).map(s => s[dim] as number);
  }

  const couplings: EmotionBehaviorCoupling[] = [];

  for (const eDim of EMOTION_DIMENSIONS) {
    for (const bDim of STATE_DIMENSIONS) {
      const eValues = emotionSeries[eDim];
      const bValues = behaviorSeries[bDim];

      if (n < MAX_LAG * 2 + 3) continue;

      let bestCorr = 0;
      let bestLag = 0;

      // Test positive lags only: emotion LEADS behavior
      // (We want to know: does emotion predict future behavior?)
      // Also test lag 0 for concurrent effects
      for (let lag = 0; lag <= MAX_LAG; lag++) {
        const end = n - lag;
        const a = eValues.slice(0, end);
        const b = bValues.slice(lag, lag + end);
        const r = signedPearson(a, b);
        if (Math.abs(r) > Math.abs(bestCorr)) {
          bestCorr = r;
          bestLag = lag;
        }
      }

      if (Math.abs(bestCorr) < COUPLING_THRESHOLD) continue;

      couplings.push({
        emotionDim: eDim,
        behaviorDim: bDim,
        lagSessions: bestLag,
        correlation: Math.abs(bestCorr),
        direction: bestCorr >= 0 ? 1 : -1,
      });
    }
  }

  couplings.sort((a, b) => b.correlation - a.correlation);
  return couplings;
}

// ─── Public API ─────────────────────────────────────────────────────

export function computeEmotionAnalysis(
  behaviorStates: EntryState[],
  emotionEntries?: EmotionEntry[],
): EmotionAnalysis {
  if (!emotionEntries) emotionEntries = loadEmotionEntries();

  const profile = computeEmotionProfile(emotionEntries);
  const emotionBehaviorCoupling = discoverEmotionBehaviorCoupling(emotionEntries, behaviorStates);

  return {
    profile,
    emotionBehaviorCoupling,
    entryCount: emotionEntries.length,
  };
}

// ─── Format for LLM renderer ────────────────────────────────────────

export function formatEmotionForRenderer(analysis: EmotionAnalysis): string {
  const lines: string[] = [];
  const { profile, emotionBehaviorCoupling } = analysis;

  lines.push('=== EMOTIONAL REGISTER (content signal, separate from behavioral dynamics) ===');

  if (!profile.current) {
    lines.push('No emotion data available.');
    return lines.join('\n');
  }

  // Current emotion profile with percentiles
  lines.push('Current entry emotion densities (word count / total words):');
  const nrcDims: EmotionDimension[] = ['anger', 'fear', 'joy', 'sadness', 'trust', 'anticipation'];
  for (const dim of nrcDims) {
    const val = profile.current[dim];
    const pct = profile.percentiles[dim];
    const dev = profile.deviations[dim];
    const devLabel =
      Math.abs(dev) >= 2.0 ? 'EXTREME' :
      Math.abs(dev) >= 1.5 ? 'notable' :
      Math.abs(dev) >= 1.0 ? 'mild' : 'normal';
    lines.push(
      `  ${dim.padEnd(14)} ${(val * 100).toFixed(1)}%  ` +
      `P${Math.round(pct * 100)}  ` +
      `${dev > 0 ? '+' : ''}${dev.toFixed(1)}σ (${devLabel})`
    );
  }

  lines.push('');
  lines.push('Pennebaker categories:');
  for (const dim of ['cognitive', 'hedging', 'firstPerson'] as EmotionDimension[]) {
    const val = profile.current[dim];
    const pct = profile.percentiles[dim];
    const dev = profile.deviations[dim];
    lines.push(
      `  ${dim.padEnd(14)} ${(val * 100).toFixed(1)}%  ` +
      `P${Math.round(pct * 100)}  ` +
      `${dev > 0 ? '+' : ''}${dev.toFixed(1)}σ`
    );
  }

  if (profile.dominantEmotion) {
    lines.push('');
    lines.push(`Dominant emotion: ${profile.dominantEmotion}`);
    lines.push(`Emotional intensity: ${(profile.emotionalIntensity * 100).toFixed(1)}% of words are emotion words`);
    lines.push(`Emotional diversity: ${profile.emotionalDiversity.toFixed(2)} (0=one emotion dominates, 1=evenly spread)`);
  }

  // Emotion→behavior couplings
  if (emotionBehaviorCoupling.length > 0) {
    lines.push('');
    lines.push('=== EMOTION → BEHAVIOR COUPLING (cross-domain, empirically discovered) ===');
    for (const c of emotionBehaviorCoupling.slice(0, 15)) { // Top 15
      const sign = c.direction > 0 ? '+' : '−';
      const lagLabel = c.lagSessions === 0 ? 'concurrent' : `${c.lagSessions}-entry lag`;
      lines.push(
        `  ${c.emotionDim} → ${c.behaviorDim}  ` +
        `r=${sign}${c.correlation.toFixed(2)}  (${lagLabel})`
      );
    }

    // Highlight active emotion→behavior effects
    const activeEffects = emotionBehaviorCoupling.filter(c => {
      const dev = profile.deviations[c.emotionDim];
      return Math.abs(dev) >= 1.0;
    });

    if (activeEffects.length > 0) {
      lines.push('');
      lines.push('Active emotion→behavior predictions:');
      for (const c of activeEffects) {
        const dev = profile.deviations[c.emotionDim];
        const dir = c.direction > 0 ? 'same direction' : 'opposite direction';
        const lagLabel = c.lagSessions === 0 ? 'concurrently' : `in ~${c.lagSessions} entries`;
        lines.push(
          `  ${c.emotionDim} deviated ${dev > 0 ? '+' : ''}${dev.toFixed(1)}σ → ` +
          `expect ${c.behaviorDim} to respond ${dir} ${lagLabel} (r=${c.correlation.toFixed(2)})`
        );
      }
    }
  }

  return lines.join('\n');
}
