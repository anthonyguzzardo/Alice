/**
 * Extended Semantic Signal Computation
 *
 * Computes text-level signals from final response text using word lists
 * and information-theoretic measures. All deterministic math.
 *
 * Signals:
 *   ideaDensity           — Snowdon / Nun Study 1996: propositions per word
 *   lexicalSophistication — TAALES / Kyle 2017: mean word frequency rank
 *   epistemicStance        — Hyland 2005: booster / (booster + hedge) ratio
 *   integrativeComplexity  — Suedfeld & Tetlock: contrastive + integrative count
 *   deepCohesion           — Coh-Metrix: causal + temporal + intentional density
 *   referentialCohesion    — Coh-Metrix: content word overlap between sentences
 *   emotionalValenceArc    — Reagan et al. 2016: NRC valence shape in thirds
 *   textCompressionRatio   — Kolmogorov complexity proxy: gzip ratio
 */

import { gzipSync } from 'node:zlib';
import { NRC_CATEGORIES } from './libAliceNegative/libNrcEmotions.ts';
import {
  LEXICON_VERSION,
  BOOSTER_WORDS,
  CONTRASTIVE_CONNECTIVES,
  INTEGRATIVE_CONNECTIVES,
  CAUSAL_CONNECTIVES,
  TEMPORAL_CONNECTIVES,
  INTENTIONAL_CONNECTIVES,
  COMMON_VERBS,
  COMMON_ADJECTIVES,
  COMMON_ADVERBS,
  COMMON_PREPOSITIONS,
  COMMON_CONJUNCTIONS,
  STOPWORDS,
} from './utlWordLists.ts';
import { HEDGING_WORDS } from './libAliceNegative/libHelpers.ts';

// ─── Types ──────────────────────────────────────────────────────────

export interface SemanticSignals {
  ideaDensity: number | null;
  lexicalSophistication: number | null;
  epistemicStance: number | null;
  integrativeComplexity: number | null;
  deepCohesion: number | null;
  referentialCohesion: number | null;
  emotionalValenceArc: string | null;
  textCompressionRatio: number | null;
  lexiconVersion: number;
  pasteContaminated: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z'\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

function splitSentences(text: string): string[] {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
}

function contentWords(words: string[]): string[] {
  return words.filter(w => !STOPWORDS.has(w) && w.length > 2);
}

// ─── Idea Density (Snowdon et al. 1996, Nun Study) ──────────────────
// Propositions per word. Predicted Alzheimer's 58 years in advance.

function ideaDensity(words: string[]): number | null {
  if (words.length < 10) return null;

  let propCount = 0;
  for (const w of words) {
    if (COMMON_VERBS.has(w) || COMMON_ADJECTIVES.has(w) ||
        COMMON_ADVERBS.has(w) || COMMON_PREPOSITIONS.has(w) ||
        COMMON_CONJUNCTIONS.has(w)) {
      propCount++;
    }
  }
  return propCount / words.length;
}

// ─── Lexical Sophistication (Kyle & Crossley 2017, TAALES) ──────────
// Proportion of words NOT in the top-2000 most common. Higher = more
// sophisticated vocabulary deployment.

// Top 2000 most frequent English words (SUBTLEXus-derived)
// Using set membership rather than frequency ranks for simplicity.
// Words NOT in this set are considered "sophisticated."
const HIGH_FREQ_WORDS = new Set([
  ...STOPWORDS, ...COMMON_PREPOSITIONS, ...COMMON_CONJUNCTIONS,
  // Common nouns/misc that are very high frequency
  'time', 'people', 'way', 'day', 'man', 'woman', 'child', 'world',
  'life', 'hand', 'part', 'place', 'case', 'week', 'company', 'system',
  'program', 'question', 'work', 'government', 'number', 'night', 'point',
  'home', 'water', 'room', 'mother', 'area', 'money', 'story', 'fact',
  'month', 'lot', 'right', 'study', 'book', 'eye', 'job', 'word',
  'business', 'issue', 'side', 'kind', 'head', 'house', 'service',
  'friend', 'father', 'power', 'hour', 'game', 'line', 'end', 'member',
  'law', 'car', 'city', 'community', 'name', 'president', 'team',
  'minute', 'idea', 'body', 'information', 'back', 'parent', 'face',
  'others', 'level', 'office', 'door', 'health', 'person', 'art',
  'war', 'history', 'party', 'result', 'change', 'morning', 'reason',
  'research', 'girl', 'guy', 'moment', 'air', 'teacher', 'force',
  'education', 'thing', 'things', 'something', 'nothing', 'everything',
  'anything', 'someone', 'everyone', 'anyone', 'nobody', 'everybody',
  'another', 'each', 'every', 'both', 'few', 'many', 'much', 'more',
  'most', 'other', 'some', 'any', 'such', 'own', 'same', 'different',
  'first', 'last', 'second', 'third', 'next', 'new', 'old', 'good',
  'great', 'big', 'small', 'long', 'little', 'young', 'important',
  'right', 'wrong', 'best', 'better', 'bad', 'real', 'true', 'hard',
  'year', 'years', 'school', 'family', 'student', 'group', 'country',
  'problem', 'food', 'today', 'state', 'age', 'love', 'interest',
  'death', 'experience', 'sense', 'land', 'show', 'plan', 'support',
  'market', 'price', 'report', 'music', 'type', 'class', 'top', 'view',
  'form', 'course', 'development', 'role', 'rate', 'process', 'model',
  'table', 'news', 'order', 'sound', 'practice', 'piece', 'paper',
  'space', 'ground', 'effect', 'light', 'nature', 'value', 'amount',
  'base', 'step', 'field', 'local', 'heart', 'road', 'care', 'past',
  'action', 'future', 'site', 'half', 'street', 'language', 'energy',
  'rest', 'control', 'period', 'picture', 'note', 'growth',
  'help', 'talk', 'look', 'only', 'still', 'even', 'here', 'there',
  'where', 'now', 'well', 'enough', 'far', 'sure', 'ago',
]);

function lexicalSophistication(words: string[]): number | null {
  const content = contentWords(words);
  if (content.length < 5) return null;

  const sophisticatedCount = content.filter(w => !HIGH_FREQ_WORDS.has(w)).length;
  return sophisticatedCount / content.length;
}

// ─── Epistemic Stance (Hyland 2005) ─────────────────────────────────
// Booster / (booster + hedge) ratio. 0 = all hedging, 1 = all certainty.

function epistemicStance(words: string[]): number | null {
  if (words.length < 10) return null;

  let boosterCount = 0;
  let hedgeCount = 0;
  for (const w of words) {
    if (BOOSTER_WORDS.has(w)) boosterCount++;
    if (HEDGING_WORDS.has(w)) hedgeCount++;
  }

  const total = boosterCount + hedgeCount;
  if (total === 0) return null;
  return boosterCount / total;
}

// ─── Integrative Complexity (Suedfeld & Tetlock) ────────────────────
// Contrastive + integrative connective density per sentence.

function integrativeComplexity(words: string[], sentenceCount: number): number | null {
  if (sentenceCount < 2) return null;

  let contrastive = 0;
  let integrative = 0;
  for (const w of words) {
    if (CONTRASTIVE_CONNECTIVES.has(w)) contrastive++;
    if (INTEGRATIVE_CONNECTIVES.has(w)) integrative++;
  }

  return (contrastive + integrative) / sentenceCount;
}

// ─── Deep Cohesion (Coh-Metrix, McNamara et al.) ────────────────────
// Causal + temporal + intentional connective density.

function deepCohesion(words: string[]): number | null {
  if (words.length < 10) return null;

  let count = 0;
  for (const w of words) {
    if (CAUSAL_CONNECTIVES.has(w)) count++;
    if (TEMPORAL_CONNECTIVES.has(w)) count++;
    if (INTENTIONAL_CONNECTIVES.has(w)) count++;
  }

  return count / words.length;
}

// ─── Referential Cohesion (Coh-Metrix) ──────────────────────────────
// Content word overlap between adjacent sentences. Higher = more coherent.

function referentialCohesion(text: string): number | null {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return null;

  const sentenceContentWords = sentences.map(s =>
    new Set(contentWords(tokenize(s)))
  );

  let totalOverlap = 0;
  let validPairs = 0;
  for (let i = 1; i < sentenceContentWords.length; i++) {
    const prev = sentenceContentWords[i - 1];
    const curr = sentenceContentWords[i];
    if (prev.size === 0 || curr.size === 0) continue;

    validPairs++;
    let overlap = 0;
    for (const w of curr) {
      if (prev.has(w)) overlap++;
    }
    totalOverlap += overlap / Math.max(prev.size, curr.size);
  }

  if (validPairs === 0) return null;
  return totalOverlap / validPairs;
}

// ─── Emotional Valence Arc (Reagan et al. 2016) ─────────────────────
// NRC valence computed in thirds, classified into arc shape.

function emotionalValenceArc(text: string): string | null {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return null;

  // Balanced partition: distribute remainder across first thirds.
  // n=4 → [2,1,1], n=7 → [3,2,2], n=9 → [3,3,3].
  const base = Math.floor(sentences.length / 3);
  const remainder = sentences.length % 3;
  const s1 = base + (remainder >= 1 ? 1 : 0);
  const s2 = base + (remainder >= 2 ? 1 : 0);
  const thirds = [
    sentences.slice(0, s1).join(' '),
    sentences.slice(s1, s1 + s2).join(' '),
    sentences.slice(s1 + s2).join(' '),
  ];

  const valences = thirds.map(section => {
    const words = tokenize(section);
    if (words.length === 0) return 0;
    let pos = 0, neg = 0;
    for (const w of words) {
      if (NRC_CATEGORIES.joy.has(w) || NRC_CATEGORIES.trust.has(w)) pos++;
      if (NRC_CATEGORIES.anger.has(w) || NRC_CATEGORIES.fear.has(w) || NRC_CATEGORIES.sadness.has(w)) neg++;
    }
    return (pos - neg) / words.length;
  });

  const [v1, v2, v3] = valences;
  const rising = v3 > v1 + 0.01;
  const falling = v3 < v1 - 0.01;
  const midHigh = v2 > v1 && v2 > v3;
  const midLow = v2 < v1 && v2 < v3;

  if (midLow) return 'vee';           // man-in-hole
  if (midHigh) return 'peak';         // Icarus
  if (rising) return 'ascending';     // rags-to-riches
  if (falling) return 'descending';   // riches-to-rags
  return 'flat';
}

// ─── Text Compression Ratio (Kolmogorov complexity proxy) ───────────

function textCompressionRatio(text: string): number | null {
  if (text.length < 50) return null;

  const raw = Buffer.from(text, 'utf-8');
  const compressed = gzipSync(raw);
  return compressed.length / raw.length;
}

// ─── Discourse Global Coherence (Asgari et al. 2023) ────────────────
//
// Sentence-level embeddings via existing TEI infrastructure. Global
// coherence = mean cosine similarity of each sentence to the first.
// Local coherence = mean cosine similarity to preceding sentence.
// Global/local ratio and decay slope capture discourse structure.
// Minimum 5 sentences.

export interface DiscourseCoherence {
  globalCoherence: number | null;
  localCoherence: number | null;
  globalLocalRatio: number | null;
  coherenceDecaySlope: number | null;
}

export async function computeDiscourseCoherence(text: string): Promise<DiscourseCoherence> {
  const none: DiscourseCoherence = {
    globalCoherence: null,
    localCoherence: null,
    globalLocalRatio: null,
    coherenceDecaySlope: null,
  };

  const sentences = splitSentences(text).filter(s => s.trim().length > 10);
  if (sentences.length < 5) return none;

  // Dynamic import to avoid circular dependency
  const { generateEmbeddings } = await import('./libEmbeddings.ts');
  const embeddings = await generateEmbeddings(sentences);

  // Filter out failed embeddings
  const valid: Array<{ idx: number; vec: number[] }> = [];
  for (let i = 0; i < embeddings.length; i++) {
    if (embeddings[i]) valid.push({ idx: i, vec: embeddings[i]! });
  }
  if (valid.length < 5) return none;

  const cosine = (a: number[], b: number[]): number => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom > 1e-15 ? dot / denom : 0;
  };

  // Global coherence: cosine of each sentence to the first
  const firstVec = valid[0].vec;
  const globalSims: number[] = [];
  for (let i = 1; i < valid.length; i++) {
    globalSims.push(cosine(valid[i].vec, firstVec));
  }
  const globalCoherence = globalSims.reduce((s, v) => s + v, 0) / globalSims.length;

  // Local coherence: cosine of each sentence to the previous
  const localSims: number[] = [];
  for (let i = 1; i < valid.length; i++) {
    localSims.push(cosine(valid[i].vec, valid[i - 1].vec));
  }
  const localCoherence = localSims.reduce((s, v) => s + v, 0) / localSims.length;

  // Global/local ratio
  const globalLocalRatio = localCoherence > 1e-10 ? globalCoherence / localCoherence : null;

  // Coherence decay slope: linear regression of global similarity against position
  let coherenceDecaySlope: number | null = null;
  if (globalSims.length >= 3) {
    const n = globalSims.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += globalSims[i];
      sumXY += i * globalSims[i];
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    coherenceDecaySlope = denom > 1e-10 ? (n * sumXY - sumX * sumY) / denom : null;
  }

  return { globalCoherence, localCoherence, globalLocalRatio, coherenceDecaySlope };
}

// ─── Public API ─────────────────────────────────────────────────────

export function computeSemanticSignals(
  text: string,
  pasteCount: number = 0,
  dropCount: number = 0,
): SemanticSignals {
  const words = tokenize(text);
  const sentences = splitSentences(text);
  // paste_contaminated covers all external input vectors: paste and drag-and-drop.
  // Column name is historical; semantics = "any non-keystroke text entry attempted."
  const contaminated = pasteCount > 0 || dropCount > 0;

  return {
    ideaDensity: ideaDensity(words),
    lexicalSophistication: lexicalSophistication(words),
    epistemicStance: epistemicStance(words),
    integrativeComplexity: integrativeComplexity(words, sentences.length),
    deepCohesion: deepCohesion(words),
    referentialCohesion: referentialCohesion(text),
    emotionalValenceArc: emotionalValenceArc(text),
    textCompressionRatio: textCompressionRatio(text),
    lexiconVersion: LEXICON_VERSION,
    pasteContaminated: contaminated,
  };
}
