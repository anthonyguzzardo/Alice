/**
 * Subject consent + data-access audit boundary.
 *
 * Phase 6c (consent + export + delete). All writes to `tb_subject_consent`
 * and `tb_data_access_log` flow through this module. Application code never
 * touches the audit tables directly — that's the discipline that keeps the
 * "every action leaves a forensic trace" guarantee from drifting.
 *
 * `CONSENT_VERSION` is the source of truth for "current consent." Bumping
 * the consent doc means: (1) write `docs/consent-vN.md`, (2) bump the
 * constant, (3) append to `CONSENT_VERSIONS`. The middleware gate reads
 * the most-recent acknowledgment per subject and engages on any mismatch.
 *
 * The `notes` column on `tb_data_access_log` is JSONB (migration 039).
 * Helper code MUST pass an object (or null); a plain string that isn't
 * valid JSON will fail at the postgres-driver boundary by design.
 */
import sql from './libDbPool.ts';
import type { TxSql } from './libDbPool.ts';

// ----------------------------------------------------------------------------
// Versioning
// ----------------------------------------------------------------------------

export const CONSENT_VERSION = 'v1';

export interface ConsentVersionRecord {
  readonly version: string;
  readonly effectiveFromUtc: string;
  readonly docPath: string;
}

/**
 * Every consent version ever published, oldest first. Bumping the doc must
 * append a row here so the /account.astro consent-history view can render
 * the older version's text alongside the acknowledgment timestamp. The
 * registry is the source of truth — recording an acknowledgment for a
 * version not listed here throws.
 */
export const CONSENT_VERSIONS: ReadonlyArray<ConsentVersionRecord> = [
  { version: 'v1', effectiveFromUtc: '2026-04-27', docPath: 'docs/consent-v1.md' },
] as const;

const KNOWN_CONSENT_VERSIONS = new Set(CONSENT_VERSIONS.map((v) => v.version));

export function getCurrentConsentVersion(): string {
  return CONSENT_VERSION;
}

// ----------------------------------------------------------------------------
// Action / actor enums (mirror te_data_access_action, te_data_access_actor)
// ----------------------------------------------------------------------------

export type DataAccessAction = 'export' | 'factory_reset' | 'delete' | 'consent';
export type DataAccessActor  = 'subject' | 'operator' | 'system';

const ACTION_ID: Record<DataAccessAction, number> = {
  export:        1,
  factory_reset: 2,
  delete:        3,
  consent:       4,
};

const ACTOR_ID: Record<DataAccessActor, number> = {
  subject:  1,
  operator: 2,
  system:   3,
};

// ----------------------------------------------------------------------------
// Reads
// ----------------------------------------------------------------------------

export interface ConsentStatus {
  subjectId: number;
  /** Most-recent acknowledged version, or null if subject has never consented. */
  currentVersion: string | null;
  acknowledgedAtUtc: string | null;
  /** True iff `currentVersion === CONSENT_VERSION`. Drives the middleware gate. */
  isCurrent: boolean;
}

/**
 * Resolve a subject's most-recent consent acknowledgment. Returns
 * `currentVersion: null` when the subject has never consented (first-login
 * state). The middleware consent gate engages whenever `isCurrent` is false.
 */
export async function getSubjectConsentStatus(subjectId: number): Promise<ConsentStatus> {
  const rows = await sql`
    SELECT consent_version       AS "currentVersion"
          ,dttm_acknowledged_utc AS "acknowledgedAtUtc"
    FROM tb_subject_consent
    WHERE subject_id = ${subjectId}
    ORDER BY dttm_acknowledged_utc DESC
    LIMIT 1
  ` as Array<{ currentVersion: string; acknowledgedAtUtc: string }>;
  const row = rows[0];
  if (!row) {
    return { subjectId, currentVersion: null, acknowledgedAtUtc: null, isCurrent: false };
  }
  return {
    subjectId,
    currentVersion: row.currentVersion,
    acknowledgedAtUtc: row.acknowledgedAtUtc,
    isCurrent: row.currentVersion === CONSENT_VERSION,
  };
}

export interface ConsentHistoryEntry {
  version: string;
  acknowledgedAtUtc: string;
  ipAddress: string | null;
}

/**
 * Full append-only consent history for a subject, newest first. Powers the
 * consent-history view on /account.astro. User-agent is intentionally
 * omitted from this view to keep the surface terse — present in the row
 * for the audit log, not surfaced back to the subject.
 */
export async function getSubjectConsentHistory(subjectId: number): Promise<ConsentHistoryEntry[]> {
  const rows = await sql`
    SELECT consent_version       AS "version"
          ,dttm_acknowledged_utc AS "acknowledgedAtUtc"
          ,ip_address            AS "ipAddress"
    FROM tb_subject_consent
    WHERE subject_id = ${subjectId}
    ORDER BY dttm_acknowledged_utc DESC
  ` as ConsentHistoryEntry[];
  return rows;
}

// ----------------------------------------------------------------------------
// Writes
// ----------------------------------------------------------------------------

export interface RecordDataAccessArgs {
  /** Whose data was accessed. */
  subjectId: number;
  action: DataAccessAction;
  actor: DataAccessActor;
  /**
   * Identity of the actor when known. NULL for operator-via-CLI (until
   * owner-session-auth ships) and for system actions; the `actor` field
   * carries the disambiguation. NEVER blindly default to subjectId — the
   * caller must distinguish "subject acting on their own data" from
   * "operator acting on this subject's data".
   */
  actorSubjectId?: number | null;
  /** Populated when action === 'consent'. */
  consentVersion?: string | null;
  /**
   * Action-specific context object. Serialized to JSONB at write time;
   * post-039 the column rejects non-JSON. Passing a plain string is a bug.
   */
  notes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: TxSql;
}

/**
 * Append a row to `tb_data_access_log`. Single canonical writer — never
 * INSERT into the audit table directly. Returns the new
 * `data_access_log_id` so callers can reference it from the same
 * transaction (e.g. error logs that link an action to its audit row).
 */
export async function recordDataAccess(args: RecordDataAccessArgs): Promise<number> {
  const q = args.tx ?? sql;
  const actionId = ACTION_ID[args.action];
  const actorId  = ACTOR_ID[args.actor];
  const ip       = args.ipAddress ? args.ipAddress.slice(0, 45) : null;
  const ua       = args.userAgent ? args.userAgent.slice(0, 200) : null;
  const consentVersion = args.consentVersion ?? null;
  const actorSubjectId = args.actorSubjectId ?? null;
  // postgres.js parses the JSON string into JSONB at the driver boundary.
  // null stays null. Plain strings would fail post-039 — by design.
  const notes = args.notes != null ? JSON.stringify(args.notes) : null;

  const rows = await q`
    INSERT INTO tb_data_access_log
      ( subject_id
      , actor_subject_id
      , data_access_actor_id
      , data_access_action_id
      , consent_version
      , notes
      , ip_address
      , user_agent
      )
    VALUES
      ( ${args.subjectId}
      , ${actorSubjectId}
      , ${actorId}
      , ${actionId}
      , ${consentVersion}
      , ${notes}
      , ${ip}
      , ${ua}
      )
    RETURNING data_access_log_id
  ` as Array<{ data_access_log_id: number }>;
  return rows[0]!.data_access_log_id;
}

export interface RecordConsentArgs {
  subjectId: number;
  /** The version being acknowledged (typically CONSENT_VERSION). */
  version: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: TxSql;
}

export interface RecordConsentResult {
  subjectConsentId: number;
  dataAccessLogId: number;
}

/**
 * Record a consent acknowledgment + write the matching audit row in the
 * same transaction. Both inserts succeed atomically or both fail.
 *
 * The middleware consent gate reads getSubjectConsentStatus, which queries
 * tb_subject_consent — so the consent row landing is what actually flips
 * the gate. The audit row is the forensic trace for the same event.
 *
 * Validates the version against CONSENT_VERSIONS to catch typos at the
 * call site before they create unrecognized acknowledgment rows.
 */
export async function recordConsent(args: RecordConsentArgs): Promise<RecordConsentResult> {
  if (!KNOWN_CONSENT_VERSIONS.has(args.version)) {
    throw new Error(
      `recordConsent: unknown consent version "${args.version}". ` +
      `Add it to CONSENT_VERSIONS in libConsent.ts before recording.`,
    );
  }

  const ip = args.ipAddress ? args.ipAddress.slice(0, 45) : null;
  const ua = args.userAgent ? args.userAgent.slice(0, 200) : null;

  if (args.tx) {
    return innerRecordConsent(args, args.tx, ip, ua);
  }
  return await sql.begin(async (tx) => innerRecordConsent(args, tx, ip, ua));
}

async function innerRecordConsent(
  args: RecordConsentArgs,
  tx: TxSql,
  ip: string | null,
  ua: string | null,
): Promise<RecordConsentResult> {
  const consentRows = await tx`
    INSERT INTO tb_subject_consent
      (subject_id, consent_version, ip_address, user_agent)
    VALUES
      (${args.subjectId}, ${args.version}, ${ip}, ${ua})
    RETURNING subject_consent_id
  ` as Array<{ subject_consent_id: number }>;
  const subjectConsentId = consentRows[0]!.subject_consent_id;

  const dataAccessLogId = await recordDataAccess({
    subjectId: args.subjectId,
    action: 'consent',
    actor: 'subject',
    actorSubjectId: args.subjectId,
    consentVersion: args.version,
    notes: { subjectConsentId },
    ipAddress: ip,
    userAgent: ua,
    tx,
  });

  return { subjectConsentId, dataAccessLogId };
}
