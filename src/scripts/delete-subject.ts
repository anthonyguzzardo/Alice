/**
 * Operator CLI — full-delete a subject's account.
 *
 * Same effect as the subject-initiated `POST /api/subject/account/delete`,
 * but invoked from the CLI with `actor: 'operator'`, `actorSubjectId: null`
 * recorded in the audit row. Used when the operator needs to close an
 * account on the subject's behalf (offboarding, study completion, etc.)
 * or when a subject can't reach the HTTP endpoint.
 *
 * Cascade scope: all 23 subject-bearing tables wiped, `tb_subjects` row
 * soft-deleted (rename + deactivate, subject_id preserved). Consent acks
 * + audit log are kept forever.
 *
 * Usage:
 *   npm run delete-subject -- --subject-id 2
 *
 * Confirmation: the CLI prompts for the subject's username before
 * proceeding. Same friction signal as the HTTP endpoint.
 */
import 'dotenv/config';
import readline from 'node:readline';
import {
  deleteSubjectAndData,
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
    console.error('refusing to delete the owner. exit.');
    process.exit(2);
  }

  const subject = await getSubjectById(subjectId);
  if (!subject) {
    console.error(`subject ${subjectId} not found`);
    process.exit(2);
  }
  if (subject.username.startsWith('_deleted_')) {
    console.error(`subject ${subjectId} is already soft-deleted (${subject.username})`);
    process.exit(2);
  }

  console.log('');
  console.log('FULL ACCOUNT DELETE');
  console.log('  subject_id:    ', subject.subject_id);
  console.log('  username:      ', subject.username);
  console.log('  display_name:  ', subject.display_name ?? '(none)');
  console.log('  iana_timezone: ', subject.iana_timezone);
  console.log('');
  console.log('Wipes:   responses + questions + signals + events + sessions + every derived table');
  console.log('Keeps:   consent acknowledgment history + audit log (research integrity)');
  console.log('Result:  tb_subjects row renamed to _deleted_<ts>_<id>_<original>, deactivated');
  console.log('         subject_id preserved so audit + consent rows stay anchored');
  console.log('');

  const confirmation = await prompt(`type the username to confirm (${subject.username}): `);
  if (confirmation !== subject.username) {
    console.error('confirmation mismatch — exit.');
    process.exit(2);
  }

  console.log('');
  console.log('proceeding...');

  try {
    const result = await deleteSubjectAndData({
      subjectId,
      actor: 'operator',
      actorSubjectId: null,
    });

    console.log('');
    console.log('DELETE COMPLETE');
    console.log('  dataAccessLogId:        ', result.dataAccessLogId);
    console.log('  softDeletedUsername:    ', result.softDeletedUsername);
    console.log('  originalUsername:       ', result.originalUsername);
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
    console.error('DELETE FAILED:', err instanceof Error ? err.stack ?? err.message : err);
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
