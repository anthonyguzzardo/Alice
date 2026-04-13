#!/usr/bin/env npx tsx
/**
 * Simulation runner: 30 days of synthetic journal data through the full pipeline.
 *
 * Uses a separate database (data/alice-sim.db) so real data is never touched.
 * Monkey-patches Date to simulate each day sequentially.
 *
 * Usage:
 *   npm run simulate                # run full 30-day simulation
 *   npm run simulate -- --dry-run   # insert data only, skip AI pipeline
 *   npm run simulate -- --start 10  # resume from day 10
 *   npm run simulate -- --embed     # also run Voyage AI embeddings
 *
 * Cost estimate (full run):
 *   ~30 observation calls (Claude) + ~4 reflection calls (Claude + Sonnet audit)
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const EMBED = args.includes('--embed');
const startIdx = args.indexOf('--start');
const START_DAY = startIdx >= 0 ? parseInt(args[startIdx + 1], 10) : 1;

// ── Set DB path BEFORE any imports that touch the database ──────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIM_DB_PATH = path.resolve(__dirname, '../../data/alice-sim.db');

// Remove existing sim DB for a clean run (unless resuming)
if (START_DAY === 1 && fs.existsSync(SIM_DB_PATH)) {
  // Also remove WAL/SHM files
  for (const suffix of ['', '-shm', '-wal']) {
    const f = SIM_DB_PATH + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  console.log('[sim] Removed existing simulation DB for clean run');
}

process.env.ALICE_DB_PATH = SIM_DB_PATH;

// ── Monkey-patch Date for day simulation ────────────────────────────────────
const OriginalDate = globalThis.Date;
let simulatedDateStr = '';

function setSimulatedDate(dateStr: string): void {
  simulatedDateStr = dateStr;
  const target = new OriginalDate(dateStr + 'T12:00:00');

  globalThis.Date = class PatchedDate extends OriginalDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(target.getTime());
      } else {
        // @ts-ignore — variadic constructor
        super(...args);
      }
    }
    static now(): number {
      return target.getTime();
    }
    static parse(s: string): number {
      return OriginalDate.parse(s);
    }
    static UTC(...args: any[]): number {
      // @ts-ignore
      return OriginalDate.UTC(...args);
    }
  } as any;
}

function restoreDate(): void {
  globalThis.Date = OriginalDate;
}

// ── Now dynamically import pipeline modules (DB connects here) ──────────────
const { SEED_QUESTIONS } = await import('../lib/seeds.ts');
const {
  scheduleQuestion,
  saveResponse,
  saveSessionSummary,
  getResponseCount,
} = await import('../lib/db.ts');
const { computeLinguisticDensities } = await import('../lib/linguistic.ts');
const { runObservation } = await import('../lib/observe.ts');
const { runGeneration } = await import('../lib/generate.ts');
const { runReflection } = await import('../lib/reflect.ts');
const { renderWitnessState } = await import('../lib/alice-negative/render-witness.ts');
const { JORDAN_ENTRIES, buildSessionSummary } = await import('./simulation-data.ts');

// Conditional embedding import
let embedResponse: ((id: number, q: string, r: string, d: string) => Promise<void>) | null = null;
if (EMBED) {
  const embedModule = await import('../lib/embeddings.ts');
  embedResponse = embedModule.embedResponse;
}

// ── Simulation config ───────────────────────────────────────────────────────
const BASE_DATE = new OriginalDate('2026-03-01T12:00:00');
const TOTAL_DAYS = 30;

function simDateStr(dayIndex: number): string {
  const d = new OriginalDate(BASE_DATE);
  d.setDate(d.getDate() + dayIndex);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ── Main simulation loop ────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  ALICE SIMULATION — 30 days of Jordan Chen');
console.log(`  DB: ${SIM_DB_PATH}`);
console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (data only)' : 'FULL PIPELINE (AI calls)'}`);
console.log(`  Embeddings: ${EMBED ? 'ON' : 'OFF'}`);
console.log(`  Starting from day: ${START_DAY}`);
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Pre-schedule all seed questions (with real date, then we'll patch for pipeline)
for (let i = 0; i < TOTAL_DAYS; i++) {
  const dateStr = simDateStr(i);
  setSimulatedDate(dateStr);
  scheduleQuestion(SEED_QUESTIONS[i], dateStr, 'seed');
}
restoreDate();
console.log(`[sim] Scheduled ${TOTAL_DAYS} seed questions (${simDateStr(0)} → ${simDateStr(TOTAL_DAYS - 1)})\n`);

for (let dayIndex = START_DAY - 1; dayIndex < TOTAL_DAYS; dayIndex++) {
  const dayNum = dayIndex + 1;
  const dateStr = simDateStr(dayIndex);
  const entry = JORDAN_ENTRIES[dayIndex];
  const question = SEED_QUESTIONS[dayIndex];

  console.log(`── Day ${dayNum}/${TOTAL_DAYS} [${dateStr}] ──────────────────────────────────`);

  // Set simulated date so pipeline thinks it's this day
  setSimulatedDate(dateStr);

  // 1. Insert response
  const questionId = dayIndex + 1; // AUTOINCREMENT starts at 1
  const responseId = saveResponse(questionId, entry.text.trim());

  // 2. Compute linguistic densities from actual text
  const densities = computeLinguisticDensities(entry.text.trim());

  // 3. Build and save session summary
  const sessionSummary = buildSessionSummary(questionId, entry.text, entry.overrides, dayIndex);
  saveSessionSummary({
    ...sessionSummary,
    ...densities,
  });
  console.log(`   Data inserted (CR=${sessionSummary.commitmentRatio}, CPM=${sessionSummary.charsPerMinute})`);

  // 4. Embed response (optional)
  if (embedResponse) {
    try {
      await embedResponse(responseId, question, entry.text.trim(), dateStr);
      console.log('   Embedded');
    } catch (err: any) {
      console.log(`   Embedding skipped: ${err.message}`);
    }
  }

  // 5. Run AI pipeline (unless dry run)
  if (!DRY_RUN) {
    try {
      console.log('   Running observation...');
      await runObservation();
      console.log('   Observation complete');

      // Generation is no-op during seed phase (days 1-30)
      await runGeneration();

      const responseCount = getResponseCount();
      if (responseCount >= 5 && responseCount % 7 === 0) {
        console.log('   Running reflection...');
        await runReflection();
        console.log('   Reflection complete');
      }

      // Skip witness form rendering in simulation — it's an extra Opus call per day
    } catch (err: any) {
      console.error(`   Pipeline error: ${err.message}`);
      if (err.message?.includes('rate_limit') || err.message?.includes('overloaded')) {
        console.log('   Waiting 30s for rate limit...');
        await new Promise(r => setTimeout(r, 30000));
        // Retry once
        try {
          await runObservation();
          console.log('   Observation complete (retry)');
        } catch (retryErr: any) {
          console.error(`   Retry failed: ${retryErr.message}`);
        }
      }
    }
  }

  console.log('');
}

restoreDate();

console.log('═══════════════════════════════════════════════════════════════');
console.log('  SIMULATION COMPLETE');
console.log(`  Database: ${SIM_DB_PATH}`);
console.log('');
console.log('  Inspect results:');
console.log('    sqlite3 data/alice-sim.db "SELECT COUNT(*) FROM tb_responses"');
console.log('    sqlite3 data/alice-sim.db "SELECT observation_date, substr(observation_text,1,100) FROM tb_ai_observations"');
console.log('    sqlite3 data/alice-sim.db "SELECT substr(text,1,100) FROM tb_reflections"');
console.log('    sqlite3 data/alice-sim.db "SELECT hypothesis, status FROM tb_predictions"');
console.log('═══════════════════════════════════════════════════════════════');
