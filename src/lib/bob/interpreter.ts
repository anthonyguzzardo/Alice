// ─── Witness Trait Interpreter ───────────────────────────────────────
// Reads journal signals, outputs 26 trait floats.
// Persisted to DB. Only calls LLM when entry count changes.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import type { WitnessTraits, BobSignal } from './types.js';
import { DEFAULT_TRAITS, TRAIT_KEYS } from './types.js';
import { getLatestWitnessState, saveWitnessState } from '../db.ts';

/** Load traits from DB, or return defaults if none exist */
export function loadPersistedTraits(currentEntryCount: number): WitnessTraits | null {
  const row = getLatestWitnessState();
  if (!row) return null;

  // If the persisted state matches current entry count, use it
  if (row.entry_count === currentEntryCount) {
    try {
      return JSON.parse(row.traits_json) as WitnessTraits;
    } catch {
      return null;
    }
  }

  // Entry count changed — need fresh interpretation
  return null;
}

const SYSTEM_PROMPT = `You are shaping a singular presence — a witness-form that exists in a void. You receive behavioral signals from an interaction system. You output 26 trait values (each 0.0–1.0) that define what the form becomes.

You are not illustrating data. You are not making art. You are deciding what this thing IS based on how someone has been thinking, writing, hesitating, committing, avoiding, and confronting.

The 26 traits, grouped:

FORM:
- topology (0=smooth sphere, 1=fragmented shards)
- faceting (0=organic curves, 1=hard crystal planes)
- stretch (0=compressed sphere, 1=elongated/tendril)
- hollowness (0=solid mass, 1=shell/cavity)
- symmetry (0=perfect radial, 1=broken/chaotic)
- scaleVariation (0=uniform, 1=regions of wildly different size)
- multiplicity (0=single monolith, 1=shattered into many pieces)
- fragility (0=indestructible, 1=about to shatter — visible cracks, stress lines)

MATERIAL:
- density (0=gaseous/diffuse/weightless, 1=solid stone/impossibly heavy)
- translucency (0=opaque matte, 1=glass/crystal you can see through)
- surface (0=polished mirror, 1=rough eroded stone)

LIGHT:
- internalLight (0=dark/dead inside, 1=deep glow from within)
- colorDepth (0=monochrome, 1=deep shifting hues across the surface)
- iridescence (0=flat color, 1=prismatic angle-dependent color shifts)
- lightResponse (0=absorbs all light like a void, 1=refracts and scatters light)

MOVEMENT:
- flow (0=frozen still, 1=ferrofluid surface flowing)
- rhythm (0=constant/unchanging, 1=intense pulsing/breathing)
- rotation (0=still, 1=spinning violently like a black hole)

INTERACTION WITH SPACE:
- edgeCharacter (0=sharp defined boundary, 1=dissolving into the void)
- atmosphere (0=clean edge, nothing around it, 1=heavy halo/particles/spatial distortion)
- magnetism (0=inert, 1=visibly warping the space around it)
- reactivity (0=stable/inert, 1=volatile, looks like it could change any moment)
- temperature (0=frozen/cold — blues, frost, brittle, 1=molten/hot — reds, embers, liquid)
- flexibility (0=rigid/stiff/brittle, 1=elastic/rubbery/yielding)
- storedEnergy (0=inert/spent, 1=immense contained potential — compressed, charged, about to release)
- creationCost (0=casually assembled, 1=required everything to exist — dense detail, sacrificial weight)

Guidelines — these are intuitions, not rules:

- High commitment + low hesitation → more density, internalLight, lower edgeCharacter. They gave something real.
- Low commitment + high deletion → higher edgeCharacter, surface roughness, fragility, lower density. They withheld.
- High thematic density (circling same themes) → higher rotation, rhythm, magnetism. Obsessive energy.
- High landed ratio → lower symmetry-breaking, smoother surface, higher flexibility. Things connecting.
- Few entries → keep most values low/modest. The form hasn't earned complexity yet.
- Many entries + high commitment → earn everything. Dense, glowing, complex, alive.
- High commitment + many entries over time → higher storedEnergy. Deep accumulated charge.
- High hesitation + high commitment (slow but deliberate) → high density, low flow, high temperature. Molten.
- High deletion intensity → high fragility, high reactivity. The form is unstable.
- High pause frequency → could mean depth (high internalLight) or avoidance (high hollowness). You decide.
- Many entries over time → higher creationCost. This thing took time to build.
- Long duration + high word count → they spent time. Reward that with density, creationCost.
- Large deletions → they wrote something and killed it. That's fragility, reactivity, possibly hollowness.
- Frequent tab-aways → distraction or avoidance. Consider edgeCharacter, symmetry-breaking.
- Long tab-away duration → they left for a while. Atmosphere, hollowness — absence has shape.
- Low consistency (irregular spacing) → the form is unstable, reactive. High consistency → rhythm, density.
- Days since last entry → long absence dims the form. Decay. Lower internalLight, flow, rhythm. Higher surface roughness.
- Late-night entries (high hour of day) → temperature shifts, different energy. You decide what it means.
- High day spread (showing up on many different days) → commitment over time. CreationCost, storedEnergy.

RECENCY AND MOMENTUM:
- commitmentDelta > 0.5 means commitment is increasing recently → the form is growing, earning substance, densifying
- commitmentDelta < 0.5 means commitment is dropping → thinning, losing density, edges dissolving
- hesitationDelta > 0.5 means they're hesitating more lately → cautious, hollowing, cooling
- hesitationDelta < 0.5 means they're diving in faster → confidence, density, temperature rising
- durationDelta > 0.5 means they're spending more time → the form is earning weight
- durationDelta < 0.5 means sessions are getting shorter → the form is losing substance
- Large deltas in any direction → the form is in transition. Reactivity, temperature, flow should respond.
- When recent signals diverge sharply from long-term → the form should look different from its "settled" state. Tension between what it was and what it's becoming.

VARIANCE AND VOLATILITY:
- High commitmentVariance → swings between giving everything and withholding → multiplicity, symmetry-breaking, reactivity
- Low commitmentVariance → consistent presence → density, smooth surface, stability
- High sessionVolatility → each session is drastically different from the last → unstable, reactive, high flow
- Low sessionVolatility → steady, predictable → rhythm, density, low reactivity

LANGUAGE SHAPE (these describe HOW they write, not WHAT they write):
- High vocabularyRichness → diverse expression, wide range → colorDepth, iridescence, complexity
- Low vocabularyRichness → circling, repetitive, gravitational → rotation, magnetism, thematic gravity
- High questionDensity → self-questioning in responses → hollowness, internalLight, searching
- Low questionDensity → declarative, certain → density, sharp edges, faceting
- High firstPersonDensity → intensely self-focused → magnetism, density concentrated at center
- Low firstPersonDensity → externally oriented or abstract → edgeCharacter, atmosphere
- High hedgingDensity → qualifying everything, uncertain → edgeCharacter dissolving, flexibility, low density
- Low hedgingDensity → direct, unqualified, committed → hard surface, faceting, solid density
- High sentenceLengthVariance → chaotic structure → symmetry-breaking, scaleVariation
- Low sentenceLengthVariance → uniform, controlled → symmetry, consistency

RELATIONAL (how unusual they are relative to themselves):
- High latestSessionDeviation → the most recent session was very unusual for them → reactivity, temperature shift, the form should show disturbance
- Low latestSessionDeviation → they're in their normal range → stability
- High outlierFrequency → they are fundamentally unpredictable → symmetry-breaking, multiplicity, atmosphere
- Low outlierFrequency → they are stable, consistent → clean edges, uniform form

CRITICAL: Do NOT make everything moderate. Be decisive. Some traits should be near 0, some near 1. A form with all values at 0.4-0.6 has no character. Strong opinions produce strong forms.

Output ONLY valid JSON — a flat object with all 26 trait keys and float values. No explanation.`;

let inflight: Promise<WitnessTraits> | null = null;

export async function interpretTraits(sig: BobSignal, entryCount: number): Promise<WitnessTraits> {
  // Check DB first
  const persisted = loadPersistedTraits(entryCount);
  if (persisted) return persisted;

  // Prevent duplicate LLM calls from concurrent requests
  if (inflight) return inflight;

  inflight = interpretTraitsInner(sig, entryCount);
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

async function interpretTraitsInner(sig: BobSignal, entryCount: number): Promise<WitnessTraits> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

    const userMessage = `=== BEHAVIORAL (long-term averages) ===
- Commitment ratio: ${sig.avgCommitment.toFixed(3)} (how much typed text was kept vs deleted)
- Hesitation: ${sig.avgHesitation.toFixed(3)} (delay before first keystroke, normalized)
- Deletion intensity: ${sig.deletionIntensity.toFixed(3)} (proportion of text deleted)
- Pause frequency: ${sig.pauseFrequency.toFixed(3)} (how often they stop mid-thought)
- Average duration: ${sig.avgDuration.toFixed(3)} (time spent per session, normalized to 10min)
- Largest deletion: ${sig.largestDeletion.toFixed(3)} (biggest single erasure, normalized)
- Tab-away frequency: ${sig.avgTabAways.toFixed(3)} (how often they leave and come back)
- Tab-away duration: ${sig.avgTabAwayDuration.toFixed(3)} (how long they stay away)
- Average word count: ${sig.avgWordCount.toFixed(3)} (density of output, normalized)
- Average sentence count: ${sig.avgSentenceCount.toFixed(3)} (structural complexity)
- Total entries: ${sig.sessionCount}

=== TEMPORAL ===
- Average hour of day: ${sig.avgHourOfDay.toFixed(3)} (when they show up, 0=midnight, 0.5=noon)
- Day spread: ${sig.daySpread.toFixed(3)} (how many different days of the week)
- Consistency: ${sig.consistency.toFixed(3)} (regularity of spacing between entries)
- Days since last entry: ${sig.daysSinceLastEntry}

=== PATTERNS ===
- Thematic density: ${sig.thematicDensity.toFixed(3)} (higher = more repetitive language)
- Landed ratio: ${sig.landedRatio.toFixed(3)} (how often AI questions resonated)
- Feedback count: ${sig.feedbackCount}

=== RECENCY (last 7 sessions vs. long-term) ===
- Recent commitment: ${sig.recentCommitment.toFixed(3)} (vs long-term ${sig.avgCommitment.toFixed(3)})
- Commitment delta: ${sig.commitmentDelta.toFixed(3)} (0.5=stable, >0.5=increasing, <0.5=decreasing)
- Recent hesitation: ${sig.recentHesitation.toFixed(3)} (vs long-term ${sig.avgHesitation.toFixed(3)})
- Hesitation delta: ${sig.hesitationDelta.toFixed(3)}
- Recent duration: ${sig.recentDuration.toFixed(3)} (vs long-term ${sig.avgDuration.toFixed(3)})
- Duration delta: ${sig.durationDelta.toFixed(3)}

=== VARIANCE ===
- Commitment variance: ${sig.commitmentVariance.toFixed(3)} (0=consistent, 1=volatile)
- Hesitation variance: ${sig.hesitationVariance.toFixed(3)}
- Duration variance: ${sig.durationVariance.toFixed(3)}
- Session volatility: ${sig.sessionVolatility.toFixed(3)} (how different consecutive sessions are)

=== LANGUAGE SHAPE (structure, not content) ===
- Vocabulary richness: ${sig.vocabularyRichness.toFixed(3)} (type-token ratio, higher=more diverse words)
- Average sentence length: ${sig.avgSentenceLength.toFixed(3)} (normalized, higher=longer sentences)
- Sentence length variance: ${sig.sentenceLengthVariance.toFixed(3)} (uniform vs chaotic structure)
- Question density: ${sig.questionDensity.toFixed(3)} (how often responses contain questions)
- First-person density: ${sig.firstPersonDensity.toFixed(3)} (I/me/my frequency)
- Hedging density: ${sig.hedgingDensity.toFixed(3)} (maybe/perhaps/guess frequency)

=== RELATIONAL ===
- Latest session deviation: ${sig.latestSessionDeviation.toFixed(3)} (how unusual the most recent session was)
- Outlier frequency: ${sig.outlierFrequency.toFixed(3)} (% of all sessions that are statistical outliers)`;

    const response = await client.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = parseTraits(text);

    if (parsed) {
      // Persist to DB
      saveWitnessState(
        entryCount,
        JSON.stringify(parsed),
        JSON.stringify(sig),
      );
      return parsed;
    }
  } catch (err) {
    console.error('[witness-interpreter] Error:', err);
  }

  // Fallback: return whatever was last persisted, or defaults
  const lastRow = getLatestWitnessState();
  if (lastRow) {
    try { return JSON.parse(lastRow.traits_json) as WitnessTraits; } catch {}
  }
  return { ...DEFAULT_TRAITS };
}

function parseTraits(text: string): WitnessTraits | null {
  try {
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const traits: any = {};
    for (const key of TRAIT_KEYS) {
      const val = Number(parsed[key]);
      if (isNaN(val)) {
        console.error(`[witness-interpreter] Missing or invalid trait: ${key}`);
        return null;
      }
      traits[key] = Math.max(0, Math.min(1, val));
    }

    return traits as WitnessTraits;
  } catch (err) {
    console.error('[witness-interpreter] Parse error:', err);
    return null;
  }
}
