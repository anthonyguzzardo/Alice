/**
 * Embedding pipeline — Voyage AI embeddings stored in PostgreSQL via pgvector.
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
  isRecordEmbedded,
  getUnembeddedResponses,
} from './libDb.ts';

const VOYAGE_MODEL = 'voyage-3-lite';

const SOURCE_IDS = {
  response: 1,
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

async function storeEmbedding(
  sourceType: keyof typeof SOURCE_IDS,
  sourceRecordId: number,
  embeddedText: string,
  sourceDate: string | null,
  vector: number[]
): Promise<void> {
  const embeddingId = await insertEmbeddingMeta(
    SOURCE_IDS[sourceType],
    sourceRecordId,
    embeddedText,
    sourceDate,
    VOYAGE_MODEL,
    vector,
  );
  if (embeddingId === 0) return; // INSERT OR IGNORE — already exists
}

export async function embedResponse(
  responseId: number,
  questionText: string,
  responseText: string,
  sourceDate: string
): Promise<void> {
  if (await isRecordEmbedded(SOURCE_IDS.response, responseId)) return;
  const text = `Question: ${questionText}\nResponse: ${responseText}`;
  const vector = await generateEmbedding(text);
  if (!vector) return;
  await storeEmbedding('response', responseId, text, sourceDate, vector);
}

export async function backfillEmbeddings(): Promise<{ embedded: number; failed: number }> {
  let embedded = 0;
  let failed = 0;

  const unembeddedResponses = await getUnembeddedResponses();
  if (unembeddedResponses.length === 0) {
    console.log('[backfill] All records already embedded.');
    return { embedded: 0, failed: 0 };
  }
  console.log(`[backfill] ${unembeddedResponses.length} responses to embed`);

  for (let i = 0; i < unembeddedResponses.length; i += 20) {
    const batch = unembeddedResponses.slice(i, i + 20);
    const texts = batch.map(r => `Question: ${r.question}\nResponse: ${r.response}`);
    const vectors = await generateEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      if (vectors[j]) {
        await storeEmbedding('response', batch[j].response_id, texts[j], batch[j].date, vectors[j]!);
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

  return { embedded, failed };
}
