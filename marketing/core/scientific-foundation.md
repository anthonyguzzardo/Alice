# Scientific Foundation

What follows is the argument chain underneath Alice's marketing claims. The campaign briefs assert things like "keystroke dynamics detect cognitive decline" and "the window is closing." This document carries the reasoning that makes those claims non-obvious and defensible. It draws from two published research papers (Guzzardo 2026a, 2026b) and the academic literature they cite.

This is not a literature review. It is a reference document for anyone who needs to understand why Alice's architecture follows from the science rather than from product intuition.

---

## 1. Keystroke-cognition research is promising but fragile

Keystroke dynamics have shown strong discriminative power for cognitive impairment: AUC = 0.918 for Alzheimer's screening via touchscreen writing-process biomarkers (Li et al. 2025), significant MCI discrimination from smartphone keystroke timing (Kim et al. 2024). The appeal is obvious: passive, daily, cheap, no clinician required.

But the evidence base is thinner than the numbers suggest:

- **Fewer than 500 total participants** across all published keystroke-cognition studies targeting neurodegeneration.
- **No held-out validation** in the highest-reported results. Li et al. (2025) computed AUC on the same 72-person sample used to fit a stepwise logistic regression. Kim et al. (2024) computed AUC on 99 participants without cross-validation; a correction notice followed.
- **Methodological heterogeneity**: studies use different input modalities (physical keyboard, smartphone, touchscreen handwriting), different tasks (free text, character repetition, constrained prompts), and different feature sets, making comparison across studies unreliable.

The results are suggestive. They are not confirmed. This matters for how Alice positions itself: not as a product built on settled science, but as the instrument the science needs to become settled.

---

## 2. The automaticity threshold: why current studies are confounded

Keystroke timing can only reflect cognitive processes when typing is automatic. This is not a methodological preference. It is a consequence of motor skill acquisition.

Pinet et al. (2022) documented two distinct processing architectures in typists:
- **Novice**: serial processing where each keystroke requires conscious key location, finger selection, and movement execution. Timing reflects motor search, not cognition.
- **Expert**: lower-level operations are chunked into an automated inner loop. The outer loop, where word retrieval, syntactic planning, and coherence monitoring happen, is where cognitive variation appears in the timing data.

Yamaguchi and Logan (2014) confirmed this experimentally: disrupting expert chunking makes skilled typists' patterns indistinguishable from novices. The expert architecture is qualitatively different, not just faster.

**The problem**: the population currently at risk for age-related cognitive decline (ages 60-80, born 1944-1964) largely did not grow up typing. Many never achieved the automaticity required for keystroke timing to carry cognitive signal rather than motor noise. Recruitment is difficult; Ntracha et al. (2020) required 12 months of smartphone experience and ultimately enrolled 23 participants.

This means current effect sizes are plausibly distorted by a generational confound: the people available to study are the wrong people to study this way.

**Why this matters for Alice's positioning**: The marketing claims about "keystroke dynamics as cognitive biomarkers" need this context. The field is real. The modality is promising. But the current evidence is built on the wrong population, and Alice is designed for the right one.

---

## 3. The window: why the opportunity is time-bound

The demographic confound is self-resolving on a known timeline:

| Decade | Ages 60-80 born | Typing history | Motor noise |
|--------|----------------|----------------|-------------|
| 2025 | 1945-1965 | Late adopters, 10-30 years | High |
| 2035 | 1955-1975 | Mixed, 20-35 years | Moderate |
| 2045 | 1965-1985 | Early adopters to natives | Low |
| 2055 | 1975-1995 | Digital natives, 30-45+ years | Minimal |

By 2045, researchers studying cognitive decline through keystroke dynamics will be working with lifelong fluent typists. The motor noise floor drops with each decade. The automaticity threshold will be met by default rather than by exclusion criterion.

**But this projection has a load-bearing assumption**: that those cohorts are still producing unassisted text character-by-character at volume when they arrive.

That assumption is already weakening. Autocomplete, predictive text, and AI-assisted drafting are not future threats. They are present features of how most people under 40 already write. The cohort arriving with typing fluency is the same cohort arriving with maximum AI-mediation exposure.

The window between demographic resolution and AI contamination is narrower than it appears. The instruments that could exploit it need to be built now, while unassisted writing is still common enough to establish baselines.

**Why this matters for marketing**: Every campaign brief's "why now" section rests on this argument. It is not a rhetorical device. It is a demographic and technological reality with a concrete timeline. The urgency is structural, not manufactured.

---

## 4. Construct replacement: why unmediated input is non-negotiable

This is the deepest argument in Alice's scientific foundation, and the one most marketing materials skip entirely.

AI mediation of human input does not add noise to behavioral measurement. It replaces the construct being measured. The distinction matters:

- **Noise**: the construct is intact; the instrument captures it imprecisely. More data helps. You can model and correct it.
- **Construct replacement**: the measurement now corresponds to a different construct entirely. More data makes it worse, because you are accumulating evidence about the wrong thing with increasing statistical power.

When a person retrieves a word from memory and types it character by character, the timing data reflects lexical retrieval, orthographic encoding, and motor execution. When the same word appears because the person accepted a predictive text suggestion, the surface output is identical but the cognitive process is different: visual scanning, suggestion evaluation, acceptance execution. Different cognitive resources, different timescale, different temporal signature.

This is empirically documented:
- Arnold, Chauncey, and Gajos (2020): predictive text shifts production from generation to selection, reducing lexical variety independently of vocabulary size.
- Banovic et al. (2019): autocomplete shifts pause distributions from lexical-retrieval patterns to suggestion-evaluation patterns.
- Buschek, Zurn, and Eiber (2021): phrase-level suggestions alter content, not just speed. Writers restructure their intended message to accommodate what the system offers.
- Doshi and Hauser (2024): AI-assisted writing enhances individual quality while reducing collective diversity. Different writers converge toward similar outputs.

Most critically, Zhou and Liu (2025) found that after seven days of AI-assisted idea generation, creativity dropped and content homogeneity continued climbing even after the AI was removed. The mediation altered the generating process in the human. The "creative scar" persists beyond the mediation itself.

**Why this matters for Alice**: Alice's requirement for unassisted writing is not a UX decision or a philosophical stance. It is a measurement validity requirement. If the input is AI-mediated, the signals computed from it are measuring suggestion evaluation and acceptance behavior, not lexical retrieval, working memory, or executive function. The data looks the same. It means something different. No amount of signal processing can recover the original construct from mediated input, because the construct was never generated.

This is also why the contamination is invisible: no dataset records whether a word was typed or accepted from a suggestion. Detection is impossible post-hoc. The distinguishing information exists only in process-level data (keystroke timing, pause structure, acceptance events), and standard behavioral datasets do not collect it.

---

## 5. The clock-drawing precedent: why modality awareness matters

The claim that a cognitive assessment can be invalidated by cultural technology shift is not hypothetical. It has already happened.

The clock-drawing test (CDT) has been a standard neuropsychological screening tool for decades. Vishnevsky, Fisher, and Specktor (2024) demonstrated that Gen Z adults underperform on the CDT not because of cognitive impairment but because of reduced familiarity with analog clock faces. The assessment embedded a hidden cultural competency that is no longer universal.

The parallel to keystroke dynamics: keyboards will eventually be displaced by voice, neural input, or technologies that do not yet exist. Any instrument permanently coupled to keyboard input will face the same obsolescence.

**Why this matters for Alice's design**: The signal engine is designed so that the cognitive constructs being measured (processing speed, retrieval fluency, planning complexity, revision behavior) can migrate to new input modalities. The framework is expressed in terms of cognitive processes, not keystroke events. Keystroke timing is the current carrier. It is not the permanent one.

---

## 6. From population norms to personal baselines

Every published keystroke-cognition study asks: does this person look impaired compared to healthy people? That is the only question available from a one-time lab visit with population norms.

Once you have someone typing fluently every day for years, you can ask a different question: does this person look different from themselves?

This is the paradigm shift that the demographic resolution enables, and it changes what Alice's signal engine actually does:

- **Cross-sectional to longitudinal**: thousands of data points per person over years, not a single snapshot.
- **Population-normed to self-referential**: comparison to the person's own history, not a healthy average. Eliminates confounds of education, occupation, and baseline cognitive ability.
- **Task-constrained to ecological**: data from naturalistic daily writing, not artificial lab tasks.
- **Diagnosis to early detection**: "your behavioral trajectory shifted six months ago in a pattern consistent with known decline markers" rather than "you score below the clinical cutoff today."

The metrics for this paradigm do not yet exist. This is not a gap in the literature. It is a consequence of the data never having been available. You cannot develop intra-individual longitudinal baselines from a 45-minute lab session with 23 participants.

**The statistical challenges are real**: regression to the mean, life event confounding, seasonal variation, compliance decay, and especially the base rate problem (MCI incidence is ~1-2% per year in adults over 65; even 95% specificity produces more false positives than true positives at that base rate). These are named in the research, not solved. Alice's marketing should not claim they are solved.

**Why this matters for marketing**: The campaign briefs for clinical, pharma, defense, and aging verticals all claim Alice produces "longitudinal cognitive signals." The scientific foundation for that claim is the self-referential baseline paradigm. The claim is real. The paradigm is validated in concept (actigraphy, speech monitoring have precedents). The specific metrics are unvalidated. Marketing should distinguish between the framework (strong) and the specific validation (in progress).

---

## 7. The instrument gap: why the architecture is necessary

The current research landscape is fragmented into two silos that do not talk to each other:

1. **Keystroke dynamics researchers** capture timing data but ignore the content of what is typed. They can tell you flight time is elevated but not whether the writer was struggling to retrieve a specific word or planning a complex sentence.
2. **Computational linguistics researchers** analyze transcribed text but have no access to the temporal process that produced it. They can tell you vocabulary diversity is declining but not whether the decline reflects retrieval difficulty (long pauses before low-frequency words) or avoidance (choosing simpler words without hesitation).

The combination is not additive. It is multiplicative. A decline in MATTR concurrent with a decline in P-burst length (retrieval difficulty under cognitive load) means something clinically different from a decline in MATTR with stable P-bursts (vocabulary contraction independent of production fluency).

No existing tool at validated scale combines:
- Process capture (keystroke-level temporal data)
- Content analysis (linguistic features from the submitted text)
- Longitudinal self-referential architecture (personal baselines over months/years)
- Calibration (within-person same-day baselines via neutral prompts)
- AI-mediation controls (unassisted writing conditions)
- Modality awareness (cognitive constructs not permanently coupled to keyboards)

Alice satisfies all six. This is not a marketing claim. It is an engineering fact, currently at n=1 with fewer than ten fully instrumented sessions. The gap between "implemented" and "validated" is the work that remains, and the marketing should say so.

---

## 8. What Alice can and cannot claim

Based on the scientific foundation above, here is what the marketing materials can say with grounding, and where they need to hedge.

### Grounded claims
- Keystroke dynamics are a promising modality for passive cognitive assessment, with early studies showing strong discriminative power.
- Current studies are confounded by a generational typing proficiency gap that is demographically self-resolving.
- AI mediation of writing input produces construct replacement, not noise, making unassisted writing a measurement validity requirement.
- The window for establishing unmediated baselines is closing on a concrete timeline.
- No existing instrument combines process capture, content analysis, and longitudinal self-referential tracking.
- Alice's architecture satisfies the design constraints the science identifies as necessary.

### Claims that need qualification
- "Alice detects cognitive decline." It captures signals associated with cognitive decline in the literature. Whether those signals produce clinically meaningful trajectory markers in a longitudinal context has not been validated.
- "365x data density vs quarterly assessments." True by arithmetic, but data density is not the same as information density. The minimum data density required for stable personal baselines has not been established.
- "Signal engine produces research-grade data." The signals are implemented. "Research-grade" implies validation that has not occurred.
- "Users can't game metrics they can't see." True as stated, but observer effects are more subtle than gaming. The Hawthorne effect claim is correct; the implied conclusion that Alice's data is therefore uncontaminated is an overstatement.

### Claims to avoid
- Any implication that Alice has been clinically validated.
- Any specific sensitivity/specificity numbers for cognitive decline detection.
- Any claim that the signal pipeline is peer-reviewed or externally validated.
- "Digital biomarker" without qualification (implies regulatory validation that does not exist).

---

## Source papers

- **Guzzardo, A. (2026a).** "A Closing Window: The Demographic Confound in Keystroke-Based Cognitive Biomarkers and the AI-Mediation Threat to the Paradigm That Would Replace It." Preprint, v2. `papers/option_a_demographic_confound_paper.md`
- **Guzzardo, A. (2026b).** "Construct Replacement: When AI-Mediated Input Invalidates Behavioral Measurement." Preprint, v2. `papers/option_b_draft.md`

Key citations from those papers are referenced inline above. Full reference lists are in the source papers.
