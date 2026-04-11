/**
 * Returns abstract signals derived from real system state.
 * No content is exposed — only shapes, intensities, and patterns.
 * The visual is reverse-engineerable from the data, like Hawking radiation.
 */
import type { APIRoute } from 'astro';
import db from '../../lib/db.ts';

interface BlackboxSignal {
  // Derived from behavioral data — how you've been writing
  avgCommitment: number;        // 0-1, your average commitment ratio
  avgHesitation: number;        // 0-1, normalized first-keystroke latency
  deletionIntensity: number;    // 0-1, how much you delete relative to what you type
  pauseFrequency: number;       // 0-1, how often you pause
  sessionCount: number;         // how many entries exist

  // Derived from system state — what the system has been doing
  observationCount: number;     // how many observations exist
  reflectionCount: number;      // how many reflections exist
  suppressedCount: number;      // how many questions the system held back
  embeddingCount: number;       // how much has been vectorized

  // Derived from the latest observation — abstracted confidence
  latestConfidence: string;     // HIGH / MODERATE / LOW / INSUFFICIENT DATA / null

  // Thematic density — how clustered or diverse recent entries are
  // (ratio of unique words to total words in last 7 entries)
  thematicDensity: number;      // 0-1, higher = more repetitive language

  // Feedback signal
  landedRatio: number;          // 0-1, ratio of "yes" to total feedback
  feedbackCount: number;
}

export const GET: APIRoute = async () => {
  try {
    // Behavioral averages
    const behavioral = db.prepare(`
      SELECT
         AVG(commitment_ratio) as avgCommitment
        ,AVG(CAST(first_keystroke_ms AS REAL) / 60000.0) as avgHesitation
        ,AVG(CASE WHEN total_chars_typed > 0
             THEN CAST(total_chars_deleted AS REAL) / total_chars_typed
             ELSE 0 END) as deletionIntensity
        ,AVG(CAST(pause_count AS REAL) / 10.0) as pauseFrequency
        ,COUNT(*) as sessionCount
      FROM tb_session_summaries
    `).get() as any;

    // System state counts
    const obsCount = (db.prepare(`SELECT COUNT(*) as c FROM tb_ai_observations`).get() as any).c;
    const refCount = (db.prepare(`SELECT COUNT(*) as c FROM tb_reflections`).get() as any).c;
    const supCount = (db.prepare(`SELECT COUNT(*) as c FROM tb_ai_suppressed_questions`).get() as any).c;
    const embCount = (db.prepare(`SELECT COUNT(*) as c FROM tb_embeddings`).get() as any).c;

    // Latest observation confidence
    const latestObs = db.prepare(`
      SELECT observation_text FROM tb_ai_observations
      ORDER BY observation_date DESC LIMIT 1
    `).get() as { observation_text: string } | null;

    let latestConfidence: string | null = null;
    if (latestObs) {
      const match = latestObs.observation_text.match(/confidence[:\s]*(HIGH|MODERATE|LOW|INSUFFICIENT DATA)/i);
      latestConfidence = match?.[1]?.toUpperCase() ?? null;
    }

    // Thematic density from last 7 entries
    const recentTexts = db.prepare(`
      SELECT r.text FROM tb_responses r
      JOIN tb_questions q ON r.question_id = q.question_id
      WHERE q.question_source_id != 3
      ORDER BY q.scheduled_for DESC LIMIT 7
    `).all() as Array<{ text: string }>;

    let thematicDensity = 0.5;
    if (recentTexts.length >= 2) {
      const allWords = recentTexts.map(r => r.text.toLowerCase()).join(' ')
        .replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const uniqueWords = new Set(allWords);
      thematicDensity = allWords.length > 0
        ? 1 - (uniqueWords.size / allWords.length)  // higher = more repetitive
        : 0.5;
    }

    // Feedback ratio
    const feedback = db.prepare(`
      SELECT COUNT(*) as total, SUM(landed) as landed
      FROM tb_question_feedback
    `).get() as any;

    const signal: BlackboxSignal = {
      avgCommitment: Math.min(1, Math.max(0, behavioral.avgCommitment ?? 0.5)),
      avgHesitation: Math.min(1, Math.max(0, behavioral.avgHesitation ?? 0.5)),
      deletionIntensity: Math.min(1, Math.max(0, behavioral.deletionIntensity ?? 0)),
      pauseFrequency: Math.min(1, Math.max(0, behavioral.pauseFrequency ?? 0)),
      sessionCount: behavioral.sessionCount ?? 0,
      observationCount: obsCount,
      reflectionCount: refCount,
      suppressedCount: supCount,
      embeddingCount: embCount,
      latestConfidence,
      thematicDensity: Math.min(1, Math.max(0, thematicDensity)),
      landedRatio: feedback.total > 0 ? (feedback.landed ?? 0) / feedback.total : 0.5,
      feedbackCount: feedback.total ?? 0,
    };

    return new Response(JSON.stringify(signal), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to compute signal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
