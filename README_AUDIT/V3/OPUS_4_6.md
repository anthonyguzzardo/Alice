> **Note:** This document predates the renames: Marrow → Alice, Bob → Alice Negative, Einstein → Bob (2026-04-12).

I've read through the Marrow design document carefully. To be clear about what I'm looking at: this is a detailed product/system design spec, not a completed experiment with results. There's no data to analyze yet — no participants, no collected responses, no outcomes to evaluate.

So let me treat this as what it is: a pre-implementation design review, focused on whether the system as described would produce valid, meaningful insights about its users.

Here's my honest assessment.

**What's genuinely strong:**

The three-frame interpretation model is the best idea in the document. Forcing the system to generate charitable, avoidance, and mundane readings of every signal is a real safeguard against the most common failure mode of behavioral analysis — collapsing ambiguous data into a single narrative. The requirement that the suppressed question must disambiguate rather than probe the most dramatic interpretation shows real methodological discipline.

Context-matched calibration is also well thought through. Recognizing that a pause on a phone at midnight means something different than a pause on a laptop in the morning is the kind of thing most behavioral tracking systems ignore entirely.

The multi-model audit is a reasonable additional check, and the requirement that weekly reflections must identify at least one error is a good forcing function.

**Where I'd push back:**

The behavioral signal layer makes strong implicit assumptions that haven't been validated. Keystroke dynamics, deletion patterns, and pause topology are being treated as psychologically meaningful signals, but the document doesn't cite any evidence that they are — particularly at the individual level, in a journaling context, with the granularity described. There's research on keystroke dynamics for authentication and some work on typing patterns and emotion, but the leap from "detectable signal exists in lab conditions" to "we can infer avoidance vs. contemplation from a single user's editing behavior" is enormous. The three-frame model mitigates over-interpretation, but it can't fix a fundamentally noisy input.

The commitment ratio is a good example. The document acknowledges that heavy editing "could mean avoidance, or it could mean careful writing," but then builds an entire interpretive infrastructure around resolving that ambiguity. What if it's genuinely unresolvable from behavioral data alone? The system might be building confidence over time in distinctions that don't reliably exist in the signal.

The calibration design has a cold-start problem the document somewhat acknowledges but underestimates. Neutral prompts like "describe what you did this morning" don't just measure baseline typing behavior — they measure baseline typing behavior *on low-stakes content*. The whole premise of Marrow is that deep questions create friction. Using frictionless prompts as a baseline means any deviation could reflect the presence of friction itself (which is the intended design) rather than anything psychologically specific about the user's relationship to the question. You're measuring the effect of the intervention and calling it a signal about the person.

The "black box" design — you never see your responses again — is presented as a philosophical choice, but it also makes the system unauditable by the person it's analyzing. The AI builds a model of you that you can never inspect, correct, or challenge. The multi-model audit checks for internal consistency, but no amount of model-reviewing-model can substitute for the subject saying "no, I deleted that sentence because my cat jumped on my keyboard." This is a significant epistemic limitation disguised as a feature.

The Day 3 walkthrough actually illustrates the problem well. The system flags a deletion from "I think I need to leave my job" to "There's a career thing I haven't figured out yet" as a potentially meaningful signal. But it has no way to distinguish this from dozens of mundane explanations: the user realized they don't actually want to leave their job and overcorrected, they worried about data security, they thought the first draft sounded whiny, etc. The three frames help, but "Frame C: Mundane" is doing a lot of heavy lifting across a vast space of possible explanations.

**The deeper question:**

The system is designed to build a longitudinal psychological model of a single user from text and typing behavior, using AI interpretation with structured self-correction. The design is thoughtful about error correction *within its own framework*. But it doesn't address whether the framework itself — inferring psychological states from keystroke dynamics and editing patterns in a journaling app — has been validated against any external ground truth. The error correction mechanisms catch the system contradicting itself. They don't catch the system being consistently wrong in the same direction.

What would strengthen this: some mechanism for periodic ground-truth validation. Even something as simple as occasionally showing the user a anonymized, abstracted version of the system's read ("the system noticed you tend to edit more on questions about relationships — does that resonate?") would introduce an external check that the entire interpretive layer currently lacks.