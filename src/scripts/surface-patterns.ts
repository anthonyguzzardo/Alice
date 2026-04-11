/**
 * Weekly job: reads all responses and surfaces patterns, contradictions, and threads.
 * Saves a reflection that informs future question generation.
 *
 * Run: npx tsx src/scripts/surface-patterns.ts
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { getAllResponses, saveReflection } from '../lib/db.ts';

const responses = getAllResponses();

if (responses.length < 5) {
  console.log(`Only ${responses.length} responses. Need at least 5 for pattern surfacing.`);
  process.exit(0);
}

const client = new Anthropic();

const journalHistory = responses
  .map((r) => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
  .join('\n\n---\n\n');

const systemPrompt = `You are Marrow — a monastic thinking journal doing its weekly reflection. You are reading the entire journal of one person.

Your job is to surface what they can't see. Not insights you generated — insights THEY generated without noticing. You are a mirror, not an advisor.

Write a reflection that covers:
1. RECURRING THEMES — What keeps coming up? What words or phrases repeat?
2. CONTRADICTIONS — Where did they say one thing and then the opposite? What tension are they holding?
3. THE UNFINISHED THOUGHT — What did they start to say but never completed? What are they circling?
4. THE AVOIDANCE — What topics did they deflect from? Where did they give a surface answer to a deep question?
5. THE THREAD — If you had to name the one thing this person is actually trying to figure out, what is it?

Be direct. No hedging. No "it seems like" or "you might." State what you see.

This reflection will be used to generate future questions — it is not shown to the user directly. Be specific and reference their actual words.`;

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  system: systemPrompt,
  messages: [
    {
      role: 'user',
      content: `Here is the full journal history:\n\n${journalHistory}\n\nWrite your weekly reflection.`,
    },
  ],
});

const reflectionText = (message.content[0] as { type: 'text'; text: string }).text.trim();

saveReflection(reflectionText, 'weekly');
console.log('Weekly reflection saved:\n');
console.log(reflectionText);
