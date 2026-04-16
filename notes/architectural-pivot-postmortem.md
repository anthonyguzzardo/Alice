# When I realized my instrument was grading itself against its own theories

A post-mortem of the 2026-04-16 restructure of Alice — a single-subject longitudinal writing-process instrument I'd been building. Drafted while the new architecture is still warm. Not yet for publication. Possibly not ever.

---

## What I deleted

About 1,830 lines of code, nine database tables, and the most visible analytical layer in the system.

Specifically, I removed:

- **Three-frame analysis.** Every notable behavioral signal was being interpreted by an LLM through three deliberately-opposed lenses (charitable / avoidance / mundane), which then synthesized a confidence assessment. ~600 lines (`src/lib/observe.ts`).
- **Falsifiable predictions.** Each three-frame observation generated 1-2 hypotheses with structured JSON criteria referencing a canonical signal registry. ~600 lines for the deterministic grader (`src/lib/grader.ts`) — ironically the most epistemically rigorous part of the system, and the part that most clearly didn't work.
- **Theory selection via Thompson sampling.** Each prediction belonged to a theory; theories accumulated Beta-Binomial posteriors; Thompson sampling selected which theories the LLM was allowed to test. ~500 lines (`src/lib/theory-selection.ts`).
- **Suppressed questions.** The LLM generated, for every entry, the question it would ask tomorrow if it could — designed to disambiguate between the three frames. Persisted, surfaced into question generation, never shown to the user.
- **Multi-model audit.** Every weekly reflection ran twice — Opus generated the primary reflection with mandatory self-correction; Sonnet then audited Opus's output for confirmation bias and over-confidence. The audit became context for all future reflections.
- **Knowledge-transforming detection** as a load-bearing system surface (the function survived but is now unused).
- **Question intervention intent tagging.** Six categorical intents — suppressed-question promotion, theme targeting, contrarian break, frame disambiguation, trajectory probe, depth test. Each generated question carried one. Designed to be the independent variable in a single-case experiment.

I archived all the data under `zz_archive_*_20260416` tables — predictions, theories, observations, suppressed questions, candidates, the supporting enums. Nothing was dropped. The methodology paper might want it.

What remains: the deterministic signal pipeline (~100 signals across keystroke dynamics, linguistic densities, calibration deltas), the parallel behavioral 7D and semantic 11D state engines with their PersDyn dynamics and coupling discovery, calibration content extraction, RAG with contrarian retrieval, question generation, weekly structured receipts (no LLM), and a designer-facing observatory.

The ratio of what I kept to what I deleted is roughly 4:1 by line count. The ratio of what I kept to what I deleted in terms of *visible work* is approximately the inverse.

## The argument against the deleted layer

The case for deletion is not that the deleted machinery was poorly built. It was the most carefully built part of the system. The case for deletion is that it could not, structurally, do what I had designed it to do.

### Three loops, only one anchor

Single-case experimental design (Barlow & Hersen 1984; Kazdin 2011) has an honest answer to the small-N problem: the within-subject is its own control, and reversal designs (ABA, ABAB) substitute for between-subject variance. The framework is sound, but it depends on a clean separation: the *experimenter*, the *subject*, and the *intervention* are distinct entities. The experimenter assigns the intervention. The subject responds. The instrument measures.

In Alice that separation collapsed at three points:

1. **Designer = subject.** I was both the person being measured and the person who built the measurement instrument. Anything the system surfaced that confirmed a theory I held could be, in principle, an artifact of the system having been built by someone with that theory. The theories the system tested were the theories the system's designer found interesting.

2. **Designer = stimulus source.** The questions Alice asks (the "interventions" in SCED terms) come from a pool I curated (the seed phase) or from a generator I prompted (the generated phase). I cannot test whether question X produces behavioral pattern Y when I am the one deciding which Xs the system is allowed to ask.

3. **Designer = grading rubric author.** Even with deterministic code-grading of structured criteria — the part I was most proud of, the part that supposedly broke the LLM self-evaluation circularity — *I wrote the criteria language*. I defined what counted as a confirmation. A prediction that says "next time this topic comes up, `session.commitmentRatio` will fall below the 30th percentile" is graded by code, not by an LLM. But the choice that the 30th percentile is the right threshold, and that commitment ratio is the right signal, and that "this topic" is the right grouping variable — those are author-encoded choices that the grading process cannot reach.

The deterministic-grading work (Shumailov et al. 2024 on model collapse from self-consuming loops; Panickssery & Bowman 2024 on LLM self-preference bias) addressed loop 3 only at the LLM grading layer. It did not address — could not address — that I had written the grading layer.

A Bayesian posterior over a non-falsifiable premise is calibrated only in the trivial sense. The numbers are coherent given the assumption set. The assumption set is unreachable from inside the system.

### What the prediction track record was actually measuring

After several months of running, I had a prediction track record with non-trivial posteriors on several theories. Some theories had high confidence (BF > 10, established). Others had been retired (BF < 1/10 after multiple disconfirming predictions). The system was confidently sorting its own hypotheses into established and retired bins.

When I looked closely at what the established theories had in common, the answer was: they were the theories whose *signals were measurable in the way I had set up the measurement to measure them*. Theories about, say, late-session revision being a marker of substantive rethinking became established because revision-timing was a high-quality signal in my pipeline. Theories about, say, vocabulary expansion being a marker of cognitive engagement remained inconclusive because MATTR is a noisier signal at small N.

This is not the same as "true theories rose, false theories fell." It's "well-instrumented theories converged faster, regardless of truth." The prediction engine was doing instrument validation in disguise.

I could have lived with this if I'd named it that way. Instead, the system was producing posteriors that *looked like* validated insights about the writer (me), and surfacing them to the question generator as though they were. The question generator was conditioning tomorrow's question on theory confidence scores that were measurements of measurement quality, not measurements of the writer.

The architectural problem was not the math. The math was correct. The architectural problem was that the math was operating on a category error and producing outputs in the language of resolved truth.

### The GPT-N filter

There is a separate, prior question I should have asked earlier and didn't: what part of this system survives a future frontier model with access to the same chat transcript?

A future Claude N reading the conversation transcript can:

- Apply three-frame analysis to any signal verbalization. The interpretive work is straightforward language manipulation.
- Generate suppressed questions designed to disambiguate competing readings of a journal entry. This is also language manipulation.
- Synthesize weekly reflections with mandatory self-correction sections. Most LLMs will do this on request.
- Audit another LLM's output for confirmation bias. Sonnet does this acceptably; future models will do it better.

What a future Claude N reading the same transcript *cannot* do:

- Read the keystroke timing distribution of the original session. The pauses that didn't get typed, the deletions that did, the inter-key intervals — none of that is in the transcript.
- Compute the parallel behavioral and semantic state vectors. The substrate isn't in the words.
- See the calibration delta between today's reflective writing and today's neutral free-write. The within-day baseline isn't reconstructable from final text alone.
- Detect the burst trajectory shape, the deletion-density curve, the inter-burst rhythm. Process structure isn't visible in product structure.

In other words: every layer of Alice that produced *narrative* about the writer was, in principle, reproducible by any sufficiently capable model with the same transcript. Every layer that captured the *substrate* — the keystroke pipeline, the calibration delta, the dynamics over orthogonal behavioral and semantic spaces — required Alice's actual measurement infrastructure.

The deleted layer was the layer that produced narrative. The surviving layer is the layer that captures substrate.

I am not making the claim that narrative interpretation is worthless. I am making a more specific claim: in a system whose *one moat is the substrate*, investing engineering depth in the layer that any future model can reproduce is committing the system to be commodity-replaceable on every model release. The substrate is the work because it's the thing only this instrument can produce.

### Three-frame analysis was decorated confirmation

This is the part that's harder to talk about because it implicates aesthetic preferences I had about the system, not just architecture.

Three-frame analysis was supposed to prevent narrative collapse — the LLM couldn't settle on a single interpretation because it had to apply three explicitly-opposed lenses and synthesize. The output looked rigorous because it had structure: Frame A (charitable), Frame B (avoidance), Frame C (mundane), each with confidence levels, a synthesis, and a calibration-anchored conclusion.

In practice, after enough sessions, the synthesis section consistently arrived at the most psychologically interesting reading. Frames A and C functioned as ritual — they were generated because the system required three frames, but they were not allowed to win. The interesting reading won because the synthesis prompt asked the LLM to identify which frame the data supported, and "the data supported the more interesting interpretation" is precisely the bias the framework was supposed to prevent.

The structural form of the interpretation looked epistemically careful. The actual function was decorated confirmation. The frames were a way of *appearing* to consider alternatives while reliably arriving at the predetermined-feeling answer.

The weekly multi-model audit (Sonnet auditing Opus) was designed to catch exactly this. In practice, the audit tended to identify minor issues (overconfidence on a single observation, missed context on one signal) while failing to flag the structural pattern (decorated confirmation across the entire reflection). I think Sonnet was capable of noticing the structural pattern but was not prompted to do so — and I, as the prompt author, had not framed the problem to Sonnet in a way that would surface what I most needed surfaced. Loop 1 again.

## What replaced it

What replaced the deleted machinery is, deliberately, less.

The architecture is now: capture deterministic signals, compute orthogonal behavioral and semantic state vectors with their dynamics and couplings, generate tomorrow's question from a bounded RAG context, persist a structured receipt of recent sessions with no narrative interpretation, render a designer-facing visualization that the user never sees.

The interpretive layer is intentionally absent. The user gets one question per day, writes, hits submit, sees a done message. No interpretation comes back. The black box is sacred — has always been sacred per the design — but now nothing inside the box is producing prose about the writer for downstream consumption either. The black box is not just opaque to the user; it has become opaque to the system itself in a particular way: the system measures, the system retrieves, the system juxtaposes (eventually, when joint embedding lands), but the system does not narrate.

The next planned feature — rhyme retrieval, scheduled for the weeks after this restructure — illustrates what the new architecture treats as an honest interpretive surface. When a session is submitted, the system finds the past session whose joint behavioral-semantic signature is closest, surfaces a single line ("this rhymes with [date]"), and offers a side-by-side view of both responses if tapped. The user reads both. The user is the only entity allowed to interpret. The system juxtaposes; it does not say what either session means.

This is closer to how a good archivist works than to how a therapist works. The archivist surfaces structurally-related artifacts. The interpretation is the patron's job.

## What I notice now that I didn't notice before

Three things that, if I'd noticed them earlier, would have prevented some of the work.

**The work that produces the most code is not the work that produces the most insight.** The deleted layers were 1,830 lines. The substrate they sat on top of — the actual signal pipeline — was, line for line, less code and more durable. Engineering effort flows toward where the structure is unfamiliar; the unfamiliar parts of the system at any given time consume disproportionate attention. But "consumed disproportionate attention" and "produced disproportionate value" are not the same axis. I should have noticed earlier that the parts of the system I was most excited to be building were the parts that, on the GPT-N filter, survived weakest.

**Epistemic seriousness can be performed.** The three-frame structure looked epistemically careful because it had explicit named alternatives, confidence ratings, and a synthesis that referenced the frames. The form of careful reasoning is not careful reasoning. I had built a structure that *pattern-matched* to careful reasoning while doing something operationally indistinguishable from confident interpretation with extra steps. Sometimes the carefulness of a system is in the things it refuses to claim; the things it does claim, it claims plainly.

**Deletion is a research finding, not a defeat.** I expect to be slightly embarrassed by how much I built before deleting it. I should not be. The thing I now know — that interpretive overlays on N=1 self-built data manufacture confidence that the underlying epistemics cannot support — is something I would not have known without having built the overlay and watched it produce its outputs. The methodology paper that this whole project is moving toward will be stronger for the comparison: *here is what the inference-based interpretive layer produced; here is what the retrieval-based layer produced; here is the difference in what each can defend.* The deleted code is preserved as a tagged release for exactly this comparison.

## What I would tell someone building a similar instrument

Three things, in order.

**Anchor the moat before the narrative.** If your instrument is going to compete with frontier models in a few years, the part that makes the instrument irreplaceable has to be the part frontier models cannot reproduce from public-facing data. For Alice that's keystroke substrate, calibration baselines, and within-subject dynamics. For other instruments it might be sensor data, video, biomarker capture, longitudinal physical environment measurement. Whatever it is, the analytical depth should sit on top of the substrate, not parallel to it. Anything that reads from the chat transcript alone is, at best, a polish layer.

**Predict-and-grade is not a free pass to escape circularity.** The fact that you can grade predictions deterministically does not break the circularity if you also wrote the predictions and the grading rules. The Bayesian update is correct; the premise it operates on is unreachable. If you cannot specify, in advance and from outside the system, what counts as a falsification, you do not have a falsifiable system. You have a coherence test wearing the costume of a falsification test.

**The thing the system refuses to do is part of the system's design.** Alice never surfaces response text back to the user. Never surfaces signal values or trait floats. Never reveals tomorrow's question. These constraints are not aesthetic preferences; they are load-bearing. Each one was, at some point, a temptation to violate ("but the user has a right to their own data, and a dashboard would show engagement, and revealing tomorrow's question would help retention"). The temptation was always real and the principle was right to hold against it. The deleted machinery violated, in spirit if not in letter, principles that the rest of the system held to: it produced narrative the user wasn't allowed to see, but the system could see, and the system fed it back into itself. The black box was sacred for the user. It was not sacred for the system. That asymmetry was the problem.

---

*Drafted shortly after the restructure shipped. Not published. The new architecture has to prove itself first; if it does, this becomes a methodology paper section. If it doesn't, this becomes evidence of a failure to learn from a failure to learn — which is its own document, but a different one.*
