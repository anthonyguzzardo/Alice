> **Note:** This document predates the rename from Marrow to Alice (2026-04-12).

Better. Materially better.

The biggest improvement is that you fixed one of the strongest structural weaknesses from the earlier version: **unbounded narrative accumulation**. The bounded context window, explicit source-of-truth hierarchy, and retrieval of resonant older entries instead of dumping the whole archive into every prompt makes the system more defensible. 

My revised read:

**Marrow is now a stronger memory-and-question-generation system than an interpretation system.**
That is progress, because memory and question selection are the parts most likely to work.

## What got better

### 1. You reduced narrative lock-in

Before, the design leaned toward “the full accumulated context” every day, which almost guarantees story accretion. Now you have:

* last 14 entries verbatim
* semantically resonant older entries
* reflections marked as hypothesis, not fact
* raw entries winning on contradiction

That is a real upgrade. It makes the system less likely to turn one early misread into permanent canon. 

### 2. You separated memory from interpretation more clearly

This line is doing a lot of good work:

> reflections … explicitly marked as hypothesis, not fact. If a reflection contradicts a raw entry, the entry wins. 

That is one of the most epistemically responsible choices in the design. It creates a hierarchy:

* raw user text
* behavioral summary
* model hypotheses

That order is right.

### 3. You made scale more believable

The earlier version implied that deeper history would just keep accumulating into the live prompt. This version solves that with embeddings and fixed prompt scale. That makes the architecture more technically credible and less likely to degrade into mush over time. 

### 4. The reflection “compression window” is smart

Weekly reflections processing recent material plus selectively retrieved older entries is much more defensible than pretending every weekly reflection should reason over everything. It also makes the audit process more meaningful, because the models are reviewing a bounded slice rather than an ever-growing mythos. 

### 5. Graceful degradation is a good sign

“Fall back to recency-only retrieval if embeddings fail” shows healthier system thinking. It means the product can fail soft without pretending the reasoning quality is unchanged. 

## What is still weak

### 1. The core validity problem is still there

The big issue did not change:

You still want to infer things like hesitation, avoidance, honesty, deflection, or resistance from weak behavioral proxies like pauses, deletions, velocity, and tab-away patterns. 

You have become more careful about memory management, but **careful memory management does not make the underlying psychological inference much more valid**.

This version is better at remembering.
It is not much better at knowing what the remembered signals actually mean.

### 2. “Genuine independence” is still overstated

You still say:

> Two different models reviewing each other's work is genuine independence. 

That is too strong.

It is better described as:
**partially independent critique with correlated assumptions**.

Same data, same framing, same task design, same ontology. Useful, yes. Genuine independence, no.

### 3. Semantic retrieval can preserve relevance but also amplify theme bias

Retrieval solves context bloat, but it introduces a new risk: **theme reinforcement**.

If the system semantically retrieves older entries that “resonate” with the present, then the retrieval layer itself may keep surfacing the same motif:

* career uncertainty
* guilt
* belonging
* control
* etc.

That can make a theme look stable partly because the retrieval system keeps bringing back material that fits it.

So retrieval reduces chronological lock-in but can increase **semantic lock-in** unless you deliberately counterweight it.

### 4. Reflections are still likely to become privileged, even if labeled hypothesis

You explicitly say reflections are hypothesis, not fact. Good. 

But in practice, once reflections enter future prompt context, they gain leverage. Models are highly influenced by prior summaries even when told those summaries are tentative. So the system may still drift toward:

* reading new entries through prior reflections
* treating old hypotheses as organizing structure
* asking questions that orbit prior interpretations

The rule “raw entry wins on contradiction” helps, but many cases will not be clean contradictions. They will be ambiguous. That is where summaries quietly dominate.

### 5. Free-write calibration is still only a partial baseline

Nothing in this revision changes the fact that calibration prompts are low-stakes descriptive writing, while daily prompts are higher-stakes introspection. 

So the baseline is still useful mostly for:

* device friction
* timing rhythm
* editing style under neutral load

Less useful for:

* vulnerability cost
* self-protective revision
* introspective search difficulty

That distinction still matters a lot.

## What I would now say the system is best at

This version is best understood as a system for:

**maintaining a disciplined long-term memory of self-reflection and using that memory to generate sharper, more contextually relevant questions.**

That is a good and credible claim.

It is still weaker as a system for:

**silently detecting what the user is psychologically avoiding.**

That claim remains too ambitious relative to the evidence layer.

## The single most important remaining risk

The retrieval layer plus reflection layer can create a subtler version of the original problem:

Not “everything is in context all the time,” but
“the system keeps retrieving what already seems important.”

That can produce a clean, elegant, self-reinforcing storyline.

Cleaner than before. Still dangerous.

## What I would change next

The next upgrades should not be more architecture polish. They should be anti-overreach controls.

I would add:

* **retrieval diversity rules** so not all recalled entries cluster around one theme
* **contradictory retrieval** that deliberately fetches entries that weaken the current dominant narrative
* **reflection expiration or decay**, so old hypotheses lose influence unless re-supported by raw entries
* **construct narrowing**, where the system talks internally about specificity, revision intensity, disclosure comfort, and topic resonance rather than honesty/avoidance unless evidence is unusually strong
* **ground-truth probes** that occasionally test interpretations more directly

## Final verdict

This version is **more credible than the last one**.

Not because it solved the deepest inference problem, but because it became more disciplined about memory, prompt size, and the difference between raw data and model-made stories. 

So my updated judgment is:

**As a longitudinal question engine: strong.**
**As a behavioral inference engine: still overclaiming.**
**As a system design: improved in the right direction.**

The shortest honest summary is:

**You fixed a real architecture flaw. You have not yet fixed the epistemology.**