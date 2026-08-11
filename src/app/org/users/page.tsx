import OrgUsersView from '@/app/org/_components/OrgUsersView'

// Org admin's own staff list. No orgId prop: they have exactly one org, so the
// API falls back to their currentOrgId. Platform admins use /org/[orgId]/users.
export default function OrgUsersPage() {
  return <OrgUsersView />
}
