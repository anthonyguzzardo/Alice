/**
 * Observatory Entry Detail API
 *
 * Returns one envelope of per-entry data for the detail page:
 *   - 7D behavioral state (computed live via libStateEngine)
 *   - Question text + scheduled date (decrypted at the libDb boundary)
 *   - Live signal-family rows: motor, dynamical, process, cross-session,
 *     discourse-coherence subset of semantic, session metadata
 *   - Replay availability flag
 *
 * Anchored on `response_id` from the URL. Subject scope resolved from
 * `?subjectId=N` (defaults to owner). Pre-2026-04-27 this endpoint anchored
 * on tb_entry_states; the table was archived (migration 036, INC-017) and
 * the page was deleted. Rebuild recomputes 7D state on every request from
 * existing live tables — no persistence, no backfill, no producer wiring.
 */
import type { APIRoute } from 'astro';
import sql, {
  getQuestionTextById,
  getSessionSummary,
  getMotorSignals,
  getProcessSignals,
  getCrossSessionSignals,
  getSemanticSignals,
  getDynamicalSignals,
  getSessionMetadata,
} from '../../../../lib/libDb.ts';
import { computeEntryStates } from '../../../../lib/libStateEngine.ts';
import { logError } from '../../../../lib/utlErrorLog.ts';
import { resolveObservatorySubjectId, badSubjectResponse } from '../../../../lib/libObservatorySubject.ts';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const subjectId = await resolveObservatorySubjectId(request);
    const responseId = parseInt(params.id ?? '', 10);
    if (Number.isNaN(responseId)) {
      return new Response(JSON.stringify({ error: 'Invalid response id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Resolve question_id for this response (cheap PK lookup).
    const respRows = await sql`
      SELECT question_id FROM tb_responses
      WHERE subject_id = ${subjectId} AND response_id = ${responseId}
      LIMIT 1
    ` as Array<{ question_id: number }>;
    const respRow = respRows[0];
    if (!respRow) {
      return new Response(JSON.stringify({ error: 'Response not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const questionId = respRow.question_id;

    // 7D state requires the personal baseline, so we must compute the full
    // set then filter. The state computation is fast (z-score arithmetic)
    // and reads only live tables.
    const allStates = await computeEntryStates(subjectId);
    const entryState = allStates.find(s => s.responseId === responseId) ?? null;

    // Fan out parallel reads of live signal-family rows + replay availability.
    const [
      questionInfo,
      sessionSummary,
      motor,
      process,
      crossSession,
      semantic,
      dynamical,
      metadata,
      replayRows,
    ] = await Promise.all([
      getQuestionTextById(subjectId, questionId),
      getSessionSummary(subjectId, questionId),
      getMotorSignals(subjectId, questionId),
      getProcessSignals(subjectId, questionId),
      getCrossSessionSignals(subjectId, questionId),
      getSemanticSignals(subjectId, questionId),
      getDynamicalSignals(subjectId, questionId),
      getSessionMetadata(subjectId, questionId),
      sql`SELECT 1 FROM tb_session_events WHERE subject_id = ${subjectId} AND question_id = ${questionId} LIMIT 1`,
    ]);

    // Discourse coherence subset only — the rest of tb_semantic_signals
    // includes columns whose producer pipelines were tied to the archived
    // alice-negative semantic 11D space. Field-pick to be safe.
    const discourse = semantic ? {
      discourse_global_coherence: semantic.discourse_global_coherence,
      discourse_local_coherence: semantic.discourse_local_coherence,
      discourse_global_local_ratio: semantic.discourse_global_local_ratio,
      discourse_coherence_decay_slope: semantic.discourse_coherence_decay_slope,
    } : null;

    // Date: pull from session_summary if present, else from the questions row.
    let date: string | null = (sessionSummary as { date?: string } | null)?.date ?? null;
    if (!date) {
      const dateRows = await sql`
        SELECT scheduled_for AS date FROM tb_questions
        WHERE subject_id = ${subjectId} AND question_id = ${questionId}
        LIMIT 1
      ` as Array<{ date: string }>;
      date = dateRows[0]?.date ?? null;
    }

    return new Response(JSON.stringify({
      responseId,
      questionId,
      date,
      question: questionInfo?.text ?? null,
      entryState,
      sessionSummary,
      motor,
      process,
      crossSession,
      discourse,
      dynamical,
      metadata,
      replayAvailable: replayRows.length > 0,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const r = badSubjectResponse(err);
    if (r) return r;
    logError('api.observatory.entry', err);
    return new Response(JSON.stringify({ error: 'Failed to load entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
