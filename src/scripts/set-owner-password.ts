/**
 * Set the owner's password.
 *
 * Usage: npm run set-owner-password -- <password>
 *
 * Run once after migration 029 lands (or after a deploy that involves resetting
 * the owner row). The migration leaves the owner with a placeholder hash that
 * fails verification, so without this step the owner cannot log in.
 *
 * Future use: if the owner ever forgets their password, this is the recovery
 * mechanism — there is no email-based recovery flow by design (Path 2-lite).
 */

import 'dotenv/config';
import sql from '../lib/libDbPool.ts';
import { setOwnerPassword } from '../lib/libSubjectAuth.ts';

const MIN_LENGTH = 12;

async function main() {
  const [, , password] = process.argv;

  if (!password) {
    console.error('Usage: npm run set-owner-password -- <password>');
    process.exit(2);
  }

  if (password.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`);
    process.exit(2);
  }

  const result = await setOwnerPassword(password);
  if (result.kind === 'rotated') {
    console.log(
      `Owner password rotated. ${result.sessionsInvalidated} active owner session(s) invalidated — every browser/device with an existing owner cookie must log in again.`,
    );
  } else {
    console.log('Owner row created with the supplied password. No prior sessions to invalidate.');
  }

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('set-owner-password failed:', err);
  void sql.end({ timeout: 5 });
  process.exit(1);
});
