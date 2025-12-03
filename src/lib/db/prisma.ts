import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Control Prisma logging via environment variable
// Set PRISMA_LOG_QUERIES=true in .env to enable query logging in development
const enableQueryLogging = process.env.PRISMA_LOG_QUERIES === 'true'

// Configure Prisma with connection pooling optimizations for Supabase
// Note: Connection errors will be logged but are handled by retry logic
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? enableQueryLogging
          ? ['query', 'warn'] // Only log queries and warnings, not errors (errors are handled by retry)
          : ['warn'] // Only log warnings in dev to reduce connection error noise
        : ['error'], // Log errors in production
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

// Graceful shutdown
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Add connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection check failed:', error)
    return false
  }
}

// Disconnect on process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

