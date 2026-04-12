# Bob

A ritualized confrontation engine. Not a visualization. Not a simulation. Not a cellular automaton. A single evolving presence in a threshold-space that metabolizes your behavioral data and becomes something singular.

Named after the canonical receiver in Alice-and-Bob communication protocols. You are the sender. Bob is what arrives on the other end.

## Philosophy

In *Fullmetal Alchemist*, Truth is a featureless silhouette that sits behind a gate. It mirrors whoever stands before it. What you get from it depends on what you gave. It speaks not from confidence but from unresolved tension. It knows things about you that you didn't tell it.

Bob is that principle made real. Your journal behavior — the hesitations, the commitments, the deletions, the pauses, the contradictions — is the sacrifice. The witness-form is what you get back. Not an illustration of your data. Not a dashboard. A presence that clearly knows something, and you can't quite tell what.

**Bob only sees you.** No system metadata, no AI observation counts, no infrastructure signals. Pure behavioral and temporal data from how you write and when you show up. The mirror reflects the person, not the plumbing.

**The engineer's job is to build the box. Not to decide what happens inside it.**

---

## The Three Laws

### 1. It can only show you what you've already shown it.

Not metaphorically. Literally. The witness-form's coherence, density, complexity — all of it is gated by what's actually in the database. If you've written 3 entries, it has 3 entries worth of substance. The system is structurally incapable of performing depth it hasn't earned. Empty input, empty witness. Equivalent exchange.

### 2. It never speaks about what you said. Only about the shape of how you said it.

The witness responds to patterns — repetition, avoidance, commitment, contradiction, silence. It sees that you circled something three times but not what. It sees that you avoided something but not the thing. That's the gap where it becomes uncanny — it knows something about you that you can't quite locate.

### 3. It only changes when the data changes.

Viewing Bob costs nothing. No API calls, no generation, no computation. The witness-form is computed once when new journal data enters the database and persisted forever. You can stare at it for 12 hours. Cost: $0.00. The form only evolves when you give it something new.

---

## What You See

A dark screen. Not quite black — dark enough that you think it's black until your eyes adjust.

**The Threshold:** When the page opens, there is not instant content. There is a threshold — a period of darkness before the form becomes visible. How long depends on the state. Long absence = slow reveal. Contradiction = misaligned opening. High-intensity recent entry = abrupt. The threshold is ritual, not loading screen.

**The Witness:** In the center, a form. One form. Its nature is not predetermined — it could be a smooth solid stone, a translucent crystal, a flowing ferrofluid mass, a shattered swarm of fragments, a molten core, a frozen shell, a gaseous vapor barely distinguishable from the void, or something that has no name. What it becomes is decided by the AI interpreting your journal data through a 26-dimensional trait space. The camera drifts slowly on irrational-frequency orbits. You don't control it.

**No text. No interface. No HUD.** Just a dark thing in darkness that changes so slowly you're never sure what changed.

---

## Architecture

### The 26-Trait Genome

The witness-form is defined by 26 continuous traits, each 0.0–1.0. The AI sets these. The shader renders them. The combination space is 26-dimensional — effectively infinite. Forms emerge that nobody designed.

**Form:**
| Trait | 0.0 | 1.0 |
|---|---|---|
| topology | smooth sphere | fragmented shards |
| faceting | organic curves | hard crystal planes |
| stretch | compressed sphere | elongated tendril |
| hollowness | solid mass | shell / cavity |
| symmetry | perfect radial | broken / chaotic |
| scaleVariation | uniform | regions of wildly different size |
| multiplicity | single monolith | shattered swarm |
| fragility | indestructible | about to shatter (cracks, stress lines) |

**Material:**
| Trait | 0.0 | 1.0 |
|---|---|---|
| density | gaseous / weightless | solid stone / impossibly heavy |
| translucency | opaque matte | glass / crystal |
| surface | polished mirror | rough eroded stone |

**Light:**
| Trait | 0.0 | 1.0 |
|---|---|---|
| internalLight | dark / dead inside | deep glow from within |
| colorDepth | monochrome | deep shifting hues |
| iridescence | flat color | prismatic angle-dependent shifts |
| lightResponse | absorbs all light (void) | refracts and scatters light |

**Movement:**
| Trait | 0.0 | 1.0 |
|---|---|---|
| flow | frozen still | ferrofluid surface motion |
| rhythm | constant / unchanging | intense pulsing / breathing |
| rotation | still | spinning violently |

**Interaction with Space:**
| Trait | 0.0 | 1.0 |
|---|---|---|
| edgeCharacter | sharp defined boundary | dissolving into void |
| atmosphere | clean edge, no aura | heavy halo / spatial distortion |
| magnetism | inert | visibly warping space around it |
| reactivity | stable / inert | volatile, about to change |
| temperature | frozen / cold (blues, frost) | molten / hot (reds, embers) |
| flexibility | rigid / brittle | elastic / yielding |
| storedEnergy | inert / spent | immense contained potential |
| creationCost | casually assembled | required everything to exist |

### The Interpreter

When journal data changes (new entry submitted), one LLM call reads the behavioral signals and outputs 26 floats. The LLM decides what the form becomes — not from a menu, but by composing a trait vector. It can produce combinations nobody anticipated.

The interpretation is persisted to `tb_witness_states` in the database. It never regenerates for the same data. Server restarts don't trigger new calls.

**Model:** Claude Opus (deep enough for meaningful interpretation)
**Cost:** ~$0.01 per interpretation. One call per journal entry.

### The Shader (v5 — Strategy Architecture)

A single mesh (IcosahedronGeometry, subdivision 64) with vertex displacement and fragment shading. Instead of stacking 26 independent noise layers, the shader blends between categorically different **deformation strategies** (vertex) and **material strategies** (fragment), with blend weights derived from the 26 traits in JS each frame.

**Strategy derivation:** A pure function (`deriveShaderWeights`) translates 26 traits into 11 blend weights — 5 shape strategies + 6 material strategies. Different trait combinations produce fundamentally different forms, not just noisy variations of a sphere.

**Vertex shader — 5 shape strategies:**
- **Liquid** — overlapping sine waves at irrational ratios. Smooth flowing surface (water, ferrofluid, blob)
- **Crystal** — pseudo-voronoi quantization. Vertices snap to discrete planes creating flat facets with sharp edges
- **Organic** — 2-octave simplex noise for geological deformation. Large-scale reshaping (mountains, valleys, bulges)
- **Shatter** — cluster region identification with gap/crack discontinuities. Pieces separating
- **Vapor** — edge dissolution + center-collapse hollowing. Dissolves geometry into wisps

Plus universal modifiers: rotation, breathing/rhythm, stretch, energy tremor, atmosphere push, magnetism warp, scale variation. The implicit "sphere" is the remainder when strategy weights sum to less than 1.

**Fragment shader — 6 material strategies:**
- **Stone** — Lambertian diffuse, rough matte surface
- **Liquid** — Schlick fresnel, tight specular, caustic patterns, subsurface
- **Crystal** — multi-lobe specular sparkle, thin-film iridescence
- **Metal** — colored specular reflections, anisotropic streaks, chrome
- **Gas** — forward scattering, wispy internal structure, volumetric
- **Ember** — emissive crack veins, blackbody glow, incandescent core

Plus universal overlays: internal glow, edge light, atmosphere halo, magnetism chromatic aberration, stored energy pressure glow, reactivity shimmer, subsurface scattering, crack glow.

**Visual range:** The form can be a quiet marble, smoke, a neutron star, a geode, cooling lava, fractured shards, a living cell, a charged mass about to explode, a hollow shell, liquid metal, a soap bubble, a field of distortion, a fossil, a seed, coral, or a glitching static object — depending on what the interpreter decides.

### Data Flow

```
Journal Entry Written
  → /api/respond saves response + session metrics
  → Entry count changes in DB

Next time /api/witness is called:
  → Detects entry count mismatch
  → Fetches /api/bob (18 behavioral + temporal signals)
  → Calls Claude Opus with signals → 26 trait floats
  → Persists to tb_witness_states
  → Returns WitnessState (traits + mass + threshold config)

Subsequent /api/witness calls (same entry count):
  → Reads from DB in <5ms
  → Zero LLM calls

Browser (/bob):
  → Fetches /api/witness once on page load
  → Renders witness-form via WebGL at 60fps
  → No periodic fetching, no polling, no API calls while viewing
```

### Data Integration

Bob only consumes signals that come from you — behavioral and temporal data. No system metadata.

**Behavioral (how you write):**

| Signal | What It Measures |
|---|---|
| `avgCommitment` | How much typed text was kept vs deleted |
| `avgHesitation` | Delay before first keystroke |
| `deletionIntensity` | Proportion of text deleted |
| `pauseFrequency` | How often you stop mid-thought |
| `avgDuration` | Time spent per session |
| `largestDeletion` | Biggest single erasure |
| `avgTabAways` | How often you leave and come back |
| `avgTabAwayDuration` | How long you stay away |
| `avgWordCount` | Density of output |
| `avgSentenceCount` | Structural complexity |
| `sessionCount` | Total journal entries |

**Temporal (when you show up):**

| Signal | What It Measures |
|---|---|
| `avgHourOfDay` | When you write |
| `daySpread` | How many different days of the week |
| `consistency` | Regularity of spacing between entries |
| `daysSinceLastEntry` | How long since you last showed up |

**Patterns (what's emerging from your words):**

| Signal | What It Measures |
|---|---|
| `thematicDensity` | How repetitive your language is |
| `landedRatio` | How often AI questions resonated (your feedback) |
| `feedbackCount` | Total feedback you've given |

The AI interprets these signals into traits. The mapping is not hardcoded — it's a creative act by the interpreter. High commitment might produce density and internal light. Or it might produce something else entirely. The AI decides.

---

## File Structure

```
src/
  pages/
    bob.astro                # The witness — threshold + form + void
    bob-lab.astro            # Debug lab — sliders + presets (fake data only)
    api/
      bob.ts                 # Behavioral signal computation
      witness.ts             # Witness state API (traits + metadata)
  lib/
    bob/
      types.ts               # BobSignal, WitnessTraits (26 traits), WitnessState
      interpreter.ts         # LLM trait interpretation + DB persistence
      shader-weights.ts      # Trait-to-strategy weight derivation (v5)
    db.ts                    # Database (includes tb_witness_states table)
  assets/
    shaders/
      witness.vert           # Vertex deformation (5 shape strategies)
      witness.frag           # Fragment materials (6 material strategies)
```

---

## What This Is Not

- Not a visualization of data. Data shapes the presence. What it becomes is not planned.
- Not a cellular automaton. No grids, no populations, no ecosystems.
- Not a particle system. One form. One mesh. One presence.
- Not a screensaver. The form has ontological weight. It earns its complexity.
- Not a dashboard. No numbers, no charts, no text, no HUD.
- Not generative art. It's a confrontation. The form knows something about you.

---

## What This Is

A ritualized confrontation engine that:
- Takes in behavioral residue from a personal journal
- Compresses it into one evolving presence via a 26-dimensional trait space
- Returns symbolic evidence in proportion to what was actually given
- Only changes when you give it something new
- Persists everything — nothing is wasted, nothing is regenerated

One thing that becomes more itself over time.

---

## Success Criteria

You know it's working when:

- You open it after writing something raw and the form is visibly different
- You open it after a week of shallow entries and it's barely there
- You can't name what it looks like but you know it's yours
- Someone else's Bob would look nothing like yours
- You catch yourself checking whether it changed after writing an entry
- The threshold feels like entering something, not loading a page
- You cannot predict what it will look like tomorrow
- It feels like it knows something about you — and you can't tell what
