'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { usePathname } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function Navbar() {
  const { user, logout, selectShop } = useAuth()
  const pathname = usePathname()

  // Don't show navbar on login page
  if (pathname === '/login') {
    return null
  }

  const currentShop = user?.shops?.find((s) => s.shopId === user.currentShopId)?.shop
  const hasMultipleShops = (user?.shops?.length || 0) > 1

  return (
    <nav className="bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] shadow-sm fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold">
                CartPOS
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {(user?.role === 'ADMIN' || user?.shops && user.shops.length > 0) && (
                <Link
                  href="/pos"
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center px-2 pt-1 text-sm font-medium"
                >
                  POS
                </Link>
              )}
              {(user?.role === 'ADMIN' || user?.shops?.some((s) => s.shopRole === 'OWNER')) && (
                <>
                  <Link
                    href="/backoffice"
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center px-2 pt-1 text-sm font-medium"
                  >
                    Backoffice
                  </Link>
                </>
              )}
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] inline-flex items-center px-2 pt-1 text-sm font-medium"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {hasMultipleShops && user?.shops && (
              <select
                value={user.currentShopId || ''}
                onChange={(e) => selectShop(e.target.value)}
                className="input h-9 w-[200px]"
              >
                {user.shops.map((s) => (
                  <option key={s.shopId} value={s.shopId}>
                    {s.shop.name}
                  </option>
                ))}
              </select>
            )}
            {currentShop && !hasMultipleShops && (
              <span className="text-sm text-[hsl(var(--muted-foreground))]">{currentShop.name}</span>
            )}
            {user && (
              <>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">{user.name}</span>
                <Button onClick={logout} variant="outline" size="sm">Logout</Button>
              </>
            )}
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center">
                <span className="text-[hsl(var(--muted-foreground))] text-sm">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

