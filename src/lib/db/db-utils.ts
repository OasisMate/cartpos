/**
 * Utility functions for handling database operations with error handling
 */

export function isDatabaseConnectionError(error: unknown): boolean {
  if (!error) return false
  
  const errorMessage = (error as Error)?.message || String(error)
  const errorName = (error as any)?.name || ''
  
  return (
    errorName === 'PrismaClientInitializationError' ||
    errorName === 'PrismaClientKnownRequestError' ||
    errorMessage.includes("Can't reach database server") ||
    errorMessage.includes("Can't reach") ||
    errorMessage.includes('connection') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('ENOTFOUND') ||
    (errorMessage.includes('database') && errorMessage.includes('server'))
  )
}

export class DatabaseConnectionError extends Error {
  constructor(message: string = 'Database connection failed') {
    super(message)
    this.name = 'DatabaseConnectionError'
  }
}

/**
 * Wraps a database operation with error handling
 * Throws DatabaseConnectionError if it's a connection issue
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      throw new DatabaseConnectionError(
        errorMessage || 'Database connection failed. Please check your database configuration or try again later.'
      )
    }
    throw error
  }
}

