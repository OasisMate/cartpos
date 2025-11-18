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
  const orgAdminRecord = user.organizations?.find((o: any) => o.orgRole === 'ORG_ADMIN')
  if (orgAdminRecord) {
    const orgId = user.currentOrgId || orgAdminRecord.orgId
    if (orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { status: true },
      })
      if (!org || org.status === 'PENDING' || org.status === 'SUSPENDED' || org.status === 'INACTIVE') {
        redirect('/waiting-approval')
      }

      redirect('/org')
    }

    redirect('/waiting-approval')
  }

  // Store managers default to store dashboard
  const storeManagerRecord = user.shops?.find((s) => s.shopRole === 'STORE_MANAGER')
  if (storeManagerRecord) {
    redirect('/store')
  }

  // Cashiers go to POS
  redirect('/pos')
}

