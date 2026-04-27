/**
 * Tests for the subject-scope lint rule (migration 030 Step 7).
 *
 * Three layers:
 *
 *   1. Fixture self-tests — synthetic source strings exercise every branch
 *      of the lint logic. These run without touching the filesystem and
 *      prove the rule actually catches what it claims to catch.
 *
 *   2. Codebase scan — runs the lint against `src/**` and `scripts/**`
 *      (excluding scripts/archive). Should report ZERO violations after
 *      step 7 lands. If a violation surfaces here, that is a real finding —
 *      the lint did its job.
 *
 *   3. Migration coverage check — every subject-bearing table named in
 *      migration 030 BLOCK 1 must appear in SUBJECT_BEARING_TABLES.
 *      Catches drift if a future migration adds a table to the unified
 *      set but forgets to update the lint.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  lintSource,
  lintCodebase,
  SUBJECT_BEARING_TABLES,
  type Violation,
} from './subjectScopeLint.ts';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');

// ----------------------------------------------------------------------------
// Layer 1: fixture self-tests
// ----------------------------------------------------------------------------
//
// Each fixture is a small synthetic source string. The lint is run against
// it and the result is compared to the expected violation set.

describe('subjectScopeLint — positive fixtures (must flag)', () => {
  it('flags a SELECT on tb_responses without subject_id', () => {
    const source = `
      export async function leaky(sql: any) {
        return await sql\`SELECT * FROM tb_responses WHERE response_id = 1\`;
      }
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_responses');
    expect(violations[0]!.tables).toEqual(['tb_responses']);
  });

  it('flags an UPDATE on tb_questions without subject_id', () => {
    const source = `
      await sql\`UPDATE tb_questions SET text = 'x' WHERE question_id = 5\`;
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_questions');
  });

  it('flags an INSERT INTO tb_session_summaries without subject_id', () => {
    const source = `
      await sql\`INSERT INTO tb_session_summaries (question_id, total_duration_ms) VALUES (1, 100)\`;
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_session_summaries');
  });

  it('flags a DELETE FROM tb_signal_jobs without subject_id', () => {
    const source = `
      await sql\`DELETE FROM tb_signal_jobs WHERE signal_job_id = 42\`;
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_signal_jobs');
  });

  it('flags a multi-table JOIN where neither side references subject_id', () => {
    const source = `
      await sql\`
        SELECT r.response_id, q.text
        FROM tb_responses r
        JOIN tb_questions q ON r.question_id = q.question_id
        WHERE q.question_source_id = 1
      \`;
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    // Both tables should be reported in the tables list.
    expect(violations[0]!.tables).toEqual(['tb_questions', 'tb_responses']);
  });

  it('flags an sql.unsafe call with a literal string against tb_motor_signals', () => {
    const source = `
      await sql.unsafe(\`UPDATE tb_motor_signals SET ex_gaussian_mu = 0 WHERE question_id = 1\`);
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_motor_signals');
  });

  it('flags every block independently when one is leaky and one is clean', () => {
    const source = `
      await sql\`SELECT * FROM tb_responses WHERE subject_id = 1\`;
      await sql\`SELECT * FROM tb_motor_signals WHERE question_id = 5\`;
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_motor_signals');
  });

  it('reports the source line of the offending block', () => {
    const source =
      'line1\n' +
      'line2\n' +
      'await sql`SELECT * FROM tb_responses WHERE x = 1`;\n' +
      'line4\n';
    const violations = lintSource('fixture.ts', source);
    expect(violations[0]!.line).toBe(3);
  });

  it('flags case-insensitively (lowercase select/from)', () => {
    const source = `
      await sql\`select * from tb_responses where x = 1\`;
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_responses');
  });
});

describe('subjectScopeLint — negative fixtures (must NOT flag)', () => {
  it('passes a SELECT on tb_responses with subject_id in the WHERE', () => {
    const source = `
      await sql\`SELECT * FROM tb_responses WHERE subject_id = 1\`;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('passes a JOIN where subject_id is on the joined parent', () => {
    const source = `
      await sql\`
        SELECT r.response_id, q.text
        FROM tb_responses r
        JOIN tb_questions q ON r.question_id = q.question_id
        WHERE q.subject_id = 1
      \`;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('passes when subject_id appears in an interpolated placeholder', () => {
    const source = `
      const subjectId = 1;
      await sql\`SELECT * FROM tb_responses WHERE subject_id = \${subjectId}\`;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('ignores queries against tables not in SUBJECT_BEARING_TABLES', () => {
    const source = `
      await sql\`SELECT * FROM tb_question_corpus WHERE corpus_question_id = 1\`;
      await sql\`SELECT * FROM tb_engine_provenance WHERE engine_provenance_id = 1\`;
      await sql\`SELECT * FROM tb_paper_comments WHERE paper_slug = 'x'\`;
      await sql\`SELECT * FROM tb_subscribers WHERE email = 'x'\`;
      await sql\`SELECT * FROM tb_subjects WHERE subject_id = 1\`;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('ignores tagged template literals that do not contain a SQL FROM/JOIN', () => {
    const source = `
      const msg = \`saw tb_responses leak in production\`;
      console.log(\`bad query touched tb_questions\`);
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('ignores comments that mention a table name', () => {
    const source = `
      // we want to read FROM tb_responses but
      /* the SELECT FROM tb_motor_signals query lives elsewhere */
      const x = 1;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('ignores string literals (not template literals) mentioning table names', () => {
    const source = `
      const errmsg = "no row in tb_responses; expected SELECT FROM tb_responses returns";
      const ident = 'FROM tb_motor_signals';
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('handles nested template literals inside placeholders', () => {
    // This pattern appears in libDb.getUnembeddedResponses — the conditional
    // sql fragment with embeddingModelVersionId. Subject_id is on the outer
    // query; the lint must see it.
    const source = `
      const filter = true;
      await sql\`
        SELECT 1 FROM tb_embeddings e
        JOIN tb_responses r ON r.response_id = e.source_record_id
        JOIN tb_questions q ON q.question_id = r.question_id
        WHERE q.subject_id = 1
          \${filter ? sql\`AND e.embedding_model_version_id = 2\` : sql\`\`}
      \`;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });
});

describe('subjectScopeLint — exemption mechanism', () => {
  it('skips a file with the file-level disable marker', () => {
    const source = `
      // alice-lint-disable-file subject-scope -- this file is test infrastructure
      await sql\`SELECT * FROM tb_responses\`;
      await sql\`SELECT * FROM tb_motor_signals\`;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('rejects a file-level disable without a -- reason', () => {
    const source = `
      // alice-lint-disable-file subject-scope
      await sql\`SELECT * FROM tb_responses\`;
    `;
    // No reason → marker is ignored → violation fires.
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
  });

  it('skips a single block with the next-query disable marker', () => {
    const source = `
      // alice-lint-disable-next-query subject-scope -- PK lookup, question_id is globally unique
      await sql\`SELECT 1 FROM tb_questions WHERE question_id = 5\`;
      await sql\`SELECT * FROM tb_responses\`;  // this should still fire
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_responses');
  });

  it('rejects a next-query disable without a -- reason', () => {
    const source = `
      // alice-lint-disable-next-query subject-scope
      await sql\`SELECT 1 FROM tb_questions WHERE question_id = 5\`;
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
  });

  it('allows a comment between the marker and the SQL block', () => {
    const source = `
      // alice-lint-disable-next-query subject-scope -- worker queue PK lookup
      // pull the next claimable job
      await sql\`SELECT * FROM tb_signal_jobs WHERE signal_job_status_id = 1\`;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('rejects a marker that is broken by intervening code', () => {
    const source = `
      // alice-lint-disable-next-query subject-scope -- intended for the second query
      const x = 1;
      await sql\`SELECT * FROM tb_responses\`;
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
  });

  it('allows blank lines between the marker and the SQL block', () => {
    const source = `
      // alice-lint-disable-next-query subject-scope -- PK lookup

      await sql\`SELECT 1 FROM tb_questions WHERE question_id = 5\`;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('skips every block inside a disable/enable range', () => {
    const source = `
      // alice-lint-disable subject-scope -- composite key globally unique
      const rows = flag
        ? await sql\`SELECT 1 FROM tb_responses WHERE response_id = 1\`
        : await sql\`SELECT 1 FROM tb_responses WHERE response_id = 2\`;
      // alice-lint-enable subject-scope
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });

  it('flags a block AFTER a closed range', () => {
    const source = `
      // alice-lint-disable subject-scope -- exempt
      await sql\`SELECT 1 FROM tb_responses\`;
      // alice-lint-enable subject-scope
      await sql\`SELECT 2 FROM tb_motor_signals\`;
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_motor_signals');
  });

  it('flags a block BEFORE a disable range opens', () => {
    const source = `
      await sql\`SELECT 1 FROM tb_motor_signals\`;
      // alice-lint-disable subject-scope -- exempt below
      await sql\`SELECT 2 FROM tb_responses\`;
      // alice-lint-enable subject-scope
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.table).toBe('tb_motor_signals');
  });

  it('rejects a range disable without a -- reason', () => {
    const source = `
      // alice-lint-disable subject-scope
      await sql\`SELECT 1 FROM tb_responses\`;
      // alice-lint-enable subject-scope
    `;
    const violations = lintSource('fixture.ts', source);
    expect(violations).toHaveLength(1);
  });

  it('treats a disable without a closing enable as covering rest of file', () => {
    const source = `
      // alice-lint-disable subject-scope -- exempt for rest of file
      await sql\`SELECT 1 FROM tb_responses\`;
      await sql\`SELECT 2 FROM tb_motor_signals\`;
    `;
    expect(lintSource('fixture.ts', source)).toHaveLength(0);
  });
});

describe('subjectScopeLint — every subject-bearing table is checked', () => {
  it('catches a violation for every table in SUBJECT_BEARING_TABLES', () => {
    // Dynamically generate one violation per table by emitting a small SQL
    // block per table. This guards against the lint silently dropping a
    // table from its check list.
    const tables = [...SUBJECT_BEARING_TABLES].sort();
    const sources = tables.map(t => `await sql\`SELECT * FROM ${t} WHERE x = 1\`;`).join('\n');
    const violations = lintSource('fixture.ts', sources);
    const flagged = new Set(violations.map(v => v.table));
    for (const t of tables) {
      expect(flagged.has(t), `expected lint to flag a query against ${t}`).toBe(true);
    }
  });
});

// ----------------------------------------------------------------------------
// Layer 2: codebase scan
// ----------------------------------------------------------------------------

describe('subjectScopeLint — codebase scan', () => {
  it('reports zero violations across src/ and scripts/', () => {
    const violations = lintCodebase(['src', 'scripts'], { repoRoot: REPO_ROOT });
    if (violations.length > 0) {
      // Format clearly so the failing test output is actionable.
      const lines = violations.map(formatViolation);
      throw new Error(
        `subject-scope lint found ${violations.length} violation(s):\n\n` +
          lines.join('\n\n'),
      );
    }
    expect(violations).toEqual([]);
  });
});

function formatViolation(v: Violation): string {
  return `${v.file}:${v.line}\n  tables: ${v.tables.join(', ')}\n  ${v.reason}\n  ${v.snippet}`;
}

// ----------------------------------------------------------------------------
// Layer 3: migration ↔ lint drift check
// ----------------------------------------------------------------------------
//
// Parse migration 030 BLOCK 1 to extract the canonical list of tables that
// gained subject_id. SUBJECT_BEARING_TABLES must be a superset (it also
// includes tb_signal_jobs, which had subject_id since migration 027).
//
// If a future migration adds a behavioral table to the unified set but the
// engineer forgets to update the lint, this test fails loudly.

// Tables that migration 030 touched but have since been archived to
// zz_archive_* via a later migration. The lint does NOT cover these because
// no application code should be querying them anymore. When a new table is
// archived, drop it from SUBJECT_BEARING_TABLES and add it here in the same
// commit as the archive migration.
const ARCHIVED_SINCE_030 = new Set<string>([
  'tb_witness_states',  // archived via migration 033 (2026-04-27, INC-014)
]);

describe('subjectScopeLint — migration drift', () => {
  it('SUBJECT_BEARING_TABLES covers every BLOCK 1 table in migration 030 (excluding archived)', () => {
    const migrationPath = resolve(REPO_ROOT, 'db', 'sql', 'migrations', '030_unify_subject_id.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    // Extract the BLOCK 1 region (between the BLOCK 1 header and BLOCK 2).
    const blockStart = sql.indexOf('BLOCK 1');
    const blockEnd = sql.indexOf('BLOCK 2');
    expect(blockStart).toBeGreaterThan(-1);
    expect(blockEnd).toBeGreaterThan(blockStart);

    const block1 = sql.slice(blockStart, blockEnd);
    const matches = [
      ...block1.matchAll(/ALTER\s+TABLE\s+(tb_[a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+subject_id\b/gi),
    ];
    const block1Tables = matches.map(m => m[1]!);

    expect(block1Tables.length).toBeGreaterThan(0);

    for (const t of block1Tables) {
      if (ARCHIVED_SINCE_030.has(t)) continue;
      expect(
        SUBJECT_BEARING_TABLES.has(t),
        `migration 030 adds subject_id to ${t} but the lint does not check it`,
      ).toBe(true);
    }
  });
});
