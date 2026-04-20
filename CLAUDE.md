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
- PostgreSQL database `alice`, schema `alice` (local, connection via `ALICE_PG_URL` env var, `search_path = alice,public`)
- Schema managed by `db/sql/dbAlice_Tables.sql`, seed data in `db/sql/dbAlice_Seed.sql`
- Connection pool in `src/lib/libDbPool.ts` (porsager/postgres.js)
- All db functions are async (return Promise)
- Seed questions in `src/lib/libSeeds.ts`
- Nightly script (`npm run generate`) generates tomorrow's question from past responses
- Rust signal engine in `src-rs/` built via `npm run build:rust`
- Signal pipeline (`src/lib/libSignalsNative.ts`) loads Rust via napi-rs with automatic TS fallback
- `npm run build` runs Rust build before Astro build

---

## CRITICAL: Logical Foreign Keys

**THE DATABASE USES LOGICAL FOREIGN KEYS. THERE ARE NO PHYSICAL FK CONSTRAINTS.**

This means:
- **No cascade deletes** -- deleting a parent row will NOT automatically delete children
- **No referential integrity enforcement** -- the database will not reject orphaned references
- **JOINs work fine** -- postgres.js uses raw SQL, not an ORM that needs FK metadata
- **Application code is responsible** for consistency when inserting or deleting across tables

### The Pattern (ALWAYS USE THIS)
```typescript
// CORRECT -- postgres.js tagged template with logical FK JOIN
const rows = await sql`
  SELECT r.response_id, r.text, q.scheduled_for AS date, q.text AS question_text
  FROM tb_responses r
  JOIN tb_questions q ON r.question_id = q.question_id
  WHERE q.scheduled_for = ${today}
`;

// CORRECT -- multi-table JOIN with camelCase aliases (must double-quote)
const rows = await sql`
  SELECT s.question_id AS "questionId",
         s.total_duration_ms AS "totalDurationMs",
         q.scheduled_for AS date,
         r.text AS "responseText"
  FROM tb_session_summaries s
  JOIN tb_questions q ON s.question_id = q.question_id
  JOIN tb_responses r ON q.question_id = r.question_id
  WHERE q.question_source_id = 3
  ORDER BY q.question_id ASC
`;

// WRONG -- unquoted camelCase alias (PG lowercases it)
SELECT s.total_duration_ms AS totalDurationMs  -- becomes "totaldurationms"

// WRONG -- assuming cascade delete behavior
await sql`DELETE FROM tb_questions WHERE question_id = ${id}`;
// ^^^ orphans rows in tb_responses, tb_session_summaries, tb_entry_states, etc.
```

### Reference Implementation

See `src/lib/libDb.ts` -- `getCalibrationSessionsWithText()` for the canonical multi-table JOIN pattern.

---

## Database Conventions
- **Table prefixes**: `te_` (enumeration/static), `td_` (dictionary), `tb_` (normal/mutable), `tm_` (matrix), `th_` (history)
- **Surrogate keys**: `table_name_id` (NEVER just `id`)
- **Logical foreign keys only** -- no physical FK constraints
- **Footer columns** on mutable tables: `dttm_created_utc`, `created_by`, `dttm_modified_utc`, `modified_by`
- **No footer** on static enum tables
- **Header comments** on every table: PURPOSE, USE CASE, MUTABILITY, REFERENCED BY, FOOTER
- **Enum tables** get explicit INSERT with fixed IDs
- Do NOT use ALTER TABLE -- rewrite the CREATE TABLE in `db/sql/dbAlice_Tables.sql`
- Do NOT hard-code proper nouns into column names
- **JSONB columns**: event_log_json, keystroke_stream_json, traits_json, signals_json, deletion_events_json, iki_autocorrelation_json, digraph_latency_json, prompt trace ID arrays
- **Embeddings**: stored as `vector(512)` on `tb_embeddings` via pgvector with HNSW index

---

## Naming Convention

All folders and files follow consistent conventions by layer.

### File Naming by Directory

| Directory | Prefix | Convention | Example |
|-----------|--------|-----------|---------|
| `src/lib/` | `lib` / `utl` | PascalCase `.ts` | `libDynamicalSignals.ts`, `utlDate.ts` |
| `src/lib/libAliceNegative/` | `lib` | PascalCase `.ts` | `libEmotionProfile.ts`, `libRenderWitness.ts` |
| `src/components/` | `cmp` | PascalCase `.astro` | `cmpAppNav.astro`, `cmpPublicNav.astro` |
| `src/layouts/` | `lay` | PascalCase `.astro` | `layApp.astro`, `layBase.astro` |
| `src/styles/` | `sty` | PascalCase `.css` | `styObservatory.css` |
| `src/pages/` | none | kebab-case `.astro` | `alice-negative.astro`, `landing.astro` |
| `src/pages/api/` | none | kebab-case `.ts` | `calibration-drift.ts`, `signal-variants.ts` |
| `src/scripts/` | none | kebab-case `.ts` | `generate-question.ts`, `backfill-embeddings.ts` |
| `src-rs/src/` | none | snake_case `.rs` | `dynamical.rs`, `motor.rs` |
| `db/sql/` | `dbAlice_` | PascalCase `.sql` | `dbAlice_Tables.sql`, `dbAlice_Seed.sql` |

### Prefixes

| Prefix | Type | Use for |
|--------|------|---------|
| `lib` | Library/domain logic | Signal computation, database, AI/ML, domain modules |
| `utl` | Utility | Generic helpers (date, error logging, word lists) |
| `cmp` | Component | Astro components |
| `lay` | Layout | Astro layouts |
| `sty` | Style | CSS files |

### Rules

1. **Prefix + PascalCase, no hyphens**: `libDynamicalSignals.ts`, not `dynamical-signals.ts`
2. **Subdirectories also prefixed**: `libAliceNegative/libStateEngine.ts`
3. **Pages and API routes are NOT prefixed**: file-based routing maps to URLs directly
4. **Scripts are NOT prefixed**: invoked by path from package.json/CLI
5. **Rust files are NOT prefixed**: snake_case per language convention, already namespaced in src-rs/

### Structure

```
src/
├── assets/         # Static assets (shaders, etc.)
├── components/     # cmpX.astro
├── layouts/        # layX.astro
├── lib/            # libX.ts / utlX.ts (domain logic + utilities)
│   └── libAliceNegative/  # libX.ts (sub-module)
├── pages/
│   ├── api/        # kebab-case.ts (API routes, NOT prefixed)
│   │   ├── observatory/
│   │   └── dev/
│   ├── app/        # kebab-case.astro (NOT prefixed)
│   ├── observatory/
│   └── papers/
├── scripts/        # kebab-case.ts (runnable tasks, NOT prefixed)
└── styles/         # styX.css

db/
└── sql/            # dbAlice_X.sql
    └── migrations/ # 001_description.sql

scripts/            # Top-level migration/backfill scripts
└── archive/        # Completed one-off scripts

src-rs/             # Rust native signal engine
└── src/            # snake_case.rs (NOT prefixed)
```

---

## Async & State Patterns

**All database calls are async. No exceptions.**

- Every function in `src/lib/libDb.ts` returns a `Promise`. Every call site must `await`.
- If you add a new db function, it must be `async`.
- API routes (`src/pages/api/*.ts`) are async handlers returning `Response` objects.
- Background jobs (embed, observe, generate, signal computation) fire-and-forget after the HTTP response. Errors go to `data/errors.log` via `src/lib/utlErrorLog.ts`.
- The signal pipeline runs Rust natively via napi-rs. If the native module fails to load, it falls back to TypeScript automatically. Both paths are async-compatible.

---

## Known Gotchas
- **VoyageAI types in `libEmbeddings.ts`**: The `voyageai` package is imported via `createRequire` (CJS shim in ESM). TypeScript can't resolve types cleanly through this path. If type errors resurface on `VoyageAIClient` or `result` being `unknown`, the fix is: extract the module ref separately, use `InstanceType<typeof VoyageAIClient>` for the type alias, and cast embed responses to `{ data?: Array<{ embedding?: number[] }> }`.
- **PostgreSQL camelCase aliases**: PG lowercases unquoted identifiers. Use double quotes for camelCase aliases in SQL: `SELECT col AS "camelCase"`.
- **JSONB auto-parsing**: The postgres driver auto-parses JSONB columns into JS objects. Functions returning JSONB fields that callers expect as strings must re-stringify them.
- **Rust native module**: Loaded via `createRequire` in `libSignalsNative.ts`. The `.node` file is platform-specific (`alice-signals.darwin-arm64.node`). If it fails to load, all three signal families fall back to TypeScript automatically. Rebuild with `npm run build:rust` after changing `src-rs/` code.

---

## Philosophy
Every technical decision should serve depth over speed. If it optimizes for engagement or throughput, it's wrong. The design is the philosophy.
