/**
 * Manual trigger for the AI observation job.
 * Run: npx tsx src/scripts/observe.ts
 */
import 'dotenv/config';
import { runObservation } from '../lib/observe.ts';

runObservation()
  .then(() => console.log('Observation complete.'))
  .catch((err) => {
    console.error('Observation failed:', err);
    process.exit(1);
  });
