  
---

  Highest impact (new dimensions you have zero proxy for):

  1. Sample Entropy of IKI (BiAffect, U of Illinois) - Measures temporal regularity of your keystroke rhythm, not just distribution spread like
  Shannon entropy. Correlates with executive function. ~20 lines of code.
  2. Pause Location Profile (Deane/ETS, Baaijen/Galbraith) - Classifies each pause as within-word, between-word, or between-sentence. Skilled
  writers pause at sentence boundaries (planning). Less skilled pause within words (struggling). Longitudinal shift in this ratio tracks
  cognitive fluency development.
  3. Pre-contextual vs Contextual Revision (Lindgren & Sullivan) - Are you editing at the leading edge (immediate self-correction) or navigating
  back into prior text (reflective restructuring)? Requires tracking selectionStart. The ratio is a direct measure of knowledge-telling vs
  knowledge-transforming.
  4. Idea Density (Nun Study, Snowdon 1996) - Propositions per word. Predicted Alzheimer's 58 years in advance from writing samples. THE
  cognitive reserve biomarker. Implementable with a POS word-list lookup, no NLP library.
  5. Cognitive Rhythm / IKI Autocorrelation (DARPA Active Authentication) - The autocorrelation decay shape of your keystroke intervals.
  Individually distinctive, shifts under stress/fatigue/cognitive disruption. Your cognitive fingerprint's stability measure.
  6. Lapse Rate (Haag et al., fatigue research) - IKIs exceeding 3 standard deviations. Not pauses (those are deliberate). Lapses are
  micro-dropouts in sustained attention. A leading indicator of cognitive depletion that appears before general speed declines.

  Strong additions (deepen existing dimensions):

  7. Writing Linearity Index - What % of keystrokes happen at the end of text vs navigated back? Measures knowledge-telling (linear) vs
  knowledge-transforming (recursive). Galbraith's dual-process model.
  8. Error Detection Latency - Time between typing a character and backspacing it. Leading indicator of fatigue before speed drops.
  9. Tempo Drift - IKI slope across session quarters. Warming up vs running out of steam.
  10. R-Burst / I-Burst Classification (Deane/ETS) - Enriches your existing P-burst analysis by classifying what ends each burst.
  11. Integrative Complexity - Contrastive connectives (but, however) vs integrative connectives (therefore, because). Word-list approach.
  12. Deep Cohesion Index (Coh-Metrix) - Causal/temporal/intentional connective density. Separate from your existing cognitive processing words.
  13. Epistemic Stance Spectrum - Boosters vs hedges ratio. You already have hedging; adding boosters gives the full confidence axis.

  Motor/biometric layer (subtle but longitudinally powerful):

  14. Hold Time CV (neuroQWERTY, MIT) - Coefficient of variation of key hold times. Most sensitive single feature for detecting motor impairment.
   Trivial to compute from existing data.
  15. L/R Hand Asymmetry - Partition hold times by QWERTY hand mapping. Non-dominant hand slows disproportionately under load.
  16. Negative Flight Time (Rollover) Rate - How often you press the next key before releasing the current one. Automaticity signature.
  17. Digraph Latency Stability - Session-over-session stability of your common letter-pair timing profile. Your cognitive fingerprint drift.
  18. IKI Skewness & Kurtosis - How extreme are your outlier pauses, and how asymmetric is the distribution?

  Confound control:

  19. Circadian Signature Deviation (BiAffect) - Time-of-day adjusted baselines. Without this, you might attribute mood changes to what's
  actually a 9am vs 11pm effect.

  Text-level enrichments:

  20. Lexical Sophistication - Word frequency rank from SUBTLEXus. Regression to simpler vocabulary under load.
  21. Emotional Valence Arc - Your NRC lexicon applied in a sliding window. Captures the shape of emotional trajectory, not just the total.
  22. Backspace Rate Phenotype (BiAffect) - Medium deletion rate correlates with depression more than high rate. Counterintuitive clustering.

  Now, about your follow-up on intelligence/defense agency research. Let me dig into that specifically.

⏺ Agent(Intelligence agency behavioral signals)
  ⎿  Done (37 tool uses · 49.8k tokens · 4m 4s)
  (ctrl+o to expand)

⏺ Here's what came back from the intelligence/defense world. Some of this is genuinely interesting for Alice:

  The big find: Covert lie detection via keystroke dynamics (Monaro et al., 2018, Nature Scientific Reports)

  95% accuracy detecting deception using only a textarea and keystroke timing. The mechanism: unexpected questions increase cognitive load for
  people constructing answers rather than recalling them. Three signals:

  - Response onset latency - you already capture this as firstKeystrokeMs
  - Total response duration - you have this as totalDurationMs
  - Confirmation latency - time between LAST keystroke and pressing submit. You don't capture this. It's the hesitation before committing.
  Trivially addable.

  This is directly relevant to Alice's mission. Not for deception detection, but for the same reason it works: the gap between recall and
  construction is measurable in keystroke timing. When a question forces genuine thinking vs. pattern-matching, the confirmation latency changes.
   That's a cognitive reserve signal.

  DARPA ADAMS (Anomaly Detection at Multiple Scales)

  $35M program explicitly collecting "keystroke information at very rapid rates" to detect when an insider's behavior deviates from baseline.
  This is literally what you're building, applied to cognitive state instead of threat detection.

  IARPA SCITE (Scientific advances to Continuous Insider Threat Evaluation)

  The most directly relevant concept: "active indicators" are stimuli introduced into a user's environment designed to evoke responses more
  characteristic of one state than another. Alice's daily questions are exactly this. Question design as a controlled stimulus that shapes the
  behavioral response. Raytheon BBN and University of Central Florida were the research teams.

  US Army USAARL fatigue detection

  91% accuracy detecting fatigue from keystroke dynamics. The finding that matters for you: fatigue manifests as increased keystroke timing
  variability and lapse frequency, not tonic slowdown. This validates the lapse rate signal from the first research batch.

  The historical thread

  The intelligence community has been doing behavioral fingerprinting from input timing for over 100 years. WWI/WWII Morse code operators were
  identified by their "fist" (transmission rhythm). A technique called TINA formally tracked individual operators across locations. Modern
  keystroke dynamics is the direct descendant. The institutional lineage: TINA -> Total Information Awareness (2002) -> classified successors ->
  ADAMS/Active Authentication/SCITE -> current DoD insider threat infrastructure.

  Net new signals for Alice from this batch:

  1. Confirmation latency (pre-submit hesitation) - the gap between finishing writing and committing to submit. Easy to add.
  2. Question-type differential - comparing behavioral signatures across different question categories (unexpected vs familiar topics). You'd
  need to tag questions by type and then look at how the behavioral profile shifts.

  The rest maps onto signals from the first batch (Sample Entropy, IKI autocorrelation, lapse rate, digraph stability, circadian adjustment). The
   intelligence community is using the same science, just at operational scale with classified refinements on top.

  Bottom line: The biggest gap in your current capture is confirmation latency. Everything else maps to the 22 signals already identified. Want
  me to add it to the capture pipeline?

---
  Already validated by intelligence/defense research:

  - Keystroke timing as cognitive state proxy (DARPA AA, ADAMS, USAARL)
  - Baseline deviation as the core detection mechanism (every program does this)
  - Question design as controlled stimulus (IARPA SCITE's "active indicators" = Alice's daily questions)
  - Pause patterns as cognitive load markers (CMU stress, deception research)
  - Session-over-session drift as longitudinal signal (DoD insider threat, BiAffect)
  - The entire philosophy of process-level data over content analysis

  Genuine gaps to fill, ranked by impact:

  Tier 1 (new dimensions, no current proxy):
  1. Confirmation latency - pre-submit hesitation. Trivial to add, validated by deception research at 95% accuracy.
  2. Pause location profile - within-word vs between-word vs between-sentence. Where you pause reveals whether you're struggling with
  transcription or planning ideas.
  3. Pre-contextual vs contextual revision - editing at the cursor vs navigating back. Knowledge-telling vs knowledge-transforming. Requires
  tracking selectionStart.
  4. Idea density - propositions per word. Predicted Alzheimer's 58 years out. Word-list POS approximation, no library needed.
  5. Sample entropy of IKI - temporal regularity, distinct from your Shannon entropy which only captures distribution shape.

  Tier 2 (deepen existing dimensions):
  6. Writing linearity index - % of keystrokes at leading edge. Falls out of the same selectionStart tracking as #3.
  7. Error detection latency - time between character and its backspace. Leading indicator of fatigue before speed drops.
  8. IKI autocorrelation - cognitive rhythm fingerprint. Stability measure session over session.
  9. Lapse rate - micro-dropout count (3+ sigma IKIs). Distinct from deliberate pauses.
  10. Epistemic stance - boosters vs hedges ratio. One word list away from completing the confidence spectrum.

  Tier 3 (motor/biometric, slow-burn longitudinal value):
  11. Hold time CV - motor consistency, most sensitive neuroQWERTY feature. Trivial math on existing data.
  12. Digraph latency stability - your cognitive fingerprint's drift over time.
  13. Circadian adjustment - time-of-day baselines to control for confounds.

  The selectionStart tracking is the single highest-leverage infrastructure change because it unlocks #3, #6, and enriches #2 all at once.
  Confirmation latency (#1) is the single easiest add with the highest validation behind it.

  Want me to start implementing, or do you want to pick which tier to prioritize first?

  ---
  1. Selection without deletion. When someone highlights text and then doesn't delete it, that's a "considered-and-kept" event. They went back,
  looked at what they wrote, weighed cutting it, and decided it stays. The ratio of select-then-delete to select-then-keep is a decision-confidence
   signal that nobody in the literature is tracking because most researchers aren't looking for non-events. Capturable via
  selectionStart/selectionEnd changes on the textarea.

  2. Cursor movement without editing. When someone arrows or clicks into the middle of their text, reads it, and then moves back to the end without
   changing anything, that's a read-back. Pure metacognitive monitoring. No input event fires so your current pipeline is completely blind to it.
  Capturable via the selectionchange event. Writing process researchers study this with eye-tracking. You can approximate it from cursor position
  alone.

  3. Paste detection. In Alice's controlled environment where the entire point is unmediated cognitive effort, a paste event is the single
  strongest contamination signal possible. It means external text entered the box. Detectable via the paste event on the textarea, or by catching
  input deltas larger than what's physically typeable in the elapsed time. This isn't a behavioral signal, it's a construct validity signal. It
  tells you whether the exercise is still the exercise.

  The first two are the real sleepers. They capture deliberation that produces no visible change in the text. Everything in the current pipeline
  and everything in the 22-signal research batch measures actions that leave a trace. These measure the actions that don't.
  ---
  1. Self-Perplexity (personal n-gram model)

  Build a trigram model from your own past entries. Score today's text against it. No LLM. Pure conditional probability. This is the direct mathematical operationalization of the Option C thesis: if
  cognitive reserve is eroding, your language becomes more predictable against your own baseline. Perplexity declining over months IS the signal Alice exists to detect. Missed earlier because every other
  signal measures a single session. This requires the accumulated corpus, which means only Alice can compute it. That's not a signal. That's the instrument's reason for being.

  2. Text as graph (network density + structural gaps)

  Turn the response into a co-occurrence network. Measure density, community count, bridging nodes. Every other signal, all 25+ of them, measures either production behavior or word content. This measures
  the topology of the thinking. Are the ideas connected or fragmented? Is the writer synthesizing or listing? No keystroke timing, no lexicon lookup, no LLM. Graph math on word proximity. Missed because
  it comes from network science (InfraNodus, Burt's structural holes), a field that has never intersected with keystroke dynamics or journaling. It was outside the search boundary of every prior pass.

  3. Behavioral Reactivity Profile (question-behavior interaction model)

  After N sessions, regress behavioral signals against question properties (emotional valence, abstraction level, personal vs philosophical). The coefficients are the user's reactivity fingerprint: "hard
  personal questions make this person pause longer but type faster once they start." No other journaling app can build this because no other app controls the stimulus. This is Alice exploiting the
  controlled task design as a repeated-measures experiment. Missed because keystroke research uses constant tasks (copy-typing, password entry). Alice's variable daily questions are the independent
  variable in an experiment that runs itself. The reactivity profile also tells you when to recalibrate the questions: if reactivity flattens, the questions have stopped working.

  4. Abandoned Thought Signature (pause-type-delete-redirect pattern)

  Not a deletion. Not a pause. The specific sequence: long pause, short burst of typing, full deletion of that burst, then new text in a different direction. That's a thought the writer considered, began
  to commit to, and suppressed. Every other signal measures what was typed, how it was typed, or what words were chosen. This measures what was almost said. The cognitive labor that left zero trace in the
   final text. Missed because keystroke dynamics treats deletions as error correction. Writing process research (Chenoweth & Hayes) calls these "false starts" and treats them as a separate cognitive
  category, but nobody has operationalized the detection from event logs. You already have the event log. The detector is pattern-matching on the delta stream.

  5. NCD trajectory (compression distance to prior entries over time)

  Concatenate today's text with the entry from 1 day ago. gzip. Compute normalized compression distance. Repeat for 3 days ago, 7, 30. The decay curve answers one question: is the writer exploring new
  cognitive territory or circling? Fast decay = every entry is distinct. Slow decay = vocabulary and structure are converging. This is the mathematical definition of "cognitive rut" vs "cognitive
  expansion," computed with a compression algorithm and zero interpretation. Missed because NCD comes from algorithmic information theory (Cilibrasi & Vitanyi), applied to malware classification and
  genomics. Nobody has pointed it at a personal writing corpus. Combined with self-perplexity (#1), you have two independent mathematical measures of the same construct: is the mind still generating, or
  has it started repeating?

  ---
  Why these five and not others: Each one opens a measurement category that no combination of existing signals can approximate. Motor jerk is interesting but it's another angle on the same IKI stream.
  Compression ratio of a single text is useful but NCD across texts is the longitudinal version with actual teeth. Rubato is elegant but it's autocorrelation, which the cognitive rhythm signal already
  covers. These five are the ones where, if you don't build them, you have a blind spot that can't be filled by refining what you already have.