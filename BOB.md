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

### Data Flow

```
Journal Entry Written
  → /api/respond saves response + session metrics (including P-burst data)
  → Entry count changes in DB

Next time /api/witness is called:
  → Detects entry count mismatch
  → Fetches /api/bob (behavioral signals, percentile-normalized)
  → Calls Claude Opus with signals + personal context → 26 trait floats
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

---

## Signal Architecture (V3)

Bob's signals are organized into 8 categories. All signals are **percentile-normalized against the person's own history** — no hardcoded divisors. The interpreter receives each signal with its raw value, personal baseline, and z-score so it can make unambiguous decisions.

**Research basis:**
- Production fluency from Chenoweth & Hayes (2001) and Deane (2015)
- Revision taxonomy from Faigley & Witte (1981) and Baaijen et al. (2012)
- Lexical diversity from McCarthy & Jarvis (2010) MATTR
- Backspace rate validated by BiAffect / Zulueta et al. (2018)

### Core Behavioral

| Signal | What It Measures |
|---|---|
| `commitmentRatio` | How much typed text was kept vs deleted (percentile) |
| `firstKeystrokeLatency` | Delay before first keystroke (percentile) |
| `pauseRatePerMinute` | 30s+ pauses per active minute — time-normalized (percentile) |
| `tabAwayRatePerMinute` | Tab switches per active minute — time-normalized (percentile) |
| `avgDurationNorm` | Session duration (percentile) |
| `avgWordCountNorm` | Words per session (percentile) |

### Production Fluency

P-bursts (text produced between 2-second pauses) are the standard unit of analysis in writing process research. Burst length is the single strongest behavioral predictor of writing quality.

| Signal | What It Measures |
|---|---|
| `charsPerMinuteActive` | Typing speed during active time, excluding pauses and tab-aways (percentile) |
| `avgPBurstLength` | Mean P-burst length in characters — sustained production flow (percentile) |
| `pBurstCountNorm` | Number of 2s-bounded bursts per session (percentile) |

### Revision Character

Small deletions (<10 chars) are corrections — typo fixes, spelling. Large deletions (>=10 chars) are revisions — substantive rethinking. These are different psychological signals that the old system conflated into one ratio.

| Signal | What It Measures |
|---|---|
| `correctionRate` | Small deletions per 100 chars typed |
| `revisionRate` | Large deletions per 100 chars typed |
| `revisionWeight` | Proportion of all typed chars lost to large deletions |
| `revisionTiming` | Where revisions happened: 0=early (false starts), 1=late (gutted after drafting) |
| `largestRevisionNorm` | Biggest single deletion (percentile) |

### Temporal

| Signal | What It Measures |
|---|---|
| `avgHourOfDay` | When you write (0=midnight, 0.5=noon) |
| `daySpread` | How many different days of the week |
| `consistency` | Regularity of spacing between entries |
| `daysSinceLastEntry` | How long since you last showed up |

### Linguistic Shape

Measures the structure of language without reading its meaning. Uses MATTR (Moving-Average Type-Token Ratio) instead of raw TTR — validated as length-independent for short texts.

| Signal | What It Measures |
|---|---|
| `lexicalDiversity` | MATTR — vocabulary diversity, corrected for text length |
| `avgSentenceLength` | Long complex sentences vs. short direct ones |
| `sentenceLengthVariance` | Uniform structure vs. chaotic structure |
| `questionDensity` | Questions per sentence — asking vs. telling |
| `firstPersonDensity` | I/me/my frequency — self-focus |
| `hedgingDensity` | maybe/perhaps/guess frequency — tentativeness |

### Momentum

Recent 7 sessions vs. all-time average. 0.5 = stable, >0.5 = increasing, <0.5 = decreasing.

| Signal | What It Measures |
|---|---|
| `commitmentDelta` | Is commitment trending up or down? |
| `charsPerMinuteDelta` | Is typing speed trending up or down? |
| `revisionWeightDelta` | Is revision intensity trending up or down? |
| `pBurstLengthDelta` | Are sustained flows getting longer or shorter? |

### Stability

| Signal | What It Measures |
|---|---|
| `commitmentVariance` | How much commitment swings session to session |
| `fluencyVariance` | Typing speed consistency |
| `sessionVolatility` | How different consecutive sessions are from each other |

### Relational

| Signal | What It Measures |
|---|---|
| `latestSessionDeviation` | How unusual the most recent session was vs. personal baseline |
| `outlierFrequency` | What % of all sessions are statistical outliers |

### Context for the Interpreter

Every signal is accompanied by a `_raw` object carrying un-normalized values — actual milliseconds, actual chars per minute, personal baseline mean and standard deviation. The interpreter sees:

```
Commitment ratio: 0.72 (personal baseline: 0.81, z: -1.4 — kept less than usual)
Revisions: 1 large deletion (84 chars — substantive rewrite)
Corrections: 3 small deletions (<10 chars — typo fixes)
```

Instead of the old format:

```
Commitment ratio: 0.720
Deletion intensity: 0.310
```

The interpreter doesn't have to guess what a float means. It knows whether a value is unusual for this person, which direction it deviated, and what the raw measurement was.

---

## The Trajectory Engine

Bob has two outputs. The **visual form** is what you see — artistic, interpretive, rendered by a shader. The **trajectory** is what you don't see — mathematical, deterministic, computed from raw data.

### Why Two Branches

The visual form is produced by Opus interpreting signals into 26 traits. That interpretation is non-deterministic — give Opus the same signals twice, you might get different traits. Non-deterministic data can't be used for trajectory analysis because the same state might produce different coordinates.

The trajectory engine bypasses the AI entirely. It goes directly to the raw per-session data in `tb_session_summaries` and `tb_responses` — frozen at submission time, deterministic, never changes.

```
User writes
  → Percentile-normalized signals (shift over time)
      → Opus interprets → 26 traits → shader → visual form (art)

  → Per-session raw data (frozen at submission)
      → Trajectory engine (pure math) → 4 dimensions + convergence
          → feeds Marrow question generation
          → becomes Einstein's foundation
```

### Four Independent Dimensions

V2 used Engagement (duration + word count + sentence count) as a trajectory dimension. Those three are near-perfectly correlated — they're all proxies for output volume. Processing was a single signal (first-keystroke latency). These weren't truly independent.

V3 dimensions are based on validated research: Baaijen et al. (2012) PCA on keystroke logs, Deane (2015) factor analysis, Chenoweth & Hayes (2001) P-burst analysis.

| Dimension | What It Combines | What It Measures | Independence |
|---|---|---|---|
| **Fluency** | P-burst length (or chars/min fallback) | Sustained production flow — how fluidly you produce text | Motor + cognitive flow. Independent of whether you deliberate. |
| **Deliberation** | first-keystroke latency + pause rate/min + revision weight | Cognitive load and care — how much you stop, think, rework | Independent of fluency: you can pause a lot and still write fluidly between pauses. |
| **Revision** | commitment ratio (inverted) + large deletion rate | Substantive editing — how much you reworked (not typo corrections) | Independent of deliberation: you can revise impulsively (low pause, high delete) or thoughtfully. |
| **Expression** | |z(sentence length)| + |z(question density)| + |z(first-person density)| + |z(hedging density)| | Linguistic deviation from personal norm — how differently you wrote | Orthogonal to all three: you can write in your normal voice whether you're fluent or halting, deliberate or impulsive. |

Each dimension is a z-score against the person's own mean. A value of 0 means "normal for you."

### Convergence

Euclidean distance from the person's center in 4D space. When one dimension deviates, it's probably noise. When four dimensions deviate together, something real happened.

### Phase Detection

- **insufficient** — fewer than 3 entries, no baseline yet
- **stable** — low velocity, low convergence, person is in their normal range
- **shifting** — consistent directional movement in one or more dimensions
- **disrupted** — sudden high-convergence spike after a period of stability

### Trajectory Viewer

Available at `/trajectory`. Two views (click to toggle):

- **Detail** — 4 panels, one per dimension, z-scores plotted over time
- **Trace** — single plot, all 4 dimensions collapsed to 2 via PCA, showing the actual path through space

---

## File Structure

```
src/
  pages/
    bob.astro                # The witness — threshold + form + void
    bob-lab.astro            # Debug lab — sliders + presets (fake data only)
    trajectory.astro         # Trajectory viewer — detail (4 panels) + trace (PCA)
    api/
      bob.ts                 # Signal computation (percentile-normalized, MATTR, P-bursts)
      witness.ts             # Witness state API (traits + metadata)
      trajectory.ts          # Trajectory analysis API (4 dimensions + convergence)
  lib/
    bob/
      types.ts               # BobSignal, BobSignalRaw, WitnessTraits (26), WitnessState
      interpreter.ts         # LLM trait interpretation — context-rich input format
      trajectory.ts          # Trajectory engine — z-scores, dimensions, convergence, phase
      shader-weights.ts      # Trait-to-strategy weight derivation (v5)
    db.ts                    # Database (includes tb_witness_states, tb_session_summaries)
  assets/
    shaders/
      witness.vert           # Vertex deformation (5 shape strategies)
      witness.frag           # Fragment materials (6 material strategies)
scripts/
  migrate-session-summaries.ts  # V3 migration — adds enriched columns
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
