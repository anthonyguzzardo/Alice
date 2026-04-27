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
  getRecentFeedback,
  getSessionSummariesForQuestions,
  getAllSessionSummaries,
  getAllReflections,
  scheduleQuestion,
  hasQuestionForDate,
  getResponseCount,
  savePromptTrace,
  getRecentCalibrationContext,
  getRecentSessionDeltas,
} from './libDb.ts';
import { localDateStr } from './utlDate.ts';
import { retrieveSimilarMulti, retrieveContrarian } from './libRag.ts';
import {
  formatCompactSignals, formatDynamicsContext,
} from './libSignals.ts';
import { computeEntryStates } from './libAliceNegative/libStateEngine.ts';
import { computeDynamics } from './libAliceNegative/libDynamics.ts';
import { computeMATTR } from './libAliceNegative/libHelpers.ts';
import { formatCompactDelta } from './libDailyDelta.ts';

const SEED_DAYS = 30;
const RECENT_WINDOW = 14;

/** Timing info emitted per API call */
export interface ApiCallInfo {
  phase: string;
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

/** Options for generation pipeline — all optional, production uses defaults */
export interface GenerationOptions {
  model?: string;
  seedDaysOverride?: number;
  onApiCall?: (info: ApiCallInfo) => void;
}

export async function runGeneration(subjectId: number, options?: GenerationOptions): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDateStr(tomorrow);

  if (await hasQuestionForDate(subjectId, tomorrowStr)) return;

  const responseCount = await getResponseCount(subjectId);
  const seedThreshold = options?.seedDaysOverride ?? SEED_DAYS;
  if (responseCount < seedThreshold) return;

  // --- RECENT RAW ENTRIES (always included verbatim) ---
  const recentResponses = await getRecentResponses(subjectId, RECENT_WINDOW);

  // --- REFLECTIONS: recent in full, older only if RAG resurfaces them ---
  const allReflections = await getAllReflections(subjectId);
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

  const ragEntries = await retrieveSimilarMulti(subjectId, querySeeds, {
    topK: 10,
    sourceTypes: ['response'],
    excludeDates: Array.from(recentDates),
    recencyHalfLifeDays: 45,
    recencyWeight: 0.15,
  });

  // --- CONTRARIAN: entries that break the echo chamber ---
  const ragIds = new Set(ragEntries.map(e => e.embeddingId));
  const contrarianEntries = (await retrieveContrarian(subjectId, querySeeds, {
    topK: 3,
    sourceTypes: ['response'],
    excludeDates: Array.from(recentDates),
  })).filter(e => !ragIds.has(e.embeddingId)); // no overlap with RAG results

  // --- RAG: older reflections that resonate with current moment ---
  const recentReflectionIds = new Set(recentReflections.map(r => r.reflection_id));
  const ragReflections = allReflections.length > RECENT_REFLECTIONS
    ? (await retrieveSimilarMulti(subjectId, querySeeds.slice(0, 2), {
        topK: 3,
        sourceTypes: ['reflection'],
        recencyHalfLifeDays: 90,
        recencyWeight: 0.05,
      })).filter(e => !recentReflectionIds.has(e.sourceRecordId))
    : [];

  // --- SCOPED CONTEXT ---
  // Observations + suppressed questions archived 2026-04-16 — no longer included.
  const recentFeedback = await getRecentFeedback(subjectId, 10);
  const recentQuestionIds = recentResponses.map(r => r.question_id);
  const recentSummaries = await getSessionSummariesForQuestions(subjectId, recentQuestionIds);

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

  // Enriched behavioral signals (research-backed formatting)
  const allSummaries = await getAllSessionSummaries(subjectId);
  const behavioralSection = recentSummaries.length > 0
    ? formatCompactSignals(recentSummaries, allSummaries)
    : 'No behavioral data available.';

  // Dynamics context (8D PersDyn behavioral dynamics)
  const entryStates = await computeEntryStates(subjectId);
  const dynamics = computeDynamics(entryStates);
  const dynamicsSection = dynamics.entryCount > 0
    ? formatDynamicsContext(dynamics, 'compact')
    : '';

  // Life-context from recent calibration extractions
  const recentLifeContext = await getRecentCalibrationContext(subjectId, 20);
  const lifeContextSection = recentLifeContext.length > 0
    ? formatGenerateLifeContext(recentLifeContext)
    : '';

  // Daily delta trends (retrospective calibration vs journal shifts)
  const recentDeltas = await getRecentSessionDeltas(subjectId, 14);
  const deltaTrendSection = recentDeltas.length > 0
    ? formatCompactDelta(recentDeltas)
    : '';

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
  let difficultyLevel: string | null = null;
  if (avgMATTR !== null && avgCogDensity !== null) {
    const complexity = avgMATTR > 0.72 && avgCogDensity > 0.04 ? 'high'
      : avgMATTR < 0.62 || avgCogDensity < 0.02 ? 'low' : 'moderate';
    difficultyLevel = complexity;
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

If a reflection contradicts what you read in the raw entries, trust the entries.
Pay special attention to the contrarian entries — they represent threads you may be neglecting.

=== SIGNAL WEIGHTING ===

- Journal text is primary signal. What they said matters most.
- Behavioral data is secondary: deletion decomposition, P-burst metrics, keystroke dynamics, percentile context, 7D behavioral + semantic dynamics.
- Dynamics phase: "disrupted" = pattern broke, probe what changed. "shifting" = something evolving, follow the thread.
- Attractor force tells you which dimensions are rigid (snap back fast) vs malleable (shifts persist). Target malleable dimensions — they're where real change happens.
- Dimension coupling shows which behavioral dimensions influence each other. If a leader dimension is currently deviated, the follower will respond at the discovered lag.
- Calibration-relative deviations are more meaningful than raw percentiles.
- Life context tags (from calibration sessions) tell you what's happening in the person's life — 7 research-backed dimensions: sleep, physical state, emotional events, social quality, stress, exercise, routine. Use this to TIME questions appropriately. If life context shows disruption (poor sleep, high stress, pain), a concrete low-friction question may land better than an abstract one. If context shows stability, you have room for deeper challenge.
- A "no" on "did it land?" means that line of questioning missed.
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
THEME: [theme tag]`;

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

=== SIGNAL DATA ===

BEHAVIORAL DATA (enriched with research-backed metrics, for recent entries):
${behavioralSection}
${dynamicsSection ? `\n${dynamicsSection}` : ''}

${feedbackSection}
${lifeContextSection ? `\n${lifeContextSection}\n` : ''}
${deltaTrendSection ? `\n${deltaTrendSection}\n` : ''}
---

RECENT QUESTION HISTORY (for spaced repetition — avoid clustering themes):
${recentQuestionTexts}

---

Generate 3 candidate questions with your selection, theme tags, and uncertainty dimension.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const generateModel = options?.model ?? 'claude-sonnet-4-20250514';
  const onApiCall = options?.onApiCall;

  const generateStart = performance.now();
  const message = await client.messages.create({
    model: generateModel,
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });
  const generateDurationMs = Math.round(performance.now() - generateStart);

  if (onApiCall) {
    onApiCall({
      phase: 'generate',
      model: generateModel,
      durationMs: generateDurationMs,
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
    });
  }

  const rawOutput = (message.content[0] as { type: 'text'; text: string }).text.trim();

  // Extract question text — prefer structured SELECTED: format, fall back to old format
  const selectedMatch = rawOutput.match(/SELECTED\s*:\s*(.+)/i);
  const questionText = selectedMatch
    ? selectedMatch[1].trim()
    : rawOutput.replace(/\n*(THEME|UNCERTAINTY|RUNNER_UP_\d)\s*:.*/gis, '').trim();

  await scheduleQuestion(subjectId, questionText, tomorrowStr, 'generated');

  // Log what went into this prompt for future auditability
  await savePromptTrace({
    subjectId,
    type: 'generation',
    recentEntryIds: recentResponses.map(r => r.response_id),
    ragEntryIds: ragEntries.map(e => e.sourceRecordId),
    contrarianEntryIds: contrarianEntries.map(e => e.sourceRecordId),
    reflectionIds: [
      ...recentReflections.map(r => r.reflection_id),
      ...ragReflections.map(r => r.sourceRecordId),
    ],
    observationIds: [],
    tokenEstimate: message.usage?.input_tokens,
    difficultyLevel,
    difficultyInputs: avgMATTR !== null && avgCogDensity !== null
      ? { avgMATTR, avgCogDensity }
      : null,
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
