---
title: "Reconstruction Validity: Self-Validation of Process-Level Behavioral Instruments via Adversarial Synthesis"
slug: reconstruction-validity
author: Anthony Guzzardo
date: 2026-04-20
status: published
version: 1
target_venue: Behavior Research Methods
abstract: "Behavioral measurement instruments extract features from temporal behavioral streams and claim those features index cognitive or motor states. The standard approach to validating these claims is external-criterion: correlate extracted features with clinically meaningful outcomes. This paper introduces reconstruction validity, a complementary form of validity evidence in which the instrument's measurements are used to reconstruct the behavior they were extracted from, and the fidelity of the reconstruction is the validity metric. Reconstruction validity is computable, deterministic, requires no external criterion, and is meaningful from n=1. The reconstruction residual, the structured gap between reconstruction and reality, characterizes what the instrument does not capture. The paper formalizes the concept using the observability framework from control theory, demonstrates feasibility through a writing-process instrument that reconstructs keystroke behavior from extracted signal features via Markov chain text generation and motor profile timing synthesis, and shows that the framework provides a direct empirical response to the non-identifiability problem in keystroke-based authorship verification identified by Condrey (2026)."
---

# Reconstruction Validity: Self-Validation of Process-Level Behavioral Instruments via Adversarial Synthesis

**Anthony Guzzardo**
April 2026

---

*Author's note: The author is developing a longitudinal journaling system that implements the measurement instrument and reconstruction pipeline described in this paper. The reconstruction validity framework is a general contribution to measurement theory that does not depend on any specific implementation. Readers should apply additional scrutiny to the implementation sections where the framework is demonstrated using the author's system.*

---

## 1. Introduction

A behavioral measurement instrument makes an implicit claim: that the features it extracts from observed behavior contain meaningful information about the person who produced the behavior. Validating this claim is the central problem of measurement theory. The dominant approach is external-criterion validity: show that extracted features correlate with outcomes the field cares about. Keystroke timing features predict cognitive decline (Kim et al. 2024; Li et al. 2025). Speech pause distributions distinguish Alzheimer's patients from healthy controls (Konig et al. 2019). Gait variability predicts cognitive impairment up to a decade before clinical presentation (Verghese et al. 2007). In each case, the validity argument is: the features predict something. Therefore the features measure something.

This is necessary but incomplete. Criterion validity tells you that extracted features carry signal. It does not tell you how much of the original behavior's information the features preserve. A feature set that predicts a single clinical outcome with moderate accuracy might capture only a narrow slice of the behavioral stream, or it might capture a comprehensive portrait of the person's cognitive-motor state. Criterion validity cannot distinguish between these cases, because it evaluates features against an external standard rather than against the behavior they were extracted from.

This paper introduces a second kind of validity question: are the extracted features *sufficient*? Do they contain enough structured information about the behavior to reconstruct it? If a measurement instrument's features can regenerate the measured behavior with high fidelity, those features are demonstrably capturing the behavioral stream's structure. If the reconstruction fails in specific, characterizable ways, those failures identify exactly what the instrument does not capture.

The concept, which this paper terms *reconstruction validity*, is not new in other fields. Signal processing has used analysis-by-synthesis since Stevens and Halle (1962). Control theory has formalized observability since Kalman (1960). Machine learning uses autoencoder reconstruction loss to validate latent representations (Hinton and Salakhutdinov 2006). What is new is applying the framework to behavioral measurement instruments, where the "signal" is a person's behavior and the "analysis" is the instrument's feature extraction pipeline. The contribution is the application and its implications, not the mathematical structure.

The paper also addresses a specific open problem. Condrey (2026a) demonstrated that keystroke timing features alone cannot distinguish genuine composition from transcription of AI-generated text. His non-identifiability result showed that the mutual information between motor timing features and content provenance is zero: timing confirms that a human operated the keyboard, not that the human originated the text. His proposed solution is "content-process binding," architectures that couple the semantic trajectory of a text to the behavioral trace of its production. Reconstruction validity provides the empirical test for whether an instrument achieves content-process binding. If the instrument's features are sufficient to reconstruct both the content trajectory and the behavioral trace, the binding is captured in the measurements. The validation framework and the authorship verification problem turn out to require the same thing.

---

## 2. Reconstruction Validity as Validity Evidence

### 2.1 The Existing Framework

The current validity framework, as codified in the *Standards for Educational and Psychological Testing* (AERA, APA, and NCME 2014) and theorized by Messick (1995) and Kane (2006), organizes validity evidence into five categories: test content, response processes, internal structure, relations to other variables, and consequences of testing. These cover what the instrument contains, how people respond to it, whether it hangs together internally, whether it predicts external outcomes, and what happens when it is used.

None of these categories asks whether the instrument's measurements are informationally sufficient. Whether the extracted features preserve the information content of the measured behavior. This is a question about the measurement itself, not about its relationship to anything external.

### 2.2 The Proposal

Reconstruction validity is the degree to which an instrument's extracted measurements contain enough structured information to regenerate the behavior they were extracted from. It is operationalized as the fidelity of a reconstruction pipeline that takes the instrument's output (extracted features, aggregated profiles, derived metrics) and produces a synthetic behavioral stream, which is then compared to the original.

The metric is the distance between the reconstructed and original behavioral streams, measured in the instrument's own feature space. This circularity is intentional. The instrument validates itself by testing whether its own outputs are sufficient to regenerate its own inputs. The circularity is the feature: reconstruction validity requires no external criterion, no population normative sample, and no clinical gold standard. It is computable from a single participant's data.

### 2.3 Independence from Other Forms of Validity

Reconstruction validity is orthogonal to the existing taxonomy.

**Independence from criterion validity.** An instrument can have high reconstruction validity and low criterion validity: it captures the behavior faithfully, but the behavior does not predict any clinical outcome. Conversely, an instrument can have high criterion validity and low reconstruction validity: a single extracted feature (say, mean inter-keystroke interval) might predict cognitive decline but preserves almost none of the behavioral stream's structure. The two axes are independent.

**Independence from construct validity.** Construct validity asks whether the instrument measures the construct it claims to measure. Reconstruction validity asks whether the instrument captures enough of the behavior to regenerate it. An instrument could perfectly reconstruct the behavior while being entirely wrong about what construct the behavior indexes. The information sufficiency question and the construct interpretation question are separate.

**Independence from content validity.** Content validity asks whether the instrument covers the intended domain. Reconstruction validity asks whether what it does cover is captured with sufficient fidelity to be reversible. An instrument with narrow coverage but high reconstruction validity within that coverage is different from an instrument with broad coverage but low fidelity.

### 2.4 The Reconstruction Residual

The most informative component of reconstruction validity is not the fidelity but the residual: the structured gap between reconstruction and reality. The residual is not noise. It is the information the instrument's features do not preserve.

In a writing-process instrument, the reconstruction might succeed on motor dimensions (timing distributions, digraph latencies, pause architecture) and vocabulary dimensions (word transition probabilities, lexical diversity) while failing on semantic dimensions (argument coherence, narrative structure, meaning). The failure characterizes the instrument's boundary. The dimensions on which reconstruction succeeds are the dimensions the instrument captures. The dimensions on which it fails are the dimensions it does not.

This makes the residual diagnostic. Instead of asking "does the instrument work?" as a binary question, reconstruction validity produces a dimensional answer: the instrument captures these aspects of the behavior and not those. The residual map is a more informative validity assessment than any single correlation coefficient.

---

## 3. Formal Parallels

The mathematical structure of reconstruction validity exists in several established fields. The contribution is not the structure but the application to behavioral measurement.

### 3.1 Analysis-by-Synthesis in Signal Processing

Stevens and Halle (1962) proposed the analysis-by-synthesis model of speech perception: the listener generates candidate speech signals from an internal model and compares them to the observed signal. The engineering inverse, synthesis-from-analysis, is foundational to speech coding. Linear predictive coding (LPC) analyzes speech into vocal tract parameters, resynthesizes speech from those parameters, and measures reconstruction error using the Itakura-Saito distance (Itakura 1968). The reconstruction error validates the parametric model: if the parameters are sufficient to regenerate perceptually equivalent speech, they capture the structure of the original signal.

This is structurally identical to reconstruction validity. Replace "speech signal" with "behavioral stream," "vocal tract parameters" with "extracted behavioral features," and "perceptual quality" with "behavioral fidelity." The math is the same. The domain is different.

### 3.2 Observability in Control Theory

Kalman (1960) defined observability as the property of a dynamical system whose internal state can be fully determined from its outputs. A system is observable if, given the output measurements, you can reconstruct the state trajectory. The observability Gramian provides a quantitative measure of how reconstructible the state is from a given measurement set.

Translated to behavioral instruments: the behavioral system is the person producing behavior. The measurements are the instrument's extracted features. The system is "observable through the instrument" if the features are sufficient to reconstruct the behavioral trajectory. Reconstruction validity is the empirical estimate of the instrument's observability.

This framing provides a natural language for the reconstruction residual. When reconstruction fails on a specific dimension, the behavioral system is not fully observable through the instrument on that dimension. The observability deficit is localized and measurable.

### 3.3 Autoencoder Reconstruction Loss

The autoencoder architecture (Hinton and Salakhutdinov 2006) compresses an input to a latent representation and reconstructs the input from the representation. The reconstruction loss is the standard validation metric for the latent space: lower loss means the representation preserves more of the input's structure.

Reconstruction validity applies the same logic, but frames it as instrument validation rather than representation learning. The "encoder" is the signal pipeline. The "latent representation" is the extracted feature set. The "decoder" is the reconstruction pipeline. The reconstruction loss is the validity metric. The framing shift matters because it connects to the measurement theory literature rather than the machine learning literature, reaching the audience that needs the concept.

### 3.4 Digital Twins

The digital twin paradigm in healthcare (Corral-Acero et al. 2020) builds computational models of individual patients that simulate physiological responses. Digital twins are validated by prediction accuracy: does the model predict what the real system will do next? Reconstruction validity makes a different claim: can the model reproduce what the real system already did? Prediction requires generalization beyond the training data. Reconstruction requires information preservation within the training data. Both are useful. They answer different questions.

---

## 4. Method: An Existence Proof

The reconstruction validity framework is general. Any instrument that extracts features from a temporal behavioral stream can, in principle, construct a synthesis pipeline and evaluate reconstruction fidelity. This section describes one specific implementation as a feasibility demonstration.

### 4.1 The Instrument

The instrument is a writing-process measurement system embedded in a daily journaling application. The user responds to one question per day by typing in a standard text input field. The system captures the full keystroke stream: every key-down and key-up event with millisecond timestamps and character identity.

A signal pipeline, implemented as a native Rust module accessed via napi-rs, extracts six families of features from the raw keystroke stream:

**Dynamical signals.** Permutation entropy at orders 3 through 7 (the PE spectrum, following Bandt and Pompe 2002), providing a multi-scale complexity profile. Detrended fluctuation analysis (DFA) scaling exponent (Peng et al. 1994), characterizing long-range temporal correlations. Recurrence quantification analysis (RQA) metrics including recurrence rate, determinism, and entropy of diagonal line lengths (Marwan et al. 2007). Kraskov-Stogbauer-Grassberger (KSG) transfer entropy between IKI series and hold times (Kraskov et al. 2004).

**Motor signals.** Ex-Gaussian decomposition of the inter-keystroke interval (IKI) distribution via maximum likelihood estimation using expectation-maximization (Lacouture and Cousineau 2008), yielding mu (Gaussian mean), sigma (Gaussian standard deviation), and tau (exponential tail, reflecting attentional lapses). Per-digraph latency profiles. Hold time and flight time distributions. Sample entropy of the IKI series. IKI autocorrelation structure.

**Process signals.** Full text reconstruction from the keystroke stream, recovering the editing history including deletions, insertions, and cursor movements. Pause classification by linguistic boundary: within-word, between-word, and between-sentence (Wengelin 2006). P-burst segmentation (production bursts bounded by pauses exceeding 2 seconds, following Chenoweth and Hayes 2001). R-burst and I-burst classification for revision and insertion episodes.

**Semantic signals.** Moving-average type-token ratio (MATTR, Covington and McFall 2010). Vocabulary metrics.

**Cross-session signals.** Session-over-session trajectory features comparing the current session's signal profile to the rolling personal baseline.

**Personal behavioral profile.** A rolling aggregate across all sessions, stored as a single-row database record, updated after each session. The profile includes: aggregate digraph latency map, ex-Gaussian parameter means and standard deviations, IKI distribution shape statistics, hold/flight time baselines, burst count and length statistics, consolidation ratio (second-half vs. first-half burst lengths), session duration and word count distributions, pause architecture percentages (within-word, between-word, between-sentence), pause rate, first keystroke latency, revision topology (deletion rates, timing bias, R-burst ratio), character trigram transition model, cumulative vocabulary size, and MATTR baseline.

All signal computation is performed in Rust. The Rust crate is the single implementation of every signal computation. There is no parallel implementation in another language. A measurement instrument cannot have two implementations, because disagreement between them would be indistinguishable from a bug.

### 4.2 The Reconstruction Pipeline

The reconstruction pipeline takes the instrument's accumulated outputs (the personal behavioral profile and the journal corpus) and generates a synthetic writing session: both the text and the per-character timing.

**Text generation.** A word-level Markov chain is trained on the full journal corpus. The tokenizer preserves punctuation as separate tokens. Sentence-initial tokens are recorded as chain starters. At fewer than 10 corpus entries, the chain operates at order 1 (unigram context). At 10 or more entries, it upgrades to order 2 (bigram context). Text generation is seeded with a topic word: the chain searches for a starting state containing the seed, falling back to a random starter. Generation proceeds by weighted random walk through the transition matrix until the target word count is reached. Dead ends (states with no outgoing transitions) trigger a jump to a random starter.

The choice of a Markov chain over a neural language model is methodologically load-bearing. The reconstruction must be bounded by what the instrument captures. The personal behavioral profile includes vocabulary, word transition probabilities (implicitly, through the corpus), and statistical properties of the writing process. It does not include a model of meaning, argument structure, or narrative coherence. An LLM trained on the corpus would introduce coherence from the model's own capabilities, not from the instrument's measurements. The Markov chain generates text using only the statistical structure the instrument can observe: which words follow which other words in this person's writing. The incoherence of the output at low corpus sizes is informative, not a failure. It shows the ceiling of text reconstruction from the instrument's measurement set.

**Timing synthesis.** Each character in the generated text is assigned a delay in milliseconds, synthesized from the personal motor profile. The synthesis proceeds through a priority hierarchy:

1. The first character receives a delay sampled from the first-keystroke latency distribution (mean from profile, with uniform jitter).
2. P-burst pauses: after approximately burst-length characters at a word boundary, a pause of 2000 to 4000 ms is inserted, mimicking the production burst structure.
3. Sentence boundary pauses: after sentence-ending punctuation followed by a space, a pause of 800 to 3000 ms is inserted with probability proportional to the between-sentence pause percentage from the profile.
4. Word boundary pauses: at spaces following words, a short pause of 300 to 1200 ms is inserted at the population base rate of approximately 8%.
5. Digraph-specific timing: if the preceding and current character form a bigram present in the aggregate digraph latency map, the mean latency for that bigram is used, with Gaussian jitter (standard deviation 20 ms).
6. Fallback: an ex-Gaussian sample from the personal IKI distribution (mu, sigma, tau), floored at 30 ms.

The synthesis uses a self-contained pseudorandom number generator (xoshiro128+, Blackman and Vigna 2018) seeded from system time, with no external dependencies. Box-Muller transform for Gaussian sampling. The exponential component of the ex-Gaussian is sampled via inverse CDF.

### 4.3 The Validation Loop

The reconstruction produces a synthetic character sequence with per-character timing. This is structurally identical to a real keystroke stream (a sequence of characters with inter-event intervals), minus deletions and cursor movements. The synthetic stream can be passed through the same signal pipeline that processes real sessions.

The pipeline produces a feature vector for the synthetic session. This vector is compared to the feature vectors of real sessions. The distance between them, computed dimension by dimension, is the reconstruction validity metric.

Dimensions where the distance is small (the reconstruction matches reality) are dimensions the instrument captures with sufficient fidelity to be reversible. Dimensions where the distance is large (the reconstruction diverges from reality) are dimensions the instrument does not capture, or captures at insufficient resolution.

The per-dimension distance profile is the reconstruction validity report. It replaces the binary question "does the instrument work?" with a dimensional map: "the instrument captures motor fingerprint with fidelity X, pause architecture with fidelity Y, temporal complexity with fidelity Z, and does not capture semantic coherence at all."

---

## 5. The Condrey Response

### 5.1 The Non-Identifiability Result

Condrey (2026a) demonstrated a fundamental limitation of keystroke-timing-based authorship verification. Using three attack variants (histogram sampling, statistical impersonation, and a generative LSTM) tested against five classifiers on 13,000 sessions from the SBU keystroke corpus, he achieved evasion rates of 99.8% or higher. The simple copy-type attack, in which a human transcribes AI-generated text keystroke by keystroke, achieves 100% evasion by construction: the timing trace is genuine human motor output. The motor system does not know or care whether the person is composing or copying.

Condrey formalized this as a non-identifiability result: when the observation channel is limited to motor timing features, the mutual information between those features and content provenance is zero. Timing features are sufficient to confirm that a human operated the keyboard. They are not sufficient to confirm that the human originated the text.

### 5.2 Content-Process Binding

Condrey identified three architectural approaches that could, in principle, break the non-identifiability:

1. **Revision-history coherence.** Genuine composition produces non-monotonic text evolution: writing, deleting, rephrasing, inserting earlier, resuming. Transcription is predominantly linear and forward-flowing.
2. **Semantic coherence monitoring.** The semantic trajectory of composed text reflects an unfolding argument or narrative. Transcription reflects the structure of the source text, which may not match the person's typical ideation patterns.
3. **Content-process binding.** The general requirement: the semantic trajectory of the emerging text must be coupled to the behavioral trace of its production in a way that timing-only observation cannot forge.

Condrey's constructive follow-up papers proposed cryptographic solutions: zero-knowledge process attestation (Condrey 2026b) and trusted execution environment architectures (Condrey 2026c). These address the verification problem (how to prove that content-process binding exists in a session without revealing the underlying data). They do not address the measurement problem: what features must an instrument capture to achieve content-process binding in the first place?

### 5.3 Reconstruction Validity as the Measurement-Side Answer

Reconstruction validity provides the measurement-side complement to Condrey's cryptographic proposals.

The reconstruction pipeline generates text from the person's vocabulary and transitions (via Markov chain) and timing from the person's motor profile. The text has correct surface statistics but no genuine semantic structure. The timing has correct distributional properties but no genuine coupling to ideation. If the instrument's full feature set (including process signals: text reconstruction, revision coherence, burst content analysis) can distinguish its own reconstruction from real sessions, the instrument captures something beyond timing: it captures the relationship between content evolution and behavioral trace.

This is a direct empirical test of content-process binding. The reconstruction is the strongest possible adversary that operates within the instrument's own measurement space. It has the person's vocabulary, their transition probabilities, their motor fingerprint, their pause architecture. What it lacks is the cognitive engagement that couples meaning to process. If the signal pipeline detects the absence, content-process binding is in the measurements.

The test is also a calibration tool. The specific dimensions on which the pipeline distinguishes real from reconstructed sessions identify which features carry the content-process binding information. This is more informative than a binary "binding present/absent" verdict: it tells you where in the measurement space the binding lives.

---

## 6. Early Trajectory

The instrument has been in daily use by a single participant for 8 sessions at the time of writing. The reconstruction pipeline is operational. The adversarial validation loop (feeding reconstructed output through the signal pipeline and computing behavioral distance) is the immediate engineering priority.

This section reports the current state and makes explicit predictions about the convergence trajectory.

### 6.1 Corpus State

Eight journal entries, ranging from approximately 150 to 400 words. The Markov chain operates at order 1 (unigram context). The personal behavioral profile has been computed from all 8 sessions, including: ex-Gaussian parameters (mu, sigma, tau means and standard deviations across sessions), aggregate digraph latency map, pause architecture percentages, burst statistics, vocabulary (438 unique words), and MATTR baseline.

### 6.2 Predictions

**Markov chain convergence.** At order 1 with 8 entries, the transition matrix is sparse and the chain frequently hits dead ends. At order 2 (available at 10+ entries), text coherence increases substantially because bigram context captures phrase-level structure. The perplexity of real journal responses under the Markov model (a quantitative convergence metric measuring how well the model predicts the person's actual word choices) should decrease monotonically with corpus size, with a step decrease at the order-2 transition.

**Motor profile convergence.** The ex-Gaussian parameters have low standard deviations across the first 8 sessions (tau std = 2.8 ms), suggesting rapid convergence of the motor fingerprint. Digraph coverage increases with corpus size. The timing synthesis should achieve high fidelity on motor dimensions within 15 to 20 sessions.

**Process signal divergence.** The reconstruction lacks deletions, cursor movements, and non-monotonic text evolution. Process signals derived from revision behavior (R-burst count, deletion rates, revision timing bias) should show large distance between reconstructed and real sessions regardless of corpus size. This divergence is expected and informative: it identifies the revision channel as carrying information the reconstruction cannot reproduce.

**Dynamical signal partial convergence.** Permutation entropy of the synthesized timing stream should partially converge on the PE of real sessions (both reflect the ex-Gaussian distribution), but DFA scaling exponents may diverge because the synthesis lacks the long-range temporal structure that genuine cognitive process produces. This would be evidence that DFA captures something about the cognitive process that the motor profile alone does not contain.

### 6.3 What the Predictions Test

Each prediction is falsifiable at a specific corpus size. If motor dimensions converge within 20 sessions, the instrument's motor feature extraction is validated on that timeline. If process signal divergence persists as predicted, the revision channel is confirmed as carrying information distinct from the motor and content channels. If DFA diverges while PE converges, the multi-scale temporal structure is capturing cognitive dynamics beyond motor execution.

These are not aspirational claims. They are testable consequences of the reconstruction validity framework. The data collection is ongoing. The predictions are registered here.

---

## 7. What the Residual Reveals

The reconstruction residual, the structured gap between synthetic and real sessions, characterizes the instrument's boundary. Three kinds of residual are expected, each with different implications.

### 7.1 Motor Residual (Expected: Small)

The timing synthesis draws from the same distributions the instrument fits to real data. Digraph latencies, ex-Gaussian parameters, and pause architecture percentages are used directly. The motor residual should be small and should decrease with corpus size as the profile estimates stabilize. A persistently large motor residual would indicate that the instrument's motor feature extraction is missing structure present in real motor behavior, which would be a finding about the instrument's limitations.

### 7.2 Content Residual (Expected: Decreasing)

The Markov chain's vocabulary and transitions converge on the person's actual language production as the corpus grows. The content residual, measured through vocabulary overlap, MATTR, and character trigram match, should decrease monotonically. The rate of decrease is itself informative: fast convergence suggests the person's vocabulary is regular and compressible; slow convergence suggests it is diverse and context-dependent.

### 7.3 Cognitive Residual (Expected: Persistent)

The reconstruction cannot reproduce the coupling between what is being written and how it is being written. The temporal dynamics of genuine composition reflect cognitive events, the pause before a difficult word, the burst through a familiar phrase, the long pause before a new paragraph, that are causally linked to the semantic content being produced. The synthesis inserts pauses according to distributional rules, not semantic contingency.

This is the cognitive residual: the information that requires the mind, not just the motor system and the vocabulary, to produce. It is expected to persist regardless of corpus size, because no amount of statistical modeling of the person's past behavior can reconstruct the real-time cognitive engagement of a new composition.

The cognitive residual is the most important output of the reconstruction validity framework. It is the quantitative answer to the question: what does the instrument capture that matters, beyond what can be reconstructed from measurements? The persistent residual IS the cognitive engagement. It is the thing that builds cognitive reserve (Stern et al. 2023), the thing that AI mediation replaces (Guzzardo 2026b), and the thing that Condrey's non-identifiability result says timing-only instruments cannot detect (Condrey 2026a). Reconstruction validity does not just validate the instrument. It characterizes the construct.

---

## 8. Generalizability

Reconstruction validity is not specific to keystroke dynamics. The framework applies to any instrument that extracts features from a temporal behavioral stream, which includes every major digital biomarker modality.

**Speech.** Vocoder resynthesis from extracted prosodic features (F0 contour, intensity envelope, spectral parameters) is a direct parallel to analysis-by-synthesis in the LPC tradition. The reconstruction fidelity of a speech instrument's extracted features could be evaluated by synthesizing speech from those features and comparing the synthetic signal's prosodic characteristics to the original. Pause-distribution fidelity, speaking-rate reconstruction, and disfluency-pattern matching are all feasible reconstruction targets.

**Gait.** Stride-time series generators that produce step-by-step timing from extracted gait parameters (mean stride time, stride variability, DFA scaling exponent) could reconstruct the temporal structure of walking. The reconstruction residual would reveal whether gait instruments capture the long-range temporal correlations that are clinically informative (Hausdorff 2007) or only distributional statistics.

**Handwriting.** Kinematic replay from extracted trajectory features (velocity profiles, pressure curves, stroke segmentation) is technically feasible with existing stylus-based capture systems. The reconstruction would test whether the extracted kinematics preserve the writing dynamics that distinguish pathological from healthy handwriting (Werner et al. 2006).

**Eye tracking.** Fixation-saccade sequence generators from extracted parameters (fixation duration distributions, saccade amplitude distributions, scanpath statistics) could test whether an eye-tracking instrument's features capture the temporal structure of visual attention or only aggregate summary statistics.

Each modality has its own synthesis challenges and fidelity metrics. But the validation framework is the same: extract features, reconstruct from features, compare reconstruction to original, interpret the residual.

---

## 9. Limitations

**Small corpus.** The implementation has 8 sessions at time of writing. The convergence trajectory is early-stage and the predictions in Section 6 are speculative, though falsifiable. The contribution is the framework, not the current results.

**Simple generative model.** The Markov chain is a first-order (soon second-order) statistical model. More sophisticated models (recurrent neural networks trained on the personal corpus, neural language models fine-tuned on the person's writing) could close part of the reconstruction gap. The current residual is an upper bound on the instrument's information loss, not a tight bound. Future work should explore the tradeoff between reconstruction model sophistication and the methodological constraint that reconstruction should be bounded by the instrument's measurements.

**Self-referential validation.** Reconstruction validity evaluates the instrument in its own feature space. The instrument cannot validate features it does not compute. If the behavioral stream contains information that the instrument's pipeline does not extract, reconstruction validity will not detect the omission. It is a test of sufficiency within the instrument's measurement space, not a test of completeness. External-criterion validity remains necessary for claims about what the measurements mean.

**No-LLM constraint.** The methodological decision to use a Markov chain rather than a language model limits reconstruction quality but preserves the interpretability of the residual. If an LLM were used for text generation, the reconstruction gap would shrink on semantic dimensions, but the residual would no longer cleanly characterize the instrument's limitations, because some of the reconstruction fidelity would come from the LLM's capabilities rather than the instrument's measurements. This tradeoff is deliberate but not the only defensible choice.

**Single participant.** The implementation is a single-subject longitudinal study. Generalizability to other individuals requires replication. However, the framework itself does not depend on population-level statistics and is designed for n=1 evaluation.

**Reconstruction omits revision.** The current synthesis generates text forward-only, without deletions, insertions, or cursor movements. Process signals derived from revision behavior will show large reconstructed-vs-real distances by construction, not because those signals are uncapturable but because the reconstruction pipeline does not yet attempt to synthesize revision. Extending the pipeline to include stochastic revision is feasible but not yet implemented.

---

## 10. A Research Program

### 10.1 Close the Adversarial Validation Loop

The immediate next step is to feed the reconstruction's output through the full signal pipeline, compute the per-dimension behavioral distance between synthetic and real sessions, and report the first reconstruction validity profile. This transforms the framework from conceptual to empirical.

### 10.2 Track Convergence

Implement per-session perplexity of real journal responses under the Markov model. Plot the trajectory across sessions. Identify the empirical convergence rate and the effect of the order-1 to order-2 transition.

### 10.3 Run the Condrey Attack

Design a transcription protocol: the same user transcribes LLM-generated text under the same journaling interface. Run both authentic composition sessions and transcription sessions through the full signal pipeline. Measure whether process-level features (not just timing features) distinguish composition from transcription. This is a direct empirical test of whether the instrument achieves the content-process binding Condrey's result requires.

### 10.4 Formalize the Metric

Define reconstruction validity in terms of the observability Gramian or information-theoretic mutual information between the feature set and the behavioral stream. Derive theoretical bounds on reconstruction fidelity given the instrument's feature dimensionality. This connects the empirical framework to the control-theory literature and provides a foundation for comparing reconstruction validity across instruments.

### 10.5 Cross-Modality Demonstrations

Apply the reconstruction validity framework to instruments in other modalities: speech, gait, handwriting. Each application tests whether the framework generalizes beyond keystroke dynamics and provides validity evidence for the target instrument. Cross-modality demonstrations would establish reconstruction validity as a general measurement methodology rather than a domain-specific technique.

### 10.6 Reconstruction Model Progression

Systematically increase the sophistication of the text generation model (order-1 Markov, order-2, order-3, character-level RNN on personal corpus) and measure how the reconstruction residual changes with each step. This traces the boundary between what statistical models of the corpus can reconstruct and what requires the mind to produce, quantifying the cognitive residual at each level of model complexity.

---

## 11. Conclusion

Reconstruction validity asks a question that the existing validity framework does not: are the measurements informationally sufficient? The answer is a dimensional map showing where the instrument captures enough to reconstruct and where it does not. The reconstruction residual characterizes the instrument's boundary more precisely than any external correlation.

For process-level behavioral instruments, the framework also addresses the content-process binding problem identified by Condrey (2026a). An instrument whose measurements can reconstruct both the content trajectory and the behavioral trace has, by construction, captured the binding between them. The adversarial test, distinguishing the instrument's own reconstruction from real behavior, is the empirical answer to the most significant theoretical challenge in keystroke-based authorship verification.

The framework is general. Any instrument that extracts features from temporal behavioral streams can construct a synthesis pipeline and evaluate reconstruction fidelity. The concept requires no external criterion, no population sample, and no clinical adjudication. It is computable from n=1. The results improve with every session the instrument captures.

The method and the metric are the contribution. The convergence curve is ongoing.

---

## References

AERA, APA, & NCME. (2014). *Standards for Educational and Psychological Testing*. American Educational Research Association.

Bandt, C., & Pompe, B. (2002). Permutation entropy: A natural complexity measure for time series. *Physical Review Letters*, 88(17), 174102.

Blackman, D., & Vigna, S. (2018). Scrambled linear pseudorandom number generators. arXiv:1805.01407.

Chenoweth, N. A., & Hayes, J. R. (2001). Fluency in writing: Generating text in L1 and L2. *Written Communication*, 18(1), 80-98.

Condrey, D. (2026a). On the insecurity of keystroke-based AI authorship detection: Timing-forgery attacks against motor-signal verification. arXiv:2601.17280.

Condrey, D. (2026b). Privacy-preserving proof of human authorship via zero-knowledge process attestation. arXiv:2603.00179.

Condrey, D. (2026c). A TEE-based architecture for confidential and dependable process attestation in authorship verification. arXiv:2603.00178.

Corral-Acero, J., et al. (2020). The digital twin to enable the vision of precision cardiology. *European Heart Journal*, 41(48), 4556-4564.

Covington, M. A., & McFall, J. D. (2010). Cutting the Gordian knot: The moving-average type-token ratio (MATTR). *Journal of Quantitative Linguistics*, 17(2), 94-100.

Guzzardo, A. (2026a). A closing window: The demographic confound in keystroke-based cognitive biomarkers and the AI-mediation threat to the paradigm that would replace it. Preprint.

Guzzardo, A. (2026b). Construct replacement: When AI-mediated input invalidates behavioral measurement. Preprint.

Hausdorff, J. M. (2007). Gait dynamics, fractals and falls: Finding meaning in the stride-to-stride fluctuations of human walking. *Human Movement Science*, 26(4), 555-589.

Hinton, G. E., & Salakhutdinov, R. R. (2006). Reducing the dimensionality of data with neural networks. *Science*, 313(5786), 504-507.

Itakura, F. (1968). Analysis synthesis telephony based upon the maximum likelihood method. *Reports of the 6th International Congress on Acoustics*, C-17-C-20.

Kalman, R. E. (1960). A new approach to linear filtering and prediction problems. *Journal of Basic Engineering*, 82(1), 35-45.

Kane, M. T. (2006). Validation. In R. L. Brennan (Ed.), *Educational Measurement* (4th ed., pp. 17-64). ACE/Praeger.

Kim, J., et al. (2024). Discriminant power of smartphone-derived keystroke dynamics for mild cognitive impairment compared to a neuropsychological screening test. *Journal of Medical Internet Research*, 26, e59247.

Kraskov, A., Stogbauer, H., & Grassberger, P. (2004). Estimating mutual information. *Physical Review E*, 69(6), 066138.

Lacouture, Y., & Cousineau, D. (2008). How to use MATLAB to fit the ex-Gaussian and other probability functions to a distribution of response times. *Tutorials in Quantitative Methods for Psychology*, 4(1), 35-45.

Li, S., et al. (2025). A new method for community-based intelligent screening of early Alzheimer's disease populations based on digital biomarkers of the writing process. *Frontiers in Computational Neuroscience*, 19, 1564932.

Marwan, N., Romano, M. C., Thiel, M., & Kurths, J. (2007). Recurrence plots for the analysis of complex systems. *Physics Reports*, 438(5-6), 237-329.

Messick, S. (1995). Validity of psychological assessment: Validation of inferences from persons' responses and performances as scientific inquiry into score meaning. *American Psychologist*, 50(9), 741-749.

Peng, C.-K., Buldyrev, S. V., Havlin, S., Simons, M., Stanley, H. E., & Goldberger, A. L. (1994). Mosaic organization of DNA nucleotides. *Physical Review E*, 49(2), 1685-1689.

Stern, Y., et al. (2023). A framework for concepts of reserve and resilience in aging. *Neurobiology of Aging*, 124, 100-103.

Stevens, K. N., & Halle, M. (1962). Speech recognition: A model and a program for research. *IRE Transactions on Information Theory*, 8(2), 155-159.

Verghese, J., et al. (2007). Quantitative gait markers and incident fall risk in older adults. *Journals of Gerontology: Series A*, 62(12), 1420-1426.

Wengelin, A. (2006). Examining pauses in writing: Theory, methods and empirical data. In K. Sullivan & E. Lindgren (Eds.), *Computer Keystroke Logging and Writing* (pp. 107-130). Elsevier.

Werner, P., Rosenblum, S., Bar-On, G., Heinik, J., & Korczyn, A. (2006). Handwriting process variables discriminating mild Alzheimer's disease and mild cognitive impairment. *Journals of Gerontology: Series B*, 61(4), P228-P236.
