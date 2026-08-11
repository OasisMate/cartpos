import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { previewDowngrade, applyDowngrade } from '@/lib/billing/downgrade'
import { swapActiveShop } from '@/lib/billing/lifecycle'
import { logActivity, ActivityActions, EntityTypes } from '@/lib/audit/activityLog'

/**
 * Org-facing plan changes: preview what a smaller plan would pause, apply it,
 * or swap which shop a one-shop plan is using.
 *
 * Never gated by billing state. An expired org must be able to choose a plan,
 * which is the entire point of the read-only lockout.
 */

async function requireOrgAdmin() {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const orgId = user.currentOrgId
  if (!orgId) return { error: NextResponse.json({ error: 'No organization selected' }, { status: 400 }) }
  const isOrgAdmin =
    user.organizations?.some((o) => o.orgId === orgId && o.orgRole === 'ORG_ADMIN') ||
    user.role === 'PLATFORM_ADMIN'
  if (!isOrgAdmin) {
    return { error: NextResponse.json({ error: 'Only the owner can change the plan' }, { status: 403 }) }
  }
  return { user, orgId }
}

/** Preview: what would this plan pause? Nothing is written. */
export async function GET(request: Request) {
  const ctx = await requireOrgAdmin()
  if ('error' in ctx) return ctx.error

  const planCode = new URL(request.url).searchParams.get('planCode')
  if (!planCode) return NextResponse.json({ error: 'planCode is required' }, { status: 400 })

  try {
    return NextResponse.json({ impact: await previewDowngrade(ctx.orgId, planCode) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not preview' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const ctx = await requireOrgAdmin()
  if ('error' in ctx) return ctx.error
  const { user, orgId } = ctx

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  try {
    // ---- Swap the single active shop -------------------------------
    if (body.action === 'swapShop') {
      const shop = await swapActiveShop({
        orgId,
        activateShopId: String(body.shopId || ''),
        userId: user.id,
      })
      await logActivity({
        userId: user.id,
        orgId,
        shopId: shop.id,
        action: ActivityActions.SWAP_ACTIVE_SHOP,
        entityType: EntityTypes.STORE,
        entityId: shop.id,
        details: { activated: shop.name },
      })
      return NextResponse.json({ shop })
    }

    // ---- Choose a plan ----------------------------------------------
    if (body.action === 'choosePlan') {
      const planCode = String(body.planCode || '')
      const keepShopIds: string[] = Array.isArray(body.keepShopIds) ? body.keepShopIds.map(String) : []

      // Pauses what no longer fits AND restores what the new plan now covers,
      // in one transaction. Calling a separate reactivate step here used to
      // un-pause the very seats this had just paused.
      const result = await applyDowngrade({ orgId, planCode, keepShopIds, setBy: user.id })

      await logActivity({
        userId: user.id,
        orgId,
        action: ActivityActions.CHANGE_PLAN,
        entityType: EntityTypes.ORGANIZATION,
        entityId: orgId,
        details: {
          planCode,
          pausedShops: result.pausedShops,
          pausedSeats: result.pausedSeats,
          restoredShops: result.restoredShops,
          restoredSeats: result.restoredSeats,
          chosenBy: 'owner',
        },
      })

      return NextResponse.json({
        subscription: result.subscription,
        pausedShops: result.pausedShops,
        pausedSeats: result.pausedSeats,
        restoredShops: result.restoredShops,
        restoredSeats: result.restoredSeats,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Billing plan change error:', error)
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 400 })
  }
}
