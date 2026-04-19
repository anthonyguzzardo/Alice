# Option B: Skeleton and Working Document

**Working title:** *Construct Replacement: The Input-Side Data Crisis That Model Collapse Is the Wrong Name For*

**Status:** Skeleton. Not yet drafted.

---

## 1. What This Paper Is

A position paper with review elements, formal-academic register (same as Option A), arguing that AI mediation of human input is producing a construct validity crisis across behavioral and cognitive science that has been misrecognized, undernamed, or conflated with the output-side model collapse problem.

The central move: the field has been focused on what AI produces (synthetic data contaminating training sets, model collapse, benchmark saturation). Almost no one is looking at what AI is doing to what *humans* produce. The input side. The place where human cognition is actually observable. That signal is being altered at the source, silently, without provenance metadata, and the alteration is not noise. It is construct replacement.

The paper names this, distinguishes it from adjacent problems, connects it to the model collapse literature as a structural parallel, argues that unassisted human behavioral data is becoming a non-renewable resource, and uses the keystroke-cognition case as a worked example of what the crisis looks like in a specific field.

---

## 2. The Core Argument

**Premise 1.** Behavioral and cognitive science depend on observing what humans do. The validity of any behavioral measurement rests on the assumption that the observed behavior reflects the cognitive process the instrument claims to measure. This is construct validity.

**Premise 2.** There is a meaningful distinction between noise and construct replacement:
- **Noise** is measurement imprecision. The construct is intact; the measurement is degraded. You can average it out, filter it, model it. More data helps.
- **Construct replacement** means the measurement now corresponds to a different construct entirely. The surface form looks similar. The generating process is different. More data makes it worse, because you are accumulating evidence about the wrong thing.

**Premise 3.** AI mediation of human input (autocomplete, predictive text, AI-assisted drafting, smart compose, copilots) produces construct replacement, not noise. A word accepted from a suggestion is not a noisily-measured instance of lexical retrieval. It is an instance of suggestion evaluation. Different cognitive process. Different neural substrates. Different temporal signature. Same surface output.

**Premise 4.** This contamination is invisible at the point of collection. No major behavioral dataset records whether a given word was typed character-by-character or accepted from a suggestion. No provenance standard exists for input-side AI mediation. The contamination cannot be removed post-hoc because it was never observed.

**Premise 5.** Model collapse (output side) and behavioral baseline collapse (input side) are the same structural problem operating on different substrates. In model collapse, models trained on synthetic output lose distributional tails and converge on a compressed, less diverse version of the original distribution. In behavioral baseline collapse, humans producing AI-mediated input generate a compressed, less diverse version of unassisted human behavior. Both involve distribution replacement masquerading as distribution sampling. Both are invisible at the surface. Both are irreversible once the original distribution is lost.

**Claim 1.** The input side is more consequential than the output side for any field that needs to know what humans actually do, think, or feel. Model collapse threatens AI capabilities. Behavioral baseline collapse threatens the empirical foundations of cognitive science, clinical psychology, linguistics, public health surveillance, and any discipline that infers human states from human behavior.

**Claim 2.** Unassisted human behavioral data is becoming a non-renewable resource. Once a population's baseline behavior is AI-mediated, you cannot retrospectively collect unmediated baselines. The pre-mediation distribution is gone. This is not analogous to other data collection challenges where you can improve instruments or expand samples. The thing being measured has changed.

**Claim 3.** There is a narrow and closing window in which unmediated behavioral baselines can still be established. The fields that need these baselines (cognitive biomarkers, longitudinal mental health, developmental linguistics, clinical neuropsychology) have not recognized the urgency. Instruments that capture unmediated human input at high fidelity, with full provenance, need to be built and deployed now, while unassisted behavior is still common enough to serve as ground truth.

---

## 3. What This Paper Is Not

- Not a moral argument about whether AI mediation is good or bad. The paper is about measurement validity, not human flourishing. (Option C covers the philosophical territory.)
- Not a systematic review. Targeted review elements support the conceptual argument.
- Not a paper about model collapse. Model collapse is a structural parallel, not the subject. The subject is the input side.
- Not a paper about Alice. Alice appears as a worked example of what an instrument designed for the closing window looks like. The argument does not depend on Alice.

---

## 4. Literatures to Engage

**Construct validity in behavioral measurement.**
- Cronbach and Meehl (1955), foundational construct validity framework
- Borsboom, Mellenbergh, and van Heerden (2004), modern restatement: validity as the causal relationship between attribute and measurement
- Flake and Fried (2020), the "construct validity crisis" in psychology: questionable measurement practices

**AI mediation of human input (empirical).**
- Arnold, Gajos, and Chauncey (2020): predictive text makes writing more predictable, less colorful, shifts word choice. The strongest empirical anchor.
- Banovic et al. (2019): autocomplete changes pause distributions from lexical retrieval to suggestion evaluation
- Quinn and Zhai (2016): predictive text creates bimodal IKI distributions
- Buschek, Zurn, and Eiber (2021): phrase suggestions alter content, not just speed
- PNAS (2025): people behave differently when assessed by AI

**Model collapse (output side, as structural parallel).**
- Shumailov et al. (Nature 2024): model collapse from recursive training on synthetic data, tail distribution loss
- Harvard JOLT: "right to uncontaminated human-generated data," legal framing of data scarcity
- arXiv 2404.05090: statistical analysis of collapse dynamics

**Data provenance and observability.**
- arXiv 2404.12691: data authenticity, consent, and provenance are "all broken"
- Data Provenance Initiative (MIT/CMU): current standards do not cover input-side mediation
- No existing standard records whether human text input was AI-assisted at the character/word level

**Keystroke-cognition literature (worked example).**
- The Option A bibliography, compressed. Pinet et al. (2022), Yamaguchi and Logan (2014), Kim et al. (2024), Li et al. (2025), the automaticity threshold, the demographic confound, the closing window.

**Cognitive reserve and behavioral engagement.**
- Stern (2009): cognitive reserve framework
- Snowdon et al. (1996): Nun Study, linguistic engagement as long-range predictor

---

## 5. Tentative Structure

### Section 1: Introduction
The behavioral sciences assume that observed human behavior reflects human cognitive processes. This assumption has always been approximate. It is now becoming structurally unsound. AI mediation of human input is altering the generating process behind observed behavior without altering its surface form. The result is not noisier data. It is data about a different thing.

### Section 2: Noise vs. Construct Replacement
Define the distinction formally. Noise degrades signal but preserves construct validity; you can average it out. Construct replacement changes what is being measured; more data makes it worse. Give examples from measurement theory. Then: AI-mediated input is construct replacement, not noise. A word accepted from autocomplete is not a noisy measurement of lexical retrieval. It is a clean measurement of suggestion evaluation. Different construct. Same surface.

### Section 3: The Input Side
The model collapse literature has focused on what AI produces contaminating what AI consumes. Almost no attention has been paid to what AI does to what *humans* produce. But the input side is where human cognition is observable. If the input is contaminated, every downstream inference about the human is compromised. Keystroke timing, word choice, revision patterns, pause distributions, sentence structure: all of these carry cognitive information only when they reflect unmediated human production. When they reflect a hybrid of human intention and AI suggestion, the cognitive interpretation is indeterminate.

### Section 4: The Invisibility Problem
The contamination is unobservable at the point of collection. No behavioral dataset records input-side AI mediation at the word or character level. No provenance standard requires it. Post-hoc detection is unreliable (human vs. AI text detection accuracy is approximately 58%, per ACM TALIP). The contamination is baked into the data permanently. This is categorically different from most measurement problems, where you can characterize the noise source and model it out.

### Section 5: Structural Parallel to Model Collapse
Model collapse: models trained on synthetic output lose distributional tails, converge on compressed distributions, degrade invisibly. Behavioral baseline collapse: humans producing AI-mediated input generate compressed, less diverse behavior, degrading invisibly. Same structure. Different substrate. The output-side problem threatens AI capabilities. The input-side problem threatens empirical science. Both involve the loss of an original distribution that cannot be recovered once overwritten.

### Section 6: Non-Renewability
Unassisted human behavioral data is a non-renewable resource on current trajectory. Once baseline behavior is AI-mediated, you cannot go back and collect unmediated baselines from the same population. This is not a sampling problem. The population's behavior has changed. The pre-mediation distribution is extinct. This has implications for any field that needs longitudinal behavioral baselines, retrospective comparison, or ground-truth human behavior as a reference standard.

### Section 7: The Closing Window (Worked Example)
Compress the Option A argument into a single section. The keystroke-cognition field was waiting for a demographic shift that would deliver lifelong fluent typists into the at-risk age range. That shift would have enabled self-referential longitudinal baselines. But the cohort arriving with typing fluency is the same cohort arriving with maximum AI-mediation exposure. The clean signal the demographic shift would have produced is being partially foreclosed. This is the general problem in miniature: the window for establishing unmediated baselines is closing before the fields that need them have recognized it is open.

### Section 8: Design Constraints for Clean-Input Instruments
What would an instrument look like that is designed to capture unmediated human input with full provenance? Enumerate constraints: unassisted input conditions, keystroke-level capture, process and content integration, longitudinal architecture, AI-mediation detection or prevention, calibration against within-person baselines. Note that Alice satisfies these constraints as a prototype (author's note, with appropriate disclosure). The constraints are general; the implementation is specific.

### Section 9: Implications Across Fields
Briefly sketch how the input-side construct validity crisis applies beyond keystroke dynamics: clinical psychology (self-report measures completed with AI assistance), linguistics (corpora contaminated by AI-mediated text), education (writing assessment when students compose with AI), public health (behavioral surveillance when behavior is co-produced). Each is a one-paragraph sketch, not a full argument. The point is generality.

### Section 10: Discussion and Limitations
- The noise vs. construct replacement distinction is presented as categorical here; in practice there is a continuum. The paper argues the categorical framing is analytically useful even if the boundary is fuzzy.
- The non-renewability claim assumes current trajectory. A cultural or regulatory shift toward unmediated input is possible but not currently probable.
- The structural parallel to model collapse is an analogy, not a formal equivalence. The dynamics differ in important ways (human adaptation vs. model degradation).
- The paper does not quantify the degree of input-side contamination in any existing dataset. That is an empirical contribution the field needs; this paper argues for its necessity rather than providing it.

### Section 11: Conclusion
The behavioral sciences have a data problem they have not yet named. It is not the problem of insufficient data, biased samples, or unreliable instruments. It is the problem that the thing being measured is changing underneath the measurement, invisibly, at scale, with no provenance record. The fields that need unmediated human behavioral data have a narrow window to collect it. That window is closing. The instruments that could capture it need to be built with the same urgency the model collapse literature has brought to the output side. The input side matters more for science. It has received less attention. That should change.

---

## 6. Relationship to Other Papers

**Option A** (demographic confound): Section 7 of this paper compresses Option A's argument into a worked example. Option B does not replace Option A; it generalizes it. Option A stands alone as a contribution to the keystroke-cognition literature. Option B uses it as a case study within a broader argument.

**Option C** (unmediated cognitive engagement): Option C asks a philosophical/cultural question: what happens to human cognition when behavior is increasingly co-produced with AI? Option B asks a methodological question: what happens to behavioral data when the input is contaminated? They share a concern but have different theses, different audiences, and different registers. Option C is essayistic and aimed at a general intellectual audience. Option B is formal-academic and aimed at researchers.

---

## 7. Pre-Drafting Work

1. **Formalize the noise vs. construct replacement distinction.** Read Borsboom et al. (2004) and Flake and Fried (2020). The distinction needs to be grounded in measurement theory, not just asserted.
2. **Verify Arnold et al. (2020) findings in detail.** This is the empirical anchor. Read the full dissertation, not just the summary.
3. **Search for 2024-2026 empirical work on AI-mediated input effects.** The field is moving fast. Especially: any work measuring how LLM-assisted writing changes the statistical properties of the text produced.
4. **Check whether any paper has named the input-side problem.** The research survey suggests no one has, but verify with targeted searches before claiming novelty.
5. **Draft Section 2 (noise vs. construct replacement) as a standalone test.** If the distinction does not hold up under pressure, the paper does not work. Test it first.
6. **Decide on venue.** This paper fits a methods/measurement journal (e.g., *Psychological Methods*, *Behavior Research Methods*), a perspectives journal (e.g., *Trends in Cognitive Sciences*, *Nature Human Behaviour* commentary), or a data science venue. The venue determines length and citation density.

---

*End of skeleton. The argument is clean enough to draft once Section 2 survives pressure-testing and the pre-drafting literature checks are complete.*
