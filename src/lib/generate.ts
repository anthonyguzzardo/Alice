/**
 * Generates tomorrow's question.
 * During seed phase (days 1-30): no-op, seeds are pre-scheduled.
 * After day 30: generates from RAG-augmented context with reflections
 * as hypothesis layer and raw entries as source of truth.
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  getRecentResponses,
  getRecentObservations,
  getRecentSuppressedQuestions,
  getRecentFeedback,
  getSessionSummariesForQuestions,
  getAllSessionSummaries,
  getAllReflections,
  scheduleQuestion,
  hasQuestionForDate,
  getResponseCount,
  savePromptTrace,
  getPredictionStats,
  getAllTheoryConfidences,
  getRecentGradedPredictions,
  updateQuestionIntent,
  saveQuestionCandidates,
  getRecentCalibrationContext,
  getRecentSessionDeltas,
} from './db.ts';
import { localDateStr } from './date.ts';
import { retrieveSimilarMulti, retrieveContrarian } from './rag.ts';
import {
  formatCompactSignals, formatDynamicsContext,
  formatPredictionTrackRecord,
} from './signals.ts';
import { computeEntryStates } from './bob/state-engine.ts';
import { computeDynamics } from './bob/dynamics.ts';
import { computeMATTR } from './bob/helpers.ts';
import { formatCompactDelta } from './session-delta.ts';

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

  // Enriched behavioral signals (research-backed formatting)
  const allSummaries = getAllSessionSummaries();
  const behavioralSection = recentSummaries.length > 0
    ? formatCompactSignals(recentSummaries, allSummaries)
    : 'No behavioral data available.';

  // Dynamics context (8D PersDyn behavioral dynamics)
  const entryStates = computeEntryStates();
  const dynamics = computeDynamics(entryStates);
  const dynamicsSection = dynamics.entryCount > 0
    ? formatDynamicsContext(dynamics, 'compact')
    : '';

  // Life-context from recent calibration extractions
  const recentLifeContext = getRecentCalibrationContext(20);
  const lifeContextSection = recentLifeContext.length > 0
    ? formatGenerateLifeContext(recentLifeContext)
    : '';

  // Session delta trends (same-day calibration → journal shifts)
  const recentDeltas = getRecentSessionDeltas(14);
  const deltaTrendSection = recentDeltas.length > 0
    ? formatCompactDelta(recentDeltas)
    : '';

  // Prediction track record
  const predStats = getPredictionStats();
  const theories = getAllTheoryConfidences();
  const recentGraded = getRecentGradedPredictions(5);
  const predictionSection = formatPredictionTrackRecord(predStats, theories, recentGraded);

  const feedbackSection = recentFeedback.length > 0
    ? `Question feedback ("did it land?"):\n${recentFeedback.map(f => `[${f.date}] ${f.landed ? 'YES' : 'NO'}`).join('\n')}\n\nUse this to calibrate question quality. "NO" means recalibrate — that line of questioning missed. "YES" is weaker signal — could mean insightful, uncomfortable, or just emotionally loaded.`
    : '';

  // --- ADAPTIVE DIFFICULTY (Bjork & Bjork 2011; Gibbons et al. 2012) ---
  // Compute response complexity metrics to calibrate question challenge level
  const recentTexts = recentResponses.map(r => r.response);
  const recentMATTRs = recentTexts.map(t => {
    const words = t.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length >= 25 ? computeMATTR(words) : null;
  }).filter((v): v is number => v != null);
  const avgMATTR = recentMATTRs.length > 0
    ? recentMATTRs.reduce((a, b) => a + b, 0) / recentMATTRs.length : null;
  const recentCogDensities = recentSummaries
    .map(s => s.cognitiveDensity)
    .filter((v): v is number => v != null);
  const avgCogDensity = recentCogDensities.length > 0
    ? recentCogDensities.reduce((a, b) => a + b, 0) / recentCogDensities.length : null;

  let difficultyGuidance = '';
  if (avgMATTR !== null && avgCogDensity !== null) {
    const complexity = avgMATTR > 0.72 && avgCogDensity > 0.04 ? 'high'
      : avgMATTR < 0.62 || avgCogDensity < 0.02 ? 'low' : 'moderate';
    difficultyGuidance = `\n\nADAPTIVE DIFFICULTY (Bjork & Bjork 2011 — desirable difficulties):
Recent response complexity: ${complexity.toUpperCase()} (avg MATTR=${avgMATTR.toFixed(3)}, avg cognitive density=${(avgCogDensity * 100).toFixed(1)}%)
${complexity === 'high' ? '→ This person is producing complex, cognitively rich responses. Escalate: use more abstract questions, surface contradictions, ask them to reconcile opposing positions. They can handle it.' : complexity === 'low' ? '→ Recent responses show lower complexity. This could mean the questions are too abstract, the person is fatigued, or topics aren\'t landing. Try more concrete, personally anchored questions. "What specifically..." over "What does it mean to..."' : '→ Moderate complexity. Maintain current challenge level but vary the type — if recent questions have been introspective, try an evaluative or reconciliation question.'}`;
  }

  // --- THEME CONTEXT (Cepeda et al. 2006; Bjork & Bjork 2011) ---
  // Recent question themes for spaced repetition and interleaving guidance
  const recentQuestionTexts = recentResponses.map(r => `[${r.date}] ${r.question}`).join('\n');

  const systemPrompt = `You are Alice — a monastic, stubborn thinking journal. You are honest in the way a mirror is honest. You don't comfort. You don't perform. You reflect what's there with precision and without flinching.

Your job is to generate ONE question for tomorrow, plus two runner-up candidates. The question is the instrument — it determines what signal is measurable. Every question is an intervention in a single-case experiment.

=== QUESTION DESIGN PRINCIPLES ===

CORE CRITERIA:
- Unanswerable in one sentence
- About the person, not a topic
- No right answer
- Worth returning to months from now
- Targets something they're avoiding, circling, or haven't finished thinking about
- Does NOT repeat a question already asked
- KEEP IT SHORT. Under 15 words. One clause, one demand. The question should be syntactically simple but cognitively demanding — a short question that requires a long answer.

FRAMING:
- Use CAUSAL and EVALUATIVE framing. "Why" and "how do you reconcile" activate deeper processing than "describe" or "what do you think about."
- Use generative verbs: reconcile, examine, explore, confront, sit with. Avoid descriptive verbs: describe, list, identify, summarize.
- Create a DISCLOSURE CONTEXT — the person should feel they are revealing something, not recording something. "What are you protecting by not deciding?" > "What decision are you facing?"

SAFE CHALLENGE:
- Frame difficulty as invitation, not confrontation. "What might it look like to sit with..." > "Why do you keep avoiding..."
- Productive discomfort requires psychological safety. Challenge without triggering defensiveness. The person should feel the question is hard because it's honest, not because it's hostile.

INFORMATION GAIN:
- Select the question that maximizes INFORMATION GAIN — target dimensions where you are most UNCERTAIN about the person, not where they are most "interesting."
- Each question should make a specific behavioral or cognitive signal observable. If you can't say what behavioral signature this question should produce, it's too vague.

SPACED REPETITION & INTERLEAVING:
- Check the recent question history below. Do NOT cluster related themes. If the last 3 questions touched the same domain, break to a different one.
- Revisit themes at expanding intervals — a thread from 3 weeks ago is ripe for revisitation; one from yesterday is not.
- Re-ask themes as NEW questions, never as callbacks to prior answers. The person should reconstruct, not recall.

CONTEXTUAL ANCHORING:
- Reference themes and patterns from prior entries WITHOUT echoing the entries themselves. "You've been circling something" > "You wrote about X on Tuesday."
- Questions inviting temporal connection produce richer signal.

=== CONTEXT LAYERS ===

SOURCE OF TRUTH — Their actual words:
1. Recent entries (last ${RECENT_WINDOW}, verbatim)
2. Resonant older entries (retrieved by semantic similarity to recent themes)
3. Contrarian entries (deliberately DISSIMILAR to current themes — what you've been ignoring)

HYPOTHESIS LAYER — Your interpretations (may contain errors):
4. Recent reflections (your last few weekly pattern analyses)
5. Resurfaced older reflections (relevant again via semantic retrieval)
6. Recent observations (your nightly three-frame analyses)
7. Suppressed questions (things you've been wanting to ask)

If a reflection contradicts what you read in the raw entries, trust the entries.
Pay special attention to the contrarian entries — they represent threads you may be neglecting.

=== SIGNAL WEIGHTING ===

- Journal text is primary signal. What they said matters most.
- Behavioral data is secondary: deletion decomposition, P-burst metrics, keystroke dynamics, percentile context, 8D behavioral dynamics.
- Dynamics phase: "disrupted" = pattern broke, probe what changed. "shifting" = something evolving, follow the thread.
- Attractor force tells you which dimensions are rigid (snap back fast) vs malleable (shifts persist). Target malleable dimensions — they're where real change happens.
- Dimension coupling shows which behavioral dimensions influence each other. If a leader dimension is currently deviated, the follower will respond at the discovered lag.
- Calibration-relative deviations are more meaningful than raw percentiles.
- Life context tags (from calibration sessions) tell you what's happening in the person's life — 7 research-backed dimensions: sleep, physical state, emotional events, social quality, stress, exercise, routine. Use this to TIME questions appropriately. If life context shows disruption (poor sleep, high stress, pain), a concrete low-friction question may land better than an abstract one. If context shows stability, you have room for deeper challenge.
- A "no" on "did it land?" means that line of questioning missed.
- Prediction track record: theory confidence scores tell you which interpretations are reliable. Frame disambiguation questions historically produce more trajectory shifts.
${difficultyGuidance}

=== OUTPUT FORMAT ===

Generate exactly 3 candidate questions ranked by quality. The first is your selection.

For each candidate, provide: the question text, a theme tag, and which uncertainty dimension it targets.

SELECTED: [question text]
THEME: [1-3 word theme tag]
UNCERTAINTY: [what you're most uncertain about that this question would resolve]

RUNNER_UP_1: [question text]
THEME: [theme tag]

RUNNER_UP_2: [question text]
THEME: [theme tag]

INTENT: [TAG] — [brief rationale for selecting #1 over runners-up]

Tags: SUPPRESSED_PROMOTION | THEME_TARGETING | CONTRARIAN_BREAK | FRAME_DISAMBIGUATION | TRAJECTORY_PROBE | DEPTH_TEST`;

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

BEHAVIORAL DATA (enriched with research-backed metrics, for recent entries):
${behavioralSection}
${dynamicsSection ? `\n${dynamicsSection}` : ''}

${predictionSection}

${feedbackSection}
${lifeContextSection ? `\n${lifeContextSection}\n` : ''}
${deltaTrendSection ? `\n${deltaTrendSection}\n` : ''}
---

RECENT QUESTION HISTORY (for spaced repetition — avoid clustering themes):
${recentQuestionTexts}

---

Generate 3 candidate questions with your selection, theme tags, uncertainty dimension, and intervention intent.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const rawOutput = (message.content[0] as { type: 'text'; text: string }).text.trim();

  // Parse the structured output
  const selectedMatch = rawOutput.match(/SELECTED\s*:\s*(.+)/i);
  const themeMatch = rawOutput.match(/THEME\s*:\s*(.+)/i);
  const uncertaintyMatch = rawOutput.match(/UNCERTAINTY\s*:\s*(.+)/i);
  const runner1Match = rawOutput.match(/RUNNER_UP_1\s*:\s*(.+)/i);
  const runner1ThemeMatch = rawOutput.match(/RUNNER_UP_1\s*:.*\nTHEME\s*:\s*(.+)/i);
  const runner2Match = rawOutput.match(/RUNNER_UP_2\s*:\s*(.+)/i);
  const runner2ThemeMatch = rawOutput.match(/RUNNER_UP_2\s*:.*\nTHEME\s*:\s*(.+)/i);
  const intentMatch = rawOutput.match(/INTENT\s*:\s*(SUPPRESSED_PROMOTION|THEME_TARGETING|CONTRARIAN_BREAK|FRAME_DISAMBIGUATION|TRAJECTORY_PROBE|DEPTH_TEST)\s*[—\-]\s*(.*)/i);

  // Extract question text — prefer structured SELECTED: format, fall back to old format
  const questionText = selectedMatch
    ? selectedMatch[1].trim()
    : rawOutput.replace(/\n*(THEME|UNCERTAINTY|RUNNER_UP_\d|INTENT)\s*:.*/gis, '').trim();

  scheduleQuestion(questionText, tomorrowStr, 'generated');

  // Get the question ID we just scheduled
  const { default: db } = await import('./db.ts');
  const scheduledQ = db
    .prepare('SELECT question_id FROM tb_questions WHERE scheduled_for = ?')
    .get(tomorrowStr) as { question_id: number } | null;

  if (scheduledQ) {
    // Tag the question with intervention intent
    if (intentMatch) {
      const intentCode = intentMatch[1].toLowerCase();
      const rationale = intentMatch[2].trim();
      updateQuestionIntent(scheduledQ.question_id, intentCode, rationale);
    }

    // Save question candidates (Harrison et al. 2017)
    const candidates = [
      {
        candidateRank: 1,
        candidateText: questionText,
        selectionRationale: intentMatch ? intentMatch[2].trim() : null,
        uncertaintyDimension: uncertaintyMatch ? uncertaintyMatch[1].trim() : null,
        themeTags: themeMatch ? themeMatch[1].trim() : null,
      },
    ];
    if (runner1Match) {
      candidates.push({
        candidateRank: 2,
        candidateText: runner1Match[1].trim(),
        selectionRationale: null,
        uncertaintyDimension: null,
        themeTags: runner1ThemeMatch ? runner1ThemeMatch[1].trim() : null,
      });
    }
    if (runner2Match) {
      candidates.push({
        candidateRank: 3,
        candidateText: runner2Match[1].trim(),
        selectionRationale: null,
        uncertaintyDimension: null,
        themeTags: runner2ThemeMatch ? runner2ThemeMatch[1].trim() : null,
      });
    }
    saveQuestionCandidates(scheduledQ.question_id, candidates);
  }

  // Log what went into this prompt for future auditability
  savePromptTrace({
    type: 'generation',
    recentEntryIds: recentResponses.map(r => r.response_id),
    ragEntryIds: ragEntries.map(e => e.sourceRecordId),
    contrarianEntryIds: contrarianEntries.map(e => e.sourceRecordId),
    reflectionIds: [
      ...recentReflections.map(r => r.reflection_id),
      ...ragReflections.map(r => r.sourceRecordId),
    ],
    observationIds: recentObservations.map(o => o.ai_observation_id),
    tokenEstimate: message.usage?.input_tokens,
  });
}

/**
 * Format life-context tags for the generation prompt (compact form).
 */
function formatGenerateLifeContext(tags: Array<{
  questionId: number; sessionDate: string; dimension: string;
  value: string; detail: string | null; confidence: number;
}>): string {
  if (tags.length === 0) return '';

  // Group by date, show most recent first
  const byDate = new Map<string, Array<typeof tags[number]>>();
  for (const tag of tags) {
    const date = tag.sessionDate.split('T')[0] || tag.sessionDate;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(tag);
  }

  const lines: string[] = ['LIFE CONTEXT (from recent calibration sessions — observable facts):'];
  for (const [date, dateTags] of byDate) {
    const tagStrs = dateTags
      .filter(t => t.confidence >= 0.5)
      .map(t => `${t.dimension}=${t.value}`);
    if (tagStrs.length > 0) {
      lines.push(`[${date}] ${tagStrs.join(', ')}`);
    }
  }

  return lines.length > 1 ? lines.join('\n') : '';
}
