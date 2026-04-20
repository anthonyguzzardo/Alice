/**
 * Manually re-trigger background jobs (observation + generation)
 * for the most recent entry. Use when background jobs failed.
 *
 * Usage: npx tsx scripts/retrigger-background.ts
 */
import 'dotenv/config';
import { runObservation } from '../src/lib/observe.ts';
import { runGeneration } from '../src/lib/libGenerate.ts';
import { getResponseCount } from '../src/lib/libDb.ts';

const count = await getResponseCount();
console.log(`Response count: ${count}`);

console.log('Running observation...');
try {
  await runObservation();
  console.log('Observation complete.');
} catch (err) {
  console.error('Observation failed:', err);
}

console.log('Running generation...');
try {
  await runGeneration();
  console.log('Generation complete.');
} catch (err) {
  console.error('Generation failed:', err);
}

console.log('Done.');
