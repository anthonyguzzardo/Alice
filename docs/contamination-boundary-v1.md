# Contamination Boundary v1

This document defines the contamination boundary for Alice sessions attested
under `contamination_boundary_version = 'v1'`. A contamination boundary
establishes that no AI system mediates, filters, modifies, or influences
the text between the user's keystrokes and the stored response.

## Covered Code Paths

Sessions submitted through the following paths are covered by v1:

### Journal submissions (`src/pages/api/respond.ts`)

1. **Keystroke capture**: Client-side JavaScript captures raw keystrokes in
   `src/pages/index.astro`. Events are accumulated in a local array.
2. **Text accumulation**: Text is built character-by-character in a textarea.
   No autocomplete, no spell-check mediation, no AI suggestions. Paste and
   drag-and-drop are blocked (`preventDefault`); attempts are counted in
   `paste_count` and `drop_count` on `tb_session_summaries`.
3. **Submission**: POST to `/api/respond` with `{ questionId, text, sessionSummary }`.
   The `text` field is the raw textarea value, trimmed of leading/trailing whitespace.
4. **Storage**: `saveResponse(questionId, text, tx)` inserts the trimmed text
   directly into `tb_responses.text`. No transformation.
5. **Session summary**: `sessionSummary` is behavioral metadata (durations,
   keystroke counts, burst sequences). It does not contain or modify the
   response text.

### Calibration submissions (`src/pages/api/calibrate.ts`)

1. **Keystroke capture**: Same client-side mechanism as journal submissions.
2. **Text accumulation**: Same textarea, same constraints (paste and drag-and-drop blocked).
3. **Submission**: POST to `/api/calibrate` with `{ prompt, text, sessionSummary }`.
4. **Storage**: `saveCalibrationSession(prompt, text, summary)` inserts the
   trimmed text into `tb_responses.text` within a transaction. No transformation.

## AI-Touching Paths (Post-Storage Only)

The following processes use AI but operate AFTER the response is stored.
They never modify `tb_responses.text`:

- `runGeneration()`: Generates tomorrow's question from past responses.
- `renderWitnessState()`: AI observation of accumulated entries.
- `embedResponse()`: Generates vector embedding of the stored text.
- `computeAndPersistDerivedSignals()`: Signal computation pipeline.

## NOT Covered by v1

**`src/pages/app/index.astro`** contains a textarea (line 34) with a TODO
at line 75 (`// TODO: wire to real submission with keystroke capture`). This
is an unwired writing surface. If this path is ever activated for real
submissions, it requires a separate contamination boundary version (v2) with
its own audit. Sessions from that path MUST NOT be attested under v1.

## Pre-Attestation Sessions

Sessions written before migration 015 (the contamination attestation schema)
have `code_commit_hash = 'pre-attestation'`. These sessions are retroactively
attested under v1 based on code history review confirming the same unmediated
paths were in place from the project's inception. The code paths above have
not changed since the first session was recorded.

## Known Unaddressed Vectors

The following input vectors are **not blocked or monitored** by v1. They are
documented here so the attestation is accurate about what it does and does not
cover. Blocking these is v2-scope engineering work.

1. **IME composition events.** Input Method Editors (used for CJK characters,
   accented text) fire `compositionstart`/`compositionend` events that bypass
   normal keydown/input flow. Composed text enters the textarea without
   per-keystroke tracking. Low risk for English-only single-user use, but the
   boundary does not assert anything about IME-composed input.

2. **`document.execCommand('insertText')`.** Browser extensions or developer
   tools can inject text programmatically via the deprecated but still-functional
   `execCommand` API. This bypasses all event listeners. Not blockable at the
   event-listener level; would require a MutationObserver or Content Security
   Policy approach.

3. **OS-level dictation.** macOS dictation (Fn-Fn), Windows Voice Typing, and
   other OS-level speech-to-text services insert text via the input event
   without corresponding keystroke events. Not distinguishable from typing at
   the event-listener level. A heuristic (comparing keystroke count to character
   count) could flag suspiciously high character-to-keystroke ratios, but this
   is not implemented.

Sessions where these vectors were used will have `paste_contaminated = false`
and `drop_count = 0`, producing a false negative on the contamination flag.
The contamination boundary does not claim to detect these vectors.

## Audit Date

Initial audit: 2026-04-23
Auditor: System (automated migration with manual code path verification)

v1.1 update: 2026-04-23
Change: Added drag-and-drop blocking (`dragover` + `drop` event listeners with
`preventDefault`) on both journal and calibration textareas. Drop attempts are
counted in `drop_count` on `tb_session_summaries` (migration 016). Pre-v1.1
sessions did not monitor drag-and-drop; their attestation covers paste blocking
only.
