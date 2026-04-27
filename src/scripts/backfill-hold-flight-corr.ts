/**
 * One-off backfill: compute hold_flight_rank_corr for existing motor signal rows.
 * This field was added in migration 010 and needs to be populated from
 * existing keystroke streams before the profile can aggregate it.
 *
 * Run: npx tsx src/scripts/backfill-hold-flight-corr.ts
 */

import { sql } from '../lib/libDb.ts';
import { computeMotorSignals } from '../lib/libSignalsNative.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';

async function main() {
  const subjectId = parseSubjectIdArg();

  const rows = await sql`
    SELECT se.question_id, se.keystroke_stream_json
    FROM tb_session_events se
    WHERE se.subject_id = ${subjectId}
      AND se.keystroke_stream_json IS NOT NULL
  ` as Array<{ question_id: number; keystroke_stream_json: unknown }>;

  console.log(`Found ${rows.length} sessions with keystroke streams.`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const streamStr = typeof row.keystroke_stream_json === 'string'
      ? row.keystroke_stream_json
      : JSON.stringify(row.keystroke_stream_json);

    const parsed = JSON.parse(streamStr);
    if (!Array.isArray(parsed) || parsed.length < 30) {
      skipped++;
      continue;
    }

    const motor = computeMotorSignals(parsed, 60000);
    if (!motor || motor.holdFlightRankCorr == null) {
      skipped++;
      continue;
    }

    await sql`
      UPDATE tb_motor_signals
      SET hold_flight_rank_corr = ${motor.holdFlightRankCorr}
      WHERE subject_id = ${subjectId} AND question_id = ${row.question_id}
    `;
    updated++;
  }

  console.log(`Updated ${updated} rows, skipped ${skipped}.`);

  // Verify
  const [{ c }] = await sql`
    SELECT COUNT(*)::int AS c FROM tb_motor_signals WHERE subject_id = ${subjectId} AND hold_flight_rank_corr IS NOT NULL
  ` as [{ c: number }];
  console.log(`Motor signals with hold_flight_rank_corr: ${c}`);
}

main().catch(err => { console.error(err); process.exit(1); });
