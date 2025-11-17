'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
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
    shop: {
      id: string
      name: string
      city: string | null
    }
  }>
  currentShopId?: string | null
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

      // Update user state directly instead of full refresh to avoid extra API calls
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

      // Update user state directly
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

  // Protect routes - redirect to login if not authenticated
  // Note: Middleware handles most redirects, but this is a fallback for client-side navigation
  useEffect(() => {
    if (!loading && !user && pathname !== '/login' && pathname !== '/signup' && pathname !== '/') {
      // Don't redirect if already on login page, signup page, or home
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

