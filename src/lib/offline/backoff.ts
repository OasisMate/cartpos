export interface BackoffOptions {
  retries?: number
  baseMs?: number
  maxMs?: number
  jitter?: boolean
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nextDelay(attempt: number, baseMs: number, maxMs: number, jitter: boolean) {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt))
  if (!jitter) return exp
  const rand = Math.random() * exp * 0.3 // 30% jitter
  return Math.min(maxMs, exp - rand)
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const retries = options.retries ?? 3
  const baseMs = options.baseMs ?? 500
  const maxMs = options.maxMs ?? 5000
  const jitter = options.jitter ?? true

  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries) throw err
      const delay = nextDelay(attempt, baseMs, maxMs, jitter)
      await sleep(delay)
      attempt++
    }
  }
}

