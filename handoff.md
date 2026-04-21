# Handoff: Avatar Engine + Research Papers + Landscape Survey (2026-04-20)

## What happened this session

Three major workstreams in one session: (1) comprehensive research landscape survey via four parallel agents, (2) two papers drafted and published (Options F and G), (3) Avatar engine upgraded from a forward-only text generator to a full writing process reconstruction engine with seven behavioral modes.

## Part 1: Research Landscape Survey

Four parallel research agents surveyed the field. Key findings:

### Joint text+timing synthesis is genuinely novel
The field is split into two non-overlapping lanes: timing synthesis (given text, generate timing) and text generation (given history, generate text). Nobody has bridged them. Closest prior art: Condrey (2026) bolts synthetic timing onto LLM text, but as separate stages. Alice's Avatar is the only system that jointly generates content from a personal corpus AND timing from a motor profile.

### "Reconstruction validity" does not exist in psychometrics
Structural parallels exist in signal processing (analysis-by-synthesis, Stevens & Halle 1962), control theory (observability, Kalman 1960), and ML (autoencoder reconstruction loss). Nobody has applied reconstruction fidelity as a validation metric for a behavioral measurement instrument. The term and the method are genuinely new.

### Condrey (2026) is the critical paper
Proved timing alone cannot distinguish composition from transcription (99.8% evasion). His solution requirement: "content-process binding." Alice already captures both channels via process signals (text reconstruction, revision coherence, burst semantics) + dynamical signals (PE, DFA, RQA). Published constructive follow-ups: ZK-PoP (zero-knowledge process attestation) and TEE-based architecture. Alice provides the measurement-side answer to his cryptographic proposals.

### Field structure (three independent tracks)
- **Authentication**: UAM BiDA Lab, TypeFormer, 185K-subject benchmarks, 3.25% EER. Mature, not Alice's game.
- **Clinical phenotyping**: BiAffect (phone, simple stats), MCI detection (97.9% sensitivity), PD diagnosis (96.97%). Fragmented, no standardization. Alice's signal depth is differentiated.
- **AI detection**: Kundu/IIIT Delhi + ETS/Vanderbilt. Expanding but broken by Condrey's attack. Needs content-process binding.

### No major AI lab involvement
Anthropic, OpenAI, DeepMind have zero published work on process-level detection. DARPA/IARPA have moved away from keystroke biometrics.

### Key researchers identified
- **Condrey** (theorist, attacks + constructive crypto)
- **Crossley at Vanderbilt** (99% transcription detection, EDM 2024)
- **Acien/Fierrez/Morales at UAM** (KeyGAN for PD phenotyping)
- **Kumar/Kundu at IIIT Delhi** (TypeNet for AI detection)
- **Leow at UIC** (BiAffect mood/cognition)

Research saved to memory: `research_avatar_landscape.md`

## Part 2: Papers Drafted and Published

### Option F: Reconstruction Validity
**File**: `papers/option_f_draft.md` (status: published, slug: `reconstruction-validity`)

Introduces reconstruction validity as a new form of validity evidence in measurement theory. Core argument: if an instrument's extracted measurements contain enough structured information to reconstruct the measured behavior, the measurements are demonstrably sufficient. The reconstruction residual characterizes what the instrument does not capture.

- Formalizes via observability (Kalman 1960) and analysis-by-synthesis (Stevens & Halle 1962)
- Responds directly to Condrey's non-identifiability result
- Defines three residual types: motor (expected small), content (expected decreasing), cognitive (expected persistent)
- Registers falsifiable predictions about convergence trajectory
- 30+ citations, full reference list
- Sits in arc as "the instrument works" paper

### Option G: Irreversible Loss
**File**: `papers/option_g_draft.md` (status: published, slug: `irreversible-loss`)

Information-theoretic argument for process-level cognitive preservation. Core argument: the artifact is a lossy compression of the process, lossy compression is one-way (Shannon 1948), therefore the loss of process data is mathematically irreversible.

- Historical demonstrations: Franklin (cognitive architecture), Dickinson (revision process), Ramanujan (mathematical reasoning), Darwin (idea development)
- Three entropy rates: artifacts (near-zero), genomes (low, self-replicating), process records (maximum, ephemeral)
- Avatar as existence proof that process data is information-rich
- Closing window argument: AI mediation makes unmediated process data uncollectable
- Essayistic register targeting Aeon/Noema

### Option G Skeleton
**File**: `papers/option_g_skeleton.md`

Full skeleton with pre-drafting work, literature engagement plan, open questions.

### Paper Arc (complete)
- **B**: names the threat (construct replacement)
- **A**: demonstrates it in one domain (keystrokes)
- **C**: establishes the stakes (cognitive reserve)
- **D**: derives the design constraints
- **F**: proves the instrument works (reconstruction validity)
- **E**: articulates the philosophical value (the process record)
- **G**: argues the loss is irreversible (information-theoretic urgency)

## Part 3: Avatar Engine Upgrades

### Seven reconstruction modes (up from three)

| Mode | What it reconstructs | Profile source |
|------|---------------------|----------------|
| Forward production | Text from Markov chain | Corpus (journal + calibration) |
| Motor timing | Per-character delays + hold times | ex-Gaussian + digraph map |
| Tempo drift | Slow start, fast middle, slight slowdown | Three-phase arc on mu |
| Content-process coupling | Rare words get longer pauses | Word frequency from corpus |
| Evaluation pauses | Periodic read-back pauses (4-8s) | Every 3-5 P-bursts |
| R-bursts (destruction) | Delete + retype episodes | small/large_del_rate, timing_bias |
| I-bursts (insertion) | Navigate back, insert mid-text | r_burst_ratio (inverse) |

### New Rust capabilities
- **Perplexity computation** (`compute_text_perplexity` + `computePerplexity` napi export): scores text against corpus Markov model for convergence tracking
- **Order-1 backoff chain**: order-2 falls back to order-1 before random restart
- **Sentence structure**: capitalization after periods, period insertion before dead-end restarts
- **Full keystroke event generation**: `key_down_ms` + `key_up_ms` for every character including Backspace events, serialized as `{c, d, u}` wire format
- **Revision synthesis**: Backspace events at profile deletion rates, timing-bias-aware positioning, R-burst deliberation pauses
- **I-burst synthesis**: Navigate-back + insert from Markov chain, reorientation pauses
- **Word frequency map**: built during chain construction for content-process coupling
- **Tempo drift**: three-phase arc (exploring/composing/finishing) modulating ex-Gaussian mu

### Data source fix
Avatar corpus and behavioral profile now include ALL sessions (seed, generated, calibration). Previously excluded `question_source_id = 3` (calibration). Calibration sessions produce equally valid keystroke data and substantially denser Markov chains.

### Clippy clean, 68 tests pass

## Part 4: UI and Infrastructure

### Avatar page updated
- Signal readout split into two rows: row 1 (chars, bursts, pauses, avg iki, elapsed) + row 2 (deletions, r-bursts, i-bursts, eval pauses, tempo)
- Replay handles Backspace events (visible delete + retype)
- Phase indicator showing tempo drift phase (exploring/composing/finishing/done)
- Rolling tempo readout (fast/steady/slow)
- Replays from full `keystrokeStreamJson` instead of text + delays

### Navigation restructured
Two-column dropdown grid replacing the single-column list:
- Left column (Project): Home, Vision, About, Research, Questions, Collaborate
- Right column (Instrument): Overview, Methodology, Papers, Log, Avatar
- Footer row: Journal, Observatory, Sandbox

### Papers index tightened
- Abstracts truncated to first sentence (max 160 chars) on index page
- Tighter spacing: smaller margins, smaller fonts, reduced padding
- Full abstracts still appear on individual paper pages

### AVATAR.md created
Full documentation of the Avatar engine: all seven modes, profile dependencies, napi boundary, adversarial validation loop (scoped), Condrey response (scoped), what the Avatar cannot reconstruct, development guidelines.

## Files created this session

| File | Purpose |
|------|---------|
| `papers/option_f_skeleton.md` | Reconstruction validity skeleton |
| `papers/option_f_draft.md` | Reconstruction validity paper (published) |
| `papers/option_g_skeleton.md` | Irreversible loss skeleton |
| `papers/option_g_draft.md` | Irreversible loss paper (published) |
| `AVATAR.md` | Avatar engine documentation |

## Files modified this session

| File | Change |
|------|--------|
| `src-rs/src/avatar.rs` | Seven reconstruction modes, perplexity, backoff, revision, I-bursts, tempo drift, content-process coupling, word frequency (117 -> 1040 lines) |
| `src-rs/src/lib.rs` | Added `keystrokeStreamJson` to AvatarOutput, added `computePerplexity` napi export, PerplexityOutput struct |
| `src/pages/api/avatar.ts` | Returns keystrokeStreamJson, passes revision profile to Rust, includes calibration sessions |
| `src/lib/libProfile.ts` | Includes all sessions (removed calibration exclusion from 5 queries) |
| `src/pages/avatar.astro` | Two-row signals, backspace replay, phase indicator, tempo readout, stream-based replay |
| `src/components/cmpPublicNav.astro` | Two-column dropdown grid layout |
| `src/pages/papers/index.astro` | Truncated abstracts, tighter list spacing |

## What's next

### Engineering priority: Adversarial validation loop
1. Wire `keystrokeStreamJson` from Avatar output into `computeDynamicalSignals()` and `computeMotorSignals()`
2. Compare synthetic signal vectors to real session signal vectors
3. Per-dimension distance = first reconstruction validity profile
4. This is the number the paper predicts and the engineering the field needs

### Engineering: Perplexity tracking
- After each journal/calibration session, compute perplexity of the response under the Markov model
- Store and plot the trajectory
- Track convergence rate and the order-1 to order-2 transition effect

### Research: Condrey attack experiment
- Design transcription protocol: user transcribes LLM text in the journal interface
- Run authentic + transcribed sessions through full signal pipeline
- Test whether process signals (not just timing) distinguish composition from transcription

### Research: Outreach
- Condrey is the most theoretically aligned researcher. His attack paper identifies the problem; Alice's architecture provides the measurement-side answer.
- BiAffect (Leow at UIC) for clinical phenotyping conversation
- Crossley at Vanderbilt for educational assessment angle

### Papers: Pre-drafting work for remaining options
- Option F needs the adversarial validation number before final version
- Options A, D, E skeletons exist but drafts need the same landscape context now available
