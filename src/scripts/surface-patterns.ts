/**
 * Manual trigger for weekly reflection.
 * Run: npx tsx src/scripts/surface-patterns.ts
 */
import 'dotenv/config';
import { runReflection } from '../lib/reflect.ts';

runReflection()
  .then(() => console.log('Reflection complete.'))
  .catch((err) => {
    console.error('Reflection failed:', err);
    process.exit(1);
  });
