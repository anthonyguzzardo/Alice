# Alice

A personal, monastic daily thinking journal. One question per day. No gamification. No dashboard. Just depth.

## Stack
- Astro (SSR with Node adapter)
- SQLite via better-sqlite3 (migrate to Postgres when needed)
- Claude API (@anthropic-ai/sdk) for question generation and pattern surfacing
- TypeScript (strict)

## Architecture
- Single user, no auth
- SQLite database at `data/alice.db`
- Seed questions in `src/lib/seeds.ts`
- Nightly script (`npm run generate`) generates tomorrow's question from past responses
- Weekly script (`npm run reflect`) surfaces patterns across all responses

## Database Conventions
- **Table prefixes**: `te_` (enumeration/static), `td_` (dictionary), `tb_` (normal/mutable), `tm_` (matrix), `th_` (history)
- **Surrogate keys**: `table_name_id` (NEVER just `id`)
- **Logical foreign keys only** — no physical FK constraints
- **Footer columns** on mutable tables: `dttm_created_utc`, `created_by`, `dttm_modified_utc`, `modified_by`
- **No footer** on static enum tables
- **Header comments** on every table: PURPOSE, USE CASE, MUTABILITY, REFERENCED BY, FOOTER
- **Enum tables** get explicit INSERT with fixed IDs
- Do NOT use ALTER TABLE — rewrite the CREATE TABLE
- Do NOT hard-code proper nouns into column names

## Known Gotchas
- **VoyageAI types in `embeddings.ts`**: The `voyageai` package is imported via `createRequire` (CJS shim in ESM). TypeScript can't resolve types cleanly through this path. If type errors resurface on `VoyageAIClient` or `result` being `unknown`, the fix is: extract the module ref separately, use `InstanceType<typeof VoyageAIClient>` for the type alias, and cast embed responses to `{ data?: Array<{ embedding?: number[] }> }`.

## Philosophy
Every technical decision should serve depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.
