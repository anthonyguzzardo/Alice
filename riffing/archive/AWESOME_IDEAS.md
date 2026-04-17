Alright, unleashed mode. I'm going to throw a lot at you and some of it will be bad. Filter on your end. I'll organize roughly by how crazy it is.

## Features that are basically free given what you've built

**The archive is already a search engine; expose it as one.** You're building rhyme retrieval as Bob's one-liner. The same machinery — joint embedding, distance function — lets you query your archive by anything. "Find sessions that felt like this" is one query. "Find sessions where my body was calm but my content was spiraling" is another. You don't need an LLM for any of it; you need a query surface. This is a week of work and it's a real research tool for *you* before it's a feature for anyone else. You become the first user of Alice-as-archive before shipping it to labs.

**Calibration-content as a separate data stream.** You're already having people write neutral calibration text before each session. That's a free corpus of everyday mundane prose from the same person, collected daily for years. Nobody has this. It's useless for the health use case directly — that's why it exists, as the neutral reference frame — but it's an untapped longitudinal linguistic dataset. Weather, breakfast, commute, etc. At N=90+ you could do your own idea density trajectory analysis *on calibration text only*, which controls for content effects in ways Nun Study can't. Nun Study compared people; calibration-stream compares you-today to you-last-year on structurally similar mundane content.

**Time-of-day signature as a dimension.** You capture hour of day. People have circadian cognitive variance. After N=60 you'd see your own curve — when your burst consolidation peaks, when your revision rate spikes. This is either a personal insight ("don't write at 11pm, you revise too much and commit too little") or a research finding ("joint signature has circadian structure that varies individually"). Free because you already have the data.

**Device-matched baselines as a portable identity signature.** You already have device-matched calibration baselines. This means Alice knows your typing fingerprint per device. Switch from laptop to phone mid-session and the calibration delta should reflect the modality shift, not a cognitive shift. If you implemented this cleanly, you'd have the first instrument that handles multi-device longitudinal data without confounding modality change for cognitive change. Constraint 1 satisfied in practice, not just architecture.

## Features that sound small but aren't

**Session "re-enter" mode.** After a session is closed, offer a read-only replay of your own writing at the original tempo. Not a video — a scrolling reveal that plays the keystroke timeline in real time. You watch yourself write. This is wildly uncomfortable and also diagnostic — you'll see your own pauses, your own deletions, your own hesitations. It's not surfacing signals; it's surfacing *behavior*. The user has a right to their own behavioral record. Researchers would pay for this alone — playback is how Inputlog users actually work, and you'd have web-native playback that Inputlog can't offer.

**Calibration variance as a health metric of its own.** If calibration is supposed to be stable ("write about the weather"), then *calibration stability* over time is itself a signal. Stable calibration means your neutral-writing baseline is anchored. Drifting calibration means something is changing underneath. A year from now you could look at your calibration-variance curve and see whether your neutral baseline was consistent. Cognitive decline studies would kill for this — most instruments can't distinguish "bad day" from "bad trajectory" because they don't have calibration.

**Intentional calibration ablation as self-experiment.** Let yourself write calibration after coffee vs before coffee. After sleep vs sleep-deprived. Before exercise vs after. Over 90 days you'd have within-subject A/B data on how specific interventions shift your baseline. This isn't a feature, it's a protocol — but the infrastructure to support it (tagged calibration sessions, post-hoc analysis of tagged deltas) is light. You become your own n=1 self-experiment platform. Some users will love this; others won't care. The ones who love it are the ones who'd pay for it.

## Features that are risky but would change the instrument

**Voice dictation as a parallel capture mode.** You cut it from the plan, but spoken composition has its own process signature (pauses, reformulations, false starts, revisions-via-restatement). Same cognitive substrate, different motor channel. If you capture both modalities from the same subject, the joint analysis extends to cross-modal disjunction detection. The writing process research community has barely touched this. Risk: adds scope. Reward: satisfies Constraint 1 in the strongest possible way and opens a second research market (speech/language pathology labs).

**Handwriting capture via Apple Pencil / Wacom tablet.** Same argument. Stylus pressure + velocity + lift time is a rich signal nobody has paired with linguistic content analysis longitudinally. Risk: hardware-dependent, narrows user base. Reward: the full multi-modal composition signature per user. This is what a Linus Health acquisition would want — they already have drawing process; they don't have written composition.

**Open the signal pipeline, close the interpretation.** Counterintuitive move: make Layer 1 open source eventually, keep Layers 2 and 3 proprietary. The signal capture becomes the de facto standard (like how Inputlog is free and standard in writing process research), and your moat is the analytical layer and the joint-signature framework. This is the Redis / Elasticsearch playbook — free core, paid intelligence. Risk: someone else could build your analytical layer on your open pipeline. Reward: academic adoption is 10x faster when the capture layer is free, and adoption drives everything downstream.

## Use cases I haven't heard you mention

**Writers' writers.** Professional writers — novelists, screenwriters, journalists — have a complicated relationship with their own process. They know some days they write badly and some days well and they can't tell which until after. Alice could tell them which days produced knowledge-transforming output (KT score) vs knowledge-telling (low KT). Not prescriptive — descriptive. Some novelists would find this fascinating. Some would hate it. It's a niche market, high willingness-to-pay, and it funds itself while you wait for clinical validation. Price: $200/year consumer subscription, marketed to people who already journal daily. Not the main path, but lucrative adjacent.

**ESL and writing pedagogy.** Learners whose process signatures change as they become fluent. A longitudinal record of how someone's writing process stabilizes as they cross the automaticity threshold in a new language. Universities would pay for this for their writing programs. DSCRIB is trying this without the longitudinal infrastructure or the content analysis. You'd be five years ahead structurally.

**Therapy augmentation.** Not therapy itself — augmentation. A client journals on Alice; the therapist gets structured weekly summaries (with client consent, HIPAA compliance) of the disjunction sessions. "Here are the three sessions this week where your client's behavioral and semantic signatures diverged." The therapist uses it as a prompt to explore what happened those days. This is different from a mental health monitoring tool because it's mediated by a human clinician. Payment path exists (therapy is reimbursable), regulatory path is cleaner (tool for therapist use, not direct-to-patient diagnostic), and the data stays in the therapeutic relationship. Risk: enters healthcare territory. Reward: reimbursable, defensible, emotionally motivated purchase.

**Cognitive trajectory gift for adult children of aging parents.** Dark mode use case: 50-year-old worries about mom's cognitive decline, gives mom Alice as "a journaling app to share memories with the grandkids." Mom writes daily. 50-year-old (with mom's consent) gets quarterly trajectory reports. This is the actual market for early cognitive decline detection — the ones paying attention are adult children, not the patients themselves. The framing has to be careful; the architecture is already there.

**Executive coaching.** Executives pay $20-50k/year for coaching. Part of what coaches do is help executives see their own patterns. Alice does that automatically once there's enough data. A coaching firm licenses Alice for their client cohort. The coach gets structured sessions derived from the data; the executive gets the retrieval surface. High-margin B2B play that funds the rest of the business.

## Research partnerships you haven't scoped

**Flanagan's group at UT Health San Antonio (Nun Study 30-year follow-up).** They have the strongest longitudinal evidence for idea density predicting decline. They're doing autopsy-confirmed analysis. Alice is the instrument that could prospectively measure idea density (and much more) across a living cohort. The contrast — autopsy-confirmed retrospective vs. instrument-based prospective — writes itself. Cold email opportunity: "You've shown what matters in text written decades before decline. I've built the instrument that could measure it in real time across a cohort starting now. Is this a conversation?"

**Giancardo at UTHealth (neuroQWERTY).** He built neuroQWERTY, company went dormant. He's presumably back in academia and may have opinions about why it didn't work commercially. Not a funding opportunity directly, but a methodology mentor who lived through the exact landscape you're entering. Coffee chat, not email.

**Boyd at UT Dallas (LIWC).** Active, accessible, runs the successor to Pennebaker's framework. LIWC-22 is the most-cited language-psychology tool in existence. Boyd has explicitly tried to extend LIWC with more modern features. Alice's semantic feature extraction could eventually *use* LIWC as a component — and Boyd might be receptive to a collaboration where Alice becomes the longitudinal deployment vehicle for LIWC-derived features. Everyone wins if it works.

## Data products that exist once you have enough corpus

**Individual cognitive fingerprint certification.** After N=180 sessions, Alice can issue a certified "cognitive signature report" — not diagnostic, not medical, just a structured description of your own writing process phenotype. Like a 23andMe for thinking. Willingness to pay is high because it's a distinctive artifact about *you*. Priced at $99 one-time. You already have everything needed to compute it.

**Cohort dataset licensing (with consent).** A handful of users who opt into anonymized data contribution becomes a cohort dataset. Research labs want this dataset. You license it. Clean consent architecture + opt-in model + direct IRB-friendly structure means you're the only source of longitudinal joint-signature data for research. This is years out but it's a real revenue line when it exists.

## Wild ideas I don't fully endorse but want on the page

**Writing as meditation substrate.** Meditation apps (Headspace, Calm) are a billion-dollar market. Alice-as-contemplative-practice is a reframe that works: the daily journal is a structured attention practice, the question is a koan, the black box is monastic discipline. This is not where the science lives but it's where the consumer adoption might live — people who'd never buy a cognitive assessment tool will buy a contemplative journal. Dangerous because it could dilute the clinical narrative. Interesting because it bypasses all of healthcare.

**Generative counterfactual: what would your past self have written today?** Using coupling structure and mode landscape, project a hypothetical session from you-at-year-1 writing today's question. Show it to current-you. The *difference* between projected-past-self and actual-current-self is a growth trajectory. Dangerously close to the reconstruction claim you stepped back from, but narrower: it's not "simulate you," it's "project how your past cognitive system would respond to this specific prompt given structural patterns." Could be fascinating or could be uncanny. I'd pilot this privately for years before shipping.

**Pair journaling — partners journal separately, system detects convergence and divergence in coupling structure.** Long-married couples: do their coupling graphs converge over time? Do they co-regulate their modes? This is relational cognitive science nobody has data for. It's also a consumer product: "journal with your partner for deeper understanding." Risk: couples therapy territory. Reward: a dataset nobody else has and a retention mechanism built on relational stakes.

**A single-slider interface for calibration session length.** Currently calibration is fixed-length. Let the user (or the study protocol) scale it. Short calibration is cheap and fast but noisy; long calibration is slow but precise. Different research contexts want different points on this curve. Configurable calibration length is a free product-surface addition and a research flexibility win.

**Alice as IDE plugin.** Developers type all day. Joint signature of someone writing code is different from writing prose but the architecture extends. You'd have the first cognitive-phenotyping tool for software engineering. Probably a bad idea (distracts from clinical narrative) but notable because the market is large and wealthy.

## Meta ideas about the project itself

**Write the architectural pivot up as a post-mortem.** What you just did — killing the V5 grader, cutting three-frame, replacing inference with retrieval — is a story about epistemic discipline in solo AI-tool building. Write it as a public post. *When I realized my instrument was grading itself against its own theories.* Does two things: (a) establishes your epistemic seriousness publicly, (b) is interesting writing that people will share. Don't ship it for months — let the architecture prove itself first — but start drafting.

**Keep the old system runnable as a reference implementation.** You archived the tables. Also archive the full stack as a tagged release. In a year you could run the old and new analysis on the same session and see how the interpretations differ. This is its own methodology contribution: *A comparison of inference-based and retrieval-based interpretation in a longitudinal writing process instrument.* Requires zero extra data collection.

**Get one other person to do calibration + journal for 30 days as a sanity check.** Not a user study. A friend. You need to know whether the system breaks when the user isn't you. Everything you've built is against your own typing patterns, vocabulary, device profile. A second person, even briefly, would surface bugs and assumptions that N=1 can't. Low cost, high information.

---

That's probably too many ideas but you said to play. A few of them are bad. A couple are probably great. The ones I'd actually prioritize thinking about:

- calibration-content as an independent data stream
- the playback feature (because researchers would pay for it alone)
- the Nun Study / Flanagan group cold email
- the one-other-person sanity check, as soon as possible
- the therapy augmentation use case, because the payment path is real and the regulatory path is cleaner than direct clinical

The rest are further out or genuinely speculative. But you've got a thing with more surface area than you've been exploring, and the surface is where the interesting doors are.