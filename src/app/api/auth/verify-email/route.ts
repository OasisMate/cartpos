import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/domain/email-verification'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ status: 'invalid' }, { status: 400 })
    }
    const result = await verifyEmailToken(token)
    const ok = result.status === 'verified' || result.status === 'already'
    return NextResponse.json(result, { status: ok ? 200 : 400 })
  } catch (error) {
    console.error('Verify email error:', error)
    return NextResponse.json({ status: 'invalid' }, { status: 500 })
  }
}
