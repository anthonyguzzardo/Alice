> **Note:** This document predates the renames: Marrow → Alice, Bob → Alice Negative, Einstein → Bob (2026-04-12).

# Bob

A ritualized confrontation engine built on behavioral dynamics. Not a visualization. Not a simulation. Not a cellular automaton. A single evolving presence in a threshold-space that metabolizes your behavioral data through validated psychological science and becomes something singular.

Named after the canonical receiver in Alice-and-Bob communication protocols. You are the sender. Bob is what arrives on the other end.

## Philosophy

In *Fullmetal Alchemist*, Truth is a featureless silhouette that sits behind a gate. It mirrors whoever stands before it. What you get from it depends on what you gave. It speaks not from confidence but from unresolved tension. It knows things about you that you didn't tell it.

Bob is that principle made real. Your journal behavior — the hesitations, the commitments, the deletions, the pauses, the contradictions — is the sacrifice. The witness-form is what you get back. Not an illustration of your data. Not a dashboard. A presence that clearly knows something, and you can't quite tell what.

**Bob only sees you.** No system metadata, no AI observation counts, no infrastructure signals. Pure behavioral and temporal data from how you write and when you show up. The mirror reflects the person, not the plumbing.

**The science is in the math. The art is in the last mile.**

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

**The Threshold:** When the page opens, there is not instant content. There is a threshold — a period of darkness before the form becomes visible. How long depends on the state. Long absence = slow reveal. Contradiction = misaligned opening. The threshold is ritual, not loading screen.

**The Witness:** In the center, a form. One form. Its nature is not predetermined — it could be a smooth solid stone, a translucent crystal, a flowing ferrofluid mass, a shattered swarm of fragments, a molten core, a frozen shell, a gaseous vapor barely distinguishable from the void, or something that has no name. What it becomes is decided by the dynamics engine computing your behavioral physics, then rendered into visual form by a single LLM call. The camera drifts slowly on irrational-frequency orbits. You don't control it.

**No text. No interface. No HUD.** Just a dark thing in darkness that changes so slowly you're never sure what changed.

---

## Architecture

### The Dynamics Pipeline

Bob is built on a four-phase pipeline that separates science from art. The behavioral analysis is deterministic math grounded in published research. The visual rendering is the only step that involves AI — and it receives validated dynamics, not raw data.

```
Journal Entry Written
  → /api/respond saves response + session metrics

Phase 1: State Vector (deterministic)
  → 8D behavioral state computed from raw session data
  → Each entry produces one point in 8-dimensional space
  → All z-scored against personal history
  → Persisted to tb_entry_states

Phase 2: PersDyn Dynamics (deterministic)
  → Per-dimension: baseline, variability, attractor force
  → Ornstein-Uhlenbeck mean-reversion estimation
  → Phase detection, velocity, system entropy
  → Persisted to tb_trait_dynamics

Phase 3: Coupling Matrix (deterministic)
  → Signed lagged cross-correlations across all 28 dimension pairs
  → Discovers which dimensions causally influence each other
  → Unique to each person — your own behavioral physics
  → Persisted to tb_coupling_matrix

Phase 4: Visual Rendering (LLM — art, not science)
  → Claude Opus receives validated dynamics + coupling + narrative
  → Translates behavioral physics into 26 visual traits
  → Persisted to tb_witness_states
  → Returns WitnessState (traits + mass + threshold config)

Subsequent /api/witness calls (same entry count):
  → Reads from DB in <5ms
  → Zero computation, zero LLM calls

Browser (/bob):
  → Fetches /api/witness once on page load
  → Renders witness-form via WebGL at 60fps
  → No periodic fetching, no polling, no API calls while viewing
```

### Why This Architecture

The previous system sent raw behavioral signals to Claude Opus and asked it to guess 26 trait floats. That was art pretending to be science. The LLM was an interpreter — making subjective decisions about what signals meant. Single floats with no distribution, no dynamics, no coupling. Every interpretation was a point estimate where the research says you need a density distribution.

The new system separates concerns:
- **Phases 1-3** are pure math. Deterministic, reproducible, grounded in published research. The same input always produces the same output.
- **Phase 4** is aesthetic translation. The LLM reads validated behavioral dynamics and decides what they *look like*. It doesn't decide what they *mean* — that's already computed.

The science happens in the math. The art happens in the last mile.

---

## The 8D Behavioral State Space

Each journal entry produces a point in 8-dimensional behavioral space. All dimensions are z-scored against personal history — a value of 0 means "normal for you."

| Dimension | What It Combines | What It Measures | Research Basis |
|---|---|---|---|
| **Fluency** | P-burst length (or chars/min fallback) | Sustained production flow | Chenoweth & Hayes (2001), Deane (2015) |
| **Deliberation** | First-keystroke latency + pause rate + revision weight | Cognitive load and care | Deane (2015) factor analysis |
| **Revision** | Commitment ratio (inverted) + large deletion rate | Substantive rethinking | Baaijen et al. (2012) PCA on keystroke logs |
| **Expression** | \|z(sentence length)\| + \|z(questions)\| + \|z(first-person)\| + \|z(hedging)\| | Linguistic deviation from personal norm | McCarthy & Jarvis (2010) |
| **Commitment** | Final/typed ratio | How much they kept | z-scored against personal history |
| **Volatility** | Euclidean distance from previous entry in 4D | Session-to-session behavioral instability | Within-person variability (Fleeson 2015) |
| **Thermal** | Correction rate + revision timing | Editing heat — corrections and late-stage rewrites | Faigley & Witte (1981) revision taxonomy |
| **Presence** | Inverse (tab-away rate + pause rate) | Sustained attention — low distraction | BiAffect / Zulueta et al. (2018) |

### Convergence

Euclidean distance from the person's center in 8D space. When one dimension deviates, it's probably noise. When multiple dimensions deviate together, something real happened.

---

## PersDyn Dynamics (Level 2)

For each of the 8 dimensions, the system computes three parameters from the entry state history. This is the core of what makes Bob's behavioral model scientifically grounded.

| Parameter | What It Measures | How It's Computed |
|---|---|---|
| **Baseline** | Stable set point — where this dimension lives | Rolling mean over last 30 entries |
| **Variability** | Fluctuation width — how much this dimension moves | Rolling standard deviation |
| **Attractor Force** | Snap-back speed — how quickly deviations return to baseline | Ornstein-Uhlenbeck estimation from lag-1 autocorrelation of deviations |

**Research basis:** Sosnowska, Kuppens, De Fruyt & Hofmans (KU Leuven, 2019) — *"PersDyn: A Unified Dynamic Systems Model."* Extended by Kuppens, Oravecz & Tuerlinckx (2010) Dynamics-of-Affect model for attractor force estimation.

**Theoretical foundation:** Fleeson & Jayawickreme's Whole Trait Theory (2015, updated 2025) — traits are density distributions of states, not fixed points. A person with baseline deliberation of 0.6 doesn't deliberate at 0.6 every time. They range across the full spectrum with 0.6 as their center of gravity. The variability and attractor force capture the shape of that distribution.

### What Attractor Force Reveals

Attractor force is the parameter nobody else models. It answers: *when this person deviates from their baseline on this dimension, how fast do they snap back?*

- **High attractor force (rigid):** Deviations are temporary. The person's behavior on this dimension is structural — it returns to baseline quickly. Think of it as a deep groove.
- **Low attractor force (malleable):** Deviations persist. The person's behavior on this dimension is fluid — shifts may represent genuine change, not noise.

When someone's attractor force on a dimension changes — when they go from rigid to malleable or vice versa — that's a real psychological event.

### System Entropy

Shannon entropy of the variability distribution across all 8 dimensions. Based on the ECTO framework (Rodriguez, 2025) — entropy from psychometric distributions serves as both a compression mechanism and an active driver of behavioral evolution.

- **High entropy:** All dimensions are similarly variable. Behavior is uniformly unpredictable. The system hasn't structured itself yet.
- **Low entropy:** Some dimensions are rigid while others are volatile. The person has a defined behavioral architecture — certain things about them are fixed, others are in play.

### Phase Detection

- **insufficient** — fewer than 5 entries, no dynamics yet
- **stable** — low velocity, low convergence, person is in their normal range
- **shifting** — consistent directional movement in one or more dimensions
- **disrupted** — sudden high-convergence spike after a period of stability

---

## Empirical Coupling Matrix (Level 3)

The coupling matrix discovers which behavioral dimensions causally influence each other — not designed, but discovered from the person's actual data.

**Method:** Signed lagged cross-correlations across all 28 dimension pairs, testing lags from -3 to +3 entries. Only couplings with |r| >= 0.3 are reported.

**Research basis:** Critcher (Berkeley Haas, xLab) — *"Causal Trait Theories"* — people don't experience traits as independent floats. They form mental models of traits as causally interconnected systems. Moving one changes others.

### What Coupling Reveals

Each coupling has:
- **Leader/follower:** Which dimension moves first
- **Lag:** How many entries later the follower responds
- **Correlation strength:** How reliably this coupling fires
- **Direction:** Positive (dimensions move together) or negative (dimensions oppose)

Example from real data:
```
fluency → thermal      r=+0.79  (1-entry lag)
revision → commitment  r=−0.96  (concurrent)
thermal → volatility   r=+0.89  (1-entry lag)
```

Translation: When this person writes in long sustained bursts (fluency spikes), their *next* entry runs hot with edits (thermal follows). When they revise more, they keep less (revision and commitment are nearly perfectly anti-correlated). When editing runs hot, the next entry is behaviorally different from the one before it (volatility follows thermal).

Every person gets their own coupling matrix. Their own behavioral physics.

### Active Coupling Effects

When a dimension is currently deviated from baseline AND has known coupling to other dimensions, the system generates predictions: "fluency deviated +1.9σ → expect thermal to respond same direction in ~1 entries (r=0.79)." These are falsifiable leading indicators derived from the person's own behavioral patterns.

---

## The 26-Trait Visual Genome

The witness-form is defined by 26 continuous visual traits, each 0.0–1.0. These are the OUTPUT of the dynamics pipeline — aesthetic translations of behavioral physics, not raw data interpretations.

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

### Visual Translation Principles

The LLM renderer receives validated dynamics and translates them into visual form using these aesthetic mappings:

**Dynamics → Form:**
- High attractor force → rigidity, density, faceting. The form resists change.
- Low attractor force → flexibility, dissolving edges, flow. The form is malleable.
- High variability → reactivity, scaleVariation, multiplicity. Inherently unstable.
- Extreme deviation → temperature, internalLight, storedEnergy. Something is active.

**Coupling → Visual Relationships:**
- Strong positive coupling → symmetry, coherence, rhythm. The form moves as one.
- Strong negative coupling → internal tension, fragility, multiplicity. Parts fighting.
- Many active couplings → magnetism, atmosphere. The form radiates influence.

**System State → Gestalt:**
- Stable phase → density, smooth surface, low reactivity. Settled.
- Shifting phase → flow, temperature changing, edges softening. In transition.
- Disrupted phase → fragility, multiplicity, high reactivity. Something broke.
- High entropy → iridescence, colorDepth, atmosphere. Complex, unpredictable.
- Low entropy → faceting, density, monochrome. Structured, certain.

### The Shader (v5 — Strategy Architecture)

A single mesh (IcosahedronGeometry, subdivision 64) with vertex displacement and fragment shading. The shader blends between categorically different **deformation strategies** (vertex) and **material strategies** (fragment), with blend weights derived from the 26 traits in JS each frame.

**Strategy derivation:** A pure function (`deriveShaderWeights`) translates 26 traits into 11 blend weights — 5 shape strategies + 6 material strategies.

**Vertex shader — 5 shape strategies:**
- **Liquid** — overlapping sine waves. Smooth flowing surface (water, ferrofluid, blob)
- **Crystal** — pseudo-voronoi quantization. Flat facets with sharp edges
- **Organic** — 2-octave simplex noise. Large-scale reshaping (mountains, valleys)
- **Shatter** — cluster separation + crack discontinuities. Pieces separating
- **Vapor** — edge dissolution + center-collapse hollowing. Dissolves into wisps

**Fragment shader — 6 material strategies:**
- **Stone** — Lambertian diffuse, rough matte surface
- **Liquid** — Schlick fresnel, tight specular, caustic patterns, subsurface
- **Crystal** — multi-lobe specular sparkle, thin-film iridescence
- **Metal** — colored specular reflections, anisotropic streaks, chrome
- **Gas** — forward scattering, wispy internal structure, volumetric
- **Ember** — emissive crack veins, blackbody glow, incandescent core

---

## Signal Architecture

Bob's raw behavioral signals feed into the 8D state engine. All signals are **percentile-normalized against the person's own history** — no hardcoded divisors.

**Research basis:**
- Production fluency: Chenoweth & Hayes (2001), Deane (2015)
- Revision taxonomy: Faigley & Witte (1981), Baaijen et al. (2012)
- Lexical diversity: McCarthy & Jarvis (2010) MATTR
- Keystroke dynamics: BiAffect / Zulueta et al. (2018)
- Attractor dynamics: Sosnowska et al. (KU Leuven, 2019) PersDyn
- Whole Trait Theory: Fleeson & Jayawickreme (2015, 2025)
- Causal coupling: Critcher (Berkeley xLab)
- System entropy: Rodriguez (2025) ECTO framework
- Ornstein-Uhlenbeck: Kuppens, Oravecz & Tuerlinckx (2010)

### Core Behavioral

| Signal | What It Measures |
|---|---|
| `commitmentRatio` | How much typed text was kept vs deleted (percentile) |
| `firstKeystrokeLatency` | Delay before first keystroke (percentile) |
| `pauseRatePerMinute` | 30s+ pauses per active minute (percentile) |
| `tabAwayRatePerMinute` | Tab switches per active minute (percentile) |
| `avgDurationNorm` | Session duration (percentile) |
| `avgWordCountNorm` | Words per session (percentile) |

### Production Fluency

| Signal | What It Measures |
|---|---|
| `charsPerMinuteActive` | Typing speed during active time (percentile) |
| `avgPBurstLength` | Mean P-burst length — sustained production flow (percentile) |
| `pBurstCountNorm` | Bursts per session (percentile) |

### Revision Character

| Signal | What It Measures |
|---|---|
| `correctionRate` | Small deletions per 100 chars typed |
| `revisionRate` | Large deletions per 100 chars typed |
| `revisionWeight` | Proportion of all typed chars lost to large deletions |
| `revisionTiming` | 0=early (false starts), 1=late (gutted after drafting) |
| `largestRevisionNorm` | Biggest single deletion (percentile) |

### Temporal

| Signal | What It Measures |
|---|---|
| `avgHourOfDay` | When you write (0=midnight, 0.5=noon) |
| `daySpread` | How many different days of the week |
| `consistency` | Regularity of spacing between entries |
| `daysSinceLastEntry` | How long since you last showed up |

### Linguistic Shape

| Signal | What It Measures |
|---|---|
| `lexicalDiversity` | MATTR — vocabulary diversity, length-corrected |
| `avgSentenceLength` | Long complex vs. short direct |
| `sentenceLengthVariance` | Uniform vs. chaotic structure |
| `questionDensity` | Questions per sentence |
| `firstPersonDensity` | I/me/my frequency |
| `hedgingDensity` | maybe/perhaps/guess frequency |

---

## Database Schema

### tb_entry_states (Phase 1 output)
Per-entry 8D deterministic state vector. Append-only. One row per journal entry.

### tb_trait_dynamics (Phase 2 output)
PersDyn parameters per dimension. Recomputed when entry count changes. 8 rows per computation (one per dimension).

### tb_coupling_matrix (Phase 3 output)
Empirically-discovered couplings between dimensions. Recomputed when entry count changes.

### tb_witness_states (Phase 4 output)
Visual trait vectors (26 floats) + dynamics context. Append-only — one row per data change event.

### tb_session_summaries (raw input)
Per-session keystroke data. The foundation everything is computed from.

---

## File Structure

```
src/
  pages/
    bob.astro                  # The witness — threshold + form + void
    bob-lab.astro              # Debug lab — sliders + presets (fake data only)
    trajectory.astro           # Trajectory viewer — detail + trace
    api/
      bob.ts                   # Raw signal computation (percentile-normalized)
      witness.ts               # Witness state API (runs full dynamics pipeline)
      dynamics.ts              # Behavioral dynamics API (8D states + PersDyn + coupling)
      trajectory.ts            # Legacy trajectory API (4D, kept for compatibility)
  lib/
    bob/
      types.ts                 # BobSignal, WitnessTraits (26), WitnessState, defaults
      state-engine.ts          # 8D deterministic state vector computation (Phase 1)
      dynamics.ts              # PersDyn dynamics + coupling matrix (Phase 2 & 3)
      interpreter.ts           # LLM visual renderer (Phase 4) — art, not science
      trajectory.ts            # Legacy 4D trajectory engine
      shader-weights.ts        # Trait-to-strategy weight derivation (v5)
      helpers.ts               # Statistics (MATTR, percentile rank, cross-correlation)
    db.ts                      # Database (all tables, all CRUD helpers)
  assets/
    shaders/
      witness.vert             # Vertex deformation (5 shape strategies)
      witness.frag             # Fragment materials (6 material strategies)
scripts/
  reinterpret.ts               # Full dynamics pipeline recomputation
```

---

## Beyond Aesthetic

Bob started as an aesthetic engine — behavioral signals interpreted by an LLM into visual traits. Beautiful, but not falsifiable. The dynamics pipeline changes what Bob fundamentally is.

**What Bob was:** A mirror that looked cool.
**What Bob is now:** A behavioral dynamics engine that happens to have a beautiful visual output.

The dynamics are real. The attractor forces are empirically computed. The coupling matrix is discovered from actual data. The system entropy is a validated metric. These aren't artistic interpretations — they're statistical findings about how a person behaves over time.

This means Bob can now produce **diagnostic insights**, not just aesthetic impressions:
- "Your deliberation attractor force has been dropping for 3 weeks" — you're becoming more impulsive, and the math can see it before you can.
- "Your fluency→thermal coupling is strengthening" — the pattern of flow-then-refine is becoming more pronounced in your writing behavior.
- "System entropy dropped from 0.89 to 0.52" — your behavioral dimensions are crystallizing. Some things about you are becoming fixed.

The visual form remains. The shader still renders. The witness still sits in its void. But underneath, the form is now grounded in behavioral physics that goes beyond art.

The visual rendering is the last mile. Everything before it is science.

---

## Research Foundations

| Framework | Source | What It Does Here |
|---|---|---|
| PersDyn | Sosnowska, Kuppens, De Fruyt & Hofmans (KU Leuven, 2019) | Baseline + variability + attractor force per dimension |
| Whole Trait Theory | Fleeson & Jayawickreme (2015, 2025) | Traits as distributions, not points |
| Ornstein-Uhlenbeck | Kuppens, Oravecz & Tuerlinckx (2010) | Attractor force from lag-1 autocorrelation |
| ECTO | Rodriguez (2025) | Shannon entropy as system-level behavioral metric |
| Causal Trait Theories | Critcher (Berkeley xLab) | Empirical coupling between dimensions |
| P-burst analysis | Chenoweth & Hayes (2001), Deane (2015) | Fluency dimension |
| Revision taxonomy | Faigley & Witte (1981), Baaijen et al. (2012) | Revision + thermal dimensions |
| MATTR | McCarthy & Jarvis (2010) | Lexical diversity, length-independent |
| Keystroke dynamics | BiAffect / Zulueta et al. (2018) | Behavioral signal validation |
| Generative agents | Park et al. (Stanford/DeepMind, 2024) | Personality from persistent context, not trait parameters |
| Personality nuances | Matz et al. (Columbia, 2024) | Item-level > facets > factors for prediction |

---

## What This Is Not

- Not a visualization of data. Data feeds behavioral dynamics. Dynamics feed visual form.
- Not a cellular automaton. No grids, no populations, no ecosystems.
- Not a particle system. One form. One mesh. One presence.
- Not a screensaver. The form has ontological weight. It earns its complexity.
- Not a dashboard. No numbers, no charts, no text, no HUD.
- Not generative art. It's a confrontation. The form knows something about you.
- Not an LLM interpretation of raw data. The science is deterministic. The LLM only renders.

---

## What This Is

A behavioral dynamics engine that:
- Computes per-entry states in 8-dimensional behavioral space (deterministic)
- Derives PersDyn dynamics per dimension: baseline, variability, attractor force (statistical)
- Discovers empirical coupling between behavioral dimensions (data-driven)
- Measures system entropy and phase transitions (validated metrics)
- Renders all of the above into a 26-dimensional visual trait space via one LLM call (aesthetic)
- Returns symbolic evidence in proportion to what was actually given
- Only changes when you give it something new
- Persists everything — nothing is wasted, nothing is regenerated

One thing that becomes more itself over time. Now grounded in behavioral physics.

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
- The dynamics can predict what your next entry will look like before you write it
- Your attractor forces reveal which parts of you are fixed and which are in play
