# Batch 3 audit report — both items

---

## Item 1 — #5: owner session invalidation

### Existing pattern in `resetPassword` (libSubjectAuth.ts:265-289)

```typescript
return await sql.begin(async (tx) => {
  const rows = await tx`SELECT password_hash FROM tb_subjects WHERE subject_id = ${subjectId} AND is_active = TRUE`;
  const row = rows[0] as { password_hash: string } | undefined;
  if (!row) return false;
  const ok = await verifyPassword(row.password_hash, currentPassword);
  if (!ok) return false;
  const newHash = await hashPassword(newPassword);
  await tx`UPDATE tb_subjects SET password_hash = ${newHash}, must_reset_password = FALSE, dttm_modified_utc = CURRENT_TIMESTAMP WHERE subject_id = ${subjectId}`;
  await tx`DELETE FROM tb_subject_sessions WHERE subject_id = ${subjectId}`;
  return true;
});
```

Pattern characteristics:

- **Transaction boundary**: single `sql.begin` wrapping load → verify → UPDATE → DELETE. Atomic: any failure rolls back the password change too.
- **DELETE shape**: `WHERE subject_id = ${subjectId}` — wipes all sessions for that subject_id, no token/expiry filter. Returns nothing (the `count` is discarded).
- **Order**: UPDATE before DELETE. Doesn't strictly matter inside a transaction (no outside reader sees partial state), but documents intent: "the new credential is the password change; all prior sessions predate the new credential, so they're invalid."
- **Return value**: `boolean` — success/fail. Doesn't surface session-wipe count.

### `tb_subject_sessions` cascade dependency walk

Schema header (dbAlice_Tables.sql:299-316):

```
tb_subject_sessions:
  - subject_session_id (PK)
  - subject_id (logical FK to tb_subjects)
  - token_hash, expires_at, last_seen_at, last_ip, dttm_created_utc
```

Grep'd the entire repo for references to `subject_session_id`. **Nothing** — no other table holds an FK to `tb_subject_sessions.subject_session_id`. It's a leaf table. Sessions reference subjects (parent), no rows reference sessions (no children).

Confirmed: a single `DELETE FROM tb_subject_sessions WHERE subject_id = ?` cleans up everything. No additional cascade needed. `sql.begin` is still appropriate to make the password-change + session-wipe atomic, but it's not load-bearing for FK reasons.

### Proposed equivalent for `setOwnerPassword`

The current function has two paths (UPDATE existing, INSERT fresh). Only the UPDATE path needs session invalidation; the INSERT path is a fresh row with no pre-existing sessions.

```typescript
export async function setOwnerPassword(
  plaintextPassword: string,
): Promise<{ kind: 'rotated'; sessionsInvalidated: number } | { kind: 'created' }> {
  const passwordHash = await hashPassword(plaintextPassword);
  return await sql.begin(async (tx) => {
    const updated = await tx`
      UPDATE tb_subjects
      SET password_hash       = ${passwordHash}
        , must_reset_password = FALSE
        , dttm_modified_utc   = CURRENT_TIMESTAMP
      WHERE is_owner = TRUE
    `;
    if (updated.count > 1) {
      throw new Error(`multiple owner rows found (${updated.count}); expected 0 or 1`);
    }
    if (updated.count === 1) {
      const wiped = await tx`DELETE FROM tb_subject_sessions WHERE subject_id IN (SELECT subject_id FROM tb_subjects WHERE is_owner = TRUE)`;
      return { kind: 'rotated' as const, sessionsInvalidated: wiped.count };
    }
    // No existing owner row — fresh deploy. INSERT, no sessions to invalidate.
    const inserted = await tx`
      INSERT INTO tb_subjects (
        username, password_hash, must_reset_password,
        iana_timezone, display_name, is_owner
      ) VALUES (
        'owner', ${passwordHash}, FALSE,
        'UTC', 'Owner', TRUE
      )
    `;
    if (inserted.count !== 1) {
      throw new Error(`failed to insert owner row, got ${inserted.count}`);
    }
    return { kind: 'created' as const };
  });
}
```

**The session-wipe runs INSIDE the same transaction as the UPDATE.** If the wipe fails, the password change rolls back too — atomic.

The DELETE uses `subject_id IN (SELECT subject_id FROM tb_subjects WHERE is_owner = TRUE)` rather than hardcoding subject_id 1 because `OWNER_SUBJECT_ID = 1` is a convention but the schema enforces uniqueness via the partial index `uq_subjects_single_owner ON tb_subjects(is_owner) WHERE is_owner = TRUE`, not a hardcoded ID. Using the `is_owner` predicate directly is the truthful join.

The return type changes from `Promise<void>` to a discriminated union. Non-breaking for the existing CLI callsite, which currently doesn't read the return value.

### Proposed CLI messages

In `src/scripts/set-owner-password.ts`:

```typescript
const result = await setOwnerPassword(password);
if (result.kind === 'rotated') {
  console.log(`Owner password rotated. ${result.sessionsInvalidated} active owner session(s) invalidated — every browser/device with an existing owner cookie must log in again.`);
} else {
  console.log('Owner row created with the supplied password. No prior sessions to invalidate.');
}
```

Two messages. The "rotated" case surfaces the count so the operator can sanity-check ("I had one tab open, I expect 1 to be invalidated"). The "created" case explicitly says "no sessions to invalidate" so it's not silent — a fresh-deploy operator sees the right thing.

The rotated message also says **"every browser/device with an existing owner cookie must log in again"** because that's the operationally important fact: the operator just locked themselves (and any other device they own) out. They should expect to type their password again on every device.

---

## Item 2 — #6: reset-password rate limit

### Existing pattern in login handler (api/subject/login.ts)

```typescript
import { consume, reset as resetRateLimit } from '../../../lib/utlRateLimit.ts';

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function clientIpKey(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return `login:${first.slice(0, 45)}`;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return `login:${real.trim().slice(0, 45)}`;
  return 'login:unknown';
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const rateKey = clientIpKey(request);
  const limited = consume(rateKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limited.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(limited.retryAfterSeconds),
      },
    });
  }
  // ... auth ...
  // On success:
  resetRateLimit(rateKey);
  // ...
};
```

Pattern characteristics:

- **Key shape**: `login:<first-xff-entry, max 45 chars>` (or `login:<x-real-ip>`, or fallback `login:unknown`). String-prefixed namespace.
- **Window**: 15 minutes.
- **Limit**: 10 attempts per window.
- **Response on hit**: 429 JSON `{ error: 'rate_limited' }` + `Retry-After: <seconds>` header. Body shape matches `utlRateLimit.rateLimited()` helper (which the submission endpoints use), but the login handler hand-rolls its own response — minor inconsistency.
- **Bucket reset on success**: yes, via `resetRateLimit(rateKey)`. So a user who fat-fingers their password 3 times then gets it right has a clean bucket for next time.
- **Fixed-window bucket** (not sliding) — `utlRateLimit.consume` resets the count when the window rolls over.

### Proposed shape for `/api/subject/reset-password`

```typescript
import { consume, reset as resetRateLimit } from '../../../lib/utlRateLimit.ts';

const RESET_LIMIT = 10;
const RESET_WINDOW_MS = 15 * 60 * 1000;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const subject = locals.subject;
  if (!subject) return jsonError(401, 'unauthorized');

  const rateKey = `reset:${subject.subject_id}`;
  const limited = consume(rateKey, RESET_LIMIT, RESET_WINDOW_MS);
  if (!limited.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(limited.retryAfterSeconds),
      },
    });
  }
  // ... existing body parse + verify + reset ...
  // On success (after the existing resetPassword returns true):
  resetRateLimit(rateKey);
  // ...
};
```

**Mirrors login exactly** in:

- Limit (10) and window (15 min) — same threat profile, same Argon2id verify cost dominates either way
- 429 response shape including `Retry-After` header
- `resetRateLimit(rateKey)` on success
- `consume()` directly (not `consumeSubmissionLimit`) — `consumeSubmissionLimit` is per-(subject, endpoint) with its own pre-baked limit/window; here we want explicit values matching login

**Deviates from login** in:

- **Key shape**: `reset:<subject_id>` instead of `reset:<ip>`. Reasoning below.
- Limit/window identical because the threat is the same shape (Argon2id-bounded brute force).

### Rate-limit key tradeoff

**Option A — `reset:<subject_id>`** (recommended)

- Simpler — no IP detection, no XFF-header parsing, no fallback for missing headers.
- An attacker with a stolen session cookie can burn the legit user's bucket. Worst case: legit user gets locked out of the reset endpoint for ≤15 minutes when they discover the compromise. Annoying but not catastrophic.

**Option B — `reset:<subject_id>:<ip>`**

- Narrower blast radius for the bucket-burning DoS — attacker burns their IP's bucket, legit user from a different IP can still proceed.
- Cost: more code (IP extraction, XFF parsing, fallback for unknown), and a determined attacker rotating proxies can still drain via different keys.
- Real downside: a legit user on flaky mobile (cell tower IP changes) could trip a separate bucket on each network change, which is rare but bad UX.

**Recommendation: Option A.** The threat profile favors A:

1. The reset endpoint requires an active session AND knowledge of the current password. An attacker who already has the session is a much bigger problem than the bucket-burning DoS — the rate limit isn't the right defense for that attack chain (session-token compromise is).
2. The primary value of the rate limit at this endpoint is **CPU DoS protection** (Argon2id at 100ms × N attacks = sustained CPU draw). Subject-keyed limit caps that to 10 attempts per 15 min per subject regardless of source IP, which is exactly the cap we want.
3. Simpler code = fewer places for the IP-parsing dance to get wrong (and we already have one IP-parsing function in the login handler that took some care to get right).

**Tradeoff for the commit message**:

> Rate-limit key is `reset:<subject_id>` rather than `reset:<subject_id>:<ip>`.
> The subject-only key means an attacker with a stolen session cookie can
> burn the legit user's bucket, locking them out of the reset endpoint for
> up to 15 minutes per cycle. We accept that — anyone who's already stolen
> the session has bigger problems, and the simpler key shape makes the
> primary defense (Argon2id-backed CPU DoS protection) more obviously
> correct. If session-cookie compromise becomes a realistic threat model,
> revisit with composite keying.

### Access log leak verification

`Caddyfile:73-76`:

```
@journal_posts path /api/respond /api/subject/respond /api/calibrate /api/subject/calibrate /api/event
log_skip @journal_posts
```

`/api/subject/reset-password` is **NOT** in `@journal_posts`. So 429 responses on this endpoint WILL be access-logged.

What lands in `/var/log/caddy/alice.log` (Caddy's `console` format default):

- timestamp
- request method (POST)
- request URI (`/api/subject/reset-password` — no query string, no fragment)
- response status (429)
- response size
- duration
- remote IP

What does NOT land:

- Request headers (cookies, including the session cookie)
- Request body
- Response body
- Anything from `Astro.locals` (subject_id, etc.)

The rate-limit-key value (`reset:<subject_id>`) is only ever in process memory inside the `utlRateLimit` Map, never serialized to the log unless we explicitly log it. The 429 response body is `{ error: 'rate_limited', retryAfterSeconds: N }` — no subject_id leak.

**Conclusion**: 429 responses on this endpoint expose to the log only "this IP got rate-limited on /api/subject/reset-password at time T." That's correct ops telemetry, no subject identity leak.

The endpoint does **NOT** need to be added to `log_skip @journal_posts`. Logging the 429 is desirable — operator can see if someone's hammering the reset endpoint and correlate to investigate.

---

## Summary

### #5 implementation plan

- `setOwnerPassword` returns discriminated union, runs everything inside `sql.begin`, wipes sessions via `is_owner = TRUE` predicate.
- `set-owner-password.ts` CLI prints two distinct messages based on `kind`.
- `tb_subject_sessions` is a leaf table — no FK cascade work needed.
- One new test in `tests/db/subjectAuth.test.ts`: rotate-with-existing-sessions invalidates them; rotate-with-no-sessions doesn't error.

### #6 implementation plan

- Add rate-limit imports to `reset-password.ts`.
- 10 attempts per 15 min per subject, key `reset:<subject_id>`.
- 429 shape mirrors login handler exactly (response body + Retry-After header).
- Bucket reset on success.
- No Caddy log_skip change needed — the 429 path doesn't leak subject identity.

### Schema changes

None for either item. As predicted.

### Suggested commit shape

Two commits:

1. `fix(auth): owner password rotation invalidates existing owner sessions` (#5 — libSubjectAuth.ts + set-owner-password.ts CLI + new test)
2. `fix(auth): rate-limit /api/subject/reset-password (10/15min/subject)` (#6 — reset-password.ts handler + commit-message tradeoff note)

Awaiting sign-off before any code.
