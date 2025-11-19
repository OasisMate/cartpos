import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { Breadcrumb } from '@/components/layout/Breadcrumb'

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


