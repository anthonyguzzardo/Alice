/**
 * Phase 2/3 end-to-end smoke test.
 *
 * Exercises the real Rust engine + real DB + real provenance flow with a
 * synthetic keystroke session. NO worker, NO HTTP, NO LLM cost. Cleans up
 * the test question after verification.
 *
 * Run: npx tsx scripts/smokeTestPhase23.ts
 */

// alice-lint-disable-file subject-scope -- script operates exclusively on a single test question_id (globally unique); raw SQL is teardown by question_id and post-pipeline assertions on the same id

import 'dotenv/config';
import sql, {
  saveResponse,
  saveSessionSummary,
  saveSessionEvents,
  getDynamicalSignals,
  getMotorSignals,
  getProcessSignals,
  stampEngineProvenance,
} from '../src/lib/libDb.ts';
import { computeAndPersistDerivedSignals } from '../src/lib/libSignalPipeline.ts';
import { getEngineProvenanceId } from '../src/lib/libEngineProvenance.ts';
import { coerceSessionSummary } from '../src/lib/utlSessionSummary.ts';
import { parseSubjectIdArg } from '../src/lib/utlSubjectIdArg.ts';

const MARKER = '[SMOKE-2026-04-25]';

interface KeystrokeEvent {
  c: string;
  d: number;
  u: number;
}

function synthesizeKeystrokeStream(text: string): { stream: KeystrokeEvent[]; eventLog: unknown[]; durationMs: number } {
  const stream: KeystrokeEvent[] = [];
  const eventLog: unknown[] = [];
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const flight = 60 + Math.floor(Math.random() * 80);
    const hold = 50 + Math.floor(Math.random() * 60);
    t += flight;
    const d = t;
    const u = t + hold;
    stream.push({ c: ch, d, u });
    eventLog.push({ type: 'keydown', t: d, c: ch });
    eventLog.push({ type: 'keyup', t: u, c: ch });
    t = u;
  }
  return { stream, eventLog, durationMs: t };
}

async function setupTestSession(subjectId: number): Promise<number> {
  const promptText = `${MARKER} test question — depth over speed`;
  const responseText = `${MARKER} this is a synthetic response written for the phase 2 and phase 3 end to end smoke test. it has enough characters to clear the dynamical and motor signal thresholds, with reasonable variance in keystroke timing to allow the rust engine to compute meaningful values.`;

  const { stream, eventLog, durationMs } = synthesizeKeystrokeStream(responseText);

  const questionId = await sql.begin(async (tx) => {
    const [q] = await tx`
      INSERT INTO tb_questions (subject_id, text, question_source_id)
      VALUES (${subjectId}, ${promptText}, 3)
      RETURNING question_id
    `;
    if (!q) throw new Error('smoke test: question insert returned no row');
    const qid = q.question_id as number;

    await saveResponse(subjectId, qid, responseText, tx, {
      boundaryVersion: 'v1',
      codePathsRef: 'docs/contamination-boundary-v1.md',
      commitHash: 'smoke-test',
    });

    await saveSessionEvents({
      subject_id: subjectId,
      question_id: qid,
      event_log_json: JSON.stringify(eventLog),
      total_events: eventLog.length,
      session_duration_ms: durationMs,
      keystroke_stream_json: JSON.stringify(stream),
      total_input_events: eventLog.length,
      decimation_count: 0,
    }, tx);

    const coerced = coerceSessionSummary(
      subjectId,
      {
        totalDurationMs: durationMs,
        pasteCount: 0,
        dropCount: 0,
        keystrokeCount: stream.length,
        hourOfDay: new Date().getHours(),
      },
      qid,
      responseText,
    );
    await saveSessionSummary(coerced, tx);

    return qid;
  });

  return questionId;
}

async function cleanup(questionId: number): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM tb_dynamical_signals       WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_motor_signals           WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_semantic_signals        WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_process_signals         WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_cross_session_signals   WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_session_integrity       WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_reconstruction_residuals WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_burst_sequences         WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_session_metadata        WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_session_events          WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_session_summaries       WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_responses               WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_signal_jobs             WHERE question_id = ${questionId}`;
    await tx`DELETE FROM tb_questions               WHERE question_id = ${questionId}`;
  });
}

async function main() {
  const subjectId = parseSubjectIdArg();
  console.log('=== Phase 2/3 smoke test ===');
  let questionId = -1;
  let exitCode = 0;
  try {
    console.log('1. Inserting synthetic test session...');
    questionId = await setupTestSession(subjectId);
    console.log(`   ✓ test question_id = ${questionId}`);

    console.log('2. Running computeAndPersistDerivedSignals (real Rust engine)...');
    await computeAndPersistDerivedSignals(subjectId, questionId);

    const ds = await getDynamicalSignals(subjectId, questionId);
    const ms = await getMotorSignals(subjectId, questionId);
    const ps = await getProcessSignals(subjectId, questionId);
    console.log(`   ✓ dynamical: ${ds ? 'saved' : 'MISSING'}`);
    console.log(`   ✓ motor:     ${ms ? 'saved' : 'MISSING'}`);
    console.log(`   ✓ process:   ${ps ? 'saved' : 'MISSING'}`);
    if (!ds || !ms) throw new Error('expected dynamical and motor rows');

    console.log('3. Computing engine provenance (SHA-256 of .node + cpu_model)...');
    const provId = await getEngineProvenanceId();
    if (provId === null) throw new Error('getEngineProvenanceId returned null');
    const [provRow] = await sql`SELECT * FROM tb_engine_provenance WHERE engine_provenance_id = ${provId}`;
    if (!provRow) throw new Error('provenance row not found after upsert');
    console.log(`   ✓ provenance_id = ${provId}`);
    console.log(`   ✓ binary_sha256 = ${(provRow as { binary_sha256: string }).binary_sha256}`);
    console.log(`   ✓ cpu_model     = ${(provRow as { cpu_model: string }).cpu_model}`);
    console.log(`   ✓ host_arch     = ${(provRow as { host_arch: string }).host_arch}`);

    console.log('4. Stamping provenance on signal rows...');
    await stampEngineProvenance(subjectId, questionId, provId);

    const [stampedDyn] = await sql`SELECT engine_provenance_id FROM tb_dynamical_signals WHERE question_id = ${questionId}`;
    const [stampedMot] = await sql`SELECT engine_provenance_id FROM tb_motor_signals    WHERE question_id = ${questionId}`;
    const dynStamped = (stampedDyn as { engine_provenance_id: number | null } | undefined)?.engine_provenance_id === provId;
    const motStamped = (stampedMot as { engine_provenance_id: number | null } | undefined)?.engine_provenance_id === provId;
    console.log(`   ✓ tb_dynamical_signals.engine_provenance_id = ${dynStamped ? 'stamped' : 'MISSING'}`);
    console.log(`   ✓ tb_motor_signals.engine_provenance_id     = ${motStamped ? 'stamped' : 'MISSING'}`);
    if (!dynStamped || !motStamped) throw new Error('stamp did not land');

    console.log('\nPASS: Phase 2 pipeline + Phase 3 provenance wiring verified end-to-end.');
  } catch (err) {
    console.error('\nFAIL:', err);
    exitCode = 1;
  } finally {
    if (questionId > 0) {
      console.log(`\nCleaning up test question_id=${questionId}...`);
      try {
        await cleanup(questionId);
        console.log('   ✓ cleanup complete');
      } catch (err) {
        console.error('   cleanup failed:', err);
      }
    }
    await sql.end({ timeout: 5 });
    process.exit(exitCode);
  }
}

void main();
