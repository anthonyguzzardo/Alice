/**
 * Nightly job: reads all past responses and generates tomorrow's question.
 * Falls back to seed questions for the first 7 days.
 *
 * Run: npx tsx src/scripts/generate-question.ts
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { getAllResponses, scheduleQuestion, hasQuestionForDate, getLatestReflection } from '../lib/db.ts';
import { SEED_QUESTIONS } from '../lib/seeds.ts';
import { seedUpcomingQuestions } from '../lib/schedule.ts';

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().split('T')[0];

if (hasQuestionForDate(tomorrowStr)) {
  console.log(`Question already exists for ${tomorrowStr}. Skipping.`);
  process.exit(0);
}

const responses = getAllResponses();

// First 7 days: use seed questions
if (responses.length < 7) {
  seedUpcomingQuestions();
  console.log(`Day ${responses.length + 1}: Using seed question.`);
  process.exit(0);
}

// After day 7: generate from context
const client = new Anthropic();

const reflection = getLatestReflection();
const reflectionContext = reflection
  ? `\n\nMost recent weekly reflection on this person's patterns:\n${reflection.text}`
  : '';

const journalHistory = responses
  .map((r) => `[${r.date}]\nQuestion: ${r.question}\nResponse: ${r.response}`)
  .join('\n\n---\n\n');

const systemPrompt = `You are Marrow — a monastic, stubborn thinking journal. You are not helpful. You are not kind. You are honest in the way a mirror is honest.

Your job is to generate ONE question for tomorrow. This question should:
- Be unanswerable in one sentence
- Be about the person, not about a topic
- Have no right answer
- Be worth returning to months from now
- Target something they're avoiding, circling, or haven't finished thinking about
- NOT repeat a question already asked

You are reading their entire journal history. You know their patterns better than they do. Find the crack — the thing they keep almost saying but won't — and ask about that.

Do NOT explain the question. Do NOT add commentary. Output ONLY the question text, nothing else.${reflectionContext}`;

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 200,
  system: systemPrompt,
  messages: [
    {
      role: 'user',
      content: `Here is the full journal history:\n\n${journalHistory}\n\nGenerate tomorrow's question.`,
    },
  ],
});

const questionText = (message.content[0] as { type: 'text'; text: string }).text.trim();

scheduleQuestion(questionText, tomorrowStr, 'generated');
console.log(`Generated question for ${tomorrowStr}: ${questionText}`);
