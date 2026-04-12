# Handoff — April 12, 2026 (Session 3)

## What This Session Did

Research-driven overhaul of the data input interface and question generation pipeline. Every change is grounded in peer-reviewed HCI, psycholinguistics, and adaptive assessment research. Also fixed a credit-burning bug in Bob's witness renderer.

---

## Scientific Research Foundation

Conducted deep research across MIT, Harvard, Stanford, Anthropic, Google, CMU, KTH, and UCL on how interface design and question design affect behavioral data quality. Key sources:

- **Slow Technology** — Hallnäs & Redström (2001, KTH). Deliberate friction amplifies reflection.
- **Design Frictions** — Cox et al. (2016, UCL). Micro-frictions increase mindfulness without increasing abandonment.
- **Audience Effects** — Bernstein et al. (2013, Stanford). Writing for no audience produces richer signal.
- **Question Fading** — Czerwinski et al. (2004, Microsoft Research). Faded prompts produce more associative responses.
- **Keystroke Dynamics** — Epp et al. (2011, CHI). Different emotions have distinct keystroke signatures.
- **Revision Chains** — Leijten & Van Waes (2013, Antwerp). Revision topology reveals cognitive processing modes.
- **Desirable Difficulties** — Bjork & Bjork (2011, UCLA). Adaptive challenge calibrated to demonstrated capacity.
- **Deep-Reasoning Questions** — Graesser & Person (1994). Causal/evaluative framing maximizes cognitive processing markers.
- **Spaced Repetition** — Cepeda et al. (2006, UCSD). Expanding intervals for theme revisitation.
- **Information-Gain Selection** — Settles (2012). Ask where the model is most uncertain.
- **Evidence-Centered Design** — Mislevy et al. (2003, ETS). Each question should make a specific signal observable.
- **Safe Challenge** — Edmondson (1999, Harvard). Invitation over confrontation.
- **Contextual Anchoring** — Bolger et al. (2003, Columbia). Event-contingent prompts produce 30-50% richer data.
- **Narrative Identity** — McAdams & McLean (2013, Northwestern). Temporal connection questions produce richer signal.

Full bibliography added to README.md under "Scientific Foundation" — ~50 citations organized by domain.

---

## Interface Changes (the instrument)

### Deliberate Friction
- **Reflection pause** — 4-second delay before textarea activates. Textarea starts disabled and translucent, then fades in and focuses. Forces time with the question before writing begins.
- **Autocomplete/spellcheck disabled** — `autocomplete="off"`, `autocorrect="off"`, `autocapitalize="off"`, `spellcheck="false"` on both journal and calibration textareas. Forces deliberate word choice.
- **No placeholder text** — Removed from both journal ("Think before you type...") and calibration ("Just write..."). Empty space reduces performance anxiety.

### Question Fading
- After first keystroke, the question fades to 30% opacity over 8 seconds via CSS transition. Less literal answering, more associative exploration.

### Deferred Submit Button
- Submit button is invisible for the first 90 seconds of writing (94s total including reflection pause). Fades in gently over 1.5 seconds. Removes implicit "finish" pressure.

### Generous Writing Space
- Textarea `min-height` increased from 240px to 400px (~12-15 visible lines). Research shows people unconsciously fill visible space.

### Richer Keystroke Capture
- **Inter-key intervals** — mean and standard deviation of ms between keystrokes (capped at 5s to exclude pauses). Captured via `keydown` listener on both journal and calibration textareas.
- **Revision chain detection** — sequential deletions within 500ms grouped as one chain. Chain count and average length stored. Distinguishes surface correction from structural revision.
- **Scroll-back tracking** — counts how often user scrolls back in textarea (both journal and calibration) and how often they scroll page to re-read the question (journal only).

### Files Modified
- `src/pages/index.astro` — all UI changes above

---

## Database Changes

### New Columns on `tb_session_summaries`
- `inter_key_interval_mean` (REAL)
- `inter_key_interval_std` (REAL)
- `revision_chain_count` (INTEGER)
- `revision_chain_avg_length` (REAL)
- `scroll_back_count` (INTEGER)
- `question_reread_count` (INTEGER)

Migration block handles existing databases. All NULL for pre-existing sessions — no backfill needed or possible.

### New Table: `tb_question_candidates`
Stores all 3 candidate questions per generation run (Harrison et al. 2017 — the sequence of what the system needed to ask is itself diagnostic signal):
- `question_id` — the selected question
- `candidate_rank` — 1=selected, 2-3=runners up
- `candidate_text`, `selection_rationale`, `uncertainty_dimension`, `theme_tags`

### Files Modified
- `src/lib/db.ts` — schema, migration, `SessionSummaryInput` interface, `saveSessionSummary()`, `SESSION_SUMMARY_COLS`, `saveQuestionCandidates()`, `getQuestionCandidates()`, `getUsedCalibrationPrompts()`

---

## API Changes

### `src/pages/api/respond.ts`
- Passes 6 new keystroke/metadata fields through to `saveSessionSummary()`

### `src/pages/api/calibrate.ts`
- Passes 6 new fields through to `saveSessionSummary()`
- GET endpoint now excludes previously used calibration prompts (207 prompts, no repeats until all exhausted, then cycles)

### `src/lib/observe.ts`
- Updated fallback `SessionSummaryInput` with new fields

---

## Question Generation Pipeline

### System Prompt Rewrite (`src/lib/generate.ts`)

**Tone fix:** "You are not helpful. You are not kind." replaced with "You are honest in the way a mirror is honest. You don't comfort. You don't perform." Same spine, aligned with safe challenge research.

**Citations stripped:** Academic paper names removed from the LLM prompt — the principles stay, the citations are for us (README), not the model. Saves tokens.

**New principles added:**
- Causal/evaluative framing ("why", "reconcile" over "describe", "list")
- Disclosure context (revealing, not recording)
- Safe challenge (invitation, not confrontation)
- Information-gain selection (target uncertainty, not interest)
- Spaced repetition with expanding intervals
- Interleaving (don't cluster related themes)
- Contextual anchoring without echoing entries
- Question length guidance: "Under 15 words. One clause, one demand."

### Adaptive Difficulty
Computes avg MATTR and cognitive density from recent responses. Injects calibrated guidance:
- HIGH complexity → escalate (abstract, contradiction-surfacing)
- LOW complexity → anchor (concrete, personally specific)
- MODERATE → maintain but vary type

### 3-Candidate Output
Generation now produces SELECTED + 2 runners-up, each with theme tags. The selected question also gets an uncertainty dimension tag. All stored in `tb_question_candidates`.

### Theme History
Recent question texts included in prompt for spaced repetition awareness — the model can see what was asked recently and avoid clustering.

### `max_tokens` raised from 200 to 400 to accommodate expanded output.

---

## Bug Fix: Bob Witness Cache

**Problem:** `witness.ts` counted ALL `tb_session_summaries` rows to determine cache key, including calibration sessions. Every calibration session incremented the count, busted the cache, and triggered a full Opus call to re-render Bob's visual traits — even though calibration data doesn't change Bob's form.

**Fix:** Changed count query to `WHERE q.question_source_id != 3` — only journal sessions invalidate the cache.

**Impact:** Was silently burning an Opus call per calibration session. Now Bob only re-renders when actual journal entries change.

### File Modified
- `src/pages/api/witness.ts`

---

## README.md Updates

- **Scientific Foundation** section added — ~50 citations organized by domain (writing process, linguistic analysis, behavioral dynamics, prediction methodology, interface design, question design, keystroke research, signal formatting, error correction)
- **The Writing Interface** section added — documents all 7 interface design decisions with research basis
- **New behavioral signals** documented (inter-key intervals, revision chains, scroll-back)
- **Generation pipeline** improvements documented (adaptive difficulty, candidate logging, research-backed framing)
- **Architecture** section updated with new tables, features, and capabilities
- **Philosophy** section expanded — ties research foundation to design philosophy
- **Images** added — Bob Day 3, calibration option, calibration question, calibration response

---

## Current State of the Data

- **3 real entries:** April 10, 11, 12. April 12 has full enriched data.
- **14+ calibration sessions:** All have linguistic densities. New sessions from today onward also have keystroke dynamics and scroll-back tracking.
- **0 sessions with burst sequence data.** Capture started April 13 (prior session).
- **0 sessions with keystroke dynamics.** Capture starts next session.
- **1 observation** (April 12) — re-generated with linguistic pipeline.
- **2 open predictions.**
- **Generation: still in seed phase** through ~May 11.

---

## What's NOT Done

1. **Dynamics not fed into generate/observe/reflect** — the dynamics engine is available but only Bob consumes it. The AI layer still uses the legacy trajectory engine + signals.ts.

2. **Within-session KT detection from burst sequences** — data captured but the consolidation algorithm isn't built.

3. **Full DTW for coupling** — cross-correlation is the proxy.

4. **Test suite** — still not built.

5. **Einstein interaction surface** — not started.

6. **New keystroke signals not yet consumed by signals.ts** — inter-key intervals, revision chains, and scroll-back are captured and stored but not yet formatted for LLM consumption in observation/generation/reflection prompts. Wire them into `formatObserveSignals()` and `formatCompactSignals()` when ready.
