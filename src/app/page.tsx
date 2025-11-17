import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

export default async function Home() {
  const user = await getCurrentUser()

  // If unauthenticated, middleware should redirect to /login
  if (!user) {
    redirect('/login')
  }

  // Admins go to Admin
  if (user.role === 'PLATFORM_ADMIN') {
    redirect('/admin')
  }

  // Org admins (within organizations) - check organization status first
  const isOrgAdmin = user.organizations?.some((o: any) => o.orgRole === 'ORG_ADMIN')
  if (isOrgAdmin) {
    const orgId = user.currentOrgId || user.organizations?.[0]?.orgId
    if (orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { status: true },
      })
      // If organization is PENDING, redirect to waiting page
      if (org?.status === 'PENDING') {
        redirect('/waiting-approval')
      }
      // If organization is SUSPENDED or INACTIVE, also redirect to waiting page (it handles these cases)
      if (org?.status === 'SUSPENDED' || org?.status === 'INACTIVE') {
        redirect('/waiting-approval')
      }
      // Only redirect to org dashboard if ACTIVE
      if (org?.status === 'ACTIVE') {
        redirect('/org')
      }
    }
    // Fallback: if no org found but user is org admin, redirect to waiting
    redirect('/waiting-approval')
  }

  // Normal users: if any SHOP_OWNER role → Shop dashboard, otherwise POS (cashier)
  const hasOwnerRole = user.shops?.some((s) => s.shopRole === 'SHOP_OWNER')
  if (hasOwnerRole) {
    redirect('/shop')
  }

  redirect('/pos')
}

