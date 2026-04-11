# The Black Box

An artificial life engine. Not a visualization. Not a simulation with a script. A system where you build the substrate, define the physics, and walk away — and something crawls out that you didn't design.

## Philosophy

In *Children of Time*, scientists sent a virus to terraform a planet for humans. Spiders became the dominant species instead. That's the principle here. You don't get to pick what emerges. You set the conditions and the conditions produce outcomes that surprise you — the architect.

This is not a cellular automaton. Not Conway. Not Lenia. Not boids. Not reaction-diffusion wallpaper with bacteria-shaped blobs drifting around. Those are solved. Those are known. The point of this system is to produce behaviors that look like they *mean something* — and you didn't tell them to.

A machine printing words in no particular order in a random language, and you catch yourself reading a sentence. Two shapes locked in orbit that suddenly aren't. A field of noise that develops structure, then rhythm, then something you'd swear is breathing — not because you coded breathing, but because you coded friction and feedback and something *found* breathing on its own. Ten agents arguing. Fungal networks. Brain waves. A black hole. Communication that might not be communication. The system decides. Not you.

**The engineer's job is to build the box. Not to decide what happens inside it.**

---

## Constraints

### Creative Constraints

**Zero.** There are no creative constraints. The agent building this has access to any API, any public library, any part of the codebase, any npm package, any rendering pipeline, any data source. WebGL, WebGPU, Canvas, SVG, Web Audio, WASM — whatever produces the best result. Three.js, d3, Pixi, raw shaders, TensorFlow.js, hand-rolled physics — all fair game. If something exists that makes this better, use it.

Do not ask permission. Do not simplify for safety. Do not reduce scope to be "realistic." Build the most ambitious version.

### Engineering Constraints

These are real and non-negotiable:

1. **It must run.** 60fps on a modern browser. If you need WebGL or WebGPU for performance, use them. If the chemical field needs to be GPU-computed, compute it on the GPU. Do not build a system that looks good on paper and runs at 4fps.

2. **It must be legible.** Not explained — legible. Someone looking at it should be able to tell that things are alive, that they're different from each other, that events are happening. They should not need a manual. The visual language must communicate without a HUD.

3. **Systems must actually interact.** This is where most artificial life projects fail. They build five systems and none of them talk to each other. The genome must *actually drive* the behavior. The chemistry must *actually affect* the organisms. The organisms must *actually change* the chemistry. If a system exists in the code but nothing reads its output, delete it.

4. **The energy economy must work.** If everything dies in 10 seconds, there's no evolution. If nothing ever dies, there's no selection pressure. The metabolism-food-predation loop is the backbone. Get it right or nothing else matters.

5. **It must not converge.** If the system reaches a stable equilibrium and stays there, it has failed. Perturbation, mutation pressure, environmental shifts, spatial heterogeneity — whatever it takes to keep the system producing novelty over time.

---

## Architecture

### The Genome

Organisms carry a genome. The genome is a vector of floating-point genes that encode everything about the organism — how it moves, what it eats, how it reproduces, how it interacts with others, what it looks like, how it responds to chemistry, how aggressive or social or territorial it is.

The genome must include a **meta-evolution gene**: the mutation rate itself is heritable and mutable. Lineages can evolve to be more or less evolvable. This is critical for open-ended dynamics.

Reproduction copies the genome with Gaussian mutations. There should be a small chance per gene of a macro-mutation — a large jump that can produce radically new strategies. Without macro-mutations, the system hill-climbs to local optima and stays there.

The exact number of genes and what they encode is up to the engineer. The spec below suggests categories but does not mandate them. If you find a better decomposition, use it. The requirement is that the genome is rich enough to produce meaningfully different organisms and that every gene actually does something.

**Suggested gene categories** (not mandatory, not exhaustive):
- Movement: speed, turning, burst capability
- Chemotaxis: response to chemical gradients
- Chemistry: what the organism deposits and consumes
- Social: aggression, sociality, fear, territoriality, pack drive
- Metabolic: metabolism rate, reproduction threshold, body size
- Perception: sense range, memory, food attraction
- Defense: armor, toxicity
- Signaling: communication frequency and sensitivity
- Phenotype: color, shape, trophic tendency

### Body Morphologies

Organisms should be visually distinct based on their genome. The shape of an organism should tell you its ecological strategy before you read any data. Predators should look like predators. Grazers should look like grazers. Parasites should look unsettling.

Morphology is not cosmetic — it should emerge from gene values and affect behavior. The engineer decides the mapping. What matters is that when you look at the screen, you see a diverse ecosystem of recognizably different creatures, not a uniform swarm.

### Life Stages

Organisms progress through life stages. At minimum: a vulnerable immobile birth stage, a growth stage, a reproductive adult stage, and an elder stage with declining performance. Stage transitions should be visible — size changes, rendering changes, behavioral changes.

### Behavioral Modes

Organisms switch between behavioral modes based on internal state and environment. These are not assigned — they emerge from context. When an aggressive organism detects prey and has energy, it hunts. When a weak organism detects a predator, it flees. When social organisms cluster, they form colonies. The modes are consequences of gene expression meeting environmental context.

Suggested modes (implement as many as produce interesting dynamics):
- Foraging (default gradient-following)
- Hunting (active pursuit)
- Fleeing (evasion)
- Colony behavior (differentiated roles)
- Territorial guarding
- Ambush predation
- Parasitic attachment

---

## Core Systems

These are the systems that must exist and must interact. How they're implemented is the engineer's decision.

### 1. Chemical Field

A multi-channel chemical field on a grid. Organisms read it, organisms write to it, and it has its own dynamics independent of organisms. At minimum, this should include reaction-diffusion chemistry (Gray-Scott or similar) that produces spatial structure (spots, stripes, labyrinths) on its own. Organisms navigate by chemotaxis and deposit pheromones that other organisms respond to.

The chemistry is not decoration. It is infrastructure. Organisms that modify the chemistry are modifying the environment that other organisms depend on. This is niche construction and it must actually work.

### 2. Species Emergence

Species are not designed. They emerge from genomic divergence. When an offspring's genome is sufficiently distant from all existing species, a new species is born. Species should be tracked — when they emerge, how many exist, when they go extinct. Speciation events should be visible.

### 3. Social Structure

When organisms of the same species cluster spatially and have high sociality genes, they should be able to form colonies with differentiated roles. Queens, workers, soldiers — or whatever role structure the engineer finds produces the most interesting dynamics. Colony members should be visually connected. Colony behavior should be visibly different from solo behavior.

Pack hunting should emerge when aggressive organisms of the same species cluster. Coordinated pursuit should be more effective than solo hunting.

### 4. Territory

Territorial organisms claim space by depositing species-specific pheromone. Territory should be visible. Entering foreign territory should have consequences — increased fear, reduced speed, increased aggression at borders. Territory creates spatial structure in the ecosystem that prevents everything from collapsing into one undifferentiated mass.

### 5. Predation, Parasitism, and Symbiosis

Large aggressive organisms eat smaller ones. Parasitic organisms latch onto hosts and drain energy. Non-aggressive organisms of different species near each other can benefit from proximity. These three interaction types create the food web. Without them, there's no selection pressure and no ecological structure.

Toxic organisms should poison their killers. Armored organisms should be harder to kill. These defenses should be visible.

### 6. Memory and Learning

Organisms carry a small memory vector that tracks recent experience — where food was, whether energy is rising or falling, how crowded the area is. Memory should influence behavior through a heritable memory-weight gene. Offspring should partially inherit parental memory, giving children a head start.

### 7. Environmental Perturbation

The system must include random environmental events that prevent convergence. Storms, famines, plagues, radiation bursts, migrations — events that disrupt the current equilibrium and force re-adaptation. Events should be visible and labeled on screen. They should be frequent enough to prevent stasis but not so frequent that nothing has time to evolve.

---

## Data Integration

The system connects to journal behavioral metrics and translates them into environmental parameters. The mapping should be intuitive: commitment increases food abundance, hesitation increases environmental viscosity, deletion intensity increases entropy, reflection accelerates evolution, suppressed content increases predation pressure.

When new data arrives, the environment shifts gradually — not instantly. Species adapted to the old regime must adapt or collapse. This is the mechanism by which your behavior shapes the ecosystem without controlling it.

The specific signals and their mappings:

| Signal | Controls |
|---|---|
| `avgCommitment` | Food abundance, pack coordination bonus |
| `avgHesitation` | Environmental viscosity |
| `deletionIntensity` | Random hazards, entropy |
| `pauseFrequency` | Mutation rate modifier |
| `observationCount` | Chemical feed rate |
| `reflectionCount` | Evolution speed |
| `suppressedCount` | Predation pressure |
| `embeddingCount` | Chemical diffusion rate |
| `latestConfidence` | Ecosystem stability |
| `thematicDensity` | Food clustering, territory diffusion |
| `landedRatio` | Symbiosis bonus, colony food sharing |
| `feedbackCount` | World topology (toroidal wrapping threshold) |

Data is fetched every 60 seconds. Transitions smooth over ~3 seconds.

---

## Rendering

Four visual layers, composited:

### Layer 1: Chemical Field
Rendered pixel-by-pixel or via shader. The reaction-diffusion channels produce nebula-like patterns in blue/cyan/purple. Signal chemistry adds violet pulses. Food glows warm amber. Territory tints regions with species color. Dark background. This layer should look alive on its own, independent of organisms.

### Layer 2: Organisms
Drawn according to morphology. Size varies dramatically — apex predators should be 3-4x the size of grazers. Brightness = energy. Reproduction-ready organisms pulse. Toxic organisms have green aura. Armored organisms have hard-edged glow. Colony members are connected by visible structural web.

### Layer 3: Trails
Pheromone deposits, not motion trails. They fade over time. Color and density vary by organism role and behavior. Hunters leave red-shifted dots. Colony organisms leave thick species-colored trails. Grazers leave barely visible traces.

### Layer 4: Events
Death: expanding ring + flash. Birth: brief expansion + particles. New species: golden flash. Environmental events: floating labeled text. Mass extinction (5+ deaths nearby in 2 seconds): shockwave ring. These should be readable at a glance — something happened, and you can see what.

---

## What Makes This Work

Seven mechanisms produce open-ended dynamics. All seven must be present and functional:

1. **Heritable variation** — genomes mutate, including the mutation rate
2. **Selection pressure** — energy economy with real consequences
3. **Indirect communication** — chemical stigmergy creates spatial structure
4. **Niche construction** — organisms modify the environment they depend on
5. **Social structure** — colonies and packs create group-level selection
6. **Life history** — stages create age-dependent strategies and intergenerational memory
7. **External perturbation** — data shifts and random events prevent convergence

If any one of these is broken or decorative, the system degrades. They must all function and they must all interact.

---

## What This Is Not

- Not a screensaver. Things must die, be born, evolve, compete, cooperate, and go extinct.
- Not a visualization of data. Data sets the physics. What evolves is not planned.
- Not a cellular automaton. No grids of cells with neighbor-counting rules.
- Not a particle system. Organisms have genomes, memory, life stages, and social behavior.
- Not a designed ecosystem. Species emerge. Behaviors emerge. Structures emerge. If you can predict what it will look like in 10 minutes, you built it wrong.

---

## Success Criteria

You know it's working when:

- You see creatures you didn't design doing things you didn't program
- Species emerge that have strategies you didn't anticipate
- The ecosystem looks fundamentally different every time you reload
- You catch yourself watching it and wondering what something is doing
- Colony structures form and collapse and reform in new configurations
- Predators evolve hunting strategies, prey evolve evasion strategies, and the arms race is visible
- Environmental events cause cascading effects that reshape the population
- You cannot explain why a particular behavior is happening without tracing it back through multiple interacting systems
- Someone looks at it and asks "what is that?" — and you don't have a complete answer
