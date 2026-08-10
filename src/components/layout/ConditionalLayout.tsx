'use client'

import { usePathname } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { isPublicRoute } from '@/lib/auth/public-routes'

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // Don't wrap auth / public pages with AppShell. A visitor on one of these has no
  // session, so app navigation would only offer links that bounce them to /login.
  // Covers /login, /signup, /verify-email, /forgot-password, /reset-password and
  // /r/<token> (public shareable receipt: the customer should see only the receipt).
  // '/waiting-approval' has a session but no usable shop yet, so it stays bare too.
  if (isPublicRoute(pathname) || pathname === '/waiting-approval') {
    return <>{children}</>
  }

  // Wrap authenticated pages with AppShell
  return <AppShell>{children}</AppShell>
}

