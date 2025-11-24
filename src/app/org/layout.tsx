import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { canManageOrgUsers } from '@/lib/permissions'

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  const orgId = user.currentOrgId

  if (!orgId) {
    redirect('/')
  }

  // CRITICAL: Store managers and cashiers should NOT access org routes
  // They should only see shop-level views
  const hasShopRole = user.shops && user.shops.length > 0
  const isOrgAdmin = canManageOrgUsers(user, orgId)
  
  // If user has shop roles but is NOT an org admin, block access
  if (hasShopRole && !isOrgAdmin && user.role !== 'PLATFORM_ADMIN') {
    // Redirect to their shop dashboard instead
    const firstShop = user.shops[0]
    if (firstShop) {
      redirect(`/store`)
    }
    redirect('/')
  }

  // If not an org admin and not platform admin, block access
  if (!isOrgAdmin && user.role !== 'PLATFORM_ADMIN') {
    redirect('/')
  }

  return <>{children}</>
}


