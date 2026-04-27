/**
 * Confound Analysis: Tasks A-D
 *
 * A: Length-matched recomputation of the dynamical inversion
 * B: Time-of-day sensitivity check
 * C: Pause and burst structure comparison (length-matched)
 * D: Day-of-week and within-day ordering
 *
 * Run: npx tsx src/scripts/confound-analysis.ts
 */
import sql from '../lib/libDbPool.ts';
import { getKeystrokeStreamJson } from '../lib/libDb.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';
import { BINARY_PATH } from '../lib/libSignalsNative.ts';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// ─── Load Rust engine ───────────────────────────────────────────────
//
// Resolve the binary filename per process.platform/arch via the canonical
// helper in libSignalsNative; never hardcode `darwin-arm64.node` here. The
// previous hardcode caused the linked Step 6 hotspot K test to fail on
// Linux CI (where the binary is `linux-x64-gnu.node`) and would silently
// disable this script on any non-darwin-arm64 host.

interface NativeModule {
  computeDynamicalSignals(streamJson: string): Record<string, unknown>;
}

const require = createRequire(import.meta.url);
let native: NativeModule;
try {
  if (!BINARY_PATH) {
    throw new Error(`Unsupported platform/arch: ${process.platform}/${process.arch}`);
  }
  native = require(`../../src-rs/${BINARY_PATH}`) as NativeModule;
} catch {
  console.error('FATAL: Rust engine not available. Run npm run build:rust first.');
  process.exit(1);
}

// ─── Stats helpers ──────────────────────────────────────────────────

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function sdFn(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function percentile(vals: number[], p: number): number {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (idx - lo) * (sorted[hi]! - sorted[lo]!);
}

function iqr(vals: number[]): number {
  return percentile(vals, 75) - percentile(vals, 25);
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327;
  const p = d * Math.exp(-x * x / 2) * (t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));
  return x >= 0 ? 1 - p : p;
}

function normalQuantile(p: number): number {
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  if (p === 0.5) return 0;
  const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
  const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  const z = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
  return p < 0.5 ? -z : z;
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const mx = mean(x);
  const my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom > 1e-15 ? num / denom : 0;
}

function linreg(x: number[], y: number[]): { slope: number; intercept: number; r: number; rSq: number; p: number } {
  const n = x.length;
  if (n < 3) return { slope: 0, intercept: 0, r: 0, rSq: 0, p: 1 };
  const r = pearsonR(x, y);
  const mx = mean(x);
  const my = mean(y);
  const sdx = sdFn(x);
  const sdy = sdFn(y);
  const slope = sdx > 1e-15 ? r * (sdy / sdx) : 0;
  const intercept = my - slope * mx;
  const rSq = r * r;
  // t-test for slope significance
  const t = n > 2 ? r * Math.sqrt((n - 2) / (1 - rSq + 1e-15)) : 0;
  const p = n > 2 ? 2 * (1 - normalCDF(Math.abs(t))) : 1;
  return { slope, intercept, r, rSq, p };
}

// ─── Hedges' g_z with BCa (reused from Phase 1) ────────────────────

function hedgesCorrection(n: number): number {
  return 1 - 3 / (4 * (n - 1) - 1);
}

function computeHedgesGz(deltas: number[], nBoot: number = 1000): { gz: number; ciLow: number; ciHigh: number; ciExcludesZero: boolean; meanDelta: number } {
  const n = deltas.length;
  if (n < 3) return { gz: 0, ciLow: 0, ciHigh: 0, ciExcludesZero: false, meanDelta: n > 0 ? mean(deltas) : 0 };

  const m = mean(deltas);
  const s = sdFn(deltas);
  const dz = s > 1e-15 ? m / s : 0;
  const J = hedgesCorrection(n);
  const gz = dz * J;

  let seed = 42;
  const nextRand = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };

  const bootMeans: number[] = [];
  for (let b = 0; b < nBoot; b++) {
    const sample: number[] = [];
    for (let i = 0; i < n; i++) sample.push(deltas[Math.floor(nextRand() * n)]!);
    const bm = mean(sample);
    const bs = sdFn(sample);
    bootMeans.push(bs > 1e-15 ? (bm / bs) * J : 0);
  }
  bootMeans.sort((a, b) => a - b);

  const propBelow = bootMeans.filter(v => v < gz).length / nBoot;
  const z0 = normalQuantile(propBelow);

  const jackValues: number[] = [];
  for (let i = 0; i < n; i++) {
    const jk = [...deltas.slice(0, i), ...deltas.slice(i + 1)];
    const jm = mean(jk);
    const js = sdFn(jk);
    jackValues.push(js > 1e-15 ? (jm / js) * hedgesCorrection(n - 1) : 0);
  }
  const jackMean = mean(jackValues);
  const sumDiffSq = jackValues.reduce((s, v) => s + (jackMean - v) ** 2, 0);
  const sumDiffCube = jackValues.reduce((s, v) => s + (jackMean - v) ** 3, 0);
  const a = sumDiffSq > 1e-15 ? sumDiffCube / (6 * Math.pow(sumDiffSq, 1.5)) : 0;

  const zLow = normalQuantile(0.025);
  const zHigh = normalQuantile(0.975);
  const adjLow = normalCDF(z0 + (z0 + zLow) / (1 - a * (z0 + zLow)));
  const adjHigh = normalCDF(z0 + (z0 + zHigh) / (1 - a * (z0 + zHigh)));

  const idxLow = Math.max(0, Math.min(nBoot - 1, Math.floor(adjLow * nBoot)));
  const idxHigh = Math.max(0, Math.min(nBoot - 1, Math.floor(adjHigh * nBoot)));

  const ciLow = bootMeans[idxLow]!;
  const ciHigh = bootMeans[idxHigh]!;

  return { gz, ciLow, ciHigh, ciExcludesZero: (ciLow > 0 && ciHigh > 0) || (ciLow < 0 && ciHigh < 0), meanDelta: m };
}

// ─── Sign consistency ───────────────────────────────────────────────

function signConsistency(deltas: number[]): { consistency: number; dominantSign: string; n: number } {
  const nonZero = deltas.filter(d => Math.abs(d) > 1e-15);
  const n = nonZero.length;
  if (n === 0) return { consistency: 0, dominantSign: 'tied', n: 0 };
  const pos = nonZero.filter(d => d > 0).length;
  const neg = n - pos;
  const k = Math.max(pos, neg);
  return { consistency: k / n, dominantSign: pos > neg ? 'journal >' : neg > pos ? 'calib >' : 'tied', n };
}

// ─── Mann-Kendall ───────────────────────────────────────────────────

function mannKendall(values: number[]): { isStationary: boolean; direction: string; p: number } {
  const n = values.length;
  if (n < 4) return { isStationary: true, direction: 'none', p: 1 };
  let S = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) {
      const d = values[j]! - values[i]!;
      if (d > 1e-15) S++; else if (d < -1e-15) S--;
    }
  const variance = n * (n - 1) * (2 * n + 5) / 18;
  const z = S > 0 ? (S - 1) / Math.sqrt(variance) : S < 0 ? (S + 1) / Math.sqrt(variance) : 0;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  return { isStationary: p > 0.05, direction: S > 0 && p <= 0.05 ? 'rising' : S < 0 && p <= 0.05 ? 'falling' : 'none', p };
}

// ─── Matched pair finding ───────────────────────────────────────────

export interface MatchedPair {
  date: string;
  journalQid: number;
  calibrationQid: number;
  journalHour: number;
  calibrationHour: number;
}

export async function findMatchedPairs(subjectId: number): Promise<MatchedPair[]> {
  const rows = await sql`
    SELECT
      j.scheduled_for::text AS date,
      j.question_id AS "journalQid",
      (
        SELECT c.question_id
        FROM tb_questions c
        JOIN tb_session_summaries cs ON cs.question_id = c.question_id
        WHERE c.subject_id = ${subjectId}
          AND c.question_source_id = 3
          AND c.dttm_created_utc::date = j.scheduled_for
        ORDER BY c.dttm_created_utc DESC
        LIMIT 1
      ) AS "calibrationQid",
      js.hour_of_day AS "journalHour",
      (
        SELECT cs.hour_of_day
        FROM tb_questions c
        JOIN tb_session_summaries cs ON cs.question_id = c.question_id
        WHERE c.subject_id = ${subjectId}
          AND c.question_source_id = 3
          AND c.dttm_created_utc::date = j.scheduled_for
        ORDER BY c.dttm_created_utc DESC
        LIMIT 1
      ) AS "calibrationHour"
    FROM tb_questions j
    JOIN tb_session_summaries js ON j.question_id = js.question_id
    WHERE j.subject_id = ${subjectId}
      AND j.question_source_id != 3
      AND j.scheduled_for IS NOT NULL
    ORDER BY j.scheduled_for ASC
  `;

  return (rows as unknown as (MatchedPair & { calibrationQid: number | null })[])
    .filter(r => r.calibrationQid != null) as MatchedPair[];
}

// ─── IC fetching (Task B helpers) ───────────────────────────────────

export interface ICRow {
  date: string;
  value: number;
  qid: number;
}

export async function getJournalICRows(subjectId: number): Promise<ICRow[]> {
  const rows = await sql`
    SELECT q.scheduled_for::text AS date, ss.integrative_complexity AS value, q.question_id AS qid
    FROM tb_semantic_signals ss
    JOIN tb_questions q ON ss.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
      AND q.question_source_id != 3 AND q.scheduled_for IS NOT NULL AND ss.integrative_complexity IS NOT NULL
  `;
  return rows as unknown as ICRow[];
}

export async function getCalibrationICRows(subjectId: number): Promise<ICRow[]> {
  const rows = await sql`
    SELECT q.dttm_created_utc::date::text AS date, ss.integrative_complexity AS value, q.question_id AS qid
    FROM tb_semantic_signals ss
    JOIN tb_questions q ON ss.question_id = q.question_id
    WHERE q.subject_id = ${subjectId}
      AND q.question_source_id = 3 AND ss.integrative_complexity IS NOT NULL
    ORDER BY q.dttm_created_utc ASC
  `;
  return rows as unknown as ICRow[];
}

// ─── DOW count helpers (Task D) ─────────────────────────────────────

export async function getJournalDOWCounts(subjectId: number): Promise<number[]> {
  const rows = await sql`
    SELECT ss.day_of_week AS dow
    FROM tb_questions q
    JOIN tb_session_summaries ss ON q.question_id = ss.question_id
    WHERE q.subject_id = ${subjectId} AND q.question_source_id != 3 AND q.scheduled_for IS NOT NULL
  `;
  const counts = new Array(7).fill(0) as number[];
  for (const row of rows) counts[(row as { dow: number }).dow]!++;
  return counts;
}

export async function getCalibrationDOWCounts(subjectId: number): Promise<number[]> {
  const rows = await sql`
    SELECT ss.day_of_week AS dow
    FROM tb_questions q
    JOIN tb_session_summaries ss ON q.question_id = ss.question_id
    WHERE q.subject_id = ${subjectId} AND q.question_source_id = 3
  `;
  const counts = new Array(7).fill(0) as number[];
  for (const row of rows) counts[(row as { dow: number }).dow]!++;
  return counts;
}

// ─── Keystroke stream fetching ──────────────────────────────────────

interface KeystrokeEvent { c: string; d: number; u: number }

async function getKeystrokeStream(subjectId: number, questionId: number): Promise<KeystrokeEvent[] | null> {
  // Plaintext keystroke stream comes back through libDb's decryption boundary.
  const json = await getKeystrokeStreamJson(subjectId, questionId);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed as KeystrokeEvent[] : null;
  } catch {
    return null;
  }
}

// ─── IKI extraction (mirrors Rust types.rs logic) ───────────────────

function extractIKIs(stream: KeystrokeEvent[]): number[] {
  const downs = stream.map(e => e.d).sort((a, b) => a - b);
  const ikis: number[] = [];
  for (let i = 1; i < downs.length; i++) {
    const iki = downs[i]! - downs[i - 1]!;
    if (iki > 0 && iki < 5000) ikis.push(iki);
  }
  return ikis;
}

// ─── Burst extraction from IKI series ───────────────────────────────

interface BurstInfo {
  length: number; // number of IKIs in burst
  durationMs: number;
}

function extractBursts(ikis: number[], threshold: number = 2000): BurstInfo[] {
  const bursts: BurstInfo[] = [];
  let burstStart = 0;
  let burstDur = 0;
  let burstLen = 0;

  for (let i = 0; i < ikis.length; i++) {
    if (ikis[i]! < threshold) {
      burstLen++;
      burstDur += ikis[i]!;
    } else {
      if (burstLen > 0) {
        bursts.push({ length: burstLen, durationMs: burstDur });
      }
      burstLen = 0;
      burstDur = 0;
    }
  }
  if (burstLen > 0) bursts.push({ length: burstLen, durationMs: burstDur });
  return bursts;
}

function extractInterBurstIntervals(ikis: number[], threshold: number = 2000): number[] {
  // Inter-burst intervals are the IKIs >= threshold
  return ikis.filter(iki => iki >= threshold);
}

function extractPauses(ikis: number[], threshold: number = 2000): number[] {
  return ikis.filter(iki => iki >= threshold);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const subjectId = parseSubjectIdArg();
  const pairs = await findMatchedPairs(subjectId);

  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  CONFOUND ANALYSIS: Tasks A-D                                                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n  Matched day-pairs: ${pairs.length}`);
  console.log(`  Date range: ${pairs[0]?.date ?? '?'} to ${pairs[pairs.length - 1]?.date ?? '?'}`);

  // ═══════════════════════════════════════════════════════════════
  // TASK A: Length-matched recomputation
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('  TASK A: LENGTH-MATCHED RECOMPUTATION OF DYNAMICAL INVERSION');
  console.log('═'.repeat(100));
  console.log(`\n  Method: For each pair with keystroke streams, truncate journal stream to`);
  console.log(`  calibration stream length. Recompute LZC, PID synergy, temporal irreversibility`);
  console.log(`  via Rust engine on the truncated journal stream. Compare to calibration values.\n`);

  const SIGNALS_OF_INTEREST = ['lempelZivComplexity', 'pidSynergy', 'temporalIrreversibility'] as const;
  const SIGNAL_LABELS: Record<string, string> = {
    lempelZivComplexity: 'Lempel-Ziv complexity',
    pidSynergy: 'PID synergy',
    temporalIrreversibility: 'Temporal irreversibility',
  };

  interface LengthMatchedResult {
    date: string;
    journalIkiCount: number;
    calibrationIkiCount: number;
    truncatedIkiCount: number;
    original: Record<string, number | null>;
    truncated: Record<string, number | null>;
    calibration: Record<string, number | null>;
  }

  const lengthMatched: LengthMatchedResult[] = [];

  for (const pair of pairs) {
    const jStream = await getKeystrokeStream(subjectId, pair.journalQid);
    const cStream = await getKeystrokeStream(subjectId, pair.calibrationQid);
    if (!jStream || !cStream) {
      console.log(`  ${pair.date}: No keystroke stream (journal=${!!jStream}, cal=${!!cStream}), skipping`);
      continue;
    }

    const jIkis = extractIKIs(jStream);
    const cIkis = extractIKIs(cStream);

    if (cIkis.length < 30 || jIkis.length < 30) {
      console.log(`  ${pair.date}: Too few IKIs (journal=${jIkis.length}, cal=${cIkis.length}), skipping`);
      continue;
    }

    // Truncate journal stream to calibration length (by keystroke count)
    const truncLen = Math.min(cStream.length, jStream.length);
    const truncatedJStream = jStream.slice(0, truncLen);

    // Compute via Rust on original and truncated journal streams
    const origResult = native.computeDynamicalSignals(JSON.stringify(jStream));
    const truncResult = native.computeDynamicalSignals(JSON.stringify(truncatedJStream));
    const calResult = native.computeDynamicalSignals(JSON.stringify(cStream));

    const row: LengthMatchedResult = {
      date: pair.date,
      journalIkiCount: jIkis.length,
      calibrationIkiCount: cIkis.length,
      truncatedIkiCount: extractIKIs(truncatedJStream).length,
      original: {},
      truncated: {},
      calibration: {},
    };

    for (const sig of SIGNALS_OF_INTEREST) {
      row.original[sig] = origResult[sig] as number | null;
      row.truncated[sig] = truncResult[sig] as number | null;
      row.calibration[sig] = calResult[sig] as number | null;
    }

    lengthMatched.push(row);
    console.log(`  ${pair.date}: journal=${jIkis.length} IKIs -> truncated=${row.truncatedIkiCount}, cal=${cIkis.length}`);
  }

  // Per-signal comparison
  console.log(`\n  ── Per-signal results (${lengthMatched.length} pairs with streams) ──\n`);

  for (const sig of SIGNALS_OF_INTEREST) {
    const label = SIGNAL_LABELS[sig]!;

    // Original deltas (journal - calibration, untruncated)
    const origDeltas: number[] = [];
    const truncDeltas: number[] = [];
    const calValues: number[] = [];

    for (const r of lengthMatched) {
      const o = r.original[sig];
      const t = r.truncated[sig];
      const c = r.calibration[sig];
      if (o != null && c != null) origDeltas.push(o - c);
      if (t != null && c != null) truncDeltas.push(t - c);
      if (c != null) calValues.push(c);
    }

    const origSign = signConsistency(origDeltas);
    const truncSign = signConsistency(truncDeltas);
    const origH = computeHedgesGz(origDeltas);
    const truncH = computeHedgesGz(truncDeltas);
    const calMK = mannKendall(calValues);

    console.log(`  ${label}:`);
    console.log(`    ORIGINAL:  n=${origDeltas.length} | sign=${origSign.consistency.toFixed(2)} ${origSign.dominantSign} | g_z=${origH.gz >= 0 ? '+' : ''}${origH.gz.toFixed(3)} [${origH.ciLow >= 0 ? '+' : ''}${origH.ciLow.toFixed(3)}, ${origH.ciHigh >= 0 ? '+' : ''}${origH.ciHigh.toFixed(3)}] CI ${origH.ciExcludesZero ? 'excludes' : 'SPANS'} zero`);
    console.log(`    TRUNCATED: n=${truncDeltas.length} | sign=${truncSign.consistency.toFixed(2)} ${truncSign.dominantSign} | g_z=${truncH.gz >= 0 ? '+' : ''}${truncH.gz.toFixed(3)} [${truncH.ciLow >= 0 ? '+' : ''}${truncH.ciLow.toFixed(3)}, ${truncH.ciHigh >= 0 ? '+' : ''}${truncH.ciHigh.toFixed(3)}] CI ${truncH.ciExcludesZero ? 'excludes' : 'SPANS'} zero`);
    console.log(`    CAL STATIONARITY: ${calMK.isStationary ? 'stationary' : 'DRIFTING (' + calMK.direction + ')'} (p=${calMK.p.toFixed(3)})`);

    const survived = truncSign.consistency > 0.75 && truncH.ciExcludesZero && calMK.isStationary;
    const signFlipped = origSign.dominantSign !== truncSign.dominantSign && truncSign.dominantSign !== 'tied';
    console.log(`    VERDICT: ${survived ? 'SURVIVES length-matching' : signFlipped ? 'SIGN FLIPPED -> series-length artifact' : 'DOES NOT SURVIVE (CI spans zero or sign < 0.75)'}`);
    console.log('');
  }

  // Per-day detail
  console.log(`  ── Per-day detail ──`);
  console.log(`  ${'Date'.padEnd(12)} | ${'J IKIs'.padStart(6)} | ${'Trunc'.padStart(5)} | ${'C IKIs'.padStart(6)} | ${'Orig LZC delta'.padStart(14)} | ${'Trunc LZC delta'.padStart(15)} | ${'Orig PID delta'.padStart(14)} | ${'Trunc PID delta'.padStart(15)} | ${'Orig TI delta'.padStart(13)} | ${'Trunc TI delta'.padStart(14)}`);
  for (const r of lengthMatched) {
    const fmt = (orig: number | null, trunc: number | null, cal: number | null): [string, string] => {
      const od = orig != null && cal != null ? (orig - cal).toFixed(4) : '-';
      const td = trunc != null && cal != null ? (trunc - cal).toFixed(4) : '-';
      return [od.padStart(14), td.padStart(15)];
    };
    const [oLZC, tLZC] = fmt(r.original['lempelZivComplexity'] ?? null, r.truncated['lempelZivComplexity'] ?? null, r.calibration['lempelZivComplexity'] ?? null);
    const [oPID, tPID] = fmt(r.original['pidSynergy'] ?? null, r.truncated['pidSynergy'] ?? null, r.calibration['pidSynergy'] ?? null);
    const [oTI, tTI] = fmt(r.original['temporalIrreversibility'] ?? null, r.truncated['temporalIrreversibility'] ?? null, r.calibration['temporalIrreversibility'] ?? null);
    console.log(`  ${r.date.padEnd(12)} | ${String(r.journalIkiCount).padStart(6)} | ${String(r.truncatedIkiCount).padStart(5)} | ${String(r.calibrationIkiCount).padStart(6)} | ${oLZC} | ${tLZC} | ${oPID} | ${tPID} | ${oTI} | ${tTI}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // TASK B: Time-of-day sensitivity check
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('  TASK B: TIME-OF-DAY SENSITIVITY CHECK');
  console.log('═'.repeat(100));
  console.log(`\n  Method: Regress signal delta against time-of-day difference (journal hour - calibration hour).`);
  console.log(`  If the relationship is significant, the provocation effect is confounded with circadian timing.\n`);

  // Need journal + calibration IC values paired by date
  const icJournal = await getJournalICRows(subjectId);
  const icCalibration = await getCalibrationICRows(subjectId);

  const icCalByDate = new Map<string, number>();
  for (const r of icCalibration) {
    icCalByDate.set(r.date, r.value); // last calibration wins (ORDER BY ASC)
  }

  // Build IC delta + time-of-day difference vectors
  const icData: { date: string; icDelta: number; todDiff: number }[] = [];
  for (const r of icJournal) {
    const calIC = icCalByDate.get(r.date);
    const pair = pairs.find(p => p.date === r.date);
    if (calIC == null || !pair) continue;
    icData.push({
      date: r.date,
      icDelta: r.value - calIC,
      todDiff: pair.journalHour - pair.calibrationHour,
    });
  }

  console.log(`  ── Integrative Complexity ──`);
  console.log(`  Pairs with IC + time data: ${icData.length}\n`);

  if (icData.length >= 3) {
    const reg = linreg(icData.map(d => d.todDiff), icData.map(d => d.icDelta));
    console.log(`  Regression: IC_delta = ${reg.slope >= 0 ? '+' : ''}${reg.slope.toFixed(4)} * TOD_diff + ${reg.intercept.toFixed(4)}`);
    console.log(`  r = ${reg.r.toFixed(3)}, R^2 = ${reg.rSq.toFixed(3)}, p = ${reg.p.toFixed(3)}`);
    console.log(`  ${reg.p < 0.05 ? 'SIGNIFICANT: IC delta covaries with time-of-day difference' : 'NOT SIGNIFICANT: IC delta does not covary with time-of-day difference'}`);

    console.log(`\n  Per-pair detail:`);
    console.log(`  ${'Date'.padEnd(12)} | ${'J hour'.padStart(6)} | ${'C hour'.padStart(6)} | ${'TOD diff'.padStart(8)} | ${'IC delta'.padStart(8)}`);
    for (const d of icData) {
      const pair = pairs.find(p => p.date === d.date)!;
      console.log(`  ${d.date.padEnd(12)} | ${String(pair.journalHour).padStart(6)} | ${String(pair.calibrationHour).padStart(6)} | ${String(d.todDiff).padStart(8)} | ${d.icDelta.toFixed(3).padStart(8)}`);
    }
  }

  // Same check on surviving dynamical signals (using truncated values if available)
  console.log(`\n  ── Dynamical signals (using truncated values where available) ──\n`);

  for (const sig of SIGNALS_OF_INTEREST) {
    const label = SIGNAL_LABELS[sig]!;
    const sigData: { todDiff: number; delta: number }[] = [];

    for (const r of lengthMatched) {
      const t = r.truncated[sig];
      const c = r.calibration[sig];
      const pair = pairs.find(p => p.date === r.date);
      if (t == null || c == null || !pair) continue;
      sigData.push({ todDiff: pair.journalHour - pair.calibrationHour, delta: t - c });
    }

    if (sigData.length >= 3) {
      const reg = linreg(sigData.map(d => d.todDiff), sigData.map(d => d.delta));
      console.log(`  ${label}: slope=${reg.slope >= 0 ? '+' : ''}${reg.slope.toFixed(5)}, r=${reg.r.toFixed(3)}, R^2=${reg.rSq.toFixed(3)}, p=${reg.p.toFixed(3)} ${reg.p < 0.05 ? '*** SIGNIFICANT' : '(not significant)'}`);
    } else {
      console.log(`  ${label}: insufficient data (n=${sigData.length})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TASK C: Pause and burst structure comparison (length-matched)
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('  TASK C: PAUSE AND BURST STRUCTURE COMPARISON (LENGTH-MATCHED)');
  console.log('═'.repeat(100));
  console.log(`\n  Method: For each pair with keystroke streams, truncate journal to calibration`);
  console.log(`  keystroke count. Extract IKIs. Compare pause, burst, and inter-burst distributions.\n`);

  const pauseData: {
    date: string;
    journalPauses: number[];
    calPauses: number[];
    journalBursts: BurstInfo[];
    calBursts: BurstInfo[];
    journalIBI: number[];
    calIBI: number[];
  }[] = [];

  for (const pair of pairs) {
    const jStream = await getKeystrokeStream(subjectId, pair.journalQid);
    const cStream = await getKeystrokeStream(subjectId, pair.calibrationQid);
    if (!jStream || !cStream) continue;

    const truncLen = Math.min(cStream.length, jStream.length);
    const truncJStream = jStream.slice(0, truncLen);

    const jIkis = extractIKIs(truncJStream);
    const cIkis = extractIKIs(cStream);

    pauseData.push({
      date: pair.date,
      journalPauses: extractPauses(jIkis),
      calPauses: extractPauses(cIkis),
      journalBursts: extractBursts(jIkis),
      calBursts: extractBursts(cIkis),
      journalIBI: extractInterBurstIntervals(jIkis),
      calIBI: extractInterBurstIntervals(cIkis),
    });
  }

  console.log(`  Pairs with keystroke streams: ${pauseData.length}\n`);

  // Aggregate pause stats
  const allJPauses = pauseData.flatMap(d => d.journalPauses);
  const allCPauses = pauseData.flatMap(d => d.calPauses);
  const jPauseCounts = pauseData.map(d => d.journalPauses.length);
  const cPauseCounts = pauseData.map(d => d.calPauses.length);

  console.log(`  ── PAUSE DURATIONS (IKI >= 2000ms, from length-matched streams) ──`);
  console.log(`                          | Journal (truncated)  | Calibration`);
  console.log(`  Total pauses            | ${String(allJPauses.length).padStart(20)} | ${String(allCPauses.length).padStart(11)}`);
  console.log(`  Pauses per session mean  | ${mean(jPauseCounts).toFixed(1).padStart(20)} | ${mean(cPauseCounts).toFixed(1).padStart(11)}`);
  if (allJPauses.length > 0 || allCPauses.length > 0) {
    const jStats = allJPauses.length > 0 ? { med: median(allJPauses), iqr: iqr(allJPauses), p90: percentile(allJPauses, 90) } : null;
    const cStats = allCPauses.length > 0 ? { med: median(allCPauses), iqr: iqr(allCPauses), p90: percentile(allCPauses, 90) } : null;
    console.log(`  Median duration (ms)     | ${jStats ? jStats.med.toFixed(0).padStart(20) : 'N/A'.padStart(20)} | ${cStats ? cStats.med.toFixed(0).padStart(11) : 'N/A'.padStart(11)}`);
    console.log(`  IQR (ms)                 | ${jStats ? jStats.iqr.toFixed(0).padStart(20) : 'N/A'.padStart(20)} | ${cStats ? cStats.iqr.toFixed(0).padStart(11) : 'N/A'.padStart(11)}`);
    console.log(`  90th percentile (ms)     | ${jStats ? jStats.p90.toFixed(0).padStart(20) : 'N/A'.padStart(20)} | ${cStats ? cStats.p90.toFixed(0).padStart(11) : 'N/A'.padStart(11)}`);
  }

  // Burst stats
  const allJBurstLens = pauseData.flatMap(d => d.journalBursts.map(b => b.length));
  const allCBurstLens = pauseData.flatMap(d => d.calBursts.map(b => b.length));
  const jBurstCounts = pauseData.map(d => d.journalBursts.length);
  const cBurstCounts = pauseData.map(d => d.calBursts.length);

  console.log(`\n  ── BURST LENGTH (IKIs between pauses >= 2000ms) ──`);
  console.log(`                          | Journal (truncated)  | Calibration`);
  console.log(`  Total bursts            | ${String(allJBurstLens.length).padStart(20)} | ${String(allCBurstLens.length).padStart(11)}`);
  console.log(`  Bursts per session mean  | ${mean(jBurstCounts).toFixed(1).padStart(20)} | ${mean(cBurstCounts).toFixed(1).padStart(11)}`);
  if (allJBurstLens.length > 0 && allCBurstLens.length > 0) {
    console.log(`  Median burst length      | ${median(allJBurstLens).toFixed(0).padStart(20)} | ${median(allCBurstLens).toFixed(0).padStart(11)}`);
    console.log(`  IQR                      | ${iqr(allJBurstLens).toFixed(0).padStart(20)} | ${iqr(allCBurstLens).toFixed(0).padStart(11)}`);
    console.log(`  90th percentile          | ${percentile(allJBurstLens, 90).toFixed(0).padStart(20)} | ${percentile(allCBurstLens, 90).toFixed(0).padStart(11)}`);
    console.log(`  Mean burst length        | ${mean(allJBurstLens).toFixed(1).padStart(20)} | ${mean(allCBurstLens).toFixed(1).padStart(11)}`);
  }

  // Inter-burst intervals
  const allJIBI = pauseData.flatMap(d => d.journalIBI);
  const allCIBI = pauseData.flatMap(d => d.calIBI);

  console.log(`\n  ── INTER-BURST INTERVALS (IKI >= 2000ms) ──`);
  console.log(`                          | Journal (truncated)  | Calibration`);
  console.log(`  Total inter-burst gaps  | ${String(allJIBI.length).padStart(20)} | ${String(allCIBI.length).padStart(11)}`);
  if (allJIBI.length > 0 && allCIBI.length > 0) {
    console.log(`  Median (ms)              | ${median(allJIBI).toFixed(0).padStart(20)} | ${median(allCIBI).toFixed(0).padStart(11)}`);
    console.log(`  IQR (ms)                 | ${iqr(allJIBI).toFixed(0).padStart(20)} | ${iqr(allCIBI).toFixed(0).padStart(11)}`);
    console.log(`  90th percentile (ms)     | ${percentile(allJIBI, 90).toFixed(0).padStart(20)} | ${percentile(allCIBI, 90).toFixed(0).padStart(11)}`);
    console.log(`  Mean (ms)                | ${mean(allJIBI).toFixed(0).padStart(20)} | ${mean(allCIBI).toFixed(0).padStart(11)}`);
  } else {
    console.log(`  (insufficient inter-burst gaps for comparison)`);
  }

  // ═══════════════════════════════════════════════════════════════
  // TASK D: Day-of-week and within-day ordering
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('  TASK D: DAY-OF-WEEK AND WITHIN-DAY ORDERING');
  console.log('═'.repeat(100));

  const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Fetch all sessions for DOW distribution (not just pairs)
  const jDOWCounts = await getJournalDOWCounts(subjectId);
  const cDOWCounts = await getCalibrationDOWCounts(subjectId);
  const jDOWTotal = jDOWCounts.reduce((s, n) => s + n, 0);
  const cDOWTotal = cDOWCounts.reduce((s, n) => s + n, 0);

  console.log(`\n  ── DAY-OF-WEEK DISTRIBUTION ──`);
  console.log(`  ${'Day'.padEnd(5)} | ${'Journal'.padStart(8)} | ${'Calibration'.padStart(12)}`);
  console.log(`  ${'─'.repeat(5)}-┼─${'─'.repeat(7)}┼─${'─'.repeat(11)}`);
  for (let d = 0; d < 7; d++) {
    console.log(`  ${DOW_NAMES[d]!.padEnd(5)} | ${String(jDOWCounts[d]).padStart(8)} | ${String(cDOWCounts[d]).padStart(12)}`);
  }
  console.log(`  Total | ${String(jDOWTotal).padStart(8)} | ${String(cDOWTotal).padStart(12)}`);

  // Within-day ordering
  console.log(`\n  ── WITHIN-DAY ORDERING ──`);
  let journalFirst = 0;
  let calFirst = 0;
  let sameHour = 0;
  const timeGaps: number[] = [];

  for (const pair of pairs) {
    const gap = pair.calibrationHour - pair.journalHour;
    timeGaps.push(gap);
    if (pair.journalHour < pair.calibrationHour) journalFirst++;
    else if (pair.calibrationHour < pair.journalHour) calFirst++;
    else sameHour++;
  }

  console.log(`  Journal before calibration:  ${journalFirst}/${pairs.length} (${(journalFirst / pairs.length * 100).toFixed(0)}%)`);
  console.log(`  Calibration before journal:  ${calFirst}/${pairs.length} (${(calFirst / pairs.length * 100).toFixed(0)}%)`);
  console.log(`  Same hour:                   ${sameHour}/${pairs.length}`);

  console.log(`\n  ── WITHIN-PAIR TIME GAP (calibration hour - journal hour) ──`);
  console.log(`  Mean:   ${mean(timeGaps).toFixed(1)} hours`);
  console.log(`  Median: ${median(timeGaps).toFixed(1)} hours`);
  console.log(`  SD:     ${sdFn(timeGaps).toFixed(1)} hours`);
  console.log(`  Range:  ${Math.min(...timeGaps)} to ${Math.max(...timeGaps)} hours`);

  console.log(`\n  Per-pair detail:`);
  console.log(`  ${'Date'.padEnd(12)} | ${'DOW'.padEnd(4)} | ${'J hour'.padStart(6)} | ${'C hour'.padStart(6)} | ${'Gap (h)'.padStart(7)} | Order`);
  console.log(`  ${'─'.repeat(12)}-┼─${'─'.repeat(3)}┼─${'─'.repeat(5)}┼─${'─'.repeat(5)}┼─${'─'.repeat(6)}┼─${'─'.repeat(20)}`);

  for (const pair of pairs) {
    const date = new Date(pair.date + 'T12:00:00');
    const dow = DOW_NAMES[date.getDay()]!;
    const gap = pair.calibrationHour - pair.journalHour;
    const order = pair.journalHour < pair.calibrationHour ? 'journal first'
      : pair.calibrationHour < pair.journalHour ? 'calibration first'
      : 'same hour';
    console.log(`  ${pair.date.padEnd(12)} | ${dow.padEnd(4)} | ${String(pair.journalHour).padStart(6)} | ${String(pair.calibrationHour).padStart(6)} | ${String(gap).padStart(7)} | ${order}`);
  }

  console.log(`\n${'═'.repeat(100)}`);
  console.log('  END OF CONFOUND ANALYSIS');
  console.log('═'.repeat(100));
  console.log('');

  await sql.end();
}

// Only invoke main() when the file is run directly (e.g.
// `npx tsx src/scripts/confound-analysis.ts`). When imported by tests for
// the exported helpers, main() must not run — its sql.end() would close
// the shared connection pool and break unrelated test queries.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
