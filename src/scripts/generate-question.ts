/**
 * Manual trigger for question generation.
 * Run: npx tsx src/scripts/generate-question.ts
 */
import 'dotenv/config';
import { runGeneration } from '../lib/generate.ts';

runGeneration()
  .then(() => console.log('Generation complete.'))
  .catch((err) => {
    console.error('Generation failed:', err);
    process.exit(1);
  });
