# Pharmaceutical Campaign Brief

## Market Context

CNS drug development faces a measurement crisis. Traditional cognitive endpoints (ADAS-Cog, CDR-SB, MMSE) are:
- Administered quarterly at best, missing the trajectory between visits
- Subject to practice effects across repeated administrations
- Insensitive to early-stage cognitive change (floor/ceiling problems)
- Expensive to administer (trained raters, clinical sites, patient travel)
- Plagued by rater variability and inter-site inconsistency

The FDA has signaled openness to digital endpoints and novel biomarkers. The 2018 draft guidance on digital health technologies and the 2023 framework for decentralized clinical trials both create regulatory pathways for instruments like Alice. The industry is actively seeking:
- Sensitive, frequent cognitive measurement for early-stage Alzheimer's and MCI trials
- Ecological endpoints that reduce site visit burden (decentralized trial enablement)
- Biomarkers that detect treatment effect earlier than traditional endpoints
- Patient-reported and patient-generated data that complements traditional assessment

## Target Personas

### VP of Clinical Development (CNS Portfolio)
- Managing Phase 2-3 programs for Alzheimer's, MCI, Parkinson's cognitive decline, MS cognitive fatigue, or TBI recovery
- Under pressure to demonstrate efficacy with smaller, shorter trials
- Looking for sensitive endpoints that detect treatment effect earlier
- Evaluates new endpoints on: sensitivity, reliability, regulatory acceptance pathway, patient burden

### Head of Digital Biomarkers / Real-World Evidence
- Building the company's digital endpoint strategy
- Evaluating wearables, digital cognitive tests, passive sensing
- Needs instruments with clear psychometric properties and a regulatory pathway
- Reports to both clinical development and regulatory affairs

### Medical Affairs / Medical Science Liaison
- Engaging KOLs in cognitive measurement and digital health
- Needs scientific credibility and publication record
- Wants instruments backed by academic partnerships

## Value Proposition

Daily ecological digital cognitive signals for CNS clinical trials. Alice provides high-frequency behavioral signal data from a 5-minute daily writing task, extracting implicit markers designed to detect within-subject cognitive change trajectories, substantially reducing practice effects, rater variability, and clinical site visit burden.

## The Signal Advantage for Pharma

### Why Implicit > Explicit for Drug Trials

Traditional cognitive tests are explicit: the patient knows they are being tested, tries to perform well, and learns the test over time. This creates:
- **Practice effects** that mask drug effects (patients improve from test familiarity, not treatment)
- **Performance anxiety** that adds noise
- **Gaming** (patients prepare, use compensatory strategies)
- **Rater effects** (different examiners score differently across sites)

Alice's signals are implicit: they are extracted from naturalistic writing behavior during a daily journal question. The patient does not know what is being measured. This substantially reduces or eliminates:
- Practice effects (each question is unique and cannot be anticipated, though the daily writing routine itself creates some familiarity)
- Performance anxiety (it's a journal, not a test)
- Gaming (you cannot optimize metrics you cannot see)
- Rater effects (signal extraction is algorithmic and deterministic)

### Signal-to-Endpoint Mapping

*Hypothesized mappings based on cognitive science literature. Each mapping requires empirical validation in the target population. See `scientific-foundation.md` for known limitations of the current evidence base.*

| Alice Signal | Hypothesized Cognitive Construct | Traditional Endpoint Analog |
|---|---|---|
| Inter-keystroke interval (IKI) distributions | Motor planning, processing speed | Trail Making Test, DSST |
| Pause architecture (between-word, between-sentence) | Lexical retrieval, working memory | Category Fluency, Digit Span |
| MATTR (lexical diversity trajectory) | Vocabulary access, semantic memory | Boston Naming Test, ADAS-Cog Word Recall |
| Semantic coherence | Discourse organization, executive function | CDR-SB (judgment, problem-solving) |
| P-burst patterns | Language production fluency | Verbal Fluency |
| Hedging density | Metacognitive monitoring, epistemic certainty | Clinical Global Impression |
| Revision behavior (backspace ratio) | Error monitoring, executive control | ADAS-Cog errors |
| Response latency | Cognitive processing speed | DSST, Coding |

### Sensitivity Advantage

Traditional endpoints sample cognition 4x/year (quarterly visits). Alice samples daily. The potential advantages, pending validation of sufficient signal-to-noise ratio at daily resolution:
- **Higher temporal density**: Within-subject trajectories are estimable with statistical power that quarterly snapshots cannot achieve, assuming daily signals carry independent cognitive information
- **Earlier signal detection**: Subtle cognitive changes that may be undetectable at quarterly resolution may become detectable at daily resolution
- **Reduced sample size requirements**: Higher measurement precision per participant may reduce the N needed to detect a given effect size
- **Missing data tolerance**: A participant who misses 30% of daily assessments still provides ~255 data points/year vs. 3 quarterly visits

## Key Messages

### For Clinical Development Leadership
"Daily digital cognitive endpoints designed to detect treatment effects with higher temporal resolution than quarterly ADAS-Cog administration. Substantially reduced practice effects, no rater variability, no site visits."

### For Regulatory Strategy
"An ecological cognitive signal instrument producing objective, algorithmic signal data amenable to biomarker qualification, compatible with decentralized trial architectures and FDA digital endpoint guidance."

### For Medical Affairs / KOL Engagement
"A research instrument generating novel candidate cognitive process signals at daily resolution, with foundations in the keystroke dynamics and computational linguistics literature. Psychometric validation in longitudinal context is the research opportunity."

### For Real-World Evidence Teams
"Post-market cognitive monitoring that patients experience as a daily journal, generating real-world cognitive trajectory data without clinical overhead."

## Differentiation

### vs. Cogstate / Cambridge Cognition / Linus Health
These are digital cognitive tests. They are computerized versions of explicit cognitive assessments. They retain the fundamental limitations of explicit testing: practice effects, performance anxiety, and patient burden.

Alice is not a test. It is a writing task that extracts cognitive signals implicitly. The patient does not know what is being measured. There is nothing to practice. The comparison is not Alice vs. digital cognitive tests; it is implicit vs. explicit measurement paradigms.

### vs. Wearable Biomarkers (Actigraphy, Gait Sensors, Speech Analysis)
Wearables capture physiological or motor signals. Alice captures cognitive-linguistic signals. These are complementary signal domains, not alternatives. A combined endpoint (physiological + cognitive) may be more sensitive than either alone.

### vs. Speech-Based Digital Biomarkers (Winterlight Labs, Ki:Elements)
Speech analysis is the closest methodological analog to Alice. Both extract cognitive signals from language production. Key differences:
- Alice uses written language (controllable pacing, revision possible), speech is spoken (real-time, no revision)
- Alice provides keystroke-level temporal data that speech analysis cannot (pause architecture within text production)
- Alice's daily question model generates consistent engagement; speech collection tasks are typically periodic

### Why Unmediated Writing Is a Measurement Validity Requirement

AI-mediated writing input (autocomplete, predictive text, AI-assisted drafting) does not add noise to behavioral signals. It replaces the cognitive construct being measured: a word accepted from a suggestion reflects suggestion evaluation, not lexical retrieval. The surface output is identical; the generating process is different (Arnold et al. 2020; Banovic et al. 2019). The contamination is invisible in the finished text, undetectable post-hoc, and persists even after AI assistance is removed (Zhou and Liu 2025). Any trial instrument that captures writing behavior without controlling for AI mediation is measuring an unknown mixture of human cognition and human-AI interaction. Alice requires unassisted writing by design. See `scientific-foundation.md` Section 4 for the full argument.

## Objection Handling

**"This hasn't been validated as a clinical trial endpoint."**
Correct. The validation pathway is: (1) establish psychometric properties in healthy controls, (2) demonstrate sensitivity to known cognitive differences (age, sleep deprivation, cognitive load), (3) pilot in an observational cohort alongside gold-standard endpoints, (4) qualify with FDA as an exploratory endpoint, (5) deploy in Phase 2 as secondary/exploratory alongside traditional primary endpoints. We are at steps 1-2 with academic partners.

**"How do you handle the regulatory pathway?"**
Alice's signals are objective, algorithmic, and reproducible (deterministic computation in Rust). The data architecture supports 21 CFR Part 11 compliance (audit trails, electronic signatures, data integrity). The FDA's 2023 decentralized trial framework and Digital Health Technologies guidance create pathways for novel digital endpoints. We pursue qualification through the Biomarker Qualification Program (BQP), starting with exploratory use in Phase 2 trials.

**"What about patients who can't type or have motor impairments?"**
The signal ensemble includes both motor-dependent signals (IKI, digraph latency) and motor-independent signals (lexical diversity, semantic coherence, hedging density, syntactic complexity). For populations with motor impairment, the linguistic signals remain valid. Voice-to-text with separate analysis pipelines is a roadmap extension.

**"How do you ensure compliance without gamification?"**
The AI-generated question model creates natural engagement without extrinsic motivation. Each question is novel, personally relevant, and generated from the participant's history. In consumer use, this model produces sustained engagement without streaks, badges, or reminders. For clinical trials, site coordinators can monitor completion rates (not content) and the low daily burden (5 minutes) supports compliance.

## Commercial Model

### Phase 1: Academic Validation Partnerships
- Co-funded validation studies with academic medical centers
- Signal psychometric characterization alongside established batteries
- Target 2-3 publications establishing signal properties

### Phase 2: Pharma Pilot Programs
- Exploratory endpoint in Phase 2 CNS trials (alongside traditional primary endpoints)
- Per-participant licensing with data export to pharma's clinical data management system
- Signal customization for specific therapeutic areas (e.g., Alzheimer's signal panel vs. MS cognitive fatigue panel)

### Phase 3: Platform Endpoint
- Qualified digital biomarker for regulatory submission
- Integration into decentralized trial platforms (Medidata, Veeva, Science 37)
- Signal data as component of composite endpoints

### Pricing
- **Pilot program**: Fixed fee for feasibility study (12-month, single-site, n=50-100)
- **Phase 2 deployment**: Per-participant-per-month + data pipeline setup
- **Platform license**: Annual enterprise license for portfolio-wide deployment
- **Signal development**: Custom signal panel development for specific indications (consulting engagement)
