# The Black Box

An artificial life engine driven by your journal data. Not a visualization of data — a living system shaped by it.

## What It Is

The Black Box is a self-evolving ecosystem that runs in your browser. Organisms carry genomes that encode their behavior. They sense chemical fields, hunt, flee, cooperate, reproduce with mutation, and die. Species emerge, compete, and go extinct. Your journal data doesn't control what happens — it sets the physics. What evolves is not designed.

## How Data Becomes Physics

Every 60 seconds, the system fetches behavioral metrics from your journal and translates them into environmental parameters:

| Signal | Controls |
|---|---|
| `avgCommitment` | Food abundance — higher commitment means a richer world |
| `avgHesitation` | Environmental viscosity — contemplation slows the medium |
| `deletionIntensity` | Random hazards — self-editing introduces entropy |
| `pauseFrequency` | Mutation rate modifier — pauses breed variation |
| `sessionCount` | (Indirect) Population scaling baseline |
| `observationCount` | Chemical feed rate — more observations, more reactive chemistry |
| `reflectionCount` | Evolution speed — reflection accelerates adaptation |
| `suppressedCount` | Predation pressure — suppressed questions build pressure |
| `embeddingCount` | Chemical diffusion rate — embeddings spread influence |
| `latestConfidence` | Ecosystem stability — HIGH is stable, LOW is volatile |
| `thematicDensity` | Food clustering — repetitive themes cluster resources |
| `landedRatio` | Symbiosis bonus — landed questions reward cooperation |
| `feedbackCount` | World topology — enough feedback wraps the world toroidal |

When new data arrives, the environment shifts gradually over ~3 seconds. Species adapted to the old regime must adapt or collapse. New niches open. Life finds a way or doesn't.

## The Seven Systems

### 1. Chemical Field (Reaction-Diffusion)

Three chemical channels undergo Gray-Scott reaction-diffusion on a grid. This produces organic Turing patterns — spots, stripes, labyrinthine structures — without any organisms present. Organisms interact with this field: sensing gradients, depositing chemicals, consuming them. The chemicals are the medium through which organisms communicate indirectly (stigmergy).

- **Channel A**: Substrate — consumed by the reaction, replenished by feed rate
- **Channel B**: Catalyst — produced by the reaction, creates visible patterns
- **Channel C**: Signal — deposited by organisms, decays quickly, used for local communication

### 2. Genome & Evolution

Each organism carries a 24-gene genome encoded as floating-point values:

- **Movement**: speed preference, turning rate
- **Chemotaxis**: attraction/repulsion to each chemical channel
- **Chemistry**: deposit and consumption rates for each channel
- **Social**: aggression, sociality, fear
- **Metabolic**: metabolism rate, reproduction threshold, body size
- **Meta-evolution**: mutation rate (the mutation rate itself evolves)
- **Perception**: sense range, memory weight, phototropism (food attraction)
- **Phenotype**: hue, saturation, luminance (visible as organism color)

Reproduction copies the genome with Gaussian mutations. Occasionally (5% chance per mutated gene), a large mutation occurs — a macro-mutation that can produce radically new strategies. The mutation rate gene means lineages can evolve to be more or less evolvable.

### 3. Species

Species are not predefined. They emerge from genomic divergence. When an offspring's genome is sufficiently distant (Euclidean distance > 2.5 in genome space) from all existing species centroids, a new species is born. Species centroids track as running averages of their members' genomes. Species colors shift as the population evolves.

A species can go extinct if all its members die. The system tracks peak population, total individuals ever born, and time of origin for each species.

### 4. Ecology

Multiple interaction types create complex dynamics:

- **Predation**: Organisms with high aggression and large body size can kill smaller, less aggressive organisms and absorb their energy. Successful hunters accumulate experience that makes them more effective.
- **Symbiosis**: Non-aggressive organisms of different species near each other gain a small energy bonus, scaled by the `landedRatio` signal. Cooperation is rewarded when questions land.
- **Competition**: All organisms compete for food and chemical resources. Niche partitioning emerges when species evolve different chemical preferences.
- **Niche construction**: Organisms modify the chemical field they depend on. A species that deposits Chemical B while consuming Chemical A reshapes the environment for every other species.

### 5. Memory & Learning

Each organism has a 4-element memory vector updated every tick:

- **Memory[0-1]**: Directional food gradient — encodes which direction food was found
- **Memory[2]**: Energy trend — rising or falling
- **Memory[3]**: Social density — how crowded the neighborhood has been

Memory influences steering decisions through the genome's memory weight gene. An organism that found food to the left will tend leftward. Memory is partially inherited by offspring (at 50% strength), giving children a head start based on parental experience.

### 6. Morphogenesis

When organisms cluster, emergent differentiation occurs:

- **Core cells** slow down, becoming stationary producers
- **Edge cells** maintain speed, acting as foragers and scouts
- **Roles emerge** from behavioral patterns, not assignment:
  - **Foragers** (default): navigate by chemical gradients
  - **Hunters**: organisms with multiple kills and high aggression
  - **Builders**: highly social organisms in dense clusters, visually connected by tendrils

### 7. Environmental Perturbation

Random events prevent the system from converging to equilibrium:

- **Chemical storms**: Flood a region with one chemical channel
- **Food blooms**: Sudden abundance in a localized area
- **Famines**: Regional food depletion
- **Migration pressure**: Directional force pushing organisms
- **Mutagen bursts**: Temporarily elevated mutation across the population

These create punctuated equilibrium — long periods of relative stability interrupted by crises that reorganize the ecosystem.

## Rendering

The visual has three layers:

1. **Chemical field**: Rendered pixel-by-pixel from the three chemical channels. Channel B (the reaction-diffusion catalyst) produces the dominant blue/cyan patterns. Channel C (organism signals) adds violet pulses. Food glows warm green.

2. **Organisms**: Each drawn with a radial gradient glow (color from species genome averages), a bright core, and a white nucleus. Trails show recent movement as colored streaks. Hunters have a red-tinted forward marker. Builders draw connection lines to nearby cluster-mates.

3. **Events**: Death produces expanding rings (with an extra red burst for predation kills). Birth produces brief luminous flashes.

## Why It Works

The combination of five mechanisms produces genuine open-ended dynamics:

1. **Heritable variation** — genomes mutate, including the mutation rate
2. **Selection pressure** — energy economy with food, predation, metabolism costs
3. **Indirect communication** — chemical stigmergy creates spatial structure organisms exploit
4. **Niche construction** — organisms modify the environment they depend on
5. **External perturbation** — data shifts and random events prevent convergence

No stable equilibrium exists. New species emerge, old ones go extinct, strategies that worked yesterday fail tomorrow. The system doesn't converge — it keeps producing novelty.

## What You're Looking At

The dark nebula of blue and cyan is the reaction-diffusion field — chemistry happening independent of life. The glowing dots are organisms. Their color tells you their species. Their brightness tells you their energy. The trails tell you where they've been. The tendrils between clustered organisms show emerging structure. The expanding rings are deaths. The flashes are births.

You don't control any of it. Your journal sets the physics. Everything else evolves.
