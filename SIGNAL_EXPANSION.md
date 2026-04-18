# Signal Expansion Reference

Comprehensive research synthesis and prioritized implementation plan for expanding Alice's behavioral signal capture beyond the current ~147 signals. Sourced from intelligence programs, academic research labs, startups, open-source projects, and novel analytical techniques.

Research conducted 2026-04-18.

---

## Research Sources

### Intelligence / Government Programs

| Program | Agency | Relevance |
|---|---|---|
| Active Authentication (BAA-12-06) | DARPA I2O | Continuous behavioral biometrics from free-text keystroke dynamics. PIs: Tappert (Pace), Maxion/Killourhy (CMU). Multi-modal fusion into continuous confidence score. |
| ADAMS (Anomaly Detection at Multiple Scales) | DARPA | $35M program collecting keystroke data to detect behavioral deviation from baseline. Architecturally identical to Alice's longitudinal model. |
| SCITE (Scientific advances to Continuous Insider Threat Evaluation) | IARPA | "Active indicators": stimuli introduced to evoke state-dependent responses. Alice's daily questions ARE active indicators. Raytheon BBN, UCF. |
| XKEYSCORE | NSA | Raw keystroke capture for stylometry and author attribution. Content-level (n-gram distributions, function word frequencies), not motor-level. |
| USAARL fatigue detection | US Army | 91% accuracy detecting fatigue from keystroke dynamics. Key finding: fatigue manifests as increased timing variability and lapse frequency, not tonic slowdown. |
| BioCatch | Unit 8200 (Israel) | "Cognitive biometrics": inferring cognitive state (fatigue, hesitation, coercion) from interaction patterns. 3,000+ behavioral signals. 16B+ sessions processed. Founded by Avi Turgeman. |
| TINA | WWI/WWII signals intelligence | Morse code operator identification by transmission rhythm ("fist"). Direct ancestor of modern keystroke dynamics. Lineage: TINA -> TIA (2002) -> ADAMS/AA/SCITE -> current DoD infrastructure. |

### Academic Research Labs

| Lab / Group | Institution | Key Contribution |
|---|---|---|
| Inputlog (Van Waes) | University of Antwerp | Pause distribution across linguistic boundaries (word/clause/sentence). P-burst and R-burst segmentation. Process graphs mapping linear text vs. chronological production. |
| ScriptLog (Lindgren) | Umea University | Revision distance, linearity index, transition matrices between writing phases (planning/translating/reviewing). L2 writing pause pattern shifts. |
| Writing Research (Torrance) | University of Nottingham | Pause location hierarchy: within-word (motor planning) < between-word (lexical retrieval) < between-clause (syntactic planning) < between-sentence (conceptual planning). Location matters more than duration. |
| BiAffect (Leow) | UIC / Northwestern | Mobile keystroke dynamics for mood disorders. Ex-Gaussian tau parameter. Diurnal cycling of keystroke features. Backspace rate phenotyping. Temporal ICA for high-dimensional keyboard dynamics. 14M+ keypresses, 250+ users. |
| neuroQWERTY (Giancardo) | MIT | Parkinson's detection from typing. Adjacent key hold-time covariance. Hold time variance over mean. Early-stage PD detection before clinical diagnosis. |
| Keystroke Dynamics (Maxion, Killourhy) | CMU | Benchmark dataset, digraph/n-graph timing, methodological rigor for free-text authentication. |
| Computational Interaction (Oulasvirta) | Aalto University | 136M keystroke dataset. Rollover analysis (40-70% in fast typists). Information-theoretic typing efficiency metrics. |
| Affective Computing (Picard) | MIT Media Lab | Broader affect detection frameworks later applied to keystroke streams by others. |
| HCI (Klemmer) | Stanford | Error correction modeling, backspace-to-character ratio over time as revision metric. |
| Keystroke Biometrics | UT Austin | Free-text authentication: word-level timing distributions, shift-key hold asymmetry, punctuation-adjacent pause patterns. |

### Startups and Applied Research

| Company | Location | Key Contribution |
|---|---|---|
| BioCatch | Tel Aviv | Cognitive intent layer: inferring WHY (scripted vs. recalled, coerced vs. autonomous) from interaction patterns. Segmented typing detection. |
| nQ Medical | Boston (MIT spinout) | FDA Breakthrough Device for cognition/motor disorders via standard keyboard typing. Cleveland Clinic, MGH, MJFF partnerships. |
| NeuraMetrix | Asheville NC | FDA Breakthrough Device for Parkinson's. Passive home-computer typing cadence at 1/100th-second resolution. Language/alphabet independent. University of Ulm, Toronto, Lund, BU, Harvard partnerships. |
| Ksana Health | Eugene OR (U of Oregon spinout) | Fleksy keyboard SDK for passive text-input biomarkers. Depression in adolescents. First-person pronoun frequency monitoring. 50+ university partners, 15+ NIH studies. |
| TypingDNA | Timisoara, Romania | Browser-based JS SDK for typing pattern vectors. Same-text and free-text modes. 2-3 enrollment samples for production-grade matching. Gartner Hype Cycle 2025. |
| BehavioSec (now LexisNexis) | Stockholm | Privacy-by-design behavioral analysis. All processing local, no PII stored. Full session "login to logout" continuous auth. |
| Plurilock | Vancouver | Cross-device behavioral fidelity. Patent US8230232 for multi-device identity validation. Insider threat detection model. |
| TypeNet | Open source | LSTM-based free-text keystroke biometric. 2.2% EER physical keyboards, 9.2% touchscreen. State of the art for deep learning approach. |

### Key Academic Citations (by signal domain)

| Citation | Domain | Signal Contribution |
|---|---|---|
| Bandt & Pompe 2002 | Nonlinear dynamics | Permutation entropy (already implemented) |
| Peng et al. 1994 | Fractal analysis | DFA (already implemented) |
| **Kantelhardt et al. 2002** | Multifractal analysis | **MF-DFA spectrum width** (NEW) |
| **Costa, Goldberger & Peng 2002** | Complexity science | **Multiscale entropy** (NEW) |
| **Shockley et al. 2003; Coco & Dale 2014** | Cognitive science | **Cross-recurrence quantification** (NEW) |
| **Lacasa et al. 2008** | Network science | **Visibility graph analysis** (NEW) |
| **Podobnik & Stanley 2008** | Econophysics | **DCCA cross-correlation** (NEW) |
| **Lizier et al. 2012** | Information theory | **Active information storage** (NEW) |
| **Amigo et al. 2010; Daw et al. 2003** | Symbolic dynamics | **Forbidden ordinal patterns** (NEW) |
| **Rosenstein et al. 1993** | Chaos theory | **Lyapunov exponent** (NEW) |
| **Huang et al. 1998** | Signal processing | **EMD / Hilbert-Huang transform** (NEW) |
| Chenoweth & Hayes 2001 | Writing process | P-bursts (already implemented) |
| Faigley & Witte 1981 | Writing process | Deletion decomposition (already implemented) |
| Lindgren & Sullivan 2006 | Writing process | Contextual revision (already implemented), **revision distance** (NEW) |
| Deane 2015 | Writing assessment | Pause profiles (partially implemented), **clause-boundary pauses** (NEW) |
| Torrance et al. | Cognitive writing | Pause location hierarchy (partially implemented) |
| Giancardo et al. 2016 | Neurology | Hold time CV (already implemented), **adjacent hold-time covariance** (NEW) |
| Monaro et al. 2018 | Deception detection | Confirmation latency (already implemented) |
| BiAffect / Zulueta et al. 2018 | Digital phenotyping | Sample entropy (already implemented), **ex-Gaussian tau** (NEW), **diurnal cycling** (NEW) |
| Plank 2016 (COLING) | Computational linguistics | Inter-word pause times encode syntactic structure |
| Asonov & Agrawal 2004; Zhuang et al. 2009 | Acoustic analysis | **Keystroke force from audio** (NEW) |
| Dingwell & Cusumano 2000 | Motor control | **Wavelet energy ratio** (NEW) |
| Gilden et al. 1995 | Cognitive timing | **Allan variance** (NEW, excluded) |
| Gunetti & Picardi 2005 | Biometrics | Trigraph timing (NEW, excluded) |
| Roth et al. 2014 | Information theory | **Markov transition entropy rate** (NEW) |

---

## New Signal Specifications

### Mouse/Cursor Trajectory During Pauses

- **Capture:** `mousemove` event listener on `document`. Sample position every 200ms during detected pauses (>2s since last `input` event). Track: `{x, y, timestamp}` tuples.
- **Derived metrics:**
  - `cursorDistanceDuringPauses`: total Euclidean distance of mouse movement during all pauses. `sum(sqrt((x2-x1)^2 + (y2-y1)^2))`
  - `cursorFidgetRatio`: `cursorDistanceDuringPauses / activeTypingMs`. Motor restlessness independent of typing.
  - `driftToSubmitCount`: number of pauses where cursor enters the submit button bounding rect then leaves without clicking
  - `cursorStillnessDuringPauses`: proportion of pause time where cursor displacement < 5px per 200ms sample. Absorption proxy.
  - `meanCursorVelocityDuringPauses`: `cursorDistanceDuringPauses / totalPauseMs`. Agitation metric.
- **Unit:** pixels, ratio, count (per metric)
- **Why:** BioCatch's 3,000-signal system treats mouse behavior during non-mouse tasks as a primary cognitive channel. Cursor drift toward submit = readiness to quit. Frozen cursor during pause = absorption. Circular movement = anxiety. This is an entirely new sensory channel for Alice, orthogonal to all keystroke signals.
- **Table:** `tb_session_summaries`
- **Citation:** BioCatch cognitive biometrics; Pusara & Brodley 2004 (mouse dynamics for continuous auth)

---

### Ex-Gaussian Tau Parameter

- **Capture:** Fit ex-Gaussian distribution to per-session flight time array. The ex-Gaussian is a convolution of a Gaussian (mu, sigma) and an exponential (tau) component.
- **Fitting method:** Method of moments or maximum likelihood. Method of moments:
  - `tau = std(flightTimes)^3 * skewness(flightTimes) / 2` (when skewness > 0)
  - `mu_gaussian = mean(flightTimes) - tau`
  - `sigma_gaussian = sqrt(variance(flightTimes) - tau^2)`
- **Derived metrics:**
  - `exGaussianTau`: the exponential tail parameter (ms). Isolates cognitive slowing from motor baseline speed.
  - `exGaussianMu`: the Gaussian mean (ms). Motor execution speed.
  - `exGaussianSigma`: the Gaussian std (ms). Motor noise.
  - `tauProportion`: `tau / mean(flightTimes)`. What fraction of mean flight time is attributable to cognitive slowing vs. motor speed.
- **Unit:** milliseconds (tau, mu, sigma); ratio (tauProportion)
- **Minimum data:** 50+ flight times with positive skewness
- **Why:** BiAffect demonstrated that tau shifts predict mood episodes in bipolar disorder before summary statistics (mean, std) move. The ex-Gaussian decomposition separates the motor execution component (Gaussian) from the cognitive slowing component (exponential tail). Mean flight time conflates both. Tau isolates the cognitive part. This is the single most validated digital phenotyping signal Alice does not currently capture.
- **Table:** `tb_motor_signals`
- **Citation:** Zulueta et al. 2018 (BiAffect); Luce 1986 (ex-Gaussian in RT); Heathcote et al. 1991

---

### Cross-Recurrence Quantification Analysis (CRQA)

- **Capture:** Compare today's IKI series against a reference session's IKI series in shared phase space.
- **Computation:**
  1. Normalize both IKI series to zero mean, unit variance
  2. Build cross-recurrence matrix: `CR(i,j) = 1 if |IKI_today[i] - IKI_ref[j]| < threshold`
  3. Threshold: `0.2 * mean(std(IKI_today), std(IKI_ref))`
  4. Extract diagonal line structures from cross-recurrence matrix
- **Derived metrics:**
  - `crqaRecurrenceRate`: proportion of filled cells in the cross-recurrence matrix. Behavioral coupling strength.
  - `crqaDeterminism`: diagonal line points / total recurrence points. Whether shared recurrence is structured or random.
  - `crqaMeanDiagLength`: mean length of diagonal lines. Duration of coupled episodes.
  - `crqaMaxDiagLength`: longest shared trajectory. Deepest behavioral coupling.
- **Unit:** ratio (recurrence, determinism); count (line lengths)
- **Minimum data:** 50+ IKI values in both sessions
- **Reference session:** Previous day's session (lag-1). If unavailable, most recent prior session.
- **Why:** Auto-RQA (already implemented) measures within-session recurrence. CRQA measures across-session recurrence: whether the trajectory through cognitive state space follows similar paths on different days. This is fundamentally different from digraph stability (which compares summary statistics) or NCD (which compares text content). CRQA captures dynamical coupling, not statistical similarity.
- **Table:** `tb_cross_session_signals`
- **Citation:** Shockley, Santana & Fowler 2003; Coco & Dale 2014; Webber & Zbilut 2005

---

### Adjacent Key Hold-Time Covariance

- **Capture:** Pearson correlation between consecutive hold times from the keystroke stream.
- **Formula:** `adjHoldCov = corr(holdTime[0:n-1], holdTime[1:n])` where hold times are sequential.
- **Unit:** correlation coefficient [-1, 1]
- **Why:** Measures sequential motor coordination. Your lateralized hold times (left/right hand) measure spatial asymmetry. This measures temporal coupling: does the duration of one keypress predict the next? In neuroQWERTY research, this covariance degrades before mean hold time shifts in Parkinson's. It is a leading indicator of motor coordination decline.
- **Minimum data:** 30+ consecutive hold times
- **Table:** `tb_motor_signals`
- **Citation:** Giancardo et al. 2016 (neuroQWERTY); nQ Medical clinical validation

---

### Precorrection and Postcorrection Latency

Alice currently captures `errorDetectionLatencyMean` (phase 1: time from last non-delete keystroke to backspace). Two additional phases complete the error-correction cognitive model.

- **Phase 2: Deletion execution speed**
  - **Capture:** Mean IKI within deletion chains (consecutive backspace/delete keys)
  - **Formula:** `deletionExecutionSpeed = mean(IKI within revision chains)`
  - **Unit:** milliseconds
  - **Why:** How fast the writer executes the deletion once the decision is made. Slow deletion = tentative, reconsidering mid-delete. Fast deletion = decisive, committed to the cut.

- **Phase 3: Postcorrection re-orientation latency**
  - **Capture:** Time from last deletion keystroke to next insertion keystroke
  - **Formula:** `postcorrectionLatency = mean(time from last backspace/delete keyup to next non-delete keydown)`
  - **Unit:** milliseconds
  - **Why:** How long it takes to re-engage after correcting. Long re-orientation = the error disrupted the train of thought. Short re-orientation = seamless recovery. This is the "getting back on track" cost of each error.

- **Table:** `tb_session_summaries`
- **Citation:** Lindgren & Sullivan 2006; Springer 2021 (automated revision extraction)

---

### Revision Distance

- **Capture:** For each contextual revision (deletion where `selectionStart < value.length - 1`), record the character offset from the leading edge.
- **Formula:** `revisionDistance = value.length - selectionStart` at the moment of deletion
- **Derived metrics:**
  - `meanRevisionDistance`: mean offset across all contextual revisions
  - `maxRevisionDistance`: deepest revision in the session
  - `revisionDistanceVariance`: spread of revision depths
- **Unit:** characters
- **Why:** Alice's `contextualRevisionCount` counts how many times the writer navigated back. Revision distance measures how FAR back. A revision 5 characters from the end is a typo fix at the leading edge. A revision 200 characters back is structural rethinking. The depth distribution distinguishes surface editing from deep restructuring.
- **Table:** `tb_session_summaries`
- **Citation:** Lindgren & Sullivan 2006 (ScriptLog); Severinson Eklundh & Kollberg 2003

---

### Visibility Graph Metrics

- **Capture:** Convert IKI time series to a network using the visibility algorithm.
- **Algorithm:** Two points `(i, IKI_i)` and `(j, IKI_j)` are connected if for all intermediate points `k` where `i < k < j`: `IKI_k < IKI_i + (IKI_j - IKI_i) * (k - i) / (j - i)`
- **Derived metrics:**
  - `vgDegreeExponent`: power-law exponent of the degree distribution. Maps to Hurst exponent: `H = 1 - 1/(gamma-1)` where gamma is the degree exponent. Captures asymmetric properties DFA cannot.
  - `vgClusteringCoefficient`: mean local clustering. Measures temporal structure locality.
  - `vgCommunityCount`: number of connected communities (via simple component detection on thresholded graph). Segments session into dynamically distinct episodes without arbitrary time thresholds.
  - `vgAssortativity`: degree-degree correlation. Positive = hierarchical temporal structure. Negative = disorganized.
- **Unit:** exponent, ratio, count (per metric)
- **Minimum data:** 100+ IKI values
- **Why:** Converts temporal data into network topology. This is orthogonal to every existing signal: DFA measures scaling, RQA measures recurrence, transfer entropy measures directed coupling. Visibility graphs measure the geometric structure of the time series as a connected network. Community detection on the visibility graph identifies cognitive phase transitions within the session without requiring sliding windows or arbitrary thresholds.
- **Table:** `tb_dynamical_signals`
- **Citation:** Lacasa et al. 2008; Lacasa & Toral 2010

---

### MF-DFA Spectrum Width

- **Capture:** Extend existing DFA computation over a range of moment orders q.
- **Algorithm:**
  1. Integrate the mean-subtracted IKI series (same as existing DFA step 1)
  2. For each moment order q in [-5, -4, ..., 0, ..., 4, 5]:
     - Compute generalized fluctuation function: `Fq(s) = (1/N_s * sum(F_v(s)^(q/2)))^(1/q)` for each box size s
     - For q = 0: `F0(s) = exp(1/(2*N_s) * sum(ln(F_v(s)^2)))`
     - Regress `log(Fq(s))` on `log(s)` to get generalized Hurst exponent `h(q)`
  3. Compute singularity spectrum: `alpha = h(q) + q * h'(q)`, `f(alpha) = q * (alpha - h(q)) + 1`
- **Derived metrics:**
  - `mfdfa_spectrumWidth`: `max(alpha) - min(alpha)`. Wide = multifractal (rich, adaptive temporal structure). Narrow = monofractal (rigid or random).
  - `mfdfa_asymmetry`: `(alpha_peak - alpha_min) / (alpha_max - alpha_min)`. Left-skewed = sensitive to large fluctuations (extreme pauses dominate). Right-skewed = sensitive to small fluctuations (micro-timing dominates).
  - `mfdfa_peakAlpha`: alpha at maximum f(alpha). The dominant scaling behavior.
- **Unit:** dimensionless (all metrics)
- **Minimum data:** 256+ IKI values
- **Why:** Existing DFA gives a single scaling exponent, treating the IKI series as monofractal. Real cognitive processes are multifractal: moments of different magnitude scale differently. Ihlen & Vereijken (2010) showed that multifractal spectrum width correlates with adaptive motor flexibility, with narrow spectra indicating rigid/pathological control. MF-DFA answers: is the complexity in your keystroke timing "healthy complexity" (wide spectrum) or "noisy collapse" (narrow spectrum)?
- **Table:** `tb_dynamical_signals`
- **Citation:** Kantelhardt et al. 2002; Ihlen & Vereijken 2010

---

### Multiscale Entropy (MSE)

- **Capture:** Compute sample entropy at progressively coarse-grained versions of the IKI series.
- **Algorithm:**
  1. For each scale factor tau in [1, 2, 3, 4, 5]:
     - Coarse-grain: average consecutive non-overlapping windows of tau points
     - Compute sample entropy on the coarse-grained series (m=2, r=0.2*std, same parameters as existing sampleEntropy)
  2. Compute MSE curve: `SampEn(tau)` for each scale
- **Derived metrics:**
  - `mse_scale1` through `mse_scale5`: sample entropy at each scale
  - `mse_slope`: linear regression slope of SampEn vs. scale. Negative slope = complexity decreasing at coarser scales (degraded system). Flat/positive = complexity maintained across scales (healthy system).
  - `mse_areaUnderCurve`: `sum(mse_scale1..5)`. Overall multi-scale complexity.
- **Unit:** nats (per scale); nats/scale (slope); nats (AUC)
- **Minimum data:** 200+ IKI values (for scale 5 to have 40+ points)
- **Why:** Single-scale sample entropy (already implemented) can show identical values for fundamentally different processes. A periodic signal and a random signal can have the same single-scale entropy. MSE distinguishes them: healthy complex systems maintain entropy across scales, while degraded systems lose complexity at coarser temporal resolutions. Costa, Goldberger & Peng showed this pattern holds across heartbeat, gait, and other physiological time series. The motor-cognitive analogy is direct.
- **Table:** `tb_dynamical_signals`
- **Citation:** Costa, Goldberger & Peng 2002, 2005

---

### Markov Transition Entropy Rate

- **Capture:** Discretize IKI series into states, compute transition matrix, extract information-theoretic measures.
- **Algorithm:**
  1. Discretize IKI into 3 states by terciles: Fast (bottom 33%), Medium (middle 33%), Slow (top 33%)
  2. Compute 3x3 transition matrix `P[i][j] = count(state_t=i, state_{t+1}=j) / count(state_t=i)`
  3. Compute stationary distribution `pi` (left eigenvector of P with eigenvalue 1)
  4. Entropy rate: `H = -sum_i(pi[i] * sum_j(P[i][j] * log2(P[i][j])))`
- **Derived metrics:**
  - `markovEntropyRate`: bits per transition. How much new information each keystroke generates given the current state. High = unpredictable transitions. Low = habitual patterns.
  - `markovStationaryFast`: `pi[Fast]`. Proportion of time in fast state at equilibrium.
  - `markovStationarySlow`: `pi[Slow]`. Proportion of time in slow state at equilibrium.
  - `markovSlowAbsorption`: `P[Slow][Slow]`. Self-transition probability of the slow state. High = the system gets "stuck" in slow states (fatigue attractor). Low = fast recovery from slow states.
- **Unit:** bits (entropy rate); probability (stationary, absorption)
- **Minimum data:** 100+ IKI values
- **Why:** Permutation entropy (already implemented) captures ordinal pattern distribution but ignores magnitude. A "fast-fast-slow" transition and a "medium-medium-slow" transition have different ordinal patterns but the same Markov state sequence. Markov modeling captures magnitude-level sequential dependencies. The slow-state absorption probability is a direct fatigue attractor metric: how likely is the system to remain in cognitive slowdown once it enters?
- **Table:** `tb_dynamical_signals`
- **Citation:** Roth et al. 2014; BiAffect team; Shannon 1948

---

### Punctuation Key Latency

- **Capture:** Filter keystroke stream by key type. Separate punctuation keys (Period, Comma, Slash, Quote, Semicolon, BracketLeft, BracketRight, Minus, Equal) from letter keys.
- **Derived metrics:**
  - `punctuationFlightMean`: mean flight time before punctuation keystrokes
  - `punctuationFlightStd`: std of flight time before punctuation keystrokes
  - `punctuationLetterRatio`: `punctuationFlightMean / letterFlightMean`. Relative cognitive cost of punctuation decisions vs. letter production.
- **Unit:** milliseconds (mean, std); ratio
- **Why:** Punctuation requires syntactic decision-making (where does this clause end? should this be a comma or a period?), which is a different cognitive process than letter production (motor execution of a known word). Clinical keystroke research shows punctuation-adjacent latencies cluster separately from letter latencies as a distinct "cognition score." Longitudinal changes in punctuation latency may indicate shifts in syntactic planning capacity independent of motor speed.
- **Table:** `tb_session_summaries`
- **Citation:** Clinical keystroke dynamics literature; Plank 2016 (COLING)

---

### Abandoned Thought Temporal Signature

- **Capture:** For each detected abandoned thought (existing signal), extract the IKI micro-pattern surrounding the event.
- **Derived metrics:**
  - `abandonedThoughtPreIKI`: mean IKI of the 5 keystrokes immediately before the abandoned burst
  - `abandonedThoughtPostIKI`: mean IKI of the 5 keystrokes immediately after the replacement text begins
  - `abandonedThoughtAcceleration`: `abandonedThoughtPreIKI / abandonedThoughtPostIKI`. > 1 = the writer sped up after abandoning (flight from the idea, relief). < 1 = the writer slowed down (the abandonment cost cognitive momentum, deliberation about the replacement).
  - `abandonedThoughtPauseBeforeMs`: duration of the pause between deletion completion and replacement text onset
- **Unit:** milliseconds (IKI, pause); ratio (acceleration)
- **Why:** Alice already detects abandoned thoughts. The temporal signature around the abandonment is the cognitive event. Does the writer flee the abandoned idea (speed up) or deliberate about the replacement (slow down)? The pause between deletion and replacement is the "reconsidering" interval. These micro-signatures distinguish impulsive self-censorship from thoughtful redirection.
- **Table:** `tb_process_signals`
- **Citation:** Chenoweth & Hayes 2001 (false starts); Baaijen, Galbraith & de Glopper 2012

---

### Clause-Boundary Pauses

- **Capture:** Extend existing pause location classification (within-word / between-word / between-sentence) to include between-clause.
- **Detection:** After reconstructing text state at each pause onset from the event log, check if the character before the cursor is a clause-boundary marker: comma followed by coordinating conjunction or subordinating conjunction, semicolon, colon, or dash.
- **Derived metrics:**
  - `pauseBetweenClause`: count of pauses at clause boundaries
  - `clausePauseMeanMs`: mean duration of clause-boundary pauses
  - `pauseLocationEntropy`: Shannon entropy of the 4-category pause distribution [within-word, between-word, between-clause, between-sentence]. High entropy = pauses distributed across all levels. Low entropy = pauses concentrated at one level.
- **Unit:** count, milliseconds, bits
- **Why:** Torrance's hierarchy establishes that pause location at different linguistic levels reflects different cognitive processes: within-word = motor planning, between-word = lexical retrieval, between-clause = syntactic planning, between-sentence = conceptual planning. Alice currently has a 3-level taxonomy. Adding clause-level completes the cognitive hierarchy. The `pauseLocationEntropy` metric captures whether pauses are concentrated (writer struggling at one level) or distributed (balanced cognitive processing).
- **Table:** `tb_process_signals`
- **Citation:** Torrance et al.; Deane 2015; Baaijen & Galbraith 2018

---

### Symbolic Dynamics and Forbidden Patterns

- **Capture:** Discretize IKI series into symbols, analyze grammar of the symbolic sequence.
- **Algorithm:**
  1. Discretize IKI into 4 symbols: F(ast) = bottom 25%, M(edium) = 25-50%, S(low) = 50-75%, P(ause) = top 25%
  2. Enumerate all length-3 symbol patterns (64 possible: FFF, FFM, FFS, ..., PPP)
  3. Count occurrences. Identify forbidden patterns (expected but never observed).
  4. Compute Lempel-Ziv complexity on the full symbol sequence.
- **Derived metrics:**
  - `forbiddenPatternCount`: number of length-3 patterns that never appear. High count = deterministic constraints in the cognitive process (certain sequences are structurally impossible). Low count = stochastic, unconstrained.
  - `lempelZivComplexity`: normalized LZ76 complexity. `C(n) / (n / log_b(n))` where b = 4 (alphabet size). Measures algorithmic complexity: 0 = perfectly predictable, 1 = maximally random.
  - `dominantPattern`: the most frequent length-3 symbol pattern. Reveals the default cognitive rhythm (e.g., FMF = fast-moderate oscillation, SSS = sustained slowness).
- **Unit:** count, ratio, categorical
- **Minimum data:** 100+ IKI values (for 64 possible patterns to have expected frequency > 1)
- **Why:** Permutation entropy captures ordinal pattern distribution. Compression ratio captures global redundancy. Symbolic dynamics captures the GRAMMAR of the cognitive process: which sequences are possible, which are forbidden, and how complex the generative rule system is. Amigo et al. (2010) showed forbidden ordinal patterns detect determinism in short, noisy time series where other methods fail.
- **Table:** `tb_dynamical_signals`
- **Citation:** Amigo, Zambrano & Sanjuan 2010; Daw, Finney & Tracy 2003; Lempel & Ziv 1976

---

### Wavelet Energy Ratio

- **Capture:** Continuous wavelet transform (CWT) of the IKI series. Extract energy in frequency bands.
- **Algorithm:**
  1. Apply CWT with Morlet wavelet to the IKI series
  2. Define bands: high-frequency (scales 2-5 keystrokes, motor microstructure), low-frequency (scales 10-50 keystrokes, cognitive planning)
  3. Compute energy per band: `E_band = sum(|CWT coefficients|^2)` within band scale range
- **Derived metrics:**
  - `waveletEnergyHF`: high-frequency band energy (motor micro-rhythm)
  - `waveletEnergyLF`: low-frequency band energy (cognitive macro-rhythm)
  - `waveletEnergyRatio`: `waveletEnergyLF / waveletEnergyHF`. High ratio = cognitive planning dominates. Low ratio = motor execution dominates. This is a scale-separated fluency measure.
  - `waveletPeakScale`: scale with maximum energy. The dominant temporal rhythm of the session.
- **Unit:** energy (arbitrary units); ratio; scale
- **Minimum data:** 128+ IKI values
- **Why:** DFA assumes stationarity and gives a single exponent. Wavelets decompose the time series into time-frequency space, revealing transient oscillatory structure. Low-frequency components capture paragraph-level planning rhythm. High-frequency components capture keystroke-to-keystroke motor execution. The ratio between bands measures whether the session was driven by planning or by execution. This changes within a session as the writer shifts modes.
- **Table:** `tb_dynamical_signals`
- **Citation:** Dingwell & Cusumano 2000; Torrence & Compo 1998

---

### Pre-Composition Detection

- **Capture:** Derived classifier from existing state engine signals. No new data capture.
- **Detection rule:** Flag sessions where ALL of the following hold:
  - `fluency > 1.5` (z-scored, well above personal baseline)
  - `commitment > 1.5` (kept nearly everything typed)
  - `deliberation < -1.0` (low hesitation, few pauses, light revision)
  - `ideaDensity > personal_median` (content is substantively complex)
  - `lexicalSophistication > personal_median` (vocabulary is not regressed)
- **Derived metric:**
  - `preCompositionFlag`: boolean. True = session characteristics are inconsistent with real-time composition.
  - `preCompositionScore`: continuous. `min(z_fluency, z_commitment, -z_deliberation) * ideaDensityPercentile`. Higher = stronger evidence.
- **Unit:** boolean, dimensionless score
- **Why:** High speed + high quality + low effort is a cognitive signature that does not arise from real-time composition. The writer composed mentally before starting to type (Flower & Hayes 1981 "planning" phase completed before "translating" phase begins). This is a different cognitive mode than knowledge-transforming (where thinking happens DURING writing). Detecting it matters because the behavioral signals from a pre-composed session measure transcription speed, not cognitive processing. The session's behavioral data should be interpreted differently.
- **Table:** `tb_session_metadata`
- **Citation:** Flower & Hayes 1981; Galbraith 2009

---

### Diurnal Cycling Profiles

- **Capture:** For each signal dimension, compute per-hour-bucket means and variances across sessions.
- **Algorithm:**
  1. Bucket sessions into 4-hour windows: [0-4), [4-8), [8-12), [12-16), [16-20), [20-24)
  2. For each z-scored dimension (7D behavioral + 11D semantic), compute mean and std per bucket
  3. Compute circadian amplitude: `max(bucket_mean) - min(bucket_mean)` per dimension
  4. Identify peak hour-bucket per dimension
- **Derived metrics:**
  - `diurnalAmplitude_{dimension}`: circadian swing for each dimension. Large amplitude = strongly time-of-day dependent.
  - `diurnalPeakBucket_{dimension}`: hour-bucket where dimension peaks.
  - `diurnalPhaseCoherence`: correlation of peak-bucket ordering across dimensions. High = all dimensions peak together. Low = different dimensions peak at different times (fragmented circadian structure).
- **Unit:** z-score (amplitude); hour-bucket (peak); correlation (coherence)
- **Minimum data:** 20+ sessions with variance across time-of-day (at least 3 sessions per bucket)
- **Why:** BiAffect demonstrated that diurnal cycling of keystroke features is itself a mood biomarker. Disrupted circadian keystroke patterns predict mood episodes. Alice's `hour_typicality` flags unusual session timing but does not model how each behavioral dimension varies with time of day. Knowing that your fluency peaks at 8am and your deliberation peaks at 10pm is longitudinal context that changes interpretation of every session.
- **Table:** `tb_cross_session_signals`
- **Citation:** BiAffect; Pilcher & Huffcutt 1996; Torous et al. 2016

---

### Acoustic Keystroke Force (Opt-In Deep Mode)

- **Capture:** Web Audio API. Create `AudioContext`, connect `MediaStreamSource` from `navigator.mediaDevices.getUserMedia({audio: true})`, route through `AnalyserNode`. On each `keydown` event, capture amplitude envelope for the duration of the hold time.
- **Algorithm:**
  1. On `keydown`: start capturing `AnalyserNode.getByteTimeDomainData()` at ~60fps
  2. On `keyup`: stop capturing, extract envelope
  3. Per keystroke: compute peak amplitude, attack time (onset to peak), decay time (peak to silence)
  4. Normalize all amplitudes within-session (relative force, not absolute)
- **Derived metrics:**
  - `keystrokeForceProfile`: array of `{keyCode, peakAmplitude, attackMs, decayMs}` per keystroke
  - `meanKeystrokeForce`: session mean peak amplitude (normalized)
  - `forceVariability`: CV of peak amplitude across keystrokes. Motor consistency under load.
  - `forceDecaySlope`: regression of mean force across session quartiles. Positive = pressing harder over time (tension). Negative = pressing lighter (fatigue/relaxation).
  - `forceLateralAsymmetry`: mean force for left-hand keys vs. right-hand keys. Complements hold-time laterality with a force dimension.
- **Unit:** normalized amplitude, milliseconds, ratio
- **Why:** The Science Advances 2025 study on soft intelligent keyboards showed keystroke force curves are the most discriminative signal for neuromotor detection (96.97% PD diagnosis accuracy). Standard keyboards provide zero force data. But the typing sound amplitude envelope is a direct proxy for strike force: harder presses produce louder sounds. UC Berkeley (Asonov & Agrawal 2004) and Georgia Tech (Zhuang et al. 2009) proved keystroke acoustics carry enough information to reconstruct typed text. Alice needs only the amplitude envelope, not the content. This sidesteps the hardware limitation entirely, extracting pressure dynamics from a standard keyboard via the microphone.
- **Requires:** Microphone permission (opt-in toggle, "deep mode")
- **Confound mitigation:** Ambient noise rejected via temporal gating (only process audio within keydown-to-keyup windows). Within-session normalization eliminates absolute volume differences.
- **Table:** `tb_motor_signals`
- **Citation:** Asonov & Agrawal 2004; Zhuang, Zhou & Tygar 2009; Science Advances 2025 (soft keyboard PD study)

---

## Analytical / Architectural Improvements

These are not new signals. They change how existing and new signals are interpreted and used.

### Circadian-Adjusted Baselines

- **Change:** Replace global z-scoring with time-of-day-conditioned z-scoring for all 7D and 11D dimensions.
- **Formula:** Current: `z(x) = (x - mean_all) / std_all`. New: `z(x|h) = (x - mean_bucket(h)) / std_bucket(h)` where `h` is the session's 4-hour bucket.
- **Fallback:** If fewer than 5 sessions exist in the bucket, fall back to global z-score.
- **Why:** Your 11pm brain is not your 2pm brain. Comparing them as if they're the same population is a systematic error in the current state engine. This changes the meaning of every state dimension without any new data capture.
- **Citation:** BiAffect circadian adjustment; Pilcher & Huffcutt 1996

### Question-as-Treatment-Variable Framework

- **Change:** After each session, store the behavioral response vector alongside the question's properties in a question-response coupling matrix.
- **Implementation:**
  1. Tag each question with extractable properties: emotional valence, abstraction level, personal vs. philosophical, question structure (open vs. bounded), topic cluster
  2. After submission, pair question properties with the session's behavioral state vector (7D + 11D + key raw signals)
  3. After 50+ sessions, compute regression coefficients: which question properties predict which behavioral responses
  4. Feed the learned coupling back into question generation as a conditioning signal
- **Why:** Alice controls the stimulus. No keystroke dynamics lab has this. Every question is an intervention, every behavioral response is a treatment effect. The coupling matrix tells Alice which question TYPES produce depth for THIS user (knowledge-transforming signatures, high deliberation, burst consolidation) vs. which produce avoidance (fast, high commitment, low revision). This transforms question generation from topic-based to cognition-calibrated.
- **Citation:** IARPA SCITE "active indicators"; repeated-measures experimental design

### Joint Behavioral-Semantic Embedding

- **Change:** Concatenate normalized behavioral state vector with text embedding before RAG indexing.
- **Implementation:**
  1. After computing 7D behavioral + 11D semantic state for a session, normalize to [0, 1]
  2. Concatenate with text embedding vector, weighted at 0.3x text embedding magnitude (tunable)
  3. Index the joint vector for RAG retrieval
- **Why:** Current RAG retrieves entries by topical similarity only. Joint embedding retrieves entries that are similar both in what was written AND how it was written. "Find entries where the user wrote about uncertainty AND showed knowledge-transforming behavioral signatures." Makes question generation sensitive to cognitive mode, not just topic coverage.
- **Citation:** Novel application; multimodal embedding literature

### Calibration-Journal Delta Expansion

- **Change:** Extend `tb_session_delta` to compute deltas for all signals (existing + new), not just the current subset.
- **Why:** The calibration free-write is a control condition. The journal response is a treatment condition. The delta across all signals is the treatment effect of that specific question on that specific day's cognitive state. Currently only a subset of signals are differenced. Expanding to all signals maximizes the within-day controlled experiment.

---

## Scoring Matrix

Each signal scored 1-5 on five criteria. Maximum 25. When criteria conflict, Competitive Differentiation and Material Impact take precedence over Additivity.

**Criteria:**
- **Add** -- Captures information not already covered by existing ~147 signals
- **Sub** -- Meaningful enough to drive decisions, not noise
- **Nov** -- Opens a data stream we weren't previously accessing
- **Mat** -- Represents a significant step forward in capability
- **Dif** -- Moves us closer to separating from competitors

### Signals Ranked by Total Score

| Rank | Signal | Add | Sub | Nov | Mat | Dif | Total | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | Question-as-treatment-variable | 5 | 5 | 4 | 5 | 5 | **24** | **INCLUDE** |
| 2 | Acoustic keystroke force | 5 | 4 | 5 | 4 | 5 | **23** | **INCLUDE** (opt-in) |
| 3 | Joint behavioral-semantic embedding | 5 | 5 | 3 | 5 | 5 | **23** | **INCLUDE** |
| 4 | Mouse/cursor trajectory | 5 | 4 | 5 | 4 | 4 | **22** | **INCLUDE** |
| 5 | Ex-Gaussian tau | 5 | 5 | 1 | 5 | 4 | **20** | **INCLUDE** |
| 6 | Cross-Recurrence (CRQA) | 5 | 4 | 2 | 4 | 5 | **20** | **INCLUDE** |
| 7 | Visibility graph | 5 | 3 | 2 | 3 | 5 | **18** | **INCLUDE** |
| 8 | Circadian-adjusted baselines | 4 | 5 | 1 | 4 | 3 | **17** | **INCLUDE** |
| 9 | Adjacent hold-time covariance | 4 | 4 | 1 | 4 | 4 | **17** | **INCLUDE** |
| 10 | Pre-composition detection | 4 | 4 | 1 | 3 | 4 | **16** | **INCLUDE** |
| 11 | Diurnal cycling profiles | 4 | 4 | 2 | 3 | 3 | **16** | **INCLUDE** |
| 12 | Abandoned thought temporal sig | 4 | 4 | 1 | 3 | 4 | **16** | **INCLUDE** |
| 13 | Markov transition entropy rate | 4 | 4 | 1 | 3 | 3 | **15** | **INCLUDE** |
| 14 | Precorrection/postcorrection | 4 | 4 | 1 | 3 | 3 | **15** | **INCLUDE** |
| 15 | Revision distance | 4 | 4 | 1 | 3 | 3 | **15** | **INCLUDE** |
| 16 | Symbolic dynamics | 4 | 3 | 1 | 3 | 4 | **15** | **INCLUDE** |
| 17 | Wavelet energy ratio | 4 | 3 | 1 | 3 | 4 | **15** | **INCLUDE** |
| 18 | MF-DFA spectrum width | 3 | 4 | 1 | 3 | 3 | **14** | **INCLUDE** |
| 19 | Multiscale Entropy | 3 | 4 | 1 | 3 | 3 | **14** | **INCLUDE** |
| 20 | Clause-boundary pauses | 3 | 4 | 1 | 3 | 3 | **14** | **INCLUDE** |
| 21 | Calibration delta expansion | 3 | 4 | 1 | 3 | 3 | **14** | **INCLUDE** |
| 22 | Punctuation key latency | 4 | 3 | 1 | 2 | 2 | **12** | **INCLUDE** |
| -- | Allan variance | 3 | 3 | 1 | 2 | 3 | **12** | EXCLUDE |
| -- | Correlation dimension | 4 | 2 | 1 | 2 | 3 | **12** | EXCLUDE |
| -- | Trigraph latency | 3 | 3 | 1 | 2 | 2 | **11** | EXCLUDE |
| -- | Copy events | 4 | 2 | 2 | 1 | 2 | **11** | EXCLUDE |
| -- | Rollover rate | 2 | 3 | 1 | 2 | 1 | **9** | EXCLUDE |

**Excluded rationale:**
- **Allan variance**: redundant with MF-DFA, which provides richer noise-type information via the full singularity spectrum
- **Correlation dimension**: requires 500+ IKI values, most Alice sessions won't qualify
- **Trigraph latency**: incremental over digraph profiles, low differentiation
- **Copy events**: too rare in a journal context to be substantive
- **Rollover rate**: trivial normalization of existing `negativeFlightTimeCount`, minimal new insight

---

## Implementation Order

Sequenced for maximum compounding value. Each phase makes subsequent phases more valuable.

### Phase 0: Baseline Correction
**Circadian-adjusted baselines.** Changes the z-scoring denominator for all state engine dimensions. Every subsequent signal and every existing signal benefits from time-of-day-appropriate comparison. Must come first because it changes interpretation of everything downstream. Zero new capture. Pure analytical improvement.

*Dependency: 20+ sessions with time-of-day variance.*

### Phase 1: Open New Channels
New data streams that feed all future analysis.

1. **Mouse/cursor trajectory** -- `mousemove` listener. Zero UX cost. Immediate new data channel.
2. **Precorrection/postcorrection latency** -- Enrich existing deletion handler. Three new values per deletion event.
3. **Revision distance** -- Enrich existing contextual revision detection. One new value per revision.
4. **Punctuation key latency** -- Filter existing keystroke stream by key class.

*Dependency: none. All can ship immediately.*

### Phase 2: High-Value Derived Signals
Strongest validated impact from existing data.

5. **Ex-Gaussian tau** -- Fit ex-Gaussian to flight times. ~50 lines. The single most validated digital phenotyping signal Alice is missing.
6. **Adjacent key hold-time covariance** -- Pearson correlation on consecutive hold times. Trivial math, leading motor indicator.
7. **Abandoned thought temporal signature** -- Extract IKI micro-pattern around each abandoned thought event.

*Dependency: keystroke stream (existing). Phase 1 not required.*

### Phase 3: Dynamical Extensions
Extend existing dynamical signal infrastructure.

8. **MF-DFA** -- Parameterize existing DFA over moment orders. ~40 lines on top of current DFA.
9. **Multiscale Entropy** -- Coarse-grain loop around existing SampEn. ~20 lines.
10. **Cross-Recurrence (CRQA)** -- Two-series RQA using existing infrastructure. Opens cross-session dynamical analysis.
11. **Markov transition entropy rate** -- Discretize IKI, compute transition matrix. Independent implementation.

*Dependency: existing dynamical signal pipeline. CRQA requires 2+ sessions.*

### Phase 4: Novel Representations
Orthogonal analytical frameworks.

12. **Visibility graph** -- IKI to network. Degree distribution, clustering, communities.
13. **Symbolic dynamics / forbidden patterns** -- IKI to symbols. Grammar analysis, Lempel-Ziv complexity.
14. **Wavelet energy ratio** -- CWT on IKI. Scale-separated energy bands.

*Dependency: none. Independent implementations.*

### Phase 5: Cognitive Classifiers and Profiles
Higher-order derived signals requiring Phase 1-4 signals.

15. **Pre-composition detection** -- Classifier from existing state engine dimensions + idea density.
16. **Clause-boundary pauses** -- Requires clause detection (lightweight NLP or regex on final text).
17. **Diurnal cycling profiles** -- Per-dimension circadian analysis. Requires accumulated session data.
18. **Calibration-journal delta expansion** -- Extend `tb_session_delta` to all new signals.

*Dependency: Phase 0 (circadian baselines). Phase 2-3 signals for delta expansion.*

### Phase 6: Architectural
Maximum value when signal set is complete.

19. **Question-as-treatment-variable** -- Build question-response coupling matrix. Condition question generation on behavioral response patterns.
20. **Joint behavioral-semantic embedding** -- Concatenate state vectors with text embeddings. Cognitive-mode-aware RAG.

*Dependency: 50+ sessions for question-treatment coupling. All prior phases for maximum embedding dimensionality.*

### Phase 7: Deep Mode (Opt-In)
Breaks monastic UX intentionally. Gated behind user consent.

21. **Acoustic keystroke force** -- Microphone-based force extraction. The one signal that cannot be derived from timing data alone.

*Dependency: none technically. UX decision on when/whether to offer.*

---

## Signal Count After Expansion

| Category | Current | New | Total |
|---|---|---|---|
| Raw production | 9 | 0 | 9 |
| Pause and engagement | 4 | 0 | 4 |
| Deletion decomposition | 9 | 0 | 9 |
| P-bursts | 3 | 0 | 3 |
| Keystroke dynamics | 7 | 0 | 7 |
| Revision chains | 2 | 0 | 2 |
| Re-engagement | 2 | 0 | 2 |
| Raw streams | 2 | 0 | 2 |
| Linguistic densities | 10 | 0 | 10 |
| Session metadata | 7 | 1 | 8 |
| 7D behavioral state | 8 | 0 | 8 |
| 11D semantic state | 12 | 0 | 12 |
| Dynamical signals | 11 | 14 | 25 |
| Calibration context | 7 dim | 0 | 7 dim |
| Device/temporal | 3 | 0 | 3 |
| Cursor behavior / writing process | 17 | 5 | 22 |
| Motor signals | 7 | 5 | 12 |
| Extended semantic signals | 8 | 0 | 8 |
| Process signals | 9 | 3 | 12 |
| Cross-session signals | 10 | 5 | 15 |
| **Mouse behavior** (NEW) | 0 | 5 | 5 |
| **Acoustic force** (NEW, opt-in) | 0 | 5 | 5 |
| **Cognitive classifiers** (NEW) | 0 | 2 | 2 |
| **Total** | **~147** | **~45** | **~192** |

Plus 4 analytical/architectural improvements (circadian baselines, question-as-treatment, joint embedding, delta expansion) that change how all signals are interpreted.
