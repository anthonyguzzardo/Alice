# Handoff — Alice

Single source of truth for system state, open work, and operational facts. Replaces the prior `HANDOFF_*.md` + `RESUME.md` pair.

Updated 2026-04-27 evening. **Read this top-to-bottom before doing anything.**

---

## STOP. Read this first.

Production runs at https://fweeo.com on a Hetzner CCX13 (Hillsboro), backed by Supabase Postgres (us-west-2). The instrument is fully operational: owner has 73+ historical responses; one subject (`ash`) is provisioned. Today's work landed every pending archival pass (alice-negative full deprecation, calibration extraction, entry-states + reflections), uniformly encrypted every subject-bearing column, hardened subject auth (rate limit + 7-day expiry + IP/last-seen telemetry), and rebuilt the per-entry observatory detail page on live signals only.

**Decisions locked in (do NOT relitigate):** auth model (Path 2-lite for subjects via session cookie + Argon2id; owner via Caddy basic-auth until session-based owner auth ships); region (Hetzner Hillsboro + Supabase us-west-2); domain (fweeo.com apex canonical); TLS (Caddy + Let's Encrypt, Cloudflare Full strict); no DEV_MODE; encryption uniformly applied; archival means removal not stubbing; Rust signal engine is the single source of truth; logical FKs only — no cascade deletes; alice-negative artistic rendering is fully gone; the black box is sacred (never surface responses, future questions, signals, or trait values to the user).

---

## 1. What's running

### Hetzner box (`alice-prod`, IPv4 `5.78.203.243`)
- Ubuntu 24.04, Node 22.22.2, Caddy 2.11.2 (cloudsmith stable repo)
- `alice` user (uid 996), repo at `/opt/alice`
- `alice.service` — Astro Node server + signal worker on `localhost:4321`
- `caddy.service` — TLS termination + HTTP basic-auth gate on owner paths. Loads `/etc/alice/secrets.env` via systemd drop-in
- Linux `.node` binary at `/opt/alice/src-rs/alice-signals.linux-x64-gnu.node` (pulled from CI artifact, NOT built locally — `target-cpu=x86-64-v3` flag matters for bit-identity across Hetzner microarch fleet)
- TLS: Let's Encrypt for `fweeo.com` + `www.fweeo.com`, Cloudflare Full(strict) end-to-end
- Backups: Hetzner daily snapshots enabled

### Supabase (project `Fweeo`, ref `sxzortfjengyztdgeqvl`, us-west-2)
- Schema `alice` applied via canonical `db/sql/dbAlice_Tables.sql`
- pgvector lives in `extensions` schema; pool's `search_path = alice, public, extensions`
- Connection: Session pooler on port 5432 (free + IPv4 + supports prepared statements which postgres.js needs)
- **All migrations 030 through 037 are applied.** Audit performed 2026-04-27 evening — see INC-017 §"Side cleanups" and §3 below

### Subject auth state
- **Owner** (`subject_id=1`, username=`owner`): logs in via Caddy basic-auth on `fweeo.com`, no in-app login form. `set-owner-password` CLI is idempotent if rotation needed
- **`ash`** (`subject_id=2`, tz=America/Chicago): provisioned. Subject-side onboarding bug — first-day login returns "no question today" because the scheduling script writes tomorrow only, not today. Tracked in §4
- **Auth hardening (2026-04-27, INC-018):** sessions expire after 7 days (was 30); login rate-limited to 10 attempts / 15 min / IP via `utlRateLimit.ts`; `tb_subject_sessions.last_seen_at` + `last_ip` populated on each verify (throttled to one write per 5 minutes per session)

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

### Operational gaps in the subject path (real bugs)

1. **Subject journal event-log parity.** `src/pages/api/subject/respond.ts` saves `tb_responses` + `tb_session_summaries` but NOT `tb_session_events` (the encrypted `event_log_json` + `keystroke_stream_json`). Calibration path saves them. Without parity, signals can't be recomputed offline for subject journals; the operator's offline rebuilds will silently skip subject data. Fix: mirror the calibration code's event-log save into respond.ts. ~30 min.

2. **TZ scheduling for subjects.** `src/scripts/schedule-questions.ts` schedules tomorrow only; there's no nightly cron; `create-subject.ts` doesn't seed a today-scheduled question. Result: a subject who logs in on day-of-provisioning gets "no question today." Fix has three sub-tasks:
   - Extend `create-subject.ts` to also schedule today + tomorrow at provision time, OR extend `/api/subject/today` to lazy-schedule on first request
   - Wire `schedule-questions.ts` into systemd as `alice-schedule.timer` + `alice-schedule.service` on Hetzner (daily, fires per `iana_timezone` boundary)
   - Verify on Supabase that `tb_question_corpus` is non-empty (else seed with curated set from owner's question history)

### Phase 6 future work (not bugs, just unbuilt)

3. **Owner session-based auth.** Owner endpoints (`/`, `/observatory/*`, `/api/respond`, `/api/calibrate`) are still gated by Caddy basic-auth via `OWNER_BASICAUTH_HASH` in `deploy/Caddyfile`. Goal: replace with the same session-cookie model used for subjects (`libSubjectAuth`), letting both auth paths share one infrastructure. Touches Caddyfile, middleware, possibly a new `/owner-login` form.

4. **Phase 6c — consent + delete + export.** Markdown consent doc. Delete endpoint that wipes a subject's data with an audit row. Export endpoint that returns decrypted JSON dump. Required before opening enrollment beyond the manually-provisioned single subject.

5. **Phase 6d — embedder queue.** Move `embedResponse` from inline-in-pipeline to its own `tb_signal_jobs` job kind (`embed`). Today, when TEI is offline, embeds skip and `npm run backfill` drains them later. With its own job kind, retries become automatic per job (quadratic backoff already implemented in `libSignalWorker`).

6. **Phase 6e — observatory subject toggle + decrypt + notifications.** Owner can view any subject's data at `/observatory/?subjectId=N`. Subject can never see another subject's data. Owner gets a notification when a subject submits.

### Cosmetic / low-priority

7. **Pre-existing TS strict-null noise.** Lingering "possibly undefined" / "not assignable" errors in `libDb`, `libCrossSessionSignals`, `libSemanticSignals`, `libDynamics`, `libDocs`, `libEmotionProfile`, `scripts/archive/*`. Not breaking; discrete cleanup pass when convenient.

8. **`data/errors.log.bak.2026-04-27`.** Forensic backup of the stale error log at the moment the time-window filter shipped. Gitignored. Delete with `rm data/errors.log.bak.*` whenever you stop caring about the old debug entries.

---

## 5. Critical architectural rules (do not violate)

From CLAUDE.md, memory, and the discipline established across INC-014 through INC-018:

1. **Single source of truth for measurements.** Rust signal engine. No TypeScript fallback. Health endpoint exposes `rustEngine: true/false`. A measurement instrument cannot have two implementations.
2. **Logical foreign keys only.** No physical FK constraints. Application code is responsible for cascade deletes. See CLAUDE.md "Cascade Dependencies per Parent Table".
3. **The black box is sacred.** Never surface to the user: their own response text, future-day question text, raw signal values, trait floats, behavioral metrics. The observatory is designer-facing; the journal is the user surface; never cross the streams.
4. **Archival means removal, not stubbing.** When a feature is deprecated, all code goes; data is preserved under `zz_archive_*` tables. Both producer AND consumer sides of the dependency edge must be cut in the archival commit (the lesson from INC-014/015/016/017).
5. **Prod is signal-store-only.** Embedding (TEI/Qwen) and LLM (Anthropic) work happen LOCALLY only via `npm run dev:full`. Never on prod.
6. **Contamination boundary.** Subject submissions NEVER trigger LLM/embed/signal jobs. The boundary docstrings in `src/pages/api/subject/respond.ts` and `src/pages/api/subject/calibrate.ts` are load-bearing.
7. **Every subject gets 30 personal seeds at account creation** via `seedUpcomingQuestions` called from `create-subject.ts`. Seeds are sacred — never overwritten. Corpus refresh is ADDITIVE.
8. **No DEV_MODE.** Every journal/calibration submission is real prod data. Discipline, not feature flag.
9. **Encryption key (`ALICE_ENCRYPTION_KEY`) is permanent.** Lose it = lose every encrypted row across all in-scope tables. Backed up in operator's password manager AND in `/etc/alice/secrets.env`.
10. **Migrations run by hand.** Audit before applying. No auto-apply.

---

## 6. Operational state (2026-04-27 session end)

- **Owner** (subject_id=1): 73+ historical responses, working through corpus.
- **Ash** (subject_id=2): provisioned, blocked on TZ scheduling (§4 item 2).
- **TEI**: Qwen3-Embedding-0.6B at `localhost:8090` when running locally. Not on prod.
- **ANTHROPIC_API_KEY**: in `.env` and `/etc/alice/secrets.env`. Used only by local LLM workflows (corpus refresh, etc.) — never on prod.
- **Tests**: 8 unit suites, 84 unit tests, all passing. DB tests run on CI only (Docker required).
- **TS check**: clean on every file touched in recent sessions. Pre-existing strict-null noise tracked in §4 item 7.
- **Working tree**: should be clean after this handoff lands. Verify with `git status --short`.

---

## 7. File paths the next agent will need

- **Repo root:** `/Users/anthonyguzzardo/Developer/Personal/GitHub/Einstein`
- **DB connection:** via `ALICE_PG_URL` in `.env` (Supabase us-west-2 pooler)
- **Memory system:** `/Users/anthonyguzzardo/.claude/projects/-Users-anthonyguzzardo-Developer-Personal-GitHub-Einstein/memory/MEMORY.md` (always loaded into context) + per-topic files
- **Provenance log:** `systemDesign/METHODS_PROVENANCE.md` (newest first; INC-018 is the most recent)
- **Schema:** `db/sql/dbAlice_Tables.sql` (single intact CREATE-TABLE script; the canonical state)
- **Migrations:** `db/sql/migrations/` (NN_description.sql; NOT auto-applied)
- **Subject auth:** `src/lib/libSubjectAuth.ts`, `src/lib/libSubject.ts`, `src/lib/utlRateLimit.ts`, `src/middleware.ts`, `src/pages/api/subject/*`
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
curl -I https://fweeo.com/                           # 401 (basic auth challenge)
curl -I https://fweeo.com/enter                      # 200 (subject login form)

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

---

## 10. Recent provenance trail (for cross-reference)

- **INC-018** (2026-04-27): Subject-auth hardening (rate limit + 7-day expiry + session telemetry + IP capture)
- **INC-017** (2026-04-27): Entry states + reflections archive (this session); migration 035 collision resolved → 037
- **INC-016** (2026-04-27): Alice-negative state/dynamics/coupling tables archived (consumer-side scrub)
- **INC-015** (2026-04-27): Calibration context extraction deprecated
- **INC-014** (2026-04-27): Alice Negative full deprecation; `runGeneration` corpus-pivot
- INC-013 and earlier: see `systemDesign/METHODS_PROVENANCE.md` for the full record back to INC-001 (HoldFlight vector misalignment, 2026-04-21)

---

End of handoff.
