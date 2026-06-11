/**
 * Rate limiter with a shared store (Upstash Redis) when configured, falling back to a
 * per-process in-memory window otherwise.
 *
 * On Vercel (many short-lived lambdas) the in-memory store is per-instance and resets on
 * cold start, so it can't actually throttle a determined attacker. Set the two Upstash
 * env vars to get a real cross-instance limit:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * If they're absent (e.g. local dev / single VPS) we transparently use the in-memory store.
 * If Upstash is configured but errors, we degrade to in-memory rather than failing open.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

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

function rateLimitMemory(key: string, limit: number, windowMs: number): RateLimitResult {
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

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const upstashEnabled = !!(UPSTASH_URL && UPSTASH_TOKEN)

/** Run a pipeline of Redis commands against the Upstash REST API. Returns each command's result. */
async function upstashPipeline(commands: (string | number)[][]): Promise<any[]> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const data = (await res.json()) as Array<{ result?: any; error?: string }>
  return data.map((d) => {
    if (d.error) throw new Error(d.error)
    return d.result
  })
}

/**
 * Record a hit for `key` and report whether it is within `limit` hits per `windowMs`.
 * Fixed-window counter (INCR + PEXPIRE NX on first hit).
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!upstashEnabled) return rateLimitMemory(key, limit, windowMs)
  try {
    const [count, , ttl] = await upstashPipeline([
      ['INCR', key],
      ['PEXPIRE', key, windowMs, 'NX'],
      ['PTTL', key],
    ])
    const c = Number(count)
    const ttlMs = Number(ttl)
    const retryAfter = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000)
    if (c > limit) return { ok: false, retryAfter, remaining: 0 }
    return { ok: true, retryAfter: 0, remaining: Math.max(0, limit - c) }
  } catch (e) {
    // Upstash unreachable: degrade to in-memory (still some protection), never fail open.
    console.warn('rateLimit: Upstash error, falling back to in-memory:', (e as Error)?.message)
    return rateLimitMemory(key, limit, windowMs)
  }
}

/** Clear a key's counter (e.g. on a successful login, reset the per-account counter). */
export async function clearRateLimit(key: string): Promise<void> {
  buckets.delete(key)
  if (!upstashEnabled) return
  try {
    await upstashPipeline([['DEL', key]])
  } catch (e) {
    console.warn('clearRateLimit: Upstash error:', (e as Error)?.message)
  }
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
