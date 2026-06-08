/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Suitable as a first line of defense against brute-force / abuse on a single-instance
 * deployment (self-hosted node / single VPS). NOTE: state is per-process, so on a
 * multi-instance / serverless deployment (e.g. Vercel with many lambdas) you should
 * back this with a shared store (Redis / Upstash). The API below stays the same.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Occasionally purge expired buckets so memory doesn't grow unbounded.
function sweep(now: number) {
  if (buckets.size < 5000) return
  for (const [key, b] of buckets) {
    if (now > b.resetAt) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  /** Seconds until the window resets (only meaningful when !ok). */
  retryAfter: number
  remaining: number
}

/**
 * Record a hit for `key` and report whether it is within `limit` hits per `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0, remaining: limit - 1 }
  }

  bucket.count++
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000), remaining: 0 }
  }
  return { ok: true, retryAfter: 0, remaining: limit - bucket.count }
}

/** Clear a key's counter (e.g. on a successful login, reset the per-account counter). */
export function clearRateLimit(key: string) {
  buckets.delete(key)
}

/** Best-effort client IP from common proxy headers (Cloudflare / Vercel / nginx). */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
