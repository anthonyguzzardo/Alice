# Alice TypeScript Codebase Audit

## 1. Verdict

**Good as correct.** The code is mostly correct in the small. SQL parameterization is universally safe (tagged templates throughout), nullability is modeled at the interface level, and the JSONB auto-parse gotcha is handled consistently. But there are correctness bugs that matter. The `respond.ts` transaction block calls `libDb.ts` functions that use the *module-level* `sql` connection, not the transaction-scoped `sql` parameter; every write inside that "transaction" runs on its own connection. `saveCalibrationSession` has the same defect by omission. In the signal computation layer, `sampleEntropy` in `libMotorSignals.ts` caps its input to 500 points into a variable that is never referenced; the O(n^2) inner loop runs uncapped. The I-burst detection in `libProcessSignals.ts` is a tautology that classifies any burst with inserted text > 2 chars as an I-burst regardless of cursor position. Multi-word phrases in the word-list Sets can never match the single-word tokenization used by callers.

**Good as idiomatic TypeScript.** Mixed. The `libDb.ts` interfaces are well-typed with honest nullability. The signal pipeline types are precise. But idiomatic TS was abandoned in the observatory handlers: `as any[]` casts 30+ times, `err: any` in 8 catch blocks, and `as unknown as SessionSummaryInput` double-casts that launder the type system. The codebase declares `strict: true` via Astro's strict preset but does not enable `noUncheckedIndexedAccess`, so every `rows[0]` access is a lie about nullability that the compiler endorses. A TS native would have caught this.

**Good as maintainable.** The naming convention is followed with near-perfect consistency. The `lib`/`utl` prefix system does real work. `libDb.ts` reads as a table of contents. Module boundaries are clean. The weak points: the observatory API layer bypasses `libDb.ts` entirely and embeds raw SQL with inline `as any` casts, creating a shadow data-access layer. The 70-field `SessionSummaryInput` mapping is duplicated verbatim between `respond.ts` and `calibrate.ts`. Inline text-metric computation (MATTR, sentence stats) is copy-pasted between both handlers. 10+ pages bypass the layout system with standalone `<html>` skeletons duplicating CSS variables and theme-init scripts. The `signedPearson` function is duplicated identically in `libDynamics.ts` and `libEmotionProfile.ts`. Utility functions (`extractIKI`, `mean`, `std`) are duplicated across `libDynamicalSignals.ts` and `libMotorSignals.ts`.

**Good as appropriately-sized.** Mostly yes. This feels like a single-user application, not a framework in search of a problem. No abstract repositories, no dependency injection, no `zod` at internal boundaries. The one over-engineering signal is the archived stub functions: 15+ synchronous no-op stubs retained for import compatibility, when the correct move is to delete the callers. The `alice-negative.ts` API handler at ~470 lines of inline signal computation is the opposite problem: under-engineered, with domain logic that belongs in `src/lib/`. `libSignalRegistry.ts` may be entirely dead code since the prediction system was archived.

**Good as honestly scoped.** The codebase is nearly there. The philosophy ("depth over speed") is visible in the signal pipeline's careful null handling and the measurement-instrument framing of the Rust boundary. The auth pages are un-cleaned-up residue from a multi-user prototype, complete with footer links that route users through a fake login form. The `PipelineCoverage.observed: true` / `suppressedQuestion: true` hardcodes in `health.ts` are dead-code pretending to still participate. Six PostgreSQL scripts never close the connection pool, causing process hangs on success.

**Synthesis:** A senior dev inheriting this Monday would think by Friday: "Someone who thinks like an engineer built this, the domain model is precise and the conventions are real, but they've been moving fast and the observatory layer was bolted on with `as any` as accelerant. The transaction bug needs fixing before the next session submission. The `sampleEntropy` cap bug means the TS fallback has different performance characteristics than assumed. The rest is cleanup, not redesign."

---

## 2. Findings

| ID | Severity | Lens | File:Line(s) | Finding | Why it matters | Fix |
|---|---|---|---|---|---|---|
| F-01 | Critical | Correct | `src/pages/api/respond.ts:66-196` | **Transaction is a no-op.** `sql.begin(async (sql) => {...})` shadows `sql`, but `saveResponse()`, `saveBurstSequence()`, `saveSessionSummary()`, `saveSessionEvents()`, `updateDeletionEvents()`, `saveSessionMetadata()` all use the module-level `sql` from `libDbPool.ts`. Every write runs on a separate connection outside the transaction. The comment "All DB writes in a single transaction" (line 62) is false. | If `saveSessionSummary` fails mid-way, the response is committed but the summary is absent, triggering the `sessionsMissingSummary` anomaly in `health.ts`. | The `libDb.ts` functions need to accept an optional `sql` parameter (the transaction handle), or `respond.ts` must inline the SQL. The simplest fix: have `saveResponse` etc. accept an optional `sql` override. |
| F-02 | Critical | Correct | `src/lib/libDb.ts:742-762` | **`saveCalibrationSession` is not transactional.** Three sequential inserts (question, response, session summary) with no `sql.begin`. If `saveSessionSummary` fails, the question and response rows are committed as orphans. | Calibration sessions are the measurement baseline; a half-saved calibration corrupts drift calculations silently. | Wrap in `sql.begin`. |
| F-03 | Critical | Correct | `src/lib/libMotorSignals.ts:66-96` | **`sampleEntropy` performance cap is a no-op.** Line 91 creates `capped = series.slice(-500)` but `countMatches` (line 73) closes over the outer `series` and `N` variables, not `capped`. The O(n^2*m) inner loop runs on the full uncapped series. | The TS fallback path will be quadratically slower than expected on long keystroke sessions. The Rust implementation presumably has its own correct cap, so this divergence means the TS fallback produces different performance (and potentially different values if the cap changes the tail window). | Change `countMatches` to use `capped` and `capped.length` instead of `series` and `N`, or refactor to pass the array as a parameter. |
| F-04 | Major | Correct | `src/lib/libProcessSignals.ts:184` | **I-burst detection is a tautology.** `firstEvent[1] < (firstEvent[1] + firstEvent[3].length - 2)` simplifies to `firstEvent[3].length > 2`. This classifies any burst with inserted text > 2 chars as an I-burst, regardless of cursor position. The comment on line 185-186 acknowledges this: "A better check would compare cursorPos to text length at that moment." | I-burst counts in the process signals are inflated. Every non-trivial burst with no deletion is counted as an I-burst, which is wrong. The Rust `process.rs` implementation likely has a different (correct) heuristic, so Rust and TS fallback diverge semantically. | Implement actual mid-text detection: compare `firstEvent[1]` (cursorPos) to the reconstructed text length at that point in the event stream. |
| F-05 | Major | Correct, Idiomatic | `tsconfig.json` | **`noUncheckedIndexedAccess` is not enabled.** The codebase indexes `rows[0]` in 50+ places. Without this flag, `rows[0]` has type `T` instead of `T \| undefined`, masking potential runtime errors on empty result sets. | Astro's strict preset only enables `strict: true`, which does not include `noUncheckedIndexedAccess`. The code *manually* handles `?? null` in most places, but the compiler isn't enforcing it. | Add `"noUncheckedIndexedAccess": true` to `tsconfig.json` `compilerOptions` and fix the resulting errors. |
| F-06 | Major | Idiomatic, Maintainable | `src/pages/api/observatory/entry/[id].ts:31,51,123,134,142,149,189,196` `src/pages/api/observatory/states.ts:28,40,52,64,77` `src/pages/api/observatory/synthesis.ts:47,54,66,73,82,89,96` `src/pages/api/alice-negative.ts:230,354,395` | **Pervasive `as any` in observatory and alice-negative handlers.** 30+ instances of `as any[]` or `as any` on SQL results. These files bypass `libDb.ts` entirely, using raw `sql` imports and casting results to `any`, defeating the type system. | `CLAUDE.md` claims "TypeScript (strict)." These handlers are strict in name only. Any schema change to these tables will produce silent runtime errors instead of compile-time catches. | Create typed query functions in `libDb.ts` for each of these queries, then replace inline SQL in the handlers. |
| F-07 | Major | Correct | `src/pages/api/respond.ts:23` `src/pages/api/calibrate.ts:22` `src/pages/api/event.ts:5` `src/pages/api/feedback.ts:5` `src/pages/api/comments.ts:20` `src/pages/api/dev/linguistic.ts:9` | **`request.json()` is never wrapped in try/catch.** If the client sends malformed JSON, `request.json()` throws and the error propagates as an unhandled 500 with a stack trace in every POST handler. | Single-user app reduces exposure, but the fix is trivial. | Wrap in try/catch returning 400, or add a shared `parseBody` helper. |
| F-08 | Major | Correct, Maintainable | `src/pages/api/calibrate.ts:136` | **Fire-and-forget promise without `.catch()`.** `runCalibrationExtraction(questionId, text.trim(), prompt)` returns a Promise that is neither awaited nor `.catch()`'d. The function has an internal try/catch (logging to `console.error` instead of `logError`). | `CLAUDE.md` states: "Errors go to `data/errors.log` via `utlErrorLog.ts`." This error path goes to stdout and vanishes. | Either `await` it or add `.catch(err => logError('calibrate.extraction', err, { questionId }))`. Also change the internal `console.error` to `logError` in `libCalibrationExtract.ts:199`. |
| F-09 | Major | Idiomatic | 8 locations across `src/pages/api/` and `src/lib/libEmbeddings.ts` | **`catch (err: any)` in 8 locations.** TypeScript strict mode types caught errors as `unknown`. `any` is used to access `.message`, `.statusCode`. | The `err: any` in `libEmbeddings.ts:61` is justified (Voyage SDK error shape). The other 7 are lazy. | Replace with `catch (err)` and use `(err as Error).message` or `err instanceof Error` guard. Keep `libEmbeddings.ts` as-is. |
| F-10 | Major | Maintainable | `src/pages/api/respond.ts:88-165` `src/pages/api/calibrate.ts:45-119` | **70-field `SessionSummaryInput` mapping duplicated verbatim.** The field-by-field `sessionSummary.X ?? null` mapping appears in both handlers, nearly identically. | Any new field must be added in both places. Most likely source of future bugs. | Extract a `buildSessionSummaryInput(raw, densities, mattrValue, avgSentLen, sentLenVar): SessionSummaryInput` function. |
| F-11 | Major | Honest scope | `src/pages/auth/login.astro` `src/pages/auth/signup.astro` `src/components/cmpFooter.astro:21-23` `src/pages/landing.astro:82` | **Auth pages exist in a "no auth" app, and are linked from the footer and landing page.** Login page has `// TODO: real auth` with a "Skip to app (dev bypass)" link. The footer component actively routes users through this fake auth flow. | `CLAUDE.md` says "Single user, no auth." These pages create a misleading user experience. | Delete both auth pages. Remove auth links from `cmpFooter.astro` and `landing.astro`. |
| F-12 | Major | Correct | `src/pages/api/today.ts` `src/pages/api/event.ts` `src/pages/api/comments.ts` `src/pages/api/feedback.ts` `src/pages/api/gallery.ts` | **5 API handlers have no try/catch at all.** If any database call throws, the server returns a 500 with a stack trace. No logging, no structured error response. | These are user-facing endpoints. A DB connection failure surfaces as an unformatted error. | Add try/catch with structured error response, at minimum. |
| F-13 | Major | Correct | `src/lib/libGenerate.ts:341` | **Unsafe `as` cast on Claude API response.** `(message.content[0] as { type: 'text'; text: string }).text` without checking that `content[0].type === 'text'`. If the API returns a tool_use block first, this crashes. | The API call uses no tools, so text is the expected response type. But a future change could break this silently. | Add a guard: `const block = message.content.find(b => b.type === 'text')`. |
| F-14 | Major | Correct | `src/lib/utlWordLists.ts:27,36,49` | **Multi-word phrases in Sets are dead data.** Entries like `'without doubt'`, `'on the other hand'`, `'as a result'` in `BOOSTER_WORDS`, `HEDGE_WORDS`, `CAUSAL_CONNECTIVES` etc. can never match when callers tokenize by whitespace. | Density calculations for hedging, causal connectives, and boosters undercount. | Either remove multi-word entries or implement n-gram matching in the tokenizer. |
| F-15 | Minor | Maintainable | `src/pages/api/alice-negative.ts` (entire file) | **~470 lines of domain logic in an API handler.** `computeShapeMetrics`, `deriveSession`, `computeVolatility`, `computeDeviation`, `computeOutlierFreq` are all inline. | The handler should call a single function from `src/lib/`. | Extract computation to `src/lib/libAliceNegativeSignals.ts`. |
| F-16 | Minor | Correct | `src/pages/api/observatory/entry/[id].ts:220` `+6 similar` | **Error detail leakage to client.** Seven observatory handlers return `detail: err?.message` in the 500 response body. If this is a DB or internal error, it leaks implementation details. | Single-user app reduces risk, but it's bad practice. | Omit `detail` from error responses, or log it server-side only. |
| F-17 | Minor | Correct, Maintainable | 6 scripts in `src/scripts/` and `scripts/` | **PostgreSQL scripts never close the connection pool.** All active scripts using `sql` from `libDbPool.ts` never call `sql.end()`. Processes hang after completion unless `process.exit()` is called. `backfill-signals.ts` and `backfill-process-signals.ts` have no explicit exit on success. | Scripts hang indefinitely after completing their work. | Add `await close()` (from `libDbPool.ts`) before exiting, or call `process.exit(0)` on success. |
| F-18 | Minor | Correct | `scripts/reinterpret.ts:33-37` | **Destructive deletes without transaction.** `DELETE FROM tb_entry_states`, `tb_trait_dynamics`, etc. run outside a transaction. If the rebuild fails mid-way, the tables are empty. | This is a manual re-computation script, not automated. But the data loss risk is real. | Wrap the delete+rebuild in a single transaction. |
| F-19 | Minor | Correct | `scripts/reinterpret.ts:262` `scripts/backfill-slice3-history.ts:262` | **Fire-and-forget async calls missing `await`.** `snapshotCalibrationBaselinesAfterSubmit(null)` is async but called without `await`. May not complete before process exit. | Silent data loss: the snapshot is requested but never confirmed. | Add `await`. |
| F-20 | Minor | Honest scope | `src/pages/api/health.ts:106-109` | **`observed: true` and `suppressedQuestion: true` hardcoded** in pipeline coverage. Archived features report as always passing. | Misleading: 100% coverage for checks that don't exist. | Remove these fields from `PipelineCoverage`. |
| F-21 | Minor | Maintainable | `src/pages/api/observatory/*.ts` | **Observatory handlers bypass `libDb.ts`.** `states.ts`, `synthesis.ts`, `entry/[id].ts` import `sql` directly. ~40+ raw SQL queries create a shadow data-access layer. | Schema changes won't be caught. | Move queries into `libDb.ts` as typed functions. |
| F-22 | Minor | Maintainable | 10+ `.astro` pages | **Pages bypass the layout system.** `index.astro`, `gallery.astro`, `papers/*.astro`, `dev/*.astro`, `observatory/*.astro`, `alice-negative*.astro` all define standalone `<html>` with duplicated CSS variables and theme-init scripts instead of using `layBase.astro`. | Theme changes must be replicated across 10+ files. | Use layouts consistently, or at minimum extract the CSS variables to a shared file. |
| F-23 | Minor | Correct | `src/lib/libAliceNegative/libInterpreter.ts:233` | **Silent JSON parse failure.** `try { return JSON.parse(lastRow.traits_json) as WitnessTraits; } catch {}` swallows parse errors with no logging. | Corrupted traits_json would silently produce null witness state. | Add `logError` or `console.error` in the catch. |
| F-24 | Minor | Idiomatic | `src/lib/libSignalFamilies.ts:415,418` | **`(ablated[i] as any)[dim]` for dynamic property access.** Three instances of `as any` to index a typed struct by string key. | Defeats struct type safety. | Use `Record<string, number>` intersection or an accessor helper. |
| F-25 | Minor | Idiomatic | `src/lib/libSignals.ts:676` | **`(cal as any).responseText`** accesses a property from the intersection return type that isn't on the base `SessionSummaryInput`. | Type hole. | Type the variable as `SessionSummaryInput & { date: string; responseText: string }`. |
| F-26 | Minor | Correct | `src/lib/libDb.ts:716-730` + 15 stubs | **Archived stubs are synchronous, violating "all db calls async."** `saveAiObservation()`, `getAllAiObservations()`, etc. return values synchronously. | `CLAUDE.md`: "All database calls are async. No exceptions." These are exceptions. | Delete them and remove callers. |
| F-27 | Minor | Maintainable | `src/lib/libDynamics.ts:150-164` `src/lib/libAliceNegative/libEmotionProfile.ts:183-198` | **`signedPearson` duplicated identically** between two files. | DRY violation. | Extract to `libHelpers.ts`. |
| F-28 | Minor | Maintainable | `src/lib/libDynamicalSignals.ts` `src/lib/libMotorSignals.ts` | **`extractIKI`, `mean`, `std` duplicated** across both signal computation modules. | | Extract shared math utilities to `utlMath.ts` or `libHelpers.ts`. |
| F-29 | Minor | Honest scope | `src/lib/libSignalRegistry.ts` (entire file) | **Potentially dead code.** Built for the prediction system which was archived 2026-04-16. If no active code references `SIGNAL_REGISTRY`, `isValidSignal`, or `getSignalCatalog`, this entire module is dead. | 225 lines of dead code. | Verify references and delete if unused. |
| F-30 | Nit | Idiomatic | `src/lib/libEmbeddings.ts:18` | **Unused constant.** `EMBEDDING_DIMENSIONS = 512` is declared but never referenced. | Dead code. | Delete it. |
| F-31 | Nit | Idiomatic | `src/lib/libSignalFamilies.ts:15` | **Unused import.** `stddev` imported from `libHelpers.ts` but never used. | Dead import. | Remove it. |
| F-32 | Nit | Idiomatic | `src/lib/utlWordLists.ts:25` | **Duplicate entry.** `'proves'` appears twice in `BOOSTER_WORDS`. | Benign (Set deduplicates), but sloppy. | Remove the duplicate. |
| F-33 | Nit | Convention | `src/pages/observatory/replay/[questionId].astro` | **camelCase in dynamic route parameter.** Convention says pages use kebab-case. Should be `[question-id].astro`. | Minor naming inconsistency. | Rename if Astro supports it without breaking the route. |
| F-34 | Nit | Maintainable | `src/pages/api/respond.ts:53-60` `src/pages/api/calibrate.ts:36-43` | **Inline text-metric computation duplicated.** MATTR, sentence length, and sentence variance calculations are copy-pasted. | Should live in a utility. | Extract to a shared function. |
| F-35 | Nit | Maintainable | `src/lib/libDb.ts:537-576,657-700,894-935` | **Session summary column list repeated 4 times.** Any new column must be added in 4+ places. | | Use `SESSION_SUMMARY_COLS` via `sql.unsafe` consistently. |
| F-36 | Nit | Maintainable | `src/lib/libAliceNegative/libHelpers.ts` | **`libHelpers.ts` contains generic math utilities** (`avg`, `variance`, `stddev`, `clamp`, `percentileRank`) that should be `utl`-prefixed per the naming convention. | `lib` prefix implies domain logic; these are domain-agnostic. | Rename to `utlMath.ts` or `utlStats.ts`, or keep but acknowledge the convention exception. |

---

## 3. Rubric Interrogation

### 1. Logical Foreign Keys

**Earning its keep.** The CRITICAL framing is justified. Every JOIN in `libDb.ts` is correct, and the pattern is followed consistently. Where it's **under-stated**: the doc says "application code is responsible for consistency when inserting or deleting across tables," but there is no documented cleanup function per parent entity. The `scripts/reinterpret.ts` file has bare `DELETE FROM tb_entry_states` without cascade logic, which is fine only because it deletes *all* rows. A future single-row delete will create orphans unless someone remembers to check `CLAUDE.md`. The doc should name the downstream tables for each parent table, not just state the principle.

### 2. Database Conventions

**Earning its keep.** Table prefixes (`te_`, `td_`, `tb_`, `tm_`, `th_`), surrogate key naming (`table_name_id`), footer columns, header comments: all followed in `dbAlice_Tables.sql`. The "no ALTER TABLE" rule applies specifically to the schema file (`dbAlice_Tables.sql`), not to migration files. The schema file should always read as a complete, intact script, not something glued together with ALTER TABLE patches. Migration files in `db/sql/migrations/` are the correct place for incremental changes, and their existence does not contradict the rule. This convention is followed correctly.

### 3. camelCase SQL Alias Quoting

**Earning its keep.** Consistently followed in `libDb.ts` and wherever typed query functions are used. The convention holds where it matters. The observatory handlers that bypass `libDb.ts` generally get this right too.

### 4. Naming Convention

**Earning its keep across all prefix types.** The prefix system is not about redundancy with the directory; it's about identification when the file appears out of context: in a search result, a stack trace, an import line, a tab bar with 15 tabs open. `cmpAppNav` tells you it's a component without seeing the path. `layBase` tells you it's a layout. `styObservatory` tells you it's a stylesheet. This is the same principle as `lib`/`utl` applied uniformly, and all prefixes pull their weight equally. The `lib`/`utl` distinction does additional semantic work (domain logic vs generic helper), but `cmp`/`lay`/`sty` earn their keep through context-free identification. Compliance is near-perfect across the codebase. One exception: `libAliceNegative/libHelpers.ts` contains generic math utilities (`avg`, `variance`, `stddev`, `clamp`, `percentileRank`) that should be `utl`-prefixed. One other: `observatory/replay/[questionId].astro` uses camelCase instead of kebab-case in the dynamic segment.

### 5. All Database Calls Async

**Contradicted** by the archived stubs (F-26). 15+ functions are synchronous no-ops. The principle is sound and followed by every *active* function. The stubs are the gap.

### 6. Background Jobs Fire-and-Forget with `utlErrorLog`

**Partially earning its keep.** `respond.ts` follows this perfectly: the background IIFE on lines 217-227 wraps each stage in try/catch with `logError`. `libSignalPipeline.ts` also follows it consistently. **Contradicted** in: `calibrate.ts:136` fires `runCalibrationExtraction` without `.catch()` and it logs to `console.error`. All 8 observatory handlers use `console.error` for catch blocks. `libCalibrationExtract.ts:199`, `libAliceNegative/libInterpreter.ts:225,253`, and multiple other lib modules log to `console.error` instead of `logError` for non-background errors.

### 7. Signal Pipeline Loads Rust with Automatic TS Fallback

**Earning its keep, with a nuance the doc under-states.** The fallback is genuinely transparent: same function signatures, same return types, `undefined`-to-`null` coercion handled correctly. The **under-stated** nuance: the fallback is *silent*. If the `.node` file fails to load, the only signal is a `console.warn` at startup. There is no persistent record that the app is running in degraded mode. A health endpoint check for `hasNativeEngine` would close this gap. Additionally, the TS fallback has two semantic divergences from Rust: the `sampleEntropy` cap bug (F-03) and the I-burst tautology (F-04). These mean the TS fallback doesn't just have different performance; it produces different *values*.

### 8. TypeScript is Strict

**Partially earning its keep.** `strict: true` is on via Astro's preset. But `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are not enabled. The 30+ `as any` casts in the observatory layer and the 8 `catch (err: any)` patterns are violations in spirit. The core `lib/` layer genuinely adheres to strict TypeScript. The `pages/api/observatory/` layer does not.

### 9. Known Gotchas

**Earning its keep.** The VoyageAI `createRequire` typing is handled exactly as described. JSONB auto-parsing is handled correctly in every `get*` function in `libDb.ts`. The Rust module loading uses `createRequire` as described. These gotchas are real, documented, and addressed.

### 10. Philosophy: Depth Over Speed

**Earning its keep in the domain layer, contradicted in the observatory layer.** The signal pipeline, the Rust boundary, the question generation, the calibration extraction: all show careful thought. The observatory handlers show speed over depth: `as any` everywhere, inline SQL, no types on response objects, `~470 lines of computation logic in `alice-negative.ts` that belongs in a lib module. The philosophy holds where the author cares most (the measurement instrument, the daily question) and slips where the UI needed to ship quickly.

---

## 4. The `libDb.ts` Review

`libDb.ts` is a 2,123-line file that serves as the entire data-access layer. It exports ~60 functions covering questions, responses, session summaries, burst sequences, session metadata, calibration baselines, session events, embeddings, prompt traces, witness states, entry states, semantic states, trait dynamics, coupling matrices, predictions (archived), calibration context, session deltas, and paper comments.

**Shape of the surface:** The file reads like a table of contents for the domain. Functions are grouped by entity with section comments. Naming is consistent: `get*`, `save*`, `getAll*`, `is*`. Return types are explicit with honest nullability (`T | null` for single-row queries, `T[]` for multi-row). The `SessionSummaryInput` interface at 70+ fields is enormous but reflects a genuinely wide table.

**Async correctness:** Every active function is `async` and returns `Promise<T>`. The archived stubs break this rule (F-26). All `await` usage is correct.

**JOIN correctness under logical FKs:** Every JOIN is correct. The canonical pattern (tagged template, `ON r.question_id = q.question_id`) is followed uniformly. No orphan-creating deletes exist in this file.

**camelCase alias discipline:** Excellent. Every camelCase alias is double-quoted (`AS "questionId"`, `AS "totalDurationMs"`). The only unquoted aliases are lowercase (`AS date`, `AS question`, `AS response`, `AS count`, `AS c`) which are correctly lowercase.

**JSONB handling:** Handled correctly in `getSessionEvents` (lines 473-484), `getLatestWitnessState` (lines 1082-1089), `getDynamicalSignals` (lines 1937-1943), and `getMotorSignals` (lines 1992-1998). The pattern `typeof row.x === 'object' ? JSON.stringify(row.x) : row.x as string` is consistent and correct.

**Transactional boundaries:** `saveBurstSequence`, `saveSemanticDynamics`, `saveSemanticCoupling`, `saveTraitDynamics`, `saveCouplingMatrix`, `saveEmotionBehaviorCoupling`, and `saveCalibrationContext` all correctly use `sql.begin` for multi-row inserts. **Missing:** `saveCalibrationSession` (F-02) should be transactional but isn't.

**What's wrong:** The file has grown past what one module should hold. The 15 archived stub functions add 100+ lines of dead weight. The `SESSION_SUMMARY_COLS` constant and the 4 functions that repeat its column list are a maintenance hazard. The `sql.unsafe` usage for `SESSION_SUMMARY_COLS` is a reasonable DRY trade-off but should be documented. The biggest structural issue is that every function uses the module-level `sql` binding with no way for callers to pass a transaction handle, making the `respond.ts` transaction (F-01) impossible to implement correctly without refactoring.

---

## 5. The napi Boundary Review

`libSignalsNative.ts` is 172 lines of clean boundary code. It does exactly what the doc says: loads the native module via `createRequire`, defines a `NativeModule` interface with typed return shapes, and provides three exported functions that try Rust first and fall back to TypeScript.

**Fallback transparency:** Transparent in the good sense. Each function checks `if (!native) return computeXTS(...)` and catches Rust-side exceptions, falling back with a `console.error` log. The TypeScript fallback functions are imported directly and produce the same types (`DynamicalSignals`, `MotorSignals`, `ProcessSignals`), so callers see identical shapes regardless of path.

**Shape fidelity:** The Rust output shape (defined in the `NativeModule` interface) maps field-by-field to the TypeScript types. The `n()`, `na()`, `ns()` coercion helpers handle `undefined`-to-`null` conversion for every nullable field. This is correct: `postgres.js` rejects `undefined` but accepts `null`. The `ikiCount` and `holdFlightCount` fields get `?? 0` instead of `n()`, which is intentional (counts default to zero, not null).

**Semantic drift risk:** Two TS fallback bugs mean Rust and TypeScript produce different values, not just different performance:
- `sampleEntropy` cap is bypassed in TS (F-03): the TS fallback runs O(n^2) on the full series while Rust presumably caps correctly.
- I-burst detection in TS (F-04) is a tautology that overcounts. The Rust `process.rs` likely has a correct cursor-position check.

This means the "automatic fallback" isn't just slower; it can produce materially different signal values. A session processed via TS fallback and one processed via Rust will have different motor and process signals for the same keystroke data.

**Digraph latency shape:** The Rust path returns `digraphLatencyProfile` as a JSON string (line 132-133), which is `JSON.parse`'d into `Record<string, number>`. No validation on the parsed shape. If Rust changes the JSON structure, the parse succeeds but the type is wrong.

**Production visibility:** If the native module fails to load, the only signal is a `console.warn` at startup. `hasNativeEngine` is exported but nothing in the health endpoint checks it. In production, degraded mode is invisible to the operator.

---

## 6. Patterns Observed

**Good patterns:**
- Consistent use of `postgres.js` tagged templates for SQL parameterization. Zero string concatenation in queries.
- The `logError` / `utlErrorLog.ts` pattern is well-designed: structured, timestamped, persistent. Where it's used, it works.
- The `n()`/`na()`/`ns()` coercion pattern in `libSignalsNative.ts` is a clean solution to the Rust `Option::None` -> JS `undefined` -> `postgres.js` rejection chain.
- Interface-first DB functions with explicit nullability. The `SessionSummaryInput`, `EntryStateRow`, `SemanticStateRow` etc. are honest about what can be null.
- The `libSignalPipeline.ts` error isolation pattern (independent try/catch per signal family with existence-check guards) is the right architecture for fire-and-forget derived computation.

**Bad patterns:**
- `as any` as an accelerant in the observatory layer. The pattern is always the same: `` sql`SELECT...` as any[] ``, followed by property access on untyped objects. This is JS-with-extra-steps, not TypeScript.
- Console-based error reporting in handlers that should use `logError`. The inconsistency means errors from different parts of the app go to different sinks.
- Module-level `sql` binding makes transaction propagation impossible. Every `libDb.ts` function is hardwired to the connection pool, with no way to participate in a caller-provided transaction. This is the root cause of F-01 and F-02.
- The `body` from `request.json()` is always treated as a trusted shape with no malformed-JSON defense and no runtime shape validation.
- Function and utility duplication across modules (`signedPearson`, `extractIKI`, `mean`, `std`, MATTR+sentence-length computation). Each instance is individually reasonable but the aggregate creates maintenance surface area.
- Pages that bypass layouts, duplicating CSS variable definitions and theme-init scripts across 10+ standalone `.astro` files.

---

## 7. What's Notably Right

- **The logical FK pattern with camelCase-aliased JOINs in `libDb.ts` is executed with near-perfect consistency across 60+ functions.** The reference implementation in `getCalibrationSessionsWithText()` is exactly the right shape to point new contributors at. A mid-level engineer would have forgotten the double quotes on at least a few aliases.

- **The `libSignalsNative.ts` fallback architecture is genuinely well-designed.** Three coercion helpers, per-function try/catch with fallback, typed interface for the native module, and performance logging. The separation of concerns between the napi boundary, the TS implementations, and the persistence layer is clean.

- **The `libSignalPipeline.ts` error isolation pattern is correct and load-bearing.** Each signal family is computed in its own try/catch with `logError`, and an existence check prevents re-computation. A failure in motor signals doesn't block process signals, and a re-run is idempotent.

- **The health endpoint (`health.ts`) is a thoughtful piece of operational tooling.** Pipeline coverage checks, anomaly detection (duplicate questions, missing summaries), error log surfacing, and typed response interface. For a single-user app, this is unusually mature.

---

## 8. Convention Compliance Table

| Directory | Convention | Compliance | Exceptions | Notes |
|---|---|---|---|---|
| `src/lib/` | `lib`/`utl` prefix + PascalCase `.ts` | ✓ | `libAliceNegative/libHelpers.ts` should be `utl`-prefixed | Strong adherence |
| `src/lib/libAliceNegative/` | `lib` prefix + PascalCase `.ts` | ✓ | `libHelpers.ts` (see above) | |
| `src/components/` | `cmp` prefix + PascalCase `.astro` | ✓ | None | 3 files, all compliant |
| `src/layouts/` | `lay` prefix + PascalCase `.astro` | ✓ | None | 3 files, all compliant |
| `src/styles/` | `sty` prefix + PascalCase `.css` | ✓ | None | 1 file, compliant |
| `src/pages/` | kebab-case `.astro`, no prefix | partial | `observatory/replay/[questionId].astro` uses camelCase in dynamic segment | |
| `src/pages/api/` | kebab-case `.ts`, no prefix | ✓ | None | |
| `src/pages/auth/` | kebab-case `.astro`, no prefix | ✓ | N/A (should be deleted, F-11) | |
| `src/scripts/` | kebab-case `.ts`, no prefix | ✓ | None | 4 files, all compliant |
| `scripts/` | kebab-case `.ts`, no prefix | ✓ | None | |
| `scripts/archive/` | kebab-case `.ts`, no prefix | ✓ | None | |
| `db/sql/` | `dbAlice_` prefix + PascalCase `.sql` | ✓ | `migrations/` uses `NNN_description.sql` | Migrations are a reasonable exception |

---

## 9. Recommended Sequence

1. **Fix the transaction bug (F-01, F-02).** Add an optional `sql` parameter to the core `libDb.ts` write functions (`saveResponse`, `saveBurstSequence`, `saveSessionEvents`, `saveSessionSummary`, `updateDeletionEvents`, `saveSessionMetadata`). Wrap `saveCalibrationSession` in `sql.begin`. This is the only correctness bug that can silently corrupt data on the next session submission.

2. **Fix the `sampleEntropy` cap bug (F-03).** Change `countMatches` to operate on `capped` instead of `series`. Verify the Rust implementation handles this correctly to confirm the TS fallback should match.

3. **Fix the I-burst tautology (F-04).** Implement actual cursor-position-relative detection, or align the heuristic with whatever the Rust `process.rs` does.

4. **Enable `noUncheckedIndexedAccess` (F-05).** This will surface ~50 `rows[0]` access sites. Most already have guards; the compiler will catch the ones that don't.

5. **Extract the session-summary mapping and text-metric computation (F-10, F-34).** Create shared functions that both `respond.ts` and `calibrate.ts` call. Eliminates the largest duplication.

6. **Type the observatory handlers (F-06).** Move inline SQL into `libDb.ts` as typed functions. Eliminates 30+ `as any` casts. Also extract the ~470-line `alice-negative.ts` computation into a lib module (F-15).

7. **Wrap `request.json()` in try/catch and add try/catch to unguarded handlers (F-07, F-12).** Mechanical, covers 11 handlers total.

8. **Fix error routing (F-08, F-09).** Change `runCalibrationExtraction` and observatory handlers to use `logError`. Replace `catch (err: any)` with `catch (err)`.

9. **Delete dead code (F-11, F-20, F-26, F-29, F-30, F-31, F-32).** Auth pages, archived stubs, hardcoded pipeline fields, potentially-dead `libSignalRegistry.ts`, unused constants/imports.

10. **Add `hasNativeEngine` to the health endpoint and fix multi-word phrase matching (F-14).** One-line health addition. For word lists, either implement n-gram matching or remove the multi-word entries and document the limitation.
