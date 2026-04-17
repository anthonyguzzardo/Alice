# The Boston Process Approach Applied to Writing

**Date:** 2026-04-14
**Note:** The prediction engine, narrative reflection layer, and Bayesian grading system referenced in earlier theories were removed on 2026-04-16. The behavioral state engine is now purely deterministic (7D behavioral + 11D semantic), the LLM role is bounded to three jobs (question generation, calibration extraction, witness rendering), and reflections are structured data digests, not narrative prose. The competitive landscape, market analysis, and strategic positioning remain current.

---

## The Reframing

Theories 1 and 2 positioned Alice as a novel invention — something that doesn't exist yet and needs to be argued into existence. That framing was wrong.

Alice is the latest instantiation of a validated paradigm with a 40-year intellectual lineage, a $420M platform company already assembling adjacent tools, and FDA regulatory precedent for the exact input channel it uses. The paradigm has a name: **process-over-output cognitive assessment.** The question isn't whether it works — that's been answered. The question is who applies it to writing first.

---

## The Paradigm: Process Over Output

### The Intellectual Lineage

**Edith Kaplan's Boston Process Approach (1983-1988)** — The foundational insight in clinical neuropsychology: HOW a patient performs a cognitive task reveals far more than WHAT their final score is. A patient who draws a correct clock but takes three times longer with visible hesitation between numbers has a different neurological profile than one who draws it fluidly. Traditional scoring treats both as "correct." Kaplan argued the process IS the data.

This was a theoretical framework for 30 years because there was no way to capture process data at scale. A trained neuropsychologist had to sit in the room and watch. You couldn't digitize "the way someone hesitates."

Then three things happened:

**DCTclock (MIT, 2005 → Linus Health, 2020):** Digitized clock drawing with a pressure-sensitive pen capturing coordinates at 100+ fps. Extracted 700+ features from the drawing *process* — latency between strokes, pen speed, think-time ratio, spatial reasoning under time pressure. Result: AUC jumped from 0.66-0.79 (traditional scoring of the final drawing) to **0.89-0.93** (process analysis). A 13-27 point improvement in diagnostic accuracy from the same test, just by watching HOW instead of WHAT. 160+ peer-reviewed papers. TIME's 100 Best Inventions 2021. $65M raised at $420M valuation.

The killer finding (Rentz et al., 2021, *Neurology*, N=300): two people draw visually identical clocks. One hesitated longer, moved the pen slower, spent more time between strokes. That person had amyloid plaques — preclinical Alzheimer's with zero symptoms. Process analysis detected pathology that the output concealed. AUC 0.72 for amyloid detection in clinically normal adults, vs. 0.63 for the PACC (a 30-minute neuropsychological battery). The two-minute process-analyzed drawing outperformed the 30-minute standard test.

**neuroQWERTY (MIT, FDA Breakthrough Device Designation):** Applied process analysis to natural typing on a standard keyboard. Captures inter-key intervals, flight time, hold time — pure timing data. Throws away all text content. Detects Parkinson's motor signatures (tremor, bradykinesia) from keystroke timing irregularities. Funded by the Michael J. Fox Foundation. Published validation in JMIR (2018).

Significance: **the FDA accepted keystroke-derived signals as a medically meaningful biomarker.** The regulatory argument that typing patterns carry clinical-grade information has already been won.

**Winterlight Labs (acquired by Cambridge Cognition):** Applied process analysis to speech. Extracts 500+ features from how someone speaks — not what they say. Pauses, rhythm, word-finding latency, speech rate changes. Partnerships with Genentech, Johnson & Johnson. 82-100% accuracy range across conditions.

### The Pattern

Every one of these tools validates the same thesis: the temporal and kinematic process of performing a cognitive task contains diagnostic information that the final output does not. The organism compensates. The output gets "cleaned up" by compensatory mechanisms. The process cannot lie.

This isn't an Alice-specific claim. It's a paradigm with:
- A named intellectual lineage (Boston Process Approach, 1983)
- 160+ peer-reviewed papers in one modality alone (clock drawing)
- FDA regulatory precedent (neuroQWERTY Breakthrough Device Designation)
- A platform company assembling tools across modalities ($420M valuation)
- Validation across drawing, typing, speech, gait, and handwriting

---

## Where Writing Sits in This Landscape

### The Modality Hierarchy

Not all cognitive tasks produce equal signal. The hierarchy, ordered by cognitive depth:

| Modality | Cognitive Load | Signal Dimensions | Duration | Process Richness |
|---|---|---|---|---|
| Clock drawing | Low (rote motor + spatial) | Motor timing, spatial reasoning | 30-60 seconds | 700+ features |
| Passive typing | Minimal (motor only) | Keystroke timing | Continuous | Motor signatures only |
| Speech | Moderate (real-time production) | Acoustic, temporal, linguistic | Minutes | 500+ features |
| Gait/balance | Low (automatic motor) | Kinematic, postural | Minutes | Motion features |
| **Reflective writing** | **High (sustained cognition)** | **Motor + cognitive + linguistic + emotional + revision** | **15-30 minutes** | **60+ signals across 5 layers** |

Writing is the richest modality because it's the only one where:

1. **The task IS cognition.** Clock drawing tests spatial reasoning. Typing speed tests motor function. But writing — sustained reflective writing in response to a hard question — IS thinking. The person isn't performing a proxy task. They're doing the thing itself.

2. **The process and the product are both informative.** neuroQWERTY throws away text. Winterlight throws away content semantics. DCTclock throws away the final drawing (process features outperform it). Writing is the only modality where both layers — how you wrote AND what you wrote — carry independent, complementary signal. The keystrokes reveal cognitive effort. The text reveals cognitive content. The revision topology reveals cognitive editing. The linguistic features reveal emotional and processing state. No other modality produces this many orthogonal signal dimensions from a single task.

3. **Duration creates longitudinal signal within a single session.** A clock drawing takes 60 seconds. A writing session takes 15-30 minutes. Within-session trajectories — P-bursts consolidating from short to long (Baaijen & Galbraith 2012), deletion patterns shifting from early-heavy to late-heavy (Faigley & Witte 1981), cognitive word density increasing as thinking deepens (Pennebaker 2018) — are themselves diagnostic. You can't extract within-session trajectories from a 60-second task.

4. **The task is simultaneously measurement and intervention.** Pennebaker's unique finding: expressive writing is both diagnostic AND therapeutic. Exercise tests don't make you fitter. Cognitive games don't make you smarter (Lumosity's retracted flagship study). But writing about your thinking demonstrably improves your thinking (Cache County study: 53% dementia risk reduction from journal-keeping, Norton et al. 2016) while simultaneously measuring it. No other modality in the process-over-output paradigm has this property.

### What Exists vs. What's Missing

The process-over-output paradigm has been applied to:
- Drawing (DCTclock — 160+ papers, $420M company)
- Passive typing (neuroQWERTY — FDA Breakthrough)
- Speech (Winterlight — acquired by Cambridge Cognition)
- Gait (Kinesis — acquired by Linus Health)
- Handwriting (COGITAT — AUC 0.907, academic)

It has NOT been applied to:
- **Structured reflective writing** — the richest cognitive task, the one that produces the most signal dimensions, the one with 60 years of longitudinal evidence (Nun Study), and the one that is simultaneously therapeutic.

Nobody has built this. Not Linus Health. Not Cambridge Cognition. Not Cogstate. Not any of the $8B cognitive assessment market. Not any of the AI journaling apps. Not any of the digital phenotyping platforms.

The gap is not "nobody thought of it." The gap is that it requires fusing two research traditions that have never converged:
- **Writing process research** (Inputlog, Chenoweth & Hayes, Leijten & Van Waes) — knows how to capture and analyze the process of writing, but has never built consumer/clinical products
- **Digital phenotyping / computational linguistics** (LIWC, NRC, Pennebaker, Torous) — knows how to extract psychological signal from text, but has never captured the writing process

Alice sits at the intersection. That's not an accident of engineering — it's the only place in the landscape where these two research traditions meet.

---

## The neuroQWERTY Asymmetry

neuroQWERTY and Alice share an input channel (the keyboard) but target different layers:

| | neuroQWERTY | Alice |
|---|---|---|
| **What it sees** | Motor control | Cognitive processing |
| **Signal path** | Motor cortex → fingers → key timing | Cognition → writing behavior → keystrokes + text + revisions |
| **Input** | Passive typing across all apps | Structured reflective writing task |
| **Text content** | Discarded (privacy) | Analyzed (linguistic features) |
| **Revision behavior** | Not captured | Full topology (deletion decomposition, commitment ratio) |
| **Personal baselines** | Population norms | Within-person z-scoring across 7 behavioral + 11 semantic dimensions |
| **Clinical target** | Parkinson's (motor) | Cognitive-behavioral patterns |

The asymmetry that matters: **Alice already captures everything neuroQWERTY captures.** The inter-key intervals that neuroQWERTY uses for Parkinson's detection are sitting inside Alice's existing data stream. Alice could run a motor-signature detection model as a byproduct, without collecting a single additional data point.

neuroQWERTY cannot move in the other direction. Adding text analysis breaks their privacy model. Adding a structured writing task changes their product category. Adding personal cognitive baselines requires longitudinal within-person data they don't collect. Adding revision topology requires capturing deletions they don't track. Each addition is a ground-up rebuild.

This asymmetry means Alice doesn't compete with neuroQWERTY — it subsumes it. The same data stream that Alice uses for cognitive-behavioral analysis contains the motor signatures that neuroQWERTY uses for Parkinson's screening. One instrument, both layers.

---

## The Linus Health Playbook

Linus Health's trajectory is the clearest model for how a process-over-output cognitive tool becomes a company:

### Phase 1: Academic Research (2005-2015)
Randall Davis at MIT CSAIL and Dana Penney at Lahey Hospital build the digital clock drawing test. Ten years of academic research. Publication is the product. The technology proves itself in controlled studies before anyone tries to sell it.

### Phase 2: Spin-Out (2015-2019)
Digital Cognition Technologies founded to commercialize DCTclock. Small company, focused on the single instrument. No platform ambitions yet.

### Phase 3: Platform Acquisition (2020)
Linus Health (founded 2019 by David Bates and Alvaro Pascual-Leone from Harvard Medical School) acquires Digital Cognition Technologies. The instrument becomes the anchor of a platform play. $55M Series B at $420M valuation follows in 2021.

### Phase 4: Multimodal Assembly (2022-2024)
Three acquisitions in three years:
- **Kinesis Health Technologies** (2022) — gait and balance analysis (Dublin)
- **Aural Analytics** (2024) — speech biomarkers
- **Together Senior Health** (2024) — therapeutic intervention programs

Each acquisition adds a modality to the platform: drawing + gait + speech + intervention. The pattern is clear: Linus is assembling every process-over-output cognitive assessment tool into one integrated brain health platform.

### Phase 5: Remote + Population Scale (2025)
"Anywhere powered by Linus Health" launches — remote cognitive assessment without clinical supervision. League partnership brings cognitive screening to private health plans. The platform goes from clinical instrument to population-scale screening.

### What's Missing From Their Platform

| Modality | Status |
|---|---|
| Drawing process | DCTclock (owned) |
| Gait/balance | Kinesis (acquired 2022) |
| Speech process | Aural Analytics (acquired 2024) |
| Therapeutic intervention | Together Senior Health (acquired 2024) |
| **Writing process** | **Nobody. The gap.** |

Writing is the richest modality in the hierarchy. It's the one that is simultaneously measurement and intervention. It's the one with 60 years of longitudinal evidence (Nun Study). And it's the one Linus Health doesn't have.

---

## Strategic Options

### Option A: The Linus Health Conversation

Approach Linus Health directly. Not as a vendor. Not as a pitch. As a research conversation.

The message: "You've built a multimodal process-over-output platform across drawing, gait, and speech. Writing is the missing modality — the richest one, the one with the longest predictive window (Nun Study), and the one that's simultaneously therapeutic (Pennebaker). I've built a working implementation: 60+ deterministic signals from the writing process, 7D behavioral + 11D semantic state with PersDyn dynamics, deterministic behavioral state computation, longitudinal personal baselines. Here's a whitepaper. Is this a conversation worth having?"

Their acquisition pattern (DCT → Kinesis → Aural Analytics → Together) suggests they'd recognize this as filling their gap. Whether that's a partnership, a licensing deal, or an acquisition depends on validation state.

**What you'd need first:** The whitepaper. Even 90 days of your own data showing the signal pipeline working on real human writing over real time. They don't need N=1000. They need to see that the instrument produces real, interpretable, longitudinal behavioral signal from the writing process — because they already believe in the paradigm.

### Option B: The Independent Linus Health Path

Follow their exact trajectory independently:

1. **Academic publication** (now → 12 months). Publish the signal pipeline, the 7D behavioral + 11D semantic model. Target *Frontiers in Digital Health* (where DCTclock's primary validation was published), *JMIR* (where neuroQWERTY was published), or *Behavior Research Methods*. Open-source the signal computation layer. Build citations.

2. **Validation study** (6-18 months). Partner with a clinical psychology or cognitive science lab. 50-100 participants, 12 weeks, correlate the 7D behavioral + 11D semantic dimensions against established instruments (MoCA, PHQ-9, ADAS-Cog). One paper proving the signals correlate with gold-standard assessments transforms the project from "interesting tool" to "validated instrument."

3. **FDA registration** (12-24 months). neuroQWERTY's FDA Breakthrough Device Designation proves keystroke-derived signals are an acceptable biomarker pathway. DCTclock's Class II registration (possibly 510(k)-exempt) provides the regulatory template. A writing-based cognitive assessment tool would likely follow the same classification path.

4. **SBIR/STTR funding** (parallel to above). NIH NIMH PAR-25-170 (digital health biomarkers) and NSF HCI both fund exactly this kind of work. Phase I: $275K for the validation pilot. Phase II: $1-2M for platform development and larger validation. Non-dilutive.

5. **Platform or acquisition** (24+ months). Either build the platform independently (writing + the capabilities you can subsume from neuroQWERTY's motor detection) or become the acquisition target that completes someone else's multimodal platform.

### Option C: The Academic-First Path

Skip the company for now. This is a PhD.

The intersection of computational writing process research, digital phenotyping is an underexplored academic niche. The dissertation: "Process-Level Writing Analysis as a Passive Cognitive Performance Measure: A Longitudinal Within-Person Validation Study."

Natural advisors:
- **Luuk Van Waes / Marielle Leijten** (University of Antwerp) — built Inputlog, the standard research tool for writing process capture. You've built a computational implementation of their measurement framework.
- **James Pennebaker's students/successors** (UT Austin) — LIWC and expressive writing. The linguistic analysis layer is their work operationalized.
- **Joanne Sosnowska / Peter Kuppens** (KU Leuven) — PersDyn framework. The 8D dynamics model implements their personality dynamics theory.

Any of these groups would recognize Alice as a computational implementation of their published methods applied to a novel domain. That's a collaboration email, not a cold pitch.

A PhD provides: institutional affiliation (required for grants), IRB infrastructure (required for validation studies), publication credibility, and 3-5 years of funded development time. The opportunity cost is 3-5 years. The benefit is that you emerge with a validated instrument, published papers, and academic credibility — exactly what Randall Davis had when he spun out Digital Cognition Technologies from MIT.

### Option D: The neuroQWERTY Subsumption Play

The most aggressive option. Lean into the asymmetry.

Alice already captures everything neuroQWERTY captures. The inter-key intervals are in the data stream. If you can demonstrate motor-signature detection from Alice's keystroke data — even at a proof-of-concept level — you've shown that a single writing-based instrument can do cognitive assessment AND motor screening simultaneously. No other tool in the landscape does both.

This reframes Alice from "a cognitive assessment tool" to "a multimodal cognitive-motor assessment platform that captures both layers from a single daily writing session." That's a positioning Linus Health spent four acquisitions assembling across separate instruments.

**What you'd need:** A collaboration with a movement disorders researcher who can provide labeled Parkinson's/healthy keystroke data, and a proof-of-concept showing that Alice's existing inter-key interval capture detects the same motor signatures neuroQWERTY detects. If it works, the paper writes itself: "Simultaneous Cognitive-Behavioral and Motor Assessment Through Structured Writing: A Proof of Concept."

---

## What This Changes From Theory 3

Theory 3 concluded: "Theory 2 is the stronger theory, but neither addresses the N=1 bottleneck."

That conclusion stands. But the framing changes:

**Before:** Alice is a novel invention that needs to be argued into existence.
**After:** Alice is the application of a validated paradigm (Boston Process Approach) to the richest cognitive modality (writing) — the one modality that is simultaneously measurement and intervention, with the longest predictive window in the literature (Nun Study, 60 years), in a landscape where a $420M company is actively assembling process-over-output tools across every other modality and hasn't touched writing yet.

**Before:** The next move is "use Alice for 90 days and recruit 5-10 alpha testers."
**After:** The next move is the same — but now there's a specific destination. The 90 days of data and the whitepaper aren't just "proof points for an unknown path." They're the minimum viable package for a conversation with Linus Health, for a SBIR application, or for an email to Leijten/Van Waes/Pennebaker's successors. The target is visible.

**Before:** "Nobody does this" was an assertion.
**After:** "Nobody does this" is a mapped gap in a validated paradigm with named players, known revenue, published precedent, and a specific hole in a specific company's acquisition strategy.

The bottleneck hasn't changed. The instrument needs to prove itself on real humans over real time. But the destination on the other side of that bottleneck is now concrete rather than theoretical.

---

## The One-Sentence Version

Alice is the Boston Process Approach applied to writing — the richest cognitive modality, the only one that's simultaneously diagnostic and therapeutic, and the one nobody in a $420M validated paradigm has touched yet.
