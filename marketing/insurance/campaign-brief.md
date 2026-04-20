# Insurance and Actuarial Campaign Brief

## Market Context

The life insurance and long-term care industry faces a $400B+ exposure to cognitive decline risk that it cannot adequately model. Current underwriting uses:
- **Age** as primary risk factor (crude, non-individualized)
- **Family history** (binary, low predictive power for sporadic cases)
- **Clinical cognitive screening at application** (single snapshot, gaming-susceptible, detects only moderate-to-severe impairment)
- **Claims-based models** (lagging indicators: diagnosis codes appear years after cognitive decline begins)
- **Genetic risk scoring** (ApoE4 status: fixed at birth, probabilistic, not currently actionable for individual underwriting)

None of these capture **cognitive trajectory**: the rate and direction of an individual's cognitive change over time. Trajectory is the most predictive variable for cognitive decline outcomes, but it requires longitudinal measurement, which no current underwriting instrument provides.

The longevity insurance market (annuities, pension de-risking, long-term care) needs better cognitive risk modeling as populations age and cognitive decline becomes the dominant driver of long-term care claims.

## Target Personas

### Chief Actuary / VP of Actuarial
- Models mortality, morbidity, and long-term care risk
- Frustrated by the crudeness of age-based cognitive risk factors
- Knows that cognitive decline trajectories vary enormously between individuals of the same age
- Would use better cognitive risk data if it existed in a form actuarial models could consume
- Evaluates new data sources on: predictive power, longitudinal availability, cost per data point

### Head of Underwriting Innovation
- Looking for differentiated risk assessment capabilities
- Evaluating digital health data, wearables, and novel biomarkers for underwriting
- Needs instruments that applicants will actually use (low burden, non-clinical)
- Worried about adverse selection in cognitive-decline-linked products

### Long-Term Care Product Actuary
- Models long-term care utilization and claim duration
- Cognitive decline is the primary driver of extended care needs
- Needs early indicators of cognitive trajectory to price risk accurately
- Currently relies on age bands and family history (inadequate)

### Chief Medical Officer / Medical Director
- Evaluates clinical validity of underwriting instruments
- Needs evidence-based justification for new data sources
- Concerned about regulatory and ethical implications of cognitive screening
- Understands the difference between cognitive reserve and cognitive impairment

## Value Proposition

Longitudinal cognitive trajectory data for actuarial risk modeling. Alice provides years of daily behavioral signal data designed to characterize an individual's cognitive trajectory, enabling trajectory-based underwriting for longevity, long-term care, and life insurance products. The signals (lexical diversity trends, semantic coherence trajectories, processing speed patterns) are hypothesized to index cognitive reserve, with the potential for detection of trajectory changes in the pre-clinical window. Specific detection timelines require prospective validation.

## The Trajectory Advantage

### From Snapshot to Trajectory

Current cognitive underwriting (when it exists) takes a single measurement at the point of application. This is a snapshot. It tells you where the applicant is today. It does not tell you:
- The direction of change (improving, stable, declining?)
- The rate of change (gradual vs. accelerating decline?)
- The variability (stable signal vs. high day-to-day fluctuation, which itself is a risk marker?)

Alice produces longitudinal daily data. Over 12 months, an individual generates 300+ data points per signal. Over 5 years, the trajectory is estimable with high precision, including inflection points (when did the rate of change itself change?).

### Signal-to-Risk Mapping

*Hypothesized mappings based on cognitive science literature. Each mapping requires prospective validation with Alice's specific signal ensemble before actuarial use.*

| Alice Signal Trajectory | Hypothesized Cognitive Risk Interpretation | Actuarial Relevance |
|---|---|---|
| MATTR declining slope | Vocabulary access narrowing | Hypothesized early semantic memory decline (timeline requires prospective validation) |
| IKI variance increasing | Processing speed becoming inconsistent | Motor-cognitive integration degrading |
| Semantic coherence declining | Discourse becoming less organized | Executive function decline |
| Pause architecture fragmenting | Lexical retrieval slowing | Word-finding difficulty (early MCI marker) |
| Hedging density increasing | Epistemic uncertainty rising | Metacognitive monitoring decline |
| Response depth declining | Less engagement with cognitively demanding tasks | Cognitive withdrawal / apathy |
| Signal autocorrelation decreasing | Day-to-day cognitive consistency degrading | Instability as independent risk factor |

### The Pre-Clinical Window

Clinical cognitive diagnosis (MCI, dementia) typically occurs 5-10 years after the underlying pathology begins. During this pre-clinical window, cognitive changes are subtle enough to escape standard screening but may be detectable in high-frequency behavioral data.

Alice's signal engine is designed to detect trajectory changes in writing behavior during this pre-clinical window, before changes surface in standard cognitive screening. Whether it succeeds requires prospective validation against clinical outcomes. This is the window where actuarial intervention (pricing, reserve adjustment, product design) has the highest potential value.

## Key Differentiators

### vs. Clinical Cognitive Screening at Underwriting
| Dimension | Clinical Screen (MoCA, MMSE) | Alice Trajectory |
|---|---|---|
| Measurement | Single point-in-time | Longitudinal daily trajectory |
| Sensitivity | Detects moderate-to-severe impairment | Designed to detect pre-clinical trajectory changes |
| Gaming | Known items, preparation possible | Cannot game metrics you cannot see |
| Burden | Clinical appointment, trained administrator | 5-minute daily journal question |
| Cost | $200-500 per administration | Per-policyholder annual data fee |
| Predictive horizon | Current state only | Trajectory extrapolation over years |

### vs. Claims-Based Cognitive Risk Models
| Dimension | Claims Models | Alice Trajectory |
|---|---|---|
| Indicator type | Lagging (diagnosis codes, prescription fills) | Leading (behavioral signal trajectories) |
| Temporal position | After clinical diagnosis | Years before clinical diagnosis |
| Granularity | Binary (diagnosed / not diagnosed) | Continuous trajectory with slope and inflection points |
| Intervention window | After the risk has materialized | During the pre-clinical window |

### vs. Genetic Risk (ApoE4)
| Dimension | Genetic Risk | Alice Trajectory |
|---|---|---|
| When determined | Fixed at birth | Dynamic, changes over time |
| Modifiability | None (genetics don't change) | Cognitive reserve is modifiable (education, activity, engagement) |
| Predictive power | Probabilistic (ApoE4 increases risk, doesn't guarantee it) | Observed trajectory (measures actual cognitive change) |
| Individual specificity | Population-level risk estimate | Individual trajectory |
| Complementarity | ApoE4 status + Alice trajectory = genetic risk + observed cognitive trajectory |

## Key Messages

### For Actuaries
**"From snapshot underwriting to trajectory underwriting."**
Age tells you the population risk. A single cognitive screen tells you today's status. Alice tells you the direction, rate, and stability of cognitive change over years. Trajectory is the variable you've been missing.

### For Underwriting Innovation
**"Candidate leading indicators of cognitive decline, potentially years before clinical diagnosis."**
Claims-based models detect cognitive risk after the diagnosis code appears. Alice's behavioral signals are designed to operate in the pre-clinical window, where actuarial intervention has the highest potential value. Specific predictive timelines require prospective validation (see Phase 1 validation study).

### For Medical Directors
**"Cognitive reserve is modifiable and potentially measurable."**
Unlike genetic risk factors, cognitive reserve changes over time in response to intellectual engagement, physical activity, and social connection. Alice is designed to track behavioral signals hypothesized to index cognitive reserve longitudinally. Whether these signals reliably measure reserve is the research question the validation study addresses.

### For Product Design
**"Price long-term care risk with cognitive trajectory, not just age."**
Two 65-year-olds with identical health profiles may have radically different cognitive trajectories. Alice provides the data to differentiate them actuarially.

## Objection Handling

**"The signals haven't been validated against clinical cognitive outcomes."**
This is the validation study we propose as Phase 1. Keystroke dynamics and computational linguistics have established cognitive science literature. The specific mapping of Alice's signal trajectories to MCI/dementia conversion rates requires a prospective cohort study, which we propose to co-fund. The actuarial value justifies the validation investment.

**"Policyholders won't use a daily journal app for years."**
Alice's consumer product demonstrates that AI-generated questions from response history create sustained engagement without gamification. The key is question quality: each question is personally relevant and novel. For insurance products, the daily practice can be positioned as a cognitive wellness benefit (the policyholder gets the journal; the insurer gets the trajectory data with consent).

**"What about adverse selection? Healthy cognition policyholders opt in; declining policyholders don't."**
This is addressable through product design: offer the journal as a standard benefit at policy inception, before cognitive concerns arise. Early adopters establish baselines when healthy. The trajectory data is most valuable when it spans the pre-clinical window, which means starting measurement years before decline. Alternatively, incentivize participation with premium credits.

**"Regulatory: can we use cognitive trajectory data for underwriting?**
Current regulations vary by jurisdiction. Many states restrict use of genetic information (GINA) but do not restrict behavioral or cognitive data. Cognitive screening at underwriting is already standard practice for some carriers. Alice's data is behavioral (how someone writes), not medical (diagnosis or genetic status). Regulatory review is required per jurisdiction, but the category is behavioral data, not medical records.

**"How do you handle data privacy with policyholder cognitive data?"**
The policyholder's journal content is never shared with the insurer. Only computed signal trajectories (numerical time series) are shared, with explicit informed consent. The insurer never sees what the policyholder wrote, only how their cognitive signals change over time. Consent is revocable. Data deletion is guaranteed.

## Commercial Model

### Phase 1: Actuarial Validation Study
- Partner with 1-2 large life/LTC carriers and an academic medical center
- Prospective cohort: 500-1,000 policyholders aged 55-75, 24-month follow-up
- Correlate Alice signal trajectories with established cognitive assessments (MoCA, ADAS-Cog) administered at baseline, 12, and 24 months
- Co-funded: insurer provides cohort access, Alice provides instrument, academic partner provides cognitive assessment and analysis
- Deliverable: actuarial report on signal-to-risk predictive power + peer-reviewed publication

### Phase 2: Underwriting Pilot
- Integrate Alice trajectory data as supplementary underwriting factor for new LTC or longevity product
- 12-month pilot with actuarial analysis of signal-to-claims predictive power
- Per-policyholder data licensing fee

### Phase 3: Platform Product
- Annual per-policyholder licensing for cognitive trajectory data
- Real-time risk monitoring: automated alerts when policyholder signal trajectory crosses predefined thresholds
- Portfolio-level cognitive risk aggregation (reinsurance product)
- Integration with underwriting platforms (FAST, EXL, RGA AURA)

### Pricing
- **Validation study**: Co-funded (shared investment for shared IP)
- **Per-policyholder annual license**: Tiered by portfolio size
- **Portfolio risk monitoring**: Annual platform fee + per-policyholder data fee
- **Reinsurance cognitive risk index**: Separate product (aggregate, anonymized cognitive trajectory data across carrier portfolios)
