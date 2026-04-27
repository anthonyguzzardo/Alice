/**
 * Manual trigger for question generation.
 * Run: npx tsx src/scripts/generate-question.ts
 */
import 'dotenv/config';
import { runGeneration } from '../lib/libGenerate.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';

const subjectId = parseSubjectIdArg();

runGeneration(subjectId)
  .then(() => console.log('Generation complete.'))
  .catch((err) => {
    console.error('Generation failed:', err);
    process.exit(1);
  });
