/**
 * Backfill daily deltas from all historical day-pairs.
 *
 * Run once: npx tsx src/scripts/backfill-daily-deltas.ts
 *
 * Idempotent — skips dates that already have a delta row.
 * Safe to re-run after interruption.
 */
import 'dotenv/config';
import { runDailyDeltaBackfill } from '../lib/libDailyDelta.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';

const subjectId = parseSubjectIdArg();

runDailyDeltaBackfill(subjectId)
  .then((count) => {
    console.log(`Done. ${count} delta(s) computed.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
