/**
 * One-time backfill: embed all existing responses, observations, and reflections
 * that don't yet have embeddings.
 * Run: npm run backfill
 */
import 'dotenv/config';
import { backfillEmbeddings } from '../lib/libEmbeddings.ts';

backfillEmbeddings()
  .then(({ embedded, failed }) => {
    console.log(`\nBackfill complete. Embedded: ${embedded}, Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
