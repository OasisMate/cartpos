import { renderOrgDashboard } from '../_components/renderOrgDashboard'

interface OrgPageProps {
  params: { orgId: string }
}

export default async function OrgDashboardByIdPage({ params }: OrgPageProps) {
  return renderOrgDashboard(params.orgId)
}

