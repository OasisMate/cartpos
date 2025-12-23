import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { isDatabaseConnectionError } from '@/lib/db/db-utils'
import { withRetry } from '@/lib/db/connection-retry'

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic'

export default async function Home() {
  try {
    const user = await getCurrentUser()

    // If unauthenticated, middleware should redirect to /login
    if (!user) {
      redirect('/login')
    }

    // Admins go to Admin
    if (user.role === 'PLATFORM_ADMIN') {
      redirect('/admin')
    }

    // IMPORTANT: Check shop roles FIRST (store managers and cashiers should NOT see org views)
    // Store managers default to store dashboard (they should NOT have org admin access)
    const storeManagerRecord = user.shops?.find((s) => s.shopRole === 'STORE_MANAGER')
    if (storeManagerRecord) {
      // Ensure they have a shop selected
      if (!user.currentShopId) {
        // Set first shop as current if none selected
        const firstShop = user.shops.find((s) => s.shopRole === 'STORE_MANAGER')
        if (firstShop) {
          redirect(`/shop/select?shopId=${firstShop.shopId}`)
        }
      }
      redirect('/store')
    }

    // Cashiers go to POS (they should NOT have org admin access)
    const cashierRecord = user.shops?.find((s) => s.shopRole === 'CASHIER')
    if (cashierRecord) {
      // Ensure they have a shop selected
      if (!user.currentShopId) {
        const firstShop = user.shops.find((s) => s.shopRole === 'CASHIER')
        if (firstShop) {
          redirect(`/shop/select?shopId=${firstShop.shopId}`)
        }
      }
      redirect('/pos')
    }

    // Only after checking shop roles, check for org admins
    // Org admins (within organizations) - check organization status first
    const orgAdminRecord = user.organizations?.find((o: any) => o.orgRole === 'ORG_ADMIN')
    if (orgAdminRecord) {
      const orgId = user.currentOrgId || orgAdminRecord.orgId
      if (orgId) {
        try {
          const org = await withRetry(
            () =>
              prisma.organization.findUnique({
                where: { id: orgId },
                select: { status: true },
              }),
            { maxRetries: 2, initialDelay: 200 }
          )
          if (!org || org.status === 'PENDING' || org.status === 'SUSPENDED' || org.status === 'INACTIVE') {
            redirect('/waiting-approval')
          }

          redirect('/org')
        } catch (error) {
          if (isDatabaseConnectionError(error)) {
            // Redirect to login with error state - the login page will show the error
            redirect('/login?error=database')
          }
          throw error
        }
      }

      redirect('/waiting-approval')
    }

    // Fallback: if user has shops but no specific role, redirect to first shop
    if (user.shops && user.shops.length > 0) {
      const firstShop = user.shops[0]
      if (firstShop) {
        redirect(`/shop/select?shopId=${firstShop.shopId}`)
      }
    }

    // No valid role or shop assignment
    redirect('/login')
  } catch (error) {
    console.error('Error in Home page:', error)
    
    if (isDatabaseConnectionError(error)) {
      // Redirect to login with error state
      redirect('/login?error=database')
    }
    
    // Re-throw other errors
    throw error
  }
}

