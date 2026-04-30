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
import { seedUpcomingQuestions } from '../lib/libSchedule.ts';

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

  // Plant the 30 seed questions starting today (in the subject's local TZ —
  // day-1 must align with the subject's local midnight, not the server's).
  // Every subject gets the same first 30 days of journey — non-negotiable.
  // Without this they would log in and see `no_question_scheduled` from
  // /api/subject/today and have nothing to do. seedUpcomingQuestions is
  // idempotent, so a re-run on an existing subject is a no-op.
  await seedUpcomingQuestions(subjectId, tz, 30);

  console.log(`Created subject_id ${subjectId} (username "${username}", tz ${tz}).`);
  console.log(`Seeded 30 starting-day questions for the next 30 days.`);
  console.log('Hand the username and temp password to the subject out-of-band.');
  console.log('They will be forced to reset the password on first login.');

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('create-subject failed:', err);
  void sql.end({ timeout: 5 });
  process.exit(1);
});
