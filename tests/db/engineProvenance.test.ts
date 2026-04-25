import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import sql, {
  upsertEngineProvenance,
  getEngineProvenanceById,
  stampEngineProvenance,
} from '../../src/lib/libDb.ts';

const SAMPLE_HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const QUESTION_ID = 9101;

const sampleInput = (overrides: Partial<Parameters<typeof upsertEngineProvenance>[0]> = {}) => ({
  binary_sha256: SAMPLE_HASH,
  code_commit_hash: 'deadbeef',
  cpu_model: 'Apple M1 Pro',
  host_arch: 'aarch64',
  target_cpu_flag: null,
  napi_rs_version: '3.6.2',
  rustc_version: 'rustc 1.85.0',
  ...overrides,
});

beforeAll(async () => {
  if (!process.env.ALICE_PG_URL?.includes('@')) {
    throw new Error('tests/db expected ALICE_PG_URL to be set by globalSetup');
  }
});

beforeEach(async () => {
  // Order matters: stamp tests insert into signal tables first; clean those.
  await sql`TRUNCATE tb_dynamical_signals, tb_motor_signals, tb_process_signals,
                    tb_cross_session_signals, tb_session_integrity, tb_reconstruction_residuals,
                    tb_engine_provenance RESTART IDENTITY`;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe('upsertEngineProvenance', () => {
  it('inserts a new row and returns its id', async () => {
    const id = await upsertEngineProvenance(sampleInput());
    expect(id).toBeGreaterThan(0);

    const row = await getEngineProvenanceById(id);
    expect(row).not.toBeNull();
    expect(row!.binary_sha256).toBe(SAMPLE_HASH);
    expect(row!.cpu_model).toBe('Apple M1 Pro');
  });

  it('is idempotent for the same (binary_sha256, cpu_model) pair', async () => {
    const a = await upsertEngineProvenance(sampleInput());
    const b = await upsertEngineProvenance(sampleInput());
    expect(a).toBe(b);

    const count = await sql`SELECT COUNT(*)::int AS n FROM tb_engine_provenance`;
    expect((count[0] as { n: number }).n).toBe(1);
  });

  it('creates a new row for the same binary on a different cpu_model', async () => {
    const a = await upsertEngineProvenance(sampleInput({ cpu_model: 'AMD EPYC 9654' }));
    const b = await upsertEngineProvenance(sampleInput({ cpu_model: 'AMD EPYC 7763' }));
    expect(a).not.toBe(b);
    // Same binary, different microarch can take different vectorized paths;
    // separate rows track this honestly.
  });

  it('creates a new row for a different binary even with the same cpu_model', async () => {
    const a = await upsertEngineProvenance(sampleInput({ binary_sha256: SAMPLE_HASH }));
    const b = await upsertEngineProvenance(sampleInput({ binary_sha256: OTHER_HASH }));
    expect(a).not.toBe(b);
  });

  it('preserves dttm_observed_first across re-upserts (does not bump on re-insert)', async () => {
    const id = await upsertEngineProvenance(sampleInput());
    const first = await getEngineProvenanceById(id);
    await new Promise((r) => setTimeout(r, 50));
    await upsertEngineProvenance(sampleInput());
    const second = await getEngineProvenanceById(id);
    expect(second!.dttm_observed_first.getTime()).toBe(first!.dttm_observed_first.getTime());
  });
});

describe('stampEngineProvenance', () => {
  async function insertDynamicalSignalRow(qid: number): Promise<void> {
    await sql`
      INSERT INTO tb_dynamical_signals (question_id, iki_count) VALUES (${qid}, 100)
    `;
  }

  async function insertSessionIntegrityRow(qid: number): Promise<void> {
    await sql`
      INSERT INTO tb_session_integrity (
         question_id, profile_distance, dimension_count, z_scores_json,
         is_flagged, threshold_used, profile_session_count
      ) VALUES (
        ${qid}, 1.0, 10, '[]'::jsonb, false, 3.5, 50
      )
    `;
  }

  async function getDynamicalProvenance(qid: number): Promise<number | null> {
    const rows = await sql`SELECT engine_provenance_id FROM tb_dynamical_signals WHERE question_id = ${qid}`;
    const row = rows[0] as { engine_provenance_id: number | null } | undefined;
    return row?.engine_provenance_id ?? null;
  }

  async function getIntegrityProvenance(qid: number): Promise<number | null> {
    const rows = await sql`SELECT engine_provenance_id FROM tb_session_integrity WHERE question_id = ${qid}`;
    const row = rows[0] as { engine_provenance_id: number | null } | undefined;
    return row?.engine_provenance_id ?? null;
  }

  it('stamps engine_provenance_id onto signal rows for the question', async () => {
    const provenanceId = await upsertEngineProvenance(sampleInput());
    await insertDynamicalSignalRow(QUESTION_ID);
    await insertSessionIntegrityRow(QUESTION_ID);

    expect(await getDynamicalProvenance(QUESTION_ID)).toBeNull();
    expect(await getIntegrityProvenance(QUESTION_ID)).toBeNull();

    await stampEngineProvenance(QUESTION_ID, provenanceId);

    expect(await getDynamicalProvenance(QUESTION_ID)).toBe(provenanceId);
    expect(await getIntegrityProvenance(QUESTION_ID)).toBe(provenanceId);
  });

  it('is idempotent — re-stamping the same provenance is a no-op', async () => {
    const provenanceId = await upsertEngineProvenance(sampleInput());
    await insertDynamicalSignalRow(QUESTION_ID);
    await stampEngineProvenance(QUESTION_ID, provenanceId);
    await stampEngineProvenance(QUESTION_ID, provenanceId);
    expect(await getDynamicalProvenance(QUESTION_ID)).toBe(provenanceId);
  });

  it('does NOT overwrite an existing provenance with a different id', async () => {
    // If a row was stamped with provenance A and we later try to stamp
    // provenance B (e.g. binary changed mid-replay), we keep A. This is the
    // honest record: that row was produced by binary A, not B.
    const a = await upsertEngineProvenance(sampleInput({ binary_sha256: SAMPLE_HASH }));
    const b = await upsertEngineProvenance(sampleInput({ binary_sha256: OTHER_HASH }));
    expect(a).not.toBe(b);

    await insertDynamicalSignalRow(QUESTION_ID);
    await stampEngineProvenance(QUESTION_ID, a);
    await stampEngineProvenance(QUESTION_ID, b); // attempt to overwrite
    expect(await getDynamicalProvenance(QUESTION_ID)).toBe(a);
  });

  it('only stamps rows for the given question_id', async () => {
    const provenanceId = await upsertEngineProvenance(sampleInput());
    await insertDynamicalSignalRow(QUESTION_ID);
    await insertDynamicalSignalRow(QUESTION_ID + 1);
    await stampEngineProvenance(QUESTION_ID, provenanceId);
    expect(await getDynamicalProvenance(QUESTION_ID)).toBe(provenanceId);
    expect(await getDynamicalProvenance(QUESTION_ID + 1)).toBeNull();
  });
});
