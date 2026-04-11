/**
 * Weekly reflection — surfaces patterns across all responses, behavioral data,
 * and AI observations. Includes self-correction and a multi-model audit pass
 * using Sonnet to check Opus's interpretations for convergence or divergence.
 * Triggers every 7th response.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  getAllResponses,
  saveReflection,
  getAllSessionSummaries,
  getAllAiObservations,
  getAllSuppressedQuestions,
  getCalibrationBaselines,
  getAllQuestionFeedback,
} from './db.ts';

export async function runReflection(): Promise<void> {
  const responses = getAllResponses();
  if (responses.length < 5) return;

  const summaries = getAllSessionSummaries();
  const observations = getAllAiObservations();
  const suppressedQuestions = getAllSuppressedQuestions();
  const calibration = getCalibrationBaselines();
  const feedback = getAllQuestionFeedback();

  const journalHistory = responses
    .map((r) => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
    .join('\n\n---\n\n');

  const behavioralHistory = summaries
    .map((s) => `[${s.date}] device=${s.deviceType || '?'} hour=${s.hourOfDay ?? '?'} keystroke_latency=${s.firstKeystrokeMs}ms duration=${s.totalDurationMs}ms commitment=${s.commitmentRatio?.toFixed(2)} pauses=${s.pauseCount} deletions=${s.deletionCount} largest_deletion=${s.largestDeletion} chars_deleted=${s.totalCharsDeleted} tab_aways=${s.tabAwayCount} words=${s.wordCount}`)
    .join('\n');

  const observationHistory = observations
    .map((o) => `[${o.date}]\n${o.observation}`)
    .join('\n\n---\n\n');

  const suppressedHistory = suppressedQuestions
    .map((q) => `[${q.date}] ${q.question}`)
    .join('\n');

  const calibrationContext = calibration.sessionCount > 0
    ? `Calibration baselines (confidence: ${calibration.confidence}, from ${calibration.sessionCount} sessions):
- Avg first keystroke: ${calibration.avgFirstKeystrokeMs?.toFixed(0)}ms
- Avg commitment ratio: ${calibration.avgCommitmentRatio?.toFixed(2)}
- Avg session duration: ${calibration.avgDurationMs?.toFixed(0)}ms
- Avg pause count: ${calibration.avgPauseCount?.toFixed(1)}
- Avg deletion count: ${calibration.avgDeletionCount?.toFixed(1)}`
    : 'No calibration baselines available yet.';

  const feedbackContext = feedback.length > 0
    ? `Question feedback ("did it land?" responses):\n${feedback.map((f) => `[${f.date}] ${f.landed ? 'YES' : 'NO'}`).join('\n')}`
    : 'No question feedback collected yet.';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

  // --- PRIMARY REFLECTION (Opus) ---
  const systemPrompt = `You are Marrow — a monastic thinking journal doing its weekly reflection. You are reading the entire journal of one person. You also have access to their behavioral signal, your own prior nightly observations (which use three interpretive frames: charitable, avoidance, mundane), calibration baselines, and question feedback.

Your job is to surface what they can't see AND to correct yourself where you were wrong. You are a mirror, not an advisor — but a mirror that checks its own distortions.

Write a reflection that covers:

1. RECURRING THEMES — What keeps coming up? What words or phrases repeat?

2. CONTRADICTIONS — Where did they say one thing and then the opposite? What tension are they holding?

3. THE UNFINISHED THOUGHT — What did they start to say but never completed? What are they circling?

4. THE AVOIDANCE — What topics did they deflect from? Where did they give a surface answer to a deep question?

5. THE THREAD — If you had to name the one thing this person is actually trying to figure out, what is it?

6. BEHAVIORAL PATTERNS — What does the behavioral data reveal that the words don't? Compare against calibration baselines. Note baseline confidence level. Only flag deviations that are significant relative to their neutral behavior on the same device type and similar time of day. Flag when you're comparing across mismatched contexts.

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

  const userContent = `Full journal history:

${journalHistory}

---

Behavioral signal history:
${behavioralHistory || 'No behavioral data available yet.'}

---

${calibrationContext}

---

${feedbackContext}

---

Nightly AI observations:
${observationHistory || 'No observations yet.'}

---

Suppressed questions trajectory:
${suppressedHistory || 'No suppressed questions yet.'}

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

  saveReflection(fullReflection, 'weekly');
}
