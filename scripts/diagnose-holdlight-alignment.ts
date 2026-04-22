/**
 * Diagnostic: Detect HoldFlight misalignment in existing sessions.
 *
 * The old HoldFlight::from_stream filtered holds and flights independently,
 * so event i could contribute a hold but not a flight (or vice versa),
 * causing the two vectors to refer to different events. This means
 * transfer entropy and RQA computed on those pairs used misaligned data.
 *
 * This script checks every session with keystroke data and reports:
 * - How many sessions have ANY misalignment
 * - Per session: the count of misaligned events and the vector length delta
 * - Whether the stored TE and RQA values for those sessions are suspect
 *
 * Usage: npx tsx scripts/diagnose-holdlight-alignment.ts
 */

import { sql } from '../src/lib/libDb.ts';

interface KeystrokeEvent {
  c: string;
  d: number;
  u: number;
}

// ── Old extraction (misaligned): filter hold and flight independently ──

function extractOld(stream: KeystrokeEvent[]): { holds: number[]; flights: number[] } {
  const holds: number[] = [];
  const flights: number[] = [];

  for (let i = 0; i < stream.length; i++) {
    const ht = stream[i].u - stream[i].d;
    if (ht > 0 && ht < 2000) {
      holds.push(ht);
    }
    if (i > 0) {
      const ft = stream[i].d - stream[i - 1].u;
      if (ft > 0 && ft < 5000) {
        flights.push(ft);
      }
    }
  }

  return { holds, flights };
}

// ── New extraction (aligned): only push when both are valid for same event ──

function extractNew(stream: KeystrokeEvent[]): { holds: number[]; flights: number[] } {
  const holds: number[] = [];
  const flights: number[] = [];

  for (let i = 1; i < stream.length; i++) {
    const ht = stream[i].u - stream[i].d;
    const ft = stream[i].d - stream[i - 1].u;
    if (ht > 0 && ht < 2000 && ft > 0 && ft < 5000) {
      holds.push(ht);
      flights.push(ft);
    }
  }

  return { holds, flights };
}

// ── Per-event diagnostic: which events diverge? ──

interface EventDiag {
  index: number;
  holdValid: boolean;
  flightValid: boolean;
  hold: number;
  flight: number;
}

function findMisalignedEvents(stream: KeystrokeEvent[]): EventDiag[] {
  const misaligned: EventDiag[] = [];

  for (let i = 1; i < stream.length; i++) {
    const ht = stream[i].u - stream[i].d;
    const ft = stream[i].d - stream[i - 1].u;
    const holdValid = ht > 0 && ht < 2000;
    const flightValid = ft > 0 && ft < 5000;

    // Misaligned = one is valid and the other isn't
    if (holdValid !== flightValid) {
      misaligned.push({ index: i, holdValid, flightValid, hold: ht, flight: ft });
    }
  }

  return misaligned;
}

// ── Main ──

async function main() {
  console.log('Diagnosing HoldFlight alignment across all sessions...\n');

  const rows = await sql`
    SELECT se.question_id,
           se.keystroke_stream_json,
           q.scheduled_for AS date,
           ds.te_hold_to_flight,
           ds.te_flight_to_hold,
           ds.te_dominance,
           ds.rqa_determinism,
           ds.rqa_laminarity,
           ds.rqa_recurrence_rate
    FROM tb_session_events se
    JOIN tb_questions q ON se.question_id = q.question_id
    LEFT JOIN tb_dynamical_signals ds ON se.question_id = ds.question_id
    WHERE se.keystroke_stream_json IS NOT NULL
    ORDER BY q.question_id ASC
  `;

  let totalSessions = 0;
  let cleanSessions = 0;
  let affectedSessions = 0;
  let totalMisalignedEvents = 0;

  interface AffectedSession {
    questionId: number;
    date: string | null;
    misalignedCount: number;
    oldHoldLen: number;
    oldFlightLen: number;
    newLen: number;
    lenDelta: number;
    hasTE: boolean;
    hasRQA: boolean;
    sampleMisaligned: EventDiag[];
  }

  const affected: AffectedSession[] = [];

  for (const row of rows) {
    totalSessions++;
    const r = row as {
      question_id: number;
      date: string | null;
      keystroke_stream_json: unknown;
      te_hold_to_flight: number | null;
      te_flight_to_hold: number | null;
      te_dominance: number | null;
      rqa_determinism: number | null;
      rqa_laminarity: number | null;
      rqa_recurrence_rate: number | null;
    };

    let stream: KeystrokeEvent[];
    if (Array.isArray(r.keystroke_stream_json)) {
      stream = r.keystroke_stream_json as KeystrokeEvent[];
    } else {
      try {
        stream = JSON.parse(r.keystroke_stream_json as string) as KeystrokeEvent[];
      } catch {
        continue;
      }
    }

    if (stream.length < 2) continue;

    const misaligned = findMisalignedEvents(stream);

    if (misaligned.length === 0) {
      cleanSessions++;
      continue;
    }

    affectedSessions++;
    totalMisalignedEvents += misaligned.length;

    const oldResult = extractOld(stream);
    const newResult = extractNew(stream);

    affected.push({
      questionId: r.question_id,
      date: r.date ? String(r.date).slice(0, 10) : null,
      misalignedCount: misaligned.length,
      oldHoldLen: oldResult.holds.length,
      oldFlightLen: oldResult.flights.length,
      newLen: newResult.holds.length,
      lenDelta: Math.abs(oldResult.holds.length - oldResult.flights.length),
      hasTE: r.te_hold_to_flight !== null || r.te_flight_to_hold !== null,
      hasRQA: r.rqa_determinism !== null,
      sampleMisaligned: misaligned.slice(0, 3), // first 3 for inspection
    });
  }

  // ── Report ──

  console.log('=== HOLDLIGHT ALIGNMENT DIAGNOSTIC ===\n');
  console.log(`Total sessions with keystroke data: ${totalSessions}`);
  console.log(`Clean (no misalignment):            ${cleanSessions}`);
  console.log(`Affected:                           ${affectedSessions}`);
  console.log(`Total misaligned events:            ${totalMisalignedEvents}`);
  console.log();

  if (affected.length === 0) {
    console.log('NO SESSIONS AFFECTED. The bug existed in the code but never triggered');
    console.log('on real data. No reprocessing needed.');
    await sql.end({ timeout: 5 });
    return;
  }

  const affectedWithTE = affected.filter(s => s.hasTE).length;
  const affectedWithRQA = affected.filter(s => s.hasRQA).length;

  console.log(`Affected sessions with stored TE:   ${affectedWithTE}`);
  console.log(`Affected sessions with stored RQA:  ${affectedWithRQA}`);
  console.log();

  // Per-session detail
  console.log('--- Per-session detail ---\n');
  console.log(
    'Q_ID   DATE        MISALIGNED  OLD_H  OLD_F  NEW   DELTA  TE?  RQA?'
  );
  console.log(
    '-----  ----------  ----------  -----  -----  ----  -----  ---  ----'
  );

  for (const s of affected) {
    const te = s.hasTE ? 'YES' : ' - ';
    const rqa = s.hasRQA ? 'YES' : ' - ';
    console.log(
      `${String(s.questionId).padStart(5)}  ` +
      `${(s.date ?? 'n/a').padEnd(10)}  ` +
      `${String(s.misalignedCount).padStart(10)}  ` +
      `${String(s.oldHoldLen).padStart(5)}  ` +
      `${String(s.oldFlightLen).padStart(5)}  ` +
      `${String(s.newLen).padStart(4)}  ` +
      `${String(s.lenDelta).padStart(5)}  ` +
      `${te}  ${rqa}`
    );
  }

  // Sample misaligned events for the worst sessions
  const worst = [...affected].sort((a, b) => b.misalignedCount - a.misalignedCount).slice(0, 3);
  if (worst.length > 0) {
    console.log('\n--- Worst sessions: sample misaligned events ---\n');
    for (const s of worst) {
      console.log(`Q${s.questionId} (${s.date}): ${s.misalignedCount} misaligned events`);
      for (const e of s.sampleMisaligned) {
        const hv = e.holdValid ? 'valid' : `INVALID (${e.hold.toFixed(1)}ms)`;
        const fv = e.flightValid ? 'valid' : `INVALID (${e.flight.toFixed(1)}ms)`;
        console.log(`  event[${e.index}]: hold=${hv}, flight=${fv}`);
      }
      console.log();
    }
  }

  // Verdict
  console.log('=== VERDICT ===\n');
  if (affectedWithTE > 0 || affectedWithRQA > 0) {
    console.log(
      `${affectedWithTE + affectedWithRQA} session(s) have stored TE/RQA values computed ` +
      `from misaligned hold-flight vectors.`
    );
    console.log('These values should be recomputed after applying the alignment fix.');
    console.log();
    console.log('To reprocess, delete affected rows and re-run the signal pipeline:');
    console.log();
    const qids = affected.filter(s => s.hasTE || s.hasRQA).map(s => s.questionId);
    console.log(`  Question IDs: ${qids.join(', ')}`);
    console.log();
    console.log('  DELETE FROM tb_dynamical_signals WHERE question_id IN (...);');
    console.log('  -- then re-run: npm run backfill');
  } else {
    console.log(
      'Misaligned events exist but no affected sessions have stored TE/RQA values.'
    );
    console.log('No reprocessing needed, but apply the fix before new sessions compute.');
  }

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
