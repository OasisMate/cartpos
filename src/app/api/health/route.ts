import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const health: {
    ok: boolean
    service: string
    time: string
    database?: {
      connected: boolean
      error?: string
    }
  } = {
    ok: true,
    service: 'CartPOS',
    time: new Date().toISOString(),
  }

  // Test database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    health.database = { connected: true }
  } catch (error: any) {
    health.ok = false
    health.database = {
      connected: false,
      error: error?.message || 'Database connection failed',
    }
  }

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
  })
}


