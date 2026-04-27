/**
 * Embedding pipeline — Qwen3-Embedding-0.6B via TEI (CPU, FP32, deterministic).
 *
 * TEI outputs 1024-dim vectors (model native). This module truncates to 512
 * via Matryoshka and L2-renormalizes, matching the tb_embeddings vector(512) schema.
 *
 * TEI endpoint: http://localhost:8090/embed (configurable via ALICE_TEI_URL).
 * Model: Qwen/Qwen3-Embedding-0.6B, weights SHA-256:
 *   0437e45c94563b09e13cb7a64478fc406947a93cb34a7e05870fc8dcd48e23fd
 */
import 'dotenv/config';
import {
  insertEmbeddingMeta,
  isRecordEmbedded,
  getUnembeddedResponses,
  getActiveEmbeddingModelVersionId,
} from './libDb.ts';

const TEI_URL = process.env.ALICE_TEI_URL ?? 'http://localhost:8090';
const MATRYOSHKA_DIM = 512;
const MODEL_NAME = 'Qwen3-Embedding-0.6B';

/**
 * Fast probe of the local TEI server. Used by the signal worker to skip the
 * embed stage cleanly when running `npm run dev` (no embedder) instead of
 * spamming ECONNREFUSED stack traces. Pending embeds are drained later via
 * `npm run dev:full` + `npm run backfill`.
 */
export async function isTeiAvailable(timeoutMs = 500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const resp = await fetch(`${TEI_URL}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return resp.ok;
  } catch {
    return false;
  }
}

const SOURCE_IDS = {
  response: 1,
} as const;

function truncateAndNormalize(vec: number[], dim: number): number[] {
  const truncated = vec.slice(0, dim);
  const norm = Math.sqrt(truncated.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return truncated;
  return truncated.map(v => v / norm);
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const resp = await fetch(`${TEI_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text, truncate: true }),
    });
    if (!resp.ok) {
      console.error(`[embeddings] TEI error: ${resp.status} ${resp.statusText}`);
      return null;
    }
    const result = await resp.json() as number[][];
    const raw = result[0];
    if (!raw || raw.length === 0) return null;
    return truncateAndNormalize(raw, MATRYOSHKA_DIM);
  } catch (err) {
    console.error('[embeddings] TEI request failed:', err);
    return null;
  }
}

export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];

  const results: (number[] | null)[] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}

async function storeEmbedding(
  subjectId: number,
  sourceType: keyof typeof SOURCE_IDS,
  sourceRecordId: number,
  embeddedText: string,
  sourceDate: string | null,
  vector: number[],
  modelVersionId: number | null,
): Promise<void> {
  const embeddingId = await insertEmbeddingMeta(
    subjectId,
    SOURCE_IDS[sourceType],
    sourceRecordId,
    embeddedText,
    sourceDate,
    MODEL_NAME,
    vector,
    modelVersionId ?? undefined,
  );
  if (embeddingId === 0) return;
}

export async function embedResponse(
  subjectId: number,
  responseId: number,
  questionText: string,
  responseText: string,
  sourceDate: string
): Promise<void> {
  const modelVersionId = await getActiveEmbeddingModelVersionId();
  if (await isRecordEmbedded(SOURCE_IDS.response, responseId, modelVersionId ?? undefined)) return;
  const text = `Question: ${questionText}\nResponse: ${responseText}`;
  const vector = await generateEmbedding(text);
  if (!vector) return;
  await storeEmbedding(subjectId, 'response', responseId, text, sourceDate, vector, modelVersionId);
}

export async function backfillEmbeddings(subjectId: number): Promise<{ embedded: number; failed: number }> {
  let embedded = 0;
  let failed = 0;

  const modelVersionId = await getActiveEmbeddingModelVersionId();
  const unembeddedResponses = await getUnembeddedResponses(subjectId, modelVersionId ?? undefined);
  if (unembeddedResponses.length === 0) {
    console.log('[backfill] All records already embedded.');
    return { embedded: 0, failed: 0 };
  }
  console.log(`[backfill] ${unembeddedResponses.length} responses to embed`);

  for (const record of unembeddedResponses) {
    const text = `Question: ${record.question}\nResponse: ${record.response}`;
    const vector = await generateEmbedding(text);
    if (vector) {
      await storeEmbedding(subjectId, 'response', record.response_id, text, record.date, vector, modelVersionId);
      embedded++;
    } else {
      failed++;
    }
    if (embedded % 5 === 0) {
      console.log(`[backfill] Progress: ${embedded + failed}/${unembeddedResponses.length}`);
    }
  }

  return { embedded, failed };
}
