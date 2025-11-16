'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuth()

  // Don't show sidebar on login page
  if (pathname === '/login') {
    return null
  }

  // Compact POS mode: hide sidebar for pure CASHIER on POS route
  if (
    pathname?.startsWith('/pos') &&
    user &&
    user.role === 'NORMAL' &&
    user.shops?.length &&
    user.shops.every((s) => s.shopRole === 'CASHIER')
  ) {
    return null
  }

  // Define all navigation items with roles that can access them
  const posNav = [{ name: 'POS', href: '/pos', roles: ['SHOP_OWNER', 'CASHIER'] }]
  const backofficeNav = [
    { name: 'Dashboard', href: '/backoffice', roles: ['SHOP_OWNER'] },
    { name: 'Products', href: '/backoffice/products', roles: ['SHOP_OWNER'] },
    { name: 'Purchases', href: '/backoffice/purchases', roles: ['SHOP_OWNER'] },
    { name: 'Sales', href: '/backoffice/sales', roles: ['SHOP_OWNER'] },
    { name: 'Customers', href: '/backoffice/customers', roles: ['SHOP_OWNER'] },
    { name: 'Udhaar', href: '/backoffice/udhaar', roles: ['SHOP_OWNER'] },
    { name: 'Reports', href: '/backoffice/reports', roles: ['SHOP_OWNER'] },
  ]
  const adminNav = [
    { name: 'Admin', href: '/admin', roles: ['PLATFORM_ADMIN'] },
    { name: 'Shops', href: '/admin/shops', roles: ['PLATFORM_ADMIN'] },
  ]

  // Filter navigation based on user role
  const canSee = (item: { roles: string[] }) => {
    if (!user) return false

    // PLATFORM_ADMIN: show only admin section
    if (user.role === 'PLATFORM_ADMIN') return false

    // For NORMAL users, check shop roles
    if (user.role === 'NORMAL' && user.shops && user.shops.length > 0) {
      const userShopRoles = user.shops.map((s) => s.shopRole)
      const isOwner = userShopRoles.includes('SHOP_OWNER')
      const isCashier = userShopRoles.includes('CASHIER')

      // Check if user has required role for this nav item
      if (item.roles.includes('SHOP_OWNER') && isOwner) return true
      if (item.roles.includes('CASHIER') && isCashier) return true

      return false
    }

    return false
  }

  const posItems = posNav.filter(canSee)
  const backofficeItems = backofficeNav.filter(canSee)
  const adminItems = adminNav.filter(canSee)

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:pt-16">
      <div className="flex-1 flex flex-col min-h-0 bg-[hsl(var(--card))] border-r border-[hsl(var(--border))]">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <nav className="flex-1 px-2 space-y-4">
            {posItems.length > 0 && (
              <div>
                <div className="px-2 pb-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  POS
                </div>
                <div className="space-y-1">
                  {posItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href)
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`${
                          isActive
                            ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                        } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                      >
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {backofficeItems.length > 0 && (
              <div>
                <div className="px-2 pb-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Backoffice
                </div>
                <div className="space-y-1">
                  {backofficeItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href)
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`${
                          isActive
                            ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                        } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                      >
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {adminItems.length > 0 && (
              <div>
                <div className="px-2 pb-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Admin
                </div>
                <div className="space-y-1">
                  {adminItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href)
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`${
                          isActive
                            ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                        } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                      >
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </nav>
        </div>
      </div>
    </div>
  )
}

