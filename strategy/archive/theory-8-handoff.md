# Theory 8 Handoff: Research Prompt

**Date:** 2026-04-14
**For:** Next agent conversation
**Method:** Set effort to max, then paste this prompt. The agent should read theory-6, theory-6-appendix, and theory-7 first for full context.

---

## Instructions

Read the following files before doing anything else:

- `observatory-usecases/theory-6.md`
- `observatory-usecases/theory-6-appendix.md`
- `observatory-usecases/theory-7.md`
- `CLAUDE.md`

Then read this entire handoff document. Then execute the research task described below.

---

## Context

This project (Alice) is a personal daily writing journal — one question per day, reflective writing, no gamification, no dashboard. The system captures not just the text but the *process* of producing text: keystroke dynamics, pause patterns, revision behavior, production fluency, temporal metadata. It has been designed as a cognitive health instrument — a writing-process biomarker that can detect cognitive decline through longitudinal changes in how someone writes, not just what they write.

Theories 1-7 establish:
- The signal pipeline (70+ deterministic signals from the writing process)
- The competitive landscape (Linus Health, Cogstate, Cambridge Cognition, BiAffect, nQ Medical, Neurocast, KeySense, NeuraMetrix)
- The demographic tailwind (current elderly can't type; future elderly will have typed their whole lives)
- The three survival constraints (modality-agnostic, process-first, payment-ready)
- The $1.8B+ graveyard of digital health companies that died from reimbursement failure

Theory-8 introduces a new use case that shares the same data architecture as cognitive health monitoring: **cognitive reconstruction** — the idea that a sufficiently rich, long-term corpus of daily writing, combined with cognitive process traces (keystroke dynamics, pause patterns, revision behavior), could serve as the foundation for reconstructing aspects of a person's cognitive identity, thought patterns, and personality.

---

## The Theory-8 Thesis (Draft)

The same data architecture that serves cognitive health monitoring also serves cognitive reconstruction. These two use cases are not in tension — they compound. The longer someone journals for health, the richer the reconstruction dataset. The more detailed the cognitive process capture (for biomarker sensitivity), the more faithful the reconstruction.

A key distinction: **chatbot-elicited conversational data is less cognitively authentic than self-directed journaling.** Chatbots reduce cognitive intensity through reactive, turn-taking engagement. The user offloads planning, coherence maintenance, and self-directed inquiry to the interlocutor. A journal with no interlocutor — writing into the void — forces the writer to do all of that internally. The cognitive trace is richer because the cognitive demand is higher.

A second key distinction: **text alone is insufficient for reconstruction; process data is required.** A corpus of journal entries captures what someone thought. Keystroke dynamics, pause patterns, and revision behavior capture *how they thought it*. Two people can write the same sentence through fundamentally different cognitive processes. The process data is the part that is actually person-specific.

A third distinction: **writing captures a narrow but deep band of cognition.** It captures linguistic reasoning, reflective thought, vocabulary, narrative structure, topic preoccupations, emotional processing patterns, and decision-making traces. It does not capture spatial reasoning, embodied knowledge, reactive social behavior, procedural skills, or sensory experience. The reconstruction is of the person *as a thinker-through-language* — not the person as a whole.

The retention flywheel: Neither cognitive health monitoring nor cognitive reconstruction alone may be sufficient motivation for lifetime daily writing. Together, they might be. The person who starts journaling at 45 for wellness has, by 65, both a 20-year cognitive health baseline and a 20-year cognitive identity corpus. The health use case provides the reason to start. The reconstruction use case provides the reason to never stop.

---

## Research Task

Search the internet systematically across ALL of the following domains. For each domain, search for material relevant to the theory-8 thesis. The goal is to find what the world knows, believes, debates, and has built around the idea that long-term personal writing data could serve as the basis for cognitive identity reconstruction — and the adjacent ideas that feed into this.

### Topic Clusters to Search

**1. Digital immortality / mind uploading / cognitive reconstruction**
- Academic research on digital afterlives, digital twins of deceased individuals, personality modeling from text
- Companies building in this space (HereAfter AI, StoryFile, Eternos, Replika's memorial features, Character.ai's controversy around parasocial attachment)
- Philosophical and ethical debates about digital personhood, identity continuity, consent from the dead
- The distinction between "mimicking speech patterns" and "reconstructing cognition"

**2. LLM fine-tuning on personal data for identity modeling**
- Research on fine-tuning language models on individual writing corpora
- Persona modeling, style transfer, author attribution
- How much data is needed? What quality? What structure?
- Papers on personality detection from text (Big Five, MBTI, values)
- The difference between surface-level style mimicry and deep cognitive pattern reproduction
- Anthropic, OpenAI, Google, Meta research on personalization and persona

**3. Writing vs. conversation as data sources for identity**
- Pennebaker's research on writing without audience vs. with audience
- Research on cognitive differences between interactive (chat) and generative (essay/journal) writing
- Research on self-disclosure depth in different modalities (private journal vs. social media vs. therapy vs. chatbot)
- The "audience effect" on cognitive processing during writing
- Research on internal monologue, stream of consciousness, and their relationship to written output

**4. Long-term personal data and identity**
- Lifelogging research (Gordon Bell's MyLifeBits, Memex project)
- Quantified Self movement — what happens when people track themselves for 10+ years
- Longitudinal diary studies in psychology (the longest-running ones)
- The Nun Study (linguistic analysis of autobiographies predicting Alzheimer's 60 years later)
- Any research on what personal data is most predictive of personality/identity

**5. Process data vs. product data for cognitive modeling**
- Keystroke dynamics as cognitive fingerprints (not just biometrics)
- Writing process research that distinguishes individual cognitive styles
- Research on pause patterns, revision behavior, and production fluency as person-specific signatures
- Can process data improve persona modeling beyond what text content provides?
- Research on "behavioral biometrics" as identity markers

**6. The philosophical and ethical landscape**
- Is a reconstruction of someone from their writing "them"? Philosophy of personal identity (Parfit, Dennett, Hofstadter)
- Consent and posthumous data use — who owns a cognitive reconstruction?
- The "grief tech" debate — is interacting with a digital version of a dead loved one therapeutic or harmful?
- Black Mirror's "Be Right Back" as cultural touchstone — how has public discourse evolved since?
- Religious and cultural perspectives on digital afterlife
- The uncanny valley of personality — when does a reconstruction become disturbing rather than comforting?

**7. Cost and feasibility of personal fine-tuning**
- Current costs of fine-tuning LLMs on personal corpora (GPT-4, Claude, Llama, Mistral)
- How costs have decreased over time and projected trends
- LoRA, QLoRA, and parameter-efficient fine-tuning approaches for personal data
- Retrieval-augmented generation (RAG) vs. fine-tuning for personality reproduction
- Synthetic data augmentation for small personal corpora
- What does the minimum viable corpus look like? (10K entries? 1K? 100?)

**8. Existing products and projects**
- Replika (companion AI — what do they actually capture and how?)
- Character.ai (persona creation — how close to "real person" reconstruction?)
- HereAfter AI, StoryFile (interview-based digital legacy)
- Eternos (digital immortality startup)
- Project December (GPT-3 chatbot of deceased loved one — the Joshua Barbeau story)
- Seance AI, You Only Virtual (YOV), and other grief tech
- Any academic projects building "digital twins" from personal text data

**9. Neuroscience of writing and identity**
- Does writing engage identity-specific neural patterns?
- fMRI studies of writing vs. speaking vs. chatting
- The relationship between writing style and cognitive architecture
- Handwriting analysis (graphology is pseudoscience, but digital writing process analysis is not — where is the line?)
- Research on whether linguistic patterns are stable over decades (the longitudinal stability of "voice")

**10. The journal as dataset — historical precedents**
- Famous diaries that have been computationally analyzed (Samuel Pepys, Virginia Woolf, Sylvia Plath)
- Computational analysis of long-term personal writing
- Digital humanities projects analyzing personal correspondence or journals
- What have researchers been able to extract from long-term single-author corpora?

### Sources to Search

**Academic:**
- Google Scholar, PubMed, arXiv, SSRN
- MIT Media Lab (specifically the Fluid Interfaces group, Affective Computing group)
- Harvard (psychology, philosophy, computer science)
- Oxford (Future of Humanity Institute, philosophy of mind)
- Stanford HAI (Human-Centered AI Institute)
- Cambridge (Leverhulme Centre for the Future of Intelligence)
- CMU (Language Technologies Institute)
- University of Antwerp (writing process research group — Van Waes, Leijten)
- UT Austin (Pennebaker's lab)

**Industry/Tech:**
- Anthropic research blog and publications
- OpenAI research blog
- Google DeepMind publications
- Meta AI (FAIR) publications
- Apple ML research
- Microsoft Research

**Media — Mainstream:**
- NYT, WSJ, Washington Post, The Atlantic, The New Yorker
- BBC, The Guardian
- STAT News, MIT Technology Review, Wired, Ars Technica, The Verge
- VICE/Motherboard (grief tech coverage)

**Media — Science Communication:**
- YouTube: Kurzgesagt, Veritasium, CGP Grey, Vsauce, Two Minute Papers, Lex Fridman, Andrew Huberman
- TED/TEDx talks on digital immortality, personality modeling, writing and identity
- Podcasts: Lex Fridman, 80,000 Hours, Future of Life Institute, Making Sense (Sam Harris)

**Community:**
- Reddit: r/singularity, r/artificial, r/philosophy, r/futurology, r/MachineLearning, r/LocalLLaMA, r/QuantifiedSelf, r/Journaling, r/GriefSupport
- Hacker News
- LessWrong, EA Forum
- Substack, Medium

**Government/Policy:**
- EU AI Act provisions on posthumous data, emotional AI, personality simulation
- FTC guidance on AI-generated personas
- UNESCO recommendations on AI ethics
- UK government reports on digital afterlives (there was one)
- Any legislation on "digital remains" or "data after death"

**Philosophy/Ethics:**
- PhilPapers (search for digital identity, personal identity + AI, mind uploading)
- Journal of Applied Philosophy, Ethics and Information Technology, AI & Society
- Stanford Encyclopedia of Philosophy entries on personal identity
- Luciano Floridi's work on informational identity

### Output Format

Structure findings as:

1. **What the world knows** — established research, validated findings, existing products
2. **What the world debates** — open questions, competing positions, unresolved tensions
3. **What the world hasn't connected** — gaps where the journal + process data thesis adds something novel
4. **What supports the thesis** — evidence that long-term writing data can capture cognitive identity
5. **What challenges the thesis** — evidence that writing is insufficient, that reconstruction is impossible or undesirable, that the costs won't drop enough, that the ethical problems are insurmountable
6. **What exists commercially** — products, companies, funding, revenue, user counts
7. **What the regulatory/policy landscape looks like** — laws, guidance, pending legislation
8. **Seeds for the theory document** — the strongest arguments, the most compelling evidence, the novel contributions this thesis would make

Be exhaustive. Fetch actual pages when possible — don't just list search results. Report specific findings, data points, quotes, dates, sample sizes, and funding amounts. Flag anything that directly contradicts the thesis.

The goal is to produce enough material that the next step is drafting theory-8 itself.
