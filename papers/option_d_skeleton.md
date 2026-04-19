# Option D: Skeleton and Working Document

**Working title:** *Design Constraints for Cognitive Measurement in an AI-Mediated World*

**Status:** Skeleton v2. Reframed from design specification to theoretical framework.

---

## 1. What This Paper Is

A theoretical framework paper arguing that AI mediation of human behavior is a modality-general problem that requires modality-general design constraints for any instrument that aims to measure cognitive function from behavioral output. The paper derives those constraints from the construct-replacement problem (Option B) and the convergent evidence across single-modality biomarker literatures, then articulates the properties any adequate instrument must satisfy without prescribing a specific architecture.

This is not a blueprint. It is a framework. The paper says: AI is changing how humans behave in ways we cannot fully predict, and the measurement tools the field has were built for a pre-AI behavioral landscape. Given that the construct-replacement threat is modality-general, the instruments that survive it must satisfy specific design constraints. Here are those constraints, here is why each is necessary, and here is the research program for testing whether constraint-satisfying instruments deliver what the framework predicts.

**What changed from v1:** The first skeleton proposed a specific architecture and staked it on a shared neural substrate claim. The critique identified two problems: the neuroscience is suggestive rather than settled, and claiming to have built the platform overstates what exists. The reframing shifts from "here is the instrument" to "here are the properties any adequate instrument must have, derived from the problem itself." The architecture becomes one possible response to the constraints, not the central claim. The neuroscience becomes one of several lines of evidence suggesting the constraints are achievable, not a load-bearing premise.

**Relationship to the arc:**
- B names the threat (construct replacement is modality-general)
- A demonstrates it in one domain (keystrokes)
- C establishes the stakes (cognitive reserve erosion, closing window)
- D derives the design constraints any adequate instrument must satisfy

All four papers identify and frame problems rather than claiming to have solved them. The arc coheres because all four are doing the same kind of intellectual work.

---

## 2. The Core Argument

**Premise 1.** Construct replacement (Option B) is not specific to any single behavioral modality. AI mediation can enter typing (autocomplete, AI-assisted drafting), speech (voice assistants, AI transcription smoothing), spatial behavior (navigation apps), decision-making (recommendation systems), and any other domain where AI assists, suggests, completes, or co-produces human output. The threat to behavioral measurement validity is modality-general.

**Premise 2.** The existing digital biomarker field is organized by modality. Keystroke dynamics, speech analysis, gait variability, and handwriting kinematics each have their own literature, their own instruments, and their own research communities. None of the existing instruments is designed to survive construct replacement in its own modality, and none is designed with awareness that construct replacement is occurring simultaneously across other modalities.

**Premise 3.** Process-level temporal biomarkers have been independently validated across multiple modalities. Keystroke timing predicts motor and cognitive decline (Giancardo et al., neuroQWERTY). Speech pause distributions distinguish AD, MCI, and healthy aging (Konig et al.). Gait stride variability predicts cognitive decline up to a decade before clinical presentation (Hausdorff, Verghese). Handwriting kinematics distinguish AD from healthy aging with high accuracy. Each literature has found that the cognitive signal lives in the temporal microstructure of behavior (pause distributions, timing variability, burst structure, error-correction dynamics), not in aggregate performance metrics.

**Premise 4.** Convergent neuroscience evidence suggests (but does not definitively establish) that this temporal microstructure reflects shared neural timing mechanisms. The basal ganglia and cerebellum form a timing system that serves both motor and cognitive modalities. 1/f neural noise slopes correlate across different tasks within individuals (Voytek et al.). Intraindividual variability in reaction time is a stable individual-difference measure regardless of the specific task producing it. This evidence is suggestive of a shared substrate, but the constraints derived below hold whether the substrate is fully shared, partially shared, or modality-specific.

**Derivation of constraints.** Given that (a) construct replacement is modality-general, (b) existing instruments are modality-specific and not designed for construct-replacement resistance, and (c) the cognitive signal lives in process-level temporal microstructure across all validated modalities, any adequate next-generation instrument must satisfy four design constraints:

**Constraint 1: Unassisted input.** The instrument must capture behavior produced without AI mediation, or detect and flag mediated segments. This is a direct derivation from the construct-replacement problem. An instrument that cannot distinguish mediated from unmediated input cannot know what construct its measurements index.

**Constraint 2: Process-level capture.** The instrument must capture the temporal microstructure of behavior, not the artifact it produces. The artifact (written text, spoken sentence, walked route, chess game) can be reproduced by AI. The process (pause distributions, timing variability, burst structure) cannot, because it reflects the real-time allocation of human attention, working memory, and executive control during performance.

**Constraint 3: Longitudinal n=1 baselines.** The instrument must build personal baselines and measure deviation from self rather than deviation from population norms. This is necessary because (a) modality heterogeneity across users makes population norms meaningless when different users contribute different practices, and (b) the construct-replacement threat alters population-level behavioral distributions over time, eroding the stability of any population norm.

**Constraint 4: Practice autonomy.** The instrument must attach to practices the user already maintains for intrinsic reasons, without creating new practices or instrumentalizing existing ones. This is a derivation from the construct-replacement problem itself: any instrument that introduces an external incentive structure during capture is introducing the same kind of construct replacement it was built to resist. Gamification of the measurement practice contaminates the signal in the same way AI mediation of the measured behavior contaminates the signal. Both substitute an external structure for the endogenous cognitive process the instrument claims to measure.

**Claim 1.** These four constraints are individually necessary and jointly sufficient for construct-replacement resistance. An instrument missing any one of them is vulnerable to the modality-general threat identified in Premise 1.

**Claim 2.** No existing digital biomarker instrument satisfies all four constraints. Multimodal clinical systems (Yamada et al., Living Lab, ADMarker) satisfy process-level capture but use population norms and structured tests. Digital phenotyping platforms (Onnela/Beiwe) satisfy practice autonomy but capture behavioral frequency rather than process-level microstructure. Structured clinical batteries satisfy process-level capture but violate practice autonomy and are periodic rather than longitudinal. Mindstrong satisfied process-level capture and practice integration for one modality but did not build personal baselines or detect AI mediation.

**Claim 3.** Instruments satisfying all four constraints would enable capabilities that no existing instrument provides, including within-person cross-modal temporal ordering of decline, modality-resilient baseline preservation, and ecologically valid continuous cognitive monitoring embedded in daily life. These are downstream predictions of the framework, not premises.

---

## 3. Audience and Venue

**Who this paper is for.** Digital biomarker researchers, cognitive scientists working on measurement validity, computational neuroscientists studying cognitive aging, and measurement theorists interested in what happens to behavioral instruments when AI alters the behavior being measured. Secondary audience: the clinical neuropsychology community following passive assessment, and the digital health policy community that needs frameworks for evaluating next-generation cognitive monitoring.

**Register.** Formal-academic, theoretical framework. The argument is empirically grounded (citing the single-modality literatures and the convergent neuroscience) but the contribution is conceptual: the constraints, their derivation, and the research program they imply. Not a methods paper. Not an engineering specification.

**Candidate venues.** *Trends in Cognitive Sciences*, *Nature Human Behaviour*, *Perspectives on Psychological Science*. These venues want theoretical frameworks with broad implications, not engineering specifications. A technical companion paper describing a specific architecture satisfying the constraints could follow in *Nature Digital Medicine*, *Patterns*, or *Behavior Research Methods*.

**Length target.** 5,000 to 7,000 words. Tighter than v1. The framework is the contribution; the literature review supports rather than dominates.

---

## 4. Literatures to Engage

**4.1. Single-modality process-level biomarkers.**

*Keystroke dynamics:*
- Giancardo et al. (neuroQWERTY): hold-time distributions detect early PD motor impairment during natural typing
- 2022 *Scientific Reports* meta-analysis: keystroke dynamics as feasible digital biomarkers for fine motor decline
- Smartphone keystroke dynamics longitudinally associated with MS outcomes (PMC 9679948)
- Kim et al. (2024), Li et al. (2025): the keystroke-cognition studies reviewed in Option A

*Speech timing and disfluency:*
- Konig et al. (INRIA): speech pause distributions as early AD marker
- Meta-analysis: AD patients pause ~1.20 SD longer than controls, MCI ~0.62 SD
- Both filled and unfilled pauses increase with decline, reflecting increased cognitive-linguistic load
- Luz et al. (Edinburgh): acoustic + linguistic features as consistent indicators across model architectures

*Gait variability:*
- Hausdorff (Tel Aviv): stride-to-stride variability as neurological dysfunction marker
- Verghese (Albert Einstein): dual-task gait paradigm, MCI-converters show increased variability before clinical conversion
- *Lancet Healthy Longevity* (2023): gait variability declines up to a decade before age 65
- Dual-task walking proposed as surrogate biomarker of subjective cognitive decline

*Chess performance:*
- Chess as "drosophila of cognitive psychology" due to Elo system providing longitudinal objective data
- Performance peaks in early-to-mid 30s, fluid abilities decline faster than crystallized
- Gap: no published work extracting temporal microstructure (move-time distributions, pause patterns) as cognitive biomarkers, only aggregate Elo trajectories

*Handwriting kinematics:*
- AD patients show greater writing pressure, slower speed, decreased stability
- Time-related features crucial in copying tasks (processing speed), pressure-related in memory tasks (recall confidence)
- ML classifiers achieve up to 96.55% accuracy

**4.2. Convergent neural timing evidence.**

- Basal ganglia and cerebellum form a shared timing system across motor and cognitive modalities (PMC 4879139)
- Motor timing variability across modalities reflects common neural mechanisms in shared brain networks
- Temporal structures show intra-individual reliability over sessions and tasks (Springer, 2022)
- 1/f neural noise as cognitive aging biomarker: noise slopes correlated between different tasks within individuals (Voytek et al., *Journal of Neuroscience*, 2015)
- Intraindividual variability in reaction time predicts executive function deficits and tau deposition even in cognitively unimpaired adults with early AD pathology
- Detrended fluctuation analysis applied across gait, wrist movements, neuronal oscillations, and speech: fractal scaling changes with cognitive decline

Note: this evidence is presented as suggestive of shared mechanisms, not as proof. The constraints hold regardless. The neuroscience explains why the constraints are achievable across modalities, not why they are necessary.

**4.3. Existing multimodal systems (for contrast).**

- Yamada et al. (IBM Research, 2021): combined gait + speech + drawing, 93% AD classification. Cross-sectional, population norms. Satisfies Constraint 2, violates 3 and 4.
- Living Lab (UK DRI, Imperial College): multicohort, multi-sensor, simulated home. Satisfies Constraint 2, violates 4 (structured environment, not natural practice).
- ADMarker (MobiCom 2024): activity classification, not process-level measurement. Violates Constraint 2.
- Altoida: FDA Breakthrough Device, tablet-based AR assessment. Satisfies Constraint 2, violates 3 and 4.
- Mindstrong (Dagum, 2017-2023): process-level biomarkers from smartphone interaction. Satisfies Constraints 2 and partially 4. Did not build personal baselines (Constraint 3) or detect AI mediation (Constraint 1). One modality only.
- Digital phenotyping (Onnela/Beiwe): passive daily capture. Satisfies Constraint 4 but captures behavioral frequency, not process-level temporal microstructure (violates Constraint 2).

**4.4. N-of-1 and idiographic assessment.**

- Idiographic assessment: individually selected variables and functional relations
- Intensive longitudinal methods show idiographic models reveal person-specific dynamics invisible to population analysis
- EMA paradata: response times to survey questions correlate with processing speed as a "free" passive biomarker
- Gap: almost all idiographic cognitive work uses self-report or structured tests, not passive process-level extraction from natural behavior

**4.5. Construct replacement and AI mediation (from Options A and B).**

- AI mediation enters every modality: autocomplete in typing, voice assistants in speech, navigation apps in spatial behavior, AI chess engines in analysis, predictive text on phones
- The closing-window argument generalizes across modalities
- Unmediated behavioral baselines are becoming scarce across all channels simultaneously

**4.6. Clinical ethics of passive longitudinal monitoring.**

- Consent frameworks for ambient in-home monitoring (ADMarker, Living Lab, digital phenotyping)
- The practice-autonomy/consent tension has precedents in this literature
- The distinction between transparency about purpose and specificity about features

---

## 5. Tentative Structure

### Section 1: Introduction

AI is changing how humans behave in ways we cannot fully predict, and the measurement tools the field has were built for a pre-AI behavioral landscape. The construct-replacement problem (cite Option B) is not specific to any single modality. It is occurring simultaneously across every behavioral channel where AI assists, suggests, or co-produces human output. The instruments designed to extract cognitive signal from human behavior were built on the assumption that the behavior being observed reflects the cognitive process the instrument claims to measure. That assumption is weakening across all modalities at once.

This paper asks: what design constraints must any adequate cognitive measurement instrument satisfy to remain valid as AI mediation becomes ubiquitous across behavioral channels? It derives four constraints from the construct-replacement problem, shows that no existing instrument satisfies all four, and articulates the research program for testing whether constraint-satisfying instruments deliver the capabilities the framework predicts.

### Section 2: The Measurement Target

The cognitive signal in behavioral biomarkers lives in the temporal microstructure of behavior, not in aggregate performance metrics. Across every modality where process-level biomarkers have been validated, the diagnostic features are the same kind of thing: pause distributions, timing variability, burst structure, error-correction dynamics, transition probabilities. The artifact (written text, spoken words, walked route) can in principle be produced by AI or by a human-AI hybrid. The temporal microstructure of its production cannot, because it reflects the real-time allocation of human attention, working memory, and executive control.

This is what makes process-level capture the right measurement target for a post-AI behavioral landscape: it indexes a property of human cognition that AI mediation alters rather than replicates.

### Section 3: Convergent Evidence Across Modalities

Review the single-modality literatures with emphasis on the structural parallels in which temporal features carry diagnostic signal. The argument: these literatures have independently converged on the same kind of measurement target (temporal microstructure) across different behavioral domains. This convergence is evidence that the design constraints derived in Section 5 are achievable, not just theoretically necessary.

Subsections by modality: keystroke dynamics, speech timing, gait variability, handwriting kinematics, chess (noting the temporal-microstructure gap in the chess literature as a prediction of the framework).

### Section 4: What the Neuroscience Suggests

Convergent evidence from basal ganglia timing systems, 1/f noise stability across tasks, fractal scaling properties, and intraindividual variability as a trait-level measure. Presented as suggestive of shared timing mechanisms across motor-cognitive modalities, not as proof.

Framing: "What the convergent evidence suggests about shared cognitive-neural mechanisms." Not: "Why the convergence is not coincidental."

This section does two things. First, it provides a neural-level explanation for why temporal microstructure carries cognitive information across modalities. Second, it raises a specific empirical question that the framework's instruments could help answer: is the temporal ordering of decline across modalities within individuals consistent with a shared substrate, or does it reveal modality-specific timing generators? The framework generates the prediction; the instruments test it.

### Section 5: Four Design Constraints

The core contribution. Derive each constraint from the construct-replacement problem:

**5.1. Unassisted input.** Derived from the construct-replacement definition itself. If you cannot distinguish mediated from unmediated input, you cannot know what construct your measurements index.

**5.2. Process-level capture.** Derived from the measurement target analysis in Section 2. Aggregate performance metrics are reproducible by AI; temporal microstructure is not. An instrument that captures only the artifact is vulnerable to construct replacement in ways an instrument that captures the process is not.

**5.3. Longitudinal n=1 baselines.** Derived from two sources: (a) construct replacement alters population-level behavioral distributions over time, eroding population norms; (b) modality heterogeneity across users makes population norms meaningless when different users contribute different practices. Deviation from self is the unit of analysis that survives both problems.

**5.4. Practice autonomy.** Derived from the construct-replacement problem applied to the measurement context itself. An external incentive structure imposed on the practice is a form of construct replacement: it substitutes externally motivated behavior for intrinsically motivated behavior, altering the cognitive state during capture. The instrument must not introduce the problem it was designed to resist.

Present these as individually necessary and jointly sufficient for construct-replacement resistance. Evaluate existing instruments against them (Yamada, Beiwe, Mindstrong, Altoida, clinical batteries) to show that none satisfies all four.

### Section 6: The Practice-Autonomy Constraint and the Consent Tension

Expanded treatment of Constraint 4 because it does the most philosophical work and faces the most ethical complexity.

The autonomy argument is nearly tautological from the construct-replacement framing, which is its strength: if you accept that external mediation of the measured behavior invalidates the measurement, you must also accept that external instrumentalization of the measured practice does the same thing. The logic is the same.

The consent tension: practice autonomy implies some degree of opacity about which specific features are diagnostic (to prevent feature-level optimization by users). Informed consent requires transparency about what is being measured. These are in tension.

Resolution approach: engage directly with the clinical ethics literature on passive longitudinal monitoring. The distinction between transparency about general purpose ("longitudinal cognitive monitoring from your daily practice") and specificity about diagnostic features ("burst-length coefficient of variation is a marker") is defensible. Users can be fully informed about what the instrument does without being told which specific features are diagnostic, just as a blood panel informs you that it measures health markers without specifying which enzymatic ratios are prognostic for which conditions.

Name the tension explicitly. Identify the design space for resolving it. Do not claim to have resolved it.

### Section 7: Downstream Predictions

What instruments satisfying all four constraints would enable. These are predictions of the framework, not premises:

**7.1. Within-person cross-modal temporal ordering.** If a user maintains multiple practices, a constraint-satisfying instrument could detect whether decline appears first in one modality or another. This is currently unobtainable by any existing passive instrument and would constitute a first-of-kind research contribution with direct clinical implications.

**7.2. Modality-resilient baseline preservation.** If AI mediation contaminates the signal in one modality for a given user, other modalities may remain clean. A constraint-satisfying instrument that operates across modalities is more resilient to construct replacement than one that depends on a single behavioral channel.

**7.3. Ecologically valid continuous monitoring.** By attaching to practices users already maintain, a constraint-satisfying instrument captures cognition in its natural deployment context at a frequency no periodic clinical assessment can match.

### Section 8: The Mathematical Common Ground

Brief section (not the centerpiece) noting that the extraction operations validated across modalities share mathematical structure: inter-event interval distribution fitting, variability measures (sample entropy, DFA), burst-pause segmentation, recurrence quantification. These operate on timestamped event streams regardless of what the events represent. This shared structure is an engineering observation that makes constraint-satisfying instruments more tractable to build, not a scientific claim about what the brain is doing. Note honestly that parameterizations differ by modality ("shared extraction framework with modality-specific tuning").

### Section 9: A Research Program

What the field should do with this framework:

**9.1. Evaluate proposed instruments against the four constraints.** The framework provides a rubric. New digital biomarker instruments can be assessed: which constraints does this instrument satisfy? Which does it violate? What are the implications for its construct validity under increasing AI mediation?

**9.2. Prioritize modality-specific validation within the constraint framework.** Each modality needs its own validation study demonstrating that process-level temporal features extracted under unassisted conditions predict cognitive outcomes. The framework structures the research program without prescribing the order.

**9.3. Pursue within-person cross-modal studies.** Even small-N studies of individuals maintaining multiple daily practices could test the cross-modal temporal ordering prediction and provide early evidence for or against the shared-substrate hypothesis.

**9.4. Develop input-provenance standards.** Constraint 1 (unassisted input) requires the ability to detect AI mediation. The field needs standards for input-side provenance that go beyond current data-quality metadata.

**9.5. Establish baseline corpora now.** The closing-window argument from Option A generalizes. Unmediated behavioral baselines across multiple modalities should be captured while they are still available, regardless of which specific instrument is used, so long as it satisfies the four constraints.

### Section 10: Limitations

- The framework derives constraints from the construct-replacement problem. If construct replacement turns out to be a less severe or less general threat than this paper and Option B argue, the constraints are more conservative than necessary. The framework is only as urgent as the threat is real.
- The neuroscience supporting shared timing mechanisms is suggestive, not definitive. The constraints hold regardless, but the achievability of modality-agnostic extraction depends on empirical work the framework can motivate but not substitute for.
- The practice-autonomy constraint limits the population the instrument can reach to people who maintain voluntary daily practices. This is a narrower population than "everyone" but broader than "people who journal." The framework does not solve the problem of measuring people who maintain no daily practice.
- The shared extraction framework requires modality-specific parameterization. "Shared math" does not mean "identical implementation." The engineering tractability of constraint-satisfying instruments is an empirical question for each modality.
- The ethical tension between practice autonomy and informed consent is identified but not resolved. The resolution depends on specific implementation contexts and evolving clinical ethics norms.
- This is a theoretical framework, not an empirical validation. The four constraints are derived from conceptual analysis. Whether instruments satisfying them actually deliver the predicted capabilities is an empirical program that has not yet been conducted.

### Section 11: Conclusion

The construct-replacement problem is modality-general. The instruments that survive it must be modality-general in their design constraints, even if they are modality-specific in their implementation. This paper derives four constraints (unassisted input, process-level capture, n=1 baselines, practice autonomy) from the construct-replacement problem, shows that no existing instrument satisfies all four, and articulates the research program for testing whether constraint-satisfying instruments deliver the capabilities the framework predicts. The convergent evidence across single-modality biomarker literatures and the suggestive neuroscience of shared timing mechanisms indicate that these constraints are achievable, not just theoretically necessary. What remains is the empirical work: modality-specific validation, cross-modal within-person studies, input-provenance standards, and the capture of unmediated baselines while they are still available. The framework structures that work. The field should begin it.

### Section 12: How This Framework Should Be Used

Brief, direct. Three use cases:

1. **Instrument evaluation.** Use the four constraints as a rubric to assess any proposed digital cognitive biomarker instrument's resilience to AI-mediation-era construct validity threats.
2. **Research prioritization.** Use the framework to identify which modality-specific validation studies, cross-modal within-person studies, and input-provenance standards are most needed.
3. **Policy and investment guidance.** Use the framework to evaluate claims about digital cognitive monitoring and to direct funding toward instruments and research programs that satisfy the constraints rather than ones that will be invalidated by the AI-mediation trajectory they ignore.

---

## 6. Relationship to Other Papers

**Option A** (demographic confound): Option A identifies a modality-specific problem (keystroke biomarkers depend on a population that lacks typing automaticity and is being replaced by a population whose typing is AI-mediated). Option D generalizes: the closing-window problem applies across modalities, and the design constraints for surviving it are modality-general.

**Option B** (construct replacement): Option B names the threat. Option D derives the instrument-design implications. The four constraints are direct consequences of the construct-replacement analysis. Option D is the "so what do we build?" response to Option B's "here's what's breaking."

**Option C** (cognitive reserve): Option C argues that AI offloading erodes reserve and that the field lacks instruments to detect the erosion. Option D specifies what those instruments must look like. The framework answers C's closing question without claiming to have built the answer.

**The series, in argument order:**
- B names the threat (construct replacement is modality-general)
- A demonstrates it in one domain (keystrokes)
- C establishes the stakes (cognitive reserve erosion, closing window)
- D derives the design constraints for instruments that survive the threat

All four identify and frame problems. None claims to have solved them. The arc coheres.

---

## 7. Pre-Drafting Work

1. **Deep read on convergent neural timing evidence.** The 1/f noise and basal ganglia timing literatures inform Section 4. The claims need to be precise about what is established vs. suggestive. Verify: are the within-individual cross-task correlations for 1/f noise slopes robust, or are they preliminary findings from small samples?

2. **Mathematical comparison across modalities.** Verify which extraction operations (DFA, entropy, ex-Gaussian) have been applied in at least two modalities with diagnostic results. Document where parameterizations diverge. This informs Section 8 (Mathematical Common Ground) and determines whether "shared extraction framework with modality-specific tuning" or "shared extraction framework" is the honest description.

3. **Find the strongest single example of cross-modal biomarker correlation within individuals.** This is the empirical anchor Section 4 needs. If even one study shows, e.g., that gait variability and speech pause distributions correlate within individuals and both predict cognitive outcomes, that study becomes foundational. If no such study exists, the within-person cross-modal prediction (Section 7.1) is the novel contribution the framework generates, and the neuroscience becomes a prediction the instruments could test.

4. **Survey the Mindstrong post-mortem.** Mindstrong is the closest predecessor. Understanding why it failed informs the framework's positioning. The tech was acquired by SonderMind. What survived?

5. **EMA paradata literature.** Response times to survey questions as passive cognitive biomarkers (PMC 10265432). Read in full. This is the closest existing precedent for "extract signal from the process of doing something the person does anyway."

6. **Chess temporal microstructure gap.** Verify that no published work extracts move-time distributions as cognitive biomarkers. If confirmed, this is a specific prediction of the framework: the temporal microstructure of chess play should carry cognitive signal, by analogy to every other modality where it has been tested.

7. **Clinical ethics of passive monitoring.** Read the consent frameworks for Living Lab, ADMarker, and digital phenotyping. The practice-autonomy/consent tension in Section 6 needs to be grounded in this literature, not just named in the abstract.

8. **Venue decision.** The reframed paper fits *Trends in Cognitive Sciences* or *Nature Human Behaviour* better than *Nature Digital Medicine* or *Patterns*. These venues want theoretical frameworks with broad implications. Decide before drafting, because it determines length, citation density, and how much of Section 8 (math) to include vs. supplement.

---

## 8. Open Questions for the Author

- **How to handle Alice in the paper.** The critique's recommendation: describe the framework abstractly, disclose the reference implementation in the author's note, mention Alice by name only in the disclosure. The argument should stand without Alice. If it only works when Alice is the implied answer, the framework is not strong enough.

- **Where does the deflationary supply argument go.** Not here. This paper is a theoretical framework. The deflationary supply argument (unmediated data appreciates as AI mediation becomes ubiquitous) is economic and strategic. It belongs in a separate essay, in the public-facing version of Option C, or in a short commentary piece. Mixing registers weakens the framework paper.

- **Whether to include Section 8 (Mathematical Common Ground) or move it to supplementary material.** If the venue is *Trends in Cognitive Sciences*, the math section may be too technical for the main text. If the venue is *Nature Human Behaviour*, a brief version in the main text with a supplementary table of cross-modality extraction operations may be the right balance.

- **How explicitly to frame the "no existing instrument satisfies all four" claim.** The constraint evaluation of existing instruments (Claim 2) is the most directly actionable part of the paper and also the most likely to generate pushback from the teams behind those instruments. The evaluation should be fair, specific, and based on published descriptions of each system's design, not on assumptions. Pre-drafting work should include reading each system's methods sections to verify which constraints they satisfy and which they violate.

---

## 9. Notes on What This Paper Is Not

- **Not a product pitch.** Alice satisfies the constraints. So could other instruments. The framework is larger than any one implementation.
- **Not an anti-AI paper.** The framework does not argue that AI mediation is bad. It argues that AI mediation changes what behavioral instruments measure, and that instruments designed for a pre-AI behavioral landscape need to be redesigned. The framework is about measurement validity, not about human flourishing (Option C covers that territory).
- **Not a claim to have solved the problem.** The framework derives constraints and articulates a research program. The empirical validation is future work. The paper is honest about this.
- **Not a neuroscience paper.** The neuroscience is suggestive context, not the contribution. The contribution is the constraint derivation and the research program.

---

*End of skeleton v2. The reframing from design specification to theoretical framework resolves the shared-substrate dependency, the Alice-as-stalking-horse risk, and the epistemic-overreach problem. The pre-drafting work centers on (1) verifying the convergent neural timing evidence at its actual strength, (2) finding the strongest cross-modal within-person empirical anchor, and (3) grounding the consent tension in the clinical ethics literature. Resolve those three before drafting.*
