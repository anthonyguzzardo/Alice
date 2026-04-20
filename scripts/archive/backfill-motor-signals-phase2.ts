/**
 * One-off backfill: recompute motor signals for all sessions to populate
 * ex-Gaussian tau, ex-Gaussian mu/sigma, tau proportion, and adjacent
 * hold-time covariance fields added in Phase 2 expansion (2026-04-18).
 *
 * These fields are computed from the raw keystroke stream which has been
 * stored in tb_session_events since day 1. The computation code was added
 * to motor-signals.ts but existing rows have NULLs because they were
 * computed before the new code existed.
 *
 * Strategy: for each session with a keystroke stream, recompute all motor
 * signals and UPDATE the existing row. If no motor signal row exists yet,
 * INSERT a new one (handles sessions where the pipeline failed).
 *
 * Idempotent: safe to re-run. Overwrites existing values with fresh
 * computation (the math is deterministic so values won't change).
 *
 * Usage: npx tsx scripts/backfill-motor-signals-phase2.ts
 */

import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { computeMotorSignals } from '../src/lib/libMotorSignals.ts';
import type { KeystrokeEvent } from '../src/lib/libDynamicalSignals.ts';

const DB_PATH = resolve(process.cwd(), 'data/alice.db');
const db = new Database(DB_PATH);

// Get all sessions with keystroke streams
const sessions = db.prepare(`
  SELECT se.question_id, se.keystroke_stream_json, ss.total_duration_ms
  FROM tb_session_events se
  JOIN tb_session_summaries ss ON ss.question_id = se.question_id
  WHERE se.keystroke_stream_json IS NOT NULL
  ORDER BY se.question_id ASC
`).all() as Array<{
  question_id: number;
  keystroke_stream_json: string;
  total_duration_ms: number;
}>;

console.log(`Found ${sessions.length} sessions with keystroke streams.\n`);

let updated = 0;
let inserted = 0;
let skipped = 0;

for (const session of sessions) {
  let stream: KeystrokeEvent[];
  try {
    stream = JSON.parse(session.keystroke_stream_json);
  } catch {
    console.log(`  q${session.question_id}: invalid JSON, skipping`);
    skipped++;
    continue;
  }

  if (stream.length < 10) {
    console.log(`  q${session.question_id}: only ${stream.length} keystrokes, skipping`);
    skipped++;
    continue;
  }

  const ms = computeMotorSignals(stream, session.total_duration_ms);

  // Check if a motor signal row exists
  const existing = db.prepare(
    'SELECT motor_signal_id FROM tb_motor_signals WHERE question_id = ?'
  ).get(session.question_id) as { motor_signal_id: number } | undefined;

  if (existing) {
    // UPDATE existing row with new fields
    db.prepare(`
      UPDATE tb_motor_signals SET
        sample_entropy = ?,
        iki_autocorrelation_json = ?,
        motor_jerk = ?,
        lapse_rate = ?,
        tempo_drift = ?,
        iki_compression_ratio = ?,
        digraph_latency_json = ?,
        ex_gaussian_tau = ?,
        ex_gaussian_mu = ?,
        ex_gaussian_sigma = ?,
        tau_proportion = ?,
        adjacent_hold_time_cov = ?
      WHERE question_id = ?
    `).run(
      ms.sampleEntropy,
      ms.ikiAutocorrelation ? JSON.stringify(ms.ikiAutocorrelation) : null,
      ms.motorJerk,
      ms.lapseRate,
      ms.tempoDrift,
      ms.ikiCompressionRatio,
      ms.digraphLatencyProfile ? JSON.stringify(ms.digraphLatencyProfile) : null,
      ms.exGaussianTau,
      ms.exGaussianMu,
      ms.exGaussianSigma,
      ms.tauProportion,
      ms.adjacentHoldTimeCov,
      session.question_id
    );
    console.log(`  q${session.question_id}: UPDATED — tau=${ms.exGaussianTau?.toFixed(1) ?? 'null'}, adjCov=${ms.adjacentHoldTimeCov?.toFixed(3) ?? 'null'}`);
    updated++;
  } else {
    // INSERT new row
    db.prepare(`
      INSERT INTO tb_motor_signals (
        question_id, sample_entropy, iki_autocorrelation_json,
        motor_jerk, lapse_rate, tempo_drift,
        iki_compression_ratio, digraph_latency_json,
        ex_gaussian_tau, ex_gaussian_mu, ex_gaussian_sigma,
        tau_proportion, adjacent_hold_time_cov
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.question_id,
      ms.sampleEntropy,
      ms.ikiAutocorrelation ? JSON.stringify(ms.ikiAutocorrelation) : null,
      ms.motorJerk,
      ms.lapseRate,
      ms.tempoDrift,
      ms.ikiCompressionRatio,
      ms.digraphLatencyProfile ? JSON.stringify(ms.digraphLatencyProfile) : null,
      ms.exGaussianTau,
      ms.exGaussianMu,
      ms.exGaussianSigma,
      ms.tauProportion,
      ms.adjacentHoldTimeCov
    );
    console.log(`  q${session.question_id}: INSERTED — tau=${ms.exGaussianTau?.toFixed(1) ?? 'null'}, adjCov=${ms.adjacentHoldTimeCov?.toFixed(3) ?? 'null'}`);
    inserted++;
  }
}

console.log(`\nDone. Updated: ${updated}, Inserted: ${inserted}, Skipped: ${skipped}`);

// Verify
const verify = db.prepare(`
  SELECT question_id, ex_gaussian_tau, ex_gaussian_mu, tau_proportion, adjacent_hold_time_cov
  FROM tb_motor_signals
  ORDER BY question_id ASC
`).all();
console.log('\nVerification:');
for (const row of verify as any[]) {
  console.log(`  q${row.question_id}: tau=${row.ex_gaussian_tau?.toFixed(1) ?? 'null'}, mu=${row.ex_gaussian_mu?.toFixed(1) ?? 'null'}, tauProp=${row.tau_proportion?.toFixed(3) ?? 'null'}, adjCov=${row.adjacent_hold_time_cov?.toFixed(3) ?? 'null'}`);
}

db.close();
