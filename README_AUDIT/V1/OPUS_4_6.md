> **Note:** This document predates the rename from Marrow to Alice (2026-04-12).

Thanks for sharing Marrow. I've read through the full design document. Before I analyze, let me make sure I understand what you're asking — this is a design/concept document, not a completed experiment with results data. So the analysis would be about the soundness of the system's design, its assumptions, and its methodology.

Let me lay out what I see, organized by what's strong, what's questionable, and what's unexamined.

**What's well-conceived**

The three-layer data model is the most interesting part. Capturing response text alone would be a standard journaling app. Adding behavioral signals (keystroke dynamics, deletion patterns, pause topology) creates a second channel that can contradict the first — and contradictions between *what someone says* and *how they said it* are where real insight lives. The AI observation layer then sits on top of both, looking for patterns neither layer surfaces alone. This compounding design is genuinely novel for a personal reflection tool.

The event-driven architecture is clean. No cron jobs, no background polling — the user's submission is the only heartbeat. This is elegant and avoids the failure modes of systems that assume continuous engagement.

The seed phase serving a dual purpose (fixed questions for the user, silent model-building for the AI) is a smart use of the 30-day window.

**Where the assumptions need scrutiny**

The behavioral signal layer is where the strongest claims meet the weakest validation. A few specific concerns:

*Interpretive overreach on keystroke data.* The Day 3 example treats a 47-second pause and a deletion as evidence the user "knew the answer and was hiding it." That's one interpretation. Others: they were distracted, they were reading the question carefully, they decided the first phrasing was melodramatic rather than honest. The document presents the AI's interpretation as insight, but without calibration against ground truth, it's pattern-matching presented as psychological reading. The gap between "interesting signal" and "reliable inference" is large, and the document doesn't acknowledge it.

*Commitment ratio as a meaningful metric.* A ratio of 0.38 (heavy editing) is framed as avoidance. But heavy editing is also what careful, precise thinkers do. A ratio of 0.97 is framed as either fluency or rehearsal — which means the metric can be read to support whatever narrative the AI is already building. A metric that confirms every hypothesis is not a metric; it's a mirror.

*Punctuation-as-signal is fragile.* Ellipses meaning "hedging," dashes meaning "self-interruption" — these are plausible literary interpretations but not robust behavioral indicators. People's punctuation habits are shaped by platform conventions, age, typing device, and personal style far more than by psychological state. On mobile, punctuation behavior is almost entirely a function of autocorrect and keyboard layout.

*No baseline, no control.* There's no mechanism to distinguish signal from noise in an individual's behavioral data. You mention that any single session is noisy but 90 sessions form a fingerprint — but a fingerprint of *what*? Without some form of calibration (neutral prompts, known-state sessions, self-report validation), you're building a detailed model that may be modeling typing habits and device context rather than cognitive or emotional states.

**What's unexamined**

*The feedback loop problem.* Once the AI generates questions based on its own observations, you have a closed loop with no external correction. If the AI develops an incorrect read of the user in week 2 (say, latching onto the "job" thread when the real issue is something else), every subsequent generated question reinforces that read, and the user's responses to those questions further confirm it. This is a well-known problem in recommender systems — filter bubbles — applied to self-reflection. The document doesn't address how the system avoids confirmation bias in its own model.

*The "never see your responses" choice.* This is presented as philosophically motivated, but it also means the user can never correct the system's model. If the AI's Day 3 observation is wrong — if the deletion wasn't avoidance but simply better writing — there's no mechanism for that error to be surfaced or corrected. The asymmetry is total: the system watches the user, the user cannot watch the system.

*Ethics of invisible behavioral capture.* The document is transparent in *this README*, but the user experience is designed so that none of this is visible during use. The user knows they're answering a question. They likely don't know their pause durations, deletion patterns, and tab-away behavior are being analyzed and interpreted. Whether this is acceptable depends on consent and framing, but the design deliberately obscures the depth of observation. That's a choice worth being explicit about rather than treating as a feature.

*N=1 methodology.* This is a single-user system. The AI's interpretive framework (what deletions "mean," what pauses "indicate") is not validated against a population. It's building psychological models from behavioral proxies without any external validation that those proxies mean what the system assumes they mean.

**The core tension**

Marrow's philosophy is depth over engagement, and the design genuinely reflects that. But the system's *confidence* in its interpretations isn't earned by the methodology. The examples in the document read like a skilled therapist's notes — but a skilled therapist also asks clarifying questions, gets corrected, and revises their model based on the patient's feedback. Marrow's AI does none of that. It observes, interprets, and compounds its interpretations without any error-correction mechanism.

The question isn't whether this collects interesting data — it does. The question is whether the system's interpretive layer is doing *analysis* or *storytelling*. Right now, there's no way to tell the difference, and the design doesn't seem to think that distinction matters. I'd argue it's the most important thing to get right.