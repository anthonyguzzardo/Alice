# Migration 030 — Step 8: Encryption Uniformity

Landed 2026-04-27. Step 8 of the unification plan brings every subject-bearing
text and JSONB column under a single encrypted-at-rest discipline. The threat
model is unchanged from the libCrypto v1 design: Supabase is a hosted third
party; subject content (journal text, calibration prompts, AI reflections,
keystroke streams) must land there as gibberish so a DB breach, rogue admin
read, or accidental dump does not expose anyone's writing.

## What it produces

Every column in the in-scope inventory (§1) is replaced with two columns:

```
<col>           TEXT/JSONB  →  removed
<col>_ciphertext TEXT       →  base64 of AES-256-GCM ciphertext + 16-byte auth tag
<col>_nonce      TEXT       →  base64 of 12-byte random nonce
```

Writes encrypt before INSERT; reads decrypt before returning to the caller.
The encryption boundary lives at libDb — application code above libDb sees
strings on the way in and strings on the way out, never ciphertext. Direct
SELECTs against encrypted columns outside libDb are forbidden by convention,
and the codebase contains zero such sites today (§4).

## §1 Columns encrypted

| Table | Plaintext column | New columns |
|---|---|---|
| `tb_responses` | `text` | `text_ciphertext`, `text_nonce` |
| `tb_questions` | `text` | `text_ciphertext`, `text_nonce` |
| `tb_reflections` | `text` | `text_ciphertext`, `text_nonce` |
| `tb_calibration_context` | `value` | `value_ciphertext`, `value_nonce` |
| `tb_calibration_context` | `detail` (nullable) | `detail_ciphertext`, `detail_nonce` (both nullable) |
| `tb_embeddings` | `embedded_text` | `embedded_text_ciphertext`, `embedded_text_nonce` |
| `tb_session_events` | `event_log_json` | `event_log_ciphertext`, `event_log_nonce` |
| `tb_session_events` | `keystroke_stream_json` (nullable) | `keystroke_stream_ciphertext`, `keystroke_stream_nonce` (both nullable) |

**Out of scope (deliberate)**:

- `tb_burst_sequences` and `tb_rburst_sequences` have no JSONB or text columns
  — they store per-burst numeric summaries (index, char count, durations).
  The Step 0 inventory was incorrect about JSONB columns existing here.
- `tb_session_summaries.deletion_events_json` carries only `{c: count, t: time}`
  per `respond.ts:103`; no deleted text content.
- `tb_subject_responses`, `tb_subject_session_summaries` are zero-row in
  production and slated for deletion in Step 9.
- `tb_paper_comments.comment_text` is public website content.
- `tb_question_corpus.text` is a shared population-agnostic pool.
- Derived signal JSONB (`digraph_latency_json`, `pe_spectrum`, etc.) — these
  are aggregated behavioral fingerprints, not subject text. The threat model
  is content disclosure, not biometric identification.

## §2 Primitive used

`src/lib/libCrypto.ts`, unchanged from v1:

- AES-256-GCM via Node `crypto.createCipheriv`.
- 12-byte random nonce per write (`crypto.randomBytes`).
- 16-byte auth tag appended to ciphertext.
- Both ciphertext and nonce stored as base64 TEXT.

The libDb wiring layer (`encryptString` / `decryptString` private helpers in
`src/lib/libDb.ts`) handles `null` propagation for nullable columns and
JSON.stringify round-trips for the two former JSONB columns.

## §3 Key source

`process.env.ALICE_ENCRYPTION_KEY` — base64-encoded 32 bytes. Same lazy load
+ strict validation as v1 (`libCrypto.getKey`). Unchanged.

**Where the key lives**:

- Local dev: `.env` file.
- Production: systemd `/etc/alice/secrets.env` loaded by `EnvironmentFile=`.
- Operator backup: password manager.

**Key rotation**: not implemented in v1. A lost key means losing every
encrypted row across all in-scope tables — by design. Backed up in two
places (host file + password manager) per the v1 operator playbook.

## §4 Read-path consolidation (Option A)

The handoff considered two patterns: (A) every SELECT against an encrypted
column lives in libDb; (B) decrypt at every call site. Option A was chosen
because (B) accumulates scattered-discipline debt that's much harder to lint
than the Step 7 subject-scope rule.

Sixteen direct-SELECT sites outside libDb were refactored to call libDb
helpers:

```
src/lib/libSignalPipeline.ts        getKeystrokeStream / getEventLogJson / getResponseText
src/lib/libCrossSessionSignals.ts   getPriorTexts (corpus) / motorSelfPerplexity (current+prior streams)
src/lib/libReconstruction.ts        compute corpus + per-question text (×2 sites)
src/lib/libProfile.ts               fingerprint corpus
src/lib/libSignalWorker.ts          calibration extraction (q.text + r.text)
src/pages/api/avatar.ts             avatar corpus (includes calibration)
src/pages/api/alice-negative.ts     pattern texts + shape texts
src/pages/api/health.ts             duplicate-question anomaly check
src/pages/api/observatory/entry/[id].ts            question text + keystroke stream
src/pages/api/observatory/playback/[questionId].ts already used getSessionEvents
src/scripts/confound-analysis.ts    keystroke stream
src/scripts/backfill-rburst-sequences.ts            event log aggregation
src/scripts/backfill-process-signals.ts             event log aggregation
src/scripts/backfill-hold-flight-corr.ts            keystroke stream aggregation
src/scripts/recompute-semantic-signals.ts           response text
src/scripts/recompute-cross-session.ts              response text
src/scripts/backfill-extended-residuals.ts          corpus
```

New libDb helpers in the `@region encrypted-reads` block:

```
getResponseText(subjectId, questionId)         — single response
getQuestionTextById(subjectId, questionId)     — single question + source_id
getEventLogJson(subjectId, questionId)         — single session event log
getKeystrokeStreamJson(subjectId, questionId)  — single session keystroke stream
listEventLogJson(subjectId)                    — all sessions
listKeystrokeStreams(subjectId, options)       — flexible filter
listResponseTexts(subjectId, options)          — flexible filter (incl. paste-contamination, calibration)
listResponseTextsExcludingCalibration          — alias preserving the most common default
```

Plus the existing read functions (`getRecentResponses`, `getResponsesSince`,
`getCalibrationSessionsWithText`, `searchVecEmbeddings`, etc.) were updated
to decrypt on read.

## §5 Operator-side query changes

**`getCalibrationPromptsByRecency`**: pre-031 used `GROUP BY text MAX(dttm)`
to produce one row per distinct prompt text, ordered by oldest last-use.
Encryption with random nonces means identical plaintexts produce distinct
ciphertexts, so SQL can no longer group them. The function now decrypts
every row and dedupes by plaintext in JS. Behavior is unchanged from the
caller's perspective.

**`health.ts:166` duplicate-question anomaly**: same fix — decrypt the
upcoming-window questions and count duplicate plaintexts in JS. The window
is small (< 30 rows in practice), so the cost is trivial.

These were the only two operators (`GROUP BY` / `DISTINCT` / `WHERE col = ?`
/ JSONB `->`/`->>`/`@>`) that touched encrypted columns. The grep pass before
refactoring is documented in the Step 8 sprint log.

## §6 Backfill procedure

```bash
# 1. Apply the additive migration (adds nullable columns)
psql -d "$ALICE_PG_URL" -f db/sql/migrations/031a_add_encryption_columns.sql

# 2. Run the Node backfill (encrypts all existing plaintext rows)
ALICE_ENCRYPTION_KEY=$(grep ALICE_ENCRYPTION_KEY .env | cut -d= -f2-) \
ALICE_PG_URL=... \
npx tsx src/scripts/backfill-encryption.ts

#    → Inspect the per-table summary. Every "fail" count must be 0.
#    → A few rows are sample-verified (round-trip decrypt) before commit.
#    → Idempotent: a partial run can be re-invoked safely.

# 3. Apply the finalizer (sets NOT NULL + drops original plaintext columns)
psql -d "$ALICE_PG_URL" -f db/sql/migrations/031b_finalize_encryption.sql
```

The 031b migration begins with a verification block that throws if any
in-scope row still lacks ciphertext + nonce. This means a forgotten backfill
cannot accidentally land on production: the finalizer aborts before dropping
plaintext.

**Reversibility**:

- Up to and including 031a + backfill: fully reversible. Drop the new columns
  to revert.
- After 031b: irreversible. Plaintext is gone. Recovery requires
  `ALICE_ENCRYPTION_KEY`.
- Operator habit: `pg_dump` before 031a, retain until end-to-end verification
  passes.

## §7 Verifying decrypt works

Three layers:

1. **Round-trip test** at `tests/db/encryption.test.ts`. Writes through libDb,
   asserts a raw SELECT shows ciphertext (not plaintext), asserts a libDb
   read returns plaintext. Tampering throws. Different writes of identical
   plaintext yield distinct ciphertexts (nonce uniqueness). Runs in CI on
   every PR.

2. **Backfill self-verification**. The backfill script encrypts each row,
   runs `decrypt(ct, nonce) === plaintext`, and refuses to write if the
   round-trip fails. Sample-verifies up to 3 already-encrypted rows per
   table on resume.

3. **031b precondition check**. The finalizer migration's BLOCK 1 confirms
   every in-scope row has populated ciphertext + nonce before dropping
   plaintext. A `RAISE EXCEPTION` aborts the migration on any miss.

## §8 What happens on key loss

`ALICE_ENCRYPTION_KEY` is the single point of failure for all encrypted rows.
By v1 design, there is no rotation, no key escrow, no recovery path. If the
key is lost:

- Every row in tb_responses, tb_questions, tb_reflections,
  tb_calibration_context, tb_embeddings, tb_session_events becomes
  permanently unreadable.
- Application reads throw on any in-scope column access.
- The DB still functions; non-encrypted columns (subject ids, dates, signal
  values, etc.) are intact.

Mitigation is operational: two backup locations (host file + password
manager). Both must be lost simultaneously for unrecoverable failure.

If a future phase introduces rotation, the model would be: each row tagged
with `key_id`, multiple keys live in env, decrypt picks by `key_id`,
re-encrypt batch on rotation. Out of scope for v1.

## §9 Why expand scope to questions / reflections / embeddings

The Step 0 column list named tb_responses + tb_calibration_context +
tb_session_events. The audit during Step 8 surfaced three additional
subject-bearing columns:

- `tb_questions.text` — for owner, LLM-generated from response history.
  Each question encodes patterns from the response data.
- `tb_reflections.text` — AI weekly/monthly summaries, derived directly
  from response text. The highest-leverage leak: one reflection compresses
  many entries.
- `tb_embeddings.embedded_text` — for response-source embeddings, this is
  literally the response text fed to the embedder. Encrypting
  tb_responses.text while leaving tb_embeddings.embedded_text plaintext
  would have been a bypass.

The scope expansion was confirmed by the user: "uniform encryption,
including corpus-drawn rows. Don't branch on row source."

## §10 Boundary discipline

The wiring discipline matches the migration 030 lint pattern: every SELECT
against an encrypted column lives inside libDb, period. Direct SELECTs
elsewhere are bugs. There is no lint rule today enforcing this — but the
codebase is clean (zero direct SELECTs of encrypted columns outside libDb
after Step 8 lands), and the same Step 7 vitest test infrastructure could
host a future encrypted-column-scope lint without significant cost.

The reason a lint isn't part of Step 8: it's incremental insurance against
future drift, not a fix for current state. The current state is verified
clean by §7's round-trip test, which would catch any new direct SELECT
returning ciphertext-shaped data instead of plaintext. If drift becomes a
concern later, a Step-7-style vitest lint covering encrypted columns is a
follow-up of bounded scope.
