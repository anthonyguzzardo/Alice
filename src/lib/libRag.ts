/**
 * RAG retrieval — semantic similarity search with recency weighting.
 * Graceful degradation: returns empty when embeddings unavailable,
 * callers fall back to recency-only retrieval.
 */
import { generateEmbedding } from './libEmbeddings.ts';
import { searchVecEmbeddings } from './libDb.ts';

const SOURCE_TYPES: Record<string, number> = {
  response: 1,
  observation: 2,
  reflection: 3,
};

export interface RetrievedEntry {
  embeddingId: number;
  sourceType: 'response' | 'observation' | 'reflection';
  sourceRecordId: number;
  text: string;
  sourceDate: string | null;
  distance: number;
  adjustedScore: number;
}

export interface RetrievalOptions {
  topK?: number;
  sourceTypes?: ('response' | 'observation' | 'reflection')[];
  recencyHalfLifeDays?: number;
  recencyWeight?: number;
  excludeDates?: string[];
  candidateMultiplier?: number;
}

const SOURCE_ID_TO_TYPE: Record<number, 'response' | 'observation' | 'reflection'> = {
  1: 'response',
  2: 'observation',
  3: 'reflection',
};

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

export async function retrieveSimilar(
  subjectId: number,
  queryText: string,
  options?: RetrievalOptions
): Promise<RetrievedEntry[]> {
  const {
    topK = 10,
    sourceTypes,
    recencyHalfLifeDays = 30,
    recencyWeight = 0.3,
    excludeDates = [],
    candidateMultiplier = 3,
  } = options ?? {};

  const embedding = await generateEmbedding(queryText);
  if (!embedding) return [];

  const candidateK = candidateMultiplier * topK;
  const allowedSourceIds = sourceTypes
    ? new Set(sourceTypes.map(t => SOURCE_TYPES[t]))
    : null;
  const excludeDateSet = new Set(excludeDates);

  const candidates = await searchVecEmbeddings(subjectId, embedding, candidateK);

  const now = new Date();
  const scored: RetrievedEntry[] = [];

  for (const c of candidates) {
    if (allowedSourceIds && !allowedSourceIds.has(c.embedding_source_id)) continue;
    if (c.source_date && excludeDateSet.has(c.source_date)) continue;

    // pgvector returns L2 distance — lower is more similar
    // Normalize to a 0-1 similarity score (approximate)
    const similarity = 1 / (1 + c.distance);

    let recencyFactor = 1;
    if (c.source_date) {
      const days = daysBetween(c.source_date, now);
      recencyFactor = Math.exp(-0.693 * days / recencyHalfLifeDays);
    }

    const adjustedScore = (1 - recencyWeight) * similarity + recencyWeight * recencyFactor;

    scored.push({
      embeddingId: c.embedding_id,
      sourceType: SOURCE_ID_TO_TYPE[c.embedding_source_id] ?? 'response',
      sourceRecordId: c.source_record_id,
      text: c.embedded_text,
      sourceDate: c.source_date,
      distance: c.distance,
      adjustedScore,
    });
  }

  scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
  return scored.slice(0, topK);
}

export async function retrieveSimilarMulti(
  subjectId: number,
  queryTexts: string[],
  options?: RetrievalOptions
): Promise<RetrievedEntry[]> {
  if (queryTexts.length === 0) return [];

  const allResults: Map<number, RetrievedEntry> = new Map();

  for (const text of queryTexts) {
    const results = await retrieveSimilar(subjectId, text, {
      ...options,
      topK: (options?.topK ?? 10) * 2, // over-fetch per query, dedupe later
    });
    for (const entry of results) {
      const existing = allResults.get(entry.embeddingId);
      if (!existing || entry.adjustedScore > existing.adjustedScore) {
        allResults.set(entry.embeddingId, entry);
      }
    }
  }

  const deduped = Array.from(allResults.values());
  deduped.sort((a, b) => b.adjustedScore - a.adjustedScore);
  return deduped.slice(0, options?.topK ?? 10);
}

/**
 * Contrarian retrieval — finds entries that are LEAST similar to the given
 * query texts. Breaks the echo chamber by surfacing what the system has
 * been ignoring. Returns entries with the highest distance (lowest similarity)
 * from the current cluster.
 */
export async function retrieveContrarian(
  subjectId: number,
  queryTexts: string[],
  options?: RetrievalOptions
): Promise<RetrievedEntry[]> {
  const {
    topK = 3,
    sourceTypes,
    excludeDates = [],
  } = options ?? {};

  if (queryTexts.length === 0) return [];

  // Get embeddings for all query texts, use the average as the "cluster center"
  const embeddings: number[][] = [];
  for (const text of queryTexts) {
    const emb = await generateEmbedding(text);
    if (emb) embeddings.push(emb);
  }
  if (embeddings.length === 0) return [];

  // Average the embeddings to get the cluster center
  const dims = embeddings[0].length;
  const center = new Array(dims).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dims; i++) {
      center[i] += emb[i] / embeddings.length;
    }
  }

  // Fetch a large candidate pool using the center embedding
  // We want the MOST distant entries, so we over-fetch and take from the bottom
  const candidateK = Math.max(50, topK * 10);
  const allowedSourceIds = sourceTypes
    ? new Set(sourceTypes.map(t => SOURCE_TYPES[t]))
    : null;
  const excludeDateSet = new Set(excludeDates);

  const candidates = await searchVecEmbeddings(subjectId, center, candidateK);

  // Filter and take the MOST distant (last entries, since results are sorted by distance ASC)
  const filtered: RetrievedEntry[] = [];
  for (const c of candidates) {
    if (allowedSourceIds && !allowedSourceIds.has(c.embedding_source_id)) continue;
    if (c.source_date && excludeDateSet.has(c.source_date)) continue;

    filtered.push({
      embeddingId: c.embedding_id,
      sourceType: SOURCE_ID_TO_TYPE[c.embedding_source_id] ?? 'response',
      sourceRecordId: c.source_record_id,
      text: c.embedded_text,
      sourceDate: c.source_date,
      distance: c.distance,
      adjustedScore: c.distance, // higher distance = more contrarian = what we want
    });
  }

  // Sort by distance DESCENDING — most different first
  filtered.sort((a, b) => b.distance - a.distance);
  return filtered.slice(0, topK);
}
