/**
 * Connection retry utility for handling intermittent database connection issues
 */

import { isDatabaseConnectionError } from './db-utils'

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 100, // 100ms
  maxDelay: 2000, // 2 seconds
  backoffMultiplier: 2,
}

/**
 * Retries a database operation with exponential backoff
 * Only retries on database connection errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Only retry on database connection errors
      if (!isDatabaseConnectionError(error)) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      )

      console.warn(
        `Database connection error (attempt ${attempt + 1}/${opts.maxRetries + 1}), retrying in ${delay}ms...`
      )

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Wraps Prisma operations with automatic retry on connection errors
 */
export function createRetryablePrismaOperation<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return withRetry(operation, options)
}


