import { renderOrgDashboard } from './_components/renderOrgDashboard'

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic'

export default async function OrgDashboardPage() {
  return renderOrgDashboard()
}
