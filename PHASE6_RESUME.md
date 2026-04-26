# Phase 6a Resume Handoff (rewritten 2026-04-26)

The previous version of this file is obsolete. This rewrite captures the state
at end of the 2026-04-25 session: audit clean, all Phase 6a CODE shipped, only
external provisioning + first deploy remains.

---

## STOP. Read this first.

The next agent's job is **deploy buddy**, not coder. The user has:
- Decisions locked in (§2 below — DO NOT RELITIGATE)
- Code complete and tested (§3)
- Tests passing (87/87 across 9 files)
- Smoke test green
- Migration 029 applied locally and folded into the canonical schema
- A clear walkthrough in `deploy/README.md`

The agent's role:
- Quickly re-verify the state (§1) before doing anything else
- Walk the user through `deploy/README.md` step by step
- Diagnose issues as they come up (Hetzner quirks, Supabase pgvector toggle, Cloudflare DNS propagation, Caddy cert provisioning, systemd unit start, first owner login, first subject provisioning)
- Help troubleshoot the first deploy
- DO NOT propose new features
- DO NOT rewrite any auth/encryption code
- DO NOT relitigate the decisions in §2

---

## 0. TL;DR

The 2026-04-25 session shipped Phase 6a code end-to-end:
- Path 2-lite auth (username + Argon2id + opaque session tokens)
- AES-256-GCM at-rest encryption library
- Platform-aware `.node` loader (darwin/linux/win)
- SIGTERM-graceful worker shutdown
- systemd unit + Caddyfile + deploy.sh + secrets template + walkthrough README
- CLI provisioning tools (`npm run create-subject`, `npm run set-owner-password`)
- CI publishes `linux-x64` `.node` artifact on every push to main

What's unblocked: the user provisioning Hetzner Hillsboro CCX13 + Supabase
(us-west-2) + Cloudflare DNS, generating secrets, first deploy, owner password
bootstrap, and onboarding the first 1-2 subjects.

---

## 1. Re-verify (do this first, ~30 seconds)

```bash
# Local DB has migrations 027, 028, 029 applied
psql -d alice -c "\dt alice.tb_signal_jobs alice.tb_engine_provenance alice.tb_subject_sessions"

# Build clean
npm run build

# Test suite green
npm test                  # expect: 87 tests across 9 files

# End-to-end smoke (real Rust + real DB + real provenance flow)
npm run smoke             # expect: PASS, cleans up its own synthetic question
```

If any of these fail, halt and investigate before continuing. Do not proceed
with deploy steps if local state is broken.

---

## 2. Locked-in decisions (DO NOT RELITIGATE)

Each of these was settled through explicit user confirmation in the 2026-04-25
session. The agent does not re-open them.

- **Auth model: Path 2-lite.** Username + Argon2id password. Owner provisions
  accounts via `npm run create-subject`, hands temp password out-of-band,
  subject is forced to reset password on first login. No self-service signup,
  no email service, no email-based recovery (owner is the recovery mechanism).
- **Region: Hetzner Hillsboro, OR (US-West).** Matches the user's Supabase
  region (us-west-2). Sub-5ms latency between app server and DB.
- **Domain: `fweeo.com` apex as canonical.** `www.fweeo.com` redirects to apex.
- **AES-256-GCM key storage: systemd `EnvironmentFile` + password manager copy.**
  `/etc/alice/secrets.env` is root-owned, group-readable by the `alice` user.
  Two-copy redundancy. No external secrets manager.
- **TLS: Caddy + Let's Encrypt.** Real end-to-end TLS. Cloudflare DNS-only
  proxy mode. NOT Workers, NOT flexible-mode (which would terminate TLS at
  the edge and leave the origin hop in plaintext).
- **Local dev DB stays.** localhost Postgres for fast iteration + tests.
  After cutover, real journaling moves to fweeo.com (Supabase). Local becomes
  a dev sandbox + backup mirror.
- **No DEV_MODE flag.** Every journal and calibration submission is real prod
  data. This is permanent. See memory: `feedback_no_dev_mode.md`.
- **Owner endpoints gated by Caddy HTTP Basic Auth.** Until session-based
  owner auth lands in a future phase. Subject endpoints have their own
  session auth in `src/middleware.ts`.

---

## 3. What was shipped (file-level)

**Schema (migration 029):**
- `tb_subjects` extended: `username` UNIQUE, `password_hash`, `must_reset_password`, `iana_timezone`, footer cols. `invite_code` made nullable (legacy).
- `tb_subject_sessions` (new): `subject_session_id`, `subject_id`, `token_hash` UNIQUE, `expires_at`, `dttm_created_utc`.

**Libraries:**
- `src/lib/libCrypto.ts` — AES-256-GCM, lazy key load, throws on tamper, 10 unit tests
- `src/lib/libSubjectAuth.ts` — Argon2id hash/verify, session token issue/verify/sweep, password reset, owner provisioning, 11 unit + 17 DB tests
- `src/lib/libSubject.ts` — rewritten: `getRequestSubject` is now session-cookie + `verifySubjectSession`
- `src/middleware.ts` (new) — attaches `locals.subject`, gates `/api/subject/*` (auth + non-owner + must_reset_password)
- `src/lib/libSignalsNative.ts` — platform-aware loader, exports `BINARY_PATH` for provenance hashing
- `src/lib/libEngineProvenance.ts` — uses `BINARY_PATH` so SHA-256 matches the running binary
- `src/lib/libSignalWorker.ts` — SIGTERM/SIGINT handler that drains in-flight job before exit

**Endpoints + pages:**
- `POST /api/subject/login` (sets HttpOnly + Lax + Secure-in-prod session cookie)
- `POST /api/subject/reset-password` (verifies current, sets new, deletes ALL sessions)
- `POST /api/subject/logout` (idempotent)
- `/api/subject/today` + `/api/subject/respond` updated to use `locals.subject`
- `src/pages/enter.astro` — username + password form (was invite_code)
- `src/pages/reset-password.astro` (new) — forced first-login reset

**CLI tools:**
- `npm run create-subject -- <username> <temp-password> [tz] [display-name]`
- `npm run set-owner-password -- <password>` (one-time bootstrap)

**Deploy infra:**
- `deploy/alice.service` — systemd unit (alice user, EnvironmentFile, 30s graceful stop, hardened sandbox)
- `deploy/Caddyfile` — TLS via Let's Encrypt, www to apex redirect, HTTP Basic Auth on owner paths via `OWNER_BASICAUTH_HASH`
- `deploy/secrets.env.example` — template
- `deploy/deploy.sh` — push code + scp linux-x64 .node + restart
- `deploy/README.md` — one-time host setup walkthrough
- `.github/workflows/signal-reproducibility.yml` — push trigger always builds linux-x64 artifact (no path filter); 90-day retention

**Docs:**
- `CLAUDE.md` — new sections: Subject Auth, At-rest Encryption, Deployment
- `GOTCHAS.md` — new entries: invite_code legacy, ALICE_ENCRYPTION_KEY permanence, libCrypto throws on tamper, session token hashing, password reset wipes all sessions, owner endpoints gated by Caddy

---

## 4. Pending: external provisioning (the user's work)

Walkthrough lives in `deploy/README.md`. Hold the user's hand through these,
in order. Diagnose issues. Don't skip steps even if they seem obvious.

1. **Generate keys (laptop):**
   ```bash
   openssl rand -base64 32                                  # ALICE_ENCRYPTION_KEY (save in 1Password)
   ssh-keygen -t ed25519 -f ~/.ssh/alice_hetzner -C alice   # SSH keypair for Hetzner
   caddy hash-password                                      # OWNER_BASICAUTH_HASH (save in 1Password)
   ```

2. **Provision Hetzner CCX13** in Hillsboro, OR. Add `~/.ssh/alice_hetzner.pub`
   during creation. Note the IP.

3. **Provision Supabase** project (user already has us-west-2 set up). Capture
   the connection pooler URL from Settings → Database. Enable pgvector extension
   if not already on.

4. **One-time host setup** — walk through `deploy/README.md` § "One-time setup",
   step by step, on the Hetzner host. The user follows along; the agent
   diagnoses any step that fails.

5. **Cloudflare DNS** — A record `fweeo.com` to Hetzner IP, proxy ON. Same
   for `www.fweeo.com`. Wait for propagation. Confirm Caddy auto-issues TLS
   cert from Let's Encrypt (`journalctl -u caddy --since '1 minute ago'`).

6. **Apply migrations to Supabase** (one-time):
   ```bash
   for f in db/sql/migrations/*.sql; do
     psql -d "$ALICE_PG_URL" -f "$f"
   done
   ```
   Audit each migration before running. There are 29.

7. **`pg_dump` localhost to Supabase** to bring the user's 65 historical sessions
   over (one-time):
   ```bash
   pg_dump --data-only --schema=alice postgres://localhost/alice > /tmp/alice-data.sql
   psql -d "$ALICE_PG_URL" -f /tmp/alice-data.sql
   ```
   (Or filter to specific tables if a full dump is too large.)

8. **First deploy** via `deploy/deploy.sh`. Set owner password with
   `npm run set-owner-password`.

9. **Provision first subject(s)** with `npm run create-subject`. Hand
   credentials out-of-band (Signal, in person).

---

## 5. How to be useful in this session

- **Confirm before destructive operations.** Migrations, `pg_dump` overwrites,
  `systemctl restart`, DNS changes. The user agreed to walk through; that
  doesn't mean blanket consent for risky steps.
- **Read errors carefully.** Caddy cert provisioning fails for many reasons
  (DNS not yet propagated, port 80/443 blocked, mis-pointed A record). Don't
  guess; read the actual journalctl output.
- **Don't skip the smoke test on Hetzner.** After first deploy, verify with
  `curl https://fweeo.com/api/subject/login -X POST` (expect 400 missing
  credentials). Then test the journal flow end-to-end.
- **Don't touch `.env` or secrets files unless asked.** They contain real
  credentials.
- **If a step fails, surface it.** Don't paper over with a workaround. The user
  prefers loud failures (per memory: `feedback_collaboration_style.md`).

---

## 6. Things to NEVER do this session

- Re-open any decision in §2.
- Refactor working code "while we're here."
- Commit `.env`, secrets, the `.node` binary, or anything in `data/`.
- Run `git push --force` or `git reset --hard` against any remote branch.
- Apply migrations against Supabase without the user reading them first.
- Edit `src/lib/libSubjectAuth.ts` to "improve" the Argon2 parameters.
- Re-introduce `invite_code` reads in any new code (it's legacy, see GOTCHAS).
- Add a DEV_MODE flag, draft entries, test tagging, or any "fake entry"
  mechanism (memory: `feedback_no_dev_mode.md`).
- Build the Linux `.node` locally and SCP it. Pull from CI artifact instead
  (the `target-cpu=x86-64-v3` flag matters; only CI sets it).

---

## 7. After Phase 6a (next phases, brief)

These are NOT in scope for this session unless the user explicitly says
"start 6b." The agent should not start them on their own.

- **6b — Encrypted subject responses + tz scheduling.** Wire libCrypto into
  `tb_subject_responses` (text becomes ciphertext + nonce columns). Use
  `iana_timezone` from tb_subjects in the scheduler.
- **6c — Consent + delete + export.** Markdown consent doc, delete endpoint
  that wipes all subject data with audit row, export endpoint that returns
  decrypted JSON dump.
- **6d — Embedder queue.** Move `embedResponse` to its own job kind so TEI
  outages auto-retry rather than running inline.
- **6e — Observatory subject toggle + decrypt + notifications.** Owner views
  any subject's data; subject can never see another subject's data; owner
  notification when subject submits (channel TBD).

---

## 8. Quick reference

```bash
# Re-verify
psql -d alice -c "\dt alice.tb_signal_jobs alice.tb_engine_provenance alice.tb_subject_sessions"
npm run build && npm test && npm run smoke

# Provisioning (laptop)
openssl rand -base64 32                            # AES key
ssh-keygen -t ed25519 -f ~/.ssh/alice_hetzner      # SSH key
caddy hash-password                                # owner basic-auth hash

# Subject provisioning (after deploy)
ALICE_PG_URL='postgres://...supabase...' \
  npm run create-subject -- <username> <temp-pw> <iana-tz> <display-name>

# Owner password (one-time after first deploy)
ALICE_PG_URL='postgres://...supabase...' \
  npm run set-owner-password -- <password>

# Pull latest linux .node from CI
gh run download --name alice-signals-linux-x64 -D /tmp/alice-deploy

# Deploy
ALICE_DEPLOY_HOST=<hetzner-ip> \
LOCAL_NODE_BINARY=/tmp/alice-deploy/alice-signals.linux-x64-gnu.node \
deploy/deploy.sh
```

---

## 9. Resume command

The next agent reads this file in full, runs §1 (re-verify), and reports
either "verify clean, ready for provisioning" or "verify failed at X."
If clean, the agent waits for the user to start §4 step 1 and walks through
each step diagnosing issues. The full setup walkthrough lives in
`deploy/README.md` — this handoff is the meta-context for that document.

End of handoff.
