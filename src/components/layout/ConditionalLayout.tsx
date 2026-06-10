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
  // Public shareable receipt (/r/<token>): no login, no app chrome — the
  // customer should see only the receipt, not the shop's navigation.
  const isPublicReceipt = pathname.startsWith('/r/')

  // Don't wrap auth / public pages with AppShell
  if (isLoginPage || isSignupPage || isWaitingApprovalPage || isPublicReceipt) {
    return <>{children}</>
  }

  // Wrap authenticated pages with AppShell
  return <AppShell>{children}</AppShell>
}

