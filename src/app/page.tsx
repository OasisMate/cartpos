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
    redirect('/org')
  }

  // Normal users: if any SHOP_OWNER role → Shop dashboard, otherwise POS (cashier)
  const hasOwnerRole = user.shops?.some((s) => s.shopRole === 'SHOP_OWNER')
  if (hasOwnerRole) {
    redirect('/shop')
  }

  redirect('/pos')
}

