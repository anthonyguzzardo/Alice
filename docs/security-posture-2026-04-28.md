# Security posture — Alice

Working punch list. Cross-check each item against current code before acting.

## Audit framing

Two layers, audited separately:

- **Measurement layer** (Rust signal engine, reproducibility CI, binary provenance, encrypted-at-rest behavioral data): research-instrument-grade. Cited algorithms, bit-identity CI, per-row provenance stamps, single source of truth, archivable embedding model with SHA-pinned weights. **No action items.**
- **Platform layer** (TLS, headers, auth surface, key custody, browser hygiene): the surface this doc is about.

## What's already strong

These do not need rework — listed so future audits do not re-discover them.

- **TLS**: Caddy + Let's Encrypt with auto-renewal. No flexible-mode Cloudflare downgrade.
- **Full-disk encryption (LUKS2/argon2id)**: Hetzner root partition encrypted at rest since 2026-04-30. `/dev/sda3` is `crypto_LUKS` → `/dev/mapper/cryptroot` ext4 mounted as `/`. `ALICE_ENCRYPTION_KEY`, `ALICE_PG_URL`, journald, and `data/errors.log` no longer extractable from an offline disk read. Owner types passphrase via Hetzner web VNC on (rare) reboots; Tang/Clevis network auto-unlock explicitly deferred.
- **Host firewall (ufw)**: deny-by-default incoming, allow outgoing. Open ports: 22/tcp (SSH), 80/tcp (LE HTTP-01 + redirect), 443/tcp (HTTPS), 443/udp (QUIC/HTTP3). Enabled 2026-05-01 as prerequisite for the Cloudflare DNS-only flip — without ufw, the now-public `5.78.203.243` would expose every listening port. Verified clean listening surface: Caddy admin API loopback-only on `127.0.0.1:2019`, Astro/Node loopback-only on `[::1]:4321`, systemd-resolve stubs loopback-only.
- **At-rest encryption (application-layer)**: AES-256-GCM with random 12-byte nonces on every subject-bearing column. `libCrypto.ts`. Encrypted reads boundary inside `libDb.ts`. Random nonces defeat ciphertext-equality oracles.
- **Encrypted-content table invariant**: `tb_responses`, `tb_questions`, `tb_session_events` may contain only subject-authored or subject-derived signal fields. Operator annotations belong in separate tables. Load-bearing for `/api/subject/export`.
- **Auth model**: Argon2id (OWASP-2024 baseline 64MB / 3 iter / 1 lane). Session token = raw 32-byte hex in cookie, SHA-256(token) in `tb_subject_sessions`. Universal `/login` for owner + subjects. Cookie HttpOnly + Secure + SameSite=Lax + no Max-Age (closes with browser); 7-day server-side hard cap. Generic 401 on every auth failure (no username enumeration via message).
- **Constant-time login**: missing-user path runs a dummy Argon2 verify before returning null, so the wall-clock cost matches the wrong-password path. `libSubjectAuth.loginSubject`.
- **Origin check**: middleware rejects state-changing requests with an unrecognized `Origin` header. Belt-and-suspenders alongside SameSite=Lax. `src/middleware.ts:failsOriginCheck`.
- **Rate limits**: login (10/15min/IP, `Retry-After` on 429, bucket reset on success) + per-subject submission limit (60/hr/(subject, endpoint)) on `/api/respond`, `/api/calibrate`, `/api/subject/respond`, `/api/subject/calibrate`. `utlRateLimit.consumeSubmissionLimit`.
- **Session telemetry**: `last_seen_at`, `last_ip` on each session row, throttled to ≤ 1 write per 5 minutes per session.
- **Three-stage gating for subjects**: `must_reset_password` → consent gate → handler. Each gate has an explicit allow-list. `src/middleware.ts`.
- **No third-party plaintext from the journal pipeline**:
  - Embeddings: local TEI on `localhost:8090` with SHA-pinned Qwen3-Embedding-0.6B. Voyage is dead.
  - LLM: `ANTHROPIC_API_KEY` is not on prod. Only call site is `src/scripts/expand-corpus.ts` (operator-run `npm run corpus:refresh`); user-agnostic by construction — no subject text, signals, traits, or per-subject context cross the API boundary.
  - Supabase: only ever sees ciphertext (encryption happens at the app layer before INSERT).
  - **Fonts** (closed 2026-04-30): Cormorant Garamond + EB Garamond self-hosted at `/fonts/` (latin + latin-ext woff2 subsets, OFL). Replaces `fonts.googleapis.com` + `fonts.gstatic.com` which previously saw every pageview's referrer + IP + UA on every Alice page. See Completed section.
  - ~~**Cloudflare is the only remaining third party in the data path** (proxy ON in front of fweeo.com).~~ **Closed 2026-05-01 (Class II #1)** — proxy flipped to DNS only. Cloudflare remains the authoritative DNS provider for the zone (NS records still point at CF nameservers), which is a much smaller surface (CF sees lookup-source IPs but not journal content, login bodies, or session cookies). End-to-end TLS now terminates at Caddy on Hetzner with Caddy's LE cert; CF is fully out of the data path.
- **Caddy security headers + Cache-Control + log_skip** (deployed 2026-04-30, see Completed section): HSTS preload-eligible (max-age=63072000), CSP (with `'unsafe-inline'` caveat — strict nonce-based CSP on Class I roadmap), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy no-referrer, Permissions-Policy full lockdown, COOP/CORP same-origin, `-Server`. `Cache-Control: no-store` on every dynamic path; `public, max-age=31536000, immutable` on hashed assets (`/_astro/*`, `/fonts/*`, `/favicon.ico`, `/robots.txt`). `log_skip` on `/api/respond`, `/api/subject/respond`, `/api/calibrate`, `/api/subject/calibrate`, `/api/event` — no IP/path metadata trail for subject-bearing POSTs.
- **Cross-subject leak guard**: `tests/db/exportLeakGuard.test.ts` plants two subjects, exports A, asserts no row references B.
- **CI npm audit gate**: `npm audit --audit-level=high --omit=dev` runs on every PR.
- **Browser hygiene**: textareas have `autocomplete/autocorrect/autocapitalize/spellcheck` off on both render paths. No localStorage drafts. No service worker, no manifest, no source maps in dist. Theme is the only thing in localStorage.
- **Background work durability**: `tb_signal_jobs` with crash recovery, atomic claim, quadratic backoff, dead-letter. `libSignalWorker.ts`.

## Open gaps

Severity = "what does it cost if exploited," not "how easy is it to fix."

### Critical

| # | Gap | Where | Reason |
|---|---|---|---|
| 1 | ~~Cloudflare proxy ON in front of fweeo.com~~ | `deploy/Caddyfile:8` (DNS comment now stale) | **Closed 2026-05-01 (Class II #1)** — apex + www toggled to DNS only. CF no longer terminates user TLS or sees plaintext. Browsers connect directly to Caddy at Hetzner with Caddy's LE cert. See Completed section. |
| 2 | ~~No HSTS header~~ | `deploy/Caddyfile` | **Closed 2026-04-30 (Class II #2)** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` deployed. |
| 3 | ~~No CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options~~ — partially closed | `deploy/Caddyfile` | **Partially closed 2026-04-30 (Class II #2)** — XFO DENY, X-Content-Type-Options nosniff, Referrer-Policy no-referrer, Permissions-Policy full lockdown, COOP/CORP same-origin all deployed. CSP also deployed but with `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'` because Astro emits `<script is:inline>` (theme bootstrap, session check) and inline `style=` attributes. Current CSP blocks remote script loading, exfiltration via `connect-src`, framing, base-URL pivots, plugin embeds — but does NOT prevent reflected XSS executing as inline `<script>...</script>`. The `escapeHtml` helper in `src/pages/index.astro:1686` remains the load-bearing inline-XSS defense. Strict nonce-based CSP on Class I roadmap. |

### High

| # | Gap | Where | Reason |
|---|---|---|---|
| 4 | ~~No `Cache-Control: no-store` on journal pages (`/`, `/subject`)~~ | `deploy/Caddyfile` | **Closed 2026-04-30 (Class II #2)** — `Cache-Control: no-store` on every dynamic path (HTML + API); `public, max-age=31536000, immutable` only on hashed assets. BFCache no longer restores journal textareas on back-navigation. |
| 5 | `ALICE_ENCRYPTION_KEY` is plaintext in `/etc/alice/secrets.env`; permanent (no rotation) | `libCrypto.ts:15-16` | **Mitigated by FDE 2026-04-30 against offline disk reads.** Live host compromise (root via SSH or Caddy 0day) = key + ciphertext + DB in same blast radius. Class I bar requires HSM/TPM-bound master with KDF-derived per-row keys and rotation. |
| 6 | No 2FA / WebAuthn | not implemented | Single password gates the owner. |
| 7 | Argon2id at OWASP minimum (64MB / 3 iter) | `libSubjectAuth.ts:35` | Hetzner CCX13 can comfortably run 256MB / 4 iter. ~16x GPU/ASIC cost increase for free. **Gated on a benchmark confirming login latency stays under 500ms before the bump lands.** |

### Medium

| # | Gap | Where | Reason |
|---|---|---|---|
| 8 | ~~Caddy access log retains IPs and URL paths to disk on subject POST paths~~ | `deploy/Caddyfile` | **Closed 2026-04-30 (Class II #2)** — `log_skip` on `/api/respond`, `/api/subject/respond`, `/api/calibrate`, `/api/subject/calibrate`, `/api/event`. GET paths (`/login`, `/observatory`, etc.) still get IP+path logged for ops debugging — acceptable trade since GETs don't carry subject content. |
| 9 | ~~`x-forwarded-for` trusted from any upstream~~ | `src/lib/utlRequestContext.ts:23`, `src/pages/api/subject/login.ts:34` | **Closed 2026-05-01 by review + CF flip** — `deploy/Caddyfile` `header_up X-Forwarded-For {remote_host}` already replaces client-supplied XFF (no `+` prefix = replace, not append). After DNS-only flip, `{remote_host}` is the real client IP, so per-IP rate limiting works as intended. No code change needed. |
| 10 | ~~No CAA DNS records~~ | DNS-side | **Closed 2026-05-01 (Class II #3)** — `0 issue "letsencrypt.org"` + `0 iodef "mailto:agguzzy91@gmail.com"`. Cloudflare Universal SSL disabled to stop their auto-injection of CAAs for `comodoca.com`/`digicert.com`/`pki.goog`/`ssl.com`. Verified via `dig CAA fweeo.com +short`. CT Monitoring also enabled as belt-and-suspenders. |
| 11 | DNSSEC enabled, parent DS propagating | DNS-side | **Enabled 2026-05-01 (Class II #3)** — CF DNS → Settings → Enable DNSSEC. Domain at CF Registrar so DS auto-pushed to .com parent. Zone-side DNSKEY + RRSIG verified. Closes fully once `dig @a.gtld-servers.net fweeo.com DS +short` returns non-empty. |
| 12 | No Sigstore signature on linux-x64 `.node` artifact | `.github/workflows/` | Compromised CI account = persistent execution on Hetzner. (npm audit gate already in place.) |
| 13 | systemd journal captures Node stdout | `src/lib/utlErrorLog.ts:40` calls `console.error` after writing to `data/errors.log` | **Mitigated by FDE 2026-04-30 — journald and `data/errors.log` now encrypted at rest.** Live host compromise still exposes content. |
| 14 | Logs and encrypted DB share storage | host filesystem | Disk seizure recovers logs (timing/IP traces) plus encrypted DB. Ship logs to a remote sink and zero local logs nightly. |
| 15 | AES-GCM 12-byte random nonces | `libCrypto.ts:79` | Birthday-bounded at ~2⁴⁸ encryptions per key. Fine at Alice's volume. For long-term posture switch to AES-GCM-SIV (RFC 8452) or XChaCha20-Poly1305. |

### Low (nation-state class)

| # | Gap | Reason |
|---|---|---|
| 16 | No post-quantum crypto | TLS 1.3 X25519 falls to Shor. Enable hybrid X25519+ML-KEM when Caddy ships it. AES-256 is grace-period-safe. |
| 17 | Hetzner / Supabase / Cloudflare subpoena exposure | Three jurisdictions (DE, US, US). Cloudflare is the worst because they see plaintext. |
| 18 | Spectre / Rowhammer / cold-boot | Encryption key sits in process RAM whenever Node runs. Out of reach on a managed VPS. |
| 19 | Browser-side adversaries on owner's device | Extensions with `<all_urls>` read the textarea. Tab-restore-on-crash brings entries back. DevTools always shows POST body. Mitigate with a dedicated browser profile, no extensions. |

## Completed: FDE rebuild via LUKS (Path A) — 2026-04-30

**Why we did it (verified 2026-04-29 night):** Hetzner volume was plain ext4 on `/dev/sda1`, no LUKS layer. `ALICE_ENCRYPTION_KEY` and `ALICE_PG_URL` both sat on the same plaintext volume, so the application-layer at-rest encryption of subject content in Supabase was theatrical against any attacker with disk read on Hetzner (read `secrets.env` → connect to Supabase → decrypt). This violated the consent doc's privacy claim end-to-end.

**Decision (2026-04-29):** rebuild the host with a LUKS-encrypted root partition. Owner types passphrase via Hetzner web VNC console on (rare) reboots. Tang/Clevis network-bound auto-unlock explicitly deferred — single-host research instrument with infrequent reboots doesn't need it yet. Path B (downgrade consent claim) explicitly rejected — "we are legit, can't violate subjects' privacy."

**Five-phase rebuild executed 2026-04-30 (~3 hr end-to-end):**

1. **Pre-flight** — pulled `/etc/alice/secrets.env` (+`.bak`), `/etc/caddy/Caddyfile`, `/etc/systemd/system/alice.service`, `/root/.ssh/authorized_keys`, `/home/alice/.ssh/authorized_keys`, the linux-x64 `.node`, and `/opt/alice/data/errors.log` to laptop via single tar pipe with mirror-of-absolute-paths layout (`~/alice-prebuild-snapshot/` with `meta.txt` cribsheet). All eight files cross-verified by sha256 (laptop ↔ prod) before any destructive step. Hetzner Cloud snapshot `pre-luks-rebuild-2026-04-30` taken via web console as rollback. **Pre-flight key verification:** ran `src/scripts/verify-decryption.ts` on prod — decrypted the most recent owner calibration row (response_id=96, dttm 2026-04-30T20:36:50Z) end-to-end with the live `ALICE_ENCRYPTION_KEY`, auth tag intact. Confirms key in `secrets.env` actually matches what's encrypting prod data — the gate against a destructive rebuild that would have lost everything.
2. **Rescue boot** — Hetzner Cloud Console → Rescue tab → Linux 64-bit + alice-hetzner SSH key → power cycle. Booted Debian 12 PXE rescue with eth0 up; sda intact (76.3G original layout) and unmounted, safe to wipe.
3. **LUKS install** — `sgdisk --zap-all`; created GPT (sda1 ESP 512M / sda2 `/boot` 1G ext4 / sda3 LUKS rest 74.8G); `cryptsetup luksFormat --type luks2 --pbkdf argon2id` (passphrase typed by owner in their own SSH session — never touched the assistant's tool channel); `debootstrap noble` into LUKS root; chroot install of `linux-image-generic` + `cryptsetup-initramfs` + `grub-efi-amd64` with `GRUB_ENABLE_CRYPTODISK=y`; configured `/etc/crypttab`, `/etc/fstab` (UUIDs for ESP + boot + cryptroot), `/etc/netplan/01-netcfg.yaml` (DHCP4 + SLAAC v6, MAC-matched eth0); `update-initramfs -u -k all` regenerated with cryptsetup hooks bundled (verified via `lsinitramfs` showing `scripts/local-top/cryptroot` + `cryptroot/crypttab` present); `grub-install` to ESP creating Boot0007 = "Ubuntu" entry, BootOrder put it first.
4. **Boot test** — disabled rescue (auto-cleared by Hetzner after one-shot use), power-cycled, watched VNC for `Please unlock disk cryptroot:` prompt; passphrase typed via VNC; SSH back in (third host key rotation, cleared with `ssh-keygen -R`). `lsblk` reports TYPE=crypt for `/dev/mapper/cryptroot` mounted at `/`, eth0 up via DHCP, `0 failed units`.
5. **Restore + smoke test** — installed Node 22 (NodeSource repo) + Caddy 2.11 (Cloudsmith) + `postgresql-client` + git + `build-essential` + ufw + zstd; recreated alice user (uid=1000 — original 996 was taken by `systemd-timesync` on noble; alice files are addressed by name, not numeric uid, so this is harmless); pushed snapshot files back via tar pipe with sha256 byte-verification (8/8 match); `git clone https://github.com/anthonyguzzardo/Alice.git` → `/opt/alice`; `npm ci` + `npx astro build` (one false start: first `npm ci` left zod's `package.json` missing → `node_modules/zod/v4` directory-import failure on `systemctl restart`; fixed by `rm -rf node_modules dist && npm ci`); restored `/etc/sudoers.d/alice` for `deploy.sh`; created `/etc/systemd/system/caddy.service.d/override.conf` adding `ReadWritePaths=/var/log/caddy` (not in repo) + pre-created `alice.log` as caddy:caddy (Caddy's `output file` directive can't create the file itself under `ProtectSystem=full`). Caddy reloaded with real Let's Encrypt certs auto-issued for `fweeo.com` + `www.fweeo.com` via HTTP-01 through Cloudflare proxy (CF egress IPs 172.68.x / 104.23.x / 162.158.x serving the challenge → origin). `GET https://fweeo.com/ → HTTP 302` end-to-end TLS-verified through the full Cloudflare → Caddy → Astro → encrypted-disk path.

**Result:** root partition encrypted at rest with LUKS2/argon2id. Offline disk read no longer extracts `ALICE_ENCRYPTION_KEY`, `ALICE_PG_URL`, journald, or `data/errors.log`. Consent doc's at-rest encryption claim is now end-to-end verifiable.

**Closed by this work:**
- "Open verifications: Full-disk encryption on the Hetzner volume" — verified, removed from the verifications list.
- High #5 (key co-located with credentials) — downgraded from real privacy violation to host-compromise-only risk. Class I bar (HSM/TPM-bound master + per-row KDF + rotation) still standing.
- Medium #13 (systemd journal plaintext at rest) — closed; journald lives on the encrypted root.

**Rollback path retained for ~1 week:** Hetzner Cloud snapshot `pre-luks-rebuild-2026-04-30` + laptop `~/alice-prebuild-snapshot/` (with `meta.txt`). Delete after a clean week of journal use confirms no regression.

**Lessons for next-time rebuild (capture in `deploy/README.md`):**
- alice user UID will collide on a fresh noble (`systemd-timesync` owns 996); plan for uid=1000.
- `/etc/systemd/system/caddy.service.d/override.conf` with `ReadWritePaths=/var/log/caddy` is required and is NOT in the repo. Add it to `deploy/`.
- Caddy's `log { output file ... }` directive cannot create the log file itself under `ProtectSystem=full` — pre-create `/var/log/caddy/alice.log` as `caddy:caddy` before first start.
- `/etc/sudoers.d/alice` (NOPASSWD for `systemctl restart alice.service`, exact match) is in the README but not in the snapshot — capture more of `/etc` next time, or formalize it as a deploy artifact.
- Snapshot should also tar `/etc/systemd/system/*.service.d/` so unit drop-ins are not lost.

**Next:** Class II punch list — item 1 (Cloudflare proxy off) is now the largest remaining data-exposure surface.

## Completed: Cloudflare Web Analytics RUM removed — 2026-04-30

Cloudflare Web Analytics RUM beacon was active at audit (auto-injected via dashboard, mode: Enable excluding EU). Captured per-element interaction data including `#password-input` INP for non-EU visitors. Removed 2026-04-30 via dashboard Delete.

Discovered during Class II item 2 deploy: the new CSP (`script-src 'self' 'unsafe-inline'`) refused the auto-injected `https://static.cloudflareinsights.com/beacon.min.js` script and surfaced the violation in DevTools, exposing the third-party RUM stream that had been running silently. Beacon is sourced from Cloudflare's edge HTML rewrite (orange-cloud), never from our code: `grep -rE "cloudflareinsights|beacon\.min" /opt/alice` returns clean across `src/`, `dist/`, and `node_modules/` (0 hits).

Order of effects:
- CSP (deployed 2026-04-30) blocks new beacon execution in browsers from that point onward.
- Dashboard "Delete" (2026-04-30) stops Cloudflare from injecting the script tag at all and stops server-side counter aggregation.
- Class II #1 (DNS-only) will eliminate any residual ability for Cloudflare to inject anything into responses.

Historical RUM data (pre-2026-04-30) sits in Cloudflare's retention. Data-subject deletion request to Cloudflare privacy (`privacyquestions@cloudflare.com`, GDPR Art. 17 / CCPA right-to-delete) is open as a follow-up.

## Completed: Class II item 2 — security headers, Cache-Control, log_skip, self-hosted fonts — 2026-04-30

Five gaps closed in one Caddyfile + app-code window. Discovery during this deploy also surfaced the Cloudflare Web Analytics RUM beacon (separate Completed section above).

**Caddy header bundle** (`deploy/Caddyfile` `header { ... defer }` block on `fweeo.com`, applied after upstream so we always win):
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. Closes Crit #2.
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests`. Partially closes Crit #3 (see CSP caveat below).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` full lockdown, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `-Server` (Caddy banner removed; CF re-injects `server: cloudflare` at edge until Class II #1).

**Cache-Control discipline** (matchers in same Caddyfile, both with `defer`):
- `@assets path /_astro/* /fonts/* /favicon.ico /robots.txt` → `public, max-age=31536000, immutable`.
- `@dynamic` (everything else) → `no-store`. Closes High #4 — BFCache no longer restores journal textareas on back-navigation.

**`log_skip`** on `/api/respond`, `/api/subject/respond`, `/api/calibrate`, `/api/subject/calibrate`, `/api/event` — no IP/path metadata trail for subject-bearing POSTs. Closes Med #8.

**Self-hosted fonts** (closes a third-party leak that was not in the original gap list — discovered via CSP violation in DevTools):
- 20 woff2 files (Cormorant Garamond + EB Garamond, latin + latin-ext subsets, OFL) committed to `public/fonts/` (~995 KB), served at `/fonts/`.
- `public/fonts/styFonts.css` aggregates all `@font-face` blocks; imported by `layBase.astro` + 10 page-level `.astro` files (each had its own Google `@import`, all replaced with `@import url('/fonts/styFonts.css')`).
- Eliminates `fonts.googleapis.com` + `fonts.gstatic.com` as third parties. Verified: `curl -sL https://fweeo.com/login | grep -E "googleapis|gstatic"` returns no matches.

**CSP caveat — partial close on Crit #3:** `'unsafe-inline'` for `script-src` and `style-src` is required because Astro emits `<script is:inline>` blocks (theme bootstrap, session check) and inline `style=` attributes across many pages. What this CSP blocks: remote script loading, exfiltration via `connect-src` to non-self, framing/clickjacking via `frame-ancestors 'none'`, base-URL pivots, plugin embeds. What it does NOT block: reflected XSS as inline `<script>...</script>`. Strict nonce-based CSP added to Class I roadmap as the full closure path.

**Closed by this work:**
- Critical #2 (HSTS) — closed.
- Critical #3 (CSP + headers) — partially closed; full closure pending nonce migration.
- High #4 (Cache-Control no-store) — closed.
- Medium #8 (log_skip on journal POSTs) — closed.

**Next:** Class II #1 (Cloudflare proxy off / DNS-only flip) is now the highest-impact remaining item — the only remaining third party in the data path.

## Completed: Class II items 1, 3, 5 — Cloudflare proxy off, CAA pin, ufw lockdown — 2026-05-01

Closes Critical #1, Medium #9, Medium #10. Medium #11 (DNSSEC) enabled and propagating; closes once the DS lands at the .com parent. Crit #1 was the single largest remaining data-exposure surface and the entire reason the punch list existed.

### ufw enabled (prerequisite for the CF flip)

Hetzner host was running with no kernel firewall: `ufw status` returned `inactive`. With CF proxy ON, casual scanners did not easily reach `5.78.203.243`; flipping to DNS-only would publish the IP, exposing every listening port. So ufw had to land before the CF toggle.

Pre-flight `ss -tlnp` + `ss -ulnp` confirmed a clean listening surface:

- Public-facing (intentional): `0.0.0.0:22` SSH, `*:80` Caddy HTTP, `*:443` TCP Caddy HTTPS, `*:443` UDP Caddy QUIC/HTTP3.
- Loopback-only (not exposed): `127.0.0.1:2019` Caddy admin API, `[::1]:4321` Astro/Node, `127.0.0.54:53` + `127.0.0.53:53` systemd-resolve stubs.
- `5.78.203.243:68` UDP is the DHCP client; port 68 is client-only (not a server) and systemd-networkd uses raw sockets that bypass iptables, so ufw does not break DHCP renewal. No allow rule needed.

Rule set:

```
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

Verified by opening a fresh SSH connection in parallel before closing the original session, so the active session was always the safety line. Final state: `Status: active`, default `deny (incoming) / allow (outgoing)`, eight rules (four v4 + four v6).

### Cloudflare proxy off (closes Crit #1)

Cloudflare DNS dashboard, both apex (`fweeo.com`) and `www` A records toggled from orange (proxied) to gray (DNS only). Hetzner origin IP `5.78.203.243` is now publicly attached to the domain. Browsers connect directly to Caddy at Hetzner; CF no longer terminates user TLS, no longer sees plaintext journal entries, logins, or session cookies. Cloudflare remains the authoritative DNS provider for the zone (NS records still point at `abby.ns.cloudflare.com` / `fonzie.ns.cloudflare.com`), which is a different and much smaller surface (CF sees lookup-source IPs but not journal content).

Verification:

- `dig @1.1.1.1 fweeo.com +short` and `dig @8.8.8.8 fweeo.com +short` both return `5.78.203.243` directly. Was CF egress IPs (`172.67.x`, `104.21.x`).
- `curl -sI https://fweeo.com` shows no `cf-ray`, no `cf-cache-status`, no `server: cloudflare`, no `report-to: nel.cloudflare.com`. Just Caddy's header bundle + `via: 1.1 Caddy`.
- TLS cert: `issuer=C=US, O=Let's Encrypt, CN=E7`, `subject=CN=fweeo.com`, valid `2026-04-30 → 2026-07-29`. Caddy's LE cert is what browsers see now (was CF Universal SSL). Renewal continues via HTTP-01 on port 80, allowed by ufw.
- End-to-end app smoke (driven by owner from Safari): `/ → 302 → /subject → 200`, `/api/subject/respond → 200`. All security headers preserved (HSTS, CSP, COOP, CORP, Permissions-Policy, XFO, X-CTO, Cache-Control: no-store, Referrer-Policy).

### CAA pinned to Let's Encrypt (closes Med #10)

Added two records:

- `fweeo.com. CAA 0 issue "letsencrypt.org"`
- `fweeo.com. CAA 0 iodef "mailto:agguzzy91@gmail.com"`

**Sneaky behavior worth recording:** Cloudflare auto-injects CAA records for the CAs their Universal SSL uses (`comodoca.com`, `digicert.com`, `pki.goog`, `ssl.com`, both `issue` and `issuewild` tags) whenever Universal SSL is enabled AND any CAA records exist in the zone. These auto-injected records do NOT appear in the dashboard. They are visible only via `dig CAA`. The doc CF links to (their own CAA page) confirms this is documented but opt-out, and the dashboard surface is misleading. Effective policy with our manual record alone was 5 authorized CAs, not the 1 we intended.

Closure: SSL/TLS → Edge Certificates → bottom of page → **Disable Universal SSL**. Removes the active + backup CF-managed certs (inert post-flip anyway since browsers see Caddy's cert) and stops the auto-CAA injection. Verified `dig CAA fweeo.com +short` from both `1.1.1.1` and `8.8.8.8` returns only the two manual records, no extraneous CAs.

While on the same Edge Certificates page: enable **Certificate Transparency Monitoring** (Beta toggle just above Disable Universal SSL). Free passive defense; emails when ANY CA issues a cert for `fweeo.com`. Combined with the `iodef` CAA record, that is dual coverage: CAA tells unauthorized CAs not to issue (and to email if they try), CT Monitoring catches misissuance even by authorized CAs.

### DNSSEC enabled (closes Med #11 once parent DS lands)

Cloudflare DNS → Settings → DNSSEC → **Enable DNSSEC**. Domain is registered at Cloudflare Registrar (Path A), so the DS record is auto-pushed to the .com parent zone via Verisign without manual registrar work.

Current state at write time:

- Zone-side DNSKEY published: KSK 257 + ZSK 256, algorithm 13 (ECDSAP256SHA256). RRSIG present on responses.
- Parent-side DS still propagating: `dig @a.gtld-servers.net fweeo.com DS +short` returns empty as of the last probe.

Closes when the .com root publishes the DS, usually within minutes to a few hours. No further action needed.

### Med #9 (XFF trust) closed by code review, no Caddyfile change

Caddyfile already has `header_up X-Forwarded-For {remote_host}` inside the `reverse_proxy` block. `header_up` without a `+` prefix REPLACES the header value, not append. Any client-supplied XFF is dropped and replaced with `{remote_host}` (the immediate TCP peer IP Caddy observes). Before the CF flip, `{remote_host}` was a CF egress IP (rate limit per-egress, useless); after the flip, `{remote_host}` is the real client IP and per-IP rate limiting works as intended. App readers (`src/lib/utlRequestContext.ts:23`, `src/pages/api/subject/login.ts:34`) both take the first comma-separated entry, which is always the real peer because Caddy never appends.

No new directive needed; the existing line was already load-bearing. Closing without code change.

### Closed by this work:

- Critical #1 (Cloudflare proxy ON) — closed.
- Medium #9 (XFF trust) — closed by existing config + CF flip.
- Medium #10 (no CAA) — closed (LE-only, Universal SSL disabled).
- Medium #11 (DNSSEC) — enabled; closes when parent DS lands.

### Open follow-ups from this session:

- DNSSEC propagation verification: re-probe `dig @a.gtld-servers.net fweeo.com DS +short` until non-empty, then close Med #11 explicitly.
- Cloudflare data-subject deletion request (GDPR Art. 17 / CCPA right-to-delete) for pre-2026-04-30 Web Analytics RUM data: still open, tracked under Completed: Cloudflare Web Analytics RUM section above.

**Next:** Class II #4 (Argon2id 256MB / 4 iter benchmark + bump). All Class II items 1-3 + 5 are now closed.

## Class II punch list (after FDE)

Once FDE is in place, the remaining Class II items. Ranked by data-exposure impact.

| # | Item | Where | Effort | Risk |
|---|---|---|---|---|
| 1 | ~~**Cloudflare proxy off (or Tunnel with origin auth tokens you control).** Closes Critical #1.~~ **CLOSED 2026-05-01** — apex + www toggled to DNS only. ufw enabled as prerequisite (default deny incoming + allow 22, 80, 443/tcp, 443/udp). End-to-end smoke verified clean. Closed Crit #1 + Med #9 (XFF trust). See Completed section. | Cloudflare dashboard | done | done |
| 2 | ~~**Caddy security-header bundle** + `Cache-Control: no-store` ... Closes Critical #2 + #3 + High #4 in one Caddyfile edit.~~ **CLOSED 2026-04-30** — see Completed section below. CSP shipped with `'unsafe-inline'` (Crit #3 partial); strict nonce-based CSP moved to Class I roadmap. Self-hosted fonts shipped in same window (closed a third-party leak not in original gap list). | `deploy/Caddyfile` | 30m | low |
| 3 | ~~CAA DNS record pinning Let's Encrypt; verify DNSSEC enabled at Cloudflare. Closes Medium #10 + #11.~~ **CLOSED 2026-05-01** — CAA records added, Cloudflare Universal SSL disabled to stop CAA auto-injection, Cert Transparency Monitoring enabled. DNSSEC enabled at zone (DNSKEY + RRSIG live); parent DS propagating from CF Registrar to .com — Med #11 closes fully on parent DS publication. | DNS only | done | done |
| 4 | Argon2id 256MB / 4 iter — only after a Hetzner CCX13 benchmark confirms login latency stays under 500ms. Rotate by running `npm run set-owner-password` and instructing each subject to use the password reset flow (auto re-hashes at new params). Closes High #7. | `src/lib/libSubjectAuth.ts:35` | 30m | low |
| 5 | ~~Caddy `log_skip` on journal POST paths + pin `trusted_proxies` to Cloudflare ranges (or LAN if going DNS-only post item 1). Closes Medium #9.~~ **CLOSED** — `log_skip` shipped 2026-04-30 (Class II #2). XFF trust verified by code review on 2026-05-01 (existing `header_up X-Forwarded-For {remote_host}` already replaces client-supplied XFF; post-CF-flip there is no upstream proxy so `trusted_proxies` stays empty by construction). Both Med #8 and Med #9 closed. | `deploy/Caddyfile` | done | done |

## Class I roadmap (separate project, not this week)

Listed for completeness so they do not get reinvented.

- HSM-bound master key (TPM 2.0 sealing, YubiKey-backed envelope key, or AWS/GCP KMS). HKDF-derived per-row keys. Master rotation annually with re-encryption pass.
- **Strict nonce-based CSP**: Astro middleware injects per-request nonce into every `<script>` and inline `<style>` tag, exposes the nonce via response header, Caddy reads it back and sets `Content-Security-Policy: ...; script-src 'self' 'nonce-{NONCE}'; style-src 'self' 'nonce-{NONCE}'`. Eliminates `'unsafe-inline'`, fully closes Critical #3. Currently CSP blocks remote-loaded scripts but reflected XSS executing as inline `<script>` is not blocked — `escapeHtml` is the only line of defense.
- Third-party penetration test.
- SOC 2 Type II or equivalent.
- Formal change management (signed releases, audit log of admin operations).
- Multi-site reproducibility study (more than one host).
- Data Protection Impact Assessment (GDPR Article 35) and equivalents.
- WebAuthn passkey + TOTP fallback for owner.

## Open verifications / debts

Items the audit cannot close from inside the repo. Each needs a one-time check that lives outside source control.

- ~~**DNSSEC enabled at Cloudflare**~~ — enabled 2026-05-01; parent DS propagating. Verify Active by re-probing `dig @a.gtld-servers.net fweeo.com DS +short`.
- ~~**Full-disk encryption on the Hetzner volume** for the `/opt/alice` mount.~~ **Closed 2026-04-30** — see Completed: FDE rebuild section above.
- **Backup posture for `ALICE_ENCRYPTION_KEY`**: verify both backups (operator's password manager AND `/etc/alice/secrets.env`) exist, are readable, and are stored in geographically distinct locations.
- ~~**CAA records pinning Let's Encrypt** at the registrar.~~ **Closed 2026-05-01** — see Class II item 3 in Completed section.
- **CI artifact integrity**: nothing currently authenticates the linux-x64 `.node` between CI and Hetzner. Add Sigstore.
- **Cloudflare data-subject deletion request** (GDPR Art. 17 / CCPA right-to-delete) for pre-2026-04-30 Web Analytics RUM data: still open. Email `privacyquestions@cloudflare.com` referencing `fweeo.com`.
- **Hetzner IP exposure post-CF-flip**: `5.78.203.243` is now publicly attached to fweeo.com and reachable to internet-wide scanners. Mitigated by ufw default-deny + only 22/80/443 open. Watch SSH brute-force noise; consider `ufw limit 22/tcp` if it gets tedious. Targeted attackers can still find the IP via cert transparency (it was already in CT logs from Caddy's LE issuance), so the privacy delta from CF hiding the IP was small.

## What this audit did NOT cover

- Production secrets management beyond what is visible from the repo.
- The owner's local development machine threat model (browser extensions, OS, FDE, Tailscale to Supabase).
- Supabase backup retention and access posture.
- Cloudflare account security (SSO, MFA, API token scoping).
- Hetzner account security and KVM console access.
- Recovery drill: has the operator ever actually restored from backup using only the password-manager copy of `ALICE_ENCRYPTION_KEY`?

These belong in a follow-up "operational security" audit.
