'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { isPublicRoute } from '@/lib/auth/public-routes'

interface User {
  id: string
  name: string
  email: string
  phone?: string | null
  cnic?: string | null
  isWhatsApp?: boolean
  profileImageUrl?: string | null
  role: string
  organizations?: Array<{
    orgId: string
    orgRole: string
    organization: {
      id: string
      name: string
      status: string
    }
  }>
  currentOrgId?: string | null
  shops?: Array<{
    shopId: string
    shopRole: string
    // This person's seat for that shop. False = paused by a plan downgrade: they can sign
    // in and read everything, but cannot write. See lib/billing/seats.ts.
    seatActive?: boolean
    shop: {
      id: string
      name: string
      city: string | null
      phone?: string | null
      // Frozen shop: readable, not writable. See lib/billing/shop-state.ts.
      isActive?: boolean
      pausedAt?: string | null
      pausedReason?: 'OWNER_CLOSED' | 'PLAN_DOWNGRADE' | null
    }
  }>
  currentShopId?: string | null
  isDemoOrg?: boolean
  // Per-shop feature flags for the current shop (drives which features/toggles show).
  features?: {
    quotations: boolean
    serviceCharge: boolean
    deliveryCharge: boolean
    unitSplitting: boolean
    tradePricing: boolean
    batchExpiry: boolean
  }
  /**
   * Plan and subscription state. UI only: it decides what to render and what to
   * warn about. The server enforces the same rules independently, so a tampered
   * client gains nothing.
   */
  billing?: {
    enforced: boolean
    bypass: boolean
    planCode: string
    planName: string
    status: string
    canWrite: boolean
    daysLeft: number | null
    deadline: string | null
    inTrial: boolean
    inGrace: boolean
    features: string[]
    maxShops: number | null
    maxUsers: number | null
    maxCashiers: number | null
    allowOrgLevel: boolean
    agreedMonthlyPrice: number
    extraShops: number
    extraShopPrice: number | null
    cycle: string
    blockedReason: string
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  selectOrg: (orgId: string) => Promise<void>
  selectShop: (shopId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const hasFetchedRef = useRef(false)

  async function fetchUser() {
    // Prevent double-fetching (React Strict Mode in dev causes double render)
    if (hasFetchedRef.current) {
      return
    }

    hasFetchedRef.current = true

    try {
      const response = await fetch('/api/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
        hasFetchedRef.current = false // Reset on error so we can retry
      }
    } catch (error) {
      setUser(null)
      hasFetchedRef.current = false // Reset on error so we can retry
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  async function refreshUser() {
    hasFetchedRef.current = false // Reset flag to allow refetch
    await fetchUser()
  }

  async function selectShop(shopId: string) {
    try {
      const response = await fetch('/api/shop/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      })

      if (!response.ok) {
        throw new Error('Failed to select shop')
      }

      // Update client state for components that read it directly. The caller is
      // responsible for re-rendering server components (router.refresh in a
      // transition) so it can show a loader until the new shop's data arrives.
      if (user) {
        setUser({ ...user, currentShopId: shopId })
      }
    } catch (error) {
      console.error('Select shop error:', error)
      // If update fails, refresh user data
      await refreshUser()
    }
  }

  async function selectOrg(orgId: string) {
    try {
      const response = await fetch('/api/org/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })

      if (!response.ok) {
        throw new Error('Failed to select organization')
      }

      // Update client state; caller re-renders server components in a transition.
      if (user) {
        setUser({ ...user, currentOrgId: orgId })
      }
    } catch (error) {
      console.error('Select org error:', error)
      await refreshUser()
    }
  }

  // Fetch user only on initial mount
  useEffect(() => {
    fetchUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array - only run on mount

  // Protect routes - redirect to login if not authenticated.
  // Note: Middleware handles most redirects, but this is a fallback for client-side
  // navigation. It MUST honour the same public-route list as the middleware, or a
  // logged-out visitor gets bounced off pages the middleware just allowed (emailed
  // verify / reset links, shared receipts). '/' is exempt because it does its own
  // stale-session handling.
  useEffect(() => {
    if (!loading && !user && pathname !== '/' && !isPublicRoute(pathname)) {
      router.push('/login')
    }
  }, [user, loading, pathname, router])

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser, selectOrg, selectShop }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

