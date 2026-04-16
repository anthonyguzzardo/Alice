/**
 * Observatory Playback API
 *
 * Returns the per-keystroke event log for a given questionId so the replay
 * page can render the writing timeline at original tempo.
 */
import type { APIRoute } from 'astro';
import { getSessionEvents } from '../../../../lib/db.ts';

export const GET: APIRoute = async ({ params }) => {
  try {
    const questionId = parseInt(params.questionId ?? '', 10);
    if (isNaN(questionId)) {
      return new Response(JSON.stringify({ error: 'Invalid questionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const row = getSessionEvents(questionId);
    if (!row) {
      return new Response(JSON.stringify({ error: 'No event log for this session' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let events: unknown = [];
    try {
      events = JSON.parse(row.event_log_json);
    } catch {
      events = [];
    }

    return new Response(JSON.stringify({
      questionId,
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
