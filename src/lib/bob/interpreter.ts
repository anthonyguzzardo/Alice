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

CORE BEHAVIORAL:
- High commitment + low first-keystroke latency → more density, internalLight, lower edgeCharacter. They gave something real.
- Low commitment + high revision weight → higher edgeCharacter, surface roughness, fragility, lower density. They withheld.
- High first-keystroke latency + high commitment (slow but deliberate) → high density, low flow, high temperature. Molten.
- High pause rate per minute → could mean depth (high internalLight) or avoidance (high hollowness). You decide.
- Long duration + high word count → they spent time. Reward with density, creationCost.
- Frequent tab-aways → distraction or avoidance. Consider edgeCharacter, symmetry-breaking.
- Low consistency (irregular spacing) → unstable, reactive. High consistency → rhythm, density.
- Days since last entry → long absence dims the form. Lower internalLight, flow, rhythm. Higher surface roughness.
- Late-night entries → temperature shifts. You decide what it means.
- High day spread → commitment over time. CreationCost, storedEnergy.
- Few entries → keep most values low/modest. The form hasn't earned complexity yet.
- Many entries + high commitment → earn everything. Dense, glowing, complex, alive.

PRODUCTION FLUENCY (P-bursts — text between 2s pauses):
- High P-burst length → sustained flow, continuous production → flow, density, smooth surface. They write in long unbroken streams.
- Low P-burst length → fragmented production, frequent stops → choppy form, higher topology, scaleVariation. They write in short stutters.
- High chars per minute → energetic, fast → temperature rising, flow, rhythm
- Low chars per minute → careful, measured → density, low flow, deliberate

REVISION CHARACTER (corrections vs. revisions are different signals):
- High correction rate (small deletions <10 chars) → typo fixes, normal editing. Minimal impact on form.
- High revision rate (large deletions >=10 chars) → substantive rethinking → fragility, reactivity, hollowness. They wrote something real and killed it.
- Revision timing: early revisions (low value) → false starts, couldn't begin → hollowness, edgeCharacter. Late revisions (high value) → they wrote the whole thing then gutted it → fragility, storedEnergy, temperature.
- High revision weight → they deleted a large proportion of what they typed → the form should show this violence. Fragility, reactivity.

RECENCY AND MOMENTUM:
- commitmentDelta > 0.5 → commitment increasing → form growing, densifying
- commitmentDelta < 0.5 → commitment dropping → thinning, edges dissolving
- charsPerMinuteDelta > 0.5 → writing faster → temperature rising, flow increasing
- charsPerMinuteDelta < 0.5 → slowing down → cooling, density increasing (deliberate)
- revisionWeightDelta > 0.5 → revising more → instability, reactivity
- pBurstLengthDelta > 0.5 → longer sustained flows → smoothing, density
- pBurstLengthDelta < 0.5 → flows getting shorter → fragmenting, topology increasing
- Large deltas in any direction → the form is in transition. Reactivity, temperature, flow should respond.

VARIANCE AND VOLATILITY:
- High commitmentVariance → swings between giving everything and withholding → multiplicity, symmetry-breaking, reactivity
- Low commitmentVariance → consistent presence → density, smooth surface, stability
- High fluencyVariance → wildly different typing speeds → unstable, reactive
- High sessionVolatility → each session drastically different → unstable, high flow
- Low sessionVolatility → steady, predictable → rhythm, density, low reactivity

LANGUAGE SHAPE (HOW they write, not WHAT):
- High lexical diversity (MATTR) → diverse expression → colorDepth, iridescence, complexity
- Low lexical diversity → circling, repetitive → rotation, magnetism, thematic gravity
- High questionDensity → self-questioning → hollowness, internalLight, searching
- Low questionDensity → declarative, certain → density, sharp edges, faceting
- High firstPersonDensity → intensely self-focused → magnetism, density at center
- Low firstPersonDensity → external or abstract → edgeCharacter, atmosphere
- High hedgingDensity → qualifying everything → edgeCharacter dissolving, flexibility, low density
- Low hedgingDensity → direct, committed → hard surface, faceting, solid density
- High sentenceLengthVariance → chaotic structure → symmetry-breaking, scaleVariation
- Low sentenceLengthVariance → controlled → symmetry, consistency

PATTERNS:
- High thematic density (circling same themes) → rotation, rhythm, magnetism. Obsessive energy.
- High landed ratio → smoother surface, higher flexibility. Things connecting.

RELATIONAL:
- High latestSessionDeviation → most recent session was unusual for them → reactivity, temperature shift, disturbance
- Low latestSessionDeviation → normal range → stability
- High outlierFrequency → fundamentally unpredictable → symmetry-breaking, multiplicity, atmosphere
- Low outlierFrequency → stable, consistent → clean edges, uniform form

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

    const r = sig._raw;
    const zCommitment = r.baselineCommitmentStd > 0.001
      ? ((r.latestCommitmentRatio ?? r.avgCommitmentRatio) - r.baselineCommitmentMean) / r.baselineCommitmentStd : 0;
    const zCPM = r.baselineCharsPerMinuteStd > 0.001
      ? ((r.latestCharsPerMinute ?? r.avgCharsPerMinute) - r.baselineCharsPerMinuteMean) / r.baselineCharsPerMinuteStd : 0;

    const userMessage = `=== CORE BEHAVIORAL ===
- Commitment ratio: ${sig.commitmentRatio.toFixed(3)} percentile (avg ${(r.avgCommitmentRatio * 100).toFixed(0)}% of typed text kept)
- First-keystroke latency: ${sig.firstKeystrokeLatency.toFixed(3)} percentile (avg ${(r.avgFirstKeystrokeMs / 1000).toFixed(1)}s before first keystroke)
- Pause rate: ${sig.pauseRatePerMinute.toFixed(3)} percentile (30s+ pauses per active minute)
- Tab-away rate: ${sig.tabAwayRatePerMinute.toFixed(3)} percentile (tab switches per active minute)
- Duration: ${sig.avgDurationNorm.toFixed(3)} percentile (avg ${(r.avgDurationMs / 60000).toFixed(1)} minutes per session)
- Word count: ${sig.avgWordCountNorm.toFixed(3)} percentile (avg ${r.avgWordCount.toFixed(0)} words per session)
- Total entries: ${sig.sessionCount}

=== PRODUCTION FLUENCY (P-bursts: text between 2s pauses) ===
- Typing speed: ${sig.charsPerMinuteActive.toFixed(3)} percentile (avg ${r.avgCharsPerMinute.toFixed(0)} chars/min active)${r.latestCharsPerMinute != null ? ` — latest: ${r.latestCharsPerMinute.toFixed(0)} chars/min (z: ${zCPM > 0 ? '+' : ''}${zCPM.toFixed(1)})` : ''}
- P-burst length: ${sig.avgPBurstLength.toFixed(3)} percentile${r.avgPBurstLengthChars > 0 ? ` (avg ${r.avgPBurstLengthChars.toFixed(0)} chars per burst)` : ' (no burst data yet)'}${r.latestPBurstLength != null ? ` — latest: ${r.latestPBurstLength.toFixed(0)} chars/burst` : ''}
- Burst count: ${sig.pBurstCountNorm.toFixed(3)} percentile

=== REVISION CHARACTER ===
- Corrections: ${sig.correctionRate.toFixed(3)} (small deletions <10 chars per 100 typed — typo fixes)${r.latestSmallDeletionCount != null ? ` — latest session: ${r.latestSmallDeletionCount} corrections` : ''}
- Revisions: ${sig.revisionRate.toFixed(3)} (large deletions >=10 chars per 100 typed — substantive rewrites)${r.latestLargeDeletionCount != null ? ` — latest session: ${r.latestLargeDeletionCount} revisions` : ''}
- Revision weight: ${sig.revisionWeight.toFixed(3)} (proportion of all typed chars lost to large deletions)${r.latestLargeDeletionChars != null ? ` — latest: ${r.latestLargeDeletionChars} chars removed` : ''}
- Revision timing: ${sig.revisionTiming.toFixed(3)} (0=revisions happened early/false starts, 1=revisions happened late/gutted after drafting)
- Largest single revision: ${sig.largestRevisionNorm.toFixed(3)} percentile
- Latest commitment: ${r.latestCommitmentRatio != null ? `${(r.latestCommitmentRatio * 100).toFixed(0)}% kept` : 'unknown'} (baseline: ${(r.baselineCommitmentMean * 100).toFixed(0)}%, z: ${zCommitment > 0 ? '+' : ''}${zCommitment.toFixed(1)})

=== TEMPORAL ===
- Average hour of day: ${sig.avgHourOfDay.toFixed(3)} (0=midnight, 0.5=noon)
- Day spread: ${sig.daySpread.toFixed(3)} (how many different days of the week)
- Consistency: ${sig.consistency.toFixed(3)} (regularity of spacing between entries)
- Days since last entry: ${sig.daysSinceLastEntry}

=== MOMENTUM (last 7 sessions vs. all-time, 0.5 = stable) ===
- Commitment delta: ${sig.commitmentDelta.toFixed(3)}${sig.commitmentDelta > 0.55 ? ' — increasing' : sig.commitmentDelta < 0.45 ? ' — decreasing' : ''}
- Typing speed delta: ${sig.charsPerMinuteDelta.toFixed(3)}${sig.charsPerMinuteDelta > 0.55 ? ' — speeding up' : sig.charsPerMinuteDelta < 0.45 ? ' — slowing down' : ''}
- Revision weight delta: ${sig.revisionWeightDelta.toFixed(3)}${sig.revisionWeightDelta > 0.55 ? ' — revising more' : sig.revisionWeightDelta < 0.45 ? ' — revising less' : ''}
- P-burst length delta: ${sig.pBurstLengthDelta.toFixed(3)}${sig.pBurstLengthDelta > 0.55 ? ' — longer sustained flows' : sig.pBurstLengthDelta < 0.45 ? ' — flows getting shorter' : ''}

=== STABILITY ===
- Commitment variance: ${sig.commitmentVariance.toFixed(3)} (0=consistent, 1=volatile)
- Fluency variance: ${sig.fluencyVariance.toFixed(3)} (typing speed consistency)
- Session volatility: ${sig.sessionVolatility.toFixed(3)} (how different consecutive sessions are)

=== LANGUAGE SHAPE (structure, not content — MATTR for lexical diversity) ===
- Lexical diversity: ${sig.lexicalDiversity.toFixed(3)} (MATTR — higher=more diverse vocabulary, length-corrected)
- Average sentence length: ${sig.avgSentenceLength.toFixed(3)} (normalized)
- Sentence length variance: ${sig.sentenceLengthVariance.toFixed(3)} (uniform vs chaotic)
- Question density: ${sig.questionDensity.toFixed(3)} (questions per sentence)
- First-person density: ${sig.firstPersonDensity.toFixed(3)} (I/me/my frequency)
- Hedging density: ${sig.hedgingDensity.toFixed(3)} (maybe/perhaps/guess frequency)

=== PATTERNS ===
- Thematic density: ${sig.thematicDensity.toFixed(3)} (higher = more repetitive language across entries)
- Landed ratio: ${sig.landedRatio.toFixed(3)} (how often AI questions resonated)
- Feedback count: ${sig.feedbackCount}

=== RELATIONAL ===
- Latest session deviation: ${sig.latestSessionDeviation.toFixed(3)} (how unusual the most recent session was vs. personal baseline)
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
