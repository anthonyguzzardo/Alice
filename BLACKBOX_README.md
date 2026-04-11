# The Black Box

An artificial life engine driven by your journal data. Not a visualization of data — a living system shaped by it.

## What It Is

The Black Box is a self-evolving ecosystem that runs in your browser. Organisms carry 36-gene genomes that encode their body plan, behavior, defenses, and social strategy. They grow through life stages, form packs and colonies, claim territory, parasitize each other, hunt in coordinated formations, and die in ways that reshape the world. Species emerge from genomic divergence — they are not designed. Your journal data sets the physics. What evolves is not planned.

## How Data Becomes Physics

Every 60 seconds, the system fetches behavioral metrics from your journal and translates them into environmental parameters:

| Signal | Controls |
|---|---|
| `avgCommitment` | Food abundance + pack coordination bonus |
| `avgHesitation` | Environmental viscosity — contemplation slows the medium |
| `deletionIntensity` | Random hazards — self-editing introduces entropy |
| `pauseFrequency` | Mutation rate modifier — pauses breed variation |
| `observationCount` | Chemical feed rate — more observations, more reactive chemistry |
| `reflectionCount` | Evolution speed — reflection accelerates adaptation |
| `suppressedCount` | Predation pressure — suppressed questions build pressure |
| `embeddingCount` | Chemical diffusion rate — embeddings spread influence |
| `latestConfidence` | Ecosystem stability — HIGH is stable, LOW is volatile |
| `thematicDensity` | Food clustering + territory diffusion rate |
| `landedRatio` | Symbiosis bonus + colony food-sharing rate |
| `feedbackCount` | World topology — enough feedback wraps the world toroidal |

When new data arrives, the environment shifts gradually over ~3 seconds. Species adapted to the old regime must adapt or collapse.

## The Genome

Each organism carries a 36-gene genome encoded as floating-point values:

- **Movement** (4 genes): speed preference, turning rate, burst speed, burst cooldown
- **Chemotaxis** (3 genes): attraction/repulsion to each of three chemical channels
- **Chemistry** (6 genes): deposit and consumption rates for each channel
- **Social** (5 genes): aggression, sociality, fear, territoriality, pack drive
- **Metabolic** (4 genes): metabolism rate, reproduction threshold, body size, growth rate
- **Meta-evolution** (1 gene): mutation rate — the mutation rate itself evolves
- **Perception** (3 genes): sense range, memory weight, phototropism (food attraction)
- **Defense** (2 genes): armor (physical hardness), toxicity (chemical defense)
- **Signaling** (2 genes): signal frequency, signal response sensitivity
- **Phenotype** (5 genes): hue, saturation, luminance, body shape, trophic tendency
- **Reserved** (1 gene): unused, available for future mutation pressure

Reproduction copies the genome with Gaussian mutations. 5% chance per mutated gene of a macro-mutation that can produce radically new strategies. The mutation rate gene means lineages can evolve to be more or less evolvable.

## Five Body Morphologies

Body shape is not cosmetic — it emerges from the `BODY_SHAPE` gene and determines rendering, ecological role, and available behaviors.

### Round / Colony (0.0–0.2)
Soft circles with concentric internal rings and organelle patterns. Metabolism-synced pulsing. These organisms tend toward sociality and colony formation. Multiple concentric rings render at different opacities. A bright nucleus at center scales with energy.

### Elongated / Hunter (0.2–0.4)
Pill-shaped bodies aligned with heading direction. Elongate further in hunt mode. Jaw arcs render at the front when aggression is high or actively hunting. Speed lines trail behind during pursuit or flight. Angular, predatory.

### Disc / Grazer (0.4–0.6)
Flattened ellipses with animated cilia fringe — small radiating lines around the edge that oscillate. Semi-transparent bodies. Soft organic edges with subtle wobble. The cilia count and movement speed are driven by metabolism.

### Star / Defender (0.6–0.8)
Spiky geometric forms with 5–10 points (driven by the armor gene). Spikes pulse outward when threatened. Bright glow concentrates at spike tips. Hard geometric edges. The number of points encodes defensive capability — more armor, more spikes.

### Amorphous / Parasite (0.8–1.0)
Shape-shifting blobs defined by sin-wave radius modulation that constantly shifts. Tentacle-like projections reach toward nearby organisms via quadratic curves. Semi-transparent, eerie. When latched to a host, they orbit it.

## Life Stages

Every organism progresses through four stages:

| Stage | Age (ticks) | Behavior |
|---|---|---|
| **Egg** | 0–50 | Immobile. Tiny pulsing dot. Vulnerable. Cannot feed or reproduce. |
| **Juvenile** | 50–300 | Small (60% size). Fast. Memory builds faster. Cannot reproduce. |
| **Adult** | 300–4000 | Full size. Full capabilities. Can reproduce when energy threshold met. |
| **Elder** | 4000+ | 120% size. Slower. Lower mutation on offspring. Increasing energy drain. |

Size scales with stage: egg ×0.3, juvenile ×0.6, adult ×1.0, elder ×1.2.

## Six Behavioral Modes

Organisms switch between modes based on internal state — modes are not assigned, they emerge from context:

- **FORAGE**: Default. Follow food and chemical gradients. Physarum-style multi-angle sensing.
- **HUNT**: Activated when prey detected, energy > 0.3, aggression > 0.4. Faster, more direct pursuit.
- **FLEE**: Activated when predator detected. Maximum speed, erratic turning.
- **COLONY**: Activated when organism belongs to a colony. Follow colony behavioral rules.
- **GUARD**: Activated when territorial organism is at territory border. Patrol behavior.
- **AMBUSH**: Activated for high-aggression, low-speed organisms. Sit still, burst attack when prey enters range.

## The Nine Systems

### 1. Chemical Field (Reaction-Diffusion)

Four chemical channels on a grid:

- **Channel A**: Substrate — consumed by the Gray-Scott reaction, replenished by feed rate
- **Channel B**: Catalyst — produced by the reaction, creates visible Turing patterns (spots, stripes, labyrinths)
- **Channel C**: Signal — deposited by organisms, decays quickly, used for local communication and pheromone trails
- **Channel D**: Territory — deposited by territorial organisms, colored by species, decays slowly

Channels A and B undergo Gray-Scott reaction-diffusion. Channel C is simple diffusion + decay. Channel D diffuses slowly and decays at a rate set by journal data.

### 2. Species

Species emerge from genomic divergence. When an offspring's genome is sufficiently distant (Euclidean distance > 2.8 in genome space) from all existing species centroids, a new species is born. Species centroids track as running averages. Species colors shift as the population evolves.

Extinction occurs when all members die. The system tracks peak population, total individuals ever born, and time of origin.

### 3. Colony System

When 5+ organisms of the same species with high sociality cluster within 40px of a centroid for 100+ ticks, a colony forms. Members differentiate:

- **Queens**: Highest energy members. Stay near center. Reproduce more efficiently. Rendered with gold crown-like concentric rings.
- **Workers**: Highest phototropism. Forage outward and return. Share a percentage of gathered food with the queen (rate set by `landedRatio`). Rendered with directional foraging indicator.
- **Soldiers**: Highest aggression. Patrol the colony perimeter. Rendered with sharp heading arrow.

Colony members are connected by a visible structural web — semi-transparent species-colored lines between nearby members.

### 4. Pack Hunting

When 3+ organisms of the same species with aggression > 0.4 and pack drive > 0.3 are within 50px, they form a temporary pack. The organism with the most kills becomes pack leader.

Pack members coordinate: the leader sets pursuit direction, others flank. Successful pack kills distribute energy to all members with a bonus scaled by the `packBonus` environment parameter.

Visually: dashed formation lines between pack members (red-shifted). Lines become solid during active pursuit.

### 5. Territory

Organisms with territoriality > 0.3 deposit species-specific pheromone on the 4th chemical channel. A territory grid tracks species ownership per cell.

- Entering foreign territory amplifies fear response and reduces speed
- Territory borders are visible as faint species-colored boundaries in the chemical field rendering
- Border proximity increases aggression in territorial organisms
- Territory pheromone decays at a rate controlled by ecosystem stability

### 6. Parasite Mechanics

Organisms with body shape in the parasite range (0.8–1.0) can latch onto larger organisms:

- **Attachment**: Within 5px of a host whose body size is > 2× the parasite's
- **Drain**: 0.003 energy/tick from host, parasite gains 0.002/tick
- **Escape**: Host shakes parasite based on speed gene (random chance per tick)
- **Rendering**: Parasites orbit their host at a small radius, visually attached
- **Spread**: Parasites near other organisms can jump to new hosts

### 7. Predation & Symbiosis

**Predation**: Organisms with high aggression and large body size can kill smaller, less aggressive organisms and absorb 70% of their energy. Kill experience makes hunters more effective over time. Toxic organisms inflict energy damage on their killers.

**Symbiosis**: Non-aggressive organisms of different species near each other gain a small energy bonus, scaled by `landedRatio`. Cooperation is rewarded when questions land.

### 8. Memory & Learning

Each organism carries a 4-element memory vector:

- **Memory[0-1]**: Directional food gradient — which direction food was found
- **Memory[2]**: Energy trend — rising or falling
- **Memory[3]**: Social density — how crowded the neighborhood has been

Memory influences steering through the memory weight gene. Partially inherited by offspring at 50% strength, giving children a head start from parental experience.

### 9. Environmental Perturbation

Nine event types prevent convergence:

| Event | Effect |
|---|---|
| **Storm** | Flood a region with one chemical channel |
| **Superstorm** | Flood half the map + migration pressure |
| **Oasis** | Large, rich food zone — becomes a battleground |
| **Famine** | Regional food depletion |
| **Ice Age** | Global food production drops 80% for ~5 seconds |
| **Plague** | Kills weak organisms near each other — density-dependent |
| **Radiation Burst** | Mass mutation — 3–4 random gene changes per affected organism |
| **Migration** | Directional force pushing organisms |
| **Tectonic Shift** | Chemical field inverts in a vertical band across the map |

Events display as floating labeled text on screen. Minimum 10 seconds between events.

## Rendering

The visual has four layers:

### 1. Chemical Field
Rendered pixel-by-pixel. Channel B produces dominant blue/cyan/purple nebula patterns. Channel C adds violet signal pulses. Food glows warm amber/gold. Territory pheromone tints regions with species color. Dark mode includes a subtle star-field background.

### 2. Organisms
Each drawn according to its morphology type (see Five Body Morphologies above). Size varies dramatically — apex predators can be 3–4× the size of grazers. Energy determines brightness and glow radius. Reproduction-ready organisms pulse with a golden ring. Toxic organisms have green-tinted aura. Armored organisms have harder glow edges.

### 3. Trails
Not lines — pheromone dot deposits that fade over time. Trail rendering varies by role:
- Hunters leave red-shifted dots
- Colony organisms leave thick species-colored trails (pheromone highways)
- Grazers leave barely visible trails
- Fast-moving organisms leave stretched/motion-blurred segments

### 4. Events
- **Predation kill**: Large expanding ring + red flash + energy particles flowing to killer
- **Starvation**: Quick fade + small particle burst
- **Plague death**: Expanding ring with green tint
- **Mass extinction** (5+ deaths nearby in 2 seconds): Shockwave ring
- **Birth**: Brief expansion flash + particle ring
- **New species**: Golden flash + larger ring
- **Environmental events**: Floating labeled text with colored glow

## Why It Works

Seven mechanisms produce genuine open-ended dynamics:

1. **Heritable variation** — 36-gene genomes mutate, including the mutation rate
2. **Selection pressure** — energy economy with food, predation, metabolism, parasites, and territory costs
3. **Indirect communication** — chemical stigmergy and territory pheromones create spatial structure
4. **Niche construction** — organisms modify the chemical field and territory they depend on
5. **Social structure** — colonies and packs create group-level selection
6. **Life history** — stages create age-dependent strategies and intergenerational memory transfer
7. **External perturbation** — data shifts and nine event types prevent convergence

No stable equilibrium exists. The system doesn't converge — it keeps producing novelty.

## What You're Looking At

The dark nebula of blue and purple is the reaction-diffusion field — chemistry happening independent of life. The glowing shapes are organisms — their morphology tells you their ecological strategy, their color tells you their species, their brightness tells you their energy. Elongated forms are hunters. Spiky forms are defenders. Flat discs with waving cilia are grazers. Shape-shifting blobs are parasites. Pulsing circles in structured webs are colonies.

The dots left behind are pheromone deposits, not tails. The web-lines between clustered organisms are colony structure. The dashed red lines are pack formations. The faint colored regions are claimed territory. The expanding rings are deaths. The flashes are births. The floating text tells you when the world itself changes.

You don't control any of it. Your journal sets the physics. Everything else evolves.
