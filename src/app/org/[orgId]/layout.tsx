import { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

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
  const isOrgAdmin = user.organizations?.some((o: any) => o.orgId === orgId && o.orgRole === 'ORG_ADMIN')

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

  const cookieStore = cookies()
  cookieStore.set('currentOrgId', orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  // Clear shop context when entering org scope; store layout will set it again when needed
  if (cookieStore.get('currentShopId')) {
    cookieStore.delete('currentShopId')
  }

  return (
    <div>
      <div className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
        <span className="font-semibold text-[hsl(var(--foreground))]">{org.name}</span>
      </div>
      {children}
    </div>
  )
}


