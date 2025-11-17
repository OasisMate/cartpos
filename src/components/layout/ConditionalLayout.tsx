'use client'

import { usePathname } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  const isSignupPage = pathname === '/signup'
  const isWaitingApprovalPage = pathname === '/waiting-approval'

  // Don't wrap auth pages with AppShell
  if (isLoginPage || isSignupPage || isWaitingApprovalPage) {
    return <>{children}</>
  }

  // Wrap authenticated pages with AppShell
  return <AppShell>{children}</AppShell>
}

