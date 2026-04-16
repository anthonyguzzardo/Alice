
# The Demographic Confound in Keystroke-Based Cognitive Biomarkers: Why Current Effect Sizes Are Conservative Lower Bounds

**Anthony Guzzardo**
April 15, 2026

## Abstract

Keystroke dynamics have emerged as a promising modality for passive cognitive assessment, with recent studies reporting sensitivity above 97% for mild cognitive impairment detection and AUC values exceeding 0.9 for community-based Alzheimer's screening. However, every published keystroke-cognition study targeting neurodegeneration has drawn its participants from a population that never achieved the typing automaticity required for keystroke timing to reflect cognitive processes rather than motor execution. This paper argues that the effect sizes reported in the current literature are conservative lower bounds on the technique's actual diagnostic power, artifacts of a generational confound rather than evidence of a weak method. The confound is self-resolving: by 2035 to 2055, the population at risk for age-related cognitive decline will consist of lifelong fluent typists, and the motor noise floor will drop dramatically. More importantly, this demographic shift does not merely improve existing cross-sectional methods. It enables an entirely new research paradigm: intra-individual longitudinal baselines where deviation from oneself, not deviation from a population norm, becomes the unit of analysis. The metrics for this paradigm do not yet exist because the data required to develop them has never been available. This paper identifies the timeline, the opportunity, and the instrument gap that must be closed before the first eligible cohort arrives.

---

## 1. Introduction

Keystroke dynamics have emerged as one of the most promising modalities for digital cognitive biomarkers. Recent studies report striking results: flight time alone achieves 97.9% sensitivity for mild cognitive impairment detection (Kim et al. 2024), and writing process biomarkers reach AUC = 0.918 for community-based Alzheimer's screening, outperforming both the Montreal Cognitive Assessment (MoCA) and the Mini-Mental State Examination (MMSE) (Li et al. 2025). The appeal is obvious: a passive, repeatable, low-cost measure of cognitive function captured during natural computer use, with no clinician required.

But there is a problem that no published study has named directly. Every keystroke-cognition study targeting neurodegeneration has drawn its participants from a population born between roughly 1939 and 1966, people who encountered computers between the ages of 30 and 55, many of whom never achieved the typing automaticity required for keystroke timing to reflect cognitive processes rather than motor execution. The total number of participants across all published keystroke-cognition studies for neurodegeneration is fewer than 500. The sample sizes are small in part because researchers cannot recruit enough elderly participants who type fluently enough for the signal to mean anything. Ntracha et al. (2020) reported that requiring 12 months of smartphone experience resulted in a difficult recruitment process, ultimately yielding only 23 participants.

This is not a limitation to acknowledge in a methods section. It is a structural confound that changes how the field should interpret its own results.

This paper argues four things:

1. The noisy and attenuated effect sizes reported in the current literature are conservative lower bounds on the technique's actual diagnostic power, artifacts of a generational confound rather than evidence of a weak method.
2. This confound is self-resolving on a known timeline. By 2035 to 2055, the 60-to-80 age demographic will consist of people who have typed daily for 20 to 40 or more years, and the motor noise floor will drop dramatically.
3. The resolution of this confound does not merely improve existing methods. It enables a fundamentally new research paradigm: intra-individual longitudinal baselines that require dense, daily, fluent data from the same person over years.
4. Any cognitive assessment modality tied to a specific input technology has a finite validity window, a claim already demonstrated by the ongoing obsolescence of the clock-drawing test as analog clock literacy declines. Only modality-aware approaches to cognitive assessment will survive successive generational technology shifts.

---

## 2. The Automaticity Threshold

Keystroke dynamics can only serve as cognitive biomarkers when typing is automatic. This is not an arbitrary methodological preference. It is a consequence of how motor skill acquisition works.

Pinet et al. (2022) characterized typing expertise in a large student population and documented two distinct processing architectures. In novice typists, the pathway from intention to keystroke is serial: the typist recognizes the target word, retrieves its spelling, locates each key on the keyboard, selects the correct finger, and executes the movement. Each step depends on the previous one. Keystroke timing in this architecture reflects the entire chain, which is dominated by visual search for keys and motor planning.

In expert typists, the lower-level operations (key location, finger selection, movement execution) are chunked into an automated inner loop that runs without conscious attention. The outer loop, where spelling retrieval, word selection, and sentence planning occur, is where cognitive work happens. The inner loop simply executes. Keystroke timing in this architecture is transparent to the motor layer. Variation in flight time and hold time reflects word retrieval difficulty, syntactic planning, and coherence monitoring rather than finger coordination.

Yamaguchi and Logan (2014) demonstrated this experimentally by disrupting the chunked representations of skilled typists, effectively pushing them back onto the learning curve. When the inner loop is disrupted, skilled typists revert to serial processing and their keystroke patterns become indistinguishable from novices. This confirms that the expert architecture is not just faster execution of the same process. It is a qualitatively different processing mode.

The practical implication is that there exists a threshold of typing fluency below which keystroke dynamics measure motor skill, not cognition. The exact threshold is difficult to specify as a single number because Pinet et al. (2022) explicitly argue against a sharp novice/expert boundary, demonstrating instead a continuous distribution. However, the evidence converges on a range: typists below roughly 40 words per minute are unlikely to have achieved the degree of automaticity required for cognitive processes to dominate keystroke timing. Above 50 words per minute, the motor layer is largely transparent.

This distinction is the foundation of the demographic confound. If a participant types at 25 words per minute, variation in their flight time tells you about their hunt-and-peck strategy, not about their cognitive state. Any study using that participant's keystroke data as a cognitive biomarker is measuring the wrong thing.

---

## 3. The Demographic Confound

The population currently available for keystroke-cognition studies of neurodegeneration consists almost entirely of people who did not grow up typing. The relevant age demographic for studying age-related cognitive decline is roughly 60 to 80 years old. In 2024, this corresponds to birth years between 1944 and 1964.

| Birth Year | Generation | Age at First Regular Computer Use | Current Age (2025) | Typing Proficiency |
|---|---|---|---|---|
| 1940-1955 | Silent/Early Boomer | 35-55 (1990s) | 70-85 | Mostly hunt-and-peck |
| 1955-1965 | Late Boomer | 25-40 (1990s) | 60-70 | Mixed, many sub-40 WPM |
| 1965-1980 | Gen X | 15-30 (1990s) | 45-60 | Variable, improving |
| 1980-1995 | Millennial | 5-15 (childhood) | 30-45 | Generally fluent |
| 1995-2010 | Gen Z | Birth-10 (native) | 15-30 | Highly fluent on keyboard and touchscreen |

The people currently old enough to be at risk for age-related cognitive decline are precisely the people least likely to type fluently. This is not a coincidence. It is a cohort effect with a known resolution timeline.

This creates three compounding problems in the existing literature.

**Signal validity.** When a participant with low typing fluency shows elevated flight time, it is impossible to determine whether this reflects cognitive slowing or motor inefficiency. The signal and the noise occupy the same channel. Studies that report differences in keystroke dynamics between MCI and healthy control groups are measuring a real effect, but that effect is attenuated by motor noise in both groups. The true cognitive signal is buried under a motor floor that varies by participant.

**Selection bias.** Researchers who require typing proficiency as an inclusion criterion (explicitly or implicitly through task design) end up with unrepresentative samples. The elderly participants who can type fluently enough to generate usable data are, by definition, more technologically engaged and likely more cognitively healthy than the general elderly population. This biases studies toward underestimating the prevalence and severity of impairment in the broader population.

**Confounding.** Typing proficiency itself correlates with cognitive reserve. People who type fluently tend to have higher education, more complex occupational histories, and greater engagement with cognitively demanding activities. In the current elderly population, typing proficiency is a confound masquerading as a control variable. Studies cannot fully separate the effect of cognitive status from the effect of technological literacy.

Despite all three of these problems working against them, the published results are still remarkable. Kim et al. (2024) achieved AUC = 0.997 for flight time alone in discriminating MCI from healthy controls on smartphone keystroke data. Li et al. (2025) reached AUC = 0.918 with writing process biomarkers. These results were obtained on the worst possible population for this technique. The effect sizes are not weak. They are suppressed.

---

## 4. The Self-Resolving Timeline

The demographic confound is not permanent. It is a transitional artifact of the historical moment when computers entered daily life.

By 2035, the youngest Baby Boomers will be 71 and the oldest Millennials will be 55. By 2045, Millennials will be 50 to 65 and Gen X will occupy the 65 to 80 range. By 2055, the 60 to 80 age demographic will consist almost entirely of people who have typed daily since childhood or adolescence.

| Year | Ages 60-80 Birth Cohort | Typing History | Expected Motor Noise |
|---|---|---|---|
| 2025 | 1945-1965 | Late adopters, 10-30 years | High |
| 2035 | 1955-1975 | Mixed, 20-35 years | Moderate |
| 2045 | 1965-1985 | Early adopters to natives, 25-40+ years | Low |
| 2055 | 1975-1995 | Digital natives, 30-45+ years | Minimal |

The motor noise floor drops with each decade. By 2045, researchers studying cognitive decline through keystroke dynamics will be working with participants who have typed for longer than the entire history of personal computing that preceded them. The automaticity threshold will be met by default rather than by exclusion criterion.

This means every keystroke-cognition study conducted today is a lower bound. The technique is being evaluated in its worst-case scenario. As the population turns over, the same methods applied to the same clinical questions will produce larger effect sizes, higher AUCs, and cleaner separation between diagnostic groups, without any methodological improvement at all.

---

## 5. The Clock-Drawing Test Precedent

The claim that a cognitive assessment modality can be invalidated by a cultural technology shift is not hypothetical. It has already happened.

The clock-drawing test (CDT) has been a standard neuropsychological screening tool for decades. The task is simple: draw a clock face showing a specified time. It assesses visuospatial ability, executive function, and semantic memory in a single brief task. It is embedded in the MoCA and used independently in clinical practice worldwide.

Vishnevsky, Fisher, and Specktor (2024) demonstrated that Generation Z adults, who grew up reading digital rather than analog clocks, underperform on the CDT compared to older adults, not because of cognitive impairment but because of reduced familiarity with analog clock faces. The assessment instrument assumed a cultural competency that is no longer universal.

The parallel to keystroke dynamics runs in both directions. The CDT was developed when analog clock literacy was universal and is now losing validity as that literacy declines. Keystroke-based cognitive assessment is being developed when keyboard literacy is not yet universal in the target population and will gain validity as that literacy saturates.

But the deeper lesson is that any cognitive assessment tied to a specific artifact or input modality has a finite validity window. Keyboards will eventually be displaced by voice interfaces, neural input, or technologies that do not yet exist. A longitudinal cognitive monitoring system that depends on keyboard input will eventually face the same obsolescence the CDT faces now.

This does not argue against building keyboard-based instruments. It argues for building them with modality awareness: designing the underlying measurement framework so that the cognitive constructs being assessed (processing speed, retrieval fluency, planning complexity, revision behavior) can be mapped to new input modalities as they emerge, rather than being permanently coupled to keystroke timing.

---

## 6. From Population Norms to Personal Baselines

The demographic shift described in this paper does more than improve existing studies. It enables a fundamentally different kind of study, one that the current research paradigm cannot conduct.

Every published keystroke-cognition study asks the same question: does this person look impaired compared to healthy people? This is the only question you can answer with a one-time lab visit, a controlled elicitation task, and a population norm. The entire methodology of the field (cross-sectional design, population-normed metrics, task-constrained assessment) is shaped by a practical constraint: researchers get one session with each participant, maybe two.

Once you have someone typing fluently every day for years in a natural environment, you can ask a different question: does this person look different from themselves?

That question does not require Honore's Statistic, Mean Dependency Distance, or population norms. It requires a dense personal baseline and enough time to detect drift. The unit of analysis shifts from population comparison to intra-individual trajectory. The relevant metrics shift from "is this score below the clinical cutoff" to "is this person's behavioral signature deviating from their own rolling baseline in a direction consistent with known decline patterns."

This represents a paradigm change across multiple dimensions:

**From cross-sectional to longitudinal.** Instead of a single cognitive snapshot, the instrument captures thousands of data points per person over years. Statistical power is derived from temporal density within a single individual rather than sample size across individuals.

**From population-normed to self-referential.** The comparison standard is not a healthy average but the person's own history. This eliminates the need for demographically matched control groups and sidesteps the confounds of education, occupation, and baseline cognitive ability that plague cross-sectional studies.

**From task-constrained to ecologically valid.** Instead of a controlled elicitation task (describe the Cookie Theft picture, draw a clock showing ten past eleven), the data comes from naturalistic daily writing. The cognitive demands are real, varied, and self-generated rather than artificial and standardized.

**From clinic-dependent to passive.** No clinician visit is required. No appointment, no travel, no white-coat anxiety. Data is captured during normal computer use, continuously, at no marginal cost per observation.

**From diagnosis to early detection.** Cross-sectional screening answers "do you have MCI right now." Longitudinal self-referential tracking can potentially answer "your behavioral trajectory started shifting six months ago in a pattern that, in other cases, preceded clinical MCI by two years." The difference between these two answers is the difference between intervention and damage control.

The metrics for this paradigm do not yet exist. This is not a gap in the literature. It is a consequence of the data never having been available. You cannot develop intra-individual longitudinal baselines from a 45-minute lab session with 23 participants who hunt and peck on a touchscreen. You need dense, daily, fluent data from the same person over years. The population that can produce that data at the age where cognitive decline becomes clinically relevant does not yet exist.

But it will, on the timeline this paper identifies.

---

## 7. Signal Design: What to Measure and What Not To

The shift from population-normed cross-sectional assessment to self-referential longitudinal tracking has implications for which signals are worth capturing and which are not.

Several NLP-derived features appear frequently in the dementia-language literature and were evaluated for this framework. Each was rejected on evidence grounds.

**Honore's Statistic** measures vocabulary productivity by counting words used only once in a text (hapax legomena). It appears in nearly every large-feature-set NLP-dementia paper, including the landmark 370-feature model of Fraser, Meltzer, and Rudzicz (2016) at the University of Toronto. However, its standalone discriminant power is negligible (AUC approximately 0.55 to 0.65 for AD versus healthy controls when isolated). Its theoretical advantage over type-token ratio, length independence, is achieved more reliably by the Moving-Average Type-Token Ratio (MATTR, Covington and McFall 2010). No study has demonstrated statistically significant incremental discriminant power of Honore's H beyond MATTR. Furthermore, the formula is mathematically unstable on short texts: when most words are hapax, as is common in journal entries under 300 tokens, the denominator approaches zero and the statistic becomes unreliable (Tweedie and Baayen 1998). Honore's Statistic persists in the literature because it has a 1979 citation pedigree and is trivial to compute, not because it independently discriminates anything.

**Mean Dependency Distance (MDD)** measures syntactic complexity by computing the average distance between grammatically related words in a dependency parse tree. The theoretical chain is individually well-established: cognitive decline reduces working memory capacity (well-documented), reduced working memory limits syntactic complexity (well-documented), and MDD measures syntactic complexity (established in quantitative linguistics by Liu 2008, Futrell, Mahowald, and Gibson 2015). However, no published study reports effect sizes or AUCs for MDD in isolation as a cognitive decline predictor. Simpler syntactic measures such as mean sentence length and clausal density consistently outperform dependency-based complexity metrics in the dementia-NLP literature. MDD also requires dependency parsing infrastructure whose accuracy degrades on informal text and cognitively impaired language, creating a risk of measuring parsing errors rather than cognition (Roark et al. 2011). MDD is theoretically motivated but empirically unvalidated.

**Noun/verb ratio** is sometimes cited as a marker for cognitive decline on the assumption that decline shifts language toward more nouns and fewer verbs. The Alzheimer's literature does not support this. In typical AD, noun retrieval is impaired first because nouns depend more heavily on semantic memory in the temporal lobe, where AD pathology typically begins (Goodglass, Boston University; Lambon Ralph and Patterson, Cambridge; Mesulam, Northwestern). The robust verb-specific deficit is real but specific to nonfluent/agrammatic primary progressive aphasia, a rare syndrome affecting roughly 3 to 4 per 100,000 people. In freeform text without controlled elicitation, the noun/verb ratio reflects topic and communicative intent rather than cognitive capacity. It does not survive feature selection when combined with lexical diversity and syntactic complexity measures.

The signals that do hold up under scrutiny for longitudinal self-referential tracking share a common property: they measure process rather than product, and they generate stable within-person baselines against which deviation can be detected.

**Keystroke dynamics** (hold time, flight time, inter-key interval, keystroke entropy) capture the temporal microstructure of typing. Kim et al. (2024) demonstrated that flight time alone achieves AUC = 0.997 for MCI discrimination. Critically, these metrics are captured during the act of writing, not derived from the finished text. They reflect real-time processing demands.

**Production fluency** (P-burst length and count, characters per minute) captures the rhythm of text generation. P-bursts, sustained runs of typing bounded by pauses exceeding two seconds, were introduced by Chenoweth and Hayes (2001) as a window into the translation process in writing. Burst length reflects how much language a person can produce in a single cognitive planning cycle.

**Revision behavior** (deletion patterns, revision timing, commitment ratio) captures how a person rethinks and restructures their writing. The Faigley and Witte (1981) taxonomy of revision distinguishes surface changes (typo correction) from meaning changes (substantive rethinking). The temporal distribution of revisions within a session, whether a person revises early or late, and the proportion of typed text that survives to submission all provide distinct signals about cognitive process.

**Lexical diversity** (MATTR) captures vocabulary range in a length-independent manner (Covington and McFall 2010). Unlike Honore's Statistic, MATTR is mathematically stable on short texts and has well-documented sensitivity to lexical retrieval difficulty.

**Calibration deltas** provide a within-session control. When a person completes both a neutral calibration prompt and a substantive journal entry on the same day, the difference between their behavioral signals on the two tasks isolates cognitive effort from baseline motor performance. This is analogous to the Pennebaker expressive writing paradigm (Pennebaker 1997), where the comparison condition controls for writing mechanics.

One additional metric emerged from this review as a candidate for future investigation. Propositional density (idea density) was identified by the Nun Study (Snowdon et al. 1996, University of Kentucky) as a predictor of Alzheimer's disease onset 60 years in advance, with 80% sensitivity and 86% specificity in an autopsy-confirmed subsample. This is the strongest longitudinal linguistic biomarker in the literature. It requires dependency parsing to automate (Sirts et al. 2017, Macquarie University), so it shares the infrastructure cost of MDD but carries substantially stronger clinical validation. It is flagged for future pipeline expansion.

---

## 8. The Instrument Gap

No existing tool combines keystroke dynamics, linguistic content analysis, and longitudinal self-referential tracking in a single instrument.

The current landscape is fragmented into two silos that do not communicate. On one side, keystroke dynamics researchers capture timing data (hold time, flight time, inter-key intervals) but ignore the content of what is typed. On the other, computational linguistics researchers analyze transcribed text for lexical, syntactic, and semantic features but have no access to the temporal process that produced it. Studies in the first silo can tell you that a person's flight time is elevated but not whether they were struggling to retrieve a specific word or planning a complex sentence. Studies in the second silo can tell you that a person's vocabulary diversity is declining but not whether the decline reflects retrieval difficulty (long pauses before low-frequency words) or avoidance (choosing simpler words without hesitation).

The combination of process and content in the same instrument is not additive. It is multiplicative. A decline in MATTR concurrent with a decline in P-burst length means something different from a decline in MATTR with stable P-burst length. The first suggests retrieval difficulty under cognitive load. The second suggests vocabulary contraction independent of production fluency, a different clinical picture. Neither signal alone captures this distinction.

Adding longitudinal self-referential tracking creates a third dimension that neither silo has explored. When you have a person's behavioral baseline over months or years, you can detect deviations that would be invisible in a cross-sectional study. A flight time of 250 milliseconds is unremarkable compared to a population norm. A flight time of 250 milliseconds in a person whose rolling 90-day average is 180 milliseconds is a signal. The deviation, not the absolute value, is what matters.

The instrument needed for this paradigm must satisfy several design constraints:

**Ecological validity.** The task must be something people actually do, not a laboratory exercise. If the instrument requires a controlled elicitation task, it cannot scale to daily use over years without participant fatigue and dropout. Journaling, daily open-ended writing in response to a prompt, is one of the few tasks that combines sufficient cognitive demand with sustainable engagement.

**Process capture.** Every keystroke event (press, release, deletion, pause, tab-away, scroll-back) must be timestamped and recorded. The raw event stream is the foundation for all derived metrics. Post-hoc text analysis without process data is half the picture.

**Content analysis.** The submitted text must be analyzed for linguistic features (lexical diversity, emotional valence, cognitive mechanism language, sentence structure) that provide a second independent signal channel alongside keystroke dynamics.

**Longitudinal architecture.** The system must be designed for accumulation, not snapshots. Personal baselines, rolling statistics, deviation detection, and trajectory modeling all require data that spans months to years.

**Modality awareness.** Given the CDT precedent, the instrument should be designed so that the cognitive constructs being measured are not permanently coupled to a specific input modality. The underlying framework (production fluency, revision behavior, lexical diversity, calibration deltas) should be expressible in terms that can migrate to new input technologies as they emerge.

**Calibration.** Neutral writing prompts, administered alongside substantive prompts, provide a within-person baseline that controls for day-to-day variation in motor performance, fatigue, and environmental factors. The delta between calibration and substantive sessions isolates cognitive engagement from mechanical performance.

No commercial or academic tool currently satisfies all of these constraints. Winterlight Labs (now Cambridge Cognition) captures spoken language for cognitive assessment but does not combine process and content in written modalities. The Pitt DementiaBank provides transcribed speech samples but no keystroke data. Neurokeys (used by Kim et al. 2024) captures smartphone keystroke dynamics but does not analyze linguistic content. Research prototypes built on the DementiaBank corpus analyze text features but have no longitudinal component.

The instrument gap is not a software engineering problem. It is a design philosophy problem. The tool must be built for depth rather than throughput, for sustained daily use rather than clinical efficiency, and for individual trajectories rather than population screening. It must be built now, while the first cohort of lifelong fluent typists is still a decade away from the age of peak cognitive decline risk, so that longitudinal baselines are already established when those baselines become clinically relevant.

---

## 9. Discussion

The argument presented here has implications beyond keystroke dynamics.

**For the cognitive biomarker field broadly:** The demographic confound described in this paper is not unique to keystroke dynamics. Any digital biomarker that depends on a specific technology skill (touchscreen fluency, voice interface competency, wearable device compliance) faces the same generational adoption curve. Researchers should routinely evaluate whether their target population has achieved the skill automaticity required for their instrument to measure what they intend to measure, and should report this evaluation explicitly rather than treating technology literacy as an assumed baseline.

**For clinical trial design:** If longitudinal behavioral monitoring can detect cognitive trajectory shifts months or years before clinical diagnosis, it becomes possible to validate pharmaceutical interventions through behavioral endpoints rather than or in addition to traditional cognitive assessments. A drug that slows cognitive decline might produce detectable changes in behavioral trajectory (stabilization of P-burst length, maintenance of MATTR, preservation of flight time baselines) before it produces measurable changes on the MoCA or MMSE. Behavioral endpoints captured passively during daily life could supplement or eventually replace periodic clinical assessments that are expensive, effortful, and subject to practice effects.

**For mental health monitoring:** The same framework that detects cognitive decline could detect other forms of psychological change. Depression, anxiety, grief, and recovery all have behavioral signatures in writing process and content. A system designed for cognitive health monitoring inherits the capacity for mental health monitoring without additional instrumentation. The ethics of this dual use require careful consideration, but the technical capability is a natural consequence of the design.

**For the replication crisis in psychology:** Much of the replication difficulty in cognitive and behavioral research stems from small samples, cross-sectional designs, and population-level inference about individual-level processes. A paradigm built on dense longitudinal data from individuals, with each person serving as their own control, sidesteps several of these problems. Effect sizes estimated within-person over time are more stable and more clinically meaningful than effect sizes estimated across persons at a single time point.

**Limitations of this paper.** This is a review and commentary, not an empirical study. The central claim, that current effect sizes are conservative lower bounds, is supported by the logic of the demographic confound but has not been tested directly. A direct test would require either a longitudinal study tracking the same keystroke-cognition relationships across successive birth cohorts, or a cross-sectional study that stratifies participants by typing proficiency and demonstrates that effect sizes increase monotonically with proficiency. Neither study has been conducted. The generational typing proficiency estimates presented here are based on cohort-level characterizations rather than individual-level typing assessments, and the precise automaticity threshold remains an approximation rather than an empirically validated cutoff.

The prediction that the 2035 to 2055 window will produce dramatically cleaner keystroke-cognition data is a forecast, not a finding. It could be complicated by factors this paper does not address: changes in typing behavior driven by AI-assisted writing tools, shifts from keyboards to alternative input modalities occurring faster than anticipated, or the possibility that lifelong typing creates its own form of motor stereotype that obscures rather than reveals cognitive variation.

These limitations do not undermine the central argument. They define the research agenda that follows from it.

---

## 10. Conclusion

The keystroke-cognition literature is stronger than it appears. The effect sizes currently reported are not the ceiling of what the technique can achieve. They are the floor, measured under the worst possible conditions, on the least suitable population, with instruments that capture only half the available signal. That these studies still produce AUCs above 0.9 is not a modest result. It is a remarkable one, achieved despite every structural disadvantage.

The window is opening. Within the next two decades, the population at risk for age-related cognitive decline will, for the first time in human history, consist of people who have typed fluently for their entire adult lives. The motor noise floor that suppresses current results will drop. The recruitment barriers that limit current sample sizes will dissolve. The confound between technological literacy and cognitive reserve will attenuate as typing proficiency becomes universal rather than selective.

But the opportunity is larger than better-powered replications of existing studies. The real prize is a new kind of study entirely: longitudinal, self-referential, ecologically valid, and passive. A paradigm where the question is not "does this person look impaired compared to healthy people" but "does this person look different from themselves." The metrics for that paradigm remain to be invented. The instrument to collect the data remains to be built. The cohort that will generate the data is still a decade away from the age where it matters most.

The time to build is now.

---

## References

Chenoweth, N. A., & Hayes, J. R. (2001). Fluency in writing: Generating text in L1 and L2. *Written Communication*, 18(1), 80-98. https://doi.org/10.1177/0741088301018001004

Covington, M. A., & McFall, J. D. (2010). Cutting the Gordian Knot: The Moving-Average Type-Token Ratio (MATTR). *Journal of Quantitative Linguistics*, 17(2), 94-100. https://doi.org/10.1080/09296171003643098

Faigley, L., & Witte, S. (1981). Analyzing revision. *College Composition and Communication*, 32(4), 400-414.

Fraser, K. C., Meltzer, J. A., & Rudzicz, F. (2016). Linguistic features identify Alzheimer's disease in narrative speech. *Journal of Alzheimer's Disease*, 49(2), 407-422. https://doi.org/10.3233/JAD-150520

Futrell, R., Mahowald, K., & Gibson, E. (2015). Large-scale evidence of dependency length minimization in 37 languages. *Proceedings of the National Academy of Sciences*, 112(33), 10336-10341. https://doi.org/10.1073/pnas.1502134112

Gibson, E. (2000). The dependency locality theory: A distance-based theory of linguistic complexity. In A. Marantz, Y. Miyashita, & W. O'Neil (Eds.), *Image, Language, Brain*. MIT Press.

Kim, et al. (2024). Discriminant power of smartphone-derived keystroke dynamics for mild cognitive impairment. *Journal of Medical Internet Research*. https://doi.org/10.2196/59247

Li, S., Li, K., Liu, J., Huang, S., Wang, C., Tu, Y., Wang, B., Zhang, P., Luo, Y., Zhang, Y., & Chen, T. (2025). A new method for community-based intelligent screening of early Alzheimer's disease populations based on digital biomarkers of the writing process. *Frontiers in Computational Neuroscience*. https://doi.org/10.3389/fncom.2025.1564932

Liu, H. (2008). Dependency distance as a metric of language comprehension difficulty. *Journal of Cognitive Science*, 9(2), 159-191.

Ntracha, A., Iakovakis, D., Hadjidimitriou, S., Charisis, V. S., Tsolaki, M., & Hadjileontiadis, L. J. (2020). Detection of mild cognitive impairment through natural language and touchscreen typing processing. *Frontiers in Digital Health*. https://doi.org/10.3389/fdgth.2020.567158

Pennebaker, J. W. (1997). Writing about emotional experiences as a therapeutic process. *Psychological Science*, 8(3), 162-166.

Pinet, S., Zielinski, C., Alario, F.-X., & Longcamp, M. (2022). Typing expertise in a large student population. *Cognitive Research: Principles and Implications*, 7, 77. https://doi.org/10.1186/s41235-022-00424-3

Roark, B., Mitchell, M., Hosom, J. P., Hollingshead, K., & Kaye, J. (2011). Spoken language derived measures for detecting mild cognitive impairment. *IEEE Transactions on Audio, Speech, and Language Processing*, 19(7), 2081-2090. https://doi.org/10.1109/TASL.2011.2112351

Sirts, K., Piguet, O., & Johnson, M. (2017). Idea density for predicting Alzheimer's disease from transcribed speech. *Proceedings of CoNLL*.

Snowdon, D. A., Kemper, S. J., Mortimer, J. A., Greiner, L. H., Wekstein, D. R., & Markesbery, W. R. (1996). Linguistic ability in early life and cognitive function and Alzheimer's disease in late life: Findings from the Nun Study. *JAMA*, 275(7), 528-532. https://doi.org/10.1001/jama.1996.03530310034029

Tweedie, F. J., & Baayen, R. H. (1998). How variable may a constant be? Measures of lexical richness in perspective. *Computers and the Humanities*, 32(5), 323-352.

Vishnevsky, G., Fisher, T., & Specktor, P. (2024). The clock drawing test (CDT) in the digital era: Underperformance of Generation Z adults. *Journal of the Neurological Sciences*, 467, 123289. https://doi.org/10.1016/j.jns.2024.123289

Yamaguchi, M., & Logan, G. D. (2014). Pushing typists back on the learning curve: Revealing chunking in skilled typewriting. *Journal of Experimental Psychology: Human Perception and Performance*, 40(2), 592-612. https://doi.org/10.1037/a0033809
