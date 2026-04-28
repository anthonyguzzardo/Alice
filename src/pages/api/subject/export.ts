/**
 * GET /api/subject/export
 *
 * Streams the subject's full data as NDJSON (one row per line, bounded
 * memory). The only sanctioned plaintext-egress path for subject content,
 * matching the consent doc's "Export" promise.
 *
 * Format:
 *   - Line 1: metadata header (`{ "type": "metadata", ... }`) carrying
 *     subjectId, exportedAt, schemaVersion, the included + excluded tables
 *     list, and the data_access_log row id this export was audited under.
 *   - Lines 2..N: one row per table per row (`{ "type": "row", "table":
 *     "tb_X", "data": {...} }`). Encrypted columns are decrypted at write
 *     time; credentials (password_hash, token_hash) are stripped.
 *   - Final line: end marker (`{ "type": "end", ... }`) with per-table row
 *     counts. On mid-stream error: an `{ "type": "error", "message": ... }`
 *     line is written before close so a downstream parser can see the
 *     failure rather than getting a truncated file.
 *
 * Memory discipline: every multi-row table is read via `sql.cursor(50)`
 * so peak memory is bounded to ~50 row objects per table at a time. Per-
 * row decryption (not batch) means plaintext exists only long enough to
 * `JSON.stringify` and `controller.enqueue` before the row is GC'able.
 *
 * Audit ordering: the `tb_data_access_log` row lands BEFORE the response
 * stream starts. A connection drop mid-export still leaves a "subject
 * exported at T" trace; the `notes` JSON on the audit row carries
 * `status: 'started'` so a future analyst can distinguish started-but-
 * incomplete from started-and-completed (we don't currently write a
 * completion row — adding one is fine when there's a use case).
 *
 * Excluded tables (per consent doc, locked spec):
 *   - tb_embeddings, tb_reconstruction_residuals: derived numerical
 *     artifacts used only for internal computation, regenerable from the
 *     underlying data.
 *   - tb_signal_jobs: internal worker queue, operational not personal.
 *
 * Auth: middleware guarantees `locals.subject` is non-null + non-owner.
 * When the consent gate ships in step 5 this route is in the whitelist —
 * a subject who refuses a new consent version still keeps their right to
 * export.
 */
import type { APIRoute } from 'astro';
import sql from '../../../lib/libDbPool.ts';
import { decrypt } from '../../../lib/libCrypto.ts';
import {
  CONSENT_VERSION,
  recordDataAccess,
} from '../../../lib/libConsent.ts';
import {
  extractClientIp,
  extractUserAgent,
} from '../../../lib/utlRequestContext.ts';
import { logError } from '../../../lib/utlErrorLog.ts';

const SCHEMA_VERSION = '1';

const INCLUDED_TABLES: ReadonlyArray<string> = [
  'tb_subjects',
  'tb_subject_sessions',
  'tb_subject_consent',
  'tb_data_access_log',
  'tb_responses',
  'tb_questions',
  'tb_question_feedback',
  'tb_interaction_events',
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
  'tb_personal_profile',
  'tb_calibration_baselines_history',
  'tb_semantic_baselines',
  'tb_semantic_trajectory',
  'tb_session_delta',
  'tb_prompt_traces',
];

const EXCLUDED_TABLES: ReadonlyArray<{ table: string; reason: string }> = [
  { table: 'tb_embeddings',              reason: 'derived numerical artifact, regenerable from response text' },
  { table: 'tb_reconstruction_residuals', reason: 'derived ghost-vs-real comparison, regenerable from signals' },
  { table: 'tb_signal_jobs',             reason: 'internal worker queue, operational not personal data' },
];

type WriteRow = (data: Record<string, unknown>) => void;

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Stream rows from a table to the writer. Uses `sql.cursor(50)` for
 * memory-bounded reads. Returns the row count for the end-marker.
 *
 * Each table block is written explicitly (vs. a config-driven loop) for
 * three reasons: (1) tagged-template SQL keeps query text auditable,
 * (2) encrypted-column decryption is per-table-shape, (3) credential
 * stripping (password_hash, token_hash) is per-table-shape. The boilerplate
 * is the cost of compile-time-checked queries.
 */
async function streamTableForSubject(
  table: string,
  subjectId: number,
  writeRow: WriteRow,
): Promise<number> {
  let count = 0;

  switch (table) {
    // ---- account ----
    case 'tb_subjects': {
      // password_hash deliberately omitted from the SELECT — it's a
      // credential, not subject data.
      const rows = await sql`
        SELECT subject_id, username, display_name, is_owner, is_active,
               must_reset_password, iana_timezone, invite_code, dttm_created_utc,
               dttm_modified_utc, modified_by
        FROM tb_subjects WHERE subject_id = ${subjectId}
      ` as Array<Record<string, unknown>>;
      for (const row of rows) {
        writeRow(row);
        count++;
      }
      break;
    }

    case 'tb_subject_sessions': {
      // token_hash deliberately omitted — effectively a credential.
      // Subject still sees expires_at, last_seen_at, last_ip per session.
      const cursor = sql`
        SELECT subject_session_id, subject_id, expires_at, last_seen_at,
               last_ip, dttm_created_utc
        FROM tb_subject_sessions WHERE subject_id = ${subjectId}
        ORDER BY subject_session_id ASC
      `.cursor(50);
      for await (const batch of cursor) {
        for (const row of batch) {
          writeRow(row);
          count++;
        }
      }
      break;
    }

    case 'tb_subject_consent': {
      const cursor = sql`
        SELECT subject_consent_id, subject_id, consent_version,
               dttm_acknowledged_utc, ip_address, user_agent,
               dttm_created_utc, created_by, dttm_modified_utc, modified_by
        FROM tb_subject_consent WHERE subject_id = ${subjectId}
        ORDER BY subject_consent_id ASC
      `.cursor(50);
      for await (const batch of cursor) {
        for (const row of batch) { writeRow(row); count++; }
      }
      break;
    }

    case 'tb_data_access_log': {
      const cursor = sql`
        SELECT data_access_log_id, subject_id, actor_subject_id,
               data_access_actor_id, data_access_action_id, consent_version,
               notes, ip_address, user_agent,
               dttm_created_utc, created_by, dttm_modified_utc, modified_by
        FROM tb_data_access_log WHERE subject_id = ${subjectId}
        ORDER BY data_access_log_id ASC
      `.cursor(50);
      for await (const batch of cursor) {
        for (const row of batch) { writeRow(row); count++; }
      }
      break;
    }

    // ---- authored content (decrypted) ----
    // SELECT * is intentional: any future column added to these tables flows
    // into the export automatically. The encrypted-storage pair is stripped
    // and replaced with the decrypted plaintext below.
    case 'tb_responses': {
      const cursor = sql`
        SELECT * FROM tb_responses WHERE subject_id = ${subjectId}
        ORDER BY response_id ASC
      `.cursor(50);
      for await (const batch of cursor) {
        for (const row of batch) {
          const { text_ciphertext, text_nonce, ...rest } = row as {
            text_ciphertext: string | null;
            text_nonce: string | null;
            [k: string]: unknown;
          };
          const text = text_ciphertext != null && text_nonce != null
            ? decrypt(text_ciphertext, text_nonce) : null;
          writeRow({ ...rest, text });
          count++;
        }
      }
      break;
    }

    case 'tb_questions': {
      const cursor = sql`
        SELECT * FROM tb_questions WHERE subject_id = ${subjectId}
        ORDER BY question_id ASC
      `.cursor(50);
      for await (const batch of cursor) {
        for (const row of batch) {
          const { text_ciphertext, text_nonce, ...rest } = row as {
            text_ciphertext: string | null;
            text_nonce: string | null;
            [k: string]: unknown;
          };
          const text = text_ciphertext != null && text_nonce != null
            ? decrypt(text_ciphertext, text_nonce) : null;
          writeRow({ ...rest, text });
          count++;
        }
      }
      break;
    }

    case 'tb_session_events': {
      const cursor = sql`
        SELECT * FROM tb_session_events WHERE subject_id = ${subjectId}
        ORDER BY session_event_id ASC
      `.cursor(50);
      for await (const batch of cursor) {
        for (const row of batch) {
          const {
            event_log_ciphertext, event_log_nonce,
            keystroke_stream_ciphertext, keystroke_stream_nonce,
            ...rest
          } = row as {
            event_log_ciphertext: string | null;
            event_log_nonce: string | null;
            keystroke_stream_ciphertext: string | null;
            keystroke_stream_nonce: string | null;
            [k: string]: unknown;
          };
          // Parse the inner JSON so the export is genuinely "machine
          // readable JSON" rather than embedded-string-in-JSON.
          const eventLog = event_log_ciphertext != null && event_log_nonce != null
            ? JSON.parse(decrypt(event_log_ciphertext, event_log_nonce)) : null;
          const keystrokeStream = keystroke_stream_ciphertext != null && keystroke_stream_nonce != null
            ? JSON.parse(decrypt(keystroke_stream_ciphertext, keystroke_stream_nonce)) : null;
          writeRow({
            ...rest,
            event_log_json: eventLog,
            keystroke_stream_json: keystrokeStream,
          });
          count++;
        }
      }
      break;
    }

    // ---- everything else: SELECT * + identity transform ----
    case 'tb_question_feedback':
    case 'tb_interaction_events':
    case 'tb_session_summaries':
    case 'tb_session_metadata':
    case 'tb_burst_sequences':
    case 'tb_rburst_sequences':
    case 'tb_dynamical_signals':
    case 'tb_motor_signals':
    case 'tb_semantic_signals':
    case 'tb_process_signals':
    case 'tb_cross_session_signals':
    case 'tb_session_integrity':
    case 'tb_personal_profile':
    case 'tb_calibration_baselines_history':
    case 'tb_semantic_baselines':
    case 'tb_semantic_trajectory':
    case 'tb_session_delta':
    case 'tb_prompt_traces': {
      // sql.unsafe is required for dynamic table names. The `table` value
      // is constrained by the outer switch — only literals listed above
      // reach this branch, so injection surface is zero.
      const cursor = sql.unsafe(
        `SELECT * FROM ${table} WHERE subject_id = $1 ORDER BY 1 ASC`,
        [subjectId],
      ).cursor(50);
      for await (const batch of cursor) {
        for (const row of batch) {
          writeRow(row);
          count++;
        }
      }
      break;
    }

    default:
      throw new Error(`streamTableForSubject: unknown table ${table}`);
  }

  return count;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const subject = locals.subject;
  if (!subject) return jsonError(401, 'unauthorized');

  const exportedAt = new Date().toISOString();
  const ipAddress = extractClientIp(request);
  const userAgent = extractUserAgent(request);

  // Audit row first. A connection drop mid-stream still leaves "subject
  // exported at T" in the audit log. Auth-check happens above so we never
  // audit-log unauthenticated requests.
  let dataAccessLogId: number;
  try {
    dataAccessLogId = await recordDataAccess({
      subjectId: subject.subject_id,
      action: 'export',
      actor: 'subject',
      actorSubjectId: subject.subject_id,
      notes: { status: 'started', schemaVersion: SCHEMA_VERSION, exportedAt },
      ipAddress,
      userAgent,
    });
  } catch (err) {
    logError('subject-export.audit-failed', err, { subjectId: subject.subject_id });
    return jsonError(500, 'export_audit_failed');
  }

  const encoder = new TextEncoder();
  const subjectId = subject.subject_id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeLine = (obj: unknown): void => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      const tableRowCounts: Record<string, number> = {};
      let totalRows = 0;

      try {
        // Metadata header
        writeLine({
          type: 'metadata',
          schemaVersion: SCHEMA_VERSION,
          subjectId,
          username: subject.username,
          exportedAt,
          consentVersionAtExport: CONSENT_VERSION,
          dataAccessLogId,
          included: INCLUDED_TABLES,
          excluded: EXCLUDED_TABLES,
        });

        // Per-table rows
        for (const table of INCLUDED_TABLES) {
          const writeRow = (data: Record<string, unknown>): void => {
            writeLine({ type: 'row', table, data });
          };
          const count = await streamTableForSubject(table, subjectId, writeRow);
          tableRowCounts[table] = count;
          totalRows += count;
        }

        // End marker
        writeLine({
          type: 'end',
          totalRows,
          tableRowCounts,
        });

        controller.close();
      } catch (err) {
        logError('subject-export.stream', err, {
          subjectId,
          dataAccessLogId,
          totalRowsSoFar: totalRows,
        });
        try {
          writeLine({
            type: 'error',
            message: (err as Error).message ?? 'export_failed',
            partial: { totalRows, tableRowCounts },
          });
        } catch {
          // controller might already be closed; nothing to do
        }
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  const filenameDate = exportedAt.slice(0, 10);
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': `attachment; filename="alice-export-subject-${subjectId}-${filenameDate}.ndjson"`,
      'Cache-Control': 'no-store',
    },
  });
};
