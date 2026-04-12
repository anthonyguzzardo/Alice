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

Bob consumes 36 signals organized into 7 categories. All signals come from you — behavioral, temporal, and structural. No system metadata, no AI observations, no response content (only the shape of your language).

**Behavioral (long-term averages of how you write):**

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

**Patterns:**

| Signal | What It Measures |
|---|---|
| `thematicDensity` | How repetitive your language is |
| `landedRatio` | How often AI questions resonated (your feedback) |
| `feedbackCount` | Total feedback you've given |

**Recency (recent window vs. long-term — is the person changing?):**

| Signal | What It Measures |
|---|---|
| `recentCommitment` | Commitment ratio over last 7 entries only |
| `commitmentDelta` | Direction of change (0.5 = stable, >0.5 = increasing, <0.5 = decreasing) |
| `recentHesitation` | Hesitation over last 7 entries |
| `hesitationDelta` | Is hesitation trending up or down? |
| `recentDuration` | Time spent per session recently |
| `durationDelta` | Is session duration trending up or down? |

These are the most important new signals. Without them, Bob's form converges and freezes as cumulative averages stabilize. With them, Bob stays alive — it can see that commitment was 0.8 for months but dropped to 0.4 this week. The delta between who you were and who you're becoming is where the real form lives.

**Variance (stability vs. volatility):**

| Signal | What It Measures |
|---|---|
| `commitmentVariance` | How much commitment swings session to session (0 = consistent, 1 = volatile) |
| `hesitationVariance` | Consistency of hesitation patterns |
| `durationVariance` | Consistency of time spent |
| `sessionVolatility` | How different each session is from the previous one — composite measure |

Same average, completely different forms. A person who's consistently at 0.7 commitment is solid. A person who swings between 0.3 and 0.9 is volatile. Bob can now tell the difference.

**Shape (texture of language structure — not what you said, but how you said it):**

| Signal | What It Measures |
|---|---|
| `vocabularyRichness` | Type-token ratio — how diverse is your word choice? |
| `avgSentenceLength` | Long complex sentences vs. short direct ones |
| `sentenceLengthVariance` | Uniform structure vs. chaotic structure |
| `questionDensity` | How often you ask questions in your responses |
| `firstPersonDensity` | I/me/my frequency — how self-focused is the writing? |
| `hedgingDensity` | maybe/perhaps/guess frequency — how much do you qualify? |

These read the **shape** of your language without reading the meaning. `hedgingDensity` doesn't know what you're hedging about — just that you hedge. `questionDensity` doesn't know what you're asking — just that you're asking rather than telling. The difference between someone who writes "I think maybe I should consider..." and someone who writes "I'm leaving" is visible here without knowing what either person is talking about.

**Relational (how unusual you are relative to yourself):**

| Signal | What It Measures |
|---|---|
| `latestSessionDeviation` | Composite z-score: how unusual was the most recent session compared to your own baseline? |
| `outlierFrequency` | What percentage of all your sessions are statistical outliers? |

A person with many outlier sessions has a fundamentally different form than someone who's consistent. And `latestSessionDeviation` means Bob can react to your most recent entry — if it was unusual for you, the form should show disturbance.

### Why 36 Signals Matter for Trajectory Analysis

The original 18 signals were all cumulative averages. After 100 entries, a single new entry barely moves them. Bob's form would converge and freeze — not because the person stabilized, but because that's what averages do.

The new signals fix this:
- **Recency signals** keep moving because they're windowed (last 7 entries only)
- **Variance signals** capture volatility that averages destroy
- **Shape signals** add a new data channel (language structure) that's independent of behavioral telemetry
- **Relational signals** let the form react to individual unusual sessions

This means the 26-trait vectors Bob produces over time carry genuinely more information. The trajectory through trait-space stays alive at month 6 instead of flatting at month 2. Emergent structure (via PCA or similar) has richer raw material to work with.

The AI interprets all 36 signals into 26 traits. The mapping is not hardcoded — it's a creative act by the interpreter. The AI decides what these signals mean for the form. High commitment might produce density and internal light. Or it might produce something else entirely.

---

## The Trajectory Engine

Bob has two outputs. The **visual form** is what you see — artistic, interpretive, rendered by a shader. The **trajectory** is what you don't see — mathematical, deterministic, computed from raw data.

### Why Two Branches

The visual form is produced by Opus interpreting 36 signals into 26 traits. That interpretation is non-deterministic — give Opus the same signals twice, you might get different traits. Non-deterministic data can't be used for trajectory analysis because the same state might produce different coordinates.

The trajectory engine bypasses the AI entirely. It goes directly to the raw per-session data in `tb_session_summaries` and `tb_responses` — frozen at submission time, deterministic, never changes.

```
User writes
  → 36 aggregated signals (shift over time)
      → Opus interprets → 26 traits → shader → visual form (art)

  → Per-session raw data (frozen at submission)
      → Trajectory engine (pure math) → 4 dimensions + convergence
          → feeds Marrow question generation
          → becomes Einstein's foundation
```

### Four Dimensions

Individual behavioral signals are noisy. A pause could mean contemplation, distraction, or a cat on the keyboard. The trajectory engine doesn't use raw signals as coordinates. It collapses correlated metrics into composite dimensions and z-scores everything against the person's own baseline.

| Dimension | What It Combines | What It Measures |
|---|---|---|
| **Engagement** | duration + word count + sentence count | How much did you give? |
| **Processing** | first-keystroke latency | How hard was it to start? |
| **Revision** | commitment ratio (inverted) + deletion intensity | How much did you change your mind? |
| **Structure** | sentence length + question density + first-person density | How differently did you write vs. your norm? |

Each dimension is a z-score against the person's own mean. A value of 0 means "normal for you." Positive or negative means deviation from your personal baseline in that dimension.

### Convergence

The meta-signal. Euclidean distance from the person's center in 4D space.

When one dimension deviates, it's probably noise. When four dimensions deviate together, something real happened. Convergence separates the two.

- **Low** — normal session, nothing unusual
- **Moderate** — some dimensions moved, worth noting
- **High** — multiple dimensions deviated simultaneously — something shifted

### Phase Detection

The engine detects the current phase of the trajectory:

- **insufficient** — fewer than 3 entries, no baseline yet
- **stable** — low velocity, low convergence, person is in their normal range
- **shifting** — consistent directional movement in one or more dimensions
- **disrupted** — sudden high-convergence spike after a period of stability

### Trajectory Viewer

Available at `/trajectory`. Two views (click to toggle):

- **Detail** — 4 panels, one per dimension, z-scores plotted over time
- **Trace** — single plot, all 4 dimensions collapsed to 2 via PCA, showing the actual path through space

Navigation between journal (`/`), Bob (`/bob`), and trajectory (`/trajectory`) via buttons on each page.

### What This Produces for Marrow and Einstein

The trajectory is the data Bob generates. Not the visual form — the mathematical path through 4D space over time. That path contains:

- **Velocity** — how fast the person is changing
- **Phase** — stable, shifting, or disrupted
- **Convergence spikes** — moments where something coherent happened
- **Direction** — which dimensions are moving and which way

This is the bridge between Marrow and Einstein. Marrow uses the trajectory to decide what to ask next. Einstein uses it to decide how to be.

---

## File Structure

```
src/
  pages/
    bob.astro                # The witness — threshold + form + void
    bob-lab.astro            # Debug lab — sliders + presets (fake data only)
    trajectory.astro         # Trajectory viewer — detail (4 panels) + trace (PCA)
    api/
      bob.ts                 # Behavioral signal computation (36 signals)
      witness.ts             # Witness state API (traits + metadata)
      trajectory.ts          # Trajectory analysis API (4 dimensions + convergence)
  lib/
    bob/
      types.ts               # BobSignal, WitnessTraits (26 traits), WitnessState
      interpreter.ts         # LLM trait interpretation + DB persistence
      trajectory.ts          # Trajectory computation — z-scores, dimensions, convergence, phase
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
