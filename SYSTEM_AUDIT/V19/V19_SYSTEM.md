# Alice

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## What It Does

Alice asks you one question every day. You answer it. That's it.

There is no feed, no streak counter, no summary of your progress. Your responses go into a black box. You never see them again. The system sees them. You don't.

## Why This Architecture

The 2026-04-16 restructure removed every layer of the system that interpreted the writer back to itself in narrative form: three-frame analysis, suppressed questions, falsifiable predictions, theory confidence scores, multi-model weekly reflection audits. All of it. The reasoning is epistemic, not aesthetic.

**Predict-and-grade on N=1 self-built data has a three-loop circularity.** The designer is the subject and the stimulus source. Deterministic grading reduces but does not break the loop, because the predictions, the questions, and the data-collection rules all originate from the same author. Bayesian confidence over a self-confirming system produces calibrated-looking numbers from a non-falsifiable premise.

**Text-only narrative interpretation is commoditizable.** Anything a frontier model can say after reading the same chat transcript will be reproduced by every future frontier model. Investing the system's depth there means rebuilding it on every model release.

**The behavioral signal substrate is the moat.** Keystroke dynamics (P-bursts, hold/flight time, entropy), revision topology, calibration deltas, parallel behavioral and semantic dynamics — these survive arbitrarily capable future models because the substrate is the writer's body, not their text. A future GPT-N reading the transcript cannot see what the keystroke pipeline measured.

So Alice now does fewer things. Capture signals. Compute deterministic dynamics. Generate tomorrow's question from a bounded context. Persist a structured receipt of recent sessions. Render a designer-facing visualization of the coupling graph. The interpretive surface is intentionally absent.

## Scientific Foundation

Every layer of Alice is grounded in peer-reviewed research. This is not a journaling app with AI bolted on — it is a single-case behavioral measurement instrument designed from validated science.

### Writing Process Research
- **P-burst production fluency** — Chenoweth & Hayes (2001). Text produced between 2-second pauses is the single strongest behavioral predictor of writing quality in process research.
- **Knowledge-transforming vs. knowledge-telling** — Bereiter & Scardamalia (1987), Galbraith (1999, 2009). Reciting existing knowledge vs. producing new thinking through writing.
- **Within-session KT signature** — Baaijen & Galbraith (2012). Short fragmented bursts consolidating into longer sustained bursts as thinking crystallizes — detectable from per-burst sequence data.
- **Deletion decomposition** — Faigley & Witte (1981). Small deletions (<10 chars) are surface corrections; large deletions (≥10 chars) are substantive revisions. The distinction changes interpretation of the same commitment ratio.

### Linguistic Analysis
- **NRC Emotion Lexicon** — Mohammad & Turney (2013), National Research Council Canada. ~14,000 English words with validated binary associations to emotion categories.
- **Linguistic Inquiry and Word Count (LIWC)** — Pennebaker, Boyd, Jordan & Blackburn (2015). Cognitive mechanism words, hedging language, first-person pronoun density as markers of psychological processing.
- **Language use as individual difference** — Pennebaker & King (1999). Function-word usage is more diagnostic of psychological state than content words.
- **Linguistic markers of processing depth** — Tausczik & Pennebaker (2010). Slope of cognitive word density over time outperforms level at any single point.
- **Lexical diversity** — McCarthy & Jarvis (2010). MATTR (moving-average type-token ratio) validated for length-independent measurement on short texts.
- **Expressive writing paradigm** — Pennebaker & Beall (1986). Prompt framing measurably activates deeper cognitive processing and emotional disclosure.

### Behavioral Dynamics
- **Personality Dynamics (PersDyn)** — Sosnowska et al. (2019, 2020), KU Leuven. Per-dimension baseline, variability, attractor force computed from within-person behavioral time series.
- **Whole Trait Theory** — Fleeson & Jayawickreme (2015, 2025). Traits as density distributions of states.
- **ECTO system entropy** — Rodriguez (2025). Shannon entropy of variability distribution as a measure of behavioral system complexity.
- **Ornstein-Uhlenbeck mean-reversion** — applied to behavioral attractor force estimation, revealing whether dimensions are rigid (fast snap-back) or malleable (persistent shifts).

### Interface Design & Data Quality
- **Single-question superiority** — Kocielnik, Xiao, Avrahami & Wilson (2018). Chatbot-style reflection increased word count 40% but decreased cognitive complexity. Conversational interfaces fragment the reflective arc.
- **Audience effect on disclosure** — Bernstein, Bakshy, Burke & Karrer (2013, Stanford). Perceived audience size decreases linguistic complexity. Writing for no one produces richer signal.
- **Introspective vs. performative mode** — Lee, Kim, Chung & Lim (2020). When AI responds substantively between user turns, writers shift from self-reflection to social cognition. The absence of visible AI is a design choice, not a limitation.
- **Slow Technology** — Hallnäs & Redström (2001, KTH). Technology designed for reflection should amplify time, not compress it.
- **Design frictions for mindfulness** — Cox, Gould, Cecchinato, Iacovides & Renfree (2016, UCL). Micro-frictions increased mindfulness without increasing abandonment.
- **Meaningful vs. meaningless smartphone use** — Lukoff, Yu, Kientz & Hiniker (2018, UW). Friction-reducing features associated with less meaningful use.
- **EMA compliance and data quality** — Eisele et al. (2022). Compliance rewards degraded response quality. No gamification is empirically correct.
- **Question fading** — Czerwinski, Horvitz & Wilhite (2004, Microsoft Research). Prompts that fade after being read produce more associative, less literal responses.

### Question Design
- **Desirable difficulties** — Bjork & Bjork (2011, UCLA). Questions requiring generation produce deeper encoding than recognition.
- **Causal framing** — Niles et al. (2014, Harvard). "Why" questions produce more causal reasoning language than "what" questions.
- **Spaced repetition of themes** — Cepeda et al. (2006, UCSD). Optimal inter-study intervals scale with desired retention interval.
- **Retrieval practice over re-exposure** — Roediger & Karpicke (2006). Re-asking a theme as a new question is more powerful than showing prior responses — validates "never surface responses."
- **Interleaving** — Bjork & Bjork (2011). Mixing themes produces deeper processing than clustering them.
- **Narrative identity** — McAdams & McLean (2013). Prompts inviting temporal connection activate deeper narrative processing.
- **Disclosure context** — Pennebaker & Beall (1986). The prompt must create a sense of revealing something, not recording something.
- **Safe challenge framing** — Edmondson (1999, HBS). "What might it look like to sit with..." outperforms "Why do you keep avoiding..."

### Keystroke & Ambient Signal Research
- **Keystroke dynamics as affect signal** — Epp, Lippold & Mandryk (2011, CHI). Different emotions have distinct keystroke signatures.
- **Hold time / flight time decomposition** — Kim et al. (2024, JMIR). Hold time (keydown→keyup) measures motor execution; flight time (keyup→next keydown) measures cognitive planning. *Note: Kim et al.'s reported AUC of 0.997 was computed on n=99 without held-out validation; the decomposition technique is sound but specific performance figures should not be cited as reliable estimates.*
- **Keystroke entropy** — Ajilore et al. (2025, BiAffect). Shannon entropy of inter-key interval distribution. Correlated with executive function (d=-1.28).
- **Error correction as stress indicator** — Vizer, Zhou & Sears (2009, UMBC). Backspace frequency and revision chain topology among the strongest behavioral stress indicators.
- **Writing process logging** — Leijten & Van Waes (2013, Antwerp). Revision behavior reveals planning, translating, reviewing modes.
- **Cognitive rhythms** — Abdullah et al. (2016, Cornell). Time-of-day is a meaningful covariate.

### Calibration Content Extraction (Incidental Supervision)
- **Incidental supervision** — Roth (AAAI 2017). Supervision signals existing in data independently of the task. Calibration responses are the primary task; life-context labels are the byproduct.
- **Data programming / weak supervision** — Ratner et al. (2017, Snorkel). Labeling functions instead of manual annotation.
- **EMA/ESM literature** — Conner & Lehman (2012); Kahneman et al. (2004, DRM). Calibration prompts are functionally involuntary EMAs.
- **Dimensions ranked by effect size on cognitive output**: sleep (Pilcher & Huffcutt 1996, d=-1.55), physical state (Moriarty et al. 2011), emotional events (Amabile et al. 2005), social quality (Reis et al. 2000), stress (Sliwinski et al. 2009), exercise (Hillman et al. 2008), routine (Torous et al. 2016).

### Same-Day Session Delta (Within-Person Control)
- **Expressive writing paradigm** — Pennebaker & Beall (1986). The foundational design: neutral writing as within-person control for emotional writing. Same person, same conditions, different prompt.
- **Within-day variance dominance** — Toledo et al. (2024). 76-89% of stress response variance is within-day. Same-day comparisons capture more signal than between-day comparisons.
- **Self-referential language as detection channel** — Collins et al. (2025). N=258. First-person pronoun density shifts in diary text detect depression with AUC 0.68.
- **Within-person baseline for deception** — Bogaard et al. (2022). Automated feature coding detects truth/lie differences against personal baselines; naive human observers cannot.

### Architectural Constraints
- **Sycophancy as architectural constraint** — Sharma, Perez et al. (Anthropic, ICLR 2024). RLHF-trained models systematically shift outputs toward perceived prompt expectations. Behavioral constraints expressed only as prompts degrade multiplicatively with complexity. Programmatic / deterministic control is required where it matters.
- **Model collapse from self-consuming loops** — Shumailov et al. (Nature 2024). Self-consuming generative loops cause irreversible tail collapse. Deterministic anchors prevent this; their absence does not.
- **LLM self-preference bias** — Panickssery & Bowman (NeurIPS 2024). LLMs recognize and favor their own outputs via perplexity familiarity. The reason Alice does not run an LLM-narrated interpretation layer over its own chat transcript.

## How It Works

### The Two Phases

Alice operates in two phases. The transition is invisible to the user.

#### Phase 1: Seed (Days 1-30)

Thirty questions delivered one per day in a fixed sequence. All thirty are deep, designed to create friction:
1. Unanswerable in one sentence
2. About you, not a topic
3. No right answer
4. Worth returning to in three months

During this phase the questions do not adapt. The signal pipeline runs from day 1 — keystroke dynamics, P-bursts, deletion decomposition, linguistic densities, parallel behavioral and semantic state vectors, calibration deltas. The questions are fixed. The measurement is not.

#### Phase 2: Generated (Day 31+)

After the seeds run out, the system generates tomorrow's question from a bounded context window. Every response is embedded as a vector (Voyage AI) and stored for semantic retrieval. When generating a question, the system assembles:

- **Recent entries** (last 14, verbatim) — raw, uncompressed source of truth.
- **Resonant older entries** retrieved by semantic similarity — past entries that echo current themes, regardless of age.
- **Contrarian entries** retrieved by semantic *dissimilarity* — entries that are most different from current themes. Breaks the echo chamber: if you've been writing about your career for weeks, the contrarian slot surfaces the entry about your dad from three months ago.
- **Recent structured receipts** (last 4 in full; older ones only if RAG resurfaces them by semantic relevance) — deterministic signal digests, not narrative interpretations.
- **Compact behavioral + dynamics + delta signals** — formatted from the deterministic pipeline. The question generator gets to see what the body did; it doesn't get a story about what the body meant.
- **Calibration life-context** — recent sleep / stress / physical-state / emotional-event tags extracted from free-write sessions.
- **Recent question feedback** ("did it land?") — one bit per recent question.

The prompt grows to a fixed size and stays there. Day 50 and day 500 produce prompts of the same scale. Tomorrow's question doesn't exist until you submit today's response. There is nothing to preview, leak, or game.

The generation prompt enforces:
- **Causal/evaluative framing** (Graesser & Person 1994; Niles et al. 2014)
- **Disclosure context** (Pennebaker & Beall 1986)
- **Safe challenge** (Edmondson 1999)
- **Adaptive difficulty** (Bjork & Bjork 2011) — challenge calibrates to recent response complexity (MATTR, cognitive density)
- **Spaced repetition + interleaving** (Cepeda et al. 2006; Bjork & Bjork 2011)

### The Writing Interface

The interface is the instrument. Every design decision is informed by HCI research on how interface affordances affect writing behavior and data quality.

**Deliberate friction** (Hallnäs & Redström 2001; Cox et al. 2016). The textarea activates after a 4-second reflection pause. Autocomplete, autocorrect, spellcheck disabled. No word counts, character counts, or progress indicators.

**Question fading** (Czerwinski, Horvitz & Wilhite 2004). Once writing begins, the question gradually fades to low opacity over 8 seconds. Prompts that recede after being read produce more associative responses.

**Generous writing space** (Kowalski et al.). Tall textarea (400px+) with no visible constraints. People unconsciously try to fill visible space — taller produces longer, wider produces more complex.

**Deferred submit button** (Hallnäs & Redström 2001). Submit is invisible for the first 90 seconds, fades in gently. A visible submit button creates implicit "finish" pressure.

**No placeholder text.** Empty textarea. Placeholder text creates performance anxiety and primes specific response patterns.

**No AI presence cues.** No spinners, typing indicators, processing feedback. When users detect AI processing, they shift from introspective to performative mode (Lee et al. 2020). The interface should feel like paper, not software.

**Monastic minimalism** (CMU HCI; Bernstein et al. 2013). Monochromatic palette. No navigation during writing. No timestamps. The black box principle — never surfacing responses — is empirically validated: writing for no one produces richer signal than writing for any audience.

### Data Collection

Alice captures three layers of data per session, all invisible to the user.

#### Layer 1: Response Text

What you submitted. Stored as-is. Never surfaced back.

#### Layer 2: Behavioral Signal

The system silently captures raw input events throughout the session — keystrokes, deletions, pauses, tab-aways, resumptions. On submission these are crunched into a session summary: a single row of derived behavioral metrics plus context metadata. Per-burst sequence data is captured in `tb_burst_sequences` for within-session pattern detection (Baaijen & Galbraith 2012).

The session summary populates ~50 deterministic signals:
- **First-keystroke latency** — meaningful only against context-matched calibration baseline.
- **P-burst metrics** (Chenoweth & Hayes 2001) — count and average length; full per-burst sequence stored.
- **Commitment ratio** — total typed vs. final character count.
- **Deletion decomposition** (Faigley & Witte 1981) — small (<10 chars, corrections) vs. large (≥10 chars, revisions).
- **Revision timing** — first-half vs. second-half deletion mass.
- **Active typing speed** — chars per minute, excluding pauses and tab-aways.
- **Pause topology, session rhythm, tab-away behavior** — relative to context-matched baselines.
- **Lexical diversity** — MATTR (McCarthy & Jarvis 2010) with 25-word window.
- **Inter-key interval mean and std** (Epp et al. 2011).
- **Hold time and flight time** (Kim et al. 2024) — motor execution vs. cognitive planning, with `e.repeat` filtering and bounded caps.
- **Keystroke entropy** (Ajilore et al. 2025) — Shannon entropy of IKI distribution over 50ms bins.
- **Revision chain topology** (Leijten & Van Waes 2013) — sequential deletions within 500ms grouped as chains.
- **Scroll-back and question-reread counts** (Czerwinski et al. 2004).

Every session also captures **context metadata**: device type, user agent, hour of day, day of week. Comparing your exhausted Friday-night phone session against your focused Tuesday-morning laptop session would manufacture signal that isn't there.

All behavioral metrics are normalized as personal percentiles — compared against the user's own history, not population norms.

#### Layer 2.25: Linguistic Density Profile

Each submission is analyzed server-side for word-category densities using validated lexicons:

- **NRC Emotion Lexicon** (Mohammad & Turney 2013) — six emotion categories: anger, fear, joy, sadness, trust, anticipation.
- **Cognitive mechanism words** (Pennebaker LIWC) — "because," "realize," "whether," "figure" as markers of active reasoning.
- **Hedging language** — "maybe," "perhaps," "seems."
- **First-person pronoun density** — "I," "me," "my."

Stored per session and z-scored against personal history. These feed both the question-generator's compact-signals block (after personal-percentile contextualization) and the parallel semantic state space (see below).

#### Layer 2.5: Parallel Behavioral and Semantic State Spaces

Each session produces two orthogonal state vectors. Behavioral and semantic spaces are kept separate at construction time so coupling discovery and joint-embedding work downstream remain meaningful — a principle borrowed from how multimodal representation learning keeps modalities orthogonal until a learned joint space combines them.

**Behavioral 7D — `tb_entry_states`.** Z-scored against personal history:
- `fluency` — P-burst length (Chenoweth & Hayes 2001, Deane 2015)
- `deliberation` — hesitation + pause rate + revision weight (Deane 2015)
- `revision` — inverted commitment + substantive deletion rate (Baaijen et al. 2012)
- `commitment` — final/typed ratio z-scored
- `volatility` — session-to-session behavioral distance
- `thermal` — correction rate + revision timing (Faigley & Witte 1981)
- `presence` — inverse distraction (tab-away + pause rate)

`expression` was a 7-dimensional sibling until 2026-04-16, when it was relocated into the parallel semantic space. The 8D vectors are preserved under `zz_archive_entry_states_8d_20260416` for the methodology paper.

**Semantic 11D — `tb_semantic_states`.** Z-scored against personal history:
- `syntactic_complexity` — z(avg sentence length) (Biber 1988)
- `interrogation` — z(question density)
- `self_focus` — z(first-person pronoun density) (Pennebaker 1997)
- `uncertainty` — z(hedging density)
- `cognitive_processing` — z(cognitive mechanism density) (Pennebaker LIWC)
- `nrc_anger` / `nrc_fear` / `nrc_joy` / `nrc_sadness` / `nrc_trust` / `nrc_anticipation` — z(NRC emotion densities) (Mohammad & Turney 2013)

Four LLM-extracted dimensions (sentiment, abstraction, agency_framing, temporal_orientation) are schema-ready in `tb_semantic_states` but populated null until the extraction step is built. They will be added to `SEMANTIC_DIMENSIONS` once extraction lands.

**PersDyn dynamics on each space.** The dynamics engine (`src/lib/alice-negative/dynamics.ts`) is generic over a dimension list and runs separately on the behavioral and semantic spaces. For each dimension it computes:
- **Baseline** — rolling mean (30-entry window).
- **Variability** — rolling std.
- **Attractor force** — Ornstein-Uhlenbeck mean-reversion parameter from lag-1 autocorrelation of deviations. High autocorrelation = slow return = LOW attractor force (dimension is malleable, shifts persist). Low autocorrelation = fast snap-back = HIGH attractor force (dimension is rigid).
- **Coupling matrix** — signed lagged Pearson cross-correlations across all dimension pairs. Reveals which dimensions causally lead others *for this specific person* (Critcher, Berkeley xLab; Mesbah et al. 2024).
- **System entropy** — Shannon entropy of the variability distribution across dimensions. High entropy = uniformly variable = unpredictable. Low entropy = some dimensions rigid and others volatile = structured.
- **Phase** — stable / shifting / disrupted, from convergence trajectory.
- **Velocity** — rate of movement through the dim-space.

Behavioral and semantic each persist into their own dynamics and coupling tables (`tb_trait_dynamics` / `tb_coupling_matrix` for behavioral; `tb_semantic_dynamics` / `tb_semantic_coupling` for semantic). The joint-embedding distance function — composed `concat(behavioral 7D, semantic ND)` — is downstream work to be validated against a pre-registered list of hand-labeled session pairs before learned-metric work begins.

**Emotion → behavior coupling — `tb_emotion_behavior_coupling`.** Cross-domain coupling between NRC + Pennebaker densities and behavioral 7D dimensions, also via lagged signed cross-correlation. Discovers chains like "anticipation density spikes → fluency follows two entries later at r=+0.8" without forcing the densities into the behavioral state vector.

### Calibration

The system needs to know what "normal" looks like for you. Without a baseline, every pause looks meaningful and every deletion looks like avoidance.

Calibration is on-demand. After you submit your daily question, a "free write" option appears.

![After submitting, the free write option appears](assets/calibrate_option.png)

Click it, get a neutral prompt — "Describe what you did this morning" or "What's on your desk right now?" — and write. Same textarea. Same invisible behavioral capture. Same session summary with full context metadata. Tagged as calibration data. No interpretive layer runs over calibration text.

![A calibration prompt with the writing surface](assets/calibrate_question.png)

You can do as many as you want. Three in one sitting, or none for a week. Calibration baselines are **context-matched**: deep-question sessions are compared against calibration sessions from the same device type and similar time of day. Baseline confidence is a spectrum — none, low, moderate, strong.

On every calibration submission, Claude Sonnet extracts structured life-context tags from the response text across 7 research-backed dimensions: sleep, physical state, emotional events, social quality, stress, exercise, routine (Roth, AAAI 2017 — incidental supervision). Tags are stored in `tb_calibration_context` with extraction confidence scores and fed into question generation as context. No three-frame interpretation, no psychological inference. Observable facts only. The calibration contract is preserved.

On days with both a calibration and a journal session, the system computes a **same-day session delta** — the behavioral difference between neutral and reflective writing, controlling for daily confounds (sleep, stress, device, time-of-day). This implements Pennebaker's expressive writing paradigm as a within-subjects daily experiment. The delta tracks 10 dimensions: first-person density, cognitive density, hedging density, typing speed, commitment ratio, large deletions, keystroke interval, P-burst length, hold time (motor), flight time (cognitive). After 15+ days the system contextualizes whether today's delta is within or outside personal range — a widening delta means the question provoked more behavioral shift than usual.

![Calibration done state — do another or stop](assets/calibrate_response.png)

The daily question always comes first. You cannot access free writes until you've answered. The daily question is sacred. Calibration is secondary.

### Weekly Structured Receipt

Every 7 sessions a `tb_reflections` row is written. Until 2026-04-16 this row was a 2-3K-token narrative: what the system thought you were doing, with a self-correction section and a Sonnet audit of the Opus reflection. That whole layer was removed.

The reflection is now a deterministic structured receipt with no LLM call: compact behavioral signals across the 7 sessions, dynamics summary (behavioral + semantic), calibration baseline confidence, recent session-delta trend. The same data the designer has access to in the database, formatted for legibility. It still gets embedded so that semantic retrieval at generation time can resurface receipts whose themes are relevant to the current moment — but the payload is structured data, not prose.

### Designer-Facing Visualization

`Alice Negative` was the original 3D witness-form rendered from a single Opus call into a 26-trait visual genome. That rendering still happens for now, but the architectural intent has shifted: the rendering layer is being repurposed into a designer-only visualization of the coupling graph and mode landscape — not a user-facing aesthetic surface. The wall against user-facing drift is a chosen position, not a default.

![Alice Negative — Day 3](assets/bob_Day3.png)

### "Did It Land?"

Every 5th daily submission, a simple yes/no prompt appears below the done message: *"did it land?"* One bit of external signal. A "no" is clear — the question missed. A "yes" is weaker — could mean insightful, uncomfortable, or just emotionally loaded. Stored in `tb_question_feedback` and fed into question generation as a calibration input. This is the only feedback loop the user is asked to participate in.

### Event-Driven Architecture

Everything fires on a single event: the user hitting submit.

#### On Submission (Daily Question)

1. **Response + session summary + context metadata saved** — text, derived behavioral metrics, device/time context.
2. **Background pipeline runs** (non-blocking — the user gets their done message instantly):
   - **Embedding** — entry vectorized via Voyage AI, stored in sqlite-vec for future semantic retrieval. Failures degrade to recency-only retrieval.
   - **Question generation** — during seeds (days 1-30), no-op. After day 30, assembles a bounded context window via semantic retrieval (recent + resonant + contrarian + reflections + behavioral signals + dynamics + life-context + delta + feedback) and generates tomorrow's question.
   - **Witness state rendering** — runs the deterministic pipeline (behavioral 7D states → semantic ND states → dynamics on each → emotion→behavior coupling) and produces a new Alice Negative rendering. As of slice 3, behavioral and semantic spaces persist separately into their own dynamics and coupling tables.

There is no three-frame analysis, no suppressed-question generation, no falsifiable-prediction call, no theory-confidence update. Those layers were removed.

#### On Submission (Free Write)

1. **Response + session summary + context metadata saved** — tagged as calibration. Behavioral data feeds context-matched baselines.
2. **Life-context extraction** (fire-and-forget) — Claude Sonnet extracts structured tags across 7 research-backed dimensions. Failure non-blocking.
3. **No interpretation layer** runs over calibration text.

There are no cron jobs, no scheduled tasks, no server dependencies. The system is fully event-driven. If the user submits, everything runs. If they don't, nothing runs.

## Stack

- **Astro** (SSR, Node adapter)
- **SQLite** via better-sqlite3 + **sqlite-vec** (vector search in the same database)
- **Claude API** (`@anthropic-ai/sdk`) — Claude Sonnet for question generation and calibration content extraction
- **Voyage AI** (`voyageai`) — voyage-3-lite embeddings for semantic retrieval
- **TypeScript** (strict)

## Architecture

- Single user, no auth
- SQLite database at `data/alice.db` (includes vector embeddings via sqlite-vec)
- Seed questions in `src/lib/seeds.ts`
- RAG-based memory: every entry is embedded and retrievable by semantic similarity with recency weighting
- Contrarian retrieval: deliberately surfaces entries that are most *dissimilar* to current themes
- Bounded prompt assembly: recent entries (verbatim) + RAG-retrieved older entries + contrarian entries + structured receipts (recent in full, older via RAG)
- On-demand calibration via free writes with context metadata
- Context-matched baselines with confidence scoring (none / low / moderate / strong)
- Linguistic density pipeline (NRC + LIWC), per-burst sequence capture, calibration content extraction (incidental supervision)
- Same-day session delta with personal-range contextualization
- Behavioral 7D and parallel semantic ND state spaces, kept orthogonal at construction time
- PersDyn dynamics (baseline, variability, attractor force, system entropy, phase, velocity, coupling) computed separately on each space
- Emotion → behavior coupling discovery across the content/process boundary
- Weekly reflection as deterministic structured receipt (no LLM call, no narrative)
- "Did it land?" feedback every 5th submission
- Graceful degradation — if Voyage AI is unavailable, falls back to recency-only retrieval
- All analysis triggered on submit — no cron, no scheduler

### Key Modules

- **State engines** — `src/lib/alice-negative/state-engine.ts` (behavioral 7D), `src/lib/alice-negative/semantic-space.ts` (semantic 11D, schema-ready for 4 LLM-extracted dimensions). Both consume `tb_session_summaries`; both produce z-scored vectors with a convergence scalar.
- **Generic dynamics engine** — `src/lib/alice-negative/dynamics.ts`. Takes a dimension list as parameter; defaults to `STATE_DIMENSIONS` (7D behavioral). Reused over `SEMANTIC_DIMENSIONS` for the parallel space.
- **Emotion profile** — `src/lib/alice-negative/emotion-profile.ts`. Cross-domain coupling between linguistic densities and behavioral state, persisted to `tb_emotion_behavior_coupling`.
- **Witness rendering** — `src/lib/alice-negative/render-witness.ts`. The single entry point that runs both state engines, both dynamics passes, the emotion coupling, and (currently) the visual trait renderer.
- **Signal formatting** — `src/lib/signals.ts`. Research-backed verbalization of behavioral data + dynamics for question-generation prompts. Informed by Netflix "From Logs to Language" (2026), anchoring bias research, "Lost in the Middle" (TACL 2024).
- **Signal registry** — `src/lib/signal-registry.ts`. Canonical vocabulary of ~100 deterministic signals. Used to be the prediction-criteria vocabulary; retained as documentation of what the substrate captures.
- **Question generation** — `src/lib/generate.ts`. Phase-2-only; assembles bounded context and produces tomorrow's question.
- **Linguistic density pipeline** — `src/lib/linguistic.ts`. Server-side computation of NRC + LIWC densities on every submission.
- **Per-burst sequence capture** — client-side P-burst tracking, persisted to `tb_burst_sequences` (character count, duration, start offset per burst).
- **Calibration content extraction** — `src/lib/calibration-extract.ts`. Sonnet-based structured tag extraction from free-write text across 7 life-context dimensions (Roth, AAAI 2017).
- **Calibration-relative deviation** — behavioral metrics compared not just against journal-history percentiles but against neutral free-write baselines.
- **Session-delta engine** — `src/lib/session-delta.ts`. Same-day journal-vs-calibration behavioral shift across 10 dimensions.

### What's Archived (Not Dropped)

The 2026-04-16 restructure preserved everything it removed under `zz_archive_*_20260416` (and `zz_archive_*_8d_20260416` for slice 3). Data is intact for the methodology paper.

- `zz_archive_predictions_20260416` — falsifiable predictions and their grades.
- `zz_archive_theory_confidence_20260416` — Bayesian theory posteriors.
- `zz_archive_ai_observations_20260416` — three-frame analysis output.
- `zz_archive_ai_suppressed_questions_20260416` — disambiguating suppressed questions.
- `zz_archive_question_candidates_20260416` — generation candidates with intervention intent.
- `zz_archive_prediction_status_20260416`, `zz_archive_prediction_type_20260416`, `zz_archive_grade_method_20260416`, `zz_archive_intervention_intent_20260416` — supporting enums.
- `zz_archive_entry_states_8d_20260416` — 8D behavioral state vectors prior to slice 3.
- `zz_archive_trait_dynamics_8d_20260416`, `zz_archive_coupling_matrix_8d_20260416` — dynamics and coupling computed over the 8D set.

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server at `localhost:4321` |
| `npm run build` | Build for production |
| `npm run generate` | Manually trigger tomorrow's question generation |
| `npm run backfill` | Embed all existing entries for RAG retrieval |
| `npm run simulate` | Run simulation (mechanics mode, Haiku) |
| `npm run simulate -- --quality` | Run simulation (quality mode, Sonnet) |
| `npm run simulate -- --dry-run` | Dry run simulation (data only, no AI calls) |

## Philosophy

Every technical decision serves depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.

Every design decision is grounded in peer-reviewed research — not because science legitimizes the work, but because the questions Alice asks about human cognition have been studied for decades, and ignoring that work would mean rebuilding answers that already exist.

The 2026-04-16 restructure was the strongest test of that principle so far. Removing the entire LLM-narrated interpretive layer — three-frame analysis, suppressed questions, falsifiable predictions, Bayesian theory confidence, multi-model audit — meant deleting the most visible work in the system. The decision was not a retreat from ambition. It was a recognition that the substrate that survives arbitrarily capable future models is the keystroke pipeline, the calibration baseline, and the parallel behavioral + semantic dynamics — not any text that a frontier model could generate after reading the same transcript. The interpretive layer can always be rebuilt. The substrate is the work.

Where the research validates what we built, we cite it. Where it challenges what we assumed, we change. Where it has gaps, we experiment — but we name the gap, so we know what's hypothesis and what's evidence.
