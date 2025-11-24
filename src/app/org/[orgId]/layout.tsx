import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { canManageOrgUsers } from '@/lib/permissions'

interface OrgLayoutProps {
  children: ReactNode
  params: { orgId: string }
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const orgId = params.orgId
  const isPlatformAdmin = user.role === 'PLATFORM_ADMIN'
  
  // CRITICAL: Store managers and cashiers should NOT access org routes
  // Check if user has shop roles (store manager or cashier)
  const hasShopRole = user.shops && user.shops.length > 0
  const isStoreManager = user.shops?.some((s: any) => s.shopRole === 'STORE_MANAGER')
  const isCashier = user.shops?.some((s: any) => s.shopRole === 'CASHIER')
  
  // If user is ONLY a store manager or cashier (no org admin role), block access
  if ((isStoreManager || isCashier) && !isPlatformAdmin) {
    const isOrgAdmin = canManageOrgUsers(user, orgId)
    if (!isOrgAdmin) {
      // Redirect to their shop dashboard
      const firstShop = user.shops?.[0]
      if (firstShop) {
        redirect('/store')
      }
      redirect('/')
    }
  }
  
  const isOrgAdmin = canManageOrgUsers(user, orgId)

  if (!isPlatformAdmin && !isOrgAdmin) {
    redirect('/')
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, status: true },
  })

  if (!org || org.status !== 'ACTIVE') {
    redirect('/waiting-approval')
  }

  // Note: Cookies are set via API route (/api/org/select) when Platform Admin clicks "Enter Org"
  // Layouts cannot modify cookies - they can only read them
  // For Platform Admin, orgId comes from URL params, not cookies

  return (
    <div className="space-y-6">
      <Breadcrumb
        prefix={isPlatformAdmin ? 'Platform Admin · Organization' : 'Organization'}
        items={[{ label: org.name }]}
      />
      {children}
    </div>
  )
}


