# Alice Go-to-Market Roadmap

## The Core Positioning Problem (and Why It's Actually an Advantage)

Alice is three things simultaneously, and most products that are three things fail because they dilute. Alice doesn't, because the three things are the same thing viewed from different angles:

1. **For researchers**: The first process-level cognitive measurement instrument with reconstruction validity
2. **For consumers**: The only tool that measures how you think, not what you think, without showing you the answer
3. **For enterprise/clinical**: A cognitive reserve biomarker that survives AI contamination of traditional assessment

The positioning advantage: you don't have to pick one. You sequence them. Research credibility unlocks clinical. Clinical credibility unlocks consumer trust. Consumer adoption generates the longitudinal dataset that makes the research irrefutable. It's a flywheel, not a trade-off.

---

## Phase 0: Foundation (Now through Month 3)

**Goal: Become citable before becoming sellable**

### What You Ship

- **Reconstruction Validity paper** (the method paper). This is the cornerstone. Without it, everything downstream is a wellness app making claims. With it, everything downstream is an instrument with published validation. The empirical data from 20 backfilled sessions is already compelling (motor L2 = 90.0, real perplexity always below ghost). Get it on arXiv.
- **Option C paper** ("The Quiet Debt"). This is the demand-creation document. It doesn't sell Alice. It identifies a problem that Alice happens to solve. Post it as a preprint, share it widely. Let people arrive at "so what do we do about this?" on their own.
- **Open-source the signal engine.** The Rust crate. Not the full application. The measurement instrument itself. This is counterintuitive but correct: nobody else has the question generation, the black box philosophy, the longitudinal design, or the avatar. The signal math is a gift to the field that makes Alice the reference implementation.

### Channels

- **arXiv / PsyArXiv** for both papers
- **Personal site / blog** for the accessible versions ("I built a journal that measures how I think")
- **Twitter/X threads** breaking down the Option C thesis (this is the kind of thing that goes viral in AI-skeptic and cognitive science circles)
- **Hacker News** for the technical story (Rust signal engine, keystroke dynamics, reconstruction adversary)

### Upside

- Papers establish priority. Nobody can claim this paradigm after you've published it.
- Open-source signal engine creates a community of researchers who build on your work and cite you.
- The Option C thesis is a cultural conversation starter. People are anxious about AI and cognition but don't have language for it. You provide the language.

### Downside

- Papers take time. Peer review is slow. Preprints move faster but carry less institutional weight.
- Open-sourcing the signal engine means someone could theoretically build a competitor. But they'd be building it on your published framework, citing your papers, using your terminology. You become the field, not just a player in it.

### Phase 0 Is the Critical Path

Every downstream phase depends on the Reconstruction Validity paper existing as a citable preprint. If Phase 0 takes six months instead of three, every phase shifts by three months. The dependency chain:

```
Reconstruction Validity paper (arXiv preprint)
├── Phase 1: researcher outreach requires a paper to attach to the cold email
├── Phase 2: consumer credibility ("published research" vs "a guy with a journal app")
├── Phase 3: clinical partnerships require published methodology
└── Phase 4: enterprise sales require published + clinical evidence

Option C paper
├── Phase 2: demand-creation essay depends on this existing
└── Independent of Reconstruction Validity (can be sequenced separately)

Open-source signal engine
├── Phase 1: researchers need the crate to evaluate the instrument
└── Depends on Reconstruction Validity paper (releasing the code before the method is published lets others claim the paradigm)
```

**Sequencing decision for Option C**: Publishing Option C alongside the Reconstruction Validity paper puts the thesis out ahead of the evidence. The thesis identifies a gap (AI eroding cognitive reserve) that Alice is positioned to test but has not yet tested. There's a safe version: Option C explicitly identifies the gap and defers the instrument validation to the Reconstruction Validity paper and future work. There's a risky version: Option C becomes the thing Alice is known for, and if the instrument later produces null results on cognitive reserve, the credibility damage hits both the paper and the product. The safe version requires disciplined scoping of what Option C claims. It should identify the problem and propose the measurement modality. It should not claim Alice has validated anything about cognitive reserve. That claim waits for data.

---

## Phase 1: Research Adoption (Months 3 through 9)

**Goal: Get Alice into 5 to 10 research labs**

### The Product

Alice Research Edition. Not a SaaS product. A deployable instrument package:

- Self-hosted PostgreSQL + Astro instance (Docker compose, one command)
- Pre-configured signal pipeline with the full Rust engine
- Data export in standard research formats (CSV, SPSS-compatible, R-compatible)
- IRB-ready consent flow templates
- Configurable question schedules (daily, weekly, event-triggered)
- Multi-participant support with anonymized IDs
- Raw keystroke export for researchers who want to run their own analyses

### Target Labs and Researchers

Based on the landscape research, these are the people who would use this tomorrow if it existed:

| Researcher | Institution | Why They Care |
|-----------|------------|---------------|
| **Leow** | UIC (BiAffect) | Already doing phone keystroke cognition. Alice gives them a controlled desktop instrument with richer signal space |
| **Crossley** | Vanderbilt | Transcription detection at 99%. Alice's process signals are the "content-process binding" Condrey proved is needed |
| **Fierrez / Morales** | UAM BiDA Lab | KeyGAN for PD phenotyping. Alice's longitudinal design is what their cross-sectional studies lack |
| **Leijten / Van Waes** | Antwerp (Inputlog) | Writing process research pioneers. Alice is Inputlog + signal computation + longitudinal tracking |
| **Kundu / Kumar** | IIIT Delhi | AI detection via keystroke. Alice's reconstruction residual is the answer to Condrey's attack |

### Go-to-Market Tactics

**Conference circuit** (boots on the ground):

- **CogSci 2026/2027**: Submit a demo paper. Set up a booth. Let people type into Alice for 5 minutes and show them their signal profile (not their content, not their signals numerically, just the shape: "your writing has high temporal complexity and low revision rate, here's what that pattern looks like compared to your ghost"). This is the hook.
- **CHI (ACM Human-Computer Interaction)**: The keystroke dynamics community lives here. Present the reconstruction validity framework.
- **Society for the Scientific Study of Reading**: P-burst analysis and writing process signals are bread and butter for this community.
- **AERA (American Educational Research Association)**: Writing assessment researchers. The Faigley-Witte deletion decomposition and MATTR work lands immediately.
- **Psychonomics**: Cognitive psychology. The cognitive reserve angle.

**Direct outreach**:

- Cold email the five researchers above with the preprint attached and an offer: "I'll deploy Alice in your lab for free for 12 months in exchange for collaboration on the validation study."
- This is not charity. Five labs running Alice on different populations (MCI patients, students, professional writers, bilingual speakers, aging adults) gives you the multi-population validation that makes the instrument credible.

**LinkedIn campaign** (targeted, not broadcast):

- Profile rewrite: not "software engineer" but "building the first process-level cognitive measurement instrument"
- Weekly posts. Not product announcements. Research dispatches: "Week 47 of measuring my own cognition: here's what happened when I changed question difficulty and tracked motor signal residuals." The n=1 longitudinal story is inherently compelling.
- Engage directly with cognitive science, digital phenotyping, and writing process researchers. Comment on their papers. Share relevant findings. Build relationships before pitching anything.
- Target connections: lab directors, postdocs (they're the ones who actually adopt new instruments), research software engineers at cognitive science labs

**Academic partnerships**:

- Offer co-authorship on validation studies to labs that deploy Alice. This is standard in instrument development. The MMPI, the BDI, the MoCA all built credibility through multi-site validation.
- Partner with one university's IRB to create a template approval package that other universities can adapt. IRB friction kills research tool adoption.

### Pricing

- **Free for academic research** with a data-sharing agreement (anonymized aggregate signals, not content). This builds the normative database.
- **Paid support tier** ($500/month per lab) for deployment assistance, custom question schedules, priority bug fixes. Most labs will pay this from grant funds without blinking.

### Upside

- Five labs means five publications citing Alice as the instrument. Citations compound.
- Multi-population data lets you establish normative ranges (what does "normal" PE spectrum look like for a 65-year-old vs a 25-year-old?). This is the dataset that makes clinical applications possible.
- Researcher adoption is the credibility moat. A consumer app can be copied. A cited, validated instrument can't.

### Downside

- Researchers are slow. A 12-month study takes 12 months. You won't see publications for 18 to 24 months.
- Free academic licenses mean no revenue from this segment initially. That's fine. This phase is an investment in credibility, not cash flow.
- Multi-site deployment means supporting multiple environments, debugging issues remotely, and handling researcher requests that may conflict with the instrument's philosophy.

---

## Phase 2: Consumer Launch (Months 6 through 18)

**Goal: 100 to 300 paying users who use Alice daily**

### The Product

Alice Personal. The thing you're building now, productized:

- Hosted (no self-hosting for consumers)
- One question per day
- Black box (never see your responses again)
- No gamification, no streaks, no social features
- Observatory view (the signal surfaces, stripped of interpretation per construct validity work)
- Monthly "shape of your thinking" reflection (Bob's output, not raw signals)

### Positioning

You are NOT competing with:

- Day One, Notion, Obsidian (those are content tools, Alice is a measurement tool)
- Headspace, Calm (those are wellness apps, Alice is a cognitive instrument)
- Lumosity, BrainHQ (those are brain training, Alice doesn't train you, it measures you)

You ARE the only product in a category that doesn't exist yet: **cognitive self-measurement**. The closest analogy is Oura Ring for your mind. Oura doesn't tell you to sleep better. It measures your sleep and lets you draw your own conclusions. Alice doesn't tell you to think better. It measures how you think and lets the shape speak for itself.

### The Black Box Problem

The black box is philosophically coherent with Alice's thesis and a genuine differentiator. It is also real adoption friction. Most people want to re-read their journals. The black box means Alice's addressable market is not "everyone who journals" but the subset who values the act of writing over the artifact of having written. That subset is real (3M+ copies of "Burn After Writing," Pennebaker's 200+ studies showing benefits are identical whether writing is kept or destroyed), but it is smaller than the journaling market and the marketing has to be honest about what Alice is asking people to give up.

The narrative should lead with what Alice gives (measurement of how you think, questions that sharpen over time), acknowledge what it costs (you don't get to re-read), and frame the cost as load-bearing (if you could re-read, you'd perform for your future self, and the measurement would degrade). The constraint needs to be marketed around, not disguised as a feature.

### The Consumer Narrative

"Every day, Alice asks you one question. You answer it. You never see your answer again. But Alice remembers how you wrote it: how long you paused, when you revised, whether your rhythm was steady or chaotic, how your vocabulary shifted mid-thought. Over weeks and months, a shape emerges. Not what you think. How you think. And that shape is yours."

### Channels

**Content marketing** (the primary channel):

- **The Option C essay**, rewritten for a general audience. Post it on your personal site, cross-post to Substack/Medium. Title suggestion: "The Thing AI Is Taking That Nobody Is Measuring." This is the awareness piece.
- **Weekly writing** about the experience of using Alice as a builder and user. The n=1 story. "What I learned from 100 days of one question." These posts should be honest, specific, and not pitchy. The product sells itself when people understand what it does.
- **Podcast circuit**: Lex Fridman, Ezra Klein, The Knowledge Project (Shane Parrish), Huberman. The cognitive reserve thesis is exactly the kind of thing these shows cover. You don't pitch Alice on these shows. You discuss the thesis. Alice comes up naturally as "the thing I built to measure this."

**Community**:

- **Not a Discord or Slack.** Alice's philosophy is monastic. Community should match. A monthly email. A quarterly essay. Maybe an annual gathering. The scarcity IS the brand.
- **Waitlist with a question.** Don't just collect emails. Ask people one question on the signup page. Let them feel what Alice is before they get access. This self-selects for the right users and creates word-of-mouth.

**Partnerships**:

- **Therapists and coaches** who work with high-performers. Not as a clinical tool (not yet), but as a reflective practice tool. "I recommend my clients use Alice the way I recommend they journal, but this actually measures something." Therapists are incredible distribution channels because recommendations carry trust.
- **Writing programs and retreats.** MFA programs, writing residencies, creative writing workshops. These are people who already value the process of writing, not just the output.
- **Monastic and contemplative communities.** Not a joke. Contemplative orders, meditation retreat centers, Zen centers. Alice's "one question, go deep" philosophy resonates with people who already structure their days around reflection.

**Paid acquisition** (secondary, targeted):

- Google Ads on searches like "cognitive health," "brain health tracking," "journaling for self-awareness," "alternative to brain training apps"
- Reddit ads in r/nootropics, r/quantifiedself, r/productivity (positioned as the antidote to productivity culture)
- Newsletter sponsorships: Brain Pickings (The Marginalian), Farnam Street, Stratechery

### Pricing

- **$9/month or $90/year.** Simple. No tiers. No freemium. Alice is not a trial experience. The commitment IS the product. If you're not willing to pay $9/month to answer one question a day, you're not the user.
- **Founding member pricing: $60/year for the first 1,000 users.** Locked for life. These people become your evangelists.

### Upside

- The "anti-app" positioning is resonant right now. People are burned out on engagement-optimized tools. Alice is the opposite. But this audience (the Readwise/old-Roam/Marginalian crowd) is small, loyal, and does not scale on organic alone. The cultural moment is real but more fragile than it looks. It can power a strong early cohort; it cannot power 1,000 users in year one without paid acquisition that may feel off-brand.
- The black box philosophy creates word-of-mouth among the right people. "There's this app that asks you a question every day and you never see your answer again" is inherently shareable. But shareable is not the same as convertible. Many people will find it interesting to hear about and wrong for them personally.
- **Realistic year-one target: 100 to 300 paying users.** That is a strong result for a monastic product with no freemium and no engagement hooks. At $9/month, that's $10K to $32K ARR. Not livable, but validation. 1,000 users is a year-two to year-three milestone, contingent on the research credibility from Phase 1 creating inbound demand.
- Even 200 daily users generating longitudinal keystroke data is scientifically significant. No keystroke dynamics study has this scale and duration in a naturalistic setting.

### Downside

- Consumer retention for a daily-question app is hard. Most journaling apps have terrible retention. Alice's philosophy (no gamification, no streaks) means you can't use the standard retention tricks. You have to earn it through genuine value.
- The "never see your responses" design will lose the majority of potential users who want to re-read their journal. The addressable market is smaller than "everyone who journals." The marketing has to find the people for whom the black box is the reason to use Alice, not the thing they tolerate despite using Alice.
- Scaling past the organic audience requires paid acquisition. Newsletter sponsorships and targeted Reddit/Google ads can work without feeling off-brand, but they cost money that a $10K-$32K ARR product doesn't generate. The gap between "enough users for validation" and "enough users for sustainability" is real and may last 12 to 18 months.
- Support burden. Consumer users expect things to work perfectly. A Rust signal engine that occasionally returns null because of insufficient data needs graceful handling that doesn't confuse people.

---

## Phase 3: Clinical Pilot (Months 12 through 36)

**Goal: Exploratory validation data for cognitive decline detection**

### The Thesis

This is where Option C becomes real. The claim: Alice can detect cognitive reserve erosion earlier than traditional neuropsych batteries, because it measures process (how you think) rather than product (what you get right), and it does so longitudinally in a naturalistic setting rather than cross-sectionally in a clinic.

The data from Phase 1 (research labs) and Phase 2 (consumer users) gives you the normative baseline. Now you need clinical data.

### The Product

Alice Clinical. Same instrument, different wrapper:

- HIPAA-compliant hosting
- Clinician dashboard (aggregate signal trends, NOT response content; the black box holds)
- Configurable alert thresholds (if PE spectrum deviation exceeds 2 standard deviations from personal baseline over 30 days, flag for clinician review)
- Integration with EHR systems (FHIR-compatible data export)
- Audit trail for regulatory compliance

### Partnerships

- **Memory clinics** (academic medical centers that specialize in MCI/dementia). Partners like UCSF Memory and Aging Center, Mayo Clinic ADRC, Mass General.
- **Digital phenotyping labs** that already have IRB infrastructure for passive monitoring studies. Leow's BiAffect group at UIC is the obvious first partner.
- **Pharma companies running cognitive decline trials.** Drug companies need cognitive endpoints for Alzheimer's trials. Current endpoints (ADAS-Cog, MMSE) are noisy, administered quarterly, and measure product not process. Alice's continuous process-level signals could complement them. But getting a novel endpoint into a registration trial is extremely hard. Pharma is risk-averse about endpoints because the FDA has to accept them. The realistic path: enter as an **exploratory secondary endpoint** in one or two trials, prove correlation with established measures (ADAS-Cog, CDR-SB), publish the concordance data, and then push for co-primary or primary status in later trials. That is a 5-to-10-year trajectory from first pharma engagement to primary endpoint status, not a 12-to-24-month outcome. The money in this phase comes from exploratory endpoint contracts, not primary endpoint fees.

### Regulatory Path

- **Start as a "wellness" device** (no FDA clearance needed). Alice measures and reports. It does not diagnose.
- **Pursue FDA breakthrough device designation** in parallel. The argument: existing cognitive assessment tools (MoCA, MMSE) are contaminated by AI assistance (people practice with ChatGPT), administered infrequently (annual), and measure product not process. Alice is a fundamentally new modality. Breakthrough designation gets you FDA collaboration on the approval pathway.
- **Generate Class II 510(k) data** through the clinical pilot. Predicate devices: computerized cognitive assessment tools (Cogstate, Cambridge Cognition). Alice is substantially equivalent in purpose but superior in modality.

### Upside

- If Alice can demonstrate earlier detection of cognitive decline than MoCA/MMSE in a published clinical study, the instrument enters the conversation for standard of care. That conversation takes years, but being in it at all is the milestone.
- Exploratory pharma endpoint contracts are smaller than primary endpoint fees ($100K to $300K per engagement, not $1M+), but they generate the concordance data that makes Alice credible for future primary status. The revenue compounds slowly. The credibility compounds fast.
- The cognitive reserve angle is politically powerful. Aging populations are a policy priority in every developed country. Government grants (NIH, NSF, EU Horizon) become accessible.
- AI contamination of traditional assessments is going to become a recognized problem in the next 2 to 3 years. Alice is the only instrument designed from the ground up to survive it.

### Downside

- FDA pathway is slow and expensive. Even breakthrough designation takes 12 to 18 months. Full clearance is 3 to 5 years.
- Clinical validation requires large sample sizes (hundreds of participants) and longitudinal follow-up (years). This is a multi-million-dollar endeavor.
- HIPAA compliance, EHR integration, and clinician-facing tooling are serious engineering efforts that pull resources from the core instrument.
- The "wellness" positioning while pursuing clinical claims is a regulatory tightrope. The FTC has cracked down on brain training companies (Lumosity paid $2M in 2016) for making unsubstantiated cognitive claims.

---

## Phase 4: Enterprise (Months 18 through 30)

**Goal: Cognitive wellness as an employee benefit**

### The Product

Alice Enterprise. Deployed per-organization:

- Company-managed instance (data stays within org's infrastructure)
- Aggregate dashboards for HR/wellness teams (population-level trends only, never individual responses or signals)
- Individual experience identical to Alice Personal (the employee sees exactly what a consumer sees)
- Optional integration with existing wellness platforms (Virgin Pulse, Wellable, Limeade)

### Positioning

Not "employee monitoring." The opposite of employee monitoring. Alice measures cognition with the same privacy architecture as a personal journal. The company gets aggregate cognitive health trends. The individual gets their own instrument. Nobody sees anyone else's responses. Ever.

The pitch to CHROs and wellness directors: "You measure physical health (gym memberships, step counters, biometric screenings). You measure mental health (EAP utilization, burnout surveys). You don't measure cognitive health. Alice does. And it does it without surveillance."

### Target Companies

- **Knowledge-worker companies** where cognitive performance is the product: consulting firms (McKinsey, BCG, Bain), law firms, investment banks, software companies
- **Companies with aging workforces** and cognitive decline risk: utilities, manufacturing, government agencies, airlines (pilot cognitive health is a literal safety concern)
- **Companies that have already invested in wellness**: Fortune 500 with existing wellness budgets. Alice is a line item, not a new category.

### Go-to-Market

**Direct sales** (this is a B2B sale, not a product-led growth play):

- Target wellness directors and CHROs at Fortune 500 companies
- Lead with the research (the published papers, the clinical pilot data, the normative database)
- Offer a 90-day pilot with 50 to 100 employees. Measure engagement and signal quality. Present aggregate findings.
- Contract structure: per-employee-per-month, minimum 100 seats

**Industry events**:

- **HLTH** (health and wellness technology conference)
- **HR Tech Conference**
- **SXSW** (the intersection of technology and human experience, Alice fits perfectly)
- **World Economic Forum** panels on AI and cognitive health (the Option C thesis is WEF material)

**Strategic partnerships**:

- **Health insurance companies.** If Alice can demonstrate that it reduces cognitive decline risk, insurers will subsidize it (same model as gym membership reimbursement). UnitedHealth, Aetna, Cigna.
- **Workplace wellness platforms.** Integration partnerships with Virgin Pulse, Castlight, Wellable. Alice becomes a module in their existing offering.

### Pricing

- **$15 per employee per month** (minimum 100 seats, annual contract)
- **$25 per employee per month** with clinical-grade reporting and EHR integration
- Volume discounts at 500+ and 1,000+ seats

### Upside

- Enterprise is where the revenue is. 1,000 employees at $15/month = $180K/year per customer. 20 customers = $3.6M ARR.
- Aggregate data from enterprise deployments massively accelerates the normative database. Every company is a population study.
- The "not surveillance" positioning is a competitive moat. No other cognitive tool can make this claim credibly because they weren't designed with the black box from the start.

### Downside

- Enterprise sales cycles are 6 to 12 months. Requires a dedicated sales team.
- Privacy concerns will be intense regardless of the architecture. Employees will be skeptical that their employer can't see their responses. Trust has to be earned through architecture transparency (publish the data flow, show the encryption, offer source code audits).
- HR buyers want dashboards and metrics. Alice's philosophy resists this. The tension between "aggregate cognitive health trends" and "no gamification, no dashboards" will need to be navigated carefully.
- Employee engagement will vary wildly. Some people will love it. Some will ignore it. A daily question is a bigger ask than a step counter.

---

## What a Platform Outcome Would Look Like (Not a Phase)

If Phases 1 through 4 succeed, certain things become possible that cannot be planned toward directly:

- **Alice Signal SDK**: The Rust signal engine as a standalone library for other applications. This is a byproduct of open-sourcing the engine in Phase 0 and other teams actually using it.
- **Alice API**: Process-level cognitive signals as a service. Only worth building if researchers are already asking for computation without the application.
- **Normative database**: A federated, anonymized dataset of process-level cognitive signals across populations. This emerges from multi-site research deployments and enterprise data, not from a data-commons initiative.

A standard (signal definitions, data formats, normative ranges) emerges from dominance, not from planning. If Alice becomes the instrument that five labs, three pharma trials, and ten enterprises use, the de facto standard is whatever Alice outputs. If it doesn't reach that density, no amount of protocol specification will create adoption.

Do not allocate engineering time to platform infrastructure until external demand makes it obvious. The signal that platform work is warranted: other teams are building adapters to Alice's output format without being asked.

---

## The LinkedIn Playbook

### Profile

- Headline: "Building the first process-level cognitive measurement instrument | Keystroke dynamics + Rust + Cognitive science"
- About: The n=1 story. "I've been answering one question a day for [X] months. I never see my answers again. But I measure how I write them." 3 to 4 paragraphs. End with the Option C thesis in one sentence.

### Content Calendar (Biweekly, Two Types)

Four post types on a weekly cadence is a content calendar that a solo builder abandons inside three months. Pick two and do them well. The two that carry the most signal for this audience:

| Cadence | Post Type | Example |
|---------|----------|---------|
| Week 1 | Research dispatch | "Week 60 of measuring my own cognition. Here's what happened to my permutation entropy when I switched from morning to evening sessions." |
| Week 2 | Thesis / philosophy | "AI is eroding something we can't measure with the tools AI has contaminated. Here's the gap." |

Research dispatches are the anchor. They're unique to you (nobody else has this longitudinal n=1 data), they demonstrate the instrument in action, and they attract the researchers you want to reach in Phase 1. Thesis posts provide the "why this matters" framing that connects the dispatches to the broader conversation.

Technical deep dives and story posts are good occasional content when something genuinely warrants it (a new Rust module lands, a paper drops, a design decision crystallizes). They're not sustainable as scheduled weekly obligations. Write them when the material is there, not because the calendar says to.

### Engagement Strategy

- Comment thoughtfully on posts by cognitive scientists, digital health researchers, AI safety people, and writing process researchers
- Share relevant papers with your own analysis (not just "interesting paper!" but "here's what this means for process-level measurement")
- Connect directly with the target researchers from Phase 1. Don't pitch. Share your work. Let them come to you.
- Post your preprints with accessible summaries

### Target Audience Tags

`#CognitiveScience` `#DigitalPhenotyping` `#KeystrokeDynamics` `#CognitiveReserve` `#WritingProcess` `#AIEthics` `#Rust` `#MeasurementScience` `#Psychometrics` `#Neuroscience`

---

## Boots on the Ground: In-Person Campaign

### Conference Priority List (in order of impact)

1. **CogSci** (cognitive science, the core audience)
2. **CHI** (HCI, the keystroke dynamics community)
3. **AERA** (education, writing assessment)
4. **Psychonomics** (cognitive psychology)
5. **HLTH** (health tech, clinical pathway)
6. **SXSW** (cultural moment, consumer awareness)
7. **NeurIPS/ICML** (AI safety angle, reconstruction adversary)
8. **WEF** (policy, the Option C thesis at global scale)

### The Demo

At every conference, the demo is the same: a laptop running Alice. You sit someone down. They answer a question for 3 minutes. You show them the shape of their session (NOT the content, NOT the numbers, just the visual shape: the pause patterns, the burst structure, the rhythm). Then you show them their ghost's version of the same shape. The gap between them is visible instantly.

This demo converts because it makes the abstract concrete. People can SEE that something was measured. They can SEE that their ghost is different from them. And they can't articulate why, which is the point: the irreducible residual is what makes them them.

### University Talks

Reach out to cognitive science, psychology, and computer science departments for invited talks. The talk title: "What Your Keystrokes Know That You Don't." 45 minutes. Demo included. This is how you recruit research partners, PhD students who want to work with Alice, and future employees.

---

## Revenue Projections

Realistic numbers for a solo-to-small-team operation building credibility before scale. All timelines are relative to Phase 0 completion (Reconstruction Validity paper on arXiv), not calendar months from today. If Phase 0 takes six months instead of three, every row shifts accordingly.

| Phase | Timeline (from Phase 0 end) | Revenue Source | ARR (conservative) | ARR (strong) |
|-------|----------------------------|---------------|---------------------|--------------|
| 0 | Month 0 (foundation) | $0 | $0 | $0 |
| 1 | Months 0 to 6 | Research support tiers | $18K | $36K |
| 2 | Months 3 to 15 | Consumer subscriptions (100 to 300 users) | $10K | $32K |
| 3 | Months 9 to 33 | Clinical pilots + exploratory pharma endpoints | $150K | $500K |
| 4 | Months 21 to 33 | Enterprise (5 to 10 customers) | $450K | $1.8M |

Phase 2 consumer revenue alone does not sustain the business. The bridge is research grants (SBIR Phase I at $275K, NIH R01 at $250K to $500K/year) plus clinical pilot contracts. Consumer adoption matters for longitudinal data and cultural credibility, not for cash flow. Sustainability likely arrives when clinical and enterprise revenue overlap, somewhere in year two to three.

---

## The Existential Risks

1. **Someone at Google/Apple ships a "cognitive health" feature using keystroke data from their billions of users.** They have scale. They don't have the black box philosophy, the measurement rigor, or the reconstruction validity framework. But they have distribution. Mitigation: published papers and open-source signal engine make you the cited standard. They'd be building on your work. And their incentive structure (engagement optimization) is fundamentally incompatible with Alice's philosophy. They'll gamify it. You won't. That's the moat.

2. **The cognitive reserve thesis turns out to be wrong.** Maybe AI doesn't erode cognitive reserve. Maybe the effect is too small to measure. Mitigation: Alice is valuable even if Option C is wrong. The instrument measures process-level cognition regardless of whether AI is the threat. Cognitive decline from aging, neurological disease, medication effects, sleep deprivation: these are all measurable with the same instrument.

3. **Regulatory crackdown on cognitive health claims.** The FTC or FDA decides that "measures how you think" is a medical claim. Mitigation: the wellness framing is genuine, not a dodge. Alice reports patterns. It does not diagnose. The clinical pathway (Phase 3) is the proper channel for diagnostic claims, pursued with proper validation.

4. **You burn out.** This is a multi-year, multi-phase roadmap and you're a solo builder. Mitigation: Phase 1 and Phase 2 generate revenue and research partnerships that let you hire. The first hire should be a research coordinator who manages lab partnerships. The second should be a Rust/systems engineer who can share the signal engine work.

5. **Privacy breach or data scandal.** Even with the black box architecture, any perception that keystroke data was misused would be devastating. Mitigation: publish the architecture. Open-source the data handling layer. Get a third-party security audit before consumer launch. Make the privacy story so transparent that a breach is technically impossible, not just unlikely.

6. **The paper doesn't land.** The preprint goes up, but peer review rejects it, requests major revisions, or drags out for 18+ months. The preprint still establishes priority and supports researcher outreach, but institutional credibility (the kind that unlocks clinical partnerships and enterprise sales) requires a peer-reviewed venue. Mitigation: target multiple venues in parallel (cognitive science journal for the method, HCI venue for the instrument, clinical informatics for the application). A rejection from one venue is a redirect, not a dead end. But the gap between "preprint on arXiv" and "published in a journal" is real, and Phase 1 credibility with cautious lab directors depends on which side of that gap you're on.

7. **The normative database never coheres.** Multi-population research deployments run on different question schedules, different participant demographics, different IRB-mandated data handling procedures. The data comes back in shapes that don't combine cleanly into a shared normative reference. Mitigation: define the minimum shared schema before the first research deployment (which signal families, which metadata, which export format). The Research Edition product spec should enforce this at the instrument level, not rely on post-hoc harmonization. If three labs export different column sets, you've already lost.

---

## The Single Most Important Decision

When to take funding, and from whom. Or whether to take it at all.

**The case for bootstrapping**: Alice's philosophy is incompatible with VC incentives. A VC wants 10x growth. Alice wants depth. A VC wants engagement metrics. Alice has no engagement metrics by design. A VC wants an exit. Alice is an instrument, not an acquisition target. Consumer revenue alone ($10K to $32K ARR in year one) does not sustain anything. But consumer revenue plus research grants (NIH R01s are $250K to $500K/year, NSF SBIR Phase I is $275K) plus clinical pilot contracts could sustain a small team (3 to 5 people) through Phase 3 without dilution. The grants are the bridge, not the consumer subscriptions.

**The case for funding**: The clinical pathway (Phase 3) requires capital that bootstrapping may not provide. An FDA validation study costs $1M to $5M. Enterprise sales requires a sales team. The right investor is someone who understands measurement instruments, not consumer apps. Think: health tech focused funds (Flare Capital, 7wireVentures, General Catalyst's health practice), or strategic investors (pharma companies with cognitive decline programs, health systems with innovation arms).

**The compromise**: Take an SBIR/STTR grant for Phase 3 clinical work. This is non-dilutive funding specifically designed for small companies doing exactly what Alice does: translating research into commercial application. NIH SBIR Phase I ($275K) to prove feasibility, Phase II ($1M to $1.7M) to conduct the validation study.

---

## What You Do Tomorrow

1. Finish the Reconstruction Validity paper. Get it on arXiv. This is the single dependency that everything else waits on.
2. Scope the Option C essay carefully: identify the gap, propose the measurement modality, defer validation claims to future work. Decide whether it publishes alongside or after the Reconstruction Validity paper based on how cleanly you can separate the thesis from the evidence.
3. Rewrite your LinkedIn profile.
4. Email Leow at UIC and Crossley at Vanderbilt with the Reconstruction Validity preprint attached. (Option C can follow separately if it's ready.)
5. Check CogSci and CHI submission deadlines. Submit a demo paper to whichever is next.

The roadmap is sequential and the Reconstruction Validity paper is the critical path. If it takes three months, downstream phases start at three months. If it takes six, they start at six. Everything else can be prepared in parallel but nothing launches until the instrument is citable.
