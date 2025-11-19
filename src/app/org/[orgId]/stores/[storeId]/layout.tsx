import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface StoreLayoutProps {
  children: ReactNode
  params: { orgId: string; storeId: string }
}

export default async function OrgStoreLayout({ children, params }: StoreLayoutProps) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const { orgId, storeId } = params
  
  // Fetch both org and store details for breadcrumb
  const [org, store] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
    prisma.shop.findUnique({
      where: { id: storeId },
      select: { name: true, orgId: true },
    }),
  ])

  if (!store || store.orgId !== orgId || !org) {
    redirect(`/org/${orgId}`)
  }

  const isPlatformAdmin = user.role === 'PLATFORM_ADMIN'
  const isOrgAdmin = user.organizations?.some((o: any) => o.orgId === orgId && o.orgRole === 'ORG_ADMIN')
  const hasStoreRole = user.shops?.some((s: any) => s.shopId === storeId) ?? false

  if (!isPlatformAdmin && !isOrgAdmin && !hasStoreRole) {
    redirect('/')
  }

  // Note: Cookies are set via API routes when users select org/shop
  // Layouts cannot modify cookies - they can only read them
  // For Platform Admin, orgId and storeId come from URL params, not cookies

  return (
    <div className="space-y-6">
      <Breadcrumb
        prefix={isPlatformAdmin ? 'Platform Admin · Store' : 'Store'}
        items={[
          { label: org.name, href: `/org/${orgId}` },
          { label: store.name },
        ]}
        actions={
          <Link
            href={`/org/${orgId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Org
          </Link>
        }
      />
      {children}
    </div>
  )
}


