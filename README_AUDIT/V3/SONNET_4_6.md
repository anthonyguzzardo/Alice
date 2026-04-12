> **Note:** This document predates the rename from Marrow to Alice (2026-04-12).

## Analysis of Marrow

I'll work through this systematically — design logic, methodological strengths, genuine weaknesses, and unresolved tensions.

---

### What the System Gets Right

**The three-frame structure is the strongest design decision.** Forcing the AI to apply Charitable, Avoidance, and Mundane interpretations simultaneously before collapsing to a conclusion is a real safeguard against the most obvious failure mode of behavioral inference systems: confirmation bias dressed as pattern recognition. Most systems like this pick a narrative and fit data to it. This one is explicitly designed to resist that.

**Context-matched calibration is methodologically sound.** The insight that a 47-second pause on a phone at midnight is not the same signal as 47 seconds on a laptop at 9am is correct and important. Many behavioral inference systems ignore this entirely. Tying confidence levels to calibration availability rather than pretending the signal is clean is honest architecture.

**The multi-model audit is genuine, not theatrical.** Using Sonnet to audit Opus's weekly reflections — rather than having the same model "self-correct" — provides actual independence. The example audit shown (Sonnet pushing back on "moderate confidence" and arguing for "low confidence") is exactly what this mechanism should do. That specific example is good calibration for what a real audit looks like.

**Event-driven heartbeat is philosophically consistent.** No cron jobs, no scheduled nudges. The system only runs when the user engages. This is the design philosophy made structural.

---

### Real Weaknesses

**The suppressed question mechanism has a subtle flaw.** The stated goal is to generate questions that *disambiguate* Frame A from Frame B, not questions that presuppose one. The example given is good. But the system generates these questions and then *holds them* — they feed into Phase 2 question generation after Day 30. There's no described mechanism for preventing a suppressed question queue that skews heavily toward avoidance-hypothesis questions even if each individual question is neutrally framed. Thirty days of "disambiguation" questions aimed at the same behavioral thread is still a directed probe, regardless of individual question neutrality.

**The "Did it land?" feedback is underspecified.** A "no" is treated as clear signal that the line of questioning missed. But "didn't land" could mean: the question was boring, the question was too painful, the question was about something already resolved, or the question was simply poorly worded. These have opposite implications for question generation. The system treats it as one bit of signal, but it's actually ambiguous signal. This is acknowledged partially ("a 'yes' is weaker signal") but the same ambiguity exists for "no" and isn't addressed.

**The commitment ratio has an unacknowledged confound.** The system distinguishes single-character deletions (noise) from large deletions (potentially meaningful). But the commitment ratio is calculated as final characters / total characters typed. Heavy use of cut-paste, restructuring, or even autocorrect correction on mobile will deflate this ratio without carrying the psychological meaning the system attributes to it. The system notes autocorrect as a confound for punctuation but doesn't apply that same caution to commitment ratio on mobile specifically.

**The black box is asymmetric in an unexamined way.** The user never sees their responses again. The system always has access to everything. This is presented as a design feature — preventing gaming, creating depth. But it also means the user has no ability to contest the AI's model of them. The weekly self-correction is the AI correcting itself about the user, not the user correcting the AI about themselves. That's a significant epistemic asymmetry that the document treats as neutral.

**"If it cannot identify at least one error, it's not being honest" is not a mechanism, it's an instruction.** Telling the model it must find an error doesn't guarantee it will find *real* errors. It may generate plausible-sounding minor corrections to satisfy the requirement while protecting larger narratives — the document's own Sonnet audit example describes exactly this happening. The audit layer catches it in that case, but the framing suggests the self-correction requirement itself is a safeguard when it's actually just a prompt.

---

### The Central Unresolved Tension

The system is built on the premise that behavioral signals contain psychological signal worth extracting. The three-frame structure and calibration system are designed to handle the noise problem — the fact that most behavioral signals are ambiguous.

But the document consistently shows the system arriving at INSUFFICIENT DATA or LOW confidence conclusions, especially early on. The Day 3 example ends at INSUFFICIENT DATA. The Day 11 example ends at LOW confidence due to device mismatch. The weekly audit pushes "moderate" down to "low."

This raises a question the document doesn't answer: **what does the system do with 30 days of mostly low-confidence observations when it generates Day 31's question?** Does it weight by confidence? Does it treat uncertain observations as noise? Does it flag to the user that the behavioral model is weak? The architecture describes what gets *collected* but not how uncertainty propagates into question generation.

If uncertain observations are treated the same as confident ones in the generation prompt, the three-frame structure and calibration work — but their outputs get discarded at the decision point that matters most.

---

### Summary Judgment

The methodological thinking here is noticeably more rigorous than most behavioral inference systems. The failure modes it's designed to prevent (confirmation bias, decontextualized signals, single-model drift) are real and the mechanisms to prevent them are real. The weakest links are: suppressed question accumulation bias, the ambiguity of "did it land?" feedback, and — most importantly — the unspecified handling of uncertainty in Phase 2 question generation. That last one is where the rigor of the observation layer could either be honored or quietly discarded.