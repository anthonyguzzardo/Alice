# Observatory Narration Rules

**Date:** 2026-04-16
**Context:** The April 16 architectural pivot removed the LLM interpretive layer. The Observatory's
plain-English synthesis replaced it with deterministic signal translation. This document codifies what
that layer is and is not allowed to say, so the constraint survives the next person touching the code.

---

## The Spectrum

1. `fluency z = -1.32 on latest entry` — pure signal, designer-only vocabulary.
2. `Writing flow has been declining for 3 straight sessions` — deterministic trend fact, translated vocabulary. Describes the signal, not the writer.
3. `Your writing is getting harder` — describes the writer's experience. Inferred, not measured.
4. `You seem blocked lately` — affective attribution. Pure narration.
5. `You're avoiding something` — causal attribution about intent. The interpretive layer we removed.

**The Observatory lives at line 2. Line 3 is prohibited.**

---

## Permitted

- Monotonic trend reports: "X has been climbing/declining for N sessions"
- Coupling descriptions: "X tends to move with Y, r = 0.58"
- Deviation callouts on the latest entry: "X is 2.1σ above baseline"
- Metadata classifications: "deletion curve: early"
- Absence statements: "no couplings discovered yet — need ≥10 entries"
- Convergence reports: "multiple dimensions moved together"
- Intensity markers on extreme values: "this is rare"

## Prohibited

- **Affective labels:** anxious, blocked, avoiding, struggling, flowing, stressed, calm
- **Causal claims:** because, driven by, in response to, caused by, suggests
- **Experiential attribution:** feels harder, getting easier, finding it difficult
- **Prescriptive language:** try, consider, might want to, should
- **Second-person psychological framing:** you seem, you're becoming, you tend to be

## Why This Matters

The moat argument rests on the claim that Alice's substrate survives future models because the
substrate is the body, not the text. If the Observatory's English layer drifts into narration,
Alice has two substrates: a deterministic one (keystrokes, dynamics) and an interpretive one
(the overview copy). The interpretive one is commoditizable by any frontier model using Alice's
own deterministic outputs as input — the exact self-consuming loop the architectural pivot was
designed to prevent.

Keeping the plain-English layer on line 2 and not line 3 is what makes the moat argument hold.

## Enforcement

The translation dictionary lives in `src/lib/observatory-vocabulary.ts`. All Observatory
prose generation must use that dictionary. Direct string construction of trend/insight copy
outside the dictionary is a code smell.

The vocabulary file includes a `BANNED_WORDS` list. A future CI check can grep synthesis
output against it.

## N-Threshold Rule

Trend language (arcs) requires a minimum of **8 entries** before emitting. Below that threshold,
the synthesis API returns an explicit low-N notice instead of trend sentences. At N=4, a
"3 straight sessions" trend is 75% of the dataset — that's not a trend, it's the dataset.

Deviation callouts ("right now" insights) require a minimum of **5 entries** to have a
meaningful baseline. Below that, deviations are suppressed with a low-N notice.
