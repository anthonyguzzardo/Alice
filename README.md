# Alice

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## What it is

Alice asks you one question every morning. You write. That's it.

Behind the writing surface, a two-channel cognitive instrument measures how you think -- not what you think. Motor signals from keystroke dynamics. Semantic signals from text structure. Both channels are deterministic, reproducible, and built to accumulate meaning over years.

## Stack

- Astro (SSR, Node adapter)
- PostgreSQL 17 + pgvector
- Rust signal engine via napi-rs
- Claude API for question generation
- TypeScript (strict)

## Getting started

```bash
npm install
npm run build:rust
npm run dev
```

Requires PostgreSQL with a local `alice` database and a running TEI instance for embeddings. See `SYSTEM.md` for the full architecture.

## Documentation

- `SYSTEM.md` -- architecture, signal engine, database conventions, naming, philosophy
- `CLAUDE.md` -- agent instructions and coding standards
- `docs/contamination-boundary-v1.md` -- attestation of unmediated input
- `docs/embedding-methods.md` -- embedding model specification
- `GOTCHAS.md` -- known landmines
