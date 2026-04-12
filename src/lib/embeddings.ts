/**
 * Embedding pipeline — Voyage AI embeddings stored in sqlite-vec.
 * All Voyage calls gracefully degrade: failures are logged, never fatal.
 */
import 'dotenv/config';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const voyageModule = require('voyageai') as typeof import('voyageai');
const { VoyageAIClient } = voyageModule;
type VoyageClient = InstanceType<typeof VoyageAIClient>;
import {
  insertEmbeddingMeta,
  insertVecEmbedding,
  isRecordEmbedded,
  getUnembeddedResponses,
  getUnembeddedObservations,
  getUnembeddedReflections,
} from './db.ts';

const VOYAGE_MODEL = 'voyage-3-lite';
const EMBEDDING_DIMENSIONS = 512;

const SOURCE_IDS = {
  response: 1,
  observation: 2,
  reflection: 3,
} as const;

let voyageClient: VoyageClient | null = null;

function getVoyageClient(): VoyageClient | null {
  if (voyageClient) return voyageClient;
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.warn('[embeddings] VOYAGE_API_KEY not set — embeddings disabled');
    return null;
  }
  voyageClient = new VoyageAIClient({ apiKey });
  return voyageClient;
}

function float32ToBuffer(arr: number[]): Buffer {
  const f32 = new Float32Array(arr);
  return Buffer.from(f32.buffer);
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getVoyageClient();
  if (!client) return null;

  try {
    const result = await withRetry(() => client.embed({
      input: [text],
      model: VOYAGE_MODEL,
    })) as { data?: Array<{ embedding?: number[] }> };
    return result.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error('[embeddings] Voyage API error:', err);
    return null;
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 2000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      // Voyage SDK: VoyageAIError has statusCode property
      // Also catch generic HTTP 429, 503, 529 and any rate/limit language
      const status = err?.statusCode ?? err?.status ?? 0;
      const message = String(err?.message ?? '').toLowerCase();
      const body = String(err?.body?.detail ?? '').toLowerCase();
      const isRetryable =
        status === 429 || status === 503 || status === 529 ||
        message.includes('rate') || message.includes('limit') || message.includes('overloaded') ||
        body.includes('rate') || body.includes('limit');

      if (!isRetryable || attempt === maxRetries) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt); // 2s, 4s, 8s, 16s, 32s
      console.warn(`[embeddings] Retryable error (status=${status}), waiting ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}

export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const client = getVoyageClient();
  if (!client) return texts.map(() => null);

  try {
    const result = await withRetry(() => client.embed({
      input: texts,
      model: VOYAGE_MODEL,
    })) as { data?: Array<{ embedding?: number[] }> };
    return texts.map((_, i) => result.data?.[i]?.embedding ?? null);
  } catch (err) {
    console.error('[embeddings] Voyage API batch error:', err);
    return texts.map(() => null);
  }
}

function storeEmbedding(
  sourceType: keyof typeof SOURCE_IDS,
  sourceRecordId: number,
  embeddedText: string,
  sourceDate: string | null,
  vector: number[]
): void {
  const embeddingId = insertEmbeddingMeta(
    SOURCE_IDS[sourceType],
    sourceRecordId,
    embeddedText,
    sourceDate,
    VOYAGE_MODEL
  );
  if (embeddingId === 0) return; // INSERT OR IGNORE — already exists
  insertVecEmbedding(embeddingId, float32ToBuffer(vector));
}

export async function embedResponse(
  responseId: number,
  questionText: string,
  responseText: string,
  sourceDate: string
): Promise<void> {
  if (isRecordEmbedded(SOURCE_IDS.response, responseId)) return;
  const text = `Question: ${questionText}\nResponse: ${responseText}`;
  const vector = await generateEmbedding(text);
  if (!vector) return;
  storeEmbedding('response', responseId, text, sourceDate, vector);
}

export async function embedObservation(
  observationId: number,
  observationText: string,
  sourceDate: string
): Promise<void> {
  if (isRecordEmbedded(SOURCE_IDS.observation, observationId)) return;
  const vector = await generateEmbedding(observationText);
  if (!vector) return;
  storeEmbedding('observation', observationId, observationText, sourceDate, vector);
}

export async function embedReflection(
  reflectionId: number,
  reflectionText: string,
  sourceDate: string
): Promise<void> {
  if (isRecordEmbedded(SOURCE_IDS.reflection, reflectionId)) return;
  const vector = await generateEmbedding(reflectionText);
  if (!vector) return;
  storeEmbedding('reflection', reflectionId, reflectionText, sourceDate, vector);
}

export async function backfillEmbeddings(): Promise<{ embedded: number; failed: number }> {
  let embedded = 0;
  let failed = 0;

  const unembeddedResponses = getUnembeddedResponses();
  const unembeddedObservations = getUnembeddedObservations();
  const unembeddedReflections = getUnembeddedReflections();

  const total = unembeddedResponses.length + unembeddedObservations.length + unembeddedReflections.length;
  if (total === 0) {
    console.log('[backfill] All records already embedded.');
    return { embedded: 0, failed: 0 };
  }
  console.log(`[backfill] ${total} records to embed (${unembeddedResponses.length} responses, ${unembeddedObservations.length} observations, ${unembeddedReflections.length} reflections)`);

  // Batch responses in groups of 20
  for (let i = 0; i < unembeddedResponses.length; i += 20) {
    const batch = unembeddedResponses.slice(i, i + 20);
    const texts = batch.map(r => `Question: ${r.question}\nResponse: ${r.response}`);
    const vectors = await generateEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      if (vectors[j]) {
        storeEmbedding('response', batch[j].response_id, texts[j], batch[j].date, vectors[j]!);
        embedded++;
      } else {
        failed++;
      }
    }
    if (i + 20 < unembeddedResponses.length) {
      await new Promise(r => setTimeout(r, 500)); // rate limit courtesy
    }
    console.log(`[backfill] Responses: ${Math.min(i + 20, unembeddedResponses.length)}/${unembeddedResponses.length}`);
  }

  // Batch observations
  for (let i = 0; i < unembeddedObservations.length; i += 20) {
    const batch = unembeddedObservations.slice(i, i + 20);
    const texts = batch.map(o => o.observation);
    const vectors = await generateEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      if (vectors[j]) {
        storeEmbedding('observation', batch[j].ai_observation_id, texts[j], batch[j].date, vectors[j]!);
        embedded++;
      } else {
        failed++;
      }
    }
    if (i + 20 < unembeddedObservations.length) {
      await new Promise(r => setTimeout(r, 500));
    }
    console.log(`[backfill] Observations: ${Math.min(i + 20, unembeddedObservations.length)}/${unembeddedObservations.length}`);
  }

  // Batch reflections
  for (let i = 0; i < unembeddedReflections.length; i += 20) {
    const batch = unembeddedReflections.slice(i, i + 20);
    const texts = batch.map(r => r.text);
    const vectors = await generateEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      if (vectors[j]) {
        storeEmbedding('reflection', batch[j].reflection_id, texts[j], batch[j].dttm_created_utc, vectors[j]!);
        embedded++;
      } else {
        failed++;
      }
    }
    if (i + 20 < unembeddedReflections.length) {
      await new Promise(r => setTimeout(r, 500));
    }
    console.log(`[backfill] Reflections: ${Math.min(i + 20, unembeddedReflections.length)}/${unembeddedReflections.length}`);
  }

  return { embedded, failed };
}
