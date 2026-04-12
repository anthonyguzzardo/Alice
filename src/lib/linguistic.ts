/**
 * Linguistic density computation for journal entries.
 *
 * Computes word category densities using:
 *   - NRC Emotion Lexicon v0.92 (Mohammad & Turney, 2013)
 *   - Cognitive mechanism words (Pennebaker LIWC)
 *   - Hedging words
 *   - First-person pronouns
 *
 * All densities are count/totalWords — comparable across entries of different lengths.
 * Slopes of these densities over time are the signal (Pennebaker, 2011).
 */

import { NRC_CATEGORIES, type NrcCategory } from './bob/nrc-emotions.ts';
import { COGNITIVE_WORDS, HEDGING_WORDS, FIRST_PERSON } from './bob/helpers.ts';

export interface LinguisticDensities {
  nrcAngerDensity: number;
  nrcFearDensity: number;
  nrcJoyDensity: number;
  nrcSadnessDensity: number;
  nrcTrustDensity: number;
  nrcAnticipationDensity: number;
  cognitiveDensity: number;
  hedgingDensity: number;
  firstPersonDensity: number;
}

/**
 * Single-pass computation of all word category densities for a text.
 */
export function computeLinguisticDensities(text: string): LinguisticDensities {
  const words = text.toLowerCase()
    .replace(/[^a-z'\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) {
    return {
      nrcAngerDensity: 0, nrcFearDensity: 0, nrcJoyDensity: 0,
      nrcSadnessDensity: 0, nrcTrustDensity: 0, nrcAnticipationDensity: 0,
      cognitiveDensity: 0, hedgingDensity: 0, firstPersonDensity: 0,
    };
  }

  const counts: Record<NrcCategory, number> = {
    anger: 0, fear: 0, joy: 0, sadness: 0, trust: 0, anticipation: 0,
  };
  let cogCount = 0;
  let hedgeCount = 0;
  let fpCount = 0;

  for (const word of words) {
    for (const cat of Object.keys(NRC_CATEGORIES) as NrcCategory[]) {
      if (NRC_CATEGORIES[cat].has(word)) counts[cat]++;
    }
    if (COGNITIVE_WORDS.has(word)) cogCount++;
    if (HEDGING_WORDS.has(word)) hedgeCount++;
    if (FIRST_PERSON.has(word)) fpCount++;
  }

  const n = words.length;
  return {
    nrcAngerDensity: counts.anger / n,
    nrcFearDensity: counts.fear / n,
    nrcJoyDensity: counts.joy / n,
    nrcSadnessDensity: counts.sadness / n,
    nrcTrustDensity: counts.trust / n,
    nrcAnticipationDensity: counts.anticipation / n,
    cognitiveDensity: cogCount / n,
    hedgingDensity: hedgeCount / n,
    firstPersonDensity: fpCount / n,
  };
}
