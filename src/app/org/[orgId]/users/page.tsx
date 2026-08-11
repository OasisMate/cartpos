import { prisma } from '@/lib/db/prisma'
import OrgUsersView from '@/app/org/_components/OrgUsersView'

// Platform-admin view of one organization's staff. The org comes from the URL,
// never from the currentOrgId cookie, so this page always matches the org named
// in the sidebar and breadcrumb. Access is already enforced by ../layout.tsx.
export default async function OrgScopedUsersPage({ params }: { params: { orgId: string } }) {
  const org = await prisma.organization.findUnique({
    where: { id: params.orgId },
    select: { name: true },
  })

  return <OrgUsersView orgId={params.orgId} orgName={org?.name || undefined} />
}
