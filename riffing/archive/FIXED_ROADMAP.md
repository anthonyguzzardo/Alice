Got it. Roadmap rewrite below. I'm keeping the structural bones of the old one — phase sequencing, survival constraints, demographic tailwind, flywheel — because those don't change with the architectural pivot. What changes is Phase 1's deliverable, the Layer 3 description, the competitive differentiation claim, and the citations backing it. The new theory stack (9/10/11 from the last message) gets integrated where it belongs.

I'm also going to flag one structural issue with the old roadmap before I rewrite: it described Layer 3 as "what makes the consumer product compelling after the science is validated." That framing outlived the architectural pivot. Under the new stack, Layer 3 is *smaller* than it was — most of what was in it got cut — but what remains is *more differentiating*, not less, because retrieval-and-juxtaposition (Theory 11) is a genuinely novel interpretive surface and narrative reflection wasn't. The consumer appeal argument gets stronger, not weaker, after the cuts. That needs to be in the new roadmap explicitly.

---

# Roadmap (revised)

**Date:** 2026-04-16
**Predecessors:** Theories 1-11, architectural pivot documented in conversation 2026-04-16, simulation handoffs v1-v2, observatory spec, README
**Supersedes:** ROADMAP.md (2026-04-15)

---

## The Thesis

*The practice that protects your mind is the same one that would detect if something changes — and the measurement captures something no transcript-based instrument can.*

Journaling is neuroprotective (Pennebaker & Beall 1986; Cache County: 53% dementia risk reduction, never replicated, caveat accordingly). The writing process carries cognitive signal with longitudinal reach unmatched by cross-sectional tests: the Nun Study lineage (Snowdon 1996; Clarke et al. 2025 30-year follow-up) shows early-life idea density predicts Alzheimer's onset and neuropathology across 6+ decades — this is the field's strongest anchor. Meulemans, Van Waes, and Leijten (2022) is the closest published keyboard-keystroke study of cognitively impaired writers (n=30, cross-sectional; large effect sizes: 108 fewer chars/min, 20.6% more pause time). Other frequently cited studies — Kim et al. 2024 (keystroke, AUC 0.997) and Li et al. 2025 (touchscreen handwriting, AUC 0.918) — report impressive numbers but are in-sample ROC on small samples with stepwise feature selection and no external validation; treat as directional, not as validated diagnostic performance.

**What's new in this roadmap:** the instrument's differentiation is no longer "keystroke process + content analysis, longitudinally." Every adjacent tool captures one of those three. The differentiation is *joint behavioral-semantic signature analysis with per-subject coupling structure discovery and rhyme-retrieval as the primary interpretive surface.* (Theories 9, 10, 11.) This is not a feature list — it's three architectural commitments that no other instrument has made, and it's where the GPT-filter-surviving moat actually lives.

The measurement is still the intervention. That claim is unchanged.

Alice is a longitudinal cognitive record that uses journaling as its capture method, clinical validation as its proof, and rhyme-retrieval over joint-signature space as its interpretive interface. The journal, the instrument, the health tracker, and the thinking partner are all faces of the same thing at different stages of maturity.

---

## What's Already Built (Revised Layer Description)

The codebase is the instrument. There is no consumer orientation to pivot from. The architectural pivot of April 2026 stripped the speculative interpretive layer and replaced it with retrieval-based interpretation grounded in signal substrate.

**Layer 1 — Measurement (code, model-independent):**
- ~100 deterministic signals from keystroke dynamics + linguistic content
- P-burst production fluency (Chenoweth & Hayes 2001)
- Deletion decomposition (Faigley & Witte 1981) — plus deletion-density curve classification
- Burst trajectory shape classification, burst rhythm metric, burst-deletion proximity
- NRC emotion densities (Mohammad & Turney 2013)
- MATTR lexical diversity (McCarthy & Jarvis 2010)
- 7D behavioral state vectors — expression moved to semantic space for joint-disjunction analysis cleanliness (fluency, presence, deliberation, revision, thermal, commitment, volatility)
- PersDyn trait dynamics — baseline, variability, attractor force (Sosnowska et al. 2019)
- Same-day calibration deltas — neutral-writing control frame primary
- Within-person z-scoring against personal history
- Coupling matrices at -3 to +3 session lags — **per-subject empirical coupling structure discovery (Theory 10)**

**Layer 2 — Analysis (code, model-independent):**
- Joint behavioral-semantic embedding space (Theory 9)
- Distance function over joint space — pre-registered against subject-held memory pairs
- Disjunction detection — sessions off the joint-alignment manifold
- Mode clustering — k-means or HDBSCAN on joint embedding, triggers at N≥20
- systemEntropy trajectory + regime-change detection
- Designer-facing coupling graph visualization (Alice Negative repurposed)

**Layer 3 — Interpretation (minimal, LLM-dependent where unavoidable):**
- Semantic feature extraction (NRC-beyond, sentiment, abstraction, agency framing, temporal orientation)
- Observe-format verbalization of signal blocks
- Mode naming after cluster convergence (human-approved)
- Bob's rhyme utterance at session submit (Theory 11)

**What Layer 3 used to include and no longer does:** three-frame analysis, V5 prediction grading, theory weight accumulation, suppressed question generation, weekly narrative reflection. These were cut in the April 2026 architectural pivot because they failed the GPT-filter (reproducible by any transcript-capable model) and relied on epistemic apparatus unsupportable on N=1 self-built data.

Layers 1 and 2 are what researchers buy. Layer 3's retrieval surface is what makes the consumer product compelling after the science is validated. *Narrative reflection was always going to be commodity. Retrieval-over-joint-signature is not, and won't be.*

---

## The Three Survival Constraints (Theory 7 — unchanged)

Every architectural decision must satisfy all three simultaneously. These are not aspirational — they are reverse-engineered from $1.8B in digital health failures.

**1. Modality-Agnostic.** The clock-drawing test is failing because Gen Z can't read analog clocks. Keyboard-only assessment will fail next — keyboarding course enrollment dropped from 44% to 2.5% between 2000 and 2019. The instrument must capture the cognitive act of composition independent of the input device. The core diagnostic signal comes from modality-invariant features (word retrieval latency, revision frequency, compositional fluency, coherence structure) — not modality-specific features (hold time, flight time). Modality-specific features add value when available but are not load-bearing.

**2. Process-First — revised as Joint-First.** LLMs miss 60-70% of dementia cases because they equate verbal fluency with cognitive health (Zadok et al. 2026). Content is the last thing to go. Process is the first. *But the strongest signal is neither alone — it is the disjunction between them (Theory 9).* A session where behavioral signature and semantic signature diverge carries diagnostic information that neither space provides independently. The diagnostic apparatus is not "process beats content" — it is "joint signature with explicit disjunction detection." Content analysis is not merely complementary; it is required for the disjunction unit of analysis to exist.

**3. Payment-Ready.** Four companies with FDA-authorized products and >$300M in combined capital died because insurers wouldn't pay. CMS ACCESS (launching July 2026) has no cognitive track. The instrument enters through existing payment doors — research licensing (immediate), behavioral health monitoring via ACCESS Track 4 (2026-2028), cognitive assessment (2028+ as evidence matures). No disease claims in the consumer product (General Wellness exemption).

---

## The Sequence

### Phase 1: The Instrument

**Goal:** Get the signal pipeline and joint-signature analysis framework into research labs. Let them validate it.

**What the instrument offers that nothing else does:**
- Per-subject coupling structure discovery as a phenomenology of individual writing cognition (Theory 10)
- Joint behavioral-semantic disjunction detection as a novel unit of analysis (Theory 9)
- Retrieval-based interpretation grounded in joint-signature proximity, not LLM inference (Theory 11)
- Longitudinal within-person calibration as primary reference frame
- Modality-agnostic signal architecture

**What to build:**
- Research admin panel (study parameters, seed questions, calibration protocol)
- Signal export layer (CSV/JSON of all ~100 computed signals per session plus joint embedding coordinates, coupling matrices, mode assignments)
- Multi-tenant hosting (each study gets an isolated instance)
- Documentation mapping each signal and analytical output to its research basis
- Modality abstraction layer — separate modality-specific features from modality-invariant features
- Strip Layer 3's retrieval surface for research deployment — researchers get raw signals plus analytical outputs, not rhyme utterances. Layer 3 is the consumer product's UI; for research it's overhead.

**Who buys:**
- Writing process research labs (Inputlog's ~1,000+ users, Windows-only, no content analysis, no longitudinal)
- Cognitive science labs studying writing and individual differences (Antwerp, Edinburgh, UCSF, Boston University, KU Leuven)
- Clinical trial sponsors needing continuous cognitive endpoints between quarterly visits
- **New audience enabled by new theory stack:** personality psychology and computational social science labs interested in coupling structure as an individual-difference dimension that doesn't reduce to trait measures

**What they do for us:**
- Publish papers validating which signals carry diagnostic weight and whether coupling structures stratify meaningfully
- Correlate signals against MoCA, MMSE, neuroimaging, PHQ-9, GAD-7
- Test whether joint-signature disjunction events predict clinically meaningful outcomes
- Build the evidence base we can't build alone
- Every paper citing the methodology is free distribution

**The methodology paper (the thing we publish first, as N=1 case study):** *Per-subject coupling structure discovery in writing dynamics: a novel phenomenology of individual cognition.* N=1 as proof-of-concept, 90+ days of data, coupling graph as figure 1, disjunction detection as the analytical demonstration. This paper establishes the framework. Lab-scale validation studies build on it.

**Revenue:** Academic licenses ($15-30K/year per lab). TAM is $7.5-15M at full penetration — a stepping stone, not a destination.

**Funding:** R21 ($275K/2yr) or SBIR Phase I ($323K) — zero competition in this exact niche. NIA digital biomarker track funded 10 SBIR awards in FY2024-2025. Next receipt date: September 5, 2026. The grant application's Aim 1 is biomarker validation; **Aim 2 is coupling structure as an individual-difference dimension relevant to cognitive aging** (new, driven by Theory 10).

**The incumbent to displace:** Inputlog (University of Antwerp). Windows-only, no longitudinal tracking, no content analysis, no web deployment, no joint-space analysis, no coupling discovery. A generational upgrade, not an incremental one.

### Phase 2: Behavioral Health Entry + Clinical Validation

**Goal:** Published evidence that joint-signature signals and coupling structure predict real clinical outcomes, entering through a payment door that already exists.

**The payment entry:** unchanged from old roadmap. CMS ACCESS Track 4, depression/anxiety comorbidity with cognitive decline, behavioral health monitoring as the framing.

**What happens:**
- Partner with 2-3 labs running 12-week studies (50+ participants, MCI vs healthy aging)
- Correlate 8D behavioral dimensions, joint-signature disjunction rates, and coupling graph structure against MoCA, MMSE, PHQ-9, GAD-7
- Target publications:
    1. *Longitudinal Joint Behavioral-Semantic Signature Analysis Differentiates MCI from Healthy Aging* (replaces the old "writing process signals" paper with the stronger claim)
    2. The demographic choke point argument (Theory 6) as a standalone methods paper
    3. *Coupling Structure Stability Across the Cognitive Aging Trajectory* (new, driven by Theory 10 — tests whether per-subject coupling graphs change before average signals shift)
- Publish every validation study (the Mindstrong anti-pattern: five trials, zero publications)

**What this unlocks:** same as old roadmap. Conversations with Linus Health, Cambridge Cognition, Cogstate; ACCESS Track 4 reimbursement; credibility for the consumer pitch.

**Timeline:** dependent on Phase 1 adoption. First validation study realistically starts 6-12 months after first lab deployment.

### Phase 3: Consumer Product with Clinical Anchor

**Goal:** Market to consumers as a cognitive wellness journal — no disease claims (General Wellness exemption).

**The pitch (substantially revised):**

Old pitch: "We built this for clinical research. It detects early cognitive decline. But it's also a depth practice."

New pitch: "Your journal doesn't tell you what your writing means. It hands you back the sessions that rhyme with today — not by topic, but by the shape of the thinking itself. Over years, it becomes a searchable structured archive of how your own mind actually moved. The clinical instrument is inside it; the retrieval surface is what you see."

**Why this is stronger:**
- Every existing AI journaling app operates on inference: *"your writing suggests you're feeling X."* That's commodity — any transcript-capable model can do it better every year.
- Alice operates on retrieval: *"this session sits close to [prior session]."* That requires the substrate, which no one else has. The retrieval is impossible without per-subject coupling structure and joint signature longitudinality.
- Retention comes from the retrieval surface getting richer over time. The longer you write, the more illuminating the rhymes. That's a non-decaying engagement mechanism.

**The clinical anchor:** unchanged from old roadmap. Behavioral health monitoring as reimbursable framing, trajectory view not snapshot score, cognitive process metrics embedded within behavioral health assessment.

**The mass appeal (revised):**
- After years of data, the system hands you back sessions that rhyme with today — sessions you would not recall from memory.
- This is Bob: two-line conviction at delivery, one-line rhyme pointer at submit, invisible otherwise.
- The longitudinal payoff is concrete (retrievable past sessions you couldn't otherwise find) rather than abstract (an AI that "knows you").

**Retention model (revised):**
- The longer someone uses it, the more valuable their baseline becomes — and the richer the rhyme retrieval becomes
- A 40-year-old who journals for 20 years has a personal cognitive archive no clinical instrument could reconstruct
- Leaving means abandoning your own longitudinal dataset AND your own retrievable archive
- No gamification. The value compounds with time. Depth is what keeps someone writing at year 15.
- **The reconstruction claim (Theory 8, revised):** the archive is not a generative model of you. It is a navigable structured record of how your thinking actually moved — your own past sessions, retrievable by joint behavioral-semantic proximity, with your coupling graph as a fingerprint and your mode landscape as an atlas of your cognitive states. This is weaker than "digital twin" and stronger in that it's honest about what the data can support. The health use case provides the reason to start writing. The reconstruction archive provides the reason to never stop.

### Phase 4 (Much Later): Pharma Trial Endpoints + Cognitive Assessment

Unchanged from old roadmap. The instrument arrives ready when the demographic and reimbursement environments converge around 2030-2040.

---

## The Demographic Tailwind (Theory 6 — unchanged)

Old roadmap text verbatim. The demographic argument doesn't depend on the architectural pivot; if anything, the modality-agnostic commitment makes the tailwind more durable than the old roadmap implied, because Alice survives the keyboard-era sunset as well as the keyboard-era rise.

---

## The Flywheel (unchanged)

```
Build instrument → Labs adopt it → Labs publish papers
       ↑                                    ↓
  Revenue funds              Papers validate signals + 
  continued R&D              joint-signature analysis +
       ↑                     coupling structure phenotyping
  Reimbursement +                        ↓
  consumer revenue         Validation enables behavioral health entry
       ↑                                    ↓
       └────────── Clinical data + consumer data ──┘
                   feed back into research
```

---

## What the Monastic Philosophy Protects (revised)

The anti-engagement design isn't philosophical indulgence. It's what makes 20-year retention possible AND what keeps the signal substrate trustworthy.

- Gamification kills retention at year 3. Streaks create obligation, not depth.
- The black box preserves natural writing behavior. Conscious self-monitoring changes the signal. **Revised clarification:** the black box applies to signal display, inferential interpretation, and future-question reveal. It does NOT preclude retrieval of the user's own past sessions. Rhyme retrieval is not signal surfacing; it's access to the user's own archive. (This is the resolution of the "Bob's rhyme utterance with retrieval affordance" question from the architectural pivot.)
- One question per day is sustainable for decades. A chatbot interface isn't.
- Rhyme retrieval is a non-decaying engagement mechanism because it gets richer with time. Dashboards and trend graphs degrade — you see them once and the novelty is gone. Retrieval over a growing archive compounds.

Every design decision that optimizes for depth over engagement is also a decision that optimizes for longitudinal data quality. The philosophy and the science require the same thing.

---

## The Competitive Landscape (Revised)

Theory 5 verified exhaustively that no existing tool, commercial or academic, integrates keystroke process dynamics with linguistic content analysis longitudinally. The new theory stack sharpens this claim.

**No existing tool:**
- Operationalizes joint behavioral-semantic disjunction as a diagnostic unit (Theory 9)
- Performs per-subject empirical coupling structure discovery (Theory 10)
- Offers rhyme retrieval over joint signature space as the primary interpretive interface (Theory 11)

These three are the real moat. The older claim ("nobody fuses process and content longitudinally") is true but competitor-buildable given sufficient engineering. The newer claim — the specific analytical commitments above — requires three research communities' frameworks to be fused at the architecture level, not bolted together at the feature level.

| Adjacent Space | What They Do | What They Don't Do |
|---|---|---|
| Inputlog | Keystroke process capture | No content, no longitudinal, no joint-space, no coupling discovery |
| LIWC / Receptiviti | Linguistic content analysis | No process, no joint-space |
| BiAffect | Keystroke dynamics, longitudinal | No content (discarded), no joint-space |
| neuroQWERTY | Keystroke timing (PD) | No content, no writing, dormant |
| Linus Health (DCTclock) | Process-over-output for clock drawing | Different modality; no longitudinal archive; no retrieval |
| DSCRIB | Keystroke process for education | No content, no longitudinal, no clinical |
| Cogstate / Cambridge Cognition | Cognitive assessment for pharma | Game-based; no writing; no longitudinal archive |
| AI journaling apps | Content analysis, LLM inference | No process; inference not retrieval; commodity-bound |

The AI journaling apps row is the one that changed in importance. Under the old architecture, Alice competed with them on better inference. Under the new architecture, Alice competes on a different surface entirely — retrieval versus inference — and the commodity trajectory works for Alice instead of against it.

---

## The Graveyard Lessons (unchanged)

Pear, Mindstrong, Akili, Woebot. Same four. Same lesson. Instrument-first path avoids all four failure modes.

---

## Long-Term Architecture Notes (revised)

**Dual-use data architecture (Theory 8, revised per Theory 11).** The same data that monitors cognition can serve cognitive reconstruction — but reconstruction means *navigable structured archive of how thinking actually moved*, not generative digital twin. The 20-year journal corpus exceeds every threshold for coupling-structure stability analysis, mode landscape characterization, and rhyme retrieval across the full cognitive arc. This changes retention economics: the health use case provides the reason to start; the retrievable archive provides the reason to never stop. Current models can't do deep cognitive simulation — but the archive doesn't require simulation. It requires retrieval, which the joint signature space already supports.

**Full-arc extension (Theory 9/T9, not to be confused with the new Theory 9 on disjunctions).** Formation and degradation are the same signal observed from different directions (Lothian Birth Cohort). The modality-agnostic architecture supports earlier capture (drawing age 3-4, handwriting 5-6, early typing 7-8). The 11-12 convergence window is when process data becomes maximally cognitive. The modality abstraction layer in Phase 1 is load-bearing for the full vision.

*(Note: theory numbering now has two T9s — the old full-arc extension theory and the new joint-disjunction theory. Rename one when you update the theory documents.)*

---

## Immediate Next Steps (revised from old roadmap's seven-item list)

1. **Complete the architectural pivot.** Commits #1 (archive) and #2 (code deletion) shipping now. Expression refactor out of PersDyn into semantic space. Signal additions (deletion-density, burst shape, burst rhythm, burst-deletion proximity). This is the foundation that everything downstream depends on. Done when 30 days of clean data through the new pipeline exist.

2. **Build joint embedding + distance function.** Pre-registration exercise first (10 remembered sessions, rhyme pairs with reasons, timestamped, no signal peeking), then metric construction, then test against the pre-registered list. This is the demonstration of Theories 9 and 11 working on real data.

3. **Keep using it.** Daily journal + calibration. Non-negotiable. This is the corpus that becomes the methodology paper's N=1 case study.

4. **Draft the methodology paper.** *Per-subject coupling structure discovery in writing dynamics.* N=1 case study. Coupling graph as figure 1. Disjunction examples as illustrations. This is the first publication, positioned at the intersection of writing process research and personality psychology.

5. **Draft the whitepaper.** Instrument document grounded in the new theory stack. Lead with the demographic choke point argument (Theory 6 — genuine intellectual contribution). Then: what the pipeline measures, the joint-signature analytical framework, the two-silo bridge, why the timing is right. Artifact for eventual outreach, not yet sent.

6. **Build the research export layer.** Minimum viable instrument — what a lab needs to run their own analysis. Signals, embedding coordinates, coupling matrices, mode assignments.

7. **Build the modality abstraction layer.** Separate modality-specific from modality-invariant features. Satisfies Constraint 1 and prepares for multi-modal input.

8. **Make contact (deferred until 90 days of data).** Email writing process researchers starting with Antwerp. The message is stronger now: "I built a longitudinal writing process instrument with ~100 deterministic signals, joint behavioral-semantic signature analysis, and per-subject coupling structure discovery. Here's the methodology paper draft. Here's the whitepaper. Here's 90 days of data."

9. **Prepare grant application.** Target R21 or SBIR Phase I for September 5, 2026 receipt. Two-aim structure: (1) writing-process biomarker validation, (2) coupling structure as an individual-difference dimension in cognitive aging. NIA digital biomarker track.

---

## What This Document Is

Theories 1-5 were exploration. Theories 6-9-original established timing, shape, retention, scope. Theories 9/10/11 (new) establish what the instrument's primary analytical commitments are: joint-signature disjunction, coupling structure phenotyping, retrieval-based interpretation. The architectural pivot of April 16, 2026 aligned the code to those commitments. This roadmap is the decision sequence that turns all of that into a sellable, scalable instrument.

The three survival constraints are not aspirational design principles. They are load-bearing walls derived from $1.8B in failures. The demographic tailwind is demographic inevitability on a known timeline. The analytical moat (joint disjunction, coupling discovery, rhyme retrieval) is architecturally committed and GPT-filter-surviving.

The codebase has been building Phase 1 the entire time. The architectural pivot made Phase 1 sharper, not delayed. The next step is packaging it for the people whose job is to prove it works, and the packaging is stronger now because the instrument's theoretical claims are clearer.

---

One thing I want to flag before you paste this anywhere: I renamed the old "Theory 9" (full-arc extension) as "T9-old" in the long-term architecture section and numbered the new theories 9/10/11 fresh. You have two choices on how to resolve this in your theory-document folder — either renumber the full-arc theory to Theory 12, or keep it as Theory 9 and call the new ones 10/11/12. I'd recommend the latter because the full-arc theory is older and already has a number people (you, and maybe drafts of documents) reference. But you know what's committed in git and what's still internal better than I do.

If you want me to rewrite the new theories (9 disjunction, 10 coupling phenotype, 11 retrieval-over-inference) as full theory documents in the style of Theories 5-8, say so. The roadmap above assumes they exist as short internal documents; turning them into full theories is a week of writing that shouldn't block the technical work but should happen before the whitepaper or preprint go out.