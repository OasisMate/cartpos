import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Control Prisma logging via environment variable
// Set PRISMA_LOG_QUERIES=true in .env to enable query logging in development
const enableQueryLogging = process.env.PRISMA_LOG_QUERIES === 'true'

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? enableQueryLogging
          ? ['query', 'error', 'warn']
          : ['error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

