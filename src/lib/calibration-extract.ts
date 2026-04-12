/**
 * Calibration Content Extraction Pipeline
 *
 * Extracts structured life-context tags from calibration response text.
 * Uses Claude Sonnet for accurate entity extraction — labels feed the
 * clustering pipeline, so extraction quality directly determines cluster quality.
 *
 * Research basis:
 *   - Incidental supervision (Roth, AAAI 2017): byproduct labels from one
 *     task supervise another without explicit annotation.
 *   - EMA/ESM literature validates day-level life-context capture. Calibration
 *     prompts are functionally involuntary EMAs — the user reports state
 *     without knowing they're providing state data.
 *   - Nature Digital Medicine (2025): LLM-based extraction of social
 *     determinants of health achieves micro-F1 >0.9.
 *
 * Dimension selection (ranked by effect size on cognitive/behavioral output):
 *   1. sleep           — Pilcher & Huffcutt (1996) d=-1.55; Abdullah et al. (2016) keystroke evidence
 *   2. physical_state  — Moriarty et al. (2011) d=0.40-0.80; Eccleston & Crombez (1999)
 *   3. emotional_event — Amabile et al. (2005) 12K diary entries; Fredrickson (2001)
 *   4. social_quality  — Reis et al. (2000) quality > quantity; Sun et al. (2020) PNAS
 *   5. stress          — Sliwinski et al. (2009) same-day WM decrement; Almeida (2005)
 *   6. exercise        — Hillman et al. (2008) d=0.20-0.50; temporally bounded
 *   7. routine         — Torous et al. (2016) circadian disruption
 *   DROPPED: meals (d=0.12-0.25), environment (no keystroke evidence), caffeine (d=0.10-0.20)
 *
 * Design constraints:
 *   - No sentiment analysis on calibration text. No three-frame interpretation.
 *   - Calibration prompts remain genuinely neutral.
 *   - Tags feed the clustering layer as context labels, NOT the observation
 *     layer as signal. The calibration contract is preserved.
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { saveCalibrationContext, type CalibrationContextTag } from './db.ts';

const EXTRACTION_SYSTEM_PROMPT = `You are a structured data extractor. You receive a person's response to a neutral writing prompt (like "Describe what you did this morning" or "What did you have for breakfast?").

Your job: extract observable life-context facts from the text. You are NOT interpreting, analyzing, or making psychological inferences. You are identifying concrete, stated facts about the person's day.

Extract tags across these dimensions ONLY when explicitly mentioned or clearly implied:

1. **sleep** — Did they mention sleep quality, duration, or disruption?
   Values: good, poor, disrupted, insufficient, restless, late_night, early_wake, oversleep
   Research: Largest effect on cognitive/behavioral output (Pilcher & Huffcutt d=-1.55). Detectable in keystroke variability.

2. **physical_state** — Did they mention how their body feels? Pain, illness, fatigue, energy level?
   Values: energetic, fatigued, sick, pain, rested, sluggish, headache, hungover, well_rested
   Research: Moriarty et al. d=0.40-0.80 for pain/illness effects on attention and executive function.

3. **emotional_event** — Did they mention a significant positive or negative experience (not just mood)?
   Values: positive_event, negative_event, exciting_news, disappointing_news, achievement, loss, surprise
   Research: Amabile et al. (2005) — emotional events predict same-day AND next-day creative output.

4. **social_quality** — Did they mention interacting with people, and was it positive, negative, or neutral?
   Values: meaningful_connection, isolation, conflict, positive_interaction, family_time, loneliness
   Research: Reis et al. (2000) — interaction QUALITY predicts wellbeing, not quantity. Negativity asymmetry.

5. **stress** — Did they mention stressors, pressure, or cognitive demands? Work stress, deadlines, overwhelm?
   Values: high, moderate, low, work_pressure, deadline, overwhelmed, calm, demanding_day
   Research: Sliwinski et al. (2009) — same-day working memory decrement. Almeida (2005) — carry-over via rumination.

6. **exercise** — Did they mention physical activity or lack thereof?
   Values: done, skipped, light, intense, walk, run, gym, active_day, sedentary
   Research: Hillman et al. (2008) d=0.20-0.50. Acute effect temporally bounded to 1-2h post-exercise.

7. **routine** — Was their routine normal or disrupted? Schedule changes, unusual day structure?
   Values: normal, disrupted, rushed, lazy, productive, chaotic, travel, schedule_change
   Research: Torous et al. (2016) — circadian disruption detectable in digital phenotyping data.

Rules:
- Only extract what is STATED or CLEARLY IMPLIED. Do not infer.
- If the text mentions nothing about a dimension, DO NOT include it.
- "detail" should be a brief quote or paraphrase of the relevant text.
- "confidence" should be 1.0 for explicit statements, 0.7 for clear implications, 0.4 for weak implications.
- Most responses will have 0-3 tags. An empty array is perfectly valid.
- Err on the side of NOT extracting rather than guessing.
- Do NOT extract mood/affect as emotional_event. Emotional_event requires a discrete EVENT, not a feeling.`;

interface ExtractionResult {
  tags: Array<{
    dimension: string;
    value: string;
    detail: string;
    confidence: number;
  }>;
}

const VALID_DIMENSIONS = new Set([
  'sleep', 'physical_state', 'emotional_event', 'social_quality',
  'stress', 'exercise', 'routine',
]);

/**
 * Extract life-context tags from calibration response text using Claude Sonnet.
 * Returns validated, typed tags ready for storage.
 */
export async function extractCalibrationContext(
  responseText: string,
  promptText: string,
): Promise<CalibrationContextTag[]> {
  if (!responseText || responseText.trim().split(/\s+/).length < 5) {
    return []; // too short to extract anything meaningful
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Prompt the person answered: "${promptText}"\n\nTheir response:\n${responseText}`,
      },
    ],
    tools: [
      {
        name: 'extract_context',
        description: 'Extract structured life-context tags from the calibration response.',
        input_schema: {
          type: 'object' as const,
          properties: {
            tags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  dimension: {
                    type: 'string',
                    enum: ['sleep', 'physical_state', 'emotional_event', 'social_quality', 'stress', 'exercise', 'routine'],
                  },
                  value: { type: 'string', description: 'Short categorical value for this dimension' },
                  detail: { type: 'string', description: 'Brief quote or paraphrase of the relevant text' },
                  confidence: { type: 'number', description: 'Extraction confidence: 1.0=explicit, 0.7=implied, 0.4=weak' },
                },
                required: ['dimension', 'value', 'detail', 'confidence'],
              },
            },
          },
          required: ['tags'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'extract_context' },
  });

  // Parse tool use response
  const toolBlock = message.content.find(b => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    return [];
  }

  const result = toolBlock.input as ExtractionResult;
  if (!result.tags || !Array.isArray(result.tags)) {
    return [];
  }

  // Validate and type-narrow
  const validated: CalibrationContextTag[] = [];
  for (const tag of result.tags) {
    if (!VALID_DIMENSIONS.has(tag.dimension)) continue;
    if (!tag.value || typeof tag.value !== 'string') continue;

    validated.push({
      dimension: tag.dimension as CalibrationContextTag['dimension'],
      value: tag.value.toLowerCase().replace(/\s+/g, '_'),
      detail: typeof tag.detail === 'string' ? tag.detail : null,
      confidence: typeof tag.confidence === 'number'
        ? Math.max(0, Math.min(1, tag.confidence))
        : 0.7,
    });
  }

  return validated;
}

/**
 * Run extraction and persist results. Fire-and-forget from calibrate.ts.
 * Logs errors but does not throw — extraction failure should never block
 * the calibration submission.
 */
export async function runCalibrationExtraction(
  questionId: number,
  responseText: string,
  promptText: string,
): Promise<void> {
  try {
    const tags = await extractCalibrationContext(responseText, promptText);
    if (tags.length > 0) {
      saveCalibrationContext(questionId, tags);
      console.log(`[calibration-extract] Extracted ${tags.length} context tags for question ${questionId}`);
    } else {
      console.log(`[calibration-extract] No context tags found for question ${questionId}`);
    }
  } catch (err) {
    console.error('[calibration-extract] Extraction failed (non-blocking):', (err as Error).message);
  }
}
