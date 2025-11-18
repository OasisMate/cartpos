import { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

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

  const cookieStore = cookies()
  cookieStore.set('currentOrgId', orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  cookieStore.set('currentShopId', storeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  return (
    <div>
      <div className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        <a href={`/org/${orgId}`} className="hover:underline font-semibold text-[hsl(var(--foreground))]">
          {org.name}
        </a>
        <span className="mx-2">›</span>
        <span className="font-semibold text-[hsl(var(--foreground))]">{store.name}</span>
      </div>
      {children}
    </div>
  )
}


