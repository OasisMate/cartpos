import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isDatabaseConnectionError } from '@/lib/db/db-utils'
import { withRetry } from '@/lib/db/connection-retry'
import { OrgDashboardContent } from './OrgDashboardContent'

export async function renderOrgDashboard(orgIdOverride?: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      redirect('/login')
    }

    const isPlatformAdmin = user.role === 'PLATFORM_ADMIN'
    
    // CRITICAL: Store managers and cashiers should NOT access org dashboard
    const isStoreManager = user.shops?.some((s: any) => s.shopRole === 'STORE_MANAGER')
    const isCashier = user.shops?.some((s: any) => s.shopRole === 'CASHIER')
    
    // If user is ONLY a store manager or cashier (no org admin role), redirect to shop
    if ((isStoreManager || isCashier) && !isPlatformAdmin) {
      const hasOrgAdminRole = user.organizations?.some(
        (o: any) => o.orgRole === 'ORG_ADMIN' && (!orgIdOverride || o.orgId === orgIdOverride)
      )
      if (!hasOrgAdminRole) {
        // Redirect to their shop dashboard
        const firstShop = user.shops?.[0]
        if (firstShop) {
          redirect('/store')
        }
        redirect('/')
      }
    }
    
    const isOrgAdmin =
      user.organizations?.some(
        (o: any) => o.orgRole === 'ORG_ADMIN' && (!orgIdOverride || o.orgId === orgIdOverride)
      ) || false

    const orgId = orgIdOverride || user.currentOrgId || user.organizations?.[0]?.orgId

    if (!orgId) {
      redirect('/')
    }

    if (!isPlatformAdmin && !isOrgAdmin) {
      redirect('/')
    }

  const org = await withRetry(
    () =>
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { status: true },
      }),
    { maxRetries: 2, initialDelay: 200 }
  )

  if (!org || org.status !== 'ACTIVE') {
    redirect('/waiting-approval')
  }

  const [shops, usersInOrg] = await Promise.all([
    withRetry(
      () =>
        prisma.shop.findMany({
          where: { orgId },
          select: { id: true, name: true },
        }),
      { maxRetries: 2, initialDelay: 200 }
    ),
    withRetry(
      () => prisma.organizationUser.count({ where: { orgId } }),
      { maxRetries: 2, initialDelay: 200 }
    ),
  ])

  const shopIds = shops.map((s) => s.id)

  const [productsCount, customersCount, invoicesTodayCount, outstandingUdhaar] = await Promise.all([
    withRetry(
      () => prisma.product.count({ where: { shopId: { in: shopIds } } }),
      { maxRetries: 2, initialDelay: 200 }
    ),
    withRetry(
      () => prisma.customer.count({ where: { shopId: { in: shopIds } } }),
      { maxRetries: 2, initialDelay: 200 }
    ),
    withRetry(
      () =>
        prisma.invoice.count({
          where: {
            shopId: { in: shopIds },
            createdAt: { gte: new Date(new Date().toDateString()) },
            status: 'COMPLETED',
          },
        }),
      { maxRetries: 2, initialDelay: 200 }
    ),
    withRetry(
      () =>
        prisma.customerLedger.aggregate({
          _sum: { amount: true },
          where: { shopId: { in: shopIds }, direction: 'DEBIT' },
        }),
      { maxRetries: 2, initialDelay: 200 }
    ),
  ])

    return (
      <OrgDashboardContent
        shopsCount={shops.length}
        usersInOrg={usersInOrg}
        productsCount={productsCount}
        invoicesTodayCount={invoicesTodayCount}
        outstandingUdhaar={Number(outstandingUdhaar._sum.amount || 0)}
      />
    )
  } catch (error) {
    console.error('Error rendering org dashboard:', error)
    
    if (isDatabaseConnectionError(error)) {
      return (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div>
                <h3 className="font-semibold text-red-800">Database Connection Error</h3>
                <p className="text-sm text-red-700 mt-1">
                  Database connection failed. Please check your database configuration or try again later.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    // Re-throw non-database errors to be handled by Next.js error boundary
    throw error
  }
}

