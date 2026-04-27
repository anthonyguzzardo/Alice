/**
 * Parses a `--subject-id <n>` flag from process.argv for backfill / recompute /
 * extract / screen / confound scripts. Defaults to OWNER_SUBJECT_ID when no
 * flag is given so existing owner-only invocations work unchanged.
 *
 * Logs the resolved subjectId to stdout at script start so output is
 * unambiguous about which population the script operated on. This is the
 * load-bearing reason the helper exists, not the parsing — without the log,
 * a script's results can be misread when grepping back through CI history.
 *
 * Usage:
 *   const subjectId = parseSubjectIdArg();   // logs the resolved id
 *
 * Examples:
 *   tsx src/scripts/backfill-foo.ts                     → owner (1)
 *   tsx src/scripts/backfill-foo.ts --subject-id 2      → subject 2
 *   tsx src/scripts/backfill-foo.ts --subject-id=2      → subject 2
 */
import { OWNER_SUBJECT_ID } from './libDb.ts';

export function parseSubjectIdArg(argv: string[] = process.argv.slice(2)): number {
  let resolved: number = OWNER_SUBJECT_ID;
  let source: 'default' | 'flag' = 'default';

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    let value: string | undefined;
    if (a === '--subject-id' || a === '--subjectId') {
      value = argv[i + 1];
    } else if (a.startsWith('--subject-id=') || a.startsWith('--subjectId=')) {
      value = a.split('=', 2)[1];
    } else {
      continue;
    }
    if (value == null) {
      throw new Error('--subject-id requires a numeric argument');
    }
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`--subject-id must be a positive integer, got: ${value}`);
    }
    resolved = n;
    source = 'flag';
    break;
  }

  console.log(`[script] subject_id=${resolved} (${source === 'default' ? 'default OWNER_SUBJECT_ID' : 'from --subject-id flag'})`);
  return resolved;
}
