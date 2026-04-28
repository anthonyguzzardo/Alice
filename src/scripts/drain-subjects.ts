/**
 * Drain pending offline computation for one or all subjects.
 *
 * Composes the routine backfill scripts (embeddings → signals → reconstruction
 * → daily-deltas → profile) over every active subject, or one when scoped via
 * `--subject-id N`. Each individual backfill is idempotent — sessions that
 * already have a derived row are skipped, so this script is safe to re-run.
 *
 * The contamination boundary forbids triggering these on prod when a subject
 * submits, so this is the operator's local-mode catch-up tool. Run with
 * `npm run dev:full` companions up (TEI on localhost:8090, ANTHROPIC_API_KEY
 * loaded for any LLM-dependent stages).
 *
 * Stage failures are non-fatal: one crashed stage doesn't block the next, and
 * the final summary lists per-stage / per-subject success. Exit code is 1 if
 * any stage failed so CI / shell pipelines can detect drift.
 *
 * Usage:
 *   npm run drain-subjects                            # all active subjects
 *   npm run drain-subjects -- --subject-id 2          # ash only
 *   npm run drain-subjects -- --skip embeddings       # skip TEI stage when down
 *   npm run drain-subjects -- --subject-id 2 --skip profile,daily-deltas
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import sql from '../lib/libDbPool.ts';

interface SubjectRow {
  subject_id: number;
  username: string;
  display_name: string | null;
  is_owner: boolean;
}

interface Stage {
  name: string;
  script: string;
}

const STAGES: readonly Stage[] = [
  { name: 'embeddings',     script: 'src/scripts/backfill-embeddings.ts' },
  { name: 'signals',        script: 'src/scripts/backfill-signals.ts' },
  { name: 'reconstruction', script: 'src/scripts/backfill-reconstruction.ts' },
  { name: 'daily-deltas',   script: 'src/scripts/backfill-daily-deltas.ts' },
  { name: 'profile',        script: 'src/scripts/backfill-profile.ts' },
] as const;

interface ParsedArgs {
  subjectId: number | null;
  skip: Set<string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  let subjectId: number | null = null;
  const skip = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    let value: string | undefined;

    if (a === '--subject-id' || a === '--subjectId') {
      value = argv[++i];
      const n = Number.parseInt(value ?? '', 10);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--subject-id requires a positive integer (got: ${value})`);
      }
      subjectId = n;
    } else if (a.startsWith('--subject-id=') || a.startsWith('--subjectId=')) {
      value = a.split('=', 2)[1];
      const n = Number.parseInt(value ?? '', 10);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--subject-id requires a positive integer (got: ${value})`);
      }
      subjectId = n;
    } else if (a === '--skip') {
      value = argv[++i];
      if (!value) throw new Error('--skip requires a comma-separated stage list');
      value.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => skip.add(s));
    } else if (a.startsWith('--skip=')) {
      value = a.split('=', 2)[1];
      if (!value) throw new Error('--skip requires a comma-separated stage list');
      value.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => skip.add(s));
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }

  for (const s of skip) {
    if (!STAGES.some((stage) => stage.name === s)) {
      throw new Error(`unknown stage: ${s}. valid: ${STAGES.map((st) => st.name).join(', ')}`);
    }
  }

  return { subjectId, skip };
}

function printHelp(): void {
  console.log('Usage: npm run drain-subjects [-- --subject-id N] [--skip A,B]');
  console.log('');
  console.log('Stages (run in order, each idempotent):');
  for (const s of STAGES) console.log(`  ${s.name.padEnd(16)} ${s.script}`);
}

async function listSubjects(scoped: number | null): Promise<SubjectRow[]> {
  if (scoped != null) {
    const rows = await sql`
      SELECT subject_id, username, display_name, is_owner
      FROM tb_subjects
      WHERE subject_id = ${scoped} AND is_active = TRUE
    ` as SubjectRow[];
    if (rows.length === 0) throw new Error(`subject ${scoped} not found or inactive`);
    return rows;
  }
  return await sql`
    SELECT subject_id, username, display_name, is_owner
    FROM tb_subjects
    WHERE is_active = TRUE
    ORDER BY is_owner DESC, subject_id ASC
  ` as SubjectRow[];
}

interface StageResult {
  subject: string;
  stage: string;
  ok: boolean;
  ms: number;
}

function runStage(scriptPath: string, subjectId: number, stageName: string): Promise<{ ok: boolean; ms: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn('npx', ['tsx', scriptPath, '--subject-id', String(subjectId)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    const prefix = `    [drain:${stageName}] `;
    let stdoutBuf = '';
    let stderrBuf = '';

    function flushLine(line: string, sink: NodeJS.WritableStream): void {
      // Skip the boilerplate line every backfill prints so the summary
      // stays signal-dense.
      if (/^\[script\] subject_id=/.test(line)) return;
      sink.write(prefix + line + '\n');
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      let idx: number;
      while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, idx);
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (line) flushLine(line, process.stdout);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      let idx: number;
      while ((idx = stderrBuf.indexOf('\n')) !== -1) {
        const line = stderrBuf.slice(0, idx);
        stderrBuf = stderrBuf.slice(idx + 1);
        if (line) flushLine(line, process.stderr);
      }
    });

    child.on('close', (code) => {
      if (stdoutBuf) flushLine(stdoutBuf, process.stdout);
      if (stderrBuf) flushLine(stderrBuf, process.stderr);
      resolve({ ok: code === 0, ms: Date.now() - start });
    });
    child.on('error', (err) => {
      console.error(prefix + 'spawn error: ' + (err as Error).message);
      resolve({ ok: false, ms: Date.now() - start });
    });
  });
}

async function main() {
  const { subjectId, skip } = parseArgs(process.argv.slice(2));
  console.log('[drain] start' + (subjectId != null ? ` (subject_id=${subjectId})` : ' (all active subjects)'));
  if (skip.size > 0) console.log(`[drain] skipping: ${[...skip].join(', ')}`);

  const subjects = await listSubjects(subjectId);
  console.log(`[drain] resolved ${subjects.length} subject${subjects.length === 1 ? '' : 's'}: ${subjects.map((s) => `${s.username}#${s.subject_id}`).join(', ')}`);

  const startedAt = Date.now();
  const results: StageResult[] = [];

  for (const subject of subjects) {
    const label = `${subject.display_name || subject.username} #${subject.subject_id}`;
    console.log(`\n[drain] ━━ ${label} ━━`);
    for (const stage of STAGES) {
      if (skip.has(stage.name)) {
        console.log(`  [${stage.name}] skipped (--skip)`);
        continue;
      }
      const { ok, ms } = await runStage(stage.script, subject.subject_id, stage.name);
      results.push({ subject: label, stage: stage.name, ok, ms });
      const tag = ok ? 'ok' : 'FAILED';
      console.log(`  → [${stage.name}] ${tag} (${(ms / 1000).toFixed(1)}s)`);
    }
  }

  const totalMs = Date.now() - startedAt;
  const failures = results.filter((r) => !r.ok);

  console.log(`\n[drain] done in ${(totalMs / 1000).toFixed(1)}s — ${results.length} stage runs, ${failures.length} failure${failures.length === 1 ? '' : 's'}`);
  if (failures.length > 0) {
    console.log('[drain] failures:');
    for (const f of failures) console.log(`  - ${f.subject} :: ${f.stage} (${(f.ms / 1000).toFixed(1)}s)`);
  }

  await sql.end({ timeout: 5 });
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('[drain] fatal:', err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(2);
});
