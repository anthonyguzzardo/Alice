# Handoff: SQLite Cleanup + Database Restructure + File Prefix Migration + Data Audit (2026-04-19)

## What happened this session

Three major efforts in one session.

1. **SQLite artifact purge** -- exhaustive audit and removal of all SQLite residue from the codebase
2. **Database restructure** -- new `alice` schema, `db/sql/` directory with `dbAlice_*` naming, split tables from seed data
3. **File prefix migration** -- 50 file renames with prefix convention (`lib`, `utl`, `cmp`, `lay`, `sty`), 200+ import path updates across ~70 files

92 files changed total. Build passes clean.

---

## Audit checklist for next conversation

### 1. SQLite removal (verify nothing was missed)

- [ ] `grep -ri sqlite src/` returns zero results
- [ ] `grep -ri sqlite CLAUDE.md` returns zero results
- [ ] `grep -ri sqlite package.json` returns zero results
- [ ] `grep -ri "better-sqlite3" package-lock.json` returns zero results
- [ ] `ls node_modules/better-sqlite3` fails (package removed)
- [ ] `ls node_modules/sqlite-vec` fails (package removed)
- [ ] `src/lib/db-sqlite.ts` does not exist (deleted)
- [ ] `scripts/create-postgres-schema.sql` does not exist (moved to `db/sql/dbAlice_Tables.sql`)

### 2. Database schema migration (verify alice schema works)

- [ ] `psql -d alice -c "SELECT current_schema();"` -- should not matter, search_path handles it
- [ ] `psql -d alice -c "SET search_path TO alice, public; SELECT count(*) FROM tb_questions;"` -- returns 73+
- [ ] `psql -d alice -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'alice' ORDER BY tablename;"` -- should list all 34 tables
- [ ] `psql -d alice -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'tb_%';"` -- should return 0 rows (all moved)
- [ ] `src/lib/libDbPool.ts` has `connection: { search_path: 'alice,public' }` in postgres options
- [ ] `db/sql/dbAlice_Tables.sql` exists and starts with `CREATE SCHEMA IF NOT EXISTS alice;`
- [ ] `db/sql/dbAlice_Seed.sql` exists and has all 6 enum INSERT blocks
- [ ] `db/sql/migrations/001_create_alice_schema.sql` exists

### 3. File renames (verify all prefixes applied correctly)

**Lib files (28 files in `src/lib/`):**
- [ ] No kebab-case `.ts` files remain in `src/lib/` (all should be PascalCase with prefix)
- [ ] `ls src/lib/lib*.ts` shows 25 files (all domain logic)
- [ ] `ls src/lib/utl*.ts` shows 3 files: `utlDate.ts`, `utlErrorLog.ts`, `utlWordLists.ts`
- [ ] `src/lib/alice-negative/` does not exist (renamed to `src/lib/libAliceNegative/`)
- [ ] `ls src/lib/libAliceNegative/lib*.ts` shows 10 files

**Components (3 files):**
- [ ] `ls src/components/` shows only `cmpAppNav.astro`, `cmpFooter.astro`, `cmpPublicNav.astro`

**Layouts (3 files):**
- [ ] `ls src/layouts/` shows only `layApp.astro`, `layBase.astro`, `layPublic.astro`

**Styles (1 file):**
- [ ] `ls src/styles/` shows only `styObservatory.css`

**NOT renamed (by design):**
- [ ] `src/pages/` files are still kebab-case (file-based routing)
- [ ] `src/pages/api/` files are still kebab-case
- [ ] `src/scripts/` files are still kebab-case
- [ ] `src-rs/src/` files are still snake_case

### 4. Import paths (verify no broken references)

- [ ] `npm run build` succeeds with no errors
- [ ] `npx tsc --noEmit 2>&1 | grep "Cannot find module" | grep -v "better-sqlite3\|sqlite-vec\|node:\|observe.ts"` returns zero results
- [ ] No remaining references to old file names in `src/`: `grep -r "alice-negative/" src/` should return zero
- [ ] No remaining references to old lib names: `grep -r "from.*'/db'" src/` or `grep -r "from.*'/date'" src/` should return zero
- [ ] `grep -r "db-pool" src/` returns zero (should be `libDbPool`)
- [ ] `grep -r "error-log" src/` returns zero (should be `utlErrorLog`)
- [ ] `grep -r "word-lists" src/` returns zero (should be `utlWordLists`)
- [ ] `grep -r "signal-pipeline" src/` returns zero (should be `libSignalPipeline`)
- [ ] `grep -r "AppLayout" src/` returns zero (should be `layApp`)
- [ ] `grep -r "BaseLayout" src/` returns zero (should be `layBase`)
- [ ] `grep -r "PublicLayout" src/` returns zero (should be `layPublic`)

### 5. Documentation (verify references updated)

- [ ] `CLAUDE.md` references `db/sql/dbAlice_Tables.sql` not `scripts/create-postgres-schema.sql`
- [ ] `CLAUDE.md` references `libDb.ts`, `libDbPool.ts`, `libSeeds.ts`, `libSignalsNative.ts`, `libEmbeddings.ts`
- [ ] `CLAUDE.md` has CRITICAL: Logical Foreign Keys section with code examples
- [ ] `CLAUDE.md` has Naming Convention section with prefix table and structure tree
- [ ] `CLAUDE.md` has Async & State Patterns section
- [ ] `CLAUDE.EXAMPLE.md` does not exist (merged into CLAUDE.md)
- [ ] `README.md` references `db/sql/dbAlice_Tables.sql`
- [ ] `README.md` references `libSeeds.ts`, `libSignalsNative.ts`, `libDb.ts`
- [ ] No README.md references to `data/alice.db` or SQLite

### 6. Scripts cleanup

- [ ] `scripts/retrigger-background.ts` is in `scripts/archive/` (dead import to non-existent `observe.ts`)
- [ ] `scripts/archive/` contains all 7 completed/dead scripts
- [ ] `scripts/` (non-archive) contains only: `backfill-slice3-history.ts`, `reinterpret.ts`

### 7. End-to-end smoke test

- [ ] `npm run dev` starts without errors
- [ ] Visit `http://localhost:4321` -- page loads
- [ ] Visit `http://localhost:4321/app` -- journal page loads
- [ ] Visit `http://localhost:4321/observatory` -- observatory loads
- [ ] Submit a test response -- background jobs (signals, embeddings, witness) complete without errors in console

---

## Files created this session

```
db/sql/dbAlice_Tables.sql          -- schema definitions (alice schema)
db/sql/dbAlice_Seed.sql            -- enum INSERT statements
db/sql/migrations/001_create_alice_schema.sql  -- one-time migration (already run)
handoff-audit-20260419.md          -- this file
```

## Files deleted this session

```
CLAUDE.EXAMPLE.md                  -- merged into CLAUDE.md
scripts/create-postgres-schema.sql -- moved to db/sql/dbAlice_Tables.sql + dbAlice_Seed.sql
src/lib/db-sqlite.ts               -- dead SQLite module (2274 lines)
```

## Key decisions made

1. **`alice` schema** over staying in `public` -- cleaner namespace, extensions stay in public
2. **`search_path = 'alice,public'`** in connection options -- zero query changes needed
3. **`CREATE ... IF NOT EXISTS` pattern** preserved -- no numbered migrations, schema file is idempotent
4. **Pages/API routes NOT prefixed** -- Astro file-based routing maps filenames to URLs
5. **Scripts NOT prefixed** -- invoked by path, no discoverability benefit
6. **Rust files NOT prefixed** -- already namespaced in src-rs/, snake_case per language convention
7. **`lib` prefix for domain logic, `utl` for utilities** -- 3 utility files (date, error-log, word-lists), everything else is lib

## Post-audit cleanup (same session)

Full audit checklist passed. Then data integrity review uncovered post-mortem artifacts:

### Data cleanup
- Deleted 1 orphaned test row in `tb_session_summaries` (question_id=99999, migration test data from April 18)
- Deleted 20 calibration response embeddings from `tb_embeddings` (pre-pivot artifacts, calibration content was polluting RAG retrieval pool)
- Deleted 3 observation embeddings from `tb_embeddings` (observation pipeline was removed on April 16)
- Final embedding state: 7 seed-question response embeddings, all correct

### Code cleanup
- Removed `embedObservation()` and `embedReflection()` from `libEmbeddings.ts` (dead since April 16 pivot)
- Removed `getUnembeddedObservations()` and `getUnembeddedReflections()` from `libDb.ts`
- Stripped observation/reflection backfill loops from `backfillEmbeddings()`
- Added `question_source_id != 3` filter to `getUnembeddedResponses()` so calibration responses are excluded from embedding, including via backfill

### Pipeline status
- All 5 signal families (dynamical, motor, process, semantic, cross-session) computing on every new entry
- Embeddings correctly scoped: only seed/generated question responses get embedded, calibration responses do not
- Verified with live calibration submission (question 76, response 51): all signals computed, no embedding created

## Known pre-existing issues (not caused by this session)

- `scripts/backfill-slice3-history.ts` and `scripts/reinterpret.ts` have missing `await` calls on async functions (pre-existing TypeScript errors)
- `scripts/archive/backfill-motor-signals-phase2.ts` references `../src/lib/libMotorSignals.ts` with wrong relative path (was broken before rename too, path is from pre-archive location)
