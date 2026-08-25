import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { requirePaidWrite } from '@/lib/billing/guards'
import { receivePurchaseList } from '@/lib/domain/purchaseLists'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'
import { purchaseListErrorResponse } from '@/lib/purchaseLists/httpErrors'
import { MAX_IMAGES, fileToValidatedDataUrl } from '@/lib/purchaseLists/billPhotos'

/**
 * A malformed request: bad JSON, a quantity or cost that is not a real
 * number, too many photos, a photo of the wrong type or size. Kept distinct
 * from a domain error out of receivePurchaseList (which purchaseListErrorResponse
 * maps on its own terms) so the single catch below can tell "the request
 * itself is broken" apart from "the request is well-formed but not allowed"
 * without stringly-matching request-shape messages into that domain list.
 */
class BadRequestError extends Error {}

/** A required number: missing, blank, or non-finite is rejected rather than becoming NaN. */
function parseNumber(value: unknown, label: string): number {
  const n = Number(value)
  if (value === '' || value === null || value === undefined || !Number.isFinite(n)) {
    throw new BadRequestError(`${label} must be a valid number`)
  }
  return n
}

/** Same as parseNumber, but absent is fine - only a present, unparsable value is rejected. */
function parseOptionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return parseNumber(value, label)
}

// No demo guard: demo orgs may receive purchases like any other write here,
// only destructive actions (delete) are blocked for them.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const blocked = requirePaidWrite(user)
    if (blocked) return blocked
    if (!user.currentShopId) return NextResponse.json({ error: 'No shop selected' }, { status: 400 })

    const form = await request.formData()

    let payload: any
    try {
      payload = JSON.parse((form.get('payload') as string) || '{}')
    } catch {
      throw new BadRequestError('Invalid payload')
    }

    if (!Array.isArray(payload.lines)) {
      throw new BadRequestError('lines must be an array')
    }

    const lines = payload.lines.map((line: any) => {
      const productId = String(line?.productId || '')
      if (!productId) throw new BadRequestError('Each line needs a product')
      return {
        productId,
        quantity: parseNumber(line?.quantity, 'Quantity'),
        unitCost: parseOptionalNumber(line?.unitCost, 'Unit cost'),
      }
    })

    let date: Date | undefined
    if (payload.date) {
      date = new Date(payload.date)
      if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid date')
    }

    const files = form.getAll('image').filter((f): f is File => f instanceof File)
    if (files.length > MAX_IMAGES) {
      throw new BadRequestError(`At most ${MAX_IMAGES} photos`)
    }

    const images: string[] = []
    for (const file of files) {
      try {
        images.push(await fileToValidatedDataUrl(file))
      } catch (error: any) {
        throw new BadRequestError(error.message)
      }
    }

    const purchase = await receivePurchaseList(
      params.id,
      {
        lines,
        supplierId: payload.supplierId || undefined,
        date,
        reference: payload.reference || undefined,
        notes: payload.notes || undefined,
        onCredit: payload.onCredit === true,
        images,
      },
      user.id
    )

    if (user.currentOrgId) {
      await logActivity({
        userId: user.id,
        orgId: user.currentOrgId,
        shopId: user.currentShopId,
        action: ActivityActions.RECEIVE_PURCHASE_LIST,
        entityType: EntityTypes.PURCHASE_LIST,
        entityId: params.id,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    return NextResponse.json(purchase, { status: 201 })
  } catch (error: any) {
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return purchaseListErrorResponse(error, 'Receive purchase list error:')
  }
}
