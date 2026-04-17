# Three Build Types — Viability Assessment Against the Real Landscape

**Date:** 2026-04-14 | **Updated:** 2026-04-17
**Predecessor:** 01-landscape.md. Architecture references updated for post-Apr-16 restructure; market analysis and competitive landscape remain current.

---

## The Question

Theory 4 established that Alice is the Boston Process Approach applied to writing — the richest cognitive modality, sitting in a mapped gap of a validated paradigm with a $420M platform company assembling adjacent tools. That framing is correct and unchanged.

But "the gap is real" is not the same as "the gap is buildable." This document asks: **given the actual competitive landscape, funding environment, regulatory terrain, and market evidence as of April 2026 — which build type (instrument, product, or company) has the highest probability of turning Alice's signal pipeline into a market differentiator?**

The research that follows is cited against named institutions, specific companies, published papers, and verified data.

---

## The Landscape as It Actually Exists

### The Gap Is Confirmed — Nobody Fuses Process and Content

After exhaustive search across academic tools, commercial products, and clinical instruments, the finding is unambiguous: **no existing tool, commercial or academic, integrates keystroke process dynamics with linguistic content analysis in a longitudinal framework.**

What exists in fragments:

| Tool | Process (how you write) | Content (what you write) | Longitudinal | Status |
|------|------------------------|-------------------------|--------------|--------|
| Inputlog (U. Antwerp) | Keystrokes, pauses, revisions | Basic NLP (POS, lemma, frequency) | No — sessions are discrete | 1,000+ researchers, Windows-only, free |
| LIWC-22 / Receptiviti | None | 117 psychological categories, 12K terms | No | Semi-commercial, 20K+ papers cite it |
| BiAffect (UIC) | Keystroke metadata | None — explicitly discards content | Yes | NIMH-funded, iOS app, no spinoff |
| Grammarly Authorship | Keystroke replay | None exposed for analysis | No | Mass-market integrity tool, not research |
| DSCRIB (dscrib.io) | Temporal keystroke analysis | None | No | First commercial writing process tool (education) |
| neuroQWERTY / nQ Medical | Inter-key intervals, motor timing | None — discards all text | Yes | FDA Breakthrough Device (PD), dormant since ~2022 |
| Winterlight / Cambridge Cognition | None | Spoken language (500+ features) | Partial | Acquired, pharma trials |
| KLiCKe Corpus (2025) | Full keystroke logs | Human-rated holistic scores only | No — cross-sectional | Open dataset, 5K essays |

The closest academic work is **Meulemans, Van Waes, & Leijten (2022, University of Antwerp)**: 30 subjects, Inputlog keystroke logging, found cognitively impaired writers produced 108 fewer characters/minute and spent 20.6% more time pausing, with very large effect sizes. But this was cross-sectional, used Inputlog (no content analysis), and had no longitudinal follow-up.

The closest new entrant is **DSCRIB** (Daedalean Pte. Ltd., 2026), a web-based tool that captures keystroke process with temporal analysis and heatmaps. It targets education (plagiarism detection, metacognitive feedback). It has no linguistic content analysis, no longitudinal tracking, and no cognitive/clinical framing. Published in *Discover Education* (2026).

**Alice is the only implementation that fuses all four components: keystroke process dynamics + linguistic content analysis + longitudinal within-person tracking + AI interpretation.** This is not marketing. It is a verifiable fact about the landscape.

### The Neurodegenerative Evidence Is Directional But Thin

Two findings from the 2025-2026 literature point in a supportive direction, though both require careful reading:

**1. Li et al. (2025, Frontiers in Computational Neuroscience):** A touchscreen writing-process biomarker model reported **AUC = 0.918** for community MCI-due-to-AD screening, compared to MoCA = 0.859 and MMSE = 0.783 on the same sample. *Important caveats, however, substantially qualify this result.* The task was repeated fingertip handwriting of a single Chinese character (米) on a touchscreen, not keyboard typing of free-form text, so the features extracted were pause durations, pause counts, and writing speed variability — not keystroke dynamics in the sense used by keyboard-based instruments. The sample was 72 participants total (38 MCI, 34 HC). The reported AUC was computed on the same sample used to fit a stepwise binary logistic regression that selected three features from twenty candidates, with no held-out test set, cross-validation, or external cohort. The authors explicitly identify the small sample and overfitting risk as a limitation. This is a directionally encouraging result, not a validated clinical diagnostic — and the MMSE/MoCA comparison is asymmetric, since those instruments were applied as pre-specified tests while the digital-biomarker model was fitted to this specific sample. Treat as "a suggestive signal worth further investigation in the correct modality," not as "writing process signals beat gold-standard cognitive tests."

**2. Nun Study 30-Year Follow-Up (Clarke et al., 2025, Alzheimer's & Dementia):** The landmark reanalysis at UT Health San Antonio (Margaret Flanagan's group, Glenn Biggs Institute) confirmed that early-life idea density predicts not just Alzheimer's diagnosis but hippocampal atrophy, amyloid burden, and cognitive resilience. New finding: a surprising interaction where high emotional content *increased* dementia risk in high-idea-density individuals while *decreasing* it in low-idea-density cases — suggesting that the *composition* of writing, not just its complexity, carries diagnostic signal across decades. This result is methodologically stronger than Li — longitudinal, large cohort, autopsy-confirmed — and is the more durable anchor for the clinical case.

**The closest study to what keyboard-based keystroke biomarker instruments actually capture** is Meulemans, Van Waes, and Leijten (2022): n=30, cross-sectional, Inputlog keystroke logging on free-form writing. Cognitively impaired writers produced 108 fewer characters per minute and spent 20.6% more time pausing, with very large effect sizes. This study is small but methodologically cleaner than Li in that it uses the actual target modality. It remains the single most relevant published anchor for a keyboard-based writing-process biomarker instrument, and its smallness is itself part of the strategic opportunity — no one has built the larger-sample longitudinal replication.

Additionally, the **NLP-for-cognitive-decline literature has exploded**: a 2025 Mayo Clinic Proceedings systematic review of 51 studies (17,340 participants) found combined linguistic + acoustic approaches achieve 87% accuracy (AUC 0.89) for detecting cognitive impairment. A separate npj Digital Medicine review found NLP on clinical notes achieves median sensitivity 0.88, specificity 0.96. But critically — **virtually all of this work analyzes speech, not writing.** The modality gap persists.

### The Market Is Real and Growing

| Market | 2025 Size | Projected | CAGR |
|--------|-----------|-----------|------|
| Cognitive Assessment & Training | $6.1-9.3B | $34-37B (2034) | 16-25% |
| Digital Neuro Biomarkers | $727M (2024) | — | 25.7% |
| Behavioral/Mental Health Software | $7.5B | $22.1B (2032) | 16.8% |
| Journaling Apps | $5.1B (2024) | $13.6B (2033) | 11.5% |
| Digital Phenotyping (Mental Health) | $1.14B (2024) | $8.87B (2033) | 22.7% |

### The Graveyard Is Also Real

| Company | Raised | Peak Valuation | Outcome | Cause of Death |
|---------|--------|----------------|---------|----------------|
| Mindstrong Health | $160M | — | Shut down Feb 2023 | Commercialized before science was sound; passive surveillance felt creepy |
| Pear Therapeutics | $175M | ~$1.6B (SPAC) | Bankrupt Apr 2023 | FDA cleared but payers refused to reimburse; burned $35M/quarter |
| Akili Interactive | $114M+ | ~$1B (SPAC) | Acquired for $34M Jul 2024 | 49% revenue decline; prescription digital therapeutic model failed |
| Woebot Health | $123M | — | Shut down Jun 2025 | FDA Breakthrough Device but never got marketing authorization; regulatory limbo killed it |

Every one of these companies had significant funding, institutional backing, and credible technology. They all died for the same structural reason: **the gap between technical proof and commercial viability in clinical digital health is a killing field.**

---

## BUILD TYPE 1: THE INSTRUMENT

### What This Means

License the signal pipeline as a research methodology. Sell to writing process researchers, cognitive science labs, and clinical trial sponsors. Avoid consumers and FDA entirely. Revenue through academic licenses, dataset access, and API fees.

### The State of the Incumbent: Inputlog

Inputlog (University of Antwerp) is the dominant research tool with 1,000+ registered researchers worldwide. It is:

- **Windows-only.** No native Mac or Linux support. Mac requires Boot Camp or a VM.
- **Desktop software.** No web-based version, no mobile support.
- **Single-session.** No built-in infrastructure for tracking the same writer over time.
- **Linguistically limited.** POS tags, lemma, frequency — no psychological category analysis, no sentiment, no affect scoring.
- **English and Dutch only** for linguistic analysis. Korean and Chinese prototypes exist with limited analytical support.
- **Not clinically oriented.** No cognitive assessment framing, no personal baselines, no deviation tracking.

Luuk Van Waes is now **Professor Emeritus** at the University of Antwerp. Marielle Leijten continues leading the project. The latest publications from their group (2025) focus on large-scale corpora (KLiCKe), automated phase detection, and educational applications — not clinical or cognitive assessment.

The planned successor? **None announced.** No ground-up rewrite. No next-generation web-based tool. Inputlog is being maintained, not reinvented.

Other tools are either dormant (Scriptlog, Translog), specialized for handwriting (Eye and Pen), or early-stage (CyWrite, GenoGraphiX-LOG, FlexKeyLogger). None are competitive threats.

### What Alice Offers as an Instrument

A web-based, cross-platform writing process capture tool that:
1. Runs in any modern browser (no installation, no Windows dependency)
2. Captures 60+ signals across keystroke dynamics, linguistic content, revision topology, and emotional texture
3. Tracks the same writer longitudinally with within-person z-scoring
4. Provides calibration baselines via neutral writing tasks (Pennebaker within-person design)
5. Computes same-day session deltas for controlled comparisons
6. Includes embedding-based RAG for thematic analysis across sessions
7. Produces 7D behavioral + 11D semantic state vectors (purely deterministic) with PersDyn dynamics (baseline, variability, attractor force)

This is a generational upgrade to the research community's primary tool. Not incrementally better — categorically different.

### The Market

**Writing process research community:**
- ~1,000+ active labs using Inputlog
- Primary venues: Journal of Writing Research, EARLI SIG Writing (next conference: June 2-4, 2026, Zurich), Learning Analytics and Knowledge (LAK)
- Revenue model: Academic license $15-30K/year per lab
- TAM (research only): $7.5-15M at full penetration

**Clinical/cognitive research labs studying writing and cognition:**
- Meulemans/Van Waes/Leijten (University of Antwerp) — already published Inputlog-based AD research
- Jet Vonk (UCSF Memory and Aging Center) — automated speech/language analysis for AD and FTD
- Rhoda Au (Boston University, Framingham Heart Study) — digital biomarkers, multi-sensory brain health monitoring
- Saturnino Luz (University of Edinburgh) — SIDE-AD longitudinal study, ADReSS challenges
- Vitor Zimmerer (UCL Dementia Research Centre) — formulaic language in dementia, ADDF-funded
- Helena Balabin (KU Leuven) — NLP classification of early AD from connected speech
- Brian MacWhinney (Carnegie Mellon) — DementiaBank database

These researchers are doing cognition + language work using speech. Nobody is doing it with the writing process. The signal pipeline would give them a new instrument for a modality they haven't been able to study computationally.

**Pharma trial sponsors:**
- Cogstate: $53.1M revenue (FY2025, up 22% YoY), $25.4M in new sales contracts in Q3 FY2026 alone, used in 70+ indications. Tests are reaction-time and card-based. No writing modality.
- Cambridge Cognition: £9.4M revenue (FY2025), acquired Winterlight for speech biomarkers. No writing modality.
- Both companies would be potential licensing partners, not competitors.

### Viability Assessment

**Strengths:**
- Confirmed technical gap (no competing tool fuses process + content + longitudinal)
- Incumbent tool (Inputlog) is showing age (Windows-only, no longitudinal, emeritus leadership)
- Active research community with established venues and funding
- Non-dilutive funding is directly available (R21: $275K, SBIR Phase I: $323K, with zero competition in this exact niche)
- No FDA requirement (research use only)
- University of Antwerp group is the natural first customer/collaborator — they already studied writing process in AD populations with the inferior tool

**Weaknesses:**
- Small TAM ($7.5-15M for pure research licensing)
- Academic sales cycles are slow
- Requires validation data (N > 1) to be credible even as a research tool
- Revenue ceiling without expanding beyond pure research

**Risks:**
- Inputlog could announce a web-based successor (low probability given emeritus status of Van Waes)
- DSCRIB could expand into longitudinal/content analysis (possible but they're education-focused)
- Grammarly could open-source or commercialize their keystroke process data (possible but it's an integrity tool, not a research instrument)

**Realistic funding path:**
- R21 ($275K/2yr) — novel writing-process cognitive biomarker validation. Zero competing applications in this niche. Next SBIR receipt date: September 5, 2026 (programs currently paused due to congressional authorization lapse through April 2026, reauthorized April 13, 2026).
- SBIR Phase I ($323K) — NIA digital biomarker track. 10 SBIR awards in FY2024-2025 for digital cognitive biomarkers; this niche is funded.
- NSF Smart Health (SCH) — HCI + health intersection. Joint NSF-NIH program. NIA participates with specific interest in early cognitive decline detection.

**Verdict: VIABLE.** The instrument path has the highest probability of near-term success. The gap is real, the incumbent is aging, the funding is available, and the validation requirements are achievable (N=10-50, not N=1000). The ceiling is low ($15M TAM) but the floor is solid.

---

## BUILD TYPE 2: THE PRODUCT

### What This Means

Ship Alice as a consumer/prosumer depth tool. One question per day. No dashboard. No streaks. Process-level self-knowledge through behavioral mirroring (the witness form), not metrics. Revenue through subscription ($20-50/month).

### The Consumer Journaling Landscape

The AI journaling market is crowded and homogeneous:

| App | Users/Revenue | Price | AI Approach | Process Analysis |
|-----|---------------|-------|-------------|-----------------|
| Rosebud | 50K users, 10K paying | $12.99/mo | GPT-4o: tags, patterns, weekly insights | None |
| Day One | ~$400K/mo revenue | $50-75/yr | "Go Deeper" prompts, summaries | None |
| Mindsera | 80K users | $19.99/mo | Cognitive frameworks, bias detection | None |
| Stoic | 4M+ users | Subscription | Marcus Aurelius-style reflection | None |
| Clearful | App Store Editor's Choice | Subscription | Weekly/monthly AI summaries | None |
| Reflectr | Active, small | Subscription | AI companions with personalities | None |
| Earkick | ~40K downloads | Freemium | Multimodal sentiment analysis | None |

**What every one of them does:** Analyzes the CONTENT of what you write — sentiment, themes, mood, topics. Uses AI to generate prompts or respond conversationally. Offers engagement mechanics — streaks, badges, weekly summaries, AI personas. Treats the journal entry as a finished artifact to analyze.

**What none of them do:** Analyze HOW you write. Track cognitive process longitudinally. Operate on anti-engagement principles. Refuse to surface raw metrics. Deliberately limit interaction.

Alice occupies a product position with **zero competitors.** Not "few" — zero.

### The Anti-Engagement Question

Is there ANY successful consumer product built on genuine anti-engagement principles?

**Opal** (screen time control): $10M ARR with 11 employees. The clearest commercial success of a friction-first product. But Opal creates friction *against other apps*, not against itself.

**Forest** (focus timer): 4M paying users, #1 in 136 countries. But Forest gamifies non-use with a virtual tree — it's engagement mechanics applied to disengagement.

**Calm/Headspace:** 100% engagement-optimized. Streaks, badges, progress milestones, AR breathing exercises. Below 8.5% Day 30 retention. Not slow tech — wellness-branded engagement tech.

**BeReal:** 40M MAU, marketed as "anti-engagement." Reality: 70% daily posting rate, 72% post engagement, 68% check within 3 minutes of notification. "Anti-engagement" is a marketing position, not a product philosophy.

**Bottom line:** No consumer product that genuinely strips ALL engagement mechanics has achieved significant scale. Every "slow tech" product that scales either adds engagement mechanics or reframes engagement as something else. The product position Alice occupies is unoccupied *because nobody has survived occupying it.*

### The Mindstrong Cautionary Tale

Mindstrong Health is the most directly relevant failure: $160M raised to analyze typing speed, scrolling behavior, and touchscreen interactions for mental health detection. This IS behavioral process analysis.

Why it died:
1. **Commercialized before the science was sound.** Founders explicitly admitted they were pressured to scale before validation.
2. **Passive collection felt like surveillance.** Users didn't choose to be analyzed; their phone behavior was monitored in the background.
3. **Lack of peer-reviewed publications.** The core biomarker claims were never rigorously validated.
4. **Unsustainable unit economics.** Patient acquisition costs too high.

**The critical distinction:** Mindstrong monitored passive behavior without consent awareness. Alice receives active, consensual, deliberate writing. The user sits down and writes TO the system. That's psychologically and ethically different from background surveillance. Pennebaker's entire research tradition is built on this distinction — expressive writing works because the person chooses to do it.

### The "Inner Whoop" Opportunity

The physical quantified-self market is proven ($B+): Whoop, Oura, Apple Watch, Garmin. Whoop's June 2025 study (300K+ mental health surveys, 170K members, 7.9M days of biometric data) showed strong correlations between physiological signals and self-reported mental health — but Whoop admits "no wearable can directly measure how you feel."

The cognitive/emotional equivalent — longitudinal tracking of how you *think*, not how your body performs — does not exist in consumer products. Mindsera comes closest with cognitive framework analysis but it's entry-by-entry content analysis, not process tracking.

The "inner Whoop" market has zero occupants.

### Viability Assessment

**Strengths:**
- Zero competitors in the exact product position (process + anti-engagement + depth)
- The "inner Whoop" narrative is compelling and the physical QS market proves demand for self-tracking
- Premium pricing ($20-50/month) is justifiable for a unique product
- Opal/Forest prove that friction-first products can generate revenue
- Digital phenotyping sub-market growing at 22.7% CAGR
- The witness form (Alice Negative) is genuinely novel — no other consumer product renders behavioral dynamics as abstract visual form

**Weaknesses:**
- No precedent for successfully monetizing behavioral process analysis in consumer (Mindstrong tried, burned $160M)
- App retention is brutal: 90%+ abandon within 30 days. Anti-engagement + journaling = maximum churn risk
- The market for "monastic depth tools" may be 10K people, not 10M
- No engagement mechanics means no viral loops, no organic growth flywheel
- Revenue ceiling: even at $50/month with 10K subscribers = $6M ARR. That's a lifestyle business, not a venture outcome

**Risks:**
- Rosebud or Mindsera could add process analysis (technically feasible, but philosophically unlikely — their entire UX is built on content analysis and engagement)
- A Whoop/Oura partnership with a writing tool could enter from the QS side
- The anti-engagement thesis may simply be wrong about what humans want

**The honest question:** Is the market for genuine depth 10K people willing to pay $50/month, or 100K people willing to pay $15/month? At 10K × $50 = $6M ARR — sustainable indie business. At 100K × $15 = $18M ARR — serious company. At 1K × $50 = $600K — a hobby. The answer is unknowable without shipping.

**Verdict: VIABLE BUT UNPROVEN.** The product position is real and genuinely unoccupied. But "unoccupied" might mean "undiscovered" or might mean "uninhabitable." No evidence exists either way. The only way to know is to ship and measure retention. The floor is a lifestyle business. The ceiling depends on whether the "inner Whoop" thesis is real.

---

## BUILD TYPE 3: THE COMPANY

### What This Means

Build a clinical cognitive assessment platform. FDA pathway. Health system integration. Pharma trial endpoints. Revenue through enterprise SaaS licensing to clinical organizations, research institutions, and pharmaceutical sponsors.

### The Competitive Landscape

**Linus Health** — The platform assembling process-over-output cognitive tools:

- **Valuation:** $420M (Series B, 2022). $105M total raised.
- **Acquisitions:** Digital Cognition Technologies/DCTclock (2020), Kinesis Health Technologies/gait (2022), Aural Analytics/speech (2023-2024), Together Senior Health/intervention (2023-2024).
- **Product:** Multimodal brain health assessment: clock drawing + gait + speech + intervention.
- **FDA:** DCTclock is FDA-registered Class II medical device.
- **Go-to-market:** "Anywhere powered by Linus Health" for remote assessment. League partnership for private health plan integration.
- **Key personnel:** David Bates (CEO), Alvaro Pascual-Leone (CSO, Harvard neuroscientist).
- **Writing modality:** None. The gap in their platform is confirmed.

**Cogstate (ASX:CGS)** — The revenue leader:

- **Revenue:** AUD $53.1M (FY2025, up 22% YoY). Net profit before tax: AUD $13.9M, up 96%.
- **New sales:** $41.3M in new clinical trial contracts (FY2025, up 53%). $25.4M in Q3 FY2026 alone — nine-month total ($67.1M) surpassed all prior full-year totals.
- **Strategic partnership:** Medidata (Oct 2024) — Medidata has 4,000+ staff and ~800 salespeople. Already ~20% of Cogstate's pipeline involves Medidata despite sales team only ramping since Feb 2025.
- **Products:** Playing-card-based computerized cognitive tests. Culture-neutral, language-independent, minimal practice effects.
- **Writing/text tools:** None. Entirely reaction-time and card-based.

**Cambridge Cognition (LSE:COG)** — Speech + cognition:

- **Revenue:** £9.4M (FY2025, down ~10%). But sales orders up 73%, order book up 21%.
- **Winterlight acquisition:** £7.0M (Jan 2023). Spun out of University of Toronto in 2015. Analyzes natural speech for dementia detection.
- **Modalities:** CANTAB (tablet cognitive tasks) + Winterlight (speech biomarkers) + clinical interview QA.
- **Key customers:** Five of top 10 life sciences companies globally.
- **Writing/text tools:** Winterlight analyzes spoken language only. No written text analysis.

**BrainCheck** — The fast-growing FDA-cleared digital assessment:

- **Scale:** 500+ practices nationwide (150 new in 2025 alone). 105,000 assessments in 2025.
- **Funding:** $36.7M total.
- **FDA:** Class II cleared. 35 peer-reviewed studies.
- **International:** Multilingual versions for pan-European PREDICTOM study.
- **Writing/text tools:** None. Reaction-time and task-based.

**Neurotrack** — Eye-tracking cognitive screening:

- **Scale:** 15,000+ clinicians. $67.6M total funding (Series C).
- **Partnerships:** Signify Health (CVS Health company) incorporated Neurotrack into standard in-home assessments (Oct 2024).
- **Method:** Three-minute screening using eye-tracking technology and culturally-agnostic symbols.
- **Writing/text tools:** None.

**nQ Medical / neuroQWERTY** — The closest competitor:

- **FDA:** Breakthrough Device Designation (Feb 2020) for Parkinson's monitoring via typing cadence.
- **Method:** Inter-key intervals, flight time, hold time. Pure motor timing. Discards all text content.
- **Status:** Appears relatively dormant since ~2022. No evidence of FDA clearance beyond the Breakthrough designation. De Novo application submitted March 2022; no clearance announced.
- **Key patent:** "Methods and Apparatus for Assessment of Health Condition or Functional State from Keystroke Data" (filed Dec 2020). Covers keystroke/touchscreen dynamics for cognitive, psychomotor, and motor assessment. **This is the broadest and most directly relevant patent.**
- **Limitation:** Motor signatures only. Cannot move toward content analysis without fundamentally changing the privacy model and product category.

### The Regulatory Terrain

**FDA pathways for a writing-based cognitive tool:**

| Pathway | Timeline (median) | Cost | Applicability |
|---------|-------------------|------|---------------|
| De Novo | 66 months (~5.5 years) | $1-5M | Most likely — novel device, no exact predicate |
| 510(k) | 31 months (~2.5 years) | $200K-$6.8M | Possible using Cognigram or Cognivue as predicates |
| Breakthrough Device | Accelerated review | Same as above | Achievable — nQ Medical got it for keystroke-based PD monitoring |

**Key regulatory facts:**
- neuroQWERTY's Breakthrough Device Designation proves the FDA accepts keystroke-derived signals as a medically meaningful biomarker pathway.
- DCTclock is FDA-registered Class II. BrainCheck is FDA Class II cleared. These establish the device classification for digital cognitive assessments.
- FDA's January 2025 draft guidance on AI-enabled medical devices is the first comprehensive AI device guidance.
- FDA's March 2024 draft guidance explicitly noted challenges in demonstrating clinical meaningfulness of digital measures in early AD — the regulatory bar is rising, not falling.
- Global CEO Initiative (January 2026, published in *Alzheimer's & Dementia*) established minimum performance standards: 80% sensitivity, 85% specificity for detection; 85% sensitivity, 90% specificity for diagnostic aid.

**The reimbursement wall:**
- Pear Therapeutics: FDA cleared, couldn't get payers to reimburse. Bankrupt.
- Akili Interactive: FDA cleared, 49% revenue decline, acquired for pennies on the dollar.
- CMS created 3 new reimbursement codes for digital interventions (Nov 2024) — the landscape is improving but slowly.
- TEMPO pilot (launched late 2025): new FDA + CMS cooperation pathway for digital health devices targeting Medicare/Medicaid.

### The IP Question

The **nQ Medical patent** is the primary concern. It claims broadly over keystroke dynamics for health assessment across multiple diseases including Alzheimer's. However:

1. The patent focuses on **motor/psychomotor signal extraction** — speed, pressure, hold time, flight time. These are biomechanical measurements.
2. Alice's signal pipeline emphasizes **compositional cognition** — how someone constructs, revises, and develops ideas over time. This includes revision topology, deletion decomposition (Faigley & Witte), P-burst dynamics (Chenoweth & Hayes), linguistic content trajectories, and behavioral state modeling (PersDyn).
3. The distinction between "motor dynamics of hitting keys" and "cognitive dynamics of composing reflective text" is defensible but would require formal freedom-to-operate analysis ($15-30K).

A second patent of note: **US20120064493A1** — "Method for cognitive computing" — uses predictive linguistics to determine states of cognition from written input. This covers content-based cognitive assessment but appears to focus on word-level value assignment, not process-level behavioral analysis.

### The Research Landscape Supporting Clinical Application

The clinical evidence base for writing + cognition is directional but thin. The headline numbers in the field are inflated by in-sample evaluation and feature selection on small samples; treat them as suggestive rather than validated:

- **Meulemans, Van Waes, Leijten (2022, University of Antwerp):** Inputlog keystroke logging in AD — 108 fewer chars/min, 20.6% more pause time in cognitively impaired writers. Very large effect sizes on n=30, cross-sectional. Methodologically the cleanest anchor in the keyboard-typing modality, but small.
- **Nun Study 30-Year Follow-Up (2025, UT Health San Antonio):** Idea density still predictive of neuropathological outcomes across 6+ decades. Longitudinal, large cohort, autopsy-confirmed. The strongest anchor in the field.
- **Li et al. (2025):** Touchscreen fingertip handwriting of a single Chinese character (米), n=72, AUC 0.918 reported for a 3-feature stepwise-selected model evaluated in-sample. Compared to MoCA=0.859 and MMSE=0.783 on the same sample. *Not* a keyboard typing study; *not* externally validated. Directionally supportive for pause-and-speed features carrying cognitive signal, but should not be cited as "writing process signals beat MoCA/MMSE" without the methodological caveats — that framing would not survive peer reviewer scrutiny.
- **Cache County Pilot (Norton et al., 2016-2017):** 53% reduction in all-cause dementia risk from journal keeping. **Never replicated.** Authors explicitly called for RCTs with long-term follow-up.
- **NLP systematic reviews (2025):** 87% accuracy (AUC 0.89) for cognitive impairment detection from language, but virtually all using speech, not writing.
- **ClinicalBERT on EHR notes (2025, Nature):** AUC 0.997 for detecting cognitive decline from clinician-written notes, up to 4 years before MCI diagnosis. This uses written text — but clinician-written, not patient-written.

Key researchers who would be natural collaborators or advisors:

| Researcher | Institution | Focus | Relevance |
|-----------|------------|-------|-----------|
| Margaret Flanagan | UT Health San Antonio, Biggs Institute | Nun Study custodian, idea density | Longitudinal writing + neuropathology |
| Jet Vonk | UCSF Memory & Aging Center | Automated verbal fluency analysis, AD/FTD | Language biomarkers in neurodegeneration |
| Rhoda Au | Boston University, Framingham | Voice biomarkers, multi-sensory brain health | Digital phenotyping pioneer |
| Saturnino Luz | University of Edinburgh | ADReSS challenges, SIDE-AD study | Computational language + dementia |
| Vitor Zimmerer | UCL Dementia Research Centre | Formulaic language in dementia | Clinical linguistics + cognition |
| Maria Norton | Utah State University | Cache County journal study | Writing + dementia risk |
| Meulemans/Van Waes/Leijten | University of Antwerp | Keystroke logging in AD populations | Writing process + cognitive impairment |
| Helena Balabin | KU Leuven | NLP classification of early AD | Computational methods + dementia |
| Luca Giancardo | UTHealth Houston (ex-MIT) | neuroQWERTY inventor, now cognitive biomarkers via typing | Keystroke → cognition transition |
| Sofia Toniolo | Oxford, NDCN | OCTAL remote cognitive assessment, plasma biomarker integration | Digital assessment + biomarker validation |
| Peter Kuppens | KU Leuven | Affect dynamics methodology, PersDyn framework | Behavioral dynamics modeling |
| Ryan Boyd | UT Dallas | LIWC-22 co-developer, text analysis tools | Pennebaker's intellectual successor |

### The Pharma Endpoint Opportunity

Current AD trial endpoints are outdated and limited:

- **ADAS-Cog:** Gold standard for mild-to-moderate AD trials. More sensitive than MMSE but still subject to practice effects, rater variability, and ceiling/floor effects.
- **MMSE:** Widely used in both practice and trials. Known ceiling effects in early stages.
- **MoCA:** Better for early-stage detection but NOT widely used in clinical trials.
- **CDR-SB:** Commonly used composite. Subjective rater-dependent.

Digital endpoints have NOT replaced traditional measures as primary endpoints in pivotal trials. But they are being explored aggressively:

- **Roche Ad DAS** (with Oxford + Lilly): Smartphone-based cognitive tasks, not writing analysis.
- **DIAN** (Washington University): Smartphone ecological momentary assessment, ICC 0.89-0.94, validated against amyloid/tau/MRI. Not writing-based.
- **Evidation/Lilly/Apple study:** Found "slower typing" and "reduced texting" as passive behavioral markers. Frequency and speed — not content.
- **RADAR-AD consortium** (13 European countries): Remote monitoring shows promise in prodromal stage. Not writing-based.

**Biomarkers are now primary outcomes in 27% of active AD trials (2025 pipeline).** The market is moving toward digital endpoints. Nobody is offering a writing-based one.

The pharma revenue model: Cogstate does AUD $53.1M/year licensing reaction-time tests to trial sponsors. If a writing-based cognitive endpoint can show sensitivity to early cognitive change — particularly in the preclinical/prodromal stage where existing tests have ceiling effects — the revenue opportunity is significant.

### Viability Assessment

**Strengths:**
- Largest TAM of the three build types (cognitive assessment: $6-9B → $34-37B)
- Linus Health's gap is confirmed — they have drawing, gait, speech, and intervention. Not writing. Their acquisition pattern suggests they'd recognize this modality.
- Cogstate's revenue growth ($53.1M, +22% YoY) proves the market pays for digital cognitive assessment
- FDA regulatory precedent exists (neuroQWERTY Breakthrough, DCTclock Class II, BrainCheck Class II)
- Pharma trial sponsors are actively seeking digital endpoints (27% of AD trials now use biomarker primary endpoints)
- The graveyard companies (Mindstrong, Pear, Akili, Woebot) died for reasons that don't structurally apply: passive surveillance (Mindstrong), no reimbursement strategy (Pear), wrong product model (Akili), regulatory limbo (Woebot)
- Writing-based assessment is uniquely both measurement AND intervention (Pennebaker) — this makes it more attractive than pure assessment tools for health system buyers

**Weaknesses:**
- Longest path to revenue (31-66 months for FDA clearance alone)
- Highest capital requirement ($1-5M for FDA pathway, $5-10M+ for full platform)
- Requires clinical validation studies with institutional partners (N=50-100+, 12+ weeks)
- nQ Medical's patent creates IP risk requiring freedom-to-operate analysis
- The reimbursement wall is real and has killed better-funded companies
- You are one person with N=1 data

**Risks:**
- Linus Health or Cambridge Cognition could develop a writing modality internally (possible but their acquisition pattern suggests buy-over-build)
- nQ Medical could pivot from motor to cognitive keystroke analysis (low probability given dormancy since 2022)
- FDA regulatory requirements could tighten further for AI-based SaMD
- Clinical validation could show that writing process signals don't differentiate cognitive states as well as cross-sectional studies suggest (the longitudinal question is untested)

**Verdict: HIGHEST CEILING, HIGHEST RISK.** The company path could produce a $100M+ outcome. But it requires $5-10M+ in capital, 3-5 years, institutional partnerships, FDA clearance, and reimbursement strategy — and every one of those gates has killed companies with more resources. This path is not viable as a first move. It is viable as the destination after the instrument path proves the science.

---

## Cross-Cutting: The Funding Landscape

### Non-Dilutive (Government Grants)

| Mechanism | Amount | Timeline | Fit |
|-----------|--------|----------|-----|
| NIH R21 (exploratory) | $275K / 2 years | Next receipt: Sep 2026 | HIGHEST — zero competing applications in writing-process cognitive biomarkers |
| SBIR Phase I (R43) | $323K / 6mo-2yr | Next receipt: Sep 2026 | HIGH — NIA actively funds digital cognitive biomarkers (10 awards FY2024-25) |
| SBIR Phase II (R44) | $2.15M / 1-3yr | After Phase I | HIGH — 60% success rate for Phase II applicants |
| NSF Smart Health (SCH) | Variable | Rolling | MODERATE — HCI + health intersection, NIA participates |
| NIH PAR-25-170 (UG3/UH3) | $500K+/yr, up to 5yr | Through Jun 2026 | MODERATE — digital health technology biomarkers |
| DARPA | Variable | Program-dependent | LOW — defense-oriented, would need warfighter framing |

**Critical note:** SBIR/STTR programs had a congressional authorization lapse October 1, 2025, reauthorized April 13, 2026. NIH is NOT accepting applications for the April 5 receipt date. Next standard receipt date: **September 5, 2026.**

**Total realistic non-dilutive funding within 3 years: $600K-$2.5M.**

### European Funding

| Mechanism | Amount | Fit |
|-----------|--------|-----|
| ERC Starting Grant | Up to ~€1.5M | Requires PI at European institution |
| Horizon Europe EDiHTA | €8M (16 partners) | Digital health tech assessment — consortium only |
| Wellcome Trust Mental Health Award | £3-7M / 5yr | Requires existing MVP + feasibility data |
| Alzheimer's Society (UK) | Variable | Has funded Zimmerer's language + dementia work |

European funding requires either institutional affiliation or consortium membership. Most viable through a university collaboration (Antwerp, KU Leuven, or Edinburgh).

### Venture Capital

Digital health VC is recovering: $14.2B in 2025 (up 35% from 2024), $4B in Q1 2026. Mental health is the #2 funded therapeutic category (12% of global digital health funding).

But the bar has risen:
1. **Clinical validation is now baseline** — at least one peer-reviewed study required for Series A
2. **Regulatory traction** — a believable FDA strategy with specific pathways
3. **Commercial proof** — revenue, health system procurement, operational ROI
4. **Profitability pressure** — the era of growth-at-all-costs is over

**No writing-process or keystroke-analysis company has received significant VC funding.** nQ Medical raised early funding (MIT spinout, MJFF) but appears dormant. This is white space — which means both opportunity and risk.

**Is Alice fundable by VCs today?** No. N=1 data, no clinical validation, no regulatory traction, no revenue. Would it be fundable after Phase 1 (instrument) validates the science? Potentially — with a published whitepaper, N=10-50 validation data, and a credible FDA strategy, a $2-5M seed round targeting the cognitive assessment market is conceivable.

---

## Cross-Cutting: Key Institutions and Their Relevance

### Tier 1 — Natural Collaborators (immediate relevance)

**University of Antwerp (Leijten, Van Waes, Meulemans)**
- Built Inputlog, the dominant tool Alice would succeed
- Already published on writing process in AD (Meulemans et al. 2022)
- Van Waes is now Professor Emeritus — transition moment for the field
- EARLI SIG Writing 2026 is in Zurich, June 2-4 — natural venue for introduction
- **Relevance:** Validation partner, co-author, first institutional customer

**KU Leuven (Kuppens, Balabin)**
- Kuppens developed affect dynamics methodology that PersDyn builds on
- Balabin published NLP classification of early AD from connected speech (2025)
- Alice implements PersDyn computationally — the first applied implementation
- **Relevance:** Theoretical validation partner, dynamics methodology co-development

**UT Austin → UT Dallas (Boyd, Pennebaker legacy)**
- Pennebaker is now Professor Emeritus, NAS 2025
- Ryan Boyd (UT Dallas) is the intellectual successor, co-developed LIWC-22
- Alice operationalizes Pennebaker's within-person expressive writing design with process data
- **Relevance:** Linguistic analysis validation, LIWC integration, academic credibility

### Tier 2 — Clinical Validation Partners (6-18 month horizon)

**UT Health San Antonio, Biggs Institute (Flanagan)**
- Custodian of the Nun Study
- 30-year follow-up published 2025 confirming idea density → neuropathology
- Alice could provide the computational infrastructure to measure idea density longitudinally in living subjects — something the Nun Study could never do prospectively
- **Relevance:** Longitudinal linguistic biomarker validation

**UCSF Memory & Aging Center (Vonk)**
- Automated speech/language analysis for AD and FTD
- Smartphone app for early FTD detection in genetically predisposed individuals
- Doing language + neurodegeneration work but only with speech
- **Relevance:** Extending their language biomarker work to writing modality

**University of Edinburgh (Luz)**
- SIDE-AD: longitudinal spoken language cohort at NHS memory clinics
- ADReSS/ADReSSo challenges: standardized evaluation of language-based AD detection
- **Relevance:** Longitudinal study design expertise, speech → writing modality extension

**Boston University / Framingham (Au)**
- 9,000+ digital audio recordings since 2005
- Multi-sensory brain health monitoring platform
- Pursuing voice biomarker validation
- **Relevance:** Digital phenotyping methodology, longitudinal cohort expertise

### Tier 3 — Commercial/Strategic Partners (12-36 month horizon)

**Linus Health**
- Platform missing writing modality. Acquisition pattern (4 acquisitions in 4 years) suggests buy-over-build.
- Would need: published whitepaper + validation data showing the writing process signal pipeline works
- **Relevance:** Potential acquirer or licensing partner

**Cogstate**
- $53.1M revenue, massive pharma distribution via Medidata partnership
- Entirely reaction-time/card-based — no language modality
- **Relevance:** Potential licensing partner for pharma trial endpoints

**Cambridge Cognition**
- Already has speech (Winterlight). Could add writing as a complementary modality.
- **Relevance:** Potential licensing or collaboration partner

**ADDF Diagnostics Accelerator**
- Funded SpeechDx ($10M+, 2,650 participants, 3 languages)
- Siemens Healthineers and Callyope have licensed the SpeechDx dataset
- Venture philanthropy model with non-exclusive licensing
- **Relevance:** Could fund a WritingDx analog — a standardized writing-process dataset for AD biomarker development

### MIT

- Originated neuroQWERTY (Giancardo, now at UTHealth Houston)
- CSAIL built DCTclock (Randall Davis, Dana Penney → Linus Health)
- AgeLab focuses on transportation/financial aging — not directly relevant
- Media Lab has no current writing/cognitive decline projects identified
- **Relevance:** Institutional credibility for the process-over-output paradigm, but no current active collaborator. The relevant researchers (Giancardo, Davis) have moved to industry or other institutions.

### Oxford

- OCTAL (Toniolo): Remote cognitive assessment portal, AUC 0.92 for AD detection, integrated with plasma biomarkers
- Collaborated with Roche/Lilly on Ad DAS
- No writing-based cognitive work identified
- **Relevance:** Digital cognitive assessment validation methodology; potential collaborator for integrating writing-process signals with molecular biomarkers (plasma pTau217 + writing dynamics could be a powerful combination)

---

## The Verdict

### Ranking by Viability

| Build Type | Probability of Success | Time to Revenue | Capital Required | Ceiling |
|-----------|----------------------|-----------------|-----------------|---------|
| **Instrument** | HIGH | 12-18 months | $50K-$275K (self-funded → R21) | $7.5-15M TAM |
| **Product** | UNKNOWN | 6-12 months | $10K-$50K (self-funded) | $6M-$18M ARR (depends on market size) |
| **Company** | MODERATE (conditional) | 36-66 months | $5-10M+ | $100M+ |

### The Sequencing That Makes Sense

These are not three independent choices. They are three stages of the same trajectory:

**Stage 1: Instrument (Now → 18 months)**

Use Alice yourself for 90 days (T=90). Recruit 5-10 writing researchers, cognitive scientists, or therapists as beta users (N=10, T=30). Write the whitepaper: "Process-Level Writing Analysis as a Passive Cognitive Performance Measure: A Longitudinal Within-Person Validation Study." Submit to R21. Present at EARLI SIG Writing 2026 (Zurich, June 2-4).

Target outcome: published validation data, R21 funded, 3-5 institutional users.

**Stage 2: Product (Parallel with Stage 1)**

Ship the consumer product to depth-seekers while the instrument validates. The consumer version funds development time and tests the "inner Whoop" thesis. If retention at Day 90 exceeds 30%, the product market is real. If not, the instrument path is the business.

Target outcome: 500-1,000 paying users, retention data, product-market fit signal.

**Stage 3: Company (Conditional on Stage 1 + 2)**

Only if: (a) the instrument produces publishable validation data showing writing process signals differentiate cognitive states, AND (b) either the product demonstrates strong retention OR a clinical partner (Linus Health, Cogstate, Cambridge Cognition) expresses interest.

At that point: SBIR Phase I ($323K), formal clinical validation study (N=50-100), freedom-to-operate patent analysis ($15-30K), and the three emails — Linus Health, ADDF Diagnostics Accelerator, and a pharma trial sponsor.

### The Three Emails (When the Data Exists)

**Email 1: Leijten or Van Waes (University of Antwerp)**
"You've spent 20 years building the standard tool for writing process research. I've built its successor — web-based, cross-platform, longitudinal, with integrated linguistic content analysis and PersDyn behavioral dynamics. Your group already showed writing process signals differentiate cognitively impaired writers (Meulemans et al. 2022). Here's 90 days of longitudinal data from a living implementation. Is this a collaboration worth exploring?"

**Email 2: Linus Health**
"You've assembled process-over-output cognitive tools across drawing, gait, speech, and intervention. Writing is the missing modality — the richest one, the only one that's simultaneously measurement and intervention, the one with the longest predictive window in the literature (Nun Study, 60 years). I've built a working implementation with 60+ deterministic signals, 7D behavioral + 11D semantic dynamics, and deterministic behavioral state computation. Here's the whitepaper. Here's the validation data. Is this a conversation worth having?"

**Email 3: ADDF Diagnostics Accelerator**
"You funded SpeechDx — a standardized speech dataset for AD biomarker development, now licensed by Siemens Healthineers. Writing is the complementary modality that doesn't exist yet. The only published keyboard-typing study of cognitive impairment in an AD population (Meulemans, Van Waes, and Leijten 2022, n=30, cross-sectional) reports effect sizes large enough to warrant scale-up, and the Nun Study lineage establishes that written-language features predict Alzheimer's decades in advance. But no longitudinal, keyboard-based, free-form writing cohort exists. I have the capture infrastructure. Could a WritingDx dataset fill the same gap for written language that SpeechDx fills for spoken?"

*Note on citation discipline:* Earlier versions of this theory cited Li et al. (2025) as "writing process biomarkers beat MoCA/MMSE" (AUC 0.918). On audit, that study is fingertip-handwriting of a single Chinese character, n=72, AUC computed in-sample after stepwise feature selection. It is not a keyboard-typing study and its reported AUC is optimistically biased. It can be cited as "a suggestive signal in the touchscreen-handwriting modality" but should not be used as the anchor for claims about keyboard-based biomarker performance. Use Meulemans 2022 and the Nun Study lineage instead.

### The One-Sentence Version

The instrument path validates the science, the product path tests the market, and the company path captures the value — but they must be run in sequence, not chosen in isolation, because the science doesn't exist yet and neither does the market evidence.

---

## Appendix: Key Citations

### Writing Process Research
- Chenoweth, N. A., & Hayes, J. R. (2001). Fluency in writing. *Written Communication*, 18(1), 80-98.
- Faigley, L., & Witte, S. (1981). Analyzing revision. *College Composition and Communication*, 32(4), 400-414.
- Leijten, M., & Van Waes, L. (2013). Keystroke logging in writing research. *Written Communication*, 30(3), 358-392.
- Meulemans, C., Van Waes, L., & Leijten, M. (2022). Writing process in Alzheimer's disease via keystroke logging. *PMC*, PMC9311409.
- Tian, Y., Crossley, S. A., & Van Waes, L. (2025). The KLiCKe Corpus. *Journal of Writing Research*, 17(1), 23-60.
- Conijn, R., Rossetti, V., Vandermeulen, N., & Van Waes, L. (2025). Phase to phase. *Journal of Writing Research*, 17(2), 339-369.

### Cognitive Assessment & Clinical
- Li, S., et al. (2025). Writing process digital biomarkers for community cognitive screening. *Frontiers in Computational Neuroscience*.
- Clarke, K. M., et al. (2025). Nun Study 30-year follow-up. *Alzheimer's & Dementia*.
- Norton, M. C., Weyerman, J. J., & Rose, C. (2017). Cache County journal study. *Journals of Gerontology: Series B*, 72(6), 991-995.
- Snowdon, D. A., et al. (1996). Linguistic ability in early life and cognitive function and Alzheimer's disease in late life. *JAMA*, 275(7), 528-532.
- Rentz, D. M., et al. (2021). DCTclock process analysis. *Neurology*.
- Balabin, H., et al. (2025). NLP classification of early AD from connected speech. *Alzheimer's & Dementia*.
- Amini, S., et al. (2024). Predicting AD progression from speech. *Alzheimer's & Dementia*.

### Behavioral Dynamics
- Sosnowska, J., et al. (2019). PersDyn model. *Personality and Individual Differences*.
- Kuppens, P. (2024). Measuring continuous affect with intensity profile drawings. *Assessment*.
- Pennebaker, J. W., & Beall, S. K. (1986). Confronting a traumatic event. *Journal of Abnormal Psychology*, 95(3), 274-281.

### Digital Phenotyping & Biomarkers
- Giancardo, L., et al. (2018). neuroQWERTY at-home validation. *JMIR*.
- BiAffect (2024). Smartphone keyboard dynamics predict affect in suicidal ideation. *npj Digital Medicine*.
- BiAffect (2025). Cognitive function assessment via passive keystroke metadata. *Frontiers in Psychiatry*.
- RADAR-AD Consortium (2025). Remote monitoring across AD stages. *Alzheimer's Research & Therapy*.

### Market & Industry
- Cogstate FY2025 Annual Report. ASX Announcement, August 2025.
- Cambridge Cognition FY2025 Results. April 2026.
- Global CEO Initiative (2026). Minimum performance standards for digital cognitive assessments. *Alzheimer's & Dementia*.
- FDA (2025). AI-Enabled Medical Devices: Total Product Lifecycle (draft guidance).
- FDA (2024). Early Alzheimer's Disease: Developing Drugs for Treatment (revised draft guidance).

### AI Alignment & Methodology
- Shumailov, I., et al. (2024). Model collapse. *Nature*.
- Kass, R. E., & Raftery, A. E. (1995). Bayes factors. *JASA*, 90(430), 773-795.

### Failed Companies (Cautionary)
- Mindstrong Health shutdown. *STAT News*, February 2023.
- Pear Therapeutics bankruptcy. *MedTech Dive*, April 2023.
- Akili Interactive acquisition. *BusinessWire*, July 2024.
- Woebot Health shutdown. June 2025.
