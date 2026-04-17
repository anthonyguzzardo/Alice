# Theory 6: The Demographic Choke Point — Why Keystroke Biomarkers Are Being Evaluated on the Worst Possible Population

**Date:** 2026-04-14
**Predecessor:** Theory 5 (Viability Assessment). This document isolates a structural argument that cuts across all three build types: the current elderly population is the worst possible population for keystroke-based cognitive biomarkers, and this limitation is self-resolving on a known timeline.

---

## The Thesis

Every keystroke-cognition study published to date shares a confound that no one has named: **the populations being studied for neurodegeneration learned to type in middle age or not at all.** This means the research community is evaluating the most promising digital cognitive biomarker modality on the generation least suited to produce clean signal through it.

This isn't a limitation to acknowledge in a methods section. It's a structural argument about timing — one that changes how the entire field should interpret its own results, and one that creates a window for the instrument that gets built now.

---

## The Evidence

### 1. Who Has Been Studied

Every keystroke-cognition study for cognitive decline or neurodegeneration uses participants aged 60-87 — people born between 1939 and 1966. Here is the complete landscape:

| Study | Population | Mean/Median Age | n | Typing Requirement |
|-------|-----------|----------------|---|-------------------|
| Meulemans et al. 2022 (Antwerp) | AD continuum vs controls | Median 74 (range 62-87) | 30 | None stated |
| Van Waes et al. 2017 (Antwerp) | Young + elderly + AD | Elderly groups ~50+ | 52 | None stated |
| neuroQWERTY 2016 (MIT) | PD vs controls | ~59-61 | 85 | 30+ min daily computer use |
| neuroQWERTY 2018 (MIT) | PD vs controls | ~60 | 52 | 30+ min daily computer use |
| Vizer & Sears 2015 | PreMCI vs NCI | ~79-81 | 35 | 1+ year typing experience |
| Ntracha et al. 2020 | MCI vs controls | 60-75 | 23 | 12+ months smartphone use |
| Li et al. 2025 | MCI-AD vs controls | Elderly (unspecified) | 72 | Touchscreen (not keyboard) |
| Holmes et al. 2022 | Cognitively impaired vs normal | ~71-74 | 77 | None (acknowledged exclusion risk) |
| Hossain et al. 2021 | Cognitive impairment levels | 50-65 | 33 | None stated |
| BiAffect 2020 (UIC) | General population (mood) | ~38 (range 20-70+) | 250 | Smartphone ownership |
| Hernandez et al. 2026 | General US panel | ~52 (computer) | 10,613 | Computer/smartphone ownership |

**Total participants across all keystroke-cognition studies targeting neurodegeneration: fewer than 500.** The sample sizes are small partly because researchers cannot recruit enough elderly people who type fluently enough for the signal to mean anything.

Ntracha et al. (2020) reported this directly: requiring 12+ months of smartphone experience as an inclusion criterion "resulted in a difficult recruitment process." The exclusion criterion reveals the problem.

### 2. Why Typing Proficiency Matters — The Automaticity Threshold

Keystroke dynamics can only serve as a cognitive biomarker when typing is automatic enough that variation in timing reflects cognitive processes (word retrieval, sentence planning, emotional arousal) rather than motor execution of the typing task itself. Below this threshold, keystroke timing is noise.

The evidence for this is convergent across multiple research traditions:

**Yamaguchi & Logan (2014):** Fluent typists represent words as integrated motor programs, chunked at the word level. Non-fluent typists represent them at the letter level. This is a qualitative difference — the keystroke timing patterns from a hunt-and-peck typist are measuring a fundamentally different cognitive process than from someone who types automatically. A fluent typist's inter-key interval reflects lexical retrieval. A non-fluent typist's inter-key interval reflects visual search for the next key.

**Pinet, Zielinski, et al. (2022):** Keystroke timing reflects lexical and sublexical processes, but only when typing is automatic enough that motor execution is not the bottleneck. The threshold appears to be roughly 40-50 WPM — below this, the motor task itself consumes attentional resources that compete with the cognitive signal.

**Medimorec & Risko (2017):** Typing speed affects the complexity of language produced. Slower typists produce simpler syntactic structures. This means that if you're measuring linguistic complexity as a cognitive biomarker, you might be measuring typing skill instead. The measurement instrument is contaminated by the very fluency it requires.

**Salthouse (1984):** Skilled older typists compensated for slower reaction times by looking further ahead in text — they used anticipation to maintain speed. This is critical: experienced older typists are not simply slower versions of young typists. They have qualitatively different strategies. This means **cohort effects** (never learned to type fluently) and **aging effects** (slowing from a fluent baseline) are fundamentally different phenomena being collapsed together in every study.

**Alves et al. (2008) and the Hayes & Flower model:** Transcription fluency (including typing) is a bottleneck in the writing pipeline. When typing is effortful, it competes with higher-level processes — planning, translating thoughts to language, monitoring coherence. The writing-process biomarker signal depends on the cognitive pipeline being the bottleneck, not the motor channel.

### 3. When Each Generation Learned to Type

| Current Age (2026) | Born | First Regular Typing | Context | Estimated Fluency |
|---|---|---|---|---|
| 75+ | <1951 | Age 40-50+ if at all | Typing was secretarial. Many never became fluent. | Very low / absent |
| 65-74 | 1952-1961 | Age 30-45 | Encountered PCs in workplace in late 80s/90s. Learned as adults. | Low to moderate |
| 55-64 | 1962-1971 | Age 20-35 | Early internet adopters. Some workplace email in their 20s. | Moderate |
| 45-54 | 1972-1981 | Age 15-25 | Oregon Trail / AOL generation. Social typing (IM) in teens-20s. | Moderate to high |
| 35-44 | 1982-1991 | Age 10-18 | AIM/MSN generation. Typing embedded in social life from adolescence. | High |
| 25-34 | 1992-2001 | Age 8-14 | Digital natives. Typing embedded in schoolwork and social life from childhood. | Very high |

**Supporting data for these estimates:**

- US Census Bureau: Home computer ownership went from ~8% in 1984 to ~36% in 1997 to ~62% in 2003 to ~77% in 2010.
- Pew Research: By 2000, ~51% of US households had a computer. By 2010, ~77%.
- Windows 95 (1995) + consumer internet (AOL, Hotmail 1996, Yahoo Mail 1997) was the inflection point for mass keyboard adoption.
- NCES data: By the early 2000s, ~95%+ of US public schools had internet access, but formal "keyboarding" instruction was inconsistent across districts.
- PARCC and Smarter Balanced assessments (2014-15) required students to type essays, forcing many districts to teach keyboarding by 3rd-4th grade.

The current elderly population (65-85, born 1941-1961) encountered computers between ages 30 and 55. Many never achieved the automaticity threshold. The population that will be 65-85 in 2040-2060 (born 1955-1995) grew up with keyboards. The shift is not gradual — it is a generational cliff.

### 4. What the Literature Says About This

Almost nothing. That's the point.

**Papers that acknowledge the limitation:**

**Meulemans, Leijten, Van Waes et al. (University of Antwerp, 2022):** The most direct acknowledgment. One sentence: "the group of computer-literate elderly is continuously growing." This is embedded in a discussion section, not elevated to a structural argument. The implication — that current results are conservative estimates of the technique's potential — is not drawn.

**Ntracha et al. (2020):** Reported that requiring smartphone experience "resulted in a difficult recruitment process." This is a practical observation, not a theoretical argument. The paper does not discuss what this means for the technique's future validity.

**Kalman, Kave & Umanski (2015):** Explicitly acknowledged that older adults were "accustomed to writing primarily by hand (or possibly typing on a typewriter)" and that they "could not use statistical means to control for the differential ratio between handwriting and typing" across generations. The most honest statement of the confound, but again limited to a methods caveat.

**Viviani, Liso & Craighero (2025):** The most theoretically sophisticated observation: "older individuals have primarily established their sensorimotor repertoires through interaction with the physical world, while younger generations have formed theirs by acting concurrently in both physical and digital environments." They noted that whether mobile typing involves adaptation of existing motor patterns or de novo learning is "particularly relevant across generations with differing early sensorimotor experiences." But they did not connect this to biomarker validity.

**Holmes et al. (2022):** Acknowledged that device requirements "might exclude some subjects." One sentence.

**Alfalahi et al. (2022, systematic review):** Called for "future clinical trials...in other populations, with possibly lower education level and smartphone usage." This frames the issue as geographic/socioeconomic rather than generational.

**Papers that should exist but don't:**

- No paper explicitly argues that future elderly cohorts who grew up typing will produce better keystroke biomarker signal.
- No paper frames the current noisy results as a conservative lower bound on the technique's diagnostic power.
- No paper proposes a temporal demographic model of keystroke biomarker validity.
- No meta-analysis partitions effect sizes by participant typing proficiency.

### 5. The Three Compounding Problems

The demographic choke point creates three distinct threats to current research validity, and all three operate simultaneously:

**A. Signal validity.** For participants below the automaticity threshold (~40-50 WPM), keystroke dynamics are primarily measuring motor skill, not cognition. Inter-key intervals reflect visual search for keys and finger coordination, not lexical retrieval or sentence planning. The cognitive signal is buried under motor noise. Effect sizes in current studies are therefore attenuated — the technique looks weaker than it actually is.

**B. Selection bias.** Studies that require computer or smartphone proficiency (neuroQWERTY: 30+ min/day; Ntracha: 12+ months; Vizer & Sears: 1+ year experience) automatically exclude the least fluent elderly participants. Those excluded participants may differ systematically on cognitive reserve, education, socioeconomic status, and occupational complexity — all of which independently predict dementia risk. The studied population is not representative of the target clinical population.

**C. Confounding.** Typing proficiency correlates with education, SES, occupational complexity, and cognitive reserve. Any correlation between keystroke patterns and cognitive decline may be partly or wholly driven by these confounds rather than by the cognitive biomarker itself. Current studies cannot cleanly separate "types slowly because of cognitive decline" from "types slowly because they never learned."

### 6. The Ironic Inversion — DCTclock and Clock Obsolescence

Linus Health raised $64.9M to build a digital cognitive biomarker platform around the clock-drawing test. Their innovation is genuinely good — process analysis at 12ms resolution, decomposed into information processing, motor, spatial, and efficiency domains. But the clock-drawing test faces its own demographic obsolescence from the opposite direction.

**Key finding (Journal of the Neurological Sciences, 2024):** "The clock drawing test (CDT) in the digital era: Underperformance of Generation Z adults." Gen Z participants (mean age 19.7) averaged only 8.1/10 on CDT despite normal cognition. 25% of participants aged 18-30 scored below expected range. In the UK, 22% of 18-24 year-olds reported struggling to read an analog clock. The errors reflect reduced exposure to analog time formats, not cognitive dysfunction.

**A 2025 bibliometric analysis** titled "Has the Clock Drawing Test been left aside with the replacement of analog clocks by smartphones?" concluded the CDT faces "the beginning of the end" as smartphone-native generations age, with impacts becoming apparent "in 20 to 30 years."

**Education bias compounds this:** A systematic review found education positively influenced CDT performance in 76.6% of analyses. Illiterate individuals' CDT performance was similar to elderly with Alzheimer's dementia. Linus Health had to build FaIRClocks specifically to mitigate AI classifier bias against people with less than 8 years of education.

The writing modality does not have these problems:
- Everyone who will be 70 in 2050 knows how to write.
- Writing fluency increases with education — the same direction as the demographic shift.
- The task itself (compose reflective text) does not depend on culturally contingent knowledge like analog clock reading.
- Writing is simultaneously measurement and intervention (Pennebaker & Beall 1986). Clock drawing is not.

The clock-drawing test gets worse as the population gets more digital. Writing-based assessment gets better. The demographic tailwind is modality-specific, and it favors writing.

---

## The Timeline

### The Transition Window (2026-2040)

**Now (2026):** The research population (65-85, born 1941-1961) has the lowest typing fluency of any cohort that will ever be studied for neurodegeneration. Current studies are producing attenuated effect sizes on small samples because the input channel is contaminated.

**2030-2035:** The 65+ population begins including people born after 1965 — the first cohort that used email in their 30s. Typing proficiency in the target demographic starts rising meaningfully. Recruitment for keystroke-cognition studies becomes easier. Effect sizes should increase as motor noise decreases.

**2040:** 70-year-olds were born ~1970. They hit Windows 95 at age 25. Most will have 20-40 years of daily typing experience. The automaticity threshold will be cleared for the vast majority. This is when keystroke biomarker research should produce dramatically cleaner results.

**2050:** 70-year-olds were born ~1980. The AIM/MSN generation. Typing has been automatic for 50+ years. Keystroke cognitive assessment reaches peak validity — the population and the technique are finally aligned.

**Caveat for 2060+:** 70-year-olds born after 1990 may type less on physical keyboards (touchscreen generation). The input modality may need to adapt. But the core principle — that digital text production is automatic for this cohort — remains.

### What This Means for Instrument Timing

The instrument that gets built now — during the transition window — has a structural advantage:

1. **It validates the pipeline on the hardest population.** If the signal pipeline shows discriminative power on current 65-85 year-olds (low typing fluency, high motor noise), the effect sizes will only improve as the population shifts. Results published now are conservative lower bounds.

2. **It builds the evidence base during the academic validation window (2026-2035).** Papers published in this period establish the methodology, the signal registry, and the analytical framework. By the time the first generation of lifelong typers enters the risk window, the science is ready.

3. **It occupies the position before the opportunity becomes obvious.** Right now, the noisy results on current populations make keystroke biomarkers look like a marginal improvement over existing tools. This suppresses competitive entry. When the demographic shift makes the signal clean, the instrument that already has 10+ years of validated methodology owns the field.

The science and the demographic arrive at the same time. The instrument must arrive first.

---

## The Competitive Implication

No existing player is positioned for this shift, because no one has framed it as a shift.

**nQ Medical (neuroQWERTY):** FDA Breakthrough Device Designation for Parkinson's motor detection via keystroke dynamics. Dormant since ~2022. Motor-only (discards all text content). Even if revived, the motor-to-cognitive pivot would require a fundamental product redesign.

**Linus Health (DCTclock):** $64.9M raised for clock-drawing process analysis. The most analogous process-over-output approach. But the clock-drawing modality is depreciating (Gen Z analog clock illiteracy), while writing is appreciating. Linus Health's acquisition pattern (drawing + gait + speech + intervention) suggests they recognize they need additional modalities. Writing is the gap in their platform.

**Cambridge Cognition (Winterlight):** Acquired speech-based linguistic biomarkers for 7M GBP. Analyzes spoken language for cognitive decline. Speech and writing are complementary but distinct modalities — speech captures phonological and acoustic signals; writing captures revision, deletion, production fluency, and compositional cognition. Cambridge Cognition has the linguistic biomarker thesis but not the writing modality.

**Cogstate:** $53.1M revenue from reaction-time card-based assessments for pharma trials. No language modality at all. The Medidata partnership (800+ salespeople) gives them massive distribution. A writing-based endpoint would be complementary, not competitive.

**BiAffect (UIC):** Smartphone keystroke dynamics for mood (bipolar disorder). Explicitly discards text content. Young population (mean ~38). No neurodegeneration focus.

**Inputlog (University of Antwerp):** The incumbent in writing-process research. Windows-only, single-session, no content analysis, no longitudinal tracking. Van Waes is now Professor Emeritus. No next-generation successor announced.

**The gap:** Zero commercial products combine keystroke process dynamics with linguistic content analysis in a longitudinal framework. The only academic work that has done both (Meulemans et al. 2022, Antwerp) was cross-sectional with 30 participants. Nobody is building the longitudinal writing-process instrument, and nobody has articulated why the timing is right.

---

## The Argument That Should Be Made

The whitepaper — and any grant application, conference presentation, or investor pitch — should make this argument explicitly:

1. **Keystroke-based cognitive biomarkers require typing automaticity.** Below the automaticity threshold (~40-50 WPM), keystroke dynamics reflect motor execution, not cognition. The signal is contaminated.

2. **The current research population is below this threshold.** People born before 1960 learned to type in middle age or not at all. Current studies (n < 500 total across all published work) are evaluating the technique on the generation least suited to produce clean signal.

3. **This is a cohort effect, not an intrinsic limitation.** The technique is not fundamentally weak. It is being measured at its worst. Negative or noisy results from current studies should not be taken as evidence that the approach is flawed.

4. **The effect sizes will improve as a demographic inevitability.** By 2040, the 65+ population will consist of people who have typed daily for 20-40+ years. The motor noise floor drops. The cognitive signal emerges. This is not a prediction that requires a leap of faith — it follows from the computer adoption curve.

5. **The instrument that validates now owns the field later.** Results published on current populations are conservative lower bounds. The methodology established during the transition window becomes the standard against which future, cleaner results are interpreted. First-mover advantage in academic methodology is durable (LIWC: 20+ years, 200K+ citations; Inputlog: 15+ years, 1,000+ researchers).

6. **Writing is the modality that survives the generational transition.** Clock drawing is depreciating (analog clock illiteracy). Reaction-time tasks are culturally brittle. Speech analysis requires controlled environments. Writing scales with digital fluency — the same fluency that is increasing in every subsequent cohort.

This argument has not been made in the published literature. It would be a genuine intellectual contribution — not just marketing, but a reframing that changes how the field interprets its own results.

---

## What This Theory Changes

Theories 1-5 asked "what could this be?" and "what's the path?" This theory adds a temporal dimension: **why now, and why the timing gets better.**

- **For the instrument path (Theory 5, Build Type 1):** The whitepaper's opening argument. "We are building the successor to Inputlog at the moment when the target population is about to undergo a generational shift in digital fluency. Current results are conservative. The signal gets cleaner every year."

- **For the clinical path (Theory 5, Build Type 3):** The grant application's significance section. "NIA funds digital biomarkers aggressively (10 SBIR awards FY2024-2025). No funded project addresses the demographic confound in keystroke-cognition research. This proposal establishes the methodology during the transition window."

- **For the consumer product (Theory 5, Build Type 2):** The retention thesis. The 45-55 year-olds who start journaling now will be the first generation with 20+ year personal cognitive trajectories when they enter the risk window. The product's retention moat is also its clinical value proposition.

- **For the competitive landscape:** This argument is a barrier to entry. Once published, it frames Alice's methodology as forward-looking rather than niche. Competitors who enter later must contend with a decade of published validation and an established methodology — both of which appreciate as the population shifts.

- **For the roadmap:** The demographic tailwind is the missing structural argument underneath the sequencing. Phase 1 (instrument) works because the science validates during the transition window. Phase 3 (consumer product with clinical anchor) works because the first lifelong-typer cohort enters the risk window with 20 years of personal baseline data. The flywheel isn't just revenue-driven. It's demographic.

---

## Citations

### Keystroke Dynamics and Cognition
- Meulemans, C., Leijten, M., Van Waes, L., Engelborghs, S., & De Maeyer, S. (2022). Cognitive writing process characteristics in Alzheimer's disease. *Frontiers in Psychology*, 13:878312. PMC9311409.
- Van Waes, L., Leijten, M., Marien, P., & Engelborghs, S. (2017). Typing competencies in Alzheimer's disease. *Computers in Human Behavior*, 73:311-319.
- Giancardo, L., et al. (2016). Computer keyboard interaction as an indicator of early Parkinson's disease. *Scientific Reports*, 6:34468.
- Arroyo-Gallego, T., et al. (2018). Detecting motor impairment in early Parkinson's disease via natural typing interaction. *JMIR*, 20(3):e89.
- Vizer, L. M., & Sears, A. (2015). Classifying text-based computer interactions for health monitoring. *IEEE Pervasive Computing*, 14(4):64-71.
- Ntracha, A., et al. (2020). Detection of mild cognitive impairment through natural language and touchscreen typing processing. *Frontiers in Digital Health*.
- Holmes, J., et al. (2022). A novel framework to estimate cognitive impairment via finger interaction with digital devices. *Brain Communications*, 4(4):fcac194.
- Hossain, M., et al. (2021). Detecting cognitive impairment status using keystroke patterns. *Journal of Healthcare Engineering*.
- Hernandez, R., et al. (2026). Functional and cognitive correlates of typing speed in a large U.S. panel study. *Scientific Reports*, 16:5900.
- Alfalahi, H., et al. (2022). Diagnostic accuracy of keystroke dynamics as digital biomarkers for fine motor decline. *Scientific Reports*. (Systematic review and meta-analysis.)

### Typing Automaticity and Cognitive Load
- Yamaguchi, M., & Logan, G. D. (2014). Pushing typists back on the learning curve. *Journal of Experimental Psychology: Human Perception and Performance*, 40(2):592-612.
- Pinet, S., Zielinski, C., et al. (2022). Typing expertise in a large student population. *Cognitive Research: Principles and Implications*, 7:77.
- Medimorec, S., & Risko, E. F. (2017). Effects of disfluency in writing. *British Journal of Psychology*, 108(1):40-57.
- Salthouse, T. A. (1984). Effects of age and skill in typing. *Journal of Experimental Psychology: General*, 113(3):345-371.
- Alves, R. A., et al. (2008). Influence of typing skill on pause-execution cycles in written composition. *Contemporary Educational Psychology*, 33(4):677-692.
- Logan, G. D. (2018). Automatic control: How experts act without thinking. *Psychological Review*, 125(4):453-485.
- Bosman, E. A. (1993). Age-related differences in the motoric aspects of transcription typing skill. *Psychology and Aging*, 8(1):87-102.

### Demographic and Generational Shift
- Viviani, G., Liso, L., & Craighero, L. (2025). Mobile typing as a window into sensorimotor and cognitive function. *Brain Sciences*, 15(10):1084.
- Kalman, Y. M., Kave, G., & Umanski, D. (2015). Writing in a digital world: Self-correction while typing in younger and older adults. *International Journal of Environmental Research and Public Health*, 12(10):12723-12736.
- Vesel, C., et al. (2020). Effects of mood and aging on keystroke dynamics metadata. *JAMIA*, 27(7):1007-1018. (BiAffect.)
- Ceolini, E., et al. (2022). Temporal clusters of age-related behavioral alterations captured in smartphone touchscreen interactions. *iScience*.
- Blanka, T., et al. (2025). Technology use and cognitive aging meta-analysis. *Nature Human Behaviour*.

### Clock-Drawing Test Demographic Obsolescence
- CDT in the digital era: Underperformance of Generation Z adults. (2024). *Journal of the Neurological Sciences*.
- Has the Clock Drawing Test been left aside with the replacement of analog clocks by smartphones? (2025). PMC11927938. (Bibliometric analysis.)
- Generational differences in Clock Drawing Test performance. (2025). PMC12912772.
- Effects of education, literacy, and dementia on CDT performance. (2010). *International Journal of Geriatric Psychiatry*. (Systematic review.)
- FaIRClocks: Mitigating classifier bias. (2024). *Scientific Reports*.
- Digital clock assessment in South Asian setting. (2025). *npj Dementia*.

### Longitudinal Writing and Cognition
- Snowdon, D. A., et al. (1996). Linguistic ability in early life and cognitive function and Alzheimer's disease in late life. *JAMA*, 275(7):528-532.
- Lancashire, I., & Hirst, G. (2011). Longitudinal detection of dementia through lexical and syntactic changes in writing. *Proceedings of the Workshop on Computational Linguistics and Clinical Psychology*, ACL.
- Pabst, A., & Tagliamonte, S. (2020). A diary-based study of language use during cognitive decline. *University of Toronto Working Papers in Linguistics*.
- Norton, M. C., et al. (2017). Cache County journal study. *Journals of Gerontology: Series B*, 72(6):991-995.
- Clarke, K. M., et al. (2025). Nun Study 30-year follow-up. *Alzheimer's & Dementia*.

### Writing Process and Cognitive Pipeline
- Chenoweth, N. A., & Hayes, J. R. (2001). Fluency in writing. *Written Communication*, 18(1):80-98.
- Faigley, L., & Witte, S. (1981). Analyzing revision. *College Composition and Communication*, 32(4):400-414.
- Pennebaker, J. W., & Beall, S. K. (1986). Confronting a traumatic event. *Journal of Abnormal Psychology*, 95(3):274-281.
- Pennebaker, J. W., & Stone, L. D. (2003). Words of wisdom: Language use over the life span. *Journal of Personality and Social Psychology*, 85(2):291-301.

### Market Context
- Li, S., et al. (2025). Writing process digital biomarkers for community cognitive screening. *Frontiers in Computational Neuroscience*.
- Linus Health Series B: $55M (2022). Total raised: ~$64.9M.
- Cogstate FY2025: AUD $53.1M revenue (+22% YoY).
- Cambridge Cognition: Winterlight Labs acquisition, 7M GBP (Jan 2023).
- nQ Medical: FDA Breakthrough Device Designation (Feb 2020). De Novo submitted March 2022. No clearance announced.
