# 30-Day Plan (April 15 – May 15, 2026)

**Predecessor:** ROADMAP.md, Theories 5-9
**Purpose:** What to do while the corpus accumulates. Nothing here replaces the daily entries — that is the non-negotiable.

---

## Daily (Non-Negotiable)

- [ ] One journal entry
- [ ] One calibration session
- [ ] Both done with full attention — no multitasking, no rushing. The signal quality depends on natural writing behavior.

---

## Week 1 (April 15-21): Foundation

### Build
- [ ] Verify z-scoring and PersDyn dynamics handle sparse early data gracefully (no errors, no wild values from <10 sessions)
- [ ] Verify calibration sessions consistently produce a different process profile than journal sessions (the Pennebaker within-person design must work or the delta system is broken)

### Positioning
- [ ] Create ORCID (https://orcid.org) — free, 5 minutes, required for preprints and grants
- [ ] Create Google Scholar profile — links to ORCID, indexes future publications
- [ ] Set up Google Scholar alerts for key researchers:
  - Meulemans, Van Waes, Leijten (University of Antwerp) — writing process + AD
  - Jet Vonk (UCSF) — automated language analysis + neurodegeneration
  - Rhoda Au (Boston University) — digital biomarkers, Framingham
  - Saturnino Luz (Edinburgh) — computational language + dementia
  - Luca Giancardo (UTHealth) — neuroQWERTY inventor, now cognitive biomarkers
  - Peter Kuppens (KU Leuven) — PersDyn framework
  - Ryan Boyd (UT Dallas) — LIWC-22, Pennebaker successor

### Study
- [ ] Read Meulemans et al. 2022 (Antwerp) in full — this is the closest published study to what you're building. Know it cold. PMC9311409.
- [ ] Read Li et al. 2025 (Frontiers in Computational Neuroscience) — writing process biomarkers AUC=0.918. Understand their feature set and how yours differs.

---

## Week 2 (April 22-28): Export Layer + Preprint Draft

### Build
- [ ] Build CSV/JSON signal export endpoint — every computed signal per session, downloadable
- [ ] Look at your own export as if you were an external researcher. What's missing? What's confusing? What needs documentation?
- [ ] Begin modality abstraction: catalog which signals are modality-specific (hold_time, flight_time) vs modality-invariant (pause-to-production ratio, revision frequency, coherence trajectory). This is documentation first, code second.

### Write
- [ ] Draft the T6 preprint: "The Demographic Choke Point in Keystroke-Based Cognitive Biomarkers"
  - Strip all Alice-specific framing — this is a field-level argument, not a product pitch
  - Lead with the thesis: current populations are the worst case, results are conservative lower bounds
  - Include the typing adoption timeline, automaticity threshold evidence, and the CDT ironic inversion
  - Target: 3,000-5,000 words, suitable for PsyArXiv or arXiv (cs.HC)
  - This establishes priority on the idea before anyone else names it

### Study
- [ ] Read Zadok et al. 2026 (Alzheimer's & Dementia) — LLMs miss 60-70% of dementia. This is the core evidence for process-over-product. Understand the methodology.
- [ ] Read Kim et al. 2024 (JMIR) — hold time vs flight time decomposition technique. Understand the decomposition and how your capture compares. *Note: the reported 97.9% sensitivity and AUC 0.997 are methodologically unreliable (no holdout, n=99). Focus on the technique, not the performance claims.*
- [ ] Skim Ajilore et al. 2025 (BiAffect) — keystroke entropy + executive function. Understand their entropy computation and compare to yours.

---

## Week 3 (April 29 – May 5): Whitepaper + Repo Cleanup

### Build
- [ ] Clean the README for external eyes — not public yet, but ready to show
  - What the instrument measures (signal inventory with research basis)
  - How it differs from Inputlog, BiAffect, LIWC (the gap claim, verifiable)
  - Architecture overview (Layers 1-3, what's deterministic vs LLM-dependent)
- [ ] Document each signal family with its citation and what it captures
- [ ] Ensure the codebase has no hardcoded personal data, API keys, or anything that would embarrass you if a researcher saw it

### Write
- [ ] Draft the whitepaper (separate from the preprint — this is the instrument document)
  - What the pipeline measures and how each signal is grounded
  - The two-silo bridge (writing process researchers + medical keystroke researchers)
  - The demographic tailwind (reference the preprint)
  - What the instrument offers that Inputlog doesn't
  - Target: 10-15 pages, technical but readable by a cognitive science audience
- [ ] Finish and polish the T6 preprint for submission

### Study
- [ ] Read Chenoweth & Hayes 2001 — P-burst theory. Your pipeline is built on this. Be able to explain it in conversation.
- [ ] Read Faigley & Witte 1981 — deletion taxonomy. Same reason.
- [ ] Skim the Nun Study 30-year follow-up (Clarke et al. 2025, Alzheimer's & Dementia) — idea density across decades. Understand what they measured and what your pipeline adds beyond static text analysis.

---

## Week 4 (May 6-12): Outreach Prep + Grant Recon

### Outreach
- [ ] Check EARLI SIG Writing (June 2-4, Zurich) — registration still open? Affordable? Even attending without presenting puts you in the room with 200+ writing process researchers.
- [ ] Draft a cold email to the Antwerp group (Leijten, since Van Waes is emeritus). Short. The message:
  - "I built a web-based longitudinal writing process instrument with 70+ deterministic signals covering keystroke dynamics and linguistic content. No LLM in the measurement loop. Cross-platform, longitudinal, content-aware — the things Inputlog doesn't do."
  - Attach the whitepaper. Link to the signal inventory.
  - Ask: "Would you be interested in evaluating this for your writing process research?"
  - Do NOT send yet — sit on it for a few days, revise, then send in Week 5.
- [ ] Identify 2-3 other researchers from the T5 list who might be receptive (Saturnino Luz at Edinburgh and Ryan Boyd at UT Dallas are both accessible and active)

### Grant Prep
- [ ] Read 3-5 recently funded R21 abstracts from NIA's digital biomarker track (NIH RePORTER: https://reporter.nih.gov, search "digital cognitive biomarker" under NIA)
- [ ] Read the SBIR/STTR program announcement for NIA — understand the format, page limits, review criteria
- [ ] Note: September 5, 2026 is the next receipt date. That gives you ~4 months from now to write the application. The 30-day corpus + preprint + whitepaper are all inputs to the grant narrative.

### Study
- [ ] Read Sosnowska et al. 2019 — PersDyn framework. Your dynamics engine is built on this. Be able to explain baseline, variability, and attractor force to a psychologist.
- [ ] Skim the CMS ACCESS/TEMPO model (Federal Register, December 8, 2025) — understand Track 4 (behavioral health) well enough to explain the payment entry strategy in the grant application.

---

## Week 5 (May 13-15): Checkpoint

### Evaluate
- [ ] Review 30 days of signal data. Do the z-scores look stable? Do the PersDyn baselines converge?
- [ ] Are calibration sessions consistently producing different process profiles than journal sessions? If not, diagnose why.
- [ ] Look at the coupling matrices — any real structure emerging, or just noise?
- [ ] Honest assessment: is the signal pipeline producing data a researcher would find credible?

### Ship
- [ ] Submit T6 preprint to PsyArXiv or arXiv
- [ ] Send the Antwerp email (revised from Week 4 draft)
- [ ] Whitepaper finalized and ready to attach

---

## Reading List (Priority Order)

These are the papers you need to know cold — not skim, but understand well enough to discuss in conversation with a researcher.

### Tier 1: Know These Inside Out
1. **Meulemans et al. 2022** — Writing process in AD. PMC9311409. The closest study to your instrument.
2. **Li et al. 2025** — Writing process biomarkers AUC=0.918. Frontiers in Computational Neuroscience.
3. **Chenoweth & Hayes 2001** — P-burst theory. Your fluency dimension is built on this.
4. **Faigley & Witte 1981** — Deletion taxonomy. Your revision/thermal dimensions depend on this.
5. **Kim et al. 2024** — Hold time vs flight time decomposition technique. JMIR 26(1):e59247. *(Performance claims unreliable; technique is sound.)*

### Tier 2: Understand the Argument
6. **Zadok et al. 2026** — LLMs miss 60-70% of dementia from content. Alzheimer's & Dementia: DADM 18(1):e70248.
7. **Sosnowska et al. 2019** — PersDyn model. Your dynamics engine.
8. **Pennebaker & Beall 1986** — Expressive writing paradigm. The theoretical foundation for why journaling works.
9. **Snowdon et al. 1996 (Nun Study)** — Idea density predicts Alzheimer's 60 years out. JAMA 275(7):528-532.
10. **Ajilore et al. 2025 (BiAffect)** — Keystroke entropy + executive function. Frontiers in Psychiatry 16:1430303.

### Tier 3: Useful Context
11. **Yamaguchi & Logan 2014** — Typing automaticity threshold. The evidence for the demographic choke point.
12. **Pinet, Zielinski et al. 2022** — Typing expertise + cognitive signal. Cognitive Research 7:77.
13. **Clarke et al. 2025 (Nun Study follow-up)** — 30-year reanalysis. Alzheimer's & Dementia.
14. **Conte et al. 2022 (Lothian Birth Cohort)** — Cognitive change predicts cognitive change. Psychology and Aging 37(8):936-951.
15. **Bereiter & Scardamalia 1987** — Knowledge-telling vs knowledge-transforming. The book, or at minimum the framework summary.

---

## What Success Looks Like on May 15

- 30 days of clean, unbroken signal data with the full pipeline
- T6 preprint submitted or ready to submit
- Whitepaper drafted and ready to attach to cold emails
- Export layer functional (CSV/JSON)
- One email sent to a real researcher
- Enough fluency with the literature to hold a conversation without reaching for notes
- ORCID + Google Scholar profile live
- Grant landscape understood enough to start the R21/SBIR application in June

What success does NOT look like: new features, UI improvements, additional signal types, architecture refactors, or anything that feels like building instead of accumulating and positioning.
