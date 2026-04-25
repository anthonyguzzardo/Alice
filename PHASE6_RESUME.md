# Phase 6 — STOPPED at sub-phase 6a (resume tomorrow)

## Where we are

- Phases 1–5 shipped. Multi-user foundation in place: corpus table, subjects table, expansion tooling, scheduler, encrypted-at-the-API-boundary subject daily path. All tests pass.
- Phase 6 broken into sub-phases 6a → 6e. We were preparing to ship **6a** (cloud infrastructure + auth + encryption foundation).
- 6a hit a hard stop at the implementation prompt: three platform-compatibility blockers surfaced that need decisions before any code is written.

## What got locked in (don't relitigate when resuming)

- **Cloud DB:** Supabase. Single source of truth going forward.
- **Local Postgres:** demoted to backup mirror via daily `pg_dump` from Supabase.
- **Encryption model:** server-side AES-256-GCM at rest, owner holds the key. No E2E. Honestly disclosed in consent doc (built in 6c).
- **Auth:** Argon2id (subject to platform constraint -- see open decision below), session tokens in `tb_subject_sessions`.
- **Existing owner data:** dump local -> restore to Supabase. Preserved.
- **Subject calibration:** triggers `runCalibrationExtraction()`. Intentional contamination boundary change. Scope of 6b, not 6a.
- **Calibration text storage for subjects:** encrypted in `tb_subject_calibrations`. 6b scope.
- **Vector dimension for subject embeddings:** 512 (Matryoshka-truncated, matches owner table).
- **Timezone:** IANA on `tb_subjects`, on-demand scheduling. 6b scope.
- **Sub-phase ordering:** 6a (infra + auth + encryption) -> 6b (encrypted subject responses + timezone scheduling) -> 6c (consent + delete + export) -> 6d (embedder queue) -> 6e (observatory subject toggle + decrypt + notifications).

## Three open decisions blocking 6a implementation

These came back from the implementation agent. All three need answers before code can be written.

### Decision 1: Deployment platform

The codebase has Node-native dependencies (`postgres.js` over TCP, `argon2` C addon, napi-rs Rust signal engine). Cloudflare Workers runs on V8 isolates and breaks all three.

Options:
- **(A) Cloudflare Pages + Workers** -- requires Hyperdrive ($5/mo), replacing `argon2` with `hash-wasm` or `bcryptjs`, solving Rust-module tree-shaking so subject routes don't drag in owner-only code. Weeks of migration work.
- **(B) Vercel** -- swap Astro adapter to `@astrojs/vercel`. Everything else works unchanged. Cold starts and serverless function timeouts are the only concerns. Paid tier $20/mo gets 60s timeout.
- **(C) Railway / Fly.io / VPS** -- persistent Node.js, no cold starts, no timeouts, all dependencies work. More ops work than managed platforms.
- **(D)** Split frontend (Cloudflare) + API server (elsewhere) -- not recommended.

**Implementation agent's recommendation: B or C, not A.** "Fighting the Workers runtime will consume weeks of migration work that produces zero user value."

### Decision 2: Local development DB

- **(i)** Local dev points at Supabase. One DB everywhere. ~50-200ms query latency vs ~1ms local.
- **(ii)** Local dev keeps local Postgres mirror. Risk: local and prod can diverge during a dev session.

### Decision 3: If Cloudflare wins Decision 1, Argon2 replacement

- `hash-wasm` (Argon2id via WASM, ~5x slower than native)
- `bcryptjs` (different algorithm, well-understood, pure JS)

If Vercel or Railway wins Decision 1, this question goes away -- native `argon2` works.

## What to do when resuming

1. Read this file. Re-read the locked-in design above so we don't relitigate.
2. Answer the three decisions. One line each is fine.
3. Hand the answers + the existing 6a prompt back to the implementation agent. The 6a prompt is mostly correct; only the deployment-specific parts (runtime mode, crypto library, connection driver) change based on Decision 1.
4. Receive 6a deliverables, verify, ship.
5. Move to 6b.

## Files / state to recover

- 6a prompt: in conversation history, last full markdown block before the implementation agent's blocker response.
- Migration chain: 001-026 applied to local Postgres. Supabase has nothing yet.
- Cloudflare Pages / Vercel / Railway: nothing provisioned yet. Decision 1 determines what gets created first.
- Encryption key: not yet generated. First thing to do once Decision 1 lands and infra setup begins.
- fweeo.com: domain owned, not yet pointed at anything.

## Resume command

Paste the three decisions into a new message. The 6a prompt will be regenerated with the chosen platform's specifics baked in.
