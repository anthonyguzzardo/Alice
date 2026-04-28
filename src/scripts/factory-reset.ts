/**
 * Operator CLI — factory-reset a subject.
 *
 * Wipes the subject's responses + signals + events + embeddings + profile
 * + residuals + deltas, but KEEPS the account + the seed schedule + the
 * active sessions + the consent acks + the audit log. The subject can
 * rejourney from the same seed sequence on next login.
 *
 * Operator-only — there is no HTTP analogue. This is the workflow for
 * "clear out a subject's history without re-provisioning."
 *
 * Usage:
 *   npm run factory-reset -- --subject-id 2
 *
 * The CLI prompts for the subject's username to confirm. The username
 * is the same friction signal as the HTTP delete endpoint — slow down
 * accidental destructive action without adding a y/N step that gets
 * muscle-memoried.
 */
import 'dotenv/config';
import readline from 'node:readline';
import {
  factoryResetSubject,
  OwnerProtectedError,
  SubjectNotFoundError,
  AlreadyDeletedError,
} from '../lib/libDelete.ts';
import { getSubjectById } from '../lib/libSubject.ts';
import { parseSubjectIdArg } from '../lib/utlSubjectIdArg.ts';
import { OWNER_SUBJECT_ID } from '../lib/libDb.ts';
import sql from '../lib/libDbPool.ts';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  const subjectId = parseSubjectIdArg();

  if (subjectId === OWNER_SUBJECT_ID) {
    console.error('refusing to factory-reset the owner. exit.');
    process.exit(2);
  }

  const subject = await getSubjectById(subjectId);
  if (!subject) {
    console.error(`subject ${subjectId} not found`);
    process.exit(2);
  }
  if (subject.username.startsWith('_deleted_')) {
    console.error(`subject ${subjectId} is soft-deleted (${subject.username}); factory-reset doesn't apply`);
    process.exit(2);
  }

  console.log('');
  console.log('FACTORY RESET');
  console.log('  subject_id:    ', subject.subject_id);
  console.log('  username:      ', subject.username);
  console.log('  display_name:  ', subject.display_name ?? '(none)');
  console.log('  iana_timezone: ', subject.iana_timezone);
  console.log('');
  console.log('Wipes:   responses + signals + events + embeddings + profile + residuals + deltas');
  console.log('Keeps:   account + seed schedule + active sessions + consent acks + audit log');
  console.log('Result:  subject rejourneys from the same seed sequence on next login');
  console.log('');

  const confirmation = await prompt(`type the username to confirm (${subject.username}): `);
  if (confirmation !== subject.username) {
    console.error('confirmation mismatch — exit.');
    process.exit(2);
  }

  console.log('');
  console.log('proceeding...');

  try {
    const result = await factoryResetSubject({
      subjectId,
      actor: 'operator',
      actorSubjectId: null,
    });

    console.log('');
    console.log('FACTORY RESET COMPLETE');
    console.log('  dataAccessLogId: ', result.dataAccessLogId);
    console.log('');
    const nonZero = Object.entries(result.rowCounts).filter(([, v]) => v > 0);
    if (nonZero.length === 0) {
      console.log('  no rows to delete (subject had no derived data)');
    } else {
      console.log('  per-table row counts (non-zero only):');
      for (const [table, count] of nonZero) {
        console.log(`    ${table.padEnd(45)} ${count}`);
      }
    }
  } catch (err) {
    if (err instanceof OwnerProtectedError) {
      console.error('owner-protection check failed (should not reach here)');
      process.exit(2);
    }
    if (err instanceof SubjectNotFoundError) {
      console.error('subject not found at cascade time (race condition?)');
      process.exit(2);
    }
    if (err instanceof AlreadyDeletedError) {
      console.error('subject was soft-deleted between confirmation and cascade');
      process.exit(2);
    }
    console.error('FACTORY RESET FAILED:', err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(async (err) => {
  console.error('UNHANDLED:', err);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
