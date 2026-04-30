/**
 * In-memory rate limiter (fixed window, per-key).
 *
 * Why in-memory: Alice runs as a single-process Astro/Node server on one
 * Hetzner host. Cross-process coordination is not a concern. State resets on
 * restart, which is acceptable — a determined attacker who can trigger a
 * restart has bigger access than a brute-force loop.
 *
 * Why fixed window over token-bucket: simpler, sufficient for the threat
 * model (slow brute-force on the auth surface). The boundary effect at window
 * rollover lets a burst of up to 2× the limit through; for a 10-per-15-min
 * login limit that's fine.
 *
 * Use case: gate `/api/subject/login` and `/api/subject/reset-password` against
 * credential stuffing. Argon2id verification is already ~100ms per attempt,
 * but this caps how many shots an attacker gets per IP per window.
 */

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

/** Last-resort cleanup: drop expired buckets so the map doesn't grow unbounded. */
function evictExpired(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > windowMs) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check whether `key` may proceed under this limit and increment its counter
 * if so. The counter is incremented even on `allowed: false` so a sustained
 * attack can't keep the window open by spamming past the cap.
 */
export function consume(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup. Cheap; only fires on calls.
  if (buckets.size > 1024) evictExpired(now, windowMs);

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const elapsed = now - bucket.windowStart;
    const retryAfterMs = Math.max(0, windowMs - elapsed);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** Reset a specific key (e.g. on successful auth). Test helper too. */
export function reset(key: string): void {
  buckets.delete(key);
}

// ─── Submission limits ─────────────────────────────────────────────────────

/**
 * Per-subject submission-endpoint rate limit. 60 requests / hour / subject is
 * comfortably above any plausible legitimate use of the journal/calibration
 * write paths (these endpoints take seconds-of-typing-then-submit, not
 * sub-second polling) and tightly bounds a hijacked-session abuser.
 *
 * Key is per-(subject, endpoint) so a hijacked session can't drain the budget
 * of one endpoint to lock the subject out of others.
 */
const SUBMISSION_LIMIT = 60;
const SUBMISSION_WINDOW_MS = 60 * 60 * 1000;

export function consumeSubmissionLimit(subjectId: number, endpoint: string): RateLimitResult {
  return consume(`submit:${subjectId}:${endpoint}`, SUBMISSION_LIMIT, SUBMISSION_WINDOW_MS);
}

/** Build a 429 response with a Retry-After header. Shared by the submission handlers. */
export function rateLimited(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ error: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(result.retryAfterSeconds),
    },
  });
}

/** Test-only: clear all buckets. */
export function _clearAll(): void {
  buckets.clear();
}
