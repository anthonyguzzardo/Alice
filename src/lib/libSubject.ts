/**
 * Subject identity model.
 *
 * Subjects authenticate via invite_code, passed as a cookie named `alice_subject`.
 * The owner is a subject with is_owner = true.
 *
 * getRequestSubject() is a pure DB lookup — it reads the cookie, queries the DB,
 * and returns the resolved subject or null. It never sets cookies or produces
 * side effects. Cookie-setting on first use is the caller's responsibility.
 */

import sql from './libDbPool.ts';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Subject {
  subject_id: number;
  invite_code: string;
  display_name: string | null;
  is_owner: boolean;
  is_active: boolean;
  dttm_created_utc: string;
}

/** Cookie name used to identify the subject on each request. */
export const SUBJECT_COOKIE = 'alice_subject';

// ----------------------------------------------------------------------------
// Lookups
// ----------------------------------------------------------------------------

/**
 * Resolve a request to a Subject.
 *
 * Reads the `alice_subject` cookie from the request headers.
 * Returns:
 *   - Subject row   if cookie present, code matches an active row
 *   - null          if cookie absent, code unrecognized, or subject is inactive
 *
 * Pure lookup — no side effects, no cookie setting.
 */
export async function getRequestSubject(request: Request): Promise<Subject | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SUBJECT_COOKIE}=([^;]+)`));
  if (!match) return null;

  const code = decodeURIComponent(match[1]).trim();
  if (!code) return null;

  return getActiveSubjectByInviteCode(code);
}

/** Look up a subject by invite code. Returns the row regardless of active status. */
export async function getSubjectByInviteCode(code: string): Promise<Subject | null> {
  const rows = await sql`
    SELECT subject_id, invite_code, display_name, is_owner, is_active, dttm_created_utc
    FROM tb_subjects
    WHERE invite_code = ${code}
  `;
  return (rows[0] as Subject) ?? null;
}

/** Look up an active subject by invite code. Returns null if inactive or not found. */
async function getActiveSubjectByInviteCode(code: string): Promise<Subject | null> {
  const rows = await sql`
    SELECT subject_id, invite_code, display_name, is_owner, is_active, dttm_created_utc
    FROM tb_subjects
    WHERE invite_code = ${code} AND is_active = TRUE
  `;
  return (rows[0] as Subject) ?? null;
}

/** Look up a subject by ID. */
export async function getSubjectById(id: number): Promise<Subject | null> {
  const rows = await sql`
    SELECT subject_id, invite_code, display_name, is_owner, is_active, dttm_created_utc
    FROM tb_subjects
    WHERE subject_id = ${id}
  `;
  return (rows[0] as Subject) ?? null;
}

/** Get the owner row. Throws if no owner exists (broken deploy). */
export async function getOwner(): Promise<Subject> {
  const rows = await sql`
    SELECT subject_id, invite_code, display_name, is_owner, is_active, dttm_created_utc
    FROM tb_subjects
    WHERE is_owner = TRUE
  `;
  const owner = rows[0] as Subject | undefined;
  if (!owner) throw new Error('No owner row in tb_subjects — seed data missing');
  return owner;
}

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------

/**
 * Create a new subject (non-owner). Returns the new row.
 * invite_code must be unique; throws on duplicate.
 */
export async function createSubject(input: {
  invite_code: string;
  display_name?: string | null;
}): Promise<Subject> {
  const [row] = await sql`
    INSERT INTO tb_subjects (invite_code, display_name)
    VALUES (${input.invite_code}, ${input.display_name ?? null})
    RETURNING subject_id, invite_code, display_name, is_owner, is_active, dttm_created_utc
  `;
  return row as Subject;
}

/** Deactivate a subject. Returns true if the row was updated. */
export async function deactivateSubject(id: number): Promise<boolean> {
  const result = await sql`
    UPDATE tb_subjects
    SET is_active = FALSE
    WHERE subject_id = ${id} AND is_active = TRUE AND is_owner = FALSE
  `;
  return result.count > 0;
}
