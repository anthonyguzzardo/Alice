import 'dotenv/config';
import Database from 'better-sqlite3';
import { interpretTraits } from '../src/lib/dream/interpreter.ts';

const db = new Database('./data/marrow.db');

const { count } = db.prepare('SELECT COUNT(*) as count FROM tb_session_summaries').get() as any;

// Behavioral averages
const behavioral = db.prepare(`
  SELECT
     AVG(commitment_ratio) as avgCommitment
    ,AVG(CAST(first_keystroke_ms AS REAL) / 60000.0) as avgHesitation
    ,AVG(CASE WHEN total_chars_typed > 0
         THEN CAST(total_chars_deleted AS REAL) / total_chars_typed
         ELSE 0 END) as deletionIntensity
    ,AVG(CAST(pause_count AS REAL) / 10.0) as pauseFrequency
    ,AVG(CAST(total_duration_ms AS REAL) / 600000.0) as avgDuration
    ,AVG(CAST(largest_deletion AS REAL)) as avgLargestDeletion
    ,AVG(CAST(tab_away_count AS REAL)) as avgTabAways
    ,AVG(CAST(total_tab_away_ms AS REAL) / 60000.0) as avgTabAwayDuration
    ,AVG(CAST(word_count AS REAL)) as avgWordCount
    ,AVG(CAST(sentence_count AS REAL)) as avgSentenceCount
    ,AVG(CAST(hour_of_day AS REAL)) as avgHourOfDay
    ,COUNT(DISTINCT day_of_week) as uniqueDays
    ,COUNT(*) as sessionCount
  FROM tb_session_summaries
`).get() as any;

// Temporal
const lastEntry = db.prepare(`
  SELECT dttm_created_utc FROM tb_session_summaries ORDER BY session_summary_id DESC LIMIT 1
`).get() as any;

let daysSinceLastEntry = 0;
if (lastEntry?.dttm_created_utc) {
  const lastDate = new Date(lastEntry.dttm_created_utc + 'Z');
  daysSinceLastEntry = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
}

const entryDates = db.prepare(`
  SELECT dttm_created_utc FROM tb_session_summaries ORDER BY session_summary_id ASC
`).all() as any[];

let consistency = 0.5;
if (entryDates.length >= 3) {
  const gaps: number[] = [];
  for (let i = 1; i < entryDates.length; i++) {
    const a = new Date(entryDates[i - 1].dttm_created_utc + 'Z').getTime();
    const b = new Date(entryDates[i].dttm_created_utc + 'Z').getTime();
    gaps.push((b - a) / 86400000);
  }
  const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const variance = gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length;
  const stddev = Math.sqrt(variance);
  consistency = meanGap > 0 ? Math.max(0, Math.min(1, 1 - stddev / (meanGap + 1))) : 0.5;
}

// System state
const obsCount = (db.prepare('SELECT COUNT(*) as c FROM tb_ai_observations').get() as any).c;
const refCount = (db.prepare('SELECT COUNT(*) as c FROM tb_reflections').get() as any).c;
const supCount = (db.prepare('SELECT COUNT(*) as c FROM tb_ai_suppressed_questions').get() as any).c;
const embCount = (db.prepare('SELECT COUNT(*) as c FROM tb_embeddings').get() as any).c;

const latestObs = db.prepare('SELECT observation_text FROM tb_ai_observations ORDER BY ai_observation_id DESC LIMIT 1').get() as any;
const latestConfidence = latestObs?.observation_text?.match(/confidence:\s*(HIGH|MODERATE|LOW|INSUFFICIENT DATA)/i)?.[1] ?? null;

// Thematic density
const recent = db.prepare('SELECT text FROM tb_responses ORDER BY response_id DESC LIMIT 7').all() as any[];
const allWords = recent.map((r: any) => r.text).join(' ').toLowerCase().split(/\s+/).filter((w: string) => w.length > 0);
const uniqueWords = new Set(allWords).size;
const thematicDensity = allWords.length > 0 ? 1 - uniqueWords / allWords.length : 0;

// Feedback
const feedback = db.prepare('SELECT COUNT(*) as total, SUM(landed) as landed FROM tb_question_feedback').get() as any;

const clamp = (v: number, fallback = 0) => Math.min(1, Math.max(0, v ?? fallback));

const sig = {
  avgCommitment: clamp(behavioral.avgCommitment, 0.5),
  avgHesitation: clamp(behavioral.avgHesitation, 0.5),
  deletionIntensity: clamp(behavioral.deletionIntensity),
  pauseFrequency: clamp(behavioral.pauseFrequency),
  avgDuration: clamp(behavioral.avgDuration),
  largestDeletion: clamp((behavioral.avgLargestDeletion ?? 0) / 500),
  avgTabAways: clamp((behavioral.avgTabAways ?? 0) / 5),
  avgTabAwayDuration: clamp(behavioral.avgTabAwayDuration),
  avgWordCount: clamp((behavioral.avgWordCount ?? 0) / 500),
  avgSentenceCount: clamp((behavioral.avgSentenceCount ?? 0) / 30),
  sessionCount: behavioral.sessionCount,
  avgHourOfDay: clamp((behavioral.avgHourOfDay ?? 12) / 24),
  daySpread: clamp((behavioral.uniqueDays ?? 1) / 7),
  consistency,
  daysSinceLastEntry,
  observationCount: obsCount,
  reflectionCount: refCount,
  suppressedCount: supCount,
  embeddingCount: embCount,
  latestConfidence,
  thematicDensity: clamp(thematicDensity),
  landedRatio: feedback.total > 0 ? (feedback.landed ?? 0) / feedback.total : 0.5,
  feedbackCount: feedback.total ?? 0,
};

console.log('Calling Opus with 24 signals for entry count:', count);
const traits = await interpretTraits(sig, count);
console.log('Done. Opus interpretation saved.');
db.close();
