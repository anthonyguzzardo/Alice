
# A Demographic Confound in Keystroke-Based Cognitive Biomarkers: Implications for Interpreting Current Effect Sizes

**Anthony Guzzardo**
April 15, 2026

## Abstract

Keystroke dynamics have emerged as a promising modality for passive cognitive assessment, yet the keystroke-cognition studies targeting neurodegeneration identified in this review have drawn their participants from a population that largely did not achieve the typing automaticity required for keystroke timing to reflect cognitive processes rather than motor execution. This paper identifies a generational confound that plausibly distorts reported effect sizes in ways that are difficult to characterize without proficiency-stratified data. The confound is self-resolving: by 2035 to 2055, the population at risk for age-related cognitive decline will consist of lifelong fluent typists. More importantly, this demographic shift enables an entirely new research paradigm: intra-individual longitudinal baselines where deviation from oneself, not deviation from a population norm, becomes the unit of analysis. This paradigm sidesteps several persistent problems in cross-sectional cognitive assessment, including demographic matching, cognitive reserve confounds, and the insensitivity of one-time screening to early trajectory shifts. The metrics and instruments for this paradigm do not yet exist. This paper identifies the timeline, the opportunity, the statistical challenges, and the instrument gap that must be addressed before the first eligible cohort arrives.

---

## 1. Introduction

Keystroke dynamics have emerged as one of the most promising modalities for digital cognitive biomarkers. Recent studies report encouraging results: writing process biomarkers reach AUC = 0.918 for community-based Alzheimer's screening, outperforming both the Montreal Cognitive Assessment (MoCA) and the Mini-Mental State Examination (MMSE) (Li et al. 2025), and smartphone keystroke timing shows discriminative power for mild cognitive impairment (Kim et al. 2024), though with methodological limitations that warrant cautious interpretation. The appeal is clear: a passive, repeatable, low-cost measure of cognitive function captured during natural computer use, with no clinician required.

But there is a problem that no published study has named directly. The keystroke-cognition studies targeting neurodegeneration identified in this review have drawn their participants predominantly from a population born between roughly 1939 and 1966, people who encountered computers between the ages of 30 and 55, many of whom never achieved the typing automaticity required for keystroke timing to reflect cognitive processes rather than motor execution. The total number of participants across the studies identified in this review is fewer than 500, a figure derived from aggregating sample sizes across the studies cited in this paper and adjacent literature (Kim et al. 2024, n = 99; Li et al. 2025, n = 135; Ntracha et al. 2020, n = 23; and comparable studies with samples ranging from 20 to 80 participants). The sample sizes are small in part because researchers cannot recruit enough elderly participants who type fluently enough to generate interpretable keystroke timing data. Ntracha et al. (2020) reported that requiring 12 months of smartphone experience resulted in a difficult recruitment process, ultimately yielding only 23 participants.

This is not a limitation to acknowledge in a methods section. It is a structural confound that changes how the field should interpret its own results.

This is a conceptual position paper, not a systematic review or empirical study. The studies cited were identified through targeted searches of PubMed, Google Scholar, and ACM Digital Library using terms including "keystroke dynamics," "cognitive decline," "dementia," "mild cognitive impairment," "typing," and "digital biomarker," with no formal date restriction. The search strategy is non-systematic and appropriate to the conceptual scope of this paper; a full systematic review is a distinct contribution that the field would benefit from but that is not attempted here. The available evidence base remains small—fewer than a dozen studies with a combined participant count under 500—which is itself part of the argument: a field drawing field-level conclusions from a sample this size should treat those conclusions as preliminary regardless of methodology.

This paper argues four things:

1. The effect sizes reported in the current literature are plausibly distorted by a generational confound in ways that may include attenuation, inflation through selection bias, or both—making them difficult to interpret as stable estimates of the technique's diagnostic power.
2. This confound is self-resolving on a known timeline. By 2035 to 2055, the 60-to-80 age demographic will consist of people who have typed daily for 20 to 40 or more years, and the motor noise floor will drop substantially.
3. The resolution of this confound enables a fundamentally new research paradigm: intra-individual longitudinal baselines where deviation from oneself replaces deviation from a population norm as the unit of analysis. This paradigm shift, rather than the confound itself, is the paper's central contribution.
4. Any cognitive assessment modality tied to a specific input technology has a finite validity window, a claim illustrated by the ongoing obsolescence of the clock-drawing test as analog clock literacy declines. Only modality-aware approaches to cognitive assessment will survive successive generational technology shifts.

*Disclosure: The author is developing a journaling system (Alice) that implements several of the design constraints discussed in Sections 7 and 8. Readers should apply additional scrutiny to those two sections in particular, where the instrument gap analysis and signal design choices overlap with design decisions already being made in that system. The arguments in Sections 2 through 6—the automaticity threshold, the demographic confound, the self-resolving timeline, the clock-drawing precedent, and the paradigm shift to self-referential baselines—do not depend on any specific implementation and should be evaluated on their own terms.*

---

## 2. The Automaticity Threshold

Keystroke dynamics can only serve as cognitive biomarkers when typing is automatic. This is not an arbitrary methodological preference. It is a consequence of how motor skill acquisition works.

Pinet et al. (2022) characterized typing expertise in a large student population and documented two distinct processing architectures. In novice typists, the pathway from intention to keystroke is serial: the typist recognizes the target word, retrieves its spelling, locates each key on the keyboard, selects the correct finger, and executes the movement. Each step depends on the previous one. Keystroke timing in this architecture reflects the entire chain, which is dominated by visual search for keys and motor planning.

In expert typists, the lower-level operations (key location, finger selection, movement execution) are chunked into an automated inner loop that runs without conscious attention. The outer loop, where spelling retrieval, word selection, and sentence planning occur, is where cognitive work happens. The inner loop simply executes. Keystroke timing in this architecture is transparent to the motor layer. Variation in flight time and hold time reflects word retrieval difficulty, syntactic planning, and coherence monitoring rather than finger coordination.

Yamaguchi and Logan (2014) demonstrated this experimentally by disrupting the chunked representations of skilled typists, effectively pushing them back onto the learning curve. When the inner loop is disrupted, skilled typists revert to serial processing and their keystroke patterns become indistinguishable from novices. This confirms that the expert architecture is not just faster execution of the same process. It is a qualitatively different processing mode.

The practical implication is that there exists a threshold of typing fluency below which keystroke dynamics measure motor skill, not cognition. The exact threshold is difficult to specify as a single number because Pinet et al. (2022) explicitly argue against a sharp novice/expert boundary, demonstrating instead a continuous distribution. The estimate offered here—that typists below roughly 40 words per minute are unlikely to have achieved full automaticity, while those above 50 words per minute have a largely transparent motor layer—is an inference drawn from the Pinet et al. proficiency distribution and the Yamaguchi and Logan disruption data, not a validated clinical cutoff. Large-scale typing data (Dhakal et al. 2018, with 168,000 participants) confirms that the bottom decile types below 26 WPM and the top decile above 78 WPM, but no study has directly mapped typing speed to the automaticity threshold required for cognitive transparency in a clinical population. The 40-to-50 WPM range should be treated as an approximate boundary pending empirical validation. Establishing this threshold directly—through a study that stratifies clinical participants by typing proficiency and measures whether keystroke-cognition effect sizes increase monotonically above a proficiency cutoff—is arguably the single most important empirical gap the field needs to close.

This distinction is the foundation of the demographic confound. If a participant types at 25 words per minute, variation in their flight time is dominated by motor search and planning rather than cognitive state. The cognitive signal is not absent, but it is substantially less identifiable—buried under motor variance that has nothing to do with neurodegeneration.

---

## 3. The Demographic Confound

The population currently available for keystroke-cognition studies of neurodegeneration consists almost entirely of people who did not grow up typing. The relevant age demographic for studying age-related cognitive decline is roughly 60 to 80 years old. In 2024, this corresponds to birth years between 1944 and 1964.

*Table 1: Schematic model of generational typing proficiency. The categorical labels in this table are conceptual rather than empirical and are intended to illustrate the cohort structure of the confound, not to quantify it. See note below for sourcing and limitations.*

| Birth Year | Generation | Age at First Regular Computer Use | Current Age (2025) | Typing Proficiency (estimated) |
|---|---|---|---|---|
| 1940-1955 | Silent/Early Boomer | 35-55 (1990s) | 70-85 | Lower average automaticity expected |
| 1955-1965 | Late Boomer | 25-40 (1990s) | 60-70 | Mixed automaticity expected |
| 1965-1980 | Gen X | 15-30 (1990s) | 45-60 | Variable, trending toward higher automaticity |
| 1980-1995 | Millennial | 5-15 (childhood) | 30-45 | Higher average automaticity expected |
| 1995-2010 | Gen Z | Birth-10 (native) | 15-30 | High average automaticity on keyboard and touchscreen |

*Note: The proficiency characterizations in this table are editorial estimates informed by cohort-level data rather than individually validated assessments. Cramer-Petersen et al. (2022) found significant generational differences in typing speed among 2,690 hospital employees, and Dhakal et al. (2018) documented wide speed variation in a 168,000-person sample, but neither study maps directly onto the clinical population categories used here. Pew Research Center (2019) provides technology adoption timelines by age group that support the estimated ages of first regular computer use.*

The people currently old enough to be at risk for age-related cognitive decline are disproportionately likely to fall in the lower ranges of typing automaticity. This is not a coincidence. It is a cohort effect with a known resolution timeline.

This creates three compounding problems in the existing literature.

**Signal validity.** When a participant with low typing fluency shows elevated flight time, it is difficult to determine how much reflects cognitive slowing versus motor inefficiency. Motor inexperience and cognitive difficulty both manifest as slower, more variable keystroke timing, making them hard to disentangle in the same data stream. Studies that report differences in keystroke dynamics between MCI and healthy control groups are measuring a real effect, but that effect is likely distorted by motor variance in both groups. The cognitive signal is harder to isolate under a motor floor that varies by participant.

**Selection bias.** Researchers who require typing proficiency as an inclusion criterion (explicitly or implicitly through task design) end up with unrepresentative samples. The elderly participants who can type fluently enough to generate usable data are, by definition, more technologically engaged and likely more cognitively healthy than the general elderly population. The direction of this bias is not straightforwardly toward underestimation. A healthier, more cognitively reserved sample could produce either larger or smaller case-control effect sizes depending on how proficiency, education, cognitive reserve, and disease severity interact in a given study. The net effect is that current results are difficult to generalize, not that they are uniformly suppressed.

**Confounding.** Typing proficiency itself correlates with cognitive reserve. People who type fluently tend to have higher education, more complex occupational histories, and greater engagement with cognitively demanding activities. In the current elderly population, typing proficiency is a confound masquerading as a control variable. Studies cannot fully separate the effect of cognitive status from the effect of technological literacy.

Despite these compounding problems, the published results are noteworthy. Li et al. (2025) reached AUC = 0.918 with writing process biomarkers for community-based Alzheimer's screening, outperforming both the MoCA and MMSE. Kim et al. (2024) reported AUC = 0.997 for flight time alone in discriminating MCI from healthy controls on smartphone keystroke data, though this result warrants caution: the study used only 99 participants (35 MCI after exclusions), computed the ROC on the full dataset without a held-out test set or cross-validation, and a subsequent correction notice was published. The Li et al. result, achieved with a larger sample and more robust methodology, is the stronger anchor for what the technique can accomplish on a population that largely lacks typing automaticity.

A further complication: the clean separation between "motor noise" and "cognitive signal" implied throughout this section is itself an oversimplification. Motor slowing in neurodegeneration is not purely peripheral. Buchman and Bennett (2011) demonstrated that motor function decline in aging shares neural substrates with cognitive decline, particularly in prefrontal and basal ganglia circuits. Holtzer et al. (2006) showed that motor planning and cognitive sequencing draw on shared prefrontal resources. What this means for keystroke dynamics is that some portion of the "motor noise" in current studies may itself carry cognitive information—the motor slowing *is* partly the disease. Removing motor inexperience from the population does not remove this fused motor-cognitive signal; it removes the additional variance introduced by participants who never learned to type fluently, which is a different and separable source of noise.

---

## 4. The Self-Resolving Timeline

The demographic confound is not permanent. It is a transitional artifact of the historical moment when computers entered daily life.

By 2035, the youngest Baby Boomers will be 71 and the oldest Millennials will be 55. By 2045, Millennials will be 50 to 65 and Gen X will occupy the 65 to 80 range. By 2055, the 60 to 80 age demographic will consist almost entirely of people who have typed daily since childhood or adolescence.

*Table 2: Schematic projection of expected motor noise reduction under a continued-keyboard assumption. The "Expected Motor Noise" labels are conceptual rather than quantitative, and the projection is contingent on the modality-shift and AI-assistance caveats discussed in Section 9.*

| Year | Ages 60-80 Birth Cohort | Typing History | Expected Motor Noise |
|---|---|---|---|
| 2025 | 1945-1965 | Late adopters, 10-30 years | High |
| 2035 | 1955-1975 | Mixed, 20-35 years | Moderate |
| 2045 | 1965-1985 | Early adopters to natives, 25-40+ years | Low |
| 2055 | 1975-1995 | Digital natives, 30-45+ years | Minimal |

Under this model, the motor noise floor drops with each decade. By 2045, researchers studying cognitive decline through keystroke dynamics will be working with participants who have typed for longer than the entire history of personal computing that preceded them. The automaticity threshold will be met by default rather than by exclusion criterion.

If the demographic confound distorts current results as argued here, then the technique is being evaluated under conditions that are poorly suited to its strengths. As the population turns over, the same methods applied to the same clinical questions should—under continued unassisted keyboard-based text production—produce cleaner separation between diagnostic groups without any methodological improvement. That conditional is load-bearing: the projected signal improvement depends on the 2035-to-2055 cohort still typing unassisted text character-by-character at volume, a condition that AI-assisted writing and modality shifts may erode before the window fully opens (see Section 9).

---

## 5. The Clock-Drawing Test Precedent

The claim that a cognitive assessment modality can be invalidated by a cultural technology shift is not hypothetical. It has already happened.

The clock-drawing test (CDT) has been a standard neuropsychological screening tool for decades. The task is simple: draw a clock face showing a specified time. It assesses visuospatial ability, executive function, and semantic memory in a single brief task. It is embedded in the MoCA and used independently in clinical practice worldwide.

Vishnevsky, Fisher, and Specktor (2024) demonstrated that Generation Z adults, who grew up reading digital rather than analog clocks, underperform on the CDT compared to older adults, not because of cognitive impairment but because of reduced familiarity with analog clock faces. The assessment instrument assumed a cultural competency that is no longer universal.

The CDT precedent illustrates a general principle: cognitive assessments can embed hidden cultural competencies that make their validity contingent on population-level familiarity with a specific artifact. The parallel to keystroke dynamics is suggestive but imperfect. The CDT is losing validity because a prerequisite skill is declining; keystroke-based assessment is hypothesized to gain validity as a prerequisite skill saturates. The directionality is opposite, and the analogy should be treated as an illustrative precedent rather than a symmetric demonstration.

But the deeper lesson is that any cognitive assessment tied to a specific artifact or input modality has a finite validity window. Keyboards will eventually be displaced by voice interfaces, neural input, or technologies that do not yet exist. A longitudinal cognitive monitoring system that depends on keyboard input will eventually face the same obsolescence the CDT faces now.

This does not argue against building keyboard-based instruments. It argues for building them with modality awareness: designing the underlying measurement framework so that the cognitive constructs being assessed (processing speed, retrieval fluency, planning complexity, revision behavior) can be mapped to new input modalities as they emerge, rather than being permanently coupled to keystroke timing.

---

## 6. From Population Norms to Personal Baselines

The demographic shift described in this paper does more than improve existing studies. It enables a fundamentally different kind of study, one that the current research paradigm cannot conduct.

Every published keystroke-cognition study asks the same question: does this person look impaired compared to healthy people? This is the only question you can answer with a one-time lab visit, a controlled elicitation task, and a population norm. The entire methodology of the field (cross-sectional design, population-normed metrics, task-constrained assessment) is shaped by a practical constraint: researchers get one session with each participant, maybe two.

Once you have someone typing fluently every day for years in a natural environment, you can ask a different question: does this person look different from themselves?

That question does not require Honore's Statistic, Mean Dependency Distance, or population norms. It requires a dense personal baseline and enough time to detect drift. The unit of analysis shifts from population comparison to intra-individual trajectory. The relevant metrics shift from "is this score below the clinical cutoff" to "is this person's behavioral signature deviating from their own rolling baseline in a direction consistent with known decline patterns."

Intra-individual longitudinal monitoring is not itself novel to cognitive assessment. Actigraphy research has used within-person sleep and activity trajectories to track cognitive decline for more than a decade. GPS and smartphone mobility data have been used to detect early cognitive change through life-space contraction. Speech-based longitudinal monitoring is the closest precedent, with Winterlight Labs (now Cambridge Cognition) and the DementiaBank consortium building toward within-person speech trajectory tracking. What keystroke dynamics add to this broader digital biomarker landscape is density and ambient capture: actigraphy tracks motor activity, mobility tracks behavior in physical space, and speech analysis depends on either clinical sessions or passive audio capture that raises substantial privacy concerns. Keystroke data is generated continuously during the cognitive act of text production itself, without requiring a clinical encounter or ambient recording. The paradigm shift proposed in this paper is therefore not the invention of within-person longitudinal cognitive monitoring but its extension to a modality that combines high temporal density, low observational burden, and direct coupling to language production.

This represents a paradigm change across multiple dimensions for keystroke-based assessment specifically:

**From cross-sectional to longitudinal.** Instead of a single cognitive snapshot, the instrument captures thousands of data points per person over years. Statistical power is derived from temporal density within a single individual rather than sample size across individuals.

**From population-normed to self-referential.** The comparison standard is not a healthy average but the person's own history. This eliminates the need for demographically matched control groups and sidesteps the confounds of education, occupation, and baseline cognitive ability that plague cross-sectional studies.

**From task-constrained to ecologically valid.** Instead of a controlled elicitation task (describe the Cookie Theft picture, draw a clock showing ten past eleven), the data comes from naturalistic daily writing. The cognitive demands are real, varied, and self-generated rather than artificial and standardized.

**From clinic-dependent to passive.** No clinician visit is required. No appointment, no travel, no white-coat anxiety. Data is captured during normal computer use, continuously, at no marginal cost per observation.

**From diagnosis to early detection.** Cross-sectional screening answers "do you have MCI right now." Longitudinal self-referential tracking can potentially answer "your behavioral trajectory started shifting six months ago in a pattern that, in other cases, preceded clinical MCI by two years." The difference between these two answers is the difference between intervention and damage control.

The metrics for this paradigm do not yet exist. This is not a gap in the literature. It is a consequence of the data never having been available. You cannot develop intra-individual longitudinal baselines from a 45-minute lab session with 23 participants who hunt and peck on a touchscreen. You need dense, daily, fluent data from the same person over years. The population that can produce that data at the age where cognitive decline becomes clinically relevant does not yet exist. But it will, on the timeline this paper identifies.

This paradigm is not without its own statistical challenges, and these should be named rather than deferred. **Regression to the mean** will produce apparent trajectory shifts in any rolling-baseline system, particularly after extreme sessions, and must be distinguished from genuine cognitive change. **Life event confounding**—retirement, bereavement, medication changes, illness, relocation—will produce real behavioral shifts unrelated to neurodegeneration, and the system must either account for or be robust to these. **Seasonal and circadian variation** in writing behavior could mimic or mask slow cognitive trends if not modeled. And **compliance decay** over years of daily journaling is perhaps the most underappreciated threat to the paradigm. Comparable daily-engagement systems offer a sobering reference class: consumer journaling, meditation, and habit-tracking apps are commonly reported to retain only a small fraction of users at one year, and clinical-grade digital intervention studies (diabetes self-monitoring, mood tracking, cognitive training) routinely document substantial dropout over 12-month windows. Specific attrition figures vary widely across contexts and definitions and should be taken from current digital-health engagement reviews rather than from this paper. The minimum data density required for stable personal baselines has not been established; if the instrument requires roughly weekly entries to sustain a meaningful rolling baseline, attrition patterns from the consumer app literature suggest that generating usable multi-year trajectories may prove difficult for a substantial share of enrolled users. No keystroke-cognition study has operated at the timescale where this becomes the binding constraint. Whether sustained voluntary engagement with open-ended daily writing is achievable at clinically useful rates is an open empirical question, and a negative answer would not invalidate the paradigm but would sharply narrow the population it can serve.

The **base rate problem** deserves particular attention because it is the challenge most likely to determine whether the paradigm succeeds or fails in practice. MCI incidence in adults over 65 is roughly 1 to 2 percent per year. In a population of 100,000 healthy users monitored longitudinally, the expected number of true transitions in a given year is on the order of 1,000 to 2,000. Even a deviation-detection system with a seemingly strong specificity of 95 percent would produce 5,000 false positive alerts against that base rate, yielding a positive predictive value well below 30 percent. A system with 99 percent specificity still produces 1,000 false positives against 1,000-2,000 true cases. This is not a minor tuning problem. It is a structural constraint that shapes what a longitudinal behavioral monitoring system can credibly claim, how alerts should be framed (as trajectory observations rather than diagnostic flags), and how clinical follow-up pathways should be designed. A system optimized for sensitivity to catch early transitions will flood clinicians with false positives; a system optimized for specificity will miss the early signals that motivate the paradigm in the first place. Navigating this trade-off is the central design problem of any self-referential cognitive monitoring instrument, and it does not have a known solution.

These challenges do not disqualify the paradigm, but they should temper the claim that its advantages over cross-sectional screening are automatic. The longitudinal paradigm is a research program, not a ready-made solution. Its structural advantages are real, but realizing them requires methodological work that has not yet been done—work that this paper identifies rather than completes.

---

## 7. Signal Design: What to Measure and What Not To

The shift from population-normed cross-sectional assessment to self-referential longitudinal tracking has implications for which signals are worth capturing and which are not.

Several NLP-derived features appear frequently in the dementia-language literature and were evaluated for suitability within a longitudinal, self-referential, short-text framework. Each was set aside for this specific use case. The evaluations that follow are scoped to this application—daily journal-length text, within-person baselines, deviation detection over months to years—and should not be read as field-level verdicts. Several of these features retain genuine value in the large-feature-set cross-sectional classifiers where they were originally developed.

**Honore's Statistic** measures vocabulary productivity by counting words used only once in a text (hapax legomena). It appears in nearly every large-feature-set NLP-dementia paper, including the landmark 370-feature model of Fraser, Meltzer, and Rudzicz (2016) at the University of Toronto. However, its standalone discriminant power is negligible (AUC approximately 0.55 to 0.65 for AD versus healthy controls when isolated). Its theoretical advantage over type-token ratio, length independence, is achieved more reliably by the Moving-Average Type-Token Ratio (MATTR, Covington and McFall 2010). No study has demonstrated statistically significant incremental discriminant power of Honore's H beyond MATTR. Furthermore, the formula is mathematically unstable on short texts: when most words are hapax, as is common in journal entries under 300 tokens, the denominator approaches zero and the statistic becomes unreliable (Tweedie and Baayen 1998). For the longitudinal short-text use case considered here, Honore's Statistic has not demonstrated independent discriminant value beyond what MATTR already provides, and its instability on short journal entries makes it a poor fit for within-person rolling baselines; its continued utility in large cross-sectional feature sets is a separate question.

**Mean Dependency Distance (MDD)** measures syntactic complexity by computing the average distance between grammatically related words in a dependency parse tree. The theoretical chain is individually well-established: cognitive decline reduces working memory capacity (well-documented), reduced working memory limits syntactic complexity (Gibson 2000, dependency locality theory), and MDD measures syntactic complexity (established in quantitative linguistics by Liu 2008, Futrell, Mahowald, and Gibson 2015). However, no published study reports effect sizes or AUCs for MDD in isolation as a cognitive decline predictor. Simpler syntactic measures such as mean sentence length and clausal density consistently outperform dependency-based complexity metrics in the dementia-NLP literature. MDD also requires dependency parsing infrastructure whose accuracy degrades on informal text and cognitively impaired language, creating a risk of measuring parsing errors rather than cognition (Roark et al. 2011). For the longitudinal self-referential use case, MDD is theoretically motivated but empirically unvalidated, and its dependence on parsing quality introduces a noise source that is hard to distinguish from the cognitive signal it is meant to measure; dependency-based measures may still prove useful in cross-sectional designs with cleaner elicitation.

**Noun/verb ratio** is sometimes cited as a marker for cognitive decline on the assumption that decline shifts language toward more nouns and fewer verbs. The Alzheimer's literature does not support this. In typical AD, noun retrieval is impaired first because nouns depend more heavily on semantic memory in the temporal lobe, where AD pathology typically begins (Goodglass, Boston University; Lambon Ralph and Patterson, Cambridge; Mesulam, Northwestern). The robust verb-specific deficit is real but specific to nonfluent/agrammatic primary progressive aphasia, a rare syndrome affecting roughly 3 to 4 per 100,000 people. In freeform journal text without controlled elicitation, the noun/verb ratio reflects topic and communicative intent rather than cognitive capacity, and does not survive feature selection against lexical diversity and syntactic complexity measures. It is set aside for this use case; in controlled-elicitation protocols targeting specific aphasic syndromes, it retains established clinical relevance.

The signals that do hold up under scrutiny for longitudinal self-referential tracking share a common property: they measure process rather than product, and they generate stable within-person baselines against which deviation can be detected.

**Keystroke dynamics** (hold time, flight time, inter-key interval, keystroke entropy) capture the temporal microstructure of typing. Kim et al. (2024) reported strong discriminative power for flight time in MCI detection, though the reported AUC of 0.997 should be interpreted cautiously given the small sample (n = 99) and absence of held-out validation. Critically, these metrics are captured during the act of writing, not derived from the finished text. They reflect real-time processing demands.

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

**Limitations of this paper.** This is a position paper with review elements, not an empirical study. The central claim—that current effect sizes are plausibly distorted by the demographic confound in ways that could include attenuation, inflation through selection bias, or both—is supported by the logic of motor automaticity but has not been tested directly. A direct test would require either a longitudinal study tracking the same keystroke-cognition relationships across successive birth cohorts, or a cross-sectional study that stratifies participants by typing proficiency and demonstrates that effect sizes increase monotonically with proficiency. Neither study has been conducted. The generational typing proficiency estimates presented here are based on cohort-level characterizations rather than individual-level typing assessments, and the precise automaticity threshold remains an approximation rather than an empirically validated cutoff.

The clean separation between "motor noise" and "cognitive signal" used throughout this paper is itself a simplification. Motor slowing in neurodegeneration has cognitive origins (Buchman and Bennett 2011), and motor and cognitive decline share neural substrates. The argument here is not that motor and cognitive signals are fully separable, but that motor *inexperience*—variance introduced by participants who never learned to type fluently—is separable from the fused motor-cognitive signal that keystroke dynamics capture in skilled typists. The former is noise; the latter is signal. But this distinction has not been empirically validated in a clinical keystroke study.

**The AI-assisted writing threat.** The prediction that the 2035 to 2055 window will produce cleaner keystroke-cognition data assumes that the at-risk population will still be generating text character by character on a keyboard. This assumption faces a serious challenge from AI-assisted writing tools. Banovic et al. (2019) demonstrated that autocomplete fundamentally alters keystroke dynamics, shifting users from character-level generation to a scan-decide-accept loop that changes pause distributions from reflecting lexical retrieval to reflecting suggestion evaluation. Quinn and Zhai (2016) found that predictive text on mobile creates bimodal inter-keystroke interval distributions—fast acceptance bursts interleaved with normal typing. Buschek et al. (2021) showed that even phrase-level suggestions alter not just speed but *content*, as writers shift toward suggestion-compatible framings.

If LLM-assisted drafting, autocomplete, and predictive text become the dominant mode of text production by 2035 to 2055, the keystroke signal would be contaminated in a fundamentally different way than it is today—not by motor inexperience but by the human no longer being the sole cognitive source of the text being typed. The temporal microstructure of accepting a suggestion is not the same as the temporal microstructure of retrieving a word from memory. Keystroke cognitive biomarkers calibrated on unassisted writing would be measuring a different cognitive process entirely: visual scanning and decision-making rather than lexical retrieval and sentence planning. This is not merely a noise problem; it is a construct validity threat.

Beyond contamination, there is an availability problem. Voice interfaces, multimodal input, and LLM-mediated composition may reduce the total volume of keyboard typing per person, undermining the "dense daily data" premise of the longitudinal paradigm. The threat is not only that future typing will be AI-contaminated but that there may be substantially less of it.

An instrument designed for this future must either control for AI assistance (by requiring unassisted writing conditions), detect and filter AI-assisted segments from keystroke streams, or develop new signal models that account for hybrid human-AI text production. No published study has addressed this problem. It represents an open research gap that could determine whether keystroke-based cognitive biomarkers remain viable beyond the window this paper identifies.

**Motor stereotypes.** A second complication for the self-resolving timeline is that lifelong typing may create its own form of signal opacity. For a person who has typed for 40 years, the motor patterns for high-frequency sequences ("the," "and," "tion") may become so deeply automated that they resist cognitive slowing even as decline progresses. These over-learned motor sequences could create blind spots where cognitive changes fail to surface in keystroke timing. If the most common words and bigrams are typed with near-mechanical consistency regardless of cognitive state, the signal may concentrate in lower-frequency words and novel constructions—which would require instruments sensitive enough to detect deviation in the sparse tail of the typing distribution rather than in aggregate statistics.

These limitations do not invalidate the central argument, but they constrain it. The demographic confound is real, and its resolution is demographically inevitable. Whether that resolution produces the clean signal improvement this paper predicts depends on whether the population that arrives in the 2035 to 2055 window is still typing unassisted text on keyboards—a condition that is no longer guaranteed.

---

## 10. Conclusion

The demographic shift described in this paper is real in the sense that its underlying fact is demographically inevitable: birth cohorts with high lifelong typing exposure will occupy the at-risk age range for cognitive decline within the next two decades. Whether that shift produces the specific effect-size changes argued for here is an inferential claim that remains to be tested empirically, not a settled fact. The implications of the shift, regardless of how the inferential claim resolves, extend beyond the interpretation of existing results. If the confound distorts current effect sizes as argued, the keystroke-cognition literature is operating under conditions that are difficult to interpret rather than clearly weak or clearly strong—the field's evidence base is preliminary in ways that typing-proficiency stratification would clarify, and the direction in which current results would move under such stratification is not settled.

But the more important conclusion is not about existing studies. It is about what becomes possible when the confound resolves. Within the next two decades, the population at risk for age-related cognitive decline will, for the first time, consist largely of people who have typed fluently for their entire adult lives. This creates the preconditions for a fundamentally different approach to cognitive assessment: longitudinal, self-referential, ecologically valid, and passive. A paradigm where the question is not "does this person look impaired compared to healthy people" but "does this person look different from themselves."

Realizing that paradigm requires solving nontrivial problems: statistical methods for detecting rare transitions in noisy individual time series, strategies for handling life-event confounds, instruments that combine process and content capture, and approaches to the AI-assisted writing threat that could contaminate or reduce the keystroke signal before the window fully opens. New confounds from AI-assisted writing may emerge as the motor noise confound recedes. The metrics remain to be developed. The instruments remain to be built and validated. The cohort is approaching but has not yet arrived. Preparing for that cohort—building the instruments, establishing the baselines, and resolving the methodological questions this paper raises—is the work that must begin now.

---

## References

Banovic, N., Buzali, T., Chevalier, F., Mankoff, J., & Dey, A. K. (2019). Quantifying the effects of autocomplete on text input efficiency and user behavior. *Proceedings of the ACM on Interactive, Mobile, Wearable and Ubiquitous Technologies*, 3(3), 1-28.

Buchman, A. S., & Bennett, D. A. (2011). Loss of motor function in preclinical Alzheimer's disease. *Expert Review of Neurotherapeutics*, 11(5), 665-676. https://doi.org/10.1586/ern.11.57

Buschek, D., Zürn, M., & Eiber, M. (2021). The impact of multiple parallel phrase suggestions on email input and composition behaviour of native and non-native English writers. *Proceedings of the 2021 CHI Conference on Human Factors in Computing Systems*, 1-13.

Chenoweth, N. A., & Hayes, J. R. (2001). Fluency in writing: Generating text in L1 and L2. *Written Communication*, 18(1), 80-98. https://doi.org/10.1177/0741088301018001004

Cramer-Petersen, C. L., et al. (2022). Digital disparities among healthcare workers in typing speed between generations, genders, and medical specialties. *JAMIA Open*, 5(4). https://doi.org/10.1093/jamiaopen/ooac099

Covington, M. A., & McFall, J. D. (2010). Cutting the Gordian Knot: The Moving-Average Type-Token Ratio (MATTR). *Journal of Quantitative Linguistics*, 17(2), 94-100. https://doi.org/10.1080/09296171003643098

Dhakal, V., Feit, A. M., Kristensson, P. O., & Oulasvirta, A. (2018). Observations on typing from 136 million keystrokes. *Proceedings of the 2018 CHI Conference on Human Factors in Computing Systems*, 1-12. https://doi.org/10.1145/3173574.3174220

Faigley, L., & Witte, S. (1981). Analyzing revision. *College Composition and Communication*, 32(4), 400-414.

Fraser, K. C., Meltzer, J. A., & Rudzicz, F. (2016). Linguistic features identify Alzheimer's disease in narrative speech. *Journal of Alzheimer's Disease*, 49(2), 407-422. https://doi.org/10.3233/JAD-150520

Futrell, R., Mahowald, K., & Gibson, E. (2015). Large-scale evidence of dependency length minimization in 37 languages. *Proceedings of the National Academy of Sciences*, 112(33), 10336-10341. https://doi.org/10.1073/pnas.1502134112

Gibson, E. (2000). The dependency locality theory: A distance-based theory of linguistic complexity. In A. Marantz, Y. Miyashita, & W. O'Neil (Eds.), *Image, Language, Brain*. MIT Press.

Holtzer, R., Verghese, J., Xue, X., & Lipton, R. B. (2006). Cognitive processes related to gait velocity: Results from the Einstein Aging Study. *Neuropsychology*, 20(2), 215-223. https://doi.org/10.1037/0894-4105.20.2.215

Kim, et al. (2024). Discriminant power of smartphone-derived keystroke dynamics for mild cognitive impairment. *Journal of Medical Internet Research*. https://doi.org/10.2196/59247

Li, S., Li, K., Liu, J., Huang, S., Wang, C., Tu, Y., Wang, B., Zhang, P., Luo, Y., Zhang, Y., & Chen, T. (2025). A new method for community-based intelligent screening of early Alzheimer's disease populations based on digital biomarkers of the writing process. *Frontiers in Computational Neuroscience*. https://doi.org/10.3389/fncom.2025.1564932

Liu, H. (2008). Dependency distance as a metric of language comprehension difficulty. *Journal of Cognitive Science*, 9(2), 159-191.

Ntracha, A., Iakovakis, D., Hadjidimitriou, S., Charisis, V. S., Tsolaki, M., & Hadjileontiadis, L. J. (2020). Detection of mild cognitive impairment through natural language and touchscreen typing processing. *Frontiers in Digital Health*. https://doi.org/10.3389/fdgth.2020.567158

Pennebaker, J. W. (1997). Writing about emotional experiences as a therapeutic process. *Psychological Science*, 8(3), 162-166.

Pew Research Center. (2019). Millennials stand out for their technology use, but older generations also embrace digital life. https://www.pewresearch.org/short-reads/2019/09/09/us-generations-technology-use/

Pinet, S., Zielinski, C., Alario, F.-X., & Longcamp, M. (2022). Typing expertise in a large student population. *Cognitive Research: Principles and Implications*, 7, 77. https://doi.org/10.1186/s41235-022-00424-3

Quinn, P., & Zhai, S. (2016). A cost-benefit study of text entry suggestion interaction. *Proceedings of the 2016 CHI Conference on Human Factors in Computing Systems*, 83-88.

Roark, B., Mitchell, M., Hosom, J. P., Hollingshead, K., & Kaye, J. (2011). Spoken language derived measures for detecting mild cognitive impairment. *IEEE Transactions on Audio, Speech, and Language Processing*, 19(7), 2081-2090. https://doi.org/10.1109/TASL.2011.2112351

Sirts, K., Piguet, O., & Johnson, M. (2017). Idea density for predicting Alzheimer's disease from transcribed speech. *Proceedings of CoNLL*.

Snowdon, D. A., Kemper, S. J., Mortimer, J. A., Greiner, L. H., Wekstein, D. R., & Markesbery, W. R. (1996). Linguistic ability in early life and cognitive function and Alzheimer's disease in late life: Findings from the Nun Study. *JAMA*, 275(7), 528-532. https://doi.org/10.1001/jama.1996.03530310034029

Tweedie, F. J., & Baayen, R. H. (1998). How variable may a constant be? Measures of lexical richness in perspective. *Computers and the Humanities*, 32(5), 323-352.

Vishnevsky, G., Fisher, T., & Specktor, P. (2024). The clock drawing test (CDT) in the digital era: Underperformance of Generation Z adults. *Journal of the Neurological Sciences*, 467, 123289. https://doi.org/10.1016/j.jns.2024.123289

Yamaguchi, M., & Logan, G. D. (2014). Pushing typists back on the learning curve: Revealing chunking in skilled typewriting. *Journal of Experimental Psychology: Human Perception and Performance*, 40(2), 592-612. https://doi.org/10.1037/a0033809
