# Handoff — Alice

Single source of truth for system state, open work, and operational facts. Replaces the prior `HANDOFF_*.md` + `RESUME.md` pair.

Updated 2026-04-28 evening (post INC-021 `nowStr()` TZ fix). **Read this top-to-bottom before doing anything.**

**Trust the code, not this file.** §4 below has burned twice — it's drifted ahead of the codebase faster than these notes get edited. Before claiming any item in §4 is broken, grep the relevant handler. The handoff is a hint, not the source of truth.

---

## STOP. Read this first.

Production runs at https://fweeo.com on a Hetzner CCX13 (Hillsboro), backed by Supabase Postgres (us-west-2). The instrument is fully operational: owner has 73+ historical responses; one subject (`ash`) is provisioned and pressure-tested across the universal-login flow. Today (2026-04-28) landed two production fixes: the subject-TZ calendar-flip bug (server-UTC vs subject-local — ash's day-1 entry was misfiled under day-2; resolver now reads `tb_subjects.iana_timezone`) and universal session-cookie auth (Caddy basic-auth retired; one `/login` for owner + subject; `/api/subject/logout` is universal; cookie has no `Max-Age` so closing the browser logs you out).

**Decisions locked in (do NOT relitigate):** auth model (Path 2-lite session cookie + Argon2id for BOTH owner and subjects via the unified `/login` flow as of 2026-04-28; Caddy basic-auth retired; one shared session-cookie infrastructure); region (Hetzner Hillsboro + Supabase us-west-2); domain (fweeo.com apex canonical); TLS (Caddy + Let's Encrypt, Cloudflare Full strict); no DEV_MODE; encryption uniformly applied; archival means removal not stubbing; Rust signal engine is the single source of truth; logical FKs only — no cascade deletes; alice-negative artistic rendering is fully gone; the black box is sacred (never surface responses, future questions, signals, or trait values to the user); calendar-day flip happens at the **subject's** local midnight, not the server's (TZ-aware date resolution via `localDateStr(date, ianaTimezone)`).

---

## 1. What's running

### Hetzner box (`alice-prod`, IPv4 `5.78.203.243`)
- Ubuntu 24.04, Node 22.22.2, Caddy 2.11.2 (cloudsmith stable repo)
- `alice` user (uid 996), repo at `/opt/alice`
- `alice.service` — Astro Node server + signal worker on `localhost:4321`
- `caddy.service` — TLS termination + reverse proxy only (basic-auth retired 2026-04-28; auth is now end-to-end in the Astro app). Loads `/etc/alice/secrets.env` via systemd drop-in for `ALICE_ENCRYPTION_KEY` etc.
- Linux `.node` binary at `/opt/alice/src-rs/alice-signals.linux-x64-gnu.node` (pulled from CI artifact, NOT built locally — `target-cpu=x86-64-v3` flag matters for bit-identity across Hetzner microarch fleet)
- TLS: Let's Encrypt for `fweeo.com` + `www.fweeo.com`, Cloudflare Full(strict) end-to-end
- Backups: Hetzner daily snapshots enabled

### Supabase (project `Fweeo`, ref `sxzortfjengyztdgeqvl`, us-west-2)
- Schema `alice` applied via canonical `db/sql/dbAlice_Tables.sql`
- pgvector lives in `extensions` schema; pool's `search_path = alice, public, extensions`
- Connection: Session pooler on port 5432 (free + IPv4 + supports prepared statements which postgres.js needs)
- **All migrations 030 through 037 are applied.** Audit performed 2026-04-27 evening — see INC-017 §"Side cleanups" and §3 below

### Auth state
- **Universal login** (2026-04-28, INC-020): one `/login` form for owner and subjects; same session cookie shape (HttpOnly, Secure, SameSite=Lax, no `Max-Age` — closing the browser logs you out). Login response carries `isOwner` so the page dispatches: owner → `/`, subject → `/subject`. Logout (`/api/subject/logout`) is universal — works for both roles, idempotent if no cookie. Caddy basic-auth retired in the same change.
- **Owner** (`subject_id=1`, username=`owner`): password set 2026-04-28 via `set-owner-password` CLI (also clears `must_reset_password`). Re-run the same script with a new password to rotate. No in-app rotation flow yet.
- **`ash`** (`subject_id=2`, tz=America/Chicago): provisioned and submitting. Pressure-tested 2026-04-28: subject login → journal entry → logout → owner login → 2 calibrations → logout → ash login → calibration. All worked. Day-1 schedule was repaired in-place during the TZ fix (INC-019): question 125 deleted, 126-154 shifted back one day so 126→2026-04-27 (her existing response stays linked) and 127→2026-04-28 (today's fresh question).
- **Auth hardening carried forward** (INC-018, 2026-04-27): sessions expire after 7 days; login rate-limited to 10 attempts / 15 min / IP via `utlRateLimit.ts`; `tb_subject_sessions.last_seen_at` + `last_ip` populated on each verify (throttled to one write per 5 minutes per session).
- **Subject creation** now requires the IANA timezone arg: `npm run create-subject -- <username> <temp-pw> <iana-tz> [display-name]`. The seed planter uses the subject's TZ so day-1 aligns with their local midnight.

### Local laptop state
- `.env` populated with `ALICE_ENCRYPTION_KEY`, `ALICE_PG_URL` (Session pooler URL), `ANTHROPIC_API_KEY`, `TEI_URL`
- `~/.ssh/alice_hetzner{,.pub}` ed25519 keypair, passphrase-protected
- Tests: 84 passing on Node 25 local
- TEI: Qwen3-Embedding-0.6B running at `http://localhost:8090` when needed for embeds

### Repo state
- main is up-to-date with origin
- CI runs vitest on ubuntu-latest (testcontainers needs Docker which macOS runners don't ship)
- Reproducibility CI builds linux-x64 `.node` on every push to main; signal-reproducibility workflow enforces bit-identity

---

## 2. Deploy mental model

**Push ≠ deploy.** `git push origin main` updates GitHub + triggers CI to build the Linux `.node` artifact. It does NOT touch Hetzner.

To deploy from laptop:
```bash
gh run list --workflow="Signal Engine Reproducibility" --limit 1
mkdir -p /tmp/alice-deploy
gh run download <run-id> --name alice-signals-linux-x64 -D /tmp/alice-deploy
ALICE_DEPLOY_HOST=5.78.203.243 \
LOCAL_NODE_BINARY=/tmp/alice-deploy/alice-signals.linux-x64-gnu.node \
deploy/deploy.sh
```

`deploy.sh` does NOT touch:
- `/etc/alice/secrets.env` — root SSH + nano if a secret rotates
- `/etc/systemd/system/alice.service` — manual cp + daemon-reload if it changes
- `/etc/systemd/system/caddy.service.d/override.conf` — manual
- `/etc/caddy/Caddyfile` — manual
- Database schema — migrations run by hand against Supabase

This separation is intentional. Code deploys ≠ infra changes.

---

## 3. Migration audit — Supabase as of 2026-04-27 evening

| Migration | Applied? | Evidence |
|---|---|---|
| 030 subject_id unification | ✅ | `subject_id` column on `tb_responses`, `tb_dynamical_signals`, etc. |
| 031 encryption | ✅ | `text_ciphertext` + `text_nonce` on `tb_responses`, `tb_questions` |
| 032 corpus_question_id + drop legacy variants | ✅ | `tb_subject_responses` gone, `corpus_question_id` present |
| 033 archive witness_states | ✅ | `tb_witness_states` gone, `zz_archive_*` exists |
| 034 archive calibration_context | ✅ | `tb_calibration_context` gone, `zz_archive_*` exists |
| 035 archive alice-negative state tables | ✅ | All 6 live gone, all 6 `zz_archive_*` exist |
| 036 archive entry_states + reflections | ✅ | Applied earlier 2026-04-27 |
| 037 session_telemetry | ✅ | `last_seen_at` + `last_ip` columns present |

Local migrations directory is fully in sync with Supabase. **No drift.**

The `035` filename collision was resolved this session by renaming `035_session_telemetry.sql` → `037_session_telemetry.sql`. The migration content is byte-identical and idempotent if re-run.

---

## 4. Open work (ordered by consequence)

### Verified stale (do NOT readd unless code confirms)

- ~~🚨 HIGH PRIORITY — `tb_responses.dttm_created_utc` silently wrong on a non-deterministic subset of journal rows.~~ Fixed + audited + repaired 2026-04-28 evening as INC-021. Code: `nowStr()` returns `Date#toISOString()` (Z-qualified). Audit: 9 confirmed skewed rows (response_id 47, 53, 60, 64, 66, 68, 72, 79, 84 — all owner journal, April 19-28, all +5h = CDT offset), 42 confirmed clean, 3 indeterminate (April 16-18 owner journals where `saveSessionEvents` also used `nowStr()` so the inter-table check is blind), 31 immune (calibrations, never used `nowStr()`). Repair: single-transaction `UPDATE` set `dttm_created_utc = se.dttm_created_utc, modified_by = 'inc-021-repair'` on the 9 confirmed rows. Post-repair audit returns 0 skewed. Indeterminate 3 left as-is (no second-source timestamp; their SE partners are equally affected if skewed, so no recoverable ground truth). Persisted signal rows are unaffected (they don't depend on `tb_responses.dttm_created_utc`). See §10 INC-021 for the full audit + repair record.


The previous version of this section listed two "real bugs" in the subject path. Both were verified false on 2026-04-27 late-evening:

- ~~Subject journal event-log parity.~~ `subject/respond.ts:134-147` already calls `saveSessionEvents` inside the transaction with both `event_log_json` and `keystroke_stream_json`, encrypted via libDb. The contamination-boundary docstring at the top of the file confirms the intent. Calibration path mirrors it (`subject/calibrate.ts:101-126`).
- ~~TZ scheduling: subject gets "no question today" on day one.~~ `create-subject.ts` calls `seedUpcomingQuestions(id, 30)`. The seeder loops `for (i = 0; i < 30)` starting at `today` (`libSchedule.ts:19-22`), so today is `i=0`. Day-one login resolves a question. Empirically confirmed when `ash` submitted journal + calibration on her first day.

### Subject path — actual remaining gaps

The schedule-extension flow is intentionally manual and collective, not automated. Do NOT wire `schedule-questions.ts` into systemd. The design (per CLAUDE.md "seed questions" + memory "Subject creation contract"):

- Each subject gets 30 personal seeds at creation (`seedUpcomingQuestions`, additive, idempotent).
- Once any subject's unanswered-seed count drops to ≤ 5, the health endpoint flags the alert (`api/health.ts:208`) and the owner navbar surfaces a pending-work badge (`pages/index.astro:663`).
- Owner runs `npm run corpus:refresh` → reviews `data/corpus-candidates-YYYY-MM-DD.md` → marks approved with `[x]` → runs `npm run corpus:approve <file>`. New questions are inserted into the shared `tb_question_corpus` (additive, never overwrites a subject's personal queue). Subjects pull from corpus once their personal seeds run out.
- Owner approves all — nothing is automatic on prod.

~~So the only "subject-path" follow-up is operational polish, not a bug:~~

1. ~~**Subject signals/embeddings drain is manual.**~~ Shipped 2026-04-27 late-evening as `npm run drain-subjects`. Composes embeddings → signals → reconstruction → daily-deltas → profile via subprocess fan-out. Default = loop all active subjects; `--subject-id N` scopes to one; `--skip A,B` bypasses named stages (e.g. when TEI is down). Each existing backfill is already idempotent so the orchestrator inherits that — re-runs skip already-correct rows. Verified: full drain across owner (41 sessions caught up, 5 new reconstructions, 1 new daily delta) and ash (2 sessions backfilled, profile created), 158.6s total, 0 failures. See `src/scripts/drain-subjects.ts`.

### Phase 6 future work (not bugs, just unbuilt)

3. ~~**Owner session-based auth.**~~ Done 2026-04-28 (INC-020). One `/login` for owner + subjects, universal middleware gate on owner pages/APIs (`/`, `/observatory/*`, `/api/respond`, `/api/calibrate`, `/api/today`, `/api/observatory/*`), Caddy basic-auth gate retired, `OWNER_BASICAUTH_HASH` removed from prod secrets.env. Future polish: in-app password rotation form for owner (currently CLI-only via `set-owner-password`).

4. ~~**Phase 6c — consent + delete + export.**~~ Complete 2026-04-28. See §10 provenance trail.

5. **Phase 6d — embedder queue.** Move `embedResponse` from inline-in-pipeline to its own `tb_signal_jobs` job kind (`embed`). Today, when TEI is offline, embeds skip and `npm run backfill` drains them later. With its own job kind, retries become automatic per job (quadratic backoff already implemented in `libSignalWorker`).

6. ~~**Phase 6e — observatory subject toggle + decrypt + notifications.**~~ Shipped 2026-04-27 late-evening. Subject toggle on every observatory page (`?subjectId=N`), in-app inbox badge for new subject submissions, custom-styled subject picker (replaces native `<select>`), `/observatory/inbox` page. Replay redacts non-whitespace to `•` for non-owner subjects (subject content stays opaque to the operator, even though the operator holds the key). See `cmpObsToolbar.astro`, `libObservatorySubject.ts`, `playback/[questionId].ts:redactNonWhitespace`.

### Cosmetic / low-priority

7. **Pre-existing TS strict-null noise.** Lingering "possibly undefined" / "not assignable" errors in `libDb`, `libCrossSessionSignals`, `libSemanticSignals`, `libDynamics`, `libDocs`, `libEmotionProfile`, `scripts/archive/*`. Not breaking; discrete cleanup pass when convenient.

8. **`data/errors.log.bak.2026-04-27`.** Forensic backup of the stale error log at the moment the time-window filter shipped. Gitignored. Delete with `rm data/errors.log.bak.*` whenever you stop caring about the old debug entries.

9. ~~**Extract IP/UA helpers to `utlRequestContext.ts`.**~~ Done 2026-04-28 alongside Phase 6c step 6. `src/lib/utlRequestContext.ts` exports `extractClientIp` + `extractUserAgent`; `libSubject.ts` and `src/pages/api/subject/consent.ts` both import from it. The export endpoint (step 6) and the upcoming delete endpoint (step 7) use the same.

10. **Phase 6c export-audit completion gap.** `/api/subject/export` writes a `{status: 'started'}` row to `tb_data_access_log` BEFORE the stream opens. There is no follow-up `{status: 'completed'}` row. The audit log can therefore distinguish "started + finished" from "started + connection dropped" only by absence-of-completion, not by an explicit success flag. Acceptable for v1 of Phase 6c — the started row is the load-bearing "every access leaves a trace" record — but the consent doc's "audit trail" claim is slightly weaker than it reads. v2 followup: write a second audit row on stream completion, with `notes: {status: 'completed', originalLogId: N, totalRows, bytesWritten}`. Same `data_access_action_id = 1 (export)`, links back to the started row. Append-only invariant preserved.

11. **JSONB shape contract: two-tier policy, opportunistic migration (locked).** The codebase has two storage patterns for JSONB columns:

   - **Tier A — string-typed JSONB (legacy, "downstream expects strings"):** `tb_prompt_traces.{recent_entry_ids, rag_entry_ids, contrarian_entry_ids, reflection_ids, observation_ids, difficulty_inputs}`, `tb_reconstruction_residuals.{real_pe_spectrum, avatar_pe_spectrum, residual_pe_spectrum}`, `tb_personal_profile.{digraph_aggregate_json, trigram_model_json}`, `tb_dynamical_signals.pe_spectrum`, `tb_motor_signals.{mse_series, iki_autocorrelation_json}`, `tb_session_integrity.z_scores_json`. Writers use `JSON.stringify(obj)` → stored as JSONB-string. Readers in `libDb.ts:1983, 2043-2044` re-stringify if `typeof === 'object'` so the downstream signal pipeline always sees strings. Storage-shape contract: **JSONB-string** (verified empirically: `jsonb_typeof = 'string'` on existing rows).

   - **Tier B — object-typed JSONB (correct, "downstream expects objects"):** `tb_data_access_log.notes`, `tb_subject_consent` (no JSONB columns yet; reserving the contract). Writers use `sql.json(obj)` → stored as JSONB-object. Readers consume as objects directly. Storage-shape contract: **JSONB-object**.

   **Migration policy: opportunistic, not coordinated.** Don't ship a 040 that flips Tier A to Tier B in a big-bang. The cost of a coordinated fix (backfill UPDATE + writer changes + reader changes + downstream pipeline changes, all atomic) exceeds the value (cleaner code; no functional bug). The read-side workaround at `libDb.ts:1983, 2043-2044` accepts both shapes, so existing code is non-breaking. Migrate Tier A columns to Tier B opportunistically as the surrounding code is touched for other reasons. New tables default to Tier B. A column never mixes shapes — pick one per column and write only that shape. Document the column's tier in its schema-file header comment when it's not obvious.

   **What this means in practice:**
   - New JSONB columns: Tier B. Use `sql.json(obj)` on write. Never `JSON.stringify`.
   - Editing an existing Tier A column: stay Tier A. Don't introduce shape mixing.
   - "I want to fix Tier A": do it as part of a larger refactor that already touches the affected files. Not as a standalone migration.
   - Reader workaround stays until every Tier A column is migrated. If you ever delete it, audit every column that flowed through it first.

12. **Delete-then-export policy: locked.** Soft-deleted subjects (post-`/api/subject/account/delete`) cannot authenticate. `libSubjectAuth.verifySubjectSession` line 153 filters by `s.is_active = TRUE` so a soft-deleted subject's cookie resolves to `null` and the middleware returns 401 before any handler runs. The cascade also deletes every `tb_subject_sessions` row for the subject, so any cookie the browser kept becomes invalid server-side. **Position A** in the locked plan: export-before-delete is the only access pathway; post-delete recovery is via the operator (rerun `create-subject`) not via export. Defense-in-depth `is_active` check added at the top of `/api/subject/export` (post-step-7) so the rule is restated at the data-access boundary.

13. **Journal footer fade: monitor for discoverability.** `/subject/index.astro` has two footer links (`settings` → `/account`, `consent` → `/consent`) that fade with the journal's `body.deepening-{2,3}` cadence — full opacity on arrival, 0.45 after 75s, 0.18 after 150s. Hover recovers to `--text-muted` on desktop; mobile has no hover. Tapping still works at 0.18 opacity since touch targets don't require visual prominence to function, but a subject who's never moused over the footer at deepening-3 may not realize the links exist. If subjects report "I couldn't find settings/consent during a deep session," the cheap mitigation is pointer-proximity opacity recovery: any `mousemove` or `touchstart` within ~150px of the footer's bounding box temporarily raises opacity to full for ~3 seconds. ~5 lines of JS. Don't preemptively add — overengineered until someone reports the problem.

---

## 5. Critical architectural rules (do not violate)

From CLAUDE.md, memory, and the discipline established across INC-014 through INC-018:

1. **Single source of truth for measurements.** Rust signal engine. No TypeScript fallback. Health endpoint exposes `rustEngine: true/false`. A measurement instrument cannot have two implementations.
2. **Logical foreign keys only.** No physical FK constraints. Application code is responsible for cascade deletes. See CLAUDE.md "Cascade Dependencies per Parent Table".
3. **The black box is sacred.** Never surface to the user: their own response text, future-day question text, raw signal values, trait floats, behavioral metrics. The observatory is designer-facing; the journal is the user surface; never cross the streams.
3a. **Subject content stays opaque to the operator.** Even though the operator holds the encryption key (one shared key, by design, so signals can be computed), the observatory binds itself not to display subject-authored plaintext — including via replay reconstruction. Server-side redaction in the playback handler (`playback/[questionId].ts`) replaces non-whitespace with `•` when `subjectId !== OWNER_SUBJECT_ID`. Do NOT add a "show body" or `?reveal=1` affordance. Subject content is meant to leave the encrypted store only via the future Phase 6c export endpoint, which lives behind explicit consent + audit rows.
4. **Archival means removal, not stubbing.** When a feature is deprecated, all code goes; data is preserved under `zz_archive_*` tables. Both producer AND consumer sides of the dependency edge must be cut in the archival commit (the lesson from INC-014/015/016/017).
5. **Prod is signal-store-only.** Embedding (TEI/Qwen) and LLM (Anthropic) work happen LOCALLY only via `npm run dev:full`. Never on prod.
6. **Contamination boundary.** Subject submissions NEVER trigger LLM/embed/signal jobs. The boundary docstrings in `src/pages/api/subject/respond.ts` and `src/pages/api/subject/calibrate.ts` are load-bearing.
7. **Every subject gets 30 personal seeds at account creation** via `seedUpcomingQuestions` called from `create-subject.ts`. Seeds are sacred — never overwritten. Corpus refresh is ADDITIVE.
8. **No DEV_MODE.** Every journal/calibration submission is real prod data. Discipline, not feature flag.
9. **Encryption key (`ALICE_ENCRYPTION_KEY`) is permanent.** Lose it = lose every encrypted row across all in-scope tables. Backed up in operator's password manager AND in `/etc/alice/secrets.env`.
10. **Migrations run by hand.** Audit before applying. No auto-apply.

---

## 6. Operational state (2026-04-28 session end)

- **Owner** (subject_id=1): 73+ historical responses + 2 calibrations from this session's pressure test. Logs in via `/login` with the password set 2026-04-28. `must_reset_password=false`.
- **Ash** (subject_id=2): provisioned, active, pressure-tested across the full universal-login matrix (subject login → journal → logout → owner login → 2 calibrations → logout → ash login → calibration). Day-1 schedule repaired in INC-019 — q126→2026-04-27 (existing response stays linked) and q127→2026-04-28 (today's fresh question).
- **TEI**: Qwen3-Embedding-0.6B at `localhost:8090` when running locally. Not on prod.
- **ANTHROPIC_API_KEY**: in `.env` and `/etc/alice/secrets.env`. Used only by local LLM workflows (corpus refresh, etc.) — never on prod.
- **Tests**: 29 test files / 176 tests passing on local Node 25 (full unit + DB suites; testcontainers-backed DB tests run against an ephemeral PG17 + pgvector image). Includes the 6 `tests/unit/utlDate.test.ts` tests that cover the TZ-aware date resolver.
- **TS check**: clean on every file touched in recent sessions. Pre-existing strict-null noise tracked in §4 item 7.
- **Working tree**: typically clean after handoff lands; the user has automation that auto-commits work in progress. Verify with `git status --short` and look for unstaged hardening edits.
- **Hetzner secrets.env**: `OWNER_BASICAUTH_HASH` removed 2026-04-28 (orphaned after Caddy basic-auth retired). Backup left at `/etc/alice/secrets.env.bak` from `sed -i.bak` — delete when comfortable.

---

## 7. File paths the next agent will need

- **Repo root:** `/Users/anthonyguzzardo/Developer/Personal/GitHub/Einstein`
- **DB connection:** via `ALICE_PG_URL` in `.env` (Supabase us-west-2 pooler)
- **Memory system:** `/Users/anthonyguzzardo/.claude/projects/-Users-anthonyguzzardo-Developer-Personal-GitHub-Einstein/memory/MEMORY.md` (always loaded into context) + per-topic files
- **Provenance log:** `systemDesign/METHODS_PROVENANCE.md` (newest first; INC-020 is the most recent)
- **Schema:** `db/sql/dbAlice_Tables.sql` (single intact CREATE-TABLE script; the canonical state)
- **Migrations:** `db/sql/migrations/` (NN_description.sql; NOT auto-applied)
- **Universal auth:** `src/lib/libSubjectAuth.ts`, `src/lib/libSubject.ts`, `src/lib/utlRateLimit.ts`, `src/middleware.ts`, `src/pages/api/subject/{login,logout,reset-password,...}.ts`, `src/pages/login.astro`
- **Signal worker:** `src/lib/libSignalWorker.ts` (drains `tb_signal_jobs`)
- **Signal pipeline:** `src/lib/libSignalPipeline.ts` (orchestrates derived signals per session)
- **Embed pipeline:** `src/lib/libEmbeddings.ts` (TEI client, `isTeiAvailable()`)
- **State engine (7D behavioral):** `src/lib/libStateEngine.ts` (computes z-scores live; no persistence after INC-017)
- **Health endpoint:** `src/pages/api/health.ts` (owner-only; reads recent errors with 24h time window)
- **Observatory pages:** `src/pages/observatory/{index,trajectory,scales,coupling,ghost,entry/[id],replay/[questionId]}.astro`
- **Observatory APIs:** `src/pages/api/observatory/*.ts` (entry detail, states, calibration-drift, integrity, ghost, etc.)
- **Rust crate:** `src-rs/` (built via `npm run build:rust`; CI builds linux-x64 artifact)
- **Deploy:** `deploy/deploy.sh`, `deploy/Caddyfile`, `deploy/alice.service`, `deploy/HETZNER_SSH.md`

---

## 8. Quick recovery commands

```bash
# Reconnect to Hetzner
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243        # for /etc edits
ssh -i ~/.ssh/alice_hetzner alice@5.78.203.243       # for /opt/alice

# Service status
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243 'systemctl status alice.service caddy --no-pager | head -30'

# Live logs
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243 'journalctl -u alice.service -f'

# External health
curl -I https://fweeo.com/                           # 302 → /login?next=/  (no session)
curl -I https://fweeo.com/login                      # 200 (universal login form)
curl -I https://fweeo.com/api/respond                # 401 application/json (no session)
curl -sI -X POST https://fweeo.com/api/subject/logout # 200 ok (always; idempotent)

# DB shell against Supabase
ALICE_PG_URL=$(awk -F= '/^ALICE_PG_URL=/{sub(/^[^=]*=/,""); print}' .env) && psql "$ALICE_PG_URL"

# Run a migration (operator-applied, manual)
ALICE_PG_URL=$(awk -F= '/^ALICE_PG_URL=/{sub(/^[^=]*=/,""); print}' .env) && \
  psql "$ALICE_PG_URL" -v ON_ERROR_STOP=1 -f db/sql/migrations/NNN_*.sql

# Provision another subject
ALICE_PG_URL=$(awk -F= '/^ALICE_PG_URL=/{sub(/^[^=]*=/,""); print}' .env) \
  npm run create-subject -- '<username>' '<temp-pw>' '<iana-tz>' '<display-name>'

# Rotate owner password (run on Hetzner as alice user)
ALICE_PG_URL=$(grep -E '^ALICE_PG_URL=' /etc/alice/secrets.env | cut -d= -f2-) \
  npm run set-owner-password -- '<new-password>'

# Pull latest .node from CI + deploy
gh run list --workflow="Signal Engine Reproducibility" --limit 1
gh run download <run-id> --name alice-signals-linux-x64 -D /tmp/alice-deploy
ALICE_DEPLOY_HOST=5.78.203.243 \
LOCAL_NODE_BINARY=/tmp/alice-deploy/alice-signals.linux-x64-gnu.node \
deploy/deploy.sh

# Local dev (full LLM/embed-capable)
npm run dev:full

# Local dev (signals only — no TEI, no Anthropic)
npm run dev

# Drain any pending embeds after dev:full + TEI startup
npm run backfill

# Refresh shared question corpus (operator-curated)
npm run corpus:refresh
# (review data/corpus-candidates-YYYY-MM-DD.md, mark approved with [x])
npm run corpus:approve data/corpus-candidates-YYYY-MM-DD.md
```

---

## 9. Things to NEVER do

- Re-relitigate the locked-in decisions in the STOP block.
- Refactor working production code "while we're here."
- Commit `.env`, secrets, the `.node` binary, or anything in `data/`.
- `git push --force` or `git reset --hard` against any remote branch.
- Apply migrations to Supabase without the user reading them first (CI/CD does NOT auto-apply).
- Add a DEV_MODE flag, draft-mode entries, or test tagging that contaminates real data.
- Build the Linux `.node` locally and SCP it (always pull from CI artifact — `target-cpu=x86-64-v3` flag matters for Hetzner microarch fleet bit-identity).
- Surface response text, future questions, signal values, or trait floats to the user. The black box is sacred.
- Resurrect alice-negative artistic rendering. Witness states / semantic 11D / trait dynamics / coupling matrices / emotion-behavior coupling / 7D entry-state persistence are all archived and stay archived.
- Stub functions for archived features. Archival means removal, not stubbing.
- Touch the `te_*` enum tables that reference archived data (`te_reflection_type`, `embedding_source_id = 3` on `te_embedding_source`) — they're harmless static dictionary entries; removing them risks orphaning archived rows.
- Ship the consent-gate middleware (Phase 6c step 5) without the consent endpoint + page (step 4). Ship step 4 first, smoke-test live with ash, leave a 24–48h verification gap, then ship step 5. **Never 5 alone** — middleware-without-the-consent-endpoint locks every non-owner subject out of `/api/subject/*` with no acknowledgment path. The whitelist (`/api/subject/consent`, `/logout`, `/export`, `/account/delete`) is what closes that hole, and it's part of the middleware change — the dangerous state is "middleware without whitelist" or "whitelist routes that don't exist yet." Failure asymmetry justifies the gap: 4-broken is a soft fail (subject hits an error on consent click), 5-without-working-4 is a lockout.
- Land production data via test scripts. Smoke tests against Supabase always clean up after themselves: every fake subject, every test session, every audit row inserted for verification gets `DELETE`'d before the script exits. Production data only lands when a real subject performs a real action through the UI. This rule is the reason the JSONB-double-encoding bug (discovered 2026-04-28 during step 7 smoke testing) didn't corrupt any production audit data — every test row that hit the bug was deleted before it could matter. Don't erode this. If you find yourself thinking "I'll clean it up later" during a smoke test, stop and clean it up now.

**Pre-step-5 checklist (do not ship middleware until ALL five are checked):**
1. ~~Hetzner snapshot retention verified in console~~ Done 2026-04-28 via Hetzner Cloud panel: **7 days** (Backups add-on, fixed 7-slot rolling rotation; 2 of 7 slots filled at time of check).
2. ~~Supabase backup window verified in console~~ Done 2026-04-28 via Supabase dashboard: **7 days** (Pro tier daily backups, no PITR add-on).
3. ~~Consent doc updated if either number differs~~ Done 2026-04-28: edited `docs/consent-v1.md` and `src/pages/account/delete.astro` from "up to 30 days" to "up to 7 days" — both numbers are 7, so 7 is honest for both copies. **In-place edit, NOT a version bump**, because v1 has no real acknowledgments yet (ash hasn't smoke-tested; the only `tb_subject_consent` rows that ever existed were synthetic test rows that were cleaned up). See substrate decision §11 about pre-publication consent edits.
4. Ash smoke test on step 4 complete: log in → /consent renders → byte-for-byte check rendered HTML against `docs/consent-v1.md` → click acknowledge → verify journal redirect → query `tb_subject_consent` + `tb_data_access_log` directly to confirm both rows landed atomically
5. ~~Stale-version reload UX (banner + disabled-button-until-reviewed)~~ Done in step 4 via `?stale=1` query param.

---

## 11. Substrate decisions for methods section

Procedural-level architectural decisions that don't show up in CLAUDE.md's stack list but are load-bearing for the methodology section of paper one. Each is a sentence; new decisions append as they land. When paper one drafting starts, the methods substrate paragraph writes itself from this list.

- **Append-only audit + consent.** Every subject-data access (export, factory_reset, delete, consent acknowledgment) writes exactly one row to `tb_data_access_log`. Rows are never modified or deleted, including when the subject closes their account; the audit log + consent history are retained forever as the research-integrity record described in `docs/consent-v1.md`.

- **Single canonical writer for audit rows.** All inserts to `tb_data_access_log` flow through `libConsent.recordDataAccess`. Application code never INSERTs into the audit table directly. This is the discipline that keeps the "every action leaves a forensic trace" guarantee from drifting as the codebase grows.

- **Audit-row write inside the same transaction as the action it describes.** A failed cascade rolls back the audit too (subject retries cleanly); a successful cascade with a failed audit-write also rolls back. The asymmetry is deliberate: failed delete is recoverable, successful delete with no audit row is not. Applies to delete + factory-reset + consent — wherever an action and its audit need to land atomically.

- **Cascade-leaves-inward order.** Delete operations traverse the logical-FK dependency graph leaves-first (children of `tb_questions`, then `tb_responses` children, then `tb_responses`, then `tb_questions`, then sessions, then soft-delete the subject). Inside a single transaction the order doesn't change observable state to outside readers, but it documents intent and matches the schema's documented dependency graph.

- **Soft-delete-tombstone with permanent audit + consent retention.** Subject deletion is soft (`tb_subjects` row renamed to `_deleted_<ts>_<id>_<original>`, deactivated, `subject_id` preserved). All subject-bearing data is wiped from the active system; the audit log + consent acknowledgments survive forever and continue to reference the tombstoned `subject_id`. Hard-delete is never used.

- **Started-only export audit posture (v1).** `/api/subject/export` writes one audit row (`{status: 'started'}`) before the response stream opens. No follow-up completion row in v1 — the audit log distinguishes "started + finished" from "started + dropped" only by absence of a corresponding row. Acceptable for v1; v2 may add `{status: 'completed'}` follow-ups for full streamed-byte accountability.

- **Encrypted-content-table invariant.** Tables that hold subject-authored content via the `<col>_ciphertext`+`<col>_nonce` pattern (`tb_responses`, `tb_questions`, `tb_session_events`) must contain only subject-authored or subject-derived columns. Operator-side annotations live in separate tables. Makes the export endpoint's `SELECT *` safe by construction — any future column flows into the export automatically without exposing operator state.

- **At-rest encryption boundary inside libDb.** Every read of an encrypted column happens through libDb. Application code above libDb sees plaintext on the way in and plaintext on the way out — never ciphertext. Direct SELECTs of encrypted columns outside libDb are forbidden by convention. This is what lets the methodology paragraph honestly claim "the database stores ciphertext only."

- **JSONB shape contract: two-tier, opportunistic migration.** Tier A (legacy) writers stringify before insert, readers re-stringify if needed; Tier B (correct) writers use `sql.json(...)`, readers consume objects. New tables default to Tier B. Tier A columns migrate opportunistically as surrounding code is touched, never as a standalone migration. Documented per-column in schema-file header comments where the shape isn't obvious.

- **Subject content opacity to the operator.** The operator holds the encryption key (one shared key, since the system needs to compute signals across subjects), but the observatory binds itself never to display subject-authored plaintext. Replay reconstructs keystrokes server-side then redacts non-whitespace to `•` before the response leaves the handler. The discipline is UI-side; the technical capability to read is not the rule.

- **Production data lands only via real subject actions through the UI.** Smoke tests against Supabase always clean up after themselves: every test subject, session, audit row, and consent row inserted for verification gets `DELETE`'d before the test exits. This rule is the reason every bug found during Phase 6c (JSONB double-encoding, Date-vs-string contract, JSON.stringify-into-JSONB scope) didn't corrupt any production data.

- **Migrations are operator-applied with pre-flight guards.** No automated migration runner — every migration runs by hand against Supabase via `psql -v ON_ERROR_STOP=1 -f db/sql/migrations/NNN_*.sql`. Migrations that change column types or constraints include `DO $$` pre-flight blocks that abort with a clear error if assumed pre-state isn't true (e.g. `RAISE EXCEPTION '039 expects 0 rows'...`). Forces the operator to re-read the migration before clobbering unexpected state.

- **Confirmation friction for destructive subject actions.** HTTP `POST /api/subject/account/delete` requires `body.confirmation === subject.username`; CLI scripts (`factory-reset`, `delete-subject`) prompt for the same string at the terminal. No y/N — typing the username is the slow-down signal that survives muscle memory.

- **Consent doc lifecycle: pre-publication is mutable, post-acknowledgment is immutable.** A consent version is "published" the moment the first real subject acknowledges it (i.e. a non-test row lands in `tb_subject_consent`). Before that, the doc text can be edited in place — the registry version stays the same, no v2 bump needed. After that, any text change requires a new version (v2) added to `CONSENT_VERSIONS`, and the previous version's text stays readable forever from the consent-history view on `/account`. The 2026-04-28 backup-window edit (30 days → 7 days) was an in-place pre-publication edit, honest because no real acknowledgments existed yet. Operationally: check `SELECT count(*) FROM tb_subject_consent WHERE consent_version = 'vN'` before editing — if zero, in-place is fine; if non-zero, bump to v(N+1).

- **Universal session-cookie auth (one model for owner + subjects).** Both roles authenticate through `/login` → `/api/subject/login` → Argon2id verify → opaque 32-byte hex session token (SHA-256 in `tb_subject_sessions`). Cookie has no `Max-Age` (close-browser = logout); server-side row has a 7-day hard cap. Middleware classifies every path as PUBLIC / OWNER-API / SUBJECT-API / OWNER-PAGE / SUBJECT-PAGE / unclassified, returning HTML 302 to `/login?next=<path>` for unauthenticated page requests and JSON 401 for unauthenticated API requests. Caddy basic-auth was retired in the same change — auth is end-to-end in the Astro app, no upstream gate. The decision matters for the methodology paragraph: there is exactly one auth path, exactly one cookie, exactly one session table.

- **Calendar-day flip at subject's local midnight, not server's.** "Today's question" resolves via `localDateStr(new Date(), subject.iana_timezone)` for subjects (server-local for owner, who is `iana_timezone='UTC'`). The lockout is per-question, not per-24-hours: at 23:58 a subject submits q-N for date X, at 00:01 the calendar flips to X+1 and the API hands them q-(N+1) which is unanswered. Two adjacent entries 3 minutes apart count as two separate days. This is by design — the journal's identity is "one day = one question, the day boundary is your local midnight," and that boundary is honored at the subject's TZ. Pre-2026-04-28 the resolver ignored `iana_timezone` and used the server's TZ; INC-019 fixed that.

---

## 10. Recent provenance trail (for cross-reference)

- **INC-021** (2026-04-28): `tb_responses.dttm_created_utc` TZ-skew via bare-timestamp implicit cast. `nowStr()` returned a TZ-unqualified string (`'YYYY-MM-DD HH:MM:SS'`) which PG cast to TIMESTAMPTZ via the connection's session `TimeZone`; deterministic skew per (client environment, code path) when the upstream Supabase backend's session TZ resolved non-UTC. `saveSessionEvents` / `saveCalibrationSession` relied on the column DEFAULT and were immune — the same-transaction asymmetry is what made the bug visible. Fix: `nowStr()` returns `Date#toISOString()` directly (Z-qualified) in production, `${_dateOverride}T12:00:00+00:00` in simulation; both call sites (`saveResponse`, `saveComment`) covered. GOTCHAS entry rewritten from a "discipline note" into the historical-landmine pattern. Historical audit ran same evening: 9 skewed rows confirmed (response_id 47, 53, 60, 64, 66, 68, 72, 79, 84 — owner journal, April 19-28, all +5h CDT), 42 clean, 3 indeterminate (April 16-18, both writers used `nowStr()`), 31 immune (calibrations). Single-transaction repair `UPDATE` set the 9 confirmed rows' `dttm_created_utc` to their matching `tb_session_events.dttm_created_utc`; post-repair audit returns 0 skewed. Indeterminate 3 left as-is (no second-source ground truth).
- **INC-020** (2026-04-28): Universal session-cookie auth. One `/login` form for owner + subjects. `/api/subject/login` returns `isOwner` so the page dispatches; `/api/subject/logout` is universal (PUBLIC_PATHS). Cookie loses `Max-Age` (close-browser = logout). Middleware rewritten to gate owner pages/APIs (`/`, `/observatory/*`, `/api/respond`, `/api/calibrate`, `/api/today`, `/api/observatory/*`) with HTML-302-to-`/login?next=` vs JSON-401 by path classifier. Caddy basic-auth gate retired (`@owner_paths` block + `OWNER_BASICAUTH_HASH` removed from Caddyfile and prod secrets.env). Astro `security.checkOrigin` disabled — Node adapter behind Caddy reconstructs URL scheme from Host header (no X-Forwarded-Proto trust), so even matching Origin headers fail the check; SameSite=Lax cookie already blocks cross-origin POSTs. Logout button added to owner journal nav dropdown + every observatory page (via `[data-logout]` delegate in cmpObsToolbar). All `/enter` references → `/login`. Owner password set 2026-04-28 via `set-owner-password` (`must_reset_password` cleared). Pressure-tested end-to-end across owner + ash + multiple sessions.
- **INC-019** (2026-04-28): Subject-TZ calendar-flip fix. `localDateStr()` ignored `tb_subjects.iana_timezone` and used the server's local TZ (Hetzner = UTC). Ash submitted at 21:49 Chicago = 02:49 UTC the next day, so the server filed her day-1 entry under day-2's seed (q126 instead of q125). She perceived "no question today" the next morning because q126 came back with `existing_response_text != null`. Fix: extended `localDateStr(date, ianaTimezone?)` to use `Intl.DateTimeFormat({timeZone})`, plus a TZ-independent `addDays(yyyymmdd, days)` helper. Subject paths (`api/subject/today`, `api/subject/respond`, `seedUpcomingQuestions` via `create-subject`) pass `subject.iana_timezone`. Owner paths keep server-local behavior (owner is `iana_timezone='UTC'`). Ash's schedule repaired in-place: q125 deleted, q126-154 shifted back one day. 6 new tests in `tests/unit/utlDate.test.ts`. GOTCHAS entry rewritten from rationalization to historical landmine. Calendar-flip-at-subject-midnight is the design (per-question lockout, not 24h cooldown — adjacent days adjacent in time still count as separate entries by design).
- **2026-04-28 (Phase 6c — consent + export + delete + tests)**: Complete. Eleven build steps landed across three sessions. Migrations 038 (consent + audit tables, te_data_access_actor enum) + 039 (audit schema tightening: te_data_access_action lookup, action_type FK, notes JSONB). New code: `libConsent.ts` (recordConsent/recordDataAccess with sql.json for proper JSONB writes; getSubjectConsentStatus/getSubjectConsentHistory with DISTINCT ON dedup), `libDelete.ts` (deleteSubjectAndData full cascade across 23 tables + soft-delete + audit-inside-transaction; factoryResetSubject preserves seeds + sessions + account; OwnerProtectedError + AlreadyDeletedError + SubjectNotFoundError), `utlRequestContext.ts` (extracted IP/UA helpers when third caller landed). New endpoints: `/api/subject/consent`, `/api/subject/export` (NDJSON streaming, per-row decrypt, audit-row-before-stream, 25-table umbrella), `/api/subject/account/delete`. New CLI: `npm run factory-reset` and `npm run delete-subject` (both username-confirmation prompts, share libDelete with `actor='operator'`). New pages: `/consent.astro` (server-side marked-rendered, stale-version banner, decline-or-acknowledge), `/account.astro` (identity card + actions + DISTINCT ON consent history with expandable doc-per-version), `/account/delete.astro` (typed-username form). Journal footer links (settings + consent, fade with deepening cadence). Middleware consent gate with whitelist (`/consent`, `/logout`, `/export`, `/account/delete` reachable; everything else 403 consent_required). Consent doc edited in-place after backup verification (Hetzner 7d, Supabase Pro 7d → "up to 7 days"). Tests: 19 new (consent.test.ts + delete.test.ts), 170 total passing. Bugs found and fixed during smoke testing: JSONB double-encoding (libConsent — switched to `sql.json()`), TIMESTAMPTZ vs string contract drift (added `::text` casts in consent helpers), JSON.stringify-into-JSONB anti-pattern scope (12 columns documented in handoff §4 item 11 as Tier A; opportunistic migration policy locked).
- **2026-04-27 late-evening (post-Phase 6e polish)**: `npm run drain-subjects` orchestrator landed at `src/scripts/drain-subjects.ts`. Subprocess fan-out across the routine backfills (embeddings, signals, reconstruction, daily-deltas, profile); default loops all active subjects; `--subject-id N` and `--skip A,B` flags. Verified end-to-end against both subjects.
- **2026-04-27 late-evening (Phase 6e)**: Observatory subject toggle + inbox + replay redaction. New: `libObservatorySubject.ts` resolver (400/404 on bad input), `cmpObsToolbar.astro` with custom button+listbox dropdown (CSS-themable, full keyboard support), `/api/observatory/{subjects,inbox}.ts`, `/observatory/inbox.astro`. All 11 observatory API handlers + 7 pages now propagate `?subjectId=N`. Subject-content opacity rule established and saved to memory: when `subjectId !== OWNER_SUBJECT_ID`, the playback handler redacts non-whitespace in reconstructed text to `•` server-side so plaintext never crosses the wire (operator holds the key but the UI binds itself not to surface subject content). May be promoted to INC-019 in METHODS_PROVENANCE.md if you want the formal record.
- **INC-018** (2026-04-27): Subject-auth hardening (rate limit + 7-day expiry + session telemetry + IP capture)
- **INC-017** (2026-04-27): Entry states + reflections archive (this session); migration 035 collision resolved → 037
- **INC-016** (2026-04-27): Alice-negative state/dynamics/coupling tables archived (consumer-side scrub)
- **INC-015** (2026-04-27): Calibration context extraction deprecated
- **INC-014** (2026-04-27): Alice Negative full deprecation; `runGeneration` corpus-pivot
- INC-013 and earlier: see `systemDesign/METHODS_PROVENANCE.md` for the full record back to INC-001 (HoldFlight vector misalignment, 2026-04-21)

---

End of handoff.
