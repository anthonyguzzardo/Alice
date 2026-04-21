Cross-Sectional Analysis: Hidden Upside Potentials

  I examined the full surface area across all four domains: 13 research drafts, 30+ Astro pages, the complete ingestion
  pipeline (100+ signals across 6 families), and the Markov avatar engine (1600 lines of Rust). The interesting findings are
  not in any one domain. They're in the gaps between domains, where something already built isn't yet connected to what it
  could prove.

  ---
  1. The Avatar Is Not a Feature. It's a Control Condition.

  This is the single largest unrealized upside in the project.

  The Reconstruction Validity paper proposes self-validating instruments via behavioral reconstruction. The avatar IS that
  reconstruction. But right now the avatar exists on a standalone page and the signal pipeline exists in the background, and
  they never touch each other.

  What's already built:
  - Avatar generates text + keystroke stream from personal Markov model + motor profile
  - Signal pipeline computes dynamical/motor/process signals from any keystroke stream
  - compute_perplexity is exposed at the napi boundary in lib.rs:231 but never called from TypeScript

  What's not connected:
  - Nobody runs the signal pipeline on the avatar's output
  - The reconstruction residual (real signals minus avatar signals) is never computed
  - The Reconstruction Validity paper makes claims about convergence predictions but has no automated convergence tracker

  The upside: Run the signal pipeline on avatar-generated keystroke streams. Compare each signal family between real sessions
  and avatar sessions. The residual is the formal measurement of what the Markov model captures (surface statistical
  regularity) versus what it misses (genuine cognitive structure). This residual:
  - Should be stable within-person across sessions (if it's noise, it isn't)
  - Should decrease as corpus grows (avatar improves), but asymptote to a non-zero floor (the irreducible cognitive component)
  - Provides the quantitative backbone for the Reconstruction Validity paper's central claim
  - Is computable today with existing infrastructure. No new signals needed.

  ---
  2. Two Perplexity Measures Exist Independently and Never Talk

  Cross-session signals compute selfPerplexity via a TypeScript character-trigram model (libCrossSessionSignals.ts:83). The
  avatar engine computes word-level Markov perplexity via Rust with Absolute Discounting (avatar.rs, exposed at lib.rs:236).
  These measure related but distinct things:

  - TS trigram perplexity: how novel is today's text relative to all prior texts (character-level surprise)
  - Rust Markov perplexity: how well does the personal word model predict a given text (generative model fit)

  The upside: Their divergence is meaningful. If character trigram perplexity stays flat but Markov perplexity increases, the
  person is using familiar letters in unfamiliar word sequences (lexical novelty without orthographic novelty). If both rise
  together, the person is exploring genuinely new territory. If Markov perplexity drops faster than trigram perplexity, the
  word model is overfitting to surface patterns. Tracking both creates a two-scale novelty detector that neither measure
  achieves alone. The Rust compute_perplexity function is already at the FFI boundary, just not wired into
  libSignalsNative.ts.

  ---
  3. Transfer Entropy Creates a Falsifiable Reconstruction Test

  Transfer entropy (dynamical.rs) measures causal direction between hold times and flight times. The avatar synthesizes both
  from the profile, with content-process coupling and tempo drift. But the avatar's TE is never compared to real TE.

  Why this matters: TE direction (hold-to-flight dominance vs flight-to-hold dominance) reflects whether motor execution
  drives cognitive planning or vice versa. A Markov chain with timing synthesis will produce SOME TE structure from its
  coupling rules, but likely not the RIGHT structure, because genuine cognitive-motor coupling is more complex than 3-phase
  tempo arcs.

  The upside: TE mismatch between real and avatar is a specific, measurable, falsifiable indicator of what the avatar can't
  reconstruct. If you can show that real TE is consistently different from avatar TE in a way that's stable within-person,
  you've isolated a signal that is:
  - Irreducible to statistical patterns (the avatar has the same surface statistics)
  - Personal (different people will have different TE signatures)
  - Potentially sensitive to cognitive change (TE reflects real-time cognitive-motor coupling)

  This doesn't exist anywhere in the keystroke-cognition literature. No existing study has attempted reconstruction-based
  validity via transfer entropy.

  ---
  4. The Calibration System Is an Unpublished Psychometric Innovation

  The within-day calibration design (neutral prompt before journal response, same-day delta computation) is mentioned in the
  observatory and pipeline code but barely appears in the papers. This is a significant gap.

  What's built: tb_calibration_context, tb_session_delta, tb_calibration_baselines_history. The question generation system
  already uses calibration-extracted life context (sleep, physical state, emotions, stress, etc.) and session deltas.

  The upside: Within-person, within-day controls eliminate most confounds that plague longitudinal behavioral studies (sleep,
  mood, medication, seasonal variation). The calibration response establishes "how I type today" and the journal response
  reveals "how I type when I'm thinking about this." The delta is the cognitive contribution, isolated from motor and
  contextual variation. This is publishable as a standalone methodological contribution. None of the papers currently make
  this argument explicitly, and no existing keystroke study uses same-day baselines.

  ---
  5. PE Spectrum (Orders 3-7) Is Computed But Underexploited

  The Rust engine computes permutation entropy at 5 embedding dimensions (orders 3-7), stored as pe_spectrum in
  tb_dynamical_signals. The observatory shows it. But nobody uses the spectral shape as a feature.

  The upside: A single PE value collapses temporal structure across scales. The spectrum separates local complexity (order 3:
  6-pattern space) from global structure (order 7: 5040-pattern space). Two people can have the same PE at order 3 but very
  different spectra. The spectral shape is a higher-dimensional fingerprint that's:
  - More discriminative than scalar PE for individual identification
  - More sensitive to change than scalar PE (degradation might show at high orders first)
  - Not reproducible by the avatar (the avatar doesn't target spectral matching)

  The PE spectrum divergence between real and avatar sessions is a particularly rich signal because the avatar's timing
  synthesis is designed at the individual-event level, not the multi-scale structure level. Whatever spectral structure
  persists in real sessions but not avatar sessions is definitionally cognitive.

  ---
  6. Question Generation Has the Seed Architecture for Adaptive Cognitive Challenge

  The question generation pipeline already:
  - Classifies response complexity (MATTR + cognitive density)
  - Adjusts difficulty using Bjork & Bjork desirable difficulties
  - Tracks which questions "landed" via feedback
  - Uses 8D behavioral dynamics to read the person's current state

  The upside that's hiding in plain sight: This isn't just question generation. It's an adaptive cognitive challenge protocol.
   The papers argue that cognitive reserve is built through sustained cognitive engagement and eroded by AI offloading. Alice
  already modulates challenge based on behavioral state. If you track the relationship between question difficulty and
  response quality (measured by signal richness, not content), you have the beginnings of a dose-response curve for cognitive
  engagement. The instrument doesn't just measure reserve. It could actively maintain it, with the same apparatus measuring
  the effect.

  ---
  7. Emotion-Behavior Coupling Is Personal and AI-Resistant

  tb_emotion_behavior_coupling stores how NRC emotion dimensions correlate with behavioral dimensions (fluency, deliberation,
  revision, etc.) per person. This is already computed and stored.

  The upside: How your emotions affect your typing is deeply personal and not reproducible by an LLM or a transcriber. If
  anger makes you type faster with fewer revisions, and sadness makes you type slower with more pauses, that coupling pattern
  is a behavioral fingerprint that:
  - Survives across topics (it's about how you write, not what you write)
  - Detects construct replacement (AI-assisted text won't show the same emotion-motor coupling because the motor component is
  disconnected from the emotional content)
  - Could be the most robust AI-contamination detector in the instrument

  The Construct Replacement paper argues that AI mediation replaces the generating process. Emotion-behavior coupling is
  exactly the kind of generating-process signal that would be disrupted, and it's already measured.

  ---
  8. The Personal Profile Is Already a Biometric Template

  tb_personal_profile aggregates digraph latencies, ex-Gaussian parameters, burst patterns, pause architecture, and revision
  topology into a single-row behavioral model.

  The upside beyond avatar generation: This profile is a behavioral biometric. It could:
  - Detect when someone else uses the instrument (profile mismatch on incoming keystroke stream vs stored profile)
  - Detect AI-assisted input (timing distribution shifts when AI suggests words)
  - Provide a formal "identity verification" that doesn't require passwords, just typing

  This connects directly to the Construct Replacement problem: if you have a person's motor profile and incoming keystrokes
  diverge from it, you can flag the session as potentially mediated. The papers argue this is needed. The data to build it
  already exists.

  ---
  9. The Research Pages and the Instrument Are Proving the Same Thesis From Two Directions

  research.astro argues the theoretical case (closing window, construct replacement, self-referential baselines). The signal
  pipeline + avatar provide the empirical machinery. But they barely cross-reference each other.

  The structural upside: The research page could pull live instrument statistics. Not user data (never surface that), but
  instrument metadata:
  - "N sessions captured to date"
  - "Average signals per session: 120+"
  - "Signal families validated against known invariants: all"
  - "Reconstruction validity: tracking (avatar convergence at X sessions)"

  The papers register predictions. The instrument produces data against those predictions. The website could show prediction
  tracking in real time, making the research a living document rather than a static claim. This is the kind of radical
  transparency that would be compelling to researchers evaluating the work.

  ---
  10. DFA Alpha Over Time Is the Dataset That Doesn't Exist Yet

  DFA alpha (detrended fluctuation analysis) measures long-range correlations in IKI timing. In motor studies (gait analysis),
   changes in DFA alpha are associated with cognitive decline. No longitudinal keystroke study has ever tracked DFA alpha
  daily for years.

  The upside: Alice is building this dataset right now. Each journal entry adds another DFA alpha measurement. Over months and
   years, this becomes the first longitudinal DFA-from-keystrokes time series in the literature. Combined with within-day
  calibration (controlling for motor variation), and PE spectrum (controlling for local complexity), DFA alpha trajectory
  becomes a candidate biomarker that's grounded in 30 years of scaling analysis theory and 0 years of keystroke longitudinal
  data. The infrastructure to produce this dataset is already running. The paper that could describe it doesn't exist yet.

  ---
  Summary of Actionable Connections

  ┌──────────────────────────────┬──────────────────────────────────┬─────────────────────────────────────────────────────┐
  │         What exists          │     What it could connect to     │                  What that yields                   │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Avatar keystroke stream      │ Signal pipeline                  │ Reconstruction residual (the cognitive fingerprint) │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Rust Markov perplexity       │ Cross-session trigram perplexity │ Two-scale novelty detection                         │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Transfer entropy             │ Avatar timing                    │ Falsifiable reconstruction validity test            │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Calibration system           │ Papers                           │ Publishable psychometric innovation                 │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ PE spectrum                  │ Avatar comparison                │ Multi-scale cognitive fingerprint                   │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Adaptive question difficulty │ Signal response quality          │ Dose-response curve for cognitive engagement        │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Emotion-behavior coupling    │ Construct Replacement paper      │ AI-contamination detector                           │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Personal profile             │ Incoming session comparison      │ Behavioral authentication / mediation detection     │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Research pages               │ Live instrument metadata         │ Living research document                            │
  ├──────────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────────────────┤
  │ Daily DFA alpha              │ Time (years)                     │ First longitudinal keystroke scaling dataset        │
  └──────────────────────────────┴──────────────────────────────────┴─────────────────────────────────────────────────────┘

  The recurring pattern: the most valuable connections are between the avatar and the signal pipeline. The avatar was built to
   demonstrate reconstruction. The signal pipeline was built to measure. Running one through the other creates the validation
  loop that the papers theorize but don't yet automate. That's the highest-leverage upside in the project.