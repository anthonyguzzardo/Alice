/**
 * Cross-Session Signal Computation
 *
 * Signals that require comparing the current entry to prior entries.
 * These measure novelty, cognitive trajectory, and stability over time.
 *
 * Signals:
 *   selfPerplexity         — personal trigram model perplexity
 *   ncdTrajectory          — normalized compression distance at various lags
 *   vocabRecurrenceDecay   — Jaccard similarity decay rate
 *   digraphStability       — cosine similarity of digraph profiles
 *   textNetworkDensity     — co-occurrence graph density
 *   textNetworkCommunities — concept cluster count
 *   bridgingRatio          — proportion of bridging nodes
 */

import { gzipSync } from 'node:zlib';
import db from './db.ts';
import { STOPWORDS } from './word-lists.ts';

// ─── Types ──────────────────────────────────────────────────────────

export interface CrossSessionSignals {
  selfPerplexity: number | null;
  ncdLag1: number | null;
  ncdLag3: number | null;
  ncdLag7: number | null;
  ncdLag30: number | null;
  vocabRecurrenceDecay: number | null;
  digraphStability: number | null;
  textNetworkDensity: number | null;
  textNetworkCommunities: number | null;
  bridgingRatio: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z'\s-]/g, '').split(/\s+/).filter(w => w.length > 0);
}

function contentWords(text: string): Set<string> {
  return new Set(tokenize(text).filter(w => !STOPWORDS.has(w) && w.length > 2));
}

function getPriorTexts(currentQuestionId: number): Array<{ text: string; daysAgo: number }> {
  const rows = db.prepare(`
    SELECT r.text as text,
           CAST(julianday(q.scheduled_for) AS INTEGER) as jday
    FROM tb_responses r
    JOIN tb_questions q ON r.question_id = q.question_id
    WHERE r.question_id != ?
    ORDER BY q.scheduled_for DESC
  `).all(currentQuestionId) as Array<{ text: string; jday: number }>;

  if (rows.length === 0) return [];

  // Get current entry's julian day
  const currentRow = db.prepare(`
    SELECT CAST(julianday(q.scheduled_for) AS INTEGER) as jday
    FROM tb_questions q WHERE q.question_id = ?
  `).get(currentQuestionId) as { jday: number } | undefined;

  if (!currentRow) return [];

  return rows.map(r => ({
    text: r.text,
    daysAgo: currentRow.jday - r.jday,
  }));
}

// ─── Self-Perplexity (personal trigram model) ───────────────────────
// Build character trigram model from all prior entries, score today against it.
// Higher perplexity = more novel language relative to personal baseline.

function selfPerplexity(currentText: string, priorTexts: string[]): number | null {
  if (priorTexts.length < 5) return null; // need corpus to be meaningful

  // Build character trigram model from prior texts
  const counts = new Map<string, Map<string, number>>();
  const contextCounts = new Map<string, number>();

  for (const text of priorTexts) {
    const lower = text.toLowerCase();
    for (let i = 0; i < lower.length - 2; i++) {
      const context = lower.slice(i, i + 2);
      const next = lower[i + 2];

      if (!counts.has(context)) counts.set(context, new Map());
      const nextMap = counts.get(context)!;
      nextMap.set(next, (nextMap.get(next) ?? 0) + 1);
      contextCounts.set(context, (contextCounts.get(context) ?? 0) + 1);
    }
  }

  // Score current text
  const lower = currentText.toLowerCase();
  let logProb = 0;
  let n = 0;
  const smoothing = 0.01; // Laplace smoothing

  for (let i = 0; i < lower.length - 2; i++) {
    const context = lower.slice(i, i + 2);
    const next = lower[i + 2];

    const contextTotal = contextCounts.get(context) ?? 0;
    const nextCount = counts.get(context)?.get(next) ?? 0;

    // Smoothed probability
    const prob = (nextCount + smoothing) / (contextTotal + smoothing * 128); // 128 ~ ASCII printable
    logProb += Math.log2(prob);
    n++;
  }

  if (n === 0) return null;
  return Math.pow(2, -logProb / n); // perplexity
}

// ─── Normalized Compression Distance (Cilibrasi & Vitanyi 2005) ─────

function ncd(text1: string, text2: string): number | null {
  if (text1.length < 20 || text2.length < 20) return null;

  const c1 = gzipSync(Buffer.from(text1, 'utf-8')).length;
  const c2 = gzipSync(Buffer.from(text2, 'utf-8')).length;
  const c12 = gzipSync(Buffer.from(text1 + text2, 'utf-8')).length;

  const minC = Math.min(c1, c2);
  const maxC = Math.max(c1, c2);

  return maxC > 0 ? (c12 - minC) / maxC : null;
}

function ncdAtLag(
  currentText: string,
  priorTexts: Array<{ text: string; daysAgo: number }>,
  targetDays: number,
  tolerance: number = 1,
): number | null {
  // Find the entry closest to targetDays ago
  const closest = priorTexts.find(
    p => Math.abs(p.daysAgo - targetDays) <= tolerance
  );
  if (!closest) return null;
  return ncd(currentText, closest.text);
}

// ─── Vocabulary Recurrence Decay ────────────────────────────────────
// How quickly vocabulary similarity drops with time lag.

function vocabRecurrenceDecay(
  currentText: string,
  priorTexts: Array<{ text: string; daysAgo: number }>,
): number | null {
  const currentWords = contentWords(currentText);
  if (currentWords.size < 5) return null;

  // Compute Jaccard similarity at lags 1, 3, 7
  const lags = [1, 3, 7];
  const similarities: Array<{ lag: number; sim: number }> = [];

  for (const targetLag of lags) {
    const entry = priorTexts.find(p => Math.abs(p.daysAgo - targetLag) <= 1);
    if (!entry) continue;

    const priorWords = contentWords(entry.text);
    if (priorWords.size === 0) continue;

    let intersection = 0;
    for (const w of currentWords) {
      if (priorWords.has(w)) intersection++;
    }
    const union = new Set([...currentWords, ...priorWords]).size;
    similarities.push({ lag: targetLag, sim: union > 0 ? intersection / union : 0 });
  }

  if (similarities.length < 2) return null;

  // Fit exponential decay: sim = a * exp(-decay * lag)
  // In log space: log(sim) = log(a) - decay * lag
  const logPoints = similarities
    .filter(s => s.sim > 0)
    .map(s => ({ x: s.lag, y: Math.log(s.sim) }));

  if (logPoints.length < 2) return null;

  const n = logPoints.length;
  const xMean = logPoints.reduce((s, p) => s + p.x, 0) / n;
  const yMean = logPoints.reduce((s, p) => s + p.y, 0) / n;

  let num = 0, den = 0;
  for (const p of logPoints) {
    num += (p.x - xMean) * (p.y - yMean);
    den += (p.x - xMean) ** 2;
  }

  // Decay rate (negative slope = faster decay = more novel)
  return den > 0 ? -(num / den) : null;
}

// ─── Digraph Stability ──────────────────────────────────────────────
// Cosine similarity of today's digraph profile to rolling baseline.

function digraphStability(questionId: number): number | null {
  // Get current session's digraph profile
  const currentRow = db.prepare(
    `SELECT digraph_latency_json FROM tb_motor_signals WHERE question_id = ?`
  ).get(questionId) as { digraph_latency_json: string | null } | undefined;

  if (!currentRow?.digraph_latency_json) return null;

  // Get prior sessions' digraph profiles (last 5)
  const priorRows = db.prepare(`
    SELECT digraph_latency_json FROM tb_motor_signals
    WHERE question_id != ? AND digraph_latency_json IS NOT NULL
    ORDER BY motor_signal_id DESC LIMIT 5
  `).all(questionId) as Array<{ digraph_latency_json: string }>;

  if (priorRows.length < 2) return null;

  try {
    const current = JSON.parse(currentRow.digraph_latency_json) as Record<string, number>;

    // Build baseline: average of prior profiles
    const baseline = new Map<string, number[]>();
    for (const row of priorRows) {
      const profile = JSON.parse(row.digraph_latency_json) as Record<string, number>;
      for (const [key, val] of Object.entries(profile)) {
        if (!baseline.has(key)) baseline.set(key, []);
        baseline.get(key)!.push(val);
      }
    }

    const baselineMean: Record<string, number> = {};
    for (const [key, vals] of baseline) {
      baselineMean[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    // Cosine similarity between current and baseline
    const allKeys = new Set([...Object.keys(current), ...Object.keys(baselineMean)]);
    let dot = 0, normA = 0, normB = 0;
    for (const key of allKeys) {
      const a = current[key] ?? 0;
      const b = baselineMean[key] ?? 0;
      dot += a * b;
      normA += a * a;
      normB += b * b;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : null;
  } catch {
    return null;
  }
}

// ─── Text Network Density (InfraNodus methodology) ──────────────────
// Build co-occurrence graph, measure density and community structure.

interface GraphResult {
  density: number | null;
  communities: number | null;
  bridgingRatio: number | null;
}

function textNetworkAnalysis(text: string): GraphResult {
  const words = tokenize(text).filter(w => !STOPWORDS.has(w) && w.length > 2);
  if (words.length < 10) return { density: null, communities: null, bridgingRatio: null };

  // Build co-occurrence graph (window = 5)
  const edges = new Map<string, Set<string>>();
  const nodeDegree = new Map<string, number>();
  const windowSize = 5;

  for (let i = 0; i < words.length; i++) {
    if (!edges.has(words[i])) edges.set(words[i], new Set());

    for (let j = i + 1; j < Math.min(i + windowSize, words.length); j++) {
      if (words[i] === words[j]) continue;
      edges.get(words[i])!.add(words[j]);
      if (!edges.has(words[j])) edges.set(words[j], new Set());
      edges.get(words[j])!.add(words[i]);
    }
  }

  // Compute degree for each node
  for (const [node, neighbors] of edges) {
    nodeDegree.set(node, neighbors.size);
  }

  const nodes = edges.size;
  if (nodes < 3) return { density: null, communities: null, bridgingRatio: null };

  // Graph density = 2 * edges / (nodes * (nodes - 1))
  let totalEdges = 0;
  for (const neighbors of edges.values()) totalEdges += neighbors.size;
  totalEdges /= 2; // undirected
  const density = (2 * totalEdges) / (nodes * (nodes - 1));

  // Simple community detection: connected components via BFS
  const visited = new Set<string>();
  let communities = 0;

  for (const node of edges.keys()) {
    if (visited.has(node)) continue;
    communities++;
    const queue = [node];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const neighbor of edges.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
  }

  // Bridging ratio: nodes with degree in top 20% (high betweenness proxy)
  const degrees = [...nodeDegree.values()].sort((a, b) => b - a);
  const threshold = degrees[Math.floor(degrees.length * 0.2)] ?? 0;
  const bridgingNodes = [...nodeDegree.values()].filter(d => d >= threshold && d > 1).length;
  const bridgingRatio = nodes > 0 ? bridgingNodes / nodes : null;

  return { density, communities, bridgingRatio };
}

// ─── Public API ─────────────────────────────────────────────────────

export function computeCrossSessionSignals(
  questionId: number,
  currentText: string,
): CrossSessionSignals {
  const priorTexts = getPriorTexts(questionId);
  const priorTextStrings = priorTexts.map(p => p.text);

  const network = textNetworkAnalysis(currentText);

  return {
    selfPerplexity: selfPerplexity(currentText, priorTextStrings),
    ncdLag1: ncdAtLag(currentText, priorTexts, 1),
    ncdLag3: ncdAtLag(currentText, priorTexts, 3),
    ncdLag7: ncdAtLag(currentText, priorTexts, 7),
    ncdLag30: ncdAtLag(currentText, priorTexts, 30),
    vocabRecurrenceDecay: vocabRecurrenceDecay(currentText, priorTexts),
    digraphStability: digraphStability(questionId),
    textNetworkDensity: network.density,
    textNetworkCommunities: network.communities,
    bridgingRatio: network.bridgingRatio,
  };
}
