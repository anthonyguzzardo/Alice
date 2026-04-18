Immediate wins (extend existing infrastructure):
  1. MF-DFA (multifractal spectrum width) -- ~40 lines on top of existing DFA. Measures whether cognitive
  variability is "healthy complexity" or "noisy collapse." The spectrum width and asymmetry are genuinely new
  dimensions.
  2. Multiscale Entropy -- iterate existing sample entropy over coarse-grained copies. Detects complexity
  collapse that single-scale entropy misses.
  3. Cross-Recurrence (CRQA) -- compare today's IKI trajectory against yesterday's in shared phase space. Uses
   existing RQA infrastructure. Fundamentally different from digraph stability.
  4. Markov transition matrices -- discretize IKI into fast/medium/slow states, compute transition
  probabilities and entropy rate. Captures magnitude-level dependencies that permutation entropy (ordinal
  only) misses. Absorbing state analysis detects fatigue attractors.

  Medium effort, high payoff:
  5. Visibility graph -- convert IKI to a network, extract degree distribution and clustering coefficient.
  Orthogonal to everything currently computed.
  6. Trigraph latency profiles -- extend existing digraph profiles to syllable-level motor planning.
  7. DCCA between hold and flight -- whether motor-cognitive coupling is scale-invariant or scale-dependent.
  Complements transfer entropy.
  8. Active Information Storage -- separates the "memory" component of typing rhythm from "innovation." High
  AIS = flow. High innovation = responding to new cognitive demands.

⏺ Agent "Startup and indie keystroke research" completed

⏺ All five agents are back. Here's the full synthesis.

  ---
  Research Synthesis: Signals Alice Doesn't Have Yet

  Organized by what's new relative to your 147 signals, prioritized by implementation effort and
   signal value.

  ---
  TIER 1: Extend Existing Infrastructure (~40 lines each)

  ┌──────────────────────┬─────────────────────┬────────────────────────────────────────────────
  ─────────────────────────────────────────┬───────────────┐
  │        Signal        │       Source        │                                What It Adds
  Over Current                                │   Min Data    │
  ├──────────────────────┼─────────────────────┼────────────────────────────────────────────────
  ─────────────────────────────────────────┼───────────────┤
  │ MF-DFA spectrum      │ Kantelhardt 2002,   │ Your DFA gives one exponent. MF-DFA gives a
  spectrum: width measures adaptive           │               │
  │ width                │ Ihlen & Vereijken   │ flexibility vs. rigid/pathological motor
  control. Asymmetry (left vs right skew) tells  │ 256+ IKI      │
  │                      │ 2010                │ you sensitivity to large vs small fluctuations.
                                           │               │
  ├──────────────────────┼─────────────────────┼────────────────────────────────────────────────
  ─────────────────────────────────────────┼───────────────┤
  │ Multiscale Entropy   │ Costa, Goldberger & │ Iterate your existing sample entropy over
  coarse-grained copies (window 2,3,4...).      │               │
  │ (MSE)                │  Peng 2002          │ Healthy systems maintain complexity across
  scales; degraded systems lose it at coarser  │ 200+ IKI      │
  │                      │                     │ scales. Single-scale entropy misses this.
                                           │               │
  ├──────────────────────┼─────────────────────┼────────────────────────────────────────────────
  ─────────────────────────────────────────┼───────────────┤
  │ Cross-Recurrence     │ Shockley 2003, Coco │ Your RQA compares a session to itself. CRQA
  compares today's IKI trajectory against     │ 50+ IKI both  │
  │ (CRQA)               │  & Dale 2014        │ yesterday's in shared phase space. Recurrence
  rate = behavioral coupling across         │ sessions      │
  │                      │                     │ sessions. Fundamentally different from digraph
  stability.                               │               │
  ├──────────────────────┼─────────────────────┼────────────────────────────────────────────────
  ─────────────────────────────────────────┼───────────────┤
  │ Markov transition    │                     │ Discretize IKI into fast/medium/slow states.
  Transition probabilities + entropy rate    │               │
  │ entropy rate         │ Roth 2014, BiAffect │ capture magnitude-level sequential dependencies
   that permutation entropy (ordinal only) │ 100+ IKI      │
  │                      │                     │  misses. Absorbing state analysis detects
  fatigue attractors.                           │               │
  ├──────────────────────┼─────────────────────┼────────────────────────────────────────────────
  ─────────────────────────────────────────┼───────────────┤
  │ Trigraph latency     │ Gunetti & Picardi   │ Your digraph profiles capture key-pair motor
  planning. Trigraphs capture syllable-level │ 200+          │
  │ profiles             │ 2005, Acien 2021    │  planning, a fundamentally different cognitive
  level.                                   │ keystrokes    │
  ├──────────────────────┼─────────────────────┼────────────────────────────────────────────────
  ─────────────────────────────────────────┼───────────────┤
  │                      │ Aalto 136M          │ You have negativeFlightTimeCount. Divide by
  total flight events for a rate. Fast        │               │
  │ Rollover rate        │ keystroke study     │ typists rollover 40-70% of keystrokes. This is
  a flow/automaticity signal, not just a   │ trivial       │
  │                      │                     │ count.
                                           │               │
  └──────────────────────┴─────────────────────┴────────────────────────────────────────────────
  ─────────────────────────────────────────┴───────────────┘

  ---
  TIER 2: New Signal Categories (moderate implementation)

  ┌──────────────────────┬──────────────────┬───────────────────────────────────────────────────
  ────────────────────────────────────────────┬────────────┐
  │        Signal        │      Source      │                                       What It
  Measures                                        │  Min Data  │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │ Ex-Gaussian tau      │ BiAffect /       │ Fit ex-Gaussian to flight time distribution. The
  tau (right-tail heaviness) isolates          │ 50+ flight │
  │ parameter            │ Zulueta 2018     │ cognitive slowing from motor speed. Shifts in tau
  predict mood episodes in bipolar before     │  times     │
  │                      │                  │ summary statistics move.
                                              │            │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │ Precorrection /      │ Springer 2021    │ Three distinct phases around each deletion: (1)
  latency before backspace (error sensing), (2) │ any        │
  │ postcorrection       │ (Lindgren)       │  deletion speed, (3) latency after correction
  (re-orienting). You capture phase 1 as          │ session    │
  │ latency              │                  │ errorDetectionLatencyMean. Phases 2 and 3 are new.
                                              │            │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │ Clause-boundary      │ Torrance         │ You have within-word / between-word /
  between-sentence pauses. Clause-boundary pauses         │            │
  │ pauses               │ (Nottingham),    │ (between clauses within a sentence) are a distinct
   cognitive level: syntactic planning vs.    │ event log  │
  │                      │ Antwerp          │ conceptual planning. Requires detecting clause
  boundaries in reconstructed text.              │            │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │                      │ Lindgren (Umeå), │ How far back in the text each revision targets
  (character offset from leading edge). Your     │            │
  │ Revision distance    │  ScriptLog       │ contextualRevisionCount counts them; revision
  distance measures depth. A revision 5 chars     │ event log  │
  │                      │                  │ back is typo fixing. A revision 200 chars back is
  structural rethinking.                      │            │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │ Punctuation key      │ Clinical         │ Isolate latencies for period, comma, question
  mark, apostrophe. These cluster separately from │ keystroke  │
  │ latency              │ keystroke        │  letter-key latencies as a distinct "cognition
  score" in clinical research. Punctuation       │ stream     │
  │                      │ research         │ requires syntactic decision-making, not just motor
   execution.                                 │            │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │ Adjacent key         │ Giancardo        │ Covariance between consecutive key hold times.
  Motor coordination decay signal. Your          │ 30+ hold   │
  │ hold-time covariance │ (neuroQWERTY)    │ lateralized hold times measure hand asymmetry;
  this measures sequential motor coupling.       │ pairs      │
  │                      │                  │ Degrades before mean hold time shifts in PD.
                                              │            │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │ Active Information   │ Lizier 2012      │ How much of the IKI series' past predicts its own
  future. High AIS = rhythmically             │ 200+ IKI   │
  │ Storage (AIS)        │                  │ self-sustaining (flow). Complements transfer
  entropy (cross-prediction) with self-prediction. │            │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │ DCCA exponent (hold  │ Podobnik &       │ Whether motor-cognitive coupling is
  scale-invariant or scale-dependent. Your transfer entropy │ 100+ each  │
  │ vs flight)           │ Stanley 2008     │  measures directed info flow; DCCA measures shared
   fractal scaling.                           │ series     │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │                      │                  │ Convert IKI to a network (points connected if they
   "see" each other). Degree distribution     │            │
  │ Visibility graph     │ Lacasa 2008      │ exponent maps to Hurst exponent but captures
  asymmetric properties. Clustering coefficient    │ 100+ IKI   │
  │ metrics              │                  │ measures local temporal structure. Community
  detection segments session into dynamically      │            │
  │                      │                  │ distinct episodes without arbitrary thresholds.
                                              │            │
  ├──────────────────────┼──────────────────┼───────────────────────────────────────────────────
  ────────────────────────────────────────────┼────────────┤
  │ Diurnal cycling of   │                  │ Track how each signal's value varies by
  hour-of-day across sessions. You have hour_typicality │ 20+        │
  │ keystroke features   │ BiAffect         │  for session timing. This extends to: is your
  fluency at 3am different from your fluency at   │ sessions   │
  │                      │                  │ 2pm? Per-signal circadian profiles.
                                              │            │
  └──────────────────────┴──────────────────┴───────────────────────────────────────────────────
  ────────────────────────────────────────────┴────────────┘

  ---
  TIER 3: Deep Additions (higher effort, high uniqueness)

  ┌─────────────────────┬─────────────────┬─────────────────────────────────────────────────────
  ──────────────────────────────────────────────┬──────────┐
  │       Signal        │     Source      │                                         What It
  Measures                                          │ Min Data │
  ├─────────────────────┼─────────────────┼─────────────────────────────────────────────────────
  ──────────────────────────────────────────────┼──────────┤
  │ Wavelet energy      │ Dingwell &      │ CWT decomposes IKI into frequency bands.
  Low-frequency = paragraph-level cognitive planning.      │          │
  │ ratio               │ Cusumano 2000   │ High-frequency = motor microstructure. The ratio
  between bands is a scale-separated fluency       │ 128+ IKI │
  │                     │                 │ measure your DFA can't provide.
                                                │          │
  ├─────────────────────┼─────────────────┼─────────────────────────────────────────────────────
  ──────────────────────────────────────────────┼──────────┤
  │                     │                 │ Discretize IKI into symbols
  (fast/medium/slow/pause), analyze the grammar. Forbidden patterns     │          │
  │ Symbolic dynamics / │ Amigo 2010, Daw │ (symbol sequences that never appear) detect
  deterministic structure in short, noisy series where  │ 100+ IKI │
  │  forbidden words    │  2003           │ other methods fail. Lempel-Ziv complexity on the
  symbolic sequence captures algorithmic           │          │
  │                     │                 │ complexity that neither Shannon, permutation, nor
  compression ratio characterize.                 │          │
  ├─────────────────────┼─────────────────┼─────────────────────────────────────────────────────
  ──────────────────────────────────────────────┼──────────┤
  │                     │                 │ Positive = sensitive dependence on initial
  conditions = the cognitive-motor system is chaotic     │          │
  │ Lyapunov exponent   │ Rosenstein 1993 │ (small perturbations amplify). Near-zero = stable,
  predictable. The sharpest tool for             │ 200+ IKI │
  │                     │                 │ distinguishing "healthy variability" from "noisy
  breakdown."                                      │          │
  ├─────────────────────┼─────────────────┼─────────────────────────────────────────────────────
  ──────────────────────────────────────────────┼──────────┤
  │                     │ Gilden 1995,    │ Separates white noise, flicker noise, and random
  walk components in IKI timing. Unlike DFA        │          │
  │ Allan variance      │ IEEE 1139       │ (single exponent), gives interpretable noise-type
  decomposition. Identifies the timescale at      │ 100+ IKI │
  │                     │                 │ which rhythm is most/least stable.
                                                │          │
  ├─────────────────────┼─────────────────┼─────────────────────────────────────────────────────
  ──────────────────────────────────────────────┼──────────┤
  │ EMD / Hilbert-Huang │ Huang 1998,     │ Fully adaptive decomposition (no basis function
  assumption). Number of meaningful IMFs =          │          │
  │  instantaneous      │ Tilsen &        │ independent temporal scales in typing. Instantaneous
   frequency reveals when cognitive rhythm      │ 100+ IKI │
  │ frequency           │ Arvaniti 2013   │ accelerates/decelerates within a session, which
  fixed-window methods (quartile tempo drift) miss. │          │
  ├─────────────────────┼─────────────────┼─────────────────────────────────────────────────────
  ──────────────────────────────────────────────┼──────────┤
  │ Backspace rate      │                 │ Cluster users by backspace rate patterns. In
  BiAffect's bipolar cohort, Medium vs High backspace  │ 20+      │
  │ phenotyping         │ BiAffect 2024   │ phenotypes mapped to different psychiatric symptom
  clusters. For N=1 longitudinal: track which    │ sessions │
  │                     │                 │ phenotype your sessions fall into over time.
                                                │          │
  ├─────────────────────┼─────────────────┼─────────────────────────────────────────────────────
  ──────────────────────────────────────────────┼──────────┤
  │ Abandoned thought   │ Novel (from     │ You detect abandoned thoughts. Add: the IKI pattern
  in the 5 keystrokes immediately before and    │ event    │
  │ temporal signature  │ event log)      │ after the abandonment. Does the writer speed up
  (flight from the idea) or slow down               │ log      │
  │                     │                 │ (deliberation)? The micro-signature around the
  abandonment is the cognitive event.                │          │
  └─────────────────────┴─────────────────┴─────────────────────────────────────────────────────
  ──────────────────────────────────────────────┴──────────┘

  ---
  TIER 4: Startup/Intelligence Insights (not signal-level, but architectural)

  ┌────────────────────┬─────────────────────┬──────────────────────────────────────────────────
  ─────────────────────────────────────────────────────────┐
  │      Concept       │       Source        │
  Relevance                                                 │
  ├────────────────────┼─────────────────────┼──────────────────────────────────────────────────
  ─────────────────────────────────────────────────────────┤
  │ Cognitive intent   │ BioCatch (Unit      │ Not just "how are you typing" but "what cognitive
   mode are you in." Hesitation before specific content    │
  │ inference          │ 8200)               │ types, segmented vs. fluid production. Alice's
  signal pipeline is the substrate; this is the interpretive │
  │                    │                     │  layer.
                                                           │
  ├────────────────────┼─────────────────────┼──────────────────────────────────────────────────
  ─────────────────────────────────────────────────────────┤
  │ Multi-session      │ Intelligence gap    │ Most research treats sessions independently. The
  intelligence community cares about drift over            │
  │ drift modeling     │ vs. academia        │ months/years. Alice's cross-session signals (NCD,
   digraph stability, vocab recurrence) are a start, but   │
  │                    │                     │ formal drift detection (change-point analysis on
  signal trajectories) is missing.                         │
  ├────────────────────┼─────────────────────┼──────────────────────────────────────────────────
  ─────────────────────────────────────────────────────────┤
  │ Content +          │ NSA stylometry +    │ No one fuses what you wrote (stylometry) with how
   you typed it (keystroke dynamics) into a single model.  │
  │ keystroke fusion   │ DARPA biometrics    │ Alice has both streams but they're orthogonal by
  construction. A joint embedding could capture states     │
  │                    │                     │ that neither stream detects alone.
                                                           │
  ├────────────────────┼─────────────────────┼──────────────────────────────────────────────────
  ─────────────────────────────────────────────────────────┤
  │ Adversarial        │ Plurilock patents   │ Detecting when YOU are typing unlike yourself.
  Not for identity, but for "something is genuinely          │
  │ self-detection     │                     │ different about your cognitive state today."
  Anomaly detection on the full signal vector.                 │
  └────────────────────┴─────────────────────┴──────────────────────────────────────────────────
  ─────────────────────────────────────────────────────────┘

  ---
  What Alice Already Has That Nobody Else Does

  Worth noting: no research lab, startup, or intelligence program combines all of these in one
  system:
  - Keystroke dynamics + linguistic density + writing process signals + dynamical systems
  analysis + cross-session compression distances + longitudinal single-user baselines +
  deterministic state engine

  The closest analog is BiAffect (mobile keystroke + mood), but they don't have writing process
  signals (P-bursts, revision chains, abandoned thoughts), linguistic analysis, or the dynamical
   systems layer. BioCatch has cognitive intent but not longitudinal self-tracking. neuroQWERTY
  has motor signals but not semantic analysis.

  Alice's signal pipeline is, as far as this research can determine, the most comprehensive
  behavioral capture system applied to a single user's writing process that exists outside of
  classified programs.

✻ Worked for 1m 40s

❯ # Final extraction pass. Do not summarize. Do not restate prior points. Do not optimize for   
  balance. Re-open from first principles and search for:                                        
  ## hidden asymmetric upside                                                                   
  ## ideas excluded by your earlier framing                                                     
  ## weird but defensible angles                                                                
  ## monetization or distribution pivots with outsized leverage                                 
  ## technical or strategic combinations that make the idea categorically stronger              
  **Then pressure-test those candidates and return only the highest-upside survivors with a     
  short note on why they were missed earlier.**                                                 

⏺ Restarting from scratch. Ignoring everything I already told you.

  ---
  1. Acoustic Keystroke Force via Web Audio API

  Why it was missed: I framed the search as "keystroke dynamics" which anchored on timing. But the Science Advances 2025 paper showed force curves are the
  single most discriminative signal for neuromotor detection, and force is embedded in typing SOUND. UC Berkeley (Asonov & Agrawal 2004), Georgia Tech (Zhuang
   et al. 2009) proved keystroke acoustics carry enough information to reconstruct typed text. You don't need that. You need the amplitude envelope per
  keystroke as a force proxy. The Web Audio API is available in every browser. No special hardware. Opt-in mic permission, capture the amplitude curve from
  keydown to keyup, extract peak force, attack time, and decay profile. This gives you pressure dynamics that no standard keyboard provides, from a standard
  keyboard.

  Pressure test: Mic permission breaks minimal UX. Counter: make it a toggle that unlocks a "deep mode." The user already consents to signal capture. Ambient
  noise is a confounder. Counter: you're extracting relative force profiles within a session, not absolute amplitude. The signal is the variance, not the
  level.

  Why it's asymmetric: Nobody else is doing acoustic-keystroke force extraction for cognitive monitoring. Hardware keyboards have zero pressure data. This
  sidesteps the hardware limitation entirely.

  ---
  2. Question-as-Treatment-Variable

  Why it was missed: I searched for "how to capture better signals" when the highest-leverage insight is about experimental design, not instrumentation. Alice
   controls the stimulus. Every question is an intervention. Every behavioral response is a treatment effect. No keystroke dynamics lab has this because they
  don't control what the subject writes about.

  What this unlocks: Retroactive question difficulty scoring. Which questions produce knowledge-transforming signatures (late-stage deletion, burst
  consolidation, high deliberation)? Which produce avoidance (fast, high commitment, low revision)? Which produce genuine depth vs. performative depth? Over
  30+ days, you build a question-response coupling matrix that tells Alice which question TYPES land for THIS user, not from self-report ("did it land?"), but
   from behavioral ground truth.

  Pressure test: You need enough questions with enough behavioral variance to learn the coupling. After 50+ entries this is real. Before that it's noise.

  Why it's asymmetric: This turns Alice from a journaling tool into a single-subject experimental platform. The question generation system can be conditioned
  on behavioral response, not just topic coverage.

  ---
  3. Mouse/Cursor Trajectory During Pauses

  Why it was missed: Alice captures scroll events and keystroke events but ignores the cursor. BioCatch's 3,000-signal system treats mouse behavior during
  non-mouse tasks as a primary cognitive channel.

  Specific signals:
  - Cursor drift toward submit button during pauses = readiness to quit
  - Cursor hovering over own text = re-reading without selecting (different from scrollBack)
  - Cursor movement velocity during pauses = agitation vs. stillness
  - Cursor position at moment of re-engagement (where does attention return?)
  - Total mouse distance during session vs. total typing time = fidget ratio

  Pressure test: On mobile there's no cursor. Counter: mobile already has different signal profiles. Desktop cursor data is pure upside.

  Why it's asymmetric: Trivial to implement (mousemove listener). High signal density. Nobody in writing process research captures this.

  ---
  4. Circadian-Adjusted Baselines

  Why it was missed: The z-scoring infrastructure treats all prior sessions as one population. But your 11pm brain is not your 2pm brain. hour_typicality
  flags unusual timing but doesn't adjust the behavioral baselines themselves.

  What changes: Instead of z(fluency) against all history, compute z(fluency | hour_bucket). A fluency of X at 3am compared to other 3am sessions tells you
  something completely different than X compared to your 2pm peak. This applies to every z-scored dimension in both the 7D and 11D state engines.

  Pressure test: Requires enough sessions per hour-bucket. With daily writing at varying times, you need ~20 sessions per bucket. Use 4-hour buckets (6
  buckets) instead of hourly to reach statistical reliability faster.

  Why it's asymmetric: Zero new capture. Pure analytical improvement. Changes the meaning of every state dimension.

  ---
  5. Calibration-Journal Delta as Controlled Experiment

  Why it was missed: tb_session_delta exists but I assumed it was already fully exploited. The free-write calibration is a CONTROL CONDITION. The journal
  response is a TREATMENT CONDITION (treatment = the question). The delta across ALL signals is the treatment effect of that specific question on that
  specific day's cognitive state.

  What's not being extracted: The delta should cover every signal, not a subset. And the delta TRAJECTORY over time (is the treatment effect of questions
  growing or shrinking?) is a meta-signal about whether the journal itself is changing how the user thinks.

  Pressure test: Calibration and journal sessions may be separated by time (morning free-write, evening journal). Time-of-day confounds the delta. Counter:
  include time-gap as a covariate in the delta computation.

  ---
  6. Pre-Composition Detection

  Why it was missed: It's a derived cognitive mode, not a captured signal. A session with anomalously high fluency + high commitment + low deliberation + high
   idea density is suspicious. The ideas per minute rate exceeds what real-time composition produces. The writer composed mentally before touching the
  keyboard.

  Why it matters: Pre-composition is a fundamentally different cognitive process (Flower & Hayes 1981 "planning" vs. "translating"). The behavioral signature
  is already in your signals. You just need to detect the conjunction: high speed + high complexity + low revision. This is a cognitive mode classifier built
  from existing features.

  Pressure test: Could also indicate a shallow, rehearsed response. Counter: idea density and lexical sophistication separate pre-composed depth from glib
  fluency.

  ---
  7. Joint Behavioral-Semantic Embedding

  Why it was missed: I framed behavioral and semantic as "orthogonal by construction" (which they are in the state engine). But for question generation RAG,
  orthogonality is a liability. You want entries to cluster by both what AND how.

  What this enables: Concatenate the 7D behavioral state vector + 11D semantic state vector with the text embedding before indexing. When generating
  tomorrow's question, retrieve entries that are similar not just topically but cognitively. "Find entries where the user wrote about uncertainty AND showed
  knowledge-transforming behavioral signatures." This makes question generation sensitive to cognitive mode, not just topic.

  Pressure test: Behavioral dimensions are on a different scale than embedding dimensions. Counter: normalize and weight. The weighting itself becomes a
  tunable parameter.

  ---
  8. The Signal Pipeline as Licensable SDK

  Why it was missed: The prompt asked about improving Alice. But the asymmetric upside is that Alice's behavioral capture engine doesn't exist anywhere else
  as a reusable component. No open-source equivalent. BiAffect is a research project. TypingDNA captures 6 signals. You capture 147.

  The play: Extract the client-side signal capture (the input/keydown/keyup/visibilitychange listener constellation) and the server-side signal computation
  into a standalone package. Any textarea, any app. Writing tutors, therapy platforms, clinical trials, exam proctoring, creative writing tools. The journal
  is the proof-of-concept. The engine is the product.

  Pressure test: Open-sourcing the engine gives away the IP. Counter: open-source the capture layer, keep the derived signal computation and state engine
  proprietary. Or: the engine is table stakes, the longitudinal personal model is the moat.

  ---
  9. Copy Events as Boundary-Crossing Signal

  Why it was missed: Small signal, easy to overlook. But Alice is a black box by design. The user can't see past entries. If they Cmd+C their own text
  mid-session, they're extracting something from the box. That's a metacognitive boundary event: "this thought is worth taking with me."

  Implementation: copy event listener. Log what was selected (length, position in text, whether it was a sentence or fragment). Don't store the copied text
  (black box stays black). The act of copying is the signal.

  ---
  Summary of What Was Missed and Why

  ┌───────────────────────┬──────────────────────────────────────────────────────────────────────────────────┐
  │      Blind Spot       │                                    Root Cause                                    │
  ├───────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Acoustic force        │ Searched "keystroke dynamics" not "keyboard sensing"                             │
  ├───────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Question-as-treatment │ Searched for better signals not better experimental design                       │
  ├───────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Mouse trajectory      │ Assumed "writing = typing" not "writing = full-body behavior at a desk"          │
  ├───────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Circadian baselines   │ Assumed the z-scoring framework was correct, only searched for new inputs to it  │
  ├───────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Pre-composition       │ Searched for new signals not new cognitive modes derivable from existing signals │
  ├───────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Joint embedding       │ Accepted the "orthogonal by construction" design as permanent                    │
  ├───────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ SDK licensing         │ Answered "how to improve the app" not "what does the app make possible"          │
  └───────────────────────┴──────────────────────────────────────────────────────────────────────────────────┘

✻ Worked for 2m 37s

❯ Evaluate each signal against the following criteria and assign a weighted importance score:                 
                                                                                                              
  Additive — captures information not already covered by existing signals                                     
  Substantive — meaningful enough to drive decisions, not noise                                               
  Novel channel — opens a data stream we weren't previously accessing                                         
  Material impact — represents a significant step forward in capability                                       
  Competitive differentiation — moves us closer to separating from competitors                                
                                                                                                              
  For each signal, score it against each criterion, then produce:                                             
                                                                                                              
  A ranked list by overall importance (include/exclude recommendation)                                        
  A suggested implementation order, accounting for dependencies and sequencing that maximizes compounding     
  value                                                                                                       
                                                                                                              
  ⎿  ⧉ Selected 382 lines from README.md in Visual Studio Codeial impact over pure additivity.                

⏺ Scoring all candidates against your five criteria (1-5 each, 25 max). I'm being ruthless about what Alice already has.

  ---
  Scoring Matrix

  NEW CAPTURE SIGNALS (client-side additions)

  ┌─────┬───────────────────────────────────────┬─────┬─────┬─────┬─────┬─────┬───────┬─────────┐
  │  #  │                Signal                 │ Add │ Sub │ Nov │ Mat │ Dif │ Total │ Verdict │
  ├─────┼───────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼─────────┤
  │ 1   │ Mouse/cursor trajectory during pauses │ 5   │ 4   │ 5   │ 4   │ 4   │ 22    │ INCLUDE │
  ├─────┼───────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼─────────┤
  │ 2   │ Acoustic keystroke force (Web Audio)  │ 5   │ 4   │ 5   │ 4   │ 5   │ 23    │ INCLUDE │
  ├─────┼───────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼─────────┤
  │ 3   │ Copy events                           │ 4   │ 2   │ 2   │ 1   │ 2   │ 11    │ EXCLUDE │
  └─────┴───────────────────────────────────────┴─────┴─────┴─────┴─────┴─────┴───────┴─────────┘

  Mouse scores nearly as high as acoustic but with zero UX cost (no permission dialog). Acoustic is the bigger swing but requires mic consent, which violates
  Alice's monastic UX. Copy events are too rare to matter.

  NEW DERIVED SIGNALS (computed from existing keystroke stream)

  ┌─────┬──────────────────────────────────────┬─────┬─────┬─────┬─────┬─────┬───────┬────────────┐
  │  #  │                Signal                │ Add │ Sub │ Mat │ Nov │ Dif │ Total │  Verdict   │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 4   │ Ex-Gaussian tau                      │ 5   │ 5   │ 5   │ 1   │ 4   │ 20    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 5   │ Cross-Recurrence (CRQA)              │ 5   │ 4   │ 4   │ 2   │ 5   │ 20    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 6   │ Adjacent key hold-time covariance    │ 4   │ 4   │ 4   │ 1   │ 4   │ 17    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 7   │ Precorrection/postcorrection latency │ 4   │ 4   │ 3   │ 1   │ 3   │ 15    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 8   │ Revision distance                    │ 4   │ 4   │ 3   │ 1   │ 3   │ 15    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 9   │ Visibility graph metrics             │ 5   │ 3   │ 3   │ 2   │ 5   │ 18    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 10  │ MF-DFA spectrum width                │ 3   │ 4   │ 3   │ 1   │ 3   │ 14    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 11  │ Multiscale Entropy                   │ 3   │ 4   │ 3   │ 1   │ 3   │ 14    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 12  │ Markov transition entropy rate       │ 4   │ 4   │ 3   │ 1   │ 3   │ 15    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 13  │ Punctuation key latency isolation    │ 4   │ 3   │ 2   │ 1   │ 2   │ 12    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 14  │ Abandoned thought temporal signature │ 4   │ 4   │ 3   │ 1   │ 4   │ 16    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 15  │ Clause-boundary pauses               │ 3   │ 4   │ 3   │ 1   │ 3   │ 14    │ INCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 16  │ Trigraph latency profiles            │ 3   │ 3   │ 2   │ 1   │ 2   │ 11    │ EXCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 17  │ Rollover rate                        │ 2   │ 3   │ 2   │ 1   │ 1   │ 9     │ EXCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 18  │ AIS (Active Information Storage)     │ 4   │ 3   │ 3   │ 1   │ 4   │ 15    │ BORDERLINE │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 19  │ DCCA exponent                        │ 4   │ 3   │ 3   │ 1   │ 4   │ 15    │ BORDERLINE │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 20  │ Wavelet energy ratio                 │ 4   │ 3   │ 3   │ 1   │ 4   │ 15    │ BORDERLINE │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 21  │ Symbolic dynamics / forbidden words  │ 4   │ 3   │ 3   │ 1   │ 4   │ 15    │ BORDERLINE │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 22  │ Lyapunov exponent                    │ 4   │ 3   │ 3   │ 1   │ 4   │ 15    │ BORDERLINE │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 23  │ EMD / Hilbert-Huang                  │ 4   │ 3   │ 3   │ 1   │ 4   │ 15    │ BORDERLINE │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 24  │ Allan variance                       │ 3   │ 3   │ 2   │ 1   │ 3   │ 12    │ EXCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 25  │ Phase space / correlation dimension  │ 4   │ 2   │ 2   │ 1   │ 3   │ 12    │ EXCLUDE    │
  ├─────┼──────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼────────────┤
  │ 26  │ Backspace rate phenotyping           │ 3   │ 4   │ 3   │ 1   │ 3   │ 14    │ BORDERLINE │
  └─────┴──────────────────────────────────────┴─────┴─────┴─────┴─────┴─────┴───────┴────────────┘

  Ex-Gaussian tau and CRQA tie at 20 but for different reasons. Tau is the single most validated digital phenotyping signal we're missing (BiAffect proved it
  predicts mood episodes). CRQA opens an entirely new class of cross-session dynamical comparison that nobody does. Visibility graph (18) is high because it's
   genuinely orthogonal to everything, converting temporal data into network topology.

  The 15-scoring cluster (AIS, DCCA, wavelet, symbolic dynamics, Lyapunov, EMD) are all "same IKI data, different math." Each is individually defensible but
  collectively they're diminishing returns on the same data stream. Pick 2-3, not all 6.

  ANALYTICAL / ARCHITECTURAL (no new capture)

  ┌─────┬─────────────────────────────────────┬─────┬─────┬─────┬─────┬─────┬───────┬─────────┐
  │  #  │               Signal                │ Add │ Sub │ Nov │ Mat │ Dif │ Total │ Verdict │
  ├─────┼─────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼─────────┤
  │ 27  │ Question-as-treatment-variable      │ 5   │ 5   │ 4   │ 5   │ 5   │ 24    │ INCLUDE │
  ├─────┼─────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼─────────┤
  │ 28  │ Joint behavioral-semantic embedding │ 5   │ 5   │ 3   │ 5   │ 5   │ 23    │ INCLUDE │
  ├─────┼─────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼─────────┤
  │ 29  │ Circadian-adjusted baselines        │ 4   │ 5   │ 1   │ 4   │ 3   │ 17    │ INCLUDE │
  ├─────┼─────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼─────────┤
  │ 30  │ Pre-composition detection           │ 4   │ 4   │ 1   │ 3   │ 4   │ 16    │ INCLUDE │
  ├─────┼─────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼─────────┤
  │ 31  │ Calibration-journal delta expansion │ 3   │ 4   │ 1   │ 3   │ 3   │ 14    │ INCLUDE │
  ├─────┼─────────────────────────────────────┼─────┼─────┼─────┼─────┼─────┼───────┼─────────┤
  │ 32  │ Diurnal cycling profiles            │ 4   │ 4   │ 2   │ 3   │ 3   │ 16    │ INCLUDE │
  └─────┴─────────────────────────────────────┴─────┴─────┴─────┴─────┴─────┴───────┴─────────┘

  Question-as-treatment scores highest overall (24) because it's the only candidate that changes what Alice fundamentally IS: from a journaling tool into a
  single-subject experimental platform. Joint embedding (23) transforms question generation from topic retrieval to cognitive-state-aware retrieval. Both are
  architectural, not signal-level, which is why they were missed.

  ---
  Ranked List (Include/Exclude)

  ┌──────┬──────────────────────────────────────┬───────┬──────────────┬──────────────────────────────────────────────┐
  │ Rank │                Signal                │ Score │     Type     │                   Verdict                    │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 1    │ Question-as-treatment-variable       │ 24    │ Framework    │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 2    │ Acoustic keystroke force             │ 23    │ New channel  │ INCLUDE (opt-in tier)                        │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 3    │ Joint behavioral-semantic embedding  │ 23    │ Architecture │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 4    │ Mouse/cursor trajectory              │ 22    │ New channel  │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 5    │ Ex-Gaussian tau                      │ 20    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 6    │ Cross-Recurrence (CRQA)              │ 20    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 7    │ Visibility graph                     │ 18    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 8    │ Circadian-adjusted baselines         │ 17    │ Analytical   │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 9    │ Adjacent key hold-time covariance    │ 17    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 10   │ Pre-composition detection            │ 16    │ Classifier   │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 11   │ Diurnal cycling profiles             │ 16    │ Analytical   │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 12   │ Abandoned thought temporal sig       │ 16    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 13   │ Markov transition entropy rate       │ 15    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 14   │ Precorrection/postcorrection latency │ 15    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 15   │ Revision distance                    │ 15    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 16   │ Symbolic dynamics                    │ 15    │ Derived      │ INCLUDE (pick from 15-cluster)               │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 17   │ MF-DFA spectrum width                │ 14    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 18   │ Multiscale Entropy                   │ 14    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 19   │ Clause-boundary pauses               │ 14    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 20   │ Calibration delta expansion          │ 14    │ Analytical   │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ 21   │ Punctuation key latency              │ 12    │ Derived      │ INCLUDE                                      │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ —    │ Trigraph latency                     │ 11    │ Derived      │ EXCLUDE (incremental over digraph)           │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ —    │ Copy events                          │ 11    │ New capture  │ EXCLUDE (too rare)                           │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ —    │ Allan variance                       │ 12    │ Derived      │ EXCLUDE (redundant w/ MF-DFA)                │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ —    │ Correlation dimension                │ 12    │ Derived      │ EXCLUDE (500+ IKI required)                  │
  ├──────┼──────────────────────────────────────┼───────┼──────────────┼──────────────────────────────────────────────┤
  │ —    │ Rollover rate                        │ 9     │ Derived      │ EXCLUDE (trivial normalization, low insight) │
  └──────┴──────────────────────────────────────┴───────┴──────────────┴──────────────────────────────────────────────┘

  From the 15-scoring cluster (AIS, DCCA, wavelet, symbolic dynamics, Lyapunov, EMD): include symbolic dynamics and wavelet energy ratio, exclude the rest.
  Symbolic dynamics captures forbidden patterns (determinism detection in short series). Wavelet separates cognitive planning scales from motor
  microstructure. The others are diminishing returns on the same IKI stream.

  ---
  Implementation Order

  Sequenced for maximum compounding: each phase makes subsequent phases more valuable.

  Phase 0: Baseline Correction (makes everything downstream more accurate)

  Circadian-adjusted baselines -- Changes the z-scoring denominator for all 7D + 11D dimensions. Every subsequent signal benefits from time-of-day-appropriate
   comparison. Use 4-hour buckets until you have 20+ sessions per bucket, then narrow to 2-hour.

  Phase 1: Open New Channels (creates data streams that feed all future analysis)

  1. Mouse/cursor trajectory -- mousemove listener. Capture: position samples during pauses (>2s), cursor distance during session, drift-toward-submit events,
   fidget ratio (mouse distance / typing time). Zero UX cost, immediate new data.
  2. Precorrection/postcorrection latency -- Enrich the existing deletion detection in the keystroke handler. Three new values per deletion event from data
  you already capture.
  3. Revision distance -- Enrich the existing contextual revision detection in event log processing. One new value per revision from data you already have.
  4. Punctuation key latency -- Filter existing keystroke stream by key class. Separate punctuation-key IKI distribution from letter-key distribution.

  Phase 2: High-Value Derived Signals (highest validated impact)

  5. Ex-Gaussian tau -- Fit ex-Gaussian to flight time distribution per session. Extract mu (motor baseline), sigma (motor noise), tau (cognitive slowing
  tail). Tau is the leading indicator. ~50 lines of fitting code.
  6. Adjacent key hold-time covariance -- Pearson correlation between consecutive hold times. Motor coordination signal that degrades before mean hold time
  shifts. Trivial computation from existing keystroke stream.
  7. Abandoned thought temporal signature -- For each detected abandoned thought, extract IKI mean/std in the 5 keystrokes before and after. Compute
  acceleration ratio. Does the writer flee or deliberate?

  Phase 3: Dynamical Extensions (extend existing infrastructure)

  8. MF-DFA -- Parameterize existing DFA over moment orders q = -5 to +5. Extract spectrum width (delta h) and asymmetry. ~40 lines on top of existing DFA.
  9. Multiscale Entropy -- Coarse-grain IKI at scales 2-5, compute sample entropy at each. ~20 lines on top of existing SampEn.
  10. Cross-Recurrence (CRQA) -- Pair today's IKI with yesterday's in shared phase space. Use existing RQA infrastructure with two-series input. Extract
  cross-recurrence rate and cross-determinism.
  11. Markov transition entropy rate -- Discretize IKI into tercile states, compute transition matrix, extract entropy rate and stationary distribution.

  Phase 4: Novel Representations

  12. Visibility graph -- Convert IKI to network. Extract degree distribution exponent, mean clustering coefficient, number of communities. Orthogonal to all
  existing dynamical signals.
  13. Symbolic dynamics / forbidden words -- Discretize IKI into 4 symbols, enumerate length-3 forbidden patterns, compute Lempel-Ziv complexity.
  14. Wavelet energy ratio -- CWT on IKI, extract energy in low-frequency (scale 10-50) vs high-frequency (scale 2-5) bands.

  Phase 5: Cognitive Mode Classifiers

  15. Pre-composition detection -- Flag sessions where fluency > 1.5σ AND commitment > 1.5σ AND deliberation < -1σ AND idea density > median. Derived from
  existing state engine.
  16. Clause-boundary pauses -- Requires clause detection (regex or lightweight NLP on final text). Classify pauses from event log into within-word /
  between-word / between-clause / between-sentence.
  17. Diurnal cycling profiles -- For each of the 7D + 11D dimensions, compute per-hour-bucket means and variances. Detect which dimensions have strongest
  circadian signatures.

  Phase 6: Architectural (requires Phase 0-4 signals to be maximally useful)

  18. Calibration-journal delta expansion -- Extend tb_session_delta to compute deltas for all new signals, not just the original subset.
  19. Question-as-treatment-variable -- Build a question-response coupling matrix. For each question, store the behavioral response vector. Cluster questions
  by behavioral signature. Feed clusters back into question generation as a conditioning signal.
  20. Joint behavioral-semantic embedding -- Concatenate normalized 7D + 11D state vector with text embedding before indexing. Weight behavioral dimensions at
   0.3x text embedding magnitude (tunable). This makes RAG retrieve entries that match both cognitively and topically.

  Phase 7: Deep Mode (opt-in, breaks monastic UX intentionally)

  21. Acoustic keystroke force -- Opt-in mic toggle. Capture per-keystroke amplitude envelope via Web Audio API. Extract peak amplitude, attack time, decay
  time per key. Normalize within-session. This is the one signal that no amount of software analysis can extract from timing alone, and the one that clinical
  research (Science Advances 2025) showed is most discriminative for neuromotor detection.

  ---
  Net result: 21 new signals/frameworks, taking Alice from ~147 to ~168 distinct signals, plus three architectural changes (circadian baselines,
  question-as-treatment, joint embedding) that change how all signals are interpreted and used.
