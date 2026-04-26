/**
 * Binary provenance for the Rust signal engine.
 *
 * Every signal row written by a Rust-derived compute path records an
 * `engine_provenance_id` linking back to a row in `tb_engine_provenance`
 * that identifies the specific (binary_sha256, cpu_model) pair that produced
 * the measurement. Without this link, the project's bit-identical
 * reproducibility claim cannot be verified post-hoc against any individual row.
 *
 * The provenance is captured once on first call (lazy) and cached
 * process-wide. The lookup is upsert-style: same (binary, cpu) returns the
 * existing id; new combinations get a new row.
 *
 * Why per-CPU-model and not per-host: the same binary on AMD EPYC Milan vs
 * Genoa can take different vectorized FP paths (Genoa supports AVX-512). The
 * production build pins to `target-cpu=x86-64-v3` to make this irrelevant for
 * x86 hosts, but the data model treats CPU model as a first-class part of
 * provenance for forward-compatibility.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { upsertEngineProvenance, type EngineProvenanceInput } from './libDb.ts';
import { BINARY_PATH } from './libSignalsNative.ts';
import { logError } from './utlErrorLog.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the .node binary that libSignalsNative actually loaded.
 * The provenance row records SHA-256 of *this* file, so the hash must match
 * the binary the engine is running with — not whichever .node happens to
 * live next to it on disk. If BINARY_PATH is null (unsupported platform),
 * provenance lookup will fail loudly when collectProvenance runs.
 */
const NODE_BINARY_PATH = BINARY_PATH
  ? resolve(__dirname, '..', '..', 'src-rs', BINARY_PATH)
  : null;

let cachedId: number | null = null;
let inflight: Promise<number | null> | null = null;

/**
 * Lazy, idempotent provenance lookup. First caller computes the hash + reads
 * cpuinfo, looks up or inserts the row, and caches the id. Subsequent callers
 * get the cached id immediately.
 *
 * Returns null if the engine binary cannot be hashed (e.g. .node file missing
 * because Rust isn't built). In that case signal saves should still proceed
 * with `engine_provenance_id = NULL` rather than blocking — a missing
 * provenance is better than a missing measurement.
 */
export async function getEngineProvenanceId(): Promise<number | null> {
  if (cachedId !== null) return cachedId;
  if (inflight) return inflight;
  inflight = lookupOrInsert().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function lookupOrInsert(): Promise<number | null> {
  let fields: EngineProvenanceInput;
  try {
    fields = collectProvenance();
  } catch (err) {
    logError('engineProvenance.collect', err);
    return null;
  }

  try {
    const id = await upsertEngineProvenance(fields);
    cachedId = id;
    return id;
  } catch (err) {
    logError('engineProvenance.upsert', err);
    return null;
  }
}

function collectProvenance(): EngineProvenanceInput {
  if (!NODE_BINARY_PATH) {
    throw new Error('no .node binary mapping for current platform/arch');
  }
  const binary_sha256 = sha256OfFile(NODE_BINARY_PATH);
  const cpu_model = readCpuModel();
  const host_arch = process.arch === 'arm64' ? 'aarch64' : process.arch;
  return {
    binary_sha256,
    code_commit_hash: readGitCommit(),
    cpu_model,
    host_arch,
    target_cpu_flag: process.env.RUSTFLAGS_TARGET_CPU ?? null,
    napi_rs_version: readNapiRsVersion(),
    rustc_version: readRustcVersion(),
  };
}

// ─── Pure helpers (unit-testable) ──────────────────────────────────────────

/**
 * Parse the CPU model name from `sysctl -n machdep.cpu.brand_string` (macOS)
 * or `/proc/cpuinfo` first `model name` line (Linux). Returns the raw string.
 *
 * Exported for testing.
 */
export function parseCpuinfoModelName(cpuinfo: string): string | null {
  for (const line of cpuinfo.split('\n')) {
    const match = /^model name\s*:\s*(.+)$/.exec(line.trim());
    if (match) return match[1]!.trim();
  }
  return null;
}

/**
 * SHA-256 of a file's contents, as a 64-character lowercase hex string.
 * Exported for testing.
 */
export function sha256OfFile(path: string): string {
  const buf = readFileSync(path);
  return createHash('sha256').update(buf).digest('hex');
}

// ─── Platform readers (intentionally non-throwing) ─────────────────────────

function readCpuModel(): string {
  try {
    if (process.platform === 'darwin') {
      return execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf-8' }).trim();
    }
    if (process.platform === 'linux' && existsSync('/proc/cpuinfo')) {
      const parsed = parseCpuinfoModelName(readFileSync('/proc/cpuinfo', 'utf-8'));
      if (parsed) return parsed;
    }
  } catch {
    // Fall through.
  }
  return `unknown-${process.arch}`;
}

function readGitCommit(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8', cwd: __dirname }).trim();
  } catch {
    return null;
  }
}

function readNapiRsVersion(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require(resolve(__dirname, '..', '..', 'node_modules', '@napi-rs', 'cli', 'package.json')) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

function readRustcVersion(): string | null {
  try {
    return execSync('rustc --version', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

// ─── Test-only reset (not exported in production paths) ────────────────────

/**
 * Clear the cached id and inflight promise. Tests that exercise the
 * lookup-or-insert path call this between assertions. Production code never
 * calls this; the cache is intended to live for the process lifetime.
 */
export function _resetForTests(): void {
  cachedId = null;
  inflight = null;
}
