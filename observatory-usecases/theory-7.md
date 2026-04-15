# Theory 7: The Three Survival Constraints — Why the Instrument Must Be Modality-Agnostic, Process-First, and Payment-Ready

**Date:** 2026-04-14
**Predecessor:** Theory 6 (The Demographic Choke Point) and its Appendix (Internet Landscape Scan). Theory-6 established *when* — the demographic tailwind and the transition window. This theory establishes *what shape the instrument must take* to survive the structural forces that have already killed >$1.8B in digital health value.

---

## The Thesis

Three structural forces constrain the design of any writing-based cognitive instrument. Each one has destroyed companies or invalidated clinical tools within the past three years. They are not risks to mitigate — they are load-bearing walls that the instrument's architecture must be built around.

**1. Modality Decay.** Every cognitive assessment tool tied to a specific technology or cultural artifact becomes invalid through demographic shift. The clock-drawing test is failing now. Keyboard-based assessment will fail next. The instrument must capture the cognitive act of composition independent of the input device.

**2. Process Over Product.** Large language models miss 60-70% of dementia cases because they equate verbal fluency with cognitive health. Content analysis alone is insufficient. The diagnostic power is in the *process* of producing text — pauses, revisions, timing, production fluency — not in the text itself. An instrument that depends on content analysis will miss the patients who remain articulate while their cognitive processes degrade.

**3. Payment-Readiness.** Four digital health companies with FDA-authorized products and >$300M in combined capital have been destroyed since 2020 because they had no reimbursement pathway. The CMS ACCESS model launching July 2026 has no cognitive track. The instrument must enter through an existing payment door or shelter under a regulatory exemption — it cannot wait for a cognitive reimbursement category that does not exist.

These three constraints are independent. A modality-agnostic instrument that ignores reimbursement dies like Mindstrong. A payment-ready product that depends on content dies like a future LLM-based screening tool. A process-first keyboard-only instrument dies like the clock-drawing test. The instrument must satisfy all three simultaneously.

---

## Constraint 1: Modality Decay

### The Pattern

The clock-drawing test is the first cognitive assessment tool to be invalidated by demographic technology shift. It will not be the last.

**The CDT is failing now.** DeMessie et al. (2026) measured CDT error rates by generation: Gen Z 40%, Millennials 28.8%, Gen X 11%, Boomers 0%. After controlling for cognitive abilities (CogState battery), the generational effect *strengthened* — OR=28.66 (95% CI 3.39-242.42), p=.003. The effect is not cognitive. It is cultural. When tested with a digital clock format (writing four digits), 100% of Gen Z participants succeeded.

Kenneth Shulman, one of the CDT's original developers, acknowledged the problem but said: "It's still a useful test for the rest of my life. What happens after I'm gone is not my problem." This is the posture of an assessment that has accepted its own obsolescence.

A 2025 bibliometric analysis of 1,298 CDT studies concluded the test faces "the beginning of the end" as smartphone-native generations age, with impacts becoming apparent "in 20 to 30 years." In the UK, schools have removed analog clocks from examination rooms because students get stressed about time.

**Keyboard fluency is failing next.** Theory-6 identifies the current choke point: elderly who never learned to type. The internet scan surfaced the future choke point from the opposite direction:

| Year | Students Taking Keyboarding Courses |
|------|-------------------------------------|
| 2000 | 44% |
| 2019 | 2.5% |

Some students now type under 13 WPM on physical keyboards. 39% of student assignments were submitted via mobile devices in 2024. Gen Z is described as "typing adverse" — fluent at touchscreen thumb-typing, unfamiliar with physical keyboards.

Viviani, Liso & Craighero (2025) provide the theoretical framework: "Digital Natives" and "Digital Immigrants" develop fundamentally different sensorimotor repertoires. Older individuals adapted existing physical-world motor patterns to keyboards. Younger generations formed theirs through concurrent physical and digital engagement, producing "qualitatively distinct motor control strategies."

**The general principle:** Any cognitive assessment tool whose validity depends on the user's proficiency with a specific technology will eventually be invalidated as generational technology exposure shifts. The CDT assumed everyone knows analog clocks. Keyboard biomarkers assume everyone types on keyboards. Handwriting assessments assume everyone writes by hand. Touchscreen assessments assume everyone uses touchscreens.

Each assumption is true for some generations and false for others. None is permanently valid.

### The Invariant

What survives generational technology transitions? Not the input device. Not the cultural artifact. The cognitive act of **composition** — the process of forming coherent thought and externalizing it as text.

Every generation that will ever enter the neurodegeneration risk window will produce text. They will do it through keyboards, touchscreens, voice dictation, or whatever input channel succeeds these. The cognitive processes that underlie text production — word retrieval, sentence planning, coherence monitoring, revision — are not modality-dependent. They are the same whether you are typing, thumb-typing, swiping, or speaking.

A modality-agnostic instrument captures composition processes regardless of the input channel:

| Input Modality | What It Captures |
|----------------|-----------------|
| Physical keyboard | Hold time, flight time, inter-key interval, pause-burst patterns |
| Touchscreen keyboard | Tap pressure, flight time, autocorrect patterns, swipe dynamics |
| Voice dictation | Pause patterns, self-correction, reformulation, speech rate variability |
| Handwriting (stylus) | Stroke pressure, velocity, lift time, letter formation dynamics |
| All of the above | Word retrieval latency, revision frequency, compositional fluency, coherence structure |

The bottom row is the invariant. The process of producing text generates cognitive signal through any channel. The instrument must capture this invariant, not optimize for a single modality.

### Design Implication

The instrument's signal pipeline must separate **modality-specific features** (hold time on a physical key, swipe velocity on a touchscreen) from **modality-invariant features** (pause duration before low-frequency words, revision-to-production ratio, coherence degradation over session length). The modality-specific features are useful when available — they add motor signal on top of cognitive signal. But the instrument cannot *depend* on them. The core diagnostic signal must come from composition process features that survive modality transitions.

This is not a future-proofing exercise. It is a survival requirement. An instrument built today on keyboard-only features will face the same validity crisis as the CDT within 20-30 years as keyboard-illiterate generations age into the risk window.

---

## Constraint 2: Process Over Product

### The LLM Blind Spot

Zadok et al. (2026) tested whether humans and large language models can detect cognitive impairment from language. Using 514 Cookie Theft picture descriptions from the Pitt corpus, they found:

- Humans correctly identified 57% of dementia cases
- LLMs correctly identified 60% of dementia cases
- Both groups showed 65-70% false negative rates

The key finding: **"LLMs equate fluency with cognitive health."** When a person with dementia produces grammatically correct, semantically coherent speech, both humans and LLMs fail to detect the impairment. Verbal fluency masks cognitive decline.

This is not an LLM limitation that better models will solve. It is an inherent property of content analysis. Content captures *what* someone says. Cognitive decline often affects *how* they produce what they say before it affects the content itself. A person can retrieve correct words while their retrieval *process* slows. A person can produce coherent sentences while their planning *process* degrades. A person can write grammatically while their revision *process* becomes erratic.

Content is the last thing to go. Process is the first.

### The Process Evidence

Multiple independent research lines converge on process signals outperforming content signals for cognitive assessment:

**Keystroke process dynamics:**
- BiAffect (Ajilore et al. 2025): Typing entropy (process irregularity) correlated with executive function at Cohen's d = -1.28 (p=.005) and with planning task performance at r=0.59 (p=.006). The process metric — not content — captured cognitive function.
- Kim et al. (2024): Flight time (the interval between releasing one key and pressing the next — a pure process metric) achieved sensitivity 97.9%, specificity 94.7% for MCI detection. Outperformed MoCA-K (Youden Index 0.947 vs. 0.469).
- Meulemans et al. (2022): Alzheimer's patients spent 123.8 seconds longer on writing tasks, typed 108 fewer characters per minute, and showed higher proportions of pause time. Pauses >2 seconds reflect higher-order cognitive processes (planning, revision). The process signature was diagnostically discriminative even in a small sample (n=30).

**Handwriting process dynamics:**
- Toffoli et al. (2025): 106 handwriting *process* indicators (time, fluency, force, pen inclination) achieved classification accuracies of 0.80-0.93 for MCI detection. The product (what was written) was identical across groups — the process (how it was written) carried the diagnostic signal.
- Li et al. (2025): Writing process biomarkers achieved AUC=0.918 for community-based AD screening, outperforming MoCA (0.859) and MMSE (0.783). The process of producing text on a touchscreen discriminated better than standardized cognitive tests.

**The automaticity mechanism:**
- Salthouse (1984): Experienced older typists compensate for slower reaction times by looking further ahead in text — they use anticipation to maintain speed. This is a *process* adaptation invisible in the output product. Two typists can produce the same text at the same speed while using fundamentally different cognitive strategies. Only process measurement reveals the difference.
- Alves et al. (2008): Transcription fluency is a bottleneck in the writing pipeline. When typing is effortful, it competes with higher-level processes — planning, translating, monitoring. The constraint is visible in the process (pause patterns, burst length) but not in the product (finished text).

### The Two Silos

The internet scan confirmed a structural gap in the research landscape. Two research communities study overlapping phenomena from non-overlapping perspectives:

**Writing process researchers (Inputlog tradition):**
- Unit of analysis: sentence, paragraph, text
- Features: pause-burst patterns at linguistic boundaries, revision cycles, planning-to-translating ratios
- Theoretical framework: Hayes & Flower cognitive process model of writing
- Tool: Inputlog (Windows-only, single-session, no content analysis)
- Target: understanding writing cognition

**Medical keystroke dynamics researchers (BiAffect/neuroQWERTY tradition):**
- Unit of analysis: character, digraph, key
- Features: hold time, flight time, inter-key interval, pressure
- Theoretical framework: motor control and degradation
- Tool: custom keyboards/apps (discard text content)
- Target: detecting neurological disease

These communities rarely cross-reference. The writing researchers measure cognitive load through production fluency but don't study neurodegeneration. The medical researchers measure motor degradation through timing statistics but discard the linguistic context that would reveal *which* cognitive process is degrading.

The only published study that combined both perspectives is Meulemans et al. (2022, University of Antwerp) — cross-sectional, n=30, no longitudinal follow-up. No instrument exists that integrates linguistic-level process analysis with character-level dynamics in a longitudinal framework.

### Design Implication

The instrument must capture process at multiple granularities simultaneously:

| Granularity | Process Features | What They Reveal |
|-------------|-----------------|-----------------|
| Character-level | Hold time, flight time, inter-key interval | Motor execution, tremor, rigidity |
| Word-level | Pre-word pause duration, word retrieval latency | Lexical access, semantic memory |
| Sentence-level | Planning pause, within-sentence fluency | Syntactic planning, working memory |
| Revision-level | Deletion patterns, reformulation frequency | Self-monitoring, error detection |
| Session-level | Warm-up curve, fatigue slope, total output | Sustained attention, cognitive endurance |

Content analysis is not discarded — it is subordinated. Content features (vocabulary richness, syntactic complexity, semantic coherence) provide complementary signal. But the instrument cannot *depend* on content for its core diagnostic power, because content analysis misses the patients who remain articulate while their processes degrade.

The hybrid approach is validated: Zolnour et al. (2025, LLMCARE) found that combining transformer embeddings with 110 handcrafted linguistic features achieved F1=85.65, outperforming either approach alone. The handcrafted features correspond to process and structural metrics. The deep learning captures patterns humans don't specify. Neither is sufficient alone.

---

## Constraint 3: Payment-Readiness

### The Body Count

Four digital health companies with innovative technology and regulatory authorization have been destroyed since 2020. Each followed the same trajectory: raise capital → build product → achieve regulatory milestone → discover no one will pay for it → die.

| Company | Technology | Regulatory Status | Capital Raised | Outcome |
|---------|-----------|-------------------|----------------|---------|
| Mindstrong Health | Typing/scrolling patterns → mental health | None (claimed validation, published nothing) | $160M | Bankruptcy Feb 2023 |
| Pear Therapeutics | Prescription digital therapeutics | FDA-cleared (3 products) | Undisclosed (burned $35M/quarter) | Bankruptcy Apr 2023. Assets sold for $6.05M vs. $1.6B SPAC valuation |
| Akili Interactive | Video game for ADHD | FDA-authorized (EndeavorRx) | Undisclosed | Revenue: $1.2M. Loss: $59.5M. Sold for $34M (Jul 2024) |
| Proteus Digital Health | Ingestible sensor for medication adherence | FDA-approved | Hundreds of millions | Bankruptcy 2020 |

The combined value destruction exceeds $1.8B. The cause of death in every case was the same: **insurers would not pay.**

Mindstrong had the added failure of never publishing clinical trial results — five trials conducted, zero peer-reviewed publications. Its technology originated in surveillance/anti-piracy research (tracking hackers by typing fingerprint). MIT researcher Rosalind Picard noted: "I'm suspicious that a single modality like typing is going to be sufficient." The company's collapse is the field's defining cautionary tale.

But Pear is the more instructive failure. Pear had FDA-cleared products — actual regulatory authorization. It had a real clinical evidence base. It still died, because FDA clearance and CMS reimbursement are different systems with different timelines. You can get cleared to sell a product that no one is authorized to buy.

### The Current Payment Landscape

**Medicare cognitive assessment codes:**
- CPT 99483: Cognitive assessment and care plan services (available in-person and telehealth)
- CPT 96146: Automated psychological testing via electronic platform — **reimbursement rate: $2.26**
- CPT 96125: Standardized cognitive performance testing — can use computer-based platforms
- No CPT codes exist specifically for Digital Cognitive Assessments

**CMS TEMPO/ACCESS (launching July 2026):**

This is the most structurally significant development for digital health reimbursement. TEMPO is an FDA regulatory sandbox allowing non-FDA-authorized digital health devices to participate in the ACCESS payment model under enforcement discretion. ACCESS is a 10-year voluntary CMS model (July 2026-July 2036) covering four clinical tracks:

1. Early cardio-kidney-metabolic
2. Cardio-kidney-metabolic
3. Musculoskeletal
4. **Behavioral health (depression and anxiety)**

Participating organizations receive Outcome-Aligned Payments tied to measurable health outcomes. Primary care can bill $30/service quarterly for co-management.

**There is no cognitive health or dementia track.** A keystroke-based cognitive decline detector does not fit the current ACCESS clinical tracks.

**The depression/anxiety door:** Track 4 covers behavioral health. Depression is the closest existing reimbursement pathway to cognitive assessment. This is not accidental — depression and cognitive decline are comorbid in 30-50% of early dementia cases. An instrument positioned as a depression/anxiety monitoring tool that *also* captures cognitive process metrics enters through an existing payment door.

This is not regulatory arbitrage. It is clinical reality. Depression screening that includes cognitive process metrics is better depression screening. The cognitive signal is a feature, not a pivot.

**The ASAP Act:** Bipartisan legislation (H.R.6130/S.3267) creating Medicare coverage for FDA-approved blood biomarker screening tests for Alzheimer's. Over 50 House co-sponsors, 459+ endorsing organizations. This covers blood biomarkers (Fujirebio, Roche) — not digital/behavioral biomarkers. But it signals strong political will for Alzheimer's early detection coverage. A cognitive track in ACCESS could follow if the political momentum holds.

**The General Wellness exemption:** FDA Commissioner Makary's January 2026 guidance expanded what qualifies as a non-device wellness product. Non-invasive tools measuring physiological parameters can qualify as general wellness products rather than regulated devices, **provided they avoid disease claims.** A tool that passively monitors writing process patterns and positions itself as a "cognitive wellness" tracker — without claiming to detect, predict, or diagnose any disease — can shelter under this exemption.

The moment it claims to detect cognitive decline, it becomes a medical device.

### The Survivor's Payment Strategy

Cogstate provides the model. FY2025 revenue: AUD $53.1M (+22% YoY). Profitable, EBITDA margin 24.3%. Critical shift: 45% of contract value now comes from mood, sleep, and neurological disorders beyond Alzheimer's — nearly 6x increase. Cogstate did not wait for a cognitive assessment reimbursement category. It entered through clinical trials (pharma pays), then diversified into adjacent indications where payment already existed.

The instrument's payment strategy has three layers:

**Layer 1 — Research instrument (immediate).** Academic researchers pay for tools. Inputlog has served 1,000+ researchers for 15+ years. The successor to Inputlog generates revenue from day one through academic licensing. This is not large revenue — it is validation revenue. Every paper published using the instrument builds the evidence base.

**Layer 2 — Behavioral health monitoring (2026-2028).** The ACCESS behavioral health track covers depression and anxiety. An instrument that monitors writing process metrics for mood changes — using keystroke entropy (validated by BiAffect at d=1.28 for executive function), production fluency, and session-level engagement patterns — fits this track. The cognitive process signal is captured as a component of behavioral health monitoring, not as a standalone cognitive claim.

**Layer 3 — Cognitive assessment endpoint (2028+).** As the evidence base matures (published papers from Layer 1, clinical data from Layer 2), the instrument establishes the methodology for cognitive process assessment. When the political will that produced the ASAP Act extends to digital biomarkers — or when a cognitive track is added to ACCESS — the instrument has years of validated data and an established user base.

### Design Implication

The instrument must be designed so that its cognitive process signal is captured within a payment-authorized clinical context from day one. This means:

- Depression/anxiety monitoring as the initial clinical framing (ACCESS Track 4)
- Cognitive process metrics as embedded components of behavioral health assessment, not standalone cognitive claims
- No disease claims in the consumer-facing product (General Wellness exemption)
- Peer-reviewed publication of every validation study (the Mindstrong anti-pattern: five trials, zero publications)
- Clinical trial endpoint capability for pharma (the Cogstate model: pharma pays for validated digital endpoints)

---

## The Shape of the Survivor

Given all three constraints, the instrument that survives has specific architectural requirements:

### 1. Input-Agnostic Capture Layer

The instrument accepts text production through any input channel — physical keyboard, touchscreen, stylus, voice dictation. Each channel generates modality-specific features (hold time for keyboards, tap pressure for touchscreens, pause duration for voice). These features are captured when available but are not required.

Above the modality-specific layer sits a **composition process layer** that extracts modality-invariant features: word retrieval latency (estimated from pre-word pauses regardless of input), revision frequency, planning-to-execution ratio, coherence trajectory, session fatigue slope.

The instrument does not require the user to type on a keyboard. It requires the user to produce text.

### 2. Multi-Granularity Process Pipeline

The signal pipeline operates at five simultaneous granularities:

- **Motor** (character-level): timing, pressure, coordination — available when the input modality supports it
- **Lexical** (word-level): retrieval latency, frequency effects, semantic priming patterns
- **Syntactic** (sentence-level): planning pauses, complexity-adjusted fluency, clause coordination
- **Discourse** (paragraph/session-level): coherence maintenance, topic drift, structural organization
- **Longitudinal** (across sessions): personal baseline deviation, trajectory modeling, rate-of-change

Each granularity contributes independent diagnostic signal. Motor-level features detect Parkinson's and motor neuron disease. Lexical and syntactic features detect language-network degradation. Discourse features detect executive function decline. Longitudinal features detect progressive change against personal baseline.

Content analysis (vocabulary richness, semantic coherence, sentiment) operates as a parallel stream — useful but not load-bearing.

### 3. Payment-Compatible Clinical Framing

The instrument is positioned within the behavioral health monitoring framework from launch:

- **Consumer product:** "Cognitive wellness journal" — no disease claims, General Wellness exemption. Captures process metrics passively during reflective writing. Provides the user with engagement-based feedback (consistency, depth of practice) without clinical claims.
- **Clinical integration:** Behavioral health monitoring tool — depression/anxiety track. Process metrics (keystroke entropy, production fluency, session engagement) serve as behavioral health indicators. Cognitive process signals are embedded within this framing.
- **Research instrument:** Successor to Inputlog — academic licensing for writing process research. Generates publications that build the evidence base for cognitive process assessment.

The cognitive assessment claim emerges from the evidence base over time. It is not the starting position. It is the destination.

---

## What This Theory Changes

Theory-6 asked "why now?" Theory-7 asks "what shape must the thing take?"

- **For the instrument path (Theory 5, Build Type 1):** The successor to Inputlog must capture composition process, not just keystroke dynamics. It must work across input modalities. It must be designed so that research data generated by academic users contributes directly to clinical validation. The two-silo problem (writing process vs. medical keystroke) is not just a gap in the literature — it is the instrument's design specification. Build the bridge.

- **For the clinical path (Theory 5, Build Type 3):** The grant application now has a sharper significance section. No instrument captures multi-granularity composition process features in a modality-agnostic, longitudinal framework. The evidence base supports process over content for diagnostic sensitivity. The competitive landscape (Linus Health, Cogstate, Cambridge Cognition) has no writing modality. The clinical entry point is behavioral health monitoring (depression/anxiety comorbidity with cognitive decline), not standalone cognitive assessment.

- **For the consumer product (Theory 5, Build Type 2):** The product cannot make cognitive health claims. It is a reflective writing journal that captures process metrics passively. The General Wellness exemption requires no disease claims. The cognitive signal accrues invisibly — the user writes for depth; the instrument learns their cognitive signature. The 45-55 year-olds who start journaling now generate 20+ years of longitudinal process data before they enter the risk window. The data is the moat.

- **For the competitive landscape:** Linus Health optimizes for a depreciating modality (clock drawing). BiAffect discards text content and captures only motor-level process. Cambridge Cognition captures speech, not writing. Cogstate captures reaction time, not language production. Inputlog captures writing process but not clinical signal. No competitor integrates composition process, content analysis, and motor dynamics in a longitudinal, modality-agnostic framework. The design specification *is* the competitive advantage.

- **For the roadmap:** The three constraints impose sequencing. Layer 1 (research instrument) comes first because it generates the evidence base without requiring reimbursement or regulatory authorization. Layer 2 (behavioral health integration) comes second because the ACCESS Track 4 door opens July 2026. Layer 3 (cognitive assessment) comes third because it requires the evidence base from Layers 1 and 2 and a reimbursement category that does not yet exist. The sequence is not arbitrary — it is forced by payment infrastructure.

- **For survival:** The $1.8B graveyard is not a cautionary tale about bad execution. It is a structural lesson about market architecture. The companies that died were not incompetent. They built real technology, achieved real regulatory milestones, and still died because the payment infrastructure did not exist. The instrument must be designed for the payment infrastructure that *does* exist, not the one that *should* exist.

---

## Citations

### Modality Decay
- DeMessie, B., Tsapatsaris, A., Rudberg, L., Glajchen, S., Zimmerman, M. E., Lipton, R. B., & Lipton, M. L. (2026). Generational differences in clock drawing test performance. *J Int Neuropsychol Soc*, 32(2):177-183.
- CDT in the digital era: Underperformance of Generation Z adults. (2024). *Journal of the Neurological Sciences*.
- Has the Clock Drawing Test been left aside with the replacement of analog clocks by smartphones? (2025). PMC11927938. (Bibliometric analysis.)
- Viviani, G., Liso, L., & Craighero, L. (2025). Mobile typing as a window into sensorimotor and cognitive function. *Brain Sciences*, 15(10):1084.
- NCES data: Keyboarding course enrollment decline, 2000-2019.

### Process Over Product
- Zadok, M., Peled-Cohen, L., Calderon, N., Gonen, H., Beeri, M. S., & Reichart, R. (2026). Human and large language model judgments of cognitive impairment from language. *Alzheimer's & Dementia: Diagnosis, Assessment & Disease Monitoring*, 18(1):e70248.
- Ajilore, O., Bark, J. S., Demos, A. P., et al. (2025). Assessment of cognitive function in bipolar disorder with passive smartphone keystroke metadata. *Frontiers in Psychiatry*, 16:1430303.
- Kim, C., et al. (2024). MCI detection via keystroke hold time and flight time. *JMIR*, 26(1):e59247.
- Toffoli, S., Abbate, C., Lunardini, F., et al. (2025). Handwriting in mild cognitive impairment. *JMIR Aging*, 8:e73074.
- Li, S., Li, K., Liu, J., et al. (2025). Writing process digital biomarkers for community cognitive screening. *Frontiers in Computational Neuroscience*.
- Meulemans, C., Leijten, M., Van Waes, L., Engelborghs, S., & De Maeyer, S. (2022). Cognitive writing process characteristics in Alzheimer's disease. *Frontiers in Psychology*, 13:878312.
- Zolnour, A., et al. (2025). LLMCARE: Early detection of cognitive impairment via transformer models enhanced by LLM-generated synthetic data. *Frontiers in Artificial Intelligence*, 8:1669896.
- Salthouse, T. A. (1984). Effects of age and skill in typing. *Journal of Experimental Psychology: General*, 113(3):345-371.
- Alves, R. A., et al. (2008). Influence of typing skill on pause-execution cycles in written composition. *Contemporary Educational Psychology*, 33(4):677-692.

### The Reimbursement Graveyard
- Mindstrong Health: Bankruptcy February 2023. Total raised: $160M. Zero peer-reviewed clinical trial publications.
- Pear Therapeutics: Bankruptcy April 2023. Assets sold for $6.05M vs. $1.6B SPAC valuation.
- Akili Interactive: Sold July 2024 for $34M. EndeavorRx revenue: $1.2M, net loss: $59.5M.
- Proteus Digital Health: Bankruptcy 2020.
- STAT News. (2023). Mindstrong demise.
- STAT News. (2024). Digital therapeutics business model failures.
- MedTech Dive. (2024). Akili sale.

### Payment Infrastructure
- CMS TEMPO/ACCESS model. Federal Register, December 8, 2025.
- ASAP Act. H.R.6130/S.3267. Alzheimer's Association legislative briefing.
- FDA General Wellness + CDS guidance updates. January 6, 2026.
- Cogstate FY2025 earnings. AUD $53.1M revenue, EBITDA margin 24.3%.
- CPT 96146 reimbursement rate: $2.26. CMS Fee Schedule 2025.
- Rock Health. (2025). Year-end digital health funding: $14.2B.
- Rock Health. (2026). Q1 funding overview: $4B.

### Competitive Landscape
- Linus Health: Concurrent detection of cognitive impairment and amyloid positivity. (2025/2026). *Alzheimer's Research & Therapy*.
- Cambridge Cognition / Winterlight: Phase 3 MDD trials, contracts through 2027-2029.
- BiAffect: NIMH R01-MH120168, project period ended December 2024.
- nQ Medical: FDA Breakthrough Device Designation (Feb 2020). Dormant since ~2022.
- NeuraMetrix: FDA Breakthrough Device designation for PD via typing cadence.
- Neurocast: FDA device registration May 2025.
- KeySense: 80,000+ users, 90-95% PD detection accuracy.

### Terminology
- Terminological clarity in digital biomarker research. (2026). *Frontiers in Digital Health*.

### Regulatory Environment
- FDA Digital Health Center of Excellence staffing disruption. Fortune, February 2025.
- SBIR/STTR Reauthorization. Signed April 13, 2026.
- NINDS PAR-25-170: Digital Health Technology Derived Biomarkers NOFO.
- EU AI Act high-risk provisions effective August 2, 2026.
