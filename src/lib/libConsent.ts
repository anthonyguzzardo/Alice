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

// MUST stay in sync with the seeded rows of te_data_access_action /
// te_data_access_actor (dbAlice_Tables.sql + migration 038/039). Adding a
// new action or actor requires: (1) extend the TS union above, (2) add the
// matching row to the lookup table via a migration, (3) extend the map
// below. All three together or the INSERT will silently fail at runtime
// with a constraint error.
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
  // Cast TIMESTAMPTZ → text in SQL so postgres.js doesn't auto-parse to a
  // Date object. The type contract says `acknowledgedAtUtc: string` and
  // callers (consent.astro, account/index.astro) call `.slice(0, 10)` on
  // it — Date has no `.slice` method, so the cast keeps the contract honest.
  const rows = await sql`
    SELECT consent_version           AS "currentVersion"
          ,dttm_acknowledged_utc::text AS "acknowledgedAtUtc"
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
 * Append-only consent history for a subject, deduped to one row per
 * consent_version (the FIRST acknowledgment of each), newest first.
 * Powers the consent-history view on /account.astro.
 *
 * Re-acknowledgments of the same version are noise from a UI perspective —
 * the audit log (`tb_data_access_log`) still has every individual row for
 * forensic purposes; this view's job is "which versions have I agreed to
 * and when did I first agree." User-agent intentionally omitted to keep
 * the surface terse.
 */
export async function getSubjectConsentHistory(subjectId: number): Promise<ConsentHistoryEntry[]> {
  // DISTINCT ON requires the distinct column to lead the ORDER BY, so we
  // sort by consent_version + acknowledgment-ASC inside, then re-sort the
  // deduped result by acknowledgment-DESC for display. TIMESTAMPTZ is cast
  // to text in SQL so callers receive a string (ConsentHistoryEntry says so);
  // postgres.js auto-parses TIMESTAMPTZ to Date otherwise, breaking
  // `.slice(0, 10)` calls in pages.
  const rows = await sql`
    SELECT version, "acknowledgedAtUtc", "ipAddress"
    FROM (
      SELECT DISTINCT ON (consent_version)
             consent_version             AS "version"
            ,dttm_acknowledged_utc::text AS "acknowledgedAtUtc"
            ,ip_address                  AS "ipAddress"
      FROM tb_subject_consent
      WHERE subject_id = ${subjectId}
      ORDER BY consent_version, dttm_acknowledged_utc ASC
    ) deduped
    ORDER BY "acknowledgedAtUtc" DESC
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
  // Use sql.json() to mark the parameter as JSON. postgres.js v3 then
  // serializes the object to JSONB cleanly — passing an object without
  // the marker fails the TS overload, and JSON.stringify before passing
  // double-encodes (stores a JSONB string, not a JSONB object). Verified
  // round-trip: object goes in, object comes back out, pg_typeof = jsonb.
  // null bypasses sql.json entirely so the SQL parameter stays NULL.
  // The `as` cast is the boundary between `Record<string, unknown>` (the
  // ergonomic caller type) and postgres.js's `JSONValue` (which can't
  // accept `unknown` keys); runtime is unaffected — postgres serializes
  // objects via JSON.stringify under the hood.
  const notes = args.notes != null ? sql.json(args.notes as Parameters<typeof sql.json>[0]) : null;

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
 * Refuses any version other than `CONSENT_VERSION`. The registry exists
 * for the *history view* (so older versions stay readable); writes only
 * ever target the current version. A request to acknowledge an older
 * version means a stale or malicious client and is rejected at the
 * boundary rather than allowed to land in the append-only table.
 *
 * NOT idempotent at this layer — a double-call writes two consent rows
 * + two audit rows. Idempotency is the endpoint's responsibility (skip
 * the call when `getSubjectConsentStatus(subjectId).isCurrent` is true).
 * Pushing it here would force every caller to handle a "no-op" return
 * shape; better to keep the helper a single canonical writer.
 */
export async function recordConsent(args: RecordConsentArgs): Promise<RecordConsentResult> {
  if (args.version !== CONSENT_VERSION) {
    throw new Error(
      `recordConsent: refusing to acknowledge version "${args.version}" — ` +
      `current is "${CONSENT_VERSION}". Acknowledgments target the current version only.`,
    );
  }
  // Defense in depth: catches the case where CONSENT_VERSION is bumped but
  // CONSENT_VERSIONS is not — without this, a fresh deploy with a missing
  // registry entry would silently insert acknowledgments for an unknown
  // version and the history view would skip them.
  if (!KNOWN_CONSENT_VERSIONS.has(args.version)) {
    throw new Error(
      `recordConsent: CONSENT_VERSION "${args.version}" is not in CONSENT_VERSIONS. ` +
      `Add it to the registry in libConsent.ts before deploying.`,
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
