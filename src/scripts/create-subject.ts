/**
 * Provision a new subject account.
 *
 * Usage: npm run create-subject -- <username> <temp-password> [iana-timezone] [display-name]
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

  if (!username || !tempPassword) {
    console.error('Usage: npm run create-subject -- <username> <temp-password> [iana-timezone] [display-name]');
    console.error('');
    console.error('Example:');
    console.error('  npm run create-subject -- alice "TempPassword123!" America/Los_Angeles "Alice Smith"');
    process.exit(2);
  }

  const existing = await sql`SELECT subject_id FROM tb_subjects WHERE username = ${username}`;
  if (existing.length > 0) {
    console.error(`Username "${username}" already exists (subject_id ${existing[0]!.subject_id}). Refusing to overwrite.`);
    process.exit(3);
  }

  const subjectId = await createSubject({
    username,
    tempPassword,
    ianaTimezone: ianaTimezone || 'UTC',
    displayName: displayName ?? null,
  });

  console.log(`Created subject_id ${subjectId} (username "${username}", tz ${ianaTimezone || 'UTC'}).`);
  console.log('Hand the username and temp password to the subject out-of-band.');
  console.log('They will be forced to reset the password on first login.');

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('create-subject failed:', err);
  void sql.end({ timeout: 5 });
  process.exit(1);
});
