# Roadmap

**Date:** 2026-04-15
**Predecessors:** Theories 1-9, simulation handoffs v1-v2, observatory spec, README

---

## The Thesis

_The practice that protects your mind is the same one that would detect if something changes._

Journaling is neuroprotective (Pennebaker & Beall 1986; Cache County: 53% dementia risk reduction — never replicated, caveat accordingly). The writing process carries cognitive signal with longitudinal reach unmatched by cross-sectional tests: the Nun Study lineage (Snowdon 1996; Clarke et al. 2025 30-year follow-up) shows early-life idea density predicts Alzheimer's onset and neuropathology across 6+ decades — this is the field's strongest anchor. Meulemans, Van Waes, and Leijten (2022) is the closest published keyboard-keystroke study of cognitively impaired writers (n=30, cross-sectional; large effect sizes: 108 fewer chars/min, 20.6% more pause time). Other frequently cited studies — Kim et al. 2024 (keystroke, AUC 0.997) and Li et al. 2025 (touchscreen handwriting, AUC 0.918) — report impressive numbers but are in-sample ROC on small samples with stepwise feature selection and no external validation; treat as directional, not as validated diagnostic performance. The measurement IS the intervention. No other cognitive assessment modality has this property.

Alice is a longitudinal cognitive record that uses journaling as its capture method, clinical validation as its proof, and AI interpretation as its interface. The journal, the instrument, the health tracker, and the thinking partner are all faces of the same thing at different stages of maturity and different points in the go-to-market.

---

## What's Already Built

The codebase is the instrument. There is no consumer orientation to pivot from.

**Layer 1 — Measurement (code, model-independent):**
- 70+ deterministic signals from keystroke dynamics + linguistic content
- P-burst production fluency (Chenoweth & Hayes 2001)
- Deletion decomposition (Faigley & Witte 1981)
- NRC emotion densities (Mohammad & Turney 2013)
- MATTR lexical diversity (McCarthy & Jarvis 2010)
- 8D behavioral state vectors (fluency, presence, deliberation, revision, thermal, expression, commitment, volatility)
- PersDyn trait dynamics — baseline, variability, attractor force (Sosnowska et al. 2019)
- Within-person z-scoring against personal history
- Coupling matrices at -3 to +3 session lags

**Layer 2 — Evaluation (code, model-independent):**
- Deterministic prediction grading against structured criteria
- Thompson sampling for theory selection (no LLM in the loop)
- Bayesian confidence (Beta-Binomial posterior, Sequential Probability Ratio Test)
- Bayes factor lifecycle (active → established → retired)

**Layer 3 — Interpretation (LLM-dependent):**
- Three-frame observation (charitable / avoidance / mundane)
- Suppressed question generation
- Falsifiable behavioral predictions via tool use
- Weekly reflections with independent audit model
- Calibration content extraction (incidental supervision)

Layers 1 and 2 are what researchers buy. Layer 3 is what makes the consumer product compelling after the science is validated.

---

## The Three Survival Constraints (Theory 7)

Every architectural decision must satisfy all three simultaneously. These are not aspirational — they are reverse-engineered from $1.8B in digital health failures.

**1. Modality-Agnostic.** The clock-drawing test is failing because Gen Z can't read analog clocks. Keyboard-only assessment will fail next — keyboarding course enrollment dropped from 44% to 2.5% between 2000 and 2019. The instrument must capture the cognitive act of composition independent of the input device. The core diagnostic signal comes from modality-invariant features (word retrieval latency, revision frequency, compositional fluency, coherence structure) — not modality-specific features (hold time, flight time). Modality-specific features add value when available but are not load-bearing.

**2. Process-First.** LLMs miss 60-70% of dementia cases because they equate verbal fluency with cognitive health (Zadok et al. 2026). Content is the last thing to go. Process is the first. The diagnostic power is in pause patterns, revision behavior, production fluency, and timing — not in the text itself. Content analysis is complementary, not primary.

**3. Payment-Ready.** Four companies with FDA-authorized products and >$300M in combined capital died because insurers wouldn't pay. CMS ACCESS (launching July 2026) has no cognitive track. The instrument enters through existing payment doors — research licensing (immediate), behavioral health monitoring via ACCESS Track 4 (2026-2028), cognitive assessment (2028+ as evidence matures). No disease claims in the consumer product (General Wellness exemption).

---

## The Sequence

### Phase 1: The Instrument

**Goal:** Get the signal pipeline into research labs. Let them validate it.

**What to build:**
- Research admin panel (configure study parameters, seed questions, calibration protocol)
- Signal export layer (CSV/JSON of all computed signals per session)
- Multi-tenant hosting (each study gets an isolated instance)
- Documentation mapping each signal to its research basis
- Modality abstraction layer — separate modality-specific features (hold time, flight time) from modality-invariant features (pause-to-production ratio, revision frequency, coherence trajectory) so the pipeline works across input channels
- Strip Layer 3 — researchers get raw signals, not AI interpretation

**Who buys:**
- Writing process research labs (~1,000+ using Inputlog, which is Windows-only, single-session, linguistically limited, with emeritus leadership)
- Cognitive science labs studying writing and cognition (Antwerp, Edinburgh, UCSF, Boston University, KU Leuven)
- Clinical trial sponsors who need continuous cognitive endpoints between quarterly visits

**What they do for us:**
- Publish papers validating which signals carry diagnostic weight
- Correlate signals against MoCA, MMSE, neuroimaging, PHQ-9, GAD-7
- Build the evidence base we can't build alone
- Every paper citing the methodology is free distribution

**Revenue:** Academic licenses ($15-30K/year per lab). TAM is $7.5-15M at full penetration — a stepping stone, not a destination.

**Funding:** R21 ($275K/2yr) or SBIR Phase I ($323K) — zero competition in this exact niche. NIA digital biomarker track funded 10 SBIR awards in FY2024-2025. Next receipt date: September 5, 2026 (programs reauthorized April 13, 2026 after congressional lapse).

**The incumbent to displace:** Inputlog (University of Antwerp). Windows-only, no longitudinal tracking, no content analysis, no web deployment. A generational upgrade, not an incremental one.

### Phase 2: Behavioral Health Entry + Clinical Validation

**Goal:** Published evidence that the signals predict real clinical outcomes, entering through a payment door that already exists.

**The payment entry (Theory 7, Constraint 3):**
- CMS ACCESS Track 4 covers behavioral health (depression/anxiety) starting July 2026
- Depression and cognitive decline are comorbid in 30-50% of early dementia cases
- An instrument positioned as a behavioral health monitoring tool that *also* captures cognitive process metrics enters through this existing door
- This is not regulatory arbitrage — depression screening that includes cognitive process metrics is better depression screening

**What happens:**
- Partner with 2-3 labs running 12-week studies (50+ participants, MCI vs healthy aging)
- Correlate 8D behavioral dimensions against established instruments (MoCA, MMSE, PHQ-9, GAD-7)
- Target publications: (1) "Longitudinal Writing Process Signals Differentiate MCI from Healthy Aging" and (2) the demographic choke point argument from Theory 6 as a standalone methods paper
- Publish every validation study (the Mindstrong anti-pattern: five trials, zero publications)

**What this unlocks:**
- Conversations with Linus Health, Cambridge Cognition, Cogstate (potential licensing or acquisition)
- Behavioral health reimbursement via ACCESS Track 4 ($30/service quarterly for co-management)
- Credibility for the consumer pitch — not "we think this works" but "University of Edinburgh published the study"

**Timeline:** Dependent on Phase 1 adoption. First validation study realistically starts 6-12 months after first lab deployment.

### Phase 3: Consumer Product with Clinical Anchor

**Goal:** Market to consumers as a cognitive wellness journal — no disease claims (General Wellness exemption).

**The pitch:** We built this for clinical research. It detects early cognitive decline better than the gold-standard screening tests. But it's also a depth practice — a daily journal that happens to accumulate the richest longitudinal cognitive dataset ever collected about you. Use it for the journaling. The protection accrues as a byproduct.

**The clinical anchor:**
- Behavioral health monitoring as the reimbursable framing (not standalone cognitive assessment — that category doesn't exist yet)
- Trajectory view instead of snapshot score: not "your MoCA is 26/30" but "your cognitive processing markers are stable over 30 days"
- Cognitive process metrics embedded within behavioral health assessment, not as standalone cognitive claims
- The cognitive assessment claim emerges from the evidence base over time — it is the destination, not the starting position

**The mass appeal:**
- After years of data, the system tells you things about yourself you can't see from inside your own life
- This is Bob. The longitudinal AI thinking partner. The payoff of years of validated signal data.

**Retention model:**
- The longer someone uses it, the more valuable their baseline becomes — to them
- A 40-year-old who journals for 20 years has a personal cognitive trajectory no clinical instrument could reconstruct
- Leaving means abandoning your own longitudinal dataset
- No gamification needed. The value compounds with time. Depth is what keeps someone writing at year 15.
- The same data architecture that monitors cognition also captures cognitive identity — characteristic thought patterns, reasoning style, revision strategies (Theory 8). The health use case provides the reason to start writing. The reconstruction use case provides the reason to never stop. This is an architectural fact, not a marketing claim.

### Phase 4 (Much Later): Pharma Trial Endpoints + Cognitive Assessment

**Goal:** Continuous cognitive measurement between quarterly clinic visits. Standalone cognitive assessment claims backed by a mature evidence base.

- Alzheimer's drug trials need cognitive endpoints measured more often than every 90 days
- Participants journal daily from home
- Trial sponsor gets continuous trajectory data supplementing standard ADAS-Cog
- Writing-based endpoint fills the 90-day gaps with actual data instead of nothing
- When the political will that produced the ASAP Act extends to digital biomarkers — or when a cognitive track is added to ACCESS — the instrument has years of validated data and an established user base
- By 2040, 70-year-olds will have typed daily for 20-40+ years. The motor noise floor drops. The cognitive signal emerges. The first generation of lifelong typers enters the risk window with the science ready to meet them.

---

## The Demographic Tailwind (Theory 6)

Every keystroke-cognition study published to date shares a confound no one has named: **the populations being studied for neurodegeneration learned to type in middle age or not at all.** The research community is evaluating the most promising digital cognitive biomarker modality on the generation least suited to produce clean signal through it.

Total participants across all keystroke-cognition studies targeting neurodegeneration: **fewer than 500.** Sample sizes are small partly because researchers can't recruit enough elderly people who type fluently enough for the signal to mean anything.

Keystroke dynamics can only serve as a cognitive biomarker when typing is automatic enough (~40-50 WPM) that variation in timing reflects cognitive processes rather than motor execution. Below this threshold, keystroke timing is noise. Current study populations (born 1941-1961, encountered computers at ages 30-55) are largely below this threshold.

**The timeline:**
- **Now (2026):** The research population has the lowest typing fluency of any cohort that will ever be studied.
- **2030-2035:** The 65+ population includes people born after 1965 — first cohort to use email in their 30s. Effect sizes should increase.
- **2040:** 70-year-olds were born ~1970. Windows 95 at age 25. 20-40 years of daily typing. Automaticity threshold cleared for the vast majority.
- **2050:** 70-year-olds were born ~1980. AIM/MSN generation. Peak keystroke biomarker validity.

**The strategic implication:** Results published now are conservative lower bounds. The instrument that validates during the transition window owns the field when the signal gets clean. The science and the demographic arrive at the same time — the instrument must arrive first.

**The ironic inversion:** Writing-based assessment gets better as populations get more digital. Clock drawing gets worse (Gen Z CDT error rate: 40%). Keyboard-specific assessment will eventually get worse too (keyboarding courses: 44% → 2.5%). Only the modality-agnostic writing-process instrument survives all three transitions — which is why Constraint 1 is non-negotiable.

---

## The Flywheel

```
Build instrument → Labs adopt it → Labs publish papers
       ↑                                    ↓
  Revenue funds              Papers validate signals
  continued R&D                        ↓
       ↑                   Validation enables behavioral health entry
  Reimbursement +                      ↓
  consumer revenue         ACCESS Track 4 generates clinical data
       ↑                                    ↓
       └────────── Clinical data + consumer data ──┘
                   feed back into research
```

Each phase funds and validates the next. The researchers do the burden-of-proof work. The papers are the marketing. The evidence base builds through the normal academic publication cycle. The behavioral health entry (Phase 2) generates reimbursement revenue and clinical data simultaneously — not waiting for a cognitive assessment category that doesn't exist.

---

## What the Monastic Philosophy Protects

The anti-engagement design isn't a philosophical indulgence — it's what makes 20-year retention possible.

- Gamification kills retention at year 3. Streaks create obligation, not depth.
- The black box (never surface responses, never show signals) preserves natural writing behavior. Conscious self-monitoring changes the signal.
- One question per day is sustainable for decades. A chatbot interface isn't.
- The absence of a dashboard is what makes the data trustworthy. The user writes for themselves, not for a score.

Every design decision that optimizes for depth over engagement is also a decision that optimizes for longitudinal data quality. The philosophy and the science require the same thing.

---

## The Competitive Landscape (Confirmed Empty)

Theory 5 verified exhaustively: **no existing tool, commercial or academic, integrates keystroke process dynamics with linguistic content analysis in a longitudinal framework.** Not "few." Zero.

| Adjacent Space | What They Do | What They Don't Do |
|---|---|---|
| Inputlog (U. Antwerp) | Keystroke process capture | No content analysis, no longitudinal, Windows-only |
| LIWC / Receptiviti | Linguistic content analysis | No process capture |
| BiAffect (UIC) | Keystroke dynamics, longitudinal | No content — explicitly discards text |
| neuroQWERTY / nQ Medical | Keystroke timing for Parkinson's | No content, no writing, dormant since 2022 |
| Linus Health (DCTclock) | Process-over-output for clock drawing | Different modality — drawing, not writing |
| DSCRIB | Keystroke process for education | No content analysis, no longitudinal, no clinical |
| Cogstate / Cambridge Cognition | Cognitive assessment for pharma trials | Game-based tasks, no writing modality |
| AI journaling apps | Content analysis | No process capture, no behavioral baselines |

The gap persists because it requires fusing three research communities that don't talk to each other: writing process (Inputlog/Antwerp), computational linguistics (Pennebaker/LIWC), and behavioral dynamics (PersDyn/KU Leuven).

---

## The Graveyard Lessons

| Company | Raised | Outcome | Lesson |
|---|---|---|---|
| Pear Therapeutics | $175M | Bankrupt 2023 | FDA cleared but payers refused to reimburse. Don't go DTx first. |
| Mindstrong | $160M | Shut down 2023 | Passive surveillance felt creepy. Commercialized before science was sound. |
| Akili Interactive | $114M | Acquired for $34M | Prescription digital therapeutic model failed. |
| Woebot Health | $123M | Shut down 2025 | FDA Breakthrough but never got marketing authorization. |

Every one died in the gap between technical proof and commercial viability in clinical digital health. The instrument-first path avoids this entirely — research use doesn't require FDA clearance, insurance reimbursement, or consumer adoption. It generates revenue and evidence simultaneously.

---

## Long-Term Architecture Notes

These are not near-term priorities. They are architectural decisions informed by T8-T9 that shape how the instrument is built now.

**Dual-use data architecture (Theory 8).** The same data that monitors cognition can model cognitive identity — characteristic thought patterns, reasoning style, revision strategies. This is architecturally free: the reconstruction use case requires no additional data collection beyond what the health use case demands. The 20-year journal corpus (~2.2M words, ~7,300 sessions, billions of timestamped motor events) exceeds every threshold for personality modeling by an order of magnitude. This changes retention economics: the health use case provides the reason to start; the reconstruction use case provides the reason to never stop. Current models can't do deep cognitive reconstruction — but the data architecture captures the data now, and the reconstruction improves as models do.

**Full-arc extension (Theory 9).** Formation and degradation are the same signal observed from different directions (Lothian Birth Cohort: rate of cognitive gain from 11-70 predicts rate of decline from 70-82, independent of level). The modality-agnostic architecture designed for Constraint 1 also supports earlier capture — drawing process data from age 3-4, handwriting from 5-6, early typing from 7-8. The 11-12 convergence window (knowledge-transforming shift + handwriting automaticity + vocabulary deceleration) is when process data becomes maximally cognitive. This is 15-20 years of empirical work away from being actionable, but it means the modality abstraction layer in Phase 1 is load-bearing for the full vision — not just for generational technology shifts.

---

## Immediate Next Steps

1. **Keep using it.** The production database reset on 2026-04-14. Daily journaling builds the first real longitudinal dataset and dog-foods the instrument.

2. **Build the research export layer.** CSV/JSON export of computed signals per session. This is the minimum viable instrument — what a lab needs to run their own analysis.

3. **Build the modality abstraction layer.** Separate modality-specific features (hold time, flight time) from modality-invariant features (pause-to-production ratio, revision frequency, coherence trajectory). This satisfies Constraint 1 and prepares the pipeline for multi-modal input.

4. **Build the research admin panel.** Study configuration: number of days, question source (seeds or custom), calibration protocol, participant management.

5. **Write the whitepaper.** Lead with the demographic choke point argument (Theory 6) — this is a genuine intellectual contribution, not marketing. Then: what the pipeline measures, how each signal is grounded, the two-silo bridge (process researchers + medical keystroke researchers), and why the timing is right. This is the opening argument for every path above.

6. **Make contact.** Email writing process researchers (start with the Antwerp group — they already studied writing process in AD populations with Inputlog). The message: "I built a web-based longitudinal writing process instrument with 70+ deterministic signals covering both keystroke dynamics and linguistic content. No LLM in the measurement loop. Here's the whitepaper."

7. **Prepare grant application.** Target R21 ($275K/2yr) or SBIR Phase I ($323K) for the September 5, 2026 receipt date. NIA digital biomarker track. Zero competing applications in this exact niche.

---

## What This Document Is

Theories 1-5 were exploration. Theories 6-9 established the structural arguments — timing, shape, retention, and scope. This is the decision.

The theories asked "what could this be?" This document answers "what is this, and in what order does it become that?" The answer: a longitudinal cognitive instrument that enters through research, validates through publication, enters clinical use through behavioral health (the payment door that exists), and reaches consumers as a depth practice that happens to protect them.

The three survival constraints (modality-agnostic, process-first, payment-ready) are not aspirational design principles. They are load-bearing walls derived from $1.8B in failures. The demographic tailwind is not a hope — it is a demographic inevitability on a known timeline. The instrument arrives during the transition window. The science and the population catch up.

The codebase has been building Phase 1 the entire time. The next step is packaging it for the people whose job is to prove it works.
