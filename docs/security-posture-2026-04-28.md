# Security posture — Alice

Working punch list. Cross-check each item against current code before acting.

## Audit framing

Two layers, audited separately:

- **Measurement layer** (Rust signal engine, reproducibility CI, binary provenance, encrypted-at-rest behavioral data): research-instrument-grade. Cited algorithms, bit-identity CI, per-row provenance stamps, single source of truth, archivable embedding model with SHA-pinned weights. **No action items.**
- **Platform layer** (TLS, headers, auth surface, key custody, browser hygiene): the surface this doc is about.

## What's already strong

These do not need rework — listed so future audits do not re-discover them.

- **TLS**: Caddy + Let's Encrypt with auto-renewal. No flexible-mode Cloudflare downgrade.
- **At-rest encryption**: AES-256-GCM with random 12-byte nonces on every subject-bearing column. `libCrypto.ts`. Encrypted reads boundary inside `libDb.ts`. Random nonces defeat ciphertext-equality oracles.
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
  - **Cloudflare is the only third party that sees journal plaintext today** (proxy ON in front of fweeo.com). Single largest remaining data-exposure surface.
- **Cross-subject leak guard**: `tests/db/exportLeakGuard.test.ts` plants two subjects, exports A, asserts no row references B.
- **CI npm audit gate**: `npm audit --audit-level=high --omit=dev` runs on every PR.
- **Browser hygiene**: textareas have `autocomplete/autocorrect/autocapitalize/spellcheck` off on both render paths. No localStorage drafts. No service worker, no manifest, no source maps in dist. Theme is the only thing in localStorage.
- **Background work durability**: `tb_signal_jobs` with crash recovery, atomic claim, quadratic backoff, dead-letter. `libSignalWorker.ts`.

## Open gaps

Severity = "what does it cost if exploited," not "how easy is it to fix."

### Critical

| # | Gap | Where | Reason |
|---|---|---|---|
| 1 | Cloudflare proxy ON in front of fweeo.com | `deploy/Caddyfile:8` (DNS comment) | Cloudflare terminates user TLS at their edge and re-encrypts to Caddy. They see every login, journal entry, session cookie in plaintext at the edge. Subpoenable (US company). For monastic Alice this is the single largest remaining leak. |
| 2 | No HSTS header | grep returns zero hits across repo | First HTTP visit is downgrade-attackable (sslstrip, evil-twin WiFi). |
| 3 | No CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options | grep returns zero hits | Single XSS bug becomes total compromise. The `escapeHtml` helper in `src/pages/index.astro:1686` is the only line of defense for innerHTML render paths. |

### High

| # | Gap | Where | Reason |
|---|---|---|---|
| 4 | No `Cache-Control: no-store` on journal pages (`/`, `/subject`) | grep returns one hit and it's `/api/subject/export` only | BFCache restores textarea contents from RAM after back-navigation. |
| 5 | `ALICE_ENCRYPTION_KEY` is plaintext in `/etc/alice/secrets.env`; permanent (no rotation) | `libCrypto.ts:15-16` | Host compromise = key + ciphertext + DB in same blast radius. Class I bar requires HSM/TPM-bound master with KDF-derived per-row keys and rotation. |
| 6 | No 2FA / WebAuthn | not implemented | Single password gates the owner. |
| 7 | Argon2id at OWASP minimum (64MB / 3 iter) | `libSubjectAuth.ts:35` | Hetzner CCX13 can comfortably run 256MB / 4 iter. ~16x GPU/ASIC cost increase for free. **Gated on a benchmark confirming login latency stays under 500ms before the bump lands.** |

### Medium

| # | Gap | Where | Reason |
|---|---|---|---|
| 8 | Caddy access log retains IPs and URL paths to disk | `deploy/Caddyfile:33-39` (50MB × 5) | Forensic metadata trail. POST bodies not logged. Add `log_skip /api/respond /api/subject/respond /api/calibrate /api/subject/calibrate /api/event` or filter format. |
| 9 | `x-forwarded-for` trusted from any upstream | `src/lib/libSubject.ts:80`, `src/pages/api/subject/login.ts:34` | If Cloudflare is bypassed, attacker spoofs XFF to bypass per-IP rate limit. Pin Caddy `trusted_proxies` to Cloudflare's published ranges (or LAN if going DNS-only). |
| 10 | No CAA DNS records | DNS-side only | Without `fweeo.com. CAA 0 issue "letsencrypt.org"` any of ~150 trusted CAs can issue a fweeo.com cert. CAA cuts that to one. |
| 11 | DNSSEC status not verified | DNS-side | Confirm DNSSEC enabled at Cloudflare for fweeo.com. |
| 12 | No Sigstore signature on linux-x64 `.node` artifact | `.github/workflows/` | Compromised CI account = persistent execution on Hetzner. (npm audit gate already in place.) |
| 13 | systemd journal captures Node stdout | `src/lib/utlErrorLog.ts:40` calls `console.error` after writing to `data/errors.log` | journald is plaintext at rest unless full-disk encryption is on. Confirm FDE on the Hetzner volume. |
| 14 | Logs and encrypted DB share storage | host filesystem | Disk seizure recovers logs (timing/IP traces) plus encrypted DB. Ship logs to a remote sink and zero local logs nightly. |
| 15 | AES-GCM 12-byte random nonces | `libCrypto.ts:79` | Birthday-bounded at ~2⁴⁸ encryptions per key. Fine at Alice's volume. For long-term posture switch to AES-GCM-SIV (RFC 8452) or XChaCha20-Poly1305. |

### Low (nation-state class)

| # | Gap | Reason |
|---|---|---|
| 16 | No post-quantum crypto | TLS 1.3 X25519 falls to Shor. Enable hybrid X25519+ML-KEM when Caddy ships it. AES-256 is grace-period-safe. |
| 17 | Hetzner / Supabase / Cloudflare subpoena exposure | Three jurisdictions (DE, US, US). Cloudflare is the worst because they see plaintext. |
| 18 | Spectre / Rowhammer / cold-boot | Encryption key sits in process RAM whenever Node runs. Out of reach on a managed VPS. |
| 19 | Browser-side adversaries on owner's device | Extensions with `<all_urls>` read the textarea. Tab-restore-on-crash brings entries back. DevTools always shows POST body. Mitigate with a dedicated browser profile, no extensions. |

## Active workstream — FDE rebuild via LUKS (Path A)

Verified 2026-04-29 night via SSH + `lsblk`: Hetzner volume is plain ext4 on `/dev/sda1`, no LUKS layer. `ALICE_ENCRYPTION_KEY` and `ALICE_PG_URL` both sit on the same plaintext volume, so the at-rest encryption of subject content in Supabase is theatrical against any attacker with disk read on Hetzner (read secrets.env → connect to Supabase → decrypt). This violates the consent doc's privacy claim end-to-end.

**Decision (2026-04-29):** rebuild the host with a LUKS-encrypted root partition. Owner types passphrase via Hetzner web VNC console on (rare) reboots. Tang/Clevis network-bound auto-unlock deferred — single-host research instrument with infrequent reboots doesn't need it yet. Path B (downgrade consent claim) explicitly rejected — "we are legit, can't violate subjects' privacy."

**Five-phase rebuild plan, ~4-6 hours total:**
1. **Pre-flight** — pull `/etc/alice/secrets.env`, `/etc/caddy/Caddyfile`, systemd units, linux-x64 `.node` to laptop. Hetzner Cloud snapshot labelled `pre-luks-rebuild-2026-04-30`. Don't skip the snapshot — it's the rollback path.
2. **Rescue boot** — Hetzner Cloud Console → Rescue tab → Linux 64-bit → power cycle.
3. **LUKS install** — wipe sda; partition (ESP + boot + LUKS); cryptsetup luksFormat; debootstrap noble inside LUKS; chroot install of kernel + cryptsetup-initramfs + grub-efi-amd64 with `GRUB_ENABLE_CRYPTODISK=y`; configure /etc/crypttab; set root password + SSH authorized_keys.
4. **Boot test** — disable rescue, watch VNC console for LUKS passphrase prompt within 30s; type passphrase; SSH in; verify `lsblk` shows TYPE=crypt.
5. **Restore + smoke test** — install Node 22 + Caddy + postgresql-client; create alice user (uid 996); push back captured state; clone repo; pull `.node` from CI artifact; enable services; end-to-end test (owner login → journal → observatory → export → ash login → calibration).

**Status (2026-04-29 night):** plan locked, paused before Phase 0 execution. Resume tomorrow. The conversation transcript with the full per-block scripts (paste-ready with verification stops) is the working source — re-derive from that, not from this summary.

**On resume, before doing anything:**
- confirm `~/alice-prebuild-snapshot/` exists on laptop with all pulled state
- confirm the Hetzner snapshot is "Available" (rollback safety net)
- re-verify `lsblk` on prod still shows the plain ext4 layout (i.e. nothing changed overnight)

After this lands: gap #5 (key co-located with credentials) downgrades from a real privacy violation to a host-compromise-only risk, the consent doc's at-rest encryption claim becomes verifiable, and the FDE row in "Open verifications" closes.

## Class II punch list (after FDE)

Once FDE is in place, the remaining Class II items. Ranked by data-exposure impact.

| # | Item | Where | Effort | Risk |
|---|---|---|---|---|
| 1 | **Cloudflare proxy off (or Tunnel with origin auth tokens you control).** **HIGHEST PRIORITY.** Now that data-bearing AI calls are eliminated, Cloudflare is the single remaining third party that sees journal plaintext. Closes Critical #1. | Cloudflare dashboard + `Caddyfile` if Tunnel | 1-2h | medium (test login + journal submit + observatory + export end-to-end) |
| 2 | **Caddy security-header bundle** + `Cache-Control: no-store` on `/`, `/subject`, `/api/respond`, `/api/subject/respond`, `/api/calibrate`, `/api/subject/calibrate`, `/api/event`. HSTS preload, CSP with nonces, Referrer-Policy `no-referrer`, Permissions-Policy lockdown, X-Frame-Options DENY, X-Content-Type-Options nosniff. Closes Critical #2 + #3 + High #4 in one Caddyfile edit. | `deploy/Caddyfile` | 30m | low |
| 3 | CAA DNS record pinning Let's Encrypt; verify DNSSEC enabled at Cloudflare. Closes Medium #10 + #11. | DNS only | 10m | none |
| 4 | Argon2id 256MB / 4 iter — only after a Hetzner CCX13 benchmark confirms login latency stays under 500ms. Rotate by running `npm run set-owner-password` and instructing each subject to use the password reset flow (auto re-hashes at new params). Closes High #7. | `src/lib/libSubjectAuth.ts:35` | 30m | low |
| 5 | Caddy `log_skip` on journal POST paths + pin `trusted_proxies` to Cloudflare ranges (or LAN if going DNS-only post item 1). Closes Medium #8 + #9. | `deploy/Caddyfile` | 15m | low |

## Class I roadmap (separate project, not this week)

Listed for completeness so they do not get reinvented.

- HSM-bound master key (TPM 2.0 sealing, YubiKey-backed envelope key, or AWS/GCP KMS). HKDF-derived per-row keys. Master rotation annually with re-encryption pass.
- Third-party penetration test.
- SOC 2 Type II or equivalent.
- Formal change management (signed releases, audit log of admin operations).
- Multi-site reproducibility study (more than one host).
- Data Protection Impact Assessment (GDPR Article 35) and equivalents.
- WebAuthn passkey + TOTP fallback for owner.

## Open verifications / debts

Items the audit cannot close from inside the repo. Each needs a one-time check that lives outside source control.

- **DNSSEC enabled at Cloudflare** for fweeo.com.
- **Full-disk encryption on the Hetzner volume** for the `/opt/alice` mount. systemd journal and `data/errors.log` are otherwise plaintext at rest.
- **Backup posture for `ALICE_ENCRYPTION_KEY`**: verify both backups (operator's password manager AND `/etc/alice/secrets.env`) exist, are readable, and are stored in geographically distinct locations.
- **CAA records pinning Let's Encrypt** at the registrar.
- **CI artifact integrity**: nothing currently authenticates the linux-x64 `.node` between CI and Hetzner. Add Sigstore.

## What this audit did NOT cover

- Production secrets management beyond what is visible from the repo.
- The owner's local development machine threat model (browser extensions, OS, FDE, Tailscale to Supabase).
- Supabase backup retention and access posture.
- Cloudflare account security (SSO, MFA, API token scoping).
- Hetzner account security and KVM console access.
- Recovery drill: has the operator ever actually restored from backup using only the password-manager copy of `ALICE_ENCRYPTION_KEY`?

These belong in a follow-up "operational security" audit.
