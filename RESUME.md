# RESUME — Alice production deploy + ongoing work

Updated 2026-04-26. Phase 6a deploy is complete and live. This file is the
resume point for any future agent or future-you. The user wants to keep
working — there is real work queued up in §3 below, not just polish.

---

## STOP. Read this first.

Production is live at https://fweeo.com/. The box runs alice.service +
caddy.service on a Hetzner CCX13 in Hillsboro. Supabase Postgres holds the
data (89 questions, 72 responses, 69 sessions, all imported from local).
The owner is fully usable. One subject (`ash`) is provisioned but has hit
a real gap in subject scheduling — see §3.

**Decisions locked in (do NOT relitigate):** auth model (Path 2-lite, owner
via Caddy basic-auth + subjects via session), region (Hetzner Hillsboro +
Supabase us-west-2), domain (fweeo.com apex canonical), TLS (Caddy + LE,
Cloudflare Full strict), no DEV_MODE, encrypted-at-rest plan, owner-only
gates via Caddy until session-based owner auth ships in a future phase.

---

## 1. What's running right now

### Hetzner box (`alice-prod`, IPv4 `5.78.203.243`)
- Ubuntu 24.04, Node 22.22.2, Caddy 2.11.2 (cloudsmith stable repo)
- alice user (uid 996), repo at `/opt/alice`
- alice.service: Astro Node server + signal worker on `localhost:4321`
- caddy.service: TLS termination + HTTP basic-auth gate on owner paths.
  Loads `/etc/alice/secrets.env` via systemd drop-in at
  `/etc/systemd/system/caddy.service.d/override.conf`
- Linux .node binary at `/opt/alice/src-rs/alice-signals.linux-x64-gnu.node`
  (pulled from CI artifact run 24962684508)
- TLS: Let's Encrypt certs for `fweeo.com` + `www.fweeo.com`,
  Cloudflare Full(strict) end-to-end
- Backups: Hetzner daily snapshots enabled

### Supabase (project `Fweeo`, ref `sxzortfjengyztdgeqvl`, us-west-2)
- Schema `alice` applied via canonical `dbAlice_Tables.sql` (52 tables)
- pgvector extension lives in `extensions` schema; the postgres role's
  `search_path` is set to `alice, public, extensions` so unqualified
  `vector` and `vector_l2_ops` resolve in app code
- 89 questions, 72 responses, 69 session summaries, 36 dynamical signals,
  36 motor signals, 23 embeddings imported from local Postgres
- All sequences advanced past max(id) so future inserts work
- Connection: Session pooler on port 5432. (Transaction pooler is paid
  IPv4 add-on; Session pooler is free + IPv4 + supports prepared statements
  which postgres.js needs.)

### Subject auth state
- **Owner:** subject_id=1, username=`owner`, password = the local one the
  user has been using (imported from local). Logs in via Caddy basic-auth
  + main app paths, no in-app login form. The set-owner-password CLI is
  idempotent if rotation is needed.
- **Subject `ash`:** subject_id=2, tz=America/Chicago, display=`Ash`. Temp
  password (single-use): `B1dUKNCLK4XkCuS8`. She has logged in but received
  "no question today" — see §3.

### Local laptop state
- `.env` populated with ALICE_ENCRYPTION_KEY, ALICE_PG_URL (Session pooler
  URL with substituted password), ANTHROPIC_API_KEY (note: legacy entry is
  named `ANTHROPIC_API_KEY2`, may need rename), CADDY_HASH (cosmetic copy)
- `~/.ssh/alice_hetzner{,.pub}` ed25519 keypair, passphrase-protected
- 87/87 tests passing on Node 25 local

### Repo state
- main is up to date with origin
- All deploy-divergence fixes committed and pushed (commit
  `634d33b fix(deploy): make a clean reprovision actually work end-to-end`)
- CI on ubuntu-latest runs the full vitest suite (testcontainers needs
  Docker which macOS runners don't ship). Reproducibility CI builds
  linux-x64 .node on every push to main.

---

## 2. Deploy mental model

**Push ≠ deploy.** `git push origin main` updates GitHub + triggers CI to
build the Linux .node artifact. It does NOT touch the Hetzner box.

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

## 3. Open work (start here next session)

`ash` logged in successfully but the app showed "no question today, come
back tomorrow." Subject scheduling is not yet wired into the login or
onboarding flow. This is the natural next thing to tackle.

### What exists
- `src/lib/libScheduler.ts` `scheduleQuestionForSubject(subject_id, date)`
  picks a corpus question with no-repeat windowing, inserts into
  `tb_scheduled_questions`. Production-ready.
- `src/scripts/schedule-questions.ts` schedules TOMORROW for all active
  non-owner subjects. Needs to run nightly (cron / systemd timer).
- `tb_question_corpus` table for owner-curated questions.

### What's missing
1. **No question for today.** The script schedules `tomorrow`, not `today`,
   so a subject who logs in on day-of-provisioning gets nothing.
2. **No nightly cron.** `schedule-questions.ts` has to be wired into systemd
   as a daily timer.
3. **Empty corpus on Supabase (likely).** Verify with
   `SELECT count(*) FROM alice.tb_question_corpus`. If empty, seed.

### Recommended sequence
1. Verify corpus state on Supabase. If empty, seed it (curate via owner UI
   or a SQL insert from the user's set of 89 questions filtered down).
2. Manually run `ALICE_PG_URL=... npm run schedule-questions` to prove the
   end-to-end pipeline works for ash.
3. Fix "today" gap: extend `create-subject.ts` to also schedule today +
   tomorrow at provision time, OR extend `/api/subject/today` to
   lazy-schedule on first request.
4. Wire the script into systemd as a daily timer
   (`alice-schedule.timer` + `alice-schedule.service`) on Hetzner.

This is Phase 6b territory ("tz scheduling").

---

## 4. Phase 6 roadmap (per CLAUDE.md, abridged)

- **6a — DONE.** Path 2-lite auth, Argon2id, encrypted at-rest library,
  Linux .node loader, SIGTERM-graceful worker, systemd unit, Caddyfile,
  CLI tools, deploy infra. Shipped in this session.
- **6b — Encrypted subject responses + tz scheduling.** Wire libCrypto into
  `tb_subject_responses` (text → ciphertext + nonce columns). Use
  `iana_timezone` in the scheduler. Includes the §3 work.
- **6c — Consent + delete + export.** Markdown consent doc, delete endpoint
  that wipes all subject data with audit row, export endpoint that returns
  decrypted JSON dump.
- **6d — Embedder queue.** Move `embedResponse` to its own job kind so TEI
  outages auto-retry rather than running inline.
- **6e — Observatory subject toggle + decrypt + notifications.** Owner
  views any subject's data; subject can never see another subject's data;
  owner notification when subject submits.

User wants to continue working — pick this up at 6b unless otherwise
directed.

---

## 5. Known minor papercuts (low priority)

- `.env` has `ANTHROPIC_API_KEY2=` (legacy). Alice expects
  `ANTHROPIC_API_KEY`. Rename or delete.
- Caddyfile emits `Unnecessary header_up X-Forwarded-For` and
  `X-Forwarded-Proto` warnings at boot — reverse_proxy sets these by default
  in Caddy 2.8+. Cosmetic, can drop the explicit ones.
- Caddyfile emits `Caddyfile input is not formatted; run 'caddy fmt
  --overwrite' to fix inconsistencies` — run `caddy fmt --overwrite
  deploy/Caddyfile` from laptop, commit.
- `ALICE_ENCRYPTION_KEY` exists on laptop `.env` and Hetzner
  `/etc/alice/secrets.env`. User should also have a 1Password copy. Losing
  it = losing every encrypted subject response forever.
- No automated test for the full subject-onboarding flow yet (login →
  forced reset → daily question). Add to integration suite when 6b lands.
- The Caddy `basicauth` (one-word) hot-fix on the live box: deploy/Caddyfile
  in repo uses canonical `basic_auth` (Caddy 2.8+). Live box file currently
  has `basicauth` from the 2.6.2 era. Both work in 2.11. To realign:
  `cp /opt/alice/deploy/Caddyfile /etc/caddy/Caddyfile && systemctl reload
  caddy` — small drift, no urgency.

---

## 6. Quick recovery commands

```bash
# Reconnect
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243        # for /etc edits
ssh -i ~/.ssh/alice_hetzner alice@5.78.203.243       # for /opt/alice

# Status
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243 'systemctl status alice.service caddy --no-pager | head -30'

# Live logs
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243 'journalctl -u alice.service -f'

# External health
curl -I https://fweeo.com/                           # 401 (basic auth challenge)
curl -I https://fweeo.com/enter                      # 200 (subject login form)

# DB shell against Supabase
ALICE_PG_URL=$(awk -F= '/^ALICE_PG_URL=/{sub(/^[^=]*=/,""); print}' .env) && psql "$ALICE_PG_URL"

# Provision another subject (laptop)
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
```

---

## 7. Things to NEVER do

- Re-relitigate the locked-in decisions in the STOP block
- Refactor working production code "while we're here"
- Commit `.env`, secrets, the `.node` binary, or anything in `data/`
- `git push --force` or `git reset --hard` against any remote branch
- Apply migrations to Supabase without the user reading them first
- Add a DEV_MODE flag, draft entries, test tagging
- Build the Linux .node locally and SCP it (always pull from CI artifact —
  the `target-cpu=x86-64-v3` flag matters for bit-identity across
  Hetzner's microarch fleet)

---

End of resume.
