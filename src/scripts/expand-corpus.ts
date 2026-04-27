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
  const n = parseInt(process.argv[idx + 1], 10);
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

=== QUESTION DESIGN PRINCIPLES ===

Every question must satisfy ALL of these criteria:

1. UNANSWERABLE IN ONE SENTENCE. The question creates friction. A one-line answer means the question failed.
2. ABOUT THE PERSON, NOT A TOPIC. "What are you avoiding?" not "What is avoidance?"
3. NO RIGHT ANSWER. The person is thinking, not performing.
4. WORTH RETURNING TO. The answer today differs from three months from now.
5. SHORT. Under 15 words. One clause, one demand. Syntactically simple, cognitively demanding.
6. DISTINCT FROM EVERY EXISTING QUESTION. Not a rephrasing, not a synonym, not the same question from a different angle. If it would feel repetitive to encounter both in the same month, it's too close.

FRAMING RULES:
- Use CAUSAL and EVALUATIVE framing. "Why" and "how do you reconcile" over "describe" or "what do you think about."
- Use generative verbs: reconcile, examine, explore, confront, sit with. Avoid descriptive verbs: describe, list, identify, summarize.
- Create a DISCLOSURE CONTEXT. The person should feel they are revealing something, not recording something.
- Frame difficulty as invitation, not confrontation. Productive discomfort requires psychological safety.

DIVERSITY RULES:
- Vary the domain: identity, relationships, work, fear, desire, time, meaning, contradiction, growth, loss.
- Vary the cognitive demand: some questions ask for self-observation, some for evaluation, some for reconciliation of opposing positions.
- Do NOT cluster around introspection. Some questions should be about action, decision, or the external world as it relates to the person.

=== WHAT MAKES A QUESTION BAD ===
- Therapy-speak: "How does that make you feel?" "What would your inner child say?"
- Fortune-cookie wisdom: "What would you do if you couldn't fail?"
- Too abstract: "What is the nature of your becoming?"
- Too narrow: "What happened at work today?"
- Redundant with an existing question (even if worded differently).`;

  const userPrompt = `Generate exactly ${count} candidate questions for the corpus.

Output format: one question per line, no numbering, no commentary, no blank lines. Just the questions.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
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
