---
title: "Irreversible Loss: An Information-Theoretic Argument for Process-Level Cognitive Preservation"
slug: irreversible-loss
author: Anthony Guzzardo
date: 2026-04-20
status: published
version: 1
target_venue: Aeon / Noema
abstract: "Every historical figure whose artifacts survive is a person whose cognitive process data is permanently lost. The loss is not a failure of archiving. It is a consequence of information theory: the artifact is a lossy compression of the process that produced it, and lossy compression is one-way. No future technology can recover what was discarded. This essay argues that process-level cognitive data, the temporal microstructure of a mind producing output in real time, is demonstrably information-rich, that its loss is mathematically irreversible, and that the window for capturing it from unmediated human cognition is closing."
---

# Irreversible Loss: An Information-Theoretic Argument for Process-Level Cognitive Preservation

**Anthony Guzzardo**
April 2026

---

*Author's note: The author has built and operates a longitudinal journaling system (Alice) that captures the process-level data discussed in this essay, including a reconstruction pipeline that regenerates writing behavior from extracted measurements (the technical framework is developed in Guzzardo 2026f). The contamination boundary attestation is documented in contamination-boundary-v1.md; the embedding methodology is documented in embedding-methods.md; the bit-reproducibility commitments are documented in METHODS_PROVENANCE.md. This is a disclosure, not a credential. The information-theoretic arguments about data loss, compression, and irreversibility do not depend on any specific instrument and should be evaluated on their own terms.*

---

## 1. What We Lost When Franklin Died

Benjamin Franklin left behind an autobiography, thousands of letters, scientific papers, political documents, and an almanac. His written output is among the best-preserved of any eighteenth-century figure. Scholars have spent two centuries studying what he wrote.

What they cannot study is how he wrote it.

They cannot recover the temporal dynamics of Franklin's composition: how long he paused before each sentence, which words came easily and which required deliberation, where he deleted and reformulated, whether his writing process differed when composing scientific arguments versus political persuasion versus personal letters. They cannot reconstruct the motor rhythms of his hand moving across paper, the revision patterns that would reveal how his mind organized an argument in real time, or the moments of hesitation that would distinguish fluent retrieval from effortful construction.

This is not a gap in the archive. It is a category of data that was never recorded. The instruments to capture it did not exist. The writing survives. The writing process is gone.

The specific loss is not sentimental. It is informational. The process data would answer scientific questions that the text cannot: whether Franklin's cognitive architecture shifted as he moved between domains, whether his revision patterns showed the kind of expertise signatures that modern cognitive science has documented in laboratory settings, whether his temporal dynamics exhibited the fractal scaling properties that have been linked to healthy cognitive function in contemporary studies. The text tells you what he decided. The process would tell you how deciding worked, in his particular brain, on that particular day.

This essay argues that the loss of process data is not merely unfortunate but mathematically irreversible, that the data is demonstrably information-rich, and that we are in the process of making it permanently uncollectable from the living.

---

## 2. The Compression Is One-Way

The relationship between a finished text and the process that produced it is the relationship between a compressed file and its source. The text is the output of a lossy compression applied to the full temporal stream of cognitive events that occurred during its composition. The compression discards the timing, the revision history, the hesitation patterns, the motor dynamics, the retrieval sequences. What remains is the product. What is discarded is the process.

Lossy compression has a mathematical property that matters here: it is one-way. Given the compressed output, you cannot recover the discarded information. This is not an engineering limitation awaiting better algorithms. It is a consequence of the compression being many-to-one. Many different processes can produce the same text. A sentence written fluently in one pass and the same sentence arrived at through ten minutes of deletion and reformulation produce identical artifacts. The artifact does not encode which process produced it. The process information is not hidden in the text, waiting to be extracted with better tools. It was never encoded in the text. It was discarded at the point of compression.

Claude Shannon formalized this in 1948. The rate-distortion function describes the fundamental tradeoff between compression rate and fidelity loss. Below a certain rate, information is irretrievably lost. The process-to-artifact compression operates far below the rate that would preserve temporal structure. The timing of a writing session contains roughly one cognitive event per 100 to 500 milliseconds, sustained over minutes to hours. The text that results contains none of this temporal information. The compression ratio is extreme. The fidelity loss is total on the temporal dimension.

This means that no future technology can recover the writing process of any historical figure from their surviving texts. You could train a machine learning model to generate plausible process records for historical texts, but the generated process would reflect the model's training distribution, not the historical writer's cognitive architecture. A "reconstructed" writing process for Franklin generated by a language model is a statistical hallucination, not a recovery. It would tell you about the model's expectations, not about Franklin's mind. The original information was never encoded in the surviving data. It is not there to be found.

---

## 3. The Evidence in What Survived

The irreversibility of the loss is most visible in the cases where fragments of process data accidentally survived, and scholars recognized those fragments as among the most valuable parts of the archive.

Emily Dickinson left 1,800 poems, many in hand-sewn booklets called fascicles. In the manuscripts, she frequently noted variant word choices: a word in the line with one or more alternatives written in the margin or below. These variants are the only surviving trace of her revision process. They show that she deliberated, that she weighed alternatives, that the final word was a choice among possibilities she had considered and rejected.

Literary scholars regard these variants as among the most important features of Dickinson's manuscripts. Martha Nell Smith, Marta Werner, and others have built scholarly careers on analyzing what the variants reveal about Dickinson's compositional practice. The variants are a fragment of process data, accidentally preserved by a manuscript technology that made alternatives visible, and the scholarly community has recognized that fragment as more revealing than the finished poems alone.

But the variants are a tiny fraction of the process that produced them. They record which alternatives were considered. They do not record the temporal dynamics: how long Dickinson paused before writing the first option, whether she wrote all variants in one sitting or returned to the poem days later, whether the revision happened before or after the rest of the stanza was composed, whether her pace changed when she was revising versus drafting. The manuscripts preserve the product of revision. They do not preserve the process of revision. The full process record would be orders of magnitude more informative than the variant annotations that scholars already consider valuable.

The Darwin case is similar but in a different dimension. Charles Darwin left extensive notebooks, correspondence, and manuscript drafts of the Origin. The sequence of his ideas can be partially reconstructed from the chronology of his notebooks. Howard Gruber's *Darwin on Man* (1974) is a landmark study that traces the development of Darwin's thinking through the notebook evidence. Multiple drafts of the Origin survive, and scholars have compared them to understand how the argument evolved.

But the temporal dimension within each session of writing is absent. We can see that Darwin revised a passage between the first draft and the second. We cannot see how long the revision took, whether he wrote the new version fluently or struggled with it, whether his pace suggested confidence or uncertainty. The discrete comparison of surviving drafts is a low-resolution approximation of what a continuous process record would provide. That the scholarly community finds even the discrete approximation valuable is evidence of how much more valuable the continuous record would be.

The most extreme case is Srinivasa Ramanujan. His notebooks contain thousands of mathematical results, most without proofs or any indication of the reasoning that produced them. The mathematical community has spent a century reconstructing how Ramanujan arrived at his formulas. Bruce Berndt's systematic work on the notebooks has filled multiple volumes. The process is the entire scientific question. The artifacts, the formulas, are maximally compressed: a formula is the most extreme possible lossy compression of the cognitive process that generated it. Everything about how the mind found the result is discarded. Only the result remains.

A process record of Ramanujan working would be, without exaggeration, among the most valuable scientific documents in the history of mathematics. Not because it would reveal the answers, which are already known, but because it would reveal the process: the temporal structure of mathematical reasoning at the highest level of human ability. That record does not exist, and it cannot be reconstructed from the formulas alone.

---

## 4. Three Entropy Rates

The three levels of record, artifact, genome, and process, are subject to entropy at fundamentally different rates. Understanding these rates is essential to understanding why the process record is uniquely vulnerable.

An artifact, once produced, has a near-zero entropy rate. A book does not change. It can be copied with zero information loss. Every copy is as good as the original. Storage technology improves monotonically. The survival probability of an artifact increases over time. We are better at preserving artifacts today than at any point in history, and we will be better at it tomorrow. The effective entropy rate of a well-maintained artifact is zero: the information content does not degrade.

A genome has a low entropy rate because it is encoded in a self-replicating substrate with error-correction mechanisms. DNA degrades, but the information is redundantly encoded in every cell of the organism and, with higher fidelity, in its descendants. Ancient DNA recovery is possible because the biological encoding has structural redundancy that survives tens of thousands of years of physical degradation. The effective entropy rate is nonzero but slow, operating on evolutionary timescales rather than human ones.

A process record has the maximum entropy rate of the three. It exists only in the moment of production. It is temporally extended: a writing session unfolds over minutes to hours, generating data continuously at the rate of human behavior, roughly one cognitive event per 100 to 500 milliseconds. It is not self-replicating. It is not stored by default. No biological mechanism preserves it. No copying mechanism exists after the fact. Without active capture at the moment of production, the information is lost at the speed of lived experience. Once the session ends, the temporal microstructure is gone.

This asymmetry means that, over time, the proportion of a person's total information output that survives tilts further and further toward artifacts. The artifacts accumulate in libraries. The process records evaporate. After decades, only artifacts remain. After death, only artifacts and genome remain. The process record, the most information-dense of the three, is the first to disappear and the least likely to be preserved.

The current state of affairs is this: we have built extraordinary infrastructure for preserving the two levels of record with the lowest entropy rates (artifacts and genomes) and almost no infrastructure for preserving the one with the highest entropy rate (process records). The result is predictable. We know what historical figures produced and what hardware they ran on. We do not know how the hardware ran. The most fundamental record is the least preserved, because its entropy rate is the highest and its capture requires active instrumentation at the moment of production.

---

## 5. The Reconstruction Proof

If the argument so far is correct, process data is both the most information-rich and the most vulnerable of the three record types. But how do we know it is information-rich? The claim that process data contains meaningful information about the person who produced it needs more than a theoretical argument. It needs a demonstration.

The demonstration exists (Guzzardo 2026f provides the full technical framework). It is possible to take process-level measurements extracted from a person's writing sessions and use them to reconstruct the writing behavior. The reconstruction is not a replay of recorded data. It is a generation of new behavior from the extracted measurements: text produced by a Markov chain trained on the person's vocabulary and word transitions, timed character by character from their motor profile (timing distributions, digraph-specific latencies, pause architecture), with revision episodes injected at their characteristic rates and positions. The person's vocabulary serves as the generator's seed material. The validity measurement lives elsewhere: in the motor and dynamical signals, where the gap between real and reconstructed behavior is quantified.

The reconstruction is imperfect. The generated text follows the person's vocabulary and word transitions but lacks semantic coherence, because meaning requires the mind, not a statistical model. The timing matches the person's motor fingerprint but lacks the content-process coupling that makes a real writing session responsive to what is being written. The revision follows the person's deletion rates and timing bias but is stochastically placed rather than semantically motivated.

These imperfections are informative. They delineate exactly what the measurements capture and what they do not. The motor fingerprint is captured: the reconstruction matches the person's timing distributions. The vocabulary is captured: the Markov chain produces text that is recognizably the person's word choices. The pause architecture is captured: production bursts and pauses occur at the right frequencies. What is not captured is the cognitive engagement, the coupling between meaning and process that requires a mind to produce. The boundary between what can be reconstructed and what cannot is a quantitative map of what process data contains.

This is the reconstruction validity argument. If the measurements are sufficient to rebuild the behavior, the measurements contain structured information about the person. The fidelity of the reconstruction is the lower bound on the information content of the process data.

The gap has been measured. Across five independent reconstruction strategies, each adding progressively more sophisticated statistical modeling of the person's behavior, the motor residual holds at L2 = 89-100. Five attempts to close the gap between the real person and their statistical reconstruction, and the gap does not close. What the statistical model cannot reproduce is the coupling between meaning and motor execution, the way a person's hands respond to what their mind is composing. That coupling is precisely the cognitive engagement the process record contains and the artifact discards (Guzzardo 2026f, METHODS_PROVENANCE.md INC-006).

Moreover, the raw process data is reanalyzable. When the signal architecture expanded from 13 to 40 behavioral dimensions (METHODS_PROVENANCE.md INC-012), including multifractal analysis, spectral decomposition, causal emergence, and partial information decomposition, every previously captured session yielded new measurements without requiring any new data collection. The per-family residual breakdown revealed that multifractal structure is the most ghost-resistant dimension, a finding that was latent in every session's raw keystroke stream but invisible until the signal to extract it was written. Historical keystroke data, if preserved, becomes more informative over time as new analytical methods are developed. This is the opposite of the artifact's trajectory: a letter does not become more informative with new reading methods, because the information it could contain was fixed at the moment of writing. The process record's information content is bounded only by the resolution of capture, not by the feature extraction available at capture time.

For historical figures, this entire quantity, everything the reconstruction can capture and everything it cannot, is lost.

---

## 6. The Window That Is Closing

The preceding argument applies to all of human history: process records have always been lost because the capture technology did not exist. What makes the present moment different is that the capture technology now exists, the behavior being captured is disappearing, and both things are happening simultaneously.

Keystroke logging can capture the full temporal microstructure of writing at millisecond resolution. Speech recording with forced alignment can capture the temporal microstructure of speaking. Eye tracking can capture the dynamics of visual attention. The instruments are available. Some of them are built into consumer devices. The capture technology has never been better.

But the behavior those instruments would capture is being replaced. When a person writes with AI assistance, the process record at the point of mediation encodes suggestion evaluation, not lexical retrieval. When a voice assistant completes a sentence, the process record encodes acceptance, not production. The surface artifact is the same. The process is different. The instruments can capture what happens, but what happens is no longer unmediated biological cognition.

This creates a paradox: the instruments to capture process records arrived at the same historical moment as the technology that is making the behavior worth capturing disappear. The window opened and began closing in the same generation (Guzzardo 2026a documents the specific demographic timeline for the keystroke-cognition field). The people alive today who still write without AI assistance, who still compose their own sentences from retrieval rather than selection, are producing process records that are simultaneously the most capturable and the most endangered in history.

The supply of unmediated process data is decreasing. The scientific demand for understanding unmediated cognition, in clinical assessment, in cognitive aging research, in writing process studies, in any field that infers mental states from behavioral output, is not decreasing. It is increasing, because the construct validity questions raised by AI mediation (Guzzardo 2026b) make uncontaminated baselines more valuable, not less. A corpus of unmediated writing process data from the mid-2020s will be, by the mid-2030s, a record of cognitive behavior that cannot be recollected from a population whose writing is predominantly AI-mediated.

Data that is not captured now is data that is permanently lost. This is not a prediction about the future. It is a statement about the entropy rate of process records. The information exists in the present moment. If it is not recorded, it is gone by the next moment. The accumulation of unrecorded moments is the accumulation of irreversible loss.

---

## 7. What Preservation Requires

Preserving process records is not a passive activity. It is not archiving. Process records do not accumulate in libraries or databases unless someone builds the instruments to capture them, builds the infrastructure to store them, and creates the conditions under which the behavior that generates them still occurs.

Some of this has been built. Instruments now exist that capture temporal microstructure at millisecond resolution for keystroke and motor dynamics. They capture behavior during natural practice rather than constrained laboratory tasks, because the ecological validity of the process record depends on the behavior being representative of how the person actually works. They build personal baselines over time, maintaining running statistical distributions that update incrementally after each session and comparing new sessions against topic-matched prior sessions via semantic similarity (Guzzardo 2026c develops the cognitive reserve argument for why this longitudinal record is uniquely irreplaceable; the drift detection and trait classification layers that would interpret these baselines are formally deferred pending data depth, documented in METHODS_PROVENANCE.md DEF-001 through DEF-003). And they operate under conditions of verified unassisted input, with cryptographic per-session attestation that no AI system mediated between the person's keystrokes and the stored record (contamination-boundary-v1.md).

What has not been built is validation at scale. The architectural requirements are met. The longitudinal validation, demonstrating that these baselines detect meaningful cognitive trajectory over years in a population, requires the data depth that only time can provide. The instruments exist. The corpus they are accumulating does not yet have the depth to support the trajectory claims the paradigm is designed to test.

Nor has the modality migration problem been solved. Keyboards will not be the dominant input modality forever. The cognitive constructs worth preserving must eventually be expressible in terms that survive the transition to voice, gesture, neural interfaces, or whatever comes next. That work remains genuinely ahead.

The instruments need to exist before the window closes. The window is measured in years. AI mediation is not a future prospect. It is the default mode of text production for a growing fraction of the population today. Every year of non-capture is a year of irreversible loss, because the people who are writing without AI today may not be writing without AI next year.

---

## 8. The Record That Was Never Made

Return to Franklin.

Imagine the record that would exist if a process-level instrument had been running while he wrote. Not the text, which survives. The temporal dynamics: the pauses before each sentence that would reveal the pace of his thinking. The revision patterns that would show whether he planned and then executed, or discovered his argument through the act of writing. The motor rhythms that would constitute a biometric fingerprint of his cognitive state. The burst structure that would reveal his working memory capacity. The digraph latencies that would show which letter combinations his hand had automated and which still required attention. The tempo drift across a long session that would show when he was confident and when he was searching.

That record, by any information-theoretic measure, would contain more information about how Franklin's mind worked than the complete text of his surviving writings. The text is the compressed output. The record would be the source. We have the compression. We will never have the source.

The same is true for every historical figure whose artifacts survive. And it will be true for every person alive today whose process data is not captured. The instruments exist. The behavior still exists, in diminishing quantity. The information is being produced right now, in every unmediated act of writing and speaking and creating, and it is evaporating at the rate of lived experience.

The question is not whether the data is valuable. The reconstruction proof demonstrates that it is. The question is not whether the loss is reversible. The information theory demonstrates that it is not. The question is whether the instruments that would preserve it will exist, and be used, before the behavior that generates it is gone.

---

<details class="collapsible-section">
<summary>References</summary>

Berndt, B. C. (1985-2012). *Ramanujan's Notebooks*, Parts I-V. Springer.

Cover, T. M., & Thomas, J. A. (2006). *Elements of Information Theory* (2nd ed.). Wiley.

De Biasi, P.-M. (2004). Toward a science of literature: Manuscript analysis and the genesis of the work. In J. Deppman, D. Ferrer, & M. Groden (Eds.), *Genetic Criticism: Texts and Avant-Textes* (pp. 36-68). University of Pennsylvania Press.

Galbraith, D. (1999). Writing as a knowledge-constituting process. In M. Torrance & D. Galbraith (Eds.), *Knowing What to Write* (pp. 139-160). Amsterdam University Press.

Gleick, J. (2011). *The Information: A History, A Theory, A Flood*. Pantheon.

Guzzardo, A. (2026a). A closing window: The demographic confound in keystroke-based cognitive biomarkers and the AI-mediation threat to the paradigm that would replace it. Preprint.

Guzzardo, A. (2026b). Construct replacement: When AI-mediated input invalidates behavioral measurement. Preprint.

Guzzardo, A. (2026c). The quiet debt: Cognitive reserve, AI offloading, and the instruments we don't yet have. Preprint.

Guzzardo, A. (2026f). Reconstruction validity: Self-validation of process-level behavioral instruments via adversarial synthesis. Preprint.

Gruber, H. E. (1974). *Darwin on Man: A Psychological Study of Scientific Creativity*. Dutton.

Hayes, J. R., & Flower, L. S. (1980). Identifying the organization of writing processes. In L. W. Gregg & E. R. Steinberg (Eds.), *Cognitive Processes in Writing* (pp. 3-30). Lawrence Erlbaum.

Leijten, M., & Van Waes, L. (2013). Keystroke logging in writing research: Using Inputlog to analyze and visualize writing processes. *Written Communication*, 30(3), 358-392.

Shannon, C. E. (1948). A mathematical theory of communication. *Bell System Technical Journal*, 27(3), 379-423.

Smith, M. N. (1992). *Rowing in Eden: Rereading Emily Dickinson*. University of Texas Press.

Stern, Y., et al. (2023). A framework for concepts of reserve and resilience in aging. *Neurobiology of Aging*, 124, 100-103.

Wengelin, A. (2006). Examining pauses in writing: Theory, methods and empirical data. In K. Sullivan & E. Lindgren (Eds.), *Computer Keystroke Logging and Writing* (pp. 107-130). Elsevier.

Werner, M. (1995). *Emily Dickinson's Open Folios: Scenes of Reading, Surfaces of Writing*. University of Michigan Press.

</details>
