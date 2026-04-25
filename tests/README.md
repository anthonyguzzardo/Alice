# Tests

Three projects, each with strict scope:

- **`unit/`** — pure functions, no DB, no Rust. Fast, parallelized. Best for: signal-family utilities, coercion logic, pure transformations, property-based invariants via `fast-check`.
- **`db/`** — `postgres.js` against a containerized Postgres started by `@testcontainers/postgresql`. Forked, transaction-rollback fixtures per test. Best for: `libDb.ts` cascade-delete paths, `tx`-handle propagation, atomic-claim semantics for `tb_signal_jobs`, anything depending on `FOR UPDATE SKIP LOCKED`.
- **`rust/`** — exercises the napi boundary against the real `.node` file. `singleFork: true` so the binary is `dlopen`'d once across the suite. Never mock the engine — a mock is a second implementation, which the project's measurement-instrument philosophy forbids.

Run:
- `npm test` — single pass, all projects
- `npm run test:watch` — watch mode for the dev loop
- `npm run test:coverage` — V8 coverage report

## Patterns

**DB transaction rollback (preferred for fast tests):**
```ts
beforeEach(async () => { await sql`BEGIN`; await sql`SAVEPOINT t`; });
afterEach(async () => { await sql`ROLLBACK TO SAVEPOINT t`; await sql`ROLLBACK`; });
```

**Concurrency under SKIP LOCKED (no rollback wrap, full COMMIT semantics):**
Use a fresh container per test file. Two concurrent claimers, assert exactly one wins.

**napi parity:**
Hand-craft 3–5 keystroke fixtures with known PE/DFA/RQA outputs (port from Rust unit tests). Prove the marshalling layer doesn't silently corrupt values across the boundary.

## What does NOT belong in tests

- Mocks of the Rust engine. Run the real `.node`.
- `pg-mem` or in-memory PG. Doesn't implement pgvector, `SKIP LOCKED`, advisory locks, or HNSW.
- Snapshot tests of UI components.
- Anything in `alice-negative`.
