/**
 * Witness Visual Renderer
 *
 * Translates validated behavioral dynamics into 26 visual traits.
 * The science lives in state-engine.ts and dynamics.ts (deterministic math).
 * This module is the LAST MILE: art, not science.
 *
 * The LLM receives:
 *   - 8 dimension dynamics (baseline, variability, attractor force, deviation)
 *   - Empirical coupling matrix (which dimensions influence each other)
 *   - System-level metrics (phase, velocity, entropy)
 *   - A behavioral narrative summarizing what's happening
 *
 * The LLM outputs:
 *   - 26 visual trait floats that make the witness-form LOOK like the dynamics FEEL
 *
 * Previous architecture: signals → LLM guesses traits (interpreter)
 * New architecture:      signals → deterministic math → validated dynamics → LLM renders visuals
 *
 * Research basis:
 *   PersDyn           — Sosnowska et al. (KU Leuven, 2019)
 *   Whole Trait Theory — Fleeson & Jayawickreme (2015, 2025)
 *   Causal coupling    — Critcher (Berkeley xLab)
 *   ECTO entropy       — Rodriguez (2025)
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import type { WitnessTraits } from './libTypes.js';
import { DEFAULT_TRAITS, TRAIT_KEYS } from './libTypes.js';
import { getLatestWitnessState, saveWitnessState } from '../libDb.ts';
import { type DynamicsAnalysis, formatDynamicsForRenderer } from './libDynamics.ts';
import { type EmotionAnalysis, formatEmotionForRenderer } from './libEmotionProfile.ts';

/** Load the latest persisted traits, regardless of entry count.
 *  Returns null only if no witness state has ever been generated. */
export async function loadPersistedTraits(subjectId: number): Promise<WitnessTraits | null> {
  const row = await getLatestWitnessState(subjectId);
  if (!row) return null;

  try {
    return JSON.parse(row.traits_json) as WitnessTraits;
  } catch {
    return null;
  }
}

/** Check if a new render is needed (entry count changed since last persist) */
export async function needsNewRender(subjectId: number, currentEntryCount: number): Promise<boolean> {
  const row = await getLatestWitnessState(subjectId);
  if (!row) return true;
  return row.entry_count !== currentEntryCount;
}

const SYSTEM_PROMPT = `You are a visual renderer for a witness-form — a singular presence that exists in a void. You receive VALIDATED BEHAVIORAL DYNAMICS computed from deterministic math. Your job is to translate those dynamics into 26 visual traits that make the form LOOK like the dynamics FEEL.

You are NOT interpreting raw data. The interpretation is done. You are receiving:
- Per-dimension dynamics: baseline (stable center), variability (how much it fluctuates), attractor force (how quickly deviations snap back), current deviation from baseline
- Empirical coupling: which dimensions causally influence each other, discovered from the person's actual behavioral data
- System metrics: phase (stable/shifting/disrupted), velocity (rate of change), entropy (structural predictability)

Your role is AESTHETIC TRANSLATION. Turn behavioral physics into visual form.

The 26 visual traits, grouped:

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

Visual translation principles:

DYNAMICS → FORM:
- High attractor force on any dimension → rigidity, density, faceting. The form resists change.
- Low attractor force → flexibility, edgeCharacter dissolving, flow. The form is malleable.
- High variability → reactivity, scaleVariation, multiplicity. The form is inherently unstable.
- Low variability → smooth surface, uniform, density. The form is consistent.
- Extreme positive deviation → the dimension is running hot. Temperature, internalLight, storedEnergy.
- Extreme negative deviation → withdrawal, hollowness, coldness. Low internalLight, high surface roughness.

COUPLING → VISUAL RELATIONSHIPS:
- Strong positive coupling between dimensions → symmetry, coherence, rhythm. The form moves as one.
- Strong negative coupling → internal tension, fragility, multiplicity. Parts fighting each other.
- Many active couplings → magnetism, atmosphere. The form radiates influence.
- Few couplings → clean edges, inert. Self-contained.

SYSTEM STATE → GESTALT:
- Phase "stable" → density, smooth surface, low reactivity. Settled.
- Phase "shifting" → flow, temperature changing, edgeCharacter softening. In transition.
- Phase "disrupted" → fragility, multiplicity, high reactivity, storedEnergy. Something broke.
- High velocity → flow, rhythm, temperature. Moving fast.
- Low velocity → frozen, dense, low flow. Still.
- High entropy → iridescence, colorDepth, atmosphere. Complex, unpredictable.
- Low entropy → faceting, density, monochrome. Structured, certain.

DIMENSION-SPECIFIC AESTHETICS:
- Fluency baseline/deviation → flow, surface texture. Sustained production = fluid. Fragmented = rough.
- Deliberation → density, temperature (cold = careful). High deliberation = heavy, still, cold.
- Revision → fragility, storedEnergy. Heavy revision = the form has been broken and rebuilt.
- Expression → colorDepth, iridescence. Linguistic diversity = visual diversity.
- Commitment → density, creationCost. High commitment = the form has weight and cost.
- Volatility → reactivity, multiplicity, scaleVariation. Behavioral instability = visual instability.
- Thermal → temperature (directly), internalLight. Editing heat = visual heat.
- Presence → internalLight, magnetism. Being there = glowing, warping space.

EMOTIONAL REGISTER → VISUAL COLORING:
You may also receive an emotional register section with NRC emotion word densities and Pennebaker categories. This is CONTENT signal (what emotion words they used), separate from the BEHAVIORAL dynamics (how they wrote). Use it to color the form, not to reshape it. The dynamics determine structure. The emotions determine palette and mood.

- High anger density → temperature rising, surface roughness. Hot, abrasive.
- High fear density → reactivity, fragility, edgeCharacter dissolving. The form is uncertain of its own boundary.
- High joy density → internalLight, lightResponse, iridescence. Luminous, refractive.
- High sadness density → low temperature, low internalLight, density increasing. Heavy, cold, dark.
- High trust density → smooth surface, symmetry, density. Solid, coherent, stable.
- High anticipation density → storedEnergy, rhythm, magnetism. Charged, pulsing, pulling.
- High cognitive density → faceting, translucency. Crystalline structure, visible internal logic.
- High hedging density → edgeCharacter dissolving, flexibility, low density. Uncertain, yielding.
- High first-person density → magnetism, density at center. Self-gravitating.
- Low emotional intensity → monochrome, matte surface. Flat register.
- High emotional diversity → colorDepth, iridescence. Many feelings at once.
- Low emotional diversity → monochrome tending toward the dominant emotion's palette.

EMOTION→BEHAVIOR COUPLING:
If emotion→behavior couplings are present, they reveal cross-domain causal chains unique to this person. When an emotion dimension is currently deviated AND has a known coupling to a behavioral dimension, the form should show anticipation of the behavioral shift — storedEnergy, reactivity, the sense that something is about to move.

CRITICAL: Do NOT make everything moderate. Be decisive. Some traits should be near 0, some near 1. A form with all values at 0.4-0.6 has no character. Strong dynamics produce strong forms.

CRITICAL: The dynamics you receive are REAL — they are computed from actual behavioral data using validated statistical methods. Trust them. Don't second-guess the math. Render what they say.

Output ONLY valid JSON — a flat object with all 26 trait keys and float values. No explanation.`;

let inflight: Promise<WitnessTraits> | null = null;

/** Render new witness traits via LLM. Called ONLY from session completion pipeline.
 *  This ALWAYS calls the LLM — caller must check needsNewRender() first. */
export async function renderTraits(
  subjectId: number,
  dynamics: DynamicsAnalysis,
  entryCount: number,
  emotionAnalysis?: EmotionAnalysis,
): Promise<WitnessTraits> {
  // Prevent duplicate LLM calls from concurrent requests
  if (inflight) return inflight;

  inflight = renderTraitsInner(subjectId, dynamics, entryCount, emotionAnalysis);
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

async function renderTraitsInner(
  subjectId: number,
  dynamics: DynamicsAnalysis,
  entryCount: number,
  emotionAnalysis?: EmotionAnalysis,
): Promise<WitnessTraits> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY2 });

    let userMessage = formatDynamicsForRenderer(dynamics);

    // Append emotion profile if available
    if (emotionAnalysis && emotionAnalysis.profile.current) {
      userMessage += '\n\n' + formatEmotionForRenderer(emotionAnalysis);
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = parseTraits(text);

    if (parsed) {
      // Persist to DB (store dynamics + emotion context)
      await saveWitnessState(
        subjectId,
        entryCount,
        JSON.stringify(parsed),
        JSON.stringify({
          dynamics: dynamics.dimensions,
          coupling: dynamics.coupling,
          phase: dynamics.phase,
          velocity: dynamics.velocity,
          systemEntropy: dynamics.systemEntropy,
          emotionProfile: emotionAnalysis?.profile ?? null,
          emotionBehaviorCoupling: emotionAnalysis?.emotionBehaviorCoupling ?? [],
        }),
        'dynamics-v2',
      );
      return parsed;
    }
  } catch (err) {
    console.error('[witness-renderer] Error:', err);
  }

  // Fallback: return whatever was last persisted, or defaults
  const lastRow = await getLatestWitnessState(subjectId);
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
        console.error(`[witness-renderer] Missing or invalid trait: ${key}`);
        return null;
      }
      traits[key] = Math.max(0, Math.min(1, val));
    }

    return traits as WitnessTraits;
  } catch (err) {
    console.error('[witness-renderer] Parse error:', err);
    return null;
  }
}

// ─── Legacy compatibility ──────────────────────────────────────────
// interpretTraits is still imported by scripts/reinterpret.ts
// Bridge it to the new pipeline

import { computeEntryStates } from './libStateEngine.ts';
import { computeDynamics } from './libDynamics.ts';
import { computeEmotionAnalysis } from './libEmotionProfile.ts';
import type { AliceNegativeSignal } from './libTypes.js';

/** Legacy bridge for scripts/reinterpret.ts — runs full pipeline unconditionally */
export async function interpretTraits(subjectId: number, _sig: AliceNegativeSignal, entryCount: number): Promise<WitnessTraits> {
  const states = await computeEntryStates(subjectId);
  if (states.length < 3) return { ...DEFAULT_TRAITS };

  const dynamics = computeDynamics(states);
  const emotionAnalysis = await computeEmotionAnalysis(subjectId, states);
  return renderTraits(subjectId, dynamics, entryCount, emotionAnalysis);
}
