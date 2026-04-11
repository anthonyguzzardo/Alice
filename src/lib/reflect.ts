/**
 * Weekly reflection — surfaces patterns across all responses, behavioral data,
 * and AI observations. Includes self-correction: the AI must review its own
 * prior observations and identify where it was wrong or over-interpreted.
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
} from './db.ts';

export async function runReflection(): Promise<void> {
  const responses = getAllResponses();
  if (responses.length < 5) return;

  const summaries = getAllSessionSummaries();
  const observations = getAllAiObservations();
  const suppressedQuestions = getAllSuppressedQuestions();
  const calibration = getCalibrationBaselines();

  const journalHistory = responses
    .map((r) => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
    .join('\n\n---\n\n');

  const behavioralHistory = summaries
    .map((s) => `[${s.date}] keystroke_latency=${s.firstKeystrokeMs}ms duration=${s.totalDurationMs}ms commitment=${s.commitmentRatio?.toFixed(2)} pauses=${s.pauseCount} deletions=${s.deletionCount} largest_deletion=${s.largestDeletion} chars_deleted=${s.totalCharsDeleted} tab_aways=${s.tabAwayCount} words=${s.wordCount}`)
    .join('\n');

  const observationHistory = observations
    .map((o) => `[${o.date}]\n${o.observation}`)
    .join('\n\n---\n\n');

  const suppressedHistory = suppressedQuestions
    .map((q) => `[${q.date}] ${q.question}`)
    .join('\n');

  const calibrationContext = calibration.sessionCount > 0
    ? `Calibration baselines (from ${calibration.sessionCount} neutral questions):
- Avg first keystroke: ${calibration.avgFirstKeystrokeMs?.toFixed(0)}ms
- Avg commitment ratio: ${calibration.avgCommitmentRatio?.toFixed(2)}
- Avg session duration: ${calibration.avgDurationMs?.toFixed(0)}ms
- Avg pause count: ${calibration.avgPauseCount?.toFixed(1)}
- Avg deletion count: ${calibration.avgDeletionCount?.toFixed(1)}`
    : 'No calibration baselines available yet.';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

  const systemPrompt = `You are Marrow — a monastic thinking journal doing its weekly reflection. You are reading the entire journal of one person. You also have access to their behavioral signal, your own prior nightly observations, and calibration baselines from neutral questions.

Your job is to surface what they can't see AND to correct yourself where you were wrong. You are a mirror, not an advisor — but a mirror that checks its own distortions.

Write a reflection that covers:

1. RECURRING THEMES — What keeps coming up? What words or phrases repeat?

2. CONTRADICTIONS — Where did they say one thing and then the opposite? What tension are they holding?

3. THE UNFINISHED THOUGHT — What did they start to say but never completed? What are they circling?

4. THE AVOIDANCE — What topics did they deflect from? Where did they give a surface answer to a deep question?

5. THE THREAD — If you had to name the one thing this person is actually trying to figure out, what is it?

6. BEHAVIORAL PATTERNS — What does the behavioral data reveal that the words don't? Compare against calibration baselines where available. Only flag deviations that are significant relative to their neutral behavior. A metric that matches their calibration baseline is NOT signal, even if it looks dramatic in isolation.

7. SELF-CORRECTION — This section is mandatory. Review your nightly observations from this period and answer honestly:
   - Which observations were likely WRONG? Where did you over-interpret a behavior that was probably mundane (distraction, typo, device issue, careful editing)?
   - Which interpretations had multiple plausible readings where you picked the most dramatic one? Reassess now with more data.
   - Which suppressed questions were based on a flawed read? Should any threads be DROPPED rather than pursued?
   - Where did you see a pattern that subsequent data has contradicted?
   - What narrative have you been building that might be a story you're telling yourself rather than something the data supports?

If you cannot identify at least one error or over-interpretation, you are not being honest. Every model drifts. Name the drift.

8. REVISED MODEL — Given your self-corrections, state your current best understanding of this person. What are you confident about? What are you uncertain about? What do you need more data to determine?

Be direct. No hedging. No "it seems like" or "you might." State what you see — including what you see about your own errors.

This reflection will be used to generate future questions and feed Einstein — it is not shown to the user directly.`;

  const userContent = `Full journal history:

${journalHistory}

---

Behavioral signal history:
${behavioralHistory || 'No behavioral data available yet.'}

---

${calibrationContext}

---

Nightly AI observations:
${observationHistory || 'No observations yet.'}

---

Suppressed questions trajectory:
${suppressedHistory || 'No suppressed questions yet.'}

---

Write your weekly reflection with self-correction.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const reflectionText = (message.content[0] as { type: 'text'; text: string }).text.trim();
  saveReflection(reflectionText, 'weekly');
}
