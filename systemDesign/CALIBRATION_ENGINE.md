# Task: Write a system design specification for the calibration channel pipelines

## Context
The Alice instrument captures two session types: journal (reflective, question-driven writing) and calibration (prompted neutral writing). Journal sessions have a full processing pipeline: per-session signals, embeddings, personal profile, semantic baselines and trajectory, cross-session signals, session integrity, and reconstruction residuals. Calibration sessions have per-session signals and participate in the daily delta against paired-day journal sessions, and nothing else.

This asymmetry is not a bug — nothing was removed in the recent decontamination pass. It is a pre-existing architectural gap. The calibration channel was designed conceptually (as a within-person second measurement channel) but only partially implemented (daily delta only). The papers describe it as more than it currently is.

The goal of this task is to write a **system design specification** for the calibration-channel pipelines so that the build work can be executed later without re-deriving the design. The spec is the deliverable. No code is written.

## What to produce

A single markdown document at `docs/calibration-channel-spec.md` covering the following sections. The document should be self-contained — a future reader (or future Claude context) should be able to implement the pipelines from this spec alone without needing today's conversation.

### 1. Channel purpose and separation
- State the calibration channel's role in the instrument: what it measures, why it exists, how it differs from the journal channel.
- Enumerate which existing pipelines are journal-only by design and which should have calibration equivalents.
- Name the separation principle: journal pipelines model reflective writing, calibration pipelines model prompted neutral writing, and the two never share aggregate state.

### 2. Tables and schema
For each new pipeline component, specify:
- Whether it needs a new table or a `question_source_id`-partitioned row in an existing table.
- The pros and cons of each approach (new tables are cleaner for analysis and migration; flagged rows reuse infrastructure).
- A recommendation and rationale.

Components to cover:
- Calibration personal profile (analogous to `tb_personal_profile`)
- Calibration semantic baselines (analogous to `tb_semantic_baselines`, `tb_semantic_trajectory`)
- Calibration cross-session signals (analogous to `tb_cross_session_signals`)
- Calibration session integrity (analogous to `tb_session_integrity`)
- Calibration reconstruction residuals (analogous to `tb_reconstruction_residuals`)
- Calibration embeddings (currently excluded by `getUnembeddedResponses()` — decide whether calibrations should be embedded for their own topic-matched baselines or remain unembedded)

For each, specify: table name or flag convention, columns, indexes, and which fields mirror the journal table vs which differ.

### 3. Module responsibilities
For each existing journal-channel module, specify what the calibration equivalent needs to do:
- `libProfile.ts` → `libCalibrationProfile.ts`? Or extend existing with a `channel` parameter?
- `libSemanticBaseline.ts` → same question.
- `libReconstruction.ts` → same question.
- `libCrossSessionSignals.ts` → same question.
- `libIntegrity.ts` → same question.

Recommend module structure (separate files vs. parameterized existing modules) with rationale. Consider: code duplication risk, readability, ease of future divergence if the channels need different logic.

### 4. Pipeline invocation
- Where does the calibration pipeline get invoked? The journal pipeline is invoked from `respond.ts`. Calibrations are submitted via `calibrate.ts`. Specify the invocation point and sequencing (what runs synchronously in the HTTP response, what runs in the fire-and-forget background).
- Specify which calibration pipelines should run per-session and which should aggregate across sessions.
- Note any ordering dependencies (e.g., profile must be updated before cross-session signals are computed, matching the journal channel's sequencing).

### 5. Cross-channel interactions
Enumerate every legitimate place the two channels should interact, and the rules:
- Daily delta: already implemented; confirm it stays as the only cross-channel consumer at the per-session level.
- Future cross-task contrasts (journal ghost reconstructing calibration behavior and vice versa): specify whether the spec includes these or defers them to a later phase.
- Any other cross-channel operations the papers imply (e.g., Paper A's automaticity-threshold demonstration using within-person motor signal contrasts).
- The default rule: channels do not share aggregate state; aggregate state within a channel is built from that channel's sessions only.

### 6. Data contamination prevention
- Formalize the separation invariant: every aggregate or cross-session computation filters on `question_source_id` and reads from only one channel.
- Specify where the filter lives (entry-point guards per the decontamination pass's pattern).
- Specify which channel is the default in any ambiguous function signature.
- Note that the journal channel's decontamination fixes established the pattern; the calibration pipelines should follow the same pattern from day one.

### 7. Migration and backfill
- Specify what happens to the 56 existing calibration sessions once the pipelines are built.
- A backfill script should populate all calibration-channel tables from the existing calibration data, analogous to the coordinated recompute that was just done for the journal channel.
- Specify the dependency order for the backfill (same shape as the journal recompute: delete, semantic signals, embeddings if applicable, profile, baselines, cross-session, integrity, reconstruction).

### 8. Observatory and reporting
- Specify where calibration-channel outputs should surface in the observatory UI, if at all.
- Specify whether existing observatory views (which currently show journal-channel data) should gain calibration equivalents or stay journal-only.
- Note that this is presentation scope, not engine scope, and can be deferred.

### 9. Effort estimate
- For each pipeline component in section 2, estimate relative effort (small / medium / large) based on how closely the calibration equivalent mirrors the existing journal module.
- Identify which components are mechanical copies (low risk) and which involve genuine design decisions (higher risk).
- Suggest a build order — which pipelines to land first, which depend on which.

### 10. Open questions
- List design questions this spec does not resolve and that require the author's input before implementation.
- Candidates: should calibrations be embedded (with what model, at what cost); should the calibration profile use the same ex-Gaussian MLE fit as journal or something different; should the reconstruction ghost for calibrations use a different corpus than the ghost for journals (yes, obviously, but document why); etc.

## What NOT to do
- Do not write any code.
- Do not modify any existing files other than creating the new spec document.
- Do not make unilateral design decisions on the open questions — surface them in section 10 for the author.
- Do not conflate the calibration-channel build with any other work (the contamination boundary v2, the paste_contaminated consumer, etc.). Those are separate.
- Do not propose timelines. Effort estimates are relative, not calendar-bound.

## Deliverable
The single markdown document at `docs/calibration-channel-spec.md`, complete enough that a future implementer can read it and build the pipelines without re-deriving the design. The spec should be self-contained — it can reference existing files and tables, but it should not assume the reader has access to today's conversation.

## Out of scope but flag if you see
If during spec-writing you identify pieces of the calibration channel that are already partially implemented (beyond the daily delta), list them. If any of the "gap" assumptions this task is based on turn out to be wrong, flag that before writing the spec.