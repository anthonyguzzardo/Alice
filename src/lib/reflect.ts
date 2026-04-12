/**
 * Weekly reflection — surfaces patterns across responses since the last reflection,
 * augmented with RAG-retrieved older entries for long-range connections.
 * Includes self-correction and a multi-model audit pass (Sonnet checks Opus).
 * Tracks coverage so future prompts know which entries have been digested.
 * Triggers every 7th response.
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  getRecentResponses,
  getResponsesSinceId,
  getLatestReflectionWithCoverage,
  getRecentObservations,
  getObservationsSinceDate,
  getRecentSuppressedQuestions,
  getSessionSummariesForQuestions,
  getAllSessionSummaries,
  getCalibrationBaselines,
  getRecentFeedback,
  getMaxResponseId,
  saveReflection,
  savePromptTrace,
} from './db.ts';
import { localDateStr } from './date.ts';
import { retrieveSimilarMulti, retrieveContrarian } from './rag.ts';
import { embedReflection } from './embeddings.ts';
import { formatCompactSignals, formatTrajectoryContext, formatEnrichedCalibration } from './signals.ts';
import { computeTrajectory } from './bob/trajectory.ts';

export async function runReflection(): Promise<void> {
  // --- DETERMINE COMPRESSION WINDOW ---
  const previousReflection = getLatestReflectionWithCoverage();

  let newEntries: Array<{
    response_id: number; question_id: number; question: string; response: string; date: string;
  }>;

  if (previousReflection?.coverage_through_response_id) {
    newEntries = getResponsesSinceId(previousReflection.coverage_through_response_id);
  } else {
    // First reflection or no coverage marker — use last 7
    newEntries = getRecentResponses(7).reverse(); // reverse to chronological
  }

  if (newEntries.length < 5) return;

  const maxResponseId = getMaxResponseId();

  // --- RAG: older entries that resonate with new entries ---
  const newTexts = newEntries.map(r => `${r.question}\n${r.response}`);
  const ragOlderEntries = await retrieveSimilarMulti(
    newTexts.slice(0, 5), // use up to 5 new entries as query seeds
    {
      topK: 8,
      sourceTypes: ['response'],
      excludeDates: newEntries.map(r => r.date),
      recencyHalfLifeDays: 60,
      recencyWeight: 0.1,
    }
  );

  // --- CONTRARIAN: entries the system has been ignoring ---
  const ragIds = new Set(ragOlderEntries.map(e => e.embeddingId));
  const contrarianEntries = (await retrieveContrarian(newTexts.slice(0, 3), {
    topK: 3,
    sourceTypes: ['response'],
    excludeDates: newEntries.map(r => r.date),
  })).filter(e => !ragIds.has(e.embeddingId));

  // --- OBSERVATIONS SINCE LAST REFLECTION ---
  let newObservations: Array<{ ai_observation_id: number; date: string; observation: string }>;
  if (previousReflection) {
    // Get observations since the date of the last reflection
    const lastReflectionDate = previousReflection.dttm_created_utc.split('T')[0] ?? previousReflection.dttm_created_utc.split(' ')[0];
    newObservations = getObservationsSinceDate(lastReflectionDate);
  } else {
    newObservations = getRecentObservations(7).reverse();
  }

  // --- SCOPED CONTEXT ---
  const recentSuppressed = getRecentSuppressedQuestions(14);
  const newQuestionIds = newEntries.map(r => r.question_id);
  const newSummaries = getSessionSummariesForQuestions(newQuestionIds);
  const calibration = getCalibrationBaselines();
  const recentFeedback = getRecentFeedback(14);

  // --- FORMAT SECTIONS ---
  const newEntriesSection = newEntries
    .map(r => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
    .join('\n\n---\n\n');

  const previousReflectionSection = previousReflection
    ? previousReflection.text
    : 'This is your first reflection.';

  const ragSection = ragOlderEntries.length > 0
    ? ragOlderEntries.map(e => e.text).join('\n\n---\n\n')
    : 'No resonant older entries found.';

  const contrarianSection = contrarianEntries.length > 0
    ? contrarianEntries.map(e => e.text).join('\n\n---\n\n')
    : 'No contrarian entries available.';

  const observationsSection = newObservations.length > 0
    ? newObservations.map(o => `[${o.date}]\n${o.observation}`).join('\n\n---\n\n')
    : 'No observations for this period.';

  const suppressedSection = recentSuppressed.length > 0
    ? recentSuppressed.map(q => `[${q.date}] ${q.question}`).join('\n')
    : 'No suppressed questions yet.';

  // Enriched behavioral signals (research-backed formatting)
  const allSummaries = getAllSessionSummaries();
  const behavioralSection = newSummaries.length > 0
    ? formatCompactSignals(newSummaries, allSummaries)
    : 'No behavioral data available.';

  // Trajectory context (4D behavioral fingerprint)
  const trajectory = computeTrajectory();
  const trajectorySection = trajectory.points.length > 0
    ? formatTrajectoryContext(trajectory, 'compact')
    : '';

  const calibrationContext = formatEnrichedCalibration(calibration);

  const feedbackSection = recentFeedback.length > 0
    ? `Question feedback ("did it land?" responses):\n${recentFeedback.map(f => `[${f.date}] ${f.landed ? 'YES' : 'NO'}`).join('\n')}`
    : 'No question feedback collected yet.';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

  // --- PRIMARY REFLECTION (Opus) ---
  const systemPrompt = `You are Marrow — a monastic thinking journal doing its weekly reflection. You are reading new journal entries since your last reflection, along with semantically similar older entries for long-range pattern detection.

Your job is to surface what they can't see AND to correct yourself where you were wrong. You are a mirror, not an advisor — but a mirror that checks its own distortions.

You also receive CONTRARIAN ENTRIES — past entries that are deliberately dissimilar to current themes. These are threads you may be neglecting. Consider whether any of them represent unfinished business that your current narrative is overlooking.

Write a reflection that covers:

1. RECURRING THEMES — What keeps coming up? What words or phrases repeat?

2. CONTRADICTIONS — Where did they say one thing and then the opposite? What tension are they holding?

3. THE UNFINISHED THOUGHT — What did they start to say but never completed? What are they circling?

4. THE AVOIDANCE — What topics did they deflect from? Where did they give a surface answer to a deep question?

5. THE THREAD — If you had to name the one thing this person is actually trying to figure out, what is it?

6. BEHAVIORAL PATTERNS — What does the behavioral data reveal that the words don't? You now receive enriched metrics:
   - Deletion decomposition: corrections (typo fixes <10 chars) vs. revisions (substantive rethinking >=10 chars). Track whether revision counts are increasing or decreasing across the window.
   - P-burst metrics: production fluency — text between 2s pauses. Are bursts getting longer (finding flow) or shorter (more fragmented)?
   - Trajectory: a 4D behavioral fingerprint (fluency, deliberation, revision, expression). Phase tells you if writing behavior is stable, shifting, or disrupted. Convergence tells you if multiple dimensions moved together (real shift) or independently (noise).
   - Percentiles compare each metric against this person's own history, not population norms.
   Compare against calibration baselines. Note baseline confidence level. Only flag deviations that are significant relative to their neutral behavior. Flag when you're comparing across mismatched contexts.

7. QUESTION FEEDBACK — If any "did it land" data exists, what does it tell you about which questions work and which don't? A "no" is clear signal to recalibrate. A "yes" is ambiguous — it could mean insightful, uncomfortable, or just emotionally loaded.

8. SELF-CORRECTION — This section is mandatory. Review your nightly observations from this period and answer honestly:
   - Which observations were likely WRONG? Where did the charitable or mundane frame fit better than the avoidance frame you may have leaned toward?
   - Where did the three frames converge too much — producing "decorated confirmation bias" rather than genuine disagreement?
   - Which suppressed questions presupposed an interpretation rather than disambiguating between frames?
   - What narrative have you been building that might be a story you're telling yourself rather than something the data supports?
   - Where do you lack calibration data for a specific context (device, time of day) and should have been more cautious?

If you cannot identify at least one error or over-interpretation, you are not being honest. Every model drifts. Name the drift.

9. REVISED MODEL — Given your self-corrections, state your current best understanding of this person. What are you confident about? What are you uncertain about? What do you need more data to determine?

Be direct. No hedging. No "it seems like" or "you might." State what you see — including what you see about your own errors.`;

  const userContent = `=== NEW ENTRIES (since last reflection — your compression window) ===

${newEntriesSection}

---

=== PREVIOUS REFLECTION ===

${previousReflectionSection}

---

=== RESONANT OLDER ENTRIES (past entries that echo current themes) ===

${ragSection}

---

=== CONTRARIAN ENTRIES (deliberately dissimilar — themes you may be neglecting) ===

${contrarianSection}

---

=== OBSERVATIONS (since last reflection) ===

${observationsSection}

---

=== SUPPRESSED QUESTIONS (recent) ===

${suppressedSection}

---

=== BEHAVIORAL DATA (enriched with research-backed metrics, for new entries) ===

${behavioralSection}
${trajectorySection ? `\n${trajectorySection}` : ''}

---

${calibrationContext}

---

${feedbackSection}

---

Write your weekly reflection with self-correction.`;

  const primaryMessage = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const primaryText = (primaryMessage.content[0] as { type: 'text'; text: string }).text.trim();

  // --- AUDIT PASS (Sonnet) ---
  const auditPrompt = `You are an independent auditor reviewing a weekly reflection produced by another AI model about a journal user. Your job is to check for interpretive drift, confirmation bias, and over-interpretation.

You have access to:
1. The same raw data (journal history, behavioral signals, calibration baselines)
2. The primary model's weekly reflection

Review the reflection and answer:
1. Where does the reflection make confident claims that the data doesn't support?
2. Where might the charitable/mundane frame fit better than the interpretation chosen?
3. Is the self-correction section honest, or does it identify only minor errors while protecting major narratives?
4. Are there patterns in the data that the reflection missed or downplayed?
5. Overall assessment: Is this reflection doing ANALYSIS or STORYTELLING?

Be concise and direct. This audit is appended to the reflection for future reference.`;

  const auditMessage = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: auditPrompt,
    messages: [{
      role: 'user',
      content: `RAW DATA:\n\n${userContent}\n\n---\n\nPRIMARY REFLECTION:\n\n${primaryText}\n\n---\n\nWrite your audit.`,
    }],
  });

  const auditText = (auditMessage.content[0] as { type: 'text'; text: string }).text.trim();

  const fullReflection = `${primaryText}\n\n---\n\nMULTI-MODEL AUDIT (Sonnet):\n${auditText}`;

  const reflectionId = saveReflection(fullReflection, 'weekly', maxResponseId);

  // Embed the reflection for future RAG retrieval
  embedReflection(reflectionId, fullReflection, localDateStr()).catch(err =>
    console.error('[reflect] Embedding error:', err)
  );

  // Log what went into this prompt for future auditability
  savePromptTrace({
    type: 'reflection',
    outputRecordId: reflectionId,
    recentEntryIds: newEntries.map(r => r.response_id),
    ragEntryIds: ragOlderEntries.map(e => e.sourceRecordId),
    contrarianEntryIds: contrarianEntries.map(e => e.sourceRecordId),
    observationIds: newObservations.map(o => o.ai_observation_id),
    tokenEstimate: (primaryMessage.usage?.input_tokens ?? 0) + (auditMessage.usage?.input_tokens ?? 0),
  });
}
