import 'dotenv/config';
import Database from 'better-sqlite3';
import { interpretTraits } from '../src/lib/dream/interpreter.ts';

const db = new Database('./data/marrow.db');

const { count } = db.prepare('SELECT COUNT(*) as count FROM tb_session_summaries').get() as any;

const rows = db.prepare('SELECT commitment_ratio, first_keystroke_ms, total_chars_deleted, total_chars_typed, pause_count FROM tb_session_summaries').all() as any[];
const n = rows.length;
const avgCommitment = rows.reduce((s, r) => s + (r.commitment_ratio ?? 0), 0) / n;
const avgHesitation = rows.reduce((s, r) => s + Math.min((r.first_keystroke_ms ?? 0) / 60000, 1), 0) / n;
const deletionIntensity = rows.reduce((s, r) => s + ((r.total_chars_typed ?? 0) > 0 ? (r.total_chars_deleted ?? 0) / r.total_chars_typed : 0), 0) / n;
const pauseFrequency = rows.reduce((s, r) => s + Math.min((r.pause_count ?? 0) / 10, 1), 0) / n;

const observationCount = (db.prepare('SELECT COUNT(*) as c FROM tb_ai_observations').get() as any).c;
const reflectionCount = (db.prepare('SELECT COUNT(*) as c FROM tb_reflections').get() as any).c;
const suppressedCount = (db.prepare('SELECT COUNT(*) as c FROM tb_ai_suppressed_questions').get() as any).c;
const embeddingCount = (db.prepare('SELECT COUNT(*) as c FROM tb_embeddings').get() as any).c;

const latestObs = db.prepare('SELECT observation_text FROM tb_ai_observations ORDER BY ai_observation_id DESC LIMIT 1').get() as any;
const latestConfidence = latestObs?.observation_text?.match(/confidence:\s*(HIGH|MODERATE|LOW|INSUFFICIENT DATA)/i)?.[1] ?? null;

const recent = db.prepare('SELECT text FROM tb_responses ORDER BY response_id DESC LIMIT 7').all() as any[];
const allWords = recent.map((r: any) => r.text).join(' ').toLowerCase().split(/\s+/).filter((w: string) => w.length > 0);
const uniqueWords = new Set(allWords).size;
const thematicDensity = allWords.length > 0 ? 1 - uniqueWords / allWords.length : 0;

const feedback = db.prepare('SELECT landed FROM tb_question_feedback').all() as any[];
const feedbackCount = feedback.length;
const landedRatio = feedbackCount > 0 ? feedback.reduce((s, r) => s + (r.landed ?? 0), 0) / feedbackCount : 0.5;

const sig = {
  avgCommitment, avgHesitation, deletionIntensity, pauseFrequency,
  sessionCount: n, observationCount, reflectionCount, suppressedCount,
  embeddingCount, latestConfidence, thematicDensity, landedRatio, feedbackCount,
};

console.log('Calling Opus for entry count:', count);
const traits = await interpretTraits(sig, count);
console.log('Done. Opus interpretation saved.');
db.close();
