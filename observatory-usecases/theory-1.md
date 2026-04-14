# Theory 1: Observatory as Revenue Engine

## What We Have That's Commercially Defensible

The observatory isn't a dashboard. It's a **behavioral science instrument** with three layers no competitor has combined.

### Layer 1: The Signal Pipeline
70+ deterministic signals computed from raw keystroke dynamics + text analysis. P-bursts (Chenoweth & Hayes), Faigley-Witte deletion taxonomy, NRC emotion densities, inter-key intervals, commitment ratios — all graded by code, not LLM. This is what Receptiviti does with LIWC ($500-1,000/month API), except ours includes the **process** of writing, not just the output.

### Layer 2: The Behavioral Model
8 dimensions (fluency, presence, deliberation, revision, thermal, expression, commitment, volatility) composed from signals via z-scoring against personal history, with trait dynamics modeled as Ornstein-Uhlenbeck processes. Coupling matrices at -3 to +3 session lags. Closer to what KU Leuven's PersDyn lab publishes than what any commercial product offers.

### Layer 3: The Prediction Engine
Falsifiable behavioral predictions with structured criteria, deterministic grading against the signal registry, Bayesian theory updating (Beta-Binomial posterior, Sequential Probability Ratio Test), Thompson sampling for exploration. No one has this for individual behavioral trajectories.

---

## The Four Revenue Layers (Ordered by Philosophical Alignment)

### 1. Academic Methodology License — "The NRC Model"
**What you sell**: The signal registry, the 8D behavioral model, the prediction framework, and the grading system as a published, citable methodology.

**Who buys**: Computational linguistics researchers, writing process researchers, clinical psychologists studying journaling interventions, EdTech companies building writing tools.

**Pricing ladder**:
- Free for academic research (builds citations, adoption, credibility — how NRC, LIWC, and MRC became standard)
- Nominal one-time fee for commercial use (NRC model)
- Per-word/per-call API for enterprise ($500+/month, Receptiviti model)

**Why it fits**: Licensing the *lens*, not the *diary*. No user data moves. The signal registry in `signal-registry.ts` is already structured as a canonical, measurable vocabulary — practically an API spec.

**Market evidence**: LIWC generates significant commercial revenue through Receptiviti. IBM Watson Tone Analyzer's deprecation (Feb 2023) left a gap. Emotion AI text market is the fastest-growing segment of a $2.14B → $13.4B market (22.9% CAGR).

**Moat**: They only analyze *text*. We analyze the *process of writing it*. Keystroke dynamics, P-bursts, deletion patterns, revision chains, pause behavior — behavioral data no text-only API can produce.

---

### 2. Measurement-Based Care Platform — "The Blueprint Model"
**What you sell**: A clinician-facing tool where therapy clients journal daily (Alice) and the therapist's dashboard (observatory variant) shows behavioral trajectories, predictions, and coupling patterns — without ever showing the text.

**Who buys**: Therapy practices, university counseling centers, community mental health organizations, health systems implementing value-based care.

**Pricing**:
- Blueprint: $0.99/session for AI documentation
- Greenspace: per-organization (unlimited clinicians)
- Our model: free MBC tool for clinicians + per-organization subscription for advanced analytics ($200-500/month)

**Why it fits**: The black box transfers perfectly. Therapist never reads the journal — they see behavioral signal trajectories. Client writes into the void. System tells the therapist "deliberation spiked 2σ, commitment dropped, this matches the pattern from 3 weeks ago." More clinically useful than a PHQ-9 score.

**Regulatory pathway**: No FDA clearance needed for a measurement tool. CPT 96127 covers "brief emotional/behavioral assessment" at $4.97-25/unit. Need validation studies correlating dimensions against established instruments (PHQ-9, GAD-7, PCL-5), not clinical trials.

**Market**: Blueprint has 9,100+ clinicians, grew 12x since 2020. Greenspace has 500+ implementations. MBC market is proven and growing because value-based care contracts require outcome measurement. Our signal pipeline is orders of magnitude richer than "PHQ-9 score went from 14 to 8."

---

### 3. Behavioral Signal API — "The Receptiviti Killer"
**What you sell**: A real-time API that accepts keystroke event streams and returns behavioral signal vectors. Developers embed it in their writing tools, therapy platforms, education software, or research instruments.

**Who buys**:
- **Researchers**: Writing process studies (currently use expensive eye-tracking setups)
- **EdTech**: Student engagement/struggle detection during writing tasks
- **Therapy platforms**: Behavioral measurement layer for existing journaling features
- **HR/Corporate wellness**: Engagement signals from workplace writing

**Pricing**: Receptiviti charges $500-1,000/month per framework, 250K-10M words/month tiers. Price per-session (one writing episode with full keystroke stream). $0.01-0.05/session at volume, $500/month minimum.

**Architecture**: Client-side keystroke capture runs in customer's app. They send event stream to API. Return the signal vector — all 70+ signals plus 8D behavioral state. Customer's users' text never hits our servers — only keystroke timing metadata.

**Privacy model**: Apple differential privacy architecture adapted. Text stays local. Only behavioral timing data (inter-key intervals, pause durations, deletion timestamps) crosses the wire. Even if intercepted, meaningless without the text.

---

### 4. Research Cohort Platform — "The UK Biobank for Behavioral Writing Data"
**What you sell**: Access to an opt-in, anonymized longitudinal dataset of behavioral signal vectors from consenting users. Researchers bring compute to data (Trusted Research Environment model).

**Who buys**: Academic researchers in computational social science, clinical psychology, neurolinguistics, digital phenotyping.

**Pricing**: UK Biobank: GBP 500/3 years. Similar nominal access fee + compute costs. Or Prolific model — 25-30% platform fee on research transactions.

**How it works**: Users who use Alice (or any app powered by the API) opt in to contribute anonymized signal vectors to the research dataset. Never text. Never demographics that could re-identify. Just 8D behavioral trajectories, coupling matrices, and trait dynamics over time.

**Why it's valuable**: No longitudinal behavioral writing dataset like this exists. Closest is Pennebaker's studies — small-N, short-duration, text-only (no process data). Thousands of users with months of daily keystroke-level behavioral data would be unprecedented.

**Consent architecture**: MIDATA/Salus.coop cooperative model. Users own their data. Cooperative governs access. Revenue from research access fees flows back to cooperative. Most philosophically aligned — data serves knowledge, not extraction.

---

## Anti-Patterns (What NOT To Do)

1. **Don't go FDA/DTx** (yet). Pear Therapeutics had 40+ studies, large RCTs, published in top journals — and went bankrupt. US reimbursement pathway for digital therapeutics is broken. Germany's DiGA works (EUR 200-700/prescription, 1M+ prescriptions) but requires European clinical infrastructure.

2. **Don't go D2C premium subscription** (yet). Woebot shut down consumer app. Mindstrong collapsed. "Strava for mental health" only works at massive scale (Strava: 50M MAUs → $180M ARR; Oura: 5.5M rings → $1B). Need consumer juggernaut first.

3. **Don't sell to insurance**. Vitality/Personify model requires 18M+ members. Optimizes for population health management, not depth. Philosophically wrong.

4. **Don't let the LLM grade predictions for other people's data**. Deterministic grading in `grader.ts` makes predictions trustworthy. LLM evaluation of behavioral signals for clinical/research purposes → model collapse and liability. Code-based grading is the feature, not a limitation.

---

## Phased Execution

### Phase 1 (now → 6 months): Publish the Methodology
Write up signal registry, 8D behavioral model, and prediction framework as a working paper. Open-source the signal computation pipeline (not the app, just signal extraction). How LIWC became LIWC — academic adoption creates commercial demand.

### Phase 2 (6-12 months): Build the API
Extract keystroke → signal pipeline into standalone service. Price at Receptiviti tier ($500/month). Target writing process researchers first — currently using $50K eye-tracking setups to measure what our keystroke pipeline captures.

### Phase 3 (12-18 months): Validation Studies
Partner with 2-3 clinical psychology labs to correlate 8D dimensions against PHQ-9, GAD-7, and PCL-5 over time. Turns a tool into an instrument.

### Phase 4 (18+ months): Launch the MBC Platform
Blueprint-style free tier for clinicians, paid organizational analytics. By then: citations, API customers, and validation data.

---

## Research Foundations

### Comparable Companies and Revenue Models

| Company | Model | Revenue | What They Sell |
|---------|-------|---------|----------------|
| **Receptiviti** | Linguistic analytics API | $500-1,000+/month | LIWC commercial license, Big Five, emotions |
| **Blueprint** | MBC SaaS | $0.99/session (12x growth since 2020) | Free MBC tools, AI documentation, outcomes data |
| **Greenspace** | MBC SaaS | Per-org subscription | 500+ evidence-based assessments, training |
| **Good Judgment** | Prediction consulting | $5.4M revenue | Superforecaster panels, calibrated predictions |
| **Prolific** | Research marketplace | 25-30% platform fee | Participant recruitment, quality screening |
| **Strava** | Consumer subscription | $180M ARR | Training analysis, route planning, social |
| **Oura** | Hardware + subscription | $1B (2025) | Ring + $5.99/mo, Oura for Business |
| **Whoop** | Subscription-only | $260M | AI coaching, journals (10+/mo = 15% higher retention) |

### Market Sizes

| Market | Current | Projected | CAGR |
|--------|---------|-----------|------|
| Emotion AI | $2.14B (2024) | $13.4B (2033) | 22.9% |
| Digital Therapeutics | $10.15B (2025) | $67.58B (2034) | 23.55% |
| AI in Mental Health | — | $22.67B (2033) | 12.8% |
| Employee Wellness | ~$56B (2022) | $109B (2030) | ~8% |

### Key Academic References

- Pennebaker & Beall (1986). "Confronting a Traumatic Event." *Journal of Abnormal Psychology*.
- Tausczik & Pennebaker (2010). "The Psychological Meaning of Words." 2,045+ citations.
- Chenoweth & Hayes (2001). P-burst research.
- Faigley & Witte (1981). Revision taxonomy.
- Sosnowska et al. (KU Leuven, 2019). PersDyn trait dynamics.
- Tetlock & Gardner (2015). *Superforecasting*.
- Shumailov et al. (Nature 2024). Model collapse.
- Torous et al. (2016). Digital phenotyping definition.
- "Balancing Privacy and Utility in Personal LLM Writing Tasks" (ACL PrivateNLP 2025).
- "Interpretability as Alignment" (arXiv 2509.08592, September 2025).

### Key Insight

The observatory doesn't need to become something different. It needs to become the **reference implementation** of a methodology that other people pay to use. The signal pipeline is deterministic, the grading is code-based, and the behavioral model is academically grounded. Not selling vibes or AI-generated insights — selling a measurement instrument.

---

## The Distribution Problem (How This Actually Makes Money)

The technology problem is solved. The distribution problem is not. Receptiviti isn't rich because LIWC is brilliant — they're rich because Pennebaker published 400 papers and every psychology department on earth already knew the name.

### Fastest Money: License to Existing Players

Don't build the company. **Sell the engine to someone who already has customers.**

- **Blueprint** (9,100 clinicians, 12x growth) currently uses PHQ-9/GAD-7 — simple screening scores. The signal pipeline is 10x richer. Approach with integration proposal. Licensing deal: upfront fee + per-session royalty.
- **Receptiviti** has the LIWC API market locked. But they have zero keystroke/process data. We have something they literally cannot build without this research. Partnership or acquisition conversation.
- **Any EdTech writing platform** (Grammarly, Turnitin, Quill.org) would pay for engagement/struggle detection signals that don't require reading the student's text.

One licensing deal could be $50-200K upfront + recurring royalties. No team, no sales pipeline, no HIPAA compliance needed.

### Medium-Term Money: The API

Extract the signal pipeline. Ship it as a standalone service. Target the buyer with the **shortest sales cycle and biggest pain**:

**Writing process researchers.** They currently spend $30-50K on Tobii eye-trackers to measure what the keystroke pipeline captures passively. ~200 active writing process research labs globally. At $500/month, 50 labs = $300K ARR. Small market, but:
- They publish papers citing the methodology (free marketing)
- Their grad students take jobs at EdTech companies (distribution)
- Their validation studies make the clinical pitch possible (credibility)

This is how LIWC grew. Pennebaker gave it away to academics who published 2,045+ citations, then Receptiviti locked down the commercial license.

### Big Money: The MBC Platform

The $10M+ path. Requires one thing not yet in place: **clinical validation.** Without published correlations between the 8D dimensions and PHQ-9/GAD-7/PCL-5, no therapy practice will touch it.

The move: find one clinical psychology PhD student who needs a dissertation topic. Give them free access to the methodology. They run a 50-person, 12-week study correlating dimensions against standard instruments. That one paper turns Theory 1 into a fundable company.

Blueprint raised $29.7M. Greenspace got a Series B. NeuroFlow raised $72.3M. The MBC market is throwing money at anyone with validated outcome measurement.

### The Honest Math

| Path | Time to first dollar | Ceiling | What you need |
|------|---------------------|---------|---------------|
| License deal | 2-3 months | $200K+/yr | 5 warm intros to the right people |
| Research API | 4-6 months | $300K-1M ARR | Extract pipeline, land 20-50 labs |
| MBC platform | 18-24 months | $10M+ ARR | 1 validation study, seed round, team |
| Research cohort | 3+ years | Massive but speculative | User base not yet built |

### What To Do Tomorrow

1. **Package the signal registry as a whitepaper.** Not a full academic paper — a 10-page technical document showing what the pipeline measures, how it's grounded, and what it predicts. This is sales collateral for every path above.

2. **Email 3 people.** One at Receptiviti, one at Blueprint, one writing process researcher. The message: "I built a keystroke-level behavioral signal pipeline that produces 70+ deterministic metrics from the writing process — not just the text. No LLM in the measurement loop. Here's the whitepaper. Want to talk?"

3. **Open-source the signal computation layer** (not Alice, not the observatory — just the keystroke → signal math). GitHub stars are distribution. Researchers who use it become advocates. This is the Pennebaker playbook.

**The technology makes you interesting. Distribution makes you rich.** The fastest path between those two points is getting the methodology in front of people who already have customers and letting them pay for what they can't build themselves.
