import { describe, it, expect, afterAll } from 'vitest';
import sql from '../../src/lib/libDb.ts';
import {
  DYNAMICAL_FIELD_MAP,
  MOTOR_FIELD_MAP,
  PROCESS_FIELD_MAP,
  CROSS_SESSION_FIELD_MAP,
  NON_PIPELINE_COLUMNS,
  STRUCTURAL_COLUMNS,
} from '../../src/lib/libSignalFieldMaps.ts';

/**
 * Cross-check the field maps against the live DB schema. Each map declares
 * the camelCase ↔ snake_case correspondence used by libSignalPipeline when
 * persisting signal computations. If any map drifts from the schema, this
 * test fails — turning a typo that would silently null a column into a
 * loud CI failure.
 */

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

async function dbColumns(table: string): Promise<Set<string>> {
  const rows = await sql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'alice' AND table_name = ${table}
  `;
  return new Set(rows.map((r) => r.column_name));
}

function mappedColumns(map: Record<string, string>): Set<string> {
  // Skip sentinel values (e.g. `__not_persisted__` for rBurstSequences which
  // takes a different persistence path).
  return new Set(Object.values(map).filter((v) => !v.startsWith('__')));
}

describe('field maps stay in sync with the DB schema', () => {
  it('DYNAMICAL_FIELD_MAP matches tb_dynamical_signals columns', async () => {
    const dbCols = await dbColumns('tb_dynamical_signals');
    const mapCols = mappedColumns(DYNAMICAL_FIELD_MAP);
    const inMapNotDb = [...mapCols].filter((c) => !dbCols.has(c));
    expect(inMapNotDb).toEqual([]);
    const expectedMissing = [...NON_PIPELINE_COLUMNS, ...STRUCTURAL_COLUMNS];
    const inDbNotMap = [...dbCols].filter((c) => !mapCols.has(c) && !expectedMissing.includes(c));
    expect(inDbNotMap).toEqual([]);
  });

  it('MOTOR_FIELD_MAP matches tb_motor_signals columns', async () => {
    const dbCols = await dbColumns('tb_motor_signals');
    const mapCols = mappedColumns(MOTOR_FIELD_MAP);
    const inMapNotDb = [...mapCols].filter((c) => !dbCols.has(c));
    expect(inMapNotDb).toEqual([]);
    const expectedMissing = [...NON_PIPELINE_COLUMNS, ...STRUCTURAL_COLUMNS];
    const inDbNotMap = [...dbCols].filter((c) => !mapCols.has(c) && !expectedMissing.includes(c));
    expect(inDbNotMap).toEqual([]);
  });

  it('PROCESS_FIELD_MAP matches tb_process_signals columns', async () => {
    const dbCols = await dbColumns('tb_process_signals');
    const mapCols = mappedColumns(PROCESS_FIELD_MAP);
    const inMapNotDb = [...mapCols].filter((c) => !dbCols.has(c));
    expect(inMapNotDb).toEqual([]);
    const expectedMissing = [...NON_PIPELINE_COLUMNS, ...STRUCTURAL_COLUMNS];
    const inDbNotMap = [...dbCols].filter((c) => !mapCols.has(c) && !expectedMissing.includes(c));
    expect(inDbNotMap).toEqual([]);
  });

  it('CROSS_SESSION_FIELD_MAP matches tb_cross_session_signals columns', async () => {
    const dbCols = await dbColumns('tb_cross_session_signals');
    const mapCols = mappedColumns(CROSS_SESSION_FIELD_MAP);
    const inMapNotDb = [...mapCols].filter((c) => !dbCols.has(c));
    expect(inMapNotDb).toEqual([]);
    const expectedMissing = [...NON_PIPELINE_COLUMNS, ...STRUCTURAL_COLUMNS];
    const inDbNotMap = [...dbCols].filter((c) => !mapCols.has(c) && !expectedMissing.includes(c));
    expect(inDbNotMap).toEqual([]);
  });
});
