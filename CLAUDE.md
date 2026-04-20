# Alice

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## Stack
- Astro (SSR with Node adapter)
- PostgreSQL 17 + pgvector (connection: `postgres://localhost/alice`)
- Rust signal engine via napi-rs (`src-rs/`, dynamical + motor + process signals)
- Claude API (@anthropic-ai/sdk) for question generation and pattern surfacing
- TypeScript (strict)

## Architecture
- Single user, no auth
- PostgreSQL database `alice` (local, connection via `ALICE_PG_URL` env var)
- Schema managed by `scripts/create-postgres-schema.sql`
- Connection pool in `src/lib/db-pool.ts` (porsager/postgres.js)
- All db functions are async (return Promise)
- Seed questions in `src/lib/seeds.ts`
- Nightly script (`npm run generate`) generates tomorrow's question from past responses
- Rust signal engine in `src-rs/` built via `npm run build:rust`
- Signal pipeline (`src/lib/signals-native.ts`) loads Rust via napi-rs with automatic TS fallback
- `npm run build` runs Rust build before Astro build

## Database Conventions
- **Table prefixes**: `te_` (enumeration/static), `td_` (dictionary), `tb_` (normal/mutable), `tm_` (matrix), `th_` (history)
- **Surrogate keys**: `table_name_id` (NEVER just `id`)
- **Logical foreign keys only** — no physical FK constraints
- **Footer columns** on mutable tables: `dttm_created_utc`, `created_by`, `dttm_modified_utc`, `modified_by`
- **No footer** on static enum tables
- **Header comments** on every table: PURPOSE, USE CASE, MUTABILITY, REFERENCED BY, FOOTER
- **Enum tables** get explicit INSERT with fixed IDs
- Do NOT use ALTER TABLE — rewrite the CREATE TABLE in `scripts/create-postgres-schema.sql`
- Do NOT hard-code proper nouns into column names
- **JSONB columns**: event_log_json, keystroke_stream_json, traits_json, signals_json, deletion_events_json, iki_autocorrelation_json, digraph_latency_json, prompt trace ID arrays
- **Embeddings**: stored as `vector(512)` on `tb_embeddings` via pgvector with HNSW index

## Known Gotchas
- **VoyageAI types in `embeddings.ts`**: The `voyageai` package is imported via `createRequire` (CJS shim in ESM). TypeScript can't resolve types cleanly through this path. If type errors resurface on `VoyageAIClient` or `result` being `unknown`, the fix is: extract the module ref separately, use `InstanceType<typeof VoyageAIClient>` for the type alias, and cast embed responses to `{ data?: Array<{ embedding?: number[] }> }`.
- **All db functions are async**: Every function exported from `src/lib/db.ts` returns a Promise. Every call site must `await`. If you add a new db function, it must be async.
- **PostgreSQL camelCase aliases**: PG lowercases unquoted identifiers. Use double quotes for camelCase aliases in SQL: `SELECT col AS "camelCase"`.
- **JSONB auto-parsing**: The postgres driver auto-parses JSONB columns into JS objects. Functions returning JSONB fields that callers expect as strings must re-stringify them.
- **Rust native module**: Loaded via `createRequire` in `signals-native.ts`. The `.node` file is platform-specific (`alice-signals.darwin-arm64.node`). If it fails to load, all three signal families fall back to TypeScript automatically. Rebuild with `npm run build:rust` after changing `src-rs/` code.

## Philosophy
Every technical decision should serve depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.
