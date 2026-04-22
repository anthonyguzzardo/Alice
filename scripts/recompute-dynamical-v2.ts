/**
 * Recompute dynamical signals using the fixed HoldFlight alignment.
 *
 * Writes results into tb_dynamical_signals_v2 (staging table).
 * Does NOT modify the live tb_dynamical_signals table.
 *
 * Usage: npx tsx scripts/recompute-dynamical-v2.ts
 */

import { sql } from '../src/lib/libDb.ts';
import { computeDynamicalSignals } from '../src/lib/libSignalsNative.ts';

interface KeystrokeEvent {
  c: string;
  d: number;
  u: number;
}

async function main() {
  // Create staging table (same schema as live, no constraints)
  await sql`
    DROP TABLE IF EXISTS alice.tb_dynamical_signals_v2;
  `;
  await sql`
    CREATE TABLE alice.tb_dynamical_signals_v2 (
       question_id                  INT NOT NULL
      ,iki_count                    INT
      ,hold_flight_count            INT
      ,permutation_entropy          DOUBLE PRECISION
      ,permutation_entropy_raw      DOUBLE PRECISION
      ,pe_spectrum                  JSONB
      ,dfa_alpha                    DOUBLE PRECISION
      ,rqa_determinism              DOUBLE PRECISION
      ,rqa_laminarity               DOUBLE PRECISION
      ,rqa_trapping_time            DOUBLE PRECISION
      ,rqa_recurrence_rate          DOUBLE PRECISION
      ,te_hold_to_flight            DOUBLE PRECISION
      ,te_flight_to_hold            DOUBLE PRECISION
      ,te_dominance                 DOUBLE PRECISION
      ,dttm_created_utc             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  console.log('Created tb_dynamical_signals_v2 staging table.\n');

  // Get all sessions with keystroke data
  const rows = await sql`
    SELECT se.question_id,
           se.keystroke_stream_json
    FROM tb_session_events se
    WHERE se.keystroke_stream_json IS NOT NULL
    ORDER BY se.question_id ASC
  `;

  let computed = 0;
  let skipped = 0;

  for (const row of rows) {
    const r = row as { question_id: number; keystroke_stream_json: unknown };

    let stream: KeystrokeEvent[];
    if (Array.isArray(r.keystroke_stream_json)) {
      stream = r.keystroke_stream_json as KeystrokeEvent[];
    } else {
      try {
        stream = JSON.parse(r.keystroke_stream_json as string) as KeystrokeEvent[];
      } catch {
        console.log(`  Q${r.question_id}: skip (unparseable)`);
        skipped++;
        continue;
      }
    }

    if (stream.length < 2) {
      console.log(`  Q${r.question_id}: skip (${stream.length} events)`);
      skipped++;
      continue;
    }

    const ds = computeDynamicalSignals(stream);
    if (!ds) {
      console.log(`  Q${r.question_id}: skip (Rust engine returned null)`);
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO tb_dynamical_signals_v2 (
        question_id, iki_count, hold_flight_count,
        permutation_entropy, permutation_entropy_raw, pe_spectrum,
        dfa_alpha,
        rqa_determinism, rqa_laminarity, rqa_trapping_time, rqa_recurrence_rate,
        te_hold_to_flight, te_flight_to_hold, te_dominance
      ) VALUES (
        ${r.question_id}, ${ds.ikiCount}, ${ds.holdFlightCount},
        ${ds.permutationEntropy}, ${ds.permutationEntropyRaw},
        ${ds.peSpectrum ? JSON.stringify(ds.peSpectrum) : null}::jsonb,
        ${ds.dfaAlpha},
        ${ds.rqaDeterminism}, ${ds.rqaLaminarity},
        ${ds.rqaTrappingTime}, ${ds.rqaRecurrenceRate},
        ${ds.teHoldToFlight}, ${ds.teFlightToHold}, ${ds.teDominance}
      )
    `;

    console.log(`  Q${r.question_id}: computed (${stream.length} events, hf_count=${ds.holdFlightCount})`);
    computed++;
  }

  console.log(`\nDone. Computed: ${computed}, Skipped: ${skipped}`);

  // Verify row count
  const [count] = await sql`SELECT COUNT(*)::int AS n FROM alice.tb_dynamical_signals_v2`;
  console.log(`Staging table rows: ${(count as { n: number }).n}`);

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
