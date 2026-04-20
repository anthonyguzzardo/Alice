# Directory Boundaries

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

See `src/lib/db.ts` -- `getCalibrationSessionsWithText()` for the canonical multi-table JOIN pattern.

---

## Naming Convention

All folders and files follow consistent conventions by layer.

### File Naming by Directory

| Directory | Convention | Example |
|-----------|-----------|---------|
| `src/lib/` | kebab-case `.ts` | `dynamical-signals.ts`, `motor-signals.ts` |
| `src/lib/alice-negative/` | kebab-case `.ts` | `emotion-profile.ts`, `render-witness.ts` |
| `src/components/` | PascalCase `.astro` | `AppNav.astro`, `PublicNav.astro` |
| `src/layouts/` | PascalCase `.astro` | `AppLayout.astro`, `BaseLayout.astro` |
| `src/pages/` | kebab-case `.astro` | `alice-negative.astro`, `landing.astro` |
| `src/pages/api/` | kebab-case `.ts` | `calibration-drift.ts`, `signal-variants.ts` |
| `src/pages/[dynamic]` | `[param].astro` or `[param].ts` | `[id].astro`, `[questionId].ts` |
| `src/scripts/` | kebab-case `.ts` | `generate-question.ts`, `backfill-embeddings.ts` |
| `src/styles/` | kebab-case `.css` | `observatory.css` |
| `src-rs/src/` | snake_case `.rs` | `dynamical.rs`, `motor.rs` |
| `scripts/` | kebab-case `.ts` or `.sql` | `create-postgres-schema.sql` |

### Rules

1. **Lib files**: kebab-case, descriptive. Group related modules in subdirectories (`alice-negative/`)
2. **Components and layouts**: PascalCase. Match Astro convention.
3. **Pages and API routes**: kebab-case. Astro maps these to URL paths directly.
4. **No prefixes on files**. The directory structure provides categorization.
5. **No hyphens in Rust**. Rust uses snake_case per language convention.

### Structure

```
src/
├── assets/         # Static assets (shaders, etc.)
├── components/     # PascalCase.astro
├── layouts/        # PascalCase.astro
├── lib/            # kebab-case.ts (domain logic)
│   └── alice-negative/  # sub-module
├── pages/
│   ├── api/        # kebab-case.ts (API routes)
│   │   ├── observatory/
│   │   └── dev/
│   ├── app/        # kebab-case.astro (authenticated views)
│   ├── observatory/  # kebab-case.astro (designer instrument)
│   └── papers/     # kebab-case.astro (public facing)
├── scripts/        # kebab-case.ts (runnable tasks)
└── styles/         # kebab-case.css

scripts/            # Top-level migration/backfill scripts
├── archive/        # Completed one-off scripts
└── create-postgres-schema.sql

src-rs/             # Rust native signal engine
└── src/            # snake_case.rs
```

---

## Async & State Patterns

**All database calls are async. No exceptions.**

- Every function in `src/lib/db.ts` returns a `Promise`. Every call site must `await`.
- If you add a new db function, it must be `async`.
- API routes (`src/pages/api/*.ts`) are async handlers returning `Response` objects.
- Background jobs (embed, observe, generate, signal computation) fire-and-forget after the HTTP response. Errors go to `data/errors.log` via `src/lib/error-log.ts`.
- The signal pipeline runs Rust natively via napi-rs. If the native module fails to load, it falls back to TypeScript automatically. Both paths are async-compatible.

---
