# Roadmap

**Date:** 2026-04-14
**Predecessors:** Theories 1-5, simulation handoffs v1-v2, observatory spec, README

---

## The Thesis

_The practice that protects your mind is the same one that would detect if something changes._

Journaling is neuroprotective (Pennebaker & Beall 1986; Cache County: 53% dementia risk reduction). The writing process carries cognitive signal stronger than any existing screening tool (Nun Study: idea density predicts Alzheimer's 60 years out; Li et al. 2025: writing process biomarkers AUC = 0.918, beating MoCA and MMSE). The measurement IS the intervention. No other cognitive assessment modality has this property.

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

## The Sequence

### Phase 1: The Instrument

**Goal:** Get the signal pipeline into research labs. Let them validate it.

**What to build:**
- Research admin panel (configure study parameters, seed questions, calibration protocol)
- Signal export layer (CSV/JSON of all computed signals per session)
- Multi-tenant hosting (each study gets an isolated instance)
- Documentation mapping each signal to its research basis
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

**Revenue:** Academic licenses ($15-30K/year per lab). Small but real.

**Funding:** R21 ($275K/2yr) or SBIR Phase I ($323K) — zero competition in this exact niche. NIA digital biomarker track funded 10 SBIR awards in FY2024-2025.

**The incumbent to displace:** Inputlog (University of Antwerp). Windows-only, no longitudinal tracking, no content analysis, no web deployment. A generational upgrade, not an incremental one.

### Phase 2: Clinical Validation

**Goal:** Published evidence that the signals predict real clinical outcomes.

**What happens:**
- Partner with 2-3 labs running 12-week studies (50+ participants, MCI vs healthy aging)
- Correlate 8D behavioral dimensions against established instruments
- Target publication: "Longitudinal Writing Process Signals Differentiate MCI from Healthy Aging"
- This paper turns the instrument into a clinically credible tool

**What this unlocks:**
- Conversations with Linus Health, Cambridge Cognition, Cogstate (potential licensing or acquisition)
- Insurance reimbursement pathway (CPT 96127 for brief behavioral assessment, no FDA clearance needed for measurement)
- Credibility for the consumer pitch — not "we think this works" but "University of Edinburgh published the study"

**Timeline:** Dependent on Phase 1 adoption. First validation study realistically starts 6-12 months after first lab deployment.

### Phase 3: Consumer Product with Clinical Anchor

**Goal:** Market to consumers as a longitudinal cognitive baseline tracker.

**The pitch:** We built this for clinical research. It detects early cognitive decline better than the gold-standard screening tests. But it's also a depth practice — a daily journal that happens to accumulate the richest longitudinal cognitive dataset ever collected about you. Use it for the journaling. The protection accrues as a byproduct.

**The clinical anchor:**
- Early-onset dementia detection is the insurance-reimbursable use case
- Prescribed by neuropsychologists as a 30-day writing protocol
- Trajectory view instead of snapshot score: not "your MoCA is 26/30" but "your cognitive processing markers are stable over 30 days"
- This is the revenue floor

**The mass appeal:**
- After years of data, the system tells you things about yourself you can't see from inside your own life
- "Your cognitive fluency drops every February"
- "The last time your signals looked like this, you were six weeks from a major depressive episode"
- "Your deliberation patterns have been strengthening for two years"
- This is Bob. The longitudinal AI thinking partner. The payoff of years of validated signal data.

**Retention model:**
- The longer someone uses it, the more valuable their baseline becomes — to them
- A 40-year-old who journals for 20 years has a personal cognitive trajectory no clinical instrument could reconstruct
- Leaving means abandoning your own longitudinal dataset
- No gamification needed. The value compounds with time. Depth is what keeps someone writing at year 15.

### Phase 4 (Much Later): Pharma Trial Endpoints

**Goal:** Continuous cognitive measurement between quarterly clinic visits.

- Alzheimer's drug trials need cognitive endpoints measured more often than every 90 days
- Participants journal daily from home
- Trial sponsor gets continuous trajectory data supplementing standard ADAS-Cog
- Writing-based endpoint fills the 90-day gaps with actual data instead of nothing

---

## The Demographic Tailwind

The current Alzheimer's research population (70s-80s today) learned to type in their 30s or 40s, if at all. Typing is not their native cognitive output channel.

People who are 45-55 now — the ones who'll enter the early cognitive decline window in 15-25 years — have been typing daily since they were teenagers. By the time they're the target demographic, a writing-based instrument won't feel like a clinical task. It'll feel like something they already do.

The generation behind them is even more saturated. The 30-year-olds of today have been producing text on keyboards and phones since childhood.

**The instrument is early for the clinical market but perfectly timed for the research market.** The labs that validate writing-process biomarkers over the next 10-15 years are building the evidence base that'll be ready exactly when the first generation of lifelong typers enters the risk window. The science and the demographic arrive at the same time.

---

## The Flywheel

```
Build instrument → Labs adopt it → Labs publish papers
       ↑                                    ↓
  Revenue funds              Papers validate signals
  continued R&D                        ↓
       ↑                   Validation enables clinical pitch
  Consumer revenue                     ↓
       ↑                   Clinical anchor enables consumer product
       ↑                                    ↓
       └────────── Consumer data feeds ─────┘
                   back into research
```

Each phase funds and validates the next. The researchers do the burden-of-proof work. The papers are the marketing. The evidence base builds through the normal academic publication cycle. And the whole time, the consumer product runs in parallel — testing the depth thesis without depending on it.

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

## Immediate Next Steps

1. **Keep using it.** The production database reset on 2026-04-14. Daily journaling builds the first real longitudinal dataset and dog-foods the instrument.

2. **Build the research export layer.** CSV/JSON export of computed signals per session. This is the minimum viable instrument — what a lab needs to run their own analysis.

3. **Build the research admin panel.** Study configuration: number of days, question source (seeds or custom), calibration protocol, participant management.

4. **Write the whitepaper.** 10-page technical document: what the pipeline measures, how each signal is grounded, what it predicts. This is sales collateral for every path above.

5. **Make contact.** Email writing process researchers (start with the Antwerp group — they already studied writing process in AD populations with Inputlog). The message: "I built a web-based longitudinal writing process instrument with 70+ deterministic signals covering both keystroke dynamics and linguistic content. No LLM in the measurement loop. Here's the whitepaper."

---

## What This Document Is

Theories 1-5 were exploration. This is the decision.

The theories asked "what could this be?" This document answers "what is this, and in what order does it become that?" The answer: a longitudinal cognitive instrument that enters through research, validates through publication, and reaches consumers as a depth practice that happens to protect them.

The codebase has been building Phase 1 the entire time. The next step is packaging it for the people whose job is to prove it works.
