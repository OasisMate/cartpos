import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getSupplierLedger } from '@/lib/domain/suppliers'

// GET: supplier payables ledger + running balance owed
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const result = await getSupplierLedger(params.id, user.id)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Get supplier ledger error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get supplier ledger' },
      { status: 404 }
    )
  }
}
