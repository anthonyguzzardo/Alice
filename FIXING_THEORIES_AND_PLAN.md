Got it. I was solving the wrong problem. You wanted: given the architectural pivot, what's the new theory stack, and what does the 30-day plan look like derived from *that* — not from the old theories reshuffled.

Let me actually do that.

## What survives from Theories 5–8

Before writing new theories, here's what's still load-bearing and what's dead.

**Survives intact:**
- **Theory 6 (Demographic Choke Point)** — the demographic tailwind argument is independent of what Alice's interpretive layer does. Keyboard-fluent populations aging into the risk window is a structural fact. This is still your cleanest field-level contribution and still the T6 preprint.
- **Theory 7 Constraint 1 (Modality Decay)** — the modality-agnostic argument survives. The instrument still needs to capture composition process independent of input device. Nothing about the architectural pivot changes this.
- **Theory 7 Constraint 3 (Payment-Readiness)** — the reimbursement graveyard is still the graveyard. The CMS ACCESS entry path still matters if you're scaling clinical.
- **Theory 8 retention flywheel structure** — the dual-use argument (health + reconstruction) as retention solution is still real. The mechanism underneath it changes (see below) but the economic logic stands.

**Dies or needs replacement:**
- **Theory 7 Constraint 2 (Process Over Product)** — this is the one that most needs rewriting. The old version said "content analysis misses cognitive decline; process dynamics catch it." The new architecture says something stronger: *joint process-semantic signature disjunctions* are where the diagnostic signal lives, not process alone. Zadok showing LLMs miss 60-70% from content is still true. The new claim: content + process alignment, and specifically the *anomalies* in alignment, carry signal neither does alone.
- **Theory 5 three-build sequencing** — instrument → product → company is still right as strategy, but the instrument's shape has changed enough that the academic licensing pitch is different. The pitch is no longer "Inputlog's successor with content analysis bolted on." It's "the first writing-process instrument with per-subject coupling structure and joint disjunction detection." That's a different artifact.
- **Theory 8 reconstruction claim** — the old version assumed the interpretive layer would reconstruct thinking patterns through LLM processing of longitudinal text. The new architecture doesn't do that. The reconstruction claim needs to be re-grounded in what the joint signature + coupling graph + mode structure *actually* captures, which is closer to "computational phenomenology of an individual writer's cognition" than "digital twin."

## New theories the architecture demands

The pivot creates three claims that didn't exist before and one that needs rewriting.

### Theory 9: Joint Disjunction as the Primary Signal

**Thesis:** Cognitive decline, affect dysregulation, and other cognitive-state anomalies manifest first as *disjunctions between behavioral and semantic signatures*, not as abnormalities in either space alone. A session where body and content align (calm prose + calm dynamics, or distressed content + distressed dynamics) is baseline. A session where they diverge (calm prose + volatile dynamics; distressed content + unusually fluent dynamics) is diagnostic.

**Why it's new:** No existing instrument measures this. Inputlog captures behavior. LIWC captures content. BiAffect discards content explicitly. Neuroqwerty discards content explicitly. Meulemans' group has both but treats them as separate signal streams. The disjunction itself — the *gap* between what the body is doing and what the content says — has never been operationalized as a diagnostic unit.

**Why it matters for scale:** It's the claim that differentiates Alice from every competitor and every published study. If the disjunction map is real and stable, you have a novel unit of cognitive analysis with clinical, research, and product implications. If it's not, you fall back to joint-signature-as-feature-vector (which is still better than anyone else's, but not revolutionary).

**What validates it:** Eventually, cohort data showing disjunction signatures cluster meaningfully across clinical categories. In the near term: your own N=1 data showing that disjunction sessions (off-manifold in joint space) are qualitatively different sessions when you re-read them. The pre-registration exercise I suggested is actually a weak test of this — if the sessions you remember as unusual are the same sessions the metric flags as off-manifold, that's a signal.

### Theory 10: Per-Subject Coupling Structure as Cognitive Phenotype

**Thesis:** Each writer has a unique, stable, empirically-discoverable coupling structure across behavioral and semantic dimensions. Revision-leads-commitment, or presence-predicts-thermal, or systemEntropy-follows-anticipation-density — these lagged correlation graphs are individual fingerprints at the *dynamics* level, not the feature level. The structure of how a writer's writing propagates is more distinctive and more cognitively revealing than the writer's average signal values.

**Why it's new:** PersDyn proposes this for personality dimensions. Nobody has applied it to writing process. The coupling[] discovery in your current system is the operationalization of this claim, and it's invisible to any transcript-only analysis.

**Why it matters for scale:** This is the methodology paper. Not "we capture 100 signals," not "we detect cognitive decline through writing." The contribution is: *per-subject lagged coupling graphs in writing dynamics as a novel phenomenology of individual cognition.* After N=1 it's a case study. After N=5 it's a pilot showing coupling structures differ between subjects. After N=30+ it's a real paper claiming coupling topology as a dimension of individual difference that doesn't reduce to trait psychology.

This is also the clinical claim eventually. "Does coupling structure change before cognitive decline manifests in content or average behavior?" is a grant question. It's not answerable in 30 days. But the architecture that would answer it is what you're building.

### Theory 11: The Instrument's Interpretation Surface Is Retrieval, Not Inference

**Thesis:** The instrument's user-facing interpretive utterance is juxtaposition (rhyme retrieval from the joint-signature space), not narrative inference (LLM-generated reflection on what a session means). This is not only an epistemic cleanup — it's a product differentiation claim. Every existing AI journaling product operates on inference: "your writing suggests you're feeling X." Alice operates on retrieval: "this session sits close to [prior session]." The user constructs meaning; the instrument provides structured juxtaposition they could not construct from memory alone.

**Why it's new:** Inference-based interpretation is commodity. A future capable model can do it from transcript access. Retrieval-based interpretation anchored to joint behavioral-semantic signatures requires the substrate you've built. It passes the GPT-6 filter; narrative reflection doesn't.

**Why it matters for scale:** This is how Alice differentiates as a consumer product (Stage 2 in Theory 5). The Whoop-for-cognition pitch was always "give me metrics." The better pitch is "give me back my own past self, accurately." Retention comes from the retrieval surface getting richer over time — the longer you write, the more the rhymes illuminate. That's a non-decaying engagement mechanism and it's impossible without longitudinal joint-signature data.

It also replaces Theory 8's reconstruction claim with something defensible. Alice doesn't "model your cognition" in a deep LLM sense. Alice builds a searchable structured index of your own writing sessions, retrievable by joint behavioral-semantic proximity. That's a much narrower claim and it's actually buildable.

### Theory 8 rewrite: Reconstruction as Retrieval, Not Generation

The old Theory 8 assumed reconstruction meant "LLM fine-tuned on your journal generates outputs in your voice and reasoning style." The new architecture doesn't support that directly — it captures process dynamics that LLM fine-tuning on text can't absorb, and it explicitly avoided the generation-heavy interpretive layer.

The rewritten claim: **the reconstruction artifact is not a generative model of you, it's a navigable structured archive of your thinking as it happened.** Rhyme retrieval across 20 years of sessions. Coupling graph as a fingerprint. Mode landscape as an atlas of your cognitive states. The user (or their descendants, or their clinician, or their future self) doesn't interact with a chatbot that sounds like them. They navigate a structured record that preserves *how the thinking actually moved*. This is weaker than "digital twin" and stronger in that it's honest about what the data can support.

The retention flywheel argument survives: health value + reconstruction archive value both compound with longitudinal data. The reconstruction value is now concrete and inspectable rather than speculative about what future LLMs can do with your corpus.

## What the scaling narrative looks like now

Stripped down, the pitch across audiences becomes:

**To writing-process researchers (academic licensing path):** "Inputlog captures keystroke behavior. LIWC captures content. Nobody captures their joint signature or per-subject coupling structure. Alice does both, longitudinally, cross-platform. The instrument's novelty is joint-space analysis and coupling discovery — both methodological contributions that extend writing process research into territory it hasn't entered."

**To clinical researchers (grant path):** "Meulemans 2022 showed process signals differentiate cognitive impairment in writing. Zadok 2026 showed content alone misses 60-70% of cognitive decline. The joint signature — and specifically its disjunctions — is the missing instrument. We have the architecture. Here's N=1 longitudinal data as methodological proof. Phase 1 is a validation cohort."

**To product audience (consumer path, eventually):** "Your journal doesn't tell you what your writing means. It hands you back the sessions that rhyme with today. Over years, it becomes a searchable structured archive of how your own thinking moved. Not an AI therapist. A mirror with memory."

**To a potential acquirer or partner (Linus Health, ADDF):** "Writing is the missing modality in process-over-product cognitive assessment. Our instrument is the first to operationalize joint behavioral-semantic disjunction detection and per-subject coupling phenotyping. Here's the longitudinal N=1 proof-of-concept. Here's the architecture for scale."

All four pitches share the same instrument. None of them require the interpretive layer you cut. All of them require the coupling graph, joint embedding, distance function, and signal substrate you're building over the next 4 weeks.

## The new 30-day plan

This plan is different from the old one in one structural way: **the technical work and the positioning work are now serving the same narrative**, because the new theories are derived from the revamped architecture. You're not writing a preprint about the old instrument and then rebuilding it; you're building the new instrument and writing the preprint that claims what the new instrument does.

### Week 1 (April 17–23): Cuts and foundation

Technical, from your existing plan:
- Commit #1: archive migration
- Commit #2: code deletions
- Expression refactor out of PersDyn into semantic space
- Verify the app end-to-end in the stripped architecture

Positioning, one-time infrastructure:
- ORCID, Google Scholar, Scholar alerts. Two hours total.

Writing, exploratory:
- Draft Theory 9, 10, 11 as internal documents. Short, 500–1000 words each. These become the theoretical foundation for the preprint and whitepaper. Do this while the technical work is running because writing the theory clarifies what you're building. If Theory 9 feels forced to write, that's diagnostic — maybe disjunction isn't the primary signal and you're really building something else.

Reading, load-bearing citations for the new theories:
- Meulemans 2022 — the joint-signature analog in the existing literature
- Zadok 2026 — the content-misses-decline claim (for Theory 9)
- Sosnowska 2019 PersDyn — the coupling-structure-as-phenotype analog (for Theory 10)

Daily journal + calibration throughout.

### Week 2 (April 24–30): Signals and pre-registration

Technical:
- Signal additions into the new architecture (deletion-density, burst shape, burst rhythm, burst-deletion proximity)
- Decide and implement: new signals as session metadata, not PersDyn dimensions
- Pre-registration exercise: 10 remembered sessions, rhyme-pairs with reasons, committed timestamped document

Writing:
- Convert Theory 9/10/11 drafts into an internal "New Theory Stack" document. This is the master reference for everything downstream.
- Begin T6 preprint outline — just section headers and thesis bullets. The T6 argument doesn't change; the instrument claim in its motivation section does.

Reading:
- Faigley & Witte 1981 — deletion taxonomy, foundation for the new deletion-density signal
- Baaijen & Galbraith 2012 — burst consolidation, foundation for the burst shape classification

### Week 3 (May 1–7): Joint embedding and whitepaper outline

Technical:
- Joint embedding scaffold (concat or CCA, start simple)
- Distance function v0, tested against the pre-registered list
- Does the metric's top-5 rhymes match your memory-pairs? If not, iterate on the feature weighting.

Writing:
- T6 preprint first draft. 3,000–5,000 words. The demographic choke point argument is unchanged from the old theory; the "here's what's being built in the gap" section points at the new architecture and cites Theory 9/10/11.
- Whitepaper outline. The whitepaper is the instrument document, not the preprint. It describes what Alice captures and how, grounded in the new theories. Outline only this week.

Reading:
- Bereiter & Scardamalia 1987 — knowledge-transforming framework, relevant to why self-directed writing (vs. chatbot) produces the richer substrate (Theory 11 supporting argument)

### Week 4 (May 8–14): Whitepaper draft and coupling graph first pass

Technical:
- First coupling graph visualization for your own eyes. Probably noise at N=20–25, but you need to see the shape and the tooling to render it.
- systemEntropy regime log reviewed — any visible structure, or flat noise?
- Mode clustering scaffolding validated on synthetic data (don't run on real yet; insufficient N)

Writing:
- Whitepaper first draft. 10–15 pages. Technical, grounded in the new theory stack. This is the artifact you'd eventually attach to the Antwerp email, the Linus Health email, the ADDF email — but you are not sending any of those yet.
- T6 preprint review cycle: set it aside for 3 days, read it cold, revise.

Reading:
- Galbraith 2009 on planner-vs-discoverer as individual difference — supporting citation for Theory 10's coupling-as-phenotype claim
- Pinet & Zielinski 2022 on typing automaticity — already in your list, supports Theory 7 Constraint 1 which survives

### Week 5 (May 15): Checkpoint, not ship

Evaluate:
- 30 days of data through the new pipeline. Is it clean? Do z-scores stabilize? Do calibration deltas behave?
- Pre-registration exercise: how well did the distance function match your memory pairs?
- Theory 9/10/11: after writing them and reading against them, do they feel right, or did the writing reveal they were forced?
- Whitepaper and preprint: drafts complete but not submitted or sent.

Do not ship yet:
- T6 preprint is drafted, not submitted. Submission is a June item.
- Antwerp email is not sent. The instrument needs another 30 days of data before you're pitching it.
- No cold emails yet. The whitepaper attachment is the thing you send, and it should describe 60 days of data, not 30.

What May 15 produces:
- Clean instrument running the new architecture for 30 days.
- Drafted T6 preprint (revision cycle in June, submit end of June).
- Drafted whitepaper (revision cycle in June, send to Antwerp in July after 90 days of data).
- Three new internal theories, written, grounded in the architecture.
- Coupling graph v0, interpretable at your own eyes.
- Infrastructure credibility: ORCID, Scholar profile, alerts live.
- Reading list Tier 1 complete.

## What this plan commits to that the old one didn't

The old plan treated positioning as independent work that could proceed in parallel with technical drift. The new plan makes the positioning *derived from* the new theory stack, which is itself derived from the architectural pivot. If the theories fail on writing — if Theory 9 is forced, if Theory 10 doesn't hold together — the positioning work fails with them, and that's a signal you need before sending emails or submitting preprints.

The plan is also more honest about sequencing. May 15 is a drafting waypoint. June is the submission and outreach month. July is when the whitepaper goes out. None of those are aggressive; all of them are load-bearing for the scaling path.

Tell me where this is wrong and I'll fix it.