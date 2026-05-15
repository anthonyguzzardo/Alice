/**
 * Provision a new subject account.
 *
 * Usage: npm run create-subject -- <username> <temp-password> <iana-timezone> [display-name]
 *
 * The owner runs this to onboard a new subject. The subject receives the
 * username + temp password out-of-band (Signal, in person, however), then
 * logs in and is forced to reset the password before doing anything else.
 *
 * Refuses to overwrite an existing username — failure is loud, not silent.
 */

import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { createSubject } from '../lib/libSubjectAuth.ts';

async function main() {
  const [, , username, tempPassword, ianaTimezone, displayName] = process.argv;

  if (!username || !tempPassword || !ianaTimezone) {
    console.error('Usage: npm run create-subject -- <username> <temp-password> <iana-timezone> [display-name]');
    console.error('');
    console.error('Example:');
    console.error('  npm run create-subject -- alice "TempPassword123!" America/Los_Angeles "Alice Smith"');
    console.error('');
    console.error('iana-timezone is REQUIRED. Use a real IANA tz database name (e.g. America/Chicago, Europe/London).');
    console.error('No UTC fallback — the subject\'s calendar-day flip MUST honor their actual local midnight.');
    process.exit(2);
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: ianaTimezone });
  } catch {
    console.error(`Invalid IANA timezone: "${ianaTimezone}". Examples: America/Chicago, America/Los_Angeles, Europe/London, Asia/Tokyo.`);
    process.exit(2);
  }

  const existing = await sql`SELECT subject_id FROM tb_subjects WHERE username = ${username}`;
  if (existing.length > 0) {
    console.error(`Username "${username}" already exists (subject_id ${existing[0]!.subject_id}). Refusing to overwrite.`);
    process.exit(3);
  }

  const tz = ianaTimezone;

  const subjectId = await createSubject({
    username,
    tempPassword,
    ianaTimezone: tz,
    displayName: displayName ?? null,
  });

  console.log(`Created subject_id ${subjectId} (username "${username}", tz ${tz}).`);
  console.log('First journal question is drawn from tb_question_corpus on first /api/subject/today hit. Each subsequent day creates one row at first page load.');
  console.log('Hand the username and temp password to the subject out-of-band.');
  console.log('They will be forced to reset the password on first login.');

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('create-subject failed:', err);
  void sql.end({ timeout: 5 });
  process.exit(1);
});
