/**
 * Observatory Playback API
 *
 * Returns the per-keystroke event log for a given questionId so the replay
 * page can render the writing timeline at original tempo.
 */
import type { APIRoute } from 'astro';
import sql, { getSessionEvents } from '../../../../lib/libDb.ts';

export const GET: APIRoute = async ({ params }) => {
  try {
    const questionId = parseInt(params.questionId ?? '', 10);
    if (isNaN(questionId)) {
      return new Response(JSON.stringify({ error: 'Invalid questionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const row = await getSessionEvents(questionId);
    if (!row) {
      return new Response(JSON.stringify({ error: 'No event log for this session' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let rawEvents: any[] = [];
    try {
      rawEvents = JSON.parse(row.event_log_json);
    } catch {
      rawEvents = [];
    }

    // Detect format and reconstruct full text snapshots for the replay page.
    // Old format: [offsetMs, fullText] — pass through.
    // New delta format: [offsetMs, cursorPos, deletedCount, insertedText] — reconstruct.
    let events: Array<[number, string]> = [];
    if (rawEvents.length > 0 && rawEvents[0].length === 4 && typeof rawEvents[0][1] === 'number') {
      // Delta format: reconstruct full text at each step
      let text = '';
      for (const [ts, pos, del, ins] of rawEvents) {
        text = text.slice(0, pos) + ins + text.slice(pos + del);
        events.push([ts, text]);
      }
    } else {
      // Legacy snapshot format: pass through
      events = rawEvents;
    }

    // Resolve response_id so replay can link back to the correct entry
    const responseRows = await sql`
      SELECT response_id FROM tb_responses WHERE question_id = ${questionId} ORDER BY response_id DESC LIMIT 1
    `;
    const responseRow = responseRows[0] as { response_id: number } | undefined;

    return new Response(JSON.stringify({
      questionId,
      responseId: responseRow?.response_id ?? null,
      events,
      totalEvents: row.total_events,
      durationMs: row.session_duration_ms,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Playback API error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Failed to load playback', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
