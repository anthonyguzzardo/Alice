> **Note:** This document predates the renames: Marrow → Alice, Bob → Alice Negative, Einstein → Bob (2026-04-12).

# Marrow

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## What It Does

Marrow asks you one question every day. You answer it. That's it.

There is no feed, no streak counter, no summary of your progress. Your responses go into a black box. You never see them again. The system sees them. You don't.

## Scientific Foundation

Every layer of Marrow is grounded in peer-reviewed research. This is not a journaling app with AI bolted on — it is a single-case behavioral measurement instrument designed from validated science.

### Writing Process Research
- **P-burst production fluency** — Chenoweth & Hayes (2001). Text produced between 2-second pauses is the single strongest behavioral predictor of writing quality in process research.
- **Knowledge-transforming vs. knowledge-telling** — Bereiter & Scardamalia (1987), extended by Galbraith (1999, 2009). The distinction between reciting existing knowledge and producing new thinking during writing.
- **Within-session KT signature** — Baaijen & Galbraith (2012). Short fragmented bursts consolidating into longer sustained bursts as thinking crystallizes — detectable from per-burst sequence data.
- **Deletion decomposition** — Faigley & Witte (1981). Small deletions (<10 chars) are surface corrections; large deletions (≥10 chars) are substantive revisions. The distinction changes interpretation of the same commitment ratio.

### Linguistic Analysis
- **NRC Emotion Lexicon** — Mohammad & Turney (2013), National Research Council Canada. ~14,000 English words with validated binary associations to emotion categories across multiple languages.
- **Linguistic Inquiry and Word Count (LIWC)** — Pennebaker, Boyd, Jordan & Blackburn (2015). Cognitive mechanism words, hedging language, and first-person pronoun density as markers of psychological processing.
- **Language use as individual difference** — Pennebaker & King (1999). Function word usage is more diagnostic of psychological state than content words.
- **Linguistic markers of processing depth** — Tausczik & Pennebaker (2010). The slope of cognitive word density over time is a stronger predictor than the level at any single point.
- **Lexical diversity** — McCarthy & Jarvis (2010). MATTR (moving-average type-token ratio) validated for length-independent measurement on short texts.
- **Expressive writing paradigm** — Pennebaker & Beall (1986). Prompt framing ("deepest thoughts and feelings") measurably activates deeper cognitive processing and emotional disclosure.

### Behavioral Dynamics
- **Personality Dynamics (PersDyn)** — Sosnowska et al. (2019, 2020), KU Leuven. Per-dimension baseline, variability, and attractor force computed from within-person behavioral time series.
- **Whole Trait Theory** — Fleeson & Jayawickreme (2015, 2025). Traits as density distributions of states, not fixed points.
- **ECTO system entropy** — Rodriguez (2025). Shannon entropy of variability distribution as a measure of behavioral system complexity.
- **Ornstein-Uhlenbeck mean-reversion** — applied to behavioral attractor force estimation, revealing whether dimensions are rigid (fast snap-back) or malleable (persistent shifts).

### Prediction & Methodology
- **Single-case experimental design (SCED)** — Barlow & Hersen (1984), Kazdin (2011). The methodological framework for treating one person's longitudinal data as a valid experiment.
- **Predictive processing / active inference** — Friston (2006), Clark (2013). Systems that only explain post hoc never learn; systems that predict and get graded do.
- **Bayesian updating** — Beta-Binomial confidence scoring per theory/topic combination, updated on every prediction grade.

### Interface Design & Data Quality
- **Single-question superiority** — Kocielnik, Xiao, Avrahami & Wilson (2018, USC/UCSB). Chatbot-style reflection increased word count 40% but decreased cognitive complexity. Conversational interfaces fragment the reflective arc.
- **Audience effect on disclosure** — Bernstein, Bakshy, Burke & Karrer (2013, Stanford). Perceived audience size decreases linguistic complexity and increases self-presentation. Writing for no one produces richer signal.
- **Introspective vs. performative mode** — Lee, Kim, Chung & Lim (2020). When AI responds substantively between user turns, writers shift from self-reflection to social cognition. The absence of visible AI is a design choice, not a limitation.
- **Slow Technology** — Hallnäs & Redström (2001, KTH Stockholm). Technology designed for reflection should amplify time, not compress it. Deliberate friction — removal of autocomplete, reflection pauses, absence of word counts — increases engagement depth.
- **Design frictions for mindfulness** — Cox, Gould, Cecchinato, Iacovides & Renfree (2016, UCL). Micro-frictions (2-5 second delays, removal of autocomplete) increased mindfulness during interaction without increasing abandonment.
- **Meaningful vs. meaningless smartphone use** — Lukoff, Yu, Kientz & Hiniker (2018, University of Washington). Features reducing friction (autoplay, predictive text) associated with less meaningful use.
- **EMA compliance and data quality** — Eisele et al. (2022). Meta-analysis showing compliance rewards degraded response quality — shorter, more performative responses. No gamification is empirically correct.
- **Text area priming** — HCI research (Kowalski et al.) showing text area dimensions prime writing behavior: taller areas produce longer responses, wider areas produce more complex sentence structure.
- **UI minimalism and disclosure** — CMU HCI Institute (Dey, Fogarty, Hudson). Removing character counters increased response length 20%. Removing timestamps reduced social desirability bias. Monochromatic, minimal UI increased emotional disclosure.
- **Question fading** — Czerwinski, Horvitz & Wilhite (2004, Microsoft Research). Prompts that fade after being read produce more associative, less literal responses than prompts that remain fully visible.

### Question Design & Adaptive Assessment
- **Desirable difficulties** — Bjork & Bjork (2011, UCLA). Questions that require generation rather than recognition produce deeper encoding. Difficulty should calibrate to demonstrated capacity.
- **Deep-reasoning question taxonomy** — Graesser & Person (1994). Causal antecedent, consequence, and goal-orientation questions elicit responses with significantly more causal connectives and hedging — the signals the linguistic density pipeline measures.
- **Bloom's taxonomy validated computationally** — McNamara et al. (2014, Arizona State, Coh-Metrix). "Evaluate" and "Create" level questions produce measurably higher MATTR and longer T-units.
- **Causal framing** — Niles, Haltom, Mulvenna, Lieberman & Stanton (2014, Harvard). "Why" questions produce more causal reasoning language than "what" questions, and causal language is the mechanism behind therapeutic benefits.
- **Computerized Adaptive Testing** — Gibbons et al. (2012). Adaptive item selection reduces measurement burden 50-70% while maintaining reliability. The adaptive sequence itself produces less measurement reactivity.
- **Information-gain question selection** — Settles (2012). Uncertainty sampling (asking where the model is most uncertain) produces fastest convergence; information density weighting produces best-calibrated models.
- **Evidence-Centered Design** — Mislevy, Almond & Lukas (2003, ETS). Every item should make a specific behavioral or cognitive signal observable in the text. The question determines what's measurable.
- **Spaced repetition of themes** — Cepeda, Pashler, Vul, Wixted & Rohrer (2006, UCSD). Optimal inter-study intervals for long-term retention scale with desired retention interval. Revisiting themes at expanding intervals produces richer longitudinal signal.
- **Retrieval practice over re-exposure** — Roediger & Karpicke (2006, Washington University). Re-asking a theme as a new question is more powerful than showing prior responses — validated alignment with the "never surface responses" principle.
- **Interleaving** — Bjork & Bjork (2011). Mixing themes rather than clustering them produces deeper processing, even though it feels harder.
- **Narrative identity** — McAdams & McLean (2013, Northwestern). Prompts inviting temporal connection activate deeper narrative processing, producing text rich in temporal connectives, causal reasoning, and identity-relevant language.
- **Contextual anchoring** — Bolger, Davis & Rafaeli (2003, Columbia). Event-contingent and contextually anchored prompts produce 30-50% more descriptive detail and emotional specificity than decontextualized prompts.
- **Disclosure context** — Pennebaker & Beall (1986), Baikie & Wilhelm (2005). The prompt must create a sense of revealing something, not recording something. Minimum effective dose is 15 minutes of sustained, uninterrupted writing.
- **Safe challenge framing** — Edmondson (1999, Harvard Business School). Productive discomfort requires psychological safety. "What might it look like to sit with..." outperforms "Why do you keep avoiding..." for eliciting cognitively complex responses.

### Keystroke & Ambient Signal Research
- **Keystroke dynamics as affect signal** — Epp, Lippold & Mandryk (2011, CHI). Different emotions have distinct keystroke signatures: confidence correlates with faster, more uniform keystrokes; hesitancy with longer pauses before specific transitions.
- **Error correction as stress indicator** — Vizer, Zhou & Sears (2009, UMBC). Backspace frequency and revision chain topology are among the strongest behavioral stress indicators.
- **Writing process logging** — Leijten & Van Waes (2013, University of Antwerp). Revision behavior reveals cognitive processing modes: planning, translating, and reviewing.
- **Cognitive rhythms** — Abdullah, Murnane et al. (2016, Cornell). Time-of-day is a meaningful covariate — the same behavioral pattern carries different signal at 7am vs 11pm.
- **Re-engagement as depth signal** — Czerwinski, Horvitz & Wilhite (2004, Microsoft Research). Re-engagement patterns after breaks correlate with task engagement depth.

### Signal Formatting for LLM Consumption
- **From Logs to Language** — Netflix (2026). Principles for converting raw metrics to natural language for LLM interpretation.
- **Anchoring bias in LLM numeracy** — (2024). Baseline-anchored presentation prevents raw numbers from being over- or under-weighted.
- **Lost in the Middle** — Liu et al. (TACL 2024). Positional attention patterns in LLMs; primary signals placed first, trajectory context last.

### Semantic Retrieval & Error Correction
- **Contrarian retrieval** — designed to counter the bias inherent in semantic similarity search, which reinforces dominant themes by surfacing entries with similar language.
- **Multi-model audit** — structured self-disagreement (three frames from one model) plus genuine independence (Opus + Sonnet review cycle) on weekly reflections.
- **Reflection decay** — old hypotheses must earn their way back via semantic relevance, preventing self-reinforcing narrative drift.

## How It Works

### The Two Phases

Marrow operates in two distinct phases. The transition is invisible to the user.

#### Phase 1: Seed (Days 1-30)

Thirty questions delivered one per day in a fixed sequence. All thirty are deep, designed to create friction:

1. Unanswerable in one sentence
2. About you, not a topic
3. No right answer
4. Worth returning to in three months

During this phase, **the questions do not adapt**. But the system is not idle. Every submission triggers the AI's silent observation layer, building an internal model of the user from day 1. The questions are fixed. The watching is not.

#### Phase 2: Generated (Day 31+)

After the seeds run out, the system generates tomorrow's question from a bounded, relevant context window — not the entire history. Every response is embedded as a vector (via Voyage AI) and stored for semantic retrieval. When generating a question, the system assembles:

- **Recent entries** (last 14, verbatim) — the raw, uncompressed source of truth
- **Resonant older entries** (retrieved by semantic similarity) — past entries that echo current themes, pulled from the full history regardless of age
- **Contrarian entries** (deliberately dissimilar) — entries that are the *most different* from current themes. These break the echo chamber by forcing the system to remember threads it's been ignoring. If you've been writing about your career for weeks, the contrarian slot surfaces the entry about your dad from three months ago.
- **Recent reflections** (last 4, in full) — the model's weekly pattern analyses, explicitly marked as hypothesis, not fact. If a reflection contradicts a raw entry, the entry wins.
- **Resurfaced older reflections** (via semantic retrieval) — older reflections are not permanently included in every prompt. They only reappear if the system detects their themes are relevant to the current moment. An old hypothesis has to earn its way back — but it's never permanently gone.
- **Recent observations, suppressed questions, behavioral data, prediction track record, and feedback** — scoped to recent context, not the entire archive

The prompt grows to a fixed size and stays there. Day 50 and day 500 produce prompts of the same scale, but the semantic retrieval ensures the system always reaches back to what's relevant — including entries from months ago that resonate with the current moment. The contrarian retrieval ensures it doesn't only reach back to what's *similar*.

No question is generated in advance. Tomorrow's question doesn't exist until you submit today's response. There is nothing to preview, leak, or game.

Every generated question carries an **intervention intent** — a tag explaining *why* the system chose it. The six intents are: promoting a previously suppressed question, targeting a specific theme, breaking a thematic rut via contrarian retrieval, disambiguating between interpretive frames, probing a specific trajectory dimension, or testing depth on a topic. This metadata turns each question into a labeled intervention in a single-case experiment, so the system can later correlate intent with outcome.

The generation prompt is built on research-backed question design principles:
- **Causal/evaluative framing** (Graesser & Person 1994; Niles et al. 2014) — "why" and "reconcile" verbs produce richer cognitive processing markers than "describe" or "list"
- **Disclosure context** (Pennebaker & Beall 1986) — questions create a sense of revealing, not recording
- **Safe challenge** (Edmondson 1999) — difficulty framed as invitation, not confrontation
- **Information-gain selection** (Settles 2012; Mislevy et al. 2003) — each question targets where the model is most *uncertain* about the person, not where they are most interesting
- **Adaptive difficulty** (Bjork & Bjork 2011) — question challenge calibrates to prior response complexity (MATTR, cognitive density). High-complexity responses earn harder questions; low-complexity responses get more concrete, anchored questions
- **Spaced repetition** (Cepeda et al. 2006; Roediger & Karpicke 2006) — themes revisit at expanding intervals. Re-asked as new questions (retrieval practice), never as callbacks to prior answers
- **Interleaving** (Bjork & Bjork 2011) — related themes are deliberately not clustered. If the last 3 questions touched identity, the next breaks to a different domain
- **Contextual anchoring** (Bolger et al. 2003; McAdams & McLean 2013) — references patterns without echoing entries

Each generation produces three candidate questions ranked by quality. All three — selected and runners-up — are stored with theme tags and uncertainty dimensions. The sequence of what the system *needed* to ask is itself diagnostic signal (Harrison et al. 2017).

### The Writing Interface

The interface is the instrument. Every design decision is informed by HCI research on how interface affordances affect writing behavior and data quality.

**Deliberate friction** (Hallnäs & Redström 2001, KTH; Cox et al. 2016, UCL) — The textarea activates after a 4-second reflection pause. Autocomplete, autocorrect, and spellcheck are disabled. There are no word counts, character counts, or progress indicators. The interface amplifies time rather than compressing it. Research shows micro-frictions increase mindfulness during interaction without increasing abandonment (Cox et al.), and features reducing friction are associated with less meaningful use (Lukoff et al. 2018, University of Washington).

**Question fading** (Czerwinski, Horvitz & Wilhite 2004, Microsoft Research) — Once writing begins, the question gradually fades to low opacity over 8 seconds. Research shows that prompts which recede after being read produce more associative, less literal responses. The user has already internalized the question; keeping it fully visible constrains the response to literal answering rather than free exploration.

**No AI presence cues** — No loading spinners, typing indicators, or processing feedback appear during writing. Research shows that when users detect AI processing, they shift from introspective to performative mode (Lee et al. 2020). The interface should feel like paper, not software.

**Monastic minimalism** (CMU HCI Institute; Bernstein et al. 2013, Stanford) — Monochromatic palette. No navigation during writing (controls hidden). No timestamps. Research shows removing visual clutter increases emotional disclosure, and perceived audience effects decrease linguistic complexity. The black box principle — never surfacing responses — is empirically validated: writing for no one produces richer signal than writing for any audience.

### Data Collection

Marrow captures three layers of data per session, all invisible to the user.

#### Layer 1: Response Text

What you submitted. Stored as-is. Never surfaced back to you.

#### Layer 2: Behavioral Signal

The system silently captures raw input events throughout the session — keystrokes, deletions, pauses, tab-aways, resumptions. On submission, these raw events are crunched into a session summary: a single row of derived behavioral metrics plus context metadata.

The variables that contribute to signal:

- **First-keystroke latency** — how long you sat with the question before starting. Only meaningful relative to your calibration baseline *on the same device type and similar time of day*. A 47-second pause on your phone at midnight is a different signal than 47 seconds on your laptop at 9am.
- **P-burst metrics** (Chenoweth & Hayes, 2001) — text produced between 2-second pauses. Burst count and average burst length measure production fluency. Long, sustained bursts indicate flow states. Short, fragmented bursts indicate cognitive load or deliberate composition. The single strongest behavioral predictor of writing quality in process research. The full per-burst sequence is captured and stored — not just the average. Each burst records its character count, duration, and start offset within the session. This enables within-session analysis of the Baaijen & Galbraith (2012) knowledge-transforming signature: short fragmented bursts consolidating into longer sustained bursts as thinking crystallizes.
- **Commitment ratio** — total characters typed vs. final character count. Heavy editing could mean avoidance, or it could mean careful writing. The system applies three interpretive frames to determine which is more likely.
- **Deletion decomposition** (Faigley & Witte, 1981) — small deletions (<10 characters) are corrections (typo fixes, word swaps). Large deletions (>=10 characters) are revisions (substantive rethinking, sentence-level rewrites). The system tracks counts, character volumes, and timing of each type independently. The distinction matters: 50 small backspaces is noise, 2 large deletions where someone wrote a paragraph and killed it is signal.
- **Revision timing** — whether large deletions occurred in the first or second half of the session. Early revisions indicate false starts — couldn't settle on an opening. Late revisions indicate writing a draft and then gutting sections — a qualitatively different signal that changes how the three frames interpret the same commitment ratio.
- **Active typing speed** — characters per minute measured only during active typing time (excluding pauses and tab-aways). Removes session length as a confound.
- **Pause topology** — where in the response you stall matters, but only relative to where you normally stall on the same device in similar conditions.
- **Session rhythm** — the temporal shape of the session. Burst-pause-burst is a different thinking mode than slow-and-steady.
- **Tab-away behavior** — leaving the page and returning. Duration of absence. Whether typing speed changes after return.
- **Lexical diversity** (McCarthy & Jarvis, 2010) — MATTR (moving-average type-token ratio) with a 25-word window. Length-independent, validated for short texts. Tracks whether vocabulary is narrowing or expanding across sessions.
- **Inter-key interval dynamics** (Epp, Lippold & Mandryk, 2011) — mean and standard deviation of milliseconds between keystrokes (capped at 5s to exclude pauses). Different emotions have distinct keystroke signatures: confidence correlates with faster, more uniform keystrokes; hesitancy with longer pauses before specific key transitions. High interval variability indicates cognitive switching; low variability indicates flow.
- **Revision chain topology** (Leijten & Van Waes, 2013) — sequential deletions within 500ms are grouped as a single revision chain. Chain count and average length reveal cognitive processing mode: short chains = surface corrections (typo fixing), long chains = deep revision (restructuring thought). The topology distinguishes "backspace-backspace-backspace" (surface) from "select-all-delete-rewrite" (structural).
- **Scroll-back behavior** (Czerwinski, Horvitz & Wilhite, 2004) — how often the user scrolls back in the textarea to re-read their own text, and how often they scroll the page to re-read the question. Re-engagement patterns correlate with task engagement depth. A user who re-reads their own writing mid-session is doing something qualitatively different from one who writes linearly.
- **Punctuation and structure** — tracked but interpreted cautiously. Punctuation habits are shaped by device, platform, and personal style as much as by psychological state.

#### Layer 2.25: Linguistic Density Profile

Each submission is analyzed server-side for word category densities using validated lexicons:

- **NRC Emotion Lexicon** (Mohammad & Turney, 2013; National Research Council Canada) — density of words associated with six emotion categories: anger, fear, joy, sadness, trust, and anticipation. Computed as word count per category divided by total words. The NRC lexicon contains ~14,000 English words with binary associations to each emotion, validated across multiple languages and studies.
- **Cognitive mechanism words** (Pennebaker LIWC research) — words like "because," "realize," "whether," "figure" that indicate active reasoning rather than recitation. The slope of cognitive word density over time is a stronger predictor of cognitive processing than the level at any single point (Tausczik & Pennebaker, 2010).
- **Hedging language** — "maybe," "perhaps," "seems," "arguably." Density indicates tentativeness or epistemic caution. Rising hedging density on a topic the user previously discussed with certainty is a signal worth tracking.
- **First-person pronoun density** — "I," "me," "my," "mine," "myself." Self-referential language density shifts are correlated with emotional processing depth (Pennebaker, 2011). High first-person density on emotional topics is typical; low first-person density on personal topics is notable.

All nine densities are computed at save time and stored per session. The system uses them in two ways:

1. **Within-session profiling** — the observation layer sees the full linguistic profile alongside behavioral signals, enabling incongruence detection. A session about a painful family relationship that shows zero anger words and high trust/joy is a different signal than one showing the expected emotional valence. The AI couldn't detect this before linguistic densities existed.

2. **Cross-session slopes** — densities are percentile-ranked against personal history, just like behavioral metrics. The trajectory over time — rising cognitive density, shifting emotion profiles, changing self-reference patterns — is the signal that Pennebaker's research identifies as most meaningful. Not the level, but the slope.

Every session also captures **context metadata**: device type (mobile/desktop), user agent, hour of day, and day of week. This prevents the system from comparing your exhausted Friday-night phone session against your focused Tuesday-morning laptop session and concluding you were "avoidant."

All behavioral metrics are normalized as personal percentiles — compared against the user's own history, not population norms. A "high" P-burst length means high relative to this person's baseline, not high in absolute terms. When the AI reads behavioral data, it receives each metric verbalized with its percentile rank and personal baseline, structured by signal importance — primary signals first (deletion character, production fluency, commitment), supporting context middle (duration, pauses, tab-aways), trajectory context last.

#### Layer 2.5: Knowledge-Transforming Detection

Each session is scored for whether it produced **new thinking** or **recited existing knowledge** — the distinction Bereiter & Scardamalia (1987) called knowledge-telling vs. knowledge-transforming, extended by Galbraith (1999, 2009).

The detection uses four signals already captured:
- **Late revision ratio** — revisions concentrated in the second half indicate writing-then-restructuring, the hallmark of knowledge-transforming
- **Substantive revision count** — large deletions relative to personal baseline
- **Vocabulary diversification** — MATTR computed from the response text
- **Cognitive mechanism word density** — from the linguistic density profile. Rising density of cognitive words indicates active reasoning, not recitation.

Future: the per-burst sequence data enables a deeper KT detection layer. The Baaijen & Galbraith (2012) signature is not a session-level average — it's a *within-session transition* from short, fragmented bursts to longer, sustained ones as thinking consolidates. The burst sequence table now captures the full temporal structure needed to detect this pattern. This becomes meaningful once enough sessions accumulate to establish a personal baseline for burst-sequence shape.

The knowledge-transforming score is measured relative to a **calibration floor** — the KT score computed on neutral free-write sessions. Describing your breakfast is pure knowledge-telling; it establishes the zero point. The distance above that floor is the real signal. A journal entry scoring 0.65 against a calibration floor of 0.25 produced 0.40 units of thinking beyond what neutral writing produces. Without the floor, 0.65 is just a number compared against other emotionally loaded entries.

The score feeds into both the observation layer and the prediction system as the deepest available measure of whether a question *worked* — not whether it felt good, but whether it produced thinking the person wasn't doing before they sat down.

#### Layer 3: The AI's Silent Layer

Every day after submission, the AI reads the response, the behavioral signal, context-matched calibration baselines, knowledge-transforming score, and all of its own prior observations. It does four things:

**Three-frame analysis.** For every notable signal, the system applies three deliberately opposed interpretive lenses:

**Frame A — Charitable:** The user is being thoughtful, careful, honest, or simply editing for quality. Deletions are revisions. Pauses are contemplation. Vagueness is appropriate boundary-setting.

**Frame B — Avoidance:** The user is hedging, self-censoring, retreating from honesty, or protecting themselves. Deletions are retractions. Pauses are resistance. Vagueness is deflection.

**Frame C — Mundane:** The behavior has no psychological meaning. The user was distracted, tired, on a different device, dealing with autocorrect, or is just a careful writer. The signal is noise.

These are not three guesses from the same perspective. They are three distinct lenses. For each signal, the system applies all three, then assesses which frame the calibration data and cross-session patterns support. Where the frames genuinely diverge with no clear winner, the system says so and assigns an overall confidence level (HIGH / MODERATE / LOW / INSUFFICIENT DATA).

**Suppressed question.** The system generates the question it would ask tomorrow if it could. This question must target the highest-uncertainty gap: the place where Frame A and Frame B give equally plausible but contradictory reads. It is designed to *disambiguate*, not to probe the most dramatic interpretation.

A bad suppressed question: "What are you hiding?" (presupposes Frame B)
A good suppressed question: "When you revise what you've written, what are you usually trying to get closer to?" (helps distinguish A from B)

**Prediction grading.** The system checks all open predictions from previous observations against today's behavioral data and grades each one as CONFIRMED, FALSIFIED, INDETERMINATE, or EXPIRED. Each grade triggers a Bayesian update on the relevant theory's confidence score.

**New predictions.** The system generates 1-2 falsifiable predictions about future sessions. Each prediction specifies a hypothesis, which interpretive frame it favors, what behavioral signature would confirm it, what would falsify it, a topic tag, and a type (behavioral, thematic, phase transition, or frame resolution). This is how the system learns whether its interpretations are analysis or storytelling. A prediction you never test is not a theory — it's a guess.

### The Prediction Engine

The prediction engine is the mechanism that turns Marrow's interpretive layer from storytelling into science.

Every observation generates predictions. Every subsequent observation grades them. Every grade updates a Bayesian confidence score. Over time, the system accumulates evidence for which of its interpretive patterns are actually predictive and which are stories it tells itself.

The architecture follows single-case experimental design methodology (Barlow & Hersen, 1984; Kazdin, 2011) and the predictive processing framework (Friston, 2006; Clark, 2013):

**Baseline.** The trajectory engine's "stable phase" detection establishes behavioral baselines — the SCED requirement before any intervention effect can be attributed.

**Prediction.** Each observation generates hypotheses with specific, falsifiable behavioral criteria. A prediction that says "the user is avoiding something" is useless. A prediction that says "next time this topic comes up, commitment ratio will drop below the 30th percentile and deliberation will spike above the 70th" is testable.

**Intervention.** The daily question is the intervention. Each generated question is tagged with one of six strategic intents: suppressed question promotion, theme targeting, contrarian break, frame disambiguation, trajectory probe, or depth test. This tag is the independent variable.

**Measurement.** The next session's behavioral data, trajectory shift, and knowledge-transforming score are the dependent variables — measured by a system (the trajectory engine) that is completely independent of the AI interpretation layer.

**Grading.** The observation pipeline grades predictions against the new data. CONFIRMED means the predicted behavioral signature appeared. FALSIFIED means the opposite appeared. INDETERMINATE means the data doesn't clearly support either. EXPIRED means the prediction's time window passed without a relevant session.

**Bayesian updating.** Each grade updates a Beta-Binomial confidence score per theory/topic/frame combination. Alpha increments on confirmation, beta on falsification. The posterior mean starts at 0.5 (no evidence) and moves toward 0 or 1 as predictions accumulate. The system knows — with a number, not a feeling — how reliable its predictions about any given topic or frame have been.

The prediction track record feeds into both question generation and weekly reflection, creating a feedback loop where the system's awareness of its own reliability shapes its future behavior.

### Calibration

The system needs to know what "normal" looks like for you. Without a baseline, every pause looks meaningful and every deletion looks like avoidance.

Calibration is on-demand. After you submit your daily question, a "free write" option appears. Click it, get a neutral prompt — "Describe what you did this morning" or "What's on your desk right now?" — and write. Same textarea. Same invisible behavioral capture. Same session summary with full context metadata. But tagged as calibration data, not interpreted by the AI.

You can do as many as you want. Three in one sitting, or none for a week. The baseline gets richer over time at your own pace. More calibration sessions don't just improve typing baselines — they sharpen the entire prediction and knowledge-transforming detection system by giving the system a clearer picture of what neutral writing looks like for you.

Calibration baselines are **context-matched**. The system compares your deep question session against calibration sessions from the same device type and similar time of day. When it lacks calibration data for a specific context, it falls back to global baselines and flags the reduced confidence. Baseline confidence is a spectrum — none, low, moderate, strong — not a binary.

The daily question always comes first. You cannot access free writes until you've answered. The daily question is sacred. Calibration is secondary.

### Error Correction

The system is designed to catch its own mistakes. Eight mechanisms prevent interpretive drift:

**1. Context-matched calibration baselines.** The system knows what your "normal" looks like on the same device at a similar time of day. It only flags behavioral metrics that deviate significantly from your personal baseline in that context. A 47-second pause is not "meaningful" if your baseline on the same device at the same hour is 40 seconds.

**2. Three interpretive frames.** The AI cannot collapse to a single narrative. It must apply charitable, avoidance, and mundane frames to every signal and assess which one the data supports. This produces structured disagreement along axes that matter, not three variations of the same story.

**3. "Did it land?" feedback.** Every 5th daily submission, a simple yes/no prompt appears: "Did today's question land?" One bit of external signal. A "no" is clear — the system's line of questioning missed. A "yes" is weaker signal — could mean insightful, uncomfortable, or just emotionally loaded. This tunes question generation without breaking the black box.

**4. Weekly self-correction.** Every 7th response, the AI runs a reflection that includes a mandatory self-correction section. It must:
- Identify which observations were likely wrong — where the charitable or mundane frame fit better than the avoidance frame
- Flag where the three frames converged too much, producing "decorated confirmation bias" rather than genuine disagreement
- Name suppressed questions that presupposed an interpretation rather than disambiguating between frames
- Identify narratives it has been building that might be stories rather than evidence
- Flag where it lacked calibration data for a specific context and should have been more cautious
- State what it's confident about vs. uncertain about vs. needs more data on

If it cannot identify at least one error, it's not being honest. Every model drifts. The system is designed to name the drift.

**5. Multi-model audit.** Every weekly reflection runs two passes. The primary reflection is generated by Claude Opus 4.6. A secondary audit is then run by Claude Sonnet 4.6, which reviews the primary reflection against the same raw data and checks for: overconfident claims, confirmation bias, dishonest self-correction (identifying minor errors while protecting major narratives), and missed patterns. The audit is appended to the reflection and becomes context for all future analysis.

One model generating three interpretations is structured self-disagreement. Two different models reviewing each other's work is genuine independence. The daily observations use the first approach (cheaper, controlled). The weekly reflection uses both.

**6. Contrarian retrieval.** Semantic retrieval has its own bias: it surfaces entries with similar *language*, which reinforces dominant themes. If the user writes about their career every week, RAG keeps pulling career entries, and the system asks more career questions. Contrarian retrieval deliberately surfaces entries that are the *most dissimilar* to the current cluster — threads the system has been ignoring. This breaks semantic lock-in at the retrieval layer, before the interpretive frames are even applied.

**7. Reflection decay.** Old reflections can become self-reinforcing. A hypothesis from month 2 — "this person is avoiding a career decision" — could sit in every prompt at month 8, shaping how the model reads new entries even if the pattern is long gone. The system includes only the last 4 reflections in full. Older reflections are stored and embedded but only resurface via semantic retrieval when their themes are relevant to the current moment. An old hypothesis has to earn its way back into the prompt — but it's never permanently gone.

**8. Falsifiable predictions with Bayesian grading.** The strongest error correction mechanism. The system must commit to testable predictions before seeing the next session's data. Predictions that fail update the theory's confidence score downward. Over time, the system accumulates a track record that tells it — with numbers, not vibes — which of its interpretive patterns are reliable and which are stories. A system that only explains post hoc never actually learns (Clark, 2013). A system that predicts and gets graded does.

### Event-Driven Architecture

Everything fires on a single event: the user hitting submit.

#### On Submission (Daily Question)

1. **Response + session summary + context metadata saved** — the response text, all derived behavioral metrics, and device/time context are written to the database.
2. **AI observation runs** — reads today's data with context-matched calibration baselines and knowledge-transforming score. Grades any open predictions against today's behavioral data. Applies three interpretive frames. Generates a disambiguating suppressed question. Generates 1-2 new falsifiable predictions. Updates Bayesian theory confidence scores. Skipped on calibration sessions.
3. **Response embedding runs** — the new entry is vectorized via Voyage AI and stored in sqlite-vec for future semantic retrieval. Failures are non-blocking — the system degrades to recency-only retrieval if the embedding service is unavailable.
4. **Question generation runs** — during the seed phase (days 1-30), this is a no-op. After day 30, it assembles a bounded context window via semantic retrieval (recent entries + resonant older entries + reflections as hypothesis layer), receives the prediction track record and theory confidence scores, generates tomorrow's question, and tags it with intervention intent.
5. **Weekly reflection + audit runs** — every 7th response. Primary reflection on Opus, then secondary audit on Sonnet. The reflection now includes a prediction analysis section reviewing which prediction types are most reliable, patterns in hits vs. misses, and leading indicator usefulness. After saving, the reflection is embedded and its coverage boundary is recorded so future prompts know which entries have been digested.

#### On Submission (Free Write)

1. **Response + session summary + context metadata saved** — tagged as calibration. The behavioral data feeds into context-matched baselines.
2. **No AI observation, no question generation, no reflection.** Pure data collection.

The user sees none of the background processing. They get their done message instantly. The background jobs run after the response is returned.

There are no cron jobs, no scheduled tasks, no server dependencies. The system is fully event-driven. If the user submits, everything runs. If they don't, nothing runs. The system's heartbeat is the user's engagement.

### What Marrow Feeds

Marrow is the data layer for [Einstein](https://github.com/anthonyguzzardo/Einstein), a longitudinal thinking partner. Einstein consumes everything Marrow collects — response text, behavioral signals with context, AI observations with three-frame analysis, suppressed questions, weekly reflections with multi-model audits, question feedback, prediction track records with Bayesian confidence scores, intervention-tagged questions, knowledge-transforming scores, and trajectory data with leading indicators — as persistent context. Where Marrow asks, Einstein converses. The depth of that conversation is bounded by the depth of the data Marrow has accumulated.

Einstein is not a chatbot that knows you well. Einstein is a theorist whose subject happens to be you. The prediction engine gives him a lab notebook with a track record. The trajectory engine gives him a measurement instrument he can't manipulate. The intervention tags give him experimental metadata. When Einstein says "I think X about you," it's not a cold read — it's a theory with evidence, tested against a non-AI measurement instrument, graded by its own prediction history.

## What This Looks Like

### Day 3

The question: *"What decision are you quietly avoiding?"*

You open the page on your laptop at 9pm. Stare at it for 47 seconds before typing. You write: "I think I need to leave my job but I keep telling myself the timing isn't right." Then you delete "I think I need to leave my job" and replace it with "There's a career thing I haven't figured out yet." You submit.

**What you see:** A done message. "That's enough for today." Below it, a subtle "free write" link.

**What the system captured:**
- Device: desktop, 21:00, Friday
- First-keystroke latency: 47,000ms
- Commitment ratio: 0.38 (you typed 140 characters, kept 53)
- 1 revision (36 characters — a full sentence replaced with a vague one), 2 corrections
- Revision timing: early (false start)
- Knowledge-transforming score: 0.31 (low — recitation, not new thinking)

**What the AI wrote (you never see this):**

> Signal: 47-second first-keystroke latency
> - Frame A (Charitable): User was composing thoughtfully before starting. The question requires introspection. (medium)
> - Frame B (Avoidance): The question landed immediately — user knew the answer and hesitated to commit. (medium)
> - Frame C (Mundane): User was distracted, reading the question carefully, or settling in. (medium)
> - Calibration: NONE. No baseline exists for this device or time of day. Cannot distinguish between frames.
>
> Signal: 36-character deletion replacing direct statement with vague one
> - Frame A (Charitable): User decided the first phrasing was melodramatic and revised for accuracy. (medium)
> - Frame B (Avoidance): Self-censorship — user retracted something too honest. (medium)
> - Frame C (Mundane): Normal editing behavior — user reconsidered scope. (low-medium)
> - Calibration: No data. The shift from specific ("leave my job") to vague ("career thing") is notable but interpretation is underdetermined.
>
> Synthesis: Two signals suggest possible avoidance but both have equally plausible charitable explanations. Overall confidence: INSUFFICIENT DATA. The specificity gap (job → career thing) is the most interesting data point — worth tracking but not enough to build a narrative on.

**Suppressed question:**
> *"When you revise what you've written, what are you usually trying to get closer to?"*

**Prediction:**
> TYPE: FRAME_RESOLUTION
> HYPOTHESIS: Next time a question touches career/work, commitment ratio will drop below the 30th percentile and at least one large deletion will occur — the specificity gap will repeat.
> FRAME: B
> TOPIC: career
> CONFIRMS: commitment ratio <0.5, large_deletion_count >= 1, vague language replacing specific language
> FALSIFIES: commitment ratio >0.8, no large deletions, direct/specific language maintained

This prediction doesn't presuppose avoidance. It says: *if* Frame B is right about the career topic, *then* a specific behavioral signature should repeat. If it doesn't, Frame B loses confidence on this topic.

### After Day 3 — Free Write

You click "free write." The prompt: *"What did you eat yesterday? Walk through it meal by meal."*

You type for 3 minutes on the same laptop at 9:15pm. First-keystroke latency: 12 seconds. Commitment ratio: 0.89. Two deletions, both under 5 characters. No pauses over 30 seconds. You click "another one." New prompt. Similar numbers.

The AI doesn't interpret any of this. It stores the behavioral data with context: desktop, 21:00, Friday. Now it has a context-matched baseline. On this device at this time: latency is 12 seconds, commitment ratio is 0.89, and you barely delete.

Day 3's 47-second latency and 0.38 commitment ratio deviate significantly from this baseline. The system's confidence in flagging those signals just went from INSUFFICIENT DATA to MODERATE.

### Day 10 — "Did It Land?"

You submit your response. This is every 5th submission, so below the done message you see: *"did it land?"* with two buttons: *yes* and *no*.

You tap "no." One bit of signal. The system knows this question missed. When it generates questions in Phase 2, it will weight away from this line of inquiry.

### Day 11

The question: *"What have you outgrown but haven't let go of yet?"*

You type fast on your phone during lunch. No pauses. No deletions. 280 words in 6 minutes. Commitment ratio: 0.97. Knowledge-transforming score: 0.22 (low — fluent recitation of a processed answer).

**What the AI wrote:**

> Signal: Commitment ratio 0.97 on mobile at 12:00
> - Frame A (Charitable): User had a clear, processed answer. This topic is resolved for them. (high)
> - Frame B (Avoidance): User gave a rehearsed answer — fluency indicates performance, not honesty. (low)
> - Frame C (Mundane): Mobile typing tends toward fewer deletions. Ratio may reflect device, not psychology. (medium)
> - Calibration: No mobile calibration data exists. Comparing against desktop baseline (0.89) is unreliable — flagging device mismatch.
>
> Synthesis: Frame A is most likely but Frame C introduces legitimate doubt. The system needs mobile calibration sessions before it can interpret phone-based behavioral data with confidence. Overall confidence: LOW due to device mismatch.

### Day 14 — Weekly Reflection

The AI runs its weekly reflection on Opus. Then Sonnet audits it.

**Sonnet's audit (appended to the reflection):**

> The primary reflection identifies the "career thing" thread as the strongest signal but correctly notes calibration weakness. However, the self-correction section identifies only one minor error (over-interpreting Day 7's pause count) while protecting the career-avoidance narrative across four other observations. The reflection would be stronger if it considered that the Day 3 specificity gap could reflect the user learning the system's format rather than psychological avoidance. The primary model's revised model section states "moderate confidence" in the career thread — given the calibration gaps and device mismatches flagged elsewhere, "low confidence" would be more honest.

### Day 31

Seeds are done. The AI has 30 observations with three-frame analysis. 30 suppressed questions designed to disambiguate, not dramatize. A behavioral fingerprint calibrated across devices and times of day. Four self-correction cycles with multi-model audits. A prediction track record with Bayesian confidence scores for each theory. Question feedback data on which questions landed and which didn't.

It generates tomorrow's question. Not from a single confident narrative. From a model that knows what it's sure about, what it's guessing, where its calibration is weak, where an independent auditor disagreed with its read, and which of its predictions have held up.

The question is tagged: FRAME_DISAMBIGUATION. The system chose it because its career-topic predictions have a posterior mean of 0.62 — leaning confirmed but not strong. It needs more data. The question is designed to produce that data.

## Stack

- **Astro** (SSR, Node adapter)
- **SQLite** via better-sqlite3 + **sqlite-vec** (vector search in the same database)
- **Claude API** (`@anthropic-ai/sdk`) — Claude Opus 4.6 for primary analysis, Claude Sonnet 4.6 for weekly audit
- **Voyage AI** (`voyageai`) — voyage-3-lite embeddings for semantic retrieval
- **TypeScript** (strict)

## Architecture

- Single user, no auth
- SQLite database at `data/marrow.db` (includes vector embeddings via sqlite-vec)
- Seed questions in `src/lib/seeds.ts`
- RAG-based memory: every entry is embedded and retrievable by semantic similarity with recency weighting
- Contrarian retrieval: deliberately surfaces entries that are most *dissimilar* to current themes, preventing semantic lock-in
- Bounded prompt assembly: recent entries (verbatim) + RAG-retrieved older entries (by resonance) + contrarian entries (by dissimilarity) + reflections (hypothesis layer)
- Reflection decay: last 4 reflections included in full, older reflections only resurface via RAG when their themes are relevant again
- Prompts explicitly separate source of truth (raw entries) from hypothesis (model's interpretations)
- On-demand calibration via free writes with context metadata
- Three interpretive frames (charitable, avoidance, mundane)
- Context-matched baselines with confidence scoring
- Multi-model audit (Opus + Sonnet) on weekly reflections
- Reflection coverage tracking — each reflection records which entries it digested
- Prompt tracing — every AI call logs which entries, reflections, and observations went into the prompt, for future auditability
- "Did it land?" feedback every 5th submission
- Graceful degradation — if Voyage AI is unavailable, falls back to recency-only retrieval
- All analysis triggered on submit — no cron, no scheduler
- **Bob** — a witness-form rendered as a 3D object driven by a four-phase behavioral dynamics pipeline. Phase 1: raw session data is computed into 8D deterministic state vectors (fluency, deliberation, revision, expression, commitment, volatility, thermal, presence) — all z-scored against personal history, no AI. Phase 2: PersDyn dynamics are derived per dimension — baseline (rolling mean), variability (rolling std), attractor force (Ornstein-Uhlenbeck mean-reversion from lag-1 autocorrelation). Phase 3: empirical coupling matrix discovered via signed lagged cross-correlations across all 28 dimension pairs — reveals which behavioral dimensions causally influence each other for this specific person. Phase 3.5: emotion densities (NRC + Pennebaker, stored per session) are loaded and cross-correlated against the 8D behavioral state to discover emotion→behavior causal chains — kept separate from the behavioral state space by design (content signal vs. process signal). Phase 4: validated dynamics + emotion profile are rendered into a 26-trait visual genome by a single Opus call — the LLM translates behavioral physics into visual form (art, not science). Research: PersDyn (Sosnowska et al., KU Leuven 2019), Whole Trait Theory (Fleeson & Jayawickreme 2015/2025), ECTO system entropy (Rodriguez 2025), causal trait theories (Critcher, Berkeley xLab). See `BOB.md` for full documentation.
- **Behavioral dynamics engine** (`src/lib/bob/state-engine.ts`, `src/lib/bob/dynamics.ts`, `src/lib/bob/emotion-profile.ts`) — deterministic computation of per-entry behavioral states in 8 dimensions and PersDyn trait dynamics. Four new dimensions beyond the original trajectory: commitment (final/typed ratio z-scored), volatility (session-to-session behavioral distance), thermal (correction intensity + revision timing, Faigley & Witte 1981), presence (inverse distraction). Three parameters per dimension: baseline, variability, attractor force — where attractor force reveals whether a dimension is rigid (deviations snap back fast) or malleable (shifts persist). System entropy (Shannon entropy of variability distribution). Emotion→behavior coupling layer discovers cross-domain causal chains (e.g., "anticipation word density spikes → fluency follows 2 entries later at r=0.88"). Persisted to `tb_entry_states`, `tb_trait_dynamics`, `tb_coupling_matrix`, `tb_emotion_behavior_coupling`. Accessible via `/api/dynamics`.
- **Trajectory engine** (legacy, `src/lib/bob/trajectory.ts`) — the original 4D behavioral space: fluency, deliberation, revision, expression. Computes convergence and phase detection. Cross-correlates dimension pairs with lag to discover leading indicators (Mesbah et al. 2024). Now superseded by the 8D dynamics engine for Bob's visual pipeline, but retained for backward compatibility and feeds into observation, generation, and reflection as cross-session context.
- **Signal formatting module** (`src/lib/signals.ts`) — research-backed verbalization of behavioral data for LLM consumption. Converts raw session metrics into percentile-contextualized, baseline-anchored, importance-hierarchied natural language. Informed by Netflix "From Logs to Language" (2026), anchoring bias research (2024), "Lost in the Middle" positional attention (TACL 2024), and LLM numeracy studies (2026).
- **Prediction engine** — falsifiable predictions generated by the observation layer, graded against future behavioral data. Each prediction carries a hypothesis, favored frame, expected/falsification criteria, topic tag, and type. Grades update Bayesian Beta-Binomial confidence scores per theory/topic combination. Track record feeds into generation and reflection prompts. Follows SCED methodology (Barlow & Hersen 1984, Kazdin 2011) and active inference (Friston 2006, Clark 2013).
- **Knowledge-transforming detection** — scores each session for whether it produced new thinking (Bereiter & Scardamalia 1987, Galbraith 1999). Uses late revision ratio, substantive revision count, MATTR vocabulary diversity, and cognitive mechanism word density (Pennebaker LIWC). Measured relative to a calibration floor computed from free-write sessions — the distance above neutral writing is the real signal. The deepest available measure of whether a question *worked*.
- **Linguistic density pipeline** (`src/lib/linguistic.ts`) — server-side computation of 9 word category densities per session using the NRC Emotion Lexicon v0.92 (Mohammad & Turney, 2013) and Pennebaker LIWC word sets. Six emotion categories (anger, fear, joy, sadness, trust, anticipation) plus cognitive mechanism words, hedging language, and first-person pronoun density. Stored per session, percentile-ranked against personal history, and fed into observation, generation, and reflection prompts. Enables incongruence detection (emotional word profile mismatched with content) and cross-session slope tracking (Pennebaker, 2011).
- **Per-burst sequence capture** (`tb_burst_sequences`) — stores the full temporal structure of P-bursts within each session: character count, duration, and start offset per burst. Preserves the within-session data needed for Baaijen & Galbraith (2012) knowledge-transforming signature detection — the transition from short fragmented bursts to longer sustained bursts as thinking consolidates. Captured client-side, stored server-side.
- **Calibration-relative deviation** — behavioral metrics (commitment ratio, first keystroke, P-burst length, typing speed) are compared not just against journal history percentiles but against neutral free-write baselines. Deviations from calibration are stronger signals than deviations from other emotional entries, because they measure distance from "nothing interesting" rather than from "other hard questions."
- **Intervention tagging** — every generated question is tagged with strategic intent (suppressed promotion, theme targeting, contrarian break, frame disambiguation, trajectory probe, depth test). Correlating intent with trajectory outcome is how the system learns which types of questions produce depth.
- **Question candidate logging** (`tb_question_candidates`) — each generation produces 3 candidate questions. All three are stored with theme tags and uncertainty dimensions. The sequence of what the system needed to ask — and what it considered but rejected — is itself diagnostic signal (Harrison et al. 2017).
- **Adaptive difficulty** — question challenge level calibrates to prior response complexity via MATTR and cognitive word density. High-complexity responses earn more abstract, contradiction-surfacing questions. Low-complexity responses get more concrete, personally anchored questions (Bjork & Bjork 2011).
- **Research-backed question design** — generation prompt enforces causal/evaluative framing (Graesser & Person 1994), disclosure context (Pennebaker & Beall 1986), safe challenge (Edmondson 1999), information-gain selection (Settles 2012), spaced theme repetition at expanding intervals (Cepeda et al. 2006), and interleaving (Bjork & Bjork 2011).
- **Deliberate interface friction** — autocomplete/autocorrect/spellcheck disabled, 4-second reflection pause before textarea activates, question fades as writing begins (Hallnäs & Redström 2001; Cox et al. 2016; Czerwinski et al. 2004). Every UI decision serves signal quality.
- **Keystroke dynamics** (`inter_key_interval_mean`, `inter_key_interval_std`) — Epp et al. (2011) showed different emotions have distinct keystroke signatures. Mean and variability of inter-key intervals, captured per session.
- **Revision chain tracking** (`revision_chain_count`, `revision_chain_avg_length`) — Leijten & Van Waes (2013). Sequential deletions within 500ms grouped as revision chains. Chain topology distinguishes surface correction from structural revision.
- **Scroll-back and re-read tracking** (`scroll_back_count`, `question_reread_count`) — Czerwinski et al. (2004). Re-engagement with own text and with the question correlates with engagement depth.

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server at `localhost:4321` |
| `npm run build` | Build for production |
| `npm run observe` | Manually trigger AI observation |
| `npm run generate` | Manually trigger question generation |
| `npm run reflect` | Manually trigger weekly reflection |
| `npm run backfill` | Embed all existing entries for RAG retrieval |

## Future: Einstein Lab

The system currently has no way to evaluate whether it is getting better. It generates questions but never audits whether the sequence of questions is producing depth over time. A future addition — **Einstein Lab** — would address this as a sealed, isolated metacognitive layer.

### Design Principles (Not Yet Implemented)

- **Separate database.** The Lab reads from `marrow.db` but writes to its own `einstein-lab.db`. Nothing in Marrow's pipeline ever opens the Lab's database. The isolation is physical, not just logical.
- **Advisory, not executive.** The Lab can flag problems — "questions are converging on one theme" — but cannot directly influence question generation. The human is the only bridge.
- **Evidence-backed findings.** Every Lab output follows a structured format: claim, evidence, confidence, expiry, falsifier. No vibes, no narrative.

### Planned Modes

1. **Question audit** — reviews generated questions for thematic diversity, presupposition load, feedback correlation, whether suppressed questions are consistently sharper than actual questions, and whether contrarian retrieval is changing output. Now additionally: correlates intervention intent tags with trajectory outcomes to measure which question strategies produce depth.
2. **Discrepancy scan** — searches for contradictions across raw entries, reflections, observations, and self-critiques. Flags where the system's claims don't fit the data.
3. **System audit** — inspects architecture, retrieval patterns, and confidence language. Evaluates whether philosophy and implementation have diverged. Now additionally: reviews prediction hit rates by type and identifies systematic biases in the prediction engine.

### Why Not Now

At 30 entries there is nothing meaningful to audit. No question-generation history, no retrieval bias to detect, no narrative drift to catch. The prediction engine needs density before its track record is statistically meaningful. The Lab becomes valuable at day 60-120, when real patterns exist. The prompt tracing infrastructure (`tb_prompt_traces`) is already recording what goes into every AI call, and the prediction registry (`tb_predictions`) is recording every hypothesis and its outcome, so when the Lab is built, the evidence trail is waiting.

## Philosophy

Every technical decision serves depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.

Every design decision is grounded in peer-reviewed research — not because science legitimizes the work, but because the questions Marrow asks about human cognition have been studied for decades, and ignoring that work would mean rebuilding answers that already exist. The interface is informed by HCI research from MIT, Stanford, CMU, and KTH. The behavioral capture draws from writing process research spanning Chenoweth & Hayes to Baaijen & Galbraith. The linguistic analysis stands on Pennebaker's four decades of work and the NRC Emotion Lexicon. The prediction engine follows single-case experimental methodology. The question generator applies adaptive testing principles from psychometrics.

Where the research validates what we built, we cite it. Where it challenges what we assumed, we change. Where it has gaps, we experiment — but we name the gap, so we know what's hypothesis and what's evidence.
