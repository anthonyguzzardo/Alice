/**
 * Subject deletion + factory-reset boundary.
 *
 * Phase 6c step 7. The HTTP endpoint (`/api/subject/account/delete`) and
 * the operator CLI (`npm run delete-subject`) both delegate to
 * `deleteSubjectAndData` so cascade logic exists in exactly one place.
 * The actor-distinction (`subject` vs `operator`) is carried into the
 * audit row but otherwise the cascade is identical.
 *
 * Atomicity: every delete + the soft-delete + the audit-row insert run
 * inside one `sql.begin` transaction. The transaction is all-or-nothing:
 * any failure (a row delete throwing, the soft-delete UPDATE failing, the
 * audit INSERT failing) rolls back every prior step. The subject can
 * retry; the DB never observes a partial cascade. The audit row landing
 * is what makes the cascade "real," and it lands in the same commit as
 * the last data delete, so the post-condition is "cascade complete and
 * audited" or "no change at all."
 *
 * Order of operations inside the transaction (leaves-inward; matters for
 * documented intent more than for FK reasons since postgres deferred
 * subtransactions don't expose partial state to outside readers anyway):
 *   1. Verify the subject exists, isn't already soft-deleted, isn't owner
 *   2. Children of tb_questions (signals + session-derived + feedback)
 *   3. Children of tb_responses (tb_embeddings)
 *   4. tb_responses
 *   5. Other subject-scoped tables (profile, baselines, deltas, prompt-traces)
 *   6. tb_questions
 *   7. tb_subject_sessions
 *   8. UPDATE tb_subjects (soft-delete: rename + deactivate)
 *   9. INSERT tb_data_access_log (audit, with rowCounts in notes)
 *
 * Tables NOT touched by the cascade:
 *   - tb_subject_consent (consent acknowledgment history — append-only,
 *     preserved forever per the consent doc's research-integrity claim)
 *   - tb_data_access_log (the audit log itself — append-only)
 *   - All `te_*` enum tables (static dictionary)
 *
 * The soft-deleted tb_subjects row keeps subject_id stable so the
 * preserved tb_subject_consent + tb_data_access_log rows continue to
 * reference a real (if tombstoned) row. The username gets prefixed with
 * `_deleted_<timestamp>_<subject_id>_` so the original username can be
 * reused for a new account if the operator wants.
 */
import sql from './libDbPool.ts';
import {
  recordDataAccess,
  type DataAccessActor,
} from './libConsent.ts';
import { OWNER_SUBJECT_ID } from './libDb.ts';

/**
 * Tables deleted in a full account-delete cascade. Order matters for
 * documented intent (leaves-inward); inside a transaction the actual
 * delete order doesn't change observable state until commit.
 *
 * `factory-reset` (operator-only, future) deletes the same tables EXCEPT
 * tb_questions and tb_subject_sessions, leaving the subject's seed
 * schedule + active sessions intact for re-journey.
 */
const TABLES_CHILDREN_OF_QUESTIONS: ReadonlyArray<string> = [
  'tb_session_summaries',
  'tb_session_events',
  'tb_session_metadata',
  'tb_burst_sequences',
  'tb_rburst_sequences',
  'tb_dynamical_signals',
  'tb_motor_signals',
  'tb_semantic_signals',
  'tb_process_signals',
  'tb_cross_session_signals',
  'tb_session_integrity',
  'tb_question_feedback',
  'tb_interaction_events',
  'tb_reconstruction_residuals',
];

const TABLES_CHILDREN_OF_RESPONSES: ReadonlyArray<string> = [
  'tb_embeddings',
];

const TABLES_OTHER_SUBJECT_SCOPED: ReadonlyArray<string> = [
  'tb_personal_profile',
  'tb_calibration_baselines_history',
  'tb_session_delta',
  'tb_semantic_baselines',
  'tb_semantic_trajectory',
  'tb_signal_jobs',
  'tb_prompt_traces',
];

// Tables that the FACTORY_RESET shape would also cascade-delete.
// Full delete adds tb_questions + tb_subject_sessions on top.
export const FACTORY_RESET_TABLES: ReadonlyArray<string> = [
  ...TABLES_CHILDREN_OF_QUESTIONS,
  ...TABLES_CHILDREN_OF_RESPONSES,
  'tb_responses',
  ...TABLES_OTHER_SUBJECT_SCOPED,
];

export const FULL_DELETE_TABLES: ReadonlyArray<string> = [
  ...FACTORY_RESET_TABLES,
  'tb_questions',
  'tb_subject_sessions',
];

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

export class SubjectNotFoundError extends Error {
  constructor(public readonly subjectId: number) {
    super(`subject ${subjectId} not found`);
    this.name = 'SubjectNotFoundError';
  }
}

export class AlreadyDeletedError extends Error {
  constructor(public readonly subjectId: number, public readonly currentUsername: string) {
    super(`subject ${subjectId} is already soft-deleted (username: ${currentUsername})`);
    this.name = 'AlreadyDeletedError';
  }
}

export class OwnerProtectedError extends Error {
  constructor() {
    super('refusing to delete the owner subject (subject_id = 1)');
    this.name = 'OwnerProtectedError';
  }
}

// ----------------------------------------------------------------------------
// Public entry points
// ----------------------------------------------------------------------------

export interface DeleteSubjectArgs {
  subjectId: number;
  /** Who initiated the delete — distinguishes subject self-service from operator action. */
  actor: DataAccessActor;
  /** Identity of the actor when known. Subject self-delete: pass subjectId. Operator CLI: null. */
  actorSubjectId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface DeleteSubjectResult {
  dataAccessLogId: number;
  rowCounts: Record<string, number>;
  /** The new `_deleted_<ts>_<id>_<original>` username on tb_subjects. */
  softDeletedUsername: string;
  originalUsername: string;
}

export interface FactoryResetArgs {
  subjectId: number;
  /** Who initiated. Factory reset is operator-only by design (memory rule). */
  actor: DataAccessActor;
  actorSubjectId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface FactoryResetResult {
  dataAccessLogId: number;
  rowCounts: Record<string, number>;
  /** Subject's current username (unchanged by reset; kept here for the CLI summary). */
  username: string;
}

/**
 * Operator-driven factory reset. Wipes the subject's response history +
 * derived signals + events + embeddings + profile + residuals + deltas,
 * but PRESERVES the account, the seed/corpus schedule (`tb_questions`),
 * the active sessions (`tb_subject_sessions`), the consent acknowledgments,
 * and the audit log. The subject can rejourney from the same seed sequence
 * on next login — preserving onboarding state per the memory rule
 * `feedback_factory_reset_semantics`.
 *
 * Operator-only by design. Subjects who want a clean slate close their
 * account (full delete) and the operator re-provisions them; that path is
 * cleaner than letting a subject self-erase content while keeping the
 * same identity.
 */
export async function factoryResetSubject(args: FactoryResetArgs): Promise<FactoryResetResult> {
  if (args.subjectId === OWNER_SUBJECT_ID) {
    throw new OwnerProtectedError();
  }

  return await sql.begin(async (tx) => {
    const lookup = await tx`
      SELECT subject_id, username, is_owner
      FROM tb_subjects
      WHERE subject_id = ${args.subjectId}
      LIMIT 1
    ` as Array<{ subject_id: number; username: string; is_owner: boolean }>;

    const subj = lookup[0];
    if (!subj) throw new SubjectNotFoundError(args.subjectId);
    if (subj.is_owner) throw new OwnerProtectedError();
    if (subj.username.startsWith('_deleted_')) {
      throw new AlreadyDeletedError(args.subjectId, subj.username);
    }

    const rowCounts: Record<string, number> = {};
    for (const table of FACTORY_RESET_TABLES) {
      const result = await tx.unsafe(
        `DELETE FROM alice.${table} WHERE subject_id = $1`,
        [args.subjectId],
      );
      rowCounts[table] = result.count ?? 0;
    }

    const dataAccessLogId = await recordDataAccess({
      subjectId: args.subjectId,
      action: 'factory_reset',
      actor: args.actor,
      actorSubjectId: args.actorSubjectId ?? null,
      notes: {
        rowCounts,
        username: subj.username,
      },
      ipAddress: args.ipAddress ?? null,
      userAgent: args.userAgent ?? null,
      tx,
    });

    return { dataAccessLogId, rowCounts, username: subj.username };
  });
}

/**
 * Full-account delete cascade. Wipes all subject-bearing rows in 23
 * tables, soft-deletes the tb_subjects row, writes one audit row. All
 * inside one transaction — partial failure rolls everything back.
 *
 * The owner subject is protected from deletion. The audit + consent
 * tables are preserved (forever, per the consent doc).
 */
export async function deleteSubjectAndData(args: DeleteSubjectArgs): Promise<DeleteSubjectResult> {
  if (args.subjectId === OWNER_SUBJECT_ID) {
    throw new OwnerProtectedError();
  }

  return await sql.begin(async (tx) => {
    // 1. Verify subject exists + isn't already soft-deleted
    const lookup = await tx`
      SELECT subject_id, username, is_owner
      FROM tb_subjects
      WHERE subject_id = ${args.subjectId}
      LIMIT 1
    ` as Array<{ subject_id: number; username: string; is_owner: boolean }>;

    const subj = lookup[0];
    if (!subj) {
      throw new SubjectNotFoundError(args.subjectId);
    }
    // Defense in depth: schema-level guard would also block via uq_subjects_single_owner,
    // but throwing early gives a clear error rather than a constraint violation.
    if (subj.is_owner) {
      throw new OwnerProtectedError();
    }
    if (subj.username.startsWith('_deleted_')) {
      throw new AlreadyDeletedError(args.subjectId, subj.username);
    }

    const rowCounts: Record<string, number> = {};

    // Helper: DELETE FROM <table> WHERE subject_id = $1, capture row count.
    // Table names are compile-time constants in FULL_DELETE_TABLES, so
    // tx.unsafe is safe here (no user-controlled SQL fragment reaches it).
    const deleteFrom = async (table: string): Promise<void> => {
      const result = await tx.unsafe(
        `DELETE FROM alice.${table} WHERE subject_id = $1`,
        [args.subjectId],
      );
      rowCounts[table] = result.count ?? 0;
    };

    // 2. Children of tb_questions (signals, session-derived, feedback, residuals)
    for (const table of TABLES_CHILDREN_OF_QUESTIONS) {
      await deleteFrom(table);
    }

    // 3. Children of tb_responses (embeddings)
    for (const table of TABLES_CHILDREN_OF_RESPONSES) {
      await deleteFrom(table);
    }

    // 4. tb_responses (after its children are gone)
    await deleteFrom('tb_responses');

    // 5. Other subject-scoped tables (profile, baselines, deltas, prompt traces)
    for (const table of TABLES_OTHER_SUBJECT_SCOPED) {
      await deleteFrom(table);
    }

    // 6. tb_questions (after all children are gone)
    await deleteFrom('tb_questions');

    // 7. tb_subject_sessions — invalidates the subject's current cookie too,
    //    since the cookie's token_hash is keyed in this table.
    await deleteFrom('tb_subject_sessions');

    // 8. Soft-delete tb_subjects.
    //    Username is renamed with `_deleted_<ts>_<subject_id>_<original>` so
    //    the original username can be reused for a new account if desired.
    //    subject_id stays stable so the preserved tb_subject_consent +
    //    tb_data_access_log rows continue to reference a real (if
    //    tombstoned) row.
    const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
    const softUsername = `_deleted_${ts}_${args.subjectId}_${subj.username}`.slice(0, 200);
    await tx`
      UPDATE tb_subjects
         SET username           = ${softUsername}
            ,is_active          = FALSE
            ,must_reset_password = FALSE
            ,dttm_modified_utc  = CURRENT_TIMESTAMP
            ,modified_by        = 'delete'
       WHERE subject_id = ${args.subjectId}
    `;
    rowCounts['tb_subjects (soft-deleted)'] = 1;

    // 9. Audit row LAST so rowCounts reflects what was actually deleted.
    //    Inside the same transaction so a failed audit-write rolls back the
    //    cascade. notes is JSONB post-039, so we pass an object.
    const dataAccessLogId = await recordDataAccess({
      subjectId: args.subjectId,
      action: 'delete',
      actor: args.actor,
      actorSubjectId: args.actorSubjectId ?? null,
      notes: {
        rowCounts,
        softDeletedUsername: softUsername,
        originalUsername: subj.username,
      },
      ipAddress: args.ipAddress ?? null,
      userAgent: args.userAgent ?? null,
      tx,
    });

    return {
      dataAccessLogId,
      rowCounts,
      softDeletedUsername: softUsername,
      originalUsername: subj.username,
    };
  });
}
