---
title: "Construct Replacement: When AI-Mediated Input Invalidates Behavioral Measurement"
slug: construct-replacement
author: Anthony Guzzardo
date: 2026-04-19
status: published
version: 2
target_venue: Trends in Cognitive Sciences (Perspective)
abstract: "The behavioral and cognitive sciences depend on observing what humans do. The validity of any behavioral measurement rests on the assumption that observed behavior reflects the cognitive process the instrument claims to measure. AI mediation of human input, including autocomplete, predictive text, and AI-assisted drafting, is breaking this assumption, not by adding noise to behavioral data but by replacing the cognitive construct the data indexes. A word accepted from a suggestion is not a noisy measurement of lexical retrieval; it is a clean measurement of suggestion evaluation. The surface output is identical. The generating process is different. This paper distinguishes construct replacement from measurement noise, argues that AI-mediated input produces the former rather than the latter, and demonstrates the consequences through the keystroke-cognition literature as a worked example. The contamination is invisible at the point of collection, no provenance standard records it, and the window for establishing unmediated behavioral baselines is closing before the fields that need them have recognized it is open."
---

# Construct Replacement: When AI-Mediated Input Invalidates Behavioral Measurement

**Anthony Guzzardo**
April 2026

---

*Author's note: The author is developing a longitudinal journaling system that captures keystroke dynamics during unassisted writing. Readers should apply additional scrutiny to the design constraints discussion in Section 5, where the instrument-gap analysis overlaps with design decisions already implemented in that system. The construct replacement argument does not depend on any specific implementation and should be evaluated on its own terms.*

---

## Abstract

The behavioral and cognitive sciences depend on observing what humans do. The validity of any behavioral measurement rests on the assumption that observed behavior reflects the cognitive process the instrument claims to measure. AI mediation of human input, including autocomplete, predictive text, and AI-assisted drafting, is breaking this assumption, not by adding noise to behavioral data but by replacing the cognitive construct the data indexes. A word accepted from a suggestion is not a noisy measurement of lexical retrieval; it is a clean measurement of suggestion evaluation. The surface output is identical. The generating process is different. This paper distinguishes construct replacement from measurement noise, argues that AI-mediated input produces the former rather than the latter, and demonstrates the consequences through the keystroke-cognition literature as a worked example. The contamination is invisible at the point of collection, no provenance standard records it, and the window for establishing unmediated behavioral baselines is closing before the fields that need them have recognized it is open.

---

## 1. Introduction

The field studying what AI produces has a name for its data problem. Model collapse, the degradation of AI systems trained recursively on their own synthetic output, has been characterized formally, demonstrated empirically, and assigned a research program (Shumailov et al. 2024). The output side of AI contamination has received sustained attention because it threatens AI capabilities, which is to say, it threatens the interests of the people building AI systems.

The input side has received almost none.

By "input side," this paper means the human behavioral data that the cognitive and behavioral sciences rely on: what people write, how they write it, what they say, how they move, what they choose. The validity of any behavioral measurement rests on a foundational assumption: that the observed behavior reflects the cognitive process the instrument claims to measure. This is construct validity (Cronbach and Meehl 1955; Borsboom, Mellenbergh, and van Heerden 2004). When the assumption holds, behavioral data tells you something about the human who produced it. When it does not, the data tells you something about something else, and the failure can be invisible at the surface.

AI mediation of human input is producing exactly this kind of invisible failure, across every behavioral domain where AI assists, suggests, completes, or co-produces human output. The failure has not been named at the level of generality it requires. This paper names it, distinguishes it from the adjacent problems it has been conflated with, and argues that the window for addressing it is narrower than the fields affected have recognized.

The structural problem is the same one the model collapse literature identified on the output side: an original distribution is being replaced by a compressed, less diverse distribution, invisibly, with no provenance record. On the output side, the distribution is training data. On the input side, the distribution is human behavior. The output-side problem threatens AI capabilities. The input-side problem threatens empirical science. The input side has received less attention. That should change.

## 2. Noise versus Construct Replacement

The distinction that organizes this paper is between two categorically different threats to measurement validity.

**Noise** is measurement imprecision. The construct being measured is intact; the instrument captures it with some degree of error. A bathroom scale that reads two pounds heavy on every measurement is noisy. The construct, body weight, is unchanged. You can average out random noise with more data, and you can correct systematic noise if you characterize the bias. Noise degrades signal. It does not alter what is being signaled.

**Construct replacement** means the measurement now corresponds to a different construct entirely. The surface form of the data looks similar or identical to what the instrument was designed to capture. The generating process is different. More data does not help, because you are accumulating evidence about the wrong thing with increasing statistical power. A bathroom scale placed on a trampoline during an earthquake is not noisily measuring body weight. It is cleanly measuring something else. The readings are precise. They are precisely wrong.

This distinction has precedent in the measurement theory literature, though not under this name. Messick (1995) identified "construct-irrelevant variance" as a threat to validity, defined as variance in test scores attributable to factors outside the intended construct. But construct-irrelevant variance implies the target construct is still present, contaminated by additional signal. Construct replacement is a stronger condition: the target construct is no longer the primary generator of the observed data. The measurement has not been degraded. It has been redirected.

Flake and Fried (2020) documented a "construct validity crisis" in psychology, cataloguing widespread failures of alignment between theoretical constructs and operational measures. The crisis they describe is primarily one of underspecification: researchers measuring loosely defined constructs with loosely validated instruments. The crisis this paper describes is different in kind. The constructs were well-specified. The instruments were well-designed. The generating process underneath the behavior changed.

AI mediation of human input produces construct replacement, not noise. Consider the specific case of a word produced during text composition. When a person retrieves a word from memory and types it character by character, the observable data (the word itself, the timing of each keystroke, the pauses before and during production) reflects lexical retrieval, orthographic encoding, and motor execution. These are the constructs that keystroke-cognition researchers, computational linguists, and writing-process researchers intend to measure.

When the same word appears on screen because the person accepted a predictive text suggestion, the surface output is identical: the same word, in the same position, in the same sentence. But the cognitive process that produced it is different. The person scanned a suggestion, evaluated it against their communicative intention, and executed an acceptance action (a tap, a spacebar press, a tab key). This is a perceptual-evaluative process, not a retrieval-production process. It engages different cognitive resources, operates on a different timescale, and generates a different temporal signature in the keystroke stream.

Arnold, Chauncey, and Gajos (2020) provided direct empirical evidence for this replacement. Participants writing image captions with predictive text produced shorter texts with fewer unpredicted words, fewer adjectives, and reduced lexical variety. This was not because the participants had smaller vocabularies. The suggestion interface shifted the production task from generation to selection. The participants' language did not become noisier. It became a different kind of language, generated by a different process, measuring a different thing.

Banovic et al. (2019) documented the process-level signature: autocomplete shifts pause distributions from patterns characteristic of lexical retrieval to patterns characteristic of suggestion evaluation. Quinn and Zhai (2016) found that predictive text on mobile devices creates bimodal inter-keystroke interval distributions, characterized by fast acceptance bursts interleaved with normal typing, that are structurally unlike the unimodal distributions produced by unassisted writing. These are not degraded versions of the unassisted signal. They are different signals.

The replacement is not limited to individual words. Buschek, Zurn, and Eiber (2021) demonstrated that phrase-level suggestions alter content, not just speed. Writers shift toward suggestion-compatible framings, restructuring their intended message to accommodate what the system offers. At the document level, Doshi and Hauser (2024) found that AI-assisted creative writing enhances individual output quality while significantly reducing collective diversity: different writers producing AI-assisted text converge toward similar outputs. The individual measurement looks better. The population distribution is compressed. Padmakumar and He (2024) showed this homogenization operates asymmetrically across cultures, with AI suggestions causing writers from non-Western backgrounds to adopt Western writing conventions.

Perhaps most striking is the evidence that construct replacement persists after the AI is removed. Zhou and Liu (2025) conducted a seven-day experiment in which participants generated ideas with and without AI assistance. After AI withdrawal, individual creativity dropped, but content homogeneity continued climbing. The AI had not just temporarily altered the output. It had altered the generating process in the human in a way that outlasted the mediation itself.

This is the feature that makes construct replacement categorically different from noise. Noise is contemporaneous with the measurement and disappears when the noise source is removed. Construct replacement can restructure the process being measured, producing altered behavior even in unmediated conditions. A behavioral dataset collected from a population with extensive AI-mediation experience may not reflect unmediated cognition even when the immediate data collection is unassisted.

A clarification on the categorical framing. In practice, the boundary between noise and construct replacement is not sharp. Some forms of AI mediation partially preserve the original construct while partially introducing a new one. A spellchecker that corrects a typo after the word is fully typed adds noise to the revision signal but leaves lexical retrieval intact. A predictive text system that replaces retrieval with selection is closer to full construct replacement. The distinction is best understood as an analytical tool that forces the right question (what is this measurement actually indexing?) rather than as a claim that every instance of AI mediation falls cleanly into one category. The value of the categorical framing is precisely that it prevents mediation effects from being absorbed into a noise budget without examination. Whether a specific form of mediation constitutes noise, partial replacement, or full replacement is an empirical question. That it could be replacement at all is the claim the field has not yet engaged with.

## 3. The Input Side Is Where Human Cognition Is Observable

The model collapse literature has focused on what AI produces contaminating what AI consumes. This is a legitimate problem for AI development. But it is the wrong frame for science, because science does not primarily need to know what AI does. Science needs to know what humans do.

Human cognition is not directly observable. It is inferred from behavior: what people write, say, choose, draw, remember, forget, hesitate over, revise. Every inference from behavior to cognition depends on the assumption that the behavior was generated by the cognitive process the researcher intends to study. This assumption has always been approximate. No behavioral measure perfectly reflects its target construct. But it has been approximately true in a stable way. The approximation was understood, bounded, and manageable.

AI mediation of input destabilizes the approximation in a way that is not bounded and not manageable with existing tools. The destabilization operates silently, at the point of data generation, with no flag in the dataset indicating which behaviors were AI-mediated and which were not.

The asymmetry between the output side and the input side is worth stating directly. On the output side, contamination degrades AI system performance, a problem that AI developers have strong incentive to solve. On the input side, contamination degrades human behavioral data, a problem that behavioral scientists have not yet recognized as distinct from other forms of measurement error. The output-side problem has a name (model collapse), a formal characterization, and a research program. The input-side problem has none of these. It is not that the problem has been studied and found to be minor. It is that the problem has not been framed as a problem.

Hancock, Naaman, and Levy (2020) introduced the framework of "AI-mediated communication" to study how AI transforms interpersonal messaging, but their analysis focused on communication outcomes and social perception rather than measurement validity. Jakesch et al. (2023) demonstrated that AI writing suggestions shift users' expressed opinions toward the AI's tendencies. This is evidence for construct replacement, though it was not framed as such. Goergen, de Bellis, and Klesse (2025) showed across twelve studies (N = 13,342) that people systematically alter their self-presentation when they believe AI rather than a human is evaluating them, shifting toward more analytical self-descriptions. The behavioral data generated under AI assessment does not reflect the same self-concept as data generated under human assessment. Each of these findings points at the same structural problem. None names it at the level of generality it requires.

## 4. Invisibility and the Absence of Provenance

The defining feature of input-side construct replacement is that it is invisible at the point of collection.

No major behavioral dataset records whether a given word was typed character by character or accepted from a predictive suggestion. No keystroke logging system flags which pauses reflect human retrieval difficulty and which reflect suggestion scanning. No linguistic corpus marks which sentences were composed by the writer and which were drafted by an AI and lightly edited. No clinical self-report instrument records whether the respondent composed their answers with AI assistance.

This is not a gap that can be closed with better post-hoc analysis. Human-versus-AI text detection accuracy is poor even for fully AI-generated text (approximately 58% in controlled conditions; Jawahar, Abdul-Mageed, and Lakshmanan 2020). Detection of AI-*assisted* text is a harder problem by construction: the text genuinely is human-produced, by a human who intended to write it, just under cognitive conditions that differ from what the instrument assumes. No detection method can distinguish a word the writer retrieved from memory from a word the writer accepted from a suggestion, because the finished text is identical in both cases. The distinguishing information exists only in the process data (keystroke timing, pause structure, acceptance events), and that data is not collected by any standard behavioral dataset. The contamination is baked into the data at collection. It cannot be removed because it was never recorded.

Existing data provenance frameworks do not address this problem. The Data Provenance Initiative and related efforts focus on the provenance of training data for AI systems: who created it, under what license, with what consent. These are important questions, but they are output-side questions. No provenance standard currently requires recording whether human-produced data was generated under AI-mediated conditions. No consent framework asks participants to disclose their use of predictive text, autocomplete, or AI drafting tools during data collection. The infrastructure for tracking input-side mediation does not exist.

This means that the contamination is cumulative and retrospectively undetectable. Every behavioral dataset collected from a population with significant AI-mediation exposure is potentially compromised, and the degree of compromise cannot be estimated from the data alone. This is categorically different from most measurement validity threats, where the noise source can be characterized, modeled, and corrected. You cannot correct for a construct replacement you cannot see.

## 5. The Closing Window

The practical implication of the preceding argument is that naturalistic unassisted behavioral data is becoming unavailable on a timeline that outpaces the fields that need it. By "naturalistic unassisted behavioral data," this paper means data generated by humans producing behavior without AI mediation, in their normal environments, at population scale.

This is not a claim that unassisted behavioral data can never be collected. Controlled laboratory conditions can require unassisted performance. Clinical assessments can prohibit AI tools. But these are not the conditions under which most behavioral data is generated, and they are not the conditions that ecological validity requires. The longitudinal, naturalistic, ambient behavioral data that the digital biomarker field has been building toward depends on the behavior being relevantly similar to what the person would do anyway. Passive monitoring during daily life, keystroke dynamics during natural writing, speech patterns during ordinary conversation: all of these assume that the observed behavior is the person's own. If what the person does anyway is AI-mediated, the ecological validity premise collapses.

The keystroke-cognition literature provides a concrete worked example. This field has been waiting for a demographic shift: the arrival of lifelong fluent typists into the age range where cognitive decline becomes clinically relevant. Current studies have drawn from a population born roughly between 1940 and 1965, people who learned to type in middle age and often never achieved the motor automaticity required for keystroke timing to reflect cognitive processes rather than motor execution (Pinet et al. 2022; see Guzzardo 2026 for a detailed treatment of this confound). By 2035 to 2055, the at-risk population will consist of lifelong typists for whom the motor layer is transparent and the keystroke signal carries cognitive information cleanly.

But the cohort arriving with typing fluency is the same cohort arriving with maximum AI-mediation exposure. The demographic shift that would have resolved the motor confound is being partially foreclosed by a technology shift operating on a faster timeline. The clean keystroke signal the field has been waiting for may not arrive clean. This is the general problem in miniature: the demographic resolution and the AI contamination are arriving together, and the second may foreclose the opportunity the first was supposed to create.

An adequate instrument for this problem would need to capture process-level temporal microstructure, not finished text alone. It would need to maintain longitudinal personal baselines rather than rely on cross-sectional population norms. It would need to operate under unassisted conditions, or at minimum flag mediation status for each segment of input. And it would need to generalize across input modalities as keyboards are displaced by voice, gesture, or neural interfaces. No existing instrument at validated scale satisfies all of these requirements simultaneously. The instrument gap is real, and it is urgent in proportion to how quickly unassisted writing ceases to be the default mode of text production.

The urgency is compounded by evidence that the effects of AI mediation may persist beyond the mediation itself. If Zhou and Liu's (2025) finding generalizes, and AI-assisted production does leave a lasting "scar" on human generative diversity even after the AI is removed, then the window is not just about capturing unmediated behavior while it still occurs naturally. It is about establishing baselines in populations whose generative processes have not yet been restructured by sustained AI exposure. That window is narrower still.

## 6. Discussion

**What this argument does not claim.** It does not claim that AI mediation of human behavior is bad. AI-assisted writing can be more efficient, more accessible, and in some contexts more effective than unassisted writing. The argument is about measurement validity, not human flourishing. Whether AI-mediated writing is better or worse for the writer is a separate question. Whether the data it produces is interpretable under the assumptions the field has been making is this paper's question, and the answer is that it may not be.

**The relationship to model collapse.** The structural parallel between output-side model collapse and input-side construct replacement is useful for orientation but should not be overdrawn. Model collapse is a formal mathematical phenomenon with precise dynamics: recursive self-training on synthetic data produces convergence on compressed distributions with progressive loss of distributional tails (Shumailov et al. 2024). Input-side construct replacement involves human adaptation, which is more complex, more varied, and less formally characterizable than model degradation. Humans do not simply converge; they develop hybrid strategies, resist in some domains while adapting in others, and vary enormously in their susceptibility to mediation effects. "Construct replacement" describes the measurement-theoretic consequence, not the dynamics by which it occurs.

**Limitations.** This paper argues for the existence and importance of construct replacement as a measurement validity threat. It does not quantify the degree of construct replacement in any existing dataset. That quantification is the empirical contribution the field needs next. The claim that naturalistic unassisted behavioral data is becoming unavailable assumes current adoption trajectories continue. A regulatory or cultural shift toward unmediated input in research contexts is possible. But such a shift would require recognizing the problem this paper describes, which has not yet occurred.

**The research program this paper argues for has three components.** The first is empirical characterization: for each major form of AI mediation (word-level autocomplete, phrase-level suggestion, sentence-level AI drafting, full document co-production), determine where it falls on the noise-to-replacement continuum described in Section 2, using paired within-subject designs that compare process-level behavioral signals under mediated and unmediated conditions. This work does not yet exist and it is the foundation everything else depends on. The second is provenance infrastructure: extending data collection standards so that AI-mediation status is recorded as a variable alongside demographics and task conditions, and extending provenance standards for human behavioral data to include input-side mediation. This requires no new technology, only the recognition that mediation status is a relevant variable. The third is baseline accumulation: building instruments that capture unmediated human behavior at process-level fidelity, under longitudinal architectures, now, while unmediated behavior is still common enough to serve as ground truth. Pre-2020 behavioral datasets collected before widespread AI mediation should be recognized as a limited and irreplaceable resource, preserved and catalogued with the same urgency the field has brought to pre-synthetic training data on the output side.

The behavioral sciences have a data problem they have not yet named. It is not the problem of insufficient data, biased samples, or unreliable instruments. It is the problem that the construct being measured is changing underneath the measurement, invisibly, at scale, with no provenance record. The fields that depend on human behavioral data have a narrow window to establish uncontaminated baselines. Naming the problem is the first step toward addressing it.

---

## References

Arnold, K. C., Chauncey, K., & Gajos, K. Z. (2020). Predictive text encourages predictable writing. *Proceedings of the 25th International Conference on Intelligent User Interfaces*, 128-138.

Banovic, N., Buzali, T., Chevalier, F., Mankoff, J., & Dey, A. K. (2019). Quantifying the effects of autocomplete on text input efficiency and user behavior. *Proceedings of the ACM on Interactive, Mobile, Wearable and Ubiquitous Technologies*, 3(3), 1-28.

Borsboom, D., Mellenbergh, G. J., & van Heerden, J. (2004). The concept of validity. *Psychological Review*, 111(4), 1061-1071.

Buschek, D., Zurn, M., & Eiber, M. (2021). The impact of multiple parallel phrase suggestions on email input and composition behaviour of native and non-native English writers. *Proceedings of the 2021 CHI Conference on Human Factors in Computing Systems*, 1-13.

Cronbach, L. J., & Meehl, P. E. (1955). Construct validity in psychological tests. *Psychological Bulletin*, 52(4), 281-302.

Doshi, A. R., & Hauser, O. P. (2024). Generative AI enhances individual creativity but reduces the collective diversity of novel content. *Science Advances*, 10(28), eadn5290.

Flake, J. K., & Fried, E. I. (2020). Measurement schmeasurement: Questionable measurement practices and how to avoid them. *Advances in Methods and Practices in Psychological Science*, 3(4), 456-465.

Goergen, J., de Bellis, E., & Klesse, A.-K. (2025). AI assessment changes human behavior. *Proceedings of the National Academy of Sciences*, 122(25), e2425439122.

Guzzardo, A. (2026). A closing window: The demographic confound in keystroke-based cognitive biomarkers and the AI-mediation threat to the paradigm that would replace it. Preprint.

Hancock, J. T., Naaman, M., & Levy, K. (2020). AI-mediated communication: Definition, research agenda, and ethical considerations. *Journal of Computer-Mediated Communication*, 25(1), 89-100.

Jakesch, M., Hancock, J. T., & Naaman, M. (2023). Human heuristics for AI-generated language are flawed. *Proceedings of the National Academy of Sciences*, 120(11), e2208839120.

Jawahar, G., Abdul-Mageed, M., & Lakshmanan, L. (2020). Automatic detection of machine generated text: A critical survey. *Proceedings of the 28th International Conference on Computational Linguistics*, 2296-2309.

Messick, S. (1995). Validity of psychological assessment: Validation of inferences from persons' responses and performances as scientific inquiry into score meaning. *American Psychologist*, 50(9), 741-749.

Padmakumar, V., & He, H. (2024). Does writing with language models reduce content diversity? *Proceedings of the 2024 Conference on Empirical Methods in Natural Language Processing*.

Pinet, S., Zielinski, C., Alario, F.-X., & Longcamp, M. (2022). Typing expertise in a large student population. *Cognitive Research: Principles and Implications*, 7, 77.

Quinn, P., & Zhai, S. (2016). A cost-benefit study of text entry suggestion interaction. *Proceedings of the 2016 CHI Conference on Human Factors in Computing Systems*, 83-88.

Shumailov, I., Shumaylov, Z., Zhao, Y., Papernot, N., Anderson, R., & Gal, Y. (2024). AI models collapse when trained on recursively generated data. *Nature*, 631, 755-759.

Zhou, E., & Liu, Q. (2025). Creative scar without generative AI. *Technological Forecasting and Social Change*, 215, 124010.
