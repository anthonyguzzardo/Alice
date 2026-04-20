# Clinical Research Campaign Brief

## Market Context

Cognitive science, neuropsychology, and aging research face a persistent measurement problem: longitudinal cognitive assessment requires repeated clinical visits, is expensive, suffers from practice effects, and produces sparse temporal data (quarterly at best). Ecological momentary assessment (EMA) improves frequency but typically relies on self-report, which introduces Hawthorne effects and social desirability bias.

The field needs a daily, ecological, implicit cognitive measurement instrument that participants will actually maintain. Retention is the critical barrier: median mental health app retention is 30 days, and 70% of digital mental health program participants abandon within 100 days.

Alice addresses both problems simultaneously. The black box design substantially reduces observer effects. The single-question model with AI-generated questions from history creates natural engagement without gamification. The signal engine extracts candidate cognitive process markers from writing behavior, not self-report.

## Target Personas

### PI / Lab Director
- Runs longitudinal studies (12+ months) on cognitive aging, reserve, or decline
- Frustrated by sparse measurement windows and attrition
- Needs ecological validity alongside psychometric rigor
- Cares about clean data, replicability, and peer review
- Has grant funding; evaluates instruments on scientific merit

### Neuropsychologist / Cognitive Assessment Specialist
- Administers traditional batteries (MoCA, MMSE, ADAS-Cog, RBANS)
- Knows the limitations: practice effects, testing anxiety, floor/ceiling effects
- Interested in continuous cognitive monitoring between formal assessments
- Wants complementary data, not replacement of standard batteries

### Research Coordinator / Data Manager
- Manages participant compliance and data quality
- Knows that study attrition kills power
- Needs low-burden instruments that participants actually use
- Values clean data pipelines and export formats

## Value Proposition

A longitudinal cognitive signal instrument that collects daily behavioral data without observer effects. Participants engage with a single AI-generated question daily. The signal engine extracts candidate cognitive process markers from response behavior. Participants experience a journal. Researchers access behavioral signal data for cognitive analysis.

## Signal Inventory (Candidate Cognitive Process Markers)

*Note: The algorithms below are implemented and computing. Their status as cognitive measures in a longitudinal journaling context is the research opportunity, not an established fact. Signal-to-construct mappings are hypothesized based on cognitive science literature. See `scientific-foundation.md` for the evidence chain and known limitations of the current evidence base.*

### Temporal Signals
- Inter-keystroke interval distributions (IKI)
- Pause architecture (within-word, between-word, between-sentence durations)
- Response latency (time from question presentation to first keystroke)
- Session duration and revision behavior

### Linguistic Signals
- Moving Average Type-Token Ratio (MATTR) for lexical diversity trajectory
- Semantic coherence (embedding similarity across response segments)
- Syntactic complexity (clause depth, sentence length distributions)
- Hedging density and epistemic certainty markers
- NRC emotion density profiles

### Process Signals
- P-burst and R-burst patterns (production vs. revision bursts)
- Digraph latency profiles (motor planning markers)
- Backspace ratio and revision-to-production ratio
- Response abandonment patterns

### Derived Measures
- Within-subject change trajectories (individual slopes over time)
- Signal autocorrelation structure (temporal dependencies)
- Cross-signal coherence (do linguistic and temporal signals co-move?)

## Key Differentiators

### vs. Traditional Neuropsych Batteries (MoCA, MMSE, ADAS-Cog)
| Dimension | Batteries | Alice |
|---|---|---|
| Frequency | Quarterly or annual | Daily |
| Practice effects | Documented and problematic | Substantially reduced (unique question each day) |
| Ecological validity | Low (clinical setting) | High (participant's own environment) |
| Participant burden | 30-90 minutes per session | 3-10 minutes daily |
| Data density | 4-12 data points per year | 365 data points per year |
| Signal type | Performance on explicit tasks | Implicit behavioral process markers |
| Observer effects | Present (examiner in room) | Substantially reduced (black box design) |

### vs. Digital Cognitive Assessment (Lumosity, Cambridge Cognition, Cogstate)
| Dimension | Digital Tests | Alice |
|---|---|---|
| Task type | Explicit cognitive tasks (memory, attention, processing speed) | Natural writing behavior |
| Practice effects | Present (users learn test patterns) | None (no test to learn) |
| Motivation | Test-taking creates anxiety or boredom | Journal question creates reflection |
| Retention | Poor (users abandon boring tests) | AI question generation maintains relevance |
| Signal breadth | Task-specific (what the test measures) | Multi-dimensional (keystroke + linguistic + process) |

### vs. Wearable Biomarkers (WHOOP, Oura, Fitbit Research)
| Dimension | Wearables | Alice |
|---|---|---|
| Signal domain | Physiological (HR, HRV, SpO2, actigraphy) | Cognitive-linguistic (writing behavior) |
| What it detects | Physical readiness, sleep quality, stress response | Cognitive process quality, language production, decision patterns |
| Complementarity | Does not measure cognition | Does not measure physiology |
| Participant burden | Wear a device | Answer a question |

**Position**: Complementary, not competitive. Alice + wearable = physiological AND cognitive signal streams. The research value is in combining them.

### Why Unmediated Writing Matters for Research Validity

Alice requires unassisted writing because AI-mediated input produces construct replacement, not noise. A word accepted from a predictive text suggestion is not a noisy measurement of lexical retrieval; it is a clean measurement of suggestion evaluation (Arnold et al. 2020; Banovic et al. 2019). The contamination is invisible in the finished text and undetectable post-hoc. The effects persist even after AI is removed (Zhou and Liu 2025). Any keystroke-cognition instrument that does not control for or prevent AI mediation is measuring an unknown mixture of human cognition and human-AI interaction. See `scientific-foundation.md` Section 4 for the full argument and citations.

### vs. Ecological Momentary Assessment (EMA)
| Dimension | Standard EMA | Alice |
|---|---|---|
| Content | Repeated self-report questions (mood scales, symptom checklists) | AI-generated questions from response history |
| Observer effects | Present (users know they're being assessed) | Absent (users experience a journal) |
| Signal extraction | Self-report only | Implicit behavioral signals from writing process |
| Habituation | Severe (same questions become automatic, responses degrade) | None (questions are never repeated) |

## Key Messages

### For Grant Applications / IRB
"A daily ecological cognitive measurement instrument that extracts implicit behavioral signals from naturalistic writing, substantially reducing the practice effects and observer-awareness contamination inherent in traditional neuropsychological assessment."

### For Conference Presentations
"Longitudinal cognitive signals at daily resolution, without the Hawthorne effect."

### For Recruitment / Participant Communication
"A daily journal that asks you one question. Your responses help researchers understand how thinking changes over time."

### For Department Heads / Funders
"Up to 365 behavioral signal observations per year per participant, from a 5-minute daily practice designed for sustained engagement."

## Objection Handling

**"The signals haven't been validated against established cognitive batteries."**
Correct. This is the research opportunity, not the limitation. Keystroke dynamics (IKI distributions, pause architecture) have established literature linking them to cognitive load, working memory, and motor planning. The validation of Alice's specific signal ensemble against gold-standard batteries is a publishable study itself. We provide the instrument; the validation is the research.

**"How do you ensure participants keep using it?"**
The AI-generated question model creates natural engagement: each question is unique, calibrated to the participant's history, and cannot be anticipated. This eliminates the habituation problem that kills EMA compliance. The one-question format takes 3-10 minutes, keeping burden low. No gamification means no streak anxiety when participants miss days (missing days is data, not failure).

**"Is the signal engine validated?"**
Individual signal components (MATTR, IKI distributions, P-burst analysis) have established psychometric properties in the writing research literature. The Rust-based signal engine implements these algorithms with deterministic, reproducible computation. The ensemble approach (combining multiple signal families) and its relationship to cognitive constructs is the novel contribution.

**"What about typing skill as a confound?"**
Within-subject designs are the primary use case. Individual differences in typing skill are controlled by the longitudinal design: each participant serves as their own baseline. Change trajectories, not absolute values, are the primary outcome.

## Go-to-Market

### Phase 1: Seed Collaborations
- Partner with 2-3 cognitive aging labs for pilot validation studies
- Provide instrument + data pipeline at no cost in exchange for co-authorship
- Target labs with existing longitudinal cohorts (add Alice as a supplementary measure)

### Phase 2: Conference Presence
- Present pilot data at Cognitive Aging Conference, Society for Neuroscience, AAIC
- Workshop: "Daily ecological cognitive measurement: methodology and signal properties"
- Poster sessions with preliminary validation data

### Phase 3: Instrument Licensing
- License signal data access to research institutions (annual site license)
- Participant-facing app provided free; researcher dashboard and data export are the product
- IRB template and informed consent language provided

### Pricing Model
- **Pilot partnership**: Free (first 3 labs, co-publication agreement)
- **Academic license**: Per-participant annual fee (scaled by cohort size)
- **Data export API**: Included with license
- **Signal customization**: Custom signal development for specific research questions (consulting engagement)
