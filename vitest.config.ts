import { getViteConfig } from 'astro/config';
import { defineConfig } from 'vitest/config';

// Vitest config for Alice.
//
// Hard constraints driving every choice:
//  - The Rust signal engine is loaded via napi-rs as a native .node module.
//    Native modules are not thread-safe in Vitest's default `threads` pool;
//    that pool can segfault on dlopen of platform binaries (Prisma, bcrypt,
//    canvas, napi-rs all hit this). `pool: 'forks'` is the official workaround.
//  - The TS layer must be tested against the real Rust engine, never a mock.
//    The project's stated philosophy ("the instrument cannot have two
//    implementations") forbids a mock — a mock IS a second implementation.
//  - postgres.js + raw SQL with logical FKs requires real Postgres. pg-mem
//    silently lies about pgvector, FOR UPDATE SKIP LOCKED, and HNSW. DB tests
//    use @testcontainers/postgresql.
//
// Three projects:
//   unit  — pure functions, no DB, no Rust. Fast, parallelized.
//   db    — postgres.js against a containerized Postgres. Forked, not threaded,
//           so the connection pool is per-fork and transaction-rollback fixtures
//           stay clean.
//   rust  — exercises the napi boundary against the real .node file.
//           singleFork ensures one process loads the binary once across all
//           tests in the project, avoiding repeated dlopen and matching the
//           production load model.

export default getViteConfig(
  defineConfig({
    test: {
      pool: 'forks',
      poolOptions: { forks: { isolate: true } },
      environment: 'node',
      testTimeout: 15_000,
      hookTimeout: 60_000,
      projects: [
        {
          extends: true,
          test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] },
        },
        {
          extends: true,
          test: {
            name: 'db',
            include: ['tests/db/**/*.test.ts'],
            pool: 'forks',
            // Single shared container per `npm run test:db` invocation.
            // Per-test isolation via TRUNCATE in test files. See globalSetup.ts.
            globalSetup: ['tests/db/globalSetup.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'rust',
            include: ['tests/rust/**/*.test.ts'],
            pool: 'forks',
            poolOptions: { forks: { singleFork: true } },
          },
        },
      ],
    },
  }),
);
