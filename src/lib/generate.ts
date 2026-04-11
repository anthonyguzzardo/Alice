/**
 * Generates tomorrow's question.
 * During seed phase (days 1-30): no-op, seeds are pre-scheduled.
 * After day 30: generates from RAG-augmented context with reflections
 * as hypothesis layer and raw entries as source of truth.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  getRecentResponses,
  getRecentObservations,
  getRecentSuppressedQuestions,
  getRecentFeedback,
  getSessionSummariesForQuestions,
  getAllReflections,
  scheduleQuestion,
  hasQuestionForDate,
  getResponseCount,
} from './db.ts';
import { localDateStr } from './date.ts';
import { retrieveSimilarMulti, retrieveContrarian } from './rag.ts';

const SEED_DAYS = 30;
const RECENT_WINDOW = 14;

export async function runGeneration(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDateStr(tomorrow);

  if (hasQuestionForDate(tomorrowStr)) return;

  const responseCount = getResponseCount();
  if (responseCount < SEED_DAYS) return;

  // --- RECENT RAW ENTRIES (always included verbatim) ---
  const recentResponses = getRecentResponses(RECENT_WINDOW);

  // --- REFLECTIONS: recent in full, older only if RAG resurfaces them ---
  const allReflections = getAllReflections();
  const RECENT_REFLECTIONS = 4;
  const recentReflections = allReflections.slice(-RECENT_REFLECTIONS);
  const latestReflection = recentReflections[recentReflections.length - 1] ?? null;

  // --- RAG: older entries that resonate with recent themes ---
  const recentDates = new Set(recentResponses.map(r => r.date));
  const querySeeds = recentResponses
    .slice(0, 3) // last 3 entries as query seeds (already sorted DESC)
    .map(r => `${r.question}\n${r.response}`);
  if (latestReflection) {
    querySeeds.push(latestReflection.text.slice(0, 500));
  }

  const ragEntries = await retrieveSimilarMulti(querySeeds, {
    topK: 10,
    sourceTypes: ['response'],
    excludeDates: Array.from(recentDates),
    recencyHalfLifeDays: 45,
    recencyWeight: 0.15,
  });

  // --- CONTRARIAN: entries that break the echo chamber ---
  const ragIds = new Set(ragEntries.map(e => e.embeddingId));
  const contrarianEntries = (await retrieveContrarian(querySeeds, {
    topK: 3,
    sourceTypes: ['response'],
    excludeDates: Array.from(recentDates),
  })).filter(e => !ragIds.has(e.embeddingId)); // no overlap with RAG results

  // --- RAG: older reflections that resonate with current moment ---
  const recentReflectionIds = new Set(recentReflections.map(r => r.reflection_id));
  const ragReflections = allReflections.length > RECENT_REFLECTIONS
    ? (await retrieveSimilarMulti(querySeeds.slice(0, 2), {
        topK: 3,
        sourceTypes: ['reflection'],
        recencyHalfLifeDays: 90,
        recencyWeight: 0.05,
      })).filter(e => !recentReflectionIds.has(e.sourceRecordId))
    : [];

  // --- SCOPED CONTEXT ---
  const recentObservations = getRecentObservations(RECENT_WINDOW);
  const recentSuppressed = getRecentSuppressedQuestions(RECENT_WINDOW);
  const recentFeedback = getRecentFeedback(10);
  const recentQuestionIds = recentResponses.map(r => r.question_id);
  const recentSummaries = getSessionSummariesForQuestions(recentQuestionIds);

  // --- FORMAT SECTIONS ---
  // Recent entries are sorted DESC from query, reverse for chronological display
  const recentEntriesSection = [...recentResponses].reverse()
    .map(r => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
    .join('\n\n---\n\n');

  const ragEntriesSection = ragEntries.length > 0
    ? ragEntries.map(e => e.text).join('\n\n---\n\n')
    : 'No resonant older entries found.';

  const contrarianSection = contrarianEntries.length > 0
    ? contrarianEntries.map(e => e.text).join('\n\n---\n\n')
    : 'No contrarian entries available.';

  // Recent reflections in full, older ones only if RAG resurfaced them
  let reflectionsSection = '';
  if (ragReflections.length > 0) {
    reflectionsSection += `RESURFACED OLDER REFLECTIONS (still relevant to current themes):\n\n`;
    reflectionsSection += ragReflections.map(r => r.text).join('\n\n===\n\n');
    reflectionsSection += '\n\n---\n\n';
  }
  if (recentReflections.length > 0) {
    reflectionsSection += `RECENT REFLECTIONS (last ${RECENT_REFLECTIONS}):\n\n`;
    reflectionsSection += recentReflections.map(r => `[${r.dttm_created_utc}]\n${r.text}`).join('\n\n===\n\n');
  }
  if (!reflectionsSection) {
    reflectionsSection = 'No reflections yet.';
  }

  const observationsSection = recentObservations.length > 0
    ? recentObservations.map(o => `[${o.date}]\n${o.observation}`).join('\n\n---\n\n')
    : 'No observations yet.';

  const suppressedSection = recentSuppressed.length > 0
    ? recentSuppressed.map(q => `[${q.date}] ${q.question}`).join('\n')
    : 'No suppressed questions yet.';

  const behavioralSection = recentSummaries.length > 0
    ? recentSummaries.map(s =>
        `[${s.date}] device=${s.deviceType || '?'} hour=${s.hourOfDay ?? '?'} keystroke_latency=${s.firstKeystrokeMs}ms duration=${s.totalDurationMs}ms commitment=${s.commitmentRatio?.toFixed(2)} pauses=${s.pauseCount} deletions=${s.deletionCount} largest_deletion=${s.largestDeletion} tab_aways=${s.tabAwayCount} words=${s.wordCount}`
      ).join('\n')
    : 'No behavioral data available.';

  const feedbackSection = recentFeedback.length > 0
    ? `Question feedback ("did it land?"):\n${recentFeedback.map(f => `[${f.date}] ${f.landed ? 'YES' : 'NO'}`).join('\n')}\n\nUse this to calibrate question quality. "NO" means recalibrate — that line of questioning missed. "YES" is weaker signal — could mean insightful, uncomfortable, or just emotionally loaded.`
    : '';

  const systemPrompt = `You are Marrow — a monastic, stubborn thinking journal. You are not helpful. You are not kind. You are honest in the way a mirror is honest.

Your job is to generate ONE question for tomorrow. This question should:
- Be unanswerable in one sentence
- Be about the person, not about a topic
- Have no right answer
- Be worth returning to months from now
- Target something they're avoiding, circling, or haven't finished thinking about
- NOT repeat a question already asked

You have access to two layers of context with different trust levels:

SOURCE OF TRUTH — Their actual words:
1. Recent entries (last ${RECENT_WINDOW}, verbatim)
2. Resonant older entries (retrieved by semantic similarity to recent themes — not exhaustive)
3. Contrarian entries (deliberately DISSIMILAR to current themes — what you've been ignoring)

HYPOTHESIS LAYER — Your interpretations (may contain errors):
4. Recent reflections (your last few weekly pattern analyses)
5. Resurfaced older reflections (old analyses that the system detected are relevant again — not all old reflections, only those whose themes echo now)
6. Recent observations (your nightly three-frame analyses)
7. Suppressed questions (things you've been wanting to ask)

If a reflection contradicts what you read in the raw entries, trust the entries.
Pay special attention to the contrarian entries — they represent threads you may be neglecting.

Weight your sources appropriately:
- The journal text is your primary signal. What they said matters most.
- Behavioral data is secondary signal. Only trust patterns across multiple sessions.
- Recent observations include confidence levels. Weight accordingly.
- A "no" on "did it land?" means that line of questioning missed.

Do NOT explain the question. Do NOT add commentary. Output ONLY the question text, nothing else.`;

  const userContent = `=== WHAT THEY SAID (SOURCE OF TRUTH) ===

RECENT ENTRIES (last ${RECENT_WINDOW}, verbatim):

${recentEntriesSection}

---

RESONANT OLDER ENTRIES (retrieved by thematic similarity):

${ragEntriesSection}

---

CONTRARIAN ENTRIES (deliberately dissimilar — what you might be ignoring):

${contrarianSection}

=== WHAT YOU'VE OBSERVED (HYPOTHESIS LAYER — your interpretations, not facts) ===

${reflectionsSection}

---

RECENT OBSERVATIONS (your nightly three-frame analyses, last ${RECENT_WINDOW}):

${observationsSection}

---

SUPPRESSED QUESTIONS (things you've been wanting to ask, last ${RECENT_WINDOW}):
${suppressedSection}

=== SIGNAL DATA ===

BEHAVIORAL DATA (for recent entries only):
${behavioralSection}

${feedbackSection}

---

Generate tomorrow's question.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const questionText = (message.content[0] as { type: 'text'; text: string }).text.trim();
  scheduleQuestion(questionText, tomorrowStr, 'generated');
}
