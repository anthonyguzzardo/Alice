
# White Paper
## The Demographic Confound in Keystroke-Based Cognitive Biomarkers: Why Current Effect Sizes Are Conservative Lower Bounds
## April 15th, 2026
## Anthony Guzzardo

The thesis is that there is an aging demographic of keyboard typing iliterate people that are unable to properly be test in experiments due to their inability to properly cognitevly output what they are thinking via keyboard. In simpler terms their keyboard patterns reflect a brain to muscle coordination rather than a truly symbiotic brain to keyboard transferal of behavioral stuff. The ideas is that in the next 10-20 years there will be a ripe population to test on a variety of topics. Including but not limited to baseline typing behavior, cogntive-decline as it relates to neuoro-degenetive disease. The study is not limited to keyboard typing as a modality and realizes the idea is we need a longitudinal study on whichever input vector bassed maps to cognitive behavior or whatever. There is a culture aspect that proves this point. The pctCLOCK drawing test used to be gold standard, but the advent of the digital clock led to people not properly being able to perform in the test. This indicates that the assessment needs to be independent of the instrumnet used to observe and be able to map to the population or whatever.

  What it actually is:
  - A review/commentary paper, not an empirical study (you don't need participants yet)
  - You synthesize the existing literature (you already have every citation in Theory 6) and make an argument nobody has made: that every keystroke-cognition study to date was run on the worst possible population, and that this is a cohort effect with a known resolution timeline
  - You present the typing fluency timeline (your generational table), the automaticity threshold evidence, the three compounding problems (signal validity, selection bias, confounding), and the CDT inversion comparison

  What the grant application actually says:
  - Specific Aims (1 page): "We will validate a longitudinal writing-process instrument that captures both keystroke dynamics and linguistic content for cognitive health monitoring" — Aim 1: deploy to 2-3 research labs, Aim 2: correlate signals against MoCA/MMSE in a pilot study (50 participants, MCI vs. healthy aging)
  - Significance: The Theory 6 argument + the two-silo gap + the $1.8B graveyard lesson about instrument-first vs. product-first
  - Innovation: No existing tool combines process + content + longitudinal. Here's the competitive landscape table from Theory 5.
  - Approach: Build research export layer, deploy to partner labs, run pilot validation


  # introduction
  - We are approaching the sweet spot of assessing the viability of keyboard based assements of behavior and cogntive ability. With the recent advent of LLM chatbots people are putting their mental state online en masse. However studies show that cognitive intensity in chatbots is reduced by nearly 40% due to over gamification and self-gratification feed back loop. This is why similar experiments of scrolling and typing patterns on phones led to failed startups and experiments because they were not using the correct environment. It's proven that journaling increases cognitive intensity and a longitudinal study would possibly allow us to make the journalist the control and we are entering the sweet spot for keyboard proficiency in 2035-2055 to test participants and ammases many longitudinal behavior studies across participants. There have been similar studies that have been outgrown due to cultural shifts and technological displacement including the pctCLOCK test which lost it's utility after the digital clock was created. Therefore there is a timeline on keyboard fluency however we know have a better control group to test than the previous keyboard iliteral boomer, and gen-x population who could not utilize such mechanism so proving this mechanic could be extremely useful. Eventually we would want to make it modality agnostic whic would require other input methods to be studied but for now this seems to be a no-brainer testing this one. How the study works is we give the user a serious question every day that they are to answer. We track various data metrics p-bursts, entropy, scrolling ... bunch of other shit and ingest it into the system. This beheavior signals over time would theoretically give us a good indication of what this person is like. We also do neutral question callibration prompts that do the same shit. If they are done on the same day this gives us an additional signal, delta between calibrations and sessions which coul dprove interesting. Every prompt submmitted we pass all the signals to an LLM and have it generate supressed questions which are designed to figure out what is the best possible question to get to this person or something and we have it weight as charitable, mundane, or avoidant based on research. we then have the llm make a prediction on that. the prediction is independelty graded so the path is not circular. hopefully by the end we will have such a good corpus of this person we will accurately be able to pick deviations in this persons cognitive ability which could allow us to test for sickness, improvement in function, mental health changes... and a bunch of other shit. could also possibly allow us to validate pharma tests through behavior mechanisms rather than intervention. so yeah stuff like that. we think it's novel and dope.


---

# CLAUDE COMMENTARY — METRICS CONSIDERED AND REJECTED

The following NLP-derived features appear frequently in the dementia-language literature and were evaluated for inclusion in the signal pipeline. Each was rejected on evidence grounds. This section belongs somewhere in the methodology or signal design discussion — it preempts the reviewer question "why didn't you use X?" and demonstrates that the pipeline's signal choices are deliberate, not naive.

## Honore's Statistic (hapax legomena)
Honore's H measures vocabulary productivity by counting words used only once in a text. It appears in nearly every large-feature-set NLP-dementia paper (e.g., Fraser, Meltzer & Rudzicz 2016, University of Toronto, 370+ features, DOI: 10.3233/JAD-150520). However:
- Standalone discriminant power is negligible: AUC ~0.55–0.65 for AD vs. healthy controls when isolated.
- Its theoretical advantage over type-token ratio (length independence) is achieved more reliably by MATTR, which the pipeline already implements.
- No study has demonstrated statistically significant incremental discriminant power of Honore's H beyond MATTR in a controlled comparison.
- The formula (H = 100 * log(N) / (1 - V1/V)) is mathematically unstable on short texts — when most words are hapax (common in journal entries under ~300 tokens), the denominator approaches zero and the statistic explodes (Tweedie & Baayen 1998).
- Not used in any clinical or production cognitive assessment tool.
- Verdict: feature-set passenger. It persists in the literature because it has a 1979 citation pedigree and is trivial to compute, not because it independently discriminates.

## Mean Dependency Distance (MDD)
MDD measures syntactic complexity by computing the average distance between grammatically related words in a dependency parse tree. The theoretical chain is sound: cognitive decline → reduced working memory → simpler syntax → lower MDD. Each link is individually well-established (Gibson 2000, MIT; Futrell, Mahowald & Gibson 2015, PNAS, DOI: 10.1073/pnas.1502134112). However:
- No published study reports effect sizes or AUCs for MDD in isolation as a cognitive decline predictor. It appears buried in feature sets of 50–400 features in machine learning pipelines.
- Simpler syntactic measures (mean sentence length, idea density, clausal density) consistently outperform dependency-based complexity metrics in the dementia-NLP literature.
- Requires dependency parsing infrastructure. Parser accuracy degrades on informal text and cognitively impaired language — the risk of measuring parsing errors rather than cognition is real and documented (Roark et al. 2011, OHSU, DOI: 10.1109/TASL.2011.2112351).
- No longitudinal study has tracked MDD over time in a dementia cohort.
- Not used in any clinical or production cognitive assessment tool.
- Verdict: theoretically motivated but empirically unvalidated. The argument for MDD is deductive, not evidential.

## Noun/Verb Ratio
The claim that cognitive decline shifts language toward more nouns and fewer verbs is not supported by the Alzheimer's literature — in typical AD, the dominant finding is the reverse. Noun retrieval is impaired first because nouns depend more heavily on semantic memory in the temporal lobe, where AD pathology typically begins (Goodglass, Boston University/VA; Lambon Ralph & Patterson, Cambridge; Mesulam's PPA classification, Northwestern).
- The robust verb-specific deficit is real but specific to nonfluent/agrammatic primary progressive aphasia (PPA) — a rare syndrome (~3–4 per 100,000), not general cognitive decline.
- Effect direction is inconsistent across conditions: typical AD shows noun deficits first, agrammatic PPA shows verb deficits, semantic PPA shows noun deficits, general MCI shows inconsistent results.
- In freeform journal text without controlled elicitation (e.g., Cookie Theft picture description), the ratio reflects topic and communicative intent, not cognitive capacity. An entry about a walk vs. an entry about loneliness will produce different noun/verb distributions regardless of cognition.
- Does not survive feature selection when combined with lexical diversity and syntactic complexity measures.
- Not used in any clinical or production cognitive assessment tool.
- Verdict: the underlying signal is not grammatical class but semantic retrieval specificity — content words becoming more generic across both nouns and verbs. The real markers are lexical diversity decline and reduced propositional density, both of which the pipeline captures through other means.

## Note on Idea Density
One metric that emerged from this review as potentially worth future investigation is propositional density (idea density). The Nun Study (Snowdon et al. 1996, University of Kentucky, DOI: 10.1001/jama.1996.03530310034029) found that idea density in autobiographies written at age ~22 predicted Alzheimer's disease ~60 years later with 80% sensitivity and 86% specificity in an autopsy-confirmed subsample. This is the strongest longitudinal linguistic biomarker in the literature. It requires dependency parsing to automate (Sirts et al. 2017, Macquarie University), so it shares the infrastructure cost of MDD but has substantially stronger clinical validation. This is flagged as a candidate for future pipeline expansion, not current implementation.

---

# CLAUDE DRAFT — INTRODUCTION ONLY

Keystroke dynamics have emerged as one of the most promising modalities for digital cognitive biomarkers. Recent studies report striking results: flight time alone achieves 97.9% sensitivity for mild cognitive impairment detection (Kim et al. 2024), and writing process biomarkers reach AUC = 0.918 for community-based Alzheimer's screening, outperforming both MoCA and MMSE (Li et al. 2025). The appeal is obvious — a passive, repeatable, low-cost measure of cognitive function captured during natural computer use, with no clinician required.

But there is a problem that no published study has named directly. Every keystroke-cognition study targeting neurodegeneration has drawn its participants from a population born between 1939 and 1966 — people who encountered computers between the ages of 30 and 55, many of whom never achieved the typing automaticity required for keystroke timing to reflect cognitive processes rather than motor execution. The total number of participants across all published keystroke-cognition studies for neurodegeneration is fewer than 500. The sample sizes are small in part because researchers cannot recruit enough elderly people who type fluently enough for the signal to mean anything (Ntracha et al. 2020 reported that requiring 12 months of smartphone experience "resulted in a difficult recruitment process").

This is not a limitation to acknowledge in a methods section. It is a structural confound that changes how the field should interpret its own results. Keystroke dynamics can only serve as cognitive biomarkers when typing is automatic enough — estimated at roughly 40–50 WPM (Pinet et al. 2022; Yamaguchi & Logan 2014) — that variation in timing reflects word retrieval, sentence planning, and coherence monitoring rather than visual search for keys. Below this threshold, the measurement instrument is capturing motor skill, not cognition. The current research population is, by demographic inevitability, the worst population that will ever be studied for this purpose.

This paper argues three things. First, that the noisy and attenuated effect sizes reported in the current literature are conservative lower bounds on the technique's actual diagnostic power — artifacts of a generational confound, not evidence of a weak method. Second, that this confound is self-resolving on a known timeline: by 2035–2055, the 60–80 age demographic will consist of people who have typed daily for 20–40+ years, and the motor noise floor will drop dramatically. Third, that any cognitive assessment modality tied to a specific input technology has a finite validity window — a claim already demonstrated by the ongoing obsolescence of the clock-drawing test as analog clock literacy declines — and that only modality-agnostic approaches to cognitive assessment will survive successive generational technology shifts.

---

# CLAUDE COMMENTARY — THE THIRD ARGUMENT (NEW RESEARCH PARADIGM)

The draft introduction currently frames three arguments. There is a fourth that may be the most important — and it could either replace the third or stand alongside it.

## The argument

Every published keystroke-cognition study asks the same question: "does this person look impaired compared to healthy people?" That's the only question you can answer with a one-time lab visit, a Cookie Theft picture, and a population norm. The entire methodology — cross-sectional design, population-normed metrics, task-constrained elicitation — is shaped by the practical constraint that you get one session with each participant, maybe two.

The demographic shift doesn't just make those studies more accurate. It makes an entirely different kind of study possible for the first time.

Once you have someone typing fluently every day for years in a natural environment, you can ask: "does this person look different from themselves?" That question doesn't need Honore's Statistic or population norms. It needs a dense personal baseline and enough time to detect drift. The unit of analysis shifts from population comparison to intra-individual trajectory. The metrics shift from "is this score below the clinical cutoff?" to "is this person's behavioral signature deviating from their own rolling baseline?"

This is not an incremental improvement on existing methods. It is a paradigm change:

- **Cross-sectional → longitudinal**: one snapshot vs. thousands of data points over years
- **Population-normed → self-referential**: "compared to healthy average" vs. "compared to yourself six months ago"
- **Task-constrained → ecologically valid**: Cookie Theft description vs. daily naturalistic writing
- **Clinic-dependent → passive**: requires a clinician visit vs. captured during normal computer use
- **Diagnosis → early detection**: "you have MCI" vs. "your behavioral trajectory is shifting in a pattern consistent with early decline"

The metrics for this paradigm don't exist yet because nobody has the data to develop them on. You cannot build intra-individual longitudinal baselines from a 45-minute lab session with 23 participants who hunt-and-peck on a touchscreen. You need dense, daily, fluent data from the same person over years. The population that can produce that data at the age where cognitive decline becomes relevant does not yet exist — but it will, on the timeline this paper identifies.

## Where this fits in the paper

This could be structured as a progression:

1. **The confound** — current effect sizes are artificially attenuated (the critique)
2. **The timeline** — the confound self-resolves by 2035–2055 (the forecast)
3. **The paradigm shift** — resolution enables intra-individual longitudinal methods that don't exist yet (the opportunity)
4. **The instrument gap** — no existing tool combines process + content + longitudinal capture; the instrument must be built before the cohort arrives (the call to action / grant pitch)

The modality-agnostic argument (CDT obsolescence) could fold into this as a design constraint on the instrument rather than standing as a separate thesis point — the instrument must survive input modality shifts because the longitudinal data is only valuable if collection doesn't break when keyboards are eventually replaced.

## Why this matters for the grant

The grant pitch becomes: "We are not proposing to run the same studies better. We are proposing to build the instrument that makes a fundamentally new class of study possible — and the window to build it is now, before the first cohort of lifelong fluent typists reaches the age of cognitive decline risk."

That's a stronger ask than "let us correlate keystroke features against MoCA scores in a pilot study." The pilot study is Aim 2 — it validates the instrument using current methods. But the significance section should make clear that the real payoff is what becomes possible after that.