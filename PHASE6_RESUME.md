# Phase 6a Resume Handoff (rewritten 2026-04-26 mid-deploy)

The 2026-04-26 session got the Hetzner CCX13 fully provisioned, alice.service
running, and the Caddyfile installed. The deploy is **paused mid-step on the
Caddy env-var drop-in.** Everything else up to that point is verified.

---

## STOP. Read this first.

The next agent's job is **finish the deploy**, not coder.

- Decisions locked in (§2 of original handoff — DO NOT RELITIGATE)
- Code complete and tested (87/87 across 9 files, smoke green)
- Hetzner box live and serving on `localhost:4321`
- Caddy installed but failing on basic-auth (env var not loading) — fix is queued, see §3 below
- DNS, migrations, data import, first login still pending

---

## 1. Box state (verified working as of pause)

- **Server:** `alice-prod`, Hetzner CCX13, Hillsboro OR, public IPv4 `5.78.203.243`
- **OS:** Ubuntu 24.04
- **Stack:** Node 22.22.2, Caddy 2.6.2, systemd, no Docker
- **User:** `alice` (uid 996), home `/home/alice`, repo at `/opt/alice`
- **SSH access (root):** `ssh -i ~/.ssh/alice_hetzner root@5.78.203.243`
- **SSH access (alice):** `ssh -i ~/.ssh/alice_hetzner alice@5.78.203.243`
- **Sudoers:** alice can `systemctl restart|status alice.service` passwordless
- **Secrets:** `/etc/alice/secrets.env`, root:alice 640, 4 values populated
  (ALICE_ENCRYPTION_KEY, ALICE_PG_URL, ANTHROPIC_API_KEY, OWNER_BASICAUTH_HASH)
- **Repo:** cloned from `https://github.com/anthonyguzzardo/Alice.git` at
  `/opt/alice`, owned by alice, npm ci done, Astro built (`dist/`)
- **Linux .node:** present at `/opt/alice/src-rs/alice-signals.linux-x64-gnu.node`
  (1.16 MB, pulled from CI run 24962684508)
- **alice.service:** **running**, listening on `http://localhost:4321`
  (verified `curl /` returns HTTP 200)
- **caddy.service:** failing — see §3

### Local-env state on user's laptop

- `.env` populated with: `ALICE_ENCRYPTION_KEY`, `ALICE_PG_URL` (Supabase pooler URL,
  password-substituted), `ANTHROPIC_API_KEY`. The Caddy basic-auth hash is also
  pasted there (line 19) but is NOT a secret (one-way bcrypt) — fine to keep.
- `~/.ssh/alice_hetzner{,.pub}` ed25519 keypair, passphrase-protected
- Hetzner SSH pubkey deduped on box (was inserted twice during paste)

---

## 2. Live fixes that DIVERGE from the repo (must commit back)

While bringing the box up we discovered three repo-level bugs in `deploy/`. The
running box has fixes applied to its local copies; the repo copies still have
the bugs and would re-introduce them on the next fresh-server provision or
`deploy.sh` run.

These all need a commit back to `main`:

1. **`deploy/alice.service` line 41** — add `AF_NETLINK` to
   `RestrictAddressFamilies`. Without it, Node spams errno 97 from
   `uv_interface_addresses` (Linux uses NETLINK to enumerate interfaces).
   Box has: `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK`
2. **`deploy/alice.service` line 45** — move the inline comment
   (`# napi-rs .node files mmap with PROT_EXEC`) to a separate line above
   `MemoryDenyWriteExecute=false`. systemd (this version) emits
   `Failed to parse boolean value, ignoring: false  # ...` because it
   doesn't strip inline comments after directive values.
3. **`deploy/Caddyfile` line 38** — `basic_auth` is Caddy 2.8+ syntax;
   Ubuntu 24.04 ships Caddy 2.6.2 which uses `basicauth` (one word).
   Box has: `basicauth @owner_paths {`

CI workflow fixes also landed during this session and ARE already in the
repo (commit `update for linux`):
- `.github/workflows/ci.yml`: switched runner `macos-14` → `ubuntu-latest`
  (testcontainers needs Docker, not preinstalled on macOS runners)
- `package-lock.json`: regenerated to add `@emnapi/runtime@1.10.0` and
  `@emnapi/core@1.10.0` (lockfile drift from Node 25 local vs Node 22 CI)

---

## 3. Where we paused — Caddy env var drop-in

`caddy.service` on the box is failing with:
```
authentication: account 0: username and password are required
```
because `OWNER_BASICAUTH_HASH` is in `/etc/alice/secrets.env` which is loaded
by `alice.service`, not `caddy.service`. They are separate systemd units.

**Fix queued (paste into root@alice-prod shell):**

```bash
mkdir -p /etc/systemd/system/caddy.service.d && echo -e '[Service]\nEnvironmentFile=/etc/alice/secrets.env' | tee /etc/systemd/system/caddy.service.d/override.conf
cat /etc/systemd/system/caddy.service.d/override.conf
systemctl daemon-reload
systemctl restart caddy
sleep 2
systemctl status caddy --no-pager | head -10
```

Expected: `Active: active (running)`. Cert provisioning will fail at this
point because DNS isn't pointed yet — that's expected, Caddy auto-retries
once DNS resolves.

This same Caddy drop-in needs to be persisted into the repo too — either as
`deploy/caddy-override.conf` documented in `deploy/README.md`, or by
inlining the hash into the Caddyfile and dropping the env-var indirection.
Discuss with user before deciding.

---

## 4. Remaining work (in order)

### a. Cloudflare DNS for `fweeo.com`

User account: `Anthony@mrfoxco.com` (cloudflare account, saw the tab earlier).

In Cloudflare for the `fweeo.com` zone:
- A record: `fweeo.com` → `5.78.203.243`, **proxy ON** (orange cloud)
- A record: `www.fweeo.com` → `5.78.203.243`, **proxy ON**
- Wait 1-5 min for propagation
- Watch Caddy: `journalctl -u caddy -f --since '1 minute ago'` — should see
  ACME challenge, cert issued
- Verify externally: `curl -I https://fweeo.com/` returns 401 (basic auth
  prompt) for owner paths, or 200 for `/enter`

**Cloudflare proxy mode caveat:** with Cloudflare proxy ON, Let's Encrypt
HTTP-01 challenges still work because Caddy serves the challenge on port 80
and Cloudflare proxies port 80 by default. If cert fails, fallback is to
flip the records to **DNS-only** (grey cloud) for 5 min, let Caddy issue,
then flip back to proxy.

### b. Apply 29 migrations to Supabase (one-time)

From the user's **laptop**, with `ALICE_PG_URL` set to the Supabase pooler URL:

```bash
cd /Users/anthonyguzzardo/Developer/Personal/GitHub/Einstein
for f in db/sql/migrations/*.sql; do
  echo "=== $f ==="
  psql -d "$ALICE_PG_URL" -f "$f"
done
```

Audit each before running. There are 29 migrations. The canonical schema
in `db/sql/dbAlice_Tables.sql` is also an option for a clean Supabase, but
running migrations preserves any historical decisions encoded in them.

pgvector is already enabled on Supabase (user confirmed). Verify
post-migration:
```sql
\dn alice
\dt alice.*
SELECT count(*) FROM alice.tb_signal_jobs;          -- expect 0
SELECT count(*) FROM alice.tb_engine_provenance;    -- expect 0
SELECT count(*) FROM alice.tb_subject_sessions;     -- expect 0
```

### c. pg_dump localhost → Supabase (one-time)

Bring 65 historical sessions over from the user's local Postgres:

```bash
pg_dump --data-only --schema=alice postgres://localhost/alice > /tmp/alice-data.sql
psql -d "$ALICE_PG_URL" -f /tmp/alice-data.sql
```

If full dump errors on FK-like ordering, fall back to per-table dumps in
dependency order. There are no physical FKs (logical FKs only — see
CLAUDE.md "Logical Foreign Keys") so a `--data-only` dump *should* import
cleanly.

### d. First deploy verification

After DNS resolves and Caddy issues a cert:

- Visit `https://fweeo.com/enter` — should load the username/password form
  WITHOUT a basic-auth prompt (it's a subject path, not gated by Caddy)
- Visit `https://fweeo.com/` — should prompt for HTTP basic auth (owner gate)
- Auth as `owner` + the password the user fed to `caddy hash-password`
- After basic-auth succeeds, the page loads — no journal data yet because
  the box's DB is Supabase and migrations haven't run yet

### e. Owner password

After step (b) migrations are applied:
```bash
ssh -i ~/.ssh/alice_hetzner alice@5.78.203.243
cd /opt/alice
ALICE_PG_URL='<supabase-pooler-url>' npm run set-owner-password -- '<password>'
```
This writes the Argon2id hash for the OWNER's app-level login (separate from
Caddy basic-auth — yes, two layers, by design until session-based owner
auth ships).

### f. Provision first subject

Same place:
```bash
ALICE_PG_URL='<supabase-pooler-url>' \
  npm run create-subject -- '<username>' '<temp-pw>' '<iana-tz>' '<display-name>'
```
Hand creds out-of-band (Signal, in person). They sign in at
`https://fweeo.com/enter`, are forced to reset the password, then land on
their daily question.

---

## 5. Quick recovery commands

```bash
# Reconnect to box
ssh -i ~/.ssh/alice_hetzner root@5.78.203.243

# Status of both services
systemctl status alice.service caddy --no-pager | head -30

# Live logs
journalctl -u alice.service -f
journalctl -u caddy -f

# Re-test app
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:4321/

# Pull a fresh linux .node from CI (laptop)
gh run list --workflow="Signal Engine Reproducibility" --limit 3
gh run download <run-id> --name alice-signals-linux-x64 -D /tmp/alice-deploy
scp -i ~/.ssh/alice_hetzner /tmp/alice-deploy/alice-signals.linux-x64-gnu.node alice@5.78.203.243:/opt/alice/src-rs/
```

---

## 6. Things to NEVER do this session

- Re-open any decision in original §2 (auth model, region, domain, key storage,
  TLS strategy, no DEV_MODE, etc.)
- Refactor working code "while we're here"
- Commit `.env`, secrets, the `.node` binary, or anything in `data/`
- Run `git push --force` or `git reset --hard` against any remote branch
- Apply migrations against Supabase without the user reading them first
- Re-introduce `invite_code` reads in any new code
- Add a DEV_MODE flag, draft entries, test tagging
- Build the Linux `.node` locally and SCP it. Pull from CI artifact instead

---

## 7. After Phase 6a (next phases, brief)

NOT in scope for this session unless user explicitly says "start 6b."

- **6b** — Encrypted subject responses + tz scheduling
- **6c** — Consent + delete + export
- **6d** — Embedder queue
- **6e** — Observatory subject toggle + decrypt + notifications

---

End of handoff.
