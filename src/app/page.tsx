import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

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

  // Org admins (within organizations) - route to org dashboard (placeholder later)
  const isOrgAdmin = user.organizations?.some((o: any) => o.orgRole === 'ORG_ADMIN')
  if (isOrgAdmin) {
    // Until /org exists, send to admin shops as a safe fallback
    redirect('/admin/shops')
  }

  // Normal users: if any OWNER role → Backoffice, otherwise POS (cashier)
  const hasOwnerRole = user.shops?.some((s) => s.shopRole === 'SHOP_OWNER')
  if (hasOwnerRole) {
    redirect('/backoffice')
  }

  redirect('/pos')
}

