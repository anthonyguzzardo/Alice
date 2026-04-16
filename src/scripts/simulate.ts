#!/usr/bin/env npx tsx
/**
 * Simulation runner v2: two modes for testing the Alice pipeline.
 *
 * MODE 1 — MECHANICS (default):
 *   10 days, Haiku, cheap (~$0.30). Tests pipeline mechanics:
 *   parsing, DB writes, prediction lifecycle, reflection triggers.
 *   Asserts after every day. Exit code 1 on failure.
 *
 * MODE 2 — QUALITY:
 *   15 days, Sonnet (~$3-4). Tests interpretation quality:
 *   planted pattern detection, false signal rejection, observation depth.
 *   Scores observations against ground truth after the run.
 *
 * Usage:
 *   npm run simulate                          # mechanics mode (default)
 *   npm run simulate -- --quality             # quality mode (15 days, Sonnet)
 *   npm run simulate -- --full                # full mode (all 30 days, Sonnet)
 *   npm run simulate -- --start 5             # resume from day 5
 *   npm run simulate -- --embed               # include Voyage AI embeddings
 *   npm run simulate -- --dry-run             # data only, no AI calls
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const EMBED = args.includes('--embed');
const QUALITY_MODE = args.includes('--quality');
const startIdx = args.indexOf('--start');
const START_DAY = startIdx >= 0 ? parseInt(args[startIdx + 1], 10) : 1;

// ── Mode config ─────────────────────────────────────────────────────────────
const FULL_MODE = args.includes('--full');
const MODE = FULL_MODE ? 'full' : QUALITY_MODE ? 'quality' : 'mechanics';
const MODEL = (FULL_MODE || QUALITY_MODE) ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001';
const AUDIT_MODEL = 'claude-haiku-4-5-20251001';

// Mechanics: 10 days cherry-picked for pattern coverage
// Quality: 15 days for deeper pattern detection
// Full: all 30 days for complete Jordan Chen run
const MECHANICS_DAYS = [0, 1, 2, 3, 4, 5, 7, 8, 10, 13]; // P1,P2,P3,P4,P5,F1,F2 + reflection trigger
const QUALITY_DAYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // first 15 days
const FULL_DAYS = Array.from({ length: 30 }, (_, i) => i); // all 30 days
const SELECTED_DAYS = FULL_MODE ? FULL_DAYS : QUALITY_MODE ? QUALITY_DAYS : MECHANICS_DAYS;
const TOTAL_DAYS = SELECTED_DAYS.length;

// ── Set DB path BEFORE any imports that touch the database ──────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIM_DB_PATH = path.resolve(__dirname, '../../data/simulation/alice-sim.db');

// Clean DB for fresh run — archive the old one first
if (START_DAY === 1 && fs.existsSync(SIM_DB_PATH)) {
  const archiveDir = path.resolve(__dirname, '../../data/simulation/archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  // Determine version from existing reports
  const reportsDir2 = path.resolve(__dirname, '../../data/simulation/reports');
  let archiveVersion = 'unknown';
  if (fs.existsSync(reportsDir2)) {
    const reportFiles = fs.readdirSync(reportsDir2).filter(f => f.match(/^sim-v\d+/));
    if (reportFiles.length > 0) {
      archiveVersion = `v${Math.max(...reportFiles.map(f => parseInt(f.match(/sim-v(\d+)/)?.[1] ?? '0', 10)))}`;
    }
  }

  const archivePath = path.resolve(archiveDir, `sim-${archiveVersion}.db`);
  fs.copyFileSync(SIM_DB_PATH, archivePath);
  console.log(`[sim] Archived previous DB to ${path.relative(process.cwd(), archivePath)}`);

  for (const suffix of ['', '-shm', '-wal']) {
    const f = SIM_DB_PATH + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  console.log('[sim] Removed existing simulation DB for clean run');
}

process.env.ALICE_DB_PATH = SIM_DB_PATH;

// ── Monkey-patch Date for day simulation ────────────────────────────────────
const OriginalDate = globalThis.Date;

function setSimulatedDate(dateStr: string): void {
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
  setDateOverride,
} = await import('../lib/db.ts');
const { computeLinguisticDensities } = await import('../lib/linguistic.ts');
const { runGeneration } = await import('../lib/generate.ts');
const { runReflection } = await import('../lib/reflect.ts');
const { JORDAN_ENTRIES, buildSessionSummary } = await import('./simulation-data.ts');

// Import state engine (8D behavioral states, dynamics, coupling)
const { computeEntryStates } = await import('../lib/alice-negative/state-engine.ts');
const { computeDynamics } = await import('../lib/alice-negative/dynamics.ts');
const { computeEmotionAnalysis } = await import('../lib/alice-negative/emotion-profile.ts');
const {
  saveEntryState,
  getEntryStateCount,
  saveTraitDynamics,
  saveCouplingMatrix,
  saveEmotionBehaviorCoupling,
} = await import('../lib/db.ts');

// Conditional embedding import
let embedResponse: ((id: number, q: string, r: string, d: string) => Promise<void>) | null = null;
if (EMBED) {
  const embedModule = await import('../lib/embeddings.ts');
  embedResponse = embedModule.embedResponse;
}

// ── Simulation config ───────────────────────────────────────────────────────
const BASE_DATE = new OriginalDate('2026-03-01T12:00:00');

function simDateStr(dayIndex: number): string {
  const d = new OriginalDate(BASE_DATE);
  d.setDate(d.getDate() + dayIndex);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ── Timing & cost tracking ──────────────────────────────────────────────────
interface ApiCallRecord {
  day: number;
  phase: string;
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

const apiCalls: ApiCallRecord[] = [];
let currentDay = 0;

function onApiCall(info: { phase: string; model: string; durationMs: number; inputTokens: number; outputTokens: number }) {
  apiCalls.push({ day: currentDay, ...info });
  const secs = (info.durationMs / 1000).toFixed(1);
  const inK = (info.inputTokens / 1000).toFixed(1);
  const outK = (info.outputTokens / 1000).toFixed(1);
  console.log(`   [${info.phase}] ${secs}s | ${inK}k in / ${outK}k out | ${info.model}`);
}

// ── Validation ──────────────────────────────────────────────────────────────
// Import raw db handle for validation queries
const { default: db } = await import('../lib/db.ts');

interface ValidationFailure {
  day: number;
  check: string;
  detail: string;
}

const failures: ValidationFailure[] = [];

function validateDay(dayNum: number, questionId: number, dateStr: string, hasReflection: boolean): void {
  // Check response exists
  const response = db.prepare('SELECT response_id FROM tb_responses WHERE question_id = ?').get(questionId);
  if (!response) {
    failures.push({ day: dayNum, check: 'response', detail: `No response for question_id ${questionId}` });
  }

  // Check session summary exists
  const summary = db.prepare('SELECT session_summary_id FROM tb_session_summaries WHERE question_id = ?').get(questionId);
  if (!summary) {
    failures.push({ day: dayNum, check: 'session_summary', detail: `No session summary for question_id ${questionId}` });
  }

  if (DRY_RUN) return; // skip AI-dependent checks

  // Check observation exists and is non-empty
  const obs = db.prepare('SELECT ai_observation_id, observation_text, dttm_created_utc FROM tb_ai_observations WHERE question_id = ?').get(questionId) as any;
  if (!obs) {
    failures.push({ day: dayNum, check: 'observation', detail: `No observation for question_id ${questionId}` });
  } else if (!obs.observation_text || obs.observation_text.length < 50) {
    failures.push({ day: dayNum, check: 'observation_content', detail: `Observation too short (${obs.observation_text?.length ?? 0} chars)` });
  }

  // Check suppressed question exists
  const suppressed = db.prepare('SELECT suppressed_text FROM tb_ai_suppressed_questions WHERE question_id = ?').get(questionId) as any;
  if (!suppressed) {
    failures.push({ day: dayNum, check: 'suppressed_question', detail: `No suppressed question for question_id ${questionId}` });
  }

  // Check predictions were created (after day 1 there should be open predictions)
  if (dayNum >= 2) {
    const predCount = db.prepare('SELECT COUNT(*) as c FROM tb_predictions WHERE question_id = ?').get(questionId) as any;
    if (!predCount || predCount.c === 0) {
      failures.push({ day: dayNum, check: 'predictions', detail: `No predictions created on day ${dayNum}` });
    }
  }

  // Check prompt trace exists (prompt_trace_type_id 2 = observation)
  const trace = db.prepare(
    'SELECT prompt_trace_id FROM tb_prompt_traces WHERE output_record_id = ? AND prompt_trace_type_id = 2'
  ).get(obs?.ai_observation_id ?? -1) as any;
  if (!trace && obs) {
    failures.push({ day: dayNum, check: 'prompt_trace', detail: `No prompt trace for observation on day ${dayNum}` });
  }

  // Check timestamp is simulated, not wall-clock
  if (obs) {
    const createdUtc = obs.dttm_created_utc ?? '';
    if (typeof createdUtc === 'string' && createdUtc.length > 0) {
      const createdDate = createdUtc.split('T')[0];
      if (createdDate !== dateStr) {
        failures.push({ day: dayNum, check: 'timestamp', detail: `Observation timestamp ${createdUtc} doesn't match simulated date ${dateStr}` });
      }
    }
  }

  // Check reflection if expected
  if (hasReflection) {
    const reflCount = db.prepare('SELECT COUNT(*) as c FROM tb_reflections').get() as any;
    if (!reflCount || reflCount.c === 0) {
      failures.push({ day: dayNum, check: 'reflection', detail: `Expected reflection but none found` });
    }
  }
}

// ── Resume cleanup ──────────────────────────────────────────────────────────
if (START_DAY > 1) {
  // Find actual question_ids to clean up (can't assume sequential due to INSERT OR IGNORE)
  const resumeDates = SELECTED_DAYS.slice(START_DAY - 1).map(idx => simDateStr(idx));
  const questionIds = resumeDates
    .map(d => db.prepare('SELECT question_id FROM tb_questions WHERE scheduled_for = ?').get(d) as { question_id: number } | undefined)
    .filter(Boolean)
    .map(r => r!.question_id);

  if (questionIds.length > 0) {
    const placeholders = questionIds.map(() => '?').join(',');
    console.log(`[sim] Cleaning up ${questionIds.length} question_ids for resume: ${questionIds[0]}..${questionIds[questionIds.length - 1]}`);
    db.prepare(`DELETE FROM tb_responses WHERE question_id IN (${placeholders})`).run(...questionIds);
    db.prepare(`DELETE FROM tb_session_summaries WHERE question_id IN (${placeholders})`).run(...questionIds);
    db.prepare(`DELETE FROM tb_burst_sequences WHERE question_id IN (${placeholders})`).run(...questionIds);
    db.prepare(`DELETE FROM tb_ai_observations WHERE question_id IN (${placeholders})`).run(...questionIds);
    db.prepare(`DELETE FROM tb_ai_suppressed_questions WHERE question_id IN (${placeholders})`).run(...questionIds);
    db.prepare(`DELETE FROM tb_predictions WHERE question_id IN (${placeholders})`).run(...questionIds);
  }
  // Clean up state engine data — recomputed incrementally
  db.prepare('DELETE FROM tb_entry_states WHERE entry_state_id > ?').run(START_DAY - 1);
  db.prepare('DELETE FROM tb_trait_dynamics WHERE entry_count >= ?').run(START_DAY);
  db.prepare('DELETE FROM tb_coupling_matrix WHERE entry_count >= ?').run(START_DAY);
  db.prepare('DELETE FROM tb_emotion_behavior_coupling WHERE entry_count >= ?').run(START_DAY);
}

// ── Main simulation loop ────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  ALICE SIMULATION v2 — ${MODE.toUpperCase()} MODE`);
console.log(`  ${TOTAL_DAYS} days of Jordan Chen`);
console.log(`  Model: ${MODEL}`);
console.log(`  DB: ${SIM_DB_PATH}`);
console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (data only)' : 'FULL PIPELINE (AI calls)'}`);
console.log(`  Embeddings: ${EMBED ? 'ON' : 'OFF'}`);
console.log(`  Starting from day: ${START_DAY}`);
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// Pre-schedule questions for selected days
for (let i = 0; i < TOTAL_DAYS; i++) {
  const entryIndex = SELECTED_DAYS[i];
  const dateStr = simDateStr(entryIndex);
  setSimulatedDate(dateStr);
  setDateOverride(dateStr);
  scheduleQuestion(SEED_QUESTIONS[entryIndex], dateStr, 'seed');
}
restoreDate();
setDateOverride(null);
console.log(`[sim] Scheduled ${TOTAL_DAYS} questions\n`);

for (let i = START_DAY - 1; i < TOTAL_DAYS; i++) {
  const dayNum = i + 1;
  const entryIndex = SELECTED_DAYS[i];
  const dateStr = simDateStr(entryIndex);
  const entry = JORDAN_ENTRIES[entryIndex];
  const question = SEED_QUESTIONS[entryIndex];
  currentDay = dayNum;

  console.log(`── Day ${dayNum}/${TOTAL_DAYS} [${dateStr}] (entry ${entryIndex + 1}) ──────────────────────`);
  console.log(`   Patterns: ${entry.patterns.length > 0 ? entry.patterns.join(', ') : 'none'}`);

  // Set simulated date for both JS and DB
  setSimulatedDate(dateStr);
  setDateOverride(dateStr);

  // 1. Look up actual question_id from DB (may differ from loop index on resume)
  const questionRow = db.prepare(
    'SELECT question_id FROM tb_questions WHERE scheduled_for = ?'
  ).get(dateStr) as { question_id: number } | undefined;
  if (!questionRow) {
    console.error(`   No question found for ${dateStr} — skipping`);
    continue;
  }
  const questionId = questionRow.question_id;
  const responseId = saveResponse(questionId, entry.text.trim());

  // 2. Compute linguistic densities from actual text
  const densities = computeLinguisticDensities(entry.text.trim());

  // 3. Build and save session summary
  const sessionSummary = buildSessionSummary(questionId, entry.text, entry.overrides, entryIndex, entry.patterns);
  saveSessionSummary({
    ...sessionSummary,
    ...densities,
  });
  console.log(`   Data: CR=${sessionSummary.commitmentRatio}, CPM=${sessionSummary.charsPerMinute}, LargeDel=${sessionSummary.largeDeletionCount}`);

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
  // 2026-04-16: runObservation removed with interpretive-layer archive.
  // runReflection now produces a deterministic structured receipt (no LLM).
  let expectReflection = false;
  if (!DRY_RUN) {
    try {
      // Generation: test on last 2 days if we have enough responses
      await runGeneration({ model: MODEL, seedDaysOverride: TOTAL_DAYS - 2, onApiCall });

      const responseCount = getResponseCount();
      if (responseCount >= 5 && responseCount % 7 === 0) {
        expectReflection = true;
        console.log('   Running reflection (structured receipt)...');
        await runReflection();
        console.log('   Reflection complete');
      }
    } catch (err: any) {
      console.error(`   Pipeline error: ${err.message}`);
      if (err.message?.includes('rate_limit') || err.message?.includes('overloaded')) {
        console.log('   Waiting 30s for rate limit...');
        await new Promise(r => setTimeout(r, 30000));
      }
    }
  }

  // 6. Compute 8D state engine (deterministic — no AI)
  try {
    const states = computeEntryStates();
    if (states.length >= 3) {
      // Persist any new entry states
      const existingCount = getEntryStateCount();
      if (states.length > existingCount) {
        const newStates = states.slice(existingCount);
        for (const s of newStates) {
          saveEntryState({
            response_id: s.responseId,
            fluency: s.fluency,
            deliberation: s.deliberation,
            revision: s.revision,
            expression: s.expression,
            commitment: s.commitment,
            volatility: s.volatility,
            thermal: s.thermal,
            presence: s.presence,
            convergence: s.convergence,
          });
        }
      }

      // Compute dynamics + coupling
      const dynamics = computeDynamics(states);
      saveTraitDynamics(dynamics.dimensions.map(d => ({
        entry_count: states.length,
        dimension: d.dimension,
        baseline: d.baseline,
        variability: d.variability,
        attractor_force: d.attractorForce,
        current_state: d.currentState,
        deviation: d.deviation,
        window_size: d.windowSize,
      })));

      if (dynamics.coupling.length > 0) {
        saveCouplingMatrix(dynamics.coupling.map(c => ({
          entry_count: states.length,
          leader: c.leader,
          follower: c.follower,
          lag_sessions: c.lagSessions,
          correlation: c.correlation,
          direction: c.direction,
        })));
      }

      // Emotion→behavior coupling
      const emotionAnalysis = computeEmotionAnalysis(states);
      if (emotionAnalysis.emotionBehaviorCoupling.length > 0) {
        saveEmotionBehaviorCoupling(emotionAnalysis.emotionBehaviorCoupling.map(c => ({
          entry_count: states.length,
          emotion_dim: c.emotionDim,
          behavior_dim: c.behaviorDim,
          lag_sessions: c.lagSessions,
          correlation: c.correlation,
          direction: c.direction,
        })));
      }

      console.log(`   States: ${states.length} entries, phase=${dynamics.phase}, velocity=${dynamics.velocity.toFixed(3)}, coupling=${dynamics.coupling.length}`);
    }
  } catch (err: any) {
    console.error(`   State engine error: ${err.message}`);
  }

  // 7. Validate
  validateDay(dayNum, questionId, dateStr, expectReflection);

  console.log('');
}

restoreDate();
setDateOverride(null);

// ── Cost summary ────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('  SIMULATION COMPLETE');
console.log(`  Database: ${SIM_DB_PATH}`);
console.log('');

if (apiCalls.length > 0) {
  const totalMs = apiCalls.reduce((s, c) => s + c.durationMs, 0);
  const totalIn = apiCalls.reduce((s, c) => s + c.inputTokens, 0);
  const totalOut = apiCalls.reduce((s, c) => s + c.outputTokens, 0);
  const avgMs = Math.round(totalMs / apiCalls.length);

  // Rough cost estimates (per 1M tokens)
  const modelCosts: Record<string, { input: number; output: number }> = {
    'claude-opus-4-6': { input: 15, output: 75 },
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-haiku-4-5-20251001': { input: 0.80, output: 4 },
  };

  let totalCost = 0;
  for (const call of apiCalls) {
    const costs = modelCosts[call.model] ?? { input: 3, output: 15 };
    totalCost += (call.inputTokens / 1_000_000) * costs.input + (call.outputTokens / 1_000_000) * costs.output;
  }

  console.log('  ── TIMING & COST ──');
  console.log(`  API calls:     ${apiCalls.length}`);
  console.log(`  Total time:    ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  Avg per call:  ${(avgMs / 1000).toFixed(1)}s`);
  console.log(`  Input tokens:  ${(totalIn / 1000).toFixed(1)}k`);
  console.log(`  Output tokens: ${(totalOut / 1000).toFixed(1)}k`);
  console.log(`  Est. cost:     $${totalCost.toFixed(2)}`);
  console.log('');

  // Per-phase breakdown
  const byPhase = new Map<string, { count: number; ms: number; inTok: number; outTok: number }>();
  for (const call of apiCalls) {
    const p = byPhase.get(call.phase) ?? { count: 0, ms: 0, inTok: 0, outTok: 0 };
    p.count++;
    p.ms += call.durationMs;
    p.inTok += call.inputTokens;
    p.outTok += call.outputTokens;
    byPhase.set(call.phase, p);
  }

  console.log('  ── PER PHASE ──');
  for (const [phase, p] of byPhase) {
    console.log(`  ${phase.padEnd(18)} ${p.count} calls, ${(p.ms / 1000).toFixed(1)}s, ${(p.inTok / 1000).toFixed(1)}k in / ${(p.outTok / 1000).toFixed(1)}k out`);
  }
  console.log('');
}

// ── Quality scoring (Mode 2 only) ──────────────────────────────────────────
if ((QUALITY_MODE || FULL_MODE) && !DRY_RUN) {
  console.log('  ── GROUND TRUTH SCORING ──');

  const observations = db.prepare(
    'SELECT question_id, observation_text FROM tb_ai_observations ORDER BY question_id'
  ).all() as Array<{ question_id: number; observation_text: string }>;

  const reflections = db.prepare(
    'SELECT text FROM tb_reflections ORDER BY reflection_id'
  ).all() as Array<{ text: string }>;

  const allText = [
    ...observations.map(o => o.observation_text),
    ...reflections.map(r => r.text),
  ].join('\n').toLowerCase();

  // Check pattern detection
  const patternChecks = [
    { id: 'P1', name: 'Relationship → self-censoring', keywords: ['censor', 'self-censor', 'deletion', 'revision', 'mia', 'relationship', 'commitment ratio'] },
    { id: 'P2', name: 'Creative → flow', keywords: ['flow', 'music', 'p-burst', 'fluent', 'creative'] },
    { id: 'P3', name: 'Grief → cognitive load', keywords: ['grief', 'danny', 'cognitive', 'hedging', 'first-person'] },
    { id: 'P4', name: 'Work → agitation', keywords: ['agitat', 'frustrat', 'startup', 'chars per minute', 'fast typing'] },
    { id: 'P5', name: 'Vulnerability hangover', keywords: ['lag', 'hangover', 'next day', 'first keystroke', 'hesitat'] },
  ];

  const falseSignalChecks = [
    { id: 'F1', name: 'Weekend word count (should NOT flag)', keywords: ['weekend', 'day of week', 'word count'] },
    { id: 'F2', name: 'Tab-away × creative (should NOT flag)', keywords: ['tab-away', 'tab away', 'multitask'] },
  ];

  for (const p of patternChecks) {
    const hits = p.keywords.filter(k => allText.includes(k));
    const detected = hits.length >= 2;
    console.log(`  ${detected ? '✓' : '✗'} ${p.id}: ${p.name} (${hits.length}/${p.keywords.length} keywords)`);
  }

  for (const f of falseSignalChecks) {
    const hits = f.keywords.filter(k => allText.includes(k));
    const flagged = hits.length >= 2;
    console.log(`  ${flagged ? '✗ FLAGGED' : '✓ Ignored'} ${f.id}: ${f.name} (${hits.length}/${f.keywords.length} keywords)`);
  }

  // Prediction stats
  const predStats = db.prepare(`
    SELECT prediction_status_id as status, COUNT(*) as count
    FROM tb_predictions GROUP BY prediction_status_id
  `).all() as Array<{ status: number; count: number }>;

  console.log('');
  console.log('  ── PREDICTION STATS ──');
  const statusNames: Record<number, string> = { 1: 'open', 2: 'confirmed', 3: 'falsified', 4: 'expired', 5: 'indeterminate' };
  for (const row of predStats) {
    console.log(`  ${(statusNames[row.status] ?? 'unknown').padEnd(15)} ${row.count}`);
  }

  // Grade method breakdown
  const gradeMethodStats = db.prepare(`
    SELECT grade_method_id as method, COUNT(*) as count
    FROM tb_predictions GROUP BY grade_method_id
  `).all() as Array<{ method: number; count: number }>;
  const methodNames: Record<number, string> = { 1: 'code', 2: 'text_search', 3: 'interpretive' };
  console.log('');
  console.log('  ── GRADE METHOD ──');
  for (const row of gradeMethodStats) {
    console.log(`  ${(methodNames[row.method] ?? 'unknown').padEnd(15)} ${row.count}`);
  }

  // Code-graded outcomes (rationale starts with [code-graded])
  const codeGraded = db.prepare(`
    SELECT COUNT(*) as count FROM tb_predictions
    WHERE grade_rationale LIKE '[code-graded]%'
  `).get() as { count: number };
  if (codeGraded.count > 0) {
    console.log(`  code-graded outcomes: ${codeGraded.count}`);
  }
  console.log('');

  // State engine summary
  const entryStateCount = (db.prepare('SELECT COUNT(*) as c FROM tb_entry_states').get() as any).c;
  const dynamicsCount = (db.prepare('SELECT COUNT(*) as c FROM tb_trait_dynamics').get() as any).c;
  const couplingCount = (db.prepare('SELECT COUNT(*) as c FROM tb_coupling_matrix').get() as any).c;
  const emotionCouplingCount = (db.prepare('SELECT COUNT(*) as c FROM tb_emotion_behavior_coupling').get() as any).c;
  console.log('  ── STATE ENGINE ──');
  console.log(`  Entry states:          ${entryStateCount}`);
  console.log(`  Dynamics snapshots:    ${dynamicsCount}`);
  console.log(`  Coupling edges:        ${couplingCount}`);
  console.log(`  Emotion couplings:     ${emotionCouplingCount}`);

  // Show latest dynamics
  const latestDynamics = db.prepare(`
    SELECT dimension, ROUND(baseline,3) as baseline, ROUND(variability,3) as variability,
           ROUND(attractor_force,3) as attractor, ROUND(current_state,3) as current,
           ROUND(deviation,3) as deviation
    FROM tb_trait_dynamics
    WHERE entry_count = (SELECT MAX(entry_count) FROM tb_trait_dynamics)
    ORDER BY dimension
  `).all() as any[];
  if (latestDynamics.length > 0) {
    console.log('');
    console.log('  ── LATEST DYNAMICS ──');
    for (const d of latestDynamics) {
      const attractorLabel = d.attractor >= 0.7 ? 'rigid' : d.attractor >= 0.4 ? 'moderate' : 'malleable';
      console.log(`  ${d.dimension.padEnd(14)} base=${(d.baseline >= 0 ? '+' : '') + d.baseline}  var=${d.variability}  attr=${d.attractor} (${attractorLabel})  dev=${(d.deviation >= 0 ? '+' : '') + d.deviation}`);
    }
  }

  // Show top couplings
  const latestCouplings = db.prepare(`
    SELECT leader, follower, lag_sessions, ROUND(correlation,3) as corr, direction
    FROM tb_coupling_matrix
    WHERE entry_count = (SELECT MAX(entry_count) FROM tb_coupling_matrix)
    ORDER BY correlation DESC
    LIMIT 10
  `).all() as any[];
  if (latestCouplings.length > 0) {
    console.log('');
    console.log('  ── TOP COUPLINGS ──');
    for (const c of latestCouplings) {
      const sign = c.direction > 0 ? '+' : '-';
      const lagLabel = c.lag_sessions === 0 ? 'concurrent' : `lag-${c.lag_sessions}`;
      console.log(`  ${c.leader} → ${c.follower}  r=${sign}${c.corr}  (${lagLabel})`);
    }
  }
  console.log('');
}

// ── Validation results ──────────────────────────────────────────────────────
if (failures.length > 0) {
  console.log('  ── VALIDATION FAILURES ──');
  for (const f of failures) {
    console.log(`  ✗ Day ${f.day} [${f.check}]: ${f.detail}`);
  }
  console.log('');
  console.log(`  ${failures.length} failure(s).`);
}
if (!DRY_RUN) {
  console.log('');
}

// ── Generate versioned report ───────────────────────────────────────────────
{
  const reportsDir = path.resolve(__dirname, '../../data/simulation/reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  // Version: find next available number
  const existing = fs.readdirSync(reportsDir).filter(f => f.match(/^sim-v\d+/));
  const nextVersion = existing.length > 0
    ? Math.max(...existing.map(f => parseInt(f.match(/sim-v(\d+)/)?.[1] ?? '0', 10))) + 1
    : 1;

  const runDate = new OriginalDate().toISOString().split('T')[0];
  const filename = `sim-v${nextVersion}-${MODE}-${runDate}.md`;
  const filepath = path.resolve(reportsDir, filename);

  // Gather data for report
  const totalResponses = (db.prepare('SELECT COUNT(*) as c FROM tb_responses').get() as any).c;
  const totalObs = (db.prepare('SELECT COUNT(*) as c FROM tb_ai_observations').get() as any).c;
  const totalSuppressed = (db.prepare('SELECT COUNT(*) as c FROM tb_ai_suppressed_questions').get() as any).c;
  const totalPredictions = (db.prepare('SELECT COUNT(*) as c FROM tb_predictions').get() as any).c;
  const totalReflections = (db.prepare('SELECT COUNT(*) as c FROM tb_reflections').get() as any).c;

  const predStatusRows = db.prepare(`
    SELECT prediction_status_id as status, COUNT(*) as count
    FROM tb_predictions GROUP BY prediction_status_id
  `).all() as Array<{ status: number; count: number }>;
  const statusNames: Record<number, string> = { 1: 'open', 2: 'confirmed', 3: 'falsified', 4: 'expired', 5: 'indeterminate' };
  const predStatusLines = predStatusRows.map(r => `| ${statusNames[r.status] ?? 'unknown'} | ${r.count} |`).join('\n');

  const theoryRows = db.prepare(`
    SELECT theory_key, ROUND(alpha*1.0/(alpha+beta),3) as confidence, total_predictions,
           alpha, beta, ROUND(log_bayes_factor, 3) as logBF, status
    FROM tb_theory_confidence ORDER BY total_predictions DESC
  `).all() as Array<{ theory_key: string; confidence: number; total_predictions: number; alpha: number; beta: number; logBF: number; status: string }>;
  const theoryLines = theoryRows.map(r => `| ${r.theory_key} | ${r.confidence} | ${r.total_predictions} | ${r.logBF} | ${r.status} |`).join('\n');

  // Grade method breakdown for report
  const reportGradeMethodRows = db.prepare(`
    SELECT grade_method_id as method, COUNT(*) as count
    FROM tb_predictions GROUP BY grade_method_id
  `).all() as Array<{ method: number; count: number }>;
  const reportMethodNames: Record<number, string> = { 1: 'code', 2: 'text_search', 3: 'interpretive' };
  const gradeMethodLines = reportGradeMethodRows.map(r => `| ${reportMethodNames[r.method] ?? 'unknown'} | ${r.count} |`).join('\n');
  const codeGradedOutcomes = (db.prepare(`SELECT COUNT(*) as c FROM tb_predictions WHERE grade_rationale LIKE '[code-graded]%'`).get() as any).c;

  // State engine data for report
  const reportEntryStates = (db.prepare('SELECT COUNT(*) as c FROM tb_entry_states').get() as any).c;
  const reportDynamics = db.prepare(`
    SELECT dimension, ROUND(baseline,3) as baseline, ROUND(variability,3) as variability,
           ROUND(attractor_force,3) as attractor, ROUND(current_state,3) as current,
           ROUND(deviation,3) as deviation
    FROM tb_trait_dynamics
    WHERE entry_count = (SELECT MAX(entry_count) FROM tb_trait_dynamics)
    ORDER BY dimension
  `).all() as any[];
  const reportCouplings = db.prepare(`
    SELECT leader, follower, lag_sessions, ROUND(correlation,3) as corr, direction
    FROM tb_coupling_matrix
    WHERE entry_count = (SELECT MAX(entry_count) FROM tb_coupling_matrix)
    ORDER BY correlation DESC
    LIMIT 10
  `).all() as any[];
  const reportEmotionCouplings = db.prepare(`
    SELECT emotion_dim, behavior_dim, lag_sessions, ROUND(correlation,3) as corr, direction
    FROM tb_emotion_behavior_coupling
    WHERE entry_count = (SELECT MAX(entry_count) FROM tb_emotion_behavior_coupling)
    ORDER BY correlation DESC
    LIMIT 10
  `).all() as any[];

  // Timing summary
  let timingSection = '';
  if (apiCalls.length > 0) {
    const totalMs = apiCalls.reduce((s, c) => s + c.durationMs, 0);
    const totalIn = apiCalls.reduce((s, c) => s + c.inputTokens, 0);
    const totalOut = apiCalls.reduce((s, c) => s + c.outputTokens, 0);
    const modelCosts: Record<string, { input: number; output: number }> = {
      'claude-opus-4-6': { input: 15, output: 75 },
      'claude-sonnet-4-20250514': { input: 3, output: 15 },
      'claude-haiku-4-5-20251001': { input: 0.80, output: 4 },
    };
    let totalCost = 0;
    for (const call of apiCalls) {
      const costs = modelCosts[call.model] ?? { input: 3, output: 15 };
      totalCost += (call.inputTokens / 1_000_000) * costs.input + (call.outputTokens / 1_000_000) * costs.output;
    }

    // Per-phase breakdown
    const byPhase = new Map<string, { count: number; ms: number; inTok: number; outTok: number }>();
    for (const call of apiCalls) {
      const p = byPhase.get(call.phase) ?? { count: 0, ms: 0, inTok: 0, outTok: 0 };
      p.count++;
      p.ms += call.durationMs;
      p.inTok += call.inputTokens;
      p.outTok += call.outputTokens;
      byPhase.set(call.phase, p);
    }

    const phaseLines = Array.from(byPhase).map(([phase, p]) =>
      `| ${phase} | ${p.count} | ${(p.ms / 1000).toFixed(1)}s | ${(p.inTok / 1000).toFixed(1)}k | ${(p.outTok / 1000).toFixed(1)}k |`
    ).join('\n');

    // Per-day timing
    const dayTimings = new Map<number, { totalMs: number; calls: number }>();
    for (const call of apiCalls) {
      const d = dayTimings.get(call.day) ?? { totalMs: 0, calls: 0 };
      d.totalMs += call.durationMs;
      d.calls++;
      dayTimings.set(call.day, d);
    }
    const dayTimingLines = Array.from(dayTimings).map(([day, d]) =>
      `| ${day} | ${d.calls} | ${(d.totalMs / 1000).toFixed(1)}s |`
    ).join('\n');

    timingSection = `## Timing & Cost

| Metric | Value |
|--------|-------|
| API calls | ${apiCalls.length} |
| Total time | ${(totalMs / 1000).toFixed(1)}s |
| Avg per call | ${(totalMs / apiCalls.length / 1000).toFixed(1)}s |
| Input tokens | ${(totalIn / 1000).toFixed(1)}k |
| Output tokens | ${(totalOut / 1000).toFixed(1)}k |
| Est. cost | $${totalCost.toFixed(2)} |

### Per Phase

| Phase | Calls | Time | Input | Output |
|-------|-------|------|-------|--------|
${phaseLines}

### Per Day

| Day | Calls | Time |
|-----|-------|------|
${dayTimingLines}
`;
  }

  // Quality scoring section
  let qualitySection = '';
  if ((QUALITY_MODE || FULL_MODE) && !DRY_RUN) {
    const observations = db.prepare(
      'SELECT observation_text FROM tb_ai_observations ORDER BY question_id'
    ).all() as Array<{ observation_text: string }>;
    const reflections = db.prepare(
      'SELECT text FROM tb_reflections ORDER BY reflection_id'
    ).all() as Array<{ text: string }>;
    const allText = [
      ...observations.map(o => o.observation_text),
      ...reflections.map(r => r.text),
    ].join('\n').toLowerCase();

    const patternChecks = [
      { id: 'P1', name: 'Relationship -> self-censoring', keywords: ['censor', 'self-censor', 'deletion', 'revision', 'mia', 'relationship', 'commitment ratio'] },
      { id: 'P2', name: 'Creative -> flow', keywords: ['flow', 'music', 'p-burst', 'fluent', 'creative'] },
      { id: 'P3', name: 'Grief -> cognitive load', keywords: ['grief', 'danny', 'cognitive', 'hedging', 'first-person'] },
      { id: 'P4', name: 'Work -> agitation', keywords: ['agitat', 'frustrat', 'startup', 'chars per minute', 'fast typing'] },
      { id: 'P5', name: 'Vulnerability hangover', keywords: ['lag', 'hangover', 'next day', 'first keystroke', 'hesitat'] },
    ];
    const falseSignalChecks = [
      { id: 'F1', name: 'Weekend word count', keywords: ['weekend', 'day of week', 'word count'] },
      { id: 'F2', name: 'Tab-away x creative', keywords: ['tab-away', 'tab away', 'multitask'] },
    ];

    const patternLines = patternChecks.map(p => {
      const hits = p.keywords.filter(k => allText.includes(k));
      return `| ${p.id} | ${p.name} | ${hits.length >= 2 ? 'DETECTED' : 'MISSED'} | ${hits.length}/${p.keywords.length} |`;
    }).join('\n');

    const falseLines = falseSignalChecks.map(f => {
      const hits = f.keywords.filter(k => allText.includes(k));
      return `| ${f.id} | ${f.name} | ${hits.length >= 2 ? 'FLAGGED (bad)' : 'IGNORED (good)'} | ${hits.length}/${f.keywords.length} |`;
    }).join('\n');

    qualitySection = `## Ground Truth Scoring

### Planted Patterns (should detect)

| ID | Pattern | Result | Keywords |
|----|---------|--------|----------|
${patternLines}

### False Signals (should ignore)

| ID | Signal | Result | Keywords |
|----|--------|--------|----------|
${falseLines}
`;
  }

  // Validation section
  const validationSection = failures.length > 0
    ? `## Validation Failures

${failures.map(f => `- **Day ${f.day}** [${f.check}]: ${f.detail}`).join('\n')}
`
    : `## Validation

All checks passed.
`;

  // Selected entries
  const entryLines = SELECTED_DAYS.map((entryIndex, i) => {
    const entry = JORDAN_ENTRIES[entryIndex];
    return `| ${i + 1} | ${simDateStr(entryIndex)} | ${entry.patterns.length > 0 ? entry.patterns.join(', ') : 'none'} |`;
  }).join('\n');

  const report = `# Simulation Report v${nextVersion}

**Date:** ${runDate}
**Mode:** ${MODE}
**Model:** ${MODEL}
**Days:** ${TOTAL_DAYS}
**Database:** \`data/simulation/alice-sim.db\`
**Status:** ${failures.length > 0 ? `${failures.length} FAILURE(S)` : 'PASSED'}

---

## Pipeline Changes Since v1

- Observation split into three API calls (observe + suppress + predict) to prevent token truncation
- Suppressed question generation in dedicated call (10/10 reliability)
- Prediction generation uses tool use for structured output (no regex parsing)
- Prediction grading now has correct observation ID linkage
- Timestamps use simulated dates, not wall-clock
- Deletion halves are pattern-driven (P1=late-heavy, P4=early-heavy)
- largestDeletion calculation fixed (per-deletion avg, not total)
- All API calls timed with token counts

---

## Data Summary

| What | Count |
|------|-------|
| Responses | ${totalResponses} |
| Observations | ${totalObs} |
| Suppressed questions | ${totalSuppressed} |
| Predictions | ${totalPredictions} |
| Reflections | ${totalReflections} |

### Prediction Status

| Status | Count |
|--------|-------|
${predStatusLines || '| (none) | 0 |'}

### Grade Method

| Method | Count |
|--------|-------|
${gradeMethodLines || '| (none) | 0 |'}

Code-graded outcomes: ${codeGradedOutcomes}

### Theory Confidence

| Theory | Posterior | Predictions | Log-BF | Status |
|--------|----------|-------------|--------|--------|
${theoryLines || '| (none) | - | 0 | - | - |'}

### What Happened (Plain English)

${(() => {
    const confirmed = predStatusRows.find(r => r.status === 2)?.count ?? 0;
    const falsified = predStatusRows.find(r => r.status === 3)?.count ?? 0;
    const open = predStatusRows.find(r => r.status === 1)?.count ?? 0;
    const indeterminate = predStatusRows.find(r => r.status === 5)?.count ?? 0;
    const total = totalPredictions;
    const theoryCount = theoryRows.length;
    const activeTheories = theoryRows.filter(r => r.status === 'active').length;
    const retiredTheories = theoryRows.filter(r => r.status === 'retired').length;
    const establishedTheories = theoryRows.filter(r => r.status === 'established').length;

    const lines: string[] = [];

    // Prediction accuracy
    const graded = confirmed + falsified;
    if (graded > 0) {
      const hitRate = Math.round((confirmed / graded) * 100);
      if (confirmed === 0) {
        lines.push(`The system made ${total} predictions and none were confirmed — every testable prediction was wrong. This usually means the system is testing bad theories or setting thresholds too aggressively.`);
      } else if (hitRate < 20) {
        lines.push(`The system made ${total} predictions. Of the ${graded} that could be graded, ${confirmed} were confirmed (${hitRate}% hit rate). Most predictions were wrong, but the system is starting to get some right.`);
      } else if (hitRate < 50) {
        lines.push(`The system made ${total} predictions. Of the ${graded} that could be graded, ${confirmed} were confirmed and ${falsified} falsified (${hitRate}% hit rate). This is a healthy range — the system is learning which patterns are real and which are stories.`);
      } else {
        lines.push(`The system made ${total} predictions with a ${hitRate}% hit rate (${confirmed} confirmed, ${falsified} falsified out of ${graded} graded). The system's theories are holding up well against the data.`);
      }
    } else {
      lines.push(`The system made ${total} predictions but none could be graded yet — they're either still open or indeterminate.`);
    }

    if (open > 0) lines.push(`${open} prediction${open > 1 ? 's are' : ' is'} still open, waiting for future data.`);
    if (indeterminate > 0) lines.push(`${indeterminate} prediction${indeterminate > 1 ? 's were' : ' was'} indeterminate — the data needed to test them wasn't available.`);

    // Theory lifecycle
    if (theoryCount === 0) {
      lines.push(`No theories were created yet — the system hasn't accumulated enough observations.`);
    } else {
      const topTheory = theoryRows[0];
      const distribution = theoryRows.map(r => r.total_predictions).join('/');
      lines.push(`The system built ${theoryCount} theor${theoryCount === 1 ? 'y' : 'ies'} with prediction distribution ${distribution}.`);

      if (theoryCount === 1) {
        lines.push(`Only one theory emerged — the system needs more diverse data or more days to develop competing hypotheses.`);
      } else if (topTheory.total_predictions > total * 0.7) {
        lines.push(`The top theory (${topTheory.theory_key}) absorbed ${topTheory.total_predictions} of ${total} predictions — still top-heavy. Thompson sampling is working but the theory was created early and accumulated predictions before alternatives emerged.`);
      } else {
        lines.push(`Predictions are reasonably spread across theories — Thompson sampling is distributing attention well.`);
      }

      if (retiredTheories > 0) lines.push(`${retiredTheories} theor${retiredTheories === 1 ? 'y was' : 'ies were'} retired (Bayes factor below 1/10 — strong evidence against). Retired theories are permanently removed from the LLM's view.`);
      if (establishedTheories > 0) lines.push(`${establishedTheories} theor${establishedTheories === 1 ? 'y was' : 'ies were'} established (Bayes factor above 10 — strong evidence for). Established theories stop being tested.`);
      if (activeTheories > 0 && activeTheories === theoryCount) lines.push(`All ${activeTheories} theories are still active — none have accumulated enough evidence to graduate or retire yet.`);

      // Flag failing theories that should concern us
      for (const t of theoryRows) {
        if (t.confidence < 0.15 && t.status === 'active' && t.total_predictions >= 5) {
          lines.push(`Warning: ${t.theory_key} has posterior ${t.confidence} after ${t.total_predictions} predictions but hasn't been retired yet (log-BF ${t.logBF} hasn't crossed -2.3 threshold). It's close — a few more falsifications will retire it.`);
        }
      }
    }

    return lines.join('\n\n');
  })()}

---

## Selected Entries

| Day | Date | Patterns |
|-----|------|----------|
${entryLines}

---

${timingSection}
${qualitySection}
${(() => {
    if (reportEntryStates === 0) return '';
    let section = `## State Engine (8D Behavioral Dynamics)\n\n`;
    section += `Entry states computed: ${reportEntryStates}\n\n`;

    if (reportDynamics.length > 0) {
      section += `### Final Dynamics\n\n`;
      section += `| Dimension | Baseline | Variability | Attractor | Current | Deviation |\n`;
      section += `|-----------|----------|-------------|-----------|---------|----------|\n`;
      for (const d of reportDynamics) {
        const attractorLabel = d.attractor >= 0.7 ? 'rigid' : d.attractor >= 0.4 ? 'moderate' : 'malleable';
        section += `| ${d.dimension} | ${d.baseline} | ${d.variability} | ${d.attractor} (${attractorLabel}) | ${d.current} | ${d.deviation} |\n`;
      }
      section += '\n';
    }

    if (reportCouplings.length > 0) {
      section += `### Top Behavioral Couplings\n\n`;
      section += `| Leader | Follower | Lag | Correlation | Direction |\n`;
      section += `|--------|----------|-----|-------------|----------|\n`;
      for (const c of reportCouplings) {
        const sign = c.direction > 0 ? '+' : '-';
        const lagLabel = c.lag_sessions === 0 ? 'concurrent' : `lag-${c.lag_sessions}`;
        section += `| ${c.leader} | ${c.follower} | ${lagLabel} | ${sign}${c.corr} | ${c.direction > 0 ? 'same' : 'opposite'} |\n`;
      }
      section += '\n';
    }

    if (reportEmotionCouplings.length > 0) {
      section += `### Top Emotion→Behavior Couplings\n\n`;
      section += `| Emotion | Behavior | Lag | Correlation | Direction |\n`;
      section += `|---------|----------|-----|-------------|----------|\n`;
      for (const c of reportEmotionCouplings) {
        const sign = c.direction > 0 ? '+' : '-';
        const lagLabel = c.lag_sessions === 0 ? 'concurrent' : `lag-${c.lag_sessions}`;
        section += `| ${c.emotion_dim} | ${c.behavior_dim} | ${lagLabel} | ${sign}${c.corr} | ${c.direction > 0 ? 'same' : 'opposite'} |\n`;
      }
      section += '\n';
    }

    return section;
  })()}
${validationSection}
---

## How to Inspect

\`\`\`bash
sqlite3 data/simulation/alice-sim.db "SELECT observation_date, substr(observation_text,1,200) FROM tb_ai_observations ORDER BY observation_date"
sqlite3 data/simulation/alice-sim.db "SELECT hypothesis, prediction_status_id, grade_rationale FROM tb_predictions"
sqlite3 data/simulation/alice-sim.db "SELECT suppressed_date, suppressed_text FROM tb_ai_suppressed_questions"
sqlite3 data/simulation/alice-sim.db "SELECT theory_key, ROUND(alpha*1.0/(alpha+beta),3) as confidence FROM tb_theory_confidence"
sqlite3 data/simulation/alice-sim.db "SELECT substr(text,1,500) FROM tb_reflections ORDER BY reflection_id"
\`\`\`
`;

  fs.writeFileSync(filepath, report.trim() + '\n');
  console.log(`  Report saved: ${filepath}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

if (failures.length > 0) {
  process.exit(1);
}
