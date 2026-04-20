# Handoff: Public Surfaces + Avatar Foundation (2026-04-20)

## What happened this session

Deep investigation of the full codebase, then two rounds of building: public-facing pages inspired by anthropic.com patterns, and the foundation for a writing process avatar.

## Part 1: Public Surface Expansion

### Email capture
- **Migration**: `db/sql/migrations/003_add_subscribers.sql` -- `tb_subscribers` table (email, source, timestamp)
- **API**: `src/pages/api/subscribe.ts` -- POST endpoint, validates email, handles duplicates (409 returns ok)
- **Forms added to**: `src/pages/collaborate.astro` (contact section), `src/pages/vision.astro` (closing section)
- Inline JS handles submit, replaces form with "You're on the list." on success

### Build log (`/log`)
- **Library**: `src/lib/libLog.ts` -- reuses papers pattern (gray-matter + marked), reads from `/log/` directory
- **Pages**: `src/pages/log/index.astro` (list), `src/pages/log/[slug].astro` (detail)
- **Sample entry**: `log/why-rust.md` (published, tagged rust/signals/engineering)
- Front matter: title, slug, date, status, tags array. Excerpt auto-extracted from first paragraph.

### Methodology page (`/methodology`)
- **Page**: `src/pages/methodology.astro`
- All 6 signal families with individual signals: name, description, citation, validation badge
- Three validation tiers: Validated (replicated method), Adapted (published method in new context), Experimental (novel to Alice)
- Known limitations section (n=1, signal-to-construct mapping, linguistic depth, question confound, device sensitivity)

### For-researchers page (`/for-researchers`)
- **Page**: `src/pages/for-researchers.astro`
- NOT in nav. Direct-link for cold outreach.
- Sections: dual-channel capture, signal pipeline (6 families), current state, partnership model, email + subscribe

### About page (`/about`)
- **Page**: `src/pages/about.astro`
- First-person narrative of how Alice came about: science forum -> Einstein machine -> circular flaw -> measurement instrument -> closing window
- Written to match Anthony's actual voice (informed by journal entries for style, not content)
- Methodological disclosure: builder = sole participant, confound named openly

### Navigation update
`src/components/cmpPublicNav.astro` now reads:
Home, Vision, Questions, Research, Instrument, **Methodology**, Papers, **Log**, Collaborate, **About** | **Avatar** | Journal, Observatory | Signal Sandbox

## Part 2: Avatar Foundation

### Personal behavioral profile
- **Migration**: `db/sql/migrations/004_add_personal_profile.sql` -- `tb_personal_profile` single-row table
- **Module**: `src/lib/libProfile.ts` -- computes rolling aggregates from all journal sessions
- **Backfill**: `src/scripts/backfill-profile.ts` -- initial population from existing data
- **Pipeline**: wired into `src/lib/libSignalPipeline.ts` as final step after cross-session signals

Profile dimensions stored:
- Motor fingerprint: aggregate digraph latencies, ex-Gaussian params (mu/sigma/tau means + stds), IKI distribution shape, hold/flight baselines
- Writing process: burst count/length, consolidation ratio, session duration/word count
- Pause architecture: within-word/between-word/between-sentence percentages, pause rate, first keystroke latency
- Revision topology: deletion rates, timing bias, R-burst ratio
- Language signature: character trigram model (JSONB), cumulative vocabulary, MATTR baseline

Current profile (8 sessions): 438 unique words, tau=85.6ms (std=2.8ms), 8.75 bursts/session at 147 chars, 69% between-word pauses, MATTR=0.89

### Avatar (Rust Markov chain + timing synthesis)
- **Rust module**: `src-rs/src/avatar.rs` -- word-level Markov chain builder, topic-seeded text generation, per-character timing synthesis from motor profile
- **napi boundary**: `generate_avatar()` in `src-rs/src/lib.rs` -- takes corpus JSON, topic, profile JSON, max words; returns text + delays array
- **API**: `src/pages/api/avatar.ts` -- reads journal texts + profile from Postgres, passes to Rust, returns text + pre-computed delays
- **Page**: `src/pages/avatar.astro` -- topic input, keystroke-by-keystroke replay with live signal counters (chars, bursts, pauses, avg IKI, elapsed), done state on completion

How it works:
1. Rust tokenizes the journal corpus, builds word transition probability matrix
2. Seeds the chain with topic words, walks transitions to generate ~150 words
3. For each character: looks up digraph-specific latency, falls back to ex-Gaussian sampling from personal distribution
4. Inserts P-burst pauses (~2-4s every ~150 chars), sentence pauses, word boundary pauses based on pause architecture percentages
5. Returns text + full delay array to client
6. Client replays character by character at exact Rust-computed timing

No LLM anywhere. Words from Markov chain on personal corpus. Timing from motor profile. Math from Rust.

Internal PRNG: xoshiro128+ seeded from system time. No external dependency.

## Research leads for avatar development

Closest existing work:
- **BiAffect** (Dr. Alex Leow, UIC) -- keystroke dynamics for mood detection, validated ex-Gaussian tau as biomarker. Phone-based, process channel only. Highest-value research outreach.
- **Dillon & Arushi (2025)** -- agent-based modeling of typing profiles, synthetic keystroke data. arXiv 2505.05015.
- **Eizaguirre-Peral et al. (2022)** -- conditional GAN for synthetic keystroke generation to attack authentication. arXiv 2212.08445.
- **Kundu et al. (IJCB 2024)** -- TypeNet-based detection of AI-assisted vs genuine writing from keystrokes. 75-86% accuracy. arXiv 2406.15335.
- **TypeNet group (UAM Madrid)** -- Fierrez, Vera-Rodriguez, Morales. Largest keystroke biometrics benchmarks.

Nobody is combining content generation (Markov from personal corpus) with process reconstruction (timing from behavioral profile). The bridge is what Alice is building.

## Files created this session

| File | Purpose |
|------|---------|
| `db/sql/migrations/003_add_subscribers.sql` | Email subscriber table |
| `db/sql/migrations/004_add_personal_profile.sql` | Rolling behavioral profile |
| `src/pages/api/subscribe.ts` | Email capture endpoint |
| `src/pages/api/avatar.ts` | Avatar generation endpoint (calls Rust) |
| `src/lib/libLog.ts` | Build log markdown reader |
| `src/lib/libProfile.ts` | Profile computation + persistence |
| `src/pages/log/index.astro` | Log list page |
| `src/pages/log/[slug].astro` | Log entry detail page |
| `src/pages/methodology.astro` | Signal methodology / instrument card |
| `src/pages/for-researchers.astro` | Researcher landing page |
| `src/pages/about.astro` | About / origin story |
| `src/pages/avatar.astro` | Avatar demo page |
| `src/scripts/backfill-profile.ts` | One-time profile backfill |
| `src-rs/src/avatar.rs` | Rust Markov chain + timing synthesis |
| `log/why-rust.md` | First build log entry |

## Files modified this session

| File | Change |
|------|--------|
| `src/components/cmpPublicNav.astro` | Added Methodology, Log, About, Avatar links |
| `src/pages/collaborate.astro` | Added subscribe form + styles + script |
| `src/pages/vision.astro` | Added subscribe form + styles + script |
| `src/lib/libSignalPipeline.ts` | Added profile update as final pipeline step |
| `src-rs/src/lib.rs` | Added avatar module + `generate_avatar` napi export |

## What's next

- **Avatar accuracy**: improves automatically with each journal entry (Markov chain gets denser, profile gets more precise)
- **Markov order upgrade**: at 10+ entries, chain bumps to bigram (order 2). Text coherence jumps significantly.
- **Instrument scoring**: run the avatar's output through the signal pipeline and compare 7D behavioral state to real sessions. This is the adversarial validation.
- **PE spectrum consumption**: `pe_spectrum` is stored but state engine still uses single PE. Wire spectral slope into deliberation dimension.
- **Cross-space coupling**: semantic x behavioral dimension correlation. Architecture supports it, not yet implemented.
- **Deploy the site**: all public pages are built but the site needs to be live for any outreach to work.
