import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default async function Home() {
  const user = await getCurrentUser()

  // If unauthenticated, middleware should redirect to /login
  if (!user) {
    redirect('/login')
  }

  // Admins go to Admin
  if (user.role === 'ADMIN') {
    redirect('/admin')
  }

  // Normal users: if any OWNER role → Backoffice, otherwise POS (cashier)
  const hasOwnerRole = user.shops?.some((s) => s.shopRole === 'OWNER')
  if (hasOwnerRole) {
    redirect('/backoffice')
  }

  redirect('/pos')
}

