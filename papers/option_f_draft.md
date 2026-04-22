---
title: "Reconstruction Validity: Self-Validation of Process-Level Behavioral Instruments via Adversarial Synthesis"
slug: reconstruction-validity
author: Anthony Guzzardo
date: 2026-04-21
status: published
version: 5
target_venue: Behavior Research Methods
abstract: "Every behavioral measurement instrument implicitly claims that its extracted features preserve meaningful information about the person who produced the behavior. The standard test of this claim is external-criterion validity: do the features predict outcomes? This paper introduces reconstruction validity, a complementary form of validity evidence that asks a different question: are the features sufficient? Reconstruction validity operationalizes sufficiency by using the instrument's own measurements to regenerate the behavior they were extracted from. The fidelity of the reconstruction is the validity metric. The structured gap between reconstruction and reality, the reconstruction residual, is a dimensional map of what the instrument captures and what it does not. The framework requires no external criterion, no population sample, and no clinical gold standard. It is computable from a single participant's data and applicable to any instrument that extracts features from temporal behavioral streams, including keystroke dynamics, speech, gait, handwriting, and eye tracking. An empirical demonstration using a writing-process instrument and a five-variant adversarial reconstruction system shows that the motor residual, the gap between statistically faithful reconstruction and real writing, holds at L2 = 89-100 across all five strategies. The reconstruction's failure, replicated across five independent approaches, is the validity evidence: the instrument detects structure in real behavior that its own measurements cannot reproduce through statistical synthesis."
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

The framework is modality-general. Any instrument that extracts features from a temporal behavioral stream can construct a synthesis pipeline and evaluate reconstruction fidelity: keystroke dynamics, speech prosody, gait kinematics, handwriting trajectories, eye-tracking scanpaths. This paper demonstrates feasibility through a keystroke-based writing-process instrument, but the concept requires only a feature extraction pipeline and a reconstruction target. Section 8 develops the cross-modality applications in detail.

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

**Text generation.** A word-level Markov chain is trained on the full journal corpus. The tokenizer preserves punctuation as separate tokens. Sentence-initial tokens are recorded as chain starters. At fewer than 10 corpus entries, the chain operates at order 1 (unigram context). At 10 or more entries, it upgrades to order 2 (bigram context). Text generation is seeded with a topic word: the chain searches for a starting state containing the seed, falling back to a random starter. Generation uses Witten-Bell interpolated backoff (Jelinek and Mercer 1980): at each step, the order-2 and order-1 distributions are blended probabilistically, with the interpolation weight proportional to the number of unique continuations observed in the higher-order context. Dead ends at both orders trigger a jump to a random starter. This produces smoother generation than hard fallback because every sample incorporates evidence from both context lengths.

**Convergence metric.** Per-word log2 perplexity of real responses under the Markov model, computed using Absolute Discounting (Chen and Goodman 1999) with unigram backoff. Discount parameter d = n1 / (n1 + 2*n2). Absolute Discounting produces tighter estimates than Laplace smoothing on small personal corpora because it avoids assigning excess mass to impossible transitions. Perplexity should decrease monotonically with corpus size.

The choice of a Markov chain over a neural language model is methodologically load-bearing. The reconstruction must be bounded by what the instrument captures. The personal behavioral profile includes vocabulary, word transition probabilities (implicitly, through the corpus), and statistical properties of the writing process. It does not include a model of meaning, argument structure, or narrative coherence. An LLM trained on the corpus would introduce coherence from the model's own capabilities, not from the instrument's measurements. The Markov chain generates text using only the statistical structure the instrument can observe: which words follow which other words in this person's writing. The incoherence of the output at low corpus sizes is informative, not a failure. It shows the ceiling of text reconstruction from the instrument's measurement set.

**Timing synthesis.** Each character in the generated text is assigned a delay in milliseconds, synthesized from the personal motor profile. The synthesis models seven dimensions of writing behavior:

*Forward timing.* The base delay for each character follows a priority hierarchy: (1) first-keystroke latency from the profile, with uniform jitter; (2) P-burst pauses of 2000 to 4000 ms after approximately burst-length characters at word boundaries; (3) sentence boundary pauses of 800 to 3000 ms with probability proportional to the between-sentence pause percentage from the profile; (4) word boundary pauses of 300 to 1200 ms, modulated by the content-process coupling described below; (5) digraph-specific latency from the aggregate digraph map with Gaussian jitter (standard deviation 20 ms); (6) fallback ex-Gaussian sample from the personal IKI distribution (mu, sigma, tau), floored at 30 ms.

*Tempo drift.* The ex-Gaussian mu parameter varies across the session in a three-phase arc grounded in Wengelin (2006) writing process phases: an exploratory phase (first 20% of the session, mu scaled to 1.3x), a confident production phase (20% to 75%, mu scaled to 0.85x), and a winding-down phase (final 25%, mu scaling from 0.85x to 1.1x). This produces the characteristic velocity profile of genuine composition sessions.

*Content-process coupling.* Pause duration at word boundaries is modulated by the difficulty of the upcoming word. A word frequency map built from the corpus during chain construction provides per-word frequency. Difficulty follows a log-frequency scaling (Inhoff and Rayner 1986): common words receive a multiplier of approximately 0.7x (shorter pause), rare words approximately 1.8x (longer pause), capped at 2.5x. This couples the content trajectory to the behavioral trace, which is the content-process binding that Condrey (2026a) identifies as necessary for authorship verification.

*Evaluation pauses.* Every 3 to 5 P-bursts, the synthesis inserts a longer evaluation pause (4000 to 8000 ms) representing a read-back episode. These are structurally distinct from production pauses in the signal pipeline and model the periodic re-evaluation of what has been written.

*Revision synthesis.* The reconstruction injects stochastic deletion and retype episodes matching the person's revision profile. Small deletions (1 to 3 characters) model typo corrections and are retyped identically. Large deletions (R-bursts) model phrase reformulation: deletion size is calibrated from the person's measured mean R-burst size, with consolidation scaling that modulates size by position in the session (larger R-bursts later if the person's measured consolidation ratio exceeds 1.0). R-burst episode timing is budget-allocated from the person's measured mean R-burst duration, split across deliberation (25%), backspace sequence (35%), transition pause (10%), and retype (30%), with gaussian jitter on each phase. Deleted text is replaced with variant text generated from the Markov chain using nearby context as seed. Leading-edge placement bias matches the person's measured Lindgren and Sullivan (2006) ratio.

*I-burst synthesis.* Mid-text insertion episodes are injected at a rate derived from the R-burst ratio in the profile. Each I-burst navigates to a position in the first 70% of the text (1.5 to 4 second navigation pause), generates 2 to 6 words from the Markov chain seeded on nearby context, and returns (0.5 to 1.5 second reorientation pause). Inserted text timing includes tempo drift and word difficulty coupling matching forward production, so insertions are not trivially distinguishable from production in the signal pipeline. I-bursts are a key marker distinguishing genuine composition from transcription (Condrey 2026a).

The synthesis is self-contained with no external dependencies. Implementation details (PRNG selection, sampling algorithms) are documented in the supplementary material.

### 4.2a Multi-Adversary Variant System (v4)

The single-ghost baseline invites a methodological objection: the motor residual might reflect weakness in the timing synthesis rather than genuine cognitive signal. Version 4 addresses this by running five adversary variants on every session, each adding exactly one statistical improvement. If an improvement closes the residual, that component of the gap was statistical, not cognitive.

| Variant | Text Generation | Timing Synthesis | What It Tests |
|---------|----------------|-----------------|---------------|
| 1. Baseline | Order-2 Markov | Independent ex-Gaussian | Original ghost. Control condition. |
| 2. Conditional Timing | Order-2 Markov | AR(1) conditioned on lag-1 autocorrelation | Does preserving IKI serial dependence close motor residual? |
| 3. Copula Motor | Order-2 Markov | Gaussian copula joint hold/flight sampling | Does preserving hold-flight coupling close TE residual? |
| 4. PPM Text | Variable-order PPM (adaptive context depth) | Independent ex-Gaussian | Does better text generation close semantic/perplexity gap? |
| 5. Full Adversary | PPM | AR(1) + copula | Strongest ghost within measurement space. |

*Conditional Timing.* The baseline samples each IKI independently. Real typing has serial dependence. The AR(1) process conditions each IKI on the previous one, calibrated from the profile's measured lag-1 autocorrelation. Marginal variance is preserved via adjusted sigma: sigma_adj = sigma * sqrt(1 - phi^2). The innovation is centered by subtracting tau to prevent upward drift from the strictly positive exponential component. Citation: Box, Jenkins, and Reinsel (2008).

*Copula Motor.* The baseline samples hold times and flight times independently. A Gaussian copula preserves the rank correlation between them, calibrated from the profile's measured Spearman rho. The Spearman-to-Pearson conversion 2 * sin(pi/6 * rho) follows Kruskal (1958) and avoids assuming normality of the marginals. Citation: Nelsen (2006), Killourhy and Maxion (2009).

*PPM Text.* Prediction by Partial Matching (Method C, Cleary and Witten 1984, Moffat 1990) adaptively selects the longest context with predictive power at each position, up to depth 5. This is the strongest text generator that stays within the constraint that reconstruction must be bounded by the instrument's measurements. No neural model, no external knowledge.

*Full Adversary.* Combines all three improvements. If the motor residual still does not collapse, the floor is cognitive.

The variants are not arbitrary. Each targets a specific limitation identified in the baseline residual structure. The design is a controlled ablation: each variant changes exactly one axis, so the effect of each improvement is isolated.

### 4.3 The Validation Loop

The reconstruction produces a synthetic keystroke stream: a sequence of characters with key-down and key-up timestamps in the signal pipeline's wire format (`{c, d, u}` events), including backspace characters for deletions and insertion events for I-bursts. The synthetic stream can be passed directly through the same signal pipeline that processes real sessions, including the process signal module that reconstructs text from the editing history.

The pipeline produces a feature vector for the synthetic session. This vector is compared to the feature vectors of real sessions. The distance between them, computed dimension by dimension, is the reconstruction validity metric.

Dimensions where the distance is small (the reconstruction matches reality) are dimensions the instrument captures with sufficient fidelity to be reversible. Dimensions where the distance is large (the reconstruction diverges from reality) are dimensions the instrument does not capture, or captures at insufficient resolution.

The per-dimension distance profile is the reconstruction validity report. It replaces the binary question "does the instrument work?" with a dimensional map: "the instrument captures motor fingerprint with fidelity X, pause architecture with fidelity Y, temporal complexity with fidelity Z, and does not capture semantic coherence at all."

---

## 5. Application: The Authorship Verification Problem

Reconstruction validity also resolves a specific open problem in keystroke-based authorship verification, illustrating the framework's diagnostic power beyond instrument validation.

Condrey (2026a) demonstrated that keystroke timing features alone cannot distinguish genuine composition from transcription of AI-generated text. Using three attack variants against five classifiers on 13,000 sessions, he achieved evasion rates of 99.8% or higher. He formalized this as a non-identifiability result: when observation is limited to motor timing distributions, mutual information with content provenance is zero. His proposed solution, "content-process binding," requires architectures that couple the semantic trajectory of a text to the behavioral trace of its production. His follow-up papers proposed cryptographic verification mechanisms (Condrey 2026b, 2026c) but did not address the measurement question: what features must an instrument capture to achieve content-process binding?

Reconstruction validity provides a direct empirical test. The reconstruction pipeline has the person's vocabulary, transition probabilities, motor fingerprint, and pause architecture. What it lacks is the cognitive engagement that couples meaning to process. If the signal pipeline distinguishes its own reconstruction from real sessions, the instrument captures something beyond timing distributions: it captures the relationship between content evolution and behavioral trace. The specific dimensions on which the pipeline detects the difference identify where in the measurement space the binding lives. The five-variant adversary system (Section 6.4) shows that motor is where it lives, and no statistical improvement closes the gap.

---

## 6. Predictions and Results

The instrument has been in daily use by a single participant. The reconstruction pipeline has been run on 26 sessions with complete signal data across all five adversary variants (130 total residual computations). This section presents the predictions registered in version 2 alongside the empirical results. The predictions were written at 8 sessions. The single-ghost results (v3) are from 54 sessions. The multi-adversary results (v5) are from 26 sessions with 63 corpus entries.

### 6.1 Corpus State

Sixty-three journal and calibration entries across 26 sessions with full signal data. The Markov chain operates at order 2 (bigram context, transitioned from order 1 at session 10). The personal behavioral profile is computed from all sessions, updated after each: ex-Gaussian parameters, aggregate digraph latency map across all observed bigrams, pause architecture percentages, burst statistics, R-burst consolidation and duration, IKI autocorrelation, hold-flight rank correlation, cumulative vocabulary, and MATTR baseline. Five signal families are active: dynamical, motor, semantic, process, and cross-session. Five adversary variants run on every session (Section 4.2a). All transfer entropy and hold-flight correlation values were recomputed after a vector alignment fix (see Limitations).

### 6.2 Predictions (Registered in v2) and Results

**Markov chain convergence.** *Prediction:* Perplexity of real responses under the Markov model should decrease monotonically with corpus size, with a step decrease at the order-2 transition. *Result:* Confirmed. Average real perplexity = 21.3 across 20 reconstruction sessions. Average ghost perplexity = 78.5. The person is substantially more internally consistent than their statistical profile predicts. The Markov model overgenerates: it produces plausible word sequences that the person would not actually write in context.

**Motor profile convergence.** *Prediction:* Timing synthesis should achieve high fidelity on motor dimensions within 15-20 sessions. *Result:* **Falsified.** Motor L2 norm = 90.0 (mean across 20 sessions, range 46-144). This is the largest residual family by two orders of magnitude. Dynamical L2 < 1.3, semantic L2 < 0.35. The timing synthesis draws from the correct ex-Gaussian and digraph distributions, but the resulting motor signal profile does not match real sessions. The ghost types from the right distributions in the wrong sequences. Motor execution encodes temporal structure that persists beyond what distributional matching can reproduce.

This falsification is the most important empirical result of the reconstruction validity framework. It was predicted that motor dimensions would converge because the synthesis has access to the same motor parameters the instrument extracts. The prediction was wrong because motor execution in genuine composition is not independent of cognitive state. The coupling between what the person is thinking and how they are physically typing produces motor signatures that distributional sampling cannot reconstruct. The motor residual is not noise; it is the instrument detecting cognitive engagement through the motor channel.

**Process signal partial convergence.** *Prediction:* Revision synthesis would partially converge, but genuine cognitive deliberation would produce persistent divergence. *Result:* Consistent with prediction. The process signal family contributes to the overall residual. The reconstruction's stochastic revision events match distributional properties (deletion rates, timing bias) but not the structural placement of revisions relative to content evolution.

**Dynamical signal partial convergence.** *Prediction:* PE should partially converge; DFA may diverge. *Result:* Dynamical L2 < 1.3 across sessions. The dynamical signal family shows the smallest residual, indicating that the temporal complexity structure (permutation entropy, DFA, RQA) is largely reproducible from the statistical profile. The synthesis's ex-Gaussian timing produces keystroke series with similar complexity signatures to real sessions. This confirms that dynamical signals primarily index motor timing distributions rather than cognitive dynamics in this instrument.

### 6.3 Additional Findings

**Journal questions produce larger ghosts than calibration questions.** Journal sessions (questions generated to probe cognitive depth) have mean total L2 = 59.6. Calibration sessions (standardized free-write prompts) have mean total L2 = 51.1. The gap is consistent with the cognitive residual hypothesis: when the question demands more cognitive engagement, the distance between person and reconstruction widens. This is a falsifiable test of whether the residual is cognitive: if it were purely biomechanical, question type should not affect it.

**Two-scale perplexity divergence.** Word-level Markov perplexity (average 21.3) and character-level trigram perplexity (average 9.0) provide independent measures at different linguistic scales. The ratio of approximately 2.4x indicates that the person's writing is more predictable at the character level (familiar letter sequences) than at the word level (less predictable word choices). The reconstruction matches character-level patterns more closely than word-level patterns, consistent with the Markov chain capturing local statistical structure but not global semantic coherence.

### 6.4 Multi-Adversary Results (v4)

The five-variant system tests whether the motor residual is an artifact of weak synthesis. Each variant adds one statistical improvement. The results below are averaged across 26 sessions with 63 corpus entries. (Note: all values recomputed after the HoldFlight vector alignment fix documented in METHODS_PROVENANCE.md INC-001. The copula parameter `hold_flight_rank_correlation` and all transfer entropy values were recalculated from corrected hold-flight pairs.)

| Variant | Avg Total L2 | Avg Motor L2 | Avg Dynamical L2 | Avg Semantic L2 |
|---------|-------------|-------------|-----------------|----------------|
| 1. Baseline | 52.3 | 90.8 | 1.35 | 0.159 |
| 2. Conditional Timing | 92.1 | 88.8 | 73.75 | 0.158 |
| 3. Copula Motor | 57.7 | 99.9 | 0.67 | 0.169 |
| 4. PPM Text | 55.0 | 98.0 | 0.31 | 0.134 |
| 5. Full Adversary | 59.1 | 91.1 | 0.33 | 0.169 |

**Conditional Timing (variant 2) has the lowest motor L2 (88.8) but the highest total L2 (92.1).** The AR(1) process preserves keystroke rhythm and modestly closes the motor gap. But it creates artificial complexity patterns that the dynamical signals detect as anomalous, increasing dynamical L2 from 1.35 to 73.75. The AR(1) process is too regular; real cognitive events produce temporal complexity that a simple autoregressive model cannot replicate.

**Copula Motor (variant 3) makes motor worse (99.9 vs 90.8).** Coupling hold and flight times jointly introduces motor patterns that diverge further from real execution. The empirical rank correlation (rho = -0.189) is mild, and imposing it on the synthesis creates a coupling artifact the motor signals detect.

**PPM Text (variant 4) wins on semantics (0.134 vs 0.159) and dynamical (0.31 vs 1.35).** Better text generation closes the gaps that better text should close, without affecting motor. The text generation and timing synthesis axes are independent in the measurement.

**Full Adversary (variant 5) lands at motor 91.1.** The combination of all improvements produces a negligible motor change over baseline (91.1 vs 90.8). The motor floor remains in the 89-100 range across all five variants.

**The motor residual is not an artifact of weak synthesis.** Five different statistical strategies, three specifically targeting motor execution, and the floor has not meaningfully moved. The objection that the baseline generator might be too crude is empirically addressed.

### 6.5 What the Results Establish

The reconstruction validity framework produces a dimensional validity profile. Across five adversary variants and 26 sessions, the profile is:

- **Motor signals:** High residual (L2 = 89-100 across all variants). The floor holds under AR(1), copula, PPM, and all three combined. The instrument detects motor structure that no statistical reconstruction within its measurement space can reproduce.
- **Dynamical signals:** Low residual for text-matched variants (L2 = 0.31 for PPM), but blown up by AR(1) timing (L2 = 73.75). Temporal complexity is captured by the statistical profile when timing is independent, but autoregressive timing creates detectable artifacts.
- **Semantic signals:** Low and closing (L2 = 0.134 for PPM vs 0.159 for Markov). Better text generation closes the semantic gap. Content structure is statistically compressible.
- **Perplexity:** Real always lower than ghost. The person is more coherent than their statistical profile predicts.

The multi-adversary system transforms the motor residual from a single falsification into a surface. The surface's shape maps the boundary between statistics and cognition at higher resolution than any single ghost can. The motor floor is not an artifact of a weak generator. It is the measurement.

---

## 7. What the Residual Reveals

The reconstruction residual, the structured gap between synthetic and real sessions, characterizes the instrument's boundary. Three kinds of residual were predicted, each with different implications. The empirical results (Section 6.2) require this section to be revised: the data contradicted the predicted structure in an informative way.

### 7.1 Motor Residual (Predicted: Small. Measured: Largest. Replicated Across Five Strategies.)

The timing synthesis draws from the same distributions the instrument fits to real data. The prediction was that the motor residual would be small and decrease with corpus size. The measured motor L2 norm is 89-100 across five adversary variants, the largest residual family by two orders of magnitude regardless of the statistical strategy.

The single-ghost falsification (v3) revealed that distributional equivalence is not behavioral equivalence. The multi-adversary system (v4) tests whether the gap closes when specific distributional limitations are addressed. It does not. Preserving IKI serial dependence via AR(1) modestly reduces the motor gap (88.8 vs 90.8) but creates dynamical artifacts (L2 = 73.75). Coupling hold and flight times via Gaussian copula makes motor worse (99.9). Combining all improvements (Full Adversary) lands at 91.1. The motor floor is not an artifact of independent sampling, missing correlations, or weak text generation. It persists under every statistical improvement the instrument's own measurements can supply.

The motor signals the instrument extracts (sample entropy, motor jerk, tempo drift, IKI autocorrelation) are sensitive to the *sequence* of intervals, not just their distribution. Genuine composition produces motor sequences structured by cognitive events. Statistical sampling, even with preserved serial dependence and coupling, produces motor sequences that the instrument reliably distinguishes from real ones. The motor channel detects the mind. Five independent strategies have now failed to close that gap.

### 7.2 Content Residual (Predicted: Decreasing. Measured: Confirmed.)

The Markov chain's vocabulary and transitions converge on the person's actual language production as the corpus grows. The semantic L2 norm is 0.35, the smallest family. The content residual is small and, as predicted, converges with corpus size. The Markov model approximates surface linguistic features (idea density, lexical sophistication, compression ratio) because these features are primarily distributional.

The rate of convergence is informative: at 54 sessions, semantic fidelity is already high. This confirms that the person's vocabulary and writing style are compressible into a relatively low-dimensional statistical model. What the reconstruction gets right is exactly what a statistical model should get right: the surface statistics of language use.

### 7.3 Cognitive Residual (Predicted: Persistent. Measured: Confirmed, But Not Where Expected.)

The original prediction was that the cognitive residual would manifest primarily in the coupling between semantic content and behavioral trace. The empirical result is that the cognitive residual manifests primarily in the motor channel.

This reframes the cognitive residual. It is not an abstract quantity inferred from content-process coupling analysis. It is a measurable motor signal: the specific way a person's typing changes in response to what they are composing. The pause before a difficult idea, the acceleration through a familiar argument, the stutter before a deletion that reformulates rather than corrects. These cognitive events are invisible in the content (the final text reads the same regardless of how it was produced) but visible in the motor trace. The reconstruction generates text with correct surface statistics and timing with correct distributional properties. It cannot generate the coupling between them.

The cognitive residual is the most important output of the reconstruction validity framework. The empirical results show it is concentrated in the motor channel, exactly where the instrument has the richest feature extraction (ex-Gaussian decomposition, digraph profiles, sample entropy, motor jerk, tempo drift, IKI autocorrelation, DFA, transfer entropy). The instrument is most sensitive where the cognitive signal is strongest.

This is the quantitative answer to the question: what does the instrument capture that matters, beyond what can be reconstructed from measurements? The persistent motor residual IS the cognitive engagement. It is the thing that builds cognitive reserve (Stern et al. 2023), the thing that AI mediation replaces (Guzzardo 2026b), and the thing that Condrey's non-identifiability result says timing-only instruments cannot detect (Condrey 2026a). But Condrey's result concerns timing *distributions*. The instrument measures timing *sequences*. The distinction is precisely where the cognitive residual lives.

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

**Still a single participant.** The implementation has 63 entries and 26 sessions with full five-variant residuals (130 total computations). The predictions from version 2 (registered at 8 sessions) have been tested, with one falsified. The convergence trajectory is stabilizing but not yet asymptotic. Motor residual variance across sessions remains substantial. The contribution remains the framework; the empirical results are early evidence, not definitive validation.

**Data reprocessing disclosure.** A vector alignment bug in the hold-flight pair extraction was discovered during an adversarial audit of the signal engine (documented in METHODS_PROVENANCE.md, INC-001). The bug caused hold times and flight times to refer to different keystroke events when rollover typing produced negative flight times, affecting 100% of sessions and contaminating all transfer entropy values (130% mean shift). All dynamical signals and reconstruction residuals reported in this paper were recomputed from raw keystroke streams after the fix. Pre-fix values are preserved in snapshot tables for independent verification.

**Generative model ceiling partially tested.** Version 3 used a single order-2 Markov chain. Version 4 introduces PPM text generation (adaptive context up to depth 5), AR(1) conditioned timing, and Gaussian copula hold-flight coupling. These represent the strongest reconstruction possible within the constraint that synthesis must be bounded by the instrument's measurements. The motor floor holds across all five strategies. More sophisticated models (neural language models, RNNs) would violate the measurement-bounded constraint by introducing coherence from the model's own capabilities. The current five-variant system maps the boundary of what statistical reconstruction can achieve within the instrument's measurement space. Neural models remain relevant for the separate question of how much of the residual is truly irreducible versus model-limited, but that question lies outside the reconstruction validity framework.

**Self-referential validation.** Reconstruction validity evaluates the instrument in its own feature space. The instrument cannot validate features it does not compute. If the behavioral stream contains information that the instrument's pipeline does not extract, reconstruction validity will not detect the omission. It is a test of sufficiency within the instrument's measurement space, not a test of completeness. External-criterion validity remains necessary for claims about what the measurements mean.

**No-LLM constraint.** Bounding reconstruction by the instrument's measurements (Section 4.2) preserves the interpretability of the residual. The PPM variant confirms that better text generation within this constraint closes the semantic gap without affecting motor, showing the constraint is not hiding a semantic limitation.

**Revision synthesis is statistical, not cognitive.** The reconstruction now includes revision episodes (R-bursts and I-bursts) parameterized from the personal revision profile. However, the placement and content of revisions are stochastic: the reconstruction deletes at profile-matching rates and retypes Markov-generated variant text. Real revision reflects cognitive deliberation about meaning. The gap between stochastic and genuine revision is itself a component of the cognitive residual, but this limitation means the revision channel's contribution to reconstruction validity is bounded by the expressiveness of the statistical revision model.

---

## 10. A Research Program

The reconstruction validity framework suggests three lines of future work, ordered by their contribution to establishing the paradigm.

### 10.1 Cross-Modality Demonstrations

Apply the reconstruction validity framework to instruments in other modalities: speech, gait, handwriting, eye tracking. Each application tests whether the framework generalizes beyond keystroke dynamics and provides validity evidence for the target instrument. Cross-modality demonstrations would establish reconstruction validity as a general measurement methodology rather than a domain-specific technique. The formal parallels in Section 3 suggest feasibility; empirical demonstrations are needed.

### 10.2 Formalize the Metric

Define reconstruction validity in terms of the observability Gramian or information-theoretic mutual information between the feature set and the behavioral stream. Derive theoretical bounds on reconstruction fidelity given the instrument's feature dimensionality. This connects the empirical framework to the control-theory literature and provides a foundation for comparing reconstruction validity across instruments and modalities.

### 10.3 Direct Composition-Transcription Test

Design a transcription protocol: the same user transcribes LLM-generated text under the same journaling interface. Run both authentic composition sessions and transcription sessions through the full signal pipeline. Measure whether process-level features (not just timing features) distinguish composition from transcription. This is a direct empirical test of whether the instrument achieves the content-process binding Condrey's result requires (Section 5), and it complements the adversarial reconstruction approach with a ground-truth behavioral comparison.

### 10.4 Adaptive Difficulty Correlation

The question generation pipeline now logs difficulty classification alongside each generated question. Direct correlation between question difficulty and reconstruction residual magnitude would confirm that the motor residual is cognitive rather than biomechanical: if harder questions produce larger motor residuals, the residual tracks cognitive engagement. Data collection is underway.

---

## 11. Conclusion

Reconstruction validity asks a question that the existing validity framework does not: are the measurements informationally sufficient? The answer is not a single coefficient but a dimensional map showing where the instrument captures enough to reconstruct and where it does not. The reconstruction residual characterizes the instrument's boundary more precisely than any external correlation.

The framework is general. Any instrument that extracts features from temporal behavioral streams can construct a synthesis pipeline and evaluate reconstruction fidelity. The concept requires no external criterion, no population sample, and no clinical adjudication. It is computable from n=1, applicable across modalities, and the results improve with every session the instrument captures.

The empirical demonstration shows the framework's diagnostic power. Five adversary variants, each adding a specific statistical improvement, all fail to reproduce what the instrument detects in real writing. The motor floor holds at L2 = 89-100 across every variant. Distributional equivalence is not behavioral equivalence. AR(1) conditioned timing, Gaussian copula coupling, variable-order PPM text generation, and all three combined: the sequence matters, and the sequence is where the mind shows.

The method, the metric, and the multi-adversary evidence are the contribution. The convergence curve continues.

---

## References

AERA, APA, & NCME. (2014). *Standards for Educational and Psychological Testing*. American Educational Research Association.

Bandt, C., & Pompe, B. (2002). Permutation entropy: A natural complexity measure for time series. *Physical Review Letters*, 88(17), 174102.

Box, G. E. P., Jenkins, G. M., & Reinsel, G. C. (2008). *Time Series Analysis: Forecasting and Control* (4th ed.). Wiley.

Chen, S. F., & Goodman, J. (1999). An empirical study of smoothing techniques for language modeling. *Computer Speech and Language*, 13(4), 359-394.

Chenoweth, N. A., & Hayes, J. R. (2001). Fluency in writing: Generating text in L1 and L2. *Written Communication*, 18(1), 80-98.

Cleary, J. G., & Witten, I. H. (1984). Data compression using adaptive coding and partial string matching. *IEEE Transactions on Communications*, 32(4), 396-402.

Condrey, D. (2026a). On the insecurity of keystroke-based AI authorship detection: Timing-forgery attacks against motor-signal verification. arXiv:2601.17280.

Condrey, D. (2026b). Privacy-preserving proof of human authorship via zero-knowledge process attestation. arXiv:2603.00179.

Condrey, D. (2026c). A TEE-based architecture for confidential and dependable process attestation in authorship verification. arXiv:2603.00178.

Corral-Acero, J., et al. (2020). The digital twin to enable the vision of precision cardiology. *European Heart Journal*, 41(48), 4556-4564.

Covington, M. A., & McFall, J. D. (2010). Cutting the Gordian knot: The moving-average type-token ratio (MATTR). *Journal of Quantitative Linguistics*, 17(2), 94-100.

Guzzardo, A. (2026a). A closing window: The demographic confound in keystroke-based cognitive biomarkers and the AI-mediation threat to the paradigm that would replace it. Preprint.

Guzzardo, A. (2026b). Construct replacement: When AI-mediated input invalidates behavioral measurement. Preprint.

Hausdorff, J. M. (2007). Gait dynamics, fractals and falls: Finding meaning in the stride-to-stride fluctuations of human walking. *Human Movement Science*, 26(4), 555-589.

Hinton, G. E., & Salakhutdinov, R. R. (2006). Reducing the dimensionality of data with neural networks. *Science*, 313(5786), 504-507.

Inhoff, A. W., & Rayner, K. (1986). Parafoveal word processing during eye fixations in reading: Effects of word frequency. *Perception and Psychophysics*, 40(6), 431-439.

Itakura, F. (1968). Analysis synthesis telephony based upon the maximum likelihood method. *Reports of the 6th International Congress on Acoustics*, C-17-C-20.

Jelinek, F., & Mercer, R. L. (1980). Interpolated estimation of Markov source parameters from sparse data. In E. S. Gelsema & L. N. Kanal (Eds.), *Pattern Recognition in Practice* (pp. 381-397). North-Holland.

Kalman, R. E. (1960). A new approach to linear filtering and prediction problems. *Journal of Basic Engineering*, 82(1), 35-45.

Killourhy, K. S., & Maxion, R. A. (2009). Comparing anomaly-detection algorithms for keystroke dynamics. In *IEEE/IFIP International Conference on Dependable Systems and Networks* (pp. 125-134). IEEE.

Kane, M. T. (2006). Validation. In R. L. Brennan (Ed.), *Educational Measurement* (4th ed., pp. 17-64). ACE/Praeger.

Kim, J., et al. (2024). Discriminant power of smartphone-derived keystroke dynamics for mild cognitive impairment compared to a neuropsychological screening test. *Journal of Medical Internet Research*, 26, e59247.

Kruskal, W. H. (1958). Ordinal measures of association. *Journal of the American Statistical Association*, 53(284), 814-861.

Kraskov, A., Stogbauer, H., & Grassberger, P. (2004). Estimating mutual information. *Physical Review E*, 69(6), 066138.

Lacouture, Y., & Cousineau, D. (2008). How to use MATLAB to fit the ex-Gaussian and other probability functions to a distribution of response times. *Tutorials in Quantitative Methods for Psychology*, 4(1), 35-45.

Lindgren, E., & Sullivan, K. P. H. (2006). Analysing online revision. In K. Sullivan & E. Lindgren (Eds.), *Computer Keystroke Logging and Writing* (pp. 157-188). Elsevier.

Li, S., et al. (2025). A new method for community-based intelligent screening of early Alzheimer's disease populations based on digital biomarkers of the writing process. *Frontiers in Computational Neuroscience*, 19, 1564932.

Marwan, N., Romano, M. C., Thiel, M., & Kurths, J. (2007). Recurrence plots for the analysis of complex systems. *Physics Reports*, 438(5-6), 237-329.

Moffat, A. (1990). Implementing the PPM data compression scheme. *IEEE Transactions on Communications*, 38(11), 1917-1921.

Messick, S. (1995). Validity of psychological assessment: Validation of inferences from persons' responses and performances as scientific inquiry into score meaning. *American Psychologist*, 50(9), 741-749.

Nelsen, R. B. (2006). *An Introduction to Copulas* (2nd ed.). Springer.

Peng, C.-K., Buldyrev, S. V., Havlin, S., Simons, M., Stanley, H. E., & Goldberger, A. L. (1994). Mosaic organization of DNA nucleotides. *Physical Review E*, 49(2), 1685-1689.

Stern, Y., et al. (2023). A framework for concepts of reserve and resilience in aging. *Neurobiology of Aging*, 124, 100-103.

Stevens, K. N., & Halle, M. (1962). Speech recognition: A model and a program for research. *IRE Transactions on Information Theory*, 8(2), 155-159.

Verghese, J., et al. (2007). Quantitative gait markers and incident fall risk in older adults. *Journals of Gerontology: Series A*, 62(12), 1420-1426.

Wengelin, A. (2006). Examining pauses in writing: Theory, methods and empirical data. In K. Sullivan & E. Lindgren (Eds.), *Computer Keystroke Logging and Writing* (pp. 107-130). Elsevier.

Werner, P., Rosenblum, S., Bar-On, G., Heinik, J., & Korczyn, A. (2006). Handwriting process variables discriminating mild Alzheimer's disease and mild cognitive impairment. *Journals of Gerontology: Series B*, 61(4), P228-P236.
