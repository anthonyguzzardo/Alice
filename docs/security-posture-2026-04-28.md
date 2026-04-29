# Security posture audit (2026-04-28)

Snapshot of Alice's security posture as of `2026-04-28` after INC-018, INC-019, INC-020, and INC-021 landed. This is a working punch list, not a finished assessment. When reading later, cross-check each item against current code before acting — gaps close fast on this repo.

## Audit framing

Two distinct layers, audited separately:

- **Measurement layer** (Rust signal engine, reproducibility CI, binary provenance, encrypted-at-rest behavioral data): research-instrument-grade. Cited algorithms (Lacouture & Cousineau, Kraskov, Peng), bit-identity CI, per-row provenance stamps, single source of truth, archivable embedding model with SHA-pinned weights. No action items here.
- **Platform layer** (TLS, headers, auth surface, key custody, browser hygiene): tightening fast but still below the measurement layer's standard. This is the surface this doc is about.

Grade as of this audit: **B+**, trending toward A- once items 1-5 in the scoped plan land.

## What's already strong

These do not need rework. They are listed so future audits do not waste time re-discovering them.

- **TLS**: Caddy + Let's Encrypt with auto-renewal. No flexible-mode Cloudflare downgrade.
- **At-rest encryption**: AES-256-GCM with random 12-byte nonces on every subject-bearing column. Master key from `ALICE_ENCRYPTION_KEY` env var. Tamper or wrong-key throws, never returns garbage. See `src/lib/libCrypto.ts`.
- **Encrypted-content boundary discipline**: every read of an encrypted column lives inside `src/lib/libDb.ts`. App code above libDb sees plaintext on the way in and out, never ciphertext. `@region encrypted-reads` block holds the helpers.
- **Random nonces defeat ciphertext-equality oracles**: SQL `GROUP BY`/`DISTINCT`/`=` on encrypted columns no longer collapses identical plaintexts. The two operators that needed equality were rewritten to decrypt-then-dedupe-in-JS (`libDb.getCalibrationPromptsByRecency`, `health.ts:166`). New code needing equality on encrypted columns must follow that pattern.
- **Encrypted-content table invariant**: `tb_responses`, `tb_questions`, `tb_session_events` may contain only subject-authored or subject-derived signal fields. Operator annotations belong in separate tables. Load-bearing for `/api/subject/export` (uses `SELECT *` and strips ciphertext pairs).
- **Auth model**: Argon2id (OWASP-2024 baseline 64MB / 3 iter / 1 lane) for passwords. Session token: raw 32-byte hex in cookie, SHA-256(token) in `tb_subject_sessions`. DB leak alone does not grant active sessions. See `src/lib/libSubjectAuth.ts`.
- **Universal session-cookie auth (post INC-020, 2026-04-28)**: Owner and subjects share `/login`. Cookie is HttpOnly + Secure(PROD) + SameSite=Lax + no Max-Age (session cookie, dies with browser). Server-side `tb_subject_sessions.expires_at` enforces 7-day hard cap. Caddy basic-auth retired; `OWNER_BASICAUTH_HASH` deleted from production secrets.env.
- **Login rate limit**: 10 attempts / 15 minutes / IP. `Retry-After` on 429. Bucket reset on successful auth so a fat-finger user is not throttled on their next session. See `src/pages/api/subject/login.ts`, `src/lib/utlRateLimit.ts`.
- **Session telemetry (INC-018)**: `last_seen_at`, `last_ip` on each session row. Throttled to ≤ 1 write per 5 minutes per session via the WHERE clause.
- **Generic 401 on every auth failure**: no username enumeration via error message.
- **Argon2id verify wrapped in try/catch**: malformed hash returns false rather than throwing. See `libSubjectAuth.ts:54`.
- **Three-stage gating for subjects**: `must_reset_password` → consent gate → handler. Each gate has an explicit allow-list (logout, export, account/delete, consent acknowledge are unconditional rights). See `src/middleware.ts`.
- **No third-party plaintext from the journal pipeline**:
  - Embeddings: local TEI on `localhost:8090` with SHA-pinned Qwen3-Embedding-0.6B (INC-010). Voyage is dead; the `voyageai` npm package remains as cleanup debt only.
  - LLM: `ANTHROPIC_API_KEY` is intentionally not on prod. Per-submission generation removed in INC-014. The only Anthropic call site is `src/scripts/expand-corpus.ts` (manual `npm run corpus:refresh`), and it sends existing corpus questions, not journal text.
  - Supabase: only ever sees ciphertext. Encryption happens at the app layer before INSERT.
  - Therefore the only third party that sees journal plaintext today is **Cloudflare** (proxy ON in front of fweeo.com).
- **Browser hygiene on the journal surface**: textareas have `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"` set on both render paths in `src/pages/index.astro`. No localStorage drafts (text only in DOM until submit). No service worker, no manifest, no source maps in `dist/`. Theme is the only thing in `localStorage`.
- **Background work is durable, not fire-and-forget**: signal jobs in `tb_signal_jobs` with crash recovery, atomic claim, quadratic backoff, dead-letter. See `src/lib/libSignalWorker.ts`.

## Gaps

Severity is "what does it cost if exploited," not "how easy is it to fix." A 30-minute fix can be CRITICAL.

### Critical

| # | Gap | Where | Reason it is critical |
|---|---|---|---|
| 1 | Cloudflare proxy ON in front of fweeo.com | `deploy/Caddyfile:8` (DNS comment) | Cloudflare terminates user TLS at their edge and re-encrypts to Caddy. They see every login, journal entry, and session cookie in plaintext at the edge. Subpoenable (US company). For "monastic" Alice this is the single largest remaining leak. |
| 2 | No HSTS header anywhere | grep returns zero hits across repo | First HTTP visit to fweeo.com is downgrade-attackable (sslstrip, evil-twin WiFi). |
| 3 | No CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options | grep returns zero hits | Single XSS bug becomes total compromise. The `escapeHtml` helper in `src/pages/index.astro:1686` is the only line of defense for innerHTML render paths. |

### High

| # | Gap | Where | Reason |
|---|---|---|---|
| 4 | No `Cache-Control: no-store` on journal pages | grep returns zero hits | BFCache restores textarea contents from RAM after back-navigation. |
| 5 | Login is not constant-time | `libSubjectAuth.ts:111` returns null before `verifyPassword` runs on missing user | ~100ms Argon2 cost is observable as a username-enumeration side channel. |
| 6 | No rate limit on `/api/respond`, `/api/calibrate`, `/api/subject/respond`, `/api/subject/calibrate` | Only `login.ts` and `observatory/states.ts` consume the limiter | Once a session is hijacked there is no per-account throttle. |
| 7 | `ALICE_ENCRYPTION_KEY` is plaintext in `/etc/alice/secrets.env`; permanent (no rotation) | `libCrypto.ts:15-16` ("Lose the key, lose the data — by design") | Host compromise = key + ciphertext + DB in same blast radius. Class I bar requires HSM/TPM-bound master with KDF-derived per-row keys and rotation. |
| 8 | No 2FA / WebAuthn | not implemented | Single password gates the owner. INC-018 explicitly defers. |
| 9 | Argon2id at OWASP minimum (64MB / 3 iter) | `libSubjectAuth.ts:35` | Hetzner CCX13 can comfortably run 256MB / 4 iter for a single-user site. ~16x GPU/ASIC cost increase for free. |
| 10 | Astro CSRF Origin check disabled | `astro.config.mjs:17` | Defensible (SameSite=Lax suffices), but layered defense narrowed. Consider belt-and-suspenders Origin check at middleware for mutating routes. |

### Medium

| # | Gap | Where | Reason |
|---|---|---|---|
| 11 | Caddy access log retains IPs and URL paths to disk | `deploy/Caddyfile:33-39` (50MB × 5) | Forensic metadata trail. POST bodies not logged. Add `log_skip /api/respond /api/subject/respond /api/calibrate /api/subject/calibrate /api/event` or filter format. |
| 12 | `x-forwarded-for` trusted from any upstream | `src/lib/libSubject.ts:80` (`extractClientIp`), `src/pages/api/subject/login.ts:34` (`clientIpKey`) | If Cloudflare is bypassed, attacker spoofs XFF to bypass per-IP rate limit. Pin Caddy `trusted_proxies` to Cloudflare's published ranges (or to local LAN if going DNS-only). |
| 13 | No CAA DNS records | DNS-side only, not in repo | Without `fweeo.com. CAA 0 issue "letsencrypt.org"` any of ~150 trusted CAs can issue a fweeo.com cert. CAA cuts that to one. |
| 14 | DNSSEC status not verified | DNS-side | Confirm DNSSEC enabled at Cloudflare for fweeo.com. |
| 15 | No supply-chain scanning | `.github/workflows/` | No `npm audit` in CI. No Sigstore signature on the linux-x64 `.node` artifact uploaded from CI to Hetzner. Compromised CI account = persistent execution on Hetzner. |
| 16 | systemd journal captures Node stdout | `src/lib/utlErrorLog.ts:40` calls `console.error` after writing to `data/errors.log` | journald is plaintext at rest unless full-disk encryption is on. Confirm FDE on the Hetzner volume. |
| 17 | Logs and encrypted DB share storage | host filesystem | Disk seizure recovers logs (timing/IP traces) plus encrypted DB. Ship logs to a remote sink (Tailscale to personal box) and zero local logs nightly. |
| 18 | AES-GCM 12-byte random nonces | `libCrypto.ts:79` | Birthday-bounded at ~2⁴⁸ encryptions per key. Fine at Alice's volume. For long-term posture switch to AES-GCM-SIV (RFC 8452) or XChaCha20-Poly1305. |
| 19 | INC-021 historical TZ-skew on `tb_responses.dttm_created_utc` | fixed forward; legacy rows not backfilled | Not a security issue. Listed here as a correctness debt that affects audit-trail timestamps. See "Open verifications / debts" below. |

### Low (nation-state class)

| # | Gap | Reason |
|---|---|---|
| 20 | No post-quantum crypto | TLS 1.3 X25519 falls to Shor. Enable hybrid X25519+ML-KEM when Caddy ships it. AES-256 is grace-period-safe. |
| 21 | Hetzner / Supabase / Cloudflare subpoena exposure | Three jurisdictions (DE, US, US). Cloudflare is the worst because they see plaintext. |
| 22 | Spectre / Rowhammer / cold-boot | Encryption key sits in process RAM whenever Node runs. Out of reach on a managed VPS. |
| 23 | Browser-side adversaries on owner's device | Extensions with `<all_urls>` read the textarea. Tab-restore-on-crash brings entries back. DevTools always shows POST body to anyone with shoulder-surfer access. Mitigate with a dedicated browser profile, no extensions. |

## Class II punch list

The single-week jump from "lab tool" (Class III) to "publishable research instrument" (Class II) is now down to three items.

1. **Cloudflare proxy off (or Tunnel with origin auth tokens you control).** Removes the only third party that sees journal plaintext today.
2. **Caddy security-header bundle.** HSTS preload, CSP with nonces, Referrer-Policy `no-referrer`, Permissions-Policy lockdown, X-Frame-Options DENY, X-Content-Type-Options nosniff, `Cache-Control: no-store` on `/`, `/subject`, `/api/respond`, `/api/subject/respond`, `/api/calibrate`, `/api/subject/calibrate`, `/api/event`.
3. **Constant-time login dummy verify.** Hardcode an Argon2id hash; run `verifyPassword` against it on missing-user before returning null.

After these three land, every IRB-defensible posture claim about Alice as a research instrument is either true or one DNS record away.

## Class I roadmap (separate project, not this week)

None of these are on this week's list. Listed for completeness so they do not get reinvented.

- HSM-bound master key (TPM 2.0 sealing, YubiKey-backed envelope key, or AWS/GCP KMS). HKDF-derived per-row keys. Master rotation annually with re-encryption pass.
- Third-party penetration test.
- SOC 2 Type II or equivalent third-party audit.
- Formal change management (signed releases, audit log of admin operations).
- Multi-site reproducibility study (more than one host).
- Data Protection Impact Assessment (GDPR Article 35) and equivalent jurisdictions.
- WebAuthn passkey + TOTP fallback for owner.

## Scoped plan (next-week-sized)

Stop after item 5. Past that the marginal return on platform hardening is below the marginal return on continuing to harden the journal flow itself.

| # | Item | Where | Effort | Risk |
|---|---|---|---|---|
| 1 | INC-021 backfill audit. Join `tb_responses ↔ tb_session_events` on `question_id`. Flag rows with abs(time-delta) > 30s. Migration overwrites `tb_responses.dttm_created_utc` with the matching `tb_session_events.dttm_created_utc`. Keep a copy of the pre-fix value in a migration-temporary column for forensic recovery. | new migration `db/sql/migrations/NNN_*.sql` | 1-2h | low |
| 2 | Caddy security-header bundle + Cache-Control no-store on the journal flow | `deploy/Caddyfile` | 30m | low |
| 3 | Constant-time login: hardcoded Argon2id dummy hash, run `verifyPassword` against it on missing-user before returning null. Unit test asserts the timing distribution. | `src/lib/libSubjectAuth.ts` | 20m | low |
| 4 | CAA DNS record pinning Let's Encrypt; verify DNSSEC enabled at Cloudflare | DNS only | 10m | none |
| 5 | Cloudflare decision: DNS-only, or Cloudflare Tunnel with origin auth | Cloudflare dashboard + `Caddyfile` if Tunnel | 1-2h | medium (test login + journal submit + observatory + export end-to-end) |
| 6 | Per-subject NDJSON export audit. Read `/api/subject/export` end-to-end. Verify it auths via session, scopes to `subject.subject_id`, and that no operator-side column drift has accumulated since the encrypted-content invariant landed. Add a test that exporting subject A never returns subject B's rows. | reading + 1 test in `tests/db/` | 30m | low |
| 7 | Argon2id 256MB / 4 iter — only after a quick benchmark on Hetzner CCX13 confirms login latency stays under 500ms. Rotate by running `npm run set-owner-password` and instructing each subject to use the password reset flow (which automatically re-hashes at the new params). | `src/lib/libSubjectAuth.ts:35` | 30m | low |
| 8 | Belt-and-suspenders Origin check at middleware for state-changing requests. Reject mutating requests whose `Origin` is not `https://fweeo.com`. Complements `SameSite=Lax` now that Astro's check is off. | `src/middleware.ts` | 30m | low |
| 9 | Per-endpoint rate limit on `/api/respond`, `/api/calibrate`, `/api/subject/respond`, `/api/subject/calibrate`. Per-subject key (not per-IP) since these are all post-auth. Reasonable: 60/hour. | new wrappers in API handlers | 30m | low |
| 10 | Caddy `log_skip` on journal POST paths. Reduces forensic IP × URL trail. | `deploy/Caddyfile` | 5m | none |
| 11 | Pin Caddy `trusted_proxies` to Cloudflare IP ranges (or to LAN if going DNS-only post item 5). | `deploy/Caddyfile` | 10m | low |
| 12 | npm audit in CI as a hard gate. | `.github/workflows/` | 20m | low |

## Open verifications / debts

Items the audit could not close from inside the repo. Each needs a one-time check that lives outside source control.

- **DNSSEC enabled at Cloudflare** for fweeo.com. (Class II)
- **Full-disk encryption on the Hetzner volume** for the `/opt/alice` mount. systemd journal and `data/errors.log` are otherwise plaintext at rest. (Class II)
- **Backup posture for `ALICE_ENCRYPTION_KEY`**. Currently described as "operator's password manager AND `/etc/alice/secrets.env`." Verify both backups exist, are readable, and are stored in geographically distinct locations.
- **CAA records pinning Let's Encrypt** at the registrar.
- **CI artifact integrity**: confirm what authenticates the linux-x64 `.node` artifact between CI and Hetzner. If nothing, add Sigstore.
- **INC-021 backfill scope**: actual count of affected rows, distribution of skew magnitudes. Run as a SELECT before the migration, store the count in the migration's header comment for the methods record.

## What this audit did NOT cover

- Production secrets management beyond what is visible from the repo (the contents of `/etc/alice/secrets.env`, the password-manager backup posture, the Hetzner host's IAM model).
- The owner's local development machine threat model (browser extensions, OS, full-disk encryption, Tailscale or no Tailscale to Supabase).
- Supabase backup retention and access posture.
- Cloudflare account security (SSO, MFA, API token scoping).
- Hetzner account security and KVM console access.
- Recovery drill: has the operator ever actually restored from backup using only the password-manager copy of `ALICE_ENCRYPTION_KEY`?

These belong in a follow-up "operational security" audit, not this one.

## Provenance

This document was assembled during a 2026-04-27 audit and re-verified against the codebase 2026-04-28 after INC-018 / INC-019 / INC-020 / INC-021 landed. Three claims from the 2026-04-27 first pass were corrected during re-verification:

1. **VoyageAI sees journal text** — wrong. INC-010 (2026-04-23) replaced VoyageAI with local TEI. The package is in `package.json` as cleanup debt only; no live code imports it.
2. **Anthropic sees journal text on `npm run dev:full`** — wrong. INC-014 (2026-04-27) removed `runGeneration`. The only Anthropic call site is `src/scripts/expand-corpus.ts`, and it sends existing corpus questions, not journal entries.
3. **Caddy basic-auth on owner endpoints** — was true on 2026-04-27, fixed by INC-020 on 2026-04-28. The audit table reflects the fixed state.

Cross-references:

- `systemDesign/METHODS_PROVENANCE.md` INC-018, INC-019, INC-020, INC-021 (auth hardening, TZ awareness, universal login, TZ-skew correctness).
- `CLAUDE.md` § Subject Auth, § At-rest Encryption, § Deployment.
- `src/lib/libSubjectAuth.ts`, `src/lib/libCrypto.ts`, `src/lib/libSubject.ts`, `src/middleware.ts`, `deploy/Caddyfile`, `astro.config.mjs`.
