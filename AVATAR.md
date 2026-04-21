# Avatar Engine

Behavioral reconstruction from process-level measurements. Generates synthetic writing sessions that replicate a person's writing behavior using only their statistical profile and corpus. No LLM. Pure math.

## What It Is

The Avatar is Alice's reconstruction pipeline. It takes the same measurements the signal pipeline extracts from real writing sessions and runs them in reverse: given a behavioral profile and a text corpus, generate a synthetic session (text + full keystroke stream) that matches the person's statistical fingerprint.

The Avatar exists to answer one question: **are the instrument's measurements sufficient to reconstruct the behavior they were extracted from?** This is reconstruction validity (see `papers/option_f_draft.md`). The fidelity of the reconstruction validates the instrument. The gap between reconstruction and reality characterizes what the instrument does not capture.

## Why No LLM

The reconstruction must be bounded by what the instrument measures. An LLM would produce more coherent text, but the coherence would come from the model's training data, not from the instrument's measurements. The Markov chain generates text using only the statistical structure the instrument can observe: which words follow which other words in this person's writing. The incoherence at low corpus sizes is informative. It shows the ceiling of reconstruction from behavioral measurements alone.

## Architecture

```
src-rs/src/avatar.rs     — Rust: Markov chain, timing synthesis, revision, I-bursts
src-rs/src/lib.rs        — napi boundary: generate_avatar(), compute_perplexity()
src/pages/api/avatar.ts  — API: reads corpus + profile from Postgres, calls Rust
src/pages/avatar.astro   — Frontend: topic input, keystroke-by-keystroke replay
src/lib/libProfile.ts    — Profile computation: rolling aggregates from all sessions
db/sql/migrations/004_add_personal_profile.sql — Profile table schema
```

## Data Flow

1. **API receives topic** from the frontend
2. **Fetches all response texts** (journal + calibration) from `tb_responses`
3. **Fetches behavioral profile** from `tb_personal_profile` (single-row rolling aggregate)
4. **Calls Rust** via napi-rs with corpus JSON, topic, profile JSON, max words
5. **Rust generates** text (Markov chain) + timing (motor profile) + revision + I-bursts
6. **Returns** text, per-character delays, full keystroke stream JSON (signal-pipeline-compatible)
7. **Frontend replays** character by character at Rust-computed timing with live signal counters

## Reconstruction Modes

The Avatar models seven modes of writing behavior. Each corresponds to a dimension the signal pipeline measures.

### 1. Forward Production (Markov Chain)

Word-level Markov chain trained on the full journal + calibration corpus.

- Order 1 at < 10 entries, order 2 at >= 10 entries
- Topic-seeded: searches starters and transition keys for the seed word
- Backoff: order-2 falls back to order-1 transitions before random restart
- Sentence structure: capitalizes after periods, inserts period before dead-end restarts
- Internal PRNG: xoshiro128+ seeded from system time, no external dependency

**Convergence metric:** Per-word log2 perplexity of real responses under the Markov model. Exposed via `compute_perplexity()` napi function. Should decrease monotonically with corpus size.

### 2. Motor Timing (Ex-Gaussian + Digraph)

Per-character delay synthesized from the personal motor profile.

- **Digraph-specific latency** where the preceding + current character bigram exists in the aggregate digraph map, with Gaussian jitter (std 20ms)
- **Ex-Gaussian fallback** sampling from the person's mu/sigma/tau distribution, floored at 30ms
- **Hold time** per keystroke: Gaussian (mu=95ms, sigma=20ms), clamped 40-200ms
- **Full keystroke events** (key_down_ms + key_up_ms) for every character, serialized as `{c, d, u}` wire format compatible with the signal pipeline

### 3. Tempo Drift (Three-Phase Arc)

The ex-Gaussian mu parameter varies across the session:

- **Phase 1 (0-20%):** Exploratory, slower (mu * 1.3 tapering to 0.85)
- **Phase 2 (20-75%):** Confident, faster (mu * 0.85 steady)
- **Phase 3 (75-100%):** Winding down, slight slowdown (mu * 0.85 rising to 1.1)

Grounded in Wengelin (2006) writing process phase research. Currently uses a fixed three-phase model. Future: parameterize from per-session `tempo_drift` once aggregated in the profile.

### 4. Content-Process Coupling (Word Frequency)

Pause duration at word boundaries is modulated by the difficulty of the upcoming word.

- Word frequency map built from the corpus during chain construction
- Rare words (low frequency in the person's writing) get longer pre-word pauses (multiplier up to ~2.5x)
- Common words get shorter pauses (multiplier ~0.7x)
- Unseen words (not in corpus) get high-difficulty treatment (~1.8x + jitter)

This couples **what** is being written to **how** it is being written, which is the content-process binding that Condrey (2026) identifies as necessary for authorship verification.

### 5. Pause Architecture (P-bursts + Evaluation Pauses)

Three kinds of pauses, each structurally distinct:

- **P-burst pauses** (2-4s): After approximately `burst_length` characters at a word boundary. Production burst boundaries.
- **Sentence pauses** (0.8-3s): After sentence-ending punctuation, probability proportional to `pause_sent_pct` from the profile.
- **Word boundary pauses** (0.3-1.2s): At spaces, rate proportional to `pause_between_pct` from the profile, modulated by word difficulty.
- **Evaluation pauses** (4-8s): Every 3-5 P-bursts. Longer than production pauses. Represents reading back through what was written, deciding what to do next. Structurally distinct from P-burst pauses in the signal pipeline.

### 6. Destruction / R-bursts (Revision Synthesis)

Stochastic deletion + retype episodes injected after forward production.

- **Small deletions** (1-3 chars): Typo corrections, word-ending rethinks. Injected at `small_del_rate` per 100 chars.
- **Large deletions / R-bursts** (4-15 chars): Word or phrase reformulation. Injected at `large_del_rate` per 100 chars. Longer pre-deletion deliberation pause (400-1600ms vs 100-400ms).
- **Revision timing bias**: Deletions cluster in first half or second half matching `revision_timing_bias` from the profile.
- **Backspace events**: Generated as `\u{0008}` with faster timing (80ms mean, 60ms hold). The signal pipeline classifies these as R-burst episodes.
- **Retype**: After deletion, characters are retyped at the person's normal ex-Gaussian rate.

Grounded in Hayes & Flower (1980) reviewing-as-core-process, Galbraith (1999) knowledge-constituting model, Faigley & Witte (1981) revision taxonomy.

### 7. I-bursts (Mid-Text Insertion)

Navigate back to an earlier position and insert new text.

- Rate derived from `r_burst_ratio`: if R-bursts are 80% of total, I-bursts are 20%
- Targets the first 70% of the text (you go BACK to insert)
- Navigation pause (1.5-4s): Represents reading back to find the insertion point
- Generates 2-6 words from the Markov chain seeded on nearby context
- Post-insertion reorientation pause (0.5-1.5s): Getting back to where you were
- Inserts at word boundaries for structural coherence

I-bursts are a key marker distinguishing genuine composition from transcription (Condrey 2026). Transcription is forward-only. Composition has mid-text insertions.

## Profile Dependencies

The Avatar reads from `tb_personal_profile`, a single-row table updated after each session by `libProfile.ts`. All sessions (seed, generated, calibration) contribute to the profile.

| Profile field | Avatar use |
|---------------|-----------|
| `digraph_aggregate_json` | Per-bigram timing lookup |
| `ex_gaussian_mu_mean` | Base IKI distribution center |
| `ex_gaussian_sigma_mean` | IKI Gaussian spread |
| `ex_gaussian_tau_mean` | IKI exponential tail (attentional lapses) |
| `burst_length_mean` | P-burst interval (chars between pauses) |
| `pause_between_word_pct` | Word boundary pause probability |
| `pause_between_sent_pct` | Sentence boundary pause probability |
| `first_keystroke_mean` | Initial latency before first character |
| `small_del_rate_mean` | Small deletion frequency per 100 chars |
| `large_del_rate_mean` | Large deletion / R-burst frequency per 100 chars |
| `revision_timing_bias` | First-half vs second-half deletion clustering |
| `r_burst_ratio_mean` | R-burst proportion (inverse = I-burst rate) |

## napi Boundary

Two exports in `lib.rs`:

### `generate_avatar(corpus_json, topic, profile_json, max_words) -> AvatarOutput`

- `corpus_json`: JSON array of response text strings
- `topic`: seed word/phrase for Markov chain
- `profile_json`: JSON object with all profile fields above
- `max_words`: target word count (default 150)
- Returns: `{ text, delays, keystrokeStreamJson, wordCount, order, chainSize }`
- `keystrokeStreamJson` is a JSON array of `{c, d, u}` events, directly compatible with the signal pipeline's `computeDynamicalSignals` and `computeMotorSignals` inputs

### `compute_perplexity(corpus_json, text) -> PerplexityOutput`

- Builds Markov chain from corpus, scores `text` against it
- Returns: `{ perplexity, wordCount, knownFraction }`
- `perplexity`: per-word log2 perplexity (lower = model predicts the text better)
- `knownFraction`: proportion of transitions that existed in the chain (0.0-1.0)
- Convergence metric: track per session, should decrease as corpus grows

## Adversarial Validation Loop (Not Yet Implemented)

The engineering prerequisite for the reconstruction validity paper:

1. Generate Avatar output via `generate_avatar()`
2. Feed `keystrokeStreamJson` into `computeDynamicalSignals()` and `computeMotorSignals()`
3. Compare synthetic signal vectors to real session signal vectors
4. Per-dimension distance = reconstruction validity profile

Where distance is small: the instrument captures that dimension. Where distance is large: the instrument does not. The persistent gap is the cognitive residual.

## Condrey Response (Not Yet Implemented)

Direct empirical test of content-process binding:

1. User composes a real journal entry (authentic session)
2. User transcribes LLM-generated text in the same interface (transcription session)
3. Run both through the full signal pipeline
4. If process-level signals (not just timing) distinguish composition from transcription, Alice captures content-process binding
5. Compare both to Avatar output as a third condition (reconstruction)

This answers Condrey (2026a) who proved timing-only detection fails at 99.8% evasion.

## What the Avatar Cannot Reconstruct

These are expected persistent residuals, not implementation gaps:

- **Semantic coherence**: The Markov chain produces statistically plausible but semantically incoherent text. Meaning requires the mind, not the model.
- **Argument structure**: The order of ideas, the build-up of an argument, the narrative arc. These are cognitive, not statistical.
- **Emotional coupling**: Pausing longer because a topic is emotionally charged. The word frequency proxy captures difficulty but not affect.
- **Creative leaps**: The unexpected word choice, the novel metaphor. The Markov chain can only produce transitions it has seen.

These residuals are the cognitive engagement that builds cognitive reserve (Stern et al. 2023), that AI mediation replaces (Guzzardo 2026b), and that Condrey's timing-only instruments cannot detect. Characterizing them quantitatively is the purpose of the reconstruction validity framework.

## Development Guidelines

- **All signal computation in Rust.** The Avatar is part of the measurement instrument. Single source of truth.
- **No LLM in the reconstruction.** Reconstruction must be bounded by what the instrument measures. An LLM closes the residual gap artificially.
- **Profile fields are the contract.** If the Avatar needs a new behavioral dimension, it must be computed in `libProfile.ts`, stored in `tb_personal_profile`, and passed through the API.
- **All sessions contribute.** Journal AND calibration sessions feed the corpus and profile. Calibration keystrokes are equally valid for motor fingerprinting.
- **Backspace is `\u{0008}`.** The signal pipeline's text reconstruction handles this character as deletion.
- **The PRNG is internal.** xoshiro128+ seeded from system time. No external randomness dependency.
- **`cargo clippy -- -W clippy::all` before committing.** Zero warnings on standard lints.
- **`cargo test` before committing.** All tests must pass.
