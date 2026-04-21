# Option F: Skeleton and Working Document

**Working title:** *Reconstruction Validity: Self-Validation of Process-Level Behavioral Instruments via Adversarial Synthesis*

**Status:** Skeleton. Not yet drafted.

---

## 1. What This Paper Is

A methods paper introducing reconstruction validity as a new form of validity evidence for behavioral measurement instruments. The core move: if a measurement instrument captures enough structured information about a behavior to reconstruct that behavior from the measurements alone, then the measurements are demonstrably sufficient. The reconstruction fidelity is the validity metric. The gap between reconstruction and reality is the residual, and the residual characterizes exactly what the instrument does not capture.

This is not an application paper. It is a measurement theory contribution. The concept applies to any instrument that extracts features from a temporal behavioral stream: keystroke dynamics, speech analysis, gait, handwriting, eye tracking, musical performance. The specific implementation (a writing-process instrument with a Markov chain + motor profile reconstruction) is the existence proof, not the contribution.

The paper also responds to Condrey (2026), who proved that keystroke timing alone cannot distinguish composition from transcription (99.8% evasion rate). Condrey identified "content-process binding" as the necessary architecture. This paper demonstrates that an instrument capturing both content evolution and behavioral trace produces measurements sufficient for behavioral reconstruction, and that the reconstruction pipeline is itself the validation framework Condrey's result demands.

**Relationship to the arc:**
- B names the threat (construct replacement)
- A demonstrates it in one domain
- C establishes the stakes (cognitive reserve, closing window)
- D derives the design constraints
- E articulates the philosophical value (the process record)
- **F proves the instrument works (reconstruction validity as self-validation)**

---

## 2. The Core Argument

**Premise 1.** Behavioral measurement instruments extract features from temporal behavioral streams. The features are claimed to index cognitive or motor states. The standard approach to validating these claims is external-criterion validity: do the extracted features predict a clinically meaningful outcome? This requires large samples, longitudinal follow-up, and clinical gold standards.

**Premise 2.** There is a second kind of validity question that the field has not asked: are the extracted features sufficient? Do they capture enough structured information about the behavior to reconstruct it? This question is independent of whether the features predict a specific clinical outcome. It is about the information content of the measurement itself.

**Premise 3.** Reconstruction fidelity is a computable, deterministic metric that requires no external criterion, no population sample, and no clinical adjudication. It can be evaluated on n=1 data from the first session. It gets more informative as the corpus grows, but it is meaningful from the start.

**Claim 1: Reconstruction validity is a new form of validity evidence.** Classical validity taxonomy includes content validity, criterion validity, and construct validity. Reconstruction validity is orthogonal to all three. Content validity asks whether the instrument covers the right domain. Criterion validity asks whether the instrument predicts an outcome. Construct validity asks whether the instrument measures what it claims. Reconstruction validity asks whether the instrument captures enough information to regenerate the measured behavior. An instrument can have high reconstruction validity and low criterion validity (it captures the behavior faithfully but the behavior doesn't predict anything interesting). An instrument can have high criterion validity and low reconstruction validity (its features predict an outcome but don't capture the full behavior). The two are independent axes.

**Claim 2: The reconstruction residual is diagnostic.** The gap between reconstruction and reality is not noise. It is the structured information the instrument does not capture. In a writing-process instrument, the reconstruction succeeds on motor fingerprint (timing, digraph latencies, pause architecture) and vocabulary transitions (Markov chain), but fails on meaning, narrative structure, and argument coherence. The residual is the cognitive engagement: the thing that can't be reconstructed from behavioral measurements because it requires the mind that produced it. Characterizing the residual is as informative as characterizing the reconstruction.

**Claim 3: Reconstruction validity responds to Condrey's non-identifiability result.** Condrey (2026) proved that timing-only instruments cannot distinguish composition from transcription. His solution: content-process binding. Reconstruction validity demonstrates content-process binding empirically: an instrument whose measurements are sufficient to reconstruct both the content trajectory and the behavioral trace has, by construction, captured the binding between them. The adversarial test (can the instrument distinguish its own reconstruction from real behavior?) is the empirical answer to Condrey's theoretical challenge.

**Claim 4: The reconstruction pipeline doubles as an adversarial validator.** Running the reconstructed behavior through the same signal pipeline that produced the measurements creates a closed evaluation loop. The behavioral distance between reconstructed and real sessions is a quantitative, reproducible metric. This is structurally identical to analysis-by-synthesis in signal processing (Stevens & Halle 1962) and observability testing in control theory (Kalman 1960), but has never been applied to behavioral measurement instruments.

---

## 3. What Makes This Different from Existing Concepts

The individual components have precedents. The combination does not.

**Analysis-by-synthesis (signal processing).** Stevens & Halle (1962): analyze speech into parameters, resynthesize, compare. LPC codecs validate the vocal tract model by measuring reconstruction error. This validates the *codec*, not a *measurement instrument*. The purpose is signal compression/transmission fidelity, not behavioral measurement validity.

**Observability (control theory).** Kalman (1960): a system is observable if its internal state can be reconstructed from its outputs. The observability Gramian quantifies how reconstructible the state is from a given measurement set. This is the closest formal framework. The contribution here is applying it to behavioral instruments, where "the system" is a person writing and "the measurements" are extracted signal features.

**Autoencoder reconstruction loss (ML).** Hinton & Salakhutdinov (2006): compress input to latent representation, reconstruct, measure loss. The loss validates the representation. But ML frames this as representation learning, not instrument validation. Nobody in the autoencoder literature has said "the reconstruction loss tells you whether the latent space is a sufficient measurement of the input."

**Digital twins (healthcare).** Corral-Acero et al. (2020): computational models of individual patients. Validated by prediction accuracy (does the twin predict what the real system will do next?). Reconstruction validity is different: does the twin reproduce what the real system already did? Prediction requires generalization. Reconstruction requires information preservation. Different claims.

**What is genuinely novel:** Using behavioral reconstruction fidelity as the self-validation metric for a process-level measurement instrument operating on n=1 longitudinal data. No existing framework makes this specific move.

---

## 4. The Implementation (Existence Proof, Not the Contribution)

The paper needs a concrete implementation to demonstrate feasibility. The implementation is Alice's Avatar system:

**The instrument.** A writing-process measurement system that captures the full keystroke stream during daily journaling. The signal pipeline extracts six families of features: dynamical (permutation entropy spectrum, DFA, RQA), motor (ex-Gaussian IKI decomposition, digraph latencies, hold/flight times), process (text reconstruction, burst/pause segmentation, revision topology), semantic, cross-session, and a rolling personal behavioral profile aggregating all sessions.

**The reconstruction.** A Rust-native Markov chain trained on the journal corpus generates text following the person's word transition probabilities. Each character is paired with a timing delay synthesized from the person's motor profile: digraph-specific latencies where available, ex-Gaussian sampling otherwise, with P-burst pauses and sentence/word boundary pauses inserted according to the person's pause architecture percentages. The reconstruction uses no LLM. Content comes from transition probabilities on the personal corpus. Timing comes from the behavioral profile. Math from a measurement-grade Rust engine with its own PRNG (xoshiro128+).

**The validation loop.** The reconstructed keystroke stream is fed back through the same signal pipeline. The pipeline produces a 7D behavioral state for the reconstruction. This is compared to the 7D behavioral state of real sessions. The distance between them is the reconstruction validity metric. Where the distance is small, the measurements captured that dimension of the behavior. Where the distance is large, the measurements did not.

**Why no LLM.** The reconstruction must be bounded by what the instrument captures. An LLM would produce more coherent text, but the coherence would come from the model's training data, not from the instrument's measurements. The Markov chain preserves exactly the vocabulary and transition probabilities the instrument measures. The incoherence of the output is the point: it shows the ceiling of reconstruction from behavioral measurements alone, without external intelligence filling the gaps.

**Current state.** 8 journal sessions. Markov chain order 1 (upgrades to order 2 at 10+ entries). Profile dimensions: motor fingerprint, writing process shape, pause architecture, revision topology, language signature. The corpus is small and the reconstruction is in toy territory. The method is what matters.

---

## 5. Audience and Register

**Who this paper is for.** Measurement theorists and psychometricians interested in new forms of validity evidence. Digital biomarker researchers who need validation frameworks for n=1 longitudinal instruments. The keystroke dynamics community (authentication, clinical phenotyping, AI detection). Researchers responding to Condrey's non-identifiability result.

**Register.** Formal-academic with a methods focus. The contribution is the concept and the metric, not the implementation. The implementation section should be detailed enough to replicate but should not dominate the paper. The measurement theory framing is the lead.

**Candidate venues.** *Behavior Research Methods* (measurement methodology, accepts novel frameworks). *Psychometrika* (measurement theory, if the formalization is rigorous enough). *Patterns* (Cell Press, data science methods with broad implications). *Nature Digital Medicine* (if framed as digital biomarker validation methodology). A workshop paper at CHI or IJCB could precede the full paper.

**Length target.** 6,000 to 8,000 words. Methods paper, not a position essay.

---

## 6. Literatures to Engage

**6.1. Measurement theory and validity.**
- Messick (1995): the unified validity framework (construct validity subsumes all others). Reconstruction validity extends this by adding an information-sufficiency axis that is independent of construct interpretation.
- Kane (2006): the argument-based approach to validity. Reconstruction validity provides a specific type of validity argument: "the measurements contain enough information to regenerate the measured behavior."
- Borsboom, Mellenbergh & van Heerden (2004): the realist view of validity. Reconstruction validity aligns with their position that validity is about the causal relationship between the attribute and the test score.
- AERA/APA/NCME Standards (2014): the five sources of validity evidence. Reconstruction validity would be a sixth.

**6.2. Analysis-by-synthesis and signal reconstruction.**
- Stevens & Halle (1962): analysis-by-synthesis in speech perception
- Itakura (1968): LPC analysis-synthesis, Itakura-Saito distance
- Blanz & Vetter (1999): analysis-by-synthesis in 3D face reconstruction
- PESQ/POLQA standards for speech quality evaluation via reconstruction

**6.3. Observability and control theory.**
- Kalman (1960): observability criterion
- The observability Gramian as a quantitative measure of reconstruction feasibility
- Application to biological systems: Aguirre et al. (2018), observability of gene regulatory networks

**6.4. Condrey and the non-identifiability result.**
- Condrey (2026a): "On the Insecurity of Keystroke-Based AI Authorship Detection: Timing-Forgery Attacks Against Motor-Signal Verification." arXiv 2601.17280. The attack paper.
- Condrey (2026b): "Privacy-Preserving Proof of Human Authorship via Zero-Knowledge Process Attestation." arXiv 2603.00179. The constructive response (cryptographic). This paper offers the measurement-side response.
- Condrey (2026c): "A TEE-Based Architecture for Confidential and Dependable Process Attestation." arXiv 2603.00178.

**6.5. Synthetic keystroke generation.**
- Eizaguirre-Peral et al. (2022): cGAN for keystroke dynamics. arXiv 2212.08445.
- Acien, Morales, Giancardo et al. (2025): KeyGAN for digital phenotyping. *Computers in Biology and Medicine* 184.
- Gonzalez, Calot, Ierache & Hasperue (2022): Liveness detection against synthetic forgeries. *Systems and Soft Computing* 4.
- Dillon & Arushi (2025): Agent-based modeling of typing profiles. arXiv 2505.05015.
- DeAlcala et al. (2023): BeCAPTCHA-Type, CVPR 2023 Workshop.

**6.6. Keystroke AI detection (what reconstruction validity can validate).**
- Kundu et al. (2024): TypeNet-based AI detection from keystrokes. IJCB 2024.
- Mehta et al. (2026): Extended to 130 participants. IEEE TBIOM.
- Crossley & Tian (2024): Plagiarism detection using keystroke logs. EDM 2024.
- Deane (2026): Keystroke dynamics for nonoriginal text detection. *J. Educational Measurement*.
- Jiang, Zhang, Hao, Deane & Li (2024): Fairness of keystroke detection models. *J. Educational Measurement*.

**6.7. Digital twins and behavioral reconstruction.**
- Corral-Acero et al. (2020): Cardiac digital twins. *European Heart Journal*.
- Tao et al. (2019): Behavioral digital twins in manufacturing.
- Liu et al. (2023): Cognitive digital twin concept.

**6.8. n=1 and single-subject research design.**
- Barlow & Hersen: single-case experimental designs (foundational text)
- Molenaar (2004): manifesto on psychology as idiographic science
- de Vries & Morey (2013): Bayesian single-case estimation

---

## 7. Tentative Structure

### Section 1: Introduction

Behavioral measurement instruments extract features from temporal behavioral streams and claim those features index cognitive or motor states. The standard validation approach is external-criterion: correlate features with clinical outcomes. This paper introduces a complementary validation approach: reconstruction validity. If an instrument's extracted measurements contain enough structured information to reconstruct the measured behavior, the measurements are demonstrably sufficient. The reconstruction fidelity is computable, deterministic, requires no external criterion, and is meaningful from n=1.

The paper also addresses a specific open problem: Condrey (2026) proved that keystroke timing alone cannot distinguish composition from transcription, and identified "content-process binding" as the necessary architecture. Reconstruction validity demonstrates content-process binding empirically, and the adversarial evaluation loop provides the validation framework Condrey's result demands.

### Section 2: Reconstruction Validity as a Form of Validity Evidence

Define the concept formally. Situate it relative to Messick's unified framework, Kane's argument-based approach, and the AERA/APA/NCME standards. Argue that reconstruction validity is independent of criterion validity, content validity, and construct validity. It answers a question none of them ask: is the measurement informationally sufficient?

Introduce the reconstruction residual as a diagnostic quantity. The residual characterizes what the instrument does NOT capture, which is as informative as what it does capture.

### Section 3: Formal Parallels

Analysis-by-synthesis in signal processing. Observability in control theory. Autoencoder reconstruction loss in ML. Digital twin validation in healthcare. Show that the formal structure is identical in each case, but the application domain (behavioral measurement instruments) is new. Define reconstruction validity using the observability framework: an instrument has high reconstruction validity if the behavioral system is observable through its measurement set.

### Section 4: Method

Describe the specific implementation as an existence proof.

4.1. The instrument (signal pipeline: six feature families, keystroke-level capture, Rust-native computation).

4.2. The behavioral profile (rolling aggregation of motor fingerprint, writing process shape, pause architecture, revision topology, language signature).

4.3. The reconstruction (Markov chain on personal corpus for content, ex-Gaussian + digraph + pause architecture synthesis for timing). Justify the no-LLM constraint: reconstruction must be bounded by what the instrument captures.

4.4. The validation loop (feed reconstruction through the signal pipeline, compute behavioral distance in feature space). Define the distance metric.

### Section 5: The Condrey Response

Present the non-identifiability result. Show that timing-only instruments fail Condrey's attack because they measure motor execution without content binding. Show that an instrument capturing process signals (text reconstruction, revision coherence, burst semantics) alongside dynamical and motor signals captures the content-process binding Condrey requires.

The reconstruction validity framework is the empirical test: if the instrument can distinguish its own reconstruction (which has correct timing but Markov-generated content) from real sessions (which have both correct timing and authentic content evolution), the content-process binding is captured in the measurements. If it cannot distinguish them, either the reconstruction is perfect or the content-process binding is absent from the measurements. Both outcomes are informative.

### Section 6: Results (Early Trajectory)

Present the convergence curve at the current corpus size (n=8 sessions). This is explicitly early-stage. The contribution is the method and the metric, not the magnitude of the results. Frame as: "Here is the trajectory. We predict it reaches threshold X at approximately n=Y. The data collection is ongoing."

Define the perplexity of real responses under the Markov model as a complementary convergence metric. Show the trajectory.

### Section 7: What the Residual Reveals

The reconstruction succeeds on certain dimensions (motor fingerprint, vocabulary transitions) and fails on others (semantic coherence, narrative structure, argument flow). The failure dimensions characterize what the instrument does not capture: the cognitive engagement that produces meaningful content. This is not a limitation of the instrument. It is a measurement of the instrument's boundary.

Connect to Option C: the residual is the cognitive engagement that builds reserve. The thing that can't be reconstructed from measurements is the thing worth protecting.

Connect to Option E: the residual is the part of the process record that requires the mind, not just the motor system, to produce.

### Section 8: Generalizability

Reconstruction validity is not specific to keystroke dynamics. Any instrument that extracts features from a temporal behavioral stream can, in principle, construct a synthesis pipeline that regenerates behavior from those features and measures reconstruction fidelity. Sketch what this looks like for speech (vocoder resynthesis from extracted prosodic features), gait (stride generator from variability parameters), and handwriting (kinematic replay from extracted trajectory features). Each has its own synthesis challenges, but the validation framework is the same.

### Section 9: Limitations

- The corpus is small (n=8 sessions at time of writing). The convergence trajectory is early-stage.
- The Markov chain is a simple generative model. More sophisticated models (higher-order chains, neural language models trained on the corpus) could close part of the residual. The current residual is an upper bound on the instrument's information loss, not a tight bound.
- The validation loop measures reconstruction fidelity in the instrument's own feature space. This is circular by design (the instrument validates itself), which is the strength (no external dependency) and the limitation (it cannot validate features the instrument does not compute).
- The no-LLM constraint is methodologically justified but limits reconstruction quality. The tradeoff between methodological purity and reconstruction fidelity should be explored in future work.
- Single-subject design. The method's generalizability to other individuals requires replication.

### Section 10: A Research Program

10.1. **Close the validation loop.** Run the Avatar's output through the full signal pipeline. Compute behavioral distance. This is the immediate engineering prerequisite.

10.2. **Track convergence.** Measure perplexity and reconstruction fidelity after each new journal session. Plot the trajectory. Predict the convergence threshold.

10.3. **Run Condrey's attack.** Have the same user transcribe LLM-generated text. Run both authentic and transcribed sessions through the full pipeline. Measure whether process signals (not just timing) distinguish composition from transcription.

10.4. **Cross-modality reconstruction validity.** Apply the framework to speech, gait, or handwriting instruments. The framework predicts that reconstruction validity is achievable for any modality where process-level features have been validated.

10.5. **Formalize the metric.** Define reconstruction validity in terms of the observability Gramian or information-theoretic sufficiency. Derive theoretical bounds on reconstruction fidelity given the instrument's feature set.

### Section 11: Conclusion

Reconstruction validity is a computable, deterministic form of validity evidence that requires no external criterion, no population sample, and no clinical adjudication. It answers a question the existing validity framework does not ask: are the measurements informationally sufficient? The reconstruction residual characterizes the instrument's boundary. Applied to process-level behavioral instruments, reconstruction validity provides both self-validation and a direct response to the non-identifiability problem identified by Condrey (2026). The method and the metric are the contribution. The results improve with every session.

---

## 8. Relationship to the Arc

**Option A** (demographic confound): F validates the instrument A identifies as threatened.

**Option B** (construct replacement): F demonstrates that the instrument captures content-process binding, which is the feature that makes an instrument resistant to the construct replacement B names.

**Option C** (cognitive reserve): F's reconstruction residual IS the cognitive engagement that builds reserve. The thing the instrument can't reconstruct is the thing worth protecting.

**Option D** (design constraints): F demonstrates a validation methodology for instruments satisfying D's four constraints. Specifically, it tests Constraint 2 (process-level capture) by showing the capture is sufficient for reconstruction.

**Option E** (the process record): F proves the process record contains enough structured information to regenerate the behavior. The reconstruction is the proof that the record is more than an artifact.

F is the "it works" paper. The others say what's broken, what matters, what to build, and why. F says: here's how you know the instrument captures what it claims to capture.

---

## 9. Pre-Drafting Work

1. **Close the adversarial validation loop (engineering).** The paper cannot be written without the number. Run Avatar output through the signal pipeline. Compute behavioral distance. This is prerequisite.

2. **Define the distance metric formally.** Which dimensions of the 7D behavioral state contribute to the distance? How are they weighted? Is it Euclidean in the signal feature space, Mahalanobis with within-person variance weighting, or something else? The metric must be defined and justified.

3. **Implement perplexity tracking.** Compute per-session perplexity of real journal responses under the Markov model. This is the convergence metric that shows the model approaching the person's language production. Simple to implement: for each new session, score the response against the current chain.

4. **Read Messick (1995) and Kane (2006).** The measurement theory framing must engage their frameworks directly, not secondhand. The claim that reconstruction validity is a new form of validity evidence needs to be positioned precisely against the existing taxonomy.

5. **Read Condrey's three papers in full.** The response must be precise about what Condrey proved, what he proposed, and where the measurement-side answer fits relative to his cryptographic proposals.

6. **Verify the "no existing framework" claim.** Search specifically for "reconstruction validity," "generative validation," "synthesis validation" in the psychometric and behavioral science literature. Confirm the term does not already exist. The research agents found nothing, but the claim must be airtight.

7. **Run Condrey's attack against the full pipeline (if possible before paper).** Even a preliminary result (composition vs. transcription distinguishability using process signals, not just timing) would substantially strengthen the paper. This may require designing a transcription protocol and collecting a few transcription sessions.

---

## 10. Open Questions for the Author

- **How formally to define reconstruction validity.** Options range from intuitive (the narrative version in this skeleton) to mathematical (information-theoretic sufficiency, observability Gramian). The venue determines the register. *Behavior Research Methods* wants accessible formalism. *Psychometrika* wants proofs.

- **Whether to run Condrey's attack before submitting.** A Condrey-attack result (composition vs. transcription distinguishability) would be the paper's strongest empirical contribution. But it requires designing and running a transcription experiment. The paper is meaningful without it (reconstruction validity stands on its own), but dramatically stronger with it.

- **How much of the Rust implementation to include.** The signal pipeline and the Avatar are implemented in Rust via napi-rs. The engineering is relevant to reproducibility but may distract from the measurement theory contribution. Options: full implementation section, brief description with code link, or supplementary material.

- **Whether to position as a response to Condrey or as an independent contribution.** Both framings work. Response-to-Condrey is more timely and attention-getting but narrows the audience. Independent measurement theory contribution is broader but may not land as urgently. The paper can do both, with the Condrey response as a motivating application in Section 5 rather than the frame.

- **What to call the concept.** "Reconstruction validity" is clear and descriptive. Alternatives: "synthesis validity," "generative validity," "observability-based validity," "sufficiency-based validity." "Reconstruction validity" is probably right because it names the method (reconstruction) rather than the formalism (observability) or the mechanism (synthesis).

---

## 11. Citations to Add

These are new to the arc, identified during the April 20 landscape survey. DOIs need verification.

| Key | Full Citation | Source |
|-----|---------------|--------|
| Condrey 2026a | Condrey, D. (2026). On the Insecurity of Keystroke-Based AI Authorship Detection: Timing-Forgery Attacks Against Motor-Signal Verification. *arXiv* 2601.17280. | arXiv |
| Condrey 2026b | Condrey, D. (2026). Privacy-Preserving Proof of Human Authorship via Zero-Knowledge Process Attestation. *arXiv* 2603.00179. | arXiv |
| Condrey 2026c | Condrey, D. (2026). A TEE-Based Architecture for Confidential and Dependable Process Attestation in Authorship Verification. *arXiv* 2603.00178. | arXiv |
| Acien et al. 2025 | Acien, A., Morales, A., Giancardo, L., Vera-Rodriguez, R., Holmes, J., Fierrez, J., & Arroyo-Gallego, T. (2025). KeyGAN: Synthetic Keystroke Data Generation in the Context of Digital Phenotyping. *Computers in Biology and Medicine*, 184. | PubMed |
| Gonzalez et al. 2022 | Gonzalez, N., Calot, E., Ierache, J., & Hasperue, W. (2022). Towards Liveness Detection in Keystroke Dynamics: Revealing Synthetic Forgeries. *Systems and Soft Computing*, 4. | ScienceDirect |
| Stragapede et al. 2024 | Stragapede, G., et al. (2024). TypeFormer: Transformers for Mobile Keystroke Biometrics. *Neural Computing and Applications*. | Springer |
| Stragapede et al. 2025 | Stragapede, G., et al. (2025). KVC-onGoing: Keystroke Verification Challenge. *Pattern Recognition*. | ScienceDirect |
| Mehta et al. 2026 | Mehta, A., Kumar, R., et al. (2026). Detecting LLM-Assisted Academic Dishonesty using Keystroke Dynamics. *IEEE TBIOM*. arXiv 2511.12468. | arXiv/IEEE |
| Crossley & Tian 2024 | Crossley, S. & Tian, Y. (2024). Plagiarism Detection Using Keystroke Logs. *EDM 2024 Proceedings*. | EDM |
| Deane 2026 | Deane, P. (2026). Using Keystroke Dynamics to Detect Nonoriginal Text. *J. Educational Measurement*. | Wiley |
| Jiang et al. 2024 | Jiang, Y., Zhang, M., Hao, J., Deane, P., & Li, C. (2024). Using Keystroke Behavior Patterns to Detect Nonauthentic Texts: Evaluating Fairness. *J. Educational Measurement*. | Wiley |
| Zafar et al. 2025 | Zafar, Z., Yousaf, A., & Minhas, S. (2025). Can You See Me Think? Grounding LLM Feedback in Keystrokes and Revision Patterns. *arXiv* 2508.13543. | arXiv |
| Roh et al. 2025 | Roh, et al. (2025). LLM-Assisted Cheating Detection in Korean Language via Keystrokes. *IEEE IJCB 2025*. arXiv 2507.22956. | arXiv |
| Knol et al. 2024 | Knol, M., et al. (2024). Smartphone keyboard dynamics predict affect in suicidal ideation. *npj Digital Medicine*. | Nature |
| Liu et al. 2024 | Liu, et al. (2024). Digital Phenotypes of Mobile Keyboard Backspace Rates. *JMIR*. | JMIR |
| Ajilore et al. 2025 | Ajilore, O., et al. (2025). Assessment of cognitive function in bipolar disorder with passive smartphone keystroke metadata. *Frontiers in Psychiatry*. | Frontiers |
| Ning et al. 2025 | Ning, et al. (2025). Predicting Cognitive Functioning through Smartphone Typing Dynamics. *J. Psychopathology and Clinical Science*. | APA |
| Tat et al. 2025 | Tat, T., et al. (2025). Diagnosing Parkinson's disease via behavioral biometrics of keystroke dynamics. *Science Advances*. | Science |
| Stevens & Halle 1962 | Stevens, K., & Halle, M. (1962). Speech recognition: A model and a program for research. *IRE Transactions on Information Theory*, 8(2), 155-159. | IEEE |
| Kalman 1960 | Kalman, R. E. (1960). A New Approach to Linear Filtering and Prediction Problems. *ASME J. Basic Engineering*, 82(1), 35-45. | ASME |
| Messick 1995 | Messick, S. (1995). Validity of psychological assessment. *American Psychologist*, 50(9), 741-749. | APA |
| Kane 2006 | Kane, M. T. (2006). Validation. In R. L. Brennan (Ed.), *Educational Measurement* (4th ed.). ACE/Praeger. | Book |
| Corral-Acero et al. 2020 | Corral-Acero, J., et al. (2020). The digital twin to enable the vision of precision cardiology. *European Heart Journal*, 41(48), 4556-4564. | Oxford |

---

*End of skeleton. The engineering prerequisite (closing the adversarial validation loop) must be completed before drafting. The measurement theory reading (Messick, Kane) must be done before the framing is finalized. The concept is novel; the paper's job is to name it, formalize it, demonstrate it, and connect it to Condrey. Everything else in the arc motivates why this kind of validation matters. This paper proves it works.*
