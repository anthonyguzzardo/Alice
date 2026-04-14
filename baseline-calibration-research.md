# Baseline Calibration Research

**The question:** Does it make sense to mix real questions with neutral/generic ones — no Bob, no grading, just raw pipeline — to establish a baseline before layering everything on?

**The answer:** Yes. Run real questions alongside bland ones through the observation pipeline. If the signals (P-bursts, MATTR, NRC densities, etc.) don't move between deep and generic prompts, the pipeline can't detect depth. If they do move, it's picking up something real. That's your baseline.

---

## Research that confirms this

### Prompt response variation — Sanchez-Gutierrez et al. (2024, UC Davis)
Even two prompts within the same genre produce substantially different linguistic feature profiles. You have to understand what the prompt itself contributes to the signal before you can attribute anything to the person writing.

- Paper: "Prompt response variation in learner corpus research: Implications for data interpretation"
- Authors: Claudia H. Sanchez-Gutierrez, Sophia Minnillo, Paloma Fernandez Mira, Andrea Hernandez
- Department of Spanish and Portuguese, UC Davis

### Cognition Hypothesis — Peter Robinson (University of Hawaii)
Task cognitive complexity directly alters linguistic output on measurable dimensions (syntactic complexity, lexical diversity, accuracy). A deep prompt consumes attentional resources differently than a generic one, which changes the signal profile independent of who's writing.

- Paper: "The Cognition Hypothesis, Task Design, and Adult Task-Based Language Learning"
- Published in Second Language Studies, University of Hawaii

### Limited Attentional Capacity — Peter Skehan
Humans have finite attentional resources. When a task is cognitively demanding, they trade off between complexity, accuracy, and fluency (the CAF triad). Without a baseline, you can't tell "this person writes with low syntactic complexity" apart from "this prompt drained their cognitive budget."

### Signal-to-noise framework — Heineman et al. (2025, Allen Institute for AI / University of Washington)
You must measure the noise floor before you can claim signal. They found a strong correlation (R=0.791) between signal-to-noise ratio and decision accuracy.

- Paper: "Signal and Noise: A Framework for Reducing Uncertainty in Language Model Evaluation"
- Authors: David Heineman, Valentin Hofmann, Ian Magnusson, et al.

### MATTR psychometric validation — Fergadiotis, Wright, Green (2015)
Validated MATTR as a "relatively pure measure of lexical diversity" with "no systematic effects from construct-irrelevant sources." They established this by testing against known baselines — the methodology itself is baseline-first.

- Paper: "Psychometric Evaluation of Lexical Diversity Indices: Assessing Length Effects"
- Portland State / East Carolina / Arizona State
- PMC4490052

### MATTR development — Covington & McFall (2010, University of Georgia)
The authors note that "a standard window size must be chosen for reproducible results" — an inherent calibration step. Different window sizes for different purposes (500 words for standard, 10 words for dysfluency detection).

- Paper: "Cutting the Gordian Knot: The Moving-Average Type-Token Ratio (MATTR)"
- Journal of Quantitative Linguistics, Vol 17, No 2

### LIWC norms — Tausczik & Pennebaker (2010, CMU / UT Austin)
Pennebaker's group established LIWC norms across several dozen studies totaling more than 100 million words. These norms ARE baselines — population-level expectations. Without them, individual scores mean nothing. The entire field of computerized text analysis is built on baseline-first methodology.

- Paper: "The Psychological Meaning of Words: LIWC and Computerized Text Analysis Methods"
- Journal of Language and Social Psychology, 29, 24-54

### Causal inference with text — Egami, Fong, Grimmer, Roberts, Stewart (2022)
When text features are used as treatments or outcomes, discovered mappings are "corpus specific" and must be validated through a split-sample workflow. Confounding the prompt with the measured signal "could lead to misrepresentations and potentially result in misinformed inferences."

- Paper: "How to Make Causal Inferences Using Texts"
- Science Advances, 2022
- Columbia / Michigan / Stanford / UCSD / Princeton

### Multi-dimensional register analysis — Douglas Biber (1988, Northern Arizona University)
Linguistic features co-occur in systematic patterns determined by situational context (audience, purpose, channel). The same person produces radically different linguistic profiles depending on register. A depth-provoking prompt creates a different register than a generic prompt — you need to understand that effect before attributing variation to the person.

### Ablation studies — established ML methodology
Systematically removing individual components of a system to observe changes in performance. This is the direct analog: running signal extraction without the full stack to understand what each layer contributes independently.

---

## Research that pokes holes

### Ecological validity — Holleman et al. (2020, Utrecht University)
Stripping context to create a "baseline" may produce measurements that don't generalize to the full-context condition. A neutral prompt doesn't just remove depth — it creates a fundamentally different communicative context. The person responding to "What did you do today?" is in a different psychological state than the person responding to "What are you avoiding?" The baseline may measure something real, but it might not be measuring the thing that matters.

- Paper: "The 'Real-World Approach' and Its Problems: A Critique of the Term Ecological Validity"
- Frontiers in Psychology, 2020

### Situated cognition — Jean Lave (1988)
Cognition is inseparable from context. Adults perform arithmetic brilliantly in grocery stores but poorly on decontextualized tests. A person's linguistic signal profile under a neutral prompt may be genuinely different from their profile under a deep prompt — not as noise, but as signal. The "baseline" you establish may be measuring a different cognitive mode entirely.

### Contextualized vs. decontextualized measurement
Research on personality assessment shows contextualized scales improve prediction of some outcomes by as much as 32% compared to decontextualized measures. The neutral-prompt baseline may actually be the noisier measurement, because the decontextualized condition introduces its own artifacts (social desirability, task disengagement, boredom).

### NRC lexicon reliability — Czarnek & Stillwell (2022, Jagiellonian / Cambridge)
NRC and LIWC produce "drastically different theoretical conclusions" for the same text. Using NRC alone, positive affect increases until age 65. Using LIWC alone, it drops sharply after 50. If the measurement tool itself is unreliable, calibrating it with a baseline doesn't solve the underlying validity problem.

- Paper: "Two is better than one: Using a single emotion lexicon can lead to unreliable conclusions"
- PMC9565755

### Floor effects
Neutral prompts may produce linguistically "flat" text (low complexity, low emotional density, short responses). Your baseline may be hitting the floor of your instruments. The signal range you observe between baseline and real conditions may be measuring instrument sensitivity rather than meaningful variation.

### Idiographic vs. nomothetic concern
For a single-user longitudinal system, the appropriate baseline is your own prior measurements over time, not a decontextualized control condition. Within-person variation requires repeated measurement, not a single neutral-prompt calibration session. Your first few weeks of real responses ARE the baseline.

### Measurement invariance / differential item functioning
If your signals behave differently under neutral vs. deep prompts — not just in magnitude but in their factor structure and interrelationships — then the baseline condition may not be measuring the same latent construct as the real condition.

---

## The bottom line

The baseline instinct is correct and well-supported. Mix real questions with generic ones, run the pipeline with no Bob or grading attached, and see if the signals discriminate between them. If they can't tell a deep question from a bland one, the pipeline needs work before you layer anything else on top.

The main caveat: for a single-user journal, your real long-term baseline is your own response history. The neutral-prompt test is a one-time sanity check on the pipeline. After that, your trajectory IS the baseline.
