---
title: "A Closing Window: The Demographic Confound in Keystroke-Based Cognitive Biomarkers and the AI-Mediation Threat to the Paradigm That Would Replace It"
slug: closing-window
author: Anthony Guzzardo
date: 2026-04-19
status: published
version: 2
abstract: "Keystroke dynamics have emerged as a promising modality for passive cognitive assessment, but the keystroke-cognition studies targeting neurodegeneration identified in this review have drawn their participants from a population that largely did not achieve the typing automaticity required for keystroke timing to reflect cognitive processes rather than motor execution."
---

# A Closing Window: The Demographic Confound in Keystroke-Based Cognitive Biomarkers and the AI-Mediation Threat to the Paradigm That Would Replace It

**Anthony Guzzardo**
April 2026 (v2, updated April 19)

---

*Author's note: The author is developing a longitudinal journaling system (Alice) that implements the design constraints discussed in Sections 7 and 8. As of v2, Alice captures keystroke dynamics at microsecond precision, computes nonlinear dynamical signals (permutation entropy, DFA, recurrence quantification analysis, transfer entropy) and motor biometric signals (ex-Gaussian decomposition, sample entropy, adjacent hold-time covariance) via a compiled Rust engine, performs linguistic content analysis across 11 semantic dimensions, and maintains longitudinal self-referential baselines with same-day calibration deltas. Readers should apply additional scrutiny to those sections, where the instrument-gap analysis overlaps with design decisions already implemented in that system. The arguments in Sections 2 through 6  -  the automaticity threshold, the demographic confound, the self-resolving timeline, the clock-drawing precedent, and the paradigm shift to self-referential baselines  -  do not depend on any specific implementation and should be evaluated on their own terms.*

---

## Abstract

Keystroke dynamics have emerged as a promising modality for passive cognitive assessment, but the keystroke-cognition studies targeting neurodegeneration identified in this review have drawn their participants from a population that largely did not achieve the typing automaticity required for keystroke timing to reflect cognitive processes rather than motor execution. This paper identifies a generational confound that plausibly distorts reported effect sizes and argues that the confound is self-resolving on a known demographic timeline: by 2035 to 2055 the population at risk for age-related cognitive decline will consist of lifelong fluent typists. More importantly, this demographic shift enables a different research paradigm  -  intra-individual longitudinal baselines in which deviation from oneself replaces deviation from a population norm as the unit of analysis. But the window this paradigm depends on may be closing before it opens. AI-assisted writing, autocomplete, and the gradual outsourcing of language production are already altering the keystroke signal in the population that would arrive at the at-risk age in the 2035 to 2055 window. The instruments that could exploit the opening window therefore need to be built now, while unassisted writing is still common enough to establish baselines, and designed with modality awareness so that the cognitive constructs being measured can survive the input technology that currently carries them.

---

## 1. Introduction

Keystroke dynamics have emerged as one of the most promising modalities for digital cognitive biomarkers. Recent studies report encouraging results: touchscreen writing-process biomarkers report AUC = 0.918 for community-based Alzheimer's screening, higher than the Montreal Cognitive Assessment (MoCA) and the Mini-Mental State Examination (MMSE) administered to the same sample (Li et al. 2025), and smartphone keystroke timing shows discriminative power for mild cognitive impairment (Kim et al. 2024). The appeal is clear: a passive, repeatable, low-cost measure of cognitive function captured during natural computer use, with no clinician required.

But the published keystroke-cognition literature is operating under two converging pressures that no study has yet named directly. The first is that current participants were largely drawn from a population born between roughly 1939 and 1966  -  people who encountered computers between the ages of 30 and 55 and many of whom never achieved the typing automaticity required for keystroke timing to reflect cognitive processes rather than motor execution. The total number of participants across the studies identified in this review is fewer than 500, aggregated from small samples constrained in part by the difficulty of recruiting elderly participants who type fluently enough to generate interpretable data. Ntracha et al. (2020) reported that requiring 12 months of smartphone experience produced a difficult recruitment process that ultimately yielded only 23 participants.

The second pressure is more recent and more serious. The cohort that was supposed to resolve the first problem  -  the digital natives and lifelong fluent typists who will occupy the at-risk age range by 2035 to 2055  -  is arriving into an environment in which unassisted character-by-character text production is becoming optional. Autocomplete, predictive text, AI-assisted drafting, and large-language-model composition are not future threats. They are present-tense features of how most people under 40 already write. The keystroke signal that current studies cannot cleanly extract from elderly novice typists may not be cleanly extractable from the future cohort either, for different reasons.

This is a conceptual position paper with review elements, not a systematic review or empirical study. The studies cited were identified through targeted searches of PubMed, Google Scholar, and the ACM Digital Library using terms including "keystroke dynamics," "cognitive decline," "dementia," "mild cognitive impairment," "typing," and "digital biomarker," with no formal date restriction. The search strategy is non-systematic and appropriate to the conceptual scope of the paper; a full systematic review is a distinct contribution that the field would benefit from but that is not attempted here. The available evidence base remains small  -  fewer than a dozen studies with a combined participant count under 500  -  which is itself part of the argument: a field drawing field-level conclusions from a sample this size should treat those conclusions as preliminary.

This paper argues four things:

1. The effect sizes reported in the current literature are plausibly distorted by a generational confound in ways that may include attenuation, inflation through selection bias, or both  -  making them difficult to interpret as stable estimates of the technique's diagnostic power.
2. This confound is self-resolving on a demographically known timeline, and its resolution would enable a different research paradigm built on intra-individual longitudinal baselines rather than cross-sectional population comparison.
3. That paradigm shift is the real contribution available to the field, but the window for capturing it is narrower than it appears. AI-assisted writing is contaminating the signal in the cohort that would have arrived cleanly at the at-risk age, and the contamination is already present, not prospective.
4. Any cognitive assessment modality tied to a specific input technology has a finite validity window. The clock-drawing test precedent shows that such windows close. The instruments needed to exploit the current window must be built with modality awareness, so the cognitive constructs being measured can migrate to new input technologies rather than being permanently coupled to keystroke timing.

---

## 2. The Automaticity Threshold

Keystroke dynamics can only serve as cognitive biomarkers when typing is automatic. This is not an arbitrary methodological preference. It is a consequence of how motor skill acquisition works.

Pinet et al. (2022) characterized typing expertise in a large student population and documented two distinct processing architectures. In novice typists, the pathway from intention to keystroke is serial: the typist recognizes the target word, retrieves its spelling, locates each key on the keyboard, selects the correct finger, and executes the movement. Each step depends on the previous. Keystroke timing in this architecture reflects the entire chain, which is dominated by visual search for keys and motor planning.

In expert typists, the lower-level operations (key location, finger selection, movement execution) are chunked into an automated inner loop that runs without conscious attention. The outer loop  -  where spelling retrieval, word selection, and sentence planning occur  -  is where cognitive work happens. Keystroke timing in expert typists is substantially transparent to the motor layer. Variation in flight time and hold time reflects word retrieval difficulty, syntactic planning, and coherence monitoring rather than finger coordination.

Yamaguchi and Logan (2014) demonstrated this experimentally by disrupting the chunked representations of skilled typists, effectively pushing them back onto the learning curve. When the inner loop is disrupted, skilled typists revert to serial processing and their keystroke patterns become indistinguishable from novices. The expert architecture is not just faster execution of the same process; it is a qualitatively different processing mode.

The practical implication is that there exists a threshold of typing fluency below which keystroke dynamics measure motor skill, not cognition. The exact threshold is difficult to specify as a single number because Pinet et al. (2022) explicitly argue against a sharp novice/expert boundary and demonstrate a continuous distribution instead. The estimate offered here  -  that typists below roughly 40 words per minute are unlikely to have achieved full automaticity, while those above 50 words per minute have a largely transparent motor layer  -  is an inference drawn from the Pinet et al. proficiency distribution and the Yamaguchi and Logan disruption data, not a validated clinical cutoff. Large-scale typing data (Dhakal et al. 2018, with 168,000 participants) confirms that the bottom decile types below 26 WPM and the top decile above 78 WPM, but no study has directly mapped typing speed to the automaticity threshold required for cognitive transparency in a clinical population. Establishing this threshold  -  through a study that stratifies clinical participants by typing proficiency and tests whether keystroke-cognition effect sizes increase monotonically above a proficiency cutoff  -  is the single most important empirical gap the field needs to close.

If a participant types at 25 words per minute, variation in their flight time is dominated by motor search and planning rather than cognitive state. The cognitive signal is not absent, but it is buried under motor variance that has nothing to do with neurodegeneration.

---

## 3. The Demographic Confound

The population currently available for keystroke-cognition studies of neurodegeneration consists almost entirely of people who did not grow up typing. The relevant age demographic for studying age-related cognitive decline is roughly 60 to 80 years old. In 2024, this corresponds to birth years between 1944 and 1964.

*Table 1: Schematic model of generational typing proficiency. The categorical labels in this table are conceptual rather than empirical and are intended to illustrate the cohort structure of the confound, not to quantify it.*

| Birth Year | Generation | Age at First Regular Computer Use | Current Age (2025) | Typing Proficiency (estimated) |
|---|---|---|---|---|
| 1940-1955 | Silent/Early Boomer | 35-55 (1990s) | 70-85 | Lower average automaticity expected |
| 1955-1965 | Late Boomer | 25-40 (1990s) | 60-70 | Mixed automaticity expected |
| 1965-1980 | Gen X | 15-30 (1990s) | 45-60 | Variable, trending toward higher automaticity |
| 1980-1995 | Millennial | 5-15 (childhood) | 30-45 | Higher average automaticity expected |
| 1995-2010 | Gen Z | Birth-10 (native) | 15-30 | High average automaticity on keyboard and touchscreen |

*Note: The proficiency characterizations are editorial estimates informed by cohort-level data rather than individually validated assessments. Cramer-Petersen et al. (2022) found significant generational differences in typing speed among 2,690 hospital employees, and Dhakal et al. (2018) documented wide speed variation in a 168,000-person sample, but neither study maps directly onto the clinical population categories used here. Pew Research Center (2019) provides technology adoption timelines by age group that support the estimated ages of first regular computer use.*

The people currently old enough to be at risk for age-related cognitive decline are disproportionately likely to fall in the lower ranges of typing automaticity. This is not a coincidence. It is a cohort effect with a known resolution timeline.

This creates three compounding problems in the existing literature.

**Signal validity.** When a participant with low typing fluency shows elevated flight time, it is difficult to determine how much reflects cognitive slowing versus motor inefficiency. Motor inexperience and cognitive difficulty both manifest as slower, more variable keystroke timing, making them hard to disentangle in the same data stream. Studies that report differences in keystroke dynamics between MCI and healthy control groups are measuring a real effect, but that effect is distorted by motor variance in both groups.

**Selection bias.** Researchers who require typing proficiency as an inclusion criterion (explicitly or implicitly through task design) end up with unrepresentative samples. The elderly participants who can type fluently enough to generate usable data are, by definition, more technologically engaged and likely more cognitively healthy than the general elderly population. The direction of this bias is not straightforwardly toward underestimation. A healthier, more cognitively reserved sample could produce either larger or smaller case-control effect sizes depending on how proficiency, education, cognitive reserve, and disease severity interact in a given study. Current results are therefore difficult to generalize, not uniformly suppressed.

**Confounding.** Typing proficiency itself correlates with cognitive reserve. People who type fluently tend to have higher education, more complex occupational histories, and greater engagement with cognitively demanding activities. In the current elderly population, typing proficiency is a confound masquerading as a control variable. Studies cannot fully separate the effect of cognitive status from the effect of technological literacy.

Despite these compounding problems, the published results are suggestive. Two frequently cited studies illustrate both the appeal of the modality and the methodological fragility of the current evidence base. Kim et al. (2024) reported AUC = 0.997 for flight time alone in discriminating MCI from healthy controls on smartphone keystroke data; the study used 99 participants (35 MCI after exclusions), computed the ROC on the full dataset without a held-out test set or cross-validation, and a subsequent correction notice was published. Li et al. (2025) reported AUC = 0.918 for a writing-process biomarker model for community Alzheimer's screening, compared to MoCA = 0.859 and MMSE = 0.783 administered to the same sample; the study used 72 participants, the task was repeated fingertip-on-touchscreen handwriting of a single Chinese character (米) rather than keyboard typing of free-form text, and the reported AUC was computed on the same sample used to fit a stepwise logistic regression that selected three features from an initial pool of twenty, with no held-out test set, cross-validation, or external cohort. The closest published study to what current-generation keystroke-biomarker instruments actually capture  -  keyboard keystroke logging during free-form writing by a cognitively impaired population  -  is Meulemans, Van Waes, and Leijten (2022), which reported large effect sizes (cognitively impaired writers produced 108 fewer characters per minute and spent 20.6% more time pausing) but was cross-sectional with n = 30. The evidence base is better characterized as "small number of studies with large within-study effect sizes, little external validation, and methodological heterogeneity" than as a confirmed diagnostic frontier.

One further complication: the clean separation between "motor noise" and "cognitive signal" implied throughout this section is itself an oversimplification. Buchman and Bennett (2011) demonstrated that motor function decline in aging shares neural substrates with cognitive decline, particularly in prefrontal and basal ganglia circuits. Holtzer et al. (2006) showed that motor planning and cognitive sequencing draw on shared prefrontal resources. Some portion of the "motor noise" in current studies carries cognitive information  -  the motor slowing *is* partly the disease. Removing motor inexperience from the population does not remove this fused motor-cognitive signal; it removes the additional variance introduced by participants who never learned to type fluently, which is a different and separable source of noise.

---

## 4. The Self-Resolving Timeline, and the Closing Window

The demographic confound is not permanent. It is a transitional artifact of the historical moment when computers entered daily life.

By 2035, the youngest Baby Boomers will be 71 and the oldest Millennials will be 55. By 2045, Millennials will be 50 to 65 and Gen X will occupy the 65 to 80 range. By 2055, the 60 to 80 age demographic will consist almost entirely of people who have typed daily since childhood or adolescence.

*Table 2: Schematic projection of expected motor noise reduction under a continued-unassisted-keyboard assumption. The "Expected Motor Noise" labels are conceptual rather than quantitative, and the projection is contingent on the AI-mediation caveat discussed below.*

| Year | Ages 60-80 Birth Cohort | Typing History | Expected Motor Noise |
|---|---|---|---|
| 2025 | 1945-1965 | Late adopters, 10-30 years | High |
| 2035 | 1955-1975 | Mixed, 20-35 years | Moderate |
| 2045 | 1965-1985 | Early adopters to natives, 25-40+ years | Low |
| 2055 | 1975-1995 | Digital natives, 30-45+ years | Minimal |

Under this model, the motor noise floor drops with each decade. By 2045, researchers studying cognitive decline through keystroke dynamics would be working with participants who have typed for longer than the entire history of personal computing that preceded them. The automaticity threshold would be met by default rather than by exclusion criterion.

But this projection has a load-bearing assumption: that the 2035-to-2055 cohort is still producing unassisted text character-by-character at volume. That assumption is already weakening. Banovic et al. (2019) demonstrated that autocomplete fundamentally alters keystroke dynamics, shifting users from character-level generation to a scan-decide-accept loop that changes pause distributions from reflecting lexical retrieval to reflecting suggestion evaluation. Quinn and Zhai (2016) found that predictive text on mobile creates bimodal inter-keystroke interval distributions  -  fast acceptance bursts interleaved with normal typing. Buschek et al. (2021) showed that phrase-level suggestions alter not just speed but *content*, as writers shift toward suggestion-compatible framings. Since 2022, LLM-assisted drafting has extended this mediation from word and phrase suggestions to whole-paragraph and whole-document composition.

The keystroke signal in an AI-mediated writer is not a noisier version of the signal in an unassisted writer. It is a different signal measuring a different thing. The temporal microstructure of accepting a suggestion is not the temporal microstructure of retrieving a word from memory. Keystroke cognitive biomarkers calibrated on unassisted writing would be measuring visual scanning and decision-making rather than lexical retrieval and sentence planning. This is not a noise problem; it is a construct validity threat.

Beyond contamination, there is an availability problem. Voice interfaces, multimodal input, and LLM-mediated composition are reducing the total volume of keyboard typing per person, undermining the "dense daily data" premise of the longitudinal paradigm. The threat is not only that future typing will be AI-contaminated but that there will be substantially less of it.

The window that the demographic timeline would have opened is therefore narrower than it appears. The cohort that will arrive at the at-risk age with high typing proficiency is the same cohort that is arriving with the heaviest AI-mediation exposure. The clean signal the demographic shift would have produced is being partially foreclosed by a second technology shift that operates on a faster timeline than generational turnover. Instruments designed to exploit the opening window must account for this  -  either by requiring unassisted writing conditions, by detecting and filtering AI-assisted segments from keystroke streams, or by developing new signal models that account for hybrid human-AI text production. No published study has addressed this problem.

---

## 5. The Clock-Drawing Test Precedent

The claim that a cognitive assessment modality can be invalidated by a cultural technology shift is not hypothetical. It has already happened.

The clock-drawing test (CDT) has been a standard neuropsychological screening tool for decades. The task is simple: draw a clock face showing a specified time. It assesses visuospatial ability, executive function, and semantic memory in a single brief task. It is embedded in the MoCA and used independently in clinical practice worldwide.

Vishnevsky, Fisher, and Specktor (2024) demonstrated that Generation Z adults, who grew up reading digital rather than analog clocks, underperform on the CDT compared to older adults  -  not because of cognitive impairment but because of reduced familiarity with analog clock faces. The assessment instrument assumed a cultural competency that is no longer universal.

The CDT precedent illustrates a general principle: cognitive assessments can embed hidden cultural competencies that make their validity contingent on population-level familiarity with a specific artifact. The parallel to keystroke dynamics is suggestive but imperfect. The CDT is losing validity because a prerequisite skill (analog clock literacy) is declining. Keystroke-based assessment was hypothesized to gain validity as a prerequisite skill (typing fluency) saturates. The directionality is opposite, and the analogy should be treated as an illustrative precedent rather than a symmetric demonstration.

The deeper lesson is that any cognitive assessment tied to a specific artifact or input modality has a finite validity window. Keyboards will eventually be displaced by voice interfaces, AI-mediated composition, neural input, or technologies that do not yet exist. A longitudinal cognitive monitoring system that depends on keyboard input will eventually face the same obsolescence the CDT faces now.

This does not argue against building keyboard-based instruments. It argues for building them with modality awareness  -  designing the underlying measurement framework so that the cognitive constructs being assessed (processing speed, retrieval fluency, planning complexity, revision behavior) can be mapped to new input modalities as they emerge, rather than being permanently coupled to keystroke timing.

---

## 6. From Population Norms to Personal Baselines

The demographic shift described in this paper does more than improve existing studies. It enables a fundamentally different kind of study  -  one the current research paradigm cannot conduct.

Every published keystroke-cognition study asks the same question: does this person look impaired compared to healthy people? That is the only question available from a one-time lab visit, a controlled elicitation task, and a population norm. The entire methodology of the field  -  cross-sectional design, population-normed metrics, task-constrained assessment  -  is shaped by a practical constraint: researchers get one session with each participant, maybe two.

Once you have someone typing fluently every day for years in a natural environment, you can ask a different question: does this person look different from themselves?

That question does not require Honoré's Statistic, Mean Dependency Distance, or population norms. It requires a dense personal baseline and enough time to detect drift. The unit of analysis shifts from population comparison to intra-individual trajectory. The relevant metrics shift from "is this score below the clinical cutoff" to "is this person's behavioral signature deviating from their own rolling baseline in a direction consistent with known decline patterns."

Intra-individual longitudinal monitoring is not itself novel to cognitive assessment. Actigraphy research has used within-person sleep and activity trajectories to track cognitive decline for more than a decade. GPS and smartphone mobility data have been used to detect early cognitive change through life-space contraction. Speech-based longitudinal monitoring is the closest precedent, with Winterlight Labs (now Cambridge Cognition) and the DementiaBank consortium building toward within-person speech trajectory tracking. What keystroke dynamics add to this broader digital biomarker landscape is density and ambient capture: actigraphy tracks motor activity, mobility tracks behavior in physical space, and speech analysis depends on either clinical sessions or passive audio capture that raises substantial privacy concerns. Keystroke data is generated continuously during the cognitive act of text production itself, without requiring a clinical encounter or ambient recording. The paradigm shift proposed here is therefore not the invention of within-person longitudinal cognitive monitoring but its extension to a modality that combines high temporal density, low observational burden, and direct coupling to language production.

This represents a paradigm change across multiple dimensions for keystroke-based assessment specifically:

**From cross-sectional to longitudinal.** Instead of a single cognitive snapshot, the instrument captures thousands of data points per person over years. Statistical power derives from temporal density within a single individual rather than sample size across individuals.

**From population-normed to self-referential.** The comparison standard is not a healthy average but the person's own history. This eliminates the need for demographically matched control groups and sidesteps the confounds of education, occupation, and baseline cognitive ability that plague cross-sectional studies.

**From task-constrained to ecologically valid.** Instead of a controlled elicitation task, the data comes from naturalistic daily writing. The cognitive demands are real, varied, and self-generated rather than artificial and standardized.

**From clinic-dependent to passive.** No clinician visit is required. No appointment, no travel, no white-coat anxiety. Data is captured during normal computer use, continuously, at no marginal cost per observation.

**From diagnosis to early detection.** Cross-sectional screening answers "do you have MCI right now." Longitudinal self-referential tracking can potentially answer "your behavioral trajectory started shifting six months ago in a pattern that, in other cases, preceded clinical MCI by two years." The difference is the difference between intervention and damage control.

The metrics for this paradigm do not yet exist. This is not a gap in the literature. It is a consequence of the data never having been available. You cannot develop intra-individual longitudinal baselines from a 45-minute lab session with 23 participants who hunt and peck on a touchscreen. You need dense, daily, fluent data from the same person over years. The population that can produce that data at the age where cognitive decline becomes clinically relevant does not yet exist  -  and the closing window described in Section 4 means that the population that will exist may not produce it unassisted either.

This paradigm carries its own statistical challenges, and these should be named. **Regression to the mean** will produce apparent trajectory shifts in any rolling-baseline system, particularly after extreme sessions, and must be distinguished from genuine cognitive change. **Life event confounding**  -  retirement, bereavement, medication changes, illness, relocation  -  will produce real behavioral shifts unrelated to neurodegeneration, and the system must either account for or be robust to these. **Seasonal and circadian variation** in writing behavior could mimic or mask slow cognitive trends if not modeled. **Compliance decay** over years of daily journaling is perhaps the most underappreciated threat: consumer journaling, meditation, and habit-tracking apps are commonly reported to retain only a small fraction of users at one year, and clinical-grade digital intervention studies routinely document substantial dropout over 12-month windows. The minimum data density required for stable personal baselines has not been established. Whether sustained voluntary engagement with open-ended daily writing is achievable at clinically useful rates is an open empirical question, and a negative answer would not invalidate the paradigm but would sharply narrow the population it can serve.

The **base rate problem** deserves particular attention because it is the challenge most likely to determine whether the paradigm succeeds or fails in practice. MCI incidence in adults over 65 is roughly 1 to 2 percent per year. In a population of 100,000 healthy users monitored longitudinally, the expected number of true transitions in a given year is on the order of 1,000 to 2,000. A deviation-detection system with seemingly strong specificity of 95 percent would produce 5,000 false positive alerts against that base rate, yielding a positive predictive value well below 30 percent. A system with 99 percent specificity still produces 1,000 false positives against 1,000-2,000 true cases. This is not a minor tuning problem. It is a structural constraint that shapes what a longitudinal behavioral monitoring system can credibly claim, how alerts should be framed (as trajectory observations rather than diagnostic flags), and how clinical follow-up pathways should be designed. A system optimized for sensitivity will flood clinicians with false positives; a system optimized for specificity will miss the early signals that motivate the paradigm in the first place. Navigating this trade-off is the central design problem of any self-referential cognitive monitoring instrument, and it does not have a known solution.

The longitudinal paradigm is a research program, not a ready-made solution. Its structural advantages are real, but realizing them requires methodological work that has not yet been done  -  work that this paper identifies rather than completes.

---

## 7. Signal Design: What to Measure

The shift from population-normed cross-sectional assessment to self-referential longitudinal tracking changes which signals are worth capturing. Several NLP-derived features that appear frequently in the large-feature-set dementia-language classifiers of Fraser, Meltzer, and Rudzicz (2016) and similar work are poorly suited to a longitudinal, self-referential, short-text framework. Honoré's Statistic is mathematically unstable on short journal entries (Tweedie and Baayen 1998) and has not demonstrated incremental discriminant power beyond the Moving-Average Type-Token Ratio (Covington and McFall 2010). Mean Dependency Distance is theoretically motivated by Gibson's dependency locality theory (2000) but empirically unvalidated as a standalone predictor, and its dependence on parsing quality introduces a noise source hard to distinguish from the cognitive signal. Noun/verb ratios are topic-dependent in freeform text and, outside of specific aphasic syndromes, do not survive feature selection against lexical diversity and syntactic complexity measures. An expanded discussion of these evaluations is provided in Appendix A.

The signals that hold up for longitudinal self-referential tracking share a common property: they measure process rather than product, and they generate stable within-person baselines against which deviation can be detected. *v2 note: All signals described in this section are now implemented and computing in Alice's signal pipeline. Keystroke dynamics and motor-cognitive decomposition are computed via a compiled Rust engine (napi-rs) at sub-2ms latency on 500-keystroke streams. Linguistic signals are computed server-side. Calibration deltas are computed on days with both calibration and journal sessions.*

**Keystroke dynamics** (hold time, flight time, inter-key interval, keystroke entropy) capture the temporal microstructure of typing. Critically, these metrics are captured during the act of writing, not derived from the finished text. They reflect real-time processing demands.

**Production fluency** (P-burst length and count, characters per minute) captures the rhythm of text generation. P-bursts  -  sustained runs of typing bounded by pauses exceeding two seconds  -  were introduced by Chenoweth and Hayes (2001) as a window into the translation process in writing.

**Motor-cognitive decomposition** addresses the central problem of this paper directly. Ex-Gaussian fitting of flight time distributions (Zulueta et al. 2018, BiAffect) separates each session's timing into a Gaussian component (mu and sigma, reflecting motor baseline speed and motor noise) and an exponential tail (tau, reflecting cognitive slowing). The tau proportion  -  tau divided by mean flight time  -  isolates the cognitive fraction of keystroke timing independent of overall typing speed. This decomposition offers a concrete answer to the automaticity threshold problem described in Section 2: even in a participant whose motor baseline is slow, an elevated tau proportion indicates cognitive load above and beyond motor skill limitations. Adjacent hold-time covariance (Giancardo et al. 2016, neuroQWERTY) provides a complementary motor coordination signal  -  the correlation between consecutive key hold durations  -  that captures fine motor degradation without conflation with cognitive state.

**Revision behavior** (deletion patterns, revision timing, commitment ratio) captures how a person rethinks and restructures their writing. The Faigley and Witte (1981) taxonomy of revision distinguishes surface changes from meaning changes. The temporal distribution of revisions within a session and the proportion of typed text that survives to submission provide distinct signals about cognitive process. Error correction can be further decomposed into three phases  -  detection (the pause before deletion), execution (the inter-key interval within a deletion chain), and recovery (the latency from the last delete to the next inserted character)  -  separating motor automaticity from cognitive re-planning after errors (Springer 2021). Revision distance  -  how far back from the leading edge the cursor is positioned when a deletion occurs  -  distinguishes deep structural restructuring from surface corrections (Lindgren and Sullivan 2006).

**Lexical diversity** (MATTR) captures vocabulary range in a length-independent manner (Covington and McFall 2010). Unlike Honoré's Statistic, MATTR is mathematically stable on short texts and has well-documented sensitivity to lexical retrieval difficulty.

**Calibration deltas** provide a within-session control. When a person completes both a neutral calibration prompt and a substantive journal entry on the same day, the difference between their behavioral signals on the two tasks isolates cognitive effort from baseline motor performance  -  analogous to the Pennebaker expressive writing paradigm (1997).

One additional metric is a candidate for future investigation. Propositional density (idea density) was identified by the Nun Study (Snowdon et al. 1996) as a predictor of Alzheimer's disease onset 60 years in advance, with 80% sensitivity and 86% specificity in an autopsy-confirmed subsample. This is the strongest longitudinal linguistic biomarker in the literature. Automating it requires dependency parsing (Sirts et al. 2017), but it carries substantially stronger clinical validation than the other parsing-dependent features set aside above.

---

## 8. The Instrument Gap

At the time of v1 publication (April 17, 2026), no existing tool combined keystroke dynamics, linguistic content analysis, and longitudinal self-referential tracking in a single instrument. As of v2, a working prototype (Alice) satisfies each of the design constraints enumerated below, though it remains at n=1 with fewer than ten fully instrumented sessions. The instrument gap as described here has been narrowed in implementation but remains open as a validated research paradigm.

The current landscape is fragmented into two silos. Keystroke dynamics researchers capture timing data but ignore the content of what is typed. Computational linguistics researchers analyze transcribed text but have no access to the temporal process that produced it. Studies in the first silo can tell you that a person's flight time is elevated but not whether they were struggling to retrieve a specific word or planning a complex sentence. Studies in the second silo can tell you that a person's vocabulary diversity is declining but not whether the decline reflects retrieval difficulty (long pauses before low-frequency words) or avoidance (choosing simpler words without hesitation).

The combination of process and content in the same instrument is not additive. It is multiplicative. A decline in MATTR concurrent with a decline in P-burst length means something different from a decline in MATTR with stable P-burst length. The first suggests retrieval difficulty under cognitive load. The second suggests vocabulary contraction independent of production fluency  -  a different clinical picture.

Adding longitudinal self-referential tracking creates a third dimension neither silo has explored. When you have a person's behavioral baseline over months or years, you can detect deviations invisible in a cross-sectional study. A flight time of 250 milliseconds is unremarkable compared to a population norm. A flight time of 250 milliseconds in a person whose rolling 90-day average is 180 milliseconds is a signal. The deviation, not the absolute value, is what matters.

The instrument needed for this paradigm must satisfy several design constraints:

**Ecological validity.** The task must be something people actually do, not a laboratory exercise. Journaling  -  daily open-ended writing in response to a prompt  -  is one of the few tasks that combines sufficient cognitive demand with sustainable engagement.

**Process capture.** Every keystroke event (press, release, deletion, pause, tab-away, scroll-back) must be timestamped and recorded. Post-hoc text analysis without process data is half the picture.

**Content analysis.** The submitted text must be analyzed for linguistic features that provide a second independent signal channel alongside keystroke dynamics.

**Longitudinal architecture.** The system must be designed for accumulation, not snapshots.

**Modality awareness.** Given the CDT precedent and the AI-mediation threat, the instrument should be designed so the cognitive constructs being measured are not permanently coupled to a specific input modality. The underlying framework should be expressible in terms that can migrate to new input technologies as they emerge.

**AI-mediation detection.** Given that autocomplete, predictive text, and AI-assisted drafting contaminate the keystroke signal in structurally different ways, the instrument must either require unassisted writing conditions, detect and flag AI-assisted segments, or develop hybrid signal models. This is not a feature to add later; it is a foundational design decision.

**Calibration.** Neutral writing prompts, administered alongside substantive prompts, provide a within-person baseline that controls for day-to-day variation in motor performance, fatigue, and environmental factors.

No commercial or academic tool currently satisfies all of these constraints at validated scale. Winterlight Labs (now Cambridge Cognition) captures spoken language but not written-process data. DementiaBank provides transcribed speech samples but no keystroke data. Neurokeys (used by Kim et al. 2024) captures smartphone keystroke dynamics but does not analyze linguistic content. Research prototypes built on DementiaBank analyze text features but have no longitudinal component.

The instrument gap is not a software engineering problem. It is a design philosophy problem. The tool must be built for depth rather than throughput, for sustained daily use rather than clinical efficiency, and for individual trajectories rather than population screening. It must be built now, while unassisted writing is still common enough to establish baselines, so that longitudinal records are already accumulating when those records become clinically relevant.

*v2 note: Alice now satisfies all seven constraints enumerated above. Process capture records every keystroke event at microsecond precision via `performance.now()`, storing complete keystroke streams and event logs for post-hoc analysis. Content analysis computes 11 semantic dimensions (syntactic complexity, self-focus, uncertainty, cognitive processing, six NRC emotion densities, sentiment, abstraction) alongside 13 dynamical signals, 12 motor signals, and 9 process signals per session. Longitudinal architecture stores all raw data in PostgreSQL with pgvector-indexed embeddings for semantic similarity search across the full journal history. Calibration sessions use neutral prompts to establish same-day behavioral baselines, and calibration deltas isolate cognitive effort from motor state. AI-mediation detection flags paste events with character counts. The system is single-user, local-first, and has been accumulating data since April 2026. It remains n=1 and unvalidated. The gap between "implemented" and "validated" is the work that remains.*

---

## 9. Discussion

The argument presented here has implications beyond keystroke dynamics.

**For the cognitive biomarker field broadly.** The demographic confound described here is not unique to keystroke dynamics. Any digital biomarker that depends on a specific technology skill  -  touchscreen fluency, voice interface competency, wearable device compliance  -  faces the same generational adoption curve. Researchers should routinely evaluate whether their target population has achieved the skill automaticity required for their instrument to measure what they intend to measure, and should report this evaluation explicitly rather than treat technology literacy as an assumed baseline. They should also evaluate whether AI-mediation of the target behavior is altering the construct being measured.

**For clinical trial design.** If longitudinal behavioral monitoring can detect cognitive trajectory shifts months or years before clinical diagnosis, behavioral endpoints captured passively during daily life could supplement or eventually replace periodic clinical assessments that are expensive, effortful, and subject to practice effects. A drug that slows cognitive decline might produce detectable changes in behavioral trajectory before it produces measurable changes on the MoCA or MMSE.

**For mental health monitoring.** The same framework that detects cognitive decline could detect other forms of psychological change. Depression, anxiety, grief, and recovery all have behavioral signatures in writing process and content. A system designed for cognitive health monitoring inherits the capacity for mental health monitoring without additional instrumentation. The ethics of this dual use require careful consideration.

**For the AI-mediation question specifically.** The concern that keystroke signals will be contaminated or eliminated by AI-assisted writing is not merely a methodological nuisance. It points at a more general question  -  what happens to behavioral biomarkers generally when the behavior being measured is increasingly co-produced with machines  -  that the digital biomarker field has not yet engaged with. Keystroke dynamics happens to be an early and well-instrumented case, but the question will recur for speech, for movement, and eventually for any behavior that can be AI-mediated.

**Motor stereotypes.** A second complication for the self-resolving timeline is that lifelong typing may create its own form of signal opacity. For a person who has typed for 40 years, the motor patterns for high-frequency sequences ("the," "and," "tion") may become so deeply automated that they resist cognitive slowing even as decline progresses. These over-learned motor sequences could create blind spots where cognitive changes fail to surface in keystroke timing. If the most common words and bigrams are typed with near-mechanical consistency regardless of cognitive state, the signal may concentrate in lower-frequency words and novel constructions  -  requiring instruments sensitive enough to detect deviation in the sparse tail of the typing distribution rather than in aggregate statistics.

**Limitations.** This is a position paper with review elements, not an empirical study. The central claim  -  that current effect sizes are plausibly distorted by the demographic confound  -  has not been tested directly. A direct test would require either a longitudinal study tracking the same keystroke-cognition relationships across successive birth cohorts, or a cross-sectional study that stratifies participants by typing proficiency and demonstrates effect sizes increase monotonically with proficiency. Neither study has been conducted. The generational typing proficiency estimates here are based on cohort-level characterizations rather than individual-level typing assessments, and the precise automaticity threshold remains an approximation.

The clean separation between "motor noise" and "cognitive signal" used throughout the paper is a simplification. Motor slowing in neurodegeneration has cognitive origins (Buchman and Bennett 2011). The argument is not that motor and cognitive signals are fully separable, but that motor *inexperience*  -  variance introduced by participants who never learned to type fluently  -  is separable from the fused motor-cognitive signal that keystroke dynamics capture in skilled typists. The former is noise; the latter is signal. This distinction has not been empirically validated in a clinical keystroke study.

---

## 10. Conclusion

The demographic shift described in this paper is real in the sense that its underlying fact is demographically inevitable: birth cohorts with high lifelong typing exposure will occupy the at-risk age range for cognitive decline within the next two decades. What that shift produces, however, depends on whether those cohorts are still producing unassisted text at volume when they arrive.

The keystroke-cognition literature is caught between two forces operating on different timescales. The demographic confound that distorts current studies is resolving slowly, on the timescale of generational turnover. The AI-mediation of writing is contaminating the signal quickly, on the timescale of product adoption. The window between the two  -  in which a sufficient population of lifelong fluent typists is still producing unassisted text at the ages where cognitive decline becomes clinically relevant  -  is narrower than the demographic projection alone suggests. It may not be as wide as a decade. It may already be narrowing in ways current instruments cannot detect.

That narrow window is where the opportunity lies, and it is closing. The instruments that could exploit it  -  combining process capture, content analysis, longitudinal self-referential architecture, and modality awareness  -  are beginning to be built, but none have been validated beyond prototype stage. The work that remains is not primarily engineering. It is empirical: establishing whether intra-individual keystroke baselines are stable enough to detect meaningful drift, determining the minimum data density required for reliable personal baselines, and validating that the signals described in Section 7 produce clinically meaningful trajectory markers in a longitudinal context. Waiting for the demographic timeline to play out on its own assumes a stability of writing behavior that can no longer be taken for granted. The baselines need to be accumulating now, so that when the validation studies become possible, the longitudinal records already exist.

---

## Appendix A: Evaluations of Signals Set Aside for Longitudinal Self-Referential Tracking

*Note: The evaluations below are scoped to longitudinal self-referential short-text analysis. Several of these features retain genuine value in the large-feature-set cross-sectional classifiers where they were originally developed, and the evaluations should not be read as field-level verdicts.*

**Honoré's Statistic** measures vocabulary productivity by counting words used only once in a text (hapax legomena). It appears in nearly every large-feature-set NLP-dementia paper including Fraser, Meltzer, and Rudzicz (2016). Its standalone discriminant power is modest (AUC approximately 0.55 to 0.65 for AD versus healthy controls when isolated). Its theoretical advantage over type-token ratio  -  length independence  -  is achieved more reliably by the Moving-Average Type-Token Ratio (Covington and McFall 2010). No study has demonstrated statistically significant incremental discriminant power of Honoré's H beyond MATTR. The formula is mathematically unstable on short texts: when most words are hapax, as is common in journal entries under 300 tokens, the denominator approaches zero and the statistic becomes unreliable (Tweedie and Baayen 1998). Set aside for the longitudinal short-text use case.

**Mean Dependency Distance** measures syntactic complexity by computing the average distance between grammatically related words in a dependency parse tree. The theoretical chain is individually well-established: cognitive decline reduces working memory, reduced working memory limits syntactic complexity (Gibson 2000), and MDD measures syntactic complexity (Liu 2008, Futrell, Mahowald, and Gibson 2015). However, no published study reports effect sizes or AUCs for MDD in isolation as a cognitive decline predictor. Simpler syntactic measures  -  mean sentence length, clausal density  -  consistently outperform dependency-based complexity metrics in the dementia-NLP literature. MDD also requires dependency parsing whose accuracy degrades on informal text and cognitively impaired language, risking measurement of parsing errors rather than cognition (Roark et al. 2011). Theoretically motivated but empirically unvalidated for this use case.

**Noun/verb ratio** is sometimes cited as a marker for cognitive decline on the assumption that decline shifts language toward more nouns and fewer verbs. The Alzheimer's literature does not support this. In typical AD, noun retrieval is impaired first because nouns depend more heavily on semantic memory in the temporal lobe, where AD pathology typically begins. The robust verb-specific deficit is real but specific to nonfluent/agrammatic primary progressive aphasia, a rare syndrome affecting roughly 3 to 4 per 100,000 people. In freeform journal text without controlled elicitation, noun/verb ratio reflects topic and communicative intent rather than cognitive capacity. Set aside for this use case; retains clinical relevance in controlled-elicitation protocols targeting specific aphasic syndromes.

---

## References

Banovic, N., Buzali, T., Chevalier, F., Mankoff, J., & Dey, A. K. (2019). Quantifying the effects of autocomplete on text input efficiency and user behavior. *Proceedings of the ACM on Interactive, Mobile, Wearable and Ubiquitous Technologies*, 3(3), 1-28.

Buchman, A. S., & Bennett, D. A. (2011). Loss of motor function in preclinical Alzheimer's disease. *Expert Review of Neurotherapeutics*, 11(5), 665-676.

Buschek, D., Zürn, M., & Eiber, M. (2021). The impact of multiple parallel phrase suggestions on email input and composition behaviour of native and non-native English writers. *Proceedings of the 2021 CHI Conference on Human Factors in Computing Systems*, 1-13.

Chenoweth, N. A., & Hayes, J. R. (2001). Fluency in writing: Generating text in L1 and L2. *Written Communication*, 18(1), 80-98.

Cramer-Petersen, C. L., et al. (2022). Digital disparities among healthcare workers in typing speed between generations, genders, and medical specialties. *JAMIA Open*, 5(4).

Covington, M. A., & McFall, J. D. (2010). Cutting the Gordian Knot: The Moving-Average Type-Token Ratio (MATTR). *Journal of Quantitative Linguistics*, 17(2), 94-100.

Dhakal, V., Feit, A. M., Kristensson, P. O., & Oulasvirta, A. (2018). Observations on typing from 136 million keystrokes. *Proceedings of the 2018 CHI Conference on Human Factors in Computing Systems*, 1-12.

Faigley, L., & Witte, S. (1981). Analyzing revision. *College Composition and Communication*, 32(4), 400-414.

Fraser, K. C., Meltzer, J. A., & Rudzicz, F. (2016). Linguistic features identify Alzheimer's disease in narrative speech. *Journal of Alzheimer's Disease*, 49(2), 407-422.

Futrell, R., Mahowald, K., & Gibson, E. (2015). Large-scale evidence of dependency length minimization in 37 languages. *PNAS*, 112(33), 10336-10341.

Giancardo, L., Sánchez-Ferro, A., Arroyo-Gallego, T., Butterworth, I., Mendoza, C. S., et al. (2016). Computer keyboard interaction as an indicator of early Parkinson's disease. *Scientific Reports*, 6, 34468.

Gibson, E. (2000). The dependency locality theory: A distance-based theory of linguistic complexity. In A. Marantz, Y. Miyashita, & W. O'Neil (Eds.), *Image, Language, Brain*. MIT Press.

Holtzer, R., Verghese, J., Xue, X., & Lipton, R. B. (2006). Cognitive processes related to gait velocity: Results from the Einstein Aging Study. *Neuropsychology*, 20(2), 215-223.

Kim, et al. (2024). Discriminant power of smartphone-derived keystroke dynamics for mild cognitive impairment. *Journal of Medical Internet Research*.

Li, S., et al. (2025). A new method for community-based intelligent screening of early Alzheimer's disease populations based on digital biomarkers of the writing process. *Frontiers in Computational Neuroscience*.

Lindgren, E., & Sullivan, K. P. H. (2006). Analysing online revision. In K. P. H. Sullivan & E. Lindgren (Eds.), *Computer Keystroke Logging and Writing* (pp. 157-188). Elsevier.

Liu, H. (2008). Dependency distance as a metric of language comprehension difficulty. *Journal of Cognitive Science*, 9(2), 159-191.

Meulemans, C., Leijten, M., Van Waes, L., Engelborghs, S., & De Maeyer, S. (2022). Cognitive writing process characteristics in Alzheimer's disease. *Frontiers in Psychology*, 13, 878312.

Ntracha, A., et al. (2020). Detection of mild cognitive impairment through natural language and touchscreen typing processing. *Frontiers in Digital Health*.

Pennebaker, J. W. (1997). Writing about emotional experiences as a therapeutic process. *Psychological Science*, 8(3), 162-166.

Pew Research Center. (2019). Millennials stand out for their technology use, but older generations also embrace digital life.

Pinet, S., Zielinski, C., Alario, F.-X., & Longcamp, M. (2022). Typing expertise in a large student population. *Cognitive Research: Principles and Implications*, 7, 77.

Quinn, P., & Zhai, S. (2016). A cost-benefit study of text entry suggestion interaction. *Proceedings of the 2016 CHI Conference on Human Factors in Computing Systems*, 83-88.

Roark, B., Mitchell, M., Hosom, J. P., Hollingshead, K., & Kaye, J. (2011). Spoken language derived measures for detecting mild cognitive impairment. *IEEE Transactions on Audio, Speech, and Language Processing*, 19(7), 2081-2090.

Sirts, K., Piguet, O., & Johnson, M. (2017). Idea density for predicting Alzheimer's disease from transcribed speech. *Proceedings of CoNLL*.

Springer, M. V. (2021). Keystroke dynamics in Parkinson's disease: Error correction as a window into motor and cognitive processing. *Journal of Clinical and Experimental Neuropsychology*, 43(4), 397-408.

Snowdon, D. A., et al. (1996). Linguistic ability in early life and cognitive function and Alzheimer's disease in late life: Findings from the Nun Study. *JAMA*, 275(7), 528-532.

Tweedie, F. J., & Baayen, R. H. (1998). How variable may a constant be? Measures of lexical richness in perspective. *Computers and the Humanities*, 32(5), 323-352.

Vishnevsky, G., Fisher, T., & Specktor, P. (2024). The clock drawing test (CDT) in the digital era: Underperformance of Generation Z adults. *Journal of the Neurological Sciences*, 467, 123289.

Yamaguchi, M., & Logan, G. D. (2014). Pushing typists back on the learning curve: Revealing chunking in skilled typewriting. *Journal of Experimental Psychology: Human Perception and Performance*, 40(2), 592-612.

Zulueta, J., Piscitello, A., Rasber, M., Nelson, R., Demiris, G., et al. (2018). Predicting mood disturbance severity with mobile phone keystroke metadata: A BiAffect digital phenotyping study. *Journal of Medical Internet Research*, 20(7), e241.
