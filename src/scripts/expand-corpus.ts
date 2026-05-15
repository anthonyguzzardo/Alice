/**
 * Generate candidate questions for the shared corpus.
 *
 * Calls Claude with the full active corpus as anti-duplication context,
 * writes N candidates to data/corpus-candidates-YYYY-MM-DD.md for owner review.
 * Does NOT write to the database. Use approve-corpus.ts after review.
 *
 * Run: npx tsx src/scripts/expand-corpus.ts [--count N]
 */

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { getCorpusQuestions } from '../lib/libDb.ts';

const DEFAULT_COUNT = 30;

function parseCount(): number {
  const idx = process.argv.indexOf('--count');
  if (idx === -1 || idx + 1 >= process.argv.length) return DEFAULT_COUNT;
  // bounds-checked above; argv[idx+1] exists.
  const n = parseInt(process.argv[idx + 1]!, 10);
  if (isNaN(n) || n < 1 || n > 50) {
    console.error('--count must be between 1 and 50');
    process.exit(1);
  }
  return n;
}

async function main(): Promise<void> {
  const count = parseCount();

  // Load full active corpus for anti-duplication
  const corpus = (await getCorpusQuestions()).filter(q => !q.is_retired);
  console.log(`Active corpus: ${corpus.length} questions`);
  console.log(`Generating ${count} candidates...`);

  const numberedCorpus = corpus
    .map((q, i) => `${i + 1}. ${q.text}`)
    .join('\n');

  const systemPrompt = `You are a question author for Alice, a monastic daily thinking journal. Your job is to write candidate questions that will be added to the shared question corpus.

=== EXISTING CORPUS (${corpus.length} questions) ===
${numberedCorpus}

=== THE PRIMARY TEST ===

The shortest honest answer must be a paragraph. If a noun phrase or single sentence feels complete, the question failed — both as a provocation (the answerer doesn't think) and as a measurement substrate (the signal pipeline needs sustained keystroke data; short sessions produce no measurement).

Before writing each question, mentally answer it with the laziest plausible response. If that response is a noun phrase ("Self-image." "My job." "Telling X I'm leaving.") or a single short sentence and feels structurally complete, the question is broken. Rework it.

=== HOW SHAPE REFUSES CLOSURE ===

Use one of these structures. Mix across the batch.

A. Narrative anchor. Force a concrete past episode the answerer must reconstruct.
   "Describe the last week you felt busiest. What were you not doing during it that you'd otherwise have to face?"

B. Comparison / contradiction. Force articulation of two sides.
   "What's the difference between what you say you value and how you actually spend your time?"

C. Two-part with second clause forcing argument.
   "If your life had a thesis statement, what would it be? Do you like it?"
   "Who do you become when you're scared? Is that who you want to be?"

D. Forecast + evidence. Predict own future behavior, then justify the prediction.
   "Pick one thing you'd commit to for a year. Would you stay committed, or lose interest? What makes you think so?"

E. Open consequence clause. Ask for what would change / what would be lost.
   "What decision are you quietly avoiding? Describe what making it would actually look like."

=== THE SECOND-CLAUSE RULE (LOAD-BEARING) ===

When you add a second clause to force elaboration, that clause must OPEN the space, never NARROW it.

OPEN clauses (good): ask for consequence, imagined scene, specific obstacle, evidence, or contrast.
- "...and what would change if you let yourself want it openly?"
- "...describe what stops you from having it."
- "...what makes you think so?"

NARROWING clauses (forbidden): smuggle a presupposed psychology, telling the answerer what frame to use.
- "...what does the avoidance let you keep believing about yourself?" (assumes self-deception)
- "...the version of yourself you're trying to outgrow." (assumes outgrowing)
- "...what does the performance protect?" (assumes defensiveness)
- "...what makes circling more bearable than committing?" (assumes anxiety-escape)

The first clause poses the probe. The second clause clears space for the answer; it does not interpret on the answerer's behalf. Words like "protect," "outgrow," "what does this let you avoid," "what version of yourself," "what does this defend against" are red flags — they do interpretive work the answerer should do.

=== META QUESTIONS ARE FORBIDDEN ===

Alice is a measurement instrument. The instrument never asks the subject to evaluate the instrument, comment on the journaling experience, or revisit prior responses. Meta questions break that frame: they invite gamification, they violate the no-surface-responses discipline, and they elicit a different cognitive register (reviewing/critiquing) than the one the signal pipeline is calibrated for.

These have been retired from the corpus and must not be regenerated:
- "What question should Alice have asked you that it didn't?"
- "Go back and read your first response. What do you notice?"

Detectors. Reject any candidate that:
- names "Alice", "this journal", "the system", or "this app"
- asks the subject to look back at, re-read, or react to a previous answer
- asks the subject to grade, suggest, critique, or improve the question stream itself
- asks the subject to predict what Alice will / should do next

The instrument is invisible to the subject. Keep it that way.

=== DISTINCT FROM EVERY EXISTING QUESTION (LOAD-BEARING) ===

Two questions are too close when an honest answerer would write substantially the same response to both. This bar is much stricter than "not a verbatim copy". The check is at the answer level, not the wording level. Mentally answer the candidate AND every neighbor in the existing corpus; if the same disclosure satisfies both, the candidate is a paraphrase and must be rewritten or dropped.

Real failures from past corpus drafts (do not repeat the pattern):

- "Where are you performing competence instead of becoming competent?" vs existing "Where are you performing competence instead of actually learning?"
   → identical first clause, second clause is a synonym swap; same answer.
- "What are you pretending isn't bothering you, and what's the cost of continuing to pretend?" vs existing "What are you pretending isn't bothering you right now?"
   → second clause is a follow-up to the same disclosure, not a new question.
- "What's something you do when you're alone that you wouldn't do if someone were watching?" vs existing "What would you do if you knew nobody was watching?"
   → hypothetical-vs-observational restatement of the same probe.
- "What would you have to admit about your current situation that you've been avoiding admitting?" vs existing "What are you pretending isn't bothering you right now?"
   → "pretending" and "avoiding admitting" name the same act; same answer.

Heuristic: scan the existing corpus by THEME (pretending, performing, observed-behavior, peak-experience, etc). If your candidate lands in a theme that is already represented, you must show how the answer set is non-overlapping, not just how the words differ.

=== OTHER CRITERIA ===

- ABOUT THE PERSON, NOT A TOPIC. "What are you avoiding?" not "What is avoidance?"
- NO RIGHT ANSWER. The person is thinking, not performing.
- WORTH RETURNING TO. The answer today differs from three months from now.
- TIME-BOUND CHECKPOINTS ARE A TIC. "By day five," "in month eight," "by Friday," "this week" — fine to use ONCE in a corpus, not per question. Default to no timestamp.
- AVOID THERAPY-SPEAK ("how does that make you feel," "inner child"), FORTUNE-COOKIE FRAMING ("what would you do if you couldn't fail"), AND ABSTRACT TOPIC QUESTIONS ("what is the nature of becoming").
- BEWARE THE TOPIC QUESTION IN A DISCLOSURE COSTUME. The question "What would it mean to stop optimizing and start choosing?" sounds personal because of the verbs, but it's a definitional question that requires the answerer to first accept a philosophical premise (optimizing vs choosing as opposed modes) and then perform within it. Detector: if the answerer must accept your framing before they can answer, it's a topic question — cut it. Personal questions probe what is, not what would-it-mean.

=== DIVERSITY ===

Vary domain across the batch: identity, relationships, work, fear, desire, time, meaning, contradiction, growth, loss, action, decision, and the external world as it relates to the person. Don't cluster around introspection — some questions should probe action and external commitments.

=== WORKED EXAMPLES OF FAILURE → FIX ===

BAD: "What are you protecting by staying busy?"
WHY: noun-phrase answer ("self-image"); also "protecting" presupposes defensiveness.
FIXED: "Describe the last week you felt busiest. What were you not doing during it that you'd otherwise have to face?"

BAD: "What would you do if you knew nobody was watching?"
WHY: noun-phrase answer ("write").
FIXED: "Describe how your day would change if no one were watching. Where would the changes be largest? What would surprisingly stay the same?"

BAD: "If you could only do one thing for the next year, what would it be?"
WHY: noun-phrase answer ("build the company").
FIXED: "Pick one thing you'd commit to for a year. Would you stay committed, or lose interest? What makes you think so?"

BAD: "What would it mean to stop optimizing and start choosing? Describe where the difference would actually show up."
WHY: definitional / abstract / presupposed worldview. "What would it mean to..." asks for a definition, not a disclosure. The answerer has to first accept that "optimizing" and "choosing" are opposed modes before they can answer — it's seminar bait wearing a disclosure costume. Adding a second clause ("describe where the difference would show up") doesn't fix it because the difference is the question's own premise; the structure is circular.
FIXED: "Describe a recent decision you made on autopilot. If you had paused and actually chosen, what would have been different?"
FIX PATTERN: replace abstract definitional with concrete past-episode + counterfactual. The episode forces narrative grounding; the counterfactual forces honesty about what was actually being skipped.

=== CANONICAL GOOD EXAMPLES ===

These are confirmed-passing questions from the seed list. Use them as positive grounding for the shape and tone you're aiming for. Notice that none of them require the answerer to accept a frame before answering.

- "When was the last time you changed your mind about something that mattered?"
- "What's the difference between what you say you value and how you actually spend your time?"
- "When do you feel most like yourself? What's different about those moments?"
- "What's the story you tell yourself about why things haven't worked out the way you wanted?"
- "What would it look like to take yourself seriously?"
- "If your life had a thesis statement, what would it be? Do you like it?"
- "Who do you become when you're scared? Is that who you want to be?"
- "Describe a recent decision you made on autopilot. If you had paused and actually chosen, what would have been different?"`;

  const userPrompt = `Generate exactly ${count} candidate questions for the corpus.

Output format: one question per line, no numbering, no commentary, no blank lines. Just the questions.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = (message.content[0] as { type: 'text'; text: string }).text.trim();
  const candidates = raw.split('\n').map(l => l.trim()).filter(Boolean);

  if (candidates.length === 0) {
    console.error('No candidates generated. Raw output:');
    console.error(raw);
    process.exit(1);
  }

  // Write candidate file
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `corpus-candidates-${dateStr}.md`;
  const filepath = resolve('data', filename);

  const lines = [
    `# Corpus Candidates ${dateStr}`,
    '',
    `Generated from active corpus of ${corpus.length} questions.`,
    `Mark approved questions with [x], then run: npx tsx src/scripts/approve-corpus.ts data/${filename}`,
    '',
    ...candidates.map(q => `- [ ] ${q}`),
    '',
  ];

  writeFileSync(filepath, lines.join('\n'), 'utf-8');

  console.log(`\nWrote ${candidates.length} candidates to ${filepath}`);
  console.log(`\nTokens: ${message.usage?.input_tokens ?? '?'} in / ${message.usage?.output_tokens ?? '?'} out`);
}

main().catch((err) => {
  console.error('expand-corpus failed:', err);
  process.exit(1);
});
