/**
 * Behavioral descriptive comparison: journal vs calibration sessions.
 *
 * Side-by-side descriptive statistics across all matched day-pairs to
 * rule out structural artifacts (session length, keystroke count, pacing)
 * as explanations for the dynamical inversion found in Phase 1 screening.
 *
 * Run: npx tsx src/scripts/describe-session-pairs.ts
 */
import sql from '../lib/libDbPool.ts';

// ─── Types ──────────────────────────────────────────────────────────

interface SessionRow {
  date: string;
  questionId: number;
  sessionType: 'journal' | 'calibration';
  totalDurationMs: number | null;
  activeTypingMs: number | null;
  totalCharsTyped: number | null;
  finalCharCount: number | null;
  wordCount: number | null;
  sentenceCount: number | null;
  ikiMean: number | null;
  ikiStd: number | null;
  pauseCount: number | null;
  totalPauseMs: number | null;
  hourOfDay: number | null;
  dayOfWeek: number | null;
  ikiCount: number | null; // from tb_dynamical_signals
  charsPerMinute: number | null;
  commitmentRatio: number | null;
  avgPBurstLength: number | null;
  pBurstCount: number | null;
}

interface PairedRow {
  date: string;
  journal: SessionRow;
  calibration: SessionRow;
}

// ─── Data fetching ──────────────────────────────────────────────────

async function fetchAllPairs(): Promise<PairedRow[]> {
  // Get all journal sessions with summaries
  const journalRows = await sql`
    SELECT
      q.scheduled_for::text AS date,
      q.question_id AS "questionId",
      ss.total_duration_ms AS "totalDurationMs",
      ss.active_typing_ms AS "activeTypingMs",
      ss.total_chars_typed AS "totalCharsTyped",
      ss.final_char_count AS "finalCharCount",
      ss.word_count AS "wordCount",
      ss.sentence_count AS "sentenceCount",
      ss.inter_key_interval_mean AS "ikiMean",
      ss.inter_key_interval_std AS "ikiStd",
      ss.pause_count AS "pauseCount",
      ss.total_pause_ms AS "totalPauseMs",
      ss.hour_of_day AS "hourOfDay",
      ss.day_of_week AS "dayOfWeek",
      ss.chars_per_minute AS "charsPerMinute",
      ss.commitment_ratio AS "commitmentRatio",
      ss.avg_p_burst_length AS "avgPBurstLength",
      ss.p_burst_count AS "pBurstCount",
      ds.iki_count AS "ikiCount"
    FROM tb_questions q
    JOIN tb_session_summaries ss ON q.question_id = ss.question_id
    LEFT JOIN tb_dynamical_signals ds ON q.question_id = ds.question_id
    WHERE q.question_source_id != 3
      AND q.scheduled_for IS NOT NULL
    ORDER BY q.scheduled_for ASC
  `;

  // Get all calibration sessions with summaries
  const calRows = await sql`
    SELECT
      q.dttm_created_utc::date::text AS date,
      q.question_id AS "questionId",
      ss.total_duration_ms AS "totalDurationMs",
      ss.active_typing_ms AS "activeTypingMs",
      ss.total_chars_typed AS "totalCharsTyped",
      ss.final_char_count AS "finalCharCount",
      ss.word_count AS "wordCount",
      ss.sentence_count AS "sentenceCount",
      ss.inter_key_interval_mean AS "ikiMean",
      ss.inter_key_interval_std AS "ikiStd",
      ss.pause_count AS "pauseCount",
      ss.total_pause_ms AS "totalPauseMs",
      ss.hour_of_day AS "hourOfDay",
      ss.day_of_week AS "dayOfWeek",
      ss.chars_per_minute AS "charsPerMinute",
      ss.commitment_ratio AS "commitmentRatio",
      ss.avg_p_burst_length AS "avgPBurstLength",
      ss.p_burst_count AS "pBurstCount",
      ds.iki_count AS "ikiCount"
    FROM tb_questions q
    JOIN tb_session_summaries ss ON q.question_id = ss.question_id
    LEFT JOIN tb_dynamical_signals ds ON q.question_id = ds.question_id
    WHERE q.question_source_id = 3
    ORDER BY q.dttm_created_utc ASC
  `;

  // Match by date: for each journal date, find last calibration on same date
  const calByDate = new Map<string, SessionRow[]>();
  for (const row of calRows) {
    const r = row as unknown as SessionRow;
    r.sessionType = 'calibration';
    const existing = calByDate.get(r.date) ?? [];
    existing.push(r);
    calByDate.set(r.date, existing);
  }

  const pairs: PairedRow[] = [];
  for (const row of journalRows) {
    const j = row as unknown as SessionRow;
    j.sessionType = 'journal';
    const cals = calByDate.get(j.date);
    if (!cals || cals.length === 0) continue;
    // Last calibration of the day
    const c = cals[cals.length - 1]!;
    pairs.push({ date: j.date, journal: j, calibration: c });
  }

  return pairs;
}

// ─── Stats helpers ────────────────────────────────────��─────────────

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

function extractPaired(pairs: PairedRow[], getter: (s: SessionRow) => number | null): { journal: number[]; calibration: number[]; deltas: number[]; nPairs: number } {
  const journal: number[] = [];
  const calibration: number[] = [];
  const deltas: number[] = [];
  for (const p of pairs) {
    const j = getter(p.journal);
    const c = getter(p.calibration);
    if (j != null && c != null && Number.isFinite(j) && Number.isFinite(c)) {
      journal.push(j);
      calibration.push(c);
      deltas.push(j - c);
    }
  }
  return { journal, calibration, deltas, nPairs: deltas.length };
}

// Paired t-test (two-sided)
function pairedTTest(deltas: number[]): { t: number; p: number; df: number } {
  const n = deltas.length;
  if (n < 3) return { t: 0, p: 1, df: 0 };
  const m = mean(deltas);
  const s = sdFn(deltas);
  if (s < 1e-15) return { t: 0, p: 1, df: n - 1 };
  const t = m / (s / Math.sqrt(n));
  const df = n - 1;
  // Approximate p-value from t distribution using normal for df >= 5
  const p = df >= 5 ? 2 * (1 - normalCDF(Math.abs(t))) : 1; // conservative for tiny df
  return { t, p, df };
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327;
  const p = d * Math.exp(-x * x / 2) * (t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));
  return x >= 0 ? 1 - p : p;
}

// ─── Report formatting ──────────────────────────────────────────────

function pad(s: string, n: number): string { return s.padEnd(n); }
function rpad(s: string, n: number): string { return s.padStart(n); }
function fmt(v: number, d: number = 1): string { return v.toFixed(d); }

interface MetricReport {
  name: string;
  unit: string;
  nPairs: number;
  journalMean: number;
  journalSD: number;
  journalMedian: number;
  calMean: number;
  calSD: number;
  calMedian: number;
  deltaMean: number;
  deltaSD: number;
  tStat: number;
  pValue: number;
  systematic: boolean; // p < 0.05
  direction: string;
}

function reportMetric(
  name: string,
  unit: string,
  pairs: PairedRow[],
  getter: (s: SessionRow) => number | null,
  transform?: (v: number) => number,
): MetricReport {
  const { journal, calibration, deltas, nPairs } = extractPaired(pairs, getter);

  const jVals = transform ? journal.map(transform) : journal;
  const cVals = transform ? calibration.map(transform) : calibration;
  const dVals = transform ? deltas.map((_, i) => jVals[i]! - cVals[i]!) : deltas;

  const { t, p } = pairedTTest(dVals);
  const dm = mean(dVals);
  const systematic = p < 0.05 && nPairs >= 5;
  const direction = dm > 0 ? 'journal >' : dm < 0 ? 'calib >' : 'equal';

  return {
    name, unit, nPairs,
    journalMean: mean(jVals), journalSD: sdFn(jVals), journalMedian: median(jVals),
    calMean: mean(cVals), calSD: sdFn(cVals), calMedian: median(cVals),
    deltaMean: dm, deltaSD: sdFn(dVals),
    tStat: t, pValue: p, systematic, direction,
  };
}

function printMetric(m: MetricReport): void {
  const flag = m.systematic ? ' ***' : '';
  console.log(
    `  ${pad(m.name, 30)} ` +
    `| ${rpad(fmt(m.journalMean), 9)} (${rpad(fmt(m.journalSD), 7)}) [${rpad(fmt(m.journalMedian), 8)}] ` +
    `| ${rpad(fmt(m.calMean), 9)} (${rpad(fmt(m.calSD), 7)}) [${rpad(fmt(m.calMedian), 8)}] ` +
    `| ${rpad(fmt(m.deltaMean, 2), 9)} (${rpad(fmt(m.deltaSD, 2), 7)}) ` +
    `| t=${rpad(fmt(m.tStat, 2), 6)} p=${rpad(fmt(m.pValue, 3), 5)} ` +
    `| ${pad(m.direction, 10)}${flag}`
  );
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const pairs = await fetchAllPairs();

  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  BEHAVIORAL DESCRIPTIVE COMPARISON: Journal vs Calibration Sessions                                                                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n  Matched day-pairs: ${pairs.length}`);
  console.log(`  Date range: ${pairs[0]?.date ?? '?'} to ${pairs[pairs.length - 1]?.date ?? '?'}`);
  console.log(`\n  *** = systematic difference (paired t-test p < 0.05, n >= 5)\n`);

  // Header
  console.log(
    `  ${pad('Metric', 30)} ` +
    `| ${pad('Journal: Mean (SD) [Median]', 37)} ` +
    `| ${pad('Calibration: Mean (SD) [Median]', 37)} ` +
    `| ${pad('Delta Mean (SD)', 19)} ` +
    `| ${pad('t-test', 19)} ` +
    `| Direction`
  );
  console.log(`  ${'─'.repeat(30)}-┼─${'─'.repeat(36)}┼─${'─'.repeat(36)}┼─${'─'.repeat(18)}┼─${'─'.repeat(18)}┼──────────`);

  // ── Session structure ──────────────────────────────────────────
  console.log(`\n  ── SESSION STRUCTURE ──`);

  const metrics: MetricReport[] = [];

  metrics.push(reportMetric('Total duration (sec)', 'sec', pairs, s => s.totalDurationMs, v => v / 1000));
  metrics.push(reportMetric('Active typing (sec)', 'sec', pairs, s => s.activeTypingMs, v => v / 1000));
  metrics.push(reportMetric('Total pause time (sec)', 'sec', pairs, s => s.totalPauseMs, v => v / 1000));
  metrics.push(reportMetric('Pause count', '', pairs, s => s.pauseCount));
  metrics.push(reportMetric('IKI count (keystrokes-1)', '', pairs, s => s.ikiCount));
  metrics.push(reportMetric('Total chars typed', '', pairs, s => s.totalCharsTyped));
  metrics.push(reportMetric('Final char count', '', pairs, s => s.finalCharCount));
  metrics.push(reportMetric('Word count', '', pairs, s => s.wordCount));
  metrics.push(reportMetric('Sentence count', '', pairs, s => s.sentenceCount));

  for (const m of metrics) printMetric(m);

  // ── Pacing and rhythm ─────────────────────────────────────────
  console.log(`\n  ── PACING AND RHYTHM ──`);

  const pacing: MetricReport[] = [];
  pacing.push(reportMetric('IKI mean (ms)', 'ms', pairs, s => s.ikiMean));
  pacing.push(reportMetric('IKI std (ms)', 'ms', pairs, s => s.ikiStd));
  pacing.push(reportMetric('IKI CV', '', pairs, s => {
    if (s.ikiMean == null || s.ikiStd == null || s.ikiMean < 1e-10) return null;
    return s.ikiStd / s.ikiMean;
  }));
  pacing.push(reportMetric('Chars per minute', 'cpm', pairs, s => s.charsPerMinute));
  pacing.push(reportMetric('Commitment ratio', '', pairs, s => s.commitmentRatio));
  pacing.push(reportMetric('Avg P-burst length', 'chars', pairs, s => s.avgPBurstLength));
  pacing.push(reportMetric('P-burst count', '', pairs, s => s.pBurstCount));

  for (const m of pacing) printMetric(m);

  // ── Pause structure ───────────────────────────────────────────
  console.log(`\n  ── PAUSE STRUCTURE ──`);

  const pauseMetrics: MetricReport[] = [];
  pauseMetrics.push(reportMetric('Pause rate (per min)', '/min', pairs, s => {
    if (s.pauseCount == null || s.totalDurationMs == null || s.totalDurationMs < 1000) return null;
    return s.pauseCount / (s.totalDurationMs / 60000);
  }));
  pauseMetrics.push(reportMetric('Avg pause duration (sec)', 'sec', pairs, s => {
    if (s.pauseCount == null || s.totalPauseMs == null || s.pauseCount === 0) return null;
    return (s.totalPauseMs / s.pauseCount) / 1000;
  }));
  pauseMetrics.push(reportMetric('Pause proportion', '', pairs, s => {
    if (s.totalPauseMs == null || s.totalDurationMs == null || s.totalDurationMs < 1000) return null;
    return s.totalPauseMs / s.totalDurationMs;
  }));

  for (const m of pauseMetrics) printMetric(m);

  // ── Temporal context ──────────────────────────────────────────
  console.log(`\n  ── TEMPORAL CONTEXT ──`);

  const temporal: MetricReport[] = [];
  temporal.push(reportMetric('Hour of day', '', pairs, s => s.hourOfDay));
  temporal.push(reportMetric('Day of week', '', pairs, s => s.dayOfWeek));

  for (const m of temporal) printMetric(m);

  // ── Per-day detail table ──────────────────────────────────────
  console.log(`\n\n  ── PER-DAY DETAIL ──`);
  console.log(`  ${pad('Date', 12)} | ${rpad('J dur(s)', 8)} | ${rpad('C dur(s)', 8)} | ${rpad('J IKIs', 6)} | ${rpad('C IKIs', 6)} | ${rpad('J IKI mean', 10)} | ${rpad('C IKI mean', 10)} | ${rpad('J words', 7)} | ${rpad('C words', 7)} | ${rpad('J hour', 6)} | ${rpad('C hour', 6)}`);
  console.log(`  ${'─'.repeat(12)}-┼─${'─'.repeat(7)}┼─${'─'.repeat(7)}┼─${'─'.repeat(5)}┼─${'─'.repeat(5)}┼─${'─'.repeat(9)}┼─${'─'.repeat(9)}┼─${'─'.repeat(6)}┼─${'─'.repeat(6)}┼─${'─'.repeat(5)}┼─${'─'.repeat(5)}`);

  for (const p of pairs) {
    const j = p.journal;
    const c = p.calibration;
    console.log(
      `  ${pad(p.date, 12)} ` +
      `| ${rpad(j.totalDurationMs != null ? fmt(j.totalDurationMs / 1000) : '-', 8)} ` +
      `| ${rpad(c.totalDurationMs != null ? fmt(c.totalDurationMs / 1000) : '-', 8)} ` +
      `| ${rpad(j.ikiCount != null ? String(j.ikiCount) : '-', 6)} ` +
      `| ${rpad(c.ikiCount != null ? String(c.ikiCount) : '-', 6)} ` +
      `| ${rpad(j.ikiMean != null ? fmt(j.ikiMean) : '-', 10)} ` +
      `| ${rpad(c.ikiMean != null ? fmt(c.ikiMean) : '-', 10)} ` +
      `| ${rpad(j.wordCount != null ? String(j.wordCount) : '-', 7)} ` +
      `| ${rpad(c.wordCount != null ? String(c.wordCount) : '-', 7)} ` +
      `| ${rpad(j.hourOfDay != null ? String(j.hourOfDay) : '-', 6)} ` +
      `| ${rpad(c.hourOfDay != null ? String(c.hourOfDay) : '-', 6)}`
    );
  }

  // ── Systematic differences summary ────────────────────────────
  const allMetrics = [...metrics, ...pacing, ...pauseMetrics, ...temporal];
  const systematic = allMetrics.filter(m => m.systematic);

  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('  SYSTEMATIC DIFFERENCES SUMMARY');
  console.log('═'.repeat(80));

  if (systematic.length === 0) {
    console.log('  No metrics reached p < 0.05 with n >= 5 pairs.');
  } else {
    for (const m of systematic) {
      const pct = m.calMean !== 0 ? ((m.deltaMean / m.calMean) * 100) : 0;
      console.log(`  ${pad(m.name, 30)} | delta=${fmt(m.deltaMean, 2)} | ${m.direction} | p=${fmt(m.pValue, 3)} | ${fmt(pct, 1)}% difference`);
    }
  }

  console.log(`\n  NOTE: These are approximate p-values (normal approximation to t with df >= 5).`);
  console.log(`  With n=${pairs.length} pairs, even p < 0.05 should be interpreted cautiously.`);
  console.log(`  The purpose is to flag structural confounds, not to claim significance.\n`);

  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
